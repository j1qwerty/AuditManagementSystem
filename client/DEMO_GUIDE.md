# 10-Minute Demo Script — UP Audit Management System

Run `npm install && npm run dev`, open the app, and follow this script. Every step lists what to click and what to say.

---

## 0. Setup (before the audience arrives)
- Open http://localhost:5193 (or `npm run preview` after a build).
- You land on the login page. Leave it there — the six demo accounts are visible, which is your first talking point: **six roles, one platform, role-based access**.

## 1. Sign in — Audit Director (1 min)
- Click the **Audit Director** card (Dr. Meena Sharma), or use **Continue with UP Parichay SSO (SSO)** to show the simulated government single sign-on.
- Say: "One click per role — let's start with strategic oversight."
- **Dashboard**: point at the KPI row (active audits, open findings, financial exposure ₹18.79 Cr, compliance rate), then the donut charts (audit mix, findings by severity) and the **highest-risk departments** ranking from the AI risk model.

## 2. Planning (1.5 min)
- Sidebar → **Audit Planning**.
- **Annual Calendar**: every audit placed month-by-month, colour-coded by type.
- **Risk Assessment**: the explainable AI risk register — click a department row, mention "the score comes with its factor breakdown, nothing is a black box". Show the 5×5 risk matrix.
- **Resource Allocation**: team utilisation bars + planned audits awaiting team assignment.
- **Scheduling & Notifications**: click **✉ Send schedule notifications** — "assignment notifications go out automatically; the bell icon shows them" (open the bell in the top bar).

## 3. Audit execution — the core workflow (2.5 min)
- Sidebar → **Audits** → open **FA-2026-001** (Health & Family Welfare, In Progress).
- Walk the tabs left to right:
  - **Checklist** — digital checklist grouped by category; progress recalculates automatically. (Sign in as a Junior Auditor later to actually tick items.)
  - **Evidence** — files stored as blobs in the browser's IndexedDB; click ⤓ to download one.
  - **Findings** — severity badges, amounts involved, due dates; open one to show the response thread.
  - **Observations** — compliance items with due dates, reminders (✉), escalation (▲) and resolution (✓).
  - **Work Papers** — Draft → Submitted → Reviewed → Approved states.
  - **Review** — the workflow stepper and CAO decision panel.
  - **Discussion** — team chat; keep this tab open for step 4.

## 4. Real-time collaboration — the wow moment (1 min)
- Open a **second browser tab**, sign in as **Junior Audit Officer (Amit Kumar)**, open the same audit → Discussion.
- Post a comment in one tab — it appears **instantly** in the other. Say: "BroadcastChannel sync — field team and reviewer are on the same page live."

## 5. Department coordinator — the other side of the table (1 min)
- Sign in as **Department Coordinator (Sunita Devi)**.
- Point out the different sidebar (no planning, no analytics — RBAC).
- **Findings** → open the unspent-balance finding → type a short response → **Send response**. The finding moves to *Under Review*.
- **Compliance Tracking** → show the ageing column and overdue items.

## 6. Compliance tracking & escalation (1 min)
- Sign in as **Chief Audit Officer**.
- **Compliance Tracking** → Overview: escalation matrix (L1 HoD → L2 Principal Secretary + Director → L3 CMO inclusion), compliance by department.
- **Open Observations** tab: click **✉** on an overdue row (reminder → notification + simulated email), then **▲** (escalate → Director notified). Show the bell icon lighting up.

## 7. Analytics & AI with governance (1 min)
- **Analytics & Risk** → **Trends & Prediction**: the dashed line is the 3-month compliance projection.
- **Fraud & Anomaly Screening**: the PFMS-screened transaction queue. Show the signal chips (duplicate payment, split purchase, vendor concentration, round-figure, weekend high-value).
- Click **Accept** on one flag and **Reject** on another. Say: "every AI flag needs a human decision, and the decision is logged — that's AI governance."

## 8. Reports (1 min)
- **Reports** → **+ Generate report** → template *Detailed Audit Report* → audit FA-2026-001 → **Generate draft report**.
- The content is auto-filled from live audit data. Show the export buttons: **PDF** (print dialog), **Word**, **Excel**.
- Submit for review → approve as CAO/Director → **Mark final & issue** (the department coordinator gets notified).

## 9. Administration wrap-up (0.5 min)
- Sign in as **System Administrator**:
  - **Users & Roles** → the module × role permission matrix.
  - **Integrations** → PFMS card → **⟳ Sync now** (simulated feed).
  - **Activity Log** — every action from this demo is already there.
  - **Settings** → Data & Storage: export full backup JSON, import, reset demo data.

## 10. Close
- **Demo Guide** page (sidebar, any role) — the same script lives inside the app.
- Say: "Everything you saw ran in the browser — IndexedDB for data and files, localStorage for session, zero servers. For production we'd put an auth provider, a database and the real PFMS/e-Office interfaces behind the same UI."

---

### Quick answers for likely questions
- **"Is the data real?"** — It's realistic seeded demo data with dates relative to today, so it always looks live. Reset any time from Settings.
- **"Where are files stored?"** — As Blobs in IndexedDB, downloadable locally.
- **"What about the mobile app?"** — The requirement's mobile-specific features (FR-090…095) are out of scope for this demo by design; the web app itself is responsive.
- **"Is the AI real?"** — It's a transparent rule-based model (see the factor breakdown on every risk score). The integration point for a real model is isolated in `src/lib/ai.js`.
- **"How do I configure it?"** — Everything is in the `.env` file — app name, FY, seeding, AI toggle, endpoints, limits. Restart the dev server after editing.
