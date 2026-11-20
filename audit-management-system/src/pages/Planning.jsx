// Audit Planning - annual plan, calendar, risk-based selection, resources.
import { useMemo, useState, useEffect } from 'react'
import { useData } from '../context/DataContext'
import { navigate, getQuery } from '../lib/router'
import {
  Badge, DataTable, PageHead, Modal, TypeBadge, Progress, StatCard, Empty,
  UserPicker, InfoTip, Tabs, Avatar, ConfirmDialog
} from '../components/ui'
import { fmtDate, fmtINR, uid, daysBetween } from '../lib/utils'
import { computeDepartmentRisk } from '../lib/ai'
import config from '../lib/config'

const TYPES = ['Financial', 'Performance', 'Compliance', 'IT', 'Forensic']
const TYPE_PREFIX = { Financial: 'FA', Performance: 'PA', Compliance: 'CA', IT: 'IA', Forensic: 'FoA' }
const STATUSES = ['Planned', 'Scheduled', 'In Progress', 'Under Review', 'Completed', 'Closed']

export default function Planning() {
  const { data, save, remove, currentUser, notify, logActivity, toast, can } = useData()
  const [tab, setTab] = useState(getQuery().get('tab') || 'plan')
  const [editing, setEditing] = useState(null)   // audit object or {new:true}
  const [confirmDel, setConfirmDel] = useState(null)

  const caoIds = data.users.filter((u) => u.role === 'cao').map((u) => u.id)
  const directorIds = data.users.filter((u) => u.role === 'director').map((u) => u.id)

  const createAudit = async (form) => {
    const seq = data.audits.length + 1
    const dept = data.departments.find((d) => d.id === form.departmentId)
    const lead = data.users.find((u) => u.id === form.leadAuditorId)
    const team = form.teamIds.map((tid, i) => {
      const u = data.users.find((x) => x.id === tid)
      return { userId: tid, name: u ? u.name : tid, role: i === 0 ? 'Co-lead' : 'Auditor' }
    })
    const rec = {
      id: uid('a'),
      code: `${TYPE_PREFIX[form.type]}-${new Date().getFullYear()}-${String(seq).padStart(3, '0')}`,
      title: form.title, type: form.type,
      departmentId: form.departmentId, departmentName: dept ? dept.name : '',
      fiscalYear: config.fiscalYear, status: 'Planned', priority: form.priority,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(new Date(form.startDate).getTime() + form.duration * 86400000).toISOString(),
      auditPeriod: form.auditPeriod || 'As per audit programme',
      leadAuditorId: form.leadAuditorId || null,
      leadAuditorName: lead ? lead.name : null,
      team, allocatedBudget: (Number(form.budgetLakh) || 0) * 100000,
      estimatedDays: Number(form.duration) || 30,
      objectives: form.objectives || '', scope: form.scope || '',
      riskScore: form.riskScore || 50, progress: 0,
      checklist: [], evidence: [], workpapers: [], comments: [], reviewHistory: [],
      timeline: [{ date: new Date().toISOString(), event: `Audit entry created in the annual plan by ${currentUser.name}` }],
      createdAt: new Date().toISOString()
    }
    await save('audits', rec, { logAction: 'Created audit', logDetail: `${rec.code} — ${rec.title}` })
    const targets = [...(form.leadAuditorId ? [form.leadAuditorId] : []), ...form.teamIds, ...caoIds, ...directorIds].filter((x) => x !== currentUser.id)
    await notify(targets, 'Assignment', `New audit planned — ${rec.code}`, rec.title, `#/audit/${rec.id}`)
    setEditing(null)
    toast('Audit added to the annual plan')
  }

  const updateAudit = async (form) => {
    const a = data.audits.find((x) => x.id === editing.id)
    const lead = data.users.find((u) => u.id === form.leadAuditorId)
    const team = form.teamIds.map((tid, i) => {
      const u = data.users.find((x) => x.id === tid)
      return { userId: tid, name: u ? u.name : tid, role: i === 0 ? 'Co-lead' : 'Auditor' }
    })
    const updated = {
      ...a,
      title: form.title, type: form.type, departmentId: form.departmentId,
      departmentName: (data.departments.find((d) => d.id === form.departmentId) || {}).name || '',
      priority: form.priority,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(new Date(form.startDate).getTime() + form.duration * 86400000).toISOString(),
      leadAuditorId: form.leadAuditorId || null, leadAuditorName: lead ? lead.name : null,
      team, allocatedBudget: (Number(form.budgetLakh) || 0) * 100000,
      estimatedDays: Number(form.duration) || 30,
      objectives: form.objectives || a.objectives, scope: form.scope || a.scope,
      timeline: [...(a.timeline || []), { date: new Date().toISOString(), event: `Audit plan updated by ${currentUser.name}` }]
    }
    await save('audits', updated, { logAction: 'Updated audit plan', logDetail: `${a.code} — ${updated.title}` })
    setEditing(null)
    toast('Audit plan updated')
  }

  const deleteAudit = async () => {
    const a = confirmDel
    await remove('audits', a.id, { logAction: 'Deleted audit', logDetail: `${a.code} — ${a.title}` })
    setConfirmDel(null)
    toast('Audit removed from the plan')
  }

  const tabs = [
    { key: 'plan', label: 'Annual Plan', count: data.audits.length },
    { key: 'calendar', label: 'Calendar' },
    { key: 'risk', label: 'Risk Assessment' },
    { key: 'resources', label: 'Resources' }
  ]

  return (
    <div>
      <PageHead
        title="Audit Planning"
        sub={`Annual plan FY ${config.fiscalYear} · risk-based selection, scheduling and resource allocation`}
        actions={can('planning.manage') ? <button className="btn btn-primary" onClick={() => setEditing({ new: true })}>+ Plan New Audit</button> : null}
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'plan' && (
        <PlanTable
          data={data} canManage={can('planning.manage')}
          onEdit={(a) => setEditing(a)} onDelete={(a) => setConfirmDel(a)}
        />
      )}
      {tab === 'calendar' && <CalendarTab data={data} />}
      {tab === 'risk' && <RiskTab data={data} canRecalc={can('risk.recalculate')} logActivity={logActivity} toast={toast} />}
      {tab === 'resources' && <ResourcesTab data={data} />}

      {editing && (
        <AuditFormModal
          audit={editing.new ? null : editing}
          data={data}
          onClose={() => setEditing(null)}
          onSave={(form) => (editing.new ? createAudit(form) : updateAudit(form))}
        />
      )}
      <ConfirmDialog
        open={!!confirmDel} onClose={() => setConfirmDel(null)}
        title="Remove audit" danger confirmLabel="Remove"
        message={`Remove ${confirmDel ? confirmDel.code : ''} from the annual plan? Linked findings and observations remain in the registry.`}
        onConfirm={deleteAudit}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ plan table */
function PlanTable({ data, canManage, onEdit, onDelete }) {
  const [statusF, setStatusF] = useState('all')
  const [typeF, setTypeF] = useState('all')
  const [deptF, setDeptF] = useState('all')
  const deptName = (id) => (data.departments.find((d) => d.id === id) || {}).name || '—'

  const rows = data.audits
    .filter((a) => statusF === 'all' || a.status === statusF)
    .filter((a) => typeF === 'all' || a.type === typeF)
    .filter((a) => deptF === 'all' || a.departmentId === deptF)

  return (
    <DataTable
      rows={rows}
      columns={[
        {
          key: 'code', label: 'Audit', sortable: true,
          render: (a) => (
            <div style={{ maxWidth: 300 }}>
              <div className="cell-strong">{a.code}</div>
              <div className="cell-sub ellipsis" title={a.title}>{a.title}</div>
            </div>
          )
        },
        { key: 'type', label: 'Type', sortable: true, render: (a) => <TypeBadge t={a.type} /> },
        { key: 'departmentName', label: 'Department', sortable: true, sort: (a) => deptName(a.departmentId), render: (a) => deptName(a.departmentId) },
        { key: 'startDate', label: 'Window', sortable: true, sort: (a) => a.startDate, render: (a) => <span className="nowrap small">{fmtDate(a.startDate)} → {fmtDate(a.endDate)}</span> },
        { key: 'leadAuditorName', label: 'Lead', sortable: true, render: (a) => a.leadAuditorName || <span className="badge warning">assign</span> },
        { key: 'team', label: 'Team', sortable: false, render: (a) => <span className="small muted">{a.team.length ? `${a.team.length + (a.leadAuditorId ? 1 : 0)} members` : '—'}</span> },
        { key: 'priority', label: 'Priority', sortable: true, render: (a) => <Badge kind={a.priority}>{a.priority}</Badge> },
        { key: 'riskScore', label: 'Risk', num: true, sortable: true, render: (a) => <span className="bold num">{a.riskScore}</span> },
        { key: 'status', label: 'Status', sortable: true, render: (a) => <Badge kind={a.status}>{a.status}</Badge> },
        {
          key: '__actions', label: '', render: (a) => (
            <div className="row-actions">
              <button className="btn-icon" title="Open audit" onClick={() => navigate(`/audit/${a.id}`)}>↗</button>
              {canManage && <button className="btn-icon" title="Edit plan entry" onClick={() => onEdit(a)}>✎</button>}
              {canManage && <button className="btn-icon danger" title="Remove from plan" onClick={() => onDelete(a)}>🗑</button>}
            </div>
          )
        }
      ]}
      searchKeys={['code', 'title', 'leadAuditorName', (a) => deptName(a.departmentId)]}
      searchPlaceholder="Search the plan…"
      filters={[
        { value: statusF, onChange: setStatusF, options: [{ value: 'all', label: 'All statuses' }, ...STATUSES.map((s) => ({ value: s, label: s }))] },
        { value: typeF, onChange: setTypeF, options: [{ value: 'all', label: 'All types' }, ...TYPES.map((t) => ({ value: t, label: t }))] },
        { value: deptF, onChange: setDeptF, options: [{ value: 'all', label: 'All departments' }, ...data.departments.map((d) => ({ value: d.id, label: d.name }))] }
      ]}
      rowClick={(a) => navigate(`/audit/${a.id}`)}
      csvName="audit-plan"
      emptyTitle="No audits in the plan"
      emptySub="Plan a new audit to get started."
    />
  )
}

/* ------------------------------------------------------------------ calendar */
function CalendarTab({ data }) {
  const fyStart = Number(config.fiscalYear.split('-')[0])
  const quarters = [
    { label: 'Q1 · Apr–Jun', months: [3, 4, 5] },
    { label: 'Q2 · Jul–Sep', months: [6, 7, 8] },
    { label: 'Q3 · Oct–Dec', months: [9, 10, 11] },
    { label: 'Q4 · Jan–Mar', months: [0, 1, 2] }
  ]
  const typeColor = { Financial: '#8b53ac', Performance: '#0f9d6e', Compliance: '#d97706', IT: '#0488fb', Forensic: '#ff3381' }

  const inQuarter = (q) =>
    data.audits.filter((a) => {
      const m = new Date(a.startDate).getMonth()
      const y = new Date(a.startDate).getFullYear()
      if (q.months[0] === 3) return q.months.includes(m) && y === fyStart
      return q.months.includes(m) && y === fyStart + 1
    })

  return (
    <div className="grid grid-4">
      {quarters.map((q, qi) => (
        <div className="card" key={qi}>
          <div className="card-head"><h3>{q.label}</h3><span className="hint">{inQuarter(q).length} audits</span></div>
          <div className="card-pad flex-col" style={{ gap: 8 }}>
            {inQuarter(q).length === 0 && <div className="muted small center" style={{ padding: '14px 0' }}>No audits scheduled</div>}
            {inQuarter(q).map((a) => (
              <div
                key={a.id}
                className="card-pad card-hover clickable"
                style={{ padding: '8px 10px', borderLeft: `3px solid ${typeColor[a.type]}`, borderRadius: 8 }}
                onClick={() => navigate(`/audit/${a.id}`)}
                title={`${a.code} — open audit`}
              >
                <div className="bold tiny">{a.code}</div>
                <div className="small ellipsis" style={{ color: 'var(--text-2)' }} title={a.title}>{a.title}</div>
                <div className="muted tiny">{fmtDate(a.startDate)} → {fmtDate(a.endDate)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ risk */
function RiskTab({ data, canRecalc, logActivity, toast }) {
  const [recalced, setRecalced] = useState(0)
  const rows = useMemo(() => {
    return data.departments
      .map((d) => {
        const r = computeDepartmentRisk(d, { findings: data.findings, observations: data.observations, audits: data.audits })
        return { dept: d, ...r }
      })
      .sort((a, b) => b.score - a.score)
  }, [data, recalced])

  const ratingBadge = (r) => <span className={`badge ${r === 'Critical' ? 'danger' : r === 'High' ? 'warning' : r === 'Moderate' ? 'info' : 'success'}`}>{r}</span>

  return (
    <div>
      <div className="flex-between mb-2">
        <div className="muted small">Risk-based selection score per department — drives the next audit cycle. <InfoTip text="Scores combine unresolved critical findings, open compliance observations, time since the last audit and budget exposure. Higher score = higher audit priority." /></div>
        {canRecalc && (
          <button
            className="btn btn-secondary"
            onClick={async () => {
              setRecalced((x) => x + 1)
              await logActivity('Recalculated risk scores', 'System', 'risk', 'Department risk scores recomputed for all departments')
              toast('Risk scores recalculated for all departments')
            }}
          >
            ↻ Recalculate Scores
          </button>
        )}
      </div>
      <DataTable
        rows={rows}
        columns={[
          {
            key: 'name', label: 'Department', sortable: true, sort: (r) => r.dept.name,
            render: (r) => <div><div className="cell-strong">{r.dept.name}</div><div className="cell-sub">{r.dept.code} · {r.dept.headName}</div></div>
          },
          {
            key: 'score', label: 'Risk Score', num: true, sortable: true,
            render: (r) => (
              <div className="flex" style={{ gap: 8 }}>
                <span className="bold num" style={{ width: 26 }}>{r.score}</span>
                <Progress value={r.score} className={r.score >= 75 ? 'bad' : r.score >= 55 ? 'warning' : 'success'} style={undefined} />
              </div>
            )
          },
          { key: 'rating', label: 'Rating', sortable: true, render: (r) => ratingBadge(r.rating) },
          {
            key: 'top', label: 'Top Risk Factor', sortable: false,
            render: (r) => <span className="small muted">{r.factors[0].key} — {r.factors[0].detail}</span>
          },
          {
            key: 'audits', label: 'Audits', num: true, sortable: true,
            render: (r) => data.audits.filter((a) => a.departmentId === r.dept.id).length
          },
          {
            key: '__actions', label: '', render: (r) => (
              <div className="row-actions">
                <button className="btn-icon" title="Open department" onClick={() => navigate(`/department/${r.dept.id}`)}>↗</button>
              </div>
            )
          }
        ]}
        searchKeys={[(r) => r.dept.name, (r) => r.rating, (r) => r.dept.code]}
        searchPlaceholder="Search departments…"
        rowClick={(r) => navigate(`/department/${r.dept.id}`)}
        csvName="department-risk"
        emptyTitle="No departments"
      />
    </div>
  )
}

/* ------------------------------------------------------------------ resources */
function ResourcesTab({ data }) {
  const officers = useMemo(() => {
    return data.users
      .filter((u) => ['senior', 'junior'].includes(u.role) && u.status === 'Active')
      .map((u) => {
        const lead = data.audits.filter((a) => a.leadAuditorId === u.id && ['Planned', 'Scheduled', 'In Progress', 'Under Review'].includes(a.status))
        const member = data.audits.filter((a) => a.team.some((t) => t.userId === u.id) && ['Planned', 'Scheduled', 'In Progress', 'Under Review'].includes(a.status))
        const fieldDays = [...lead, ...member].reduce((s, a) => s + (a.estimatedDays || 0), 0)
        return { u, leadCount: lead.length, memberCount: member.length, total: lead.length + member.length, fieldDays }
      })
      .sort((a, b) => b.total - a.total)
  }, [data])

  const maxLoad = Math.max(...officers.map((o) => o.total), 1)

  return (
    <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
      <div className="card">
        <div className="card-head"><h3>Officer Workload</h3><span className="hint">active & upcoming engagements</span></div>
        <div className="card-pad">
          <div className="flex-col" style={{ gap: 11 }}>
            {officers.map((o) => (
              <div key={o.u.id} className="flex" style={{ gap: 11 }}>
                <Avatar name={o.u.name} color={o.u.avatarColor} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex-between">
                    <span className="small bold">{o.u.name}</span>
                    <span className="muted tiny">{o.leadCount} lead · {o.memberCount} team · ~{o.fieldDays} field days</span>
                  </div>
                  <div className="progress mt-1" style={{ height: 8 }}>
                    <div style={{ width: `${(o.total / maxLoad) * 100}%`, background: o.total >= 4 ? '#cc004e' : o.total >= 3 ? '#d97706' : '#8b53ac' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-col" style={{ gap: 16 }}>
        <div className="card card-pad">
          <div className="muted small bold">PLANNED COVERAGE</div>
          <div className="bold" style={{ fontSize: 24 }}>{data.departments.filter((d) => data.audits.some((a) => a.departmentId === d.id)).length} / {data.departments.length}</div>
          <div className="muted tiny mt-1">departments with at least one audit this cycle</div>
        </div>
        <div className="card card-pad">
          <div className="muted small bold">TOTAL PLANNED BUDGET</div>
          <div className="bold" style={{ fontSize: 24 }}>{fmtINR(data.audits.reduce((s, a) => s + (a.allocatedBudget || 0), 0))}</div>
          <div className="muted tiny mt-1">across {data.audits.length} engagements</div>
        </div>
        <div className="card card-pad">
          <div className="muted small bold">AVERAGE DURATION</div>
          <div className="bold" style={{ fontSize: 24 }}>
            {Math.round(data.audits.reduce((s, a) => s + daysBetween(a.startDate, a.endDate), 0) / Math.max(data.audits.length, 1))} days
          </div>
          <div className="muted tiny mt-1">per engagement window</div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ audit form */
function AuditFormModal({ audit, data, onClose, onSave }) {
  const isNew = !audit
  const [f, setF] = useState(() => ({
    title: audit ? audit.title : '',
    type: audit ? audit.type : 'Financial',
    departmentId: audit ? audit.departmentId : (data.departments[0] || {}).id || '',
    priority: audit ? audit.priority : 'Medium',
    startDate: audit ? String(audit.startDate).slice(0, 10) : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    duration: audit ? audit.estimatedDays : 45,
    leadAuditorId: audit ? audit.leadAuditorId : '',
    teamIds: audit ? audit.team.map((t) => t.userId) : [],
    budgetLakh: audit ? audit.allocatedBudget / 100000 : 8,
    objectives: audit ? audit.objectives : '',
    scope: audit ? audit.scope : '',
    riskScore: audit ? audit.riskScore : 50
  }))
  const [showTeamPicker, setShowTeamPicker] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  const loadTeam = (teamId) => {
    const team = data.teams.find((t) => t.id === teamId)
    if (!team) return
    set('leadAuditorId', team.leadId)
    set('teamIds', team.memberIds)
  }

  const seniors = data.users.filter((u) => ['senior'].includes(u.role) && u.status === 'Active')

  return (
    <Modal
      open onClose={onClose}
      title={isNew ? 'Plan New Audit' : `Edit Plan — ${audit.code}`}
      sub={isNew ? 'The audit enters the annual plan with status Planned' : 'Changes are tracked in the audit timeline'}
      size="lg"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!f.title.trim() || !f.departmentId} onClick={() => onSave(f)}>
            {isNew ? 'Add to Plan' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field span-all">
          <label>Audit title <span className="req">*</span></label>
          <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Financial Audit of Health & Family Welfare — FY expenditure" />
        </div>
        <div className="field">
          <label>Audit type</label>
          <select className="select" value={f.type} onChange={(e) => set('type', e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Department <span className="req">*</span></label>
          <select className="select" value={f.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
            {data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Priority</label>
          <select className="select" value={f.priority} onChange={(e) => set('priority', e.target.value)}>
            {['Low', 'Medium', 'High', 'Critical'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Start date</label>
          <input className="input" type="date" value={String(f.startDate).slice(0, 10)} onChange={(e) => set('startDate', e.target.value)} />
        </div>
        <div className="field">
          <label>Duration (field days)</label>
          <input className="input" type="number" min="5" max="180" value={f.duration} onChange={(e) => set('duration', e.target.value)} />
        </div>
        <div className="field">
          <label>Budget (₹ lakh)</label>
          <input className="input" type="number" min="0" step="0.1" value={f.budgetLakh} onChange={(e) => set('budgetLakh', e.target.value)} />
        </div>
        <div className="field">
          <label>Risk score (0–100)</label>
          <input className="input" type="number" min="0" max="100" value={f.riskScore} onChange={(e) => set('riskScore', e.target.value)} />
        </div>
        <div className="field">
          <label>Lead auditor</label>
          <select className="select" value={f.leadAuditorId} onChange={(e) => set('leadAuditorId', e.target.value)}>
            <option value="">Not assigned</option>
            {seniors.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.designation}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Load from team</label>
          <select className="select" value="" onChange={(e) => loadTeam(e.target.value)}>
            <option value="">Choose a saved team…</option>
            {data.teams.filter((t) => t.status === 'Active').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <span className="help">Sets the lead and members from a saved team.</span>
        </div>
        <div className="field span-all">
          <label>Team members ({f.teamIds.length} selected)</label>
          <div className="flex wrap" style={{ gap: 6, marginBottom: 6 }}>
            {f.teamIds.map((id) => {
              const u = data.users.find((x) => x.id === id)
              return <span key={id} className="chip active" onClick={() => set('teamIds', f.teamIds.filter((x) => x !== id))}>{u ? u.name : id} ✕</span>
            })}
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowTeamPicker(true)}>+ Choose members</button>
        </div>
        <div className="field span-all">
          <label>Objectives</label>
          <textarea className="textarea" value={f.objectives} onChange={(e) => set('objectives', e.target.value)} placeholder="What the audit aims to verify / evaluate…" />
        </div>
        <div className="field span-all">
          <label>Scope</label>
          <textarea className="textarea" value={f.scope} onChange={(e) => set('scope', e.target.value)} placeholder="Records, period, districts and sampling approach…" />
        </div>
      </div>

      <UserPicker
        open={showTeamPicker} onClose={() => setShowTeamPicker(false)}
        users={data.users.filter((u) => ['senior', 'junior', 'coordinator'].includes(u.role))}
        multi initialSelected={f.teamIds}
        title="Add team members"
        onDone={(ids) => set('teamIds', ids)}
      />
    </Modal>
  )
}
