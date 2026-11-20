// Authentication context. The session lives in localStorage; user records live
// in IndexedDB (created by the seed). SSO is simulated for the demo (FR-005).
import { createContext, useContext, useEffect, useState } from 'react'
import ls from '../lib/storage'
import idb from '../lib/db'
import config from '../lib/config'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => ls.get('session'))
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    // session timeout (disabled when 0)
    if (session && config.sessionTimeoutMin > 0) {
      const age = Date.now() - new Date(session.loginAt).getTime()
      if (age > config.sessionTimeoutMin * 60000) {
        ls.remove('session')
        setSession(null)
      }
    }
    setBooted(true)
  }, [])

  const login = async (email, password) => {
    const users = await idb.getAll('users')
    const user = users.find((u) => u.email.toLowerCase() === String(email).toLowerCase().trim())
    if (!user) return { ok: false, error: 'No account found with this email.' }
    if (user.password !== password) return { ok: false, error: 'Incorrect password.' }
    if (user.status !== 'Active') return { ok: false, error: 'This account is deactivated.' }
    const s = { userId: user.id, loginAt: new Date().toISOString(), via: 'Password' }
    ls.set('session', s)
    setSession(s)
    await idb.put('users', { ...user, lastLogin: new Date().toISOString() })
    return { ok: true }
  }

  // Simulated government SSO (demo only - picks the demo Director account)
  const loginWithSSO = async () => {
    await new Promise((r) => setTimeout(r, 700))
    const users = await idb.getAll('users')
    const user = users.find((u) => u.role === 'director') || users[0]
    const s = { userId: user.id, loginAt: new Date().toISOString(), via: config.ssoProviderName }
    ls.set('session', s)
    setSession(s)
    await idb.put('users', { ...user, lastLogin: new Date().toISOString() })
    return { ok: true, user }
  }

  const logout = () => {
    ls.remove('session')
    setSession(null)
  }

  const value = { session, booted, login, loginWithSSO, logout, setSession }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
