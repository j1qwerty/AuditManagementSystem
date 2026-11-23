// App root: providers (auth → data) and the hash router with auth + RBAC guards.
import { useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider, useData } from './context/DataContext'
import { useRoute, navigate, matchPath } from './lib/router'
import { canModule, ROLES } from './lib/permissions'
import config from './lib/config'
import { AppLayout } from './components/layout'
import { ToastStack, Empty } from './components/ui'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Departments, { DepartmentDetail } from './pages/Departments'
import Planning from './pages/Planning'
import Audits from './pages/Audits'
import AuditDetail from './pages/AuditDetail'
import Findings from './pages/Findings'
import Compliance from './pages/Compliance'
import Analytics from './pages/Analytics'
import Reports from './pages/Reports'
import Documents from './pages/Documents'
import Messages from './pages/Messages'
import Teams from './pages/Teams'
import Users from './pages/admin/Users'
import ActivityLog from './pages/admin/ActivityLog'
import Settings from './pages/admin/Settings'
import Profile from './pages/Profile'
import Guide from './pages/Guide'

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <Router />
      </DataProvider>
    </AuthProvider>
  )
}

const ROUTES = [
  { path: '/dashboard', module: 'dashboard', render: () => <Dashboard /> },
  { path: '/departments', module: 'departments', render: () => <Departments /> },
  { path: '/department/:id', module: 'departments', render: (p) => <DepartmentDetail id={p.id} /> },
  { path: '/planning', module: 'planning', render: () => <Planning /> },
  { path: '/audits', module: 'audits', render: () => <Audits /> },
  { path: '/audit/:id', module: 'audits', render: (p) => <AuditDetail id={p.id} /> },
  { path: '/findings', module: 'findings', render: () => <Findings /> },
  { path: '/compliance', render: () => <Compliance /> },
  { path: '/analytics', module: 'analytics', render: () => <Analytics /> },
  { path: '/reports', module: 'reports', render: () => <Reports /> },
  { path: '/documents', module: 'documents', render: () => <Documents /> },
  { path: '/messages', module: 'messages', render: () => <Messages /> },
  { path: '/teams', module: 'teams', render: () => <Teams /> },
  { path: '/users', module: 'users', render: () => <Users /> },
  { path: '/activity', module: 'activity', render: () => <ActivityLog /> },
  { path: '/settings', module: 'settings', render: () => <Settings /> },
  { path: '/profile', module: 'profile', render: () => <Profile /> },
  { path: '/guide', module: 'guide', render: () => <Guide /> }
]

function Router() {
  const path = useRoute()
  const { session, booted, invalidateSession } = useAuth()
  const { ready, currentUser, toasts, data } = useData()

  // default redirect
  useEffect(() => {
    if (path === '/' || path === '') {
      navigate(session ? '/dashboard' : '/login')
    }
    // a signed-in user never needs the sign-in screen
    if (path === '/login' && session && currentUser) navigate('/dashboard')
  }, [path, session, currentUser])

  // A session whose account no longer exists (the local database was reset,
  // or the user record was removed) is invalidated automatically: the user
  // lands on the real sign-in page with a notice instead of a dead-end screen.
  // If the workspace itself could not load any accounts, the sign-in page is
  // still shown (with a warning there) so the app never blocks on a database
  // problem - reload heals it.
  const workspaceLoaded = ready && (data.users.length > 0 || !config.seedDemoData)
  useEffect(() => {
    if (booted && ready && session && !currentUser && workspaceLoaded) {
      invalidateSession('Your session is no longer valid. Please sign in again.')
    }
  }, [booted, ready, session, currentUser, workspaceLoaded, invalidateSession])

  if (!booted || (session && !ready)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 14 }}>
        Preparing your workspace…
      </div>
    )
  }

  // The sign-in screen is always reachable - with a session whose account
  // cannot be resolved (stale or workspace without accounts) it stays the
  // landing view; the effect above turns a stale session into a notice.
  if (!session || !currentUser) {
    return (
      <>
        <Login />
        <ToastStack toasts={toasts} />
      </>
    )
  }

  // match route
  let matched = null
  let params = null
  for (const r of ROUTES) {
    const p = matchPath(r.path, path)
    if (p) { matched = r; params = p; break }
  }

  if (!matched) {
    return (
      <AppLayout>
        <Empty icon="?" title="Page not found" sub={`No route matches "${path}".`}>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Back to dashboard</button>
        </Empty>
      </AppLayout>
    )
  }

  // Routes without a module (e.g. /compliance, which restricts its own content
  // by role) are open to every signed-in user.
  if (matched.module && !canModule(currentUser, matched.module)) {
    return (
      <AppLayout>
        <Empty icon="⛨" title="Access denied" sub={`The ${ROLES[currentUser.role] ? ROLES[currentUser.role].label : currentUser.role} role does not have access to this module.`}>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Back to dashboard</button>
        </Empty>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      {matched.render(params || {})}
    </AppLayout>
  )
}
