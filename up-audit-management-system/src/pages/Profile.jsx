// My profile: edit own details, change password, review own activity.
import { useState } from 'react'
import { useData } from '../context/DataContext'
import { Avatar, Badge, StatCard } from '../components/ui'
import { ROLES } from '../lib/permissions'
import { fmtDate, fmtRelative } from '../lib/utils'
import config from '../lib/config'

export default function Profile() {
  const { data, currentUser, save, toast, logActivity } = useData()
  const [form, setForm] = useState({ name: currentUser.name, designation: currentUser.designation, phone: currentUser.phone || '' })
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })

  const role = ROLES[currentUser.role]
  const myActivity = data.activity.filter((a) => a.userId === currentUser.id).slice(0, 12)
  const myAudits = data.audits.filter((a) => a.leadAuditorId === currentUser.id || a.team.some((t) => t.userId === currentUser.id))

  const saveProfile = async () => {
    await save('users', { ...currentUser, ...form }, { logAction: 'Updated own profile', logDetail: form.name })
    toast('Profile updated.')
  }

  const changePassword = async () => {
    if (pw.current !== currentUser.password) { toast('Current password is incorrect.', 'error'); return }
    if (!pw.next || pw.next.length < 6) { toast('New password must be at least 6 characters.', 'error'); return }
    if (pw.next !== pw.confirm) { toast('Passwords do not match.', 'error'); return }
    await save('users', { ...currentUser, password: pw.next }, { logAction: 'Changed own password', logDetail: currentUser.name })
    toast('Password changed.')
    setPw({ current: '', next: '', confirm: '' })
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>My Profile</h1>
          <div className="sub">Your account details, password and recent activity on the platform.</div>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Audits involved" value={myAudits.length} icon="☰" accent />
        <StatCard label="Findings raised" value={data.findings.filter((f) => f.raisedBy === currentUser.id).length} icon="!" />
        <StatCard label="Messages" value={data.messages.filter((m) => m.from === currentUser.id).length} icon="✉" />
        <StatCard label="Actions logged" value={data.activity.filter((a) => a.userId === currentUser.id).length} icon="🕘" />
      </div>

      <div className="grid-2">
        <div>
          <div className="card mb-3">
            <div className="card-head"><h3>Account</h3></div>
            <div className="card-body">
              <div className="flex" style={{ gap: 14, marginBottom: 14 }}>
                <Avatar name={currentUser.name} color={currentUser.avatarColor} lg />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{currentUser.name}</div>
                  <div className="muted small">{currentUser.designation}</div>
                  <div style={{ marginTop: 6 }}><Badge kind={role ? role.label : ''}>{role ? role.label : currentUser.role}</Badge></div>
                </div>
              </div>
              <dl className="kv">
                <dt>Email</dt><dd>{currentUser.email}</dd>
                <dt>Department</dt><dd>{(data.departments.find((d) => d.id === currentUser.departmentId) || {}).name || '—'}</dd>
                <dt>Member since</dt><dd>{fmtDate(currentUser.joined)}</dd>
                <dt>Last login</dt><dd>{currentUser.lastLogin ? fmtRelative(currentUser.lastLogin) : '—'}</dd>
                <dt>Sign-in method</dt><dd>SSO / password (demo)</dd>
              </dl>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Edit details</h3></div>
            <div className="card-body">
              <div className="field"><label>Full name</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="field"><label>Designation</label>
                <input className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
              <div className="field"><label>Phone</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <button className="btn btn-primary" onClick={saveProfile}>Save changes</button>
            </div>
          </div>
        </div>
        <div>
          <div className="card mb-3">
            <div className="card-head"><h3>Change password</h3><span className="hint">demo default: {config.demoPassword}</span></div>
            <div className="card-body">
              <div className="field"><label>Current password</label>
                <input className="input" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
              <div className="field"><label>New password</label>
                <input className="input" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
              <div className="field"><label>Confirm new password</label>
                <input className="input" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></div>
              <button className="btn btn-primary" onClick={changePassword}>Update password</button>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>My recent activity</h3></div>
            <div className="card-body">
              {myActivity.length === 0 && <div className="muted small">No activity yet.</div>}
              <ul className="timeline">
                {myActivity.map((a) => (
                  <li key={a.id}>
                    <div className="tt"><b>{a.action}</b> — {a.entityType}</div>
                    <div className="td">{a.details}</div>
                    <div className="td">{fmtRelative(a.timestamp)}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
