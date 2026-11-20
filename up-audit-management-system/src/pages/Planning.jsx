// Audit planning (FR-020 to FR-028): annual calendar, risk assessment,
// resource allocation, scheduling with automated notifications.
import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { Badge, Empty, SectionTitle, StatCard, TypeBadge, Modal } from '../components/ui'
import { RiskHeatmap, HBarChart } from '../components/charts'
import { fmtDate, daysFromNow, fmtINRCompact } from '../lib/utils'
import { computeDepartmentRisk } from '../lib/ai'
import { can } from '../lib/permissions'
import config from '../lib/config'

const TYPE_BG = { Financial: '#eaf1fd', Performance: '#e7f5ee', Compliance: '#fef3e2', IT: '#f0eafd', Forensic: '#fdebe9' }
const TYPE_FG = { Financial: '#175cd3', Performance: '#067647', Compliance: '#b54708', IT: '#6941c6', Forensic: '#b42318' }
const FY_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
const RISK_CLASS = { Critical: 'danger', High: 'danger', Moderate: 'warning', Low: 'success' }

export default function Planning() {
  const { data, currentUser, notify, toast, logActivity } = useData()
  const [tab, setTab] = useState('calendar')
  const [selectedCell, setSelectedCell] = useState(null)
  const canManage = can(currentUser, 'planning.manage')

  const riskRows = useMemo(
    () =>
      data.departments
        .map((d) => ({ d, ...computeDepartmentRisk(d, { findings: data.findings, observations: data.observations, audits: data.audits }) }))
        .sort((a, b) => b.score - a.score),
    [data]
  )

  const workload = useMemo(() => {
    const auditors = data.users.filter((u) => ['cao', 'senior', 'junior'].includes(u.role))
    return auditors
      .map((u) => {
        const mine = data.audits.filter((a) => a.leadAuditorId === u.id || a.team.some((t) => t.userId === u.id))
        const days = mine.filter((a) => !['Completed', 'Closed'].includes(a.status)).reduce((s, a) => s + a.estimatedDays, 0)
        return { u, audits: mine.length, activeDays: days, utilization: Math.min(100, Math.round((days / 120) * 100)) }
      })
      .sort((a, b) => b.utilization - a.utilization)
  }, [data])

  const needsTeam = data.audits.filter((a) => a.status === 'Planned' && (!a.leadAuditorId || a.team.length === 0))

  // calendar cells: map each audit to its months
  const calEvents = useMemo(() => {
    return data.audits.map((a) => {
      const s = new Date(a.startDate)
      const e = new Date(a.endDate)
      const months = []
      let cur = new Date(s.getFullYear(), s.getMonth(), 1)
      while (cur <= e && months.length < 12) {
        months.push({ y: cur.getFullYear(), m: cur.getMonth() })
        cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
      }
      return { a, months }
    })
  }, [data])

  const fyStartYear = Number(config.fiscalYear.split('-')[0])
  const gridMonths = FY_MONTHS.map((m, i) => {
    const monthIdx = (3 + i) % 12 // April = 3
    const year = i < 9 ? fyStartYear : fyStartYear + 1
    return { label: `${m} ${String(year).slice(2)}`, m: monthIdx, y: year }
  })

  const heatCells = useMemo(() => {
    return riskRows.map((r) => ({
      impact: Math.min(5, Math.max(1, Math.round(r.score / 20))),
      likelihood: Math.min(5, Math.max(1, Math.round(r.factors[0].points / 8) + 1)),
      items: [{ title: `${r.d.name} — ${r.score}`, ...r }]
    }))
  }, [riskRows])

  const sendScheduleNotifications = async () => {
    const upcoming = data.audits.filter((a) => ['Scheduled', 'Planned'].includes(a.status))
    let n = 0
    for (const a of upcoming) {
      const targets = [a.leadAuditorId, ...a.team.map((t) => t.userId)].filter(Boolean)
      if (targets.length) {
        await notify(targets, 'Assignment', `Scheduled: ${a.code} (${a.type} audit)`, `Field work: ${fmtDate(a.startDate)} to ${fmtDate(a.endDate)} — ${a.departmentName}.`, `/audit/${a.id}`)
        n += targets.length
      }
    }
    await logActivity('Sent schedule notifications', 'Planning', 'annual-plan', `${n} assignment notifications sent for ${upcoming.length} upcoming audits (FR-024).`)
    toast(`Assignment notifications sent to ${n} team members for ${upcoming.length} audits.`)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Audit Planning</h1>
          <div className="sub">Annual calendar, risk-based selection, team allocation and scheduling for FY {config.fiscalYear} (FR-020 to FR-028).</div>
        </div>
        {canManage && tab === 'schedule' && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={sendScheduleNotifications}>✉ Send schedule notifications</button>
          </div>
        )}
      </div>

      <div className="tabs">
        {[
          { key: 'calendar', label: 'Annual Calendar' },
          { key: 'risk', label: 'Risk Assessment' },
          { key: 'resources', label: 'Resource Allocation' },
          { key: 'schedule', label: 'Scheduling & Notifications' }
        ].map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'calendar' && (
        <>
          <div className="stat-grid">
            <StatCard label="Audits planned for FY" value={data.audits.length} icon="☰" accent />
            <StatCard label="Starting this quarter" value={data.audits.filter((a) => daysFromNow(a.startDate) !== null && daysFromNow(a.startDate) > 0 && daysFromNow(a.startDate) < 92).length} icon="▶" />
            <StatCard label="Currently in field" value={data.audits.filter((a) => a.status === 'In Progress').length} icon="◎" />
            <StatCard label="Departments covered" value={new Set(data.audits.map((a) => a.departmentId)).size} icon="⌂" />
          </div>
          <div className="cal-grid">
            {gridMonths.map((gm) => {
              const evs = calEvents.filter((ce) => ce.months.some((mo) => mo.m === gm.m && mo.y === gm.y))
              return (
                <div key={gm.label} className="cal-month">
                  <div className="m-head">{gm.label}</div>
                  <div className="m-body">
                    {evs.length === 0 && <div className="muted small" style={{ padding: '2px 0' }}>—</div>}
                    {evs.map(({ a }) => (
                      <a
                        key={a.id}
                        className="cal-ev"
                        style={{ background: TYPE_BG[a.type], color: TYPE_FG[a.type] }}
                        href={`#/audit/${a.id}`}
                        title={`${a.code} — ${a.title}`}
                      >
                        <b>{a.code}</b> · {a.departmentName.replace(' Department', '')}
                      </a>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="chart-legend mt-2">
            {Object.keys(TYPE_BG).map((t) => (
              <span key={t}><span className="sw" style={{ background: TYPE_BG[t], border: `1px solid ${TYPE_FG[t]}` }} />{t}</span>
            ))}
          </div>
        </>
      )}

      {tab === 'risk' && (
        <>
          {config.aiEnabled && (
            <div className="callout mb-3">
              AI-assisted risk assessment (FR-025). Scores are computed by a transparent rule-based model —{" "}
              {config.aiModelLabel}. Click any department to see the factor breakdown (explainability).
            </div>
          )}
          <div className="grid-2">
            <div className="card">
              <div className="card-head"><h3>Risk matrix</h3><span className="hint">departments by likelihood × impact</span></div>
              <div className="card-body">
                <RiskHeatmap cells={heatCells} onCellClick={(cell) => setSelectedCell(cell)} />
                <div className="muted small mt-2">Counts = departments in each cell. Click a cell for details.</div>
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h3>Top risks — recommended for next plan</h3></div>
              <div className="card-body">
                <HBarChart data={riskRows.slice(0, 8).map((r) => ({ label: r.d.name.replace(' Department', ''), value: r.score }))} />
              </div>
            </div>
          </div>
          <div className="card mt-3">
            <div className="card-head"><h3>Department risk register</h3><span className="hint">sorted by score</span></div>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Department</th><th className="num">Open critical+high findings</th><th className="num">Non-compliant obs.</th><th className="num">Months since audit</th><th className="num">Score</th><th>Rating</th><th>Recommendation</th></tr></thead>
                <tbody>
                  {riskRows.map((r) => {
                    const months = r.factors[2]
                    return (
                      <tr key={r.d.id} className="clickable" onClick={() => (window.location.hash = `#/department/${r.d.id}`)}>
                        <td className="strong">{r.d.name}</td>
                        <td className="num">{r.factors[0].value}</td>
                        <td className="num">{r.factors[1].value}</td>
                        <td className="num">{months.value}</td>
                        <td className="num"><b>{r.score}</b></td>
                        <td><Badge kind={r.rating === 'Moderate' ? 'Medium' : r.rating}>{r.rating}</Badge></td>
                        <td className="small muted">
                          {r.score >= 75 ? 'Prioritise forensic / financial audit this quarter' : r.score >= 55 ? 'Schedule compliance audit within 2 quarters' : r.score >= 30 ? 'Routine coverage as per calendar' : 'Maintain standard cycle'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'resources' && (
        <>
          <div className="stat-grid">
            <StatCard label="Audit officers in pool" value={workload.length} icon="◍" accent />
            <StatCard label="Officers > 80% utilised" value={workload.filter((w) => w.utilization > 80).length} icon="⚠" />
            <StatCard label="Planned audits awaiting team" value={needsTeam.length} icon="☰" />
            <StatCard label="Total budget allocated" value={fmtINRCompact(data.audits.reduce((s, a) => s + a.allocatedBudget, 0))} icon="₹" />
          </div>
          <div className="grid-2">
            <div className="card">
              <div className="card-head"><h3>Team workload & utilisation</h3><span className="hint">active audit days vs 120-day capacity</span></div>
              <div className="card-body">
                {workload.map((w) => (
                  <div key={w.u.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className="flex-between">
                      <b style={{ fontSize: 13 }}>{w.u.name}</b>
                      <span className="muted small">{w.audits} audits · {w.activeDays} days allocated</span>
                    </div>
                    <div className="progress mt-1" style={{ marginTop: 6 }}>
                      <div style={{ width: `${w.utilization}%`, background: w.utilization > 80 ? 'var(--danger)' : w.utilization > 60 ? 'var(--warning)' : 'var(--primary)' }} />
                    </div>
                    <div className="muted small" style={{ marginTop: 3 }}>{w.utilization}% utilised</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="card mb-3">
                <div className="card-head"><h3>Audits needing team assignment</h3><span className="hint">FR-021</span></div>
                <div className="card-body">
                  {needsTeam.length === 0 && <Empty icon="✓" title="All planned audits are staffed" />}
                  {needsTeam.map((a) => (
                    <div key={a.id} className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <a href={`#/audit/${a.id}`} style={{ fontSize: 13, fontWeight: 600 }}>{a.code}</a>
                        <div className="muted small">{a.title.length > 52 ? a.title.slice(0, 52) + '…' : a.title}</div>
                      </div>
                      <div className="flex" style={{ gap: 8 }}>
                        <TypeBadge t={a.type} />
                        {!a.leadAuditorId && <Badge kind="Open">No lead</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="card-head"><h3>Budget allocation by audit type</h3></div>
                <div className="card-body">
                  <HBarChart
                    data={Object.entries(
                      data.audits.reduce((acc, a) => { acc[a.type] = (acc[a.type] || 0) + a.allocatedBudget; return acc }, {})
                    ).map(([t, v]) => ({ label: t, value: Math.round(v / 100000) }))}
                    formatValue={(v) => `₹${v} L`}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'schedule' && (
        <>
          <div className="callout mb-3">
            Automated notifications (FR-024): team members receive an assignment notification when an audit is scheduled.
            Use the <b>Send schedule notifications</b> button above to dispatch the current batch.
          </div>
          <div className="card">
            <div className="card-head"><h3>Upcoming schedule</h3><span className="hint">next 90 days</span></div>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Code</th><th>Audit</th><th>Department</th><th>Start</th><th>End</th><th>Lead</th><th>Team</th><th>Status</th></tr></thead>
                <tbody>
                  {data.audits
                    .filter((a) => ['Scheduled', 'Planned'].includes(a.status))
                    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
                    .map((a) => {
                      const dd = daysFromNow(a.startDate)
                      return (
                        <tr key={a.id} className="clickable" onClick={() => (window.location.hash = `#/audit/${a.id}`)}>
                          <td className="strong">{a.code}</td>
                          <td>{a.title.length > 52 ? a.title.slice(0, 52) + '…' : a.title}</td>
                          <td>{a.departmentName}</td>
                          <td>{fmtDate(a.startDate)}<div className="sub">{dd > 0 ? `in ${dd} days` : 'started'}</div></td>
                          <td>{fmtDate(a.endDate)}</td>
                          <td>{a.leadAuditorName || <span className="muted">unassigned</span>}</td>
                          <td className="num">{a.team.length}</td>
                          <td><Badge kind={a.status}>{a.status}</Badge></td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card mt-3">
            <div className="card-head"><h3>Recent notification deliveries</h3></div>
            <div className="card-body">
              <ul className="timeline">
                {data.notifications.filter((n) => n.type === 'Assignment' || n.type === 'Deadline').slice(0, 6).map((n) => (
                  <li key={n.id}>
                    <div className="tt"><b>{n.title}</b> → {n.userId === '*' ? 'all users' : (data.users.find((u) => u.id === n.userId) || {}).name || n.userId}</div>
                    <div className="td">{n.body}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}

      <Modal open={!!selectedCell} onClose={() => setSelectedCell(null)} title="Risk matrix cell">
        {selectedCell && (
          <div>
            <p className="small muted">Impact level {selectedCell.impact} / likelihood {selectedCell.likelihood}:</p>
            {selectedCell.items.map((it, i) => (
              <div key={i} className="flex-between" style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{it.d.name}</div>
                  <div className="muted small">{it.factors.map((f) => f.key).join(' · ')}</div>
                </div>
                <b>{it.score}</b>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
