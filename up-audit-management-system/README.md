# UP Audit Management System — Demo

A centralized, web-based **audit management platform** for government departments (Uttar Pradesh), built as a fully client-side demo. It covers the complete audit lifecycle — planning, execution, evidence, findings, compliance tracking, reporting, analytics and integrations — with **no backend at all**: all data lives in your browser (IndexedDB + localStorage).

Built with **React + Vite**. Clean, minimal UI. No chart libraries, no UI frameworks, no animations — only 3 runtime dependencies (react, react-dom and the dev toolchain).

---

## Quick start

```bash
# 1. install dependencies
npm install

# 2. start the dev server
npm run dev
# → open http://localhost:5173

# production build (optional)
npm run build
npm run preview
```

That's it. On first launch the app seeds realistic demo data into the browser. No server, no database, no API keys.

> Requirements: Node.js 18+ and a modern browser (Chromium-based, Firefox or Safari) with IndexedDB enabled.

---

## Demo accounts

Password for every account: **demo123** (configurable, see `.env`). On the login page you can also sign in with **one click** per role, or use the simulated government SSO button.

| Role | Name | Email | What to show with it |
| --- | --- | --- | --- |
| System Administrator | Arjun Verma | arjun.verma@up.gov.in | Users & roles, RBAC matrix, integrations, activity log, settings, data reset |
| Audit Director | Dr. Meena Sharma | meena.sharma@up.gov.in | Executive dashboard, analytics, report approvals, high-level oversight |
| Chief Audit Officer | Rajesh Kumar Singh | rajesh.singh@up.gov.in | Planning, team assignment, audit review/approval, escalations |
| Senior Audit Officer | Priya Yadav | priya.yadav@up.gov.in | Audit execution, findings, work papers, team coordination |
| Junior Audit Officer | Amit Kumar | amit.kumar@up.gov.in | Field checklists, evidence upload, work paper preparation |
| Department Coordinator | Sunita Devi | sunita.devi@up.gov.in | Department view: respond to findings, compliance reporting |

Each role sees a **different sidebar and dashboard** — that's role-based access control (RBAC) in action.

---

## Configuration — everything via `.env`

All runtime configuration is handled through the `.env` file (copy `.env.example` if `.env` is missing). Restart the dev server after changes.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_APP_NAME` | UP Audit Management System | App name shown in UI |
| `VITE_APP_SHORT_NAME` | UP-AMS | Short brand in the sidebar |
| `VITE_ORG_NAME` | Government of Uttar Pradesh | Organisation branding |
| `VITE_ORG_UNIT` | State Audit Department | Unit branding |
| `VITE_DEMO_MODE` | true | Shows demo banners and demo accounts on login |
| `VITE_SEED_DEMO_DATA` | true | Seed realistic demo data on first run |
| `VITE_RESET_DATA_ON_VERSION_CHANGE` | true | Re-seed when the seed version changes |
| `VITE_DEMO_PASSWORD` | demo123 | Password for all seeded accounts |
| `VITE_ENABLE_AI_FEATURES` | true | Risk scoring, anomaly screening, predictive compliance |
| `VITE_AI_MODEL_LABEL` | Rule-based demo model v1 | Label shown next to AI outputs |
| `VITE_SSO_ENABLED` | true | Show the simulated SSO button |
| `VITE_SSO_PROVIDER_NAME` | UP Parichay SSO | SSO provider label |
| `VITE_PFMS_ENDPOINT` | https://pfms-demo.example.gov.in/api/v2 | Mock PFMS endpoint |
| `VITE_EOFFICE_ENDPOINT` | … | Mock e-Office endpoint |
| `VITE_KOSH_ENDPOINT` | … | Mock treasury endpoint |
| `VITE_DDO_ENDPOINT` | … | Mock DDO API endpoint |
| `VITE_DB_NAME` / `VITE_DB_VERSION` | up_ams_db / 1 | IndexedDB name & version |
| `VITE_STORAGE_PREFIX` | upams | localStorage key prefix |
| `VITE_SYNC_CHANNEL` | up-ams-sync | BroadcastChannel name (cross-tab sync) |
| `VITE_DEFAULT_PAGE_SIZE` | 10 | Table pagination size |
| `VITE_MAX_UPLOAD_MB` | 10 | Upload limit for evidence/documents |
| `VITE_CURRENCY` | INR | Currency label |
| `VITE_FISCAL_YEAR` | auto | `auto` = derive Indian FY (Apr–Mar) from today, or e.g. `2025-26` |
| `VITE_SESSION_TIMEOUT_MINUTES` | 0 | 0 = never expire (demo-friendly) |
| `VITE_EMAIL_SIMULATION` | true | Outbound email is simulated into an outbox log |
| `VITE_EMAIL_DOMAIN` | up.gov.in | Domain for simulated emails |

---

## What's inside (feature coverage vs. the requirement)

| Requirement area | FR IDs | Where in the app |
| --- | --- | --- |
| Users, RBAC, profiles, activity trail, SSO | FR-001…005 | Login (one-click roles + simulated SSO), Users & Roles (permission matrix), My Profile, Activity Log |
| Department registry, org mapping, contacts, dept docs | FR-010…013 | Departments list + department profile page |
| Annual calendar, teams, periods, resources, scheduling, risk assessment, predictive analytics, anomaly detection, benchmarking | FR-020…028 | Audit Planning (4 tabs) + Analytics |
| Checklists, evidence, findings, review workflow, real-time collaboration, progress, observations, work papers | FR-030…038 | Audit detail workspace (8 tabs) |
| Automated reports, executive dashboards, templates, PDF/Word/Excel export, draft→final workflow | FR-040…044 | Reports module + Dashboard + Analytics |
| Messaging, notifications, email integration, sharing | FR-050…053 | Messages, notification bell, Settings → Email outbox, Documents → Share |
| Observation tracking, compliance monitoring, follow-ups, escalation, time-bound tracking, reminders, resolution | FR-060…066 | Compliance Tracking (3 tabs incl. escalation matrix) |
| Executive dashboards, metrics, trends, compliance indicators, custom views, risk scoring, fraud detection | FR-070…075 | Dashboard (role-aware) + Analytics (4 tabs) |
| Document repository, versioning, sharing, audit trail, search | FR-080…084 | Document Repository |
| Mobile application | FR-090…095 | **Excluded from this demo by design** |
| PFMS, third-party APIs, SSO, data exchange | FR-100…103 | Integrations (simulated) + JSON export/import in Settings |

**AI governance**: all "AI" features (risk scores, anomaly flags, compliance projection) are a transparent, deterministic rule-based model. Risk scores show their factor breakdown; anomaly flags must be **accepted or rejected by a human** before action, and every decision is logged — demonstrating explainability and human-in-the-loop review.

**Non-functional demo aspects**: works offline once loaded (local-first), instant performance (no network), data retention policy + backup/restore (JSON export/import), full activity audit trail, zero data leaving the machine.

---

## Architecture

```
src/
├── lib/
│   ├── config.js        # .env reader with safe defaults
│   ├── db.js            # promise-based IndexedDB wrapper (16 stores)
│   ├── storage.js       # localStorage helpers (session, settings)
│   ├── seed.js          # realistic demo dataset (dates relative to today)
│   ├── ai.js            # rule-based risk scoring, anomaly detection, projection
│   ├── permissions.js   # RBAC: 6 roles, module + action matrices
│   ├── exporters.js     # PDF (print), Word (.doc), Excel (CSV), JSON
│   ├── utils.js         # dates, INR formatting (lakh/crore), helpers
│   └── router.jsx       # tiny hash router (no react-router dependency)
├── context/
│   ├── AuthContext.jsx  # session, login, simulated SSO
│   └── DataContext.jsx  # IndexedDB ↔ React state, CRUD, activity trail,
│                        # notifications, cross-tab sync (BroadcastChannel)
├── components/          # ui.jsx (primitives), charts.jsx (SVG), layout.jsx
└── pages/               # 18 routes, role-aware dashboards, admin section
```

- **Storage split**: entity data + file blobs → **IndexedDB**; session + app settings → **localStorage**.
- **Real-time collaboration (FR-034)**: open the app in two tabs (any two users), post a comment or message — it appears in both tabs instantly via `BroadcastChannel`.
- **Files** (evidence, documents) are stored as Blobs in IndexedDB and download straight from the browser.

---

## Reset / data management

- **Reset demo data**: Settings → Data & Storage → *Reset demo data* (as Administrator).
- **Full backup**: export everything as JSON; import on any other machine/browser.
- **Wipe**: start with an empty system (then clear site data once to re-seed).

## Troubleshooting

- *Changed `.env`* → restart `npm run dev` (Vite reads `VITE_*` at startup).
- *Stale view after playing with data* → hard refresh (Ctrl/Cmd+Shift+R).
- *Private/incognito windows*: some browsers disable IndexedDB there — use a normal window.
- *Nothing seeds*: check that `VITE_SEED_DEMO_DATA=true` and IndexedDB isn't blocked.

## Demo limitations (by design)

- No real backend, no real authentication (passwords stored in clear, in the browser only).
- PFMS/e-Office/Kosh/DDO integrations are **simulated** — no network calls are made.
- Email is simulated (written to an outbox log).
- "AI" is a transparent rule-based model, not machine learning.

See **DEMO_GUIDE.md** for a ready-made 10-minute demo script.
