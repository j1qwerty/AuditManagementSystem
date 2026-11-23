// Authentication context. The session lives in localStorage; user records live
// in IndexedDB (created by the seed). Every login/logout is recorded in the
// loginEvents store (session tracking with IP, browser and device info).
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import ls from '../lib/storage'
import idb from '../lib/db'
import config from '../lib/config'
import { uid, stableIp } from '../lib/utils'
import { resetNavHistory, suppressNextNavPush } from '../lib/router'

const AuthContext = createContext(null)

function browserInfo() {
  const ua = navigator.userAgent
  let browser = 'Browser'
  if (ua.includes('Edg/')) browser = 'Edge ' + (ua.split('Edg/')[1] || '').split('.')[0]
  else if (ua.includes('Chrome/')) browser = 'Chrome ' + (ua.split('Chrome/')[1] || '').split('.')[0]
  else if (ua.includes('Firefox/')) browser = 'Firefox ' + (ua.split('Firefox/')[1] || '').split('.')[0]
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari'
  let os = 'Unknown OS'
  if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac OS')) os = 'macOS'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('Linux')) os = 'Linux'
  const device = /Mobi|Android/i.test(ua) ? 'Mobile' : 'Desktop'
  return { browser, os, device }
}

async function recordLoginEvent(user, via, status) {
  const info = browserInfo()
  const entry = {
    id: uid('le'),
    userId: user.id,
    userName: user.name,
    timestamp: new Date().toISOString(),
    ip: stableIp(user.id + '|' + new Date().toDateString()),
    ...info,
    via,
    status
  }
  try { await idb.put('loginEvents', entry) } catch (e) { /* non-blocking */ }
  return entry
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => ls.get('session'))
  const [booted, setBooted] = useState(false)
  // One-line message shown on the sign-in screen after a session was ended
  // involuntarily (database reset, account removed, timeout).
  const [sessionNotice, setSessionNotice] = useState(null)

  // Clear an unusable session and land the user on the sign-in page with an
  // explanation instead of a dead-end screen. Used for timed-out sessions and
  // for sessions whose account no longer exists after a database reset.
  const invalidateSession = useCallback((notice) => {
    ls.remove('session')
    resetNavHistory()
    suppressNextNavPush()
    setSession(null)
    setSessionNotice(notice || null)
  }, [])

  const clearSessionNotice = useCallback(() => setSessionNotice(null), [])

  useEffect(() => {
    // session timeout (disabled when 0)
    if (session && config.sessionTimeoutMin > 0) {
      const age = Date.now() - new Date(session.loginAt).getTime()
      if (age > config.sessionTimeoutMin * 60000) {
        invalidateSession('Your session has timed out. Please sign in again.')
      }
    }
    setBooted(true)
  }, [])

  const login = async (email, password) => {
    const users = await idb.getAll('users')
    const user = users.find((u) => u.email.toLowerCase() === String(email).toLowerCase().trim())
    if (!user) {
      if (email) await recordLoginEvent({ id: 'unknown', name: email }, 'Password', 'Failed')
      return { ok: false, error: 'No account found with this email.' }
    }
    if (user.password !== password) {
      await recordLoginEvent(user, 'Password', 'Failed')
      return { ok: false, error: 'Incorrect password.' }
    }
    if (user.status !== 'Active') return { ok: false, error: 'This account is deactivated.' }
    const s = { userId: user.id, loginAt: new Date().toISOString(), via: 'Password', ip: stableIp(user.id + '|' + new Date().toDateString()) }
    ls.set('session', s)
    suppressNextNavPush()
    resetNavHistory()
    setSession(s)
    setSessionNotice(null)
    await idb.put('users', { ...user, lastLogin: new Date().toISOString() })
    await recordLoginEvent(user, 'Password', 'Success')
    return { ok: true }
  }

  // Office SSO (simulated - signs in with the Director account)
  const loginWithSSO = async () => {
    await new Promise((r) => setTimeout(r, 650))
    const users = await idb.getAll('users')
    const user = users.find((u) => u.role === 'director' && u.status === 'Active') || users.find((u) => u.status === 'Active') || users[0]
    if (!user) return { ok: false, error: 'No accounts are available yet. Reload the page to finish the workspace initialisation.' }
    const s = { userId: user.id, loginAt: new Date().toISOString(), via: config.ssoProviderName, ip: stableIp(user.id + '|' + new Date().toDateString()) }
    ls.set('session', s)
    suppressNextNavPush()
    resetNavHistory()
    setSession(s)
    setSessionNotice(null)
    await idb.put('users', { ...user, lastLogin: new Date().toISOString() })
    await recordLoginEvent(user, config.ssoProviderName, 'Success')
    return { ok: true, user }
  }

  const logout = () => {
    ls.remove('session')
    resetNavHistory()
    setSession(null)
    setSessionNotice(null)
  }

  const value = { session, booted, sessionNotice, clearSessionNotice, login, loginWithSSO, logout, setSession, invalidateSession }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
