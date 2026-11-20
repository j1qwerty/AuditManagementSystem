// App shell: sidebar (role-filtered navigation), topbar with global search,
// notifications (FR-051) and user menu.
import { useMemo, useState, useCallback } from 'react'
import { Link, navigate, useRoute } from '../lib/router'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { canModule, ROLES } from '../lib/permissions'
import { Avatar, Badge, useClickOutside, ToastStack, TypeBadge } from './ui'
import { fmtRelative } from '../lib/utils'
import config from '../lib/config'

const NAV = [
  { group: null, items: [{ key: 'dashboard', label: 'Dashboard', icon: '▦', to: '/dashboard' }] },
  {
    group: 'Auditing',
    items: [
      { key: 'planning', label: 'Audit Planning', icon: '▤', to: '/planning', module: 'planning' },
      { key: 'audits', label: 'Audits', icon: '☰', to: '/audits' },
      { key: 'findings', label: 'Findings', icon: '!', to: '/findings' },
      { key: 'compliance', label: 'Compliance Tracking', icon: '✓', to: '/compliance' }
    ]
  },
  {
    group: 'Insights',
    items: [
      { key: 'analytics', label: 'Analytics & Risk', icon: '◔', to: '/analytics', module: 'analytics' },
      { key: 'reports', label: 'Reports', icon: '▥', to: '/reports' }
    ]
  },
  {
    group: 'Organisation',
    items: [
      { key: 'departments', label: 'Departments', icon: '⌂', to: '/departments' },
      { key: 'documents', label: 'Documents', icon: '▤', to: '/documents' },
      { key: 'messages', label: 'Messages', icon: '✉', to: '/messages' }
    ]
  },
  {
    group: 'Administration',
    items: [
      { key: 'users', label: 'Users & Roles', icon: '◍', to: '/users', module: 'users' },
      { key: 'integrations', label: 'Integrations', icon: '⇄', to: '/integrations', module: 'integrations' },
      { key: 'activity', label: 'Activity Log', icon: '🕘', to: '/activity', module: 'activity' },
      { key: 'settings', label: 'Settings', icon: '⚙', to: '/settings', module: 'settings' }
    ]
  },
  {
    group: 'Help',
    items: [
      { key: 'profile', label: 'My Profile', icon: '◉', to: '/profile' },
      { key: 'guide', label: 'Demo Guide', icon: '?', to: '/guide' }
    ]
  }
]

const PAGE_TITLES = {
  '/dashboard': 'Dashboard', '/planning': 'Audit Planning', '/audits': 'Audits',
  '/findings': 'Findings Registry', '/compliance': 'Compliance Tracking',
  '/analytics': 'Analytics & Risk', '/reports': 'Reports', '/departments': 'Departments',
  '/documents': 'Document Repository', '/messages': 'Messages', '/users': 'Users & Roles',
  '/integrations': 'Integrations', '/activity': 'Activity Log', '/settings': 'Settings',
  '/profile': 'My Profile', '/guide': 'Demo Guide'
}

export function AppLayout({ children }) {
  const { currentUser, data, unreadCount, markNotificationRead, markAllNotificationsRead, toasts } = useData()
  const { logout } = useAuth()
  const path = useRoute()
  const [notifOpen, setNotifOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [searchFocus, setSearchFocus] = useState(false)

  const notifRef = useClickOutside(() => setNotifOpen(false))
  const userRef = useClickOutside(() => setUserMenuOpen(false))
  const searchRef = useClickOutside(() => setSearchFocus(false))

  const activeModule = useMemo(() => {
    const base = '/' + path.split('/')[1]
    return base
  }, [path])

  const myNotifications = useMemo(
    () =>
      currentUser
        ? data.notifications
            .filter((n) => n.userId === '*' || n.userId === currentUser.id)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 30)
        : [],
    [data.notifications, currentUser]
  )

  const counts = useMemo(() => {
    const openFindings = data.findings.filter((f) => !['Resolved', 'Closed'].includes(f.status)).length
    const activeAudits = data.audits.filter((a) => ['In Progress', 'Under Review'].includes(a.status)).length
    const overdue = data.observations.filter((o) => o.status !== 'Resolved' && new Date(o.dueDate) < new Date()).length
    const unreadMsgThreads = new Set(
      data.messages
        .filter((m) => m.from !== (currentUser && currentUser.id) && (m.to || []).includes(currentUser && currentUser.id) && !(m.readBy || []).includes(currentUser && currentUser.id))
        .map((m) => m.threadId)
    ).size
    return { openFindings, activeAudits, overdue, unreadMsgThreads }
  }, [data, currentUser])

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q || q.length < 2) return []
    const out = []
    data.audits.filter((a) => (a.title + a.code).toLowerCase().includes(q)).slice(0, 4)
      .forEach((a) => out.push({ type: 'Audit', label: `${a.code} — ${a.title}`, to: `/audit/${a.id}` }))
    data.departments.filter((d) => d.name.toLowerCase().includes(q)).slice(0, 3)
      .forEach((d) => out.push({ type: 'Department', label: d.name, to: `/department/${d.id}` }))
    data.findings.filter((f) => f.title.toLowerCase().includes(q)).slice(0, 3)
      .forEach((f) => out.push({ type: 'Finding', label: f.title, to: `/findings` }))
    data.users.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 3)
      .forEach((u) => out.push({ type: 'User', label: u.name, to: '/users' }))
    return out
  }, [search, data])

  const onNotifClick = useCallback(
    (n) => {
      markNotificationRead(n)
      setNotifOpen(false)
      if (n.link) navigate(n.link.replace('#', ''))
    },
    [markNotificationRead]
  )

  const role = currentUser ? ROLES[currentUser.role] : null
  const crumb = path.startsWith('/audit/') ? 'Audits / Audit Detail' : path.startsWith('/department/') ? 'Departments / Department Profile' : PAGE_TITLES[activeModule] || 'Audit Management'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo">UP</div>
          <div>
            <div className="name">{config.appShortName} Audit Platform</div>
            <div className="org">{config.orgName}</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((g, gi) => {
            const items = g.items.filter((it) => !it.module || canModule(currentUser, it.module))
            if (!items.length) return null
            return (
              <div key={gi}>
                {g.group && <div className="nav-group-label">{g.group}</div>}
                {items.map((it) => {
                  const isActive = activeModule === it.to || (it.to === '/audits' && path.startsWith('/audit/')) || (it.to === '/departments' && path.startsWith('/department/'))
                  const count = it.key === 'audits' ? counts.activeAudits : it.key === 'findings' ? counts.openFindings : it.key === 'compliance' ? counts.overdue : it.key === 'messages' ? counts.unreadMsgThreads : null
                  return (
                    <Link key={it.key} to={it.to} className={`nav-item ${isActive ? 'active' : ''}`}>
                      <span className="ico">{it.icon}</span>
                      <span>{it.label}</span>
                      {count > 0 && <span className="count">{count}</span>}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          {config.demoMode ? 'Demo build — all data is stored locally in this browser (IndexedDB + localStorage). Nothing leaves your machine.' : config.appName}
          <br />
          FY {config.fiscalYear} · v1.0 demo
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <span className="crumb">{crumb}</span>
          <div className="topbar-spacer" />

          <div className="dropdown-wrap" ref={searchRef} style={{ position: 'relative' }}>
            <input
              className="input"
              style={{ width: 250 }}
              placeholder="Search audits, departments, findings…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocus(true)}
            />
            {searchFocus && searchResults.length > 0 && (
              <div className="dropdown" style={{ left: 0, right: 'auto', minWidth: 340 }}>
                <div className="dropdown-head">Results</div>
                <div className="dropdown-body">
                  {searchResults.map((r, i) => (
                    <div key={i} className="dropdown-item" onClick={() => { navigate(r.to); setSearch(''); setSearchFocus(false) }}>
                      <div>
                        <div className="t">{r.label}</div>
                        <div className="b muted">{r.type}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="dropdown-wrap" ref={notifRef}>
            <button className="topbar-icon-btn" onClick={() => setNotifOpen((o) => !o)} title="Notifications">
              ✉
              {unreadCount > 0 && <span className="dot">{unreadCount}</span>}
            </button>
            {notifOpen && (
              <div className="dropdown" style={{ minWidth: 360 }}>
                <div className="dropdown-head">
                  Notifications
                  <button className="btn btn-ghost btn-sm" onClick={markAllNotificationsRead}>Mark all read</button>
                </div>
                <div className="dropdown-body">
                  {myNotifications.length === 0 && <div className="empty" style={{ padding: 24 }}><div className="t">No notifications</div></div>}
                  {myNotifications.map((n) => {
                    const unread = !(n.readBy || []).includes(currentUser.id)
                    return (
                      <div key={n.id} className="dropdown-item" onClick={() => onNotifClick(n)}>
                        <div style={{ flex: 1 }}>
                          <div className="t" style={unread ? { color: 'var(--text)' } : { color: 'var(--text-2)' }}>{n.title}</div>
                          <div className="b">{n.body}</div>
                          <div className="time">{n.type} · {fmtRelative(n.timestamp)}</div>
                        </div>
                        {unread && <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--primary)', flexShrink: 0, marginTop: 5 }} />}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="dropdown-wrap" ref={userRef}>
            <div className="user-chip" onClick={() => setUserMenuOpen((o) => !o)}>
              <div className="meta">
                <div className="n">{currentUser.name}</div>
                <div className="r">{role ? role.label : ''}</div>
              </div>
              <Avatar name={currentUser.name} color={currentUser.avatarColor} />
            </div>
            {userMenuOpen && (
              <div className="dropdown" style={{ minWidth: 210 }}>
                <div className="dropdown-head" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{currentUser.name}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 500 }}>{currentUser.email}</div>
                  <div style={{ marginTop: 3 }}><Badge kind={role ? role.label : ''}>{role ? role.label : ''}</Badge></div>
                </div>
                <Link className="menu-item" to="/profile" onClick={() => setUserMenuOpen(false)}>◉ My Profile</Link>
                <Link className="menu-item" to="/guide" onClick={() => setUserMenuOpen(false)}>? Demo Guide</Link>
                <button className="menu-item" style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', fontWeight: 600 }} onClick={logout}>
                  ⏻ Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="page-content">{children}</main>
      </div>
      <ToastStack toasts={toasts} />
    </div>
  )
}
