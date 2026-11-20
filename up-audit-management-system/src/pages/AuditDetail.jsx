// Audit detail workspace (FR-030 to FR-038): checklist, evidence, findings,
// observations, work-papers, review workflow and team discussion with
// cross-tab real-time sync.
import { useMemo, useState, useRef } from 'react'
import { useData } from '../context/DataContext'
import { Badge, Empty, KV, Modal, Progress, PROGRESS_CLASS, SeverityBadge, StatCard, Tabs, Avatar, ConfirmDialog } from '../components/ui'
import { Link } from '../lib/router'
import { fmtDate, fmtDateTime, fmtRelative, fmtINR, fmtBytes, uid, daysFromNow, todayISO, download } from '../lib/utils'
import { can } from '../lib/permissions'
import idb from '../lib/db'
import config from '../lib/config'

export default function AuditDetail({ id }) {
  const { data, currentUser, save, notify, toast, logActivity, sendEmail } = useData()
  const audit = data.audits.find((a) => a.id === id)
  const [tab, setTab] = useState('overview')

  const findings = useMemo(() => data.findings.filter((f) => f.auditId === id), [data.findings, id])
  const observations = useMemo(() => data.observations.filter((o) => o.auditId === id), [data.observations, id])

  if (!audit) return <Empty icon="☰" title="Audit not found" sub="It may have been deleted." />

  const isTeam = audit.leadAuditorId === currentUser.id || audit.team.some((t) => t.userId === currentUser.id)
  const canExecute = (can(currentUser, 'audit.execute') && isTeam) || currentUser.role === 'admin' || currentUser.role === 'cao'
  const isLead = audit.leadAuditorId === currentUser.id
  const canSubmitReview = (isLead || currentUser.role === 'admin' || currentUser.role === 'cao') && audit.status === 'In Progress'
  const canApprove = can(currentUser, 'audit.approve') && audit.status === 'Under Review'
  const canRespond = (currentUser.role === 'coordinator' && currentUser.departmentId === audit.departmentId) || currentUser.role === 'admin'

  const updateAudit = async (patch, action, detail) => {
    const next = { ...audit, ...patch }
    await save('audits', next, { logAction: action, logDetail: detail || audit.code })
    return next
  }

  const advance = async () => {
    // state machine: Planned -> Scheduled -> In Progress -> Under Review -> Completed -> Closed
    const map = { Planned: 'Scheduled', Scheduled: 'In Progress', 'Under Review': 'Completed', Completed: 'Closed' }
    const nextStatus = map[audit.status]
    if (!nextStatus) return
    await updateAudit(
      { status: nextStatus, timeline: [...audit.timeline, { date: todayISO(), event: `Status changed to ${nextStatus}` }] },
      'Updated audit status',
      `${audit.code}: ${audit.status} → ${nextStatus}`
    )
    toast(`${audit.code} moved to “${nextStatus}”.`)
  }

  const submitForReview = async () => {
    await updateAudit(
      {
        status: 'Under Review', progress: 100,
        reviewHistory: [...audit.reviewHistory, { action: 'Submitted for review', by: currentUser.name, date: todayISO(), notes: 'Field work complete. Documentation submitted for quality review.' }],
        timeline: [...audit.timeline, { date: todayISO(), event: 'Submitted for review by ' + currentUser.name }]
      },
      'Submitted for review',
      audit.code
    )
    await notify('u_cao', 'Review', `${audit.code} awaiting your approval`, `${audit.type} audit of ${audit.departmentName} submitted by ${currentUser.name}.`, `/audit/${audit.id}`)
    toast('Submitted for CAO review.')
  }

  const reviewDecision = async (approved, note) => {
    const entry = {
      action: approved ? 'Approved by Chief Audit Officer' : 'Returned for rework',
      by: `${currentUser.name} (CAO)`,
      date: todayISO(),
      notes: note || (approved ? 'Quality review passed.' : 'Documentation gaps found.')
    }
    await updateAudit(
      {
        status: approved ? 'Completed' : 'In Progress',
        reviewHistory: [...audit.reviewHistory, entry],
        timeline: [...audit.timeline, { date: todayISO(), event: entry.action }]
      },
      approved ? 'Approved audit' : 'Returned audit for rework',
      audit.code
    )
    if (audit.leadAuditorId) {
      await notify(audit.leadAuditorId, 'Review', `${audit.code} ${approved ? 'approved' : 'returned'}`, entry.notes, `/audit/${audit.id}`)
    }
    toast(approved ? 'Audit approved and marked completed.' : 'Audit returned to the team.')
  }

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'checklist', label: 'Checklist', count: audit.checklist.length },
    { key: 'evidence', label: 'Evidence', count: audit.evidence.length },
    { key: 'findings', label: 'Findings', count: findings.length },
    { key: 'observations', label: 'Observations', count: observations.length },
    { key: 'workpapers', label: 'Work Papers', count: audit.workpapers.length },
    { key: 'review', label: 'Review' },
    { key: 'discussion', label: 'Discussion', count: audit.comments.length }
  ]

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="flex wrap" style={{ marginBottom: 5 }}>
            <Link to="/audits" className="small">← Audits</Link>
          </div>
          <h1 style={{ fontSize: 19 }}>{audit.code} — {audit.title}</h1>
          <div className="sub">
            {audit.departmentName} · FY {audit.fiscalYear} · Lead: {audit.leadAuditorName || 'unassigned'} · {fmtDate(audit.startDate)} to {fmtDate(audit.endDate)}
          </div>
        </div>
        <div className="page-actions">
          <Badge kind={audit.status}>{audit.status}</Badge>
          <Badge kind={audit.priority}>Priority: {audit.priority}</Badge>
          {(audit.status === 'Planned' || audit.status === 'Scheduled' || audit.status === 'Under Review' || audit.status === 'Completed') && (isTeam || currentUser.role === 'admin' || currentUser.role === 'cao') && (
            <button className="btn btn-secondary" onClick={advance}>
              {audit.status === 'Planned' ? 'Schedule audit' : audit.status === 'Scheduled' ? 'Start field work' : audit.status === 'Under Review' ? 'Mark completed' : 'Close audit'}
            </button>
          )}
          {canSubmitReview && <button className="btn btn-primary" onClick={submitForReview}>Submit for review</button>}
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Progress" value={`${audit.progress}%`} icon="◔" accent />
        <StatCard label="Checklist done" value={`${audit.checklist.filter((c) => c.status === 'Completed' || c.status === 'N/A').length}/${audit.checklist.length}`} icon="☑" />
        <StatCard label="Findings raised" value={findings.length} icon="!" delta={{ text: `${findings.filter((f) => !['Resolved', 'Closed'].includes(f.status)).length} open`, dir: findings.some((f) => !['Resolved', 'Closed'].includes(f.status)) ? 'down' : 'up' }} />
        <StatCard label="Evidence items" value={audit.evidence.length} icon="▤" />
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'overview' && <Overview audit={audit} observations={observations} />}
      {tab === 'checklist' && <Checklist audit={audit} canExecute={canExecute} update={updateAudit} />}
      {tab === 'evidence' && <Evidence audit={audit} canExecute={canExecute} update={updateAudit} toast={toast} logActivity={logActivity} />}
      {tab === 'findings' && <FindingsTab audit={audit} findings={findings} canRespond={canRespond} canCreate={canExecute || can(currentUser, 'finding.create')} />}
      {tab === 'observations' && <ObservationsTab audit={audit} observations={observations} />}
      {tab === 'workpapers' && <Workpapers audit={audit} canExecute={canExecute} update={updateAudit} />}
      {tab === 'review' && <Review audit={audit} canApprove={canApprove} reviewDecision={reviewDecision} />}
      {tab === 'discussion' && <Discussion audit={audit} update={updateAudit} />}
    </div>
  )

  // ------------------------------------------------ overview
  function Overview({ audit, observations }) {
    const overdue = observations.filter((o) => o.status !== 'Resolved' && daysFromNow(o.dueDate) < 0)
    return (
      <div className="grid-2">
        <div>
          <div className="card mb-3">
            <div className="card-head"><h3>Audit particulars</h3></div>
            <div className="card-body">
              <KV rows={[
                ['Audit code', <b>{audit.code}</b>],
                ['Type', audit.type + ' audit'],
                ['Department', <Link to={`/department/${audit.departmentId}`}>{audit.departmentName}</Link>],
                ['Audit period', audit.auditPeriod],
                ['Budget allocated', fmtINR(audit.allocatedBudget)],
                ['Estimated effort', `${audit.estimatedDays} days`],
                ['Risk score at planning', <span><b>{audit.riskScore}</b>/100</span>]
              ]} />
              <hr className="divider" />
              <b style={{ fontSize: 13 }}>Objectives</b>
              <p className="small" style={{ marginTop: 4 }}>{audit.objectives}</p>
              <b style={{ fontSize: 13 }}>Scope</b>
              <p className="small" style={{ marginTop: 4 }}>{audit.scope}</p>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Team</h3><span className="hint">FR-021</span></div>
            <div className="card-body">
              {audit.leadAuditorName ? (
                <div className="flex" style={{ padding: '6px 0' }}>
                  <Avatar name={audit.leadAuditorName} color="#116a5b" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{audit.leadAuditorName} <Badge kind="Low">Lead</Badge></div>
                    <div className="muted small">{(data.users.find((u) => u.id === audit.leadAuditorId) || {}).designation}</div>
                  </div>
                </div>
              ) : <div className="muted small">No lead assigned yet.</div>}
              {audit.team.map((t) => (
                <div key={t.userId} className="flex" style={{ padding: '6px 0' }}>
                  <Avatar name={t.name} color={(data.users.find((u) => u.id === t.userId) || {}).avatarColor} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name} <span className="muted small">— {t.role}</span></div>
                    <div className="muted small">{(data.users.find((u) => u.id === t.userId) || {}).designation}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div>
          <div className="card mb-3">
            <div className="card-head"><h3>Progress & status</h3></div>
            <div className="card-body">
              <Progress value={audit.progress} className={PROGRESS_CLASS(audit.progress)} />
              <div className="flex-between mt-2">
                <span className="muted small">Field work progress</span>
                <b>{audit.progress}%</b>
              </div>
              <hr className="divider" />
              <ul className="timeline">
                {audit.timeline.map((t, i) => (
                  <li key={i}>
                    <div className="tt">{t.event}</div>
                    <div className="td">{fmtDate(t.date)}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {overdue.length > 0 && (
            <div className="callout warn mb-3">
              <b>{overdue.length} compliance observation(s) overdue</b> for this audit — see the Observations tab. Escalation may be required (FR-063).
            </div>
          )}
          <div className="card">
            <div className="card-head"><h3>Latest discussion</h3></div>
            <div className="card-body">
              {audit.comments.length === 0 && <div className="muted small">No comments yet.</div>}
              {audit.comments.slice(-3).map((c) => (
                <div key={c.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="small" style={{ fontWeight: 600 }}>{c.userName} <span className="muted" style={{ fontWeight: 400 }}>· {fmtRelative(c.timestamp)}</span></div>
                  <div className="small">{c.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ------------------------------------------------ checklist
  function Checklist({ audit, canExecute, update }) {
    const [noteFor, setNoteFor] = useState(null)
    const groups = useMemo(() => {
      const g = {}
      audit.checklist.forEach((c) => { (g[c.category] = g[c.category] || []).push(c) })
      return g
    }, [audit.checklist])

    const setStatus = async (itemId, status) => {
      const checklist = audit.checklist.map((c) =>
        c.id === itemId
          ? { ...c, status, completedBy: status === 'Completed' ? currentUser.name : c.completedBy, completedAt: status === 'Completed' ? todayISO() : c.completedAt, notes: noteFor === itemId && noteFor.text ? noteFor.text : c.notes }
          : c
      )
      const done = checklist.filter((c) => c.status === 'Completed' || c.status === 'N/A').length
      const progress = checklist.length ? Math.round((done / checklist.length) * 100) : 0
      await update({ checklist, progress }, 'Updated checklist', `${audit.code}: item ${status.toLowerCase()}`)
      if (status === 'Completed') toast('Checklist item marked complete — progress recalculated.')
    }

    const saveNote = async (itemId) => {
      const checklist = audit.checklist.map((c) => (c.id === itemId ? { ...c, notes: noteFor.text } : c))
      await update({ checklist }, 'Updated checklist note', audit.code)
      setNoteFor(null)
      toast('Note saved.')
    }

    return (
      <div>
        {canExecute && <div className="callout mb-2">Update each item as field work progresses. Audit progress is recalculated automatically from the checklist.</div>}
        {Object.entries(groups).map(([cat, items]) => (
          <div className="card mb-3" key={cat}>
            <div className="card-head">
              <h3>{cat}</h3>
              <span className="hint">{items.filter((i) => i.status === 'Completed' || i.status === 'N/A').length}/{items.length} done</span>
            </div>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th style={{ width: '45%' }}>Checklist item</th><th>Note</th><th>Completed by</th><th style={{ width: 150 }}>Status</th></tr></thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.id}>
                      <td>{c.item}</td>
                      <td className="small muted">
                        {c.notes || '—'}
                        {canExecute && <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }} onClick={() => setNoteFor({ id: c.id, text: c.notes || '' })}>edit</button>}
                      </td>
                      <td className="small">{c.completedBy ? <>{c.completedBy}<div className="sub">{fmtDate(c.completedAt)}</div></> : '—'}</td>
                      <td>
                        {canExecute ? (
                          <select className="select" style={{ padding: '4px 8px', fontSize: 12 }} value={c.status} onChange={(e) => setStatus(c.id, e.target.value)}>
                            {['Pending', 'In Progress', 'Completed', 'N/A'].map((s) => <option key={s}>{s}</option>)}
                          </select>
                        ) : (
                          <Badge kind={c.status}>{c.status}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {audit.checklist.length === 0 && <Empty icon="☑" title="No checklist for this audit" sub="Checklists are created from the audit-type template at scheduling." />}

        <Modal open={!!noteFor} onClose={() => setNoteFor(null)} title="Checklist note"
          footer={<><button className="btn btn-secondary" onClick={() => setNoteFor(null)}>Cancel</button><button className="btn btn-primary" onClick={() => saveNote(noteFor.id)}>Save note</button></>}>
          <div className="field"><label>Working note (visible to reviewers)</label>
            <textarea className="textarea" value={noteFor ? noteFor.text : ''} onChange={(e) => setNoteFor({ ...noteFor, text: e.target.value })} /></div>
        </Modal>
      </div>
    )
  }

  // ------------------------------------------------ evidence
  function Evidence({ audit, canExecute, update, toast, logActivity }) {
    const fileRef = useRef(null)
    const [desc, setDesc] = useState('')

    const upload = async (e) => {
      const file = e.target.files && e.target.files[0]
      if (!file) return
      if (file.size > config.maxUploadMb * 1048576) { toast(`File exceeds the ${config.maxUploadMb} MB demo limit.`, 'error'); return }
      const fileId = uid('file')
      const rec = { id: fileId, name: file.name, blob: file }
      await idb.put('files', rec)
      const ev = {
        id: uid('ev'),
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        uploadedBy: currentUser.name,
        uploadedAt: todayISO(),
        description: desc || 'Uploaded during field work',
        fileId
      }
      await update({ evidence: [ev, ...audit.evidence] }, 'Uploaded evidence', `${audit.code}: ${file.name}`)
      await logActivity('Uploaded evidence', 'Audit', audit.id, `${file.name} attached to ${audit.code}`)
      setDesc('')
      if (fileRef.current) fileRef.current.value = ''
      toast(`Evidence “${file.name}” stored in browser IndexedDB.`)
    }

    const doDownload = async (ev) => {
      const rec = await idb.get('files', ev.fileId)
      if (!rec) { toast('File blob not found (demo).', 'error'); return }
      download(rec.blob, rec.name || ev.name)
    }

    const removeEvidence = async (ev) => {
      await update({ evidence: audit.evidence.filter((x) => x.id !== ev.id) }, 'Removed evidence', `${audit.code}: ${ev.name}`)
      toast('Evidence removed from audit (blob kept in store).')
    }

    return (
      <div>
        {canExecute && (
          <div className="card mb-3">
            <div className="card-head"><h3>Upload evidence</h3><span className="hint">stored locally in IndexedDB · max {config.maxUploadMb} MB</span></div>
            <div className="card-body">
              <div className="form-row">
                <div className="field"><label>Description</label>
                  <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Voucher bundle for March 2026" /></div>
                <div className="field"><label>File</label>
                  <input ref={fileRef} className="input" type="file" onChange={upload} /></div>
              </div>
            </div>
          </div>
        )}
        <div className="card">
          <div className="card-head"><h3>Evidence store</h3><span className="hint">{audit.evidence.length} items</span></div>
          <div className="table-wrap">
            {audit.evidence.length === 0 ? (
              <div className="card-body"><Empty icon="▤" title="No evidence yet" sub={canExecute ? 'Upload records collected during field work.' : 'The audit team will attach records here.'} /></div>
            ) : (
              <table className="tbl">
                <thead><tr><th>Name</th><th>Description</th><th>Uploaded by</th><th>Date</th><th className="num">Size</th><th></th></tr></thead>
                <tbody>
                  {audit.evidence.map((ev) => (
                    <tr key={ev.id}>
                      <td className="strong">{ev.name}</td>
                      <td className="small muted">{ev.description}</td>
                      <td className="small">{ev.uploadedBy}</td>
                      <td className="small">{fmtDate(ev.uploadedAt)}</td>
                      <td className="num small">{fmtBytes(ev.size)}</td>
                      <td className="right">
                        <button className="btn btn-secondary btn-sm" onClick={() => doDownload(ev)}>⤓</button>
                        {canExecute && <button className="btn btn-ghost btn-sm" onClick={() => removeEvidence(ev)} style={{ color: 'var(--danger)' }}>✕</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ------------------------------------------------ findings
  function FindingsTab({ audit, findings, canRespond, canCreate }) {
    const [showNew, setShowNew] = useState(false)
    const [detail, setDetail] = useState(null)
    const [response, setResponse] = useState('')

    const create = async (f) => {
      const rec = {
        id: uid('f'),
        auditId: audit.id,
        auditCode: audit.code,
        departmentId: audit.departmentId,
        title: f.title,
        description: f.description,
        category: f.category,
        severity: f.severity,
        status: 'Open',
        amountInvolved: Number(f.amount) || 0,
        raisedBy: currentUser.id,
        raisedByName: currentUser.name,
        raisedDate: todayISO(),
        dueDate: f.dueDate,
        responses: []
      }
      await save('findings', rec, { logAction: 'Raised finding', logDetail: `${audit.code}: ${f.title}` })
      const coordinator = data.users.find((u) => u.role === 'coordinator' && u.departmentId === audit.departmentId)
      if (coordinator) {
        await notify(coordinator.id, 'Finding', `New finding on ${audit.code}: ${f.severity}`, f.title, '/findings')
        await sendEmail(coordinator.email, `New audit finding (${f.severity}) — ${audit.code}`, f.title)
      }
      toast('Finding raised and department coordinator notified.')
      setShowNew(false)
    }

    const respond = async () => {
      if (!response.trim() || !detail) return
      const rec = {
        ...detail,
        responses: [...detail.responses, { by: currentUser.name + ' (Department Coordinator)', role: 'coordinator', type: 'Response', text: response, date: todayISO() }],
        status: detail.status === 'Open' ? 'Under Review' : detail.status
      }
      await save('findings', rec, { logAction: 'Responded to finding', logDetail: detail.title })
      setDetail(rec)
      setResponse('')
      toast('Response recorded and sent to the audit team.')
    }

    const changeStatus = async (f, status) => {
      await save('findings', { ...f, status }, { logAction: 'Updated finding status', logDetail: `${f.title} → ${status}` })
      toast(`Finding marked ${status}.`)
      setDetail(null)
    }

    return (
      <div>
        {canCreate && (
          <div className="flex mb-2" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Raise finding</button>
          </div>
        )}
        <div className="card">
          <div className="card-head"><h3>Findings on this audit</h3><span className="hint">{findings.length} total</span></div>
          <div className="table-wrap">
            {findings.length === 0 ? (
              <div className="card-body"><Empty icon="✓" title="No findings raised" sub="Findings documented during execution appear here (FR-032)." /></div>
            ) : (
              <table className="tbl">
                <thead><tr><th>Title</th><th>Category</th><th>Severity</th><th className="num">Amount</th><th>Status</th><th>Due</th><th></th></tr></thead>
                <tbody>
                  {findings.map((f) => (
                    <tr key={f.id} className="clickable" onClick={() => setDetail(f)}>
                      <td style={{ maxWidth: 380 }}>{f.title}</td>
                      <td className="small">{f.category}</td>
                      <td><SeverityBadge s={f.severity} /></td>
                      <td className="num small">{f.amountInvolved ? fmtINR(f.amountInvolved) : '—'}</td>
                      <td><Badge kind={f.status}>{f.status}</Badge></td>
                      <td className="small">{fmtDate(f.dueDate)}{daysFromNow(f.dueDate) < 0 && !['Resolved', 'Closed'].includes(f.status) && <div className="sub" style={{ color: 'var(--danger)' }}>overdue</div>}</td>
                      <td className="right"><button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setDetail(f) }}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <NewFindingModal open={showNew} onClose={() => setShowNew(false)} onCreate={create} />

        <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? detail.title : ''} size="lg">
          {detail && (
            <div>
              <div className="flex wrap mb-2" style={{ gap: 8 }}>
                <SeverityBadge s={detail.severity} /><Badge kind={detail.status}>{detail.status}</Badge>
                <span className="tag">{detail.category}</span>
                {detail.amountInvolved ? <span className="tag">Amount involved: {fmtINR(detail.amountInvolved)}</span> : null}
              </div>
              <p style={{ lineHeight: 1.55 }}>{detail.description}</p>
              <div className="muted small">Raised by {detail.raisedByName} on {fmtDate(detail.raisedDate)} · response due {fmtDate(detail.dueDate)}</div>
              <hr className="divider" />
              <b style={{ fontSize: 13 }}>Department responses & action plan</b>
              {detail.responses.length === 0 && <div className="muted small mt-1">No response yet.</div>}
              {detail.responses.map((r, i) => (
                <div key={i} className="box" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', margin: '7px 0' }}>
                  <div className="small" style={{ fontWeight: 600 }}>{r.by}</div>
                  <div className="small muted">{fmtDateTime(r.date)}</div>
                  <div className="small" style={{ marginTop: 4 }}>{r.text}</div>
                </div>
              ))}
              {canRespond && !['Resolved', 'Closed'].includes(detail.status) && (
                <div className="mt-2">
                  <div className="field"><label>Department response / action taken</label>
                    <textarea className="textarea" value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Describe the action taken or the department's explanation…" /></div>
                  <button className="btn btn-primary" onClick={respond}>Send response</button>
                </div>
              )}
              {(currentUser.role === 'cao' || currentUser.role === 'admin' || (currentUser.role === 'senior' && isTeam)) && !['Resolved', 'Closed'].includes(detail.status) && (
                <div className="flex mt-2" style={{ gap: 8 }}>
                  <button className="btn btn-secondary" onClick={() => changeStatus({ ...detail }, 'Action Planned')}>Mark action planned</button>
                  <button className="btn btn-success btn-secondary" onClick={() => changeStatus({ ...detail }, 'Resolved')}>Mark resolved</button>
                  <button className="btn btn-secondary" onClick={() => changeStatus({ ...detail }, 'Closed')}>Close finding</button>
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    )
  }

  function NewFindingModal({ open, onClose, onCreate }) {
    const [f, setF] = useState({ title: '', description: '', category: 'Financial Irregularity', severity: 'Medium', amount: '', dueDate: '' })
    const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
    return (
      <Modal open={open} onClose={onClose} title="Raise a finding"
        footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => f.title && onCreate(f)}>Raise finding</button></>}>
        <div className="field"><label>Finding title *</label>
          <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Short, factual statement of the irregularity" /></div>
        <div className="field"><label>Description *</label>
          <textarea className="textarea" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="What was observed, against which rule/provision, with reference to evidence…" /></div>
        <div className="form-row-3">
          <div className="field"><label>Category</label>
            <select className="select" value={f.category} onChange={(e) => set('category', e.target.value)}>
              {['Financial Irregularity', 'Procurement', 'Compliance', 'IT Security', 'Fraud', 'Performance'].map((c) => <option key={c}>{c}</option>)}
            </select></div>
          <div className="field"><label>Severity</label>
            <select className="select" value={f.severity} onChange={(e) => set('severity', e.target.value)}>
              {['Low', 'Medium', 'High', 'Critical'].map((c) => <option key={c}>{c}</option>)}
            </select></div>
          <div className="field"><label>Amount involved (₹)</label>
            <input className="input" type="number" value={f.amount} onChange={(e) => set('amount', e.target.value)} /></div>
        </div>
        <div className="field"><label>Response due date</label>
          <input className="input" type="date" value={f.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></div>
      </Modal>
    )
  }

  // ------------------------------------------------ observations (compliance, audit-scoped)
  function ObservationsTab({ audit, observations }) {
    const canUpdate = can(currentUser, 'observation.update') && (currentUser.role !== 'coordinator' || currentUser.departmentId === audit.departmentId)
    const canEscalate = can(currentUser, 'observation.escalate')
    const [newObs, setNewObs] = useState(false)
    const [o, setO] = useState({ title: '', requirement: '', complianceStatus: 'Non-Compliant', dueDate: '' })

    const createObs = async () => {
      if (!o.title) return
      const rec = {
        id: uid('o'), findingId: null, auditId: audit.id, title: o.title, requirement: o.requirement,
        departmentId: audit.departmentId, complianceStatus: o.complianceStatus, status: 'Open',
        dueDate: o.dueDate ? new Date(o.dueDate).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString(),
        followUpDate: new Date(Date.now() + 37 * 86400000).toISOString(), escalationLevel: 0, remindersSent: 0,
        resolvedAt: null, resolutionNote: '', history: [{ date: todayISO(), event: 'Observation raised on ' + audit.code }]
      }
      await save('observations', rec, { logAction: 'Created observation', logDetail: rec.title })
      toast('Compliance observation created.')
      setNewObs(false)
      setO({ title: '', requirement: '', complianceStatus: 'Non-Compliant', dueDate: '' })
    }

    const updateObs = async (obs, patch, action) => {
      await save('observations', { ...obs, ...patch }, { logAction: action, logDetail: obs.title })
      toast('Observation updated.')
    }

    const sendReminder = async (obs) => {
      const coord = data.users.find((u) => u.role === 'coordinator' && u.departmentId === audit.departmentId)
      await updateObs(obs, { remindersSent: (obs.remindersSent || 0) + 1 }, 'Sent reminder')
      if (coord) {
        await notify(coord.id, 'Deadline', `Reminder: ${obs.title}`, `Compliance response due by ${fmtDate(obs.dueDate)} (audit ${audit.code}).`, '/compliance')
        await sendEmail(coord.email, `Reminder: ${obs.title}`, `Response due by ${fmtDate(obs.dueDate)}.`)
      }
      toast(`Reminder sent to department coordinator (notification + simulated email).`)
    }

    const escalate = async (obs) => {
      const level = Math.min(3, (obs.escalationLevel || 0) + 1)
      const to = level >= 2 ? ['u_director', 'u_cao'] : ['u_cao']
      await updateObs(
        { ...obs, status: 'Escalated' },
        { escalationLevel: level, status: 'Escalated', history: [...obs.history, { date: todayISO(), event: `Escalated to level ${level} (${level >= 2 ? 'Director + Principal Secretary' : 'Head of Department'})` }] },
        'Escalated observation'
      )
      await notify(to, 'Escalation', `Observation escalated (level ${level})`, `${obs.title} — ${audit.code}`, '/compliance')
      toast(`Observation escalated to level ${level}.`)
    }

    return (
      <div>
        <div className="callout mb-2">
          Compliance observations from this audit are tracked here and in the central <Link to="/compliance">Compliance Tracking</Link> module — with follow-up dates, reminders and escalation (FR-060 to FR-066).
        </div>
        <div className="flex mb-2" style={{ justifyContent: 'space-between' }}>
          <span className="muted small">{observations.length} observations</span>
          {canUpdate && <button className="btn btn-primary btn-sm" onClick={() => setNewObs(true)}>+ New observation</button>}
        </div>
        <div className="card">
          <div className="table-wrap">
            {observations.length === 0 ? (
              <div className="card-body"><Empty icon="✓" title="No compliance observations" /></div>
            ) : (
              <table className="tbl">
                <thead><tr><th>Observation</th><th>Requirement</th><th>Compliance</th><th>Due</th><th>Escalation</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {observations.map((obs) => {
                    const overdue = obs.status !== 'Resolved' && daysFromNow(obs.dueDate) < 0
                    return (
                      <tr key={obs.id}>
                        <td style={{ maxWidth: 300 }}>{obs.title}</td>
                        <td className="small muted">{obs.requirement}</td>
                        <td><Badge kind={obs.complianceStatus}>{obs.complianceStatus}</Badge></td>
                        <td className="small">{fmtDate(obs.dueDate)}{overdue && <div className="sub" style={{ color: 'var(--danger)' }}>overdue by {-daysFromNow(obs.dueDate)}d</div>}</td>
                        <td>{obs.escalationLevel ? <Badge kind="Escalated">Level {obs.escalationLevel}</Badge> : <span className="muted small">—</span>}</td>
                        <td><Badge kind={obs.status}>{obs.status}</Badge></td>
                        <td className="right">
                          {canUpdate && obs.status !== 'Resolved' && (
                            <>
                              <button className="btn btn-secondary btn-sm" onClick={() => sendReminder(obs)} title="Send reminder">✉</button>
                              {canEscalate && obs.escalationLevel < 3 && <button className="btn btn-secondary btn-sm" onClick={() => escalate(obs)} title="Escalate">▲</button>}
                              <button className="btn btn-secondary btn-sm" onClick={() => updateObs(obs, { status: 'Resolved', resolvedAt: todayISO(), resolutionNote: 'Compliance verified.' }, 'Resolved observation')} title="Mark resolved">✓</button>
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
        </div>

        <Modal open={newObs} onClose={() => setNewObs(false)} title="New compliance observation"
          footer={<><button className="btn btn-secondary" onClick={() => setNewObs(false)}>Cancel</button><button className="btn btn-primary" onClick={createObs}>Create</button></>}>
          <div className="field"><label>Observation</label>
            <input className="input" value={o.title} onChange={(e) => setO({ ...o, title: e.target.value })} placeholder="e.g. Open tendering for works above ₹10 lakh" /></div>
          <div className="field"><label>Rule / requirement</label>
            <input className="input" value={o.requirement} onChange={(e) => setO({ ...o, requirement: e.target.value })} placeholder="e.g. GFR 2017 Rule 149" /></div>
          <div className="form-row">
            <div className="field"><label>Compliance status</label>
              <select className="select" value={o.complianceStatus} onChange={(e) => setO({ ...o, complianceStatus: e.target.value })}>
                {['Compliant', 'Partially Compliant', 'Non-Compliant', 'Pending'].map((c) => <option key={c}>{c}</option>)}
              </select></div>
            <div className="field"><label>Due date</label>
              <input className="input" type="date" value={o.dueDate} onChange={(e) => setO({ ...o, dueDate: e.target.value })} /></div>
          </div>
        </Modal>
      </div>
    )
  }

  // ------------------------------------------------ workpapers
  function Workpapers({ audit, canExecute, update }) {
    const [w, setW] = useState({ ref: '', title: '' })
    const [showNew, setShowNew] = useState(false)

    const create = async () => {
      if (!w.title) return
      const wp = {
        id: uid('wp'),
        ref: w.ref || `WP-${String(audit.workpapers.length + 1).padStart(2, '0')}`,
        title: w.title,
        preparedBy: currentUser.name,
        status: 'Draft',
        reviewedBy: null,
        date: todayISO()
      }
      await update({ workpapers: [...audit.workpapers, wp] }, 'Prepared workpaper', `${audit.code}: ${wp.title}`)
      toast('Work paper added (draft).')
      setShowNew(false)
      setW({ ref: '', title: '' })
    }

    const setStatus = async (wp, status) => {
      const workpapers = audit.workpapers.map((x) =>
        x.id === wp.id ? { ...x, status, reviewedBy: status === 'Reviewed' || status === 'Approved' ? currentUser.name : x.reviewedBy } : x
      )
      await update({ workpapers }, `Work paper ${status.toLowerCase()}`, `${audit.code}: ${wp.title}`)
      toast(`Work paper marked ${status}.`)
    }

    return (
      <div>
        <div className="flex mb-2" style={{ justifyContent: 'space-between' }}>
          <span className="muted small">Working papers document how the audit was performed (FR-038).</span>
          {canExecute && <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>+ Add work paper</button>}
        </div>
        <div className="card">
          <div className="table-wrap">
            {audit.workpapers.length === 0 ? (
              <div className="card-body"><Empty icon="▤" title="No work papers yet" /></div>
            ) : (
              <table className="tbl">
                <thead><tr><th>Ref</th><th>Title</th><th>Prepared by</th><th>Date</th><th>Status</th><th>Reviewed by</th>{canExecute && <th></th>}</tr></thead>
                <tbody>
                  {audit.workpapers.map((wp) => (
                    <tr key={wp.id}>
                      <td className="strong">{wp.ref}</td>
                      <td>{wp.title}</td>
                      <td className="small">{wp.preparedBy}</td>
                      <td className="small">{fmtDate(wp.date)}</td>
                      <td><Badge kind={wp.status}>{wp.status}</Badge></td>
                      <td className="small">{wp.reviewedBy || '—'}</td>
                      {canExecute && (
                        <td className="right">
                          {wp.status === 'Draft' && <button className="btn btn-secondary btn-sm" onClick={() => setStatus(wp, 'Submitted')}>Submit</button>}
                          {wp.status === 'Submitted' && (currentUser.role === 'cao' || currentUser.role === 'admin' || isLead) && <button className="btn btn-secondary btn-sm" onClick={() => setStatus(wp, 'Reviewed')}>Review</button>}
                          {wp.status === 'Reviewed' && (currentUser.role === 'cao' || currentUser.role === 'admin') && <button className="btn btn-secondary btn-sm" onClick={() => setStatus(wp, 'Approved')}>Approve</button>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <Modal open={showNew} onClose={() => setShowNew(false)} title="Add work paper"
          footer={<><button className="btn btn-secondary" onClick={() => setShowNew(false)}>Cancel</button><button className="btn btn-primary" onClick={create}>Add</button></>}>
          <div className="form-row">
            <div className="field"><label>Reference</label><input className="input" value={w.ref} onChange={(e) => setW({ ...w, ref: e.target.value })} placeholder="WP-A-01" /></div>
            <div className="field"><label>Title</label><input className="input" value={w.title} onChange={(e) => setW({ ...w, title: e.target.value })} placeholder="e.g. Voucher testing sheet" /></div>
          </div>
        </Modal>
      </div>
    )
  }

  // ------------------------------------------------ review workflow
  function Review({ audit, canApprove, reviewDecision }) {
    const [note, setNote] = useState('')
    const steps = ['Planned', 'Scheduled', 'In Progress', 'Under Review', 'Completed', 'Closed']
    const idx = steps.indexOf(audit.status)
    return (
      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h3>Workflow status</h3><span className="hint">FR-033 review workflows</span></div>
          <div className="card-body">
            <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {steps.map((s, i) => (
                <li key={s} className="flex" style={{ padding: '8px 0', gap: 10, opacity: i <= idx ? 1 : 0.45 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: i < idx ? 'var(--primary)' : i === idx ? 'var(--warning-soft)' : 'var(--neutral-soft)', color: i < idx ? '#fff' : i === idx ? 'var(--warning)' : 'var(--text-3)', border: i === idx ? '2px solid var(--warning)' : 'none' }}>
                    {i < idx ? '✓' : i + 1}
                  </span>
                  <span style={{ fontWeight: i === idx ? 700 : 500 }}>{s}</span>
                  {i === idx && <Badge kind={audit.status}>current</Badge>}
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div>
          <div className="card mb-3">
            <div className="card-head"><h3>Review history</h3></div>
            <div className="card-body">
              {audit.reviewHistory.length === 0 && <div className="muted small">No review events yet.</div>}
              <ul className="timeline">
                {audit.reviewHistory.map((r, i) => (
                  <li key={i}>
                    <div className="tt"><b>{r.action}</b></div>
                    <div className="small" style={{ marginTop: 2 }}>{r.notes}</div>
                    <div className="td">{r.by} · {fmtDateTime(r.date)}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {canApprove && (
            <div className="card">
              <div className="card-head"><h3>CAO decision</h3></div>
              <div className="card-body">
                <div className="field"><label>Review note</label>
                  <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Quality review remarks…" /></div>
                <div className="flex">
                  <button className="btn btn-primary" onClick={() => reviewDecision(true, note)}>✓ Approve & complete audit</button>
                  <button className="btn btn-secondary" onClick={() => reviewDecision(false, note)}>↩ Return for rework</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ------------------------------------------------ discussion (real-time across tabs)
  function Discussion({ audit, update }) {
    const [text, setText] = useState('')
    const canComment = isTeam || currentUser.role === 'admin' || currentUser.role === 'cao' || canRespond
    const post = async () => {
      if (!text.trim()) return
      const comment = { id: uid('cm'), userId: currentUser.id, userName: currentUser.name, text: text.trim(), timestamp: todayISO() }
      await update({ comments: [...audit.comments, comment] }, 'Posted comment', `${audit.code} discussion`)
      setText('')
      toast('Comment posted — visible to the team instantly (synced across tabs).')
    }
    return (
      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h3>Team discussion</h3><span className="hint">FR-034 real-time collaboration</span></div>
          <div className="card-body">
            {audit.comments.length === 0 && <Empty icon="✉" title="No messages yet" sub="Coordinate with your team right here." />}
            {audit.comments.map((c) => (
              <div key={c.id} className="flex" style={{ alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid var(--border)', gap: 10 }}>
                <Avatar name={c.userName} color={(data.users.find((u) => u.id === c.userId) || {}).avatarColor} />
                <div>
                  <div className="small" style={{ fontWeight: 700 }}>{c.userName} <span className="muted" style={{ fontWeight: 400 }}>· {fmtRelative(c.timestamp)}</span></div>
                  <div className="small" style={{ marginTop: 2, lineHeight: 1.5 }}>{c.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="card mb-3">
            <div className="card-head"><h3>Post a message</h3></div>
            <div className="card-body">
              {canComment ? (
                <>
                  <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="Share an update, question or instruction with the audit team…" />
                  <button className="btn btn-primary mt-2" onClick={post}>Post to team</button>
                </>
              ) : <div className="muted small">Only the audit team and reviewers can post.</div>}
            </div>
          </div>
          <div className="callout">
            <b>Real-time demo tip:</b> open this app in a second browser tab, sign in as another team member and open the same audit — new comments appear in both tabs instantly (BroadcastChannel sync).
          </div>
        </div>
      </div>
    )
  }
}
