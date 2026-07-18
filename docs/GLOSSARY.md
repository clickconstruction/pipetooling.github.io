# Project Glossary

> **Purpose**: Comprehensive definitions of all domain-specific terms, technical concepts, and project-specific terminology used in Pipetooling.

---
file: GLOSSARY.md
type: Reference
purpose: Comprehensive definitions of all domain-specific terms and technical concepts
audience: All users (especially new developers and AI agents)
last_updated: 2026-07-18
estimated_read_time: 15-20 minutes (reference only)
difficulty: Beginner

categories: 9

key_sections:
  - name: "User Roles"
    anchor: "#user-roles"
  - name: "Project Management"
    anchor: "#project-management"
  - name: "Access Control"
    anchor: "#access-control"
  - name: "Workflow Concepts"
    anchor: "#workflow-concepts"
  - name: "Bids System"
    anchor: "#bids-system"
  - name: "Materials System"
    anchor: "#materials-system"
  - name: "Database Concepts"
    anchor: "#database-concepts"
  - name: "Technical Terms"
    anchor: "#technical-terms"
  - name: "Abbreviations"
    anchor: "#abbreviations"

usage: "Use Ctrl+F/Cmd+F to search for specific terms"

related_docs:
  - "[AI_CONTEXT.md](./AI_CONTEXT.md) - Quick overview with glossary"
  - "[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) - Terms in context"
  - "[BIDS_SYSTEM.md](./BIDS_SYSTEM.md) - Bids terminology"
  - "[ACCESS_CONTROL.md](./ACCESS_CONTROL.md) - Role terminology"

when_to_read:
  - Encountering unfamiliar terms
  - Learning project terminology
  - Understanding domain concepts
  - Clarifying abbreviations
---

## Quick Navigation

- [User Roles](#user-roles)
- [Project Management](#project-management)
- [Access Control](#access-control)
- [Workflow Concepts](#workflow-concepts)
- [Checklist](#checklist)
- [Task Dispatch](#task-dispatch)
- [Email schedule (Dashboard)](#email-schedule-dashboard)
- [Recurring job report emails (Jobs)](#recurring-job-report-emails-jobs)
- [Bids System](#bids-system)
- [Materials System](#materials-system)
- [PO Generator ledger](#po-generator-ledger)
- [Database Concepts](#database-concepts)
- [Technical Terms](#technical-terms)
- [UI/UX Terms](#uiux-terms)
- [Abbreviations](#abbreviations)
- [Common Phrases](#common-phrases)

---

## User Roles

### dev (Developer/Admin)
System administrator with complete access to all features, data, and operations. Can create/delete users, manage templates, impersonate users, and access all edge functions. The highest privilege level in the system.

**Capabilities**: Everything (full CRUD on all resources, user management, system configuration)

### master_technician (Master)
Project owner and business manager role. Creates customers and projects, manages workflows, assigns work to assistants and subcontractors. Can adopt assistants and share data with other masters.

**Capabilities**: Own data management, assistant adoption, master sharing, full bids/materials access

**Alias**: Sometimes called "Master" for brevity

### assistant (Assistant)
Support staff who work under masters. Must be "adopted" by a master to access their data. Can view all stages in accessible workflows but only take actions on assigned stages. Cannot see private notes or financial totals.

**Capabilities**: View adopted masters' data, edit line items (no totals), manage bids/materials, limited customer creation

**Key Restriction**: Must be adopted by a master to access any data

### subcontractor (Sub/Subcontractor)
External worker with minimal access. Only sees stages they are assigned to by name. Cannot access customer, project, or workflow management pages. Limited to Dashboard and Calendar views.

**Capabilities**: Start/Complete assigned stages only; **Task Dispatch** (send title + links to Dispatch group)

**Key Restriction**: Cannot see any stage they're not explicitly assigned to

### helpers (labeled **Helper** in the app UI)

Same high-level routing and subcontractor-parity policies as **subcontractor** (`SUBCONTRACTOR_PATHS`, `isSubcontractorLikeRole()`). Stored role: PostgreSQL **`user_role`** enum value **`helpers`**. Service-type column: **`users.helpers_service_type_ids`** (Clock/Dispatch), analogous to **`subcontractor_service_type_ids`**. **`people.kind` = `helper`** for off‑roster People rows. See [ACCESS_CONTROL.md](./ACCESS_CONTROL.md) **`### helpers (Helper)`**.

### estimator (Estimator)
Bid estimation specialist centered on the Bids and Materials systems. Can view all customers (for bid creation), create customers via the Bids modal or Customers page, and edit basic customer fields. Allowed routes also include Dashboard, Map, Estimates, Documents, Calendar, Checklist, People, Settings, Tally, and Help (`estimatorAllowedPaths` in [`layoutRouteAccess.ts`](../src/lib/layoutRouteAccess.ts)); Prospects only when `estimator_prospects_access` is granted.

**Capabilities**: Full Bids system, full Materials system, view/create/edit customers (no owner/Stripe/merge/delete)

**Key Restriction**: No access to Projects, Workflows, Jobs, or Quickfill pages

### primary (Primary)
Materials and job reports specialist with access to Materials (full), Jobs (**Reports and Billing** tabs), Bids (**full access** — all tabs including Pricing and Cover Letter, which are hidden only for superintendents — [`Bids.tsx`](../src/pages/Bids.tsx)), and Dashboard with Recent Reports and Send task. Cannot access Customers, Projects, People, or Prospects.

**Capabilities**: Full Materials system, Jobs Reports tab (view/create reports) + Billing tab (view jobs, add materials), full Bids access (create/edit/delete bids, all tabs), Dashboard Recent Reports, Send task, ChecklistAddModal ("detail send")

**Key Restriction**: No access to Customers, Projects, People, Prospects, Quickfill, or Jobs tabs other than Reports and Billing

### superintendent (Superintendent)
Runs jobs, manages subcontractors, and drafts bids — but only on projects they are explicitly assigned to via `project_superintendents` (adoption through `master_superintendents` no longer grants project access). Sees Jobs Reports + Sub Sheet Ledger tabs, the Schedule Dispatch week grid, and the Bids draft flow; the Pricing, Cover Letter, and Submission tabs are hidden ([`Bids.tsx`](../src/pages/Bids.tsx)).

**Capabilities**: Workflow stage visibility + people assignment on assigned projects, Jobs Reports/Sub Sheet Ledger, draft-flow Bids tabs, Materials Price/Assembly books, Dispatch

**Key Restriction**: Assigned projects only; no People or Customers pages (customer create from the Bids modal only)

### controller (Controller)
Bookkeeper/financial-controller role: acts like an assistant everywhere plus dev-level financial visibility via `has_payroll_access()`. See the full entry at [Controller (role)](#controller-role) below and `ACCESS_CONTROL.md` → controller section.

---

## Project Management

### Customer
A client or General Contractor (GC) who provides work. Customers have an owner (`master_user_id`) and can have multiple projects. In the Bids context, customers are also called "GC/Builder".

**Database**: `customers` table

**Key Fields**: name, address, contact info (JSONB), date_met, master_user_id, archived_at/archived_by

### Customer archive
Soft archive for customers (v2.735), patterned on user archival — never a delete. Setting `customers.archived_at` (with `archived_by`) hides the customer from the Customers list by default (a **Show archived (n)** toggle reveals them with an **Archived** badge) and excludes them from pickers that link **new** jobs/estimates/bids/projects. Existing links keep working and archived customers still render wherever already referenced (by-id lookups, embedded joins, global search). Archive/Unarchive lives in the Edit customer form (dev/master/assistant-like) behind a confirm modal. Kernel: `src/lib/customerArchive.ts`.

### Team prospects (Prospects → Team tab)
Prospective **hires** — candidates for the crew, tracked separately from customer leads. The Prospects page has two top-level tabs: **Customers** (lead pipeline: Follow Up / Prospect List / Convert / Activity) and **Team** (v2.709). The Team tab is a **board with one drag-ranked column per role** being hired for (v2.712): users add role columns as needed; drag re-ranks within a column (#1 = top candidate) or moves a candidate across columns; `role_id` NULL rows show in a virtual **Unsorted** column. A role column is deletable **only when empty** (FK `ON DELETE RESTRICT`). Statuses `active` / `hired` / `passed`; **Talked today** stamps `last_contact`. Access is **per-user** (v2.714): `user_has_team_prospects_access()` = prospects staff access AND `users.team_prospects_access` (dev-granted in Settings → Active accounts, default off).

**Database**: `team_prospects`, `team_prospect_roles` tables

**Key Fields**: name, trade, source, status, role_id, rank_order (per-column), last_contact, master_user_id

### Project
A job site or construction project for a specific customer. Each project has one workflow. The project owner automatically matches the customer owner (enforced by database trigger).

### Job–Project Link
Optional association between a Job (billing) and a Project (multi-phase work). Jobs can optionally belong to a project; not all jobs need projects. When linked, the job owner must match the project owner (enforced by trigger). When editing a job and linking it to a project, the job's owner is automatically updated to the project owner.

**Database**: `projects` table

**Key Fields**: name, description, status, customer_id, master_user_id, address, project_number

**Rule**: Project owner = Customer owner (cannot be changed independently)

### Project Number
Short identifier for a project (e.g. "42") that mirrors the **Bid Number** pattern. Stored in `projects.project_number` (TEXT, default `''`). **Auto-assigned** on insert by the `BEFORE INSERT` trigger `projects_set_project_number` via the org-global sequence `projects_project_number_seq` — only fills when the column is null / blank, so any caller passing a value (advanced flows) is honored verbatim. Existing rows were backfilled oldest-first by `created_at NULLS LAST` (migration **`20260519170221`**). **Display label** is **`Project #{number}`** rendered via [`formatProjectNumberLabel`](../src/lib/projectNumberLabel.ts) (returns `null` when blank so consumers fall back gracefully — Workflow chip → `Project: {name}`, Dashboard subscribed line → `Project: {name}`, Projects list inline label simply hides).

**Editable** from the Edit Project modal as the first form field (free-text, blank allowed; **v2.557**, mirrors how Jobs' HCP # works). Save is **warn-but-allow on duplicates** — typing a number another project already uses surfaces *Already used by "{Other Project}". Save anyway?* in amber but Save still works (no DB uniqueness constraint on `project_number`, consistent with `hcp_number` / `housecallpro_number`). Cleared values stay cleared on UPDATE — the BEFORE INSERT trigger does not fire on UPDATE, so renumbering or blanking is sticky.

**Visibility** (intentionally narrow): Edit Project modal title-row form field, Projects list rows (`Project #N` label inline next to the project-name link), Workflow header chip (`Project #N · {project.name}`), Dashboard subscribed-stages line (`Project #N: {project_name}`). Other surfaces showing project names (Jobs Stages, DetailJobModal, Calendar / ForecastSpecific, People active projects) are intentionally untouched — extend later if needed.

**Database**: `projects.project_number` (TEXT, default `''`), `projects_project_number_seq` (org-global sequence), `projects_set_project_number` (BEFORE INSERT FOR EACH ROW trigger), `idx_projects_project_number` (lookup index for the duplicate-warning query).

**Helpers**: [`formatProjectNumberLabel(value)`](../src/lib/projectNumberLabel.ts) → `'Project #42'` or `null`; [`formatProjectNumberBadge(value)`](../src/lib/projectNumberLabel.ts) → `'#42'` or `null`. Both null-safe and trim-safe; covered by 11 unit tests in [`projectNumberLabel.test.ts`](../src/lib/projectNumberLabel.test.ts).

### Workflow
A sequence of stages/steps for completing a project. Each project has exactly one workflow. Created from templates or built from scratch.

**Database**: `project_workflows` table

**Relationship**: One per project (1:1)

### Stage / Step
Individual work phase in a project workflow (e.g., "Rough In", "Inspection", "Top Out", "Trim Set"). Can be assigned to people, have start/complete dates, and track status (pending, in_progress, completed, approved, rejected). The rejected status displays as "Previous work incomplete" in the UI.

**Database**: `project_workflow_steps` table

**Alias**: "Stage" and "Step" used interchangeably

**Statuses**: pending, in_progress, completed, approved, rejected (rejected displays as "Previous work incomplete"), skipped

**Expected dates** (**v2.552**): `project_workflow_steps.scheduled_start_date` / `scheduled_end_date` (YMD `date` columns) hold the **expected** Start / End the team set via the **Expected dates** modal on the Workflow page stage card — distinct from `started_at` / `ended_at` (instants when work actually began / finished). Modal includes a **Duration (days)** field that auto-computes the end from the start (or vice versa). When a stage's scheduled end is set and the next stage's scheduled start is still null, the next stage's scheduled start **defaults to** the prior stage's scheduled end (defaults-only cascade — explicit downstream choices are never overwritten). These columns drive the **Forecast tab** below.

**Percent complete (workflow step)** (**v2.559**, gutter persistence **v2.562**): `project_workflow_steps.percent_complete` — optional 0-100 INT, nullable, `CHECK (... BETWEEN 0 AND 100)` (migration `20260519214147_add_percent_complete_to_project_workflow_steps.sql`). NULL = "not tracked"; the team only fills it in when they want a numeric progress signal independent of the discrete `status` field. Editable from three surfaces sharing a single source of truth: the **Forecast Specific gutter** (right-aligned cell with a `%` column header in the sticky gutter, edit gate **`dragEdit && canAlignStages(myRole)`** — the page's Edit toggle has to be on too, so by default every role sees the same muted read-only `NN%` text. **Hide-when-empty**: when the selected job has no `percent_complete` values anywhere AND the user isn't in Edit mode, the column is omitted entirely and `labelGutterWidth` shrinks from 300 to 260 so the stage name reclaims the freed space; toggling Edit on a job that already has a value doesn't reflow the timeline; **`pendingPercentByStageId`** also keeps the column visible immediately after the first save); the **Forecast Specific stage detail modal** header (**`Complete [N] %`**, edit gate `canEditExpectedDates(myRole)`); and the **Workflow expanded stage card** (new `Complete: [ N ] %` row directly under Expected dates, edit gate `canManageStages || s.assigned_to_name === currentUserName` so assignees can update their own progress without manager rights, no Edit-toggle requirement since the Workflow page doesn't have one). All surfaces parse user input through the same [`parsePercentCompleteInput.ts`](../src/lib/parsePercentCompleteInput.ts) helper (empty → null, **explicit `0` / anything that clamps or rounds to 0 (negatives, `0.4`) → null**, clamp 0-100, round fractionals). **v2.562** — Forecast Specific gutter commits stamp an optimistic **`pendingPercentByStageId`** overlay (merged into **`effectiveResolvedBars`**), call parent **`refreshStages()`** after a successful Supabase write, and blur focused gutter inputs when **Edit** toggles off so values are not lost on unmount. Intentionally NOT rendered on Forecast All Stages or collapsed Workflow rows. No bar fill yet — numeric display only.

**Forecast Specific pan window** (**v2.560**): the dense-mode calendar on Forecast Specific opens at a fixed 180-day window centered on today (`[today − 90, today + 90]`) instead of the selected job's stage envelope, and grows in 90-day chunks via in-line `←` / `→` **pan-pillar** columns sitting at the rail's start and end as inline-flex siblings of the day-grid block inside the scroller. The pillars scroll WITH the rail, so the user only sees them after scrolling all the way to the corresponding edge (`... | 22 | 23 | 24 | →`) — no day cells are obscured at any scroll position. Each click adds 90 days to that edge (window only grows, never slides) **and deliberately does NOT snap the scroller** — the user explicitly asked for "load the days but don't move me." `→` clicks need no scroll adjustment (new columns appear off-screen to the right); `←` clicks apply an explicit `scrollLeft += 90 × FORECAST_COL_W` adjustment so the cells the user was reading stay at the same on-screen position even though every existing cell shifted right when the new columns were inserted at the start of the rail. To see the freshly-loaded days the user scrolls in that direction manually. A toolbar `Today` button (left of `Edit`, only rendered when a job is picked and the day rail is visible) resets the view back to the "fresh page load" state: clears both pan overrides so the window snaps to `[today − 90, today + 90]`, and re-centers the scroller on today via a `todayResetTick` counter composed into the grid's `autoCenterTodayResetKey`. Resets to the default window on every job switch — no persistence (`reset_per_job` UX choice). Stages outside the visible window are reached by clicking the pillars; this is an explicit trade-off so different jobs all open at the same temporal anchor regardless of when their stages were scheduled. Pure helpers in [`src/lib/projectsForecastSpecificWindow.ts`](../src/lib/projectsForecastSpecificWindow.ts) (`computeForecastSpecificDefaultWindow`, `computeForecastSpecificEffectiveWindow` with only-grow guard, `extendForecastSpecificWindowLeft`, `extendForecastSpecificWindowRight`, exported `FORECAST_SPECIFIC_DEFAULT_BACK_DAYS = 90`, `FORECAST_SPECIFIC_DEFAULT_FORWARD_DAYS = 90`, `FORECAST_SPECIFIC_EXTEND_DAYS = 90`) — 13 unit tests. Sparse mode (`showDates === false`) has no day rail and no pillars. All Stages is unchanged — both pan props are optional and omitted there.

### Forecast tab (Projects)
A top-level tab on `/projects` (right of **Job History**, **v2.554**) that visualizes every workflow stage on every project-linked job as Gantt bars. Two independent sub-tabs share data + Realtime but keep their own filter state.

**Sub-tabs** (`?forecastSub=specific|all-stages`, default `specific`):

- **Specific** — one job, vertical stack of stage bars in `sequence_order`. Job picked via typeahead (substring match on HCP / name / address / project name); selection persists to `?forecastJob=` + `localStorage` `projects_forecast_specific_selected_job_v1`. Range auto-fits to the job's stage span ±3 days; user override persists under `projects_forecast_specific_range_v1` with a **Reset to fit** chip. Click a bar → opens `/workflows/${project_id}#step-${stage_id}` in a new tab.
- **All Stages** — one row per job-with-project, stages laid out side-by-side horizontally so dispatchers can spot crew-assignment gaps at a glance. Default range today − 7d → today + 90d (forward-leaning), persisted under `projects_forecast_all_range_v1`. **Only show jobs with active stages** checkbox filters out jobs whose every stage is `completed` / `approved` / `skipped`, persisted under `projects_forecast_all_active_only_v1`.

**Pure resolver** [`projectsForecastStageResolver.ts`](../src/lib/projectsForecastStageResolver.ts) walks each workflow's stages and emits a `ResolvedStageBar` per stage: `start = scheduled_start_date ?? prior.endYmd ?? actual(started_at) ?? todayYmd`; `end = scheduled_end_date ?? actual(ended_at) ?? ymdAddDays(start, 1)`. Stages with **no expected and no actual dates** render as **1-day grey dashed placeholders** chained at the prior stage's end (never invisible). Explicit `skipped` wins over the inferred `unscheduled` look so intentional skips keep their muted strikethrough swatch.

**Permissions**: relies entirely on existing `project_workflow_steps` RLS — dev / master see all; assistant / superintendent via `can_access_project_via_workflow`; subcontractor / helpers see only assigned stages (sparse but functional). No new RPCs.

**Scope**: jobs with `project_id IS NOT NULL` (any `status`); every stage of each job's workflow (every status).

### Template
Reusable workflow definition. Masters and devs can create templates with pre-defined stages. When creating a project, can select a template to auto-generate workflow stages.

**Database**: `workflow_templates`, `workflow_template_steps` tables

**Access**: Only dev can create/edit templates

### Clock Sessions / Pending Clock Sessions
User clock-in/clock-out records from the Dashboard. Each session has `clocked_in_at`, `clocked_out_at`, `work_date` (from clock-in date), required `notes` ("What are you working on?"), and optional `job_ledger_id` or `bid_id` for job/bid-level reporting (mutually exclusive). **Pending** sessions are clocked out but not yet approved or rejected. **Approved** sessions have hours merged into `people_hours`; **Rejected** sessions are in a separate section. Pay-access users approve, reject, or revoke in People Hours tab (and Quickfill Hours section). `approve_clock_sessions` RPC merges hours into `people_hours` (canonical **`person_id`** → **`people.id`** when resolvable, via **`people.account_user_id`** or a unique trimmed roster name match; denormalized **`person_name`** is still written for legacy readers) and, for sessions with `job_ledger_id`, auto-creates/updates `people_crew_jobs` via **`sync_crew_jobs_from_clock`**; for sessions with `bid_id`, auto-creates/updates `people_crew_bids` via **`sync_crew_bids_from_clock`**. Both sync RPCs now **always** write the computed `job_assignments` / `bid_assignments` for the person+date — the "skip if **`crew_lead_person_name`** is set" branch was dropped in **v2.538** after the freeze migration removed every follower row (see **Crew lead inheritance (deprecated)** below). `revoke_clock_sessions` subtracts hours and moves back to Pending, recomputing or removing crew jobs/crew bids when the session had a job or bid. **Pending table UX**: Time and duration on the first line of the time column; work date and location (or placeholder when GPS missing) on the second line; **Notes** and **Job/Bid** share a wide cell with the job/bid label under the notes; accountability uses two lines (actor line + short timestamp without seconds). Pending row actions are ordered **Approve**, **Reject**, **Edit**. Job/Bid label format: `J123 · [job name] - [address]` for jobs or `B456 · [project name] - [address]` for bids. Cross-midnight work (e.g. 11pm–1am) is attributed entirely to the clock-in date. Devs do not appear in the Pay roster; if a dev's session is approved, hours go to `people_hours` but are not visible in the Hours grid. **Pending vs payroll visibility on the Hours grid** (**v2.533**): Because **`people_hours`** is what **Draft Payroll** reads, closed pending sessions do not yet contribute to a person's payroll total even though the Hours grid cell shows **`max(people_hours, pending closed clock hours)`**. To stop operators from running payroll on phantom hours, every grid cell where pending sums to **more** than saved **`people_hours`** now renders an amber **`! n`** pill (gated on **`canAccessHours || canAccessPay`**); clicking opens **`PeopleHoursPendingCellPopover`** with per-row reject and a one-click **Approve all (n)** that calls **`approve_clock_sessions`**. A week-strip roll-up banner above the grid surfaces the org-wide gap (**`Pending: N people · H h not yet in payroll`**) with a **Review & approve** bulk modal (**`PeopleHoursBulkApprovePendingModal`**). Day-column headers get an amber dot and person rows get a `+X.XX pending` subline below the total. Detection lives in pure helpers in **[`src/lib/peopleHoursPendingByCell.ts`](../src/lib/peopleHoursPendingByCell.ts)** (closed sessions only, excluding rejected / revoked, salary-only people skipped). **Revoked filter on the cell display sum (v2.537)**: `loadPendingClockSessions` queries `approved_at IS NULL AND rejected_at IS NULL`, which still returns **revoked** rows (revoke clears **`approved_at`** but leaves **`rejected_at`** null and sets **`revoked_at`**). The same helper module now exports **`sumClosedPendingClockHoursForCell`** and **`pendingUnapprovedCountsByWorkDate`**, both of which explicitly skip **`rejected_at || revoked_at`**, so the cell value (`max(people_hours, pendingSum)`) drops revoked hours immediately after **`revoke_clock_sessions`** subtracts them from **`people_hours`** (this also fed the cost-matrix **Unapproved** column until the cost matrix was fully retired on 2026-07-15 — migrations `20260715090000` / `20260715120000`). Without this the badge logic (which already filtered revoked) and the cell value disagreed on the same row. Related: typing into an **empty** Hours grid cell builds a draft session and opens **`DashboardMyTimeDayEditorModal`**; **v2.533** also fixes that modal so **Close** persists the draft as a pending **`clock_sessions`** row even without a job/bid (previously the draft was silently discarded unless an additional edit marked the cluster dirty).

**Database**: `clock_sessions`

**Salaried auto-sessions**: For users with a salary workday template, **`origin = 'salary_schedule'`** rows are opened/closed by **`salary_sync_one_user_clock_sessions`** (cron via Edge **sync-salary-sessions**, or after saving Settings). **`salary_segment_index`** is null for a **continuous**-template canonical row, **`1`** / **`2`** for **split**-template slots, or **`1..N`** when a **continuous** parent was split in My Time into multiple **`salary_schedule`** segments. Splitting an **indexed** template slot turns new segments into **`user_punch`**. Sync implements half-open template windows, overlap guards for split mode, and (for **continuous**) closing **indexed** fragments at **`t_end`** once **`p_now`** has passed that end (**`20270516120000`**). See **[`SALARY_CLOCK_SESSIONS.md`](SALARY_CLOCK_SESSIONS.md)** (older “mass-close every open session at boundary” wording may not match the current function body).

**Add disjoint session (v2.571)**: a ghost-grey **`+`** at the bottom-right of the **`DashboardMyTimeDayEditorModal`** timeline scroll area opens **[`AddDisjointSessionModal`](../src/components/my-time-day-editor/AddDisjointSessionModal.tsx)** — a sub-modal with Clock in / Clock out **`datetime-local`** fields for inserting a new closed clock session on the current day without leaving the editor (intended use: *"I worked a second shift after dinner and forgot to clock back in"*). Defaults are last session end + 1 h gap + 2 h duration (e.g. last session 1–2 PM → 3–5 PM); empty days default to **8 AM** Chicago wall + 2 h via `salaryZonedWallClockToUtcMs`. Validation rejects blank fields, `out <= in`, sessions shorter than **`MIN_SEGMENT_MS`**, future-stamped times, and overlap with any existing session (open punches treated as extending to `nowMs`; the error names the conflicting range). On confirm, a normalized `DayEditorSession` is appended to local `fetchedSessions` with a synthetic **`DRAFT_PEOPLE_HOURS_SESSION_ID_PREFIX`** id + seeded `notes='Disjoint session'` so the existing **`isDraftPeopleHoursSessionId`** INSERT branch in `persistDirtyChangesAsync` persists it as a fresh `clock_sessions` row on the next Save. No new DB / RPC / migration code. Button is gated on `effectiveEditable && allowPunchTimeActions && !priorWeekGateActive && sessionsProp.length === 0 && !sessionsLoading && !pendingAuthForFetch` — i.e. self-fetched editor instances only; People-Hours-seeded callers (which pass `sessionsProp`) never see the button. **`closeTopmostSubFlow`** dismisses the disjoint sub-modal first on Escape / backdrop / discard-on-dirty. See **`RECENT_FEATURES`** **v2.571**.

### Job schedule blocks (planned work) / Linked crew block
**`job_schedule_blocks`** rows describe a planned work window on a job: **assignee** (`assignee_user_id`), **`work_date`**, Central wall-clock **`time_start`** / **`time_end`** (allowed range 4:00–20:00), optional **`note`**. Used in the Jobs **Schedule** modal, Calendar **planned** chips, and **Schedule dispatch** week grid. **Solo** rows (or older data) may have **`shared_block_group_id`** null. **New** inserts assign a random UUID to **`shared_block_group_id`** so every block can be linked-copied. Rows that share the same non-null **`shared_block_group_id`** are one **linked** (crew) block: they keep the same times and note; each person still has their own row. **Schedule dispatch** can use **+ → Linked copy** on a card to add another assignee’s leg; **Edit** updates every leg in the group; removing one leg does not remove the others. **Drag** to reassign another team member applies only to **solo** legs — linked legs use a disabled handle. **Add schedule block** opens a modal with an **occupied timeline** for that person-day: existing blocks appear as labeled bands; you can **drag** them to draft new times (linked legs on that day move together) before **Save**, which updates moved rows then inserts the new block (**RECENT_FEATURES** v2.296).

**Database**: `job_schedule_blocks` — migration **`20260407061043`** adds **`shared_block_group_id`**; **`20260407052651`** enforces minimum 30-minute duration.

### Job Mode (Dashboard)
A per-user, per-device toggle in the header gear menu (**[`Layout.tsx`](../src/components/Layout.tsx)**) that swaps the top of the Dashboard for a focused mobile-first card. When **Job Mode** is on, **[`Dashboard.tsx`](../src/pages/Dashboard.tsx)** takes an early-return path that renders only the tally / pinned-tabs banner, **[`DashboardJobModeCard`](../src/components/jobMode/DashboardJobModeCard.tsx)**, the existing `AdditionalReportModal`, and a **Show full dashboard** link (component-local state, resets every page load).

**Behavior** — clock-driven advance through today's `job_schedule_blocks`:

- The card derives "current job" from the user's open `clock_sessions` row (so it matches whatever they're billing time to) and "next job" from the next scheduled block whose `job_id` differs from the current one.
- Pure picker **[`pickCurrentAndNextScheduleBlock`](../src/lib/jobModePickCurrentNext.ts)** handles every state — `no-clock-no-schedule`, `not-clocked-in-with-schedule`, `on-scheduled-job-not-last`, `on-scheduled-job-last`, `on-off-schedule-job`, `on-bid` — and the right-hand button label adapts (Clock In / Start First Job / Next Job / Last job of the day / Switch to Scheduled Job / Start First Scheduled Job / Choose Next Job).
- Tapping **Next Job** opens **[`JobModeAdvanceNotesModal`](../src/components/jobMode/JobModeAdvanceNotesModal.tsx)** (single-line notes; **Cancel** / **Skip notes** / **Confirm**, Enter submits, Escape cancels). Confirm calls `applyUpdateFocusDirect` on **[`UpdateFocusOpenerBridgeContext`](../src/contexts/UpdateFocusOpenerBridgeContext.tsx)**, which **[`ClockInOutButton`](../src/components/ClockInOutButton.tsx)** registers — same close-current-row + insert-new-row mutation as the Update Focus modal (or in-place `UPDATE` for salaried users; `INSERT`-only when there's no open session).
- Multi-window same-job continuations (e.g. 8–12 + 1–5 on the same job) are skipped when picking "next" — Next Job means a different `job_id`. When the only later blocks are the same job, state is `on-scheduled-job-last` and the right button disables as **Last job of the day**.
- **Schedule blocks are jobs only** — there is no `bid_id` on **`job_schedule_blocks`** — so when the user is clocked into a bid, the card shows a "Clocked into a bid" header and Next Job points at the first scheduled block.

**Storage** — `localStorage` key `dashboard_job_mode_${userId}` (per-user suffix so a shared phone doesn't leak between accounts), with the `storage` event syncing across tabs. Mirrors the **`dashboard_clock_strip_scope`** pattern; toggle implemented in **[`jobModeToggle.ts`](../src/lib/jobModeToggle.ts)** + **[`useJobModeEnabled.ts`](../src/hooks/useJobModeEnabled.ts)**.

**Visibility** — toggle gated by **`canLeaveJobFieldReport(role)`** in the gear dropdown (all 9 roles: dev, master_technician, assistant, controller, helpers, subcontractor, estimator, primary, superintendent — the predicate uses `isAssistantLike`, so controller passes; [`canLeaveJobFieldReport.ts`](../src/lib/canLeaveJobFieldReport.ts)). Without that capability the buttons would be useless.

**Realtime / day rollover** — the card subscribes to `postgres_changes` on `clock_sessions` (this user) and `job_schedule_blocks` (this user, this `work_date`); a 1-minute interval re-checks `denverCalendarDayKey(Date.now())` so a long-open page rolls over at midnight. The picker is fully unit-tested (14 cases) so adding new state branches is safe.

**See also** — **`RECENT_FEATURES.md`** **v2.545**, **`PROJECT_DOCUMENTATION.md`** Dashboard **Job Mode**.

### User Review modal
A global, full-screen modal (**[`UserReviewModal`](../src/components/UserReviewModal.tsx)** + **[`UserReviewModalContext`](../src/contexts/UserReviewModalContext.tsx)**) opened by clicking a person's **name** on the Dashboard's **`DashboardTeamActiveClockStrip`** (the "Currently In" / "Clocked in today" strip). It pairs a read-only **schedule view** with an optional **Mercury transaction summary** for the same date window, all keyed to one subject user.

**Three view modes** toggle in the toolbar:
- **Day** — one day's schedule strip + transactions.
- **Week** — Sunday–Saturday company week (`companyWeekStartSundayContaining`), one strip per day + transactions for the whole week.
- **Month** — rolling 30-day window anchored on the selected day, one strip per active day (empty days collapse) + transactions for the window.

Prev / next chevrons step by one unit (day, week, or 30-day window); a **Today** button returns to the present.

**Top section (all roles)** — read-only `DispatchAddBlockTimeRange` strips per day (no thumbs, no proposed range, no drag) showing **`job_schedule_blocks`** (occupied bands) + closed **`clock_sessions`** (secondary bands). Built from **[`UserDayScheduleSection`](../src/components/userReview/UserDayScheduleSection.tsx)**, **[`UserWeekScheduleSection`](../src/components/userReview/UserWeekScheduleSection.tsx)**, **[`UserMonthScheduleSection`](../src/components/userReview/UserMonthScheduleSection.tsx)**. Realtime via `useRealtimeChannel` on both source tables.

**Bottom section (banking roles only)** — **[`UserMercuryWindowSection`](../src/components/userReview/UserMercuryWindowSection.tsx)**: Mercury transactions attributed to or person-tagged for the subject during the window, summarized **By Job** / **By Label** / **By Date** (segmented sort under the centered `Transactions: -$X · N tx` total, persisted under `localStorage` key `user_review_tx_sort_v1`). Non-banking roles see no Transactions section at all.

**Interactions inside the modal:**
- **Date header click** (Week / Month, all viewports) opens **[`UserDaySummaryModal`](../src/components/userReview/UserDaySummaryModal.tsx)** — read-only list of that day's blocks + sessions; rows click-through to **`ScheduleBlockPreviewModal`** (block) or **`DashboardMyTimeDayEditorModal`** (session, staff-gated).
- **Name-in-title click** (all modes, all viewports) opens **[`UserReviewSwitchUserModal`](../src/components/userReview/UserReviewSwitchUserModal.tsx)** for staff (`dev` / `master_technician` / `assistant` / `superintendent`) — a `SearchableSelect` over the last 30 days of distinct **`clock_sessions.user_id`** (archived users dropped, current subject omitted). Picking a user preserves the anchor day + the current Day / Week / Month tab.
- **Schedule strip clicks** route to `ScheduleBlockPreviewModal` (block bands) or `DashboardMyTimeDayEditorModal` (clock-session bands, staff-gated).

**Schedule rail trim + stretch** — see **[Schedule rail trim / stretch (User Review modal)](#schedule-rail-trim--stretch-user-review-modal)** below.

**See also** — **`RECENT_FEATURES.md`** v2.566 (User Day Summary), v2.567 (Switch user), v2.568 (rail trim), **v2.569** (rail stretch + 4 h floor); **`PROJECT_DOCUMENTATION.md`** Dashboard **User Review modal**; **`AGENTS.md`** "Where to Look For" → User Review modal rows.

### Schedule rail trim / stretch (User Review modal)
The grey background rail under each per-day schedule strip in the User Review modal is **rescaled** to show only the active part of the day, edge-to-edge, instead of always spanning the full 4 AM – 8 PM track. Specific to the User Review modal — Quickfill and Schedule Dispatch keep the full-rail layout.

**How the window is computed:**
- One shared `{ loSlotIndex, hiSlotIndex } | null` per view (Day = 1 row, Week = 7 rows, Month = active days) via pure helper **[`computeUserReviewSharedSlotWindow`](../src/lib/userReviewSharedSlotWindow.ts)** — `null` when zero bands exist anywhere in the view.
- A **4-hour minimum floor** (8 slots at 30-min granularity) is applied at the orchestrator boundary via **`applyRailWindowMinFloor(window, USER_REVIEW_RAIL_MIN_FLOOR_SLOTS = 8)`** — expands a tiny single-event window symmetrically around its midpoint, re-clamps to the legal slot range, and shifts the deficit to the opposite side when one edge clamps. So a 30-min punch at 9 AM expands to roughly 7:30 AM – 11 AM, and a 30-min punch at 4 AM expands to 4 AM – 8 AM.

**How the strip renders the window:**
- `null` → rail is hidden entirely (empty day).
- `{ lo, hi }` → the visible strip *is* the window. Bands, proposed-range fill, inline tick marks, and orientation labels (`8 AM` / `12 PM` / `4 PM`) all route through internal helper `slotToTrackT(slotIndex, slotCount, window)` so they paint at their wall-time x in the rescaled strip; labels filter to inside-window marks only.
- The shared header **`QuickfillScheduleOrientationLabelsRow`** above the strips tracks the same rescale via an optional `railTrimWindow` prop.

**Cross-row alignment** is preserved by the shared-window invariant: every row in the same view uses the same `{ lo, hi }`, so a band at `9 AM` lands at the same screen x on every row. The trade-off is that `9 AM` sits at *different* screen x in Day vs Week vs Month because each view's window can differ.

**Opt-in prop** — **`railTrimWindow?: { loSlotIndex; hiSlotIndex } | null`** on **[`DispatchAddBlockTimeRange`](../src/components/schedule/DispatchAddBlockTimeRange.tsx)**. Default-`undefined` keeps the original `slotIndex / maxIdx` math byte-for-byte, so every non-User-Review caller (Quickfill, Schedule Dispatch hub / job week, schedule-block modals) stays on the full-rail layout with zero behavior change.

**See also** — **`RECENT_FEATURES.md`** **v2.568** (trim), **v2.569** (stretch + floor); **`AGENTS.md`** User Review modal "Shared schedule-rail trim + stretch" row.

### Crew lead inheritance (deprecated)
Legacy feature on **`people_crew_jobs`** / **`people_crew_bids`** where a follower row could set **`crew_lead_person_name`** to inherit that lead's `job_assignments` / `bid_assignments` for the same `work_date`. Removed in **v2.538** because the business now drives crew hours and billing off clock sessions (hourly people get their own approved clock; salary people get sessions split across their paid hours), so inheritance no longer matches how time is allocated.

- **Freeze migration** **`20260516154601_freeze_crew_lead_inheritance.sql`** materialized every follower row's effective assignments (`COALESCE(lead.job_assignments, '[]'::jsonb)` for orphans), snapshotted the pre-freeze state into unprivileged backup tables **`public._freeze_crew_lead_jobs_backup`** / **`_freeze_crew_lead_bids_backup`** (no RLS / grants, service-role only), then set **`crew_lead_person_name = NULL`** on every row. A `DO $$` guard at the end of the transaction throws if any follower rows are left. Pre-flight audit: **116** job follower rows + **29** bid follower rows; post-migration count is **0** on both tables. Idempotent — safely re-runnable.
- **Sync RPC freeze** **`20260516162434_drop_crew_lead_inheritance_from_sync_rpcs.sql`** dropped the "skip if **`crew_lead_person_name`** is set" branch in **`sync_crew_jobs_from_clock`** / **`sync_crew_bids_from_clock`** and forces **`crew_lead_person_name = NULL`** on every `INSERT` / `ON CONFLICT DO UPDATE` they perform. **`approve_clock_sessions`** / **`revoke_clock_sessions`** still call those RPCs, so every approved session now always rewrites the person's own assignments for that day instead of skipping followers.
- **Client code** — **`CrewJobsBlock.tsx`** dropped its **Crew** column and crew-lead picker; **`peopleHoursUnallocatedRows.ts`**, **`payReportAssignmentsBreakdown.ts`**, **`draftPayrollPersonBreakdown.ts`**, **`crewAssignments.ts`**, **`teamLabor.ts`**, **`HoursUnassignedModal.tsx`**, **`PeopleHoursDayAuditModal.tsx`**, **`QuickfillUnassignedFieldTimeSection.tsx`**, **`HoursSection.tsx`**, **`People.tsx`**, **`Jobs.tsx`** all read `row.job_assignments ?? []` directly (no more `crew_lead ? lead.assignments : row.assignments` fallback). Four inheritance-mismatch unit tests in **`peopleHoursUnallocatedRows.test.ts`** were dropped (16 tests still pass).
- **Column status** — **`people_crew_jobs.crew_lead_person_name`** and **`people_crew_bids.crew_lead_person_name`** still exist in the schema but are **always `NULL`** post-freeze. No further reads should be added; a future migration may drop the columns once any external consumers are updated.

**See also**: **`RECENT_FEATURES.md`** **v2.538**, **`MIGRATIONS.md`** **`20260516154601`** + **`20260516162434`**, **`PROJECT_DOCUMENTATION.md`** People **Team Costs Tab**.

### Not coming in (Schedule Dispatch)
A single-day **`user_time_off`** row with **`kind='unpaid'`** + **`note='Not coming in'`** that the dispatcher records from **Schedule Dispatch** to mark someone as not working that day. The mark drives three behaviors at once on the dispatch grid (Hub + JobWeek), and is the only **`user_time_off`** variant the grid surfaces a write affordance for — PTO and other off-ranges still come from People / Calendar.

- **Recording it** — Picker footer **Not coming in today** on the **Add job to schedule** modal (single person + day intent only) → `recordNotComingInForUserAsStaff` → `pay_staff_bulk_insert_user_time_off` RPC (single-day **`unpaid`** insert) → bulk `deleteJobScheduleBlock` for **every** block on that user/day across **every** job (not just the job that was about to be added). If the user already has any overlapping `user_time_off` row (PTO etc.), the helper short-circuits with `alreadyMarked: true` instead of inserting a duplicate.
- **Showing it** — **[`ScheduleDispatchTimeOffChip`](../src/components/schedule/ScheduleDispatchTimeOffChip.tsx)** renders a red **Not coming in** pill at the top of every cell whose assignee has the row, fed by **[`userTimeOffByCell.ts`](../src/lib/userTimeOffByCell.ts)** (chunked fetch + per-cell map; pure mapping covered by 14 unit tests). PTO and multi-day unpaid render as the amber **Off** variant from the same module. The chip is centered both axes when the cell has no blocks; sits at the top center when blocks are below it.
- **Disabling new work while it's on** — Each cell computes `cellHasTimeOff` and uses it to (a) `useDroppable({ disabled: true })` so DnD reassign / linked-copy bounces, (b) hide the **Add block** / `+` triangle, (c) grey out (`#f3f4f6`) during placement / picker / multi-cell flows, (d) ignore click-to-add. Existing blocks render and remain fully interactive (edit / delete / link copy) so cleanup edge cases stay accessible.
- **Undoing it** — Click the red chip → **[`ScheduleDispatchUndoNotComingInModal`](../src/components/schedule/ScheduleDispatchUndoNotComingInModal.tsx)** (Cancel / **Mark as coming in**) → `removeNotComingInForUserAsStaff` → SECURITY DEFINER RPC **`pay_staff_remove_not_coming_in_for_user_day`** (migration **`20260515233801`**). The RPC is **tightly scoped** server-side: only deletes rows where `start_date = end_date = p_work_date AND kind = 'unpaid' AND note = 'Not coming in'`, then re-runs `sync_salary_clock_sessions_for_user_day` for the day. Authz gate is identical to the insert RPC. Schedule blocks deleted on the way in are **not restored** on undo (they're hard-deleted) — the dispatcher re-adds with one click in the picker.

**Roles**: dev / master_technician / assistant / superintendent (same as `/schedule-dispatch` access).

**Database**: `user_time_off` — migration **`20270331170000`** (table); **`20270331190000`** (`kind='unpaid'` constraint); **`20270331192000`** (insert RPC); **`20260515233801`** (undo RPC).

**See also**: **`AGENTS.md`** **Schedule dispatch** rows; **`RECENT_FEATURES.md`** **v2.535**.

### Unassigned field time / Open day audit
Per (person, work_date) cells where the org **paid for field-type time** that the team summary cannot tie to a specific revenue-generating job. Surfaced in **Quickfill** as a section gated to **dev** / **master_technician** / **assistant** (**v2.537**, **`quickfill_section_marks.section_id = 'unassigned-field-time'`**). The math mirrors **`derivePersonTeamSummary`** under **Convention 1** (**v2.539**) and is purely client-side.

**v2.546 — approved-clock-only sourcing.** Every input now comes from approved-closed `clock_sessions` only — no `people_hours` lookup, no salary 8h phantoms on no-clock days. New pure helper **`buildApprovedClosedHoursByPersonByDate`** sums approved-closed clock hours per (person, work_date) across every bucket (office / bid / field / unassigned). The math becomes:

- `approvedClockOnDay = Σ approved-closed clock hours for person+date (all buckets)`
- `dayHoursRaw = is_salary ? (weekday && approvedClockOnDay > 0 ? 8 : 0) : approvedClockOnDay`
- `overheadOnDay` = approved closed clock on the **org office job** (**`overhead_office_job_ledger_id_v1`**) plus any **bid-only** clock that day
- `fieldHours = max(0, dayHoursRaw − overheadOnDay)`
- **`crewAttributedHrs = dayHoursRaw × Σ pct/100`** over **`people_crew_jobs`** + **`people_crew_bids`** assignments excluding the office job (**share-of-total-day**, matches the **`sync_crew_jobs_from_clock`** trigger and `teamLabor.ts` / `payReportAssignmentsBreakdown.ts` — see **v2.539** Option E)
- `unallocatedHrs = max(0, fieldHours − crewAttributedHrs − subLaborHrs)`

**Two key consequences of v2.546**: (1) **manual `people_hours` overrides** no longer create rows when no clock backs them up (hourly people now read straight from approved clock); (2) **salary weekdays with zero approved clock** (PTO, sick, no-show) no longer produce a phantom 8h unallocated row — `dayHoursRaw = 0` returns no candidate. **Pending sessions are explicitly excluded** by the caller's Supabase query (`approved_at IS NOT NULL`, `rejected_at IS NULL`, `revoked_at IS NULL`, `clocked_out_at IS NOT NULL`) and by `buildApprovedClosedHoursByPersonByDate` itself — they live on the **Pending Sessions** UI instead (v2.537) and the Unassigned list waits until payroll has caught up.

Only rows with **`unallocatedHrs > thresholdHours`** emit (default **1 h**, configurable to 0.25 / 0.5 / 1 / 2 / 4); window is **3 / 7 / 14 / 30** days (default **14**). All compute lives in **[`peopleHoursUnallocatedRows.ts`](../src/lib/peopleHoursUnallocatedRows.ts)** (**21** unit tests as of v2.546 — added: `buildApprovedClosedHoursByPersonByDate` sums-all-buckets + ignores-non-approved; `skips salary weekdays with NO approved clock`; `skips when a closed session is still pending approval`; `uses approved-clock hours (not people_hours) for hourly people`; the Paige-shaped Office + non-Office regression from **v2.539** stayed green).

**Open day audit** is the per-row action that mounts **`PeopleHoursDayAuditModal`** for that (person, work_date). The modal is the same component used by the People → Hours grid correct-day audit, with **v2.537** additions:

- **Dispatch** panel above **Clock sessions** — read-only **`QuickfillScheduleUserRow`** strip (primary scheduled bands from **`job_schedule_blocks`**, secondary recorded bands from approved closed **`clock_sessions`** via **`clockSessionsToDispatchSecondaryBands`**) + plain-text block list (`time_start–time_end · job/HCP · note`) + **Open in Schedule Dispatch** deep-link (**`/schedule-dispatch?week={Sunday}&day={workDate}`**).
- Per-row session **Approved** / **Pending** / **Open** badge + inline **Approve** button (closed pending only, gated on **`canEditCrewJobs`**) → **`approveClockSessions`** RPC (refreshes sessions, bubbles **`onCrewSaved`** so the parent Quickfill list drops the row when the gap closes).
- **Pending-approval banner** in **Job / bid assignments** when there are no crew assignments yet but pending closed sessions link to a job/bid: lists up to two distinct labels then `and {n} more`, with **Approve all (N)** for **2+** sessions.
- The reason this fixes "no crew assignment despite a dispatched job + clocked session": **`people_crew_jobs`** is populated by **`sync_crew_jobs_from_clock`**, which the **`clock_sessions_sync_crew_assignments_after_job_bid`** trigger (migration **`20260402120000`**) only runs for **approved** sessions — pending sessions never auto-create the crew row.

**v2.545 addition** (canonical fix path): per-clock-session **`Assign`** popover — every clock-session row whose `job_ledger_id` and `bid_id` are both null shows the shared **`AssignSessionJobPopover`** (`src/components/clock-sessions/AssignSessionJobPopover.tsx`, the same control the Dashboard clock strip uses) right beside the **Approve** / **Edit** buttons in the row's actions cluster, gated on **`canEditCrewJobs && !sessionsUserMissing && !!s.user_id && !s.job_ledger_id && !s.bid_id`**. Portal `popoverZIndex={1110}` (above the modal's `zIndex: 1002`); Dispatch quick-picks seeded from `dispatchScheduleAssigneeUserId={s.user_id}` + `dispatchScheduleWorkDateYmd={workDate}`. On save it `UPDATE`s **`clock_sessions.job_ledger_id`** (or `bid_id`) → **`clock_sessions_sync_crew_assignments_after_job_bid`** trigger (migration **`20260402120000`**) fires → **`sync_crew_jobs_from_clock`** runs (per v2.538 it always rewrites `job_assignments`, no `crew_lead` short-circuit) → **`people_crew_jobs.job_assignments`** auto-populates server-side. The modal's `onSaved` hook calls `refreshSessions()` + bubbles `onCrewSaved?.()` so the Quickfill Unassigned section re-runs `loadAll` + `computeUnallocatedFieldRows`. **This is now the canonical fix** for "session was never linked to a job" — preferred over the v2.543 direct-`people_crew_jobs` write because it stays consistent with payroll forever (re-running `sync_crew_jobs_from_clock` for any reason will reproduce the same allocation).

**v2.543 additions** (UX, no math change; positioned around the v2.545 canonical fix above):

- **`Assign a job or bid`** inline CTA — when **`canEditCrewJobs && !isEditMode`** and the day has zero crew assignments, a blue-outline button sits next to *No job or bid assignments for this day.* in the **Job / bid assignments** panel. One click flips `isEditMode = true`, opens `jobSearchOpen` with cleared `jobSearchText` / `jobSearchResults`, and surfaces the same **Search HCP, bid #, job name, project, address…** input + `addAssignmentToDraft` flow the **Edit** button has always exposed. Picking a result sets the row to **100%** and the existing **Save crew** path persists via the same `people_crew_jobs` / `people_crew_bids` upserts. **Post-v2.545** this path is the **override** route — useful when the session was overhead / non-billable and shouldn't allocate to the linked job at all; for the *"session is missing its job link"* case, use the v2.545 per-row **`Assign`** popover instead so the source of truth is the clock session itself.
- **View-mode subtitle now matches reality** — the hardcoded *“This day is marked Correct (view only).”* was misleading because the modal never actually consults **`hours_reviewed`**, and `canEditCrewJobs` users could always click **Edit**. New ternary: editing → existing copy; `!isEditMode && canEditCrewJobs` → *“Click Edit to change assignments or sessions.”*; `!canEditCrewJobs` → *“View only — you don't have permission to edit this day.”*

**Three repair paths in one modal** (covers every shape of "unallocated time"):

| Cause | Fix path | Version |
|---|---|---|
| (a) Session was never linked to a job | Per-row **`Assign`** popover | **v2.545** |
| (b) Session is linked but not yet approved | Per-row **Approve** / **Approve all (N)** banner | **v2.537** |
| (c) Session is overhead / non-billable and shouldn't allocate | **`Assign a job or bid`** CTA on the empty assignments panel | **v2.543** |

**Roles**: dev / master_technician / assistant.

**Database**: read-only at the audit-modal level — uses existing **`people_pay_config`**, **`people_hours`**, **`people_crew_jobs`**, **`people_crew_bids`**, **`clock_sessions`**, **`app_settings.overhead_office_job_ledger_id_v1`**. The v2.545 per-row **`Assign`** popover does `UPDATE clock_sessions SET job_ledger_id = …` (or `bid_id`) for the targeted row only; downstream `people_crew_jobs.job_assignments` writes are server-side via the existing trigger + RPC.

**See also**: **`AGENTS.md`** **Quickfill Unassigned field time** row; **`PROJECT_DOCUMENTATION.md`** §6b Quickfill; **`RECENT_FEATURES.md`** **v2.546**, **v2.545**, **v2.543**, **v2.537**.

### Team Summary (People → Review)
Dev-only per-person rollup table embedded in **People → Review** (and also openable in a fully-interactive popup via **Open in new window** — renamed from *Open in print view* in **v2.542** since the popup is interactive, printing is just one of many things you can do with it). Built by **`derivePersonTeamSummary`** in **[`src/pages/People.tsx`](../src/pages/People.tsx)** from a single shared **`TeamReviewUnion`** loaded by **`loadTeamReviewUnion`** (one snapshot fetched per period / paid toggle change, not per row; popup short-circuits to the cached inline rows when the cache key still matches — see `teamSummaryDataCacheRef` / `buildTeamSummaryCacheKey` from **v2.542**). Renders **11 columns**: **Name** · **Hours** · **Overhead hrs** · **Overhead labor** · **Field hrs** · **Gross Revenue** · **Net Revenue** · **Profit (after overhead)** · **Gross Revenue/hr** · **Net Revenue/hr** · **Profit/hr (after overhead)**, sorted by `r.profit` desc with name tiebreak; footer is the team total.

Every cell is click-to-drilldown (`data-type` attribute → modal HTML built by `buildXxxBody`). Numeric **0** values render as `—` and are not clickable. **`@media print`** hides modals + click chrome so the print popup matches the on-screen table.

**Drilldown modal layout convention (v2.547)** — all eight modals (**Hours**, **Overhead hours**, **Overhead labor**, **Field hours**, **Gross Revenue**, **Net Revenue**, **Profit (after overhead)**, **Gross Revenue/hr**, **Profit/hr (after overhead)**) follow a single layout idiom: the running total appears in the modal title (`Hours breakdown — Abraham · 50.8 hrs`, `Gross Revenue breakdown — Abraham · $872`, etc.) so the headline metric is always above the fold; explanatory paragraphs appear at the bottom as `.caption` text rather than at the top. **Hours breakdown** displays a hierarchical Day → indented allocation list (`(percent) Job # | Job Name - address` per line) and includes Office and Bid allocations alongside field jobs (the modal-only `crewByDateForPerson` builder reads `union.periodCrewRows` without filtering Office and reads `union.periodCrewBidRows` for bid sessions). **Per-day Value Created (v2.591):** each allocation line is prefixed with a green `[$value]` = the person's cost-share (`dayCost / totalLaborOnJob`, same basis as the **Gross Revenue** column) of that job's Value Created, so the per-day values reconcile with the person's Gross for the job (`pct_complete` null → 100%; Office/bids → $0). Stored on `crewAllocations` as `valueCreated`; see `derivePersonTeamSummary.ts`. **Overhead hours breakdown** mirrors the Hours layout, splitting sessions into centered `Office · N hrs` and `Bids · N hrs` section headers with per-day blocks underneath each — Office sessions render as `(pct) 8:00 AM → 5:30 PM · N hrs`, bid sessions as `(pct) B249 | Project Name - address · N hrs`. Field-revenue math is unchanged in all of these — the wider builds only feed the modal display, while `derivePersonTeamSummary` still uses `crewJobsWithLeadFiltered` for the field-revenue rollup so Office and bids stay out of it. Plumbing additions for v2.547: `TeamReviewUnion.periodCrewBidRows`, `TeamReviewUnion.bidsById` (with `address`), `TeamReviewUnion.overheadSessionsByPerson`, new `OverheadSessionLine` type + `TeamSummaryRow.overheadSessions`.

**Convention 1** (**v2.539**): per-person crew labor multiplies crew percentages by **`dayHoursRaw`** (share of total session hours, including the configured Office overhead job), matching the `sync_crew_jobs_from_clock` trigger and `teamLabor.ts` / `payReportAssignmentsBreakdown.ts`. Office and bid clock sessions get their own crew rows and feed the **Overhead hrs** / **Overhead labor** columns rather than the field-revenue rollup.

**Profit (after overhead)** = `r.profit − r.fieldHours × overheadRate`, where `overheadRate = overheadTotal / fieldHours90d` (rolling 90-day window). Office and bid hours are not charged the rate (they fund it), so a pure office worker shows **$0** Profit (after overhead) — their cost shows in **Overhead labor** instead.

**See also**: `Overhead labor (Team Summary column)`, **`PROJECT_DOCUMENTATION.md`** Review Tab, **`RECENT_FEATURES.md`** **v2.547** + **v2.542** + **v2.541** + **v2.540** + **v2.539**, **`AGENTS.md`** Team Summary row.

### Overhead labor (Team Summary column)
Per-person column in **People → Review → Team Summary** (**v2.540**) that displays **`-((officeHours + bidHours) × people_pay_config.hourly_wage)`** — i.e. the wage cost of the time a person spent on the configured Office job and on bid work. Stored as a **negative dollar amount** so it renders `-$X` red via `negStyle`, the team-total footer is negative, and the column reads visually like a P&L line item. Column position: between **Overhead hrs** and **Field hrs**.

**Why only office + bid (not field)** — Field labor is already subtracted at the per-job level inside **Net Revenue** (`job_net = revenue − parts − total_labor`). Re-adding `fieldHours × wage` here would visually double-count for field workers. The column exists specifically to surface the wage cost of overhead workers (office staff and estimators), who otherwise appear to "cost nothing" because their hours never flow into a revenue-generating job.

**Drilldown** (`buildOverheadLaborBody`) shows source (`hourlyWage` from `people_pay_config`, salary vs hourly), the **Office** and **Bid** rows split out as `-$X`, the overhead-labor footer total, and a separate **For context: this person's field labor** memo row that displays `fieldHours × wage` greyed out with the explanatory note that it lives in **Net Revenue** rather than this column. Cell is clickable only when `n < 0`; pure field workers (no office or bid hours) render `—`.

**Profit columns are not affected** — the Overhead labor column is a transparency/visibility line; it does not modify Gross Revenue, Net Revenue, or Profit (after overhead) in the same row, all of which continue to be computed by `derivePersonTeamSummary` with their pre-existing formulas.

**Files**: [`src/pages/People.tsx`](../src/pages/People.tsx) — `TeamSummaryRow.overheadLaborCost`, `cellOverheadLaborClickable`, `buildOverheadLaborBody`, click router branch `overhead_labor`.

**See also**: `Team Summary (People → Review)`, **`PROJECT_DOCUMENTATION.md`** Review Tab, **`RECENT_FEATURES.md`** **v2.540**.

### My Roles Goals / Daily goals gate
Per-user checklist lines (**`user_dashboard_goals`**) edited by dev, master, or assistant in Settings. After the **first successful clock-in of a calendar day**, if the user has at least one goal, a full-screen overlay titled **“My Roles Goals”** appears; **Continue** writes **`user_daily_goals_ack`** for that local date so the gate stays off until the next calendar day.

---

## Access Control

### Adoption
Process where a master grants an assistant access to their customers and projects. Creates a many-to-many relationship allowing assistants to work for multiple masters.

**Database**: `master_assistants` table with `(master_id, assistant_id)` pairs

**Effect**: Assistant can see and work on adopted master's data

**UI**: Managed in Settings page with checkboxes

### Sharing
Process where a master grants another master assistant-level access to their data. Shared masters can view but not modify, and cannot see private notes or financial totals.

**Database**: `master_shares` table with `(sharing_master_id, viewing_master_id)` pairs

**Effect**: Viewing master gets read-only access to sharing master's data

**Use Case**: Collaboration, backup coverage, training

### RLS (Row Level Security)
PostgreSQL security mechanism that filters database rows based on user context. Every table has policies defining who can SELECT, INSERT, UPDATE, or DELETE rows.

**Implementation**: SQL policies in migration files

**Common Pattern**: Check ownership OR dev role OR adoption OR sharing

### SECURITY DEFINER
PostgreSQL function attribute that runs the function with the creator's permissions instead of caller's. Used to bypass RLS in helper functions to prevent recursion and timeouts.

**Use Case**: Helper functions like `is_dev()`, `can_access_project_via_step()`

**Caution**: Use sparingly; creates security risk if misused

### Ownership
Relationship where a user owns a resource (customer, project, purchase order). Indicated by `master_user_id` or `created_by` foreign key to `users.id`.

**Pattern**: Users can always access their own resources

**Inheritance**: Projects inherit owner from customer (automatic)

### Read-only (training) mode
Per-user flag (`users.read_only`) a dev sets from Active Accounts that lets someone browse everything their role can see while blocking every direct INSERT/UPDATE/DELETE. Enforcement is two-layered: restrictive RLS policies created by `apply_read_only_write_blocks()` (migration `20260713090000`) plus a statement-level `read_only_block_stmt` trigger attached by `apply_read_only_stmt_blocks()` that also stops writes inside `SECURITY DEFINER` RPCs (migration `20260717000000`, which extended the flag from assistant/controller to **every role**). Nobody can flag or unflag their own account — only devs change it — and JWT-less writers (cron, service-role, edge functions) are deliberately unaffected.

**Database**: `users.read_only`, `is_read_only()`, `apply_read_only_write_blocks()`, `apply_read_only_stmt_blocks()`

**See**: `ACCESS_CONTROL.md` → Read-only (training) mode; `MIGRATIONS.md` → `20260713090000`, `20260717000000`

### Deleted-records archive & restore
Dev-only safety net for hard deletes: a `BEFORE DELETE` trigger (`archive_deleted_record()`, `SECURITY DEFINER`) snapshots deleted rows from high-value tables (jobs, bids, reports, customers→projects trees, people roster + cascades) into **`public.deleted_records_archive`**, grouped by the top-level record with `deleted_by`/`deleted_at`; rows auto-purge after 90 days. Two dev-only RPCs drive restore: `list_deleted_records(p_limit)` and `restore_deleted_records(p_group_key, p_dry_run)` — all-or-nothing with a dry-run preview (dangling nullable FKs are nulled + warned; dangling NOT NULL FKs block the restore). Surfaced in **Settings → Data & migration → Recently deleted (dev)**.

**Database**: `deleted_records_archive`; migrations `20260716120000` (archive), `20260716150000`/`20260716230000` (coverage), `20260716180000`/`20260716210000` (restore), `20260717210000` (people)

**See**: `ACCESS_CONTROL.md` → Deleted-records archive; `RECENT_FEATURES.md` → v2.696–v2.699

---

## Workflow Concepts

### Line Item
Financial entry on a workflow stage representing materials, labor, or expenses. Has memo, amount, and optional link to external resources. Also called **Line Items For Office** in the UI.

**Database**: `workflow_step_line_items` table

**Access**: Masters and assistants can add/edit; assistants cannot see totals

**Optional**: Can link to purchase order for material tracking. Can link to supply house invoices; "View Invoice" button opens invoice details.

### Projection
Forward-looking financial estimate for a workflow. Represents expected future costs or revenue.

**Database**: `workflow_projections` table

**Access**: Masters only (dev can see)

**Visibility**: Not visible to assistants or subcontractors

### Private Note
Owner-only note on a workflow stage. Not visible to assistants, subcontractors, or shared masters.

**Database**: `private_notes` field on `project_workflow_steps`

**Access**: Only owner (master) and dev can see/edit

### Action / Action Ledger
Status change event recorded in history (started, completed, approved, rejected, reopened). The rejected action displays as "Previous work incomplete". Provides complete audit trail of stage lifecycle.

**Database**: `project_workflow_step_actions` table

**Tracked**: action_type, occurred_at, performed_by, notes

**Purpose**: Complete stage history for accountability and analysis

### Ledger Total
Sum of all line items for a workflow. Shows total costs/expenses across all stages.

**Calculation**: Client-side sum of line item amounts

**Visibility**: Masters and dev only (hidden from assistants)

### Total Left on Job
Remaining budget after subtracting ledger total from projections.

**Calculation**: Projections - Ledger Total

**Visibility**: Masters and dev only (hidden from assistants)

### Charges & Value timeline (Jobs — Job Summary / Job Detail / Edit Job)
Profit step chart for one job: the main line is **payments received − charges** (charges step DOWN in red with per-source icons 👷🔧💳🧾📦🧱; payments step UP in green with 💵; dashed **$0** line; above it = money made; bold signed end-of-line labels). A **blue** line steps to (latest report completion % × job total) per field report (🚩 = report). Renders in Job Summary expanded rows and at the bottom of **Parts cost** in the Job Detail / Edit Job modals ([`JobChargesTimelineStandalone.tsx`](../src/components/jobs/JobChargesTimelineStandalone.tsx)); scrolls horizontally on busy jobs. Kernel: [`jobChargesTimeline.ts`](../src/lib/jobChargesTimeline.ts). See `RECENT_FEATURES.md` v2.646–v2.655.

### Job Summary % column
Last column on Jobs → Job Summary: **100%** when every invoice is paid with a positive total (fully collected = done) → else the **latest field-report completion %** (RPC `list_latest_report_completion_pct`, server-side parse) → else Edit Job `pct_complete` → "—". Kernel: [`jobSummaryPercentComplete.ts`](../src/lib/jobSummaryPercentComplete.ts). The Quickfill **Complete, no Total Bill** section uses the same resolution.

### Crew P&L (Jobs tab; formerly "Teams")
Dev-only per-person profit rollup (tab key `teams-summary`): **billing credit weighted by clocked crew hours** (job total × person's share of the job's hours; ≈ = equal-split estimate for revenue jobs with no clocked hours), roster-keyed identity, Hours / Labor Cost / Billing / Profit / $-per-hr with date-range presets and per-job drill-down. Kernel: [`crewPnlSummary.ts`](../src/lib/crewPnlSummary.ts). Not related to People → Teams (leader/member structures). See `RECENT_FEATURES.md` v2.656.

### Merge users (Active Accounts)
Dev-only: absorb one user account into another. Rules — same role; the merged-away account must be **archived or never signed in**; when one is live it must survive. **Preview merge** runs `merge_user_accounts` with `p_dry_run` (full merge, rolled back, per-table counts); commit reassigns every FK reference (dynamic sweep + zero-leftover assert) and bans the absorbed login (Edge `merge-users`). Absorbed account keeps its email as an archived tombstone. Cannot be undone. See `RECENT_FEATURES.md` v2.652.

### Accounts Receivable Sorting (Jobs Stages → Bank payments)
Org-wide Mercury transaction filter for applying customer bank deposits to billed work (**Jobs** → **Stages** → **Bank payments**). The active filter shape is **`BankingSortingConfigV1`**: kinds, accounts, debit cards, Chicago **start date**, and optional counterparty/note substring exclusions. Canonical storage is **`app_settings`** key **`bank_payments_sorting_config_v1`** (**`value_text`** JSON); only **dev** can upsert (RLS). All authenticated roles that can open Bank Payments read the same row; **`list_mercury_transactions_for_bank_payments`** and **`count_mercury_transactions_for_bank_payments`** use the same **`p_filter`**. If no server row exists yet, the client may fall back to legacy per-user **`localStorage`** or Banking/Quickfill **`banking_sorting_config_v1_<userId>`** until a dev publishes settings. A global browser cache key **`bank_payments_sorting_config_v1__cache`** mirrors the server after fetch/save. Distinct from per-user **Banking** page sorting (**`banking_sorting_config_v1_<userId>`**).

**Returned deposit (AR Bank Payments)**: Org flag on a Mercury **`mercury_transactions`** row for deposits that still appear in the feed after a return or bounce (e.g. cheque). Stored in **`mercury_transaction_ar_returned`** (not on the sync table). By default **`list_mercury_transactions_for_bank_payments`** / **`count_mercury_transactions_for_bank_payments`** hide rows marked returned, same as fully applied deposits, unless **`p_filter.includeHiddenArDeposits`** is true (legacy **`includeFullyApplied`** still maps to that behavior). Toggle via **`set_mercury_transaction_ar_returned`** and **Mark** mode in **[`BankPaymentsModal`](../src/components/jobs/BankPaymentsModal.tsx)**.

### Payment unlink (Edit Job → Payments received)
**`remove_jobs_ledger_payment_and_reconcile(p_payment_id)`** — `SECURITY DEFINER` RPC that deletes one **`jobs_ledger_payments`** row in one transaction while recomputing **`jobs_ledger.payments_made`**, syncing **`jobs_ledger_invoices`** **`paid`/`billed`** from remaining **`invoice_id`** totals (non-Stripe invoices), and calling **`update_job_status`** to **`billed`** when the job was **`paid`** but **`revenue`** exceeds **`payments_made`**. **Rejects** payments tied to Stripe-hosted invoices (**`jobs_ledger_invoices.stripe_invoice_id`** non-empty). Authorized roles: **dev**, **master_technician**, **assistant**, **primary**, with the same job-access checks as other billing RPCs. **Edit Job** uses this for Mercury **Unlink and remove** and for removing persisted **non-Mercury** rows linked to **non-Stripe** invoices; unlinking a Mercury row frees that deposit’s applied amount so **Stages** → **Bank payments** can allocate it again.

**See**: **Accounts Receivable Sorting** — `RECENT_FEATURES.md` → v2.335, v2.334; `PROJECT_DOCUMENTATION.md` → §15 Banking; [`bankingSortingConfig.ts`](../src/lib/bankingSortingConfig.ts), [`appSettingsKeys.ts`](../src/lib/appSettingsKeys.ts). **Payment unlink** — `RECENT_FEATURES.md` → v2.436; `MIGRATIONS.md` → **`20260501030427_remove_jobs_ledger_payment_and_reconcile.sql`**; `PROJECT_DOCUMENTATION.md` → Jobs §6 **Payments received**; [`JobFormModal.tsx`](../src/components/jobs/JobFormModal.tsx).

### Accounting Label (Banking Mercury Drag Sort)
Org-wide shared classification for Mercury rows on **Banking** → **Mercury** → **Drag Sort** (`?tab=drag_sort`). Storage: **`mercury_drag_sort_labels`**, **`mercury_transaction_drag_sort_assignments`** (one label per transaction for the whole org). The ledger **Accounting Label** column shows the assigned label **name** only; optional **Schedule C** line and **description** appear in the cell **tooltip**. The right sidebar is titled **Accounting Labels** (per-label cards, **Unlabeled**, add-label form). **Collapse** / **Expand** beside that heading collapses **all** label cards to the title row only; **Unlabeled** and the add form stay expanded (`RECENT_FEATURES.md` → v2.474). Built-ins include **Equipment Lease** and **Property Lease** (v2.473; `MIGRATIONS.md` → **`20260502202929_rename_drag_sort_rent_lease_builtin_names.sql`**). UI: **[`BankingMercuryDragSortTab.tsx`](../src/components/banking/BankingMercuryDragSortTab.tsx)**; overview: **`PROJECT_DOCUMENTATION.md`** §15 **Mercury → Drag Sort**. The same assignment table is updated when staff **Approve** a rule suggestion on the **Accounting** tab (**v2.485**).

### Internal Transfers (Banking Mercury Drag Sort built-in)
Built-in **Accounting Label** in **`mercury_drag_sort_labels`** with `default_key = 'internal_transfers'`, `is_system_default = true`, `schedule_c_line = 'N/A'` for transactions that move money between the org's own Mercury accounts (Mercury Checking → Mercury Savings, internal sweep, etc.). **Not an expense** — excluded from Schedule C totals and from the Materials cost rollup in **People → Overhead** via the new `'internal_transfer'` bucket key in [`overheadPartsAccountingBuckets.ts`](../src/lib/overheadPartsAccountingBuckets.ts) (**`isMaterialsBucketKey`** + **`sumMaterialsTotalUsdExcludingInternalTransfer`**). **Mutually exclusive with `mercury_transaction_splits`** — both directions hard-blocked at the UI: applying the label to a transaction with existing job splits (**`BankingMercuryDragSortTab.applyDragSortAssignment`**, Drag Sort + Quick Sort + **Banking Accounting** quick-assign / approve / Approve all) toasts an error and aborts; opening **`MercuryTransactionAllocationsModal`** on an Internal-Transfers-labeled tx renders a slate banner, disables the job search input + per-line `$/%` toggles + value/note inputs + Fill remainder / Remove buttons, and gates Save (`canSave` returns false; `handleSave` short-circuits). The probe runs once per modal open against `mercury_transaction_drag_sort_assignments` + `mercury_drag_sort_labels.default_key`. The label appears at the bottom of the **Accounting Labels** sidebar with a slate accent (`#94a3b8` border, `#f1f5f9` background) — distinct from the Schedule C buckets — via the new optional **`defaultKey`** prop on **[`DragSortLabelBucketCard`](../src/components/banking/dragSortLabelBucketCard.tsx)**. New helpers: **`INTERNAL_TRANSFERS_DEFAULT_KEY`** + **`isInternalTransfersLabel(label)`** in [`dragSortDefaultLabels.ts`](../src/lib/dragSortDefaultLabels.ts). Replaces the old workaround of using **Exclude counterparty** on the Banking Accounting tab. Catalog seeded from both [`DRAG_SORT_DEFAULT_LABELS`](../src/lib/dragSortDefaultLabels.ts) (client-side `ensureDragSortDefaultLabels()` on Drag Sort load) and migration **`20260525160339_add_drag_sort_internal_transfers_builtin.sql`** (`INSERT … ON CONFLICT DO NOTHING`); whichever lands first wins, the other is a no-op. The `mercury_drag_sort_labels_guard_system_fields` trigger (from **`20260502224616`**) immutably pins `name` / `schedule_c_line` / `description`. `RECENT_FEATURES.md` → **v2.572**.

### Accounting rule overlap (audit)
The accounting-rule engine in **`BankingMercuryAccountingTab.applyRulesWithSnapshot`** is **first-match-wins**: rules are sorted by `sort_order, id` (ascending) and the inner loop `break`s on the first matching rule. Every other rule that would have matched the same `mercury_transactions` row is silently shadowed. The **overlap audit** surfaces those silent shadows without changing engine semantics. **Audit overlaps** button on the Rules section toolbar opens **[`BankingMercuryAccountingOverlapsModal`](../src/components/banking/BankingMercuryAccountingOverlapsModal.tsx)** with two tabs: **By rule pair** — table sorted desc by tx count, columns *Winner rule* / *Shadowed rule* / *Transactions*, both rule names clickable → routes through **`openEditRuleByIdFromOverlaps`** which **hides the audit modal** before opening Edit Rule and **auto-restores audit** when Edit Rule closes (avoids the stacking deadlock with the Test results modal that Edit Rule itself spawns at z-index 1250). **By transaction** — one row per overlapping tx (posted-date desc, id tiebreak) with the standard `formatUsd · counterparty · formatBankingDate` summary plus a `Matched by: <Winner> (winner), <Shadowed1>, <Shadowed2>...` line; an amber `Currently labeled X · winning rule labels Y` line surfaces when an existing **`mercury_transaction_drag_sort_assignments`** disagrees with the winning rule. Audit scope = currently filtered Banking transactions, **including already-labeled ones** (Apply silently skips assigned/pending; the audit deliberately does not, because rule-vs-assignment disagreements are the highest-signal flavour of overlap). The existing per-rule **Test results** modal also enriches each matched row with `Also matched by: <rule names>` when other enabled rules also match the same tx — list excludes the rule currently being edited (`editingRuleId`). Pure helper **`buildAccountingRuleOverlapReport(rules, txs, opts)`** in **[`accountingRuleOverlap.ts`](../src/lib/accountingRuleOverlap.ts)** mirrors the engine's sort/tiebreak verbatim, walks every match per tx (no `break`), aggregates `perRule` (matched / winner / shadowed) + `pairCounts` (winner → shadowed pair counts, sorted desc with deterministic id tiebreak); supports `assignmentLabelByTxId` for the conflict path and `includeDisabled` opt-in. Returns a tx in `txRows` only when it has 2+ matches or an assignment-vs-winner conflict. 13 unit tests in [`accountingRuleOverlap.test.ts`](../src/lib/accountingRuleOverlap.test.ts). The audit is purely client-side; no DB / migration / RPC / RLS / Edge changes. See **`RECENT_FEATURES.md`** → **v2.573**.

### Accounting rules (Banking Mercury Accounting tab)
On **Banking** → **Mercury** → **Accounting** (`?tab=accounting`). **Rules** live in **`mercury_accounting_label_rules`** (criteria **`jsonb`**); pending suggestions in **`mercury_accounting_label_suggestions`**. **Approve** applies **`mercury_transaction_drag_sort_assignments`** (same as Drag Sort). **Approve all** (**v2.487**) runs the same steps for every pending row in sequence (each row’s chosen **Accounting Label**); the button label includes the live count (**`Approve all (N)`**, **v2.576**). **Apply rules to transactions** workflow (**v2.576**): every click runs a read-only **preflight** (**[`buildAccountingRulesToInsert`](../src/lib/applyAccountingRulesPreflight.ts)** — engine-faithful first-match-wins over enabled rules with non-empty criteria, sorted by `sort_order ASC, id ASC`, skipping already-assigned and already-pending txs). Above **`APPLY_RULES_CONFIRM_THRESHOLD = 200`** matches the **[`BankingMercuryAccountingApplyRulesConfirmModal`](../src/components/banking/BankingMercuryAccountingApplyRulesConfirmModal.tsx)** asks before inserting; below threshold the existing silent-insert path is unchanged. Every click is hard-capped at **`APPLY_RULES_PER_CLICK_CAP = 500`** pending suggestions — the success toast names the dropped count (`N more match — apply again after reviewing.`) so the user iterates instead of rendering a 5,000-card wedge. **Apply rules by default** toggle (**v2.580**) — new per-user toolbar checkbox below **Hide labeled transactions** (default off, presence of `'1'` = on, prefix **`banking_accounting_apply_rules_default_v1_`** in **[`bankingDragSortStorage.ts`](../src/lib/bankingDragSortStorage.ts)**). When on, every successful transaction load on the Accounting tab — initial mount, **Refresh from Mercury**, **Backfill from Mercury…**, the Sorting/Ledger **Reload table** buttons, and the silent reload after the v2.579 **`onAfterAssignmentChange`** callback — auto-runs the same `computeApplyRulesPreflight` → `executeApplyRules` pipeline that the manual **Apply rules to transactions** button uses. Deliberately bypasses **`applyRulesWithSnapshot`** (so it skips the 200 confirm modal entirely) but still routes through `executeApplyRules`, so the **`APPLY_RULES_PER_CLICK_CAP = 500`** per-pass cap and the `Created N. M more match — apply again after reviewing.` toast both apply unchanged. State lifted to **[`Banking.tsx`](../src/pages/Banking.tsx)** with monotonic **`autoApplyResetTick`** counter (bumped after **`handleSync`** / **`handleBackfill`**) so a fresh sync re-fires auto-apply even on identical id sets. Pure helper module **[`accountingApplyRulesAutoTrigger.ts`](../src/lib/accountingApplyRulesAutoTrigger.ts)** — **`buildAutoApplySignature(txs, rules)`** returns `${sortedTxIds}|${sortedEnabledRuleIds}` (sort-independent; disabled rules excluded), **`shouldAutoApplyAccountingRules(state)`** walks the gate set (`enabled`, not loading / rules-loading / assignments-loading / apply-busy, `rulesCount > 0`, signature changed); 13 unit tests in **[`accountingApplyRulesAutoTrigger.test.ts`](../src/lib/accountingApplyRulesAutoTrigger.test.ts)**. Auto-apply effect uses **`lastAutoAppliedSignatureRef`** + reset effect keyed on `autoApplyResetTick`. Tab gating + concurrent-click safety are free (effect lives inside the tab; **`applyRulesBusy`** gates both manual + auto). The manual **Apply rules to transactions** button is unchanged — still goes through `applyRulesWithSnapshot` and pops the 200-confirm modal. **Approve by default** toggle (**v2.581**) — new per-user checkbox below the green **Approve all (N)** button in the Approvals section (default off, presence of `'1'` = on, prefix **`banking_accounting_approve_by_default_v1_`** in **[`bankingDragSortStorage.ts`](../src/lib/bankingDragSortStorage.ts)**). When on, the existing **`handleApproveAll`** flow is auto-fired every time a new pending suggestion appears (closes the loop after v2.580 — rules auto-create suggestions, v2.581 auto-commits them). Internal Transfers conflicts (suggestions whose label is Internal Transfers and whose tx already has rows in **`mercury_transaction_splits`**) are still skipped by **`handleApproveAll`** itself, so those persist in pending for manual cleanup. Toast-spam-free conflict residue via memoized **`autoApprovablePending`** filter (mirrors the conflict-skip predicate inside **`handleApproveAll`**) — only the filtered list feeds the signature, so a stable conflict-only residue produces an empty signature, the gate's `pendingCount === 0` branch quiets the effect, and the *All pending suggestions are conflicts* error toast never fires from auto-mode. State lifted to **[`Banking.tsx`](../src/pages/Banking.tsx)** with **`approveByDefault`** + **`onApproveByDefaultChange`**; two new props on **`BankingMercuryAccountingTabProps`**. Pure helper module **[`accountingApproveByDefaultAutoTrigger.ts`](../src/lib/accountingApproveByDefaultAutoTrigger.ts)** — **`buildApproveByDefaultSignature(pending)`** returns sorted suggestion-ids joined with `,`; **`shouldAutoApproveAccountingSuggestions(state)`** walks the gate set (`enabled`, not pending-loading, not approve-all-busy, `pendingCount > 0`, signature changed); 11 unit tests in **[`accountingApproveByDefaultAutoTrigger.test.ts`](../src/lib/accountingApproveByDefaultAutoTrigger.test.ts)**. Auto-approve effect uses **`lastAutoApprovedSignatureRef`**; signature naturally shrinks as `bulk_approve_accounting_label_suggestions` flips suggestions to `'approved'` server-side and `loadPending` filters them out, so the effect quiets without explicit reset machinery. Tab gating + concurrent-click safety are free (effect lives inside the tab; **`approveAllBusy`** gates both manual + auto). The manual **Approve all (N)** button is unchanged — same handler, same chunking, same Internal Transfers skip + toast. Approval cards (one per pending suggestion) are paginated at **`APPROVALS_PAGE_SIZE = 50`** with **`Show 50 more`** + **`Show all (N)`** controls; the visible window resets to 50 on a fresh load (`0 → N` transition) and persists across in-place edits. The card body lives in **[`AccountingApprovalCard.tsx`](../src/components/banking/AccountingApprovalCard.tsx)** (`React.memo` + stable `useCallback` props mediated by **`pendingApprovalsRef: useRef<PendingApproval[]>`**) so changing one card's dropdown re-renders only that card, not all 500 / 5,000. Matching: **[`accountingLabelRuleMatch.ts`](../src/lib/accountingLabelRuleMatch.ts)** — substantive criteria are **AND**; **amount** is an inclusive interval on **`mercury_transactions.amount`**; when both bounds are set, **Min**/**Max** are **normalized** so the smaller numeric value is the lower endpoint (**`resolveAccountingRuleAmountBounds`**, **v2.486**, which avoids empty matches when negative ranges are typed with fields reversed). **Counterparty** uses **`counterparty_name`** (contains/equals, case-insensitive). **Bank description** uses **`mercuryBankDescriptionFromRaw`** (**`raw.bankDescription`** only). **Test** and **Apply rules** iterate the **same Mercury rows** as the main Banking table (account / kind / toolbar search), not the Sorting Ledger’s local search/hide-labeled slice. **Overlap audit** (**v2.573**) — **Audit overlaps** button on the Rules toolbar opens a modal that scans every filtered tx for 2+ matching rules and assignment-vs-winner conflicts; Test preview shows `Also matched by: <rule names>` per row; engine first-match-wins behavior is unchanged. See **Accounting rule overlap (audit)** above. **Edit Rule modal Delete** (**v2.574**) — red trash icon in the **Edit rule** header (Edit mode only, gated on `editingRuleId !== null && onDelete !== undefined`) opens a nested confirm modal at z-index 1201 with the rule name + *Pending suggestions tied to this rule will be removed. This cannot be undone.* warning. Confirms call shared `deleteRuleCore` (extracted from `deleteRule`; the Rules-table Delete link still wraps it with `window.confirm`), then close the parent modal which fires the v2.573 audit handoff `useEffect` so any open audit modal underneath re-opens with refreshed data (deleted rule absent). On failure `deleteRuleCore` toasts and re-throws so the nested confirm stays open for retry. UI: **[`AccountingRuleFormModal.tsx`](../src/components/banking/AccountingRuleFormModal.tsx)** (`onDelete` prop, header trash icon via [`PayStubDeleteIcon`](../src/components/pay/PayStubDeleteIcon.tsx) at `#b91c1c`, `deleteConfirmOpen` / `deleting` state, `controlsDisabled` extension). **More filters** on the Sorting Ledger (**`RECENT_FEATURES.md`** **v2.489**–**v2.492**): optional **posted date**, **amount** min/max, **`kinds`** (**v2.490**), **Exclude counterparty** (**`excludeCounterpartyContains`** on **`counterparty_name`**, case-insensitive contains, max **50** phrases — **v2.492**), **job split**, **Person unassigned only** — persisted as **`v:1`** JSON in **`bankingDragSortStorage.ts`**; implemented in **[`bankingAccountingLedgerFilters.ts`](../src/lib/bankingAccountingLedgerFilters.ts)** and **[`BankingMercuryAccountingLedgerFilterModal.tsx`](../src/components/banking/BankingMercuryAccountingLedgerFilterModal.tsx)**. The Sorting Ledger’s **Hide labeled transactions** checkbox defaults **on** (**`v2.488`**): **`localStorage`** unset ⇒ hide labeled rows; **`'0'`** persists when the user turns hide **off** (**[`bankingDragSortStorage.ts`](../src/lib/bankingDragSortStorage.ts)** — **breaking** for anyone who left hide **off** with no key under the old convention). When this checkbox is on, **[`Banking.tsx`](../src/pages/Banking.tsx)** swaps the master 15k `mercury_transactions` fetch for SECURITY INVOKER RPC **`list_unlabeled_mercury_transactions(p_limit int default null)`** (**v2.579**, migration **`20260525204531_list_unlabeled_mercury_transactions.sql`**) — anti-join against `mercury_transaction_drag_sort_assignments` returns only the unlabeled rows, ordered the same as the master list. The tab-aware dispatcher **`loadRowsForActiveView`** picks this loader **only** for (Accounting tab + Hide labeled = on); every other tab (Drag Sort, User Review, Category Review, Sorting, Ledger) keeps the full 15k fetch. The Accounting tab also drops its local `hideLabeledTransactions` state in favor of parent props and short-circuits the per-page `mercury_transaction_drag_sort_assignments` mapping sweep + the redundant client-side filter (`inputIsUnlabeledOnly`); the four assignment-table mutation flows (`clearRowDragSortLabel`, `handleQuickAssignLabel`, `handleApprove`, `handleApproveAll`) call back into the parent's silent re-fetch via the new `onAfterAssignmentChange?` prop so the unlabeled list shrinks (or grows) in place. **`MIGRATIONS.md`** → **`20260504011219_mercury_accounting_label_rules_and_suggestions.sql`**; label-frequency RPC **`list_mercury_drag_sort_label_assignment_counts`** (**`20260505231245`**). **Rules** table: **`Search rules…`** (substring on **Name** / **Label**); **Name** / **Label** headers toggle **asc**/**desc** sort (**`aria-sort`**, **`sortAccountingRulesForTable`** in [**`accountingRulesTableSearch.ts`**](../src/lib/accountingRulesTableSearch.ts)). **Sorting Ledger**: section title **`Sorting Ledger (n)`** = visible rows after search/filters/**Hide labeled**; **Counterparty** **`… (k)`** = row count sharing the same trimmed **`counterparty_name`** in that list (**[`bankingMercuryCounterpartyFrequency.ts`](../src/lib/bankingMercuryCounterpartyFrequency.ts)**). **New/Edit rule** modal: **`SearchableSelect`** for **Accounting Label** (frequency ordering). **Rules modal** (**v2.578**) — the inline collapsible Rules section is replaced by a single **`Rules (N)`** trigger button between Approvals and Sorting Ledger that opens **[`BankingMercuryAccountingRulesModal.tsx`](../src/components/banking/BankingMercuryAccountingRulesModal.tsx)** at **`zIndex: 1100`** containing the full toolbar (**New rule** / **Audit overlaps** / **Apply rules to transactions**), **`Search rules…`** input, and the sortable rules table; child modals stack above (Edit Rule **1200**, audit handoff nested confirm **1201**, Audit Overlaps **1250**, Apply Rules confirm **1260**), v2.573 audit-handoff hide-and-restore continues to work with Rules modal visible behind throughout. UI: **[`BankingMercuryAccountingTab.tsx`](../src/components/banking/BankingMercuryAccountingTab.tsx)**.

### Mercury organization notes (Banking)
Per-transaction org-wide scratch text stored in **`mercury_transaction_org_notes`** (writes via **`upsert_mercury_org_transaction_note`** **`SECURITY DEFINER`**). UI: **[`MercuryTxNotesDisclosure.tsx`](../src/components/banking/MercuryTxNotesDisclosure.tsx)** — **Ledger**, **User Sort**, and **Drag Sort** show a read-only **preview** sub-row when Mercury **`note`**, **`external_memo`**, or org body is non-empty; org line is a **single indented ellipsis** row (**v2.477**). **v2.478** — **focus** + **auto-grow** org **`textarea`**, **Save** closes editor, **Close** when draft empty, actions **right** (**`MercuryTxNotesEditorPanel`**). **v2.479** — **transparent** **`td`** (**`mercuryTxNotesSubRowTdStyle`**) as one band with the transaction: **divider under** (**`border-bottom`** **`#e5e7eb`** only), summary row omits interior bottom rule when the notes band follows (**`notesContinuationBelow`** / **`suppressBottomDivider`**). **Drag Sort** can show Mercury **bank description** + notes as one **piped** read-only line (**`dragSortPipe`**, [`mercuryBankDescriptionFromRaw.ts`](../src/lib/mercuryBankDescriptionFromRaw.ts)). **v2.480** — split **`colSpan`** spacer + content so preview/editor **starts under Counterparty** ([**`bankingMercuryNotesSubRowColSpan.ts`**](../src/lib/bankingMercuryNotesSubRowColSpan.ts)); **Drag Sort**: spacer spans **Posted** + **Amount**; **`mercuryTxNotesSubRowInnerStyle`** symmetric horizontal padding (**no **`3rem`** gutter**). **Edit note** / **Hide edit** under **Amount** toggles the **editor** only. No separate **Notes** table column (`RECENT_FEATURES.md` → **v2.480**–**v2.475**; `MIGRATIONS.md` → **`20260502232908_mercury_transaction_org_notes.sql`**).

### Mercury sync (Banking)
Mercury transactions are pulled from the Mercury REST API (`/api/v1/transactions`) into **`mercury_transactions`** by Edge function **[`sync-mercury-transactions`](../supabase/functions/sync-mercury-transactions/index.ts)** — paginated 500/page × **`MAX_PAGES = 120`** = up to **60,000 tx** per invocation, upserted on **`mercury_id`** so re-running over an overlapping range is idempotent. Two trigger paths from **Banking** → **Mercury**: **(1) Refresh from Mercury** — top-of-page button + **Advanced** menu item, all eligible roles (dev / master_technician / assistant), hardcoded to **`{ lookback_days: 90 }`** in **`handleSync`** so daily refreshes stay fast (~10s). **(2) Backfill from Mercury…** (**v2.575**) — **dev only**, lives in the **Advanced** menu between **Refresh from Mercury** and **Reload table**; opens **[`MercuryBackfillModal.tsx`](../src/components/banking/MercuryBackfillModal.tsx)** with a custom **`{ start, end }`** picker (default **`[today − 365, today]`** in **`APP_CALENDAR_TZ`**, range capped at **3650** days client-side, future / reverse ranges blocked). Submit posts **`{ start, end }`** to the same Edge function (already supported, no Edge change), then runs **`Promise.all([loadRows(), loadNicknames(), loadDebitCardNicknames()])`** so the table reflects new rows immediately. Both paths share the same **`syncing`** flag so they mutex automatically. Display side: in [`Banking.tsx`](../src/pages/Banking.tsx) `loadRows`, the in-memory cap is **`MERCURY_TRANSACTIONS_BANKING_LIST_LIMIT = 15000`** (raised from 5,000 in v2.575) so a year of synced rows fits in one scrollable list; search and rules still filter via the DB, not the in-memory list. Edge function gated **`dev only`** at the `users.role` check; UI gates the menu item on **`isDevBanking`** so non-dev viewers don't see it. `RECENT_FEATURES.md` → **v2.575**; `EDGE_FUNCTIONS.md` → **`sync-mercury-transactions`**.

### User Review tab (Banking Mercury)
Banking → Mercury tab (`?tab=user_review`) for all banking staff (`canAccessBanking` — dev / master_technician / assistant-like) that pivots Mercury transactions by **attributed user** × accounting label so spend per person is visible at a glance; the **Unassigned** row sorts first. Cells drill into a ledger modal with a per-row **Assign to** person picker and a bulk assign/unassign control (writes via `mercurySetTransactionAttribution`, preserving job splits); counterparty clicks open the shared `TransactionDetailModal`.

**Implementation**: [`BankingMercuryUserReviewTab.tsx`](../src/components/banking/BankingMercuryUserReviewTab.tsx), pivots in [`bankingMercuryUserReviewPivot.ts`](../src/lib/bankingMercuryUserReviewPivot.ts). Not the same thing as the Dashboard **User Review modal** (clock-strip schedule review). See `RECENT_FEATURES.md` → v2.590.

### Category Review tab (Banking Mercury)
Banking → Mercury tab (`?tab=category_review`, same `canAccessBanking` gate) that pivots the filtered Mercury transactions by **accounting label** (the Drag Sort / Accounting label catalog) with per-label count + sum, so Schedule C-shaped spend review happens without leaving Banking. Drill-ins list the label's transactions; clicking a transaction date opens the shared `TransactionDetailModal` for inline reassignment.

**Implementation**: [`BankingMercuryCategoryReviewTab.tsx`](../src/components/banking/BankingMercuryCategoryReviewTab.tsx); shares the label catalog types with the User Review pivot. See `RECENT_FEATURES.md` → v2.590.

### Reconciliation tab (Banking Mercury)
Banking → Mercury tab (`?tab=reconciliation`, same `canAccessBanking` gate) that checks sync completeness of `mercury_transactions` against Mercury's own statements, per account per month (3/6/12-month windows): statement count vs present count, missing-transaction samples and value, and ending-balance continuity, rendered as ok/warn status pills. A **Payroll** chip cross-checks the scope against People → Payroll stub payments. Raw numbers come from the `mercury-reconcile` edge function; pass/fail thresholds live in the pure kernel.

**Implementation**: [`BankingMercuryReconciliationTab.tsx`](../src/components/banking/BankingMercuryReconciliationTab.tsx), kernel [`mercuryReconciliation.ts`](../src/lib/mercuryReconciliation.ts), fetch via [`fetchMercuryReconciliation.ts`](../src/lib/fetchMercuryReconciliation.ts).

## Controller (role)

Bookkeeper/financial-controller role added in **v2.662** (Phase 3 of the pay-visibility overhaul). **Acts like an assistant everywhere** — the DB's `is_assistant()` and the client's `isAssistantLike()` are assistant-LIKE (assistant **or** controller), so every assistant capability (clock cards, hours, crew, contracts, licenses, vehicles, housing, dispatch) extends automatically — **plus dev-level financial visibility**: `has_payroll_access()` (wages, pay stubs, People → Payroll tab), Dashboard financials unredacted, Job Summary team-labor/profit, Cost breakdown team labor, Projects day-modal team labor. **Not** dev admin: no user management, impersonation, backups, or dev-only deletes. Compare `role === 'assistant'` / `users.role` directly when strictly-assistant semantics matter.

**See**: `ACCESS_CONTROL.md` → Nine User Roles; `MIGRATIONS.md` → `20260714210000` / `20260714213000`; `RECENT_FEATURES.md` → v2.662

## Payroll access (`has_payroll_access()`)

The single DB capability that gates **individual pay data** — `people_pay_config` wages, the pay-stub family (`pay_stubs` + days/payments/deductions/additional lines), `person_offsets`, Hours-tab teams/due totals — since the 2026-07-14 pay-visibility overhaul (v2.660–v2.663). Holders: **devs**, **pay-approved masters** (`pay_approved_masters`), and **controllers**. **Assistants never hold it** — pay-master adoption confers nothing (v2.661 dissolved `is_assistant_of_pay_approved_master()`); their surfaces use the wage-free `list_people_pay_flags()` RPC and the aggregate `get_dashboard_payroll_totals()` instead. Client mirror: `usePeopleAccess().canAccessPay`. Never gate pay data on `is_assistant()` (it is assistant-LIKE and includes controller) and never reintroduce direct `is_pay_approved_master()` policy checks — v2.663 swept them all onto `has_payroll_access()`.

**See**: `MIGRATIONS.md` → `20260714120000`, `20260714200000`, `20260714230000`; `ACCESS_CONTROL.md` → assistant / controller sections

## Checklist

### Checklist Items / Checklist Instances
Recurring tasks with Today, History, **Review**, Manage, and **Roadmap** tabs (Review/Manage require manage-capable roles). **Assignees** are stored in junction tables `checklist_item_assignees` (item, user) and `checklist_instance_assignees` (instance, user)—items and instances can have multiple assignees. Add/Edit modal uses checkboxes for multi-assignee selection; at least one assignee required. Today/History filter by `checklist_instance_assignees.user_id`. **Review** tab: **Outstanding by person** (filters and table) first, then **Task Dispatch** and **Estimator Inbox** cards via `ChecklistReviewInboxes` (inbox cards hidden for assistants). **Link placeholders**: `[1]`, `[2]`, etc. in item titles map to URLs in `checklist_items.links` array; Add/Edit modal provides URL inputs; displayed as clickable links via `ChecklistTitleWithLinks`. **Header Task** (global add modal): **subcontractor**, **helpers**, and **estimator** use **`can_define_task_style_checklist_items()`** RLS for definitions they created (**`created_by_user_id`**); **`checklist_item_created_by_auth_user`** / **`checklist_instance_parent_item_created_by_auth_user`** (**SECURITY DEFINER**, **`row_security` off**) avoid **`checklist_items`** ↔ junction policy recursion (**RECENT_FEATURES** v2.450).

**Database**: `checklist_items`, `checklist_instances`, `checklist_item_assignees`, `checklist_instance_assignees`

### Roadmap (tech tree)
Named **roadmaps** on the Checklist page (`?tab=roadmap`, optional **`roadmap=<uuid>`**): each roadmap has its own groups of tasks, prerequisite edges, and per-task assignees. **`ChecklistTechTreeRoadmapBar`** — pick roadmap, **New roadmap** (dev/master/assistant/primary), **Members**. **`ChecklistTechTreeRoadmapMembersModal`** — add org users as **viewer** (read + complete assigned tasks) or **editor** (change graph + manage members). **Staff/primary** can access any roadmap without a member row (RLS); others need membership. Implemented in **`ChecklistTechTreeTab`** with a floating **canvas** icon row when the graph has groups—**enter full screen** (bare icon, no chip), **Organize**, **Add group**, **Edit tasks**, **Show all** / **Collapse all**—via **`ChecklistTechTreeMapActionIconButtons`**; an empty graph uses text actions in the roadmap toolbar. Full-screen mode repeats those icons in the overlay header; **exit** is an icon-only control (class **`checklistTechTreeExitFs`** in **`index.css`**).

**Database**: **`checklist_tech_tree_roadmaps`**, **`checklist_tech_tree_roadmap_members`**, **`checklist_tech_tree_groups`** (includes **`roadmap_id`**), **`checklist_tech_tree_group_tasks`**, **`checklist_tech_tree_edges`**, **`checklist_tech_tree_task_assignees`**

**See**: `RECENT_FEATURES.md` → v2.408, v2.407; `MIGRATIONS.md` → **`20270427120000_checklist_tech_tree_multi_roadmap.sql`**; `PROJECT_DOCUMENTATION.md` → Key differentiators, Checklist

**Repeat types**: once, day_of_week (multiple days), days_after_completion

### Muted task
Per-task preference to stop receiving completed-task push notifications for a specific checklist item. Stored in `user_checklist_item_mute_preferences`. Users who are notification recipients (notify_on_complete_user_id or creator when notify_creator_on_complete) can mute via inline bell-off icon on Checklist Today, Manage, Dashboard; Settings shows Muted Tasks list.

### Ignored section (dev)
Collapsible section in Dashboard Recently Completed Tasks where devs move task types they want out of the main view. Stored in `dev_ignored_checklist_items`. Main section shows only non-ignored types; UNREAD count excludes ignored; Ignore/Un-ignore buttons move task types between sections.

### My Inbox (Dashboard)
Bordered Dashboard card (v2.681, reusable [`DashboardGroupCard`](../src/components/dashboard/DashboardGroupCard.tsx)) that groups the personal checklist sections into one unit: **Due Today** (was "Checklist: Due Today"), **Overdue** (was "Checklist: Outstanding"), and — for devs — **Recently Completed Tasks**. As of v2.683 the dev-only Recently Completed block hides entirely when nothing completed in the last 7 days and otherwise appears as a `▶ Recently Completed (N unread)` corner link in the card's top-right that expands the grouped-by-completer list in place. The section-dock's **My Inbox** chip anchors to the card whenever it renders.

**See**: `RECENT_FEATURES.md` → v2.681, v2.683; help guide `src/content/help/dashboard-my-inbox.md`

---

## Task Dispatch

Short messages to internal **Dispatch** (a dev-configured set of **assistants**), separate from recurring checklist tasks. **Authenticated users** can insert **`dispatch_requests`** with **`from_user_id = auth.uid()`** (RLS). The **header** toolbar button is shown when [**`headerTaskDispatchEstimatorEligible.ts`**](../src/lib/headerTaskDispatchEstimatorEligible.ts) passes — **dev**, **master_technician**, **assistant**, **estimator**, **subcontractor**, and **helpers** (**RECENT_FEATURES** v2.450). The modal titled **Message the Dispatch team** has: **Task** (required), **Reference (optional)** (job/bid search), and **Links (optional)** (URLs for `[1]`, `[2]` placeholders in the task text). Rows live in `dispatch_requests`. **Dispatch group** membership is `dispatch_group_members` (assistant users only; trigger-enforced). Devs edit the group in Settings. Dispatch members and devs see the **Dispatch inbox** on the Dashboard for open requests and can **mark closed**. When marking closed, user enters a **closed_note** (required in app). Closed requests can be **dismissed** per-user (hidden from that user's inbox); `dispatch_request_dismissals` table. **Inbox UI** (Dashboard, Quickfill, Checklist Review; parallel **Estimator inbox**): at **≤640px** [`useNarrowViewport640`](../src/hooks/useNarrowViewport640.ts) stacks the title above message stats; **closed** rows put **Dismiss** beside the stats block; **Expand for thread** (only when the card has thread messages, `note_count` > 0) appears under **Dismiss** (**`RECENT_FEATURES`** **v2.452**). Push notifications use Edge Function **`notify-dispatch-request`** so the member list is not exposed to clients. The Edge gateway should use **`verify_jwt = false`** for that function in **`supabase/config.toml`** (JWT validated inside the function, same pattern as **`notify-estimator-request`**); otherwise the client can see **401** before the function runs.

### Link Customer Pictures dispatch action

A structured **`dispatch_requests`** flavor created by the Dashboard **My Schedule** customer-photos icon when the assigned job's [**`jobs_ledger.job_pictures_link`**](#) is empty. Rows carry **`pending_action = 'link_job_pictures'`** + the originating **`job_ledger_id`**; inserts are **deduplicated** per **`(job_ledger_id, pending_action, status = 'open')`** (a second tap shows *Already sent to Dispatch.*). The dispatch inbox row renders an inline blue-outlined **Add Customer Pictures URL** button next to the existing **Dismiss** / **Expand for thread** controls; clicking it calls **`useJobFormModal().openEditJob(jobId, { jobPicturesLinkHighlight: true })`** which opens **Edit Job** with the **Customer Pictures** input scrolled into view, focused, and flashed (same 2.5s blue highlight mechanism as the existing **`fixturesSectionHighlight`** / **`billingCustomerHighlight`** patterns). Saving a non-empty URL on that job auto-closes any open **`link_job_pictures`** rows for the same **`job_ledger_id`** with **`closed_note = 'Customer Pictures URL added'`** (non-fatal failure handling — the URL save itself is the success path). Migration **`20260519171140_dispatch_requests_pending_action`** added the nullable **`pending_action text`** column + a partial **`(job_ledger_id, pending_action)`** index gated on **`pending_action IS NOT NULL AND status = 'open'`** so the dedupe lookup stays cheap. **See**: `RECENT_FEATURES.md` → v2.556; [`src/pages/Dashboard.tsx`](../src/pages/Dashboard.tsx) (`submitLinkJobPicturesDispatchRequest`); [`src/components/jobs/JobFormModal.tsx`](../src/components/jobs/JobFormModal.tsx) (`jobPicturesLinkHighlight` state + scroll/focus/flash + auto-close); [`src/contexts/JobFormModalContext.tsx`](../src/contexts/JobFormModalContext.tsx) (`OpenEditJobOptions.jobPicturesLinkHighlight`); [`src/components/DispatchInboxSection.tsx`](../src/components/DispatchInboxSection.tsx) (`onLinkJobPictures` prop + button render); [`src/hooks/useDispatchInbox.ts`](../src/hooks/useDispatchInbox.ts) (`DISPATCH_REQUEST_SELECT` carries `pending_action` + `job_ledger_id`).

---

## Email schedule (Dashboard)

**One-off** email of **Schedule Dispatch**–style **`job_schedule_blocks`** for a single calendar **`work_date`**, queued from the **Clocked in today** strip ([**`ScheduleDayEmailModal.tsx`**](../src/components/ScheduleDayEmailModal.tsx) → **`schedule_day_email_requests`**). Not recurring: at most one **pending** row per **`recipient_user_id` + `work_date`**. **Schedule** sets a future **`send_at`**; **Queue soon** sets **`send_at`** immediately so pg_cron **`schedule-day-email-dispatch`** (~every 15 minutes) can pick it up.

**Distinct from** [**Jobs → Reports → Recurring Email Reports**](#recurring-job-report-emails-jobs): those are **scheduled digests** of field / clock activity (**`recurring_job_report_schedules`**), with **Daily summary** / **Weekly summary** wording in the email body—not the same table or Edge function.

**Roles**: **dev**, **master_technician**, and **assistant** when the strip shows the control; **dev** may set **`recipient_user_id`** to another non-archived **`users`** row (RLS **`schedule_day_email_requests_insert_dev_any_recipient`**).

**See**: `RECENT_FEATURES.md` → v2.522, v2.523; `PROJECT_DOCUMENTATION.md` → Dashboard §8; `EDGE_FUNCTIONS.md` → **schedule-day-email-dispatch**; `ACCESS_CONTROL.md` → dev capabilities + Dashboard matrix.

## Recurring job report emails (Jobs)

Scheduled **field-activity** emails configured under **Jobs → Reports → Recurring Email Reports** (`recurring_job_report_schedules`, `recurring_job_report_schedule_recipients`). Uses **`recurring-job-report-dispatch`**, not **`schedule-day-email-dispatch`**.

---

## Bids System

### Bid / Bid Board
The main bid management system. Bid Board is the first tab showing all bids in a list.

**Database**: `bids` table

**Tabs**: Bid Board, **Unsent/Working** Kanban (`?tab=working`), Bid Costs, **Estimators** (`?tab=estimators` — see below), Counts, Takeoff, Cost Estimate, Pricing, Cover Letter, Submission & Followup, RFI, Change Order, Lien Release. Builder Review is a separate top-row tab.

### Bid Number
Short identifier for a bid (e.g. "456"), analogous to HCP for jobs. Stored in `bids.bid_number`. Auto-generated for new bids via `bids_bid_number_seq`; backfilled for existing bids (oldest first). **Display label** is **`{bid_prefix}{bid_number}`** where **`bid_prefix`** comes from **`service_types.ledger_bid_prefix`** for that bid’s trade (trimmed); **null/blank** falls back to **`B`** (same as legacy **`B456`**). Used in Clock In / Update Focus search labels, People Hours clock session displays, **Bid Board** (**`BidBoardBidNumberMark`** in **`Bids.tsx`**: full prefix at **`0.7em`**, **`bid_number`** at inherited size — **v2.498**), workflow tab headings, Documents, Mercury alloc search, etc. **Unified search** accepts typed **`B` + remainder** or **`ledger_bid_prefix` + remainder** (case-insensitive) to find `bid_number`. **Edit restriction**: Only dev, master_technician, and assistant can edit; estimator and primary see it read-only (enforced by UI and database trigger).

### Ledger display prefix (job / bid)
Optional **per–service-type** characters shown **before** the numeric **HCP** (**`jobs_ledger.hcp_number`**) or **bid** (**`bids.bid_number`**) in the UI and in some notifications. Stored on **`service_types`** as **`ledger_job_prefix`** and **`ledger_bid_prefix`**. **Dev-only** editing in **Settings** (Service types). **Implementation**: [`ledgerDisplayPrefixes.ts`](../src/lib/ledgerDisplayPrefixes.ts); Edge helpers in **`supabase/functions/_shared/ledgerDisplayPrefixes.ts`**. **Stripe** invoice **number** generation remains **digits-only HCP** (no prefix) unless changed separately.

### Estimators tab (Bids → Estimators)
A cross-bid analytics tab on the Bids page (**`?tab=estimators`**, viewable by **every role that can open `/bids`** — subcontractor and helpers cannot reach the Bids page at all, since `/bids` is not in `SUBCONTRACTOR_PATHS` in [`layoutRouteAccess.ts`](../src/lib/layoutRouteAccess.ts)) — **v2.531**. Shows a **days × estimators** pivot of **`clock_sessions`** linked to **bids** over the last **30 days** (**`APP_CALENDAR_TZ`**). Each cell stacks one chip per bid the column user clocked into that day, formatted **`{N}% — {label} ({project clip})`**, where **`{N}% = userHoursThatDay / bidAllTimeHours × 100`** (lifetime team denominator, so **100%** means that user has been the only one to clock any time to the bid ever). **`{label}`** is the trade-aware ledger label (e.g. **`BE249`** when **`service_types.ledger_bid_prefix` = `BE`**, **`B412`** when blank — see **Bid Number**); **`{project clip}`** is the first **10** characters of **`bids.project_name`** + `...` (omitted when ≤10 chars). Click the bid label → **Bid preview** modal via **`useBidPreview`**.

**Columns** = `role = 'estimator'` users **plus** the org-wide augmentation list **`bid_estimators_extra_users`**. **Manage columns** (dev / master_technician / assistant only) edits the augmentation list via **[`BidsEstimatorsExtraUsersModal.tsx`](../src/components/bids/BidsEstimatorsExtraUsersModal.tsx)**. **Cost mode** (dev only) appends **`{bidValue × pct}k | {bidValue}k`** per chip via **`formatBidValueK`**, or **`no bid value`** in red when **`bids.bid_value`** is missing. **Search bar** (**v2.534**) above the table matches the bid's ledger label (prefix or digits), **`project_name`**, and **GC/Builder name** (**`customers.name`** with legacy **`bids_gc_builders.name`** fallback) — case-insensitive substring; matching chips get an amber pill and rows with no match are hidden, but estimator columns stay stable.

**RLS-safe aggregation** via two **`SECURITY DEFINER`** RPCs in **`20260515102040_bid_estimators_tab.sql`**: **`list_bid_estimators_window_hours`** (per-cell per-day decimal hours) and **`list_bid_estimators_all_time_hours`** (lifetime per-bid denominator). Both filter out rejected / revoked sessions and clip open sessions at **`now()`**. **Implementation**: **[`src/components/bids/BidsEstimatorsTab.tsx`](../src/components/bids/BidsEstimatorsTab.tsx)**, pure helpers in **[`src/lib/bidEstimatorsTab.ts`](../src/lib/bidEstimatorsTab.ts)** (42 unit tests in **`.test.ts`**). See **`BIDS_SYSTEM.md`** → Estimators Tab.

### GC / Builder / General Contractor
Customer in the bids context. The entity requesting the bid (can be actual GC, homeowner, developer, etc.).

**Database**: Uses `customers` table (linked via `customer_id`)

**Alias**: "GC/Builder", "GC", "Builder", "Customer" all refer to same concept in Bids

### Fixture / Fixture Type
Installed plumbing fixture in a project (toilet, sink, faucet, shower, tub, water heater, etc.). Service-type-specific categorization used in Bids system for labor and pricing calculations.

**Database**: `fixture_types` table with FK to `service_types`

**Used In**: Labor book entries, Price book entries (structured with FK)

**Count Rows**: Use free text `fixture` field (not FK) for flexibility

**Example Values**: "Toilet", "Kitchen Sink", "Shower Valve", "Tub/Shower Combo"

**Management**: Settings page, Fixture Types section (dev access)

### Tie-in
Connection point where new plumbing connects to existing systems (water supply, waste lines, vent stacks).

**Used In**: Counts tab (alongside fixtures)

**Example Values**: "Water Supply Tie-in", "Waste Line Connection", "Gas Line Tie-in"

### Count / Count Row
Quantity entry for a fixture or tie-in in a bid. Stored in Counts tab. Uses free text for flexibility.

**Database**: `bids_count_rows` table

**Fields**: fixture (free text name), count (quantity), page (optional plan page reference)

**Note**: Unlike labor/price books, count rows use free text `fixture` field (not FK) to allow flexible field notes

### Rough In
Initial plumbing installation phase. In-wall piping, water supply lines, drain/waste/vent lines installed before walls closed.

**Stage Context**: One of three main plumbing stages (Rough In → Top Out → Trim Set)

### Top Out
Mid-stage plumbing work. Testing, inspection, adjustments after rough-in before final fixtures.

**Stage Context**: Second of three main plumbing stages

### Trim Set / Trim Out
Final fixture installation phase. Installing visible fixtures, trim kits, faucets, toilets, sinks, etc.

**Stage Context**: Third of three main plumbing stages

**Alias**: "Trim Set" and "Trim Out" used interchangeably

### Takeoff
Process of calculating material quantities from fixture counts. Maps counts to material templates to generate purchase orders.

**Tab**: Third tab in Bids system

**Output**: Purchase orders with calculated quantities

**Print Breakdown**: Printable report (per stage, per fixture) showing parts and assemblies for master plumber audit

### Takeoff Book
Template library mapping fixture names to material templates and stages. Standardizes material takeoffs.

**Database**: `takeoff_book_versions`, `takeoff_book_entries`, `takeoff_book_entry_items`

**Structure**: Version → Entries → Items (Template + Stage pairs)

**Features**: Alias names for matching, multiple templates per fixture

### Labor Book
Template library mapping fixture types to labor hours per stage. Standardizes labor estimates.

**Database**: `labor_book_versions`, `labor_book_entries`

**Structure**: Version → Entries (fixture_type_id FK + hours per stage)

**Fields**: fixture_type_id (FK to fixture_types), rough_in_hrs, top_out_hrs, trim_set_hrs, alias_names

### Price Book
Template library mapping fixture types to pricing per stage. Used for margin analysis.

**Database**: `price_book_versions`, `price_book_entries`

**Structure**: Version → Entries (fixture_type_id FK + prices per stage)

**Fields**: fixture_type_id (FK to fixture_types), rough_in_price, top_out_price, trim_set_price, total_price

### Cost Estimate
Calculated total project cost including materials, labor, driving, and estimator expenses. Created in Cost Estimate tab (4th tab).

**Database**: `cost_estimates`, `cost_estimate_labor_rows`

**Components**: Material costs (from linked POs), Labor costs (hours × rate), Driving costs (calculated), Estimator costs (per count type or flat)

### Driving Cost
Transportation cost calculated from total labor hours, distance to office, and configurable rates.

**Formula**: `(Total Man Hours / Hours Per Trip) × Rate Per Mile × Distance to Office`

**Default Rates**: $0.70/mile, 2.0 hours/trip

**Database**: `driving_cost_rate`, `hours_per_trip` fields on `cost_estimates`

### Estimator Cost
Per-count-type or flat amount added to Labor Total to cover estimator overhead. Default: $10 per Count Type (fixture type row in Counts).

**Options**: Per count row (Count Types × $/count) or flat amount

**Database**: `estimator_cost_per_count`, `estimator_cost_flat_amount` on `cost_estimates`

### Margin / Margin Percentage
Profitability metric comparing revenue to cost.

**Formula**: `((Revenue - Cost) / Revenue) × 100`

**Color Flags**: 
- Red: < 20% (low profitability)
- Yellow: 20-40% (acceptable)
- Green: ≥ 40% (good profitability)

**Tab**: Analyzed in Pricing tab (5th tab)

### Bid Assignment / Pricing Assignment
Link between a count row and a price book entry. Stores fixture-to-pricing mappings for margin analysis.

**Database**: `bid_pricing_assignments` table

**Purpose**: Persist which price book entry applies to each fixture count

### Bid Pricing Package send
Bids → Pricing tab → **Package and send** button (left of **Export CSV**). Sends an external pricing package to a teammate: the bid's Job Plans link plus a 4-column table (**Fixture or Tie-in**, **Count**, **Unit price**, **Revenue**). External by design — no Margin %, no Our cost, no Price book entry; hidden submission fixtures (`bid_count_row_submission_hides`) are dropped, but the footer total still reflects the live Pricing tab.

**Audience**: `dev` / `master_technician` / `assistant` / `estimator`. Recipient is an org user from the existing roster (non-archived, no `helpers`, no `name='delete'`).

**Two send paths**:
- **Send via my mail** — opens `mailto:` (plain-text body via [`bidPackageMailto.ts`](../src/lib/bidPackageMailto.ts)) and copies the HTML table to the clipboard so the user pastes a rich table next to the link.
- **Send for me** — Edge function [`send-bid-pricing-package`](../supabase/functions/send-bid-pricing-package/index.ts) re-computes pricing rows server-side and emails via Resend (`sendResendHtmlEmail`). Server-side re-compute guarantees the email always matches the live Pricing tab, never a stale tab.

**Audit table**: `bid_pricing_package_sends` (migration `20260521221622_bid_pricing_package_sends.sql`). One row per attempt with `sent_via` either `'resend'` or `'mailto_logged'`. The mailto path writes through SECURITY INVOKER RPC `log_bid_pricing_package_send`; the Resend path writes through the Edge function's service-role client.

**RLS**: SELECT for `dev` / `master_technician` / `assistant` / `estimator` gated on `can_access_bid_for_pricing(bid_id)`. INSERT same gate plus `sent_by_user_id = auth.uid()`. UPDATE / DELETE dev only.

**Source of truth**: shared pure helper [`buildBidPricingPackageHtml.ts`](../src/lib/buildBidPricingPackageHtml.ts) (mirrored at [`supabase/functions/_shared/bidPricingPackage.ts`](../supabase/functions/_shared/bidPricingPackage.ts)) renders the table HTML for the modal preview, the clipboard payload, and the Resend email body — so the recipient sees exactly what the sender saw.

### Schedule of Values (Cover Letter payment schedule)
Opt-in per-bid payment schedule rendered in the Cover Letter (and Approval PDF page 4) after **Terms and Warranty**: one line per row — `Due {timing}: {percent}% — ${amount}` — where **timing** ∈ before start / before–after **Rough In** / **Top Out** / **Trim Set** and the dollar amount is that percent of the letter's effective contract amount (custom-amount override respected; bundled multi-Pricing letters compute per-Pricing dollars). First enable seeds the company standard **30/30/30/10** (30% before each phase + 10% retainage after Trim Set). Flag **`bids.include_payment_schedule`**; rows in **`bid_payment_schedule_rows`** (persist even while the toggle is off); RLS via `can_access_bid_for_pricing`. Editor in the Cover Letter tab warns (amber, non-blocking) when percents don't sum to 100. Pure kernel [`paymentSchedule.ts`](../src/lib/bidDocuments/paymentSchedule.ts); migration `20260702120000`; **v2.596**.

### Followup Sheet
Printable/downloadable report showing account manager's assigned projects with contact details and submission history. Available in Submission & Followup tab.

**Formats**: Print preview window, downloadable PDF

**Features**: 
- Select specific account manager, "ALL", or "UNASSIGNED"
- Groups projects by status (Not Yet Won or Lost, Won)
- Includes project details, builder info, project contact, bid details, and latest 3 submission entries
- PDF has clickable phone numbers (tel: links) and emails (mailto: links) for mobile use

**Purpose**: Field reference for account managers with quick access to contact information

### Book / Book Version
Reusable template collection (Takeoff, Labor, or Price book). Multiple versions allow different standards for different job types.

**Pattern**: All three book systems use same structure (versions → entries)

**Selection**: Bid-level version persistence (each bid remembers selected versions)

---

## Materials System

### Part / Material Part
Individual plumbing part or material in the catalog (pipe, fitting, fixture, valve, etc.).

**Database**: `material_parts` table

**Fields**: name, manufacturer, part_type_id (FK to part_types — **optional** since **v2.591**; a part can be saved with no type), notes (can include SKU)

### Part Type
Category for organizing material parts in the Materials system (Pipe, Fitting, Valve, Sink, Faucet, etc.). Service-type-specific categorization separate from fixture types used in Bids.

**Database**: `part_types` table (separate from `fixture_types`)

**Management**: Settings page, Part Types section (dev access)

### Supply House / Vendor
Supplier or vendor where materials are purchased (Ferguson, HD Supply, local plumbing supply, etc.).

**Database**: `supply_houses` table

**Fields**: name, contact info, address, notes, monthly_payment_day (day 1–31 when payment is typically due; used for Due column in supply house list)

### PO Generator ledger
Shop PO / reference codes (10000–99999) generated from **Materials → PO Generator** and stored in **`material_po_generator_entries`** with **`job_ledger_id`**, **`for_user_id`**, optional **`supply_house_id`**, and unique **`po_code`**. **Supply Houses** → expanded house → **Invoices** **Purchase Order #** can show a red warning when that field contains a parsed generator-style code not present on visible ledger rows for this supply house or with **null** **`supply_house_id`**. Parser: **[`parsePoGeneratorCodeFromPurchaseOrderName`](../src/lib/parsePoGeneratorCodeFromPurchaseOrderName.ts)** — treats strings like **`40326-1`** as shop refs, not **`40326`**.

**See**: **[`RECENT_FEATURES.md`](RECENT_FEATURES.md)** v2.412; **[`MIGRATIONS.md`](MIGRATIONS.md)** **`20260428231416_material_po_generator.sql`**, **`20260428232212_material_po_generator_supply_house_optional.sql`**

### Price / Part Price
Cost of a specific part from a specific supply house. One price per (part, supply_house) combination.

**Database**: `material_part_prices` table

**Unique Constraint**: `(part_id, supply_house_id)` - prevents duplicate prices

### Price History
Historical record of price changes. Automatically tracked via database trigger.

**Database**: `material_part_price_history` table

**Tracked**: old_price, new_price, price_change_percent, changed_at, changed_by, notes

**Purpose**: Audit trail and analysis of price trends

### Price Confirmation
Assistant verification of a price before ordering. Tracked per PO item.

**Fields**: `price_confirmed_at`, `price_confirmed_by` on `purchase_order_items`

**Display**: "X hours ago" since confirmation

**Purpose**: Ensure prices are current before placing orders

### Service Type
Trade category (Plumbing, Electrical, HVAC) used to organize materials and bids by specialty. Each part, template, purchase order, and bid must be assigned a service type.

**Database**: `service_types` table (referenced by `material_parts`, `material_templates`, `purchase_orders`, `bids`)

**Initial Types**: Plumbing, Electrical, HVAC

**Management**: Devs can add, edit, delete (if not in use), and reorder service types in Settings

**UI**: Filter buttons above tabs in Materials and Bids sections show only items of selected type

### Assembly Type
Category for organizing material assemblies/templates (Bathroom, Kitchen, Utility, Commercial, Residential, etc.). Service-type-specific categorization for grouping and filtering assemblies.

**Database**: `assembly_types` table

**Fields**: service_type_id (FK), name, category, sequence_order

**Management**: Settings page, Material Assembly Types section (dev access)

**Usage**: Filter and search assemblies in Materials Assembly Book

**Examples**: 
- Plumbing: Bathroom, Kitchen, Utility, Commercial
- Optional field - assemblies can exist without a type

### Template / Material Template / Assembly
Reusable collection of parts and nested assemblies (e.g., "Bathroom rough-in" might include pipes, fittings, and fixtures). Can be added to purchase orders or used in takeoff books.

**Database**: `material_templates` table (with `material_template_items` for contents)

**Fields**: name, description, service_type_id, assembly_type_id (optional)

**Features**: Nested assemblies (assemblies can contain other assemblies), quantity per item, recursive cost calculation

**Management**: 
- Assembly Book tab (Materials) - Focused interface for building and checking assemblies
- Assemblies & Purchase Orders tab - Quick access when building POs

**Use Case**: "Standard Bathroom", "Kitchen Rough-in", "Commercial Restroom", etc.

### Assembly Book
Dedicated tab in Materials for managing assemblies, their parts, nested assemblies, and pricing.

**Location**: Materials page → Assembly Book tab (between Price Book and Assemblies & POs)

**Features**:
- Filter by assembly type
- Search by name, description, or type
- View detailed assembly breakdown with all parts and costs
- Edit part quantities within assemblies
- View all prices at different supply houses
- Quick access to edit parts and prices
- Recursive cost calculation for nested assemblies
- Pricing status indicators (all priced, missing prices, etc.)

**Purpose**: Focused interface for building complete, properly priced assemblies before using them in purchase orders or takeoff books

### Purchase Order (PO)
Order for materials from a supply house. Can be draft (editable) or finalized (locked).

**Database**: `purchase_orders`, `purchase_order_items`

**Statuses**: draft, finalized

**Features**: Draft = editable, Finalized = locked (except add-only notes)

### Draft PO
Editable purchase order. Can add/remove items, change quantities, change supply houses.

**Status**: `status = 'draft'`

**Restrictions**: None (fully editable)

### Finalized PO
Locked purchase order ready for ordering. Cannot edit items but can add notes once.

**Status**: `status = 'finalized'`

**Notes**: Add-only field for final bill amount, pickup issues, etc.

**Fields**: `notes`, `notes_added_by`, `notes_added_at`

### Load All Mode
Price book feature that loads entire parts catalog for instant client-side search and sorting.

**UI**: Toggle button with speed icon, blue indicator when active

**Benefits**: No pagination interruption, perfect for bulk editing

**Default**: Enabled by default

### Infinite Scroll
Pagination mode that automatically loads more parts as user scrolls near bottom.

**Trigger**: Within 200px of page bottom

**Disabled**: When Load All mode is active

### Server-Side Search
Search that queries database instead of filtering loaded results. Searches across entire dataset.

**Debounce**: 300ms delay to prevent excessive queries

**Fields Searched**: name, manufacturer, fixture_type, notes

### Server-Side Sorting
Sorting by price count that queries database for global sort order (not just current page).

**Column**: "#" column header (price count)

**Function**: `get_parts_ordered_by_price_count(ascending_order, filter_service_type_id)`

**Benefit**: See parts with fewest/most prices across entire catalog

---

## Database Concepts

### Migration
SQL file defining schema changes (CREATE TABLE, ALTER TABLE, etc.). Migrations are append-only and never edited after creation.

**Location**: `supabase/migrations/`

**Naming**: `YYYYMMDDHHMMSS_descriptive_name.sql`

**Rule**: Never edit existing migrations; create new ones

### address_geocodes
Cache of **normalized address key** → **latitude** / **longitude** (and source metadata) for the [Map page](#map-page-map) and related geocoding. **RLS** — **`dev`**, **`master_technician`**, **`assistant`**, **`estimator`** (**`20270520120000_address_geocodes_estimator_map_access.sql`**). Written by Edge Functions **`geocode-one`** and **`geocode-address-batch`** (see [EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md)). Client: [`useMapPageData.ts`](../src/hooks/useMapPageData.ts). See [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) **Key Features** §16.

### Last work date (`jobs_ledger.last_work_date`)
Cached calendar **`work_date`**: the latest among **approved**, non-rejected, non-revoked **`clock_sessions`** with **`job_ledger_id`** pointing at the job. Maintained by database triggers on **`clock_sessions`** (not edited in Job form). Used for read-only display (e.g. **Job Detail** modal).

### Last bill date (Job Detail modal — UI-only row)
**Not a database column.** In **[`DetailJobModal.tsx`](../src/components/jobs/DetailJobModal.tsx)**, the **Last bill date** label shows the calendar-latest **recorded billing activity** from **`deriveRecordedBillingActivityDetail`** ([`stagesJobReferenceDates.ts`](../src/lib/stagesJobReferenceDates.ts)): **`jobs_ledger_invoices`** **`sent_to_customer_at`** / **`billed_at`** and **`jobs_ledger_payments`** **`paid_on`** only (manual **`last_bill_date`** is **excluded** here; see **Last manual bill date** and Stages **`b:`**). **`—`** when no activity qualifies or when the modal uses a **limited** snapshot without invoice/payment data.

### Last manual bill date (`jobs_ledger.last_bill_date`)
**UI label** in **Edit Job** / **Detail Job**: **Last manual bill date** (database column **`last_bill_date`**). Business date for billing / Stages aging / partial-invoice defaults—**entered by the user**, not auto-updated when an invoice is sent. Set in **Edit Job** and **When Billed** / **Missing Billed Date** on Jobs **Ready to Bill** when unset. Former column name **`estimated_completion_date`**. Future **Stripe** webhooks may set or align this field. Included in the **Stages `b:`** line (`max` with invoice/payment activity; see below).

### Primary remainder vs partial Ready-to-Bill lines (`jobs_ledger_invoices`)
For jobs in **Ready to Bill**, **`jobs_ledger_invoices`** can have **multiple** rows with **`status = ready_to_bill`**. Exactly one row should have **`is_primary_rtb_bundle = true`**: the **remainder** line whose **`amount`** is kept in sync with unallocated balance (**revenue − payments − sum of ready_to_bill and billed invoice amounts**) by **`ensure_single_ready_to_bill_invoice_for_job`**. User-created **partial** lines use **`is_primary_rtb_bundle = false`**; their amounts are **not** overwritten by that RPC. **Bill Customer** from the **job** row targets the **primary** remainder; billing a **partial** amount uses **Bill Customer** on that **invoice** row.

### Other job charges (Jobs — manual materials)
User-facing label for **manual job materials** lines stored on **`jobs_ledger_materials`** in **Edit Job** and **Job Detail** materials cost accordions (and in Jobs **Parts** totals / Quickfill copy). Replaces the older **Billed materials** wording. See **`RECENT_FEATURES.md`** → v2.277; **`JobFormModal.tsx`**, **`JobDetailMaterialsCostSection.tsx`**.

### Stages lines `j:` and `b:` (Jobs Stages tab)
Read-only **T±n (weekday)** summaries under **Assigned / HCP**: **`j:`** (job / field) = calendar-latest of **`last_work_date`** (approved clock sessions cache) and max **`job_schedule_blocks.work_date`** for the job; **`b:`** (billing reference) = calendar-**latest** of **last manual bill date** (**`last_bill_date`**) and invoice **`sent_to_customer_at`** / **`billed_at`** and payment **`paid_on`**; **`—`** only when all of those are empty. **Implementation**: **[`src/lib/stagesJobReferenceDates.ts`](../src/lib/stagesJobReferenceDates.ts)**.

### Stages line "man-hours applied" (Jobs Stages tab) — **v2.592**
Read-only clock-icon line on each Stages-board card, directly under **`b:`**, showing **total man-hours applied** to the job as a compact `8h 15m` / `45m` label (via **`formatDecimalWorkHoursToHhMm`**, which returns **`—`** for non-positive values), with a **per-person breakdown on hover** (`title` tooltip, descending). Backed by the **`SECURITY INVOKER`** RPC **`get_man_hours_by_job()`** (migration **`20260607234914`**), which mirrors the canonical **[`teamLabor.ts`](../src/utils/teamLabor.ts)** allocation kernel — salaried = **8h Mon–Fri**, hourly = **`people_hours`** (last 2 years), each crew day split across that day's **`job_assignments`** by **`pct`** — so totals reconcile with the **Combined Labor / Teams Summary** tabs. Loaded **once per Stages visit** in **[`Jobs.tsx`](../src/pages/Jobs.tsx)** (`loadStagesManHours`, load-once `useRef`, retry on error); shows **`…`** while loading and **`—`** when the job has no allocated hours or the caller's role has no RLS read access to the labor tables. See **`RECENT_FEATURES.md`** → v2.592.

### Clock sessions in Job activity / notes (v2.593)
The **Job activity / notes** feed (**`JobThreadNotesPanel`**, shown on Jobs **Stages**, **Workflow**, and the **Job Detail** modal) is a merged chronological timeline of read-only and interactive sources: thread notes (**`jobs_ledger_thread_notes`**), field reports, dispatch schedule blocks (**v2.445**), and — as of **v2.593** — **clock in/out sessions**. Clock rows render with an indigo left-border + **CLOCK** tag showing `person · in → out · duration` (open sessions read *still on the clock*), an amber **Pending approval** chip when **`approved_at`** is null, and the session note when present. Pure kernel **[`clockSessionsToActivityItems`](../src/lib/jobThreadClockActivity.ts)** maps non-rejected **`clock_sessions`** (fetched via **`fetchClockSessionsForJobLedger`**, which already excludes revoked) into timeline items; merged + sorted in **[`useJobThreadNotes.ts`](../src/hooks/useJobThreadNotes.ts)** / **[`useJobThreadNotesForModal.ts`](../src/hooks/useJobThreadNotesForModal.ts)** with a `clock_sessions` Realtime subscription. **RLS-governed** (roles without labor read-access see no clock rows). Because it keeps **pending** (unapproved) sessions, this surfaces clocked time that has **not** yet rolled into man-hours (see **Stages line "man-hours applied"**, which is approved-only). The collapsed **Last activity** preview is unaffected (thread-stats only). No DB / migration / type changes.

### Job activity ledger — system events (v2.594; ledger table v2.595)
Extends the Job activity / notes feed into a **chronological ledger of important job actions**. Beyond notes/reports/schedule/clock, the feed merges read-only **system events**: **status changes** (`job_status_events`), **payments** (`jobs_ledger_payments`), **invoice milestones** created/billed/sent/write-down (`jobs_ledger_invoices`, one row → up to 4 items), **Stripe invoice emails** (`jobs_ledger_invoice_stripe_email_sends`), and **crew added** (`jobs_ledger_team_members`). All flow through ONE generic `event` item kind defined in **[`jobActivityEvent.ts`](../src/lib/jobActivityEvent.ts)** (`JobActivityEventType` + `JOB_ACTIVITY_EVENT_RENDER` registry: tag/colors/`financial`/bucket); the panel renders them with one branch (colored left-border + uppercase tag + humanized `summary`). A segmented **All / Notes / Status / Billing / Crew** filter (**[`jobActivityFilter.ts`](../src/lib/jobActivityFilter.ts)**) sits above the feed. **Financial events** (payments/invoices) are gated by the source tables' existing RLS (dev/master_technician/assistant/primary) — others see none. **Phase 1** (v2.594) was client-only (per-source pure kernel + fetcher, mirroring `clockSessionsToActivityItems`, merged in both thread hooks). **Phase 2** (v2.595, **now live**) replaces that with an append-only **`job_activity_events`** table written by DB triggers (status / payments / invoices / team / field-edits / materials / fixtures + the split RPC), read through the single SECURITY DEFINER **`list_job_activity_events`** RPC (role-aware, gating via `can_read_job_activity`) with one realtime subscription — additionally capturing **removals** (payment/crew), **field edits**, and **combine/separate**. The client now reads only that RPC; the Phase-1 per-table kernels were removed (the generic `event` chassis + filter stay). See **`RECENT_FEATURES.md`** → v2.594, v2.595; **`MIGRATIONS.md`** → June 8, 2026.

### Stages Last activity — Stripe emailed customer (Jobs)
When **Jobs** **Stages** **Last activity** shows **Stripe emailed customer** plus a time line and **Resend invoice email**, the job has exactly **one** matching **billed** Stripe invoice line with **`sent_to_customer_at`** set (**`stagesJobLevelStripeEmailedHintInvoice`** in **`Jobs.tsx`**); multiple billed Stripe lines hide the block. **Resend** invokes Edge **`send-stripe-invoice`** (same as **Send Email invoice from Stripe** in **Bill Customer** / hosted bill). **`jobs_ledger_invoices.sent_to_customer_at`** holds the **latest** send timestamp; append-only **`jobs_ledger_invoice_stripe_email_sends`** records each successful **PipeTooling** send for history in the confirm modal. See **`RECENT_FEATURES.md`** → v2.303, v2.304.

### pay_stub_payments
Physical installment rows against a generated pay stub: amount sent, optional sent-on date, optional memo. A database trigger prevents the sum of installment amounts from exceeding **Net Pay** (stub **gross_pay** minus **`pay_stub_deductions`** plus **`pay_stub_additional_lines`** `line_total`, within a small rounding tolerance).

**Contrast with `pay_stub_days`**: Day rows allocate gross by **work date** (used in Annual Pay to Date: earned vs allocated). **`pay_stub_payments`** tracks **cash actually sent** and drives People **Payroll** tab **Paid to date**, **Balance**, and Unpaid / Partial / Paid status (against **Net Pay**).

**Client helpers**: `src/lib/payStubPayments.ts` (e.g. sum, remaining, fully paid).

**See also**: `RECENT_FEATURES.md` → v2.172, v2.173, v2.174; `PROJECT_DOCUMENTATION.md` → People (**Payroll** tab).

### person_offsets
Per-person **backcharges**, **damages**, and **employee credits** (`person_offsets.type`, migration **`20270408163000`**). Pending rows (`pay_stub_id` null) surface on printed pay reports; applied rows link to a pay stub. **Employee credit** records money owed *to* the employee (for example a payment overage captured as a pending offset). **Less** in `src/components/pay/PayStubLessModal.tsx` does not **Apply** employee credits as deductions.

**See also**: `RECENT_FEATURES.md` → v2.252; `PROJECT_DOCUMENTATION.md` → People (Offsets, **Payroll** tab).

### pay_stub_deductions
**Less** lines on a pay stub: amounts subtracted from **gross_pay** as part of **Net Pay**. Each row is either **manual** (description + amount) or **offset** (linked to **`person_offsets`**). Sum of deductions cannot exceed gross; changing deductions is blocked if existing installments would exceed the new Net Pay (which also includes **Additional**).

**See also**: `RECENT_FEATURES.md` → v2.173, v2.174; `src/components/pay/PayStubLessModal.tsx`.

### pay_stub_additional_lines
**Additional** lines on a pay stub: **quantity** × **rate**, with **`line_total`** generated in the database as `round(quantity * rate, 2)`. **Net Pay** = **gross_pay** − sum(Less) + sum(Additional line totals). Edits are blocked when installments already fully cover Net Pay, same pattern as **Less**. Optional **`source_clock_session_id`** links a line to **`clock_sessions`** (for example a **prevailing wage** top-up from an approved session in the stub period); partial unique index enforces at most one such row per stub per session. **`description`** is user-facing text only (**v2.345**): new prevailing-wage rows do not embed a machine prefix; **`stripPrevailingWageTag`** in **`payStubPrevailingWageLine.ts`** strips any legacy **`[pw:<uuid>]`** leader for the Additional modal and pay report HTML, while **`parsePrevailingSessionId`** can still read it for dedup on old rows.

**Client helpers**: `src/lib/payStubDeductions.ts`, `src/lib/payStubPrevailingWageLine.ts`.

**See also**: `RECENT_FEATURES.md` → v2.345, v2.174; `PROJECT_DOCUMENTATION.md` → People (**Payroll** tab); `MIGRATIONS.md` → `20260420051645`; `src/components/pay/PayStubAdditionalModal.tsx`.

### Trigger
Automatic database function that fires on INSERT, UPDATE, or DELETE operations.

**Common Uses**: 
- Update `updated_at` timestamps
- Cascade customer master changes to projects
- Track price history changes

**Example**: `update_updated_at_column()` trigger on all tables

### Cascade / Cascading
Automatic propagation of changes via foreign keys.

**ON DELETE CASCADE**: Deleting parent deletes children (e.g., delete project → delete workflow)

**ON DELETE SET NULL**: Deleting parent nulls reference (e.g., delete user → null `created_by`)

**ON UPDATE CASCADE**: Updating parent updates children (e.g., customer owner → project owner)

### Foreign Key
Database constraint linking tables via ID references.

**Pattern**: `other_table_id UUID REFERENCES other_table(id)`

**Cascading**: Specifies what happens on parent DELETE/UPDATE

### Check Constraint
Database validation rule enforcing data integrity.

**Examples**: 
- `CHECK (quantity > 0)` - no negative quantities
- `CHECK (price >= 0)` - no negative prices
- `CHECK (count >= 0)` - no negative counts

### Unique Constraint
Database rule preventing duplicate values.

**Examples**:
- `UNIQUE (version_id, fixture_name)` - no duplicate fixtures per version
- `UNIQUE (bid_id, count_row_id)` - one pricing assignment per count row
- `UNIQUE (part_id, supply_house_id)` - one price per part per supply house

### Index
Performance optimization structure for faster queries.

**Types**: Regular, Unique, Partial (with WHERE clause)

**Purpose**: Speed up lookups on frequently queried columns

### Transaction / Transaction Function
Multiple database operations wrapped in atomic unit. All succeed or all rollback.

**Benefits**: Prevents partial data on failures

**Examples**: `create_project_with_template()`, `duplicate_purchase_order()`

### Atomic Operation
Database operation that completes fully or not at all (no partial completion).

**Guarantee**: Either all changes commit or all rollback

**Implementation**: Transaction functions in PostgreSQL

---

## Technical Terms

### Supabase
Backend-as-a-service platform providing PostgreSQL database, authentication, edge functions, and real-time subscriptions.

**Components**: Database (PostgreSQL), Auth (JWT-based), Edge Functions (Deno), Storage, Realtime

**URL Pattern**: `https://[project-ref].supabase.co`

### Edge Function
Serverless function running on Deno runtime. Handles privileged operations requiring service role permissions.

**Runtime**: Deno (TypeScript/JavaScript)

**Location**: `supabase/functions/`

**Examples**: create-user, archive-user, restore-user, login-as-user, send-workflow-notification

### Resend
Email delivery service used for sending notification emails.

**API Key**: Stored in Supabase Edge Functions secrets

**Used By**: `send-workflow-notification`, `test-email` edge functions

### JWT (JSON Web Token)
Authentication token containing user ID and metadata. Passed in Authorization header.

**Format**: `Authorization: Bearer <jwt_token>`

**Contains**: user_id, role, email, expiry

### Service Role Key
Supabase admin key with full database access (bypasses RLS). Used in Edge Functions for privileged operations.

**Security**: Never expose to frontend; only use in backend

**Storage**: Supabase Edge Functions secrets

### GitHub Pages
Static site hosting service. Pipetooling deploys here via GitHub Actions.

**URL Pattern**: `https://[username].github.io/[repo]/`

**Deployment**: Automatic on push to main branch

**SPA note**: Deep links (e.g. `/dashboard`) have no static file; the host may return **HTTP 404** for the document while still serving **`404.html`** (copy of `index.html`). **Hard Reload** in the app loads **`/`** first then restores the path in the browser (`TROUBLESHOOT_404.md`, [`src/lib/hardReload.ts`](../src/lib/hardReload.ts)).

### GitHub Actions
CI/CD automation running workflows on GitHub events.

**Location**: `.github/workflows/deploy.yml`

**Triggers**: Push to main branch

**Steps**: Install dependencies, build, deploy to GitHub Pages

### Vite
Frontend build tool and dev server. Fast hot module replacement (HMR) during development.

**Dev Server**: `npm run dev` (port 5173 by default)

**Build**: `npm run build` → outputs to `dist/`

**Config**: `vite.config.ts`

### React Router DOM
Client-side routing library for React single-page applications.

**Routes**: Defined in `src/App.tsx`

**Components**: `<BrowserRouter>`, `<Routes>`, `<Route>`, `<Navigate>`

### Context API
React pattern for sharing state across component tree without prop drilling.

**Used For**: Authentication state (`AuthContext`)

**Pattern**: Provider at root, consumers via `useContext()` hook

---

## UI/UX Terms

### Protected Route
Route component that requires authentication. Redirects to sign-in if user not authenticated.

**Implementation**: `ProtectedRoute` wrapper in `App.tsx`

**Redirects**: Unauthenticated users → `/sign-in`

### Map page (`/map`)
**Leaflet** + OpenStreetMap **tiles**; circle markers for **jobs**, **bids**, and **estimates**; **scrollable entity table below the map**; **Filter** (**search**) sits on the **table heading row** (with **All visible layers** / result counts); **Geoman** polygon draw refines the list further; while cold addresses resolve, optional **Resolving addresses…** + progress list (**`useMapPageData`**, chunked **`geocode-address-batch`**). **Review geocodes** (per-row **Google** refresh via **`geocode-one`** **`refresh_google_only`**) is under the bottom-right **Debug** disclosure. **Dev** can set an org **default map center/zoom** in **Settings** (`map_default_view_v1` in `app_settings`; see `MapDefaultViewSettingsBlock`, `mapDefaultViewSettings.ts`). **Roles**: **`dev`**, **`master_technician`**, **`assistant`**, **`estimator`**; **`Layout`**: desktop **pin** where present, **gear** menu on narrow viewports ([ACCESS_CONTROL.md](ACCESS_CONTROL.md) Page Access Matrix, [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) §16).

### Layout
Component wrapping page content with navigation header.

**Location**: `src/components/Layout.tsx`

**Features**: Navigation links, role-based menu visibility, user menu

### Modal
Overlay dialog for forms and confirmations. Used extensively for create/edit operations.

**Pattern**: Conditional rendering based on state (e.g., `showModal` boolean)

**Close**: X button, Cancel button, or click outside (some modals)

### Toast / Notification
Temporary message showing success/error feedback.

**Library**: Custom implementation or third-party (check code)

**Duration**: Typically 3-5 seconds

### Dropdown / Select
Form input allowing selection from list of options.

**Types**: 
- Standard select element
- Searchable dropdown (custom)
- Autocomplete (with filtering)

### Quick Fill
Feature in Customers page for bulk-pasting customer data from spreadsheet.

**Format**: Tab-separated values (name, address, email, phone, date)

**Location**: Expandable section in New Customer form

**Visibility**: Collapsed by default, hidden in Bids modal

### Quickfill (page)
The **`/quickfill`** route — day-to-day workflow hub (section marks, hours, **Prospects**, **Stages: customer link & customer pictures** (`no-customer-stages` — empty–Stages-search lists + union metric, **`QuickfillStagesNoCustomerSection`**, **v2.413** / copy **v2.415**), schedule, inboxes, etc.). Not the same as **Quick Fill** (customer bulk paste). **Jump row** (buttons under the **`h1`**): one compact **last-marked** subline per section (**`RECENT_FEATURES`** **v2.513**). **Prospects** block: warmth pipeline + (for **dev** / **master** / **assistant**) a **30-day Team activity line chart** — **`RECENT_FEATURES.md`** v2.381 / v2.382, **`PROJECT_DOCUMENTATION.md`** (Quickfill), **`ACCESS_CONTROL.md`**.

### Expandable Row
Table row that expands to show additional details.

**Used In**: Price Book (shows all prices), Materials (shows notes)

**Trigger**: Click row or expand icon

### Inline Editing
Editing field directly in table/list without opening modal.

**Example**: PO name editing in Draft POs

**Pattern**: Click to edit, blur or Enter to save

### Page Pins
User-customizable shortcut links on the Dashboard. Stored in localStorage and/or `user_pinned_tabs` table.

**Management**: Settings → Dashboard Page Pins → Page pins (Clear all, Remove per pin). Users add pins via the Layout pin icon when on pinnable pages.

**Dev-only pins**: Devs can pin financial totals (Billed Awaiting Payment, Supply Houses AP, Sub Labor Due, Internal Team labor) to masters/devs dashboards via dev-only sections in Settings.

---

## Abbreviations

- **PO**: Purchase Order
- **RLS**: Row Level Security
- **FK**: Foreign Key
- **GC**: General Contractor
- **HMR**: Hot Module Replacement
- **CRUD**: Create, Read, Update, Delete
- **JWT**: JSON Web Token
- **UUID**: Universally Unique Identifier
- **RPC**: Remote Procedure Call (Supabase functions)
- **UI**: User Interface
- **UX**: User Experience
- **API**: Application Programming Interface
- **SQL**: Structured Query Language
- **CSV**: Comma-Separated Values
- **JSON**: JavaScript Object Notation
- **JSONB**: JSON Binary (PostgreSQL data type)

---

## Common Phrases

### "Adopted master"
A master who has adopted the current user (assistant). Grants the assistant access to the master's data.

### "Shared master"
A master who has granted the current user (another master) assistant-level access to their data.

### "Own data"
Resources where `master_user_id` or `created_by` matches current user's ID.

### "Via adoption"
Access granted because a master adopted the current user.

### "Via sharing"
Access granted because a master shared with the current user.

### "Assistant-level access"
Read-only access with restrictions: can view but not modify, cannot see private notes or financial totals.

### "Cascade to projects"
When customer owner changes, automatically update owner on all customer's projects.

### "Expand template"
Recursively resolve nested templates to get final list of parts with quantities.

### "Book version"
Specific set of entries in a book (Takeoff, Labor, or Price). Allows different standards for different scenarios.

### "Apply book"
Use selected book version to populate fields (labor hours from Labor Book, pricing from Price Book, etc.).

### "RLS policy"
Row-level security rule on a table defining who can access which rows.

### "Helper function"
Database function using SECURITY DEFINER to check conditions without RLS recursion.

### "Transaction function"
Database function wrapping multiple operations in atomic transaction with rollback.

### "Type generation"
Command to auto-generate TypeScript types from Supabase schema: `supabase gen types typescript`

---

**Last Updated**: 2026-07-17

**Related Documentation**: 
- [AI_CONTEXT.md](./AI_CONTEXT.md) - Quick project overview
- [ACCESS_CONTROL.md](./ACCESS_CONTROL.md) - Role permissions details
- [BIDS_SYSTEM.md](./BIDS_SYSTEM.md) - Bids terminology in context
- [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) - Technical reference
