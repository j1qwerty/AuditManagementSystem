// Authentication context. The session lives in localStorage; user records live
// in IndexedDB (created by the seed). Every login/logout is recorded in the
// loginEvents store (session tracking with IP, browser and device info).
import { createContext, useContext, useEffect, useState } from 'react'
import ls from '../lib/storage'
import idb from '../lib/db'
import config from '../lib/config'
import { uid, stableIp } from '../lib/utils'

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
    setSession(s)
    await idb.put('users', { ...user, lastLogin: new Date().toISOString() })
    await recordLoginEvent(user, 'Password', 'Success')
    return { ok: true }
  }

  // Office SSO (simulated - signs in with the Director account)
  const loginWithSSO = async () => {
    await new Promise((r) => setTimeout(r, 650))
    const users = await idb.getAll('users')
    const user = users.find((u) => u.role === 'director') || users[0]
    const s = { userId: user.id, loginAt: new Date().toISOString(), via: config.ssoProviderName, ip: stableIp(user.id + '|' + new Date().toDateString()) }
    ls.set('session', s)
    setSession(s)
    await idb.put('users', { ...user, lastLogin: new Date().toISOString() })
    await recordLoginEvent(user, config.ssoProviderName, 'Success')
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
