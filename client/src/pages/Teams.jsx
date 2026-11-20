// Teams - create, edit, deactivate and delete audit teams with member
// management via the people picker.
import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { Badge, DataTable, PageHead, Modal, ConfirmDialog, StatCard, UserPicker, Avatar, AvatarStack } from '../components/ui'
import { uid, fmtDate } from '../lib/utils'

const SPECIALISATIONS = ['Financial', 'Performance', 'Compliance', 'IT', 'Forensic', 'General']

export default function Teams() {
  const { data, save, remove, currentUser, notify, toast, can } = useData()
  const [editing, setEditing] = useState(null)   // team or {new:true}
  const [confirmDel, setConfirmDel] = useState(null)
  const [statusF, setStatusF] = useState('all')
  const [leadF, setLeadF] = useState('all')

  const memberCount = (t) => (t.memberIds || []).length + 1
  const userName = (id) => (data.users.find((u) => u.id === id) || {}).name || '—'

  const rows = useMemo(
    () =>
      data.teams
        .filter((t) => statusF === 'all' || t.status === statusF)
        .filter((t) => leadF === 'all' || t.leadId === leadF),
    [data.teams, statusF, leadF]
  )

  const saveTeam = async (form) => {
    const exists = !!form.id
    const rec = {
      id: exists ? form.id : uid('team'),
      name: form.name,
      leadId: form.leadId,
      leadName: userName(form.leadId),
      memberIds: form.memberIds,
      description: form.description,
      specialisation: form.specialisation,
      status: form.status,
      createdAt: exists ? (data.teams.find((t) => t.id === form.id) || {}).createdAt || new Date().toISOString() : new Date().toISOString()
    }
    await save('teams', rec, { logAction: exists ? 'Updated team' : 'Created team', logDetail: `${rec.name} (${memberCount(rec)} members)` })
    if (!exists) {
      await notify([form.leadId, ...form.memberIds], 'Assignment', `You were added to team "${rec.name}"`, rec.description || '', '#/teams')
    }
    setEditing(null)
    toast(exists ? 'Team updated' : 'Team created')
  }

  const toggleStatus = async (t) => {
    const status = t.status === 'Active' ? 'Inactive' : 'Active'
    await save('teams', { ...t, status }, { logAction: `Team marked ${status}`, logDetail: t.name })
    toast(`Team marked ${status}`)
  }

  const deleteTeam = async () => {
    await remove('teams', confirmDel.id, { logAction: 'Deleted team', logDetail: confirmDel.name })
    setConfirmDel(null)
    toast('Team deleted')
  }

  return (
    <div>
      <PageHead
        title="Teams"
        sub={`${data.teams.length} audit teams · reusable units that can be assigned to audits from the planning calendar`}
        actions={can('team.manage') ? <button className="btn btn-primary" onClick={() => setEditing({ new: true })}>+ Create Team</button> : null}
      />

      <div className="grid grid-4 mb-3">
        <StatCard label="All Teams" value={data.teams.length} strip="#8b53ac" onClick={() => setStatusF('all')} foot="created in the workspace" />
        <StatCard label="Active" value={data.teams.filter((t) => t.status === 'Active').length} strip="#0f9d6e" onClick={() => setStatusF('Active')} foot="available for assignment" />
        <StatCard label="Inactive" value={data.teams.filter((t) => t.status === 'Inactive').length} strip="#8d7f9a" onClick={() => setStatusF('Inactive')} foot="not assignable" />
        <StatCard label="People on Teams" value={new Set(data.teams.filter((t) => t.status === 'Active').flatMap((t) => [t.leadId, ...t.memberIds])).size} strip="#0488fb" foot="unique members" />
      </div>

      <DataTable
        rows={rows}
        columns={[
          {
            key: 'name', label: 'Team', sortable: true,
            render: (t) => (
              <div style={{ maxWidth: 260 }}>
                <div className="cell-strong">{t.name}</div>
                <div className="cell-sub ellipsis" title={t.description}>{t.description}</div>
              </div>
            )
          },
          { key: 'specialisation', label: 'Specialisation', sortable: true, render: (t) => <span className="tag">{t.specialisation}</span> },
          { key: 'leadName', label: 'Lead', sortable: true, render: (t) => <span className="small">{t.leadName}</span> },
          {
            key: 'members', label: 'Members', sortable: true, sort: (t) => memberCount(t),
            render: (t) => (
              <div className="flex" style={{ gap: 8 }}>
                <AvatarStack people={[{ name: t.leadName, color: (data.users.find((u) => u.id === t.leadId) || {}).avatarColor }, ...t.memberIds.map((id) => ({ name: userName(id), color: (data.users.find((u) => u.id === id) || {}).avatarColor }))]} />
                <span className="small muted" style={{ alignSelf: 'center' }}>{memberCount(t)}</span>
              </div>
            )
          },
          { key: 'status', label: 'Status', sortable: true, render: (t) => <Badge kind={t.status}>{t.status}</Badge> },
          { key: 'createdAt', label: 'Created', sortable: true, sort: (t) => t.createdAt, render: (t) => <span className="small nowrap">{fmtDate(t.createdAt)}</span> },
          {
            key: '__actions', label: '', render: (t) => (
              <div className="row-actions">
                {can('team.manage') && <button className="btn-icon" title={t.status === 'Active' ? 'Deactivate' : 'Activate'} onClick={() => toggleStatus(t)}>{t.status === 'Active' ? '⏸' : '▶'}</button>}
                {can('team.manage') && <button className="btn-icon" title="Edit team" onClick={() => setEditing(t)}>✎</button>}
                {can('team.manage') && <button className="btn-icon danger" title="Delete team" onClick={() => setConfirmDel(t)}>🗑</button>}
              </div>
            )
          }
        ]}
        searchKeys={['name', 'description', 'leadName', 'specialisation']}
        searchPlaceholder="Search teams…"
        filters={[
          { value: statusF, onChange: setStatusF, options: [{ value: 'all', label: 'All statuses' }, { value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }] },
          { value: leadF, onChange: setLeadF, options: [{ value: 'all', label: 'All leads' }, ...Array.from(new Set(data.teams.map((t) => t.leadId))).map((id) => ({ value: id, label: userName(id) }))] }
        ]}
        csvName="teams"
        emptyTitle="No teams yet"
        emptySub="Create a team to reuse member combinations across audits."
      />

      {editing && (
        <TeamModal
          team={editing.new ? null : editing}
          data={data}
          onClose={() => setEditing(null)}
          onSave={saveTeam}
        />
      )}
      <ConfirmDialog
        open={!!confirmDel} onClose={() => setConfirmDel(null)}
        title="Delete team" danger confirmLabel="Delete"
        message={`Delete "${confirmDel ? confirmDel.name : ''}"? Audits already assigned keep their member lists.`}
        onConfirm={deleteTeam}
      />
    </div>
  )
}

function TeamModal({ team, data, onClose, onSave }) {
  const isNew = !team
  const [f, setF] = useState(() => ({
    id: team ? team.id : null,
    name: team ? team.name : '',
    leadId: team ? team.leadId : '',
    memberIds: team ? team.memberIds : [],
    description: team ? team.description : '',
    specialisation: team ? team.specialisation : 'General',
    status: team ? team.status : 'Active'
  }))
  const [showPicker, setShowPicker] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const userName = (id) => (data.users.find((u) => u.id === id) || {}).name

  return (
    <Modal
      open onClose={onClose}
      title={isNew ? 'Create Team' : `Edit Team — ${team.name}`}
      sub="Teams can be loaded directly when planning an audit"
      size="md"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!f.name.trim() || !f.leadId} onClick={() => onSave(f)}>
            {isNew ? 'Create Team' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field span-all">
          <label>Team name <span className="req">*</span></label>
          <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Financial Audit Team A" />
        </div>
        <div className="field">
          <label>Team lead <span className="req">*</span></label>
          <select className="select" value={f.leadId} onChange={(e) => set('leadId', e.target.value)}>
            <option value="">Choose lead…</option>
            {data.users.filter((u) => ['senior', 'cao'].includes(u.role) && u.status === 'Active').map((u) => (
              <option key={u.id} value={u.id}>{u.name} — {u.designation}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Specialisation</label>
          <select className="select" value={f.specialisation} onChange={(e) => set('specialisation', e.target.value)}>
            {SPECIALISATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <select className="select" value={f.status} onChange={(e) => set('status', e.target.value)}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <div className="field span-all">
          <label>Members ({f.memberIds.length} selected)</label>
          <div className="flex wrap" style={{ gap: 6, marginBottom: 6 }}>
            {f.memberIds.map((id) => (
              <span key={id} className="chip active" onClick={() => set('memberIds', f.memberIds.filter((x) => x !== id))}>
                {userName(id)} ✕
              </span>
            ))}
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPicker(true)}>+ Choose members</button>
        </div>
        <div className="field span-all">
          <label>Description</label>
          <textarea className="textarea" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="What this team handles…" />
        </div>
      </div>

      <UserPicker
        open={showPicker} onClose={() => setShowPicker(false)}
        users={data.users.filter((u) => ['senior', 'junior', 'coordinator'].includes(u.role))}
        multi initialSelected={f.memberIds}
        title="Add team members"
        onDone={(ids) => set('memberIds', ids)}
      />
    </Modal>
  )
}
