// Audit detail - the core workspace of the platform.
// Tabs: Overview, Checklist, Evidence, Findings, Observations, Work Papers,
// Review, Discussion. Every action is tracked in the audit timeline, the
// activity trail and notifications.
import { useMemo, useState, useEffect } from 'react'
import { useData } from '../context/DataContext'
import { navigate } from '../lib/router'
import {
  Badge, DataTable, PageHead, Progress, TypeBadge, SeverityBadge, Modal, ConfirmDialog,
  Empty, KV, Tabs, Avatar, FilePreviewModal, EscalationBadge, SectionTitle, UserPicker
} from '../components/ui'
import { fmtDate, fmtDateTime, fmtRelative, fmtBytes, fmtINR, daysFromNow, uid, fileKind } from '../lib/utils'
import { suggestedProgress } from '../lib/ai'
import { dispatchComms } from '../lib/comms'
import { CommsActionModal, CommsHistory } from '../components/comms'
import config from '../lib/config'

// Escalation levels and default recipient groups per level are shared with
// the CommsActionModal (components/comms.jsx).
export const REVIEW_LEVEL_DEFAULTS = {
  1: ['coord', 'role:cao'],
  2: ['coord', 'role:cao'],
  3: ['role:director', 'role:cao'],
  4: ['role:director', 'role:admin', 'role:cao']
}

export default function AuditDetail({ id }) {
  const { data, save, remove, saveFile, logActivity, notify, can, currentUser, sendEmail, toast } = useData()
  const audit = data.audits.find((a) => a.id === id)
  const [tab, setTab] = useState('overview')
  const [previewFile, setPreviewFile] = useState(null)
  const [confirm, setConfirm] = useState(null)

  // ---------- helpers ----------
  const dept = useMemo(() => data.departments.find((d) => d.id === (audit || {}).departmentId), [data.departments, audit])
  const caoIds = useMemo(() => data.users.filter((u) => u.role === 'cao').map((u) => u.id), [data.users])
  const directorIds = useMemo(() => data.users.filter((u) => u.role === 'director').map((u) => u.id), [data.users])
  const coordinatorId = useMemo(
    () => (data.users.find((u) => u.role === 'coordinator' && u.departmentId === (audit || {}).departmentId) || {}).id,
    [data.users, audit]
  )

  const teamIds = useMemo(() => {
    if (!audit) return []
    return [...(audit.leadAuditorId ? [audit.leadAuditorId] : []), ...audit.team.map((t) => t.userId)].filter(Boolean)
  }, [audit])

  const notifyTeam = async (title, body, remarks, extra = []) => {
    const targets = Array.from(new Set([...teamIds, ...extra, ...caoIds])).filter((u) => u !== currentUser.id)
    if (targets.length) await notify(targets, 'Review', title, body, `#/audit/${id}`, remarks)
  }

  // central mutation helper - patches the audit, appends a timeline event,
  // logs to the activity trail.
  const mutate = async (patch, event, action, extraNotify) => {
    const updated = { ...audit, ...patch }
    updated.timeline = [...(audit.timeline || []), { date: new Date().toISOString(), event, by: currentUser.name }]
    await save('audits', updated, { logAction: action, logDetail: `${audit ? audit.code : ''} — ${event}` })
    if (extraNotify) await notifyTeam(`${audit.code}: ${event}`, extraNotify.body || event, extraNotify.remarks, extraNotify.to || [])
    return updated
  }

  useEffect(() => { window.scrollTo(0, 0) }, [tab])

  if (!audit) {
    return (
      <Empty icon="?" title="Audit not found" sub="It may have been deleted.">
        <button className="btn btn-secondary" onClick={() => navigate('/audits')}>Back to audits</button>
      </Empty>
    )
  }

  const progress = suggestedProgress(audit)
  const auditFindings = data.findings.filter((f) => f.auditId === id)
  const auditObservations = data.observations.filter((o) => o.auditId === id)

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'checklist', label: 'Checklist', count: (audit.checklist || []).length },
    { key: 'evidence', label: 'Evidence', count: (audit.evidence || []).length },
    { key: 'findings', label: 'Findings', count: auditFindings.length },
    { key: 'observations', label: 'Observations', count: auditObservations.length },
    { key: 'workpapers', label: 'Work Papers', count: (audit.workpapers || []).length },
    { key: 'review', label: 'Review' },
    { key: 'discussion', label: 'Discussion', count: (audit.comments || []).length }
  ]

  return (
    <div>
      <PageHead
        backTo="/audits"
        title={`${audit.code} · ${audit.title}`}
        sub={`${audit.type} audit · ${dept ? dept.name : ''} · FY ${audit.fiscalYear} · Lead: ${audit.leadAuditorName || 'unassigned'}`}
        actions={
          <>
            <Badge kind={audit.status}>{audit.status}</Badge>
            <Badge kind={audit.priority}>Priority: {audit.priority}</Badge>
          </>
        }
      />

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'overview' && <Overview audit={audit} progress={progress} dept={dept} data={data} onGoto={setTab} canManage={can('audit.edit')} mutate={mutate} toast={toast} currentUser={currentUser} />}
      {tab === 'checklist' && (
        <ChecklistTab
          audit={audit} canEdit={can('audit.execute')} data={data} mutate={mutate} toast={toast}
          currentUser={currentUser} onPreview={setPreviewFile} saveStore={save}
        />
      )}
      {tab === 'evidence' && (
        <EvidenceTab
          audit={audit} canEdit={can('audit.execute')} mutate={mutate} saveFile={saveFile}
          currentUser={currentUser} onPreview={setPreviewFile} toast={toast} confirm={setConfirm}
        />
      )}
      {tab === 'findings' && (
        <FindingsTab
          audit={audit} findings={auditFindings} canCreate={can('finding.create')} canRespond={can('finding.respond')}
          canClose={can('finding.close')} data={data} save={save} remove={remove} notify={notify}
          currentUser={currentUser} coordinatorId={coordinatorId} caoIds={caoIds} toast={toast} logActivity={logActivity}
        />
      )}
      {tab === 'observations' && (
        <ObservationsTab
          audit={audit} observations={auditObservations} findings={auditFindings} data={data}
          canUpdate={can('observation.update')} canResolve={can('observation.resolve')} canEscalate={can('observation.escalate')}
          canRemind={can('reminders.send')} save={save} notify={notify} sendEmail={sendEmail} currentUser={currentUser}
          coordinatorId={coordinatorId} caoIds={caoIds} directorIds={directorIds} toast={toast} logActivity={logActivity}
          commsLogs={data.commsLogs}
        />
      )}
      {tab === 'workpapers' && (
        <WorkpapersTab
          audit={audit} canEdit={can('audit.execute')} canApprove={can('audit.approve')}
          mutate={mutate} currentUser={currentUser} toast={toast}
        />
      )}
      {tab === 'review' && (
        <ReviewTab
          audit={audit} canSubmit={can('audit.submitReview')} canApprove={can('audit.approve')}
          canFinalise={can('audit.finalise')} canRemind={can('reminders.send')} mutate={mutate} currentUser={currentUser}
          directorIds={directorIds} caoIds={caoIds} notify={notify} toast={toast}
          users={data.users} save={save} sendEmail={sendEmail} coordinatorId={coordinatorId}
        />
      )}
      {tab === 'discussion' && (
        <DiscussionTab
          audit={audit} mutate={mutate} currentUser={currentUser} canPost={can('audit.execute') || can('audit.approve')}
        />
      )}

      {previewFile && <FilePreviewModal open onClose={() => setPreviewFile(null)} fileId={previewFile.fileId} name={previewFile.name} />}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  )
}

/* ======================================================================== */
/* Overview                                                                  */
/* ======================================================================== */
function Overview({ audit, progress, dept, data, onGoto, canManage, mutate, toast, currentUser }) {
  const [teamEdit, setTeamEdit] = useState(false)
  const [teamForm, setTeamForm] = useState(null)
  const [showTeamPicker, setShowTeamPicker] = useState(false)

  const openTeamEdit = () => {
    setTeamForm({
      leadAuditorId: audit.leadAuditorId || '',
      teamIds: audit.team.map((t) => t.userId)
    })
    setTeamEdit(true)
  }

  const saveTeam = async () => {
    const lead = data.users.find((u) => u.id === teamForm.leadAuditorId)
    const team = teamForm.teamIds.map((tid, i) => {
      const u = data.users.find((x) => x.id === tid)
      return { userId: tid, name: u ? u.name : tid, role: i === 0 ? 'Co-lead' : 'Auditor' }
    })
    const leadChanged = teamForm.leadAuditorId !== (audit.leadAuditorId || '')
    await mutate(
      { leadAuditorId: teamForm.leadAuditorId || null, leadAuditorName: lead ? lead.name : null, team },
      `Team updated — lead: ${lead ? lead.name : 'unassigned'}, ${team.length} members`,
      'Assigned team'
    )
    setTeamEdit(false)
    toast('Team updated')
    void leadChanged
  }

  const openFindings = data.findings.filter((f) => f.auditId === audit.id && !['Resolved', 'Closed'].includes(f.status))
  const openObs = data.observations.filter((o) => o.auditId === audit.id && o.status !== 'Resolved')
  const doneChecklist = (audit.checklist || []).filter((c) => ['Completed', 'N/A'].includes(c.status)).length

  const mergedTimeline = [
    ...(audit.timeline || []).map((t) => ({ date: t.date, event: t.event, by: t.by })),
    ...(audit.reviewHistory || []).map((r) => ({ date: r.date, event: `${r.action}${r.notes ? ` — ${r.notes}` : ''}`, by: r.by }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 16 }}>
      <div className="flex-col" style={{ gap: 16 }}>
        <div className="grid grid-4">
          <div className="card card-pad card-hover" onClick={() => onGoto('checklist')}>
            <div className="muted small bold">CHECKLIST</div>
            <div className="bold" style={{ fontSize: 22 }}>{doneChecklist}/{(audit.checklist || []).length}</div>
            <Progress value={progress} className="sky mt-1" />
            <div className="muted tiny mt-1">{progress}% complete — open tab →</div>
          </div>
          <div className="card card-pad card-hover" onClick={() => onGoto('evidence')}>
            <div className="muted small bold">EVIDENCE</div>
            <div className="bold" style={{ fontSize: 22 }}>{(audit.evidence || []).length}</div>
            <div className="muted tiny mt-1">items in the evidence store — open tab →</div>
          </div>
          <div className="card card-pad card-hover" onClick={() => onGoto('findings')}>
            <div className="muted small bold">FINDINGS</div>
            <div className="bold" style={{ fontSize: 22 }}>{openFindings.length}</div>
            <div className="muted tiny mt-1">{openFindings.filter((f) => f.severity === 'Critical').length} critical — open tab →</div>
          </div>
          <div className="card card-pad card-hover" onClick={() => onGoto('observations')}>
            <div className="muted small bold">OBSERVATIONS</div>
            <div className="bold" style={{ fontSize: 22 }}>{openObs.length}</div>
            <div className="muted tiny mt-1">{openObs.filter((o) => daysFromNow(o.dueDate) < 0).length} overdue — open tab →</div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Objectives & Scope</h3></div>
          <div className="card-pad">
            <p style={{ marginBottom: 10 }}><span className="bold">Objectives. </span>{audit.objectives}</p>
            <p style={{ margin: 0 }}><span className="bold">Scope. </span>{audit.scope}</p>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Action History</h3><span className="hint">every tracked action on this audit</span></div>
          <div className="card-pad">
            <div className="timeline">
              {mergedTimeline.map((t, i) => (
                <div key={i} className="tl-item">
                  <span className="tl-dot" />
                  <div className="tl-title">{t.event}</div>
                  <div className="tl-meta">{t.by ? `${t.by} · ` : ''}{fmtDateTime(t.date)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-col" style={{ gap: 16 }}>
        <div className="card">
          <div className="card-head"><h3>Details</h3></div>
          <div className="card-pad">
            <KV rows={[
              ['Audit code', audit.code],
              ['Type', <TypeBadge t={audit.type} />],
              ['Status', <Badge kind={audit.status}>{audit.status}</Badge>],
              ['Department', dept ? dept.name : '—'],
              ['Audit period', audit.auditPeriod],
              ['Start date', fmtDate(audit.startDate)],
              ['End date', fmtDate(audit.endDate)],
              ['Risk score', <span className="bold num">{audit.riskScore}<span className="muted">/100</span></span>],
              ['Budget', fmtINR(audit.allocatedBudget)],
              ['Effort', `${audit.estimatedDays} field days`]
            ]} />
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <h3>Team</h3>
            <div className="flex" style={{ gap: 8 }}>
              <span className="hint">{audit.team.length + (audit.leadAuditorId ? 1 : 0)} members</span>
              {canManage && <button className="btn btn-secondary btn-sm" onClick={openTeamEdit}>✎ Edit Team</button>}
            </div>
          </div>
          <div className="card-pad flex-col" style={{ gap: 10 }}>
            {audit.leadAuditorId && (
              <div className="flex" style={{ gap: 10 }}>
                <Avatar name={audit.leadAuditorName} color={(data.users.find((u) => u.id === audit.leadAuditorId) || {}).avatarColor} />
                <div>
                  <div className="bold small">{audit.leadAuditorName}</div>
                  <div className="muted tiny">Lead Auditor</div>
                </div>
              </div>
            )}
            {audit.team.map((t) => (
              <div key={t.userId} className="flex" style={{ gap: 10 }}>
                <Avatar name={t.name} color={(data.users.find((u) => u.id === t.userId) || {}).avatarColor} />
                <div>
                  <div className="bold small">{t.name}</div>
                  <div className="muted tiny">{t.role}</div>
                </div>
              </div>
            ))}
            {!audit.leadAuditorId && !audit.team.length && <Empty icon="👥" title="No team assigned" sub={canManage ? 'Use Edit Team to assign a lead and members.' : 'A team will be assigned by the planning team.'} />}
          </div>
        </div>
      </div>

      {/* team edit modal */}
      <Modal
        open={teamEdit} onClose={() => setTeamEdit(false)}
        title="Edit Audit Team" sub={`${audit.code} — changes are tracked and the team is notified`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setTeamEdit(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveTeam}>Save Team</button>
          </>
        }
      >
        {teamForm && (
          <div className="flex-col" style={{ gap: 12 }}>
            <div className="field">
              <label>Lead auditor</label>
              <select className="select" value={teamForm.leadAuditorId} onChange={(e) => setTeamForm((f) => ({ ...f, leadAuditorId: e.target.value }))}>
                <option value="">Not assigned</option>
                {data.users.filter((u) => ['senior', 'cao'].includes(u.role) && u.status === 'Active').map((u) => (
                  <option key={u.id} value={u.id}>{u.name} — {u.designation}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Load from saved team</label>
              <select className="select" value="" onChange={(e) => {
                const t = data.teams.find((x) => x.id === e.target.value)
                if (t) setTeamForm((f) => ({ ...f, leadAuditorId: t.leadId, teamIds: t.memberIds }))
              }}>
                <option value="">Choose a saved team…</option>
                {data.teams.filter((t) => t.status === 'Active').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <span className="help">Fills the lead and members from a reusable team.</span>
            </div>
            <div className="field">
              <label>Team members ({teamForm.teamIds.length} selected)</label>
              <div className="flex wrap mb-2" style={{ gap: 6 }}>
                {teamForm.teamIds.map((id) => {
                  const u = data.users.find((x) => x.id === id)
                  return <span key={id} className="chip active" onClick={() => setTeamForm((f) => ({ ...f, teamIds: f.teamIds.filter((x) => x !== id) }))}>{u ? u.name : id} ✕</span>
                })}
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowTeamPicker(true)}>+ Choose members</button>
            </div>
          </div>
        )}
        <UserPicker
          open={showTeamPicker} onClose={() => setShowTeamPicker(false)}
          users={data.users.filter((u) => ['senior', 'junior', 'coordinator'].includes(u.role))}
          multi initialSelected={teamForm ? teamForm.teamIds : []}
          title="Add team members"
          onDone={(ids) => setTeamForm((f) => ({ ...f, teamIds: ids }))}
        />
      </Modal>
    </div>
  )
}

/* ======================================================================== */
/* Checklist                                                                 */
/* ======================================================================== */
function ChecklistTab({ audit, canEdit, data, mutate, toast, currentUser, saveStore }) {
  const [showTemplate, setShowTemplate] = useState(false)
  const [showItem, setShowItem] = useState(null) // {mode:'add'|'edit', item}
  const [showSaveTpl, setShowSaveTpl] = useState(false)
  const [catFilter, setCatFilter] = useState('all')
  const [statusF, setStatusF] = useState('all')

  const items = (audit.checklist || [])
    .filter((c) => catFilter === 'all' || c.category === catFilter)
    .filter((c) => statusF === 'all' || c.status === statusF)
  const categories = Array.from(new Set((audit.checklist || []).map((c) => c.category)))
  const templates = data.checklistTemplates || []

  const applyTemplate = async (tpl, replace) => {
    const newItems = tpl.items.map((it, i) => ({
      id: uid('cl'), category: it.category, item: it.item, status: 'Pending', notes: '',
      completedBy: null, completedAt: null
    }))
    const checklist = replace ? newItems : [...(audit.checklist || []), ...newItems]
    await mutate(
      { checklist },
      `Checklist ${replace ? 'replaced with' : 'extended by'} template "${tpl.name}" (+${newItems.length} items)`,
      'Applied checklist template'
    )
    setShowTemplate(false)
    toast(`Template applied — ${newItems.length} items added`)
  }

  const saveItem = async (item) => {
    const exists = (audit.checklist || []).some((c) => c.id === item.id)
    const checklist = exists
      ? audit.checklist.map((c) => (c.id === item.id ? item : c))
      : [...(audit.checklist || []), item]
    await mutate(
      { checklist },
      exists ? `Checklist item updated — "${item.item}"` : `Checklist item added — "${item.item}"`,
      exists ? 'Updated checklist item' : 'Added checklist item'
    )
    setShowItem(null)
    toast('Checklist saved')
  }

  const deleteItem = async (item) => {
    const checklist = audit.checklist.filter((c) => c.id !== item.id)
    await mutate({ checklist }, `Checklist item removed — "${item.item}"`, 'Deleted checklist item')
    toast('Item removed')
  }

  const setItemStatus = async (item, status) => {
    const upd = {
      ...item,
      status,
      completedBy: ['Completed', 'N/A'].includes(status) ? currentUser.name : item.completedBy,
      completedAt: ['Completed', 'N/A'].includes(status) ? new Date().toISOString() : item.completedAt
    }
    const checklist = audit.checklist.map((c) => (c.id === item.id ? upd : c))
    await mutate({ checklist }, `Checklist item marked ${status} — "${item.item}"`, 'Updated checklist item')
  }

  const saveAsTemplate = async (name) => {
    const tpl = {
      id: uid('ctpl'), name, type: audit.type, description: `Custom checklist saved from ${audit.code}.`,
      items: (audit.checklist || []).map((c) => ({ category: c.category, item: c.item })),
      createdBy: currentUser.name, createdAt: new Date().toISOString(), system: false
    }
    await saveStore('checklistTemplates', tpl, { logAction: 'Saved checklist template', logDetail: `${audit.code} — "${name}"` })
    await mutate({ }, `Checklist saved as reusable template "${name}"`, 'Saved checklist template')
    setShowSaveTpl(false)
    toast('Template saved to the library')
  }

  return (
    <div>
      <div className="flex-between mb-2" style={{ flexWrap: 'wrap' }}>
        <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
          <select className="select" style={{ width: 'auto' }} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="all">All areas</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="select" style={{ width: 'auto' }} value={statusF} onChange={(e) => setStatusF(e.target.value)}>
            <option value="all">All statuses</option>
            {['Pending', 'In Progress', 'Completed', 'N/A'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {canEdit && (
          <div className="flex" style={{ gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowTemplate(true)}>Apply Template</button>
            <button className="btn btn-secondary" onClick={() => setShowSaveTpl(true)}>Save as Template</button>
            <button className="btn btn-primary" onClick={() => setShowItem({ mode: 'add', item: { id: uid('cl'), category: categories[0] || 'General', item: '', status: 'Pending', notes: '' } })}>+ Add Item</button>
          </div>
        )}
      </div>

      <div className="flex-col" style={{ gap: 8 }}>
        {items.length === 0 && (
          <div className="card"><Empty icon="☑" title="No checklist items" sub={canEdit ? 'Add items manually or apply a standard template.' : 'The audit team has not added items yet.'} /></div>
        )}
        {items.map((c) => (
          <div key={c.id} className="check-item">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex" style={{ gap: 8 }}>
                <span className="tag">{c.category}</span>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{c.item}</span>
              </div>
              {c.notes && <div className="muted small mt-1">{c.notes}</div>}
              {c.completedBy && <div className="muted tiny mt-1">Completed by {c.completedBy} · {fmtRelative(c.completedAt)}</div>}
            </div>
            <div className="flex" style={{ gap: 6, flexShrink: 0 }}>
              {canEdit && (
                <>
                  <select
                    className={`check-status-btn ${c.status === 'Completed' ? 'done' : c.status === 'In Progress' ? 'doing' : c.status === 'N/A' ? 'na' : ''}`}
                    value={c.status}
                    onChange={(e) => setItemStatus(c, e.target.value)}
                    style={{ appearance: 'none', padding: '3px 22px 3px 9px', backgroundPosition: 'right 7px center' }}
                  >
                    {['Pending', 'In Progress', 'Completed', 'N/A'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button className="btn-icon" title="Edit item" onClick={() => setShowItem({ mode: 'edit', item: c })}>✎</button>
                  <button className="btn-icon danger" title="Delete item" onClick={() => deleteItem(c)}>🗑</button>
                </>
              )}
              {!canEdit && <span className={`badge ${c.status === 'Completed' ? 'success' : c.status === 'In Progress' ? 'warning' : 'neutral'}`}>{c.status}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* template picker */}
      <Modal open={showTemplate} onClose={() => setShowTemplate(false)} title="Apply Checklist Template" sub="Standard and custom templates from the library" size="md">
        <div className="flex-col" style={{ gap: 10 }}>
          {templates.length === 0 && <Empty icon="☑" title="No templates yet" sub="Save the current checklist as a template to reuse it." />}
          {templates.map((t) => (
            <div key={t.id} className="card card-pad card-hover" style={{ cursor: 'default' }}>
              <div className="flex-between">
                <div>
                  <div className="bold small">{t.name} {!t.system && <span className="badge purple">custom</span>}</div>
                  <div className="muted tiny" style={{ margin: '3px 0' }}>{t.description}</div>
                  <div className="flex" style={{ gap: 6 }}>
                    <span className="tag">{t.type}</span>
                    <span className="muted tiny">{t.items.length} items · {new Set(t.items.map((i) => i.category)).size} areas</span>
                  </div>
                </div>
                <div className="flex" style={{ gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => applyTemplate(t, true)} title="Replace existing items">Replace</button>
                  <button className="btn btn-primary btn-sm" onClick={() => applyTemplate(t, false)} title="Append to existing items">Append</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* add / edit item */}
      <ItemModal
        open={!!showItem}
        onClose={() => setShowItem(null)}
        item={showItem && showItem.item}
        mode={showItem && showItem.mode}
        categories={categories}
        onSave={saveItem}
      />

      {/* save as template */}
      <SaveTemplateModal open={showSaveTpl} onClose={() => setShowSaveTpl(false)} onSave={saveAsTemplate} audit={audit} />
    </div>
  )
}

function ItemModal({ open, onClose, item, mode, categories, onSave }) {
  const [form, setForm] = useState(null)
  useEffect(() => { if (item) setForm({ ...item }) }, [item])
  if (!open || !form) return null
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <Modal
      open={open} onClose={onClose}
      title={mode === 'add' ? 'Add Checklist Item' : 'Edit Checklist Item'}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!form.item.trim()} onClick={() => onSave(form)}>Save Item</button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field">
          <label>Area / Category <span className="req">*</span></label>
          <input className="input" list="cl-cats" value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="e.g. Expenditure Verification" />
          <datalist id="cl-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div className="field">
          <label>Status</label>
          <select className="select" value={form.status} onChange={(e) => set('status', e.target.value)}>
            {['Pending', 'In Progress', 'Completed', 'N/A'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field span-all">
          <label>Verification item <span className="req">*</span></label>
          <textarea className="textarea" value={form.item} onChange={(e) => set('item', e.target.value)} placeholder="What must be verified during the audit?" />
        </div>
        <div className="field span-all">
          <label>Notes</label>
          <textarea className="textarea wide" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Working notes, references, exceptions found…" />
        </div>
      </div>
    </Modal>
  )
}

function SaveTemplateModal({ open, onClose, onSave, audit }) {
  const [name, setName] = useState('')
  useEffect(() => { if (open) setName(`${audit.type} Checklist — ${new Date().toLocaleDateString('en-IN')}`) }, [open])
  return (
    <Modal
      open={open} onClose={onClose} title="Save Checklist as Template"
      sub={`${(audit.checklist || []).length} items will be saved to the reusable template library`}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Save Template</button>
        </>
      }
    >
      <div className="field">
        <label>Template name <span className="req">*</span></label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        <span className="help">Anyone in your organisation can apply this template to future audits.</span>
      </div>
    </Modal>
  )
}

/* ======================================================================== */
/* Evidence                                                                  */
/* ======================================================================== */
function EvidenceTab({ audit, canEdit, mutate, saveFile, currentUser, onPreview, toast, confirm }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editEv, setEditEv] = useState(null)

  const addEvidence = async ({ name, description, blob }) => {
    const fileId = uid('evf')
    if (blob) await saveFile(fileId, name, blob)
    const ev = {
      id: uid('ev'), name, type: blob ? blob.type : 'text/plain',
      size: blob ? blob.size : 0,
      uploadedBy: currentUser.name, uploadedAt: new Date().toISOString(),
      description, fileId: blob ? fileId : null
    }
    const evidence = [...(audit.evidence || []), ev]
    await mutate({ evidence }, `Evidence uploaded — ${name}`, 'Uploaded evidence', { body: `New evidence "${name}" added to ${audit.code}.` })
    setShowAdd(false)
    toast('Evidence added to the store')
  }

  const updateEvidence = async (evPatch) => {
    const evidence = audit.evidence.map((e) => (e.id === evPatch.id ? evPatch : e))
    await mutate({ evidence }, `Evidence updated — ${evPatch.name}`, 'Updated evidence')
    setEditEv(null)
    toast('Evidence updated')
  }

  const deleteEvidence = (ev) => {
    confirm({
      title: 'Delete evidence',
      message: `Remove "${ev.name}" from the evidence store? This is recorded in the audit trail.`,
      confirmLabel: 'Delete', danger: true,
      onConfirm: async () => {
        const evidence = audit.evidence.filter((e) => e.id !== ev.id)
        await mutate({ evidence }, `Evidence removed — ${ev.name}`, 'Deleted evidence')
        toast('Evidence removed')
      }
    })
  }

  return (
    <div>
      <div className="flex-between mb-2">
        <div className="muted small">{(audit.evidence || []).length} items · stored securely in the platform evidence store</div>
        {canEdit && <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Upload Evidence</button>}
      </div>

      {(audit.evidence || []).length === 0 ? (
        <div className="card"><Empty icon="🗄" title="No evidence yet" sub={canEdit ? 'Upload vouchers, statements, registers and replies collected during field work.' : 'The audit team has not uploaded evidence yet.'} /></div>
      ) : (
        <div className="grid grid-2">
          {audit.evidence.map((ev) => {
            const kind = fileKind(ev.name)
            return (
              <div key={ev.id} className="card card-pad card-hover" style={{ cursor: 'default' }}>
                <div className="flex-between mb-1">
                  <div className="flex" style={{ gap: 9, minWidth: 0 }}>
                    <span className="tag" style={{ background: 'var(--thistle-50)', color: 'var(--thistle-700)', borderColor: 'var(--thistle-200)' }}>{kind.toUpperCase()}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="bold small ellipsis" title={ev.name}>{ev.name}</div>
                      <div className="muted tiny">{fmtBytes(ev.size)} · {ev.uploadedBy} · {fmtRelative(ev.uploadedAt)}</div>
                    </div>
                  </div>
                </div>
                <p className="small" style={{ color: 'var(--text-2)', margin: '8px 0 10px', minHeight: 34 }}>{ev.description || <span className="muted">No description</span>}</p>
                <div className="flex" style={{ gap: 6 }}>
                  {ev.fileId && <button className="btn btn-secondary btn-sm" onClick={() => onPreview(ev)}>👁 Preview</button>}
                  {canEdit && <button className="btn btn-secondary btn-sm" onClick={() => setEditEv(ev)}>✎ Edit</button>}
                  {canEdit && <button className="btn btn-danger btn-sm" onClick={() => deleteEvidence(ev)}>Delete</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <EvidenceModal open={showAdd} onClose={() => setShowAdd(false)} onSave={addEvidence} />

      <Modal
        open={!!editEv} onClose={() => setEditEv(null)} title="Edit Evidence"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEditEv(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => updateEvidence(editEv)}>Save</button>
          </>
        }
      >
        {editEv && (
          <div className="form-grid">
            <div className="field span-all">
              <label>Name</label>
              <input className="input" value={editEv.name} onChange={(e) => setEditEv({ ...editEv, name: e.target.value })} />
            </div>
            <div className="field span-all">
              <label>Description</label>
              <textarea className="textarea wide" style={{ minHeight: 130 }} value={editEv.description} onChange={(e) => setEditEv({ ...editEv, description: e.target.value })} placeholder="Detailed description — what the evidence covers, source, period, verification notes…" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function EvidenceModal({ open, onClose, onSave }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [file, setFile] = useState(null)
  useEffect(() => { if (open) { setName(''); setDesc(''); setFile(null) } }, [open])

  const pick = (e) => {
    const f = e.target.files && e.target.files[0]
    if (f) { setFile(f); if (!name) setName(f.name) }
  }

  return (
    <Modal
      open={open} onClose={onClose} title="Upload Evidence" sub="Files are stored in the platform evidence store with a full audit trail"
      size="md"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!name.trim() || !file} onClick={() => onSave({ name: name.trim(), description: desc, blob: file })}>
            Upload to Evidence Store
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field span-all">
          <label>File <span className="req">*</span></label>
          <input className="input" type="file" onChange={pick} />
          {file && <span className="help">{file.name} · {fmtBytes(file.size)}</span>}
        </div>
        <div className="field span-all">
          <label>Evidence name <span className="req">*</span></label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Treasury reconciliation Q2 — Sitapur" />
        </div>
        <div className="field span-all">
          <label>Description</label>
          <textarea className="textarea wide" style={{ minHeight: 140 }} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Detailed description — what the evidence covers, source, period covered, sampling reference, verification notes and exceptions if any…" />
        </div>
      </div>
    </Modal>
  )
}

/* ======================================================================== */
/* Findings                                                                  */
/* ======================================================================== */
function FindingsTab({ audit, findings, canCreate, canRespond, canClose, data, save, remove, notify, currentUser, coordinatorId, caoIds, toast, logActivity }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editF, setEditF] = useState(null)
  const [viewF, setViewF] = useState(null)
  const [respondF, setRespondF] = useState(null)
  const [response, setResponse] = useState('')

  const createFinding = async (f) => {
    const rec = {
      id: uid('f'), auditId: audit.id, auditCode: audit.code, departmentId: audit.departmentId,
      title: f.title, category: f.category, severity: f.severity, status: 'Open',
      amountInvolved: f.amount ? Number(f.amount) * 100000 : 0,
      description: f.description, raisedBy: currentUser.id, raisedByName: currentUser.name,
      raisedDate: new Date().toISOString(), dueDate: f.dueDate, responses: []
    }
    await save('findings', rec, { logAction: 'Raised finding', logDetail: `${audit.code} — ${f.title}` })
    if (coordinatorId) await notify([coordinatorId], 'Finding', `New finding on ${audit.code}`, f.title, '#/findings')
    await notify([...caoIds], 'Finding', `New finding on ${audit.code}`, f.title, '#/findings')
    setShowAdd(false)
    toast('Finding raised and department notified')
  }

  const updateFinding = async (f) => {
    await save('findings', f, { logAction: 'Updated finding', logDetail: `${audit.code} — ${f.title}` })
    setEditF(null)
    toast('Finding updated')
  }

  const deleteFinding = async (f) => {
    await remove('findings', f.id, { logAction: 'Deleted finding', logDetail: `${audit.code} — ${f.title}` })
    toast('Finding removed')
  }

  const changeStatus = async (f, status, remarks) => {
    const upd = { ...f, status }
    await save('findings', upd, { logAction: `Finding marked ${status}`, logDetail: `${f.title}${remarks ? ` — ${remarks}` : ''}`, logRemarks: remarks })
    const targets = [f.raisedBy, coordinatorId, ...caoIds].filter(Boolean)
    await notify(targets, 'Finding', `Finding ${status.toLowerCase()}`, `${f.title}${remarks ? ` — remarks: ${remarks}` : ''}`, '#/findings', remarks)
    setViewF(null)
    toast(`Finding marked ${status}`)
  }

  const submitResponse = async () => {
    const upd = {
      ...respondF,
      responses: [...(respondF.responses || []), {
        by: `${currentUser.name} (Department Coordinator)`, role: 'coordinator', type: 'Response',
        text: response, date: new Date().toISOString()
      }],
      status: respondF.status === 'Open' ? 'Under Review' : respondF.status
    }
    await save('findings', upd, { logAction: 'Responded to finding', logDetail: `${respondF.title}` })
    await notify([respondF.raisedBy, ...caoIds], 'Finding', 'Department response received', `${respondF.title} — ${response.slice(0, 90)}…`, '#/findings')
    setRespondF(null); setResponse('')
    toast('Response submitted to the audit team')
  }

  return (
    <div>
      <div className="flex-between mb-2">
        <div className="muted small">{findings.length} findings on this audit</div>
        {canCreate && <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Raise Finding</button>}
      </div>

      <DataTable
        rows={findings}
        columns={[
          {
            key: 'title', label: 'Finding', sortable: true,
            render: (f) => (
              <div style={{ maxWidth: 320 }}>
                <div className="cell-strong ellipsis" title={f.title}>{f.title}</div>
                <div className="cell-sub">{f.category} · raised {fmtDate(f.raisedDate)}</div>
              </div>
            )
          },
          { key: 'severity', label: 'Severity', sortable: true, render: (f) => <SeverityBadge s={f.severity} /> },
          { key: 'status', label: 'Status', sortable: true, render: (f) => <Badge kind={f.status}>{f.status}</Badge> },
          { key: 'amount', label: 'Amount', num: true, sortable: true, sort: (f) => f.amountInvolved, render: (f) => f.amountInvolved ? fmtINR(f.amountInvolved) : '—' },
          {
            key: 'due', label: 'Due', sortable: true, sort: (f) => f.dueDate,
            render: (f) => <span className="nowrap">{fmtDate(f.dueDate)}{daysFromNow(f.dueDate) < 0 && !['Resolved', 'Closed'].includes(f.status) && <span className="badge danger" style={{ marginLeft: 5 }}>late</span>}</span>
          },
          {
            key: '__actions', label: '', render: (f) => (
              <div className="row-actions">
                <button className="btn-icon" title="View details" onClick={() => setViewF(f)}>👁</button>
                {canCreate && <button className="btn-icon" title="Edit" onClick={() => setEditF(f)}>✎</button>}
                {canRespond && f.status === 'Open' && <button className="btn-icon" title="Respond" onClick={() => { setRespondF(f); setResponse('') }}>↩</button>}
                {canClose && !['Resolved', 'Closed'].includes(f.status) && (
                  <>
                    <button className="btn-icon" title="Mark resolved" onClick={() => changeStatus(f, 'Resolved', '')}>✓</button>
                  </>
                )}
                {canCreate && <button className="btn-icon danger" title="Delete" onClick={() => deleteFinding(f)}>🗑</button>}
              </div>
            )
          }
        ]}
        searchKeys={['title', 'category', 'severity', 'status']}
        searchPlaceholder="Search findings…"
        rowClick={(f) => setViewF(f)}
        emptyTitle="No findings yet"
        emptySub="Findings raised during field work will appear here."
        pageSize={8}
      />

      {/* view finding */}
      <Modal open={!!viewF} onClose={() => setViewF(null)} title={viewF ? viewF.title : ''} sub={viewF ? `${viewF.auditCode} · raised by ${viewF.raisedByName}` : ''} size="lg">
        {viewF && (
          <div>
            <div className="flex mb-2" style={{ gap: 8 }}>
              <SeverityBadge s={viewF.severity} />
              <Badge kind={viewF.status}>{viewF.status}</Badge>
              <span className="tag">{viewF.category}</span>
              {viewF.amountInvolved > 0 && <span className="badge rose">{fmtINR(viewF.amountInvolved)}</span>}
            </div>
            <p style={{ color: 'var(--text-2)' }}>{viewF.description}</p>
            <div className="grid grid-3 mt-2 mb-2">
              <div><span className="muted tiny">RAISED</span><div className="small bold">{fmtDate(viewF.raisedDate)}</div></div>
              <div><span className="muted tiny">RESPONSE DUE</span><div className="small bold">{fmtDate(viewF.dueDate)}</div></div>
              <div><span className="muted tiny">DEPARTMENT</span><div className="small bold">{(data.departments.find((d) => d.id === viewF.departmentId) || {}).name || '—'}</div></div>
            </div>
            <SectionTitle>Department Responses & Action History</SectionTitle>
            {(viewF.responses || []).length === 0 && <div className="muted small">No responses yet.</div>}
            <div className="timeline">
              {(viewF.responses || []).map((r, i) => (
                <div key={i} className="tl-item">
                  <span className="tl-dot ok" />
                  <div className="tl-title">{r.type} — {r.by}</div>
                  <div className="tl-meta">{fmtDateTime(r.date)}</div>
                  <div className="tl-body">{r.text}</div>
                </div>
              ))}
            </div>
            {canClose && !['Resolved', 'Closed'].includes(viewF.status) && (
              <div className="flex mt-3" style={{ gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => { const f = viewF; setViewF(null); changeStatus(f, 'Under Review', '') }}>Mark Under Review</button>
                <button className="btn btn-success" onClick={() => { const f = viewF; setViewF(null); changeStatus(f, 'Resolved', '') }}>Mark Resolved</button>
                <button className="btn btn-secondary" onClick={() => { const f = viewF; setViewF(null); changeStatus(f, 'Closed', '') }}>Close Finding</button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* add finding */}
      <FindingModal open={showAdd} onClose={() => setShowAdd(false)} onSave={createFinding} audit={audit} />

      {/* edit finding */}
      <FindingModal open={!!editF} onClose={() => setEditF(null)} onSave={updateFinding} audit={audit} initial={editF} />

      {/* respond */}
      <Modal
        open={!!respondF} onClose={() => setRespondF(null)} title="Department Response"
        sub={respondF ? respondF.title : ''}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRespondF(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={!response.trim()} onClick={submitResponse}>Submit Response</button>
          </>
        }
      >
        <div className="field">
          <label>Response <span className="req">*</span></label>
          <textarea className="textarea wide" style={{ minHeight: 130 }} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Action taken / clarification for the audit team…" />
        </div>
      </Modal>
    </div>
  )
}

function FindingModal({ open, onClose, onSave, audit, initial }) {
  const [f, setF] = useState(null)
  useEffect(() => {
    if (open) {
      setF(initial || {
        title: '', category: 'Compliance', severity: 'Medium', amount: '', dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), description: ''
      })
    }
  }, [open, initial])
  if (!open || !f) return null
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  return (
    <Modal
      open={open} onClose={onClose} title={initial ? 'Edit Finding' : 'Raise Finding'} sub={audit ? audit.code : ''}
      size="md"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!f.title.trim()} onClick={() => onSave(f)}>{initial ? 'Save' : 'Raise Finding'}</button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field span-all">
          <label>Finding title <span className="req">*</span></label>
          <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Short, factual statement of the irregularity" />
        </div>
        <div className="field">
          <label>Category</label>
          <select className="select" value={f.category} onChange={(e) => set('category', e.target.value)}>
            {['Procurement', 'Compliance', 'Financial Irregularity', 'Performance', 'Fraud', 'IT Security'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Severity</label>
          <select className="select" value={f.severity} onChange={(e) => set('severity', e.target.value)}>
            {['Low', 'Medium', 'High', 'Critical'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Amount involved (₹ lakh)</label>
          <input className="input" type="number" min="0" step="0.1" value={f.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0 if not quantifiable" />
        </div>
        <div className="field">
          <label>Response due date</label>
          <input className="input" type="date" value={String(f.dueDate).slice(0, 10)} onChange={(e) => set('dueDate', e.target.value)} />
        </div>
        <div className="field span-all">
          <label>Description</label>
          <textarea className="textarea wide" style={{ minHeight: 130 }} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Condition, criteria, cause and effect — with reference to evidence items…" />
        </div>
      </div>
    </Modal>
  )
}

/* ======================================================================== */
/* Observations                                                              */
/* ======================================================================== */
function ObservationsTab({ audit, observations, findings, data, canUpdate, canResolve, canEscalate, canRemind, save, notify, sendEmail, currentUser, coordinatorId, caoIds, directorIds, toast, logActivity, commsLogs }) {
  const [showAdd, setShowAdd] = useState(false)
  const [viewO, setViewO] = useState(null)
  const [remindO, setRemindO] = useState(null)
  const [escalateO, setEscalateO] = useState(null)
  const [resolveO, setResolveO] = useState(null)
  const [escLevel, setEscLevel] = useState(1)
  const [altDept, setAltDept] = useState('')

  const createObs = async (o) => {
    const rec = {
      id: uid('o'), findingId: o.findingId || null, auditId: audit.id, title: o.title, requirement: o.requirement,
      departmentId: audit.departmentId, complianceStatus: o.complianceStatus, status: 'Open',
      dueDate: o.dueDate, followUpDate: null, escalationLevel: 0, escalatedTo: null, escalatedAt: null,
      escalationRemarks: '', remindersSent: 0, resolvedAt: null, resolutionNote: '',
      history: [{ date: new Date().toISOString(), event: `Observation raised on ${audit.code} by ${currentUser.name}` }]
    }
    await save('observations', rec, { logAction: 'Raised observation', logDetail: `${audit.code} — ${o.title}` })
    if (coordinatorId) await notify([coordinatorId], 'Compliance', `New compliance observation on ${audit.code}`, o.title, '#/compliance')
    setShowAdd(false)
    toast('Observation raised')
  }

  // ---- manual reminder: remark + selected recipients, fully logged ----
  const sendReminder = async ({ recipients, remark }) => {
    const o = remindO
    const names = recipients.map((r) => r.name).join(', ')
    const upd = {
      ...o, remindersSent: (o.remindersSent || 0) + 1, lastRemindedAt: new Date().toISOString(),
      history: [...(o.history || []), { date: new Date().toISOString(), event: `Reminder #${(o.remindersSent || 0) + 1} sent by ${currentUser.name} to ${names} — remarks: ${remark}` }]
    }
    await save('observations', upd, { logAction: 'Sent reminder', logDetail: `${audit.code} — ${o.title} → ${names}`, logRemarks: remark })
    await dispatchComms(
      { save, notify, sendEmail, currentUser },
      {
        kind: 'Reminder', mode: 'Manual', contextType: 'Observation', contextId: o.id,
        auditId: audit.id, title: o.title, recipients, remark,
        link: `#/audit/${audit.id}`,
        notifyTitle: `Reminder: ${o.title}`,
        notifyBody: `${audit.code} · Response due ${fmtDate(o.dueDate)} — reminder from ${currentUser.name}.`
      }
    )
    setRemindO(null); setViewO(upd)
    toast(`Reminder sent to ${recipients.length} ${recipients.length === 1 ? 'recipient' : 'recipients'} and recorded in the log`)
  }

  // ---- manual escalation: level + remark + selected recipients ----
  const doEscalate = async ({ recipients, remark, level, altDept: ad }) => {
    const o = escalateO
    const lvl = level || escLevel
    const levelLabel = ['', 'Department Director', 'Head of Department', 'Audit Director', 'Executive Board'][lvl] || `Level ${lvl}`
    const names = recipients.map((r) => r.name).join(', ')
    const upd = {
      ...o,
      status: 'Escalated',
      escalationLevel: lvl,
      escalatedTo: levelLabel,
      escalatedAt: new Date().toISOString(),
      escalationRemarks: remark,
      history: [...(o.history || []), { date: new Date().toISOString(), event: `Escalated to Level ${lvl} (${levelLabel})${ad ? ` (parallel notice to ${ad})` : ''} by ${currentUser.name} — remarks: ${remark}` }]
    }
    await save('observations', upd, { logAction: 'Escalated observation', logDetail: `${audit.code} — ${upd.title} → Level ${lvl} (${levelLabel})`, logRemarks: remark })
    await dispatchComms(
      { save, notify, sendEmail, currentUser },
      {
        kind: 'Escalation', mode: 'Manual', contextType: 'Observation', contextId: o.id,
        auditId: audit.id, title: o.title, recipients, remark, level: lvl, escalatedTo: levelLabel,
        link: `#/audit/${audit.id}`,
        notifyTitle: `Escalated to Level ${lvl}: ${o.title}`,
        notifyBody: `${audit.code} · ${levelLabel}${ad ? ` · parallel notice: ${ad}` : ''} — by ${currentUser.name}.`
      }
    )
    setEscalateO(null); setViewO(upd); setAltDept('')
    toast('Escalation recorded, stakeholders notified and logged')
  }

  const doResolve = async (note) => {
    const upd = {
      ...resolveO,
      status: 'Resolved', resolvedAt: new Date().toISOString(), resolutionNote: note,
      history: [...(resolveO.history || []), { date: new Date().toISOString(), event: `Resolved by ${currentUser.name} — ${note}` }]
    }
    await save('observations', upd, { logAction: 'Resolved observation', logDetail: `${upd.title} — ${note}`, logRemarks: note })
    await notify([...caoIds, coordinatorId].filter(Boolean), 'Compliance', `Observation resolved — ${upd.title}`, note, '#/compliance', note)
    setResolveO(null)
    toast('Observation resolved')
  }

  const obsLogs = (o) => (commsLogs || []).filter((l) => l.contextType === 'Observation' && l.contextId === o.id)

  return (
    <div>
      <div className="flex-between mb-2">
        <div className="muted small">{observations.length} compliance observations on this audit</div>
        {canUpdate && <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Raise Observation</button>}
      </div>

      <DataTable
        rows={observations}
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
          { key: 'complianceStatus', label: 'Compliance', sortable: true, render: (o) => <Badge kind={o.complianceStatus}>{o.complianceStatus}</Badge> },
          { key: 'status', label: 'Tracking', sortable: true, render: (o) => <Badge kind={o.status}>{o.status}</Badge> },
          { key: 'escalationLevel', label: 'Escalation', num: true, sortable: true, sort: (o) => o.escalationLevel || 0, render: (o) => <EscalationBadge level={o.escalationLevel} /> },
          {
            key: 'dueDate', label: 'Due', sortable: true,
            render: (o) => <span className="nowrap">{fmtDate(o.dueDate)}{daysFromNow(o.dueDate) < 0 && o.status !== 'Resolved' && <span className="badge danger" style={{ marginLeft: 5 }}>late</span>}</span>
          },
          { key: 'remindersSent', label: 'Reminders', num: true, sortable: true, render: (o) => o.remindersSent || 0 },
          {
            key: '__actions', label: '', render: (o) => (
              <div className="row-actions">
                <button className="btn-icon" title="View details" onClick={() => setViewO(o)}>👁</button>
                {canRemind && o.status !== 'Resolved' && <button className="btn-icon" title="Send reminder (with remark & recipients)" onClick={() => setRemindO(o)}>🔔</button>}
                {canEscalate && o.status !== 'Resolved' && <button className="btn-icon danger" title="Escalate" onClick={() => { setEscalateO(o); setEscLevel(Math.min(4, (o.escalationLevel || 0) + 1)); setAltDept('') }}>↑</button>}
                {canResolve && o.status !== 'Resolved' && <button className="btn-icon" title="Resolve" onClick={() => setResolveO(o)}>✓</button>}
              </div>
            )
          }
        ]}
        searchKeys={['title', 'requirement', 'complianceStatus', 'status']}
        searchPlaceholder="Search observations…"
        rowClick={(o) => setViewO(o)}
        emptyTitle="No observations"
        emptySub="Compliance observations raised on this audit appear here."
        pageSize={8}
      />

      {/* view observation */}
      <Modal open={!!viewO} onClose={() => setViewO(null)} title={viewO ? viewO.title : ''} sub={viewO ? `${audit.code} · ${viewO.requirement}` : ''} size="lg">
        {viewO && (
          <div>
            <div className="flex mb-2" style={{ gap: 8 }}>
              <Badge kind={viewO.complianceStatus}>{viewO.complianceStatus}</Badge>
              <Badge kind={viewO.status}>{viewO.status}</Badge>
              {viewO.escalationLevel > 0 && <EscalationBadge level={viewO.escalationLevel} />}
            </div>
            <div className="grid grid-3 mb-2">
              <div><span className="muted tiny">DUE DATE</span><div className="small bold">{fmtDate(viewO.dueDate)}</div></div>
              <div><span className="muted tiny">REMINDERS SENT</span><div className="small bold">{viewO.remindersSent || 0}</div></div>
              <div><span className="muted tiny">LINKED FINDING</span><div className="small bold">{viewO.findingId ? (findings.find((f) => f.id === viewO.findingId) || {}).title || '—' : '—'}</div></div>
            </div>
            {viewO.escalationRemarks && (
              <div className="tl-body mb-2" style={{ background: 'var(--danger-soft)' }}>
                <span className="bold">Escalation remarks: </span>{viewO.escalationRemarks}
              </div>
            )}
            {viewO.status === 'Resolved' && viewO.resolutionNote && (
              <div className="tl-body mb-2" style={{ background: 'var(--success-soft)' }}>
                <span className="bold">Resolution: </span>{viewO.resolutionNote}
              </div>
            )}
            <div className="mb-3">
              <CommsHistory logs={obsLogs(viewO)} users={data.users} />
            </div>
            <SectionTitle>Follow-up History</SectionTitle>
            <div className="timeline">
              {(viewO.history || []).map((h, i) => (
                <div key={i} className="tl-item">
                  <span className="tl-dot" />
                  <div className="tl-title">{h.event}</div>
                  <div className="tl-meta">{fmtDateTime(h.date)}</div>
                </div>
              ))}
            </div>
            <div className="flex mt-3" style={{ gap: 8, flexWrap: 'wrap' }}>
              {canRemind && viewO.status !== 'Resolved' && <button className="btn btn-secondary" onClick={() => setRemindO(viewO)}>🔔 Send Reminder</button>}
              {canEscalate && viewO.status !== 'Resolved' && (
                <button className="btn btn-danger" onClick={() => { setEscalateO(viewO); setEscLevel(Math.min(4, (viewO.escalationLevel || 0) + 1)); setAltDept('') }}>↑ Escalate</button>
              )}
              {canResolve && viewO.status !== 'Resolved' && <button className="btn btn-success" onClick={() => setResolveO(viewO)}>✓ Resolve</button>}
            </div>
          </div>
        )}
      </Modal>

      {/* add observation */}
      <ObsModal open={showAdd} onClose={() => setShowAdd(false)} onSave={createObs} findings={findings} />

      {/* reminder modal — remark + role-based recipients */}
      <CommsActionModal
        open={!!remindO} onClose={() => setRemindO(null)}
        kind="Reminder" onSend={sendReminder}
        currentUser={currentUser} users={data.users}
        audit={audit}
        coordinatorId={coordinatorId || null}
        contextTitle={remindO ? remindO.title : ''}
        contextSub={remindO ? `${audit.code} · ${remindO.requirement}` : ''}
        dueLabel={remindO ? fmtDate(remindO.dueDate) : ''}
        initialGroups={['coord', 'team']}
      />

      {/* escalate modal — level + remark + recipients */}
      <CommsActionModal
        open={!!escalateO} onClose={() => setEscalateO(null)}
        kind="Escalation" onSend={doEscalate}
        currentUser={currentUser} users={data.users}
        audit={audit}
        coordinatorId={coordinatorId || null}
        contextTitle={escalateO ? escalateO.title : ''}
        contextSub={escalateO ? `${audit.code} · ${escalateO.requirement}` : ''}
        dueLabel={escalateO ? fmtDate(escalateO.dueDate) : ''}
        initialLevel={escLevel}
        initialGroups={['coord', 'role:cao']}
        levelDefaults={REVIEW_LEVEL_DEFAULTS}
        altDeptOptions={data.departments.filter((d) => d.id !== audit.departmentId).map((d) => ({ id: d.id, name: d.name }))}
        altDeptValue={altDept}
        onAltDeptChange={setAltDept}
      />

      {/* resolve */}
      <Modal
        open={!!resolveO} onClose={() => setResolveO(null)} title="Resolve Observation" sub={resolveO ? `${resolveO.title} — verified compliance position required` : ''}
        footer={<ConfirmResolve onResolve={doResolve} />}
      >
        <p className="muted small" style={{ margin: 0 }}>
          The resolution note is recorded in the follow-up history, the activity trail and sent to reviewers with the notification.
        </p>
      </Modal>
    </div>
  )
}

function ConfirmResolve({ onResolve }) {
  const [note, setNote] = useState('')
  return (
    <>
      <div style={{ flex: 1, marginRight: 10 }}>
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resolution note (required) — verified compliance position…" />
      </div>
      <button className="btn btn-success" disabled={!note.trim()} onClick={() => onResolve(note.trim())}>Resolve</button>
    </>
  )
}

function ObsModal({ open, onClose, onSave, findings }) {
  const [o, setO] = useState(null)
  useEffect(() => {
    if (open) setO({ title: '', requirement: '', complianceStatus: 'Non-Compliant', dueDate: new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10), findingId: '' })
  }, [open])
  if (!open || !o) return null
  const set = (k, v) => setO((x) => ({ ...x, [k]: v }))
  return (
    <Modal
      open={open} onClose={onClose} title="Raise Compliance Observation" size="md"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!o.title.trim() || !o.requirement.trim()} onClick={() => onSave(o)}>Raise Observation</button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field span-all">
          <label>Observation title <span className="req">*</span></label>
          <input className="input" value={o.title} onChange={(e) => set('title', e.target.value)} placeholder="Requirement not being complied with" />
        </div>
        <div className="field span-all">
          <label>Rule / requirement violated <span className="req">*</span></label>
          <input className="input" value={o.requirement} onChange={(e) => set('requirement', e.target.value)} placeholder="e.g. Financial Rules 2017 Rule 149" />
        </div>
        <div className="field">
          <label>Compliance status</label>
          <select className="select" value={o.complianceStatus} onChange={(e) => set('complianceStatus', e.target.value)}>
            {['Compliant', 'Partially Compliant', 'Non-Compliant', 'Pending'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Compliance due date</label>
          <input className="input" type="date" value={String(o.dueDate).slice(0, 10)} onChange={(e) => set('dueDate', e.target.value)} />
        </div>
        <div className="field span-all">
          <label>Link to finding (optional)</label>
          <select className="select" value={o.findingId} onChange={(e) => set('findingId', e.target.value)}>
            <option value="">No linked finding</option>
            {findings.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  )
}

/* ======================================================================== */
/* Work Papers                                                               */
/* ======================================================================== */
function WorkpapersTab({ audit, canEdit, canApprove, mutate, currentUser, toast }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editWp, setEditWp] = useState(null)
  const [statusWp, setStatusWp] = useState(null)
  const [statusForm, setStatusForm] = useState({ status: 'Submitted', remarks: '' })

  const saveWp = async (wp) => {
    const exists = (audit.workpapers || []).some((w) => w.id === wp.id)
    const workpapers = exists ? audit.workpapers.map((w) => (w.id === wp.id ? wp : w)) : [...(audit.workpapers || []), wp]
    await mutate({ workpapers }, exists ? `Work paper updated — ${wp.ref}` : `Work paper prepared — ${wp.ref} (${wp.title})`, exists ? 'Updated work paper' : 'Prepared work paper')
    setShowAdd(false); setEditWp(null)
    toast('Work paper saved')
  }

  const deleteWp = async (wp) => {
    const workpapers = (audit.workpapers || []).filter((w) => w.id !== wp.id)
    await mutate({ workpapers }, `Work paper removed — ${wp.ref}`, 'Deleted work paper')
    toast('Work paper removed')
  }

  const changeStatus = async () => {
    const wp = { ...statusWp, status: statusForm.status, remarks: statusForm.remarks, reviewedBy: ['Reviewed', 'Approved'].includes(statusForm.status) ? `${currentUser.name}` : statusWp.reviewedBy }
    const workpapers = audit.workpapers.map((w) => (w.id === wp.id ? wp : w))
    await mutate(
      { workpapers },
      `Work paper ${statusWp.ref} marked ${statusForm.status}${statusForm.remarks ? ` — ${statusForm.remarks}` : ''}`,
      `Work paper ${statusForm.status.toLowerCase()}`
    )
    setStatusWp(null)
    toast(`Work paper marked ${statusForm.status}`)
  }

  return (
    <div>
      <div className="flex-between mb-2">
        <div className="muted small">{(audit.workpapers || []).length} work papers · Draft → Submitted → Reviewed → Approved</div>
        {canEdit && <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ New Work Paper</button>}
      </div>

      <DataTable
        rows={audit.workpapers || []}
        columns={[
          { key: 'ref', label: 'Ref', sortable: true, render: (w) => <span className="mono bold">{w.ref}</span> },
          {
            key: 'title', label: 'Work paper', sortable: true,
            render: (w) => <div><div className="cell-strong">{w.title}</div>{w.remarks && <div className="cell-sub ellipsis" style={{ maxWidth: 260 }}>{w.remarks}</div>}</div>
          },
          { key: 'preparedBy', label: 'Prepared by', sortable: true },
          { key: 'status', label: 'Status', sortable: true, render: (w) => <Badge kind={w.status}>{w.status}</Badge> },
          { key: 'reviewedBy', label: 'Reviewed by', sortable: true, render: (w) => w.reviewedBy || '—' },
          { key: 'date', label: 'Date', sortable: true, sort: (w) => w.date, render: (w) => fmtDate(w.date) },
          {
            key: '__actions', label: '', render: (w) => (
              <div className="row-actions">
                {canEdit && w.status === 'Draft' && <button className="btn-icon" title="Submit for review" onClick={() => { setStatusWp(w); setStatusForm({ status: 'Submitted', remarks: '' }) }}>➤</button>}
                {canApprove && w.status === 'Submitted' && <button className="btn-icon" title="Review" onClick={() => { setStatusWp(w); setStatusForm({ status: 'Reviewed', remarks: '' }) }}>👁</button>}
                {canApprove && ['Submitted', 'Reviewed'].includes(w.status) && <button className="btn-icon" title="Approve" onClick={() => { setStatusWp(w); setStatusForm({ status: 'Approved', remarks: '' }) }}>✓</button>}
                {canEdit && <button className="btn-icon" title="Edit" onClick={() => setEditWp(w)}>✎</button>}
                {canEdit && <button className="btn-icon danger" title="Delete" onClick={() => deleteWp(w)}>🗑</button>}
              </div>
            )
          }
        ]}
        searchKeys={['ref', 'title', 'preparedBy', 'status']}
        searchPlaceholder="Search work papers…"
        emptyTitle="No work papers"
        emptySub="Prepare audit programme, sampling plans and testing sheets here."
        pageSize={8}
      />

      <WpModal open={showAdd || !!editWp} onClose={() => { setShowAdd(false); setEditWp(null) }} onSave={saveWp} initial={editWp} audit={audit} currentUser={currentUser} />

      <Modal
        open={!!statusWp} onClose={() => setStatusWp(null)} title={`Work paper ${statusForm.status}`}
        sub={statusWp ? `${statusWp.ref} · ${statusWp.title}` : ''}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setStatusWp(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={statusForm.status === 'Approved' && !statusForm.remarks.trim()} onClick={changeStatus}>Confirm</button>
          </>
        }
      >
        <div className="field">
          <label>Status</label>
          <select className="select" value={statusForm.status} onChange={(e) => setStatusForm((f) => ({ ...f, status: e.target.value }))}>
            {['Draft', 'Submitted', 'Reviewed', 'Approved'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field mt-2">
          <label>Remarks {statusForm.status === 'Approved' ? <span className="req">*</span> : ''}</label>
          <textarea className="textarea wide" value={statusForm.remarks} onChange={(e) => setStatusForm((f) => ({ ...f, remarks: e.target.value }))} placeholder="Review remarks - recorded in the audit trail and notifications" />
        </div>
      </Modal>
    </div>
  )
}

function WpModal({ open, onClose, onSave, initial, audit, currentUser }) {
  const [w, setW] = useState(null)
  useEffect(() => {
    if (open) {
      setW(initial || {
        id: uid('wp'), ref: `WP-${String(((audit.workpapers || []).length + 1)).padStart(2, '0')}`,
        title: '', preparedBy: currentUser.name, status: 'Draft', reviewedBy: null,
        date: new Date().toISOString(), remarks: ''
      })
    }
  }, [open, initial])
  if (!open || !w) return null
  const set = (k, v) => setW((x) => ({ ...x, [k]: v }))
  return (
    <Modal
      open={open} onClose={onClose} title={initial ? 'Edit Work Paper' : 'New Work Paper'} sub={audit.code}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!w.title.trim() || !w.ref.trim()} onClick={() => onSave(w)}>Save</button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field">
          <label>Reference <span className="req">*</span></label>
          <input className="input" value={w.ref} onChange={(e) => set('ref', e.target.value)} placeholder="WP-A-01" />
        </div>
        <div className="field">
          <label>Date</label>
          <input className="input" type="date" value={String(w.date).slice(0, 10)} onChange={(e) => set('date', e.target.value)} />
        </div>
        <div className="field span-all">
          <label>Title <span className="req">*</span></label>
          <input className="input" value={w.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Sampling plan & sample list" />
        </div>
        <div className="field span-all">
          <label>Remarks / contents note</label>
          <textarea className="textarea wide" value={w.remarks} onChange={(e) => set('remarks', e.target.value)} placeholder="What this work paper documents, cross-references to evidence…" />
        </div>
      </div>
    </Modal>
  )
}

/* ======================================================================== */
/* Review                                                                    */
/* ======================================================================== */
function ReviewTab({ audit, canSubmit, canApprove, canFinalise, canRemind, mutate, currentUser, directorIds, caoIds, notify, toast, users, save, sendEmail, coordinatorId }) {
  const [action, setAction] = useState(null) // {type, }
  const [remarks, setRemarks] = useState('')
  const [remindOpen, setRemindOpen] = useState(false)

  // ---- manual review reminder: remark + selected recipients, logged ----
  const sendReviewReminder = async ({ recipients, remark }) => {
    const names = recipients.map((r) => r.name).join(', ')
    const updated = {
      ...audit,
      timeline: [...(audit.timeline || []), { date: new Date().toISOString(), by: currentUser.name, event: `Review reminder sent by ${currentUser.name} to ${names} — remarks: ${remark}` }]
    }
    await save('audits', updated, { logAction: 'Sent reminder', logDetail: `${audit.code} — review pending (${audit.status})`, logRemarks: remark })
    await dispatchComms(
      { save, notify, sendEmail, currentUser },
      {
        kind: 'Reminder', mode: 'Manual', contextType: 'Audit', contextId: audit.id,
        auditId: audit.id, title: `${audit.code} — review reminder`, recipients, remark,
        link: `#/audit/${audit.id}`,
        notifyTitle: `Review reminder: ${audit.code}`,
        notifyBody: `Audit is ${audit.status} — action requested by ${currentUser.name}.`
      }
    )
    setRemindOpen(false)
    toast(`Review reminder sent to ${recipients.length} ${recipients.length === 1 ? 'recipient' : 'recipients'}`)
  }

  const doAction = async (type) => {
    if (type === 'submit') {
      await mutate(
        { status: 'Under Review', reviewHistory: [...(audit.reviewHistory || []), { action: 'Submitted for review', by: currentUser.name, date: new Date().toISOString(), notes: remarks || 'Documentation complete.' }] },
        `Submitted for review${remarks ? ` — ${remarks}` : ''}`,
        'Submitted audit for review',
        { body: `${audit.code} submitted for review by ${currentUser.name}`, remarks }
      )
    }
    if (type === 'approve') {
      await mutate(
        {
          status: 'Completed',
          reviewHistory: [...(audit.reviewHistory || []), { action: 'Approved by ' + currentUser.name, by: currentUser.name, date: new Date().toISOString(), notes: remarks }]
        },
        `Audit approved by ${currentUser.name}${remarks ? ` — ${remarks}` : ''}`,
        'Approved audit',
        { body: `${audit.code} approved by ${currentUser.name}`, remarks, to: [...directorIds, ...audit.team.map((t) => t.userId)] }
      )
    }
    if (type === 'reject') {
      await mutate(
        {
          status: 'In Progress',
          reviewHistory: [...(audit.reviewHistory || []), { action: 'Changes requested by ' + currentUser.name, by: currentUser.name, date: new Date().toISOString(), notes: remarks }]
        },
        `Changes requested by ${currentUser.name} — ${remarks}`,
        'Requested changes on audit',
        { body: `${audit.code}: changes requested by ${currentUser.name}`, remarks }
      )
    }
    if (type === 'finalise') {
      await mutate(
        {
          status: 'Closed',
          reviewHistory: [...(audit.reviewHistory || []), { action: 'Finalised & issued by ' + currentUser.name, by: currentUser.name, date: new Date().toISOString(), notes: remarks }]
        },
        `Audit finalised and issued by ${currentUser.name}${remarks ? ` — ${remarks}` : ''}`,
        'Finalised audit',
        { body: `${audit.code} final report issued by ${currentUser.name}`, remarks, to: [...caoIds, ...audit.team.map((t) => t.userId)] }
      )
    }
    setAction(null); setRemarks('')
    toast('Review action recorded')
  }

  const nextAction = () => {
    if (audit.status === 'In Progress' && canSubmit) return { type: 'submit', label: 'Submit for Review', cls: 'btn-primary', desc: 'Submit the completed documentation for quality review.' }
    if (audit.status === 'Under Review' && canApprove) return { type: 'approve', label: 'Approve Audit', cls: 'btn-success', desc: 'Approve the audit documentation and findings.' }
    if (audit.status === 'Completed' && canFinalise) return { type: 'finalise', label: 'Finalise & Issue', cls: 'btn-primary', desc: 'Issue the final report to the department and close the audit.' }
    return null
  }
  const na = nextAction()

  return (
    <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
      <div className="card">
        <div className="card-head"><h3>Review History</h3><span className="hint">all approvals with remarks</span></div>
        <div className="card-pad">
          {(audit.reviewHistory || []).length === 0 && <Empty icon="✓" title="No review activity yet" sub="Once the audit is submitted, review actions appear here." />}
          <div className="timeline">
            {(audit.reviewHistory || []).map((r, i) => (
              <div key={i} className={`tl-item ${r.action.includes('Approved') || r.action.includes('Finalised') ? 'ok' : ''}`}>
                <span className="tl-dot" />
                <div className="tl-title">{r.action}</div>
                <div className="tl-meta">{r.by} · {fmtDateTime(r.date)}</div>
                {r.notes && <div className="tl-body">{r.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-col" style={{ gap: 16 }}>
        <div className="card">
          <div className="card-head"><h3>Current Status</h3></div>
          <div className="card-pad center">
            <Badge kind={audit.status}>{audit.status}</Badge>
            <div className="muted small mt-2">
              {audit.status === 'In Progress' && 'Field work in progress. Submit when documentation is complete.'}
              {audit.status === 'Under Review' && 'Awaiting quality review by the Chief Audit Officer.'}
              {audit.status === 'Completed' && 'Approved by CAO. Awaiting final issue by the Director.'}
              {audit.status === 'Closed' && 'Final report issued. Compliance tracking continues on observations.'}
              {['Planned', 'Scheduled'].includes(audit.status) && 'Audit not yet started.'}
            </div>
          </div>
        </div>
        {na && (
          <div className="card">
            <div className="card-head"><h3>Next Step</h3></div>
            <div className="card-pad">
              <p className="muted small" style={{ marginBottom: 12 }}>{na.desc}</p>
              <div className="flex-col" style={{ gap: 8 }}>
                <button className={`btn ${na.cls}`} onClick={() => { setAction(na.type); setRemarks('') }}>{na.label}</button>
                {audit.status === 'Under Review' && canApprove && (
                  <button className="btn btn-danger" onClick={() => { setAction('reject'); setRemarks('') }}>Request Changes</button>
                )}
                {canRemind && (
                  <button className="btn btn-secondary" onClick={() => setRemindOpen(true)}>🔔 Send Review Reminder</button>
                )}
              </div>
            </div>
          </div>
        )}
        {canRemind && !na && (
          <div className="card">
            <div className="card-head"><h3>Follow-up</h3></div>
            <div className="card-pad">
              <p className="muted small" style={{ marginBottom: 12 }}>Nudge the people whose action is pending on this audit — with a remark, and recorded in the communication log.</p>
              <button className="btn btn-secondary" onClick={() => setRemindOpen(true)}>🔔 Send Review Reminder</button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={!!action} onClose={() => setAction(null)}
        title={action === 'approve' ? 'Approve Audit' : action === 'reject' ? 'Request Changes' : action === 'finalise' ? 'Finalise & Issue' : 'Submit for Review'}
        sub={audit.code}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setAction(null)}>Cancel</button>
            <button
              className={`btn ${action === 'reject' ? 'btn-danger' : 'btn-primary'}`}
              disabled={action === 'reject' && !remarks.trim()}
              onClick={() => doAction(action)}
            >
              Confirm
            </button>
          </>
        }
      >
        <div className="field">
          <label>Remarks {action === 'reject' ? <span className="req">*</span> : ''}</label>
          <textarea className="textarea wide" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Recorded in the audit trail and sent with notifications" />
        </div>
      </Modal>

      {/* review reminder — remark + role-based recipients */}
      <CommsActionModal
        open={remindOpen} onClose={() => setRemindOpen(false)}
        kind="Reminder" onSend={sendReviewReminder}
        currentUser={currentUser} users={users || []}
        audit={audit}
        coordinatorId={coordinatorId || null}
        contextTitle={`${audit.code} · ${audit.title}`}
        contextSub={`Status: ${audit.status} — pending action`}
        initialGroups={audit.status === 'Completed' ? ['role:director'] : ['role:cao']}
      />
    </div>
  )
}

/* ======================================================================== */
/* Discussion                                                                */
/* ======================================================================== */
function DiscussionTab({ audit, mutate, currentUser, canPost }) {
  const [text, setText] = useState('')

  const post = async () => {
    if (!text.trim()) return
    const comment = {
      id: uid('cm'), userId: currentUser.id, userName: currentUser.name,
      text: text.trim(), timestamp: new Date().toISOString()
    }
    await mutate(
      { comments: [...(audit.comments || []), comment] },
      `Discussion: ${currentUser.name} commented on ${audit.code}`,
      'Commented on audit',
      { body: `${currentUser.name}: ${text.trim().slice(0, 80)}`, to: [] }
    )
    setText('')
  }

  return (
    <div className="card" style={{ maxHeight: 'calc(100vh - 230px)', display: 'flex', flexDirection: 'column' }}>
      <div className="card-head"><h3>Team Discussion</h3><span className="hint">{(audit.comments || []).length} messages · visible to the audit team</span></div>
      <div className="chat-body scroll-y">
        {(audit.comments || []).length === 0 && <Empty icon="💬" title="No messages yet" sub="Coordinate field work, share updates and flag blockers here." />}
        {(audit.comments || []).map((c) => {
          const mine = c.userId === currentUser.id
          return (
            <div key={c.id} className={`chat-msg ${mine ? 'mine' : ''}`}>
              <Avatar name={c.userName} color={(c.userId === currentUser.id) ? currentUser.avatarColor : undefined} />
              <div className="cm-body">
                {!mine && <div className="cm-sender">{c.userName}</div>}
                <div className="cm-text">{c.text}</div>
                <div className="cm-time">{fmtRelative(c.timestamp)}</div>
              </div>
            </div>
          )
        })}
      </div>
      {canPost && (
        <div className="chat-foot">
          <input
            className="input" style={{ flex: 1 }}
            placeholder="Write a message to the team…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && post()}
          />
          <button className="btn btn-primary" disabled={!text.trim()} onClick={post}>Send</button>
        </div>
      )}
    </div>
  )
}
