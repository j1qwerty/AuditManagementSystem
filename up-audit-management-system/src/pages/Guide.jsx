// Demo guide: in-app walkthrough so anyone can demo the platform confidently.
import { useData } from '../context/DataContext'
import { Link } from '../lib/router'
import config from '../lib/config'

const STEPS = [
  {
    title: '1 — Sign in as the Audit Director (or use SSO)',
    body: 'On the login page click the Audit Director demo account, or use the SSO button (simulated government single sign-on). Every role sees a different sidebar and dashboard — that is role-based access control (RBAC) in action.',
    to: '/dashboard'
  },
  {
    title: '2 — Review the executive dashboard',
    body: 'KPIs for active audits, open findings, flagged financial exposure and compliance rate. Charts show audit mix by type, findings by severity, and the highest-risk departments from the AI risk model.',
    to: '/dashboard'
  },
  {
    title: '3 — Open the Audit Planning module',
    body: 'The annual calendar lays out every audit month by month. The Risk Assessment tab shows the explainable AI risk register and 5×5 risk matrix. Resource Allocation shows team utilisation and unstaffed audits. Scheduling demonstrates automated notifications.',
    to: '/planning'
  },
  {
    title: '4 — Walk through an audit in execution',
    body: 'Open audit FA-…-001 (Health & Family Welfare). Move through the tabs: digital checklist, evidence store (files live in IndexedDB), findings with severity and amounts, work papers with review states, and the review workflow. Post a comment in the Discussion tab.',
    to: '/audits'
  },
  {
    title: '5 — Real-time collaboration demo',
    body: 'Open a second browser tab, sign in as a different team member (e.g. Junior Audit Officer) and open the same audit. Post a comment in one tab — it appears instantly in the other (BroadcastChannel sync). Same for messages and notifications.',
    to: '/messages'
  },
  {
    title: '6 — Department coordinator view',
    body: 'Sign in as the Department Coordinator (Sunita Devi). See pending queries on findings, respond to one, and check the compliance observations due for the Health department.',
    to: '/findings'
  },
  {
    title: '7 — Compliance tracking with escalation',
    body: 'The Compliance module shows time-bound tracking with ageing, a 3-level escalation matrix, follow-up scheduling and bulk overdue reminders (in-app notification + simulated email).',
    to: '/compliance'
  },
  {
    title: '8 — Analytics, AI screening and governance',
    body: 'Analytics shows trends, a 3-month predictive compliance projection, department benchmarking, and the anomaly screening queue from the mock PFMS feed. Accept or reject AI flags — every decision is logged (human-in-the-loop AI governance).',
    to: '/analytics'
  },
  {
    title: '9 — Reports with exports',
    body: 'Generate a report from a template (content is auto-filled from audit data), push it through Draft → In Review → Approved → Final, and export as PDF, Word or Excel.',
    to: '/reports'
  },
  {
    title: '10 — Administration',
    body: 'As the System Administrator: manage users, review the role-permission matrix, run integrations (PFMS sync is simulated), inspect the full activity trail, and export / import / reset all local data.',
    to: '/settings'
  }
]

export default function Guide() {
  const { data } = useData()
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Demo Guide</h1>
          <div className="sub">A 10-step walkthrough of the platform. Everything runs locally in your browser — IndexedDB for data and file blobs, localStorage for settings and session.</div>
        </div>
      </div>

      <div className="callout mb-3">
        <b>Demo accounts</b> — password for all: <b>{config.demoPassword}</b>. Roles: System Administrator, Audit Director,
        Chief Audit Officer, Senior Audit Officer, Junior Audit Officer, Department Coordinator. Each sees a different view.
      </div>

      <div className="grid-2">
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-head"><h3>Suggested demo script</h3><span className="hint">≈ 10 minutes</span></div>
          <div className="card-body">
            {STEPS.map((s) => (
              <div key={s.title} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="flex-between">
                  <b style={{ fontSize: 13.5 }}>{s.title}</b>
                  {s.to && <Link to={s.to} className="small">Open →</Link>}
                </div>
                <p className="small muted" style={{ marginTop: 4, lineHeight: 1.6 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Where the data lives</h3></div>
          <div className="card-body small" style={{ lineHeight: 1.7 }}>
            <p><b>IndexedDB</b> ({config.dbName}): users, departments, audits, findings, observations, documents, evidence blobs, messages, notifications, activity trail, transactions, reports, integrations.</p>
            <p><b>localStorage</b> (prefix “{config.storagePrefix}_”): your session, app settings, seeded flag.</p>
            <p><b>Nothing leaves this machine.</b> The app has no backend — it also works offline once loaded. Reset or wipe the data any time from Settings → Data & Storage.</p>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Feature coverage</h3><span className="hint">vs. requirement FR IDs</span></div>
          <div className="card-body small" style={{ lineHeight: 1.9 }}>
            <div>Users & RBAC — FR-001…005 · SSO simulated</div>
            <div>Departments — FR-010…013 (registry, org map, contacts, docs)</div>
            <div>Planning — FR-020…028 (calendar, risk, resources, scheduling)</div>
            <div>Execution — FR-030…038 (checklists, evidence, findings, review, collaboration)</div>
            <div>Reporting — FR-040…044 (templates, workflow, PDF/Word/Excel)</div>
            <div>Communication — FR-050…053 (messaging, notifications, email simulation)</div>
            <div>Compliance — FR-060…066 (tracking, follow-up, escalation, reminders)</div>
            <div>Dashboards & AI — FR-070…075 (KPIs, trends, projection, anomaly screening)</div>
            <div>Documents — FR-080…084 (repository, versions, sharing, trail)</div>
            <div>Integrations — FR-100…103 (PFMS mock, APIs, data exchange)</div>
            <div className="muted">Mobile app features (FR-090…095) are excluded per demo scope.</div>
          </div>
        </div>

        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-head"><h3>Troubleshooting</h3></div>
          <div className="card-body small" style={{ lineHeight: 1.8 }}>
            <div>• <b>Reset the demo:</b> Settings → Data & Storage → Reset demo data.</div>
            <div>• <b>Charts look stale:</b> data is live-computed from local records; a hard refresh (Ctrl+Shift+R) re-reads IndexedDB.</div>
            <div>• <b>Changed .env:</b> restart <code>npm run dev</code> — Vite reads VITE_* variables at startup.</div>
            <div>• <b>Storage:</b> the app needs IndexedDB enabled (normal in all modern browsers; not available in private windows in some browsers).</div>
            <div>• Current demo scale: {data.audits.length} audits, {data.findings.length} findings, {data.documents.length} documents, {data.users.length} users, {data.transactions.length} screened transactions.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
