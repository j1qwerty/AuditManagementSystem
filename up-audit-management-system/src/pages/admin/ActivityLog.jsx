// Activity log / audit trail (FR-004, FR-083): every action performed in the
// app is recorded here — filterable and exportable.
import { useMemo, useState } from 'react'
import { useData } from '../../context/DataContext'
import { Avatar, Badge, Empty, StatCard, Pagination } from '../../components/ui'
import { fmtDateTime, fmtRelative } from '../../lib/utils'
import { exportCSV } from '../../lib/exporters'
import config from '../../lib/config'

export default function ActivityLog() {
  const { data, toast } = useData()
  const [q, setQ] = useState('')
  const [fUser, setFUser] = useState('All')
  const [page, setPage] = useState(1)
  const pageSize = config.pageSize * 2

  const rows = useMemo(
    () =>
      data.activity
        .filter((a) => (fUser === 'All' ? true : a.userId === fUser))
        .filter((a) => (a.userName + a.action + a.details + a.entityType).toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    [data.activity, q, fUser]
  )
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const curPage = Math.min(page, pages)
  const paged = rows.slice((curPage - 1) * pageSize, curPage * pageSize)

  const doExport = () => {
    exportCSV('activity-log', rows.map((a) => ({
      Timestamp: fmtDateTime(a.timestamp), User: a.userName, Action: a.action,
      Entity: a.entityType, Details: a.details, Location: a.location
    })))
    toast('Activity log exported (Excel/CSV).')
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Activity Log</h1>
          <div className="sub">Complete audit trail of user actions — every create, update, approval and export is recorded automatically (FR-004).</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={doExport}>⤓ Export</button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Total events" value={data.activity.length} icon="🕘" accent />
        <StatCard label="Today" value={data.activity.filter((a) => new Date(a.timestamp).toDateString() === new Date().toDateString()).length} icon="◎" />
        <StatCard label="Active users (7 days)" value={new Set(data.activity.filter((a) => Date.now() - new Date(a.timestamp) < 7 * 86400000).map((a) => a.userId)).size} icon="◍" />
        <StatCard label="Records retained" value="Unlimited (demo)" icon="▤" />
      </div>

      <div className="filter-bar">
        <input className="input search" placeholder="Search action, user, details…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        <select className="select" value={fUser} onChange={(e) => setFUser(e.target.value)}>
          <option value="All">All users</option>
          {data.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <span className="muted small">{rows.length} events</span>
      </div>

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? (
            <div className="card-body"><Empty icon="🕘" title="No activity recorded yet" sub="Actions you take in the app will appear here instantly." /></div>
          ) : (
            <table className="tbl">
              <thead><tr><th>User</th><th>Action</th><th>Entity</th><th>Details</th><th>When</th></tr></thead>
              <tbody>
                {paged.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="flex">
                        <Avatar name={a.userName} color={(data.users.find((u) => u.id === a.userId) || {}).avatarColor} />
                        <div className="strong">{a.userName}</div>
                      </div>
                    </td>
                    <td><Badge kind="Active">{a.action}</Badge></td>
                    <td className="small">{a.entityType}</td>
                    <td className="small muted" style={{ maxWidth: 420 }}>{a.details}</td>
                    <td className="small">{fmtDateTime(a.timestamp)}<div className="sub">{fmtRelative(a.timestamp)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '0 14px 12px' }}>
          <Pagination page={curPage} pages={pages} onPage={setPage} total={rows.length} pageSize={pageSize} />
        </div>
      </div>
    </div>
  )
}
