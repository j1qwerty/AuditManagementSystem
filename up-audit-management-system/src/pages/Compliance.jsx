// Compliance tracking (FR-060 to FR-066): observation status, time-bound
// tracking with ageing, follow-up scheduling, automated reminders and a
// 3-level escalation mechanism.
import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { Badge, Empty, Modal, StatCard, Tabs, Pagination } from '../components/ui'
import { Link } from '../lib/router'
import { fmtDate, daysFromNow, todayISO, groupBy } from '../lib/utils'
import { can } from '../lib/permissions'
import { HBarChart } from '../components/charts'
import config from '../lib/config'

export default function Compliance() {
  const { data, currentUser, save, notify, toast, sendEmail, logActivity } = useData()
  const [tab, setTab] = useState('overview')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [followUp, setFollowUp] = useState(null)
  const pageSize = config.pageSize

  const isCoord = currentUser.role === 'coordinator'
  const scoped = isCoord ? data.observations.filter((o) => o.departmentId === currentUser.departmentId) : data.observations
  const canUpdate = can(currentUser, 'observation.update') && (!isCoord || true)
  const canEscalate = can(currentUser, 'observation.escalate')

  const open = scoped.filter((o) => o.status !== 'Resolved')
  const overdue = open.filter((o) => daysFromNow(o.dueDate) < 0)
  const escalated = scoped.filter((o) => o.escalationLevel > 0 && o.status !== 'Resolved')
  const resolved = scoped.filter((o) => o.status === 'Resolved')
  const complianceRate = scoped.length ? Math.round((resolved.length / scoped.length) * 100) : 100

  const byDept = useMemo(() => {
    const g = groupBy(open, (o) => o.departmentId)
    return Object.entries(g)
      .map(([deptId, list]) => ({ label: ((data.departments.find((d) => d.id === deptId) || {}).name || deptId).replace(' Department', ''), value: list.length }))
      .sort((a, b) => b.value - a.value)
  }, [open, data.departments])

  const rows = useMemo(
    () =>
      (tab === 'escalations' ? escalated : open)
        .filter((o) => (o.title + o.requirement).toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)),
    [open, escalated, tab, q]
  )
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const curPage = Math.min(page, pages)
  const paged = rows.slice((curPage - 1) * pageSize, curPage * pageSize)

  const sendReminder = async (o) => {
    const coord = data.users.find((u) => u.role === 'coordinator' && u.departmentId === o.departmentId)
    await save('observations', { ...o, remindersSent: (o.remindersSent || 0) + 1 }, { logAction: 'Sent reminder', logDetail: o.title })
    if (coord) {
      await notify(coord.id, 'Deadline', `Reminder: ${o.title}`, `Compliance response due by ${fmtDate(o.dueDate)}.`, '/compliance')
      await sendEmail(coord.email, `Reminder: ${o.title}`, `Response due by ${fmtDate(o.dueDate)}.`)
    }
    toast('Reminder dispatched (in-app notification + simulated email).')
  }

  const sendAllOverdueReminders = async () => {
    let n = 0
    for (const o of overdue) {
      const coord = data.users.find((u) => u.role === 'coordinator' && u.departmentId === o.departmentId)
      await save('observations', { ...o, remindersSent: (o.remindersSent || 0) + 1 }, { log: false })
      if (coord) {
        await notify(coord.id, 'Deadline', `Reminder: ${o.title}`, `Compliance response overdue (due ${fmtDate(o.dueDate)}).`, '/compliance')
        await sendEmail(coord.email, `OVERDUE: ${o.title}`, `Response was due on ${fmtDate(o.dueDate)}.`)
        n++
      }
    }
    await logActivity('Sent bulk reminders', 'Compliance', 'tracker', `${n} overdue reminders dispatched (FR-065).`)
    toast(`${n} overdue reminder(s) dispatched to department coordinators.`)
  }

  const escalate = async (o) => {
    const level = Math.min(3, (o.escalationLevel || 0) + 1)
    await save(
      'observations',
      {
        ...o, escalationLevel: level, status: 'Escalated',
        history: [...o.history, { date: todayISO(), event: `Escalated to level ${level} (${level >= 2 ? 'Director + Principal Secretary' : 'Head of Department'})` }]
      },
      { logAction: 'Escalated observation', logDetail: `${o.title} → level ${level}` }
    )
    const to = level >= 2 ? ['u_director', 'u_cao'] : ['u_cao']
    await notify(to, 'Escalation', `Observation escalated (level ${level})`, o.title, '/compliance')
    toast(`Escalated to level ${level} — Director's office notified.`)
  }

  const resolve = async (o) => {
    await save(
      'observations',
      { ...o, status: 'Resolved', resolvedAt: todayISO(), resolutionNote: 'Compliance verified by audit team.' },
      { logAction: 'Resolved observation', logDetail: o.title }
    )
    toast('Observation resolved.')
  }

  const scheduleFollowUp = async (date) => {
    await save('observations', { ...followUp, followUpDate: new Date(date).toISOString(), history: [...followUp.history, { date: todayISO(), event: `Follow-up scheduled for ${fmtDate(date)}` }] }, { logAction: 'Scheduled follow-up', logDetail: followUp.title })
    toast(`Follow-up scheduled for ${fmtDate(date)} (FR-062).`)
    setFollowUp(null)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Compliance Tracking</h1>
          <div className="sub">Time-bound tracking of audit observations with follow-ups, automated reminders and a 3-level escalation matrix (FR-060 to FR-066).</div>
        </div>
        {can(currentUser, 'reminders.send') && overdue.length > 0 && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={sendAllOverdueReminders}>✉ Send {overdue.length} overdue reminder(s)</button>
          </div>
        )}
      </div>

      <div className="stat-grid">
        <StatCard label="Compliance rate" value={`${complianceRate}%`} icon="✓" delta={{ text: `${resolved.length}/${scoped.length} resolved`, dir: complianceRate >= 70 ? 'up' : 'down' }} accent />
        <StatCard label="Open observations" value={open.length} icon="◌" />
        <StatCard label="Overdue" value={overdue.length} icon="⏱" delta={{ text: 'past due date', dir: overdue.length ? 'down' : 'up' }} />
        <StatCard label="Escalated" value={escalated.length} icon="▲" delta={{ text: 'levels 1-3 active', dir: escalated.length ? 'down' : 'up' }} />
      </div>

      <Tabs
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'observations', label: 'Open Observations', count: open.length },
          { key: 'escalations', label: 'Escalations', count: escalated.length }
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'overview' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-head"><h3>Open observations by department</h3></div>
            <div className="card-body">
              {byDept.length ? <HBarChart data={byDept} /> : <Empty icon="✓" title="Nothing open" />}
            </div>
          </div>
          <div>
            <div className="card mb-3">
              <div className="card-head"><h3>Escalation matrix</h3><span className="hint">FR-063</span></div>
              <div className="card-body">
                <table className="tbl">
                  <thead><tr><th>Level</th><th>Trigger</th><th>Escalated to</th></tr></thead>
                  <tbody>
                    <tr><td className="strong">1</td><td className="small">Due date missed by 7 days</td><td className="small">Head of Department</td></tr>
                    <tr><td className="strong">2</td><td className="small">No response 14 days past due</td><td className="small">Principal Secretary + Audit Director</td></tr>
                    <tr><td className="strong">3</td><td className="small">No response 30 days past due</td><td className="small">Chief Minister's Office (inclusion in report)</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h3>Recently resolved</h3></div>
              <div className="card-body">
                {resolved.length === 0 && <div className="muted small">Nothing resolved yet.</div>}
                {resolved.slice(0, 5).map((o) => (
                  <div key={o.id} className="flex-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{o.title}</div>
                      <div className="muted small">resolved {fmtDate(o.resolvedAt)}</div>
                    </div>
                    <Badge kind="Resolved">Resolved</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {(tab === 'observations' || tab === 'escalations') && (
        <>
          <div className="filter-bar">
            <input className="input search" placeholder="Search observation or rule…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
            <span className="muted small">{rows.length} items · sorted by due date</span>
          </div>
          <div className="card">
            <div className="table-wrap">
              {rows.length === 0 ? (
                <div className="card-body"><Empty icon="✓" title={tab === 'escalations' ? 'No active escalations' : 'No open observations'} sub="Great compliance position." /></div>
              ) : (
                <table className="tbl">
                  <thead>
                    <tr><th>Observation</th><th>Department</th><th>Requirement</th><th>Compliance</th><th>Due</th><th>Ageing</th>{tab === 'escalations' && <th>Level</th>}<th style={{ minWidth: 130 }}></th></tr>
                  </thead>
                  <tbody>
                    {paged.map((o) => {
                      const d = daysFromNow(o.dueDate)
                      const od = d < 0 && o.status !== 'Resolved'
                      return (
                        <tr key={o.id}>
                          <td style={{ maxWidth: 260 }}>{o.title}<div className="sub"><Link to={`/audit/${o.auditId}`} className="small">{(data.audits.find((a) => a.id === o.auditId) || {}).code || ''}</Link></div></td>
                          <td className="small">{(data.departments.find((dp) => dp.id === o.departmentId) || {}).name}</td>
                          <td className="small muted" style={{ maxWidth: 180 }}>{o.requirement}</td>
                          <td><Badge kind={o.complianceStatus}>{o.complianceStatus}</Badge></td>
                          <td className="small">{fmtDate(o.dueDate)}</td>
                          <td className="small">{od ? <b style={{ color: 'var(--danger)' }}>{-d}d overdue</b> : d <= 14 ? <span style={{ color: 'var(--warning)' }}>due in {d}d</span> : <span className="muted">in {d}d</span>}</td>
                          {tab === 'escalations' && <td><Badge kind="Escalated">L{o.escalationLevel}</Badge></td>}
                          <td className="right">
                            {canUpdate && o.status !== 'Resolved' && (
                              <>
                                <button className="btn btn-secondary btn-sm" onClick={() => sendReminder(o)} title="Send reminder (FR-065)">✉</button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setFollowUp(o)} title="Schedule follow-up (FR-062)">📅</button>
                                {canEscalate && o.escalationLevel < 3 && <button className="btn btn-secondary btn-sm" onClick={() => escalate(o)} title="Escalate (FR-063)">▲</button>}
                                <button className="btn btn-secondary btn-sm" onClick={() => resolve(o)} title="Mark resolved (FR-066)">✓</button>
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ padding: '0 14px 12px' }}>
              <Pagination page={curPage} pages={pages} onPage={setPage} total={rows.length} pageSize={pageSize} />
            </div>
          </div>
        </>
      )}

      <Modal open={!!followUp} onClose={() => setFollowUp(null)} title="Schedule follow-up"
        footer={null}>
        {followUp && <FollowUpForm obs={followUp} onSave={scheduleFollowUp} />}
      </Modal>
    </div>
  )
}

function FollowUpForm({ obs, onSave }) {
  const [date, setDate] = useState(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10))
  return (
    <div>
      <p className="small muted" style={{ marginBottom: 10 }}>{obs.title}</p>
      <div className="field"><label>Follow-up date</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label>Notes</label>
        <input className="input" defaultValue="Verify departmental compliance certificate and supporting records." /></div>
      <button className="btn btn-primary" onClick={() => onSave(date)}>Schedule follow-up</button>
    </div>
  )
}
