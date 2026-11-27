// Findings registry - all findings across audits with full lifecycle actions.
import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { navigate, getQuery } from '../lib/router'
import { Badge, DataTable, PageHead, Modal, SeverityBadge, TypeBadge, StatCard, SectionTitle, EscalationBadge, PrintButton } from '../components/ui'
import { CommsActionModal, CommsHistory } from '../components/comms'
import { fmtDate, fmtDateTime, fmtINR, daysFromNow } from '../lib/utils'
import { dispatchComms } from '../lib/comms'

const CATEGORIES = ['Procurement', 'Compliance', 'Financial Irregularity', 'Performance', 'Fraud', 'IT Security']
const STATUSES = ['Open', 'Under Review', 'Action Planned', 'Resolved', 'Closed']

export default function Findings() {
  const { data, save, notify, sendEmail, currentUser, can, toast } = useData()
  const q0 = getQuery()
  const [sevF, setSevF] = useState(q0.get('severity') || 'all')
  const [statusF, setStatusF] = useState(q0.get('status') || 'all')
  const [deptF, setDeptF] = useState(q0.get('dept') ? (data.departments.find((d) => d.code === q0.get('dept')) || {}).id || 'all' : 'all')
  const [catF, setCatF] = useState('all')
  const [view, setView] = useState(null)
  const [response, setResponse] = useState('')
  const [respondOpen, setRespondOpen] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [statusChange, setStatusChange] = useState(null) // {finding, newStatus}
  const [remindF, setRemindF] = useState(null) // finding being reminded

  const deptName = (id) => (data.departments.find((d) => d.id === id) || {}).name || '—'

  const rows = useMemo(
    () =>
      data.findings
        .filter((f) => sevF === 'all' || f.severity === sevF)
        .filter((f) => {
          if (statusF === 'all') return true
          if (statusF === '__open') return !['Resolved', 'Closed'].includes(f.status)
          if (statusF === '__overdue') return !['Resolved', 'Closed'].includes(f.status) && daysFromNow(f.dueDate) < 0
          if (statusF === 'Resolved+Closed') return f.status === 'Resolved' || f.status === 'Closed'
          return f.status === statusF
        })
        .filter((f) => deptF === 'all' || f.departmentId === deptF)
        .filter((f) => catF === 'all' || f.category === catF),
    [data.findings, sevF, statusF, deptF, catF]
  )

  const counts = useMemo(() => ({
    open: data.findings.filter((f) => !['Resolved', 'Closed'].includes(f.status)).length,
    critical: data.findings.filter((f) => f.severity === 'Critical' && !['Resolved', 'Closed'].includes(f.status)).length,
    overdue: data.findings.filter((f) => !['Resolved', 'Closed'].includes(f.status) && daysFromNow(f.dueDate) < 0).length,
    resolved: data.findings.filter((f) => ['Resolved', 'Closed'].includes(f.status)).length
  }), [data.findings])

  const coordinatorFor = (f) => data.users.find((u) => u.role === 'coordinator' && u.departmentId === f.departmentId)
  const caoIds = data.users.filter((u) => u.role === 'cao').map((u) => u.id)
  const auditOf = (f) => data.audits.find((a) => a.id === f.auditId)

  // ---- manual reminder on a finding: remark + recipients, fully logged ----
  const sendFindingReminder = async ({ recipients, remark }) => {
    const f = remindF
    const audit = auditOf(f)
    const names = recipients.map((r) => r.name).join(', ')
    const upd = {
      ...f,
      remindersSent: (f.remindersSent || 0) + 1,
      lastRemindedAt: new Date().toISOString(),
      responses: [...(f.responses || []), { by: `${currentUser.name} (Audit)`, role: currentUser.role, type: 'Reminder', text: `Reminder sent to ${names} — ${remark}`, date: new Date().toISOString() }]
    }
    await save('findings', upd, { logAction: 'Sent reminder', logDetail: `${f.title} → ${names}`, logRemarks: remark })
    await dispatchComms(
      { save, notify, sendEmail, currentUser },
      {
        kind: 'Reminder', mode: 'Manual', contextType: 'Finding', contextId: f.id,
        auditId: f.auditId, title: f.title, recipients, remark,
        link: '#/findings',
        notifyTitle: `Reminder: ${f.title}`,
        notifyBody: `${audit ? audit.code + ' · ' : ''}Department response due ${fmtDate(f.dueDate)} — reminder from ${currentUser.name}.`
      }
    )
    setRemindF(null); setView(upd)
    toast(`Reminder sent to ${recipients.length} ${recipients.length === 1 ? 'recipient' : 'recipients'} and recorded in the log`)
  }

  const submitResponse = async () => {
    const coord = coordinatorFor(view)
    const upd = {
      ...view,
      responses: [...(view.responses || []), {
        by: `${currentUser.name} (${coord ? 'Department Coordinator' : currentUser.designation})`, role: 'coordinator', type: 'Response',
        text: response, date: new Date().toISOString()
      }],
      status: view.status === 'Open' ? 'Under Review' : view.status
    }
    await save('findings', upd, { logAction: 'Responded to finding', logDetail: view.title })
    await notify([view.raisedBy, ...caoIds].filter(Boolean), 'Finding', 'Department response received', `${view.title}`, '#/findings')
    setView(upd); setRespondOpen(false); setResponse('')
    toast('Response submitted')
  }

  const applyStatus = async () => {
    const { finding, newStatus } = statusChange
    const upd = { ...finding, status: newStatus }
    await save('findings', upd, { logAction: `Finding marked ${newStatus}`, logDetail: finding.title, logRemarks: remarks })
    const targets = [finding.raisedBy, (coordinatorFor(finding) || {}).id, ...caoIds].filter(Boolean)
    await notify(targets, 'Finding', `Finding marked ${newStatus}`, `${finding.title}${remarks ? ` — remarks: ${remarks}` : ''}`, '#/findings', remarks)
    setView(null); setStatusChange(null); setRemarks('')
    toast(`Finding marked ${newStatus}`)
  }

  return (
    <div>
      <PageHead
        title="Findings Registry"
        sub={`${data.findings.length} findings across all audits · full lifecycle tracking with department responses`}
        actions={<PrintButton label="Print" title="Print this view (or save as PDF)" />}
      />

      <div className="grid grid-4 mb-3">
        <StatCard label="Open Findings" value={counts.open} strip="#8b53ac" onClick={() => { setStatusF('__open'); setSevF('all') }} foot="all severities" />
        <StatCard label="Critical" value={counts.critical} strip="#cc004e" onClick={() => { setSevF('Critical'); setStatusF('__open') }} foot="critical severity, unresolved" />
        <StatCard label="Overdue" value={counts.overdue} strip="#e0364f" onClick={() => { setStatusF('__overdue'); setSevF('all') }} foot="response window expired" />
        <StatCard label="Resolved / Closed" value={counts.resolved} strip="#0f9d6e" onClick={() => { setStatusF('Resolved+Closed'); setSevF('all') }} foot="closed after verification" />
      </div>

      <DataTable
        rows={rows}
        columns={[
          {
            key: 'title', label: 'Finding', sortable: true,
            render: (f) => (
              <div style={{ maxWidth: 340 }}>
                <div className="cell-strong ellipsis" title={f.title}>{f.title}</div>
                <div className="cell-sub">{f.auditCode} · {f.category} · {deptName(f.departmentId)}</div>
              </div>
            )
          },
          { key: 'severity', label: 'Severity', sortable: true, render: (f) => <SeverityBadge s={f.severity} /> },
          { key: 'status', label: 'Status', sortable: true, render: (f) => <Badge kind={f.status}>{f.status}</Badge> },
          { key: 'amountInvolved', label: 'Amount', num: true, sortable: true, render: (f) => f.amountInvolved ? fmtINR(f.amountInvolved) : '—' },
          { key: 'raisedDate', label: 'Raised', sortable: true, render: (f) => <span className="nowrap small">{fmtDate(f.raisedDate)}</span> },
          {
            key: 'dueDate', label: 'Response Due', sortable: true,
            render: (f) => (
              <span className="nowrap small">
                {fmtDate(f.dueDate)}
                {daysFromNow(f.dueDate) < 0 && !['Resolved', 'Closed'].includes(f.status) && <span className="badge danger" style={{ marginLeft: 5 }}>late</span>}
              </span>
            )
          },
          {
            key: 'responses', label: 'Responses', num: true, sortable: true, sort: (f) => (f.responses || []).length,
            render: (f) => (f.responses || []).length || <span className="muted">—</span>
          },
          {
            key: '__actions', label: '', render: (f) => (
              <div className="row-actions">
                <button className="btn-icon" title="View details" onClick={() => setView(f)}>👁</button>
                {can('reminders.send') && !['Resolved', 'Closed'].includes(f.status) && (
                  <button className="btn-icon" title="Send reminder (with remark & recipients)" onClick={() => setRemindF(f)}>🔔</button>
                )}
                <button className="btn-icon" title="Open audit" onClick={() => navigate(`/audit/${f.auditId}`)}>↗</button>
              </div>
            )
          }
        ]}
        searchKeys={['title', 'category', 'auditCode', 'severity', 'status', (f) => deptName(f.departmentId)]}
        searchPlaceholder="Search findings…"
        filters={[
          { value: sevF, onChange: setSevF, options: [{ value: 'all', label: 'All severities' }, ...['Critical', 'High', 'Medium', 'Low'].map((s) => ({ value: s, label: s }))] },
          { value: statusF, onChange: setStatusF, options: [{ value: 'all', label: 'All statuses' }, ...STATUSES.map((s) => ({ value: s, label: s })), { value: '__open', label: 'Open (unresolved)' }, { value: '__overdue', label: 'Overdue' }, { value: 'Resolved+Closed', label: 'Resolved or Closed' }] },
          { value: catF, onChange: setCatF, options: [{ value: 'all', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))] },
          { value: deptF, onChange: setDeptF, options: [{ value: 'all', label: 'All departments' }, ...data.departments.map((d) => ({ value: d.id, label: d.name }))] }
        ]}
        rowClick={(f) => setView(f)}
        csvName="findings"
        emptyTitle="No findings match"
        emptySub="Adjust the filters to see more results."
      />

      {/* view modal */}
      <Modal open={!!view} onClose={() => setView(null)} title={view ? view.title : ''} sub={view ? `${view.auditCode} · raised by ${view.raisedByName} · ${deptName(view.departmentId)}` : ''} size="lg">
        {view && (
          <div>
            <div className="flex mb-2" style={{ gap: 8 }}>
              <SeverityBadge s={view.severity} />
              <Badge kind={view.status}>{view.status}</Badge>
              <span className="tag">{view.category}</span>
              {view.amountInvolved > 0 && <span className="badge rose">{fmtINR(view.amountInvolved)}</span>}
            </div>
            <p style={{ color: 'var(--text-2)' }}>{view.description}</p>
            <div className="grid grid-4 mt-2 mb-2">
              <div><span className="muted tiny">RAISED</span><div className="small bold">{fmtDate(view.raisedDate)}</div></div>
              <div><span className="muted tiny">RESPONSE DUE</span><div className="small bold">{fmtDate(view.dueDate)}</div></div>
              <div><span className="muted tiny">LINKED OBSERVATION</span><div className="small bold">{(() => { const o = data.observations.find((x) => x.findingId === view.id); return o ? <EscalationBadge level={o.escalationLevel} /> : '—' })()}</div></div>
              <div><span className="muted tiny">AUDIT</span><div className="link small" onClick={() => navigate(`/audit/${view.auditId}`)}>{view.auditCode} ↗</div></div>
            </div>
            <SectionTitle>Responses & History</SectionTitle>
            <div className="timeline">
              {(view.responses || []).length === 0 && <div className="muted small mb-2">No responses yet.</div>}
              {(view.responses || []).map((r, i) => (
                <div key={i} className="tl-item">
                  <span className="tl-dot ok" />
                  <div className="tl-title">{r.type} — {r.by}</div>
                  <div className="tl-meta">{fmtDateTime(r.date)}</div>
                  <div className="tl-body">{r.text}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 mb-3">
              <CommsHistory
                logs={data.commsLogs.filter((l) => l.contextType === 'Finding' && l.contextId === view.id)}
                users={data.users}
                title="Reminders & Escalations on this Finding"
              />
            </div>

            <div className="flex mt-3" style={{ gap: 8, flexWrap: 'wrap' }}>
              {can('reminders.send') && !['Resolved', 'Closed'].includes(view.status) && (
                <button className="btn btn-secondary" onClick={() => setRemindF(view)}>🔔 Send Reminder</button>
              )}
              {can('finding.respond') && !['Resolved', 'Closed'].includes(view.status) && (
                <button className="btn btn-primary" onClick={() => { setRespondOpen(true); setResponse('') }}>Submit Department Response</button>
              )}
              {can('finding.close') && !['Resolved', 'Closed'].includes(view.status) && (
                <>
                  <button className="btn btn-secondary" onClick={() => setStatusChange({ finding: view, newStatus: 'Under Review' })}>Mark Under Review</button>
                  <button className="btn btn-success" onClick={() => setStatusChange({ finding: view, newStatus: 'Resolved' })}>Mark Resolved</button>
                  <button className="btn btn-secondary" onClick={() => setStatusChange({ finding: view, newStatus: 'Closed' })}>Close</button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* respond */}
      <Modal
        open={respondOpen} onClose={() => setRespondOpen(false)} title="Department Response"
        sub={view ? view.title : ''}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRespondOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={!response.trim()} onClick={submitResponse}>Submit Response</button>
          </>
        }
      >
        <div className="field">
          <label>Response <span className="req">*</span></label>
          <textarea className="textarea wide" style={{ minHeight: 130 }} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Action taken or clarification for the audit team…" />
        </div>
      </Modal>

      {/* reminder modal — remark + role-based recipients */}
      <CommsActionModal
        open={!!remindF} onClose={() => setRemindF(null)}
        kind="Reminder" onSend={sendFindingReminder}
        currentUser={currentUser} users={data.users}
        audit={remindF ? auditOf(remindF) : null}
        coordinatorId={remindF ? ((coordinatorFor(remindF) || {}).id || null) : null}
        contextTitle={remindF ? remindF.title : ''}
        contextSub={remindF ? `${remindF.auditCode} · ${deptName(remindF.departmentId)}` : ''}
        dueLabel={remindF ? fmtDate(remindF.dueDate) : ''}
        initialGroups={['coord']}
      />

      {/* status change with remarks */}
      <Modal
        open={!!statusChange} onClose={() => setStatusChange(null)}
        title={statusChange ? `Mark as ${statusChange.newStatus}` : ''}
        sub={statusChange ? statusChange.finding.title : ''}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setStatusChange(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={applyStatus} disabled={statusChange && statusChange.newStatus === 'Resolved' && !remarks.trim()}>Confirm</button>
          </>
        }
      >
        <div className="field">
          <label>Remarks {statusChange && statusChange.newStatus === 'Resolved' ? <span className="req">*</span> : ''}</label>
          <textarea className="textarea wide" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Included in the notification to stakeholders" />
        </div>
      </Modal>
    </div>
  )
}
