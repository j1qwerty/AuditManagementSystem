// Activity Log - complete action trail with quick filters, activity
// categories, a reminders & escalations communication log, and a login-history
// view with IP / browser / device tracking.
import { useMemo, useState } from 'react'
import { useData } from '../../context/DataContext'
import { Badge, DataTable, PageHead, Tabs, StatCard, Empty, Modal, KV, Avatar, ExportMenu } from '../../components/ui'
import { CommsLogTable } from '../../components/comms'
import { fmtDate, fmtDateTime, fmtRelative, groupBy } from '../../lib/utils'
import { ROLES } from '../../lib/permissions'
import { useTabMemory } from '../../lib/router'

const QUICK_FILTERS = [
  { key: 'all', label: 'All Activity' },
  { key: 'audits', label: 'Audits' },
  { key: 'findings', label: 'Findings & Compliance' },
  { key: 'documents', label: 'Documents' },
  { key: 'messages', label: 'Messages' },
  { key: 'users', label: 'Users & Roles' },
  { key: 'system', label: 'System' }
]

const ENTITY_GROUP = {
  'Audit': 'audits', 'audits': 'audits',
  'Finding': 'findings', 'findings': 'findings',
  'Observation': 'findings', 'observations': 'findings',
  'Document': 'documents', 'documents': 'documents',
  'files': 'documents',
  'Message': 'messages', 'messages': 'messages',
  'User': 'users', 'users': 'users', 'rolePermissions': 'users', 'teams': 'users',
  'Team': 'users',
  'Report': 'system', 'reports': 'system', 'templates': 'system',
  'transactions': 'system', 'System': 'system'
}

export default function ActivityLog() {
  const { data } = useData()
  const [tab, setTab] = useTabMemory('all')
  const [commsKind, setCommsKind] = useState('all')
  const [quick, setQuick] = useState('all')
  const [userF, setUserF] = useState('all')
  const [dateF, setDateF] = useState('all')
  const [q, setQ] = useState('')
  const [view, setView] = useState(null)

  const loginRows = useMemo(
    () =>
      [...data.loginEvents]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .filter((l) => userF === 'all' || l.userId === userF)
        .filter((l) => dateF === 'all' || withinDate(l.timestamp, dateF))
        .filter((l) => !q || l.userName.toLowerCase().includes(q.toLowerCase()) || l.ip.includes(q) || l.browser.toLowerCase().includes(q.toLowerCase())),
    [data.loginEvents, userF, dateF, q]
  )

  const activityRows = useMemo(() => {
    return [...data.activity]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .filter((a) => quick === 'all' || ENTITY_GROUP[a.entityType] === quick)
      .filter((a) => userF === 'all' || a.userId === userF)
      .filter((a) => dateF === 'all' || withinDate(a.timestamp, dateF))
      .filter((a) => !q ||
        a.userName.toLowerCase().includes(q.toLowerCase()) ||
        a.action.toLowerCase().includes(q.toLowerCase()) ||
        (a.details || '').toLowerCase().includes(q.toLowerCase()) ||
        (a.entityType || '').toLowerCase().includes(q.toLowerCase()))
  }, [data.activity, quick, userF, dateF, q])

  const stats = useMemo(() => ({
    today: data.activity.filter((a) => new Date(a.timestamp).toDateString() === new Date().toDateString()).length,
    week: data.activity.filter((a) => Date.now() - new Date(a.timestamp) < 7 * 86400000).length,
    logins: data.loginEvents.length,
    failed: data.loginEvents.filter((l) => l.status === 'Failed').length,
    reminders: data.commsLogs.filter((l) => l.kind === 'Reminder').length,
    escalations: data.commsLogs.filter((l) => l.kind === 'Escalation').length
  }), [data])

  const grouped = useMemo(() => {
    const g = groupBy(activityRows, (a) => new Date(a.timestamp).toDateString())
    return Object.entries(g).sort((a, b) => new Date(b[0]) - new Date(a[0]))
  }, [activityRows])

  const actionBadge = (a) => {
    const kind = ENTITY_GROUP[a.entityType]
    const cls = { audits: 'purple', findings: 'rose', documents: 'info', messages: 'sky', users: 'warning', system: 'neutral' }[kind] || 'neutral'
    return <span className={`badge ${cls}`}>{a.entityType}</span>
  }

  return (
    <div>
      <PageHead
        title="Activity Log"
        sub="Every tracked action and sign-in across the platform, with user, time and network origin"
      />

      <div className="grid grid-4 mb-3">
        <StatCard label="Actions Today" value={stats.today} strip="#8b53ac" foot="recorded in the trail" />
        <StatCard label="Actions This Week" value={stats.week} strip="#0488fb" />
        <StatCard label="Reminders Sent" value={stats.reminders} strip="#d97706" onClick={() => { setTab('comms'); setCommsKind('Reminder') }} foot="manual + automatic" />
        <StatCard label="Escalations" value={stats.escalations} strip="#e0364f" onClick={() => { setTab('comms'); setCommsKind('Escalation') }} foot="manual + automatic" />
      </div>

      <Tabs
        tabs={[
          { key: 'all', label: 'Activity Trail', count: data.activity.length },
          { key: 'comms', label: 'Reminders & Escalations', count: data.commsLogs.length },
          { key: 'logins', label: 'Login History & Sessions', count: data.loginEvents.length }
        ]}
        active={tab} onChange={setTab}
      />

      {tab !== 'comms' && (
        <div className="table-toolbar" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none' }}>
          {tab === 'all' && (
          <div className="flex wrap" style={{ gap: 6 }}>
            {QUICK_FILTERS.map((f) => (
              <button key={f.key} className={`chip ${quick === f.key ? 'active' : ''}`} onClick={() => setQuick(f.key)}>
                {f.label}
                {f.key !== 'all' && <span className="c-count">{data.activity.filter((a) => ENTITY_GROUP[a.entityType] === f.key).length}</span>}
              </button>
            ))}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <input className="input" style={{ width: 210 }} placeholder="Search user, action, IP…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" style={{ width: 'auto' }} value={userF} onChange={(e) => setUserF(e.target.value)}>
          <option value="all">All users</option>
          {data.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className="select" style={{ width: 'auto' }} value={dateF} onChange={(e) => setDateF(e.target.value)}>
          <option value="all">Any time</option>
          <option value="today">Today</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>
        <ExportMenu
          label="Export View"
          title="Export the filtered activity trail — choose format"
          name="activity-trail"
          rows={activityRows.map((a) => ({ time: a.timestamp, user: a.userName, action: a.action, entity: `${a.entityType}/${a.entityId}`, details: a.details, remarks: a.remarks || '', location: a.location, ip: a.ip || '' }))}
        />
        </div>
      )}

      {tab === 'all' && (
        <div className="table-wrap" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
          {activityRows.length === 0 && <Empty icon="🕘" title="No activity matches" sub="Adjust the quick filters or search." />}
          {grouped.map(([day, list]) => (
            <div key={day}>
              <div className="table-toolbar" style={{ background: 'var(--surface-2)', cursor: 'default' }}>
                <span className="bold small">{fmtDate(day)}</span>
                <span className="muted tiny">{list.length} action{list.length > 1 ? 's' : ''}</span>
              </div>
              <table className="table">
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id} className="clickable" onClick={() => setView(a)}>
                      <td style={{ width: 40 }}>
                        <Avatar name={a.userName} color={(data.users.find((u) => u.id === a.userId) || {}).avatarColor} sm />
                      </td>
                      <td>
                        <div className="cell-strong small">{a.userName} — {a.action}</div>
                        <div className="cell-sub">{a.details}{a.remarks ? ` · “${a.remarks}”` : ''}</div>
                      </td>
                      <td style={{ width: 110 }}>{actionBadge(a)}</td>
                      <td style={{ width: 150 }}>
                        <div className="small">{a.location}</div>
                        <div className="cell-sub mono">{a.ip || ''}</div>
                      </td>
                      <td style={{ width: 120 }} className="right">
                        <div className="small nowrap" title={fmtDateTime(a.timestamp)}>{fmtRelative(a.timestamp)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {tab === 'comms' && (
        <CommsLogTable
          logs={data.commsLogs}
          users={data.users}
          audits={data.audits}
          csvName="reminders-escalations-log"
          pageSize={12}
          kindF={commsKind}
          onKindFChange={setCommsKind}
        />
      )}

      {tab === 'logins' && (
        <DataTable
          rows={loginRows}
          columns={[
            {
              key: 'userName', label: 'User', sortable: true,
              render: (l) => (
                <div className="flex" style={{ gap: 10 }}>
                  <Avatar name={l.userName} color={(data.users.find((u) => u.id === l.userId) || {}).avatarColor} sm />
                  <div>
                    <div className="cell-strong small">{l.userName}</div>
                    <div className="cell-sub">{(data.users.find((u) => u.id === l.userId) || {}).designation || ''}</div>
                  </div>
                </div>
              )
            },
            { key: 'status', label: 'Result', sortable: true, render: (l) => <Badge kind={l.status}>{l.status}</Badge> },
            { key: 'via', label: 'Method', sortable: true, render: (l) => <span className="small">{l.via}</span> },
            { key: 'ip', label: 'IP Address', sortable: true, render: (l) => <span className="mono small">{l.ip}</span> },
            { key: 'browser', label: 'Browser / OS', sortable: true, render: (l) => <span className="small nowrap">{l.browser} · {l.os}</span> },
            { key: 'device', label: 'Device', sortable: true, render: (l) => <span className="small">{l.device}</span> },
            { key: 'timestamp', label: 'Time', sortable: true, sort: (l) => l.timestamp, render: (l) => <span className="small nowrap" title={fmtDateTime(l.timestamp)}>{fmtRelative(l.timestamp)}</span> }
          ]}
          searchKeys={[]}
          filters={[]}
          csvName="login-history"
          emptyTitle="No sign-ins recorded"
          emptySub="Sign-in events appear here with IP and device details."
          pageSize={12}
          toolbarExtra={<span className="muted tiny">tracked with IP, browser and device</span>}
        />
      )}

      {/* detail modal */}
      <Modal open={!!view} onClose={() => setView(null)} title={view ? `${view.userName} — ${view.action}` : ''} sub={view ? fmtDateTime(view.timestamp) : ''}>
        {view && (
          <KV rows={[
            ['User', `${view.userName}${(data.users.find((u) => u.id === view.userId) || {}).role ? ` (${ROLES[(data.users.find((u) => u.id === view.userId) || {}).role].label})` : ''}`],
            ['Action', view.action],
            ['Entity', `${view.entityType} · ${view.entityId}`],
            ['Details', view.details],
            ['Remarks', view.remarks || '—'],
            ['Location', view.location],
            ['IP address', <span className="mono">{view.ip}</span>],
            ['Time', fmtDateTime(view.timestamp)]
          ]} />
        )}
      </Modal>
    </div>
  )
}

function withinDate(ts, range) {
  const t = new Date(ts).getTime()
  if (range === 'today') return new Date(ts).toDateString() === new Date().toDateString()
  return Date.now() - t < Number(range) * 86400000
}
