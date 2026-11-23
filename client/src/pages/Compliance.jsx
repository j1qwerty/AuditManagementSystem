// Compliance Tracking - observation follow-up with reminders, escalations
// (level selection) and resolution with remarks.
// Reminders & escalations require a remark and let the sender pick recipients
// (audit team, department coordinator, roles above / same level / below).
// Every manual and automatic action is recorded in the communication log,
// the observation history, the activity trail and notifications.
import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { navigate, useTabMemory } from '../lib/router'
import {
  Badge, DataTable, PageHead, Modal, StatCard, Tabs, EscalationBadge, SectionTitle, PrintButton
} from '../components/ui'
import { CommsActionModal, CommsLogTable, CommsHistory } from '../components/comms'
import { fmtDate, fmtDateTime, daysFromNow } from '../lib/utils'
import { dispatchComms, visibleCommsLogs } from '../lib/comms'
import { canModule } from '../lib/permissions'

export default function Compliance() {
  const { data, save, notify, sendEmail, currentUser, can, toast } = useData()
  const [tab, setTab] = useTabMemory('open')
  const [deptF, setDeptF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [view, setView] = useState(null)
  const [remindO, setRemindO] = useState(null)   // observation being reminded
  const [escalateO, setEscalateO] = useState(null)
  const [resolveO, setResolveO] = useState(null)
  const [escLevel, setEscLevel] = useState(1)
  const [altDept, setAltDept] = useState('')
  const [resolveNote, setResolveNote] = useState('')

  // Roles without the compliance module may still open this page, but only to
  // read the communication log entries that concern them.
  const hasCompliance = canModule(currentUser, 'compliance')
  const activeTab = hasCompliance ? tab : 'log'

  const deptName = (id) => (data.departments.find((d) => d.id === id) || {}).name || '—'
  const caoIds = data.users.filter((u) => u.role === 'cao').map((u) => u.id)
  const directorIds = data.users.filter((u) => u.role === 'director').map((u) => u.id)

  const rows = useMemo(() => {
    let list = data.observations
    if (activeTab === 'open') list = list.filter((o) => !['Resolved'].includes(o.status))
    if (activeTab === 'escalated') list = list.filter((o) => o.status === 'Escalated')
    if (activeTab === 'resolved') list = list.filter((o) => o.status === 'Resolved')
    return list
      .filter((o) => deptF === 'all' || o.departmentId === deptF)
      .filter((o) => statusF === 'all' || o.complianceStatus === statusF)
  }, [data.observations, activeTab, deptF, statusF])

  const stats = useMemo(() => {
    const total = data.observations.length
    const resolved = data.observations.filter((o) => o.status === 'Resolved').length
    const overdue = data.observations.filter((o) => o.status !== 'Resolved' && daysFromNow(o.dueDate) < 0).length
    const escalated = data.observations.filter((o) => o.status === 'Escalated').length
    return { total, resolved, overdue, escalated, rate: total ? Math.round((resolved / total) * 100) : 0 }
  }, [data.observations])

  // communication log - every reminder / escalation the user may see (not just
  // observations), so manual reminders sent from findings or audits appear here
  const myLogs = useMemo(
    () => visibleCommsLogs(currentUser, data.commsLogs, data.audits),
    [currentUser, data.commsLogs, data.audits]
  )

  const auditOf = (o) => data.audits.find((a) => a.id === o.auditId)
  const coordinatorFor = (o) => data.users.find((u) => u.role === 'coordinator' && u.departmentId === o.departmentId)

  // ---- send manual reminder (remark + selected recipients, all logged) ----
  const sendReminder = async ({ recipients, remark }) => {
    const o = remindO
    const audit = auditOf(o)
    const names = recipients.map((r) => r.name).join(', ')
    const upd = {
      ...o, remindersSent: (o.remindersSent || 0) + 1, lastRemindedAt: new Date().toISOString(),
      history: [...(o.history || []), { date: new Date().toISOString(), event: `Reminder #${(o.remindersSent || 0) + 1} sent by ${currentUser.name} to ${names} — remarks: ${remark}` }]
    }
    await save('observations', upd, { logAction: 'Sent reminder', logDetail: `${o.title} → ${names}`, logRemarks: remark })
    await dispatchComms(
      { save, notify, sendEmail, currentUser },
      {
        kind: 'Reminder', mode: 'Manual', contextType: 'Observation', contextId: o.id,
        auditId: o.auditId, title: o.title, recipients, remark,
        link: audit ? `#/audit/${o.auditId}` : '#/compliance',
        notifyTitle: `Reminder: ${o.title}`,
        notifyBody: `${audit ? audit.code + ' · ' : ''}Response due ${fmtDate(o.dueDate)} — reminder from ${currentUser.name}.`
      }
    )
    setRemindO(null); setView(upd)
    toast(`Reminder sent to ${recipients.length} ${recipients.length === 1 ? 'recipient' : 'recipients'} and recorded in the log`)
  }

  // ---- manual escalation (level + remark + selected recipients) ----
  const doEscalate = async ({ recipients, remark, level, altDept: ad }) => {
    const o = escalateO
    const audit = auditOf(o)
    const lvl = level || escLevel
    const levelLabel = ['', 'Department Director', 'Head of Department', 'Audit Director', 'Executive Board'][lvl] || `Level ${lvl}`
    const names = recipients.map((r) => r.name).join(', ')
    const upd = {
      ...o, status: 'Escalated', escalationLevel: lvl,
      escalatedTo: levelLabel,
      escalatedAt: new Date().toISOString(), escalationRemarks: remark,
      history: [...(o.history || []), { date: new Date().toISOString(), event: `Escalated to Level ${lvl} (${levelLabel})${ad ? ` (parallel notice to ${ad})` : ''} by ${currentUser.name} — remarks: ${remark}` }]
    }
    await save('observations', upd, { logAction: 'Escalated observation', logDetail: `${upd.title} → Level ${lvl} (${levelLabel})`, logRemarks: remark })
    await dispatchComms(
      { save, notify, sendEmail, currentUser },
      {
        kind: 'Escalation', mode: 'Manual', contextType: 'Observation', contextId: o.id,
        auditId: o.auditId, title: o.title, recipients, remark, level: lvl, escalatedTo: levelLabel,
        link: audit ? `#/audit/${o.auditId}` : '#/compliance',
        notifyTitle: `Escalated to Level ${lvl}: ${o.title}`,
        notifyBody: `${audit ? audit.code + ' · ' : ''}${levelLabel}${ad ? ` · parallel notice: ${ad}` : ''} — by ${currentUser.name}.`
      }
    )
    setEscalateO(null); setView(upd); setAltDept('')
    toast('Escalation recorded, stakeholders notified and logged')
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

  const tabs = hasCompliance
    ? [
        { key: 'open', label: 'Open', count: data.observations.filter((o) => o.status !== 'Resolved').length },
        { key: 'escalated', label: 'Escalated', count: stats.escalated },
        { key: 'resolved', label: 'Resolved', count: stats.resolved },
        { key: 'all', label: 'All', count: stats.total },
        { key: 'log', label: 'Communication Log', count: myLogs.length }
      ]
    : [{ key: 'log', label: 'Communication Log', count: myLogs.length }]

  const obsLogs = (o) => data.commsLogs.filter((l) => l.contextType === 'Observation' && l.contextId === o.id)

  return (
    <div>
      <PageHead
        title="Compliance Tracking"
        sub={hasCompliance
          ? 'Time-bound follow-up on audit observations — reminders, escalation and resolution with recorded remarks'
          : 'Reminders and escalations that concern you or your audits'}
        actions={<PrintButton label="Print" title="Print this view (or save as PDF)" />}
      />

      {hasCompliance && (
        <div className="grid grid-5 mb-3">
          <StatCard label="Total Observations" value={stats.total} strip="#8b53ac" onClick={() => setTab('all')} foot="raised across all audits" />
          <StatCard label="Open" value={stats.total - stats.resolved} strip="#d97706" onClick={() => setTab('open')} foot="awaiting compliance" />
          <StatCard label="Overdue" value={stats.overdue} strip="#e0364f" onClick={() => setTab('open')} foot="past due date" />
          <StatCard label="Escalated" value={stats.escalated} strip="#cc004e" onClick={() => setTab('escalated')} foot="at department / board level" />
          <StatCard label="Compliance Rate" value={`${stats.rate}%`} strip="#0f9d6e" foot={`${stats.resolved} resolved`} />
        </div>
      )}

      <Tabs tabs={tabs} active={activeTab} onChange={setTab} />

      {activeTab === 'log' ? (
        <CommsLogTable
          logs={myLogs}
          users={data.users}
          audits={data.audits}
          csvName="compliance-communication-log"
          emptySub="Reminders and escalations that concern you or your audits appear here."
          onRowClick={hasCompliance ? (l) => {
            const o = data.observations.find((x) => x.id === l.contextId)
            if (o) setView(o)
          } : undefined}
        />
      ) : (
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
                  {can('reminders.send') && o.status !== 'Resolved' && <button className="btn-icon" title="Send reminder (with remark & recipients)" onClick={() => setRemindO(o)}>🔔</button>}
                  {can('observation.escalate') && o.status !== 'Resolved' && (
                    <button className="btn-icon danger" title="Escalate" onClick={() => { setEscalateO(o); setEscLevel(Math.min(4, (o.escalationLevel || 0) + 1)); setAltDept('') }}>↑</button>
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
      )}

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
            <div className="mb-3">
              <CommsHistory logs={obsLogs(view)} users={data.users} />
            </div>
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
              {can('reminders.send') && view.status !== 'Resolved' && <button className="btn btn-secondary" onClick={() => setRemindO(view)}>🔔 Send Reminder</button>}
              {can('observation.escalate') && view.status !== 'Resolved' && (
                <button className="btn btn-danger" onClick={() => { setEscalateO(view); setEscLevel(Math.min(4, (view.escalationLevel || 0) + 1)); setAltDept('') }}>↑ Escalate</button>
              )}
              {can('observation.resolve') && view.status !== 'Resolved' && <button className="btn btn-success" onClick={() => { setResolveO(view); setResolveNote('') }}>✓ Resolve</button>}
            </div>
          </div>
        )}
      </Modal>

      {/* reminder modal — remark + role-based recipients */}
      <CommsActionModal
        open={!!remindO} onClose={() => setRemindO(null)}
        kind="Reminder" onSend={sendReminder}
        currentUser={currentUser} users={data.users}
        audit={remindO ? auditOf(remindO) : null}
        coordinatorId={remindO ? ((coordinatorFor(remindO) || {}).id || null) : null}
        contextTitle={remindO ? remindO.title : ''}
        contextSub={remindO ? `${auditOf(remindO) ? auditOf(remindO).code + ' · ' : ''}${deptName(remindO.departmentId)}` : ''}
        dueLabel={remindO ? fmtDate(remindO.dueDate) : ''}
        initialGroups={['coord']}
      />

      {/* escalate modal — level + remark + role-based recipients */}
      <CommsActionModal
        open={!!escalateO} onClose={() => setEscalateO(null)}
        kind="Escalation" onSend={doEscalate}
        currentUser={currentUser} users={data.users}
        audit={escalateO ? auditOf(escalateO) : null}
        coordinatorId={escalateO ? ((coordinatorFor(escalateO) || {}).id || null) : null}
        contextTitle={escalateO ? escalateO.title : ''}
        contextSub={escalateO ? `${auditOf(escalateO) ? auditOf(escalateO).code + ' · ' : ''}${deptName(escalateO.departmentId)}` : ''}
        dueLabel={escalateO ? fmtDate(escalateO.dueDate) : ''}
        initialLevel={escLevel}
        initialGroups={['coord', 'role:cao']}
        levelDefaults={{
          1: ['coord', 'role:cao'],
          2: ['coord', 'role:cao'],
          3: ['role:director', 'role:cao'],
          4: ['role:director', 'role:admin', 'role:cao']
        }}
        altDeptOptions={data.departments.filter((d) => d.id !== ((escalateO || {}).departmentId)).map((d) => ({ id: d.id, name: d.name }))}
        altDeptValue={altDept}
        onAltDeptChange={setAltDept}
      />

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
