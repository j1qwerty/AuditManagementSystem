// Audit Planning - annual plan, calendar, risk-based selection, resources.
import { useMemo, useState, useEffect } from 'react'
import { useData } from '../context/DataContext'
import { navigate, useTabMemory } from '../lib/router'
import {
  Badge, DataTable, PageHead, Modal, TypeBadge, Progress, StatCard, Empty,
  UserPicker, InfoTip, Tabs, Avatar, ConfirmDialog, PrintButton
} from '../components/ui'
import { fmtDate, fmtINR, uid, daysBetween } from '../lib/utils'
import { computeDepartmentRisk } from '../lib/ai'
import config from '../lib/config'

const TYPES = ['Financial', 'Performance', 'Compliance', 'IT', 'Forensic']
const TYPE_PREFIX = { Financial: 'FA', Performance: 'PA', Compliance: 'CA', IT: 'IA', Forensic: 'FoA' }
const STATUSES = ['Planned', 'Scheduled', 'In Progress', 'Under Review', 'Completed', 'Closed']

export default function Planning() {
  const { data, save, remove, currentUser, notify, logActivity, toast, can } = useData()
  const [tab, setTab] = useTabMemory('plan')
  const [editing, setEditing] = useState(null)   // audit object or {new:true}
  const [confirmDel, setConfirmDel] = useState(null)

  const caoIds = data.users.filter((u) => u.role === 'cao').map((u) => u.id)
  const directorIds = data.users.filter((u) => u.role === 'director').map((u) => u.id)

  const createAudit = async (form) => {
    const seq = data.audits.length + 1
    const dept = data.departments.find((d) => d.id === form.departmentId)
    const lead = data.users.find((u) => u.id === form.leadAuditorId)
    const team = form.teamIds.map((tid, i) => {
      const u = data.users.find((x) => x.id === tid)
      return { userId: tid, name: u ? u.name : tid, role: i === 0 ? 'Co-lead' : 'Auditor' }
    })
    const rec = {
      id: uid('a'),
      code: `${TYPE_PREFIX[form.type]}-${new Date().getFullYear()}-${String(seq).padStart(3, '0')}`,
      title: form.title, type: form.type,
      departmentId: form.departmentId, departmentName: dept ? dept.name : '',
      fiscalYear: config.fiscalYear, status: 'Planned', priority: form.priority,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(new Date(form.startDate).getTime() + form.duration * 86400000).toISOString(),
      auditPeriod: form.auditPeriod || 'As per audit programme',
      leadAuditorId: form.leadAuditorId || null,
      leadAuditorName: lead ? lead.name : null,
      team, allocatedBudget: (Number(form.budgetLakh) || 0) * 100000,
      estimatedDays: Number(form.duration) || 30,
      objectives: form.objectives || '', scope: form.scope || '',
      riskScore: form.riskScore || 50, progress: 0,
      checklist: [], evidence: [], workpapers: [], comments: [], reviewHistory: [],
      timeline: [{ date: new Date().toISOString(), event: `Audit entry created in the annual plan by ${currentUser.name}` }],
      createdAt: new Date().toISOString()
    }
    await save('audits', rec, { logAction: 'Created audit', logDetail: `${rec.code} — ${rec.title}` })
    const targets = [...(form.leadAuditorId ? [form.leadAuditorId] : []), ...form.teamIds, ...caoIds, ...directorIds].filter((x) => x !== currentUser.id)
    await notify(targets, 'Assignment', `New audit planned — ${rec.code}`, rec.title, `#/audit/${rec.id}`)
    setEditing(null)
    toast('Audit added to the annual plan')
  }

  const updateAudit = async (form) => {
    const a = data.audits.find((x) => x.id === editing.id)
    const lead = data.users.find((u) => u.id === form.leadAuditorId)
    const team = form.teamIds.map((tid, i) => {
      const u = data.users.find((x) => x.id === tid)
      return { userId: tid, name: u ? u.name : tid, role: i === 0 ? 'Co-lead' : 'Auditor' }
    })
    const updated = {
      ...a,
      title: form.title, type: form.type, departmentId: form.departmentId,
      departmentName: (data.departments.find((d) => d.id === form.departmentId) || {}).name || '',
      priority: form.priority,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(new Date(form.startDate).getTime() + form.duration * 86400000).toISOString(),
      leadAuditorId: form.leadAuditorId || null, leadAuditorName: lead ? lead.name : null,
      team, allocatedBudget: (Number(form.budgetLakh) || 0) * 100000,
      estimatedDays: Number(form.duration) || 30,
      objectives: form.objectives || a.objectives, scope: form.scope || a.scope,
      timeline: [...(a.timeline || []), { date: new Date().toISOString(), event: `Audit plan updated by ${currentUser.name}` }]
    }
    await save('audits', updated, { logAction: 'Updated audit plan', logDetail: `${a.code} — ${updated.title}` })
    setEditing(null)
    toast('Audit plan updated')
  }

  const deleteAudit = async () => {
    const a = confirmDel
    await remove('audits', a.id, { logAction: 'Deleted audit', logDetail: `${a.code} — ${a.title}` })
    setConfirmDel(null)
    toast('Audit removed from the plan')
  }

  const tabs = [
    { key: 'plan', label: 'Annual Plan', count: data.audits.length },
    { key: 'calendar', label: 'Calendar' },
    { key: 'risk', label: 'Risk Assessment' },
    { key: 'resources', label: 'Resources' }
  ]

  return (
    <div>
      <PageHead
        title="Audit Planning"
        sub={`Annual plan FY ${config.fiscalYear} · risk-based selection, scheduling and resource allocation`}
        actions={<>
          {can('planning.manage') && <button className="btn btn-primary" onClick={() => setEditing({ new: true })}>+ Plan New Audit</button>}
          <PrintButton label="Print" title="Print this view (or save as PDF)" />
        </>}
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'plan' && (
        <PlanTable
          data={data} canManage={can('planning.manage')}
          onEdit={(a) => setEditing(a)} onDelete={(a) => setConfirmDel(a)}
        />
      )}
      {tab === 'calendar' && <CalendarTab data={data} />}
      {tab === 'risk' && <RiskTab data={data} canRecalc={can('risk.recalculate')} logActivity={logActivity} toast={toast} />}
      {tab === 'resources' && <ResourcesTab data={data} />}

      {editing && (
        <AuditFormModal
          audit={editing.new ? null : editing}
          data={data}
          onClose={() => setEditing(null)}
          onSave={(form) => (editing.new ? createAudit(form) : updateAudit(form))}
        />
      )}
      <ConfirmDialog
        open={!!confirmDel} onClose={() => setConfirmDel(null)}
        title="Remove audit" danger confirmLabel="Remove"
        message={`Remove ${confirmDel ? confirmDel.code : ''} from the annual plan? Linked findings and observations remain in the registry.`}
        onConfirm={deleteAudit}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ plan table */
function PlanTable({ data, canManage, onEdit, onDelete }) {
  const [statusF, setStatusF] = useState('all')
  const [typeF, setTypeF] = useState('all')
  const [deptF, setDeptF] = useState('all')
  const deptName = (id) => (data.departments.find((d) => d.id === id) || {}).name || '—'

  const rows = data.audits
    .filter((a) => statusF === 'all' || a.status === statusF)
    .filter((a) => typeF === 'all' || a.type === typeF)
    .filter((a) => deptF === 'all' || a.departmentId === deptF)

  return (
    <DataTable
      rows={rows}
      columns={[
        {
          key: 'code', label: 'Audit', sortable: true,
          render: (a) => (
            <div style={{ maxWidth: 300 }}>
              <div className="cell-strong">{a.code}</div>
              <div className="cell-sub ellipsis" title={a.title}>{a.title}</div>
            </div>
          )
        },
        { key: 'type', label: 'Type', sortable: true, render: (a) => <TypeBadge t={a.type} /> },
        { key: 'departmentName', label: 'Department', sortable: true, sort: (a) => deptName(a.departmentId), render: (a) => deptName(a.departmentId) },
        { key: 'startDate', label: 'Window', sortable: true, sort: (a) => a.startDate, render: (a) => <span className="nowrap small">{fmtDate(a.startDate)} → {fmtDate(a.endDate)}</span> },
        { key: 'leadAuditorName', label: 'Lead', sortable: true, render: (a) => a.leadAuditorName || <span className="badge warning">assign</span> },
        { key: 'team', label: 'Team', sortable: false, render: (a) => <span className="small muted">{a.team.length ? `${a.team.length + (a.leadAuditorId ? 1 : 0)} members` : '—'}</span> },
        { key: 'priority', label: 'Priority', sortable: true, render: (a) => <Badge kind={a.priority}>{a.priority}</Badge> },
        { key: 'riskScore', label: 'Risk', num: true, sortable: true, render: (a) => <span className="bold num">{a.riskScore}</span> },
        { key: 'status', label: 'Status', sortable: true, render: (a) => <Badge kind={a.status}>{a.status}</Badge> },
        {
          key: '__actions', label: '', render: (a) => (
            <div className="row-actions">
              <button className="btn-icon" title="Open audit" onClick={() => navigate(`/audit/${a.id}`)}>↗</button>
              {canManage && <button className="btn-icon" title="Edit plan entry" onClick={() => onEdit(a)}>✎</button>}
              {canManage && <button className="btn-icon danger" title="Remove from plan" onClick={() => onDelete(a)}>🗑</button>}
            </div>
          )
        }
      ]}
      searchKeys={['code', 'title', 'leadAuditorName', (a) => deptName(a.departmentId)]}
      searchPlaceholder="Search the plan…"
      filters={[
        { value: statusF, onChange: setStatusF, options: [{ value: 'all', label: 'All statuses' }, ...STATUSES.map((s) => ({ value: s, label: s }))] },
        { value: typeF, onChange: setTypeF, options: [{ value: 'all', label: 'All types' }, ...TYPES.map((t) => ({ value: t, label: t }))] },
        { value: deptF, onChange: setDeptF, options: [{ value: 'all', label: 'All departments' }, ...data.departments.map((d) => ({ value: d.id, label: d.name }))] }
      ]}
      rowClick={(a) => navigate(`/audit/${a.id}`)}
      csvName="audit-plan"
      emptyTitle="No audits in the plan"
      emptySub="Plan a new audit to get started."
    />
  )
}

/* ------------------------------------------------------------------ calendar */
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const CAL_TYPE_COLOR = {
  Financial: '#8b53ac',
  Performance: '#0f9d6e',
  Compliance: '#d97706',
  IT: '#0488fb',
  Forensic: '#ff3381',
}

const startOfDay = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()
const inAuditWindow = (audit, date) => audit._start <= date && audit._end >= date
const dateLabel = (date) => date.toLocaleDateString('en-IN', {
  day: 'numeric', month: 'long', year: 'numeric', weekday: 'long',
})

// Build calendar rows only for the month view.
function calendarCells(year, month, fixedRows = false) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const length = fixedRows ? 42 : Math.ceil((offset + days) / 7) * 7
  return Array.from({ length }, (_, index) => {
    const date = new Date(year, month, index - offset + 1)
    return { date, outside: index < offset || index >= offset + days }
  })
}

function CalendarTab({ data }) {
  const fyStart = Number(config.fiscalYear.split('-')[0])
  const today = startOfDay(new Date())
  const initialFY = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1

  const [viewDate, setViewDate] = useState(() =>
    new Date(
      initialFY === fyStart ? today.getFullYear() : fyStart,
      initialFY === fyStart ? today.getMonth() : 3,
      1
    )
  )
  const [selectedDate, setSelectedDate] = useState(() =>
    initialFY === fyStart ? today : new Date(fyStart, 3, 1)
  )
  const [mode, setMode] = useState('month')
  const [fullscreen, setFullscreen] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!fullscreen) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [fullscreen])

  const audits = useMemo(() => data.audits.flatMap((audit) => {
    const start = startOfDay(audit.startDate)
    const end = startOfDay(audit.endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return []
    return [{ ...audit, _start: start, _end: end, _color: CAL_TYPE_COLOR[audit.type] || '#64748b' }]
  }), [data.audits])

  const filteredAudits = useMemo(() => {
    const term = search.trim().toLowerCase()
    return audits.filter((a) =>
      (typeFilter === 'all' || a.type === typeFilter) &&
      (statusFilter === 'all' || a.status === statusFilter) &&
      (!term || [a.code, a.title, a.departmentName, a.leadAuditorName]
        .some((value) => String(value || '').toLowerCase().includes(term)))
    )
  }, [audits, typeFilter, statusFilter, search])

  const viewFyStart = viewDate.getMonth() >= 3 ? viewDate.getFullYear() : viewDate.getFullYear() - 1
  const yearMonths = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const absoluteMonth = 3 + index
    return { month: absoluteMonth % 12, year: viewFyStart + Math.floor(absoluteMonth / 12) }
  }), [viewFyStart])

  const yearData = useMemo(() => yearMonths.map(({ month, year }) => {
    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month + 1, 0)
    // Include audits that overlap the month. Ongoing audits appear first, followed
    // by new starts in date order. Preserve the chronological audit sequence.
    const items = filteredAudits
      .filter((a) => a._start <= monthEnd && a._end >= monthStart)
      .sort((a, b) =>
        Math.max(a._start.getTime(), monthStart.getTime()) - Math.max(b._start.getTime(), monthStart.getTime()) ||
        a._start - b._start ||
        a._end - b._end ||
        String(a.code || '').localeCompare(String(b.code || '')))
    const startingCount = items.filter((a) => a._start >= monthStart && a._start <= monthEnd).length
    return { month, year, items, startingCount }
  }), [yearMonths, filteredAudits])

  const fyFirst = new Date(viewFyStart, 3, 1)
  const fyLast = new Date(viewFyStart + 1, 2, 31)
  const fyAudits = useMemo(() => filteredAudits.filter((a) => a._start <= fyLast && a._end >= fyFirst),
    [filteredAudits, viewFyStart])
  const fyStarting = fyAudits.filter((a) => a._start >= fyFirst && a._start <= fyLast).length
  const departmentsCovered = new Set(fyAudits.map((a) => a.departmentId).filter(Boolean)).size

  const monthCells = useMemo(() => calendarCells(viewDate.getFullYear(), viewDate.getMonth()), [viewDate])
  const monthInfo = yearData.find((entry) => entry.month === viewDate.getMonth() && entry.year === viewDate.getFullYear())
  const monthAudits = monthInfo?.items || []
  const selectedAudits = filteredAudits.filter((a) => inAuditWindow(a, selectedDate))
    .sort((a, b) => a._start - b._start)

  const jumpTo = (month, year, day = 1) => {
    setViewDate(new Date(year, month, 1))
    setSelectedDate(new Date(year, month, day))
  }
  const shiftMonth = (delta) => {
    const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1)
    jumpTo(next.getMonth(), next.getFullYear())
  }
  const shiftYear = (delta) => jumpTo(viewDate.getMonth(), viewDate.getFullYear() + delta)
  const goToday = () => jumpTo(today.getMonth(), today.getFullYear(), today.getDate())
  const goThisFy = () => {
    const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1
    jumpTo(3, year)
  }
  const switchMode = (nextMode) => {
    setMode(nextMode)
    // The year view opens at viewport width instead of being squeezed into a page card.
    setFullscreen(nextMode === 'year')
  }
  const openMonth = (month, year, day = 1) => {
    jumpTo(month, year, day)
    setMode('month')
    setFullscreen(false)
  }

  return (
    <div className={`card cal-shell ${fullscreen ? 'cal-fullscreen' : ''}`}>
      <style>{`
        .cal-shell { width:100%; max-width:none; min-width:0; overflow:visible; container: audit-calendar / inline-size; }
        .cal-shell.cal-fullscreen { position:fixed; inset:0; z-index:1100; overflow:auto;
          border:0; border-radius:0; background:var(--bg, #f8fafc); }
        .cal-wrap { padding:20px; min-width:0; }
        .cal-fullscreen .cal-wrap { width:100%; margin:0 auto; padding:26px 32px 36px; }
        .cal-toolbar { display:flex; align-items:center; flex-wrap:wrap; justify-content:space-between;
          gap:14px; margin-bottom:16px; }
        .cal-navigation, .cal-actions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .cal-heading { min-width:190px; margin:0 6px; }
        .cal-title { font-size:19px; font-weight:750; letter-spacing:-.025em; color:var(--text, #111827); }
        .cal-subtitle { margin-top:2px; font-size:11px; color:var(--text-3, #64748b); }
        .cal-btn { display:inline-flex; justify-content:center; align-items:center; gap:6px;
          min-height:35px; padding:0 11px; border-radius:8px; border:1px solid var(--border, #e5e7eb);
          background:var(--surface, #fff); color:var(--text, #111827); cursor:pointer; font-size:12px; font-weight:600; }
        .cal-btn:hover { background:var(--bg-2, #f3f4f6); }
        .cal-btn:focus-visible, .cal-year-head:focus-visible, .cal-year-item:focus-visible,
        .cal-day-button:focus-visible, .cal-chip:focus-visible { outline:2px solid var(--primary, #6366f1); outline-offset:2px; }
        .cal-btn-arrow { min-width:36px; font-size:20px; line-height:1; padding:0; }
        .cal-toggle { display:inline-flex; align-items:center; padding:3px; gap:2px;
          border:1px solid var(--border, #e5e7eb); border-radius:9px; background:var(--bg-2, #f3f4f6); }
        .cal-toggle button { border:0; background:transparent; color:var(--text-2, #4b5563);
          padding:7px 13px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:650; }
        .cal-toggle button.active { background:var(--surface, #fff); color:var(--primary, #6366f1);
          box-shadow:0 1px 3px rgba(0,0,0,.09); }
        .cal-filters { display:flex; flex-wrap:wrap; gap:9px; margin-bottom:16px; }
        .cal-filter-search, .cal-filter-select { height:36px; border:1px solid var(--border, #e5e7eb);
          border-radius:8px; color:var(--text, #111827); background:var(--surface, #fff);
          font:inherit; font-size:12px; padding:0 11px; min-width:0; }
        .cal-filter-search { flex:1 1 220px; max-width:390px; }
        .cal-filter-select { flex:0 1 155px; }
        .cal-filter-note { align-self:center; font-size:11px; color:var(--text-3, #64748b); margin-left:auto; }
        .cal-summary { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:12px; margin-bottom:18px; }
        .cal-summary-item { border:1px solid var(--border, #e5e7eb); background:var(--surface, #fff);
          border-radius:11px; padding:12px 16px; min-width:0; }
        .cal-summary-label { font-size:11px; color:var(--text-3, #64748b); }
        .cal-summary-number { font-size:25px; font-weight:750; letter-spacing:-.035em; line-height:1.25;
          color:var(--text, #111827); font-variant-numeric:tabular-nums; }
        .cal-year-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr));
          gap:16px; align-items:stretch; }
        .cal-year-month { min-width:0; display:flex; flex-direction:column; overflow:hidden;
          border:1px solid var(--border, #e5e7eb); border-radius:12px;
          background:var(--surface, #fff); }
        .cal-year-month.current { border-color:var(--primary, #6366f1); }
        .cal-year-head { width:100%; display:flex; justify-content:space-between; align-items:center;
          gap:12px; padding:15px 16px; border:0; border-bottom:1px solid var(--border, #e5e7eb);
          background:var(--bg-2, #f8fafc); color:var(--text, #111827); text-align:left; cursor:pointer; }
        .cal-year-head:hover { background:var(--primary-soft, #eef2ff); }
        .cal-year-name { display:flex; flex-wrap:wrap; align-items:baseline; gap:7px; min-width:0;
          font-size:16px; font-weight:750; }
        .cal-year-head-year { font-size:11px; color:var(--text-3, #64748b); font-weight:500; }
        .cal-year-count { display:inline-flex; flex-shrink:0; align-items:center; gap:7px;
          font-size:11px; font-weight:650; color:var(--text-2, #475569); }
        .cal-year-count-number { background:var(--surface, #fff); border:1px solid var(--border, #e5e7eb);
          border-radius:20px; padding:3px 9px; white-space:nowrap; }
        .cal-year-chevron { font-size:19px; line-height:1; font-weight:400; }
        .cal-year-subhead { padding:9px 16px; color:var(--text-3, #64748b); font-size:11px;
          border-bottom:1px solid var(--border, #e5e7eb); }
        .cal-year-list { flex:1; display:flex; flex-direction:column; gap:0; padding:4px 10px 10px; }
        .cal-year-item { width:100%; display:flex; align-items:flex-start; gap:10px;
          padding:11px 7px; background:transparent; border:0;
          border-bottom:1px solid var(--border, #e5e7eb); color:var(--text, #111827);
          text-align:left; cursor:pointer; min-width:0; }
        .cal-year-item:last-child { border-bottom:0; }
        .cal-year-item:hover { background:var(--bg-2, #f3f4f6); border-radius:7px; }
        .cal-year-date { flex:0 0 51px; display:flex; flex-direction:column; align-items:center;
          justify-content:center; gap:1px; padding:5px 3px; min-height:46px;
          border:1px solid var(--border, #e5e7eb); border-top:3px solid;
          border-radius:7px; color:var(--text-2, #4b5563); background:var(--surface, #fff);
          font-variant-numeric:tabular-nums; }
        .cal-year-date-day { font-size:18px; font-weight:750; line-height:1.1; }
        .cal-year-date-month { font-size:9px; color:var(--text-3, #64748b); }
        .cal-year-date-cont { font-size:9px; font-weight:650; line-height:1.2; }
        .cal-year-details { flex:1; display:flex; flex-direction:column; gap:4px; min-width:0; }
        .cal-year-row { display:flex; align-items:center; flex-wrap:wrap; gap:6px; }
        .cal-year-code { font-size:11px; font-weight:750; }
        .cal-year-status { font-size:9px; border-radius:4px; padding:2px 5px;
          background:var(--bg-2, #f1f5f9); color:var(--text-2, #64748b); }
        .cal-year-title { font-size:12px; font-weight:600; line-height:1.35; overflow-wrap:anywhere; }
        .cal-year-meta { font-size:10px; color:var(--text-3, #64748b); line-height:1.4; overflow-wrap:anywhere; }
        .cal-year-empty { flex:1; display:flex; align-items:center; justify-content:center;
          min-height:90px; padding:16px; font-size:12px; color:var(--text-3, #64748b); }
        .cal-pills { display:flex; gap:6px; flex-wrap:wrap; margin:0 0 16px; }
        .cal-pill { border:1px solid var(--border, #e5e7eb); background:var(--surface, #fff);
          color:var(--text-2, #4b5563); padding:6px 12px; border-radius:18px; font-size:11px; cursor:pointer; }
        .cal-pill.active { border-color:transparent; background:var(--primary, #6366f1); color:#fff; }
        .cal-month-layout { display:grid; grid-template-columns:minmax(0,1fr) 275px; gap:16px; align-items:start; }
        .cal-month-board { min-width:0; }
        .cal-grid { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:6px; }
        .cal-wd { text-align:center; font-size:10px; letter-spacing:.06em; text-transform:uppercase;
          font-weight:650; color:var(--text-3, #94a3b8); padding:3px 0; }
        .cal-cell { min-width:0; min-height:115px; padding:7px; display:flex; flex-direction:column;
          gap:5px; border:1px solid var(--border, #e5e7eb); border-radius:9px; background:var(--surface, #fff); }
        .cal-cell.outside { background:var(--bg-2, #f8fafc); opacity:.45; }
        .cal-cell.today { border-color:var(--primary, #6366f1); }
        .cal-cell.selected { outline:2px solid var(--primary, #6366f1); outline-offset:-2px; }
        .cal-day-button { display:flex; justify-content:space-between; align-items:center; width:100%;
          padding:0; border:0; background:transparent; color:var(--text-2, #475569);
          cursor:pointer; text-align:left; font-weight:650; font-size:12px; }
        .cal-cell.today .cal-day-button { color:var(--primary, #6366f1); }
        .cal-day-active { font-size:9px; color:var(--text-3, #64748b); font-weight:500; white-space:nowrap; }
        .cal-events { display:flex; flex-direction:column; gap:3px; min-width:0; }
        .cal-chip { display:block; width:100%; text-align:left; border:0; border-left:3px solid;
          border-radius:4px; padding:4px 5px; cursor:pointer; white-space:nowrap; overflow:hidden;
          text-overflow:ellipsis; font-size:10px; font-weight:650; }
        .cal-more { padding:2px; font-size:10px; color:var(--text-3, #64748b); }
        .cal-agenda { position:sticky; top:12px; border:1px solid var(--border, #e5e7eb);
          border-radius:11px; background:var(--surface, #fff); overflow:hidden; }
        .cal-agenda-head { padding:14px; border-bottom:1px solid var(--border, #e5e7eb); }
        .cal-agenda-date { margin-top:4px; font-size:12px; color:var(--text-2, #475569); }
        .cal-agenda-body { padding:10px; display:flex; flex-direction:column; gap:7px; max-height:560px; overflow:auto; }
        .cal-agenda-item { text-align:left; cursor:pointer; background:var(--bg-2, #f8fafc);
          border:1px solid var(--border, #e5e7eb); border-left:3px solid;
          padding:9px; border-radius:7px; color:var(--text, #111827); }
        .cal-agenda-item:hover { border-color:var(--primary, #6366f1); }
        .cal-agenda-code { font-size:11px; font-weight:750; }
        .cal-agenda-title { margin:4px 0; font-size:11px; line-height:1.35; }
        .cal-agenda-meta { font-size:10px; color:var(--text-3, #64748b); }
        .cal-empty { font-size:12px; color:var(--text-3, #64748b); padding:16px 8px; }
        .cal-legend { display:flex; flex-wrap:wrap; align-items:center; gap:7px 17px;
          margin-top:17px; color:var(--text-2, #64748b); font-size:11px; }
        .cal-dot { display:inline-block; width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .cal-legend-item { display:inline-flex; align-items:center; gap:6px; }
        .cal-legend-note { margin-left:auto; color:var(--text-3, #94a3b8); }
        @container audit-calendar (min-width:1550px) { .cal-year-grid { grid-template-columns:repeat(4,minmax(0,1fr)); } }
        @container audit-calendar (max-width:1050px) { .cal-year-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @container audit-calendar (max-width:950px) {
          .cal-month-layout { grid-template-columns:1fr; } .cal-agenda { position:static; } }
        @container audit-calendar (max-width:640px) { .cal-year-grid { grid-template-columns:1fr; } }
        @media (max-width:980px) { .cal-fullscreen .cal-wrap { padding:20px; } }
        @media (max-width:560px) {
          .cal-wrap, .cal-fullscreen .cal-wrap { padding:12px; }
          .cal-navigation { width:100%; } .cal-heading { flex:1; min-width:120px; }
          .cal-actions { justify-content:space-between; width:100%; }
          .cal-title { font-size:16px; } .cal-summary { gap:6px; }
          .cal-summary-item { padding:9px; } .cal-summary-number { font-size:20px; }
          .cal-summary-label { font-size:9px; } .cal-filter-search { max-width:none; }
          .cal-filter-note { margin-left:0; }
          .cal-grid { gap:3px; } .cal-cell { min-height:84px; padding:4px; }
          .cal-day-active { display:none; } .cal-chip { font-size:9px; padding:3px; }
          .cal-pill { padding:5px 9px; } .cal-legend-note { width:100%; margin-left:0; } }
        @media print { .cal-shell.cal-fullscreen { position:static; overflow:visible; }
          .cal-btn, .cal-toggle, .cal-filters { display:none; }
          .cal-year-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
          .cal-year-month, .cal-summary-item { break-inside:avoid; } }
      `}</style>

      <div className="cal-wrap">
        <div className="cal-toolbar">
          <div className="cal-navigation">
            <button type="button" className="cal-btn cal-btn-arrow"
              onClick={() => mode === 'year' ? shiftYear(-1) : shiftMonth(-1)}
              aria-label={mode === 'year' ? 'Previous financial year' : 'Previous month'}>‹</button>
            <button type="button" className="cal-btn cal-btn-arrow"
              onClick={() => mode === 'year' ? shiftYear(1) : shiftMonth(1)}
              aria-label={mode === 'year' ? 'Next financial year' : 'Next month'}>›</button>
            <div className="cal-heading">
              <div className="cal-title">
                {mode === 'year'
                  ? `FY ${viewFyStart}–${String((viewFyStart + 1) % 100).padStart(2, '0')}`
                  : `${MONTH_FULL[viewDate.getMonth()]} ${viewDate.getFullYear()}`}
              </div>
              <div className="cal-subtitle">
                {mode === 'year' ? 'Annual audit schedule · April to March' : `${monthAudits.length} audits active this month`}
              </div>
            </div>
            <button type="button" className="cal-btn" onClick={mode === 'year' ? goThisFy : goToday}>
              {mode === 'year' ? 'This FY' : 'Today'}
            </button>
          </div>
          <div className="cal-actions">
            <div className="cal-toggle" role="group" aria-label="Calendar view">
              <button type="button" className={mode === 'month' ? 'active' : ''}
                onClick={() => switchMode('month')} aria-pressed={mode === 'month'}>Month</button>
              <button type="button" className={mode === 'year' ? 'active' : ''}
                onClick={() => switchMode('year')} aria-pressed={mode === 'year'}>Year</button>
            </div>
            {mode === 'year' && (
              <button type="button" className="cal-btn" onClick={() => setFullscreen((value) => !value)}
                title={fullscreen ? 'Return to the page' : 'Use entire screen'}>
                {fullscreen ? 'Exit full screen' : 'Full screen'}
              </button>
            )}
          </div>
        </div>

        <div className="cal-filters">
          <input className="cal-filter-search" aria-label="Search calendar audits" value={search}
            onChange={(e) => setSearch(e.target.value)} placeholder="Search audits or departments…" />
          <select className="cal-filter-select" aria-label="Filter audit type" value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All audit types</option>
            {TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select className="cal-filter-select" aria-label="Filter audit status" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <span className="cal-filter-note">{filteredAudits.length} matching audits</span>
        </div>

        {mode === 'year' ? (
          <>
            <div className="cal-summary">
              <div className="cal-summary-item">
                <div className="cal-summary-label">Audits in this FY</div>
                <div className="cal-summary-number">{fyAudits.length}</div>
              </div>
              <div className="cal-summary-item">
                <div className="cal-summary-label">Starting this FY</div>
                <div className="cal-summary-number">{fyStarting}</div>
              </div>
              <div className="cal-summary-item">
                <div className="cal-summary-label">Departments covered</div>
                <div className="cal-summary-number">{departmentsCovered}</div>
              </div>
            </div>

            <div className="cal-year-grid">
              {yearData.map(({ month, year, items, startingCount }) => {
                const isCurrent = year === today.getFullYear() && month === today.getMonth()
                const monthStart = new Date(year, month, 1)
                return (
                  <section key={`${year}-${month}`} className={`cal-year-month ${isCurrent ? 'current' : ''}`}>
                    <button type="button" className="cal-year-head" onClick={() => openMonth(month, year)}
                      title={`Open ${MONTH_FULL[month]} ${year}`}>
                      <span className="cal-year-name">
                        {MONTH_FULL[month]} <span className="cal-year-head-year">{year}</span>
                      </span>
                      <span className="cal-year-count">
                        <span className="cal-year-count-number">{items.length} audit{items.length === 1 ? '' : 's'}</span>
                        <span className="cal-year-chevron" aria-hidden="true">›</span>
                      </span>
                    </button>
                    <div className="cal-year-subhead">
                      {items.length ? `${startingCount} starting · ${items.length - startingCount} continuing` : 'No scheduled work'}
                    </div>
                    <div className="cal-year-list">
                      {items.length === 0 ? (
                        <div className="cal-year-empty">No audits scheduled this month</div>
                      ) : items.map((audit) => {
                        const continuing = audit._start < monthStart
                        return (
                          <button type="button" key={audit.id} className="cal-year-item"
                            onClick={() => navigate(`/audit/${audit.id}`)}
                            title={`${audit.code} — ${audit.title}\n${fmtDate(audit.startDate)} → ${fmtDate(audit.endDate)}`}>
                            <span className="cal-year-date" style={{ borderTopColor: audit._color }}>
                              {continuing ? (
                                <span className="cal-year-date-cont">Ongoing</span>
                              ) : (
                                <>
                                  <span className="cal-year-date-day">{String(audit._start.getDate()).padStart(2, '0')}</span>
                                  <span className="cal-year-date-month">{MONTH_FULL[month].slice(0, 3)}</span>
                                </>
                              )}
                            </span>
                            <span className="cal-year-details">
                              <span className="cal-year-row">
                                <span className="cal-dot" style={{ background: audit._color }} />
                                <span className="cal-year-code" style={{ color: audit._color }}>{audit.code}</span>
                                <span className="cal-year-status">{audit.status}</span>
                              </span>
                              <span className="cal-year-title">{audit.title}</span>
                              <span className="cal-year-meta">{audit.departmentName || audit.type}</span>
                              <span className="cal-year-meta">{fmtDate(audit.startDate)} → {fmtDate(audit.endDate)}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })}            </div>
          </>
        ) : (
          <>
            <div className="cal-pills">
              {yearMonths.map(({ month, year }) => (
                <button type="button" key={`${year}-${month}`}
                  className={`cal-pill ${viewDate.getMonth() === month && viewDate.getFullYear() === year ? 'active' : ''}`}
                  onClick={() => jumpTo(month, year)}>{MONTH_FULL[month].slice(0, 3)}</button>
              ))}
            </div>
            <div className="cal-month-layout">
              <div className="cal-month-board">
                <div className="cal-grid">
                  {WEEKDAYS.map((day) => <div className="cal-wd" key={day}>{day}</div>)}
                  {monthCells.map(({ date, outside }, index) => {
                    const starts = outside ? [] : monthAudits.filter((a) => sameDay(a._start, date))
                    const active = outside ? [] : monthAudits.filter((a) => inAuditWindow(a, date))
                    return (
                      <div key={index} className={`cal-cell ${outside ? 'outside' : ''} ${sameDay(date, today) ? 'today' : ''} ${sameDay(date, selectedDate) && !outside ? 'selected' : ''}`}>
                        <button type="button" className="cal-day-button" disabled={outside}
                          onClick={() => setSelectedDate(date)} aria-label={`Select ${dateLabel(date)}`}>
                          {date.getDate()}
                          {active.length > 0 && <span className="cal-day-active">{active.length} active</span>}
                        </button>
                        <div className="cal-events">
                          {starts.slice(0, 3).map((audit) => (
                            <button type="button" key={audit.id} className="cal-chip"
                              style={{ background: `${audit._color}16`, borderLeftColor: audit._color, color: audit._color }}
                              title={`${audit.code} — ${audit.title}\n${fmtDate(audit.startDate)} → ${fmtDate(audit.endDate)}`}
                              onClick={() => navigate(`/audit/${audit.id}`)}>{audit.code}</button>
                          ))}
                          {starts.length > 3 && <span className="cal-more">+{starts.length - 3} more</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <aside className="cal-agenda">
                <div className="cal-agenda-head">
                  <div className="cal-title" style={{ fontSize: 14 }}>Day details</div>
                  <div className="cal-agenda-date">{dateLabel(selectedDate)}</div>
                  <div className="cal-subtitle">{selectedAudits.length} active audit{selectedAudits.length === 1 ? '' : 's'}</div>
                </div>
                <div className="cal-agenda-body">
                  {selectedAudits.length === 0 ? (
                    <div className="cal-empty">No audits scheduled for this date.</div>
                  ) : selectedAudits.map((audit) => (
                    <button type="button" key={audit.id} className="cal-agenda-item"
                      style={{ borderLeftColor: audit._color }} onClick={() => navigate(`/audit/${audit.id}`)}>
                      <div className="cal-agenda-code" style={{ color: audit._color }}>{audit.code}</div>
                      <div className="cal-agenda-title">{audit.title}</div>
                      <div className="cal-agenda-meta">{audit.departmentName || audit.type} · {audit.status}</div>
                      <div className="cal-agenda-meta">{fmtDate(audit.startDate)} → {fmtDate(audit.endDate)}</div>
                    </button>
                  ))}
                </div>
              </aside>
            </div>
          </>
        )}

        <div className="cal-legend">
          {Object.entries(CAL_TYPE_COLOR).map(([type, color]) => (
            <span className="cal-legend-item" key={type}>
              <span className="cal-dot" style={{ background: color }} />{type}
            </span>
          ))}
          {mode === 'year' && <span className="cal-legend-note">Audits appear in date order · Click a month or an audit to open it</span>}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ risk */
function RiskTab({ data, canRecalc, logActivity, toast }) {
  const [recalced, setRecalced] = useState(0)
  const rows = useMemo(() => {
    return data.departments
      .map((d) => {
        const r = computeDepartmentRisk(d, { findings: data.findings, observations: data.observations, audits: data.audits })
        return { dept: d, ...r }
      })
      .sort((a, b) => b.score - a.score)
  }, [data, recalced])

  const ratingBadge = (r) => <span className={`badge ${r === 'Critical' ? 'danger' : r === 'High' ? 'warning' : r === 'Moderate' ? 'info' : 'success'}`}>{r}</span>

  return (
    <div>
      <div className="flex-between mb-2">
        <div className="muted small">Risk-based selection score per department — drives the next audit cycle. <InfoTip text="Scores combine unresolved critical findings, open compliance observations, time since the last audit and budget exposure. Higher score = higher audit priority." /></div>
        {canRecalc && (
          <button
            className="btn btn-secondary"
            onClick={async () => {
              setRecalced((x) => x + 1)
              await logActivity('Recalculated risk scores', 'System', 'risk', 'Department risk scores recomputed for all departments')
              toast('Risk scores recalculated for all departments')
            }}
          >
            ↻ Recalculate Scores
          </button>
        )}
      </div>
      <DataTable
        rows={rows}
        columns={[
          {
            key: 'name', label: 'Department', sortable: true, sort: (r) => r.dept.name,
            render: (r) => <div><div className="cell-strong">{r.dept.name}</div><div className="cell-sub">{r.dept.code} · {r.dept.headName}</div></div>
          },
          {
            key: 'score', label: 'Risk Score', num: true, sortable: true,
            render: (r) => (
              <div className="flex" style={{ gap: 8 }}>
                <span className="bold num" style={{ width: 26 }}>{r.score}</span>
                <Progress value={r.score} className={r.score >= 75 ? 'bad' : r.score >= 55 ? 'warning' : 'success'} style={undefined} />
              </div>
            )
          },
          { key: 'rating', label: 'Rating', sortable: true, render: (r) => ratingBadge(r.rating) },
          {
            key: 'top', label: 'Top Risk Factor', sortable: false,
            render: (r) => <span className="small muted">{r.factors[0].key} — {r.factors[0].detail}</span>
          },
          {
            key: 'audits', label: 'Audits', num: true, sortable: true,
            render: (r) => data.audits.filter((a) => a.departmentId === r.dept.id).length
          },
          {
            key: '__actions', label: '', render: (r) => (
              <div className="row-actions">
                <button className="btn-icon" title="Open department" onClick={() => navigate(`/department/${r.dept.id}`)}>↗</button>
              </div>
            )
          }
        ]}
        searchKeys={[(r) => r.dept.name, (r) => r.rating, (r) => r.dept.code]}
        searchPlaceholder="Search departments…"
        rowClick={(r) => navigate(`/department/${r.dept.id}`)}
        csvName="department-risk"
        emptyTitle="No departments"
      />
    </div>
  )
}

/* ------------------------------------------------------------------ resources */
function ResourcesTab({ data }) {
  const officers = useMemo(() => {
    return data.users
      .filter((u) => ['senior', 'junior'].includes(u.role) && u.status === 'Active')
      .map((u) => {
        const lead = data.audits.filter((a) => a.leadAuditorId === u.id && ['Planned', 'Scheduled', 'In Progress', 'Under Review'].includes(a.status))
        const member = data.audits.filter((a) => a.team.some((t) => t.userId === u.id) && ['Planned', 'Scheduled', 'In Progress', 'Under Review'].includes(a.status))
        const fieldDays = [...lead, ...member].reduce((s, a) => s + (a.estimatedDays || 0), 0)
        return { u, leadCount: lead.length, memberCount: member.length, total: lead.length + member.length, fieldDays }
      })
      .sort((a, b) => b.total - a.total)
  }, [data])

  const maxLoad = Math.max(...officers.map((o) => o.total), 1)

  return (
    <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
      <div className="card">
        <div className="card-head"><h3>Officer Workload</h3><span className="hint">active & upcoming engagements</span></div>
        <div className="card-pad">
          <div className="flex-col" style={{ gap: 11 }}>
            {officers.map((o) => (
              <div key={o.u.id} className="flex" style={{ gap: 11 }}>
                <Avatar name={o.u.name} color={o.u.avatarColor} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex-between">
                    <span className="small bold">{o.u.name}</span>
                    <span className="muted tiny">{o.leadCount} lead · {o.memberCount} team · ~{o.fieldDays} field days</span>
                  </div>
                  <div className="progress mt-1" style={{ height: 8 }}>
                    <div style={{ width: `${(o.total / maxLoad) * 100}%`, background: o.total >= 4 ? '#cc004e' : o.total >= 3 ? '#d97706' : '#8b53ac' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-col" style={{ gap: 16 }}>
        <div className="card card-pad">
          <div className="muted small bold">PLANNED COVERAGE</div>
          <div className="bold" style={{ fontSize: 24 }}>{data.departments.filter((d) => data.audits.some((a) => a.departmentId === d.id)).length} / {data.departments.length}</div>
          <div className="muted tiny mt-1">departments with at least one audit this cycle</div>
        </div>
        <div className="card card-pad">
          <div className="muted small bold">TOTAL PLANNED BUDGET</div>
          <div className="bold" style={{ fontSize: 24 }}>{fmtINR(data.audits.reduce((s, a) => s + (a.allocatedBudget || 0), 0))}</div>
          <div className="muted tiny mt-1">across {data.audits.length} engagements</div>
        </div>
        <div className="card card-pad">
          <div className="muted small bold">AVERAGE DURATION</div>
          <div className="bold" style={{ fontSize: 24 }}>
            {Math.round(data.audits.reduce((s, a) => s + daysBetween(a.startDate, a.endDate), 0) / Math.max(data.audits.length, 1))} days
          </div>
          <div className="muted tiny mt-1">per engagement window</div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ audit form */
function AuditFormModal({ audit, data, onClose, onSave }) {
  const isNew = !audit
  const [f, setF] = useState(() => ({
    title: audit ? audit.title : '',
    type: audit ? audit.type : 'Financial',
    departmentId: audit ? audit.departmentId : (data.departments[0] || {}).id || '',
    priority: audit ? audit.priority : 'Medium',
    startDate: audit ? String(audit.startDate).slice(0, 10) : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    duration: audit ? audit.estimatedDays : 45,
    leadAuditorId: audit ? audit.leadAuditorId : '',
    teamIds: audit ? audit.team.map((t) => t.userId) : [],
    budgetLakh: audit ? audit.allocatedBudget / 100000 : 8,
    objectives: audit ? audit.objectives : '',
    scope: audit ? audit.scope : '',
    riskScore: audit ? audit.riskScore : 50
  }))
  const [showTeamPicker, setShowTeamPicker] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  const loadTeam = (teamId) => {
    const team = data.teams.find((t) => t.id === teamId)
    if (!team) return
    set('leadAuditorId', team.leadId)
    set('teamIds', team.memberIds)
  }

  const seniors = data.users.filter((u) => ['senior'].includes(u.role) && u.status === 'Active')

  return (
    <Modal
      open onClose={onClose}
      title={isNew ? 'Plan New Audit' : `Edit Plan — ${audit.code}`}
      sub={isNew ? 'The audit enters the annual plan with status Planned' : 'Changes are tracked in the audit timeline'}
      size="lg"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!f.title.trim() || !f.departmentId} onClick={() => onSave(f)}>
            {isNew ? 'Add to Plan' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field span-all">
          <label>Audit title <span className="req">*</span></label>
          <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Financial Audit of Health & Family Welfare — FY expenditure" />
        </div>
        <div className="field">
          <label>Audit type</label>
          <select className="select" value={f.type} onChange={(e) => set('type', e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Department <span className="req">*</span></label>
          <select className="select" value={f.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
            {data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Priority</label>
          <select className="select" value={f.priority} onChange={(e) => set('priority', e.target.value)}>
            {['Low', 'Medium', 'High', 'Critical'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Start date</label>
          <input className="input" type="date" value={String(f.startDate).slice(0, 10)} onChange={(e) => set('startDate', e.target.value)} />
        </div>
        <div className="field">
          <label>Duration (field days)</label>
          <input className="input" type="number" min="5" max="180" value={f.duration} onChange={(e) => set('duration', e.target.value)} />
        </div>
        <div className="field">
          <label>Budget (₹ lakh)</label>
          <input className="input" type="number" min="0" step="0.1" value={f.budgetLakh} onChange={(e) => set('budgetLakh', e.target.value)} />
        </div>
        <div className="field">
          <label>Risk score (0–100)</label>
          <input className="input" type="number" min="0" max="100" value={f.riskScore} onChange={(e) => set('riskScore', e.target.value)} />
        </div>
        <div className="field">
          <label>Lead auditor</label>
          <select className="select" value={f.leadAuditorId} onChange={(e) => set('leadAuditorId', e.target.value)}>
            <option value="">Not assigned</option>
            {seniors.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.designation}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Load from team</label>
          <select className="select" value="" onChange={(e) => loadTeam(e.target.value)}>
            <option value="">Choose a saved team…</option>
            {data.teams.filter((t) => t.status === 'Active').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <span className="help">Sets the lead and members from a saved team.</span>
        </div>
        <div className="field span-all">
          <label>Team members ({f.teamIds.length} selected)</label>
          <div className="flex wrap" style={{ gap: 6, marginBottom: 6 }}>
            {f.teamIds.map((id) => {
              const u = data.users.find((x) => x.id === id)
              return <span key={id} className="chip active" onClick={() => set('teamIds', f.teamIds.filter((x) => x !== id))}>{u ? u.name : id} ✕</span>
            })}
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowTeamPicker(true)}>+ Choose members</button>
        </div>
        <div className="field span-all">
          <label>Objectives</label>
          <textarea className="textarea" value={f.objectives} onChange={(e) => set('objectives', e.target.value)} placeholder="What the audit aims to verify / evaluate…" />
        </div>
        <div className="field span-all">
          <label>Scope</label>
          <textarea className="textarea" value={f.scope} onChange={(e) => set('scope', e.target.value)} placeholder="Records, period, districts and sampling approach…" />
        </div>
      </div>

      <UserPicker
        open={showTeamPicker} onClose={() => setShowTeamPicker(false)}
        users={data.users.filter((u) => ['senior', 'junior', 'coordinator'].includes(u.role))}
        multi initialSelected={f.teamIds}
        title="Add team members"
        onDone={(ids) => set('teamIds', ids)}
      />
    </Modal>
  )
}