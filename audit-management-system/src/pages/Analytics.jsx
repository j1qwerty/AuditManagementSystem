// Analytics & Risk - trends, department risk, benchmarking and the flagged
// transaction review queue. Charts show details on hover and navigate on click.
import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { navigate, getQuery } from '../lib/router'
import { Badge, DataTable, PageHead, Tabs, StatCard, Modal, RemarksBlock, SeverityBadge, InfoTip } from '../components/ui'
import { BarChart, HBarChart, LineChart, DonutChart, RiskHeatmap } from '../components/charts'
import { fmtINR, fmtINRCompact, fmtDate, daysFromNow } from '../lib/utils'
import { computeDepartmentRisk, detectAnomalies, projectCompliance } from '../lib/ai'

// only transactions whose anomaly score crosses the review threshold enter the queue
const REVIEW_THRESHOLD = 20

export default function Analytics() {
  const { data, save, notify, currentUser, can, toast, logActivity } = useData()
  const [tab, setTab] = useState(getQuery().get('tab') || 'overview')
  const [viewTxn, setViewTxn] = useState(null)
  const [reviewAction, setReviewAction] = useState(null) // {flag, action}
  const [remarks, setRemarks] = useState('')

  const deptName = (id) => (data.departments.find((d) => d.id === id) || {}).name || '—'

  const flags = useMemo(() => detectAnomalies(data.transactions).filter((f) => f.score >= REVIEW_THRESHOLD), [data.transactions])
  const pendingFlags = flags.filter((f) => (f.txn.anomalyReview || {}).status === 'Pending review')

  const monthlyFindings = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i)
      const key = d.toISOString().slice(0, 7)
      months.push({
        label: d.toLocaleString('en', { month: 'short' }),
        value: data.findings.filter((f) => f.raisedDate.slice(0, 7) === key).length,
        rows: [['Raised', data.findings.filter((f) => f.raisedDate.slice(0, 7) === key).length]]
      })
    }
    return months
  }, [data.findings])

  const complianceMonthly = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i)
      const key = d.toISOString().slice(0, 7)
      const raised = data.observations.filter((o) => (o.history[0] || {}).date && o.history[0].date.slice(0, 7) === key).length
      const resolved = data.observations.filter((o) => o.resolvedAt && o.resolvedAt.slice(0, 7) === key).length
      months.push({ label: d.toLocaleString('en', { month: 'short' }), value: resolved, raised, rows: [['Resolved', resolved], ['Raised', raised]] })
    }
    return months
  }, [data.observations])

  const complianceProjection = useMemo(() => {
    const rates = complianceMonthly.map((m) => (m.raised + m.value > 0 ? Math.round((m.value / (m.raised + m.value)) * 100) : 0))
    const { projected } = projectCompliance(rates, 3)
    return [...rates.map((v, i) => ({ label: complianceMonthly[i].label, value: v, rows: [['Compliance', `${v}%`]] })),
            ...projected.map((v, i) => ({ label: `+${i + 1}m`, value: Math.round(v), rows: [['Projected', `${Math.round(v)}%`]] }))]
  }, [complianceMonthly])

  const deptRisk = useMemo(
    () =>
      data.departments
        .map((d) => ({ d, ...computeDepartmentRisk(d, { findings: data.findings, observations: data.observations, audits: data.audits }) }))
        .sort((a, b) => b.score - a.score),
    [data]
  )

  const typeBar = useMemo(() => {
    const colors = { Financial: '#8b53ac', Performance: '#0f9d6e', Compliance: '#d97706', IT: '#0488fb', Forensic: '#ff3381' }
    return ['Financial', 'Performance', 'Compliance', 'IT', 'Forensic'].map((t) => ({
      label: t, value: data.audits.filter((a) => a.type === t).length, color: colors[t],
      rows: [['Audits', data.audits.filter((a) => a.type === t).length], ['Open findings', data.findings.filter((f) => { const a = data.audits.find((x) => x.id === f.auditId); return a && a.type === t && !['Resolved', 'Closed'].includes(f.status) }).length]]
    }))
  }, [data])

  const severityDonut = useMemo(() => {
    const colors = { Critical: '#cc004e', High: '#ff3381', Medium: '#d97706', Low: '#0488fb' }
    return ['Critical', 'High', 'Medium', 'Low'].map((s) => ({
      label: s, value: data.findings.filter((f) => f.severity === s).length, color: colors[s]
    }))
  }, [data.findings])

  const heatCells = useMemo(() => {
    const impactMap = { Low: 1, Medium: 2, High: 4, Critical: 5 }
    const cells = []
    data.audits.forEach((a) => {
      const likelihood = Math.max(1, Math.min(5, Math.ceil(a.riskScore / 20)))
      const impact = impactMap[a.priority] || 2
      let cell = cells.find((c) => c.impact === impact && c.likelihood === likelihood)
      if (!cell) { cell = { impact, likelihood, items: [] }; cells.push(cell) }
      cell.items.push({ title: `${a.code} · ${a.priority}` })
    })
    return cells
  }, [data.audits])

  const vendorFlags = useMemo(() => {
    const byVendor = {}
    flags.forEach((f) => {
      byVendor[f.txn.vendor] = (byVendor[f.txn.vendor] || 0) + f.txn.amount
    })
    return Object.entries(byVendor)
      .map(([label, value]) => ({ label, value, color: '#ff3381', rows: [['Flagged value', fmtINRCompact(value)]] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [flags])

  const reviewFlag = async () => {
    const { flag, action } = reviewAction
    const status = action === 'accept' ? 'Accepted' : 'Rejected - false positive'
    const txn = {
      ...flag.txn,
      anomalyReview: { status, by: currentUser.name, date: new Date().toISOString(), note: remarks }
    }
    await save('transactions', txn, { logAction: `Flagged payment ${action === 'accept' ? 'accepted' : 'rejected'}`, logDetail: `${txn.refNo} — ${txn.vendor}`, logRemarks: remarks })
    await notify(data.users.filter((u) => u.role === 'cao' && u.id !== currentUser.id).map((u) => u.id), 'Integration',
      `Flagged payment ${status}`, `${txn.refNo} · ${txn.vendor} — reviewed by ${currentUser.name}${remarks ? ` — ${remarks}` : ''}`, '#/analytics?tab=flagged', remarks)
    setReviewAction(null); setRemarks(''); setViewTxn(null)
    toast(`Payment review recorded — ${status}`)
  }

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'trends', label: 'Trends & Projection' },
    { key: 'risk', label: 'Risk Matrix' },
    { key: 'flagged', label: 'Flagged Payments', count: pendingFlags.length }
  ]

  return (
    <div>
      <PageHead
        title="Analytics & Risk"
        sub="Portfolio analytics, department risk scoring and payment anomaly screening"
        actions={can('risk.recalculate') ? <button className="btn btn-secondary" onClick={async () => { await logActivity('Recalculated risk scores', 'System', 'risk', 'Risk scores recomputed from the analytics module'); toast('Risk scores recalculated') }}>↻ Recalculate Risk</button> : null}
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div>
          <div className="grid grid-4 mb-3">
            <StatCard label="Audits This Cycle" value={data.audits.length} strip="#8b53ac" foot={`${data.audits.filter((a) => ['Completed', 'Closed'].includes(a.status)).length} completed`} onClick={() => navigate('/audits')} />
            <StatCard label="Findings Raised" value={data.findings.length} strip="#ff3381" foot={`${data.findings.filter((f) => !['Resolved', 'Closed'].includes(f.status)).length} still open`} onClick={() => navigate('/findings')} />
            <StatCard label="Flagged Payments" value={pendingFlags.length} strip="#d97706" foot="awaiting review" onClick={() => setTab('flagged')} />
            <StatCard label="High-Risk Departments" value={deptRisk.filter((r) => r.score >= 55).length} strip="#cc004e" foot="score ≥ 55" onClick={() => setTab('risk')} />
          </div>
          <div className="grid grid-3">
            <div className="card">
              <div className="card-head"><h3>Audits by Type</h3><span className="hint">click a bar → audits</span></div>
              <div className="card-pad">
                <BarChart data={typeBar} onItemClick={(d) => navigate(`/audits?type=${encodeURIComponent(d.label)}`)} height={190} />
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h3>Findings by Severity</h3><span className="hint">click → findings registry</span></div>
              <div className="card-pad">
                <DonutChart data={severityDonut} centerValue={data.findings.length} centerLabel="findings" onItemClick={(d) => navigate(`/findings?severity=${encodeURIComponent(d.label)}`)} />
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h3>Top Risk Departments</h3><span className="hint">click → department</span></div>
              <div className="card-pad">
                <HBarChart
                  data={deptRisk.slice(0, 6).map((r) => ({ label: r.d.code, value: r.score, color: r.score >= 75 ? '#cc004e' : r.score >= 55 ? '#d97706' : '#8b53ac', rows: [['Score', r.score], ['Rating', r.rating], ['Top factor', r.factors[0].key]] }))}
                  formatValue={(v) => v}
                  onItemClick={(d) => navigate(`/department/${(deptRisk.find((r) => r.d.code === d.label) || {}).d.id}`)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'trends' && (
        <div className="grid grid-2">
          <div className="card">
            <div className="card-head"><h3>Findings Raised — 6 Months</h3><span className="hint">click a point → findings</span></div>
            <div className="card-pad">
              <LineChart data={monthlyFindings} valueLabel="Findings" onItemClick={() => navigate('/findings')} />
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Compliance Rate & Projection <InfoTip text="Resolved vs raised observations per month. The dashed segment is a 3-month linear projection." /></h3></div>
            <div className="card-pad">
              <LineChart data={complianceProjection} valueLabel="%" height={190} />
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Flagged Value by Vendor</h3><span className="hint">payment anomaly screening</span></div>
            <div className="card-pad">
              <HBarChart data={vendorFlags} formatValue={(v) => fmtINRCompact(v)} onItemClick={() => setTab('flagged')} />
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Department Benchmarking</h3><span className="hint">compliance rate vs open findings</span></div>
            <div className="card-pad">
              <HBarChart
                data={deptRisk.slice(0, 8).map((r) => ({
                  label: r.d.code, value: r.score, color: '#0488fb',
                  rows: [['Risk score', r.score], ['Open findings', data.findings.filter((f) => f.departmentId === r.d.id && !['Resolved', 'Closed'].includes(f.status)).length], ['Resolved obs.', data.observations.filter((o) => o.departmentId === r.d.id && o.status === 'Resolved').length]]
                }))}
                formatValue={(v) => v}
                onItemClick={(d) => navigate(`/department/${(deptRisk.find((r) => r.d.code === d.label) || {}).d.id}`)}
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'risk' && (
        <div className="flex-col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><h3>Audit Risk Heatmap</h3><span className="hint">impact (priority) × likelihood (risk score) — click a cell</span></div>
            <div className="card-pad">
              <RiskHeatmap
                cells={heatCells}
                onCellClick={() => navigate('/audits')}
              />
            </div>
          </div>
          <DataTable
            rows={deptRisk}
            columns={[
              { key: 'name', label: 'Department', sortable: true, sort: (r) => r.d.name, render: (r) => <div><div className="cell-strong">{r.d.name}</div><div className="cell-sub">{r.d.code}</div></div> },
              { key: 'score', label: 'Risk Score', num: true, sortable: true, render: (r) => <b className="num">{r.score}</b> },
              { key: 'rating', label: 'Rating', sortable: true, render: (r) => <span className={`badge ${r.rating === 'Critical' ? 'danger' : r.rating === 'High' ? 'warning' : r.rating === 'Moderate' ? 'info' : 'success'}`}>{r.rating}</span> },
              ...r0factors(),
              { key: '__actions', label: '', render: (r) => <div className="row-actions"><button className="btn-icon" title="Open department" onClick={() => navigate(`/department/${r.d.id}`)}>↗</button></div> }
            ]}
            searchKeys={[(r) => r.d.name, (r) => r.rating]}
            searchPlaceholder="Search departments…"
            rowClick={(r) => navigate(`/department/${r.d.id}`)}
            csvName="risk-scores"
            emptyTitle="No departments"
          />
        </div>
      )}

      {tab === 'flagged' && (
        <div>
          <div className="flex-between mb-2">
            <div className="muted small">
              {pendingFlags.length} payments awaiting review · {flags.length - pendingFlags.length} already reviewed.
              <InfoTip text="Payments are screened automatically for duplicates, round-figure transfers, split purchases below approval thresholds, weekend activity and vendor concentration." right />
            </div>
          </div>
          <DataTable
            rows={flags.filter((f) => (f.txn.anomalyReview || {}).status === 'Pending review')}
            columns={[
              { key: 'refNo', label: 'Reference', sortable: true, render: (f) => <span className="mono">{f.txn.refNo}</span> },
              { key: 'vendor', label: 'Vendor', sortable: true, render: (f) => f.txn.vendor },
              { key: 'departmentId', label: 'Department', sortable: true, sort: (f) => deptName(f.txn.departmentId), render: (f) => <span className="small">{deptName(f.txn.departmentId)}</span> },
              { key: 'amount', label: 'Amount', num: true, sortable: true, render: (f) => <b className="num">{fmtINR(f.txn.amount)}</b> },
              { key: 'date', label: 'Date', sortable: true, sort: (f) => f.txn.date, render: (f) => <span className="small nowrap">{fmtDate(f.txn.date)}</span> },
              { key: 'score', label: 'Risk Score', num: true, sortable: true, render: (f) => <span className={`badge ${f.score >= 50 ? 'danger' : 'warning'}`}>{f.score}</span> },
              { key: 'reasons', label: 'Reasons', sortable: false, render: (f) => <span className="small muted ellipsis" style={{ maxWidth: 240 }} title={f.reasons.join(' · ')}>{f.reasons.length} rule(s)</span> },
              {
                key: '__actions', label: '', render: (f) => (
                  <div className="row-actions">
                    <button className="btn-icon" title="View details" onClick={() => setViewTxn(f)}>👁</button>
                  </div>
                )
              }
            ]}
            searchKeys={[(f) => f.txn.refNo, 'vendor', (f) => deptName(f.txn.departmentId)]}
            searchPlaceholder="Search payments…"
            rowClick={(f) => setViewTxn(f)}
            emptyTitle="No payments awaiting review"
            emptySub="All flagged payments have been reviewed."
          />
          {/* reviewed history */}
          <div className="card mt-3">
            <div className="card-head"><h3>Review History</h3><span className="hint">recently reviewed flags</span></div>
            <div className="card-pad">
              {flags.filter((f) => (f.txn.anomalyReview || {}).status !== 'Pending review').length === 0 && <div className="muted small">Nothing reviewed yet.</div>}
              {flags.filter((f) => (f.txn.anomalyReview || {}).status !== 'Pending review').slice(0, 6).map((f, i) => (
                <div key={i} className="flex-between" style={{ padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
                  <div>
                    <span className="bold small">{f.txn.refNo}</span> <span className="muted small">· {f.txn.vendor} · {fmtINR(f.txn.amount)}</span>
                    {f.txn.anomalyReview.note && <div className="muted tiny">“{f.txn.anomalyReview.note}”</div>}
                  </div>
                  <span className="flex" style={{ gap: 8 }}>
                    <span className="muted tiny">{f.txn.anomalyReview.by} · {fmtDate(f.txn.anomalyReview.date)}</span>
                    <Badge kind={f.txn.anomalyReview.status}>{f.txn.anomalyReview.status}</Badge>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* transaction detail */}
      <Modal open={!!viewTxn} onClose={() => setViewTxn(null)} title={viewTxn ? `Flagged Payment — ${viewTxn.txn.refNo}` : ''} sub={viewTxn ? `${viewTxn.txn.vendor} · ${fmtINR(viewTxn.txn.amount)}` : ''} size="lg">
        {viewTxn && (
          <div>
            <div className="grid grid-3 mb-2">
              <div><span className="muted tiny">DEPARTMENT</span><div className="small bold">{deptName(viewTxn.txn.departmentId)}</div></div>
              <div><span className="muted tiny">DATE / MODE</span><div className="small bold">{fmtDate(viewTxn.txn.date)} · {viewTxn.txn.mode}</div></div>
              <div><span className="muted tiny">RISK SCORE</span><div className="small bold"><span className={`badge ${viewTxn.score >= 50 ? 'danger' : 'warning'}`}>{viewTxn.score}/100</span></div></div>
            </div>
            <p className="small" style={{ color: 'var(--text-2)' }}><span className="bold">Description: </span>{viewTxn.txn.description}</p>
            <div className="tl-body" style={{ background: 'var(--warning-soft)' }}>
              <div className="bold small">Why this was flagged</div>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {viewTxn.reasons.map((r, i) => <li key={i} className="small">{r}</li>)}
              </ul>
            </div>
            {(viewTxn.txn.anomalyReview || {}).status !== 'Pending review' ? (
              <div className="tl-body mt-2" style={{ background: 'var(--success-soft)' }}>
                <span className="bold">Reviewed: </span>{viewTxn.txn.anomalyReview.status} by {viewTxn.txn.anomalyReview.by}
                {viewTxn.txn.anomalyReview.note && <div className="small mt-1">“{viewTxn.txn.anomalyReview.note}”</div>}
              </div>
            ) : (
              can('anomaly.review') && (
                <div className="flex mt-3" style={{ gap: 8 }}>
                  <button className="btn btn-success" onClick={() => { setReviewAction({ flag: viewTxn, action: 'accept' }); setRemarks('') }}>✓ Confirm Anomaly</button>
                  <button className="btn btn-secondary" onClick={() => { setReviewAction({ flag: viewTxn, action: 'reject' }); setRemarks('') }}>✕ False Positive</button>
                </div>
              )
            )}
          </div>
        )}
      </Modal>

      {/* review with remarks */}
      <Modal
        open={!!reviewAction} onClose={() => setReviewAction(null)}
        title={reviewAction ? (reviewAction.action === 'accept' ? 'Confirm Anomaly' : 'Mark as False Positive') : ''}
        sub={reviewAction ? `${reviewAction.flag.txn.refNo} · ${fmtINR(reviewAction.flag.txn.amount)}` : ''}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setReviewAction(null)}>Cancel</button>
            <button className={`btn ${reviewAction && reviewAction.action === 'accept' ? 'btn-danger' : 'btn-primary'}`} disabled={!remarks.trim()} onClick={reviewFlag}>
              {reviewAction && reviewAction.action === 'accept' ? 'Confirm' : 'Mark False Positive'}
            </button>
          </>
        }
      >
        <RemarksBlock label="Review remarks" required value={remarks} onChange={setRemarks} placeholder="Justification for the decision - recorded in the activity trail and notifications" />
      </Modal>
    </div>
  )
}

function r0factors() {
  // risk factor columns for the department risk table
  const names = ['Unresolved critical findings', 'Open compliance observations', 'Time since last completed audit', 'Budget exposure']
  return names.map((n, i) => ({
    key: `f${i}`, label: i === 0 ? 'Critical Findings' : i === 1 ? 'Open Obs.' : i === 2 ? 'Since Audit' : 'Budget',
    sortable: true, sort: (r) => r.factors[i].points,
    render: (r) => <span className="small num" title={`${r.factors[i].key} — ${r.factors[i].detail}`}>{r.factors[i].value}</span>
  }))
}
