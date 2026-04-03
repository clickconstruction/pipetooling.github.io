# AI Agent Instructions

> **Start here.** Read [AI_CONTEXT.md](./AI_CONTEXT.md) for the full project overview, code map, and documentation index. This file is the entry point; AI_CONTEXT.md is the source of truth.

---

## Quick Orientation

**PipeTooling** — Workflow management for master plumbers. React + TypeScript + Supabase. 7 roles, 4 major systems (Projects/Workflows, Bids, Materials, Checklist). ~50+ tables with RLS.

---

## Where to Look For...

| Need | Documentation |
|------|---------------|
| Database schema, tables, columns | `PROJECT_DOCUMENTATION.md` → "Database Schema" section |
| User role permissions | `ACCESS_CONTROL.md` → Page/Feature access matrices |
| Adding a new role | `ADDING_A_NEW_ROLE.md` → Step-by-step guide |
| Term definitions | `GLOSSARY.md` → All domain terms and concepts |
| Recent changes and features | `RECENT_FEATURES.md` → Chronological updates |
| Bids system | `BIDS_SYSTEM.md` → Complete workflow documentation |
| Edge Functions API | `EDGE_FUNCTIONS.md` → All Edge Functions with examples |
| Migration history | `MIGRATIONS.md` → All migrations by date and category |
| Apply migrations / run SQL on linked Supabase (when Docker local unavailable) | Cursor **Supabase MCP** — read tool descriptors in `.cursor/.../mcps/` first; `apply_migration` for new files, `execute_sql` for ad-hoc queries; see [Supabase MCP](#supabase-mcp-cursor) below |
| Workflow features | `WORKFLOW_FEATURES.md` → Stage management, financials |
| Clock In/Out, pending sessions, Revoke, accountability, Quickfill Hours, Crew Jobs / Bids, unified job/bid search, Pay Report Jobs/Bids | `RECENT_FEATURES.md` → v2.100, v2.105, v2.114, v2.120; `PROJECT_DOCUMENTATION.md` → Dashboard, Hours, Quickfill, People; `GLOSSARY.md` → Clock Sessions |
| Testing without credentials (dev login) | `EDGE_FUNCTIONS.md` → dev-login; `/dev-login?as=<existing-email>` when `import.meta.env.DEV`; email must exist in auth.users (e.g. robert@douglasmining.com); set `VITE_DEV_LOGIN_SECRET` and `DEV_LOGIN_SECRET` |
| Set password (dev) | `EDGE_FUNCTIONS.md` → set-user-password; Settings → Active Accounts → Set password for another user |
| Dev Ignored Tasks, Recently Completed Tasks, button icons | `RECENT_FEATURES.md` → v2.110, v2.111; `PROJECT_DOCUMENTATION.md` → Dashboard; `GLOSSARY.md` → Ignored section |
| approve_clock_sessions RPC 404 / client-side | `RECENT_FEATURES.md` → v2.125; `TROUBLESHOOTING.md` → RPC 404; `TROUBLESHOOT_404.md` |
| Project superintendent assignment, Projects page master/superintendents display | `RECENT_FEATURES.md` → v2.127, v2.128; `ACCESS_CONTROL.md` → superintendent section; `PROJECT_DOCUMENTATION.md` → projects, project_superintendents |
| Job–Project link, linking jobs to projects for multi-phase billing | `RECENT_FEATURES.md` → v2.129; `PROJECT_DOCUMENTATION.md` → Jobs, projects; `MIGRATIONS.md` → 20260320140000 |
| Workflow step card collapse, collapsed header, button styling | `RECENT_FEATURES.md` → v2.132; `PROJECT_DOCUMENTATION.md` → Workflow; `WORKFLOW_FEATURES.md` |
| Collapse old stages toggle, stage breadcrumb below buttons, no-wrap scroll | `RECENT_FEATURES.md` → v2.135; `WORKFLOW_FEATURES.md` → Collapse Old Stages Toggle, Stage Breadcrumb Layout |
| Workflow Approve/Previous work incomplete, private notes (dev/master/assistant/superintendent) | `RECENT_FEATURES.md` → v2.133, v2.134, v2.137; `ACCESS_CONTROL.md` → Workflow; `WORKFLOW_FEATURES.md` |
| Line Items For Office, supply house invoice linking | `RECENT_FEATURES.md` → v2.136; `WORKFLOW_FEATURES.md` → Line Items For Office; `PROJECT_DOCUMENTATION.md` → workflow_step_line_items |
| Jobs Edit billing comma fields; Workflow line `item_date` + clipboard bulk import | `RECENT_FEATURES.md` → v2.181; `WORKFLOW_FEATURES.md` → Line Items For Office; `PROJECT_DOCUMENTATION.md` → Jobs §6, workflow_step_line_items; `MIGRATIONS.md` → 20270329210000; `src/lib/parseWorkflowLineItemPaste.ts`; `src/components/MoneyDecimalAmountInput.tsx` |
| Client auth (**`AuthProvider`**, **`useAuth`**) | `src/hooks/useAuth.ts`; `src/main.tsx` wraps **`App`** |
| Clock In / Update Focus: assigned jobs auto-load; **no assigned jobs** info toast once per modal (ToastContext stable value + ref); modal field borders / focus | `RECENT_FEATURES.md` → v2.182, v2.191; `PROJECT_DOCUMENTATION.md` → Dashboard **Clock In/Out**, `ToastContext`; `src/components/ClockInOutButton.tsx`; `src/contexts/ToastContext.tsx` |
| GitHub Pages **GET /route 404** in Network (SPA), Hard Reload document request | `TROUBLESHOOT_404.md`; `src/lib/hardReload.ts`; `index.html`; `PROJECT_DOCUMENTATION.md` → Deployment |
| Jobs Stages + Workflow **job thread notes** (`jobs_ledger_thread_notes`); **Last activity** preview column; composer **Enter** / **Shift+Enter**; dropped `stage_notes` | `RECENT_FEATURES.md` → v2.183–v2.185; `PROJECT_DOCUMENTATION.md` → Jobs §6, Workflow; `MIGRATIONS.md` → `20260330023918`; `src/components/JobThreadNotesPanel.tsx`; `src/hooks/useJobThreadNotes.ts`; `src/pages/Jobs.tsx` |
| **Invoice / Update** (Ready to Bill): Linked **`jobs_ledger.customer_id`** required (Jobs: toast + Edit Job **`billingCustomerHighlight`**; Dashboard: toast); Stripe **`create-stripe-invoice`** + **`stripe-webhook`**; **`get_jobs_ledger_by_status`** includes **`customer_id`** (`20260330065236`); **`SendRecordInvoiceModal`** on Jobs + Dashboard; Ham mode instant billed on Jobs (customer-gated) | `RECENT_FEATURES.md` → v2.190, v2.187; `EDGE_FUNCTIONS.md` → **create-stripe-invoice**, **stripe-webhook**; `MIGRATIONS.md` → `20260330045018`, `20260330065236`; `src/components/jobs/SendRecordInvoiceModal.tsx`; `src/pages/Jobs.tsx`; `src/pages/Dashboard.tsx` |
| Settings **Templates & testing** (dev): **Workflow email (Edge Function)** smoke test for **`send-workflow-notification`**; **`test-email`** / **`send-workflow-notification`** gateway **`verify_jwt`** in `supabase/config.toml` | `RECENT_FEATURES.md` → v2.186; `EDGE_FUNCTIONS.md` → **send-workflow-notification**, **test-email**; `WORKFLOW_EMAIL_TESTING.md` → Quick smoke test; `src/pages/Settings.tsx` |
| Settings **Salaried workday** (collapsible); **`people_pay_config`** self-read for salary Settings; Dashboard **Currently In** scope toggles without overlay frame | `RECENT_FEATURES.md` → v2.206; `MIGRATIONS.md` → `20270331160000`; `src/pages/Settings.tsx`; `src/components/SalaryWorkScheduleSettings.tsx`; `src/components/DashboardTeamActiveClockStrip.tsx` |
| Salaried workday **end-time hints** (Day end / session ends, `+1 day`), **split** first-block default when switching layout; **`salary_sync`** no duplicate INSERT after split (`20270402100000`) | `RECENT_FEATURES.md` → v2.228; `MIGRATIONS.md` → `20270402100000`; `SalaryWorkScheduleSettings.tsx`; `salaryScheduleEndTimeDisplay.ts` |
| Dispatch dismissals, closed note, inbox thread notes | `RECENT_FEATURES.md` → v2.169, v2.136; `MIGRATIONS.md`; `GLOSSARY.md` → Task Dispatch |
| Superintendent Jobs: Reports + Sub Ledger only (no Stages, Billing) | `RECENT_FEATURES.md` → v2.138; `ACCESS_CONTROL.md` → superintendent; `MIGRATIONS.md` → 20260623190000 |
| Dashboard Assigned Jobs, Superintendent Jobs, in-progress stage banner, Choose from my jobs | `RECENT_FEATURES.md` → v2.142; `PROJECT_DOCUMENTATION.md` → Dashboard; `MIGRATIONS.md` → 20260624000000_allow_superintendent_send_to_billing |
| Remove specific pins, Page pins for assistants | `RECENT_FEATURES.md` → v2.147; `PROJECT_DOCUMENTATION.md` → Settings, Dashboard |
| Bid Board All notes (unified timeline), customer notes cards, `customer_contacts.contact_method` | `RECENT_FEATURES.md` → v2.148; `PROJECT_DOCUMENTATION.md` → Bids; `MIGRATIONS.md` → 20260324120000 |
| Clock sessions table (time/location, merged notes+job, accountability lines), pending Approve/Reject/Edit order, My Roles Goals gate, `user_dashboard_goals` / `user_daily_goals_ack` | `RECENT_FEATURES.md` → v2.149; `PROJECT_DOCUMENTATION.md` → Dashboard, People Hours, Quickfill, Settings; `MIGRATIONS.md` → 20260329120000; `GLOSSARY.md` → Clock Sessions |
| Job Parts Tally **Transactions** tab: **search** ([`tallyTransactionSearch.ts`](src/lib/tallyTransactionSearch.ts)); **Mercury note** icon ([`MercuryTransactionNoteIcon.tsx`](src/components/icons/MercuryTransactionNoteIcon.tsx)); **`parseTallyJobSplitsJson`** ([`tallyJobSplits.ts`](src/lib/tallyJobSplits.ts)); [`TallyJobTransactionsModal.tsx`](src/components/tally/TallyJobTransactionsModal.tsx) | `RECENT_FEATURES.md` → v2.225; `PROJECT_DOCUMENTATION.md` → Jobs §6a |
| Quickfill **section** **`h2`** titles + **dividers**; **Banking sorting** snapshot **Link…** in Person/Jobs (no Link column); **People Hours (new)** assistance notice; **Jobs Billing** **Min HCP** filter | `RECENT_FEATURES.md` → v2.224; [`Quickfill.tsx`](src/pages/Quickfill.tsx); [`BankingSortingSnapshotSection.tsx`](src/components/quickfill/BankingSortingSnapshotSection.tsx); [`QuickfillPeopleHoursNewSection.tsx`](src/components/quickfill/QuickfillPeopleHoursNewSection.tsx); [`JobsBillingReminderSection.tsx`](src/components/quickfill/JobsBillingReminderSection.tsx) |
| Quickfill **Banking sorting** snapshot: parallel Mercury relations + nickname maps; **Total available** count | `RECENT_FEATURES.md` → v2.222; `PROJECT_DOCUMENTATION.md` → Quickfill; [`BankingSortingSnapshotSection.tsx`](src/components/quickfill/BankingSortingSnapshotSection.tsx) |
| **Crew Jobs / Bids** Realtime in **`CrewJobsBlock`**; **`clock_sessions`** trigger syncs crew rows on job/bid assign | `RECENT_FEATURES.md` → v2.223; `PROJECT_DOCUMENTATION.md` → Quickfill; `MIGRATIONS.md` → **`20260402120000_clock_sessions_sync_crew_assignments_trigger.sql`**; [`CrewJobsBlock.tsx`](src/components/CrewJobsBlock.tsx) |
| Dashboard My Team: Clock activity above Active/Pending, plain "Clock activity" label, pending banner full-bar jump + expand | `RECENT_FEATURES.md` → v2.153; `PROJECT_DOCUMENTATION.md` → Dashboard |
| Dashboard Currently clocked in strip (below pins): Today hours, My team/Everyone toggle (dev/master/assistant); Materials supply house `website_url` + Open website | `RECENT_FEATURES.md` → v2.163; `PROJECT_DOCUMENTATION.md` → Dashboard, Materials Supply Houses, `supply_houses`; `src/hooks/useDashboardMyTeamSectionState.ts`; `src/components/DashboardTeamActiveClockStrip.tsx` |
| Layout **header** shared **height** (Task Dispatch, Estimator Inbox, Task, **Bid**); Dashboard strip **Assign** optimistic job/bid + **`loadPending` Promise.all**; **Calendar** month grid bottom chips **centered** | `RECENT_FEATURES.md` → v2.214; `PROJECT_DOCUMENTATION.md` → Dashboard **Currently clocked in**, Calendar §7, `Layout.tsx` component notes; `src/components/Layout.tsx`; `src/components/clock-sessions/AssignSessionJobPopover.tsx`; `src/hooks/useDashboardMyTeamSectionState.ts`; `src/components/DashboardTeamActiveClockStrip.tsx`; `src/pages/Dashboard.tsx`; `src/pages/Calendar.tsx` |
| Dashboard **Jobs worked today** (below Clocked in today): collapsible by job; **two-column** table—job link + inline **`[ hours • people ]`**, address on second line; per-job session detail **`colSpan` 2; `jobsWorkedTodayStripRows` | `RECENT_FEATURES.md` → v2.203, v2.202; `PROJECT_DOCUMENTATION.md` → Dashboard; `src/components/DashboardTeamActiveClockStrip.tsx`; `src/hooks/useDashboardMyTeamSectionState.ts` |
| Dashboard **My Time** / **Edit time** (this-week-only save, Form vs Visual defaults, timeline + form grid, merge + job-choice modal, `segmentJobOverrides`; **Option A** `can_edit_clock_sessions_for_user` for master/assistant/superintendent; merge-after-split reducer **v2.216**) | `RECENT_FEATURES.md` → v2.216, v2.193, v2.192, v2.179; `ACCESS_CONTROL.md` → Dashboard matrix; `MIGRATIONS.md` → `20260401190823`, `20260328220000`; `src/components/DashboardMyTimeSection.tsx`; `src/components/DashboardMyTimeDayEditorModal.tsx`; `src/components/my-time-day-editor/`; `src/lib/myTimeDayTimeline.ts`; `src/lib/myTimeDaySavePlan.ts` |
| Dashboard **NCNS** (team My Time from clock strip): **`record_ncns_and_reject_sessions_for_day`**, **`attendance_incidents`**; extra confirm if **approved** sessions (payroll + trust) | `RECENT_FEATURES.md` → v2.209; `ACCESS_CONTROL.md` → Dashboard matrix; `MIGRATIONS.md` → `20260331232529`; `src/components/DashboardMyTimeDayEditorModal.tsx`; `src/pages/Dashboard.tsx` |
| People **Writeups** unified timeline (**writeups** + read-only **NCNS** from **`attendance_incidents`**) | `RECENT_FEATURES.md` → v2.210; `ACCESS_CONTROL.md` → People matrix; `src/components/writeups/WriteupsContractsSubTab.tsx`; `src/components/writeups/NcnsDetailModal.tsx`; `src/components/writeups/writeupsTimelineTypes.ts`; `src/pages/People.tsx` |
| **Calendar** NCNS + **recorded time** + salary (**scheduled** forward-only after today; **PTO** all days; `showScheduledSalaryProjectionForYmd`) | `RECENT_FEATURES.md` → v2.212; `ACCESS_CONTROL.md` → Calendar matrix; `MIGRATIONS.md` → `20260401004452`; `src/pages/Calendar.tsx`; `src/lib/calendarClockedHoursByDate.ts` |
| Bids New/Edit modal: **`SearchableSelect`**, responsive `bid-form-top-fields`, Address + Distance/Plan Pages row, **720px**; Layout **Bid** header alignment | `RECENT_FEATURES.md` → v2.180; `BIDS_SYSTEM.md` → Edit Bid Modal; `PROJECT_DOCUMENTATION.md` → Bids; `src/components/SearchableSelect.tsx`; `src/pages/Bids.tsx`; `src/components/Layout.tsx` |
| Team feedback (dev): eligibility overview per-user Reset, submit `reviewer_user_id` from session, `team_feedback_submissions_select_own` migration, raw submissions names + CSV | `RECENT_FEATURES.md` → v2.162; `MIGRATIONS.md` → 20270329140000; `src/lib/teamFeedback.ts`; `src/components/team-feedback/` |
| Settings: Sharing and Adoption merged into **People & accounts** (`settings-people`); no `settings-sharing` jump | `RECENT_FEATURES.md` → v2.165; `PROJECT_DOCUMENTATION.md` → Settings §9; `ACCESS_CONTROL.md` → Settings matrix |
| Pay History: Ledger **Less** + **Additional** (qty × rate modal) + **Net Pay** (gross − Less + Additional); **Partial** installments (`pay_stub_payments`) capped at net; ledger name search; **Print** in ledger (no row **View**; bulk **Generate Pay Reports** modal still has **View**); dev delete as red trash icon | `RECENT_FEATURES.md` → v2.170, v2.172, v2.173, v2.174; `PROJECT_DOCUMENTATION.md` → People; `GLOSSARY.md` → pay_stub_payments, pay_stub_additional_lines; `src/lib/payStubPayments.ts`; `src/lib/payStubDeductions.ts`; `src/components/pay/PayStubLessModal.tsx`; `src/components/pay/PayStubAdditionalModal.tsx`; `src/components/pay/PayStubDeleteIcon.tsx` |
| People **Housing** tab (`housing_units`, `housing_possessions`); pay stub HTML **Housing** after vehicles | `RECENT_FEATURES.md` → v2.177; `ACCESS_CONTROL.md` → People; `MIGRATIONS.md` → 20270329180000; `PROJECT_DOCUMENTATION.md` → People; `src/pages/People.tsx` |
| People roster **`primary`** / **`superintendent`** on `people`; Pay/Hours via `allRosterNames`; backfill `20260329042321` | `RECENT_FEATURES.md` → v2.178; `MIGRATIONS.md` → 20260329042321; `PROJECT_DOCUMENTATION.md` → People; `src/pages/People.tsx`; `src/pages/Jobs.tsx`; `ReceivablesSection.tsx` |
| People Hours: Correct-day audit **Edit** (crew + clock + add session); **ClockSessionEditSplitModal**; **Highlight by job** on grid | `RECENT_FEATURES.md` → v2.171; `PROJECT_DOCUMENTATION.md` → People, Quickfill; `src/components/PeopleHoursDayAuditModal.tsx`; `src/pages/People.tsx` |

---

## Critical Constraints (Non-Negotiable)

1. **Never edit existing migrations** — Append-only. Create new migration to change schema.
   - **Always create new migration files with the CLI** — Run `supabase migration new short_description_of_change` (snake_case description). Never invent timestamps, copy an existing migration file and tweak the name, or add a second file that shares the same `YYYYMMDDHHMMSS` prefix as another file in `supabase/migrations/` (one version number → one SQL file). Edit the generated file, then apply via `supabase db push` (or MCP `apply_migration` on that file).
2. **Always add RLS policies** — Every new table needs SELECT/INSERT/UPDATE/DELETE for all 6 roles.
3. **Update types after schema changes** — **`2>/dev/null`** keeps the Supabase CLI’s stderr noise (login hints, update banners) out of `src/types/database.ts`. Examples: `supabase gen types typescript --local > src/types/database.ts 2>/dev/null`, or linked: `… --linked > src/types/database.ts 2>/dev/null`. Shortcuts: `npm run gen-types:local` / `npm run gen-types:linked`. If generation fails or the file looks wrong, rerun the same command **without** `2>/dev/null` to read the real error.
4. **No `any` types** — TypeScript strict mode. Use proper types or `unknown`.
5. **Wrap Supabase calls** — Use `withSupabaseRetry()` from `@/utils/errorHandling`
6. **Test all 7 roles** — dev, master, assistant, subcontractor, estimator, primary, superintendent

---

## Supabase MCP (Cursor)

When this workspace has the **Supabase MCP** server enabled, agents can apply new migration files and run SQL against the **linked** project via MCP (useful when local Docker / `supabase db reset` is not available). **Create the migration file first** with `supabase migration new …`, then edit it; use MCP `apply_migration` only for that generated path. **Always read each tool’s JSON descriptor** under the project’s `mcps` folder before calling — e.g. `execute_sql` for validation or reads, `apply_migration` to apply a file under `supabase/migrations/`. This does not replace **Critical Constraints** item 3: after schema changes, still regenerate `src/types/database.ts` (see item 3 for `2>/dev/null` and npm scripts).

---

## Next Steps

1. **Read [AI_CONTEXT.md](./AI_CONTEXT.md)** — Full overview, file structure, patterns, glossary
2. **Consult the table above** — For your task, open the relevant doc
3. **Review code** — `src/pages/` for UI, `supabase/` for backend
4. **Check RECENT_FEATURES.md** — For context on recent changes
5. **Ask before changing** — Clarify requirements if unclear

---

*Full documentation lives in [AI_CONTEXT.md](./AI_CONTEXT.md). Keep that file updated; this file stays minimal.*
