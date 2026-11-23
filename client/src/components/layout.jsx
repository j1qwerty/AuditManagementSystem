// App shell: sidebar (role-filtered navigation), topbar with global search,
// notifications (color-coded, click-through) and user menu.
import { useMemo, useState, useCallback } from 'react'
import { Link, navigate, useRoute, useNavHistory, goBack, routeTitle } from '../lib/router'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { canModule, ROLES } from '../lib/permissions'
import { Avatar, Badge, useClickOutside, ToastStack } from './ui'
import { fmtRelative } from '../lib/utils'
import config from '../lib/config'
import { Widget5Icon } from '@solar-icons/react/linear/widget-5'
import { CalendarDateIcon } from '@solar-icons/react/linear/calendar-date'
import { ClipboardListIcon } from '@solar-icons/react/linear/clipboard-list'
import { DangerTriangleIcon } from '@solar-icons/react/linear/danger-triangle'
import { ShieldCheckIcon } from '@solar-icons/react/linear/shield-check'
import { ChartIcon } from '@solar-icons/react/linear/chart'
import { DocumentTextIcon } from '@solar-icons/react/linear/document-text'
import { Buildings2Icon } from '@solar-icons/react/linear/buildings-2'
import { UsersGroupRoundedIcon } from '@solar-icons/react/linear/users-group-rounded'
import { DocumentsIcon } from '@solar-icons/react/linear/documents'
import { UsersGroupTwoRoundedIcon } from '@solar-icons/react/linear/users-group-two-rounded'
import { HistoryIcon } from '@solar-icons/react/linear/history'
import { SettingsIcon } from '@solar-icons/react/linear/settings'
import { QuestionCircleIcon } from '@solar-icons/react/linear/question-circle'
import { BellIcon } from '@solar-icons/react/linear/bell'
import { ChatRoundIcon } from '@solar-icons/react/linear/chat-round'
import { UserCircleIcon } from '@solar-icons/react/linear/user-circle'
import { LogoutIcon } from '@solar-icons/react/linear/logout'
import { ArrowLeftIcon } from '@solar-icons/react/linear/arrow-left'

const NAV = [
  { group: null, items: [{ key: 'dashboard', label: 'Dashboard', Icon: Widget5Icon, to: '/dashboard' }] },
  {
    group: 'Auditing',
    items: [
      { key: 'planning', label: 'Audit Planning', Icon: CalendarDateIcon, to: '/planning', module: 'planning' },
      { key: 'audits', label: 'Audits', Icon: ClipboardListIcon, to: '/audits' },
      { key: 'findings', label: 'Findings', Icon: DangerTriangleIcon, to: '/findings' },
      { key: 'compliance', label: 'Compliance', Icon: ShieldCheckIcon, to: '/compliance' }
    ]
  },
  {
    group: 'Insights',
    items: [
      { key: 'analytics', label: 'Analytics & Risk', Icon: ChartIcon, to: '/analytics', module: 'analytics' },
      { key: 'reports', label: 'Reports', Icon: DocumentTextIcon, to: '/reports' }
    ]
  },
  {
    group: 'Workspace',
    items: [
      { key: 'departments', label: 'Departments', Icon: Buildings2Icon, to: '/departments' },
      { key: 'teams', label: 'Teams', Icon: UsersGroupRoundedIcon, to: '/teams', module: 'teams' },
      { key: 'documents', label: 'Documents', Icon: DocumentsIcon, to: '/documents' }
    ]
  },
  {
    group: 'Administration',
    items: [
      { key: 'users', label: 'Users & Roles', Icon: UsersGroupTwoRoundedIcon, to: '/users', module: 'users' },
      { key: 'activity', label: 'Activity Log', Icon: HistoryIcon, to: '/activity', module: 'activity' },
      { key: 'settings', label: 'Settings', Icon: SettingsIcon, to: '/settings', module: 'settings' }
    ]
  },
  {
    group: 'Help',
    items: [
      { key: 'guide', label: 'Project Guide', Icon: QuestionCircleIcon, to: '/guide' }
    ]
  }
]

const PAGE_TITLES = {
  '/dashboard': 'Dashboard', '/planning': 'Audit Planning', '/audits': 'Audits',
  '/findings': 'Findings Registry', '/compliance': 'Compliance Tracking',
  '/analytics': 'Analytics & Risk', '/reports': 'Reports', '/departments': 'Departments',
  '/teams': 'Teams', '/documents': 'Document Repository', '/messages': 'Messages',
  '/users': 'Users & Roles', '/activity': 'Activity Log', '/settings': 'Settings',
  '/profile': 'My Profile', '/guide': 'Project Guide'
}

export function AppLayout({ children }) {
  const { currentUser, data, unreadCount, unreadThreads, markNotificationRead, markAllNotificationsRead, toasts } = useData()
  const { logout } = useAuth()
  const path = useRoute()
  const [notifOpen, setNotifOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [searchFocus, setSearchFocus] = useState(false)

  const notifRef = useClickOutside(() => setNotifOpen(false))
  const userRef = useClickOutside(() => setUserMenuOpen(false))
  const searchRef = useClickOutside(() => setSearchFocus(false))
  const { canBack, target } = useNavHistory()

  const activeModule = useMemo(() => '/' + path.split('/')[1], [path])

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
    return { openFindings, activeAudits, overdue, unreadMsg: unreadThreads.size }
  }, [data, unreadThreads])

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q || q.length < 2) return []
    const out = []
    data.audits.filter((a) => (a.title + a.code).toLowerCase().includes(q)).slice(0, 4)
      .forEach((a) => out.push({ type: 'Audit', label: `${a.code} — ${a.title}`, to: `/audit/${a.id}` }))
    data.departments.filter((d) => d.name.toLowerCase().includes(q)).slice(0, 3)
      .forEach((d) => out.push({ type: 'Department', label: d.name, to: `/department/${d.id}` }))
    data.findings.filter((f) => f.title.toLowerCase().includes(q)).slice(0, 3)
      .forEach((f) => out.push({ type: 'Finding', label: f.title, to: '/findings' }))
    data.teams.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 2)
      .forEach((t) => out.push({ type: 'Team', label: t.name, to: '/teams' }))
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
  const crumb = path.startsWith('/audit/')
    ? 'Audits / Audit Detail'
    : path.startsWith('/department/')
      ? 'Departments / Department Profile'
      : PAGE_TITLES[activeModule] || 'Audit Management'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo">A</div>
          <div>
            <div className="name">{config.appShortName} Platform</div>
            <div className="org">{config.orgUnit}</div>
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
                  const count = it.key === 'audits' ? counts.activeAudits : it.key === 'findings' ? counts.openFindings : it.key === 'compliance' ? (canModule(currentUser, 'compliance') ? counts.overdue : null) : it.key === 'messages' ? counts.unreadMsg : null
                  const Icon = it.Icon
                  return (
                    <Link key={it.key} to={it.to} className={`nav-item ${isActive ? 'active' : ''}`}>
                      <span className="ico"><Icon size={18} /></span>
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
          {config.orgName} · {config.orgUnit}
          <br />
          FY {config.fiscalYear} · v1.0
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button
            className="topbar-icon-btn back-nav"
            disabled={!canBack}
            onClick={goBack}
            title={canBack ? `Back to ${routeTitle(target)}` : 'No previous page yet'}
            aria-label="Go back"
          >
            <ArrowLeftIcon size={18} />
          </button>
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
              <BellIcon size={19} />
              {unreadCount > 0 && <span className="dot">{unreadCount}</span>}
            </button>
            {notifOpen && (
              <div className="dropdown" style={{ minWidth: 370 }}>
                <div className="dropdown-head">
                  Notifications
                  <button className="btn btn-ghost btn-sm" onClick={markAllNotificationsRead}>Mark all read</button>
                </div>
                <div className="dropdown-body">
                  {myNotifications.length === 0 && <div className="empty" style={{ padding: 24 }}><div className="t">No notifications</div></div>}
                  {myNotifications.map((n) => {
                    const unread = !(n.readBy || []).includes(currentUser.id)
                    return (
                      <div key={n.id} className="dropdown-item" onClick={() => onNotifClick(n)} style={{ padding: 0, overflow: 'hidden' }}>
                        <span className={`notif-type nt-${n.type}`} title={n.type} />
                        <div style={{ flex: 1, padding: '10px 14px 10px 10px' }}>
                          <div className="t" style={unread ? { color: 'var(--text)' } : { color: 'var(--text-2)' }}>{n.title}</div>
                          <div className="b">{n.body}</div>
                          {n.remarks && <div className="b" style={{ color: 'var(--thistle-700)', fontStyle: 'italic' }}>“{n.remarks}”</div>}
                          <div className="time">{n.type} · {fmtRelative(n.timestamp)}</div>
                        </div>
                        {unread && <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--thistle-500)', flexShrink: 0, marginTop: 5, marginRight: 10 }} />}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="dropdown-wrap">
            <button className="topbar-icon-btn" title="Messages" onClick={() => navigate('/messages')}>
              <ChatRoundIcon size={19} />
              {counts.unreadMsg > 0 && <span className="dot" style={{ background: 'var(--sky-500)' }}>{counts.unreadMsg}</span>}
            </button>
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
                <Link className="menu-item" to="/profile" onClick={() => setUserMenuOpen(false)}>
                  <UserCircleIcon size={16} /> My Profile
                </Link>
                {canModule(currentUser, 'guide') && (
                  <Link className="menu-item" to="/guide" onClick={() => setUserMenuOpen(false)}>
                    <QuestionCircleIcon size={16} /> Project Guide
                  </Link>
                )}
                <button className="menu-item" style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', fontWeight: 600 }} onClick={logout}>
                  <LogoutIcon size={16} /> Sign out
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
