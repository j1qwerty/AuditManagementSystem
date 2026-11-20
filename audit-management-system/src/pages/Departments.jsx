// Departments - registry with full management (add / edit / deactivate /
// delete) and a detail profile with units, audits, findings and documents.
import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { navigate } from '../lib/router'
import {
  Badge, DataTable, PageHead, Modal, ConfirmDialog, StatCard, KV, TypeBadge, Progress, SectionTitle, Avatar
} from '../components/ui'
import { uid, fmtDate, fmtINRCompact } from '../lib/utils'
import { suggestedProgress } from '../lib/ai'

export default function Departments() {
  const { data, save, remove, currentUser, toast, can } = useData()
  const [statusF, setStatusF] = useState('all')
  const [editing, setEditing] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)

  const rows = useMemo(
    () => data.departments.filter((d) => statusF === 'all' || (d.status || 'Active') === statusF),
    [data.departments, statusF]
  )

  const stats = (d) => {
    const audits = data.audits.filter((a) => a.departmentId === d.id)
    const findings = data.findings.filter((f) => f.departmentId === d.id)
    const obs = data.observations.filter((o) => o.departmentId === d.id)
    return {
      audits: audits.length,
      active: audits.filter((a) => ['In Progress', 'Under Review'].includes(a.status)).length,
      openFindings: findings.filter((f) => !['Resolved', 'Closed'].includes(f.status)).length,
      openObs: obs.filter((o) => o.status !== 'Resolved').length
    }
  }

  const saveDept = async (form) => {
    const exists = !!form.id
    const rec = {
      id: exists ? form.id : uid('d'),
      code: form.code.toUpperCase(), name: form.name,
      headName: form.headName, headDesignation: form.headDesignation,
      annualBudget: Number(form.annualBudget) || 0, employeeCount: Number(form.employeeCount) || 0,
      units: exists ? (data.departments.find((d) => d.id === form.id) || {}).units || [] : [],
      contactEmail: form.contactEmail, contactPhone: form.contactPhone,
      address: form.address, city: form.city || 'Lucknow',
      established: Number(form.established) || new Date().getFullYear(),
      lastAuditDate: null, status: form.status
    }
    await save('departments', rec, { logAction: exists ? 'Updated department' : 'Added department', logDetail: rec.name })
    setEditing(null)
    toast(exists ? 'Department updated' : 'Department added')
  }

  const toggleStatus = async (d) => {
    const status = (d.status || 'Active') === 'Active' ? 'Inactive' : 'Active'
    await save('departments', { ...d, status }, { logAction: `Department marked ${status}`, logDetail: d.name })
    toast(`${d.name} marked ${status}`)
  }

  const deleteDept = async () => {
    const d = confirmDel
    await remove('departments', d.id, { logAction: 'Deleted department', logDetail: d.name })
    setConfirmDel(null)
    toast('Department deleted')
  }

  return (
    <div>
      <PageHead
        title="Departments"
        sub={`${data.departments.length} departments in the audit universe`}
        actions={<button className="btn btn-primary" onClick={() => setEditing({ new: true })}>+ Add Department</button>}
      />

      <div className="grid grid-4 mb-3">
        <StatCard label="All Departments" value={data.departments.length} strip="#8b53ac" onClick={() => setStatusF('all')} foot="in the audit universe" />
        <StatCard label="Active" value={data.departments.filter((d) => (d.status || 'Active') === 'Active').length} strip="#0f9d6e" onClick={() => setStatusF('Active')} foot="auditable" />
        <StatCard label="Inactive" value={data.departments.filter((d) => d.status === 'Inactive').length} strip="#8d7f9a" onClick={() => setStatusF('Inactive')} foot="deactivated" />
        <StatCard label="With Open Findings" value={data.departments.filter((d) => data.findings.some((f) => f.departmentId === d.id && !['Resolved', 'Closed'].includes(f.status))).length} strip="#ff3381" foot="unresolved findings" />
      </div>

      <DataTable
        rows={rows}
        columns={[
          {
            key: 'name', label: 'Department', sortable: true,
            render: (d) => (
              <div>
                <div className="cell-strong">{d.name}</div>
                <div className="cell-sub">{d.code} · {d.headDesignation}</div>
              </div>
            )
          },
          { key: 'headName', label: 'Head', sortable: true, render: (d) => <span className="small">{d.headName}</span> },
          { key: 'annualBudget', label: 'Annual Budget', num: true, sortable: true, render: (d) => <span className="num">{fmtINRCompact(d.annualBudget)}</span> },
          { key: 'employeeCount', label: 'Staff', num: true, sortable: true, render: (d) => <span className="num">{d.employeeCount.toLocaleString('en-IN')}</span> },
          { key: 'units', label: 'Units', num: true, sortable: true, sort: (d) => (d.units || []).length, render: (d) => (d.units || []).length },
          { key: 'audits', label: 'Audits', num: true, sortable: true, render: (d) => stats(d).audits },
          { key: 'openFindings', label: 'Open Findings', num: true, sortable: true, render: (d) => stats(d).openFindings },
          { key: 'status', label: 'Status', sortable: true, render: (d) => <Badge kind={d.status || 'Active'}>{d.status || 'Active'}</Badge> },
          {
            key: '__actions', label: '', render: (d) => (
              <div className="row-actions">
                <button className="btn-icon" title="Open profile" onClick={() => navigate(`/department/${d.id}`)}>↗</button>
                <button className="btn-icon" title={(d.status || 'Active') === 'Active' ? 'Deactivate' : 'Activate'} onClick={() => toggleStatus(d)}>{(d.status || 'Active') === 'Active' ? '⏸' : '▶'}</button>
                <button className="btn-icon" title="Edit" onClick={() => setEditing(d)}>✎</button>
                <button className="btn-icon danger" title="Delete" onClick={() => setConfirmDel(d)}>🗑</button>
              </div>
            )
          }
        ]}
        searchKeys={['name', 'code', 'headName', 'headDesignation']}
        searchPlaceholder="Search departments…"
        filters={[
          { value: statusF, onChange: setStatusF, options: [{ value: 'all', label: 'All statuses' }, { value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }] }
        ]}
        rowClick={(d) => navigate(`/department/${d.id}`)}
        csvName="departments"
        emptyTitle="No departments"
        emptySub="Add a department to the audit universe."
      />

      {editing && (
        <DeptModal
          dept={editing.new ? null : editing}
          onClose={() => setEditing(null)}
          onSave={saveDept}
        />
      )}
      <ConfirmDialog
        open={!!confirmDel} onClose={() => setConfirmDel(null)}
        title="Delete department" danger confirmLabel="Delete"
        message={`Delete "${confirmDel ? confirmDel.name : ''}"? Historical audits and findings keep their records.`}
        onConfirm={deleteDept}
      />
    </div>
  )
}

function DeptModal({ dept, onClose, onSave }) {
  const isNew = !dept
  const [f, setF] = useState(() => ({
    id: dept ? dept.id : null,
    code: dept ? dept.code : '',
    name: dept ? dept.name : '',
    headName: dept ? dept.headName : '',
    headDesignation: dept ? dept.headDesignation : '',
    annualBudget: dept ? dept.annualBudget / 1e7 : '',
    employeeCount: dept ? dept.employeeCount : '',
    contactEmail: dept ? dept.contactEmail : '',
    contactPhone: dept ? dept.contactPhone : '',
    address: dept ? dept.address : '',
    city: dept ? dept.city : 'Lucknow',
    established: dept ? dept.established : new Date().getFullYear(),
    status: dept ? dept.status || 'Active' : 'Active'
  }))
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  return (
    <Modal
      open onClose={onClose} title={isNew ? 'Add Department' : `Edit — ${dept.name}`} size="md"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!f.name.trim() || !f.code.trim()} onClick={() => onSave({ ...f, annualBudget: Number(f.annualBudget) * 1e7 })}>
            {isNew ? 'Add Department' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field span-all">
          <label>Department name <span className="req">*</span></label>
          <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="field">
          <label>Code <span className="req">*</span></label>
          <input className="input" value={f.code} onChange={(e) => set('code', e.target.value)} placeholder="e.g. PWD" />
        </div>
        <div className="field">
          <label>Status</label>
          <select className="select" value={f.status} onChange={(e) => set('status', e.target.value)}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <div className="field">
          <label>Head name</label>
          <input className="input" value={f.headName} onChange={(e) => set('headName', e.target.value)} />
        </div>
        <div className="field">
          <label>Head designation</label>
          <input className="input" value={f.headDesignation} onChange={(e) => set('headDesignation', e.target.value)} />
        </div>
        <div className="field">
          <label>Annual budget (₹ crore)</label>
          <input className="input" type="number" min="0" value={f.annualBudget} onChange={(e) => set('annualBudget', e.target.value)} />
        </div>
        <div className="field">
          <label>Employee count</label>
          <input className="input" type="number" min="0" value={f.employeeCount} onChange={(e) => set('employeeCount', e.target.value)} />
        </div>
        <div className="field">
          <label>Contact email</label>
          <input className="input" type="email" value={f.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
        </div>
        <div className="field">
          <label>Contact phone</label>
          <input className="input" value={f.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
        </div>
        <div className="field">
          <label>City</label>
          <input className="input" value={f.city} onChange={(e) => set('city', e.target.value)} />
        </div>
        <div className="field">
          <label>Established</label>
          <input className="input" type="number" min="1900" max="2100" value={f.established} onChange={(e) => set('established', e.target.value)} />
        </div>
        <div className="field span-all">
          <label>Address</label>
          <input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}

/* ======================================================================== */
/* Department detail                                                         */
/* ======================================================================== */
export function DepartmentDetail({ id }) {
  const { data } = useData()
  const dept = data.departments.find((d) => d.id === id)
  if (!dept) {
    return (
      <div className="card"><div className="empty"><div className="t">Department not found</div></div></div>
    )
  }
  const audits = data.audits.filter((a) => a.departmentId === id)
  const findings = data.findings.filter((f) => f.departmentId === id)
  const obs = data.observations.filter((o) => o.departmentId === id)
  const docs = data.documents.filter((d) => d.departmentId === id)
  const coordinators = data.users.filter((u) => u.role === 'coordinator' && u.departmentId === id)

  return (
    <div>
      <PageHead
        backTo="/departments"
        title={dept.name}
        sub={`${dept.code} · ${dept.headDesignation} · ${dept.city || ''} · ${dept.status || 'Active'}`}
        actions={<Badge kind={dept.status || 'Active'}>{dept.status || 'Active'}</Badge>}
      />

      <div className="grid grid-4 mb-3">
        <StatCard label="Audits" value={audits.length} strip="#8b53ac" foot={`${audits.filter((a) => ['In Progress', 'Under Review'].includes(a.status)).length} active`} onClick={() => navigate('/audits')} />
        <StatCard label="Open Findings" value={findings.filter((f) => !['Resolved', 'Closed'].includes(f.status)).length} strip="#ff3381" foot={`${findings.length} total`} onClick={() => navigate('/findings')} />
        <StatCard label="Open Observations" value={obs.filter((o) => o.status !== 'Resolved').length} strip="#d97706" foot={`${obs.filter((o) => o.status === 'Resolved').length} resolved`} onClick={() => navigate('/compliance')} />
        <StatCard label="Documents" value={docs.length} strip="#0488fb" foot="in the repository" onClick={() => navigate('/documents')} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
        <div className="flex-col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><h3>Audit History</h3><span className="hint">all engagements with this department</span></div>
            <div className="table-scroll">
              <table className="table">
                <thead><tr><th>Audit</th><th>Type</th><th>Status</th><th style={{ width: 120 }}>Progress</th><th>Ends</th></tr></thead>
                <tbody>
                  {audits.length === 0 && <tr><td colSpan={5}><div className="empty"><div className="t">No audits yet</div></div></td></tr>}
                  {audits.map((a) => {
                    const p = suggestedProgress(a)
                    return (
                      <tr key={a.id} className="clickable" onClick={() => navigate(`/audit/${a.id}`)}>
                        <td><div className="cell-strong">{a.code}</div><div className="cell-sub ellipsis" style={{ maxWidth: 220 }}>{a.title}</div></td>
                        <td><TypeBadge t={a.type} /></td>
                        <td><Badge kind={a.status}>{a.status}</Badge></td>
                        <td><div className="flex" style={{ gap: 6 }}><Progress value={p} className={p >= 80 ? 'success' : p >= 40 ? 'warning' : 'bad'} /><span className="tiny num bold">{p}%</span></div></td>
                        <td className="nowrap small">{fmtDate(a.endDate)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Units / Sub-organisations</h3><span className="hint">{(dept.units || []).length} units</span></div>
            <div className="table-scroll">
              <table className="table">
                <thead><tr><th>Unit</th><th>Head</th><th className="num">Staff</th></tr></thead>
                <tbody>
                  {(dept.units || []).map((u) => (
                    <tr key={u.id}><td className="cell-strong">{u.name}</td><td>{u.head}</td><td className="num">{u.staffCount.toLocaleString('en-IN')}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex-col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><h3>Profile</h3></div>
            <div className="card-pad">
              <KV rows={[
                ['Code', dept.code],
                ['Head', `${dept.headName}`],
                ['Designation', dept.headDesignation],
                ['Annual budget', fmtINRCompact(dept.annualBudget)],
                ['Employees', (dept.employeeCount || 0).toLocaleString('en-IN')],
                ['Established', dept.established],
                ['Contact', dept.contactEmail],
                ['Phone', dept.contactPhone],
                ['Address', `${dept.address}${dept.city ? `, ${dept.city}` : ''}`]
              ]} />
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Coordinators</h3></div>
            <div className="card-pad flex-col" style={{ gap: 10 }}>
              {coordinators.length === 0 && <span className="muted small">No coordinator assigned.</span>}
              {coordinators.map((u) => (
                <div key={u.id} className="flex" style={{ gap: 10 }}>
                  <Avatar name={u.name} color={u.avatarColor} />
                  <div>
                    <div className="bold small">{u.name}</div>
                    <div className="muted tiny">{u.email}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Compliance Posture</h3></div>
            <div className="card-pad">
              <KV rows={[
                ['Observations raised', obs.length],
                ['Resolved', obs.filter((o) => o.status === 'Resolved').length],
                ['Escalated', obs.filter((o) => o.status === 'Escalated').length],
                ['Critical findings', findings.filter((f) => f.severity === 'Critical').length],
                ['Recovery potential', fmtINRCompact(findings.reduce((s, f) => s + (f.amountInvolved || 0), 0))]
              ]} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
