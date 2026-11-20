# Audit Management System (AMS)

A centralized, web-based **audit management platform** covering the complete audit lifecycle — planning, execution, evidence, findings, compliance tracking, reporting and analytics.

Fully client-side: all data lives in the browser (**IndexedDB + localStorage**). No backend, no server, no API keys.

Built with **React + Vite**. Clean, minimal pastel UI. No chart libraries, no UI frameworks — only React as a runtime dependency.

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

On first launch the app seeds a realistic workspace (departments, audits, findings, teams, documents, messages, activity history). No configuration needed.

> Requirements: Node.js 18+ and a modern browser with IndexedDB enabled.

---

## Accounts

Password for every account: **demo123** (configurable, see `.env`). The sign-in page also offers one-click access per role and an SSO button.

| Role | Name | Email | What to show with it |
| --- | --- | --- | --- |
| System Administrator | Arjun Verma | arjun.verma@auditms.in | Users & roles, permission matrix, activity log + login history, settings, project guide |
| Audit Director | Dr. Meena Sharma | meena.sharma@auditms.in | Executive dashboard, analytics, final report approval, escalations |
| Chief Audit Officer | Rajesh Kumar Singh | rajesh.singh@auditms.in | Planning, team assignment, audit review/approval, escalations |
| Senior Audit Officer | Priya Yadav | priya.yadav@auditms.in | Audit execution, findings, work papers, team coordination |
| Junior Audit Officer | Amit Kumar | amit.kumar@auditms.in | Field checklists, evidence upload, work paper preparation |
| Department Coordinator | Sunita Devi | sunita.devi@auditms.in | Department responses to findings, compliance follow-up |

## What's inside

| Module | Highlights |
| --- | --- |
| **Dashboard** | Role-aware KPIs, clickable charts and tables, deadlines, pending approvals |
| **Audit Planning** | Annual plan with full CRUD, quarterly calendar, department risk scoring, resource workload |
| **Audit Workspace** | 8 tabs — Overview, Checklist (template library + custom), Evidence (upload/preview/versions), Findings, Observations, Work Papers, Review (with remarks), Discussion |
| **Compliance Tracking** | Reminders, level 1–4 escalation with remarks, resolution tracking, full history |
| **Analytics & Risk** | Trends & projection, risk heatmap, department benchmarking, flagged payment review |
| **Reports** | Template designer (sections, colours, cover/TOC), draft → review → approve → final workflow, PDF/Word/CSV export |
| **Teams** | Reusable teams with lead + members, active/inactive, loadable into planning |
| **Documents** | Version control, inline preview (PDF/image/text/CSV/Word), sharing with notifications |
| **Messages** | Direct + group conversations with search and role/department filters |
| **Users & Roles** | User CRUD + an **editable permission matrix** per role |
| **Activity Log** | Every tracked action + login history with IP, browser and device |

Every action across the app is recorded in the activity trail and audit timelines; notifications are colour-coded and carry the remarks of the action that triggered them.

## Configuration

All runtime configuration lives in **`.env`** (see `.env.example` for the full list): branding, fiscal year, SSO, seeding, storage, page size, uploads, email gateway and more. Adjust the file and restart the dev server.

## Data & privacy

- Everything is stored locally in the browser (IndexedDB for entities and file blobs, localStorage for the session and small settings).
- **Settings → Data** offers backup (JSON), restore, reset and clear.
- Multiple tabs stay in sync automatically (open two tabs as two users to see live updates).
- Nothing ever leaves the machine.

## Project structure

```
src/
  components/   ui.jsx (DataTable, UserPicker, FilePreview…), charts.jsx, layout.jsx
  context/      AuthContext (sessions, login events), DataContext (CRUD, activity, notify)
  lib/          config (.env), db (IndexedDB), seed, permissions (RBAC), ai (risk/anomalies), exporters
  pages/        one file per module + admin/ (Users, ActivityLog, Settings)
```
