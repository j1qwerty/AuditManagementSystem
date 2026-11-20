// Audit register: all audits with filters (FR-020..028 outputs) + create (FR-021).
import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { Badge, Empty, Modal, Progress, PROGRESS_CLASS, StatCard, TypeBadge, Pagination } from '../components/ui'
import { fmtDate, fmtINRCompact, uid, daysFromNow } from '../lib/utils'
import { can } from '../lib/permissions'
import { exportCSV } from '../lib/exporters'
import config from '../lib/config'

const STATUSES = ['Planned', 'Scheduled', 'In Progress', 'Under Review', 'Completed', 'Closed']
const TYPES = ['Financial', 'Performance', 'Compliance', 'IT', 'Forensic']

export default function Audits() {
  const { data, currentUser, save, toast, notify, logActivity } = useData()
  const [q, setQ] = useState('')
  const [fType, setFType] = useState('All')
  const [fStatus, setFStatus] = useState('All')
  const [fDept, setFDept] = useState('All')
  const [page, setPage] = useState(1)
  const [showNew, setShowNew] = useState(false)
  const pageSize = config.pageSize

  const rows = useMemo(() => {
    return data.audits
      .filter((a) => (fType === 'All' ? true : a.type === fType))
      .filter((a) => (fStatus === 'All' ? true : a.status === fStatus))
      .filter((a) => (fDept === 'All' ? true : a.departmentId === fDept))
      .filter((a) => (a.title + a.code + a.departmentName).toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
  }, [data.audits, q, fType, fStatus, fDept])

  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const curPage = Math.min(page, pages)
  const paged = rows.slice((curPage - 1) * pageSize, curPage * pageSize)

  const exportList = () => {
    exportCSV(
      `audit-register-${config.fiscalYear}`,
      rows.map((a) => ({
        Code: a.code, Title: a.title, Type: a.type, Department: a.departmentName,
        Status: a.status, Priority: a.priority, Lead: a.leadAuditorName || '',
        Start: fmtDate(a.startDate), End: fmtDate(a.endDate), 'Progress %': a.progress,
        'Findings (open)': data.findings.filter((f) => f.auditId === a.id && !['Resolved', 'Closed'].includes(f.status)).length
      }))
    )
    toast('Audit register exported (Excel/CSV).')
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Audits</h1>
          <div className="sub">Complete audit register — financial, performance, compliance, IT and forensic audits across all departments.</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={exportList}>⤓ Export (Excel)</button>
          {can(currentUser, 'audit.create') && <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Audit</button>}
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Total audits" value={data.audits.length} icon="☰" accent />
        <StatCard label="In field work" value={data.audits.filter((a) => a.status === 'In Progress').length} icon="▶" />
        <StatCard label="Awaiting review" value={data.audits.filter((a) => a.status === 'Under Review').length} icon="◎" />
        <StatCard label="Starting within 30 days" value={data.audits.filter((a) => daysFromNow(a.startDate) > 0 && daysFromNow(a.startDate) <= 30).length} icon="⏱" />
      </div>

      <div className="filter-bar">
        <input className="input search" placeholder="Search by code, title, department…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        <select className="select" value={fType} onChange={(e) => setFType(e.target.value)}>
          <option>All</option>{TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className="select" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option>All</option>{STATUSES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className="select" value={fDept} onChange={(e) => setFDept(e.target.value)}>
          <option>All</option>{data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <span className="muted small">{rows.length} audits</span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Code</th><th>Title</th><th>Type</th><th>Department</th><th>Status</th><th>Priority</th>
                <th>Lead</th><th>Schedule</th><th style={{ minWidth: 130 }}>Progress</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((a) => (
                <tr key={a.id} className="clickable" onClick={() => (window.location.hash = `#/audit/${a.id}`)}>
                  <td className="strong">{a.code}</td>
                  <td style={{ maxWidth: 320 }}>{a.title.length > 60 ? a.title.slice(0, 60) + '…' : a.title}</td>
                  <td><TypeBadge t={a.type} /></td>
                  <td>{a.departmentName}</td>
                  <td><Badge kind={a.status}>{a.status}</Badge></td>
                  <td><Badge kind={a.priority}>{a.priority}</Badge></td>
                  <td>{a.leadAuditorName || <span className="muted">—</span>}</td>
                  <td className="small">{fmtDate(a.startDate)}<div className="sub">{fmtDate(a.endDate)}</div></td>
                  <td>
                    <Progress value={a.progress} className={PROGRESS_CLASS(a.progress)} />
                    <span className="muted small">{a.progress}% · {data.findings.filter((f) => f.auditId === a.id).length} findings</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <Empty icon="☰" title="No audits match the filters" sub="Try clearing the search or filters." />}
        <div style={{ padding: '0 14px 12px' }}>
          <Pagination page={curPage} pages={pages} onPage={setPage} total={rows.length} pageSize={pageSize} />
        </div>
      </div>

      <NewAuditModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  )

  function NewAuditModal({ open, onClose }) {
    const [form, setForm] = useState({ title: '', type: 'Financial', departmentId: '', priority: 'Medium', startDate: '', endDate: '', leadAuditorId: '', teamIds: [], objectives: '', auditPeriod: '', allocatedBudget: '' })
    const auditors = data.users.filter((u) => ['cao', 'senior', 'junior'].includes(u.role))
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

    const submit = async () => {
      if (!form.title || !form.departmentId || !form.startDate || !form.endDate) { toast('Please fill title, department, start and end dates.', 'error'); return }
      const dept = data.departments.find((d) => d.id === form.departmentId)
      const lead = data.users.find((u) => u.id === form.leadAuditorId)
      const seq = data.audits.filter((a) => a.type === form.type).length + 1
      const TYPE_PREFIX = { Financial: 'FA', Performance: 'PA', Compliance: 'CA', IT: 'IA', Forensic: 'FoA' }
      const audit = {
        id: uid('a'),
        code: `${TYPE_PREFIX[form.type]}-${new Date().getFullYear()}-${String(seq).padStart(3, '0')}`,
        title: form.title,
        type: form.type,
        departmentId: dept.id,
        departmentName: dept.name,
        fiscalYear: config.fiscalYear,
        status: 'Planned',
        priority: form.priority,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        auditPeriod: form.auditPeriod || 'As per audit programme',
        leadAuditorId: lead ? lead.id : null,
        leadAuditorName: lead ? lead.name : null,
        team: form.teamIds.map((id, i) => ({ userId: id, name: data.users.find((u) => u.id === id).name, role: i === 0 ? 'Co-lead' : 'Auditor' })),
        allocatedBudget: Number(form.allocatedBudget) || 0,
        estimatedDays: Math.max(1, Math.round((new Date(form.endDate) - new Date(form.startDate)) / 86400000)),
        objectives: form.objectives,
        scope: 'To be defined at entry conference.',
        riskScore: dept ? 50 : 50,
        progress: 0,
        checklist: [],
        evidence: [],
        workpapers: [],
        comments: [],
        reviewHistory: [],
        timeline: [{ date: new Date().toISOString(), event: 'Audit entry created in the system' }],
        createdAt: new Date().toISOString()
      }
      await save('audits', audit, { logAction: 'Created audit', logDetail: `${audit.code} — ${audit.title}` })
      const targets = [audit.leadAuditorId, ...audit.team.map((t) => t.userId)].filter(Boolean)
      if (targets.length) await notify(targets, 'Assignment', `You are assigned to ${audit.code}`, `${audit.type} audit of ${dept.name}: ${fmtDate(audit.startDate)} to ${fmtDate(audit.endDate)}.`, `/audit/${audit.id}`)
      toast(`Audit ${audit.code} created and team notified.`)
      onClose()
    }

    return (
      <Modal open={open} onClose={onClose} title="Create new audit"
        footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit}>Create audit</button></>}>
        <div className="field"><label>Audit title *</label>
          <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Financial Audit of …" /></div>
        <div className="form-row">
          <div className="field"><label>Audit type *</label>
            <select className="select" value={form.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div className="field"><label>Department *</label>
            <select className="select" value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
              <option value="">Select department…</option>
              {data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></div>
        </div>
        <div className="form-row-3">
          <div className="field"><label>Start date *</label>
            <input className="input" type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} /></div>
          <div className="field"><label>End date *</label>
            <input className="input" type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} /></div>
          <div className="field"><label>Priority</label>
            <select className="select" value={form.priority} onChange={(e) => set('priority', e.target.value)}>{['Low', 'Medium', 'High', 'Critical'].map((p) => <option key={p}>{p}</option>)}</select></div>
        </div>
        <div className="form-row">
          <div className="field"><label>Lead auditor</label>
            <select className="select" value={form.leadAuditorId} onChange={(e) => set('leadAuditorId', e.target.value)}>
              <option value="">Unassigned</option>
              {data.users.filter((u) => ['cao', 'senior'].includes(u.role)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select></div>
          <div className="field"><label>Allocated budget (₹)</label>
            <input className="input" type="number" value={form.allocatedBudget} onChange={(e) => set('allocatedBudget', e.target.value)} placeholder="e.g. 850000" /></div>
        </div>
        <div className="field"><label>Team members</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {auditors.map((u) => {
              const checked = form.teamIds.includes(u.id)
              return (
                <label key={u.id} className={`demo-acc ${checked ? '' : ''}`} style={{ borderColor: checked ? 'var(--primary)' : 'var(--border)', minWidth: 150, cursor: 'pointer' }}>
                  <span className="checkbox-row" style={{ padding: 0 }}>
                    <input type="checkbox" checked={checked} onChange={() => set('teamIds', checked ? form.teamIds.filter((x) => x !== u.id) : [...form.teamIds, u.id])} />
                    <span className="small">{u.name}</span>
                  </span>
                </label>
              )
            })}
          </div></div>
        <div className="field"><label>Objectives</label>
          <textarea className="textarea" value={form.objectives} onChange={(e) => set('objectives', e.target.value)} placeholder="What should this audit achieve?" /></div>
      </Modal>
    )
  }
}
