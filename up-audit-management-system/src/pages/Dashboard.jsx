// Role-aware dashboard (FR-035, FR-070, FR-071): each role sees the view
// that matters for its job - executive overview, operations or department.
import { useMemo } from 'react'
import { useData } from '../context/DataContext'
import { Link } from '../lib/router'
import { StatCard, Badge, SeverityBadge, TypeBadge, Progress, PROGRESS_CLASS, Empty, SectionTitle } from '../components/ui'
import { DonutChart, HBarChart, LineChart } from '../components/charts'
import { fmtDate, fmtINRCompact, daysFromNow, fmtRelative, fmtINR, groupBy } from '../lib/utils'
import { computeDepartmentRisk } from '../lib/ai'

export default function Dashboard() {
  const { data, currentUser } = useData()
  const role = currentUser.role

  const stats = useMemo(() => {
    const audits = data.audits
    const active = audits.filter((a) => ['In Progress', 'Under Review'].includes(a.status))
    const openFindings = data.findings.filter((f) => !['Resolved', 'Closed'].includes(f.status))
    const critical = openFindings.filter((f) => f.severity === 'Critical').length
    const overdueObs = data.observations.filter((o) => o.status !== 'Resolved' && new Date(o.dueDate) < new Date())
    const resolved = data.observations.filter((o) => o.status === 'Resolved').length
    const totalObs = data.observations.length
    const complianceRate = totalObs ? Math.round((resolved / totalObs) * 100) : 0
    const exposure = openFindings.reduce((s, f) => s + (f.amountInvolved || 0), 0)
    return { audits, active, openFindings, critical, overdueObs, complianceRate, exposure }
  }, [data])

  const charts = useMemo(() => {
    const byType = groupBy(data.audits, (a) => a.type)
    const byStatus = groupBy(data.audits, (a) => a.status)
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      months.push(d.toISOString().slice(0, 7))
    }
    const findingsTrend = months.map((m) => ({
      label: new Date(m + '-01').toLocaleString('en', { month: 'short' }),
      value: data.findings.filter((f) => f.raisedDate.slice(0, 7) === m).length
    }))
    return { byType, byStatus, findingsTrend }
  }, [data])

  // ---------- ADMIN: system view ----------
  if (role === 'admin') {
    const integrationStatus = groupBy(data.integrations, (i) => i.status)
    return (
      <div>
        <PageHead currentUser={currentUser} sub="System health, usage and administrative activity at a glance." />
        <div className="stat-grid">
          <StatCard label="Registered users" value={data.users.length} icon="◍" delta={{ text: `${data.users.filter((u) => u.status === 'Active').length} active`, dir: 'up' }} accent />
          <StatCard label="Departments on platform" value={data.departments.length} icon="⌂" />
          <StatCard label="Audits in system" value={data.audits.length} icon="☰" delta={{ text: `${stats.active.length} in execution`, dir: 'up' }} />
          <StatCard label="Documents in repository" value={data.documents.length} icon="▤" />
        </div>
        <div className="grid-2">
          <div className="card">
            <div className="card-head"><h3>Integration status</h3><Link to="/integrations" className="small">Manage →</Link></div>
            <div className="card-body">
              {data.integrations.map((i) => (
                <div key={i.id} className="flex-between" style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{i.name.split(' - ')[0]}</div>
                    <div className="muted small">{i.type}</div>
                  </div>
                  <div className="flex"><Badge kind={i.status}>{i.status}</Badge></div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Recent system activity</h3><Link to="/activity" className="small">Full log →</Link></div>
            <div className="card-body">
              <ul className="timeline">
                {data.activity.slice(0, 7).map((a) => (
                  <li key={a.id}>
                    <div className="tt"><b>{a.userName}</b> — {a.action}</div>
                    <div className="muted small">{a.details}</div>
                    <div className="td">{fmtRelative(a.timestamp)}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="card mt-3">
          <div className="card-head"><h3>Findings raised per month</h3><span className="hint">Last 6 months</span></div>
          <div className="card-body"><LineChart data={charts.findingsTrend} height={180} /></div>
        </div>
      </div>
    )
  }

  // ---------- COORDINATOR: department view ----------
  if (role === 'coordinator') {
    const deptId = currentUser.departmentId
    const dept = data.departments.find((d) => d.id === deptId)
    const myAudits = data.audits.filter((a) => a.departmentId === deptId)
    const myFindings = data.findings.filter((f) => f.departmentId === deptId && !['Resolved', 'Closed'].includes(f.status))
    const myObs = data.observations.filter((o) => o.departmentId === deptId && o.status !== 'Resolved')
    const dueSoon = myObs.filter((o) => daysFromNow(o.dueDate) !== null && daysFromNow(o.dueDate) <= 14)
    return (
      <div>
        <PageHead currentUser={currentUser} sub={`${dept ? dept.name : 'Department'} — coordination view: pending queries, responses and compliance.`} />
        <div className="callout mb-3">
          You are the department coordinator. Respond to audit queries, upload requested records to the document repository, and keep compliance observations on track before their due dates.
        </div>
        <div className="stat-grid">
          <StatCard label="Audits involving my department" value={myAudits.length} icon="☰" accent />
          <StatCard label="Findings awaiting response" value={myFindings.length} icon="!" delta={{ text: `${myFindings.filter((f) => f.severity === 'Critical' || f.severity === 'High').length} high/critical`, dir: 'down' }} />
          <StatCard label="Open compliance observations" value={myObs.length} icon="✓" />
          <StatCard label="Due within 14 days" value={dueSoon.length} icon="⏱" delta={{ text: `${myObs.filter((o) => daysFromNow(o.dueDate) < 0).length} overdue`, dir: 'down' }} />
        </div>
        <div className="grid-2">
          <div className="card">
            <div className="card-head"><h3>Findings to respond</h3><Link to="/findings" className="small">Open registry →</Link></div>
            <div className="card-body">
              {myFindings.length === 0 && <Empty icon="✓" title="No pending responses" sub="All findings have been responded to." />}
              {myFindings.slice(0, 6).map((f) => (
                <div key={f.id} className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, maxWidth: 460 }}>{f.title}</div>
                    <div className="muted small">{f.auditCode} · due {fmtDate(f.dueDate)} {daysFromNow(f.dueDate) < 0 && <b style={{ color: 'var(--danger)' }}>(overdue)</b>}</div>
                  </div>
                  <SeverityBadge s={f.severity} />
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Compliance observations</h3><Link to="/compliance" className="small">Open tracker →</Link></div>
            <div className="card-body">
              {myObs.length === 0 && <Empty icon="✓" title="Nothing pending" />}
              {myObs.slice(0, 6).map((o) => (
                <div key={o.id} className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{o.title}</div>
                    <div className="muted small">{o.requirement}</div>
                  </div>
                  <div className="flex" style={{ flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                    <Badge kind={o.complianceStatus}>{o.complianceStatus}</Badge>
                    <span className="muted small">{daysFromNow(o.dueDate) < 0 ? <b style={{ color: 'var(--danger)' }}>overdue</b> : `due ${fmtDate(o.dueDate)}`}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---------- SENIOR / JUNIOR: operational view ----------
  if (role === 'senior' || role === 'junior') {
    const mine = data.audits.filter((a) => a.leadAuditorId === currentUser.id || a.team.some((t) => t.userId === currentUser.id))
    const myTasks = []
    mine.forEach((a) => {
      a.checklist.forEach((c) => {
        if (c.status === 'Pending' || c.status === 'In Progress') myTasks.push({ audit: a, item: c })
      })
    })
    const upcoming = mine.filter((a) => ['In Progress', 'Scheduled'].includes(a.status)).sort((a, b) => new Date(a.endDate) - new Date(b.endDate))
    return (
      <div>
        <PageHead currentUser={currentUser} sub="Your audits, checklists and deadlines for this week." />
        <div className="stat-grid">
          <StatCard label="My audits" value={mine.length} icon="☰" accent />
          <StatCard label="In execution now" value={mine.filter((a) => a.status === 'In Progress').length} icon="▶" />
          <StatCard label="Open checklist items" value={myTasks.length} icon="☑" delta={{ text: `${mine.filter((a) => a.status === 'Under Review').length} awaiting review`, dir: 'up' }} />
          <StatCard label="Findings I raised" value={data.findings.filter((f) => f.raisedBy === currentUser.id).length} icon="!" />
        </div>
        <div className="grid-2">
          <div className="card">
            <div className="card-head"><h3>My audits</h3><Link to="/audits" className="small">All audits →</Link></div>
            <div className="card-body">
              {mine.length === 0 && <Empty icon="☰" title="No audits assigned yet" sub="Assignments from the Chief Audit Officer will appear here." />}
              {mine.map((a) => (
                <Link key={a.id} to={`/audit/${a.id}`} className="flex-between" style={{ padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{a.code} — {a.title.length > 58 ? a.title.slice(0, 58) + '…' : a.title}</div>
                    <div className="muted small">{a.departmentName} · {a.leadAuditorId === currentUser.id ? 'You are the lead' : 'Team member'} · ends {fmtDate(a.endDate)}</div>
                  </div>
                  <div className="flex" style={{ gap: 10 }}>
                    <Badge kind={a.status}>{a.status}</Badge>
                    <div style={{ width: 70 }}><Progress value={a.progress} className={PROGRESS_CLASS(a.progress)} /><div className="muted small right">{a.progress}%</div></div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Next deadlines</h3></div>
            <div className="card-body">
              {upcoming.length === 0 && <Empty icon="⏱" title="No scheduled audits" />}
              {upcoming.map((a) => {
                const d = daysFromNow(a.endDate)
                return (
                  <div key={a.id} className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <Link to={`/audit/${a.id}`} style={{ fontSize: 13, fontWeight: 600 }}>{a.code}</Link>
                      <div className="muted small">{a.type} audit · {a.departmentName}</div>
                    </div>
                    <Badge kind={d < 7 ? 'Critical' : d < 21 ? 'High' : 'Medium'}>{d < 0 ? `${-d}d overdue` : `${d} days left`}</Badge>
                  </div>
                )
              })}
              <div className="divider" />
              <SectionTitle hint="across my audits">Open checklist items</SectionTitle>
              {myTasks.slice(0, 5).map((t, i) => (
                <div key={i} className="flex-between" style={{ padding: '6px 0' }}>
                  <span style={{ fontSize: 12.5 }}>{t.item.item.length > 64 ? t.item.item.slice(0, 64) + '…' : t.item.item}</span>
                  <Link to={`/audit/${t.audit.id}`} className="small">{t.audit.code} →</Link>
                </div>
              ))}
              {myTasks.length === 0 && <div className="muted small">All checklist items completed.</div>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---------- DIRECTOR / CAO: executive view ----------
  const riskyDepts = data.departments
    .map((d) => ({ dept: d, ...computeDepartmentRisk(d, { findings: data.findings, observations: data.observations, audits: data.audits }) }))
    .sort((a, b) => b.score - a.score)
  const pendingApprovals = data.reports.filter((r) => r.status === 'In Review')
  const reviewAudits = data.audits.filter((a) => a.status === 'Under Review')
  const bySeverity = ['Critical', 'High', 'Medium', 'Low'].map((s, i) => ({ label: s, value: stats.openFindings.filter((f) => f.severity === s).length, color: ['#b42318', '#ea580c', '#d97706', '#2563eb'][i] }))

  return (
    <div>
      <PageHead currentUser={currentUser} sub="Executive overview of the audit portfolio, findings exposure and compliance position." />
      <div className="stat-grid">
        <StatCard label="Active audits" value={stats.active.length} icon="☰" delta={{ text: `${data.audits.filter((a) => a.status === 'In Progress').length} in field work`, dir: 'up' }} accent />
        <StatCard label="Open findings" value={stats.openFindings.length} icon="!" delta={{ text: `${stats.critical} critical`, dir: stats.critical ? 'down' : 'up' }} />
        <StatCard label="Financial exposure flagged" value={fmtINRCompact(stats.exposure)} icon="₹" delta={{ text: 'amount involved in open findings', dir: 'down' }} />
        <StatCard label="Compliance rate" value={`${stats.complianceRate}%`} icon="✓" delta={{ text: `${stats.overdueObs.length} observations overdue`, dir: stats.overdueObs.length ? 'down' : 'up' }} />
      </div>

      <div className="grid-2 mb-3">
        <div className="card">
          <div className="card-head"><h3>Audits by type</h3><span className="hint">{data.audits.length} total</span></div>
          <div className="card-body">
            <DonutChart
              data={Object.keys(charts.byType).map((t, i) => ({ label: t, value: charts.byType[t].length }))}
              centerValue={data.audits.length}
              centerLabel="audits"
            />
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Open findings by severity</h3><Link to="/findings" className="small">Registry →</Link></div>
          <div className="card-body">
            <DonutChart data={bySeverity} centerValue={stats.openFindings.length} centerLabel="open" />
          </div>
        </div>
      </div>

      <div className="grid-2 mb-3">
        <div className="card">
          <div className="card-head"><h3>Highest-risk departments</h3><span className="hint">AI risk score (rule-based, explainable)</span></div>
          <div className="card-body">
            <HBarChart data={riskyDepts.slice(0, 6).map((r) => ({ label: r.dept.name.replace(' Department', ''), value: r.score, color: r.score >= 75 ? '#b42318' : r.score >= 55 ? '#ea580c' : r.score >= 30 ? '#d97706' : '#2563eb' }))} showPct />
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Findings raised per month</h3><span className="hint">last 6 months</span></div>
          <div className="card-body"><LineChart data={charts.findingsTrend} height={190} /></div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h3>Awaiting your action</h3></div>
          <div className="card-body">
            {pendingApprovals.length === 0 && reviewAudits.length === 0 && <Empty icon="✓" title="Nothing pending approval" />}
            {reviewAudits.map((a) => (
              <Link key={a.id} to={`/audit/${a.id}`} className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.code} — audit review</div>
                  <div className="muted small">Submitted by {a.leadAuditorName} · {a.departmentName}</div>
                </div>
                <Badge kind={a.status}>{a.status}</Badge>
              </Link>
            ))}
            {pendingApprovals.map((r) => (
              <Link key={r.id} to="/reports" className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</div>
                  <div className="muted small">Report approval · {r.generatedByName}</div>
                </div>
                <Badge kind={r.status}>{r.status}</Badge>
              </Link>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Recent audits</h3><Link to="/audits" className="small">View all →</Link></div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Code</th><th>Department</th><th>Type</th><th>Status</th><th className="num">Progress</th></tr></thead>
                <tbody>
                  {data.audits.slice(0, 6).map((a) => (
                    <tr key={a.id} className="clickable" onClick={() => (window.location.hash = `#/audit/${a.id}`)}>
                      <td className="strong">{a.code}</td>
                      <td>{a.departmentName}</td>
                      <td><TypeBadge t={a.type} /></td>
                      <td><Badge kind={a.status}>{a.status}</Badge></td>
                      <td className="num">{a.progress}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PageHead({ currentUser, sub }) {
  return (
    <div className="page-head">
      <div>
        <h1>Welcome back, {currentUser.name.split(' ')[0].replace('Dr.', '')}</h1>
        <div className="sub">{sub}</div>
      </div>
    </div>
  )
}
