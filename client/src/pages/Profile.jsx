// My Profile - personal details, password and preferences.
import { useState } from 'react'
import { useData } from '../context/DataContext'
import { PageHead, Avatar, Badge, SectionTitle, Tabs, KV } from '../components/ui'
import { fmtDate, fmtDateTime } from '../lib/utils'
import { ROLES } from '../lib/permissions'
import config from '../lib/config'

export default function Profile() {
  const { currentUser, data, save, toast } = useData()
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' })
  const [color, setColor] = useState(currentUser.avatarColor)

  const myActivity = data.activity.filter((a) => a.userId === currentUser.id).slice(0, 12)
  const myLogins = data.loginEvents.filter((l) => l.userId === currentUser.id).slice(0, 8)
  const myAudits = data.audits.filter((a) => a.leadAuditorId === currentUser.id || a.team.some((t) => t.userId === currentUser.id))

  const changePassword = async () => {
    if (pwd.current !== currentUser.password) return toast('Current password is incorrect', 'error')
    if (!pwd.next || pwd.next.length < 5) return toast('New password must be at least 5 characters', 'error')
    if (pwd.next !== pwd.confirm) return toast('Passwords do not match', 'error')
    await save('users', { ...currentUser, password: pwd.next }, { logAction: 'Changed password', logDetail: currentUser.name })
    setPwd({ current: '', next: '', confirm: '' })
    toast('Password updated')
  }

  const saveColor = async (c) => {
    setColor(c)
    await save('users', { ...currentUser, avatarColor: c }, { log: false })
    toast('Avatar colour updated')
  }

  return (
    <div>
      <PageHead
        title="My Profile"
        sub="Personal details, sign-in security and your recent activity"
      />

      <div className="grid" style={{ gridTemplateColumns: '1fr 1.6fr', gap: 16 }}>
        <div className="flex-col" style={{ gap: 16 }}>
          <div className="card card-pad center">
            <Avatar name={currentUser.name} color={color} lg />
            <div className="bold" style={{ fontSize: 16, marginTop: 10 }}>{currentUser.name}</div>
            <div className="muted small">{currentUser.designation}</div>
            <div className="mt-1"><Badge kind="Active">{ROLES[currentUser.role].label}</Badge></div>
            <p className="muted tiny mt-2">{ROLES[currentUser.role].description}</p>
            <div className="flex" style={{ gap: 8, justifyContent: 'center', marginTop: 10 }}>
              {['#70428a', '#036dc9', '#0f9d6e', '#d97706', '#ff3381', '#cc004e'].map((c) => (
                <span key={c} onClick={() => saveColor(c)} style={{ width: 22, height: 22, borderRadius: 7, background: c, cursor: 'pointer', outline: color === c ? '2.5px solid var(--text)' : 'none', outlineOffset: 2 }} />
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Change Password</h3></div>
            <div className="card-pad flex-col" style={{ gap: 10 }}>
              <div className="field">
                <label>Current password</label>
                <input className="input" type="password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} />
              </div>
              <div className="field">
                <label>New password</label>
                <input className="input" type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
              </div>
              <div className="field">
                <label>Confirm new password</label>
                <input className="input" type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
              </div>
              <button className="btn btn-primary" disabled={!pwd.current || !pwd.next || !pwd.confirm} onClick={changePassword}>Update Password</button>
            </div>
          </div>
        </div>

        <div className="flex-col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><h3>Details</h3></div>
            <div className="card-pad">
              <KV rows={[
                ['Email', currentUser.email],
                ['Phone', currentUser.phone || '—'],
                ['Role', ROLES[currentUser.role].label],
                ['Department', currentUser.departmentId ? (data.departments.find((d) => d.id === currentUser.departmentId) || {}).name : 'Not department-linked'],
                ['Member since', fmtDate(currentUser.joined)],
                ['Last sign-in', currentUser.lastLogin ? fmtDateTime(currentUser.lastLogin) : '—'],
                ['My audits', myAudits.length ? myAudits.map((a) => a.code).join(', ') : '—']
              ]} />
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>My Recent Activity</h3><span className="hint">last {myActivity.length} actions</span></div>
            <div className="card-pad">
              <div className="timeline">
                {myActivity.length === 0 && <span className="muted small">No recorded actions yet.</span>}
                {myActivity.map((a) => (
                  <div key={a.id} className="tl-item">
                    <span className="tl-dot" />
                    <div className="tl-title">{a.action}</div>
                    <div className="tl-meta">{a.details} · {fmtDateTime(a.timestamp)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>My Sign-in History</h3><span className="hint">with IP and device</span></div>
            <div className="card-pad">
              {myLogins.length === 0 && <span className="muted small">No sign-ins recorded yet.</span>}
              {myLogins.map((l) => (
                <div key={l.id} className="flex-between" style={{ padding: '7px 0', borderBottom: '1px dashed var(--border)' }}>
                  <span className="small">{fmtDateTime(l.timestamp)} · <span className="mono">{l.ip}</span></span>
                  <span className="flex" style={{ gap: 8 }}>
                    <span className="muted tiny">{l.browser} · {l.device}</span>
                    <Badge kind={l.status}>{l.status}</Badge>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
