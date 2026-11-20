// Project Guide - reference for every page, section and tab, plus a
// walkthrough with step-by-step flows for presenting the platform.
import { useState } from 'react'
import { PageHead, Tabs, Badge } from '../components/ui'
import { navigate } from '../lib/router'
import { ROLES, ROLE_ORDER } from '../lib/permissions'

/* ------------------------------------------------------------------ data */
const PAGES = [
  {
    group: 'Getting Started', items: [
      { name: 'Sign In', desc: 'Email + password sign-in, office SSO button, and one-click role cards for quick access. Every sign-in is recorded in the login history with IP, browser and device.' },
      { name: 'Dashboard', desc: 'Role-aware landing page: KPI cards (active audits, open findings, overdue compliance, compliance rate, flagged payments), clickable charts (audit status, findings severity, workspace activity, department risk) and tables (my assignments, deadlines, pending approvals, recent activity). Every card and chart navigates to its module with filters applied.' },
      { name: 'My Profile', desc: 'Personal details, avatar colour, password change, your recent activity and sign-in history.' }
    ]
  },
  {
    group: 'Auditing', items: [
      { name: 'Audit Planning', desc: 'The annual plan. Tabs: Annual Plan (create/edit/remove audit entries, assign lead & team or load a saved team), Calendar (quarterly view of engagements), Risk Assessment (department risk scores with recalculation and factor breakdown), Resources (officer workload, coverage and budget).' },
      { name: 'Audits', desc: 'The engagement registry: search, filter by status/type/department, sort any column, CSV export. Click any row to open the audit workspace.' },
      { name: 'Audit Workspace (core)', desc: 'Eight tabs: Overview (KPIs, objectives, scope, full action history, team), Checklist (add/edit/delete items, apply standard or custom templates, save your checklist as a template, status tracking), Evidence (file upload with detailed descriptions, preview, download, delete), Findings (raise, respond, resolve with remarks), Observations (raise, remind, escalate with level selection, resolve with notes), Work Papers (draft → submitted → reviewed → approved with remarks), Review (submit, approve, request changes, finalise — all with remarks), Discussion (team chat). Every action is recorded in the audit timeline, the activity trail and notifications.' },
      { name: 'Findings Registry', desc: 'All findings across audits with severity/status/category/department filters, department response workflow and status transitions with remarks.' },
      { name: 'Compliance Tracking', desc: 'Observation follow-up with tabs for Open / Escalated / Resolved / All. Actions: view full history, send reminder (with email), escalate to Level 1–4 (Department Director → Head of Department → Audit Director → Executive Board, with optional parallel notice to another department), resolve with a mandatory note. Every action carries remarks that appear in notifications.' }
    ]
  },
  {
    group: 'Insights', items: [
      { name: 'Analytics & Risk', desc: 'Tabs: Overview (audits by type, findings severity, top-risk departments), Trends & Projection (monthly trends with a 3-month compliance projection), Risk Matrix (impact × likelihood heatmap of audits + department risk table), Flagged Payments (anomaly screening queue with full transaction details and accept / false-positive review with remarks).' },
      { name: 'Reports', desc: 'Report registry with the Draft → In Review → Approved → Final workflow. Templates tab: create and customise templates (sections add/remove/reorder, accent colour, footer, cover page, contents). Generate reports from any audit and template, then export to PDF (print), Word or CSV.' }
    ]
  },
  {
    group: 'Workspace', items: [
      { name: 'Departments', desc: 'The audit universe: add, edit, deactivate/reactivate and delete departments. Click a department for its profile — units, audit history, coordinators, compliance posture — with a back button to return.' },
      { name: 'Teams', desc: 'Create, edit, deactivate and delete reusable audit teams. Leads and members are picked with the people picker (search + role filters); active teams can be loaded directly when planning an audit.' },
      { name: 'Documents', desc: 'Central repository with version control. Preview PDFs, images, text, CSV and Word files directly in the app. Upload new versions against any document, share with specific people (they get notified), and filter by category, file type and department.' },
      { name: 'Messages', desc: 'Internal messaging with Direct and Group conversations. Tabs: All / Direct / Groups. The header shows exactly who you are talking to (with roles), groups are marked with stacked avatars. New conversations use the people picker with search and role/department filters.' }
    ]
  },
  {
    group: 'Administration', items: [
      { name: 'Users & Roles', desc: 'Users tab: add, edit, deactivate and delete accounts, reset passwords, filter by role/status/department. Roles & Permissions tab: pick any role and grant or revoke each fine-grained permission with a switch — changes apply instantly across the app.' },
      { name: 'Activity Log', desc: 'Every tracked action with quick filter chips (audits, findings, documents, messages, users, system), user and date filters, and grouped-by-day display. The Login History & Sessions tab lists sign-ins with result, method, IP address, browser, OS and device.' },
      { name: 'Settings', desc: 'General (workspace info, storage statistics), Notifications (per-user preferences), Data (backup / restore / reset / activity export), Developer (SSO integration status and sync log, environment configuration, email gateway outbox, developer tools).' }
    ]
  }
]

const FLOWS = [
  {
    title: 'Sign in and orient',
    steps: [
      'On the sign-in page, use the quick access cards to sign in as Rajesh Kumar Singh (Chief Audit Officer) — or use the Office SSO button.',
      'Note the dashboard: KPI cards for active audits, open findings, overdue compliance, compliance rate and flagged payments — each clickable.',
      'Click the "Open Findings" KPI card — it opens the findings registry filtered. Use the ← back button or sidebar to return.'
    ]
  },
  {
    title: 'Plan a new audit',
    steps: [
      'Still as Chief Audit Officer, open Audit Planning from the sidebar.',
      'Click "+ Plan New Audit". Fill in title, type (Financial), department, priority, start date, duration and budget.',
      'Under "Load from team", pick "Financial Audit Team A" — the lead and members fill in automatically.',
      'Save — the audit enters the annual plan, and the team receives assignment notifications.',
      'Open the Calendar tab to see the new engagement placed in its quarter; open Risk Assessment to show how departments are scored.'
    ]
  },
  {
    title: 'Execute an audit — checklist and evidence',
    steps: [
      'Sign in as Priya Yadav (Senior Audit Officer) and open Audits → FA-…-001 (Health & Family Welfare).',
      'In the Checklist tab, click "Apply Template" and append the standard financial checklist — 11 items appear.',
      'Add a custom item using "+ Add Item" (e.g. a department-specific verification), then set a few items to Completed using the status dropdown.',
      'Switch to the Evidence tab and upload a file with a detailed description — it is stored with the uploader, time and description.',
      'Click Preview on any evidence item to view it inline; hover the Overview tab to see progress update automatically from the checklist.'
    ]
  },
  {
    title: 'Raise a finding and track compliance',
    steps: [
      'In the same audit, open the Findings tab and click "+ Raise Finding". Enter a title, category, severity (High), amount and response due date.',
      'Save — the department coordinator is notified automatically.',
      'Sign in as Sunita Devi (Department Coordinator), open Findings Registry, view the finding and use "Submit Department Response".',
      'Back as the Senior Audit Officer, mark the finding Under Review. Note the remarks captured on every transition.',
      'In the audit\'s Observations tab (or Compliance Tracking), raise an observation linked to the finding with the rule violated and a due date.'
    ]
  },
  {
    title: 'Escalate a compliance observation',
    steps: [
      'As Chief Audit Officer, open Compliance Tracking and pick an overdue observation.',
      'Click the view (👁) icon first — the full follow-up history, reminders and escalations are visible.',
      'Click ↑ Escalate. Choose "Level 2 — Head of Department", optionally add a parallel notice to another department, and enter remarks (required).',
      'Confirm — the observation moves to Escalated, and the notification carries the remarks. Also try 🔔 Send Reminder, which emails the coordinator.'
    ]
  },
  {
    title: 'Review and approve an audit',
    steps: [
      'As Priya Yadav (Senior), open the Irrigation compliance audit (under review) — its work papers are ready.',
      'In the Work Papers tab, approve a submitted work paper with remarks.',
      'Sign in as Rajesh Kumar Singh (Chief Audit Officer). The dashboard shows audits pending your approval.',
      'Open the audit → Review tab → "Approve Audit" with remarks.',
      'Sign in as Dr. Meena Sharma (Audit Director) to "Finalise & Issue" — the audit closes with the full review history visible.'
    ]
  },
  {
    title: 'Generate and issue a report',
    steps: [
      'As Chief Audit Officer, open Reports → Templates. Edit the "Detailed Audit Report" template: reorder sections, change the accent colour, toggle the contents page.',
      'Open the Reports tab and click "+ Generate Report". Pick an audit and your template.',
      'View the draft: summary, workflow history, export to PDF and Word.',
      'Advance the workflow: Send for Review → Approve (remarks required) → Mark Final & Issue.'
    ]
  },
  {
    title: 'Review flagged payments (analytics)',
    steps: [
      'Open Analytics & Risk → Flagged Payments tab.',
      'Open a flagged transaction with the view icon — the modal explains exactly which rules fired (duplicate payment, round figure, split purchase, weekend transfer, vendor concentration).',
      'Click "Confirm Anomaly" or "False Positive" with remarks — the decision is recorded and visible in the review history.'
    ]
  },
  {
    title: 'Manage teams and departments',
    steps: [
      'As Chief Audit Officer, open Teams. Create a team, pick a lead, add members via the people picker (search + role filters), and save.',
      'Deactivate an old team with the pause icon — inactive teams cannot be assigned.',
      'Open Departments. Add a department, edit its head and budget, deactivate one, then click into a department profile and use the back button to return.'
    ]
  },
  {
    title: 'Users, permissions and activity trail',
    steps: [
      'Sign in as Arjun Verma (System Administrator) and open Users & Roles.',
      'In the Users tab, add a user or reset a password; deactivate and reactivate an account.',
      'Switch to Roles & Permissions, pick "Junior Audit Officer" and toggle a permission off — junior officers immediately lose that capability in the app. Toggle it back.',
      'Open Activity Log: use the quick filter chips (Audits, Documents, System…), then switch to "Login History & Sessions" to show sign-ins with IP, browser and device.',
      'Open Settings → Developer (last tab) to show the SSO integration, environment configuration and email gateway log.'
    ]
  },
  {
    title: 'Documents and messaging',
    steps: [
      'Open Documents. Filter by file type (PDF), preview a document inline, then use the ⇧ icon to upload a new version with a note.',
      'Share a document with specific people — they receive a notification.',
      'Open Messages: the tabs separate direct and group conversations; groups show stacked avatars and participant names.',
      'Start a new group message using the people picker with role and department filters, and send a reply — recipients see it instantly (try a second browser tab).'
    ]
  }
]

/* ------------------------------------------------------------------ page */
export default function Guide() {
  const [tab, setTab] = useState('pages')

  return (
    <div>
      <PageHead
        title="Project Guide"
        sub="Everything in the platform explained — plus ready-to-use walkthrough flows"
      />

      <Tabs
        tabs={[
          { key: 'pages', label: 'Pages & Modules' },
          { key: 'flows', label: 'Walkthrough Flows', count: FLOWS.length },
          { key: 'roles', label: 'Roles' }
        ]}
        active={tab} onChange={setTab}
      />

      {tab === 'pages' && (
        <div className="flex-col" style={{ gap: 16 }}>
          {PAGES.map((g) => (
            <div key={g.group} className="card">
              <div className="card-head"><h3>{g.group}</h3></div>
              <div className="card-pad grid grid-2" style={{ gap: 18 }}>
                {g.items.map((it) => (
                  <div key={it.name} className="flex" style={{ gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ width: 7, height: 7, borderRadius: 4, background: 'var(--thistle-500)', marginTop: 6, flexShrink: 0 }} />
                    <div>
                      <div className="bold small">{it.name}</div>
                      <div className="muted small" style={{ lineHeight: 1.55 }}>{it.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'flows' && (
        <div className="grid grid-2">
          {FLOWS.map((f, i) => (
            <div key={i} className="flow-card">
              <div className="card-head" style={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                <h3>{f.title}</h3>
                <span className="hint">{f.steps.length} steps</span>
              </div>
              {f.steps.map((s, j) => (
                <div key={j} className="flow-step">
                  <span className="fs-n">{j + 1}</span>
                  <span className="small" style={{ color: 'var(--text-2)' }}>{s}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === 'roles' && (
        <div className="grid grid-3">
          {ROLE_ORDER.map((r) => (
            <div key={r} className="card card-pad">
              <div className="flex-between mb-1">
                <span className="bold">{ROLES[r].label}</span>
                <span className="tag" style={{ background: ROLES[r].color + '18', color: ROLES[r].color, borderColor: 'transparent' }}>{r}</span>
              </div>
              <p className="muted small" style={{ margin: 0 }}>{ROLES[r].description}</p>
              <button className="btn btn-secondary btn-sm mt-2" onClick={() => navigate('/users')}>View permissions →</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
