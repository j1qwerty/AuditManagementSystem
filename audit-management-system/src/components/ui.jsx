// Shared UI primitives (no UI library - clean, dependency-free components).
import { useEffect, useMemo, useRef, useState } from 'react'
import { initials, cx, fileKind, fmtBytes } from '../lib/utils'
import idb from '../lib/db'
import { navigate } from '../lib/router'
import { exportCSV } from '../lib/exporters'

// ---------- status → badge class maps (single source of truth) ----------
export const STATUS_CLASS = {
  'Planned': 'neutral', 'Scheduled': 'info', 'In Progress': 'warning',
  'Under Review': 'purple', 'Completed': 'success', 'Closed': 'neutral',
  'Open': 'danger', 'Action Planned': 'warning',
  'Resolved': 'success', 'Draft': 'neutral', 'In Review': 'purple',
  'Approved': 'info', 'Final': 'success', 'Active': 'success', 'Inactive': 'neutral',
  'Connected': 'success', 'Disconnected': 'neutral', 'Error': 'danger',
  'Pending': 'warning', 'Escalated': 'danger',
  'Compliant': 'success', 'Partially Compliant': 'warning', 'Non-Compliant': 'danger',
  'Pending review': 'warning', 'Accepted': 'success', 'Rejected - false positive': 'neutral',
  'Low': 'info', 'Medium': 'warning', 'High': 'danger', 'Critical': 'danger',
  'Submitted': 'info', 'Reviewed': 'info', 'N/A': 'neutral',
  'Success': 'success', 'Failed': 'danger', 'Pending Response': 'warning'
}
export const SEVERITY_CLASS = { Critical: 'danger', High: 'danger', Medium: 'warning', Low: 'info' }
export const TYPE_CLASS = { Financial: 'purple', Performance: 'success', Compliance: 'warning', IT: 'info', Forensic: 'danger' }
export const PROGRESS_CLASS = (p) => (p >= 100 ? 'success' : p >= 60 ? 'success' : p >= 30 ? 'warning' : 'bad')

export function Badge({ children, kind }) {
  const cls = STATUS_CLASS[kind || children] || 'neutral'
  return <span className={`badge ${cls}`}>{children}</span>
}
export function SeverityBadge({ s }) {
  return <span className={`badge ${SEVERITY_CLASS[s] || 'neutral'}`}>{s}</span>
}
export function TypeBadge({ t }) {
  return <span className={`badge ${TYPE_CLASS[t] || 'neutral'}`}>{t}</span>
}
export function EscalationBadge({ level }) {
  if (!level) return <span className="muted small">-</span>
  return <span className={`badge ${level >= 2 ? 'danger' : 'warning'}`}>Level {level}</span>
}

// ---------- modal ----------
export function Modal({ open, onClose, title, sub, children, footer, size }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose && onClose()
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div className={cx('modal', size)}>
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {sub && <div className="sub">{sub}</div>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

// ---------- confirm dialog ----------
export function ConfirmDialog({ open, onClose, onConfirm, title = 'Please confirm', message, confirmLabel = 'Confirm', danger, requireRemarks }) {
  const [remarks, setRemarks] = useState('')
  useEffect(() => { if (open) setRemarks('') }, [open])
  const ok = () => { onConfirm(remarks.trim()); setRemarks('') }
  return (
    <Modal
      open={open} onClose={onClose} title={title}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className={cx('btn', danger ? 'btn-danger' : 'btn-primary')} onClick={ok} disabled={requireRemarks && !remarks.trim()}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: '0 0 10px' }}>{message}</p>
      {requireRemarks && (
        <div className="field">
          <label>Remarks <span className="req">*</span></label>
          <textarea className="textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Reason / remarks for this action (recorded in the activity trail and notifications)" />
        </div>
      )}
    </Modal>
  )
}

// ---------- tabs ----------
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.key} className={cx('tab', active === t.key && 'active')} onClick={() => onChange(t.key)}>
          {t.label}
          {t.count !== undefined && <span className="n">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

// ---------- page header with optional back button ----------
export function PageHead({ backTo, backLabel = 'Back', title, sub, actions, children }) {
  return (
    <div className="page-head">
      {backTo && (
        <button className="back-btn" title={backLabel} onClick={() => navigate(backTo)} aria-label={backLabel}>←</button>
      )}
      <div className="titles">
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {actions && <div className="actions">{actions}</div>}
      {children}
    </div>
  )
}

// ---------- stat card ----------
export function StatCard({ label, value, delta, icon, strip, onClick, foot }) {
  return (
    <div
      className={cx('stat-card', onClick && 'clickable')}
      onClick={onClick}
      title={onClick ? 'Click to view details' : undefined}
    >
      {strip && <div className="strip" style={{ background: strip }} />}
      <div className="label">
        {icon && <span className="s-ico" style={{ background: icon.soft, color: icon.color }}>{icon.glyph}</span>}
        {label}
      </div>
      <div className="value">{value}</div>
      {delta && <div className={cx('delta', delta.dir || 'flat')}>{delta.text}</div>}
      {foot && <div className="foot">{foot}</div>}
    </div>
  )
}

// ---------- progress ----------
export function Progress({ value, className, color }) {
  return (
    <div className={cx('progress', className)} title={`${value}%`}>
      <div style={{ width: `${Math.min(100, Math.max(0, value))}%`, ...(color ? { background: color } : {}) }} />
    </div>
  )
}

// ---------- avatar ----------
export function Avatar({ name, color, lg, sm, title }) {
  return (
    <span className={cx('avatar', lg && 'lg', sm && 'sm')} style={{ background: color || '#543267' }} title={title || name}>
      {initials(name)}
    </span>
  )
}
export function AvatarStack({ people = [], max = 4 }) {
  const shown = people.slice(0, max)
  const rest = people.length - shown.length
  return (
    <span className="avatar-stack" title={people.map((p) => p.name).join(', ')}>
      {shown.map((p, i) => <Avatar key={i} name={p.name} color={p.color} sm title={p.name} />)}
      {rest > 0 && <span className="avatar sm" style={{ background: 'var(--text-3)' }}>+{rest}</span>}
    </span>
  )
}

// ---------- empty state ----------
export function Empty({ icon = '🗂', title, sub, children }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <div className="t">{title}</div>
      {sub && <div className="s">{sub}</div>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  )
}

// ---------- key-value list ----------
export function KV({ rows }) {
  return (
    <dl className="kv">
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

// ---------- segmented control ----------
export function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ---------- info tip ----------
export function InfoTip({ text, right }) {
  const [open, setOpen] = useState(false)
  return (
    <span className={cx('info-tip', right && 'right')} onClick={(e) => e.stopPropagation()}>
      <span className="q" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onClick={() => setOpen((o) => !o)}>?</span>
      {open && <span className="bubble">{text}</span>}
    </span>
  )
}

// ---------- pagination ----------
export function Pagination({ page, pages, onPage, total, pageSize, onPageSize }) {
  if (pages <= 1 && !onPageSize) return null
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const pageBtns = []
  const start = Math.max(1, Math.min(page - 2, pages - 4))
  const end = Math.min(pages, start + 4)
  for (let i = start; i <= end; i++) pageBtns.push(i)
  return (
    <div className="table-foot">
      <span>Showing <b>{from}–{to}</b> of <b>{total}</b></span>
      <div className="pages">
        {onPageSize && (
          <select className="select" style={{ width: 'auto', padding: '3px 24px 3px 8px', fontSize: 11.5 }} value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
            {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        )}
        <button className="btn-icon" disabled={page <= 1} onClick={() => onPage(page - 1)} title="Previous page">‹</button>
        {start > 1 && <span className="muted small">…</span>}
        {pageBtns.map((p) => (
          <button key={p} className={cx('btn-icon', p === page && 'btn-primary')} style={p === page ? { color: '#fff' } : {}} onClick={() => onPage(p)}>{p}</button>
        ))}
        {end < pages && <span className="muted small">…</span>}
        <button className="btn-icon" disabled={page >= pages} onClick={() => onPage(page + 1)} title="Next page">›</button>
      </div>
    </div>
  )
}

// ==========================================================================
// DataTable - search + filters + sorting + pagination + row click + actions
// ==========================================================================
export function DataTable({
  rows,
  columns,               // [{key, label, render(row), sort(row), num, width, className, hint}]
  searchKeys,            // array of keys searched by the toolbar search box
  searchPlaceholder = 'Search…',
  filters = [],          // [{label, value, onChange, options:[{value,label}]}] - controlled by parent
  pageSize: initialPageSize = 10,
  rowClick,              // (row) => void - makes rows clickable
  actions,               // (row) => node (rendered as last column)
  actionsLabel = 'Actions',
  toolbarExtra,          // node rendered right side of toolbar
  emptyTitle = 'Nothing here yet',
  emptySub,
  csvName,               // enable CSV export with this filename
  compact
}) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  useEffect(() => { setPage(1) }, [query, pageSize, filters.map((f) => f.value).join('|')])

  const filtered = useMemo(() => {
    let out = rows
    const q = query.trim().toLowerCase()
    if (q && searchKeys) {
      out = out.filter((r) =>
        searchKeys.some((k) => {
          const v = typeof k === 'function' ? k(r) : r[k]
          return String(v == null ? '' : v).toLowerCase().includes(q)
        })
      )
    }
    return out
  }, [rows, query, searchKeys])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    const col = columns.find((c) => c.key === sortKey)
    if (!col) return filtered
    const val = (r) => {
      const v = col.sort ? col.sort(r) : r[sortKey]
      if (v === null || v === undefined) return ''
      if (col.num) return Number(v) || 0
      return String(v).toLowerCase()
    }
    return [...filtered].sort((a, b) => {
      const va = val(a); const vb = val(b)
      let cmp = 0
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
      else cmp = String(va).localeCompare(String(vb), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir, columns])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize)

  const onSort = (col) => {
    if (!col.sortable && !col.sort && !columns.find((c) => c.key === col.key)) return
    if (sortKey === col.key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(col.key); setSortDir(col.num ? 'desc' : 'asc') }
  }

  const doExport = () => {
    const heads = columns.filter((c) => c.key !== '__actions').map((c) => c.label)
    const body = sorted.map((r) => columns.filter((c) => c.key !== '__actions').map((c) => {
      const v = c.sort ? c.sort(r) : r[c.key]
      return v === null || v === undefined ? '' : String(v)
    }))
    exportCSV(csvName, body, heads)
  }

  const allCols = [...columns]
  if (actions) allCols.push({ key: '__actions', label: actionsLabel, width: 10, className: 'right' })

  return (
    <div className="table-wrap">
      {(searchKeys || filters.length > 0 || toolbarExtra || csvName) && (
        <div className="table-toolbar">
          {searchKeys && (
            <div className="search-box">
              <input className="input" placeholder={searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          )}
          {filters.map((f, i) => (
            <select key={i} className="select" style={{ width: 'auto', minWidth: 130 }} value={f.value} onChange={(e) => f.onChange(e.target.value)}>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ))}
          <div style={{ flex: 1 }} />
          {toolbarExtra}
          {csvName && <button className="btn btn-secondary btn-sm" onClick={doExport}>⇩ Export CSV</button>}
        </div>
      )}
      <div className="table-scroll">
        <table className="table" style={compact ? { fontSize: 12 } : undefined}>
          <thead>
            <tr>
              {allCols.map((c) => (
                <th
                  key={c.key}
                  className={cx(c.num && 'num', c.key !== '__actions' && 'sortable', c.className)}
                  style={c.width ? { width: `${c.width}%` } : undefined}
                  onClick={() => c.key !== '__actions' && onSort(c)}
                  title={c.hint}
                >
                  {c.label}
                  {sortKey === c.key && <span className="sort-ind">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={allCols.length}>
                  <Empty icon="🔍" title={query || filters.some((f) => f.value && f.value !== 'all') ? 'No matching records' : emptyTitle} sub={query ? 'Try a different search or filter.' : emptySub} />
                </td>
              </tr>
            )}
            {pageRows.map((r, i) => (
              <tr key={r.id || i} className={cx(rowClick && 'clickable')} onClick={rowClick ? () => rowClick(r) : undefined}>
                {allCols.map((c) => (
                  <td key={c.key} className={cx(c.className, c.num && 'num')}>
                    {c.key === '__actions'
                      ? <div className="row-actions" onClick={(e) => e.stopPropagation()}>{actions ? actions(r) : c.render ? c.render(r) : null}</div>
                      : c.render ? c.render(r) : (r[c.key] == null ? '-' : String(r[c.key]))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={totalPages} onPage={setPage} total={sorted.length} pageSize={pageSize} onPageSize={setPageSize} />
    </div>
  )
}

// ---------- click outside hook ----------
export function useClickOutside(onOutside) {
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOutside()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onOutside])
  return ref
}

// ---------- toast stack ----------
export function ToastStack({ toasts }) {
  if (!toasts || !toasts.length) return null
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{t.type === 'error' ? '✕' : t.type === 'info' ? 'ℹ' : '✓'}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}

// ---------- section title ----------
export function SectionTitle({ children, hint, right }) {
  return (
    <div className="flex-between mb-2">
      <h3 style={{ fontSize: 14.5 }}>{children}{hint && <span className="muted small" style={{ fontWeight: 500, marginLeft: 8 }}>{hint}</span>}</h3>
      {right}
    </div>
  )
}

// ==========================================================================
// UserPicker - select one or many users with search + role/department filters
// ==========================================================================
export function UserPicker({ open, onClose, users, onDone, multi = true, title = 'Select people', initialSelected = [], excludeIds = [], noteTo }) {
  const [q, setQ] = useState('')
  const [roleF, setRoleF] = useState('all')
  const [deptF, setDeptF] = useState('all')
  const [picked, setPicked] = useState([])
  const searchRef = useRef(null)

  useEffect(() => {
    if (open) {
      setPicked(initialSelected || [])
      setQ(''); setRoleF('all'); setDeptF('all')
      setTimeout(() => searchRef.current && searchRef.current.focus(), 50)
    }
  }, [open])

  const roles = useMemo(() => Array.from(new Set(users.map((u) => u.role))), [users])
  const depts = useMemo(() => Array.from(new Set(users.map((u) => u.departmentId).filter(Boolean))), [users])
  const deptName = (id) => {
    const u = users.find((x) => x.departmentId === id)
    return u && u.deptName ? u.deptName : id
  }

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return users
      .filter((u) => u.status === 'Active')
      .filter((u) => !excludeIds.includes(u.id))
      .filter((u) => roleF === 'all' || u.role === roleF)
      .filter((u) => deptF === 'all' || u.departmentId === deptF)
      .filter((u) => !s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s) || (u.designation || '').toLowerCase().includes(s))
  }, [users, q, roleF, deptF, excludeIds])

  const toggle = (id) => {
    if (!multi) { onDone([id]); onClose(); return }
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  const pickedUsers = users.filter((u) => picked.includes(u.id))

  return (
    <Modal
      open={open} onClose={onClose} title={title} size="md"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!multi && picked.length !== 1} onClick={() => { onDone(picked); onClose() }}>
            {multi ? `Add ${picked.length || ''} ${picked.length === 1 ? 'person' : 'people'}` : 'Select'}
          </button>
        </>
      }
    >
      {noteTo && <p className="muted small" style={{ margin: '0 0 10px' }}>{noteTo}</p>}
      {multi && pickedUsers.length > 0 && (
        <div className="flex wrap mb-2">
          {pickedUsers.map((u) => (
            <span key={u.id} className="chip active" onClick={() => toggle(u.id)} title="Remove">
              {u.name} <span style={{ fontWeight: 800 }}>✕</span>
            </span>
          ))}
        </div>
      )}
      <div className="flex mb-2" style={{ gap: 8 }}>
        <div className="search-box" style={{ flex: 1, position: 'relative' }}>
          <input ref={searchRef} className="input" placeholder="Search by name, email or designation…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="select" style={{ width: 'auto' }} value={roleF} onChange={(e) => setRoleF(e.target.value)}>
          <option value="all">All roles</option>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="select" style={{ width: 'auto' }} value={deptF} onChange={(e) => setDeptF(e.target.value)}>
          <option value="all">All departments</option>
          {depts.map((d) => <option key={d} value={d}>{deptName(d)}</option>)}
        </select>
      </div>
      <div className="picker-list">
        {list.length === 0 && <Empty icon="👥" title="No people match" sub="Adjust the search or filters." />}
        {list.map((u) => (
          <div key={u.id} className={cx('picker-row', picked.includes(u.id) && 'picked')} onClick={() => toggle(u.id)}>
            <Avatar name={u.name} color={u.avatarColor} />
            <div style={{ minWidth: 0 }}>
              <div className="pr-name ellipsis">{u.name}</div>
              <div className="pr-meta ellipsis">{u.designation || u.role}{u.deptName ? ` · ${u.deptName}` : ''}</div>
            </div>
            {picked.includes(u.id) && <span className="tick">✓</span>}
          </div>
        ))}
      </div>
    </Modal>
  )
}

// ==========================================================================
// FilePreview - preview a stored file (pdf / image / text / html-doc / csv)
// ==========================================================================
export function FilePreviewModal({ open, onClose, fileId, name }) {
  const [url, setUrl] = useState(null)
  const [blob, setBlob] = useState(null)
  const kind = fileKind(name)

  useEffect(() => {
    let objectUrl = null
    let cancelled = false
    if (open && fileId) {
      idb.get('files', fileId).then((f) => {
        if (cancelled) return
        if (f && f.blob) {
          setBlob(f.blob)
          objectUrl = URL.createObjectURL(f.blob)
          setUrl(objectUrl)
        } else { setUrl(null); setBlob(null) }
      })
    } else { setUrl(null); setBlob(null) }
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [open, fileId])

  const download = () => {
    if (!blob) return
    const a = document.createElement('a')
    a.href = url
    a.download = name || 'file'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const canIframe = blob && (blob.type.includes('pdf') || blob.type.includes('html') || blob.type.includes('word'))
  const isText = blob && (blob.type.startsWith('text/') || blob.type.includes('csv') || blob.type.includes('json'))

  return (
    <Modal
      open={open} onClose={onClose} title={name || 'File preview'} size="lg"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={download} disabled={!blob}>⇩ Download ({blob ? fmtBytes(blob.size) : '-'})</button>
        </>
      }
    >
      {!url && <Empty icon="📄" title="Preview unavailable" sub="The file could not be loaded from storage." />}
      {url && kind === 'image' && <div className="preview-frame"><img src={url} alt={name} /></div>}
      {url && canIframe && <div className="preview-frame"><iframe src={url} title={name} /></div>}
      {url && !canIframe && isText && <TextPreview url={url} />}
      {url && !canIframe && !isText && kind !== 'image' && (
        <Empty icon="📦" title="Preview not available for this format" sub="Download the file to open it in the native application.">
          <button className="btn btn-primary btn-sm" onClick={download}>⇩ Download file</button>
        </Empty>
      )}
    </Modal>
  )
}

function TextPreview({ url }) {
  const [text, setText] = useState('Loading…')
  useEffect(() => {
    fetch(url).then((r) => r.text()).then(setText).catch(() => setText('Could not read file.'))
  }, [url])
  return <div className="preview-frame"><div className="preview-text">{text}</div></div>
}

// ---------- remarks input block (used by approve/reject/escalate dialogs) ----------
export function RemarksBlock({ value, onChange, label = 'Remarks', required, placeholder = 'Recorded in the activity trail and included in notifications' }) {
  return (
    <div className="field">
      <label>{label} {required && <span className="req">*</span>}</label>
      <textarea className="textarea wide" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}
