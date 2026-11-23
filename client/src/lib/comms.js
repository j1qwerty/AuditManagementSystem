// Communication layer for manual & automatic reminders and escalations.
// Every reminder / escalation goes through dispatchComms() which:
//   1. writes a record to the commsLogs store (what, when, to whom, remark)
//   2. sends colour-coded notifications with details + click-through links
//   3. (optionally) simulates emails to coordinators among the recipients
// Visibility of log entries is role/ team based - see visibleCommsLogs().
import { ROLES, ROLE_LEVEL, roleRelation } from './permissions'
import { uid, todayISO } from './utils'

// Roles that oversee the whole function and can read every log entry.
export const COMMS_OVERSIGHT_ROLES = ['admin', 'director', 'cao']

// ---------------------------------------------------------------------------
// Recipient groups - built from the perspective of the logged-in user.
// Groups: audit team, department coordinator, roles above / same level /
// roles below. The modal lets the user pick any combination.
// ---------------------------------------------------------------------------
const REL_HINT = {
  above: 'Above your level',
  same: 'Same level as you',
  below: 'Below your level'
}

export function buildRecipientGroups(currentUser, users, audit, coordinatorId) {
  const groups = []
  if (!currentUser) return groups
  const active = users.filter((u) => u.status === 'Active')
  const self = currentUser.id

  // 1. audit team (lead + members), never the sender
  if (audit) {
    const teamIds = Array.from(
      new Set([...(audit.leadAuditorId ? [audit.leadAuditorId] : []), ...((audit.team || []).map((t) => t.userId))].filter((id) => id && id !== self))
    )
    if (teamIds.length) {
      groups.push({
        key: 'team',
        label: `Audit team (${teamIds.length})`,
        hint: `Lead + members assigned to ${audit.code}`,
        userIds: teamIds
      })
    }
  }

  // 2. department coordinator of the concerned department
  const coord = active.find((u) => u.id === coordinatorId && u.id !== self)
  if (coord) {
    groups.push({
      key: 'coord',
      label: 'Department coordinator',
      hint: `${coord.name} — ${coord.designation || ROLES[coord.role].label}`,
      userIds: [coord.id]
    })
  }

  // 3. roles above / same level / below, one group per role
  const byRole = {}
  active.forEach((u) => {
    if (u.id === self) return
    const rel = roleRelation(currentUser.role, u.role)
    byRole[u.role] = byRole[u.role] || { role: u.role, rel, ids: [] }
    byRole[u.role].ids.push(u.id)
  })
  const relOrder = { above: 1, same: 2, below: 3 }
  Object.values(byRole)
    .sort((a, b) => relOrder[a.rel] - relOrder[b.rel] || ROLE_LEVEL[a.role] - ROLE_LEVEL[b.role])
    .forEach((g) => {
      groups.push({
        key: `role:${g.role}`,
        label: `${ROLES[g.role].label}${g.ids.length > 1 ? ` (${g.ids.length})` : ''}`,
        hint: REL_HINT[g.rel],
        userIds: g.ids
      })
    })
  return groups
}

// Resolve selected group keys -> deduplicated user records (never the sender).
export function resolveRecipients(groups, selectedKeys, users, selfId) {
  const ids = new Set()
  groups.forEach((g) => {
    if (selectedKeys.includes(g.key)) g.userIds.forEach((id) => ids.add(id))
  })
  ids.delete(selfId)
  return Array.from(ids)
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean)
    .map((u) => ({ userId: u.id, name: u.name, role: u.role, email: u.email }))
}

// ---------------------------------------------------------------------------
// dispatchComms - the single entry point used by every manual action and by
// the automatic follow-up engine.
// ---------------------------------------------------------------------------
export async function dispatchComms(
  { save, notify, sendEmail, currentUser },
  { kind, mode = 'Manual', contextType, contextId, auditId, title, recipients, remark, link, level = 0, escalatedTo = '', notifyTitle, notifyBody, fromOverride = null, email = true }
) {
  const from = fromOverride || (currentUser ? { userId: currentUser.id, name: currentUser.name, role: currentUser.role } : { userId: 'system', name: 'System', role: 'system' })
  const rec = {
    id: uid('cl'),
    kind, // 'Reminder' | 'Escalation'
    mode, // 'Manual' | 'Automatic'
    contextType, // 'Observation' | 'Finding' | 'Audit'
    contextId,
    auditId: auditId || null,
    title,
    fromUserId: from.userId,
    fromName: from.name,
    fromRole: from.role,
    recipients: (recipients || []).map((r) => ({ userId: r.userId, name: r.name, role: r.role })),
    remark: remark || '',
    level,
    escalatedTo,
    link: link || '',
    timestamp: todayISO()
  }
  await save('commsLogs', rec)
  const ids = (recipients || []).map((r) => r.userId).filter(Boolean)
  if (ids.length) {
    await notify(ids, kind === 'Escalation' ? 'Escalation' : 'Reminder', notifyTitle || `${kind}: ${title}`, notifyBody || '', link || '', remark)
  }
  if (email && sendEmail) {
    for (const r of recipients || []) {
      if (r.email) await sendEmail(r.email, `${kind}: ${title}`, `${notifyBody || ''}${remark ? ` Remarks: ${remark}` : ''}`)
    }
  }
  return rec
}

// ---------------------------------------------------------------------------
// Visibility - who may see a log entry:
//   oversight roles (admin / director / cao) -> everything
//   everyone else -> entries they sent, entries addressed to them, and
//   entries on audits they are assigned to (team members see the full
//   communication picture for their own audits).
// ---------------------------------------------------------------------------
export function commsLogVisible(currentUser, log, audits) {
  if (!currentUser || !log) return false
  if (COMMS_OVERSIGHT_ROLES.includes(currentUser.role)) return true
  if (log.fromUserId === currentUser.id) return true
  if ((log.recipients || []).some((r) => r.userId === currentUser.id)) return true
  if (log.auditId) {
    const a = audits.find((x) => x.id === log.auditId)
    if (a) {
      const inTeam = (a.leadAuditorId === currentUser.id) || (a.team || []).some((t) => t.userId === currentUser.id)
      if (inTeam) return true
      // coordinators see communication about their department's audits
      if (currentUser.role === 'coordinator' && a.departmentId === currentUser.departmentId) return true
    }
  }
  return false
}

export function visibleCommsLogs(currentUser, logs, audits) {
  if (!currentUser) return []
  return (logs || []).filter((l) => commsLogVisible(currentUser, l, audits))
}
