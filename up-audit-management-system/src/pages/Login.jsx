// Login screen with demo accounts (one click = sign in) and a simulated
// government SSO button (FR-005). All credentials are demo-only.
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { navigate } from '../lib/router'
import config from '../lib/config'
import { Avatar } from '../components/ui'

const DEMO_ROLES = [
  ['admin', 'System Administrator'],
  ['director', 'Audit Director'],
  ['cao', 'Chief Audit Officer'],
  ['senior', 'Senior Audit Officer'],
  ['junior', 'Junior Audit Officer'],
  ['coordinator', 'Department Coordinator']
]

export default function Login() {
  const { login, loginWithSSO } = useAuth()
  const { data, ready, toast } = useData()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ssoBusy, setSsoBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await login(email, password)
    setBusy(false)
    if (res.ok) navigate('/dashboard')
    else setError(res.error)
  }

  const quickLogin = async (roleKey) => {
    const user = data.users.find((u) => u.role === roleKey)
    if (!user) { setError('Demo user not seeded yet.'); return }
    setBusy(true)
    const res = await login(user.email, config.demoPassword)
    setBusy(false)
    if (res.ok) { toast(`Signed in as ${user.name}`); navigate('/dashboard') }
    else setError(res.error)
  }

  const sso = async () => {
    setSsoBusy(true)
    const res = await loginWithSSO()
    setSsoBusy(false)
    if (res.ok) { toast(`Signed in via ${config.ssoProviderName} as ${res.user.name}`); navigate('/dashboard') }
  }

  return (
    <div className="login-wrap">
      <div className="login-left">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div className="logo" style={{ width: 44, height: 44, borderRadius: 10, background: '#1e463f', color: '#5eead4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>UP</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700 }}>{config.appName}</div>
            <div style={{ color: '#7fa39b', fontSize: 12.5 }}>{config.orgName} · {config.orgUnit}</div>
          </div>
        </div>
        <h1>One platform for the complete audit lifecycle of every department.</h1>
        <ul>
          <li><span className="tick">✓</span> Plan, schedule and track financial, performance, compliance, IT and forensic audits</li>
          <li><span className="tick">✓</span> Checklists, evidence, work-papers and review workflows for field teams</li>
          <li><span className="tick">✓</span> Findings registry with time-bound compliance tracking and escalation</li>
          <li><span className="tick">✓</span> AI-assisted risk scoring, anomaly screening and predictive compliance analytics</li>
          <li><span className="tick">✓</span> Role-based access for six stakeholder roles with a full activity trail</li>
        </ul>
        <div style={{ marginTop: 34, fontSize: 12, color: '#6d8f88' }}>
          Demo build · FY {config.fiscalYear} · All data stored locally in your browser (IndexedDB + localStorage)
        </div>
      </div>

      <div className="login-right">
        <div className="login-box">
          <h2 style={{ fontSize: 20 }}>Sign in</h2>
          <p className="muted small" style={{ marginBottom: 18 }}>Use a demo account below, or the password <b>{config.demoPassword}</b> with any listed email.</p>

          <form onSubmit={submit}>
            <div className="field">
              <label>Official email</label>
              <input className="input" type="email" placeholder="name@up.gov.in" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input className="input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <div className="callout warn" style={{ marginBottom: 12 }}>{error}</div>}
            <button className="btn btn-primary btn-block" disabled={busy || !ready}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {config.ssoEnabled && (
            <>
              <div className="flex" style={{ margin: '14px 0', color: 'var(--text-3)', fontSize: 12 }}>
                <hr className="divider" style={{ flex: 1, margin: 0 }} /> or <hr className="divider" style={{ flex: 1, margin: 0 }} />
              </div>
              <button className="btn btn-secondary btn-block" onClick={sso} disabled={ssoBusy || !ready}>
                {ssoBusy ? `Redirecting via ${config.ssoProviderName}…` : `Continue with ${config.ssoProviderName} (SSO)`}
              </button>
            </>
          )}

          <div style={{ marginTop: 20 }}>
            <div className="small" style={{ fontWeight: 700, color: 'var(--text-2)', marginBottom: 7 }}>Demo accounts — click to sign in</div>
            <div className="demo-accounts">
              {DEMO_ROLES.map(([key, label]) => {
                const u = data.users.find((x) => x.role === key)
                return (
                  <button key={key} className="demo-acc" onClick={() => quickLogin(key)} disabled={!ready} title={u ? u.email : ''}>
                    <div className="flex" style={{ gap: 7 }}>
                      <Avatar name={u ? u.name : '?'} color={u ? u.avatarColor : '#999'} />
                      <div>
                        <div className="r">{label}</div>
                        <div className="e">{u ? u.name : '…'}</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
