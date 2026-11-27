// Shared reminder & escalation UI.
// - CommsActionModal: manual reminder / escalation with a REQUIRED remark and
//   role-based recipient selection (audit team, department coordinator,
//   roles above / same level / below the sender).
// - CommsLogTable: reusable, searchable log of every reminder & escalation
//   with filters, detail modal and click-through.
// - CommsHistory: compact timeline used inside detail modals.
import { useEffect, useMemo, useState } from 'react'
import { Modal, Badge, DataTable, Avatar, InfoTip } from './ui'
import { buildRecipientGroups, resolveRecipients } from '../lib/comms'
import { ROLES } from '../lib/permissions'
import { fmtDateTime, fmtRelative } from '../lib/utils'
import { navigate } from '../lib/router'

export const ESCALATION_LEVELS = [
  { level: 1, label: 'Level 1 — Department Director', desc: 'Escalate to the director of the concerned department' },
  { level: 2, label: 'Level 2 — Head of Department', desc: 'Escalate to the administrative head of the department' },
  { level: 3, label: 'Level 3 — Audit Director', desc: 'Bring to the Audit Director for intervention' },
  { level: 4, label: 'Level 4 — Executive Board', desc: 'Highest level - place before the executive board' }
]

/* ==========================================================================
   CommsActionModal
   ========================================================================== */
export function CommsActionModal({
  open, onClose, onSend,
  kind, // 'Reminder' | 'Escalation'
  currentUser, users, audit, coordinatorId,
  contextTitle, contextSub, dueLabel,
  levelDefaults = {}, // escalation: { 1: ['coord','role:cao'], ... }
  initialLevel = 1, initialGroups = ['coord'],
  altDeptOptions = [], altDeptValue = '', onAltDeptChange
}) {
  const isEsc = kind === 'Escalation'
  const [remark, setRemark] = useState('')
  const [level, setLevel] = useState(initialLevel)
  const [selected, setSelected] = useState(initialGroups)

  useEffect(() => {
    if (open) {
      setRemark('')
      setLevel(initialLevel)
      setSelected(isEsc ? levelDefaults[initialLevel] || initialGroups : initialGroups)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const groups = useMemo(
    () => buildRecipientGroups(currentUser, users, audit, coordinatorId),
    [currentUser, users, audit, coordinatorId]
  )
  const recipients = useMemo(
    () => resolveRecipients(groups, selected, users, currentUser ? currentUser.id : null),
    [groups, selected, users, currentUser]
  )

  const toggle = (key) =>
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]))

  const pickLevel = (lv) => {
    setLevel(lv)
    setSelected(levelDefaults[lv] || [])
  }

  const send = () => {
    onSend({ recipients, remark: remark.trim(), level: Number(level), altDept: altDeptValue })
    setRemark(''); setSelected([])
  }

  return (
    <Modal
      open={open} onClose={onClose}
      title={isEsc ? 'Escalate — level, recipients & remarks' : 'Send Reminder — recipients & remarks'}
      sub={contextTitle || ''}
      size="md"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className={isEsc ? 'btn btn-danger' : 'btn btn-primary'}
            disabled={!remark.trim() || recipients.length === 0}
            onClick={send}
          >
            {isEsc ? `Escalate — notify ${recipients.length} ${recipients.length === 1 ? 'person' : 'people'}` : `Send to ${recipients.length} ${recipients.length === 1 ? 'recipient' : 'recipients'}`}
          </button>
        </>
      }
    >
      <div className="flex-col" style={{ gap: 12 }}>
        {/* context summary */}
        <div className="comms-ctx">
          <div className="bold small">{contextTitle}</div>
          {contextSub && <div className="muted tiny">{contextSub}</div>}
          {dueLabel && <div className="muted tiny">Due: <b style={{ color: 'var(--warning)' }}>{dueLabel}</b></div>}
        </div>

        {/* escalation level */}
        {isEsc && (
          <div className="field">
            <label>Escalation level <span className="req">*</span> <InfoTip text="Choose the authority who should intervene. You can escalate within the same level to another department, or go to a higher level." /></label>
            <div className="flex-col" style={{ gap: 7 }}>
              {ESCALATION_LEVELS.map((l) => (
                <label key={l.level} className="check-item" style={{ cursor: 'pointer', borderColor: Number(level) === l.level ? 'var(--thistle-500)' : undefined }}>
                  <input type="radio" name="comms-esc-level" checked={Number(level) === l.level} onChange={() => pickLevel(l.level)} style={{ accentColor: 'var(--thistle-500)' }} />
                  <div>
                    <div className="bold small">{l.label}</div>
                    <div className="muted tiny">{l.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* parallel department notice */}
        {isEsc && altDeptOptions.length > 0 && (
          <div className="field">
            <label>Parallel notice to another department (optional)</label>
            <select className="select" value={altDeptValue} onChange={(e) => onAltDeptChange && onAltDeptChange(e.target.value)}>
              <option value="">Not applicable</option>
              {altDeptOptions.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
        )}

        {/* recipients */}
        <div className="field">
          <label>
            Recipients <span className="req">*</span>
            <InfoTip text="Choose who receives this reminder: the audit team, the department coordinator, or people by role relative to your own level. Everyone selected is notified and the entry is recorded in the communication log." />
          </label>
          <div className="flex-col" style={{ gap: 7 }}>
            {groups.length === 0 && <div className="muted small">No selectable recipients.</div>}
            {groups.map((g) => (
              <label key={g.key} className={`check-item recipient-row ${selected.includes(g.key) ? 'picked' : ''}`} style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={selected.includes(g.key)} onChange={() => toggle(g.key)} style={{ accentColor: 'var(--thistle-500)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="bold small">{g.label} <span className="tag" style={{ marginLeft: 6 }}>{g.hint}</span></div>
                  <div className="flex mt-1" style={{ gap: 5, flexWrap: 'wrap' }}>
                    {g.userIds.slice(0, 6).map((id) => {
                      const u = users.find((x) => x.id === id)
                      return u ? <span key={id} className="chip tiny-chip">{u.name}</span> : null
                    })}
                    {g.userIds.length > 6 && <span className="muted tiny">+{g.userIds.length - 6} more</span>}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* selected summary */}
        {recipients.length > 0 && (
          <div className="comms-selected">
            <div className="muted tiny" style={{ fontWeight: 700, marginBottom: 4 }}>GOES TO {recipients.length} {recipients.length === 1 ? 'PERSON' : 'PEOPLE'}</div>
            <div className="flex" style={{ gap: 5, flexWrap: 'wrap' }}>
              {recipients.map((r) => (
                <span key={r.userId} className="chip tiny-chip active">
                  {r.name} <span className="muted tiny">· {ROLES[r.role] ? ROLES[r.role].label : r.role}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* remark */}
        <div className="field">
          <label>Remarks <span className="req">*</span> 
          {/* <InfoTip text="Mandatory. Recorded in the communication log, the activity trail and shown with the notification." /> */}
          </label>
          <textarea
            className="textarea wide" value={remark} onChange={(e) => setRemark(e.target.value)}
            placeholder={isEsc ? 'Why this is being escalated — included in the notification' : 'What is pending and by when it is needed — included in the notification'}
          />
        </div>
      </div>
    </Modal>
  )
}

/* ==========================================================================
   CommsLogTable — searchable log with filters (used on Compliance + Activity)
   ========================================================================== */
export function CommsLogTable({ logs, users, audits, onRowClick, csvName, emptySub, pageSize = 10, kindF: kindFProp, onKindFChange }) {
  const [kindFState, setKindFState] = useState('all')
  const [modeF, setModeF] = useState('all')
  const [view, setView] = useState(null)

  // kind filter is controlled when `kindF` is provided (e.g. stat-card shortcuts), otherwise internal
  const kindF = kindFProp !== undefined ? kindFProp : kindFState
  const setKindF = onKindFChange || setKindFState

  const auditOf = (log) => audits.find((a) => a.id === log.auditId)
  const rows = useMemo(
    () =>
      [...logs]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .filter((l) => kindF === 'all' || l.kind === kindF)
        .filter((l) => modeF === 'all' || l.mode === modeF),
    [logs, kindF, modeF]
  )

  const openLog = (l) => {
    if (onRowClick) onRowClick(l)
    else setView(l)
  }

  return (
    <div>
      <DataTable
        rows={rows}
        columns={[
          {
            key: 'remark', label: 'Remark', sortable: false, width: 27,
            render: (l) => l.remark ? <span className="small" style={{ fontStyle: 'italic', color: 'var(--text-2)' }}>“{l.remark}”</span> : <span className="muted">—</span>
          },
          {
            key: 'timestamp', label: 'Sent', sortable: true, width: 8,
            render: (l) => <span className="small nowrap" title={fmtDateTime(l.timestamp)}>{fmtRelative(l.timestamp)}</span>
          },
          {
            key: 'kind', label: 'Type', sortable: true, width: 17,
            render: (l) => (
              <span className="flex" style={{ gap: 5 }}>
                {l.kind === 'Escalation' ? <Badge kind="Escalated">Escalation</Badge> : <span className="badge warning">Reminder</span>}
                {l.mode === 'Automatic' ? <span className="tag" style={{ background: 'var(--surface-2)', color: 'var(--text-3)', borderColor: 'transparent' }}>auto</span> : <span className="tag">manual</span>}
              </span>
            )
          },
          {
            key: 'title', label: 'About', sortable: true,
            render: (l) => (
              <div style={{ maxWidth: 280 }}>
                <div className="cell-strong ellipsis" title={l.title}>{l.title}</div>
                <div className="cell-sub ellipsis">
                  {l.contextType}{l.auditId && auditOf(l) ? ` · ${auditOf(l).code}` : ''}
                  {l.kind === 'Escalation' && l.escalatedTo ? ` · ${l.escalatedTo}` : ''}
                </div>
              </div>
            )
          },
          {
            key: 'fromName', label: 'From', sortable: true, width: 12,
            render: (l) => (
              <span className="flex" style={{ gap: 8 }}>
                <Avatar name={l.fromName} sm color={l.fromRole === 'system' ? 'var(--text-3)' : undefined} />
                <span>
                  <span className="small bold" style={{ display: 'block' }}>{l.fromName}</span>
                  <span className="cell-sub">{ROLES[l.fromRole] ? ROLES[l.fromRole].label : l.fromRole === 'system' ? 'System' : l.fromRole}</span>
                </span>
              </span>
            )
          },
          {
            key: 'recipients', label: 'To', sortable: true, sort: (l) => (l.recipients || []).length, width: 13,
            render: (l) => (
              <div className="flex" style={{ gap: 6 }}>
                <AvatarStackMini people={l.recipients || []} users={users} />
                <span className="muted tiny" style={{ lineHeight: 1.3 }}>
                  {(l.recipients || []).slice(0, 2).map((r) => r.name.split(' ')[0]).join(', ')}
                  {(l.recipients || []).length > 2 ? ` +${l.recipients.length - 2}` : ''}
                </span>
              </div>
            )
          }
        ]}
        searchKeys={['title', 'remark', 'fromName', 'escalatedTo', (l) => (l.recipients || []).map((r) => r.name).join(' ')]}
        searchPlaceholder="Search reminders, remarks, people…"
        filters={[
          { value: kindF, onChange: setKindF, options: [{ value: 'all', label: 'All types' }, { value: 'Reminder', label: 'Reminders' }, { value: 'Escalation', label: 'Escalations' }] },
          { value: modeF, onChange: setModeF, options: [{ value: 'all', label: 'Manual + automatic' }, { value: 'Manual', label: 'Manual' }, { value: 'Automatic', label: 'Automatic' }] }
        ]}
        rowClick={openLog}
        csvName={csvName}
        emptyTitle="No reminders or escalations yet"
        emptySub={emptySub || 'Every manual and automatic reminder and escalation is recorded here with its recipients and remark.'}
        pageSize={pageSize}
        fixed
        minWidth={860}
      />

      {/* detail modal (when no custom row handler) */}
      <Modal open={!!view} onClose={() => setView(null)} title={view ? `${view.kind} — ${view.mode}` : ''} sub={view ? view.title : ''}>
        {view && (
          <div className="flex-col" style={{ gap: 10 }}>
            <div className="grid grid-2">
              <div><span className="muted tiny">SENT BY</span><div className="small bold">{view.fromName}</div></div>
              <div><span className="muted tiny">WHEN</span><div className="small bold">{fmtDateTime(view.timestamp)}</div></div>
              <div><span className="muted tiny">CONTEXT</span><div className="small bold">{view.contextType}{view.auditId && auditOf(view) ? ` · ${auditOf(view).code}` : ''}</div></div>
              <div><span className="muted tiny">{view.kind === 'Escalation' ? 'ESCALATED TO' : 'LEVEL'}</span><div className="small bold">{view.escalatedTo || '—'}</div></div>
            </div>
            <div>
              <span className="muted tiny">RECIPIENTS ({(view.recipients || []).length})</span>
              <div className="flex mt-1" style={{ gap: 5, flexWrap: 'wrap' }}>
                {(view.recipients || []).map((r) => (
                  <span key={r.userId} className="chip tiny-chip">{r.name} <span className="muted tiny">· {ROLES[r.role] ? ROLES[r.role].label : r.role}</span></span>
                ))}
              </div>
            </div>
            <div className="tl-body" style={{ background: 'var(--surface-2)' }}>
              <span className="bold">Remark: </span>{view.remark || '—'}
            </div>
            <div className="flex">
              {view.auditId && <button className="btn btn-secondary btn-sm" onClick={() => { setView(null); navigate(`/audit/${view.auditId}`) }}>Open audit ↗</button>}
              {view.contextType === 'Observation' && <button className="btn btn-secondary btn-sm" onClick={() => { setView(null); navigate('/compliance') }}>Open compliance ↗</button>}
              {view.contextType === 'Finding' && <button className="btn btn-secondary btn-sm" onClick={() => { setView(null); navigate('/findings') }}>Open findings ↗</button>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function AvatarStackMini({ people, users, max = 3 }) {
  const shown = people.slice(0, max)
  const rest = people.length - shown.length
  return (
    <span className="avatar-stack" title={people.map((p) => p.name).join(', ')}>
      {shown.map((p, i) => {
        const u = users.find((x) => x.id === p.userId)
        return <Avatar key={i} name={p.name} sm color={u ? u.avatarColor : undefined} />
      })}
      {rest > 0 && <span className="avatar sm" style={{ background: 'var(--text-3)' }}>+{rest}</span>}
    </span>
  )
}

/* ==========================================================================
   CommsHistory — compact timeline for a single observation / finding / audit
   ========================================================================== */
export function CommsHistory({ logs, users, title = 'Reminders & Escalations' }) {
  const sorted = [...(logs || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  return (
    <div>
      <SectionTitleSmall text={title} count={sorted.length} />
      {sorted.length === 0 ? (
        <div className="muted small">No reminders or escalations recorded yet.</div>
      ) : (
        <div className="timeline">
          {sorted.map((l) => (
            <div key={l.id} className={`tl-item ${l.kind === 'Escalation' ? 'bad' : 'warn'}`}>
              <span className="tl-dot" />
              <div className="tl-title">
                {l.kind} · {l.mode === 'Automatic' ? 'sent automatically by the system' : `sent by ${l.fromName}`}
                {l.kind === 'Escalation' && l.escalatedTo ? ` — ${l.escalatedTo}` : ''}
              </div>
              <div className="tl-meta">
                To {(l.recipients || []).map((r) => r.name).join(', ') || '—'} · {fmtDateTime(l.timestamp)}
              </div>
              {l.remark && <div className="tl-body">“{l.remark}”</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SectionTitleSmall({ text, count }) {
  return (
    <div className="flex-between mb-2 mt-1">
      <h3 style={{ fontSize: 13.5 }}>{text}</h3>
      {count !== undefined && <span className="hint">{count} recorded</span>}
    </div>
  )
}
