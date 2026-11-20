// Role-based access control (RBAC).
// Six roles as per the requirement document (FR-001, FR-002).

export const ROLES = {
  admin: {
    key: 'admin',
    label: 'System Administrator',
    description: 'System configuration, user management, monitoring, integrations and security administration.',
    color: '#7c3aed'
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
    color: '#1d4ed8'
  },
  junior: {
    key: 'junior',
    label: 'Junior Audit Officer',
    description: 'Field audit execution, data collection, evidence gathering and work-paper preparation.',
    color: '#0369a1'
  },
  coordinator: {
    key: 'coordinator',
    label: 'Department Coordinator',
    description: 'Department coordination, data provision and validation, responses to audit queries, compliance reporting.',
    color: '#be185d'
  }
}

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
  users: ['admin'],
  integrations: ['admin'],
  activity: ['admin', 'director'],
  settings: ['admin'],
  profile: ['admin', 'director', 'cao', 'senior', 'junior', 'coordinator'],
  guide: ['admin', 'director', 'cao', 'senior', 'junior', 'coordinator']
}

// Fine-grained actions (FR-001). Pages check these before showing buttons.
export const ACTIONS = {
  'audit.create': ['admin', 'cao'],
  'audit.edit': ['admin', 'cao'],
  'audit.execute': ['admin', 'cao', 'senior', 'junior'], // checklist, evidence, workpapers
  'audit.submitReview': ['admin', 'cao', 'senior'],
  'audit.approve': ['admin', 'cao'],
  'finding.create': ['admin', 'cao', 'senior', 'junior'],
  'finding.respond': ['admin', 'coordinator'], // department response
  'finding.close': ['admin', 'cao', 'senior'],
  'observation.update': ['admin', 'cao', 'senior', 'coordinator'],
  'observation.escalate': ['admin', 'cao', 'senior'],
  'planning.manage': ['admin', 'cao', 'director'],
  'report.create': ['admin', 'cao', 'senior'],
  'report.approve': ['admin', 'director', 'cao'],
  'document.upload': ['admin', 'director', 'cao', 'senior', 'junior', 'coordinator'],
  'document.share': ['admin', 'cao', 'senior'],
  'message.send': ['admin', 'director', 'cao', 'senior', 'junior', 'coordinator'],
  'user.manage': ['admin'],
  'integration.manage': ['admin'],
  'settings.manage': ['admin'],
  'reminders.send': ['admin', 'cao', 'senior', 'director'],
  'risk.recalculate': ['admin', 'cao', 'director']
}

export function canModule(user, moduleKey) {
  if (!user) return false
  return (MODULES[moduleKey] || []).includes(user.role)
}

export function can(user, action) {
  if (!user) return false
  return (ACTIONS[action] || []).includes(user.role)
}

// role helpers
export function roleLabel(key) {
  return ROLES[key] ? ROLES[key].label : key
}
