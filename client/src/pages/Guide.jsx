// Project Guide - reference for every page, section and tab, plus workflow
// documents: each walkthrough has a short intro ("what it is about"), typed
// steps (navigate / perform / watch / switch role) with tips, and can be
// printed or downloaded as a standalone document.
import { useMemo, useState } from 'react'
import { PageHead, Tabs, MenuButton } from '../components/ui'
import { navigate, useTabMemory } from '../lib/router'
import { exportWord } from '../lib/exporters'
import { ROLES, ROLE_ORDER } from '../lib/permissions'
import { PrinterIcon } from '@solar-icons/react/linear/printer'
import { DocumentTextIcon } from '@solar-icons/react/linear/document-text'
import { TableIcon } from '@solar-icons/react/linear/table'

/* ------------------------------------------------------------------ data */
const PAGES = [
  {
    group: 'Getting Started', items: [
      { name: 'Sign In', desc: 'Email + password sign-in, office SSO button, and one-click role cards for quick access. Every sign-in is recorded in the login history with IP, browser and device.' },
      { name: 'Dashboard', desc: 'Role-aware landing page: KPI cards (active audits, open findings, overdue compliance, compliance rate, flagged payments), clickable charts (audit status, findings severity, workspace activity, department risk) and tables (my assignments, deadlines, pending approvals, recent activity). Every card and chart navigates to its module with filters applied.' },
      { name: 'Global Back Button', desc: 'The arrow at the left of the topbar walks back through your real visit order across the whole app — page to page, not just within one feature. Repeated clicks keep stepping back; the tooltip always shows where the next click will take you.' },
      { name: 'My Profile', desc: 'Personal details, avatar colour, password change, your recent activity and sign-in history.' }
    ]
  },
  {
    group: 'Auditing', items: [
      { name: 'Audit Planning', desc: 'The annual plan. Tabs: Annual Plan (create/edit/remove audit entries, assign lead & team or load a saved team), Calendar (quarterly view of engagements), Risk Assessment (department risk scores with recalculation and factor breakdown), Resources (officer workload, coverage and budget).' },
      { name: 'Audits', desc: 'The engagement registry: search, filter by status/type/department, sort any column, CSV export. Click any row to open the audit workspace.' },
      { name: 'Audit Workspace (core)', desc: 'Eight tabs: Overview (KPIs, objectives, scope, full action history, team), Checklist (add/edit/delete items, apply standard or custom templates, save your checklist as a template, status tracking), Evidence (file upload with detailed descriptions, preview, download, delete), Findings (raise, respond, resolve with remarks), Observations (raise, remind with remark & recipients, escalate with level selection, resolve with notes), Work Papers (draft → submitted → reviewed → approved with remarks), Review (submit, approve, request changes, finalise — all with remarks, plus review reminders), Discussion (team chat). Every action is recorded in the audit timeline, the activity trail and notifications.' },
      { name: 'Findings Registry', desc: 'All findings across audits with severity/status/category/department filters, department response workflow and status transitions with remarks. Findings awaiting a department response can be chased with a reminder — mandatory remark, selectable recipients (coordinator, audit team, roles above / same / below your level), logged in the communication log.' },
      { name: 'Compliance Tracking', desc: 'Observation follow-up with tabs for Open / Escalated / Resolved / All / Communication Log. Actions: view full history, send reminder (mandatory remark + recipient selection), escalate to Level 1–4 (Department Director → Head of Department → Audit Director → Executive Board, with optional parallel notice to another department), resolve with a mandatory note. Overdue observations also receive automatic system reminders and Level-1 auto-escalation — every manual and automatic action lands in the Communication Log with sender, recipients, remark and time, visible according to role and audit team.' }
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
      { name: 'Users & Roles', desc: 'Users tab: add, edit, deactivate and delete accounts, reset passwords, filter by role/status/department. Roles & Permissions tab: pick any role and grant or revoke each fine-grained permission with a switch — changes apply instantly across the app (including who may send reminders or escalate).' },
      { name: 'Activity Log', desc: 'Every tracked action with quick filter chips (audits, findings, documents, messages, users, system), user and date filters, and grouped-by-day display. The Reminders & Escalations tab is the full communication log — every manual and automatic reminder and escalation, with sender, recipients, remark and click-through to the audit or compliance page. The Login History & Sessions tab lists sign-ins with result, method, IP address, browser, OS and device.' },
      { name: 'Settings', desc: 'General (workspace info, storage statistics), Notifications (per-user preferences), Data (backup / restore / reset / activity export), Developer (SSO integration status and sync log, environment configuration, email gateway outbox, developer tools).' }
    ]
  }
]

/* ------------------------------------------------------------------ workflows
   Each workflow document has:
   - intro: one line — what this walkthrough is about, in short
   - about: 2-3 sentences of context
   - roles + duration + prerequisites
   - typed steps: navigate | action | observe | switch | info (with tips)
--------------------------------------------------------------------------- */
const STEP_META = {
  navigate: { label: 'Navigate', cls: 'st-navigate' },
  action: { label: 'Perform', cls: 'st-action' },
  observe: { label: 'Watch / Check', cls: 'st-observe' },
  switch: { label: 'Switch role', cls: 'st-switch' },
  info: { label: 'Good to know', cls: 'st-info' }
}

/* ------------------------------------------------------------------ export helpers
   One HTML generator (in the app's own pastel palette) is shared by the
   "download all as PDF" print window and the Word export, so both outputs
   look exactly like the workflow documents on screen. */
const escHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const WF_EXPORT_CSS = `
  body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 12px; color: #2b2433; }
  h1.guide-title { font-size: 22px; color: #543267; margin: 0 0 3px; }
  .guide-sub { color: #6d627a; font-size: 12px; margin-bottom: 4px; }
  .guide-meta { color: #8d84a0; font-size: 10.5px; margin-bottom: 20px; }
  .wf-doc { border: 1px solid #e5dfef; border-radius: 10px; padding: 16px 18px; margin-bottom: 18px; }
  .wf-doc.first { page-break-before: avoid; }
  .wf-doc.page-break { page-break-before: always; }
  .wf-head { border-bottom: 2px solid #f3eef7; padding-bottom: 8px; margin-bottom: 10px; }
  h2.wf-title { font-size: 16px; color: #543267; margin: 0 0 4px; }
  .wf-intro { color: #4a4156; font-size: 11.5px; line-height: 1.5; margin: 0; }
  .chips { margin: 10px 0 4px; }
  .chip { display: inline-block; border-radius: 999px; padding: 2px 10px; font-size: 10.5px; font-weight: 600; margin: 0 5px 4px 0; background: #f6f2fa; color: #543267; border: 1px solid #e5dfef; }
  .panels { display: flex; gap: 10px; margin: 10px 0 12px; }
  .panel { flex: 1; border: 1px solid #e5dfef; border-radius: 8px; padding: 9px 11px; background: #faf8fd; }
  .panel .pt { font-weight: 700; font-size: 10.5px; color: #8b53ac; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 3px; }
  .panel .pb { font-size: 11.5px; color: #4a4156; line-height: 1.5; }
  .legend { margin: 8px 0 12px; font-size: 10px; color: #8d84a0; }
  .step { display: flex; gap: 10px; border: 1px solid #e5dfef; border-radius: 8px; padding: 9px 11px; margin-bottom: 7px; break-inside: avoid; }
  .step .n { width: 22px; height: 22px; border-radius: 7px; background: #8b53ac; color: #ffffff; font-weight: 700; font-size: 11px; text-align: center; line-height: 22px; flex-shrink: 0; }
  .st { display: inline-block; border-radius: 6px; padding: 1px 8px; font-size: 10px; font-weight: 700; margin-bottom: 4px; }
  .st-navigate { background: #e6f3ff; color: #025197; }
  .st-action { background: #f3eef7; color: #543267; }
  .st-observe { background: #e7f6ef; color: #0b7f58; }
  .st-switch { background: #ffe5ef; color: #99003b; }
  .st-info { background: #f6f2fa; color: #5d5266; }
  .step .tx { font-size: 11.5px; line-height: 1.55; color: #2b2433; margin: 0; }
  .tip { margin-top: 5px; font-size: 10.5px; color: #8a6d1f; background: #fdf6e7; border: 1px solid #f0e3c0; border-radius: 6px; padding: 4px 8px; }
  .footer { margin-top: 20px; color: #8d84a0; font-size: 10px; border-top: 1px solid #e5dfef; padding-top: 6px; }
  @page { margin: 15mm 13mm; }
`

function flowDocHTML(f, { first = false, pageBreak = false } = {}) {
  const roleChips = f.roles
    .map((r) => `<span class="chip" style="background:${((ROLES[r] || {}).color || '#888')}14;color:${(ROLES[r] || {}).color || '#888'};border-color:transparent">${escHtml((ROLES[r] || {}).label)}</span>`)
    .join('')
  const legend = Object.entries(STEP_META)
    .map(([, m]) => `<span class="st ${m.cls}" style="margin-right:6px">${m.label}</span>`)
    .join('')
  const steps = f.steps
    .map((s, i) => {
      const meta = STEP_META[s.t] || STEP_META.info
      return `<div class="step">
        <div class="n">${i + 1}</div>
        <div style="flex:1">
          <span class="st ${meta.cls}">${meta.label}</span>
          <p class="tx">${escHtml(s.text)}</p>
          ${s.tip ? `<div class="tip">Tip: ${escHtml(s.tip)}</div>` : ''}
        </div>
      </div>`
    })
    .join('')
  return `<div class="wf-doc${first ? ' first' : ''}${pageBreak ? ' page-break' : ''}">
    <div class="wf-head">
      <h2 class="wf-title">${f.icon ? f.icon + ' ' : ''}${escHtml(f.title)}</h2>
      <p class="wf-intro">${escHtml(f.intro)}</p>
      <div class="chips">
        <span class="chip">${escHtml(f.duration)}</span>
        <span class="chip">${f.steps.length} steps</span>
        ${roleChips}
      </div>
    </div>
    <div class="panels">
      <div class="panel"><div class="pt">About this workflow</div><div class="pb">${escHtml(f.about)}</div></div>
      <div class="panel"><div class="pt">Before you start</div><div class="pb">${escHtml(f.prereq)}</div></div>
    </div>
    <div class="legend">Step types: ${legend}</div>
    ${steps}
  </div>`
}

function flowsToHTML(flows) {
  const docs = flows
    .map((f, i) => flowDocHTML(f, { first: i === 0, pageBreak: i > 0 }))
    .join('')
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  return `<h1 class="guide-title">Audit Management System — Workflow Guide</h1>
  <div class="guide-sub">${flows.length} workflow documents · step-by-step walkthroughs for every role</div>
  <div class="guide-meta">Generated from the Project Guide on ${escHtml(today)}</div>
  ${docs}
  <div class="footer">Generated by the Audit Management System · Project Guide → Workflows</div>`
}

function downloadFlowsPDF(flows) {
  const w = window.open('', '_blank', 'width=940,height=720')
  if (!w) { alert('Please allow pop-ups for this site to export the PDF.') ; return }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>AMS Workflow Guide</title><style>${WF_EXPORT_CSS}</style></head><body>${flowsToHTML(flows)}<script>window.onload=function(){setTimeout(function(){window.print()},350)}</script></body></html>`)
  w.document.close()
}

function downloadFlowsWord(flows) {
  exportWord('AMS-Workflow-Guide', 'AMS Workflow Guide', flowsToHTML(flows), WF_EXPORT_CSS)
}

const FLOWS = [
  {
    id: 'orient',
    icon: '🧭',
    title: 'Sign in and orient',
    intro: 'Find your way around after sign-in: dashboard KPIs, clickable charts, colour-coded notifications and the app-wide back button.',
    about: 'This walkthrough orients a new user with the landing experience. It shows how every KPI card and chart is a shortcut into the underlying module, how notifications deep-link to their source, and how the topbar back button retraces your steps across the whole app.',
    roles: ['admin', 'director', 'cao', 'senior', 'junior', 'coordinator'],
    duration: '3 min',
    prereq: 'Any account. Quick access cards on the sign-in page sign you in with one click.',
    steps: [
      { t: 'navigate', text: 'On the sign-in page, use a quick access card (e.g. Rajesh Kumar Singh — Chief Audit Officer) or the Office SSO button.' },
      { t: 'observe', text: 'Note the dashboard KPI cards: active audits, open findings, overdue compliance, compliance rate and flagged payments — each one is clickable.', tip: 'Hover a card to see the "Click to view details" cue, then click "Open Findings" to jump into the findings registry pre-filtered.' },
      { t: 'action', text: 'Use the ← back button at the left of the topbar to return to the dashboard.', tip: 'The tooltip shows where the next click takes you. The back stack is app-wide: dashboard → findings → an audit → compliance all retrace in order.' },
      { t: 'action', text: 'Hover any chart segment (audit status, findings severity) to see its details; click it to jump to the relevant page with filters applied.' },
      { t: 'observe', text: 'Open the notifications bell — entries are colour-coded by type (review, findings, reminders, escalations, deadlines) and clicking one navigates straight to its page.' },
      { t: 'observe', text: 'Try the topbar search: type an audit code, department or person name and click a result to navigate there.' }
    ]
  },
  {
    id: 'plan-audit',
    icon: '🗓',
    title: 'Plan a new audit',
    intro: 'Add an engagement to the annual plan, load a saved team, and see it appear on the calendar and in resource loading.',
    about: 'Covers the planning stage: creating a planned audit, assigning a lead and team (manually or from a saved team), and verifying the engagement across the Calendar, Risk Assessment and Resources tabs of Audit Planning.',
    roles: ['admin', 'director', 'cao'],
    duration: '4 min',
    prereq: 'Sign in as Chief Audit Officer (Rajesh Kumar Singh) or Audit Director.',
    steps: [
      { t: 'navigate', text: 'Open Audit Planning from the sidebar.' },
      { t: 'observe', text: 'The Annual Plan tab lists every engagement with status, priority, quarter, team and budget — sort any column or use the search box.' },
      { t: 'action', text: 'Click "+ Plan New Audit". Fill in title, type (Financial), department, priority, start date, duration and budget.' },
      { t: 'action', text: 'Under "Load from team", pick "Financial Audit Team A" — the lead and members fill in automatically.', tip: 'You can still swap individual members with the people picker (search + role filters).' },
      { t: 'action', text: 'Save — the audit enters the annual plan with status Planned, and the team receives assignment notifications.' },
      { t: 'navigate', text: 'Open the Calendar tab and find the new engagement placed in its quarter.' },
      { t: 'observe', text: 'Open Risk Assessment: department risk scores with factor breakdown; use "Recalculate" to re-score.' },
      { t: 'observe', text: 'Open Resources: officer workload, audit coverage and budget utilisation update with the new entry.' }
    ]
  },
  {
    id: 'execute-audit',
    icon: '📋',
    title: 'Execute an audit — checklist, evidence and tabs',
    intro: 'Work through the audit workspace: apply a checklist template, track item status, upload evidence with descriptions, and watch progress update live.',
    about: 'The core execution workflow inside an audit workspace. It visits every working tab (Checklist, Evidence, Overview), performs real actions (template apply, add item, status change, file upload with description, inline preview) and shows how the progress bar and action history react to each change.',
    roles: ['admin', 'cao', 'senior', 'junior'],
    duration: '6 min',
    prereq: 'Sign in as Priya Yadav (Senior Audit Officer) — lead on the Health & Family Welfare financial audit.',
    steps: [
      { t: 'navigate', text: 'Open Audits from the sidebar and click FA-…-001 (Health & Family Welfare) to enter the audit workspace.' },
      { t: 'observe', text: 'On the Overview tab, note the progress bar, objectives, scope, team and the full action history timeline — every change in the workspace lands here.' },
      { t: 'navigate', text: 'Switch to the Checklist tab.' },
      { t: 'action', text: 'Click "Apply Template" and append the standard financial checklist — the items appear instantly.' },
      { t: 'action', text: 'Add a custom item with "+ Add Item" (e.g. a department-specific verification).' },
      { t: 'action', text: 'Set a few items to Completed / In Progress using the status button on each row.', tip: 'Status changes are tracked per item with who changed them.' },
      { t: 'observe', text: 'Return to Overview — the progress percentage has recalculated from the checklist.' },
      { t: 'navigate', text: 'Switch to the Evidence tab.' },
      { t: 'action', text: 'Upload a file with a detailed description (what it proves, period covered). It is stored with uploader, time and description.' },
      { t: 'action', text: 'Click Preview on the evidence item to view it inline; use Download to export it.' },
      { t: 'navigate', text: 'Briefly visit Work Papers and Discussion to see the other working tabs.' },
      { t: 'observe', text: 'Open Overview once more — the action history now shows every step you performed, with timestamps.' }
    ]
  },
  {
    id: 'finding-compliance',
    icon: '⚠',
    title: 'Raise a finding and track compliance',
    intro: 'Raise a finding on an audit, let the department respond, move it through review — then raise a compliance observation linked to it.',
    about: 'Follows a finding end-to-end: raising it in the audit workspace, the coordinator\u2019s response from the Findings Registry, the reviewer\u2019s status transitions with remarks, and finally linking a time-bound compliance observation that feeds Compliance Tracking.',
    roles: ['admin', 'cao', 'senior', 'coordinator'],
    duration: '7 min',
    prereq: 'Two accounts: Priya Yadav (Senior Audit Officer) and Sunita Devi (Department Coordinator).',
    steps: [
      { t: 'navigate', text: 'As Priya Yadav, open the audit workspace and switch to the Findings tab.' },
      { t: 'action', text: 'Click "+ Raise Finding". Enter title, category, severity (High), amount and response due date.' },
      { t: 'action', text: 'Save — the department coordinator is notified automatically.' },
      { t: 'switch', text: 'Sign out and sign in as Sunita Devi (Department Coordinator).' },
      { t: 'navigate', text: 'Open Findings Registry — filter by department if needed, open the finding and read the full description and history.' },
      { t: 'action', text: 'Use "Submit Department Response" to record the action taken.' },
      { t: 'switch', text: 'Sign back in as Priya Yadav.' },
      { t: 'action', text: 'In the Findings Registry, mark the finding Under Review — note that remarks are captured on every transition.' },
      { t: 'navigate', text: 'Back in the audit workspace, open the Observations tab.' },
      { t: 'action', text: 'Click "+ Raise Observation", link it to the finding, enter the rule violated and a due date.', tip: 'The observation now appears in Compliance Tracking for time-bound follow-up.' },
      { t: 'observe', text: 'Open Compliance Tracking and confirm the new observation is listed with its due date and compliance status.' }
    ]
  },
  {
    id: 'reminders-escalations',
    icon: '🔔',
    title: 'Reminders, escalations and the communication log',
    intro: 'The full follow-up loop: send a reminder with a mandatory remark to selected recipients, escalate with a level, and watch everything land in the communication log and notifications.',
    about: 'This is the follow-up engine of the platform. Every reminder and escalation — manual or automatic — requires a remark, lets the sender choose recipients (audit team, department coordinator, roles above / same level / below), is recorded in the communication log with sender, recipients, remark and time, and triggers a colour-coded notification that deep-links to the right page. Visibility of log entries follows role and audit-team membership.',
    roles: ['admin', 'director', 'cao', 'senior'],
    duration: '8 min',
    prereq: 'Sign in as Rajesh Kumar Singh (Chief Audit Officer). By default admin, director, CAO and senior officers may send reminders; the admin can change this in Users & Roles → Roles & Permissions.',
    steps: [
      { t: 'navigate', text: 'Open Compliance Tracking from the sidebar.' },
      { t: 'observe', text: 'The stat cards show overdue and escalated counts. Pick an overdue observation (red "late" badge).' },
      { t: 'action', text: 'Click the 🔔 icon on its row (or open the observation and use "Send Reminder").' },
      { t: 'observe', text: 'The reminder dialog shows the context (audit, due date) and recipient groups built from your role: the audit team, the department coordinator, roles above your level, same-level roles and roles below.', tip: 'The groups differ per role — a Senior Audit Officer sees the CAO / Director above them, other seniors at the same level, and juniors / coordinators below.' },
      { t: 'action', text: 'Select recipients (e.g. the coordinator + a junior officer on the team) and type the mandatory remark — the send button stays disabled until both are provided.' },
      { t: 'action', text: 'Send. A toast confirms the recipient count.' },
      { t: 'observe', text: 'Open the notifications bell (as one of the recipients, in a second tab): the notification is colour-coded, quotes your remark and links to the audit workspace.' },
      { t: 'navigate', text: 'In Compliance Tracking, switch to the Communication Log tab.' },
      { t: 'observe', text: 'Your reminder is listed: type (Reminder, manual), about, from, recipients with avatars, and the remark. Filter by type or manual/automatic, or search remarks and names.' },
      { t: 'action', text: 'Now escalate: open an overdue observation and click ↑ Escalate. Choose a level (1 Department Director → 4 Executive Board) — suggested recipients switch with the level. Add a parallel notice to another department if needed, type the remark, confirm.' },
      { t: 'observe', text: 'The observation moves to Escalated, the escalation badge shows the level, and the entry appears in the communication log and in the Activity Log → Reminders & Escalations tab.' },
      { t: 'observe', text: 'Automatic actions: overdue observations receive system reminders (3-day cooling period) and 14+ day overdue open observations are auto-escalated to Level 1 — these appear in the log tagged "auto", with the system as sender.' },
      { t: 'info', text: 'Who sees what: admin / director / CAO see the whole log; everyone else sees entries they sent, entries addressed to them, and everything on audits they are assigned to. Coordinators additionally see communication about their own department\u2019s audits.' }
    ]
  },
  {
    id: 'coordinator',
    icon: '🏤',
    title: 'Department coordinator workflow',
    intro: 'See the platform from the department side: respond to findings, read received reminders, and track your department\u2019s observations.',
    about: 'The coordinator is the department\u2019s point of contact. This walkthrough shows where reminders addressed to the coordinator arrive, how to respond to findings, and how the Communication Log keeps the department\u2019s follow-up picture transparent.',
    roles: ['coordinator'],
    duration: '4 min',
    prereq: 'Sign in as Sunita Devi (Department Coordinator, Health & Family Welfare).',
    steps: [
      { t: 'observe', text: 'The dashboard shows your department\u2019s findings awaiting response and its audits.' },
      { t: 'action', text: 'Open the notifications bell — reminders addressed to you quote the remark and link to the audit workspace (observations tab).' },
      { t: 'navigate', text: 'Open Findings Registry, filter to your department, open a finding and submit the department response with action-taken details.' },
      { t: 'navigate', text: 'Open Compliance Tracking — the observations of your department are listed with due dates, reminder counts and escalation levels.' },
      { t: 'action', text: 'Use the view (👁) icon to read the full follow-up history and the reminders & escalations recorded for that observation before responding.' },
      { t: 'navigate', text: 'Switch to the Communication Log tab — it shows every reminder and escalation that concerns you or your department, with sender, recipients and remarks.' }
    ]
  },
  {
    id: 'review-approve',
    icon: '✅',
    title: 'Review and approve an audit',
    intro: 'Walk the quality loop: work paper approval, submitting for review, nudging a pending reviewer with a reminder, and final issue.',
    about: 'The review workflow moves an audit from In Progress to Under Review to Completed to Closed. Every action carries remarks; when a reviewer is slow, the audit lead can send a review reminder with a remark — logged like every other communication.',
    roles: ['admin', 'director', 'cao', 'senior'],
    duration: '6 min',
    prereq: 'Three accounts: Priya Yadav (Senior), Rajesh Kumar Singh (CAO), Dr. Meena Sharma (Audit Director).',
    steps: [
      { t: 'navigate', text: 'As Priya Yadav, open the Irrigation compliance audit (under review) — its work papers are ready.' },
      { t: 'action', text: 'In the Work Papers tab, approve a submitted work paper with remarks.' },
      { t: 'navigate', text: 'Open the Review tab — it shows the review history and the next step for your role.' },
      { t: 'action', text: 'Use "🔔 Send Review Reminder" to nudge the CAO: pick recipients (role above you), type the remark, send.', tip: 'The reminder lands in the communication log and the recipient\u2019s notifications, with a link back to this audit.' },
      { t: 'switch', text: 'Sign in as Rajesh Kumar Singh (Chief Audit Officer). The dashboard shows audits pending your approval.' },
      { t: 'action', text: 'Open the audit → Review tab → "Approve Audit" with remarks. The status moves to Completed.' },
      { t: 'switch', text: 'Sign in as Dr. Meena Sharma (Audit Director) and use "Finalise & Issue" — the audit closes with the full review history visible.' },
      { t: 'observe', text: 'Open the audit\u2019s Overview tab — the action history records every review action with its remarks.' }
    ]
  },
  {
    id: 'reports',
    icon: '📄',
    title: 'Generate and issue a report',
    intro: 'Customise a template, generate a report from an audit, advance it through review to final, and export it.',
    about: 'Reports move through Draft → In Review → Approved → Final. Templates define sections, accent colour, cover page and contents. Exports produce real PDF (print), Word and CSV files.',
    roles: ['admin', 'director', 'cao', 'senior'],
    duration: '5 min',
    prereq: 'Sign in as Chief Audit Officer.',
    steps: [
      { t: 'navigate', text: 'Open Reports → Templates. Edit the "Detailed Audit Report" template: reorder sections, change the accent colour, toggle the contents page.' },
      { t: 'navigate', text: 'Open the Reports tab and click "+ Generate Report". Pick an audit and your template.' },
      { t: 'observe', text: 'View the draft: summary, findings, workflow history — then export to PDF or Word.' },
      { t: 'action', text: 'Advance the workflow: Send for Review → Approve (remarks required) → Mark Final & Issue.' },
      { t: 'observe', text: 'Each transition is recorded with user, time and remarks, and stakeholders are notified.' }
    ]
  },
  {
    id: 'flagged-payments',
    icon: '🔍',
    title: 'Review flagged payments (analytics)',
    intro: 'Work the anomaly screening queue: inspect why a payment was flagged, confirm or clear it with remarks, and explore the risk matrix.',
    about: 'Analytics & Risk screens transactions against rules (duplicates, round figures, split purchases, weekend transfers, vendor concentration). Each decision is recorded with remarks and visible in the review history.',
    roles: ['admin', 'director', 'cao', 'senior'],
    duration: '4 min',
    prereq: 'Sign in as Chief Audit Officer or Senior Audit Officer.',
    steps: [
      { t: 'navigate', text: 'Open Analytics & Risk → Flagged Payments tab.' },
      { t: 'action', text: 'Open a flagged transaction with the view icon — the modal explains exactly which rules fired.' },
      { t: 'action', text: 'Click "Confirm Anomaly" or "False Positive" with remarks — the decision is recorded and visible in the review history.' },
      { t: 'navigate', text: 'Switch to the Trends tab to show monthly trends and the 3-month compliance projection.' },
      { t: 'observe', text: 'Open the Risk Matrix tab: hover a heat cell for details, click it to jump to the underlying audits.' }
    ]
  },
  {
    id: 'teams-departments',
    icon: '👥',
    title: 'Manage teams and departments',
    intro: 'Build a reusable audit team, deactivate old ones, and maintain the department universe with profiles.',
    about: 'Teams are reusable staff groupings loaded at planning time; departments form the audit universe. Both support full CRUD, active/inactive status and filters.',
    roles: ['admin', 'director', 'cao'],
    duration: '4 min',
    prereq: 'Sign in as Chief Audit Officer.',
    steps: [
      { t: 'navigate', text: 'Open Teams. Filter by specialisation or status.' },
      { t: 'action', text: 'Create a team: pick a lead, add members via the people picker (search + role filters), and save.' },
      { t: 'action', text: 'Deactivate an old team with the pause icon — inactive teams cannot be assigned but keep their history.' },
      { t: 'navigate', text: 'Open Departments. Add a department, edit its head and budget, deactivate one.' },
      { t: 'action', text: 'Click into a department profile: audit history, units, coordinators and compliance posture.' },
      { t: 'observe', text: 'Use the back button (page or topbar) to return to the list.' }
    ]
  },
  {
    id: 'users-permissions',
    icon: '🛡',
    title: 'Users, permissions and the activity trail',
    intro: 'Administer accounts, tune what each role may do (including who can send reminders), and audit everything via the activity and communication logs.',
    about: 'The administration surface: user lifecycle, the editable permission matrix that drives every action button in the app, the complete activity trail, the reminders & escalations log, and login history with IP / browser / device.',
    roles: ['admin'],
    duration: '6 min',
    prereq: 'Sign in as Arjun Verma (System Administrator).',
    steps: [
      { t: 'navigate', text: 'Open Users & Roles. In the Users tab, add a user, reset a password, deactivate and reactivate an account.' },
      { t: 'action', text: 'Switch to Roles & Permissions, pick "Junior Audit Officer" and toggle "Send reminders" off — junior officers immediately lose the 🔔 buttons across the app. Toggle it back.', tip: 'Permissions are live: every action button checks this matrix.' },
      { t: 'navigate', text: 'Open Activity Log. Use the quick filter chips (Audits, Documents, System…), the user and date filters, and search.' },
      { t: 'action', text: 'Click any activity row to open its detail modal — user, action, entity, remarks, location and IP.' },
      { t: 'navigate', text: 'Switch to the Reminders & Escalations tab: the full communication log with manual + automatic entries, filterable by type and mode, exportable to CSV.' },
      { t: 'navigate', text: 'Switch to Login History & Sessions to show sign-ins with IP, browser and device.' },
      { t: 'navigate', text: 'Open Settings → Developer (last tab) for the SSO integration, environment configuration and email gateway outbox.' }
    ]
  },
  {
    id: 'documents-messages',
    icon: '🗂',
    title: 'Documents and messaging',
    intro: 'Version documents with notes, share them with notifications, and run direct + group conversations with the people picker.',
    about: 'The collaboration layer: a versioned document repository with inline preview (PDF, images, Word, CSV, text) and an internal messaging module with direct and group threads that sync live across tabs.',
    roles: ['admin', 'director', 'cao', 'senior', 'junior', 'coordinator'],
    duration: '5 min',
    prereq: 'Any account.',
    steps: [
      { t: 'navigate', text: 'Open Documents. Filter by file type (PDF) or category.' },
      { t: 'action', text: 'Preview a document inline, then use the ⇧ icon to upload a new version with a note — the version history keeps every note.' },
      { t: 'action', text: 'Share a document with specific people — they receive a notification with a link.' },
      { t: 'navigate', text: 'Open Messages: tabs separate All / Direct / Groups; groups show stacked avatars and participant names.' },
      { t: 'action', text: 'Start a new group message with the people picker (role and department filters) and send a reply.', tip: 'Open a second browser tab as another user — messages and notifications sync live.' }
    ]
  },
  {
    id: 'discussion',
    icon: '💬',
    title: 'Team discussion inside an audit',
    intro: 'Keep the conversation with the work: post to the audit team chat and watch every workspace action feed the action history.',
    about: 'The Discussion tab is the audit\u2019s own chat. Combined with the Overview action history, it gives a complete picture of who did what and what was said, in one place.',
    roles: ['admin', 'cao', 'senior', 'junior'],
    duration: '2 min',
    prereq: 'Sign in as a member of an audit team (e.g. Priya Yadav).',
    steps: [
      { t: 'navigate', text: 'Open any active audit and switch to the Discussion tab.' },
      { t: 'action', text: 'Post a message to the team — the chat shows sender names and roles, with your own messages aligned right.' },
      { t: 'observe', text: 'Open the Overview tab: every checklist update, evidence upload, finding and review action also lands in the action history — nothing in the app is untracked.' }
    ]
  }
]

/* ------------------------------------------------------------------ page */
export default function Guide() {
  const [tab, setTab] = useTabMemory('pages')
  const [openFlow, setOpenFlow] = useState(null)
  const [flowQuery, setFlowQuery] = useState('')
  const [flowRole, setFlowRole] = useState('all')

  // workflows matching the current search + role filter (the download-all
  // buttons export exactly this list, so a filter doubles as "export selection")
  const visibleFlows = useMemo(() => {
    const q = flowQuery.trim().toLowerCase()
    return FLOWS.filter((f) => {
      if (flowRole !== 'all' && !f.roles.includes(flowRole)) return false
      if (!q) return true
      const hay = [f.title, f.intro, f.about, f.prereq, ...f.steps.map((s) => `${s.text} ${s.tip || ''}`)].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [flowQuery, flowRole])

  return (
    <div>
      <PageHead
        title="Project Guide"
        sub="Everything in the platform explained — plus ready-to-use workflow documents"
      />

      <Tabs
        tabs={[
          { key: 'pages', label: 'Pages & Modules' },
          { key: 'flows', label: 'Workflows', count: FLOWS.length },
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

      {tab === 'flows' && !openFlow && (
        <div className="flex-col" style={{ gap: 14 }}>
          {/* toolbar: search, role filter and the whole-guide downloads */}
          <div className="card card-pad no-print" style={{ padding: '12px 14px' }}>
            <div className="flex" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="search-box" style={{ flex: '1 1 220px', minWidth: 200 }}>
                <input
                  className="input"
                  placeholder="Search workflows — title, step or tip text…"
                  value={flowQuery}
                  onChange={(e) => setFlowQuery(e.target.value)}
                />
              </div>
              <select className="select" style={{ width: 'auto' }} value={flowRole} onChange={(e) => setFlowRole(e.target.value)}>
                <option value="all">All roles</option>
                {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
              </select>
              <div style={{ flex: 1 }} />
              <span className="muted small">
                {visibleFlows.length} of {FLOWS.length} workflow{FLOWS.length === 1 ? '' : 's'}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                title="Open a print window with every workflow document — choose “Save as PDF” in the print dialog"
                onClick={() => downloadFlowsPDF(visibleFlows)}
              >
                <PrinterIcon size={14} /> Print all · PDF
              </button>
              <button
                className="btn btn-secondary btn-sm"
                title="Download every workflow document as a Word file (.doc) with the app's colours"
                onClick={() => downloadFlowsWord(visibleFlows)}
              >
                <DocumentTextIcon size={14} /> Word (.doc)
              </button>
            </div>
          </div>

          {visibleFlows.length === 0 && (
            <div className="card card-pad center muted">No workflow matches “{flowQuery}”. Try another term or clear the role filter.</div>
          )}

          <div className="grid grid-2">
          {visibleFlows.map((f) => (
            <div key={f.id} className="flow-card">
              <div className="card-head" style={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                <h3>{f.icon} {f.title}</h3>
                <span className="hint">{f.steps.length} steps · {f.duration}</span>
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div className="small" style={{ color: 'var(--text-2)', lineHeight: 1.55 }}>{f.intro}</div>
                <div className="flex mt-2" style={{ gap: 5, flexWrap: 'wrap' }}>
                  {f.roles.map((r) => (
                    <span key={r} className="tag" style={{ background: (ROLES[r] || {}).color + '14', color: (ROLES[r] || {}).color, borderColor: 'transparent' }}>
                      {(ROLES[r] || {}).label}
                    </span>
                  ))}
                </div>
                <div className="flex mt-2" style={{ gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setOpenFlow(f); window.scrollTo(0, 0) }}>
                    Open workflow document →
                  </button>
                  <button
                    className="btn-icon"
                    title="Download this workflow as Word (.doc)"
                    onClick={() => exportWord(`Workflow-${f.title.replace(/[^\w -]/g, '').trim().replace(/\s+/g, '-')}`, f.title, flowsToHTML([f]), WF_EXPORT_CSS)}
                  >
                    <DocumentTextIcon size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      {tab === 'flows' && openFlow && (
        <WorkflowDocument flow={openFlow} onBack={() => setOpenFlow(null)} />
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
              <div className="flex mt-2" style={{ gap: 6 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/users')}>View permissions →</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ workflow document */
function WorkflowDocument({ flow, onBack }) {
  return (
    <div className="card" style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="card-head" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 17 }}>{flow.icon} {flow.title}</h2>
          <div className="muted small" style={{ marginTop: 3, lineHeight: 1.5 }}>{flow.intro}</div>
        </div>
        <div className="flex no-print" style={{ gap: 6, flexShrink: 0 }}>
          <button className="btn btn-secondary btn-sm" onClick={onBack}>← All workflows</button>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()} title="Print this workflow — choose “Save as PDF” in the print dialog">🖨 Print / PDF</button>
          <button
            className="btn btn-secondary btn-sm"
            title="Download this workflow as Word (.doc)"
            onClick={() => exportWord(`Workflow-${flow.title.replace(/[^\w -]/g, '').trim().replace(/\s+/g, '-')}`, flow.title, flowsToHTML([flow]), WF_EXPORT_CSS)}
          >
            <DocumentTextIcon size={14} /> Word
          </button>
        </div>
      </div>
      <div className="card-pad">
        {/* meta */}
        <div className="flex mb-3" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="wf-meta-chip">⏱ {flow.duration}</span>
          <span className="wf-meta-chip">🔢 {flow.steps.length} steps</span>
          {flow.roles.map((r) => (
            <span key={r} className="wf-meta-chip" style={{ background: ((ROLES[r] || {}).color || '#888') + '12', borderColor: 'transparent', color: (ROLES[r] || {}).color }}>
              {(ROLES[r] || {}).label}
            </span>
          ))}
        </div>

        {/* about + prerequisites */}
        <div className="grid grid-2 mb-3">
          <div className="tl-body" style={{ background: 'var(--primary-softer)' }}>
            <div className="bold small" style={{ marginBottom: 3 }}>About this workflow</div>
            <span className="small" style={{ color: 'var(--text-2)' }}>{flow.about}</span>
          </div>
          <div className="tl-body" style={{ background: 'var(--surface-2)' }}>
            <div className="bold small" style={{ marginBottom: 3 }}>Before you start</div>
            <span className="small" style={{ color: 'var(--text-2)' }}>{flow.prereq}</span>
          </div>
        </div>

        {/* legend */}
        <div className="flex mb-2" style={{ gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(STEP_META).map(([k, m]) => (
            <span key={k} className={`st-chip ${m.cls}`}>{m.label}</span>
          ))}
        </div>

        {/* steps */}
        <div>
          {flow.steps.map((s, i) => {
            const meta = STEP_META[s.t] || STEP_META.info
            return (
              <div key={i} className="wf-step">
                <span className="fs-n">{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className={`st-chip ${meta.cls}`}>{meta.label}</span>
                  <div className="small" style={{ color: 'var(--text)', lineHeight: 1.55 }}>{s.text}</div>
                  {s.tip && <div className="st-tip">💡 {s.tip}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
