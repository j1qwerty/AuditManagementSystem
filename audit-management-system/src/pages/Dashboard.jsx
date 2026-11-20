// Dashboard: role-aware overview with clickable KPIs, charts and tables.
// Every chart segment navigates to the relevant page with filters applied.
import { useMemo } from 'react'
import { useData } from '../context/DataContext'
import { navigate, Link } from '../lib/router'
import { Badge, PageHead, StatCard, Progress, Empty, SeverityBadge, TypeBadge, Avatar } from '../components/ui'
import { DonutChart, HBarChart, LineChart, Sparkline } from '../components/charts'
import { fmtDate, fmtRelative, daysFromNow, fmtINRCompact, groupBy } from '../lib/utils'
import { ROLES } from '../lib/permissions'
import { suggestedProgress, detectAnomalies } from '../lib/ai'
import config from '../lib/config'

export default function Dashboard() {
  const { data, currentUser, can } = useData()
  const role = currentUser.role

  const isAuditTeam = ['admin', 'director', 'cao', 'senior', 'junior'].includes(role)
  const isCoordinator = role === 'coordinator'

  // ---------------- shared metrics ----------------
  const m = useMemo(() => {
    const active = data.audits.filter((a) => ['In Progress', 'Under Review'].includes(a.status))
    const openFindings = data.findings.filter((f) => !['Resolved', 'Closed'].includes(f.status))
    const critical = openFindings.filter((f) => f.severity === 'Critical').length
    const overdueObs = data.observations.filter((o) => o.status !== 'Resolved' && new Date(o.dueDate) < new Date())
    const resolvedObs = data.observations.filter((o) => o.status === 'Resolved')
    const complianceRate = data.observations.length ? Math.round((resolvedObs.length / data.observations.length) * 100) : 0
    const pendingReview = data.audits.filter((a) => a.status === 'Under Review')
    const reportsInReview = data.reports.filter((r) => ['In Review', 'Approved'].includes(r.status))
    const flagged = detectAnomalies(data.transactions).filter((f) => f.score >= 20 && (f.txn.anomalyReview || {}).status === 'Pending review')
    return { active, openFindings, critical, overdueObs, resolvedObs, complianceRate, pendingReview, reportsInReview, flagged }
  }, [data])

  // ---------------- my scope ----------------
  const myAudits = useMemo(() => {
    if (isCoordinator) return data.audits.filter((a) => a.departmentId === currentUser.departmentId)
    return data.audits.filter((a) => a.leadAuditorId === currentUser.id || a.team.some((t) => t.userId === currentUser.id))
  }, [data.audits, currentUser, isCoordinator])

  const myDeptFindings = useMemo(() => {
    if (!isCoordinator) return []
    return data.findings.filter((f) => f.departmentId === currentUser.departmentId && !['Resolved', 'Closed'].includes(f.status))
  }, [data.findings, currentUser, isCoordinator])

  // charts ------------------------------------------------------------------
  const statusDonut = useMemo(() => {
    const groups = groupBy(data.audits, (a) => a.status)
    const colors = { 'Planned': '#ba98cd', 'Scheduled': '#68b7fd', 'In Progress': '#d97706', 'Under Review': '#8b53ac', 'Completed': '#0f9d6e', 'Closed': '#8d7f9a' }
    return Object.entries(groups).map(([label, list]) => ({ label, value: list.length, color: colors[label], filter: label }))
  }, [data.audits])

  const severityBar = useMemo(() => {
    const order = ['Critical', 'High', 'Medium', 'Low']
    const colors = { Critical: '#cc004e', High: '#ff3381', Medium: '#d97706', Low: '#0488fb' }
    return order.map((s) => ({ label: s, value: m.openFindings.filter((f) => f.severity === s).length, color: colors[s] }))
  }, [m.openFindings])

  const deptRisk = useMemo(() => {
    const byDept = groupBy(data.findings.filter((f) => !['Resolved', 'Closed'].includes(f.status)), (f) => {
      const d = data.departments.find((x) => x.id === f.departmentId)
      return d ? d.code : '—'
    })
    return Object.entries(byDept)
      .map(([label, list]) => ({ label, value: list.length, color: '#8b53ac' }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [data.findings, data.departments])

  const monthly = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleString('en', { month: 'short' })
      const acts = data.activity.filter((a) => a.timestamp.slice(0, 7) === key).length
      const finds = data.findings.filter((f) => f.raisedDate.slice(0, 7) === key).length
      months.push({ label, value: acts, sub: [['Findings raised', finds]], rows: [['Activities', acts], ['Findings raised', finds]], key })
    }
    return months
  }, [data.activity, data.findings])

  // deadlines ----------------------------------------------------------------
  const deadlines = useMemo(() => {
    const items = []
    data.observations.filter((o) => o.status !== 'Resolved').forEach((o) =>
      items.push({ kind: 'Observation', title: o.title, due: o.dueDate, to: '/compliance', late: daysFromNow(o.dueDate) < 0 })
    )
    data.findings.filter((f) => !['Resolved', 'Closed'].includes(f.status)).forEach((f) =>
      items.push({ kind: 'Finding', title: f.title, due: f.dueDate, to: '/findings', late: daysFromNow(f.dueDate) < 0 })
    )
    data.audits.filter((a) => ['In Progress', 'Under Review'].includes(a.status)).forEach((a) =>
      items.push({ kind: 'Audit', title: `${a.code} · ${a.title}`, due: a.endDate, to: `/audit/${a.id}`, late: daysFromNow(a.endDate) < 0 })
    )
    return items.sort((a, b) => new Date(a.due) - new Date(b.due)).slice(0, 7)
  }, [data])

  const recentActivity = useMemo(
    () => [...data.activity].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 8),
    [data.activity]
  )

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const quickActions = []
  if (can('audit.create')) quickActions.push({ label: '+ New Audit', to: '/planning?tab=plan' })
  if (can('report.create')) quickActions.push({ label: 'Generate Report', to: '/reports?tab=generate' })
  if (can('document.upload')) quickActions.push({ label: 'Upload Document', to: '/documents' })
  if (isCoordinator) quickActions.push({ label: 'My Findings', to: '/findings' })

  return (
    <div>
      <PageHead
        title={`${greet}, ${currentUser.name.split(' ')[0]}`}
        sub={`${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · FY ${config.fiscalYear} · ${ROLES[role].label}`}
        actions={quickActions.map((a) => (
          <button key={a.label} className="btn btn-secondary" onClick={() => navigate(a.to)}>{a.label}</button>
        ))}
      />

      {/* ---------------- KPI cards ---------------- */}
      <div className="grid grid-5 mb-3">
        <StatCard label="Active Audits" value={m.active.length} icon={{ glyph: '☰', color: '#70428a', soft: '#f3eef7' }} strip="#8b53ac"
          foot={`${data.audits.filter((a) => a.status === 'Planned').length} planned · ${m.pendingReview.length} in review`}
          onClick={() => navigate('/audits')} />
        <StatCard label="Open Findings" value={m.openFindings.length} icon={{ glyph: '!', color: '#cc004e', soft: '#ffe5ef' }} strip="#ff3381"
          foot={`${m.critical} critical severity`}
          onClick={() => navigate('/findings')} />
        <StatCard label="Overdue Compliance" value={m.overdueObs.length} icon={{ glyph: '⏰', color: '#c21f38', soft: '#ffe9ed' }} strip="#e0364f"
          foot={`${data.observations.filter((o) => o.status !== 'Resolved').length - m.overdueObs.length} on track`}
          onClick={() => navigate('/compliance')} />
        <StatCard label="Compliance Rate" value={`${m.complianceRate}%`} icon={{ glyph: '✓', color: '#0b7f58', soft: '#e7f6ef' }} strip="#0f9d6e"
          foot={`${m.resolvedObs.length} of ${data.observations.length} observations resolved`}
          onClick={() => navigate('/compliance')} />
        <StatCard label="Flagged Payments" value={m.flagged.length} icon={{ glyph: '⚠', color: '#b45f06', soft: '#fdf3e3' }} strip="#d97706"
          foot="Awaiting anomaly review"
          onClick={() => navigate('/analytics?tab=flagged')} />
      </div>

      {/* ---------------- charts row ---------------- */}
      <div className="grid grid-3 mb-3">
        <div className="card">
          <div className="card-head"><h3>Audit Portfolio by Status</h3><span className="hint">{data.audits.length} total</span></div>
          <div className="card-pad">
            <DonutChart
              data={statusDonut}
              centerValue={data.audits.length}
              centerLabel="audits"
              onItemClick={(d) => navigate(`/audits?status=${encodeURIComponent(d.filter)}`)}
            />
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Open Findings by Severity</h3><span className="hint">click to open registry</span></div>
          <div className="card-pad">
            <HBarChart
              data={severityBar}
              formatValue={(v) => v}
              onItemClick={(d) => navigate(`/findings?severity=${encodeURIComponent(d.label)}`)}
            />
            <div className="mt-2 muted small">Highest concentration: {deptRisk[0] ? `${deptRisk[0].label} (${deptRisk[0].value} findings)` : '—'}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Workspace Activity — 6 Months</h3><span className="hint">click a month for analytics</span></div>
          <div className="card-pad">
            <LineChart
              data={monthly}
              valueLabel="Actions"
              height={150}
              onItemClick={(d) => navigate('/analytics')}
            />
            <div className="flex-between mt-2">
              <span className="muted small">Trend across all modules</span>
              <span className="muted small bold">{monthly.reduce((s, x) => s + x.value, 0)} actions</span>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- approvals strip (CAO / Director / Admin) ---------------- */}
      {(role === 'cao' || role === 'director' || role === 'admin') && (
        <div className="grid grid-2 mb-3">
          <div className="card card-hover">
            <div className="card-head"><h3>Pending My Approval</h3><Link className="link small" to="/audits?status=Under%20Review">View all →</Link></div>
            <div className="card-pad" style={{ paddingTop: 6 }}>
              {m.pendingReview.length === 0 && m.reportsInReview.length === 0 && (
                <Empty icon="✓" title="Nothing waiting" sub="Audits and reports you review are up to date." />
              )}
              {m.pendingReview.map((a) => (
                <div key={a.id} className="flex-between" style={{ padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
                  <div style={{ minWidth: 0 }}>
                    <Link className="link ellipsis" to={`/audit/${a.id}`} style={{ display: 'block', maxWidth: 380 }}>{a.code} · {a.title}</Link>
                    <span className="muted tiny">{a.leadAuditorName} · field work complete</span>
                  </div>
                  <Badge kind={a.status}>{a.status}</Badge>
                </div>
              ))}
              {m.reportsInReview.filter((r) => (role === 'director' ? r.status === 'Approved' : r.status === 'In Review')).map((r) => (
                <div key={r.id} className="flex-between" style={{ padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
                  <div style={{ minWidth: 0 }}>
                    <Link className="link ellipsis" to="/reports" style={{ display: 'block', maxWidth: 380 }}>{r.title}</Link>
                    <span className="muted tiny">v{r.version} · {r.generatedByName}</span>
                  </div>
                  <Badge kind={r.status}>{r.status === 'Approved' ? 'Awaiting final issue' : r.status}</Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Department Risk Radar</h3><Link className="link small" to="/analytics?tab=risk">Full risk matrix →</Link></div>
            <div className="card-pad">
              <HBarChart
                data={deptRisk}
                formatValue={(v) => `${v}`}
                onItemClick={(d) => navigate(`/findings?dept=${encodeURIComponent(d.label)}`)}
              />
              <div className="mt-2 muted small">Open findings by department code — click a bar to open the findings registry.</div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- coordinator view ---------------- */}
      {isCoordinator && (
        <div className="grid grid-2 mb-3">
          <div className="card">
            <div className="card-head"><h3>Findings Awaiting Department Response</h3><Link className="link small" to="/findings">View all →</Link></div>
            <div className="card-pad" style={{ paddingTop: 4 }}>
              {myDeptFindings.length === 0 && <Empty icon="✓" title="All responses submitted" sub="No findings are pending from your department." />}
              {myDeptFindings.slice(0, 5).map((f) => (
                <div key={f.id} className="flex-between" style={{ padding: '9px 0', borderBottom: '1px dashed var(--border)' }}>
                  <div style={{ minWidth: 0 }}>
                    <Link className="link ellipsis" to="/findings" style={{ display: 'block', maxWidth: 360 }}>{f.title}</Link>
                    <span className="muted tiny">{f.auditCode} · due {fmtDate(f.dueDate)}{daysFromNow(f.dueDate) < 0 ? ' · overdue' : ''}</span>
                  </div>
                  <SeverityBadge s={f.severity} />
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>My Department's Audits</h3><span className="hint">{myAudits.length} engagements</span></div>
            <div className="card-pad" style={{ paddingTop: 4 }}>
              {myAudits.length === 0 && <Empty icon="☰" title="No audits" sub="Your department has no engagements yet." />}
              {myAudits.slice(0, 5).map((a) => (
                <div key={a.id} className="flex-between" style={{ padding: '9px 0', borderBottom: '1px dashed var(--border)' }}>
                  <div style={{ minWidth: 0 }}>
                    <Link className="link ellipsis" to={`/audit/${a.id}`} style={{ display: 'block', maxWidth: 340 }}>{a.code} · {a.title}</Link>
                    <span className="muted tiny">{a.leadAuditorName || 'Lead not assigned'}</span>
                  </div>
                  <Badge kind={a.status}>{a.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- tables row ---------------- */}
      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <h3>{isCoordinator ? "Department Audit Progress" : isAuditTeam ? 'My Assignments' : 'All Active Audits'}</h3>
            <Link className="link small" to="/audits">Open audits →</Link>
          </div>
          <div className="table-scroll">
            <table className="table" style={{ fontSize: 12 }}>
              <thead>
                <tr><th>Audit</th><th>Type</th><th>Lead</th><th style={{ width: 110 }}>Progress</th><th>Ends</th></tr>
              </thead>
              <tbody>
                {(isCoordinator ? myAudits : myAudits.length ? myAudits : m.active).slice(0, 6).map((a) => {
                  const progress = suggestedProgress(a)
                  return (
                    <tr key={a.id} className="clickable" onClick={() => navigate(`/audit/${a.id}`)}>
                      <td>
                        <div className="cell-strong ellipsis" style={{ maxWidth: 240 }}>{a.code}</div>
                        <div className="cell-sub ellipsis" style={{ maxWidth: 240 }}>{a.title}</div>
                      </td>
                      <td><TypeBadge t={a.type} /></td>
                      <td>{a.leadAuditorName || '—'}</td>
                      <td>
                        <div className="flex" style={{ gap: 7 }}>
                          <Progress value={progress} className={progress >= 80 ? 'success' : progress >= 40 ? 'warning' : 'bad'} />
                          <span className="small bold num">{progress}%</span>
                        </div>
                      </td>
                      <td className="nowrap">{fmtDate(a.endDate)}</td>
                    </tr>
                  )
                })}
                {((isCoordinator ? myAudits : myAudits.length ? myAudits : m.active)).length === 0 && (
                  <tr><td colSpan={5}><Empty icon="☰" title="No active assignments" sub="Assignments will appear here once added to an audit team." /></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Upcoming & Overdue Deadlines</h3><span className="hint">across findings, observations and audits</span></div>
          <div className="card-pad" style={{ paddingTop: 4 }}>
            {deadlines.length === 0 && <Empty icon="✓" title="No deadlines" sub="Nothing due in the tracked pipeline." />}
            {deadlines.map((d, i) => (
              <div key={i} className="flex-between clickable" style={{ padding: '8px 0', borderBottom: '1px dashed var(--border)' }} onClick={() => navigate(d.to)}>
                <div style={{ minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontWeight: 600, color: 'var(--text)', maxWidth: 380 }}>{d.title}</div>
                  <span className="muted tiny">{d.kind} · due {fmtDate(d.due)}</span>
                </div>
                <span className={`badge ${d.late ? 'danger' : 'warning'}`}>{d.late ? 'Overdue' : `${daysFromNow(d.due)}d left`}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- activity feed ---------------- */}
      <div className="card mt-3">
        <div className="card-head"><h3>Recent Activity</h3><Link className="link small" to="/activity">Full activity log →</Link></div>
        <div className="card-pad">
          <div className="grid grid-2" style={{ gap: 20 }}>
            <div className="timeline">
              {recentActivity.slice(0, 4).map((a) => (
                <div key={a.id} className="tl-item">
                  <span className="tl-dot" />
                  <div className="tl-title">{a.userName} — {a.action}</div>
                  <div className="tl-meta">{a.entityType} · {fmtRelative(a.timestamp)} · IP {a.ip || '—'}</div>
                </div>
              ))}
            </div>
            <div className="timeline">
              {recentActivity.slice(4, 8).map((a) => (
                <div key={a.id} className="tl-item">
                  <span className="tl-dot" />
                  <div className="tl-title">{a.userName} — {a.action}</div>
                  <div className="tl-meta">{a.entityType} · {fmtRelative(a.timestamp)} · IP {a.ip || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
