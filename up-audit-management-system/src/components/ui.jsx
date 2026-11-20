// Shared UI primitives (no UI library - clean, dependency-free components).
import { useEffect, useRef, useState } from 'react'
import { initials, cx } from '../lib/utils'

// ---------- status → badge class maps (single source of truth) ----------
export const STATUS_CLASS = {
  'Planned': 'neutral', 'Scheduled': 'info', 'In Progress': 'warning',
  'Under Review': 'purple', 'Completed': 'success', 'Closed': 'neutral',
  'Open': 'danger', 'Action Planned': 'warning', 'Under Review ': 'purple',
  'Resolved': 'success', 'Draft': 'neutral', 'In Review': 'purple',
  'Approved': 'info', 'Final': 'success', 'Active': 'success', 'Inactive': 'neutral',
  'Connected': 'success', 'Disconnected': 'neutral', 'Error': 'danger',
  'Pending': 'warning', 'In Progress ': 'warning', 'Escalated': 'danger',
  'Compliant': 'success', 'Partially Compliant': 'warning', 'Non-Compliant': 'danger',
  'Pending review': 'warning', 'Accepted': 'success', 'Rejected - false positive': 'neutral',
  'Low': 'info', 'Medium': 'warning', 'High': 'danger', 'Critical': 'danger',
  'Submitted': 'info', 'Draft ': 'neutral', 'Reviewed': 'info'
}
export const SEVERITY_CLASS = { Critical: 'danger', High: 'danger', Medium: 'warning', Low: 'info' }
export const TYPE_CLASS = { Financial: 'info', Performance: 'success', Compliance: 'warning', IT: 'purple', Forensic: 'danger' }
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

// ---------- modal ----------
export function Modal({ open, onClose, title, children, footer, size }) {
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
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

// ---------- confirm dialog ----------
export function ConfirmDialog({ open, onClose, onConfirm, title = 'Please confirm', message, confirmLabel = 'Confirm', danger }) {
  return (
    <Modal
      open={open} onClose={onClose} title={title}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className={cx('btn', danger ? 'btn-danger' : 'btn-primary')} onClick={onConfirm}>{confirmLabel}</button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{message}</p>
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

// ---------- stat card ----------
export function StatCard({ label, value, delta, icon, accent }) {
  return (
    <div className={cx('stat-card', accent && 'accent')}>
      <div className="label">
        {icon && <span>{icon}</span>} {label}
      </div>
      <div className="value">{value}</div>
      {delta && <div className={cx('delta', delta.dir)}>{delta.text}</div>}
    </div>
  )
}

// ---------- progress ----------
export function Progress({ value, className }) {
  return (
    <div className={cx('progress', className)} title={`${value}%`}>
      <div style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

// ---------- avatar ----------
export function Avatar({ name, color, lg }) {
  return (
    <span className={cx('avatar', lg && 'lg')} style={{ background: color || '#55606e' }}>
      {initials(name)}
    </span>
  )
}

// ---------- empty state ----------
export function Empty({ icon = '🗂️', title, sub, children }) {
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
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
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

// ---------- pagination ----------
export function Pagination({ page, pages, onPage, total, pageSize }) {
  if (pages <= 1) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="flex-between mt-2" style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
      <span>Showing {from}–{to} of {total}</span>
      <div className="flex">
        <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Prev</button>
        <span style={{ padding: '4px 8px' }}>Page {page} / {pages}</span>
        <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next ›</button>
      </div>
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
export function SectionTitle({ children, hint }) {
  return (
    <div className="flex-between mb-2">
      <h3 style={{ fontSize: 15 }}>{children}</h3>
      {hint && <span className="muted small">{hint}</span>}
    </div>
  )
}
