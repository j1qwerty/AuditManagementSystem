// App root: providers (auth → data) and the hash router with auth + RBAC guards.
import { useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider, useData } from './context/DataContext'
import { useRoute, navigate, matchPath } from './lib/router'
import { canModule, ROLES } from './lib/permissions'
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
import Users from './pages/admin/Users'
import Integrations from './pages/admin/Integrations'
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
  { path: '/compliance', module: 'compliance', render: () => <Compliance /> },
  { path: '/analytics', module: 'analytics', render: () => <Analytics /> },
  { path: '/reports', module: 'reports', render: () => <Reports /> },
  { path: '/documents', module: 'documents', render: () => <Documents /> },
  { path: '/messages', module: 'messages', render: () => <Messages /> },
  { path: '/users', module: 'users', render: () => <Users /> },
  { path: '/integrations', module: 'integrations', render: () => <Integrations /> },
  { path: '/activity', module: 'activity', render: () => <ActivityLog /> },
  { path: '/settings', module: 'settings', render: () => <Settings /> },
  { path: '/profile', module: 'profile', render: () => <Profile /> },
  { path: '/guide', module: 'guide', render: () => <Guide /> }
]

function Router() {
  const path = useRoute()
  const { session, booted } = useAuth()
  const { ready, currentUser, toasts } = useData()

  // default redirect
  useEffect(() => {
    if (path === '/' || path === '') {
      navigate(session ? '/dashboard' : '/login')
    }
  }, [path, session])

  if (!booted || (session && !ready)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 14 }}>
        Loading local database…
      </div>
    )
  }

  if (!session) {
    return (
      <>
        <Login />
        <ToastStack toasts={toasts} />
      </>
    )
  }

  if (!currentUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="empty">
          <div className="t">Session user not found</div>
          <div className="s">The local database was reset. Please sign in again.</div>
          <button className="btn btn-primary mt-2" onClick={() => navigate('/login')}>Go to login</button>
        </div>
      </div>
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
        <Empty icon="?" title="Page not found" sub={`No route matches “${path}”.`}>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Back to dashboard</button>
        </Empty>
      </AppLayout>
    )
  }

  if (!canModule(currentUser, matched.module)) {
    return (
      <AppLayout>
        <Empty icon="⛨" title="Access denied" sub={`The ${ROLES[currentUser.role] ? ROLES[currentUser.role].label : currentUser.role} role does not have access to this module (RBAC).`}>
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
