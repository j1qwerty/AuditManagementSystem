// Users & Roles - user management plus an editable role-permission matrix.
import { useMemo, useState } from 'react'
import { useData } from '../../context/DataContext'
import {
  Badge, DataTable, PageHead, Modal, ConfirmDialog, StatCard, Tabs, Avatar, InfoTip, SectionTitle
} from '../../components/ui'
import { uid, fmtDate, fmtRelative } from '../../lib/utils'
import { ROLES, ROLE_ORDER, ACTIONS, ACTION_GROUPS } from '../../lib/permissions'
import config from '../../lib/config'

export default function Users() {
  const { data, usersNamed, save, remove, setRolePermissions, currentUser, toast, can, notify } = useData()
  const [tab, setTab] = useState('users')
  const [editing, setEditing] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [roleF, setRoleF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [deptF, setDeptF] = useState('all')
  const [permTab, setPermTab] = useState(ROLE_ORDER[1])

  const deptName = (id) => (data.departments.find((d) => d.id === id) || {}).name || '—'
  const permFor = (role) => (data.rolePermissions.find((p) => p.role === role) || { actions: [] }).actions

  const rows = useMemo(
    () =>
      usersNamed
        .filter((u) => roleF === 'all' || u.role === roleF)
        .filter((u) => statusF === 'all' || u.status === statusF)
        .filter((u) => deptF === 'all' || u.departmentId === deptF),
    [usersNamed, roleF, statusF, deptF]
  )

  const saveUser = async (form) => {
    const exists = !!form.id
    const rec = {
      id: exists ? form.id : uid('u'),
      name: form.name, email: form.email, password: form.password || config.defaultPassword,
      role: form.role, designation: form.designation, departmentId: form.departmentId || null,
      phone: form.phone,
      status: form.status,
      avatarColor: exists ? (data.users.find((u) => u.id === form.id) || {}).avatarColor : ROLES[form.role].color,
      joined: exists ? (data.users.find((u) => u.id === form.id) || {}).joined || new Date().toISOString() : new Date().toISOString(),
      lastLogin: exists ? (data.users.find((u) => u.id === form.id) || {}).lastLogin : null
    }
    await save('users', rec, { logAction: exists ? 'Updated user' : 'Created user', logDetail: `${rec.name} (${ROLES[rec.role].label})` })
    if (!exists) await notify([rec.id], 'Assignment', 'Your account has been created', `Welcome to the ${config.appName}.`, '#/profile')
    setEditing(null)
    toast(exists ? 'User updated' : 'User created')
  }

  const toggleStatus = async (u) => {
    const status = u.status === 'Active' ? 'Inactive' : 'Active'
    await save('users', { ...u, status }, { logAction: `User marked ${status}`, logDetail: u.name })
    toast(`${u.name} marked ${status}`)
  }

  const resetPassword = async (u) => {
    await save('users', { ...u, password: config.defaultPassword }, { logAction: 'Reset password', logDetail: u.name })
    toast(`Password reset to the default for ${u.name}`)
  }

  const deleteUser = async () => {
    await remove('users', confirmDel.id, { logAction: 'Deleted user', logDetail: confirmDel.name })
    setConfirmDel(null)
    toast('User deleted')
  }

  const togglePerm = async (role, actionKey) => {
    const current = permFor(role)
    const actions = current.includes(actionKey) ? current.filter((a) => a !== actionKey) : [...current, actionKey]
    await setRolePermissions(role, actions)
    toast(`Permission ${actions.includes(actionKey) ? 'granted' : 'revoked'} — ${ACTIONS[actionKey].label} (${ROLES[role].label})`)
  }

  return (
    <div>
      <PageHead title="Users & Roles" sub="Accounts, role assignment and the editable permission matrix" />

      <Tabs
        tabs={[{ key: 'users', label: 'Users', count: data.users.length }, { key: 'roles', label: 'Roles & Permissions' }]}
        active={tab} onChange={setTab}
      />

      {tab === 'users' && (
        <div>
          <div className="grid grid-4 mb-3">
            <StatCard label="All Users" value={data.users.length} strip="#8b53ac" onClick={() => { setRoleF('all'); setStatusF('all') }} foot="workspace accounts" />
            <StatCard label="Active" value={data.users.filter((u) => u.status === 'Active').length} strip="#0f9d6e" onClick={() => setStatusF('Active')} />
            <StatCard label="Audit Officers" value={data.users.filter((u) => ['senior', 'junior'].includes(u.role)).length} strip="#0488fb" onClick={() => setRoleF('senior')} foot="senior + junior" />
            <StatCard label="Coordinators" value={data.users.filter((u) => u.role === 'coordinator').length} strip="#ff3381" onClick={() => setRoleF('coordinator')} foot="department side" />
          </div>

          <DataTable
            rows={rows}
            columns={[
              {
                key: 'name', label: 'User', sortable: true,
                render: (u) => (
                  <div className="flex" style={{ gap: 10 }}>
                    <Avatar name={u.name} color={u.avatarColor} />
                    <div>
                      <div className="cell-strong">{u.name}</div>
                      <div className="cell-sub">{u.email}</div>
                    </div>
                  </div>
                )
              },
              {
                key: 'role', label: 'Role', sortable: true,
                render: (u) => <span className="badge purple">{ROLES[u.role].label}</span>
              },
              { key: 'designation', label: 'Designation', sortable: true, render: (u) => <span className="small">{u.designation}</span> },
              { key: 'departmentId', label: 'Department', sortable: true, sort: (u) => deptName(u.departmentId), render: (u) => <span className="small">{u.departmentId ? deptName(u.departmentId) : '—'}</span> },
              { key: 'status', label: 'Status', sortable: true, render: (u) => <Badge kind={u.status}>{u.status}</Badge> },
              { key: 'lastLogin', label: 'Last Login', sortable: true, sort: (u) => u.lastLogin || '', render: (u) => <span className="small nowrap">{u.lastLogin ? fmtRelative(u.lastLogin) : 'never'}</span> },
              {
                key: '__actions', label: '', render: (u) => (
                  <div className="row-actions">
                    <button className="btn-icon" title={u.status === 'Active' ? 'Deactivate' : 'Activate'} onClick={() => toggleStatus(u)}>{u.status === 'Active' ? '⏸' : '▶'}</button>
                    <button className="btn-icon" title="Reset password" onClick={() => resetPassword(u)}>🔑</button>
                    <button className="btn-icon" title="Edit user" onClick={() => setEditing(u)}>✎</button>
                    <button className="btn-icon danger" title="Delete user" disabled={u.id === currentUser.id} onClick={() => setConfirmDel(u)}>🗑</button>
                  </div>
                )
              }
            ]}
            searchKeys={['name', 'email', 'designation', (u) => ROLES[u.role].label, (u) => deptName(u.departmentId)]}
            searchPlaceholder="Search users…"
            filters={[
              { value: roleF, onChange: setRoleF, options: [{ value: 'all', label: 'All roles' }, ...ROLE_ORDER.map((r) => ({ value: r, label: ROLES[r].label }))] },
              { value: statusF, onChange: setStatusF, options: [{ value: 'all', label: 'All statuses' }, { value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }] },
              { value: deptF, onChange: setDeptF, options: [{ value: 'all', label: 'All departments' }, ...data.departments.map((d) => ({ value: d.id, label: d.name }))] }
            ]}
            rowClick={(u) => setEditing(u)}
            csvName="users"
            emptyTitle="No users match"
            actionsLabel="Manage"
          />

          {editing && <UserModal user={editing.new ? null : editing} data={data} onClose={() => setEditing(null)} onSave={saveUser} />}
          <ConfirmDialog
            open={!!confirmDel} onClose={() => setConfirmDel(null)}
            title="Delete user" danger confirmLabel="Delete"
            message={`Delete ${confirmDel ? confirmDel.name : ''}? Their history remains in the activity trail.`}
            onConfirm={deleteUser}
          />
        </div>
      )}

      {tab === 'roles' && (
        <div className="flex-col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <h3>Roles</h3>
              <span className="hint">select a role to edit its permissions</span>
            </div>
            <div className="card-pad grid grid-3">
              {ROLE_ORDER.map((r) => (
                <div
                  key={r}
                  className={`card card-hover card-pad ${permTab === r ? '' : ''}`}
                  style={{ cursor: 'pointer', borderColor: permTab === r ? 'var(--thistle-500)' : undefined, boxShadow: permTab === r ? '0 0 0 3px rgba(139,83,172,0.12)' : undefined }}
                  onClick={() => setPermTab(r)}
                >
                  <div className="flex-between mb-1">
                    <span className="bold small">{ROLES[r].label}</span>
                    <span className="muted tiny">{data.users.filter((u) => u.role === r).length} users</span>
                  </div>
                  <div className="muted small">{ROLES[r].description}</div>
                  <div className="mt-1"><span className="badge purple">{permFor(r).length} permissions</span></div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Permissions — {ROLES[permTab].label}</h3>
              <span className="hint flex" style={{ gap: 6 }}>
                changes apply instantly <InfoTip text="Toggling a permission immediately updates what this role can see and do across the app for everyone with the role." />
              </span>
            </div>
            <div className="card-pad">
              {ACTION_GROUPS.map((g) => (
                <div key={g.group} className="mb-3">
                  <SectionTitle>{g.group}</SectionTitle>
                  <div className="grid grid-2">
                    {g.keys.map((k) => {
                      const on = permFor(permTab).includes(k)
                      return (
                        <div key={k} className="flex-between" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px' }}>
                          <div style={{ minWidth: 0, paddingRight: 10 }}>
                            <div className="small bold">{ACTIONS[k].label}</div>
                            <div className="muted tiny ellipsis">module: {k.split('.')[0]}</div>
                          </div>
                          <label className="switch" title={on ? 'Granted' : 'Revoked'}>
                            <input type="checkbox" checked={on} onChange={() => togglePerm(permTab, k)} disabled={permTab === 'admin'} />
                            <span className="track" />
                          </label>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              {permTab === 'admin' && (
                <div className="tl-body" style={{ background: 'var(--warning-soft)' }}>
                  The System Administrator role always retains full permissions and cannot be restricted from this screen.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function UserModal({ user, data, onClose, onSave }) {
  const isNew = !user
  const [f, setF] = useState(() => ({
    id: user ? user.id : null,
    name: user ? user.name : '',
    email: user ? user.email : '',
    password: '',
    role: user ? user.role : 'junior',
    designation: user ? user.designation : 'Junior Audit Officer',
    departmentId: user ? user.departmentId || '' : '',
    phone: user ? user.phone : '',
    status: user ? user.status : 'Active'
  }))
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  return (
    <Modal
      open onClose={onClose} title={isNew ? 'Add User' : `Edit — ${user.name}`} size="md"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!f.name.trim() || !f.email.trim()} onClick={() => onSave(f)}>{isNew ? 'Create User' : 'Save Changes'}</button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field">
          <label>Full name <span className="req">*</span></label>
          <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="field">
          <label>Email <span className="req">*</span></label>
          <input className="input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
        </div>
        <div className="field">
          <label>Role</label>
          <select className="select" value={f.role} onChange={(e) => { set('role', e.target.value); set('designation', ROLES[e.target.value].label) }}>
            {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Department {f.role === 'coordinator' && <span className="req">*</span>}</label>
          <select className="select" value={f.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
            <option value="">Not department-linked</option>
            {data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Designation</label>
          <input className="input" value={f.designation} onChange={(e) => set('designation', e.target.value)} />
        </div>
        <div className="field">
          <label>Phone</label>
          <input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div className="field">
          <label>Status</label>
          <select className="select" value={f.status} onChange={(e) => set('status', e.target.value)}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <div className="field">
          <label>{isNew ? 'Password' : 'New password (optional)'}</label>
          <input className="input" type="text" value={f.password} onChange={(e) => set('password', e.target.value)} placeholder={isNew ? `default: ${config.defaultPassword}` : 'leave blank to keep current'} />
        </div>
      </div>
    </Modal>
  )
}
