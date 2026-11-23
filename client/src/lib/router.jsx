// Minimal hash-based router (no external dependency).
// Routes look like "#/audits/a1" -> path "/audits/a1".
import { useEffect, useState, useCallback } from 'react'

export function getPath() {
  const h = window.location.hash || ''
  return h.startsWith('#') ? h.slice(1) || '/' : '/'
}

// query params live in the hash, e.g. #/audits?status=In+Progress
export function getQuery() {
  const path = getPath()
  const qi = path.indexOf('?')
  return new URLSearchParams(qi >= 0 ? path.slice(qi + 1) : '')
}

export function useRoute() {
  const [path, setPath] = useState(getPath)
  useEffect(() => {
    const onChange = () => setPath(getPath())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return path
}

export function navigate(to) {
  const target = to.startsWith('#') ? to : '#' + (to.startsWith('/') ? to : '/' + to)
  if (window.location.hash === target) return
  window.location.hash = target
  window.scrollTo({ top: 0 })
}

export function useNavigate() {
  return useCallback((to) => navigate(to), [])
}

/* ==========================================================================
   App-wide back navigation
   Every route change pushes the page being left onto a history stack, so the
   topbar back button can walk back through the real visit order across all
   pages (not just within one feature).
   ========================================================================== */
const MAX_HISTORY = 60
let backStack = []
let suppressPush = false
let lastPath = typeof window !== 'undefined' ? getPath() : '/'
const navListeners = new Set()
const emitNav = () => navListeners.forEach((l) => l())

/* ==========================================================================
   Per-page UI state memory (active tab, scroll position…)
   Pages remember where the user last was, so pressing Back returns not just
   to the right page but to the right tab and scroll offset. Keyed by path
   without query string; entries live for the whole session.
   ========================================================================== */
const pageState = new Map()

function cleanPathOf(path) {
  return String(path || '').split('?')[0] || '/'
}

export function setPageState(path, patch) {
  const key = cleanPathOf(path)
  pageState.set(key, { ...(pageState.get(key) || {}), ...(patch || {}) })
}

export function getPageState(path) {
  return pageState.get(cleanPathOf(path)) || {}
}

export function clearPageState(path) {
  pageState.delete(cleanPathOf(path))
}

// Tab state with memory: picks up the last tab the user had open on this
// page. A ?tab=… query parameter (deep links from notifications) wins over
// the memory, which wins over the page default.
export function useTabMemory(defaultTab) {
  const path = useRoute()
  const [tab, setTab] = useState(() => {
    const q = getQuery().get('tab')
    if (q) return q
    const remembered = getPageState(getPath()).tab
    return remembered === undefined ? defaultTab : remembered
  })
  useEffect(() => {
    setPageState(path, { tab })
  }, [tab, path])
  return [tab, setTab]
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const next = getPath()
    const prev = lastPath
    lastPath = next
    if (suppressPush) {
      suppressPush = false
      emitNav()
      return
    }
    if (prev && next && prev !== next && prev !== '/' && prev !== '/login') {
      // remember where the user was on the page being left (scroll offset)
      setPageState(prev, { scroll: window.scrollY || 0 })
      if (backStack[backStack.length - 1] !== prev) {
        backStack.push(prev)
        if (backStack.length > MAX_HISTORY) backStack = backStack.slice(-MAX_HISTORY)
      }
    }
    emitNav()
  })
}

// Walk back to the previous page (repeated clicks keep going back).
// The destination's remembered tab and scroll offset are restored so Back
// lands exactly where the user left off.
export function goBack() {
  if (!backStack.length) return
  const target = backStack.pop()
  const restoreScroll = getPageState(target).scroll || 0
  suppressPush = true
  emitNav()
  if (getPath() === target) return
  navigate(target)
  // re-apply after the page (and its remembered tab) have rendered
  const apply = () => window.scrollTo({ top: restoreScroll })
  setTimeout(apply, 90)
  setTimeout(apply, 260)
}

// Prevent the next route change from pushing onto the back stack
// (used on login so the pre-logout page is not remembered for the new user).
export function suppressNextNavPush() {
  suppressPush = true
  // safety: never let the flag linger if no navigation follows
  setTimeout(() => { suppressPush = false }, 1000)
}

export function canGoBack() {
  return backStack.length > 0
}

export function backTarget() {
  return backStack.length ? backStack[backStack.length - 1] : null
}

export function resetNavHistory() {
  backStack = []
  emitNav()
}

// React binding: re-renders whenever the history stack changes.
export function useNavHistory() {
  const [, force] = useState(0)
  useEffect(() => {
    const sub = () => force((x) => x + 1)
    navListeners.add(sub)
    return () => navListeners.delete(sub)
  }, [])
  return { canBack: backStack.length > 0, target: backStack.length ? backStack[backStack.length - 1] : null, depth: backStack.length }
}

// Human title for any route (used by the topbar back button tooltip).
const ROUTE_TITLES = {
  '/dashboard': 'Dashboard', '/planning': 'Audit Planning', '/audits': 'Audits',
  '/findings': 'Findings Registry', '/compliance': 'Compliance Tracking',
  '/analytics': 'Analytics & Risk', '/reports': 'Reports', '/departments': 'Departments',
  '/teams': 'Teams', '/documents': 'Document Repository', '/messages': 'Messages',
  '/users': 'Users & Roles', '/activity': 'Activity Log', '/settings': 'Settings',
  '/profile': 'My Profile', '/guide': 'Project Guide', '/login': 'Sign In'
}
export function routeTitle(path) {
  if (!path) return ''
  const clean = path.split('?')[0]
  if (clean.startsWith('/audit/')) return 'Audit Workspace'
  if (clean.startsWith('/department/')) return 'Department Profile'
  return ROUTE_TITLES[clean] || clean
}

// "/audits/:id" matching -> { params, match: bool }
export function matchPath(pattern, path) {
  const pParts = pattern.split('/').filter(Boolean)
  const aParts = path.split('?')[0].split('/').filter(Boolean)
  if (pParts.length !== aParts.length) return null
  const params = {}
  for (let i = 0; i < pParts.length; i++) {
    if (pParts[i].startsWith(':')) params[pParts[i].slice(1)] = decodeURIComponent(aParts[i])
    else if (pParts[i] !== aParts[i]) return null
  }
  return params
}

export function Link({ to, children, className, onClick, title }) {
  return (
    <a
      href={'#' + (to.startsWith('/') ? to : '/' + to)}
      className={className}
      title={title}
      onClick={(e) => {
        if (onClick) onClick(e)
        window.scrollTo({ top: 0 })
      }}
    >
      {children}
    </a>
  )
}
