// Audits registry - searchable, filterable, sortable table of all engagements.
import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { navigate, getQuery } from '../lib/router'
import { Badge, DataTable, PageHead, Progress, TypeBadge, StatCard } from '../components/ui'
import { fmtDate, daysFromNow, fmtINRCompact } from '../lib/utils'
import { suggestedProgress } from '../lib/ai'

export default function Audits() {
  const { data } = useData()
  const q0 = getQuery()
  const [statusF, setStatusF] = useState(q0.get('status') || 'all')
  const [typeF, setTypeF] = useState(q0.get('type') || 'all')
  const [deptF, setDeptF] = useState('all')

  const deptName = (id) => (data.departments.find((d) => d.id === id) || {}).name || '—'

  const rows = useMemo(
    () =>
      data.audits
        .filter((a) => statusF === 'all' || a.status === statusF)
        .filter((a) => typeF === 'all' || a.type === typeF)
        .filter((a) => deptF === 'all' || a.departmentId === deptF),
    [data.audits, statusF, typeF, deptF]
  )

  const counts = useMemo(() => ({
    inProgress: data.audits.filter((a) => a.status === 'In Progress').length,
    review: data.audits.filter((a) => a.status === 'Under Review').length,
    upcoming: data.audits.filter((a) => ['Planned', 'Scheduled'].includes(a.status)).length,
    completed: data.audits.filter((a) => ['Completed', 'Closed'].includes(a.status)).length
  }), [data.audits])

  const columns = [
    {
      key: 'code', label: 'Audit', sortable: true,
      render: (a) => (
        <div>
          <div className="cell-strong">{a.code}</div>
          <div className="cell-sub ellipsis" style={{ maxWidth: 300 }} title={a.title}>{a.title}</div>
        </div>
      )
    },
    { key: 'type', label: 'Type', sortable: true, render: (a) => <TypeBadge t={a.type} /> },
    {
      key: 'department', label: 'Department', sortable: true, sort: (a) => deptName(a.departmentId),
      render: (a) => <span style={{ color: 'var(--text-2)' }}>{deptName(a.departmentId)}</span>
    },
    { key: 'leadAuditorName', label: 'Lead', sortable: true, render: (a) => a.leadAuditorName || <span className="muted">Unassigned</span> },
    {
      key: 'progress', label: 'Progress', num: true, sortable: true, sort: (a) => suggestedProgress(a),
      render: (a) => {
        const p = suggestedProgress(a)
        return (
          <div className="flex" style={{ gap: 7 }}>
            <Progress value={p} className={p >= 80 ? 'success' : p >= 40 ? 'warning' : 'bad'} />
            <span className="small bold num">{p}%</span>
          </div>
        )
      }
    },
    { key: 'status', label: 'Status', sortable: true, render: (a) => <Badge kind={a.status}>{a.status}</Badge> },
    {
      key: 'endDate', label: 'Ends', sortable: true, sort: (a) => a.endDate,
      render: (a) => {
        const d = daysFromNow(a.endDate)
        return (
          <span className="nowrap">
            {fmtDate(a.endDate)}
            {['In Progress', 'Under Review'].includes(a.status) && d < 0 && <span className="badge danger" style={{ marginLeft: 6 }}>late</span>}
          </span>
        )
      }
    },
    { key: 'allocatedBudget', label: 'Budget', num: true, sortable: true, render: (a) => <span className="num">{fmtINRCompact(a.allocatedBudget)}</span> }
  ]

  return (
    <div>
      <PageHead
        title="Audits"
        sub={`${data.audits.length} engagements in the registry · FY ${data.audits[0] ? data.audits[0].fiscalYear : ''}`}
        actions={<button className="btn btn-secondary" onClick={() => navigate('/planning?tab=plan')}>Open in Planning</button>}
      />
      <div className="grid grid-4 mb-3">
        <StatCard label="In Progress" value={counts.inProgress} strip="#d97706" onClick={() => setStatusF('In Progress')} foot="field work ongoing" />
        <StatCard label="Under Review" value={counts.review} strip="#8b53ac" onClick={() => setStatusF('Under Review')} foot="awaiting approval" />
        <StatCard label="Upcoming" value={counts.upcoming} strip="#0488fb" onClick={() => setStatusF('Planned')} foot="planned & scheduled" />
        <StatCard label="Completed" value={counts.completed} strip="#0f9d6e" onClick={() => setStatusF('Completed')} foot="closed or issued" />
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        searchKeys={['code', 'title', 'leadAuditorName', (a) => deptName(a.departmentId)]}
        searchPlaceholder="Search audits by code, title, lead or department…"
        filters={[
          { value: statusF, onChange: setStatusF, options: [{ value: 'all', label: 'All statuses' }, ...['Planned', 'Scheduled', 'In Progress', 'Under Review', 'Completed', 'Closed'].map((s) => ({ value: s, label: s }))] },
          { value: typeF, onChange: setTypeF, options: [{ value: 'all', label: 'All types' }, ...['Financial', 'Performance', 'Compliance', 'IT', 'Forensic'].map((t) => ({ value: t, label: t }))] },
          { value: deptF, onChange: setDeptF, options: [{ value: 'all', label: 'All departments' }, ...data.departments.map((d) => ({ value: d.id, label: d.name }))] }
        ]}
        rowClick={(a) => navigate(`/audit/${a.id}`)}
        csvName="audits"
        emptyTitle="No audits match"
        emptySub="Adjust the filters, or create a new audit from Audit Planning."
      />
    </div>
  )
}
