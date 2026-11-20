// Sign-in screen: clean split layout - brand panel + sign-in card with quick
// role selection and office SSO.
import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { navigate } from '../lib/router'
import config from '../lib/config'
import { ROLES } from '../lib/permissions'
import { Avatar } from '../components/ui'

export default function Login() {
  const { login, loginWithSSO } = useAuth()
  const { data, toast } = useData()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ssoBusy, setSsoBusy] = useState(false)
  const [picked, setPicked] = useState(null)

  const accounts = useMemo(
    () =>
      Object.keys(ROLES)
        .map((role) => ({ role, user: data.users.find((u) => u.role === role && u.status === 'Active') }))
        .filter((x) => x.user),
    [data.users]
  )

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const res = await login(email, password)
    setBusy(false)
    if (res.ok) {
      toast('Signed in successfully')
      navigate('/dashboard')
    } else setError(res.error)
  }

  const quickLogin = async (acc) => {
    setPicked(acc.user.id)
    setError('')
    setBusy(true)
    const res = await login(acc.user.email, acc.user.password)
    setBusy(false)
    if (res.ok) {
      toast(`Signed in as ${acc.user.name}`)
      navigate('/dashboard')
    } else setError(res.error)
  }

  const sso = async () => {
    setSsoBusy(true)
    setError('')
    const res = await loginWithSSO()
    setSsoBusy(false)
    if (res.ok) {
      toast(`Signed in via ${config.ssoProviderName}`)
      navigate('/dashboard')
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-left">
        <div className="brand">
          <div className="logo">A</div>
          <div>
            <div className="n">{config.appName}</div>
            <div className="o">{config.orgUnit}</div>
          </div>
        </div>
        <div className="tagline">
          Plan, execute and track <b>every audit</b> — from field checklists to final reports.
        </div>
        <div className="foot">
          FY {config.fiscalYear} · {config.orgName}
        </div>
      </div>

      <div className="login-right">
        <div className="login-card">
          <h2>Sign in</h2>
          <div className="sub">Use your workspace account to continue</div>

          <form onSubmit={submit} className="flex-col" style={{ gap: 12 }}>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" placeholder="name@auditms.in" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label>Password</label>
              <input className="input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <div className="field"><span className="err">{error}</span></div>}
            <button className="btn btn-primary btn-lg" type="submit" disabled={busy || !email || !password}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {config.ssoEnabled && (
            <>
              <div className="flex mt-3 mb-3" style={{ gap: 12, color: 'var(--text-3)', fontSize: 11.5, fontWeight: 600 }}>
                <span style={{ flex: 1, borderTop: '1px solid var(--border-2)' }} />
                OR
                <span style={{ flex: 1, borderTop: '1px solid var(--border-2)' }} />
              </div>
              <button className="btn btn-secondary btn-lg" style={{ width: '100%' }} onClick={sso} disabled={ssoBusy}>
                {ssoBusy ? 'Connecting…' : `Continue with ${config.ssoProviderName}`}
              </button>
            </>
          )}

          <div className="mt-3" style={{ marginTop: 22 }}>
            <div className="muted small bold" style={{ marginBottom: 8 }}>Quick access by role</div>
            <div className="flex-col" style={{ gap: 7 }}>
              {accounts.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  className={`role-chip ${picked === acc.user.id ? 'selected' : ''}`}
                  onClick={() => quickLogin(acc)}
                  disabled={busy}
                >
                  <Avatar name={acc.user.name} color={acc.user.avatarColor} />
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div className="rc-name">{acc.user.name}</div>
                    <div className="rc-role">{ROLES[acc.role].label}</div>
                  </div>
                  <span className="muted">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
