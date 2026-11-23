// Role-based access control (RBAC).
// MODULES decide which navigation entries each role sees.
// ACTIONS are fine-grained permissions that the administrator can edit
// at runtime (Users & Roles -> Roles & Permissions) - the defaults below
// are seeded into the rolePermissions store on first launch.

export const ROLES = {
  admin: {
    key: 'admin',
    label: 'System Administrator',
    description: 'System configuration, user management, monitoring, integrations and security administration.',
    color: '#70428a'
  },
  director: {
    key: 'director',
    label: 'Audit Director',
    description: 'Strategic oversight and planning, high-level reporting, budget and resource audits, policy configuration.',
    color: '#b45309'
  },
  cao: {
    key: 'cao',
    label: 'Chief Audit Officer',
    description: 'Audit planning and scheduling, team management, quality review and approval, performance monitoring.',
    color: '#0f766e'
  },
  senior: {
    key: 'senior',
    label: 'Senior Audit Officer',
    description: 'Audit execution and documentation, findings analysis, team coordination, stakeholder communication.',
    color: '#036dc9'
  },
  junior: {
    key: 'junior',
    label: 'Junior Audit Officer',
    description: 'Field audit execution, data collection, evidence gathering and work-paper preparation.',
    color: '#0488fb'
  },
  coordinator: {
    key: 'coordinator',
    label: 'Department Coordinator',
    description: 'Department coordination, data provision and validation, responses to audit queries, compliance reporting.',
    color: '#ff3381'
  }
}

export const ROLE_ORDER = ['admin', 'director', 'cao', 'senior', 'junior', 'coordinator']

// Hierarchy levels for reminder / escalation targeting (1 = highest).
// Used to offer role-based recipient groups: above / same level / below.
export const ROLE_LEVEL = { admin: 1, director: 2, cao: 3, senior: 4, junior: 5, coordinator: 5 }

// Modules each role can open (sidebar is filtered by this map).
export const MODULES = {
  dashboard: ['admin', 'director', 'cao', 'senior', 'junior', 'coordinator'],
  departments: ['admin', 'director', 'cao', 'senior', 'junior', 'coordinator'],
  planning: ['admin', 'director', 'cao', 'senior'],
  audits: ['admin', 'director', 'cao', 'senior', 'junior', 'coordinator'],
  findings: ['admin', 'director', 'cao', 'senior', 'junior', 'coordinator'],
  compliance: ['admin', 'director', 'cao', 'senior', 'coordinator'],
  analytics: ['admin', 'director', 'cao', 'senior'],
  reports: ['admin', 'director', 'cao', 'senior', 'junior', 'coordinator'],
  documents: ['admin', 'director', 'cao', 'senior', 'junior', 'coordinator'],
  messages: ['admin', 'director', 'cao', 'senior', 'junior', 'coordinator'],
  teams: ['admin', 'director', 'cao'],
  users: ['admin'],
  activity: ['admin', 'director'],
  settings: ['admin'],
  profile: ['admin', 'director', 'cao', 'senior', 'junior', 'coordinator'],
  guide: ['admin']
}

// Fine-grained action permissions. Labels are shown in the admin permission
// editor. Defaults are seeded into the rolePermissions store and can then be
// edited by the administrator.
export const ACTIONS = {
  'audit.create': { label: 'Create audits', roles: ['admin', 'cao'] },
  'audit.edit': { label: 'Edit audit details', roles: ['admin', 'cao'] },
  'audit.execute': { label: 'Execute audit (checklist, evidence, work papers)', roles: ['admin', 'cao', 'senior', 'junior'] },
  'audit.submitReview': { label: 'Submit audit for review', roles: ['admin', 'cao', 'senior'] },
  'audit.approve': { label: 'Approve / reject audits', roles: ['admin', 'cao'] },
  'audit.finalise': { label: 'Finalise and issue audit reports', roles: ['admin', 'director'] },
  'finding.create': { label: 'Raise findings', roles: ['admin', 'cao', 'senior', 'junior'] },
  'finding.respond': { label: 'Respond to findings (department)', roles: ['admin', 'coordinator'] },
  'finding.close': { label: 'Close findings', roles: ['admin', 'cao', 'senior'] },
  'observation.update': { label: 'Update compliance observations', roles: ['admin', 'cao', 'senior', 'coordinator'] },
  'observation.resolve': { label: 'Resolve compliance observations', roles: ['admin', 'cao', 'senior'] },
  'observation.escalate': { label: 'Escalate compliance observations', roles: ['admin', 'cao', 'senior'] },
  'planning.manage': { label: 'Manage audit plan and calendar', roles: ['admin', 'cao', 'director'] },
  'team.manage': { label: 'Create and manage teams', roles: ['admin', 'cao'] },
  'report.create': { label: 'Generate reports', roles: ['admin', 'cao', 'senior'] },
  'report.approve': { label: 'Approve reports', roles: ['admin', 'director', 'cao'] },
  'report.template': { label: 'Manage report templates', roles: ['admin', 'cao'] },
  'document.upload': { label: 'Upload documents', roles: ['admin', 'director', 'cao', 'senior', 'junior', 'coordinator'] },
  'document.share': { label: 'Share documents', roles: ['admin', 'cao', 'senior'] },
  'document.delete': { label: 'Delete documents', roles: ['admin', 'cao'] },
  'message.send': { label: 'Send messages', roles: ['admin', 'director', 'cao', 'senior', 'junior', 'coordinator'] },
  'user.manage': { label: 'Manage users and permissions', roles: ['admin'] },
  'settings.manage': { label: 'Manage system settings', roles: ['admin'] },
  'reminders.send': { label: 'Send reminders', roles: ['admin', 'cao', 'senior', 'director'] },
  'risk.recalculate': { label: 'Recalculate risk scores', roles: ['admin', 'cao', 'director'] },
  'anomaly.review': { label: 'Review flagged transactions', roles: ['admin', 'cao', 'senior'] }
}

export const ACTION_GROUPS = [
  { group: 'Audits', keys: ['audit.create', 'audit.edit', 'audit.execute', 'audit.submitReview', 'audit.approve', 'audit.finalise'] },
  { group: 'Findings', keys: ['finding.create', 'finding.respond', 'finding.close'] },
  { group: 'Compliance', keys: ['observation.update', 'observation.resolve', 'observation.escalate', 'reminders.send'] },
  { group: 'Planning & Teams', keys: ['planning.manage', 'team.manage', 'risk.recalculate'] },
  { group: 'Reports', keys: ['report.create', 'report.approve', 'report.template'] },
  { group: 'Documents & Messages', keys: ['document.upload', 'document.share', 'document.delete', 'message.send'] },
  { group: 'System', keys: ['user.manage', 'settings.manage', 'anomaly.review'] }
]

// Build the default rolePermissions records (one per role, list of action keys).
export function defaultRolePermissions() {
  return Object.keys(ROLES).map((role) => ({
    id: `perm_${role}`,
    role,
    actions: Object.entries(ACTIONS).filter(([, def]) => def.roles.includes(role)).map(([k]) => k)
  }))
}

export function canModule(user, moduleKey) {
  if (!user) return false
  return (MODULES[moduleKey] || []).includes(user.role)
}

// Static fallback used before the editable permission store has loaded.
export function canDefault(user, action) {
  if (!user) return false
  const def = ACTIONS[action]
  return def ? def.roles.includes(user.role) : false
}

export function roleLabel(key) {
  return ROLES[key] ? ROLES[key].label : key
}

// Relation of one role to another ('above' | 'same' | 'below') from the
// perspective of `myRole`.
export function roleRelation(myRole, otherRole) {
  const a = ROLE_LEVEL[myRole]
  const b = ROLE_LEVEL[otherRole]
  if (a === undefined || b === undefined) return 'below'
  if (b < a) return 'above'
  if (b === a) return 'same'
  return 'below'
}
