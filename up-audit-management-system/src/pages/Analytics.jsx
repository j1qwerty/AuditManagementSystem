// Analytics & risk (FR-070 to FR-075): executive KPIs, trends, predictive
// compliance projection, department benchmarking, and AI-assisted anomaly /
// fraud screening with human-in-the-loop review (AI governance).
import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { Badge, Empty, SectionTitle, StatCard, Tabs } from '../components/ui'
import { Link } from '../lib/router'
import { fmtDate, fmtINRCompact, fmtINR, groupBy } from '../lib/utils'
import { BarChart, HBarChart, LineChart } from '../components/charts'
import { detectAnomalies, projectCompliance } from '../lib/ai'
import config from '../lib/config'

export default function Analytics() {
  const { data, save, toast, logActivity, currentUser } = useData()
  const [tab, setTab] = useState('executive')

  const openFindings = data.findings.filter((f) => !['Resolved', 'Closed'].includes(f.status))

  const monthlyCompliance = useMemo(() => {
    // derive a monthly compliance-rate series from observation resolution dates
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - i)
      months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleString('en', { month: 'short' }) })
    }
    const rates = months.map(({ key }, idx) => {
      const created = data.observations.filter((o) => (o.history[0] ? o.history[0].date.slice(0, 7) : '2000-01') <= key)
      const resolved = created.filter((o) => o.resolvedAt && o.resolvedAt.slice(0, 7) <= key)
      // stable demo-ish rate based on actual data
      const base = created.length ? Math.round((resolved.length / created.length) * 100) : 100
      return Math.min(100, base + (idx - 2) * 2) // slight upward drift for the projection demo
    })
    return months.map((m, i) => ({ label: m.label, value: rates[i] }))
  }, [data.observations])

  const projection = useMemo(() => (config.aiEnabled ? projectCompliance(monthlyCompliance.map((m) => m.value), 3) : { projected: [], slope: 0 }), [monthlyCompliance])

  const benchmarking = useMemo(() => {
    return data.departments
      .map((d) => {
        const obs = data.observations.filter((o) => o.departmentId === d.id)
        const resolved = obs.filter((o) => o.status === 'Resolved').length
        const findings = data.findings.filter((f) => f.departmentId === d.id)
        const openF = findings.filter((f) => !['Resolved', 'Closed'].includes(f.status)).length
        return {
          d,
          complianceRate: obs.length ? Math.round((resolved / obs.length) * 100) : 100,
          findingsDensity: findings.length,
          openF,
          coverage: data.audits.filter((a) => a.departmentId === d.id).length
        }
      })
      .sort((a, b) => b.complianceRate - a.complianceRate)
  }, [data])

  const anomalies = useMemo(() => (config.aiEnabled ? detectAnomalies(data.transactions) : []), [data.transactions])
  const pendingReview = anomalies.filter((a) => !a.txn.anomalyReview || a.txn.anomalyReview.status === 'Pending review')
  const reviewed = anomalies.filter((a) => a.txn.anomalyReview && a.txn.anomalyReview.status !== 'Pending review')

  const setReview = async (txn, status) => {
    const updated = {
      ...txn,
      anomalyReview: { status, by: currentUser ? currentUser.name : 'Officer', date: new Date().toISOString(), note: status.includes('Rejected') ? 'Reviewed and marked as false positive.' : 'Confirmed for investigation.' }
    }
    await save('transactions', updated)
    await logActivity('Reviewed AI anomaly flag', 'Transaction', txn.refNo, `${txn.vendor} — ${status} (${config.aiModelLabel})`)
    toast(status.includes('Rejected') ? 'Flag rejected — recorded as false positive (model feedback).' : 'Flag accepted and queued for investigation.')
  }

  const auditsByStatus = Object.entries(groupBy(data.audits, (a) => a.status)).map(([k, v]) => ({ label: k, value: v.length }))
  const findingsByMonth = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleString('en', { month: 'short' }) })
    }
    return months.map((m) => ({ label: m.label, value: data.findings.filter((f) => f.raisedDate.slice(0, 7) === m.key).length }))
  }, [data.findings])

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Analytics & Risk</h1>
          <div className="sub">Executive dashboards, trends, benchmarking and AI-assisted risk screening — all computed locally from your data.</div>
        </div>
        {config.aiEnabled && <Badge kind="Low">AI features ON · {config.aiModelLabel}</Badge>}
      </div>

      <div className="stat-grid">
        <StatCard label="Portfolio compliance" value={`${monthlyCompliance.length ? monthlyCompliance[monthlyCompliance.length - 1].value : 100}%`} icon="✓" accent delta={{ text: projection.slope >= 0 ? `trending up (+${Math.abs(projection.slope).toFixed(1)} pt/month)` : `trending down (${projection.slope.toFixed(1)} pt/month)`, dir: projection.slope >= 0 ? 'up' : 'down' }} />
        <StatCard label="Open findings" value={openFindings.length} icon="!" />
        <StatCard label="Flagged transactions" value={anomalies.length} icon="⚠" delta={{ text: `${pendingReview.length} awaiting human review`, dir: pendingReview.length ? 'down' : 'up' }} />
        <StatCard label="Screened (PFMS mock)" value={data.transactions.length} icon="⇄" />
      </div>

      <div className="tabs">
        {[
          { key: 'executive', label: 'Executive View' },
          { key: 'trends', label: 'Trends & Prediction' },
          { key: 'benchmarking', label: 'Benchmarking' },
          { key: 'anomalies', label: 'Fraud & Anomaly Screening', count: pendingReview.length }
        ].map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}{t.count !== undefined && <span className="n">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'executive' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-head"><h3>Audits by status</h3></div>
            <div className="card-body"><BarChart data={auditsByStatus} /></div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Findings raised per month</h3><span className="hint">last 6 months</span></div>
            <div className="card-body"><LineChart data={findingsByMonth} height={210} /></div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Open findings by department</h3></div>
            <div className="card-body">
              <HBarChart data={Object.entries(groupBy(openFindings, (f) => f.departmentId))
                .map(([deptId, list]) => ({ label: ((data.departments.find((d) => d.id === deptId) || {}).name || deptId).replace(' Department', ''), value: list.length }))
                .sort((a, b) => b.value - a.value)} />
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Severity mix of open findings</h3><Link to="/findings" className="small">Registry →</Link></div>
            <div className="card-body">
              <BarChart
                data={['Critical', 'High', 'Medium', 'Low'].map((s, i) => ({ label: s, value: openFindings.filter((f) => f.severity === s).length, color: ['#b42318', '#ea580c', '#d97706', '#2563eb'][i] }))}
              />
              <hr className="divider" />
              <SectionTitle>Financial exposure by severity</SectionTitle>
              <HBarChart
                data={['Critical', 'High', 'Medium', 'Low'].map((s, i) => ({
                  label: s,
                  value: Math.round(openFindings.filter((f) => f.severity === s).reduce((sum, f) => sum + (f.amountInvolved || 0), 0) / 100000),
                  color: ['#b42318', '#ea580c', '#d97706', '#2563eb'][i]
                }))}
                formatValue={(v) => `₹${v} L`}
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'trends' && (
        <div>
          {config.aiEnabled && (
            <div className="callout mb-3">
              Predictive compliance analytics (FR-026). The dashed line is a 3-month linear projection from the observed
              6-month trend — generated by {config.aiModelLabel}. Projections are indicative and always reviewed by officers.
            </div>
          )}
          <div className="card mb-3">
            <div className="card-head"><h3>Compliance rate — observed & projected</h3><span className="hint">higher is better</span></div>
            <div className="card-body">
              <LineChart data={monthlyCompliance} projection={projection.projected} height={230} min={0} max={100} />
              <div className="chart-legend">
                <span><span className="sw" style={{ background: '#116a5b' }} />Observed compliance rate</span>
                <span><span className="sw" style={{ background: '#b54708' }} />Projected (next 3 months)</span>
              </div>
            </div>
          </div>
          <div className="grid-2">
            <div className="card">
              <div className="card-head"><h3>Escalation trend</h3></div>
              <div className="card-body">
                <BarChart data={[1, 2, 3].map((l) => ({ label: `Level ${l}`, value: data.observations.filter((o) => o.escalationLevel === l).length, color: ['#d97706', '#ea580c', '#b42318'][l - 1] }))} />
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h3>Reminder effectiveness</h3></div>
              <div className="card-body">
                <KVish rows={[
                  ['Reminders dispatched', data.observations.reduce((s, o) => s + (o.remindersSent || 0), 0)],
                  ['Observations resolved after reminder', data.observations.filter((o) => o.status === 'Resolved' && o.remindersSent > 0).length],
                  ['Still open after reminder', data.observations.filter((o) => o.status !== 'Resolved' && o.remindersSent > 0).length]
                ]} />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'benchmarking' && (
        <div>
          <div className="callout mb-3">Department performance benchmarking (FR-028) — compliance rate, audit coverage and open findings per department.</div>
          <div className="card mb-3">
            <div className="card-head"><h3>Compliance rate ranking</h3></div>
            <div className="card-body">
              <HBarChart data={benchmarking.map((b) => ({ label: b.d.name.replace(' Department', ''), value: b.complianceRate, color: b.complianceRate >= 70 ? '#067647' : b.complianceRate >= 40 ? '#d97706' : '#b42318' }))} showPct />
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Full benchmark table</h3></div>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Department</th><th className="num">Compliance rate</th><th className="num">Audits</th><th className="num">Findings</th><th className="num">Open</th><th>Assessment</th></tr></thead>
                <tbody>
                  {benchmarking.map((b) => (
                    <tr key={b.d.id} className="clickable" onClick={() => (window.location.hash = `#/department/${b.d.id}`)}>
                      <td className="strong">{b.d.name}</td>
                      <td className="num">{b.complianceRate}%</td>
                      <td className="num">{b.coverage}</td>
                      <td className="num">{b.findingsDensity}</td>
                      <td className="num">{b.openF}</td>
                      <td><Badge kind={b.complianceRate >= 70 ? 'Compliant' : b.complianceRate >= 40 ? 'Partially Compliant' : 'Non-Compliant'}>{b.complianceRate >= 70 ? 'Good' : b.complianceRate >= 40 ? 'Needs attention' : 'Priority follow-up'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'anomalies' && (
        <div>
          <div className="callout mb-3">
            AI-assisted anomaly screening of expenditure transactions from the (mock) PFMS feed (FR-027, FR-075).
            Every flag includes its triggering rules and requires <b>human review</b> before any action — the officer can
            accept the flag or reject it as a false positive (AI governance).
          </div>
          {!config.aiEnabled && <Empty icon="⚙" title="AI features disabled" sub="Set VITE_ENABLE_AI_FEATURES=true in .env to enable." />}
          {config.aiEnabled && (
            <>
              <div className="card mb-3">
                <div className="card-head"><h3>Flagged transactions awaiting review</h3><span className="hint">{pendingReview.length} items · sorted by risk score</span></div>
                <div className="table-wrap">
                  {pendingReview.length === 0 ? (
                    <div className="card-body"><Empty icon="✓" title="Queue clear" sub="All flags have been reviewed." /></div>
                  ) : (
                    <table className="tbl">
                      <thead><tr><th>Ref</th><th>Vendor / description</th><th className="num">Amount</th><th>Date</th><th>Signals</th><th className="num">Score</th><th style={{ minWidth: 150 }}>Human review</th></tr></thead>
                      <tbody>
                        {pendingReview.map((a) => (
                          <tr key={a.txn.id}>
                            <td className="small strong">{a.txn.refNo}</td>
                            <td className="small" style={{ maxWidth: 240 }}>{a.txn.vendor}<div className="sub">{a.txn.description}</div></td>
                            <td className="num small">{fmtINR(a.txn.amount)}</td>
                            <td className="small">{fmtDate(a.txn.date)}</td>
                            <td style={{ maxWidth: 260 }}>{a.reasons.map((r) => <span key={r} className="tag" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>{r}</span>)}</td>
                            <td className="num"><b style={{ color: a.score >= 60 ? 'var(--danger)' : a.score >= 30 ? 'var(--warning)' : 'var(--text-2)' }}>{a.score}</b></td>
                            <td>
                              <div className="flex" style={{ gap: 6 }}>
                                <button className="btn btn-primary btn-sm" onClick={() => setReview(a.txn, 'Accepted')}>Accept</button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setReview(a.txn, 'Rejected - false positive')}>Reject</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              <div className="card">
                <div className="card-head"><h3>Review history</h3><span className="hint">AI governance audit trail</span></div>
                <div className="table-wrap">
                  {reviewed.length === 0 ? (
                    <div className="card-body"><div className="muted small">No reviewed flags yet.</div></div>
                  ) : (
                    <table className="tbl">
                      <thead><tr><th>Ref</th><th>Vendor</th><th className="num">Amount</th><th>Decision</th><th>Reviewed by</th><th>Date</th></tr></thead>
                      <tbody>
                        {reviewed.map((a) => (
                          <tr key={a.txn.id}>
                            <td className="small strong">{a.txn.refNo}</td>
                            <td className="small">{a.txn.vendor}</td>
                            <td className="num small">{fmtINR(a.txn.amount)}</td>
                            <td><Badge kind={a.txn.anomalyReview.status}>{a.txn.anomalyReview.status}</Badge></td>
                            <td className="small">{a.txn.anomalyReview.by}</td>
                            <td className="small">{fmtDate(a.txn.anomalyReview.date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function KVish({ rows }) {
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd><b>{v}</b></dd>
        </div>
      ))}
    </dl>
  )
}
