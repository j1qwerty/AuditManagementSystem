// Users & Roles administration (FR-001 to FR-004): user CRUD, activation,
// password reset and a glanceable role-permission matrix.
import { useMemo, useState } from 'react'
import { useData } from '../../context/DataContext'
import { Avatar, Badge, Empty, Modal, StatCard, Tabs, ConfirmDialog } from '../../components/ui'
import { ROLES, MODULES, ACTIONS } from '../../lib/permissions'
import { fmtDate, fmtRelative, uid, todayISO } from '../../lib/utils'
import config from '../../lib/config'

const MODULE_LABELS = {
  dashboard: 'Dashboard', departments: 'Departments', planning: 'Audit Planning', audits: 'Audits',
  findings: 'Findings', compliance: 'Compliance Tracking', analytics: 'Analytics & Risk', reports: 'Reports',
  documents: 'Documents', messages: 'Messages', users: 'Users & Roles', integrations: 'Integrations',
  activity: 'Activity Log', settings: 'Settings', profile: 'My Profile', guide: 'Demo Guide'
}
const ACTION_LABELS = {
  'audit.create': 'Create audits', 'audit.edit': 'Edit audits', 'audit.execute': 'Execute audits (checklist/evidence)',
  'audit.submitReview': 'Submit audit for review', 'audit.approve': 'Approve audits',
  'finding.create': 'Raise findings', 'finding.respond': 'Respond to findings (dept)', 'finding.close': 'Close findings',
  'observation.update': 'Update observations', 'observation.escalate': 'Escalate observations',
  'planning.manage': 'Manage annual plan', 'report.create': 'Generate reports', 'report.approve': 'Approve reports',
  'document.upload': 'Upload documents', 'document.share': 'Share documents', 'message.send': 'Send messages',
  'user.manage': 'Manage users', 'integration.manage': 'Manage integrations', 'settings.manage': 'Manage settings',
  'reminders.send': 'Send reminders', 'risk.recalculate': 'Recalculate risk scores'
}

export default function Users() {
  const { data, save, toast, logActivity } = useData()
  const [tab, setTab] = useState('users')
  const [q, setQ] = useState('')
  const [editUser, setEditUser] = useState(null)
  const [confirmReset, setConfirmReset] = useState(null)

  const rows = useMemo(
    () => data.users.filter((u) => (u.name + u.email + u.designation).toLowerCase().includes(q.toLowerCase())),
    [data.users, q]
  )

  const persistUser = async (user, action, detail) => {
    await save('users', user, { logAction: action, logDetail: detail })
  }

  const toggleStatus = async (u) => {
    const status = u.status === 'Active' ? 'Inactive' : 'Active'
    await persistUser({ ...u, status }, 'Updated user', `${u.name} → ${status}`)
    toast(`${u.name} is now ${status}.`)
  }

  const resetPassword = async () => {
    await persistUser({ ...confirmReset, password: config.demoPassword }, 'Reset user password', confirmReset.name)
    toast(`Password reset to “${config.demoPassword}”.`)
    setConfirmReset(null)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Users & Roles</h1>
          <div className="sub">User accounts and the role-based access control matrix (RBAC) — six roles as defined in the requirement (FR-001, FR-002).</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setEditUser({})}>+ Add user</button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Total users" value={data.users.length} icon="◍" accent />
        <StatCard label="Active" value={data.users.filter((u) => u.status === 'Active').length} icon="✓" />
        <StatCard label="Roles configured" value={Object.keys(ROLES).length} icon="⛨" />
        <StatCard label="Permission rules" value={Object.keys(ACTIONS).length} icon="⚙" />
      </div>

      <Tabs
        tabs={[{ key: 'users', label: 'Users', count: data.users.length }, { key: 'roles', label: 'Roles & Permissions' }]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'users' && (
        <>
          <div className="filter-bar">
            <input className="input search" placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="card">
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>User</th><th>Role</th><th>Department</th><th>Status</th><th>Last login</th><th></th></tr></thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="flex">
                          <Avatar name={u.name} color={u.avatarColor} />
                          <div>
                            <div className="strong">{u.name}</div>
                            <div className="sub">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td><Badge kind={ROLES[u.role] ? ROLES[u.role].label : ''}>{ROLES[u.role] ? ROLES[u.role].label : u.role}</Badge></td>
                      <td className="small">{(data.departments.find((d) => d.id === u.departmentId) || {}).name || '—'}</td>
                      <td><Badge kind={u.status}>{u.status}</Badge></td>
                      <td className="small">{u.lastLogin ? fmtRelative(u.lastLogin) : '—'}</td>
                      <td className="right">
                        <div className="flex" style={{ gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditUser(u)}>Edit</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setConfirmReset(u)}>Reset password</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => toggleStatus(u)}>{u.status === 'Active' ? 'Deactivate' : 'Activate'}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && <Empty icon="◍" title="No users match" />}
          </div>
        </>
      )}

      {tab === 'roles' && (
        <>
          <div className="grid-2 mb-3">
            {Object.values(ROLES).map((r) => (
              <div className="card" key={r.key}>
                <div className="card-head"><h3>{r.label}</h3><span className="sw" style={{ width: 12, height: 12, borderRadius: 3, background: r.color, display: 'inline-block' }} /></div>
                <div className="card-body">
                  <p className="small muted" style={{ lineHeight: 1.55 }}>{r.description}</p>
                  <div className="small muted">
                    {data.users.filter((u) => u.role === r.key).length} user(s): {data.users.filter((u) => u.role === r.key).map((u) => u.name.split(' ')[0]).join(', ') || 'none'}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="card mb-3">
            <div className="card-head"><h3>Module access matrix</h3><span className="hint">which role can open which module</span></div>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Module</th>{Object.values(ROLES).map((r) => <th key={r.key} className="center">{r.label.split(' ').map((w) => w[0]).join('')}</th>)}</tr>
                </thead>
                <tbody>
                  {Object.keys(MODULES).map((m) => (
                    <tr key={m}>
                      <td className="strong">{MODULE_LABELS[m]}</td>
                      {Object.values(ROLES).map((r) => (
                        <td key={r.key} className="center">{MODULES[m].includes(r.key) ? <span style={{ color: 'var(--primary)', fontWeight: 700 }}>✓</span> : <span className="muted">—</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Action permissions</h3><span className="hint">fine-grained operations per role</span></div>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Action</th>{Object.values(ROLES).map((r) => <th key={r.key} className="center">{r.label.split(' ').map((w) => w[0]).join('')}</th>)}</tr>
                </thead>
                <tbody>
                  {Object.keys(ACTIONS).map((a) => (
                    <tr key={a}>
                      <td className="strong">{ACTION_LABELS[a] || a}</td>
                      {Object.values(ROLES).map((r) => (
                        <td key={r.key} className="center">{ACTIONS[a].includes(r.key) ? <span style={{ color: 'var(--primary)', fontWeight: 700 }}>✓</span> : <span className="muted">—</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <UserModal user={editUser} onClose={() => setEditUser(null)} onSave={persistUser} />

      <ConfirmDialog
        open={!!confirmReset}
        onClose={() => setConfirmReset(null)}
        onConfirm={resetPassword}
        title="Reset password"
        message={`Reset the password of ${confirmReset ? confirmReset.name : ''} to the demo default “${config.demoPassword}”?`}
        confirmLabel="Reset password"
      />
    </div>
  )

  function UserModal({ user, onClose, onSave }) {
    const isNew = !user || !user.id
    const [form, setForm] = useState(
      user && user.id
        ? { ...user }
        : { name: '', email: '', role: 'junior', designation: '', departmentId: '', phone: '', avatarColor: '#116a5b' }
    )
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
    const submit = async () => {
      if (!form.name || !form.email) { toast('Name and email are required.', 'error'); return }
      const rec = {
        ...form,
        id: form.id || uid('u'),
        password: form.password || config.demoPassword,
        status: form.status || 'Active',
        joined: form.joined || todayISO(),
        lastLogin: form.lastLogin || null
      }
      await onSave(rec, isNew ? 'Created user' : 'Updated user', `${rec.name} (${ROLES[rec.role] ? ROLES[rec.role].label : rec.role})`)
      toast(isNew ? 'User created — they can sign in with the demo password.' : 'User updated.')
      onClose()
    }
    return (
      <Modal open={!!user} onClose={onClose} title={isNew ? 'Add user' : `Edit — ${form.name}`}
        footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit}>Save</button></>}>
        <div className="form-row">
          <div className="field"><label>Full name *</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div className="field"><label>Email *</label><input className="input" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@up.gov.in" /></div>
        </div>
        <div className="form-row">
          <div className="field"><label>Role</label>
            <select className="select" value={form.role} onChange={(e) => set('role', e.target.value)}>
              {Object.values(ROLES).map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select></div>
          <div className="field"><label>Designation</label><input className="input" value={form.designation || ''} onChange={(e) => set('designation', e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="field"><label>Department (coordinators)</label>
            <select className="select" value={form.departmentId || ''} onChange={(e) => set('departmentId', e.target.value)}>
              <option value="">— None —</option>
              {data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></div>
          <div className="field"><label>Phone</label><input className="input" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} /></div>
        </div>
        {form.joined && <div className="muted small">Member since {fmtDate(form.joined)}</div>}
      </Modal>
    )
  }
}
