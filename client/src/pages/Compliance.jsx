// Compliance Tracking - observation follow-up with reminders, escalations
// (level selection) and resolution with remarks. All actions are notified.
import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { navigate } from '../lib/router'
import {
  Badge, DataTable, PageHead, Modal, StatCard, Tabs, EscalationBadge, InfoTip, Progress, SectionTitle
} from '../components/ui'
import { fmtDate, fmtDateTime, daysFromNow } from '../lib/utils'
import { projectCompliance } from '../lib/ai'

const ESCALATION_LEVELS = [
  { level: 1, label: 'Level 1 — Department Director', desc: 'Escalate to the director of the concerned department' },
  { level: 2, label: 'Level 2 — Head of Department', desc: 'Escalate to the administrative head of the department' },
  { level: 3, label: 'Level 3 — Audit Director', desc: 'Bring to the Audit Director for intervention' },
  { level: 4, label: 'Level 4 — Executive Board', desc: 'Highest level - place before the executive board' }
]

export default function Compliance() {
  const { data, save, notify, sendEmail, currentUser, can, toast } = useData()
  const [tab, setTab] = useState('open')
  const [deptF, setDeptF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [view, setView] = useState(null)
  const [escalateO, setEscalateO] = useState(null)
  const [resolveO, setResolveO] = useState(null)
  const [esc, setEsc] = useState({ level: 1, remarks: '', altDept: '' })
  const [resolveNote, setResolveNote] = useState('')

  const deptName = (id) => (data.departments.find((d) => d.id === id) || {}).name || '—'
  const caoIds = data.users.filter((u) => u.role === 'cao').map((u) => u.id)
  const directorIds = data.users.filter((u) => u.role === 'director').map((u) => u.id)

  const rows = useMemo(() => {
    let list = data.observations
    if (tab === 'open') list = list.filter((o) => !['Resolved'].includes(o.status))
    if (tab === 'escalated') list = list.filter((o) => o.status === 'Escalated')
    if (tab === 'resolved') list = list.filter((o) => o.status === 'Resolved')
    return list
      .filter((o) => deptF === 'all' || o.departmentId === deptF)
      .filter((o) => statusF === 'all' || o.complianceStatus === statusF)
  }, [data.observations, tab, deptF, statusF])

  const stats = useMemo(() => {
    const total = data.observations.length
    const resolved = data.observations.filter((o) => o.status === 'Resolved').length
    const overdue = data.observations.filter((o) => o.status !== 'Resolved' && daysFromNow(o.dueDate) < 0).length
    const escalated = data.observations.filter((o) => o.status === 'Escalated').length
    return { total, resolved, overdue, escalated, rate: total ? Math.round((resolved / total) * 100) : 0 }
  }, [data.observations])

  // 6-month compliance trend + projection
  const trend = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i)
      const key = d.toISOString().slice(0, 7)
      const raised = data.observations.filter((o) => (o.history[0] || {}).date && o.history[0].date.slice(0, 7) === key).length
      const resolved = data.observations.filter((o) => o.resolvedAt && o.resolvedAt.slice(0, 7) === key).length
      months.push({ label: d.toLocaleString('en', { month: 'short' }), raised, resolved })
    }
    return months
  }, [data.observations])

  const coordinatorFor = (o) => data.users.find((u) => u.role === 'coordinator' && u.departmentId === o.departmentId)

  const sendReminder = async (o) => {
    const upd = {
      ...o, remindersSent: (o.remindersSent || 0) + 1,
      history: [...(o.history || []), { date: new Date().toISOString(), event: `Reminder #${(o.remindersSent || 0) + 1} sent by ${currentUser.name}` }]
    }
    await save('observations', upd, { logAction: 'Sent reminder', logDetail: o.title })
    const coord = coordinatorFor(o)
    if (coord) {
      await notify([coord.id], 'Compliance', `Reminder: response pending — ${o.title}`, `Due ${fmtDate(o.dueDate)}. Please submit the compliance position.`, '#/compliance')
      await sendEmail(coord.email, `Reminder: ${o.title}`, `Response is due on ${fmtDate(o.dueDate)}.`)
    }
    setView({ ...upd })
    toast('Reminder sent to the department coordinator')
  }

  const doEscalate = async () => {
    const level = ESCALATION_LEVELS.find((l) => l.level === Number(esc.level))
    const upd = {
      ...escalateO, status: 'Escalated', escalationLevel: Number(esc.level),
      escalatedTo: level ? level.label.replace(/^Level \d+ — /, '') : '',
      escalatedAt: new Date().toISOString(), escalationRemarks: esc.remarks,
      history: [...(escalateO.history || []), { date: new Date().toISOString(), event: `Escalated to ${level ? level.label : ''}${esc.altDept ? ` (parallel notice to ${esc.altDept})` : ''} by ${currentUser.name} — remarks: ${esc.remarks}` }]
    }
    await save('observations', upd, { logAction: 'Escalated observation', logDetail: `${upd.title} → ${level ? level.label : ''}`, logRemarks: esc.remarks })
    const targets = Array.from(new Set([...caoIds, ...directorIds, ((coordinatorFor(upd) || {}).id)].filter(Boolean)))
    await notify(targets, 'Escalation', `Observation escalated — ${upd.title}`, `${level ? level.label : ''}${esc.altDept ? ` · parallel notice: ${esc.altDept}` : ''}`, '#/compliance', esc.remarks)
    const coord = coordinatorFor(upd)
    if (coord) await sendEmail(coord.email, `Escalation: ${upd.title}`, `The observation has been escalated. Remarks: ${esc.remarks}`)
    setEscalateO(null); setView(null); setEsc({ level: 1, remarks: '', altDept: '' })
    toast('Escalation recorded and stakeholders notified')
  }

  const doResolve = async () => {
    const upd = {
      ...resolveO, status: 'Resolved', resolvedAt: new Date().toISOString(), resolutionNote: resolveNote,
      history: [...(resolveO.history || []), { date: new Date().toISOString(), event: `Resolved by ${currentUser.name} — ${resolveNote}` }]
    }
    await save('observations', upd, { logAction: 'Resolved observation', logDetail: `${upd.title} — ${resolveNote}`, logRemarks: resolveNote })
    await notify([...caoIds, ((coordinatorFor(upd) || {}).id)].filter(Boolean), 'Compliance', `Observation resolved — ${upd.title}`, resolveNote, '#/compliance', resolveNote)
    setResolveO(null); setView(null); setResolveNote('')
    toast('Observation resolved')
  }

  const tabs = [
    { key: 'open', label: 'Open', count: data.observations.filter((o) => o.status !== 'Resolved').length },
    { key: 'escalated', label: 'Escalated', count: stats.escalated },
    { key: 'resolved', label: 'Resolved', count: stats.resolved },
    { key: 'all', label: 'All', count: stats.total }
  ]

  return (
    <div>
      <PageHead
        title="Compliance Tracking"
        sub="Time-bound follow-up on audit observations — reminders, escalation and resolution with recorded remarks"
      />

      <div className="grid grid-5 mb-3">
        <StatCard label="Total Observations" value={stats.total} strip="#8b53ac" onClick={() => setTab('all')} foot="raised across all audits" />
        <StatCard label="Open" value={stats.total - stats.resolved} strip="#d97706" onClick={() => setTab('open')} foot="awaiting compliance" />
        <StatCard label="Overdue" value={stats.overdue} strip="#e0364f" onClick={() => setTab('open')} foot="past due date" />
        <StatCard label="Escalated" value={stats.escalated} strip="#cc004e" onClick={() => setTab('escalated')} foot="at department / board level" />
        <StatCard label="Compliance Rate" value={`${stats.rate}%`} strip="#0f9d6e" foot={`${stats.resolved} resolved`} />
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <DataTable
        rows={rows}
        columns={[
          {
            key: 'title', label: 'Observation', sortable: true,
            render: (o) => (
              <div style={{ maxWidth: 300 }}>
                <div className="cell-strong ellipsis" title={o.title}>{o.title}</div>
                <div className="cell-sub ellipsis" title={o.requirement}>{o.requirement}</div>
              </div>
            )
          },
          { key: 'departmentId', label: 'Department', sortable: true, sort: (o) => deptName(o.departmentId), render: (o) => <span className="small">{deptName(o.departmentId)}</span> },
          { key: 'complianceStatus', label: 'Compliance', sortable: true, render: (o) => <Badge kind={o.complianceStatus}>{o.complianceStatus}</Badge> },
          { key: 'status', label: 'Tracking', sortable: true, render: (o) => <Badge kind={o.status}>{o.status}</Badge> },
          { key: 'escalationLevel', label: 'Escalation', num: true, sortable: true, sort: (o) => o.escalationLevel || 0, render: (o) => <EscalationBadge level={o.escalationLevel} /> },
          {
            key: 'dueDate', label: 'Due Date', sortable: true,
            render: (o) => (
              <span className="nowrap small">
                {fmtDate(o.dueDate)}
                {daysFromNow(o.dueDate) < 0 && o.status !== 'Resolved' && <span className="badge danger" style={{ marginLeft: 5 }}>late</span>}
              </span>
            )
          },
          { key: 'remindersSent', label: 'Reminders', num: true, sortable: true, render: (o) => o.remindersSent || 0 },
          {
            key: '__actions', label: '', render: (o) => (
              <div className="row-actions">
                <button className="btn-icon" title="View details" onClick={() => setView(o)}>👁</button>
                {can('reminders.send') && o.status !== 'Resolved' && <button className="btn-icon" title="Send reminder" onClick={() => sendReminder(o)}>🔔</button>}
                {can('observation.escalate') && o.status !== 'Resolved' && (
                  <button className="btn-icon danger" title="Escalate" onClick={() => { setEscalateO(o); setEsc({ level: Math.min(4, (o.escalationLevel || 0) + 1), remarks: '', altDept: '' }) }}>↑</button>
                )}
                {can('observation.resolve') && o.status !== 'Resolved' && <button className="btn-icon" title="Resolve" onClick={() => { setResolveO(o); setResolveNote('') }}>✓</button>}
              </div>
            )
          }
        ]}
        searchKeys={['title', 'requirement', 'complianceStatus', 'status', (o) => deptName(o.departmentId)]}
        searchPlaceholder="Search observations…"
        filters={[
          { value: deptF, onChange: setDeptF, options: [{ value: 'all', label: 'All departments' }, ...data.departments.map((d) => ({ value: d.id, label: d.name }))] },
          { value: statusF, onChange: setStatusF, options: [{ value: 'all', label: 'All compliance statuses' }, ...['Compliant', 'Partially Compliant', 'Non-Compliant', 'Pending'].map((s) => ({ value: s, label: s }))] }
        ]}
        rowClick={(o) => setView(o)}
        csvName="compliance-observations"
        emptyTitle="No observations here"
        emptySub="Observations raised on audits appear here for follow-up."
      />

      {/* view observation */}
      <Modal open={!!view} onClose={() => setView(null)} title={view ? view.title : ''} sub={view ? `${deptName(view.departmentId)} · ${view.requirement}` : ''} size="lg">
        {view && (
          <div>
            <div className="flex mb-2" style={{ gap: 8 }}>
              <Badge kind={view.complianceStatus}>{view.complianceStatus}</Badge>
              <Badge kind={view.status}>{view.status}</Badge>
              {view.escalationLevel > 0 && <EscalationBadge level={view.escalationLevel} />}
            </div>
            <div className="grid grid-4 mb-2">
              <div><span className="muted tiny">DUE DATE</span><div className="small bold">{fmtDate(view.dueDate)}</div></div>
              <div><span className="muted tiny">REMINDERS</span><div className="small bold">{view.remindersSent || 0}</div></div>
              <div><span className="muted tiny">ESCALATED TO</span><div className="small bold">{view.escalatedTo || '—'}</div></div>
              <div><span className="muted tiny">AUDIT</span><div className="link small" onClick={() => navigate(`/audit/${view.auditId}`)}>open audit ↗</div></div>
            </div>
            {view.escalationRemarks && (
              <div className="tl-body mb-2" style={{ background: 'var(--danger-soft)' }}>
                <span className="bold">Escalation remarks: </span>{view.escalationRemarks}
              </div>
            )}
            {view.status === 'Resolved' && view.resolutionNote && (
              <div className="tl-body mb-2" style={{ background: 'var(--success-soft)' }}>
                <span className="bold">Resolution: </span>{view.resolutionNote}
              </div>
            )}
            <SectionTitle>Follow-up History</SectionTitle>
            <div className="timeline">
              {(view.history || []).map((h, i) => (
                <div key={i} className="tl-item">
                  <span className="tl-dot" />
                  <div className="tl-title">{h.event}</div>
                  <div className="tl-meta">{fmtDateTime(h.date)}</div>
                </div>
              ))}
            </div>
            <div className="flex mt-3" style={{ gap: 8, flexWrap: 'wrap' }}>
              {can('reminders.send') && view.status !== 'Resolved' && <button className="btn btn-secondary" onClick={() => sendReminder(view)}>🔔 Send Reminder</button>}
              {can('observation.escalate') && view.status !== 'Resolved' && (
                <button className="btn btn-danger" onClick={() => { setEscalateO(view); setEsc({ level: Math.min(4, (view.escalationLevel || 0) + 1), remarks: '', altDept: '' }) }}>↑ Escalate</button>
              )}
              {can('observation.resolve') && view.status !== 'Resolved' && <button className="btn btn-success" onClick={() => { setResolveO(view); setResolveNote('') }}>✓ Resolve</button>}
            </div>
          </div>
        )}
      </Modal>

      {/* escalate modal */}
      <Modal
        open={!!escalateO} onClose={() => setEscalateO(null)} title="Escalate Observation" sub={escalateO ? escalateO.title : ''} size="md"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEscalateO(null)}>Cancel</button>
            <button className="btn btn-danger" disabled={!esc.remarks.trim()} onClick={doEscalate}>Escalate</button>
          </>
        }
      >
        <div className="flex-col" style={{ gap: 12 }}>
          <div className="field">
            <label>Escalation level <span className="req">*</span> <InfoTip text="Choose the authority who should intervene. You can escalate within the same level to another department, or go to a higher level." /></label>
            <div className="flex-col" style={{ gap: 7 }}>
              {ESCALATION_LEVELS.map((l) => (
                <label key={l.level} className="check-item" style={{ cursor: 'pointer', borderColor: Number(esc.level) === l.level ? 'var(--thistle-500)' : undefined }}>
                  <input type="radio" name="esc-l" checked={Number(esc.level) === l.level} onChange={() => setEsc((e) => ({ ...e, level: l.level }))} style={{ accentColor: 'var(--thistle-500)' }} />
                  <div>
                    <div className="bold small">{l.label}</div>
                    <div className="muted tiny">{l.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Parallel notice to another department (optional)</label>
            <select className="select" value={esc.altDept} onChange={(e) => setEsc((x) => ({ ...x, altDept: e.target.value }))}>
              <option value="">Not applicable</option>
              {data.departments.filter((d) => d.id !== (escalateO || {}).departmentId).map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Remarks <span className="req">*</span></label>
            <textarea className="textarea wide" value={esc.remarks} onChange={(e) => setEsc((x) => ({ ...x, remarks: e.target.value }))} placeholder="Why this is being escalated - included in the notification" />
          </div>
        </div>
      </Modal>

      {/* resolve modal */}
      <Modal
        open={!!resolveO} onClose={() => setResolveO(null)} title="Resolve Observation" sub={resolveO ? resolveO.title : ''}
        footer={
          <>
            <div style={{ flex: 1, marginRight: 10 }}>
              <textarea className="textarea" value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} placeholder="Resolution note (required) — verified compliance position, certificates checked…" />
            </div>
            <button className="btn btn-success" disabled={!resolveNote.trim()} onClick={doResolve}>Resolve</button>
          </>
        }
      >
        <p className="muted small" style={{ margin: 0 }}>
          The resolution note is recorded in the follow-up history, the activity trail and sent with the notification to reviewers.
        </p>
      </Modal>
    </div>
  )
}
