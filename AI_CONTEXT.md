# AI Context - Quick Project Overview

> **Purpose**: This file provides a 30-second overview of PipeTooling for AI agents and new developers. Read this first, then consult specialized documentation as needed.

---

## Project in 30 Seconds

**PipeTooling** is a workflow management system for master plumbers to track work across multiple projects and crews.

- **Domain**: Commercial/residential plumbing project management + bid estimation
- **Stack**: React + TypeScript + Supabase (PostgreSQL + Auth + RLS + Edge Functions)
- **Deployment**: GitHub Pages (static hosting)
- **Users**: 7 roles with complex access control (dev, master, assistant, subcontractor, estimator, primary, superintendent)
- **4 Major Systems** (+ significant subsystems):
  1. Projects/Workflows (ongoing work tracking)
  2. Bids (estimation system: Bid Board, Builder Review, Counts, Takeoff, Cost Estimate, Pricing, Cover Letter, Submission, RFI, Change Order, Lien Release)
  3. Materials (Supply Houses with invoices, price book, templates, purchase orders)
  4. Checklist (recurring tasks, Today/History/Manage tabs, push notifications)
  - **Estimates** (internal proposals; global **Quote #** `estimate_number`, staff **`/estimates/{quote#}`**; **`sent`** detail: **`#` + title**, For/logo/line items; **`customer_accepted`**: **`#` + status**, snapshot **card** first, **CustomerSnapshotModal** from customer line, **Customer acceptance** then collapsible **Customer activity** (default closed) then centered **Job** (blue **Create job**); **Customer activity** + **`record_estimate_public_link_view`** dedupe; public **thank-you** centered + **`chick.png`**; **Terms and Conditions.** link line; customer **`/estimate/accept`** + Edge; see `PROJECT_DOCUMENTATION.md`, **RECENT_FEATURES** **v2.288**)
  - **Prospects** (lead management, Convert tab, callbacks) and **Quickfill** (billing workflow, **Banking sorting** snapshot, Crew Jobs / Bids with Realtime **`CrewJobsBlock`**) are major subsystems

---

## Critical Concepts

### Access Control Patterns

**Master-Assistant Adoption** (many-to-many):
- Masters "adopt" assistants to grant access to their customers/projects
- One assistant can work for multiple masters
- Controlled via `master_assistants` table + RLS policies

**Master-Master Sharing**:
- Masters can share their data with other masters
- Shared masters get assistant-level access (view-only, no private notes/financials)
- Controlled via `master_shares` table

**Project Owner = Customer Owner**:
- Projects automatically inherit customer's owner
- Cannot be changed independently
- Enforced by database trigger `cascade_customer_master_to_projects()`

**RLS Everywhere**:
- Every table has Row Level Security policies
- Policies check: ownership, role, adoption, sharing
- Helper functions prevent timeout: `is_dev()`, `can_access_project_via_step()`

### Data Flow

```
Customer (has master_user_id) 
  → Project (master_user_id matches customer)
    → Workflow (one per project)
      → Steps/Stages (assigned to people)
        → Line Items (financial tracking)
        → Actions (status history ledger)
```

### Key Relationships

- **Adoption**: `master_assistants(master_id, assistant_id)` - grants data access
- **Sharing**: `master_shares(sharing_master_id, viewing_master_id)` - grants view access
- **Cost Matrix Shares**: `cost_matrix_teams_shares(shared_with_user_id)` - dev grants view-only Cost matrix and Teams to masters/assistants
- **Ownership**: Foreign keys to `users.id` as `master_user_id` or `created_by`
- **Project Superintendent Assignment**: `project_superintendents(project_id, superintendent_id)` - devs/masters/assistants assign superintendents to specific projects; superintendents gain access via adoption OR project assignment
- **Job–Project Link**: `jobs_ledger.project_id` (nullable FK → projects) - Jobs can optionally link to projects for multi-phase billing; not all jobs need projects; job owner must match project owner when linked (trigger); Edit Job auto-updates master_user_id to project owner when linking
- **Cascading**: Customer master changes propagate to projects automatically

---

## Tech Stack Quick Reference

### Frontend
- **React 18**: Functional components with hooks
- **TypeScript**: Strict mode (`strict`, `noUncheckedIndexedAccess`)
- **Vite**: Build tool and dev server
- **React Router DOM**: Client-side routing
- **State**: React Context + local state (no Redux/Zustand)

### Backend
- **Supabase**: Backend-as-a-service
  - PostgreSQL 15 with Row Level Security (RLS)
  - Built-in authentication
  - Edge Functions (Deno runtime)
  - Real-time subscriptions (not heavily used)
- **Database**: ~50+ tables with complex RLS policies

### Deployment
- **Hosting**: GitHub Pages (static site)
- **CI/CD**: GitHub Actions (`.github/workflows/deploy.yml`)
- **Build**: `npm run build` → `dist/` → GitHub Pages (Vite `copy404Plugin` writes `dist/404.html` from `index.html` for deep-link fallback)
- **SPA reload**: Hard Reload and broadcast force reload use [`src/lib/hardReload.ts`](src/lib/hardReload.ts) + [`index.html`](index.html) to load `/` then `history.replaceState` back to the prior route (fewer misleading document **404**s than reloading `/dashboard?nocache=…`). See [`TROUBLESHOOT_404.md`](TROUBLESHOOT_404.md).
- **Sync to Testing**: Double-click `Sync to Testing.command` at project root to copy `pipetooling.github.io` → `testing-pipetooling.github.io`

### Type Safety
- Types auto-generated from Supabase schema: `src/types/database.ts`
- Manual function types: `src/types/database-functions.ts`
- Update: `npm run gen-types:local` or `npm run gen-types:linked`, or manually with **`2>/dev/null`** so CLI stderr does not append to `database.ts` (see **`AGENTS.md`** constraint 3)

---

## File Structure

```
pipetooling.github.io/
├── src/
│   ├── pages/              # Main UI pages (Customers, Projects, Workflow, People, Jobs, Bids, Materials, Checklist, etc.)
│   ├── components/         # Reusable UI components
│   ├── contexts/           # React contexts (ToastContext, ForceReloadContext, ChecklistAddModalContext, EditCustomerModalContext, NewCustomerModalContext)
│   ├── hooks/              # Custom hooks (useAuth, usePushNotifications, etc.)
│   ├── lib/                # Utilities (supabaseClient, etc.)
│   ├── utils/              # Utilities (errorHandling, authErrorHandler)
│   ├── types/             # TypeScript type definitions
│   └── App.tsx            # Root component with routing
├── supabase/
│   ├── migrations/        # Database migrations (append-only)
│   └── functions/         # Edge Functions (Deno/TypeScript)
├── public/                # Static assets
└── [documentation].md     # 14+ markdown documentation files (incl. SALARY_CLOCK_SESSIONS.md)
```

---

## Most Important Files

### Core Application
- **`src/pages/Workflow.tsx`** (~3.2k lines) - Most complex component, manages project workflow
- **`src/pages/Bids.tsx`** (~14k lines) - Bids: Bid Board, Builder Review (PIA per customer), Counts, Takeoff, Cost Estimate, Pricing, Cover Letter, Submission, RFI, Change Order, Lien Release; Bid Board **Notes** row: tabs **All notes** (default), **Bid notes**, **Customer notes** — see `src/components/bidBoard/UnifiedBidCustomerNotes.tsx`; New/Edit bid modal uses **`SearchableSelect`** (`src/components/SearchableSelect.tsx`) for Estimator, Account Man, Service Type, Win/Loss; grid `bid-form-top-fields` (desktop vs mobile); **720px** modal width; **Project Address** then Distance + Plan Pages row
- **`src/pages/Materials.tsx`** (~7k lines) - Price book, templates, purchase orders
- **`src/pages/Checklist.tsx`** - Recurring checklist (Today, History, Manage tabs)
- **`src/components/ChecklistTitleWithLinks.tsx`** - Renders checklist titles with [1], [2], etc. as clickable links
- **`src/pages/Jobs.tsx`** - Jobs (Reports, Stages, Billing, Team Labor, Sub Labor, Parts, Job Summary, Inspections, Teams Summary tabs)
- **`src/pages/ScheduleDispatch.tsx`** - Week hub (**People** / **Jobs**) + job grid; **Add schedule block** modal with occupied timeline + draft moves ([`scheduleDispatchAddBlockTimeline.ts`](src/lib/scheduleDispatchAddBlockTimeline.ts), [`DispatchAddBlockTimeRange.tsx`](src/components/schedule/DispatchAddBlockTimeRange.tsx); **RECENT_FEATURES** v2.296)
- **`src/pages/Prospects.tsx`** - Lead management (Convert tab, callbacks, Team tab for dev/assistant)
- **`src/pages/Quickfill.tsx`** - Billing workflow: **`QuickfillSectionWrapper`** per block (left **`h2`** titles, **`2px`** dividers); Crew Jobs / Bids: **`CrewJobsBlock.tsx`** (Realtime on **`people_crew_jobs`** / **`people_crew_bids`**, **`CrewJobsSection.tsx`**); Billed; **Banking sorting** snapshot (**`BankingSortingSnapshotSection.tsx`**, inline **Link…** in table); **People Hours (new)** + **Jobs Billing** min HCP (**RECENT_FEATURES** v2.224; **People Hours (new)** mobile day nav v2.289)
- **`src/pages/Dashboard.tsx`** - Reports, pins, Estimator Dashboard; **clock strip** **Assign** uses **`applyOptimisticClockSessionAssign`** (from **`useDashboardMyTeamSectionState`**) for instant job/bid labels, then silent **`loadPending`**; **Clocked in today** **Mix** (copy job %) + **`clockStripWorkDateYmd`**; **`openMyTimePreviewFromClock`** → strip **`DashboardMyTimeDayEditorModal`** with **`clockTimesReadOnly`**
- **`src/components/Layout.tsx`** - Nav; right cluster **Task Dispatch** / **Estimator Inbox** / **Task** / **Bid** share **`headerActionButtonBase`** height
- **`src/components/my-time-day-editor/`** - Dashboard **My Time** **Edit time** modal: **Form** vs **Visual** cluster editor (`MyTimeDayClusterForm.tsx`, `MyTimeDayClusterVisual.tsx`, `MyTimeMergeSegmentsModal.tsx`, datetime helpers); timeline **pairwise-overlap** split + Form overlap dividers (**RECENT_FEATURES** v2.289)
- **`src/hooks/useAuth.ts`** - **`AuthProvider`** + **`useAuth()`** context (session and role); [`src/main.tsx`](src/main.tsx) wraps **`App`** inside **`BrowserRouter`**
- **`src/hooks/usePushNotifications.ts`** - Push notification subscriptions for Checklist
- **`src/contexts/ToastContext.tsx`** - Shared toast notifications (success, info, warning, error); use `useToastContext()` to show toasts from any component
- **`src/lib/supabase.ts`** - Supabase client configuration (includes `db: { schema: 'public' }`)
- **`src/lib/approveClockSessions.ts`** - RPC helper for approve_clock_sessions with explicit schema and fetch fallback
- **`src/utils/errorHandling.ts`** - Retry wrappers and error utilities

### Documentation (Start Here)
- **`AGENTS.md`** - AI agent entry point (points here); includes **Supabase MCP** note for applying migrations / SQL when the linked project is available in Cursor
- **`README.md`** - Quick start and documentation index
- **`AI_CONTEXT.md`** - This file (quick overview)
- **`PROJECT_DOCUMENTATION.md`** - Complete technical reference (3000+ lines)
- **`SALARY_CLOCK_SESSIONS.md`** - Salaried **`salary_schedule`** materialization, split RPCs, sync overlap guards, migrations (no-Docker CLI notes)
- **`TIME_AND_ZONES.md`** - Company **`America/Chicago`** constant (`APP_CALENDAR_TZ`), instants vs naive wall-clock storage, `check:timezone` guardrail
- **`BIDS_SYSTEM.md`** - Bids system documentation (all tabs)
- **`ACCESS_CONTROL.md`** - Complete role permissions matrix
- **`ADDING_A_NEW_ROLE.md`** - Step-by-step guide for adding new roles
- **`EDGE_FUNCTIONS.md`** - Edge Functions API reference
- **`RECENT_FEATURES.md`** - Chronological feature log
- **Team feedback** (clock-out / Dashboard prompts, **People → Feedback** `?tab=feedback` or Settings dev tools, RLS details): **`RECENT_FEATURES.md`** v2.157 (foundation), **v2.162** (eligibility reset, submission SELECT policy, raw submission names), **v2.290** (Feedback tab, modals, Enabled persist, raw detail modal / CSV)
- **Settings layout**: Sharing and Adoption merged into **People & accounts** (`settings-people`); no separate `settings-sharing` jump — **`RECENT_FEATURES.md`** v2.165; **`PROJECT_DOCUMENTATION.md`** Settings §9; **`ACCESS_CONTROL.md`** Settings matrix
- **Templates & testing** (dev): Collapsible **Workflow email (Edge Function)** invokes **`send-workflow-notification`** for a Resend smoke test — **`RECENT_FEATURES.md`** v2.186; **`WORKFLOW_EMAIL_TESTING.md`**; **`EDGE_FUNCTIONS.md`**

---

## Common Tasks

### Adding a New Database Table

1. **Create migration**: `cd supabase && supabase migration new add_my_table`
2. **Write SQL**: CREATE TABLE + RLS policies + constraints + foreign keys
3. **Apply locally**: `supabase migration up`
4. **Update types**: `npm run gen-types:local` (or `--linked` variant if no local DB; see **`AGENTS.md`**)
5. **Test RLS**: Verify policies work for all 6 roles
6. **Document**: Add to `PROJECT_DOCUMENTATION.md` and `MIGRATIONS.md`; salaried auto-session / sync / split behavior → also **`SALARY_CLOCK_SESSIONS.md`**

### Adding a New Page/Route

1. **Create component**: `src/pages/MyPage.tsx`
2. **Add route**: Update `src/App.tsx` with new `<Route>`
3. **Add navigation**: Update `src/components/Layout.tsx` if needed
4. **Add RLS**: Ensure backend data is accessible to intended roles

### Debugging RLS Issues

1. **Check role**: Verify user's role in `public.users` table
2. **Review policies**: Check table's RLS policies in latest migrations
3. **Test query**: Run query manually with `SET LOCAL ROLE` to test policy
4. **Check adoptions**: Verify `master_assistants` or `master_shares` relationships
5. **Consult**: See `ACCESS_CONTROL.md` for expected permissions

### Fixing TypeScript Errors

1. **Update types**: After schema changes, regenerate types
2. **Check nulls**: Use optional chaining `?.` and nullish coalescing `??`
3. **Array access**: Always check `array[0]` could be undefined
4. **Build test**: Run `npm run build` to catch all type errors

### Testing Without Credentials (Dev Login)

AI agents or automated tests can sign in without a password using the dev-login flow:

1. **Prerequisites**: Dev server running (`npm run dev`); Supabase functions running; test user exists in Supabase
2. **Env vars**: Add to `.env.local`: `VITE_DEV_LOGIN_SECRET=your-secret`
3. **Edge Function secret**: `supabase secrets set DEV_LOGIN_SECRET=your-secret`
4. **URL**: Open `http://localhost:5173/dev-login?as=<existing-email>` or use the form at `/dev-login` (Vite default port 5173). Use an existing user email from your Supabase project (e.g. `robert@douglasmining.com`). `user@example.com` or `test@example.com` will fail with non-2xx if that user doesn't exist in `auth.users`.
5. **Flow**: Frontend calls `dev-login` Edge Function with email + secret; function returns magic link; browser redirects; user lands authenticated

**Security**: Only active when `import.meta.env.DEV` is true. Production builds redirect `/dev-login` to sign-in.

**See**: `EDGE_FUNCTIONS.md` → dev-login; `.env.example` for env var names

---

## Where to Look For...

| Need | Documentation |
|------|---------------|
| Database schema, tables, columns | `PROJECT_DOCUMENTATION.md` → "Database Schema" section |
| User role permissions | `ACCESS_CONTROL.md` → Page/Feature access matrices |
| Adding a new role | `ADDING_A_NEW_ROLE.md` → Step-by-step guide |
| Term definitions | `GLOSSARY.md` → All domain terms and concepts |
| Recent changes and features | `RECENT_FEATURES.md` → Chronological updates (e.g. v2.304 Stripe send confirm modal **Most recent sends** (`jobs_ledger_invoice_stripe_email_sends`); v2.303 Jobs **Stages** **Last activity** Stripe **Resend invoice email**; v2.297 People **Hours** grid blur → **My Time** with **proportional** scale of closed `clock_sessions` (or draft / fetch if open session); v2.291 manual blur draft / **`saveHours(0)`** / **NCNS** off; v2.289 **My Time** overlap split cards + Form chrome + prior-week footer; Quickfill **People Hours (new)** mobile nav; v2.284 Banking **Mercury/Stripe** URL + dev **Invoices/Data** grids; Jobs **Stages** thread-stats debounce/chunks; v2.281 Dashboard **Mix** copy day job % + **My Time** clock preview (**punch** locked); v2.257 linked **job_schedule_blocks** + Dispatch linked copy (`+` on cards); v2.249 salary split sync overlap + clock-in TZ date; v2.231 strip **My Time** from **Jobs worked today** duration; v2.229 salary indexed-slot split + overlap guard; v2.228 Salaried workday UI + continuous sync guard) |
| Bids system | `BIDS_SYSTEM.md` → Complete workflow documentation |
| Edge Functions API | `EDGE_FUNCTIONS.md` → All 10 functions with examples |
| Migration history | `MIGRATIONS.md` → All migrations by date and category |
| Workflow features | `WORKFLOW_FEATURES.md` → Stage management, financials |
| Email templates | `EMAIL_TEMPLATES_SETUP.md`, `EMAIL_TESTING.md` |
| Database improvements | `DATABASE_IMPROVEMENTS_SUMMARY.md` → v2.22 enhancements |
| Supabase disk IO / Materials performance | `RECENT_FEATURES.md` → v2.46; `PROJECT_DOCUMENTATION.md` → Materials Disk IO Optimizations |
| Clock In/Out, pending sessions, pay roster | `RECENT_FEATURES.md` → v2.100; `PROJECT_DOCUMENTATION.md` → Dashboard, Hours tab; `GLOSSARY.md` → Clock Sessions |
| Dashboard "Currently clocked in" strip (Today column, My team/Everyone; **Clocked in today** **Mix** copy job % [v2.281]; **Jobs worked today** duration → strip **Edit time**; **Overlap** badge; scope overlay chrome v2.206); supply house website in Materials | `RECENT_FEATURES.md` → v2.281, v2.231, v2.163, v2.206; `PROJECT_DOCUMENTATION.md` → Dashboard, Materials; `src/hooks/useDashboardMyTeamSectionState.ts`; `src/components/DashboardTeamActiveClockStrip.tsx`; `src/components/day-job-mix/CopyDayJobMixModal.tsx`; `src/lib/dayJobMixPercentages.ts`; `src/lib/dayJobMixApply.ts` |
| Dashboard **My Time** / **Edit time** (this-week-only, Form/Visual, merge + job override, `myTimeDayTimeline`; **pairwise overlap** → one timeline card per session; Form overlap **double** border + cluster separators; compact list frame off; prior-week gate footer; **Overlapping clock times** / **Multiple jobs/bids in this span**; **read-only punch** from **Clock** preview — **`clockTimesReadOnly`**, save on close) | `RECENT_FEATURES.md` → v2.289, v2.281, v2.231, v2.193, v2.192, v2.179; `PROJECT_DOCUMENTATION.md` → Dashboard **My Time**; `src/components/DashboardMyTimeSection.tsx`; `src/components/DashboardMyTimeDayEditorModal.tsx`; `src/components/my-time-day-editor/`; `src/lib/myTimeDayTimeline.ts`; `src/lib/myTimeDaySavePlan.ts` |
| Dashboard **Clock In** / **Update Focus**: assigned jobs auto-load; **View today’s time** clock preview → **My Time** [v2.281]; **no assigned jobs** toast once per modal (v2.191); field borders / focus | `RECENT_FEATURES.md` → v2.281, v2.182, v2.191; `PROJECT_DOCUMENTATION.md` → Dashboard **Clock In/Out**; `src/components/ClockInOutButton.tsx`; `src/contexts/ToastContext.tsx` |
| Settings **Salaried workday** + auto **`salary_schedule`** sessions: UI hints (`formatSalaryBlockEndDisplay`); continuous duplicate INSERT guard (`20270402100000`); indexed-slot split → **`user_punch`** + split overlap guard (`20270403180000`); split sync overlap uses **`work_date`** or clock-in civil date in template TZ (`20270408153000`) | **`SALARY_CLOCK_SESSIONS.md`**; `RECENT_FEATURES.md` → v2.249, v2.229, v2.228; `PROJECT_DOCUMENTATION.md` → `clock_sessions`; `MIGRATIONS.md` → `20270402100000`, `20270403180000`, `20270408153000`; `SalaryWorkScheduleSettings.tsx`; `salaryScheduleEndTimeDisplay.ts` |
| Job Parts Tally **(/tally)**: Materials estimate + **Transactions** (Mercury card search, note icon, `tallyJobSplits`, `TallyJobTransactionsModal`) | `RECENT_FEATURES.md` → v2.225; `PROJECT_DOCUMENTATION.md` → Jobs §6a; `src/pages/JobTally.tsx`; `src/lib/tallyTransactionSearch.ts`; `src/components/icons/MercuryTransactionNoteIcon.tsx` |
| Jobs **Stages** + Workflow linked jobs: **thread notes**, **Last activity** preview, composer **Enter** / **Shift+Enter**; **Last activity** Stripe **emailed customer** + **Resend invoice email** when one billed Stripe line has **`sent_to_customer_at`** (`StripeInvoiceSendFromStripeButton`, **`send-stripe-invoice`**); `jobs_ledger.stage_notes` removed; **Stages** thread-stats: **chunk 200**, generation guard, **320ms** debounce; narrow **`loadJobs`** reload on **`customer`** query param | `RECENT_FEATURES.md` → v2.303, v2.284, v2.183–v2.185; `PROJECT_DOCUMENTATION.md` → Jobs §6, Workflow; `MIGRATIONS.md` → `20260330023918`; `src/components/JobThreadNotesPanel.tsx`; `src/components/jobs/StripeInvoiceSendFromStripeButton.tsx`; `src/hooks/useJobThreadNotes.ts`; `src/pages/Jobs.tsx` |
| **Banking** (`/banking`): Mercury **Ledger/Sorting** + dev **Stripe** **Invoices** (`jobs_ledger_invoices`) & **Data** (`stripe_webhook_events`); **`product`/`tab`** query params | `RECENT_FEATURES.md` → v2.284; `PROJECT_DOCUMENTATION.md` → §15; `ACCESS_CONTROL.md`; `MIGRATIONS.md` → `20270410130300`; `src/pages/Banking.tsx`; `src/components/BankingStripeInvoicesPanel.tsx`; `src/components/BankingStripeWebhookEventsPanel.tsx` |
| **Schedule** planned blocks: **`job_schedule_blocks`**, Dispatch week hub/grid, **Linked** crew rows (**`shared_block_group_id`**, **+ → Linked copy** on job/hub cards, group edit) | `RECENT_FEATURES.md` → v2.257, v2.256, v2.255, v2.254; `GLOSSARY.md` → Job schedule blocks; `MIGRATIONS.md` → `20260407033913`, `20260407052651`, `20260407061043`; `src/lib/jobScheduleBlocks.ts`; `src/pages/ScheduleDispatch.tsx`; `src/components/schedule/ScheduleDispatchGrid.tsx`; `src/components/jobs/ScheduleJobModal.tsx` |
| Ready to Bill **customer gate** + **Edit Job** billing highlight; **`get_jobs_ledger_by_status.customer_id`**; RTB **Job: Send Job Back** / **Delete draft bill**; Edit Job **Ready to Bill** (**Preview / Stripe bill…**, **View in Stages**); **Outstanding billing** / **Payments received** / **Partial invoice** layout (`RECENT_FEATURES` v2.285); **`BillCustomerModalProvider`**, **`preview-stripe-invoice`**, **`StripeBillPreSubmitPreview`** | `RECENT_FEATURES.md` → v2.285, v2.283, v2.190; `PROJECT_DOCUMENTATION.md` → Jobs §6, Dashboard; `MIGRATIONS.md` → `20260330065236`; `EDGE_FUNCTIONS.md` → **create-stripe-invoice**, **preview-stripe-invoice**; `src/contexts/BillCustomerModalContext.tsx`; `src/pages/Jobs.tsx`; `src/pages/Dashboard.tsx`; `src/components/jobs/SendRecordInvoiceModal.tsx`; `src/components/jobs/JobFormModal.tsx` |
| Jobs **Edit Job** billing: **Job Total / Bid** and payment **Amount** comma formatting | `RECENT_FEATURES.md` → v2.181; `PROJECT_DOCUMENTATION.md` → Jobs §6; `src/pages/Jobs.tsx`; `src/components/MoneyDecimalAmountInput.tsx` |
| Workflow **line items**: optional **`item_date`**; **Add Line Item** clipboard bulk import | `RECENT_FEATURES.md` → v2.181; `WORKFLOW_FEATURES.md` → Line Items For Office; `PROJECT_DOCUMENTATION.md` → workflow_step_line_items; `MIGRATIONS.md` → 20270329210000; `src/lib/parseWorkflowLineItemPaste.ts`; `src/pages/Workflow.tsx` |
| Clock sessions table UX, My Roles Goals gate, `user_dashboard_goals` / `user_daily_goals_ack` | `RECENT_FEATURES.md` → v2.149; `PROJECT_DOCUMENTATION.md` → Dashboard, People, Quickfill, Settings; `MIGRATIONS.md` → 20260329120000; `GLOSSARY.md` → Clock Sessions, My Roles Goals |
| Settings: Sharing and Adoption under **People & accounts** (`settings-people`); no `settings-sharing` jump | `RECENT_FEATURES.md` → v2.165; `PROJECT_DOCUMENTATION.md` → Settings §9; `ACCESS_CONTROL.md` → Settings matrix |
| Pay History: **Less** + **Additional** (`pay_stub_additional_lines`, qty×rate) + **Net Pay** (gross − Less + Additional); ledger name search; **Partial** installments (`pay_stub_payments`) vs net; Paid to date / Balance; **Record payment** (single amount, capped at balance, optional **employee credit** for overage); **Draft Payroll** prior week + crew merge; **`person_offsets.employee_credit`**; per-row delete in payment detail; **Print** in row; **View** in bulk **Generate Pay Reports**; dev trash delete | `RECENT_FEATURES.md` → v2.252, v2.170, v2.172, v2.173, v2.174; `PROJECT_DOCUMENTATION.md` → People; `MIGRATIONS.md` → `20270408163000`; `GLOSSARY.md` → person_offsets, pay_stub_payments, pay_stub_deductions, pay_stub_additional_lines; `src/pages/People.tsx`; `src/lib/payStubPayments.ts`; `src/lib/payStubDeductions.ts`; `src/components/pay/PayStubLessModal.tsx`; `src/components/pay/PayStubAdditionalModal.tsx`; `src/components/pay/PayStubDeleteIcon.tsx`; `src/components/pay/PersonOffsetFormModal.tsx` |
| People Hours: Audit modal edit mode, shared clock split/create modal, **Highlight by job**; manual grid blur → **My Time** proportional scale or draft (`peopleHoursProportionalScale.ts`, `peopleHoursManualDraftSession.ts`) | `RECENT_FEATURES.md` → v2.297, v2.291, v2.171; `PROJECT_DOCUMENTATION.md` → People §5 Hours; `PeopleHoursDayAuditModal.tsx`; `ClockSessionEditSplitModal.tsx`; `DashboardMyTimeDayEditorModal.tsx` |
| Checklist (multi-assignee, links, Today/History/Manage) | `RECENT_FEATURES.md` → v2.107, v2.109; `PROJECT_DOCUMENTATION.md` → Key Features; `GLOSSARY.md` → Checklist Items |
| Testing without credentials (dev login) | `EDGE_FUNCTIONS.md` → dev-login; `/dev-login?as=<existing-email>` when running dev server; email must exist in auth.users (e.g. robert@douglasmining.com); set `VITE_DEV_LOGIN_SECRET` in `.env.local` and `DEV_LOGIN_SECRET` for Edge Function |

---

## Key Patterns

### Error Handling
```typescript
import { withSupabaseRetry } from '@/utils/errorHandling'

// Wraps Supabase calls with retry logic
const { data, error } = await withSupabaseRetry(() => 
  supabase.from('table').select()
)
```

### RLS Helper Functions
```sql
-- Prevent recursion and timeout in complex policies
CREATE FUNCTION is_dev() RETURNS boolean
  SECURITY DEFINER  -- Runs with creator's permissions
  AS $$ SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'dev'
  ) $$;
```

### Atomic Transaction Functions
```sql
-- Multi-step operations with automatic rollback
CREATE FUNCTION create_project_with_template(...)
  RETURNS project_workflows
  AS $$ 
    -- Multiple INSERTs in single transaction
    -- Returns result or rolls back on error
  $$;
```

### State Management
- **Global**: React Context (ToastContext, ForceReloadContext, ChecklistAddModalContext, EditCustomerModalContext, NewCustomerModalContext)
- **Page-level**: `useState`, `useEffect` hooks
- **No global state library**: No Redux, MobX, or Zustand
- **Server state**: Direct Supabase queries (no React Query)
- **Toasts**: Use `useToastContext()` from any component; `showToast(message, 'success'|'info'|'warning'|'error')`

### Type Safety
```typescript
// Auto-generated types
import { Database } from '@/types/database'
type Customer = Database['public']['Tables']['customers']['Row']

// Function types (manual)
import { createProjectWithTemplate } from '@/types/database-functions'
```

---

## Domain Glossary

### User Roles
- **dev**: System administrator, full access to everything
- **master_technician** (Master): Project owner/manager, creates customers/projects
- **assistant**: Support staff, works under masters (must be adopted)
- **subcontractor** (Sub): External worker, sees only assigned stages. Optional **subcontractor service type restriction**: devs can limit which service types a subcontractor can associate with when clocking in and sending Task Dispatch (job/bid reference); NULL/empty = all types
- **estimator**: Bid specialist, access to Bids and Materials only (no projects). Optional **estimator service type restriction**: devs can limit an estimator to specific service types (e.g., Electrical only); NULL/empty = all types

### Project Management
- **Customer**: Client or General Contractor (GC)
- **Project**: Job site or construction project
- **Workflow**: Sequence of stages for a project (one per project)
- **Stage/Step**: Individual work phase (e.g., "Rough In", "Top Out", "Trim Set")
- **Action**: Status change event (started, completed, approved, rejected, reopened)
- **Line Item**: Financial entry (material, labor, or expense)
- **Projection**: Forward-looking financial estimate
- **Ledger**: Complete financial history (line items + projections)
- **Private Note**: Owner-only note on a stage (not visible to assistants/subs)

### Access Control
- **Adoption**: Master grants assistant access to their data (many-to-many)
- **Sharing**: Master grants another master assistant-level access
- **Estimator service type restriction**: Limits estimators to specific service types (Plumbing, Electrical, HVAC); set via `estimator_service_type_ids` on users; NULL/empty = all types
- **Subcontractor service type restriction**: Limits which bids a subcontractor can associate with when clocking in and when sending Task Dispatch; set via `subcontractor_service_type_ids` on users; NULL/empty = all types
- **RLS**: Row Level Security (PostgreSQL security policies)
- **SECURITY DEFINER**: Function runs with creator's permissions (bypasses RLS)

### Bids System
- **Bid Board**: Main bid list and management
- **Counts**: Fixture/tie-in quantity entry; Import for bulk paste (tab/comma-separated)
- **Takeoff**: Map counts to material templates → create POs
- **Cost Estimate**: Calculate material + labor + driving costs
- **Pricing**: Compare costs to price book, analyze margins
- **Cover Letter**: Generate proposal documents
- **Submission & Followup**: Track bid submissions and outcomes

### Bids Concepts
- **Fixture**: Plumbing fixture (toilet, sink, faucet, etc.)
- **Tie-in**: Connection point in plumbing system
- **Rough In**: Initial plumbing installation (in-wall piping)
- **Top Out**: Mid-stage plumbing work
- **Trim Set**: Final fixture installation (visible fixtures)
- **Takeoff**: Process of calculating material quantities from fixture counts
- **Book** (Takeoff/Labor/Price): Template library for standardizing estimates
  - **Takeoff Book**: Maps fixtures to material templates
  - **Labor Book**: Maps fixtures to labor hours per stage
  - **Price Book**: Maps fixtures to pricing per stage
- **GC/Builder**: General Contractor (customer in bids context)
- **Margin**: Profitability percentage `(revenue - cost) / revenue`

### Materials System
- **PO**: Purchase Order (draft or finalized)
- **Supply House**: Vendor or supplier (e.g., Ferguson, HD Supply)
- **Price Book**: Catalog of parts with prices per supply house
- **Template**: Reusable part list (can contain nested templates)
- **Finalized PO**: Locked purchase order (add-only notes allowed)
- **Price Confirmation**: Assistant verification of prices before ordering

### Database Concepts
- **Migration**: SQL file defining schema changes (append-only, never edit)
- **Trigger**: Automatic database function on INSERT/UPDATE/DELETE
- **Cascade**: Automatic update/delete propagation via foreign keys
- **CHECK Constraint**: Database-level data validation
- **UNIQUE Constraint**: Enforces uniqueness of column values
- **Index**: Performance optimization for queries

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │  Projects  │  │    Bids    │  │ Materials  │        │
│  │ Workflows  │  │ 11 Tabs    │  │ Price Book │        │
│  └────────────┘  └────────────┘  └────────────┘        │
│         │                │                │              │
│         └────────────────┴────────────────┘              │
│                          │                               │
│                   AuthContext                            │
└──────────────────────────┼──────────────────────────────┘
                           │
                  Supabase Client
                           │
┌──────────────────────────┼──────────────────────────────┐
│                 Supabase Backend                         │
│  ┌────────────────────────────────────────────┐         │
│  │         PostgreSQL Database                │         │
│  │  • 50+ tables with RLS policies            │         │
│  │  • Triggers for timestamps, cascading      │         │
│  │  • Transaction functions for atomicity     │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
│  ┌────────────────────────────────────────────┐         │
│  │         Supabase Auth                      │         │
│  │  • Email/password authentication           │         │
│  │  • JWT tokens with role metadata           │         │
│  │  • Magic links for impersonation           │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
│  ┌────────────────────────────────────────────┐         │
│  │      Edge Functions (Deno)                 │         │
│  │  • create-user, archive-user, restore-user, login-as-user │         │
│  │  • send-workflow-notification (Resend)     │         │
│  │  • send-checklist-notification             │         │
│  │  • send-scheduled-reminders, send-report   │         │
│  │  • set-user-password, claim-dev, test-email│         │
│  └────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────┘
                           │
                    Resend Email API
```

---

## Critical Constraints

### Development Rules

1. **Never edit existing migrations**: Migrations are append-only. Create new migration to change schema.
2. **Always add RLS policies**: Every new table needs SELECT/INSERT/UPDATE/DELETE policies for all roles.
3. **Update types after schema changes**: `npm run gen-types:local` or `npm run gen-types:linked` (stderr redirected; see **`AGENTS.md`**)
4. **No `any` types**: TypeScript strict mode enforced. Use proper types or `unknown`.
5. **Test all 5 roles**: Verify RLS works for dev, master, assistant, subcontractor, estimator.
6. **Foreign keys need CASCADE behavior**: Decide ON DELETE CASCADE vs SET NULL vs RESTRICT.
7. **Use transaction functions**: For multi-step operations, create atomic database functions.

### Code Style

- **Functional components**: Use hooks (useState, useEffect, useContext)
- **Error handling**: Wrap Supabase calls with `withSupabaseRetry()`
- **Null safety**: Use optional chaining `?.` and nullish coalescing `??`
- **Async/await**: Preferred over `.then()` chains
- **No inline styles**: Use className and CSS files
- **Component size**: Break down files over 500 lines

### Database Patterns

- **Helper functions for RLS**: Use `is_dev()`, `can_access_project_via_step()` to prevent timeouts
- **SECURITY DEFINER carefully**: Only use when absolutely necessary (bypasses RLS)
- **Triggers for timestamps**: Use `update_updated_at_column()` trigger on all tables
- **CHECK constraints**: Add data validation at database level
- **Unique constraints**: Prevent duplicates (e.g., `(bid_id, count_row_id)`)

---

## Testing Focus Areas

### Role-Based Access
- [ ] Dev can access everything
- [ ] Master can access own data + shared data
- [ ] Assistant can access adopted masters' data
- [ ] Subcontractor only sees assigned stages
- [ ] Estimator can access Bids + Materials, but not Projects

### Data Integrity
- [ ] Foreign key cascading works correctly
- [ ] CHECK constraints prevent invalid data
- [ ] Unique constraints enforced
- [ ] Triggers fire on INSERT/UPDATE

### Concurrent Operations
- [ ] Multiple users editing same project
- [ ] Race conditions in workflow creation
- [ ] Mutex pattern in frontend prevents duplicate creates

### Type Safety
- [ ] `npm run build` succeeds with no errors
- [ ] No `any` types in new code
- [ ] Proper null/undefined handling

---

## Quick Troubleshooting

### "403 Forbidden" Error
- **Cause**: RLS policy blocking access
- **Fix**: Check user's role, adoption/sharing relationships, table RLS policies

### "Row not found" / Empty Results
- **Cause**: RLS filtering out data user shouldn't see
- **Fix**: Verify user has proper access (adoption, ownership, role)

### TypeScript Build Errors
- **Cause**: Types out of sync with database schema
- **Fix**: Regenerate types (`npm run gen-types:local` or linked; see **`AGENTS.md`**)

### Workflow Not Creating
- **Cause**: Race condition with concurrent calls
- **Fix**: Check mutex pattern in `ensureWorkflow()` function

### Email Not Sending
- **Cause**: Resend API key not configured or domain not verified
- **Fix**: Check Supabase Dashboard → Edge Functions → Secrets

### Price Book Loading Slow
- **Cause**: Large dataset, pagination needed
- **Fix**: Use "Load All" mode for bulk editing, or infinite scroll for browsing

---

## Next Steps

**For AI Agents starting work**:
1. Read this file (you're done! ✓)
2. Consult specific documentation for your task (see "Where to Look For..." table)
3. Review relevant code files in `src/pages/` or `supabase/`
4. Check recent changes in `RECENT_FEATURES.md` for context
5. Ask clarifying questions before making changes

**For new developers**:
1. Read `README.md` for setup instructions
2. Read this file for project overview
3. Explore `PROJECT_DOCUMENTATION.md` for deep technical details
4. Try running the app locally: `npm install && npm run dev`
5. Browse the UI to understand user workflows

---

**Last Updated**: 2026-03-07

**Maintained By**: Documentation generated during comprehensive documentation update project

**Related Files**: See `README.md` "Documentation" section for complete file list
