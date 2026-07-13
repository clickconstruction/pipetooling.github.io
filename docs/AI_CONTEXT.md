# AI Context - Quick Project Overview

> **Purpose**: This file provides a 30-second overview of PipeTooling for AI agents and new developers. Read this first, then consult specialized documentation as needed.

---

## Project in 30 Seconds

**PipeTooling** is a workflow management system for master plumbers to track work across multiple projects and crews.

- **Domain**: Commercial/residential plumbing project management + bid estimation
- **Stack**: React + TypeScript + Supabase (PostgreSQL + Auth + RLS + Edge Functions)
- **Deployment**: GitHub Pages (static hosting)
- **Users**: 8 roles with complex access control (dev, master, assistant, subcontractor, **helpers** / UI **Helper**, estimator, primary, superintendent)
- **4 Major Systems** (+ significant subsystems):
  1. Projects/Workflows (ongoing work tracking; **HCP** labels use **trade-specific** **`ledger_job_prefix`** from **Settings** → Service types — **v2.432**, [`ledgerDisplayPrefixes.ts`](../src/lib/ledgerDisplayPrefixes.ts))
  2. Bids (estimation system: Bid Board, Builder Review, Unsent/Working Kanban, Bid Costs, **Estimators** (cross-bid clock pivot — **v2.531** / **v2.534**), Counts, Takeoff, Cost Estimate, Pricing, Cover Letter, Submission, RFI, Change Order, Lien Release; **trade-specific ledger prefixes** for bid # from **`service_types.ledger_bid_prefix`** with client **[`ledgerDisplayPrefixes.ts`](../src/lib/ledgerDisplayPrefixes.ts)** + **[`LedgerDisplayPrefixContext`](../src/contexts/LedgerDisplayPrefixContext.tsx)** — **RECENT_FEATURES** **v2.432**)
  3. Materials (Supply Houses + **PO Generator** ledger, price book, templates, purchase orders — **`RECENT_FEATURES`** **v2.412**, **`PROJECT_DOCUMENTATION.md`** §11)
  4. Checklist (recurring tasks, Today/History/**Review**/Manage/**Roadmap** tabs, `?tab=roadmap` + `roadmap=` — **`checklist_tech_tree_roadmaps`**, members, **`roadmap_id`** on groups, **canvas** icon controls + full-screen header **v2.408** / **v2.407** / **v2.380**; **Manage** client-side **search** (title / assignee) **v2.416**; **Layout** header **Task** / **Task Dispatch** / **Estimator** for **subcontractor**/**helpers**/estimator **v2.450** + checklist RLS helpers **`checklist_item_created_by_auth_user`** / **`checklist_instance_parent_item_created_by_auth_user`**)
  - **Estimates** (internal proposals; global **Quote #** `estimate_number`, staff **`/estimates/{quote#}`**; **`sent`** detail: **`#` + title**, For/logo/line items; **`customer_accepted`**: **`#` + status**, snapshot **card** first, **CustomerSnapshotModal** from customer line, **Customer acceptance** then collapsible **Customer activity** (default closed) then centered **Job** (blue **Create job**); **Customer activity** + **`record_estimate_public_link_view`** dedupe; public **thank-you** centered + **`chick.png`**; **Terms and Conditions.** link line; customer **`/estimate/accept`** + Edge; **Email when customer accepts** — **Notify me** + **Also notify** [`SearchableMultiSelect`](../src/components/SearchableMultiSelect.tsx) (role-grouped options, separator captions); draft **`accept_notify_user_ids` `NULL`** → load default **self + all `master_technician`**; **`≤640px`**: **`EstimateListCards`**, **`estimatesPageShellCss`**, scroll wraps / preview constraints — **`Estimates.tsx`**, **`AcceptHeaderBrandPicker.tsx`**; see `PROJECT_DOCUMENTATION.md`, **RECENT_FEATURES** **v2.434**, **v2.288**, **v2.430**)
  - **Documents** (`/documents`) — ledgers + **Search** + **Supply house invoices** (`?tab=` **`search`**, **`estimates`**, **`bid-proposals`**, **`jobs`**, **`supply-invoices`**, **`upload`** — [`documentsPageTab.ts`](../src/lib/documentsPageTab.ts)); **Docs** column + soft **+** to add/check Google links ([`Documents.tsx`](../src/pages/Documents.tsx), [`DocumentsAddDriveLinkModal.tsx`](../src/components/documents/DocumentsAddDriveLinkModal.tsx), [`checkGoogleDriveAttachmentUrl.ts`](../src/lib/checkGoogleDriveAttachmentUrl.ts)); per-tab and unified search; compact header (**RECENT_FEATURES** **v2.380**, **v2.314**; **`PROJECT_DOCUMENTATION.md`** → Documents page)
  - **Prospects** (lead management, Convert tab, callbacks; **Team** activity in **`prospectTeamActivity`**) and **Quickfill** (billing workflow, **Stages: customer link & customer pictures** **v2.413** / copy **v2.415**, **Banking sorting** snapshot, **Prospects** section — warmth + **Team** line chart (**`ProspectTeamActivityLineChart`**, **`recharts`**) + link — **`QuickfillProspectsSection`**, Crew Jobs / Bids with Realtime **`CrewJobsBlock`**) are major subsystems
  - **Map** (`/map`) — **Leaflet** + OSM tiles; **`dev`**, **`master_technician`**, **`assistant`**, **`estimator`** ([`layoutRouteAccess.ts`](../src/lib/layoutRouteAccess.ts)); desktop **pin** / narrow **gear** ([`Layout.tsx`](../src/components/Layout.tsx)); **entity table below map** + **Filter** on the **table title row**; **Geoman** polygon; **Debug** → **Review geocodes**; org **default view** (**Settings**, **`map_default_view_v1`**); **`address_geocodes`**; primary load **`geocode-address-batch`** in chunks (**`useMapPageData`**) + **Resolving addresses…**; **`geocode-one`** for **`refresh_google_only`** and Settings default-label geocode (see [EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md), **RECENT_FEATURES** **v2.451**)

---

## Branch workflow

`main` is protected: no direct pushes. All changes land via a PR whose CI `checks` job (typecheck + lint + test, [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) must pass; branches must be up to date before merging.

```bash
git checkout -b my-change
# edit, commit
git push -u origin my-change
gh pr create --fill          # CI runs automatically
gh pr merge --squash --delete-branch   # once "checks" is green
```

Merging to `main` triggers the GitHub Pages deploy ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)), which re-runs the same checks before building.

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
- **SPA reload**: Hard Reload and broadcast force reload use [`src/lib/hardReload.ts`](../src/lib/hardReload.ts) + [`index.html`](../index.html) to load `/` then `history.replaceState` back to the prior route (fewer misleading document **404**s than reloading `/dashboard?nocache=…`). See `TROUBLESHOOT_404.md`.
- **Sync to Testing**: Double-click `Sync to Testing.command` at project root to copy `pipetooling.github.io` → `testing-pipetooling.github.io`

### Type Safety
- Types auto-generated from Supabase schema: `src/types/database.ts`
- Manual function types: `src/types/database-functions.ts`
- Update: `npm run gen-types:local` or `npm run gen-types:linked`, or manually `supabase gen types typescript --local > src/types/database.ts` (or **`--linked`**) — **`>`** writes **stdout only** into **`database.ts`**; **stderr** is not mixed in unless **`2>&1`** is used incorrectly before **`>`**. See **`AGENTS.md`** constraint 3 for details.

---

## File Structure

```
pipetooling.github.io/
├── src/
│   ├── pages/              # Main UI pages (Customers, Projects, Workflow, People, Jobs, Bids, Materials, Checklist, etc.)
│   ├── components/         # Reusable UI components
│   ├── contexts/           # React contexts (ToastContext, ForceReloadContext, JobsListCacheContext, ChecklistAddModalContext, EditCustomerModalContext, NewCustomerModalContext)
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
- **`src/pages/Bids.tsx`** (~20k lines) - Bids: Bid Board, Builder Review, **Unsent/Working** (`tab=working`) Kanban, Bid Costs, **Estimators** (`tab=estimators`, viewable by all roles — days × estimators pivot of bid clock sessions; **[`BidsEstimatorsTab.tsx`](../src/components/bids/BidsEstimatorsTab.tsx)**, **[`bidEstimatorsTab.ts`](../src/lib/bidEstimatorsTab.ts)**, RPCs **`list_bid_estimators_window_hours`** + **`list_bid_estimators_all_time_hours`** in **`20260515102040_bid_estimators_tab.sql`**; **Manage columns** writes **`bid_estimators_extra_users`**; dev **Cost mode**; search across ledger label / project / GC-builder — **v2.531**, **v2.534**), Counts, Takeoff, Cost Estimate, Pricing, Cover Letter, Submission, RFI, Change Order, Lien Release; **Bid Board** — **`compareBidsForBidBoardDueDate`** (due date ascending, unmarked last — **v2.507**); **Bid Board** **empty bid-value alert** — red filled-circle **`$`** button in **Bid Value** column when a sent bid has empty **`bid_value`** and is **"Not yet won or lost"**; click opens **Edit Bid** with **`focus: 'bidValue'`** so the modal effect scroll-centers, focuses, **`.select()`**s, and amber-pulses the **Bid Value** field (**`#bid-form-bid-value`**) — **[`shouldShowEmptyBidValueAlert`](../src/lib/bidBoardEmptyBidValueAlert.ts)** (12 unit tests), **v2.532**; **Pricing** — **`bid_count_row_submission_hides`**, **`% of bid revenue`** omit toggle, **`GenerateUnitCostModal`** / **`unitPriceFromTargetPctOfTotal`** (**`RECENT_FEATURES`** **v2.499**–**v2.500**, **`MIGRATIONS.md`** **`20270521120000`**, **`20270521120100`**); **Working**-column bids as Clock In quick picks (`fetchWorkingBoardClockBidPicks`); Bid Board **Notes** row: tabs **All notes** (default), **Bid notes**, **Customer notes** — see `src/components/bidBoard/UnifiedBidCustomerNotes.tsx`; **Weekly bids sent** pivot + **dev-only** **Estimator labor cost** block below (**`BidBoardWeeklyEstimatorLaborDevSection`**, **`bidBoardWeeklyEstimatorLaborCost`** — **v2.442**); **Cover Letter** combined HTML: single **`<p>`**, **`pre-wrap`**, clipboard **HTML-only** for Google Docs paste (**v2.329**); **Submission** `?tab=submission-followup` pending deep link; note times via **`datetimeLocal.ts`** in **`BidNotesTable`** / **`UnifiedBidCustomerNotes`**; **Confirm bid sent** attestation modal: optional **Adds to bid note:** persists to **`bids_submission_entries`** on save (**v2.383**); **Win/Loss** change on save — **`insertOutcomeChangeBidNoteAfterSave`** + **`outcomeChangeBidNote.ts`** (**v2.507**); New/Edit bid modal uses **`SearchableSelect`** (`src/components/SearchableSelect.tsx`) for Estimator, Account Man, Service Type, Win/Loss; **`loadEstimatorUsers`** supplies Estimator/Account Man: **non-archived**, not **`helpers`**, not display name **delete** (**v2.449**); **Copy Bid** overlay from **Service Type** chip ([`BidFormModal.tsx`](../src/components/bids/BidFormModal.tsx)): **Open Job** calls **`JobFormModalContext`** **`openNewJob({ prefillBidId })`** → **`JobFormModal`** **`applyPrefillFromBid`** after **`initDone`** (**v2.493**); grid `bid-form-top-fields` (desktop vs mobile); **720px** modal width; **Project Address** then Distance + Plan Pages row
- **`src/pages/Materials.tsx`** (~7k lines) - Price book, templates, purchase orders
- **`src/pages/Checklist.tsx`** - Recurring checklist (Today, History, **Review**, Manage, **Roadmap** `?tab=roadmap` & `roadmap=`); **Manage** — **Search by title or assignee** (client-side **`filteredItems`**, **v2.416**); **Review** lists **Outstanding by person** then **`ChecklistReviewInboxes`** (v2.380; **Dispatch / Estimator inbox** same components as Dashboard — narrow layout **v2.452**); **Roadmap** — [`ChecklistTechTreeTab`](../src/components/checklist/ChecklistTechTreeTab.tsx), [`ChecklistTechTreeRoadmapBar`](../src/components/checklist/ChecklistTechTreeRoadmapBar.tsx), [`ChecklistTechTreeRoadmapMembersModal`](../src/components/checklist/ChecklistTechTreeRoadmapMembersModal.tsx), shared [`ChecklistTechTreeMapActionIconButtons`](../src/components/checklist/ChecklistTechTreeMapActionIconButtons.tsx), [`ChecklistTechTreeRoadmapToolbar`](../src/components/checklist/ChecklistTechTreeRoadmapToolbar.tsx) (v2.408, v2.407)
- **`src/components/ChecklistTitleWithLinks.tsx`** - Renders checklist titles with [1], [2], etc. as clickable links
- **`src/pages/Jobs.tsx`** - Jobs (Reports, Stages, Billing, Team Labor, Sub Labor, **Crew P&L** (dev-only, key `teams-summary` — hours-weighted per-person P&L, [`crewPnlSummary.ts`](../src/lib/crewPnlSummary.ts), **v2.656**), Parts, **Job Summary**, Inspections tabs); **Job Summary expanded rows** open with quick links + Stages-style Assigned/HCP/Last-Activity header and the **Charges & Value profit timeline** ([`jobChargesTimeline.ts`](../src/lib/jobChargesTimeline.ts), also at the bottom of Parts cost in Job Detail/Edit Job via [`JobChargesTimelineStandalone.tsx`](../src/components/jobs/JobChargesTimelineStandalone.tsx); horizontal scroll on busy jobs — **v2.646–v2.655**); Job Summary **%** column = paid-invoices → latest report % (RPC `list_latest_report_completion_pct`) → `pct_complete` ([`jobSummaryPercentComplete.ts`](../src/lib/jobSummaryPercentComplete.ts)); **Reports** — **Recurring Email Reports** (**[`RecurringEmailReportsModal.tsx`](../src/components/jobs/RecurringEmailReportsModal.tsx)**): schedules + recipients; optional **`include_costs`** (**Cost** = hours × **`people_pay_config.hourly_wage`** matched on **`trim(users.name)`** = **`person_name`**; Edge **`recurring-job-report-*`**, **`RECENT_FEATURES`** v2.425); **Stages** — **Combine / Separate** (**[`JobsCombineSeparateModal.tsx`](../src/components/jobs/JobsCombineSeparateModal.tsx)**, toolbar **right**; **v2.516** / **`split_job_ledger_fixtures_to_new_job`**); pipeline row **No customer** / **No customer pictures** list modals (**`StagesNoCustomerJobsModal`**, **`StagesAlertJobListModal`**, **`stagesWorkingJobsWithoutPicturesFromWorking`** in **`jobsStagesBoard.ts`** — **RECENT_FEATURES** v2.413, v2.415); **Parts** tab: toolbar **Unattributed** (all-jobs unattributed Mercury modal) + expanded **Cost by person** **Unattributed** (per-job list, assign / quick-add; **Card**/**Account** columns) — [`fetchUnattributedMercuryLinesForManyJobs`](../src/lib/fetchUnattributedMercuryForManyJobs.ts), [`PartsUnattributedAllJobsModal`](../src/components/jobs/PartsUnattributedAllJobsModal.tsx), [`PartsUnattributedMercuryListModal`](../src/components/jobs/PartsUnattributedMercuryListModal.tsx); **Cost by person** from [`buildPartsPerPersonCostRows`](../src/lib/partsPerPersonCostSummary.ts) — omits **Job (no per-person split)** line (**RECENT_FEATURES** v2.402, v2.401). **Job Summary**: dedicated all-status [`fetchJobsLedgerWithDetailsForStages`](../src/lib/fetchJobsLedgerWithDetailsForStages.ts), **HCP #** min filter ([`applyMinHcpFilter`](../src/lib/jobSummaryHcpFilter.ts), default **500**, **RECENT_FEATURES** v2.395 / v2.396); cost breakdown **print** (`printJobSummaryCostBreakdown`, **Print / Save as PDF** / **Preparing…**, supply lines under **Parts Cost** in print, **RECENT_FEATURES** v2.403, v2.405); expanded **Person summary** per-cell **drilldown** — [`JobSummaryCostCellDrilldownModal`](../src/components/jobs/JobSummaryCostCellDrilldownModal.tsx), [`JobSummaryDrilldownMercuryTable`](../src/components/jobs/JobSummaryCostCellDrilldownModal.tsx) **Reassign** → [`MercuryTransactionAllocationsModal`](../src/components/MercuryTransactionAllocationsModal.tsx) (same access as Parts assign), [`filterJobSummaryMercuryRowsForPersonName` / `filterJobSummaryMercuryRowsForPersonNames`](../src/lib/jobSummaryDrilldownMercuryFilter.ts), [`elementToLikelyCsv`](../src/lib/domTableToCsv.ts), **`.jobSummaryBreakdownInteractive`**, **RECENT_FEATURES** v2.404, v2.406; **Sub Labor** New/Edit modal UX (**RECENT_FEATURES** v2.305): crew search filters, **Add Sub**, line-items + footer layout; **AIA G702-G703** on **Stages** (and **View bill** [`BilledBillViewModal`](../src/components/jobs/BilledBillViewModal.tsx)): [`showAiaG702G703`](../src/lib/aiaG702G703Eligibility.ts), [`AiaG702G703Modal`](../src/components/jobs/AiaG702G703Modal.tsx) — **Change Orders** fields in collapsed **\<details\>** (**RECENT_FEATURES** v2.398)
- **`src/pages/ScheduleDispatch.tsx`** - **Router**: no **`jobId`** → [`ScheduleDispatchHubPage`](../src/components/schedule/ScheduleDispatchHubPage.tsx); with **`jobId`** → [`ScheduleDispatchJobWeek`](../src/components/schedule/ScheduleDispatchJobWeek.tsx). Week hub (**People** / **Jobs** / **Day** — **`hubTab`**; **Day** embeds **`QuickfillScheduleSection`**; URL **`day=`** — [`scheduleDispatchColumnFocus.ts`](../src/lib/scheduleDispatchColumnFocus.ts), v2.309). **Add schedule block**: [`ScheduleDispatchAddBlockModal`](../src/components/schedule/ScheduleDispatchAddBlockModal.tsx) + occupied timeline ([`scheduleDispatchAddBlockTimeline.ts`](../src/lib/scheduleDispatchAddBlockTimeline.ts), [`DispatchAddBlockTimeRange.tsx`](../src/components/schedule/DispatchAddBlockTimeRange.tsx); v2.296, v2.310); per-block **note** + **chrome** (v2.378). **Not coming in today** lifecycle (v2.535): picker footer in [`ScheduleDispatchAssignJobPickerModal`](../src/components/schedule/ScheduleDispatchAssignJobPickerModal.tsx) (single-cell intent only) → [`recordNotComingInForUserAsStaff`](../src/lib/notComingInTimeOff.ts) + bulk `deleteJobScheduleBlock`; cell chips via [`ScheduleDispatchTimeOffChip`](../src/components/schedule/ScheduleDispatchTimeOffChip.tsx) + [`userTimeOffByCell.ts`](../src/lib/userTimeOffByCell.ts) drive `cellHasTimeOff` disabling drops / Add / + triangle; click red chip → [`ScheduleDispatchUndoNotComingInModal`](../src/components/schedule/ScheduleDispatchUndoNotComingInModal.tsx) → `pay_staff_remove_not_coming_in_for_user_day` (migration `20260515233801`)
- **`src/pages/Documents.tsx`** - **Documents** (**Search** / **Estimates** / **Bid proposals** / **Jobs** / **Supply house invoices** / **Upload**); **`documentsPageTab`**, **`DocumentsAddDriveLinkModal`**, **Docs** icons (**RECENT_FEATURES** v2.380, v2.314)
- **`src/pages/Prospects.tsx`** - Lead management (Convert tab, callbacks, Team tab for dev/assistant)
- **`src/pages/Quickfill.tsx`** - Billing workflow: **`QuickfillSectionWrapper`** per block (left **`h2`** titles, **`2px`** dividers); **Jump row** under **`h1`** — compact **last-marked** subline + full phrase on **`title`** / **`aria-label`** (**`RECENT_FEATURES`** **v2.513**); **Stages: customer link & customer pictures** — **`QuickfillStagesNoCustomerSection`** + **`useQuickfillStagesJobsWithoutCustomer`** (**Open list** / **No customer pictures**, union metric, **v2.413**, copy **v2.415**); **Prospects** — **`QuickfillProspectsSection.tsx`** (warmth **`prospectWarmthCounts`**, Team chart **`prospectTeamActivityChartData`** + **`ProspectTeamActivityLineChart`**, v2.381 / v2.382; **`canAccessProspects`**); Crew Jobs / Bids: **`CrewJobsBlock.tsx`** (Realtime on **`people_crew_jobs`** / **`people_crew_bids`**, **`CrewJobsSection.tsx`**); Billed; **Banking sorting** snapshot (**`BankingSortingSnapshotSection.tsx`**, inline **Link…** in table); **People Hours (new)** + **Jobs Billing** min HCP (**RECENT_FEATURES** v2.224; **People Hours (new)** mobile day nav v2.289); **Email** / **Texts** / **Physical inbox** self-report sections (**`QuickfillPhysicalInboxSection.tsx`** — task modal shortcuts, v2.309; **Schedule** / **Office** / inbox chrome + stale tally **Assign** split seeding, v2.310); **Dispatch inbox** embedded section — same **`DispatchInboxSection`** narrow layout as Dashboard (**v2.452**); **Complete, no Total Bill** (`complete-no-bill`, **v2.649**) — 100%-complete non-paid jobs with empty revenue, inline cards with clock rollup + Job Detail/Edit job buttons + activity accordion ([`quickfillCompleteNoBill.ts`](../src/lib/quickfillCompleteNoBill.ts))
- **`src/pages/Dashboard.tsx`** - Reports, pins, Estimator Dashboard; **Job Mode** (gear-menu toggle): when **`useJobModeEnabled`** is `true` and user has not pressed **Show full dashboard**, renders only the tally row + **[`DashboardJobModeCard`](../src/components/jobMode/DashboardJobModeCard.tsx)** + modal layer + a **Show full dashboard** button (full Dashboard always available behind the toggle); reuses **`setLeaveReportJob`** + **`AdditionalReportModal`** so the card's **Leave Report** button drops into the same flow as the existing dashboard surfaces (**`RECENT_FEATURES`** **v2.545**); **Lost bids need a reason** amber banner when **lost** **`bids`** (**`estimator_id`** / **`account_manager_id`**) have blank **`loss_reason`** — deep link **`lostSummary`** / **`lostSummaryTab`** on **Bids** opens **Bid Tabs on Lost** with staff tab (**`RECENT_FEATURES`** **v2.496**); **clock strip** **Assign** uses **`applyOptimisticClockSessionAssign`** (from **`useDashboardMyTeamSectionState`**) for instant job/bid labels, then silent **`loadPending`**; strip scope **Everyone / Organization** (**`readClockStripScopeFromStorage`**, **`stripScopeEligible`**): **Organization** when **`dashboard_clock_strip_scope`** absent (effect persists default; **`RECENT_FEATURES`** v2.429); **Projects** **Assigned** / **Subscribed Stages** collapsible disclosures + region ids (**`RECENT_FEATURES`** v2.427); **Clocked in today** **Mix** (copy job %) + **`clockStripWorkDateYmd`**; **Mix** + **Needs attention** / **Show all** shared chrome (**v2.428**, **`DashboardTeamActiveClockStrip`**); **`openMyTimePreviewFromClock`** → strip **`DashboardMyTimeDayEditorModal`** with **`clockTimesReadOnly`**; **Assigned Jobs** / **Superintendent Jobs** **Send to Billing** outlined vs **Leave Report** primary + **Leave Report** schedule nag (**[`leaveReportScheduleReminder`](../src/lib/leaveReportScheduleReminder.ts)**, **`my_last_report_at`**) (**`RECENT_FEATURES`** v2.409, v2.411); **`helpers`** no **Send to Billing** (**v2.411**); **View Reports** (**[`JobReportsModal.tsx`](../src/components/JobReportsModal.tsx)**) — inline **`ReportDetailBody`** + **`ReportLocationMapsLink`** (**[`ReportViewModal.tsx`](../src/components/ReportViewModal.tsx)**); superintendent **`reports`** RLS/RPC (**`RECENT_FEATURES`** v2.418); **Dispatch / Estimator inbox** cards (**`DispatchInboxSection`**, **`EstimatorInboxSection`**, **`useDispatchInbox`** / **`useEstimatorInbox`**, **`useNarrowViewport640`** — **v2.452**)
- **`src/components/Layout.tsx`** - Nav; right cluster **Task Dispatch** / **Estimator Inbox** / **Task** / **Bid** share **`headerActionButtonBase`** height; **gear** menu **Banking** (v2.380), **Job Mode** toggle with checkbox indicator (gated by **[`canLeaveJobFieldReport(role)`](../src/lib/canLeaveJobFieldReport.ts)** — all 8 roles; persists per-user via **[`useJobModeEnabled`](../src/hooks/useJobModeEnabled.ts)** / **[`jobModeToggle.ts`](../src/lib/jobModeToggle.ts)** `localStorage`; **`RECENT_FEATURES`** **v2.545**); global **[`UserDayScheduleModal`](../src/components/UserDayScheduleModal.tsx)** (**[`UserDayScheduleModalContext`](../src/contexts/UserDayScheduleModalContext.tsx)** provider in [`App`](../src/App.tsx)) — one person’s day schedule from **clock strip** name click: responsive date header, **Dispatch** + **+** + **Close** footer, **prev/next day** on **8 / 12 / 4** marks row above the grey track (**RECENT_FEATURES** v2.399)
- **`src/components/my-time-day-editor/`** - Dashboard **My Time** **Edit time** modal: **Form** vs **Visual** cluster editor (`MyTimeDayClusterForm.tsx`, `MyTimeDayClusterVisual.tsx`, `MyTimeMergeSegmentsModal.tsx`, datetime helpers); timeline **pairwise-overlap** split + Form overlap dividers (**RECENT_FEATURES** v2.289)
- **`src/hooks/useAuth.ts`** - **`AuthProvider`** + **`useAuth()`** context (session and role); [`src/main.tsx`](../src/main.tsx) wraps **`App`** inside **`BrowserRouter`**
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
- **`SALARY_CLOCK_SESSIONS.md`** - Salaried **`salary_schedule`** materialization, split RPCs, sync overlap guards, **continuous** indexed-fragment close (**`20270516120000`**), migrations (no-Docker CLI notes)
- **`TIME_AND_ZONES.md`** - Company **`America/Chicago`** constant (`APP_CALENDAR_TZ`), instants vs naive wall-clock storage, `check:timezone` guardrail
- **`BIDS_SYSTEM.md`** - Bids system documentation (all tabs)
- **`docs/BIDS_TABS_ARCHITECTURE.md`** - Refactor map of `src/pages/Bids.tsx`: per-tab state/memos/handlers/supabase tables, cross-tab coupling, extraction status + recommended extraction order (use when decomposing the Bids God component)
- **`ACCESS_CONTROL.md`** - Complete role permissions matrix
- **`ADDING_A_NEW_ROLE.md`** - Step-by-step guide for adding new roles
- **`EDGE_FUNCTIONS.md`** - Edge Functions API reference
- **`RECENT_FEATURES.md`** - Chronological feature log
- **`TROUBLESHOOTING.md`** - White screen, Supabase, sign-in; **load / outage** links **`docs/runbooks/AGENT_APP_CRASH_INVESTIGATION.md`**, **`SUPABASE_INCIDENT_RUNBOOK.md`**, **`scripts/capture-supabase-incident.sh`**; **Cursor** outage prompts → **[`.cursor/rules/supabase-incident-triage.mdc`](../.cursor/rules/supabase-incident-triage.mdc)** (**`AGENTS.md`** table); client Realtime mitigation **`RECENT_FEATURES.md`** **v2.454**
- **`docs/runbooks/AGENT_APP_CRASH_INVESTIGATION.md`** - AI agent playbook (*find why the app crashed* / 503 / timeouts); then full runbook
- **`docs/runbooks/SUPABASE_INCIDENT_RUNBOOK.md`** - Supabase CLI inspect + Dashboard logs; **`clock_sessions`** / **`jobs_ledger`** correlation (clock-out / Dashboard prompts, **People → Feedback** `?tab=feedback` or Settings dev tools, RLS details): **`RECENT_FEATURES.md`** v2.157 (foundation), **v2.162** (eligibility reset, submission SELECT policy, raw submission names), **v2.290** (Feedback tab, modals, Enabled persist, raw detail modal / CSV)
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

### Supabase load / “crash” investigation

1. **Agents:** start with **`docs/runbooks/AGENT_APP_CRASH_INVESTIGATION.md`** (ordered checklist), then **`docs/runbooks/SUPABASE_INCIDENT_RUNBOOK.md`** for full detail. In **Cursor**, natural-language reports (**Supabase crashed**, **503**, **Postgres slow**) are guided by **[`.cursor/rules/supabase-incident-triage.mdc`](../.cursor/rules/supabase-incident-triage.mdc)** (see **`AGENTS.md`** table).
2. **`docs/runbooks/SUPABASE_INCIDENT_RUNBOOK.md`** — `supabase inspect db … --linked`, Dashboard log export for the same UTC window, and mapping hot queries to `clock_sessions` / `jobs_ledger` triggers.
3. **`TROUBLESHOOTING.md`** — high disk I/O, long queries SQL; links to the runbook.
4. **Client-side mitigation** (Realtime debounce, tab visibility, narrower subscriptions) — **`RECENT_FEATURES.md`** → **v2.454**; **`useDocumentVisibility`** — [`src/hooks/useDocumentVisibility.ts`](../src/hooks/useDocumentVisibility.ts).

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
| Recent changes and features | `RECENT_FEATURES.md` → Chronological updates (e.g. **v2.516** **Jobs** **Stages** **Combine / Separate** — **[`JobsCombineSeparateModal.tsx`](../src/components/jobs/JobsCombineSeparateModal.tsx)** (toolbar **far right**), **`split_job_ledger_fixtures_to_new_job`**; **v2.507** **Bids** **Bid Board** **`compareBidsForBidBoardDueDate`** (unmarked last) + **Win/Loss** save **`insertOutcomeChangeBidNoteAfterSave`** / **`outcomeChangeBidNote.ts`**; v2.500 **Bids** **Pricing** **`GenerateUnitCostModal`** preview (**New row total**, hide redundant **unit** line when non-fixed **count** is **1**, bold **N**); **v2.506** **Banking** **Mercury** **Drag Sort** + **Accounting** — **`MercuryCounterpartyFrequencyModal`** / **`counterpartyFrequenciesAboveMin`** (**Counterparty** header, **3+** occurrences in view); **v2.505**–**v2.503** **Banking** **Mercury** **Accounting** — **`Sorting Ledger (n)`** / counterparty **`(k)`**, **`Search rules…`**, **Name**/**Label** sort (**`sortAccountingRulesForTable`**), **`AccountingRuleFormModal`** **`SearchableSelect`** + **`list_mercury_drag_sort_label_assignment_counts`**; **v2.499** **`bid_count_row_submission_hides`** (Cover Letter / Approval omit, **`duplicate_bid_to_service_type`**); **`GenerateUnitCostModal`** **`unitPriceFromTargetPctOfTotal`**; **`MIGRATIONS.md`** **`20270521120000`**, **`20270521120100`**; v2.498 **Bids** **Bid Board** **`BidBoardBidNumberMark`** — full **`ledger_bid_prefix`** at **`0.7em`**, **`bid_number`** inherited; v2.497 **Dashboard** **Unallocated bank deposits** banner **`canRoleSeeArBankUnallocatedDashboardBanner`** (**dev** + **assistant**; **master_technician** not on Dashboard; Quickfill/route **OrgNudge** unchanged); v2.496 **Dashboard** **Lost bids need a reason** — **`DashboardLostBidsMissingReasonBanner`**, **`lostSummary`** / **`lostSummaryTab`** on **`Bids`**, **`BidBoardLostSummaryModal`** **`initialStaffTabUserId`**; v2.492 **Banking** **Mercury** **Accounting** — **More filters** **Exclude counterparty** (`excludeCounterpartyContains` on **`counterparty_name`**, **`bankingAccountingLedgerFilters.ts`**); v2.487 **Banking** **Mercury** **Accounting** — **Approvals** **Approve all** (bulk confirm pending suggestions); v2.486 **Banking** **Mercury** **Accounting** — **amount** rule **Min**/**Max** normalized to inclusive interval (**`resolveAccountingRuleAmountBounds`**, **`accountingLabelRuleMatch.ts`**); v2.485 **Accounting** tab (**`?tab=accounting`**, **`BankingMercuryAccountingTab.tsx`**, rules / approvals / **`bankingMercuryDragSortLedger`**, **`20260504011219`**); v2.480 **Banking** **Mercury** — **Team notes** **`colSpan`** split (**Counterparty**-aligned content); **`bankingMercuryNotesSubRowColSpan.ts`**; v2.479 **Banking** **Mercury** — **Team notes** band grouping (**divider under** the notes band, tight spacing from summary row), **Drag Sort** **bank \| note** preview; v2.478 **Banking** **Mercury** — **Team notes** editor polish (**Save** closes, **Close** when draft empty, **focus** + auto-grow **textarea**, actions **right**); v2.477 **Banking** **Mercury** — preview org **Transaction note** single-line ellipsis; v2.476 **Banking** **Mercury** — default **note preview** row + **Edit note** / **Hide edit**; v2.475 **Banking** **Mercury** — org **Notes** under **Amount** (no **Notes** column); v2.447 **Job Detail** — **`buildServiceTypeTradePill`** trade pill on **title** row with **Edit**; **Close** in bottom footer; **limited** notices centered; no **Service type** row under **Status**; v2.446 **Job activity / notes** — **Arrived**/**Leaving** stamp toolbar **Job Detail** only (omit **`jobThreadStampActions`** on **`Jobs.tsx`** / **`Workflow.tsx`** **`JobThreadNotesPanel`**); v2.445 **Job activity / notes** — merged Dispatch **`job_schedule_blocks`** notes (**`scheduleBlocksToScheduleActivityItems`**, **`fetchJobScheduleBlocksForJob`**, Realtime **`job_schedule_blocks`**); **Stages Last activity** preview still thread-stats only; v2.444 **Job thread notes** (**`JobThreadNotesPanel`**) — auto-grow composer, activity **`activityListMaxHeight`** scroll snap to newest, **DetailJobModal** outer scroll removed; v2.436 **Edit Job** **Payments received** — **`remove_jobs_ledger_payment_and_reconcile`** RPC (**`MIGRATIONS.md`** **`20260501030427`**; **`GLOSSARY.md`** **Payment unlink**); v2.344 **Edit Job** **Delete** nested **confirm** modal (no **`window.confirm`**); **Collect Payment** **hosted Stripe invoice** + **`update-collect-payment-stripe-customer-email`**; **`complete_job_collect_payment_flow_for_invoice`**; Realtime **`jobs_ledger_invoices`**; **`return_collect_payment_to_dispatch`**; Terminal device Edge functions removed; v2.343 **Collect Payment** Step 1 **Job Book** always on (**search**, collapsible default); **Ready-to-Bill** warning only with no **fixtures**; Step 2 **Call Dispatch** in modal footer; **`JobBookEditorPanel`** **Work** focus + **Cost** select-at-zero; v2.341 Dashboard **Field: Waiting for Approval** — read-only **Line Items** + Stripe invoice match (**`fieldQueueFixtureStripeLineMatch`**, red rows + conditional footer), **Prepare Bill** blue/green, **Add Line Items** → **Edit Job** **Specific Work** highlight (**`fixturesSectionHighlight`**), **`parseStripeInvoiceDetailsResponse`** (**`stripeInvoiceDetailsResponse.ts`**); **Collect Payment** step titles centered; v2.340 Send Back cancels in-progress collect payment flow; v2.339 subcontractor **Collect Payment** field flow (superseded by hosted invoice completion in v2.344) + field queue; v2.338 Dashboard **team Ready to Bill** (`list_ready_to_bill_assigned_jobs_for_dashboard`); **Assigned Jobs** / **Superintendent Jobs** **HCP · name** → **Job Detail**; **Job Detail** **Job Total** hidden for subs; v2.336 Jobs **Stages** **Accounts Receivable** always on (role-only); **`bankPaymentsModalBilledRows`** + **`BankPaymentsModal`** ignore Stages search; **Edit Job** Mercury **Unlink and remove** + payment **Ref** abbrev + copy (**`abbreviatePaymentReference.ts`**); **Memo (optional)** in AR modal; v2.334 **Accounts Receivable Sorting** Mercury filter JSON org-wide in **`app_settings`** (`bank_payments_sorting_config_v1`, dev upsert; **`fetchBankPaymentsSortingConfigFromAppSettings`**, **`resolveBankPaymentsSortingConfigForAr`**); v2.333 **Bank Payments** Kind badges in **`app_settings`** (`bank_payments_kind_badges_v1`, dev-only badge editor, **`bankPaymentsKindBadges.ts`**); v2.332 Dashboard **Unallocated bank deposits** (`count_mercury_transactions_for_bank_payments`, **`useArBankUnallocatedCount`**, **`DashboardArBankUnallocatedBanner`**); Jobs **Bank Payments** AR **counterparty/note** exclusions + **Allocations** layout (picker row, **Amount** row, **Add allocation** footer — **`BankPaymentsModal`**); v2.328 Jobs **Stages** **Billed Awaiting Payment**: **Edit** beside **Open …**; v2.325 **Bill Customer** collapsible **Line on bill** / **Memo**; memo presets via **`normalizePhysicalInvoiceFooterPlainText`** ([`billCustomerMemoPresets.ts`](../src/lib/billCustomerMemoPresets.ts)); **physical invoice** email summary: bold issuer **tagline**, no **Service date** or **Issuer** block ([`buildPhysicalInvoiceEmailBodies`](../src/lib/physicalInvoiceDocument.ts)); v2.321 **Bill Customer** three top tabs (**Stripe bill**, **HouseCall Pro**, **Physical invoice**); v2.320 legacy **`revenue`** → first **Specific Work** row (`20260416182749`); Edit Job **break-off** slider **5%** snap + **`N% of job total`** after **+** (hidden at 100%); v2.314 **Documents** page **Jobs** tab + **+** add Drive links + layout; v2.304 Stripe send confirm modal **Most recent sends** (`jobs_ledger_invoice_stripe_email_sends`); v2.303 Jobs **Stages** **Last activity** Stripe **Resend invoice email**; v2.297 People **Hours** grid blur → **My Time** with **proportional** scale of closed `clock_sessions` (or draft / fetch if open session); v2.291 manual blur draft / **`saveHours(0)`** / **NCNS** off; v2.289 **My Time** overlap split cards + Form chrome + prior-week footer; Quickfill **People Hours (new)** mobile nav; v2.284 Banking **Mercury/Stripe** URL + dev **Invoices/Data** grids; Jobs **Stages** thread-stats debounce/chunks; v2.281 Dashboard **Mix** copy day job % + **My Time** clock preview (**punch** locked); v2.257 linked **job_schedule_blocks** + Dispatch linked copy (`+` on cards); v2.249 salary split sync overlap + clock-in TZ date; v2.231 strip **My Time** from **Jobs worked today** duration; v2.229 salary indexed-slot split + overlap guard; v2.228 Salaried workday UI + continuous sync guard) |
| People **Contracts** (`/people` **Contracts** tab): **search** (person + document names; matching document lines), **templates** (**Manage templates** indented doc lists), **Assign template** modal (**search** + list), **Contract Book** (library **View** / **Edit**; **`update_contract_book_entry`**; save may **`create_pending_contract_versions_after_book_save`** — new **`unsent`** row when latest in lineage is **`signed`**), **lineage** table (**Ver.** = **`lineage_version`**; **`supersedes_person_contract_document_id`**), **Applied version** (optional **`applied_contract_template_document_id`** pin vs max library **`updated_at`**), row **⋯** **Edit**, **Add document** **Upload Signed** vs **Request Signature**, **`person_contract_documents`**, public **`/contract/accept`** (signing UI without **For:** line; thank-you **title-only** + **`pup.jpg`** + **`list_my_contract_dashboard_prompts`** CTA — v2.368) | `RECENT_FEATURES.md` → v2.368, v2.365, v2.355–v2.346; [`People.tsx`](../src/pages/People.tsx); [`ContractBookModal.tsx`](../src/components/contracts/ContractBookModal.tsx); [`ContractAccept.tsx`](../src/pages/ContractAccept.tsx); [`EstimateCustomerThankYou.tsx`](../src/components/estimates/EstimateCustomerThankYou.tsx); [`EDGE_FUNCTIONS.md`](EDGE_FUNCTIONS.md) → **send-contract-for-signature**; `MIGRATIONS.md` → `20260421055733`, `20260421054257` |
| People **Teams** tab (`?tab=teams`): **`team_leader_assignments`** leader→member tree, add/remove links, search; **Leader dashboard** (`full` / `strip_only`) **dev-only** — **[`PeopleTeamsTab.tsx`](../src/components/people/PeopleTeamsTab.tsx)**; same access as Settings **Team Hours Sharing** | `RECENT_FEATURES.md` → v2.424; `ACCESS_CONTROL.md`; `PROJECT_DOCUMENTATION.md` → **`team_leader_assignments`** |
| People **Users** tab: account **`users.notes`** (UI **Full name and title**); **Full name, title, and phone** modal edits **`users.notes`** + **`users.phone`** (roster **`people.notes`** unchanged — v2.398); **Search** hides sections with no matches; single global **No matches.** when none (**v2.443**) | `RECENT_FEATURES.md` → **v2.443**, v2.398; `PROJECT_DOCUMENTATION.md` → §5 People **Users**; `MIGRATIONS.md` → `20260229000004_add_users_notes` |
| Jobs **Crew P&L** / Charges & Value timeline / Job Summary % column | `RECENT_FEATURES.md` → v2.646–v2.656; `GLOSSARY.md` → Charges & Value timeline, Crew P&L, Job Summary % column; kernels [`crewPnlSummary.ts`](../src/lib/crewPnlSummary.ts), [`jobChargesTimeline.ts`](../src/lib/jobChargesTimeline.ts), [`jobSummaryPercentComplete.ts`](../src/lib/jobSummaryPercentComplete.ts) |
| **Merge / archive user accounts** (Active Accounts) | `GLOSSARY.md` → Merge users; `EDGE_FUNCTIONS.md` → merge-users, archive-user; `MIGRATIONS.md` → `20260712190000`; guides `merge-user-accounts.md`, `archive-user-accounts.md` |
| **Documents** (`/documents`) ledgers | `PROJECT_DOCUMENTATION.md` → Documents page; `RECENT_FEATURES.md` → v2.314; [`Documents.tsx`](../src/pages/Documents.tsx); [`documentsPageTab.ts`](../src/lib/documentsPageTab.ts); [`checkGoogleDriveAttachmentUrl.ts`](../src/lib/checkGoogleDriveAttachmentUrl.ts) |
| Bids system | `BIDS_SYSTEM.md` → Complete workflow documentation |
| Edge Functions API | `EDGE_FUNCTIONS.md` → All Edge Functions with examples |
| Migration history | `MIGRATIONS.md` → All migrations by date and category |
| App crash / outage / Supabase load (*find why the app crashed*, 503, DB locks); **Cursor**: natural-language outage triage via **[`.cursor/rules/supabase-incident-triage.mdc`](../.cursor/rules/supabase-incident-triage.mdc)** + **`AGENTS.md`** table | `docs/runbooks/AGENT_APP_CRASH_INVESTIGATION.md` → `SUPABASE_INCIDENT_RUNBOOK.md`; `scripts/capture-supabase-incident.sh`; **`RECENT_FEATURES.md`** → **v2.454** (client Realtime/load mitigation); `AGENTS.md`; `TROUBLESHOOTING.md` |
| Workflow features | `WORKFLOW_FEATURES.md` → Stage management, financials |
| Email templates | `EMAIL_TEMPLATES_SETUP.md`, `EMAIL_TESTING.md` |
| Database improvements | `DATABASE_IMPROVEMENTS_SUMMARY.md` → v2.22 enhancements |
| Supabase disk IO / Materials performance | `RECENT_FEATURES.md` → v2.46; `PROJECT_DOCUMENTATION.md` → Materials Disk IO Optimizations |
| Clock In/Out, pending sessions, pay roster | `RECENT_FEATURES.md` → v2.100; `PROJECT_DOCUMENTATION.md` → Dashboard, Hours tab; `GLOSSARY.md` → Clock Sessions |
| Dashboard "Currently clocked in" strip (Today column; **Everyone / Organization** toggle — **default Organization** when scope unset, **`Dashboard.tsx`** **`readClockStripScopeFromStorage`**; **Currently In** name column min-width for **name + (s)** [v2.400]; **Clocked in today** **Mix** copy job % [v2.281] + **Mix** chrome matches **Show all**/**Needs attention** [v2.428]; merged **Jobs worked today** header single-line scroll ≤640px [v2.429]; **Jobs worked today** **No job or bid** row + duration → strip **Edit time** [v2.367]; missing-report icons stable after approvals (**`jobLedgerIdsForReportsLookupKey`**, **`useDashboardMyTeamSectionState`** — **v2.495**); **Overlap** badge; scope overlay chrome v2.206); tally row **Unallocated bank deposits** on **Dashboard** (**`canRoleSeeArBankUnallocatedDashboardBanner`**, dev + assistant — **v2.497**); tally row **Lost bids need a reason** when **lost** **`bids`** (**estimator** / **account manager**) lack **`loss_reason`** [v2.496]; supply house website in Materials | `RECENT_FEATURES.md` → **v2.497**, **v2.496**, v2.495, v2.429, v2.428, v2.400, v2.367, v2.281, v2.231, v2.163, v2.206; `PROJECT_DOCUMENTATION.md` → Dashboard §8, Materials; `src/pages/Dashboard.tsx`; `src/components/DashboardArBankUnallocatedBanner.tsx`; `src/hooks/useArBankUnallocatedCount.ts`; `src/components/DashboardLostBidsMissingReasonBanner.tsx`; `src/hooks/useDashboardMyTeamSectionState.ts`; `src/components/DashboardTeamActiveClockStrip.tsx`; `src/components/day-job-mix/CopyDayJobMixModal.tsx`; `src/lib/dayJobMixPercentages.ts`; `src/lib/dayJobMixApply.ts` |
| Dashboard **Email schedule** (clock strip): one-off **`schedule_day_email_requests`** → **`schedule-day-email-dispatch`**; **Schedule** vs **Queue soon**; dev **Send to** any non-archived user (**v2.523**); not the same as **Jobs → Reports → Recurring Email Reports** (recurring digests) | `RECENT_FEATURES.md` → **v2.523**, v2.522; `PROJECT_DOCUMENTATION.md` → Dashboard §8, Jobs Reports; `GLOSSARY.md` → **Email schedule (Dashboard)**; `EDGE_FUNCTIONS.md` → **schedule-day-email-dispatch**; `ACCESS_CONTROL.md`; `src/components/ScheduleDayEmailModal.tsx` |
| Dashboard **My Time** / **Edit time** (this-week-only, Form/Visual, merge + job override, `myTimeDayTimeline`; **pairwise overlap** → one timeline card per session; Form overlap **double** border + cluster separators; compact list frame off; prior-week gate footer; **Overlapping clock times** / **Multiple jobs/bids in this span**; coalesced mixed-cluster **Save** per-row **notes** — **`partitionMixedClusterEditorSegmentsToRowNotes`**, **v2.371**; **read-only punch** from **Clock** preview — **`clockTimesReadOnly`**, save on close) | `RECENT_FEATURES.md` → v2.371, v2.289, v2.281, v2.231, v2.193, v2.192, v2.179; `PROJECT_DOCUMENTATION.md` → Dashboard **My Time**; `src/components/DashboardMyTimeSection.tsx`; `src/components/DashboardMyTimeDayEditorModal.tsx`; `src/components/my-time-day-editor/`; `src/lib/myTimeDayTimeline.ts`; `src/lib/myTimeDaySavePlan.ts`; `src/lib/myTimeMixedClusterSingleSegmentPartition.ts` |
| Dashboard **Job Mode** (gear-menu toggle, mobile-first focused view): replaces Dashboard top with **HCP** + **Job Name** + **Address** card and stacked **Leave Report** / **Next Job** buttons; current/next derived from today's **`job_schedule_blocks`** + open **`clock_sessions`** row via pure **[`jobModePickCurrentNext`](../src/lib/jobModePickCurrentNext.ts)** (covers no-clock/no-schedule, on-bid, off-schedule job, last-block, multi-window-same-job); **Next Job** advances via single-line **[`JobModeAdvanceNotesModal`](../src/components/jobMode/JobModeAdvanceNotesModal.tsx)** (**Confirm** / **Skip notes**) calling **`applyUpdateFocusDirect`** on **[`UpdateFocusOpenerBridgeContext`](../src/contexts/UpdateFocusOpenerBridgeContext.tsx)** (registered by **[`ClockInOutButton`](../src/components/ClockInOutButton.tsx)** so insert / salaried-update / hourly close-and-insert all share the same path as **Update Focus**); per-user `localStorage` (**[`jobModeToggle.ts`](../src/lib/jobModeToggle.ts)**, **[`useJobModeEnabled`](../src/hooks/useJobModeEnabled.ts)**); Realtime on **`clock_sessions`** + **`job_schedule_blocks`** (filtered by user + work_date) + midnight rollover; rest of dashboard collapses behind **Show full dashboard** ([`DashboardJobModeCard`](../src/components/jobMode/DashboardJobModeCard.tsx)); gear-menu toggle gated by **[`canLeaveJobFieldReport(role)`](../src/lib/canLeaveJobFieldReport.ts)** (all 8 roles) | `RECENT_FEATURES.md` → **v2.545**; `PROJECT_DOCUMENTATION.md` → Dashboard **Job Mode**; `GLOSSARY.md` → **Job Mode (Dashboard)**; `ACCESS_CONTROL.md` → Dashboard matrix; `src/components/jobMode/DashboardJobModeCard.tsx`; `src/components/jobMode/JobModeAdvanceNotesModal.tsx`; `src/lib/jobModePickCurrentNext.ts`; `src/lib/jobModeToggle.ts`; `src/hooks/useJobModeEnabled.ts`; `src/contexts/UpdateFocusOpenerBridgeContext.tsx`; `src/components/Layout.tsx`; `src/pages/Dashboard.tsx` |
| Dashboard **Clock In** / **Update Focus** / **Review before clock out**: assigned jobs auto-load; **Complete Clock In** empty-notes validation refocuses textarea (**v2.431**); **Update Focus** opens blank notes with focus; keeps hydrated session job/bid selected (**Dispatch**/**Working** highlights; **`showUpdateFocusAssociationChip`** when off pick lists — **v2.431**); job/bid **chip + Clear** — **Clock In** / clock-out typed search (**v2.426** **`associationChipFromSearch`**); **trade** pills on **job** and **bid** unified rows (**`serviceTypeTagForUnifiedRow`**, **`service_type_name`** from **`search_jobs_ledger`** / **`list_assigned_jobs_for_dashboard`** — **v2.433**); **Update Focus** chip also when hydrated association not on quick picks; clock-out **Missing reports from today (click to make report)** (**`AdditionalReportModal`**, **`canLeaveJobFieldReport`**); **View today’s time** clock preview → **My Time** [v2.281]; **no assigned jobs** toast once per modal (v2.191); field borders / focus | `RECENT_FEATURES.md` → **v2.433**, **v2.431**, **v2.426**, v2.281, v2.182, v2.191; `PROJECT_DOCUMENTATION.md` → Dashboard **Clock In/Out**; `src/components/ClockInOutButton.tsx`; `src/contexts/ToastContext.tsx` |
| Settings **Salaried workday** + auto **`salary_schedule`** sessions: UI hints (`formatSalaryBlockEndDisplay`); continuous duplicate INSERT guard (`20270402100000`); **continuous** split fragments close at **`t_end`** (`20270516120000`); indexed-slot split → **`user_punch`** + split overlap guard (`20270403180000`); split sync overlap uses **`work_date`** or clock-in civil date in template TZ (`20270408153000`) | **`SALARY_CLOCK_SESSIONS.md`**; `RECENT_FEATURES.md` → v2.419, v2.249, v2.229, v2.228; `PROJECT_DOCUMENTATION.md` → `clock_sessions`; `MIGRATIONS.md` → `20270516120000`, `20270402100000`, `20270403180000`, `20270408153000`; `SalaryWorkScheduleSettings.tsx`; `salaryScheduleEndTimeDisplay.ts` |
| Job Parts Tally **(/tally)**: Materials estimate + **Transactions** (Mercury card search, note icon, `tallyJobSplits`, `TallyJobTransactionsModal`); **Clock Out** optional [`TallyPreClockOutModal`](../src/components/tally/TallyPreClockOutModal.tsx) + [`MercuryTransactionAllocationsModal`](../src/components/MercuryTransactionAllocationsModal.tsx) (**Transaction's Job Assignment**) | `RECENT_FEATURES.md` → **v2.521**, **v2.520**, **v2.519**, v2.225; `PROJECT_DOCUMENTATION.md` → Jobs §6a; `src/pages/JobTally.tsx`; `src/lib/tallyTransactionSearch.ts`; `src/components/icons/MercuryTransactionNoteIcon.tsx` |
| **Projects** **Job History** tab (`/projects?tab=job-history`, **v2.548**–**v2.553**, renamed from **Job Schedule** in **v2.553**): horizontally-scrollable Gantt of **`jobs_ledger.status = 'working'`** jobs over Chicago calendar days. First tab on the page renamed **Stages → Overview** in **v2.551** (label only — URL param and React state stay `?tab=stages` for back-compat). The **v2.553** rename was deep: all 12 files moved from `ProjectsJobSchedule*` / `projectsJobSchedule*` / `projects_job_schedule_*` to `ProjectsJobHistory*` / `projectsJobHistory*` / `projects_job_history_*` (components, libs, tests, `localStorage` keys for range / layout / only-with-projects, Supabase Realtime channel name, DOM `data-*` attrs, URL `?tab=` value). **Bars** span first approved **`clock_sessions.work_date`** → last approved + closed **`work_date`** (open-ended jobs extend to today with **dashed** right edge); per-day highlights scale with **distinct user count** on a 5-step blue palette (**`peopleCountColor`**) with a numeric badge — each badge is a `<button>` opening **[`ProjectsJobHistoryDayModal`](../src/components/projects/ProjectsJobHistoryDayModal.tsx)** (People & sessions + day cost breakdown + mini-Gantt + reports, **v2.549**). Bar label is a `<button>` positioned **left of the bar** → **Edit Job**; bar background → **Job Detail** (`useJobDetailModal`). **Layout toggle** (**v2.550**, default flipped to **Compact** in **v2.553**): segmented `Expanded | Compact` in the toolbar; Compact packs non-overlapping bars onto shared lanes via [**`packBarsIntoLanes`**](../src/lib/projectsJobHistoryLanePacking.ts) with **label-width-aware** spacing (canvas-measured per bar via `measureLabelWidthPx`, `MAX_LABEL_DAY_COLS = 14`, `LABEL_BREATHING_COLS = 1`), persisted in **`localStorage` `projects_job_history_layout_mode_v1`**. **Toolbar** (**v2.551** reorder + **v2.553** filter): `[ Search ]  [ From ] [ To ]  [ Last 90d ] [ Last 365d ]  [ Expanded | Compact ]` plus an **Only show jobs with projects** checkbox under the search (**v2.553**, `bars.filter(b => b.projectId != null)` applied **before** search so `k of N matches` reflects the same population on screen; persisted under **`projects_job_history_only_with_projects_v1`**; `ProjectsJobHistoryBar` carries `projectId` from `jobs_ledger.project_id`). Search bar (**v2.551**) does case-insensitive substring match across full label / prefix+HCP / raw HCP / job name / address via [**`projectsJobHistoryBarSearch.ts`**](../src/lib/projectsJobHistoryBarSearch.ts) (16 unit tests); placeholder doubles as `N jobs · D days` counter, inline `k of N matches` (`aria-live="polite"`) when active. From / To `<input type="date">` narrowed to `92px` (full `YYYY-MM-DD` value preserved + `title` hover); range default Today − 90d → Today, persisted to **`projects_job_history_range_v1`**; viewport (not a query filter). Realtime: channel **`projects-job-history-${authUserId}`** with **`clock_sessions`** `job_ledger_id=in.(...)` filter (≤ 80 ids) + unfiltered **`jobs_ledger`**, 280 ms debounce, `document.visibilityState === 'visible'` gate. Pure data libs: **[`projectsJobHistoryData.ts`](../src/lib/projectsJobHistoryData.ts)** (20 tests, projectId added in v2.553), **[`projectsJobHistoryLanePacking.ts`](../src/lib/projectsJobHistoryLanePacking.ts)** (21 tests, default `'compact'` in v2.553), **[`projectsJobHistoryBarSearch.ts`](../src/lib/projectsJobHistoryBarSearch.ts)** (16 tests), **[`projectsJobHistoryDayCosts.ts`](../src/lib/projectsJobHistoryDayCosts.ts)** (29 tests); chunked fetcher **[`fetchProjectsJobHistoryClockSessions.ts`](../src/lib/fetchProjectsJobHistoryClockSessions.ts)**; orchestration **[`ProjectsJobHistoryTab.tsx`](../src/components/projects/ProjectsJobHistoryTab.tsx)**; pure presentational **[`ProjectsJobHistoryTimeline.tsx`](../src/components/projects/ProjectsJobHistoryTimeline.tsx)** with shared `JobBarContent` subcomponent | `RECENT_FEATURES.md` → **v2.553**, **v2.551**, **v2.550**, **v2.549**, **v2.548**; `PROJECT_DOCUMENTATION.md` → Projects **Job History Tab**; [`src/pages/Projects.tsx`](../src/pages/Projects.tsx) |
| **Projects** **Forecast** tab (`/projects?tab=forecast`, **v2.554**): forward-looking Gantt of every workflow stage on every project-linked job; driven by **`project_workflow_steps.scheduled_start_date`** / **`scheduled_end_date`** (the **Expected dates** modal added in **v2.552** writes these) plus actual **`started_at`** / **`ended_at`**. Two independent sub-tabs (`?forecastSub=specific|all-stages`, default `specific`). **Specific** — typeahead picks one job (substring on HCP / name / address / project name via **[`projectsForecastJobSearch.ts`](../src/lib/projectsForecastJobSearch.ts)**, 12 unit tests; selection persists to `?forecastJob=` + **`projects_forecast_specific_selected_job_v1`**); stages render as a vertical stack in `sequence_order`, range auto-fits to `[min(start), max(end)] ± 3 days` (override persisted under **`projects_forecast_specific_range_v1`** with **Reset to fit**); click a stage row → opens stage detail modal. **All Stages** — one row per job-with-project (any `jobs_ledger.status`), stages laid out side-by-side horizontally so dispatchers spot crew gaps; default range today − 7d → today + 90d (**`projects_forecast_all_range_v1`**); **Only show jobs with active stages** checkbox (**`projects_forecast_all_active_only_v1`**) filters out jobs whose every stage is `completed` / `approved` / `skipped`. **Pure resolver** **[`projectsForecastStageResolver.ts`](../src/lib/projectsForecastStageResolver.ts)** (`resolveForecastStages(stagesIn, todayYmd)`, 19 unit tests) chains every stage — `start = scheduled_start_date ?? prior.endYmd ?? actual(started_at) ?? todayYmd`, `end = scheduled_end_date ?? actual(ended_at) ?? ymdAddDays(start, 1)` — and flags `isUnscheduled` when all four are absent so the bar renders as a **1-day grey dashed** placeholder at the chained position (never invisible); explicit `skipped` wins over inferred `unscheduled`. **Shared grid** **[`ProjectsForecastTimelineGrid.tsx`](../src/components/projects/ProjectsForecastTimelineGrid.tsx)** is generic over row shape (sticky 2-tier date header, today vertical line, weekend tints, sticky label gutter, `forecastBarColumnSpan` helper). Color palette **[`projectsForecastColors.ts`](../src/lib/projectsForecastColors.ts)** mirrors `getStepStatusStyle` in `Workflow.tsx`. **Realtime** channel **`projects-forecast-${authUserId}`** on `project_workflow_steps` (`workflow_id=in.(...)`, cap 80) + unfiltered `jobs_ledger`, 280 ms debounce + visibility gate. **Permissions** — relies entirely on existing `project_workflow_steps` RLS (dev / master see all; assistant / superintendent via `can_access_project_via_workflow`; subcontractor / helpers see only assigned stages). New files: [`projectsForecastData.ts`](../src/lib/projectsForecastData.ts), [`projectsForecastStageResolver.ts`](../src/lib/projectsForecastStageResolver.ts) + tests, [`projectsForecastColors.ts`](../src/lib/projectsForecastColors.ts), [`projectsForecastJobSearch.ts`](../src/lib/projectsForecastJobSearch.ts) + tests, [`projectsForecastToolbarStyles.ts`](../src/lib/projectsForecastToolbarStyles.ts), [`ProjectsForecastTab.tsx`](../src/components/projects/ProjectsForecastTab.tsx), [`ProjectsForecastSpecificTab.tsx`](../src/components/projects/ProjectsForecastSpecificTab.tsx), [`ProjectsForecastAllStagesTab.tsx`](../src/components/projects/ProjectsForecastAllStagesTab.tsx), [`ProjectsForecastTimelineGrid.tsx`](../src/components/projects/ProjectsForecastTimelineGrid.tsx). Modified: [`Projects.tsx`](../src/pages/Projects.tsx) (added `'forecast'` to `ProjectsPageTab`, parser, third tab button, mount). **v2.559** — Forecast Specific gutter **`%`** column (edit gate **`dragEdit && canAlignStages(myRole)`**; **hide-when-empty** via `showPercentColumn = dragEdit || resolvedBars.some(...) || pendingPercentByStageId.size > 0`; stage detail modal header **`Complete [N] %`**; Workflow expanded **`Complete: [ N ] %`**). Shared **[`parsePercentCompleteInput.ts`](../src/lib/parsePercentCompleteInput.ts)** (14 tests; **`0` → null**). **v2.562** — gutter commits use optimistic **`pendingPercentByStageId`** + **`refreshStages()`** + blur-on-Edit-exit for focused gutter inputs (`data-forecast-pct="true"`).

**v2.560** — Forecast Specific dense calendar is anchored to **today** with a 180-day window centered on it (`[today − 90, today + 90]`) instead of the resolved-bar envelope, and grows in 90-day chunks via in-line `←` / `→` pillar columns sitting AT the rail's start / end as inline-flex siblings of the day-grid block inside the scroller (visible only when the user has scrolled all the way to the corresponding edge — `... | 22 | 23 | 24 | →`, no day cells obscured). Resets to the default window on every job switch (no persistence). Toolbar `Today` button (left of `Edit`, gated on `hasJob && showDates`) re-applies the reset on demand via a `todayResetTick` counter composed into `autoCenterTodayResetKey`. New helper [`src/lib/projectsForecastSpecificWindow.ts`](../src/lib/projectsForecastSpecificWindow.ts) with `computeForecastSpecificDefaultWindow` / `computeForecastSpecificEffectiveWindow` (only-grow guard) / `extendForecastSpecificWindowLeft` / `extendForecastSpecificWindowRight` + 13 unit tests. `ProjectsForecastTimelineGrid` wrapped in `forwardRef`, exposes `ForecastTimelineGridHandle { adjustScrollLeftByPx(deltaPx) }` (used by `←` clicks to preserve visual position; `→` clicks need no adjustment because new columns appear off-screen to the right), gains optional `onPanLeft` / `onPanRight` / `panLeftLabel` / `panRightLabel` / `autoCenterTodayResetKey` (when provided, auto-center fires only on key change so pan clicks don't yank the scroll back to today). `ProjectsForecastSpecificTab` adds two pan-override states + a grid handle ref + a `pendingScrollIntentRef` + a `useLayoutEffect` keyed on `denseDayKeys.length` that snaps scroll to the freshly-loaded edge; the `selectedJobId`-reset effect clears both pan overrides. Dead code dropped: `SHOW_DATES_TRAILING_DAYS`, `denseEnvelope` memo, `resolvedStagesEnvelope` import, `ymdAddDays` import. Sparse mode unchanged — no day rail, no pillars. All Stages unchanged — both opt-in props omitted. Backed by new **`project_workflow_steps.percent_complete`** INT 0-100 nullable (migration **`20260519214147_add_percent_complete_to_project_workflow_steps.sql`**). Uncontrolled `<input type=number>` re-keyed off the persisted value; `e.stopPropagation()` keeps typing from opening the stage detail modal; commits via `withSupabaseRetry(supabase.from('project_workflow_steps').update({ percent_complete: next }))` with toast on failure. `labelGutterWidth` bumped 260 → 300 on both grids to fit. Both grids got opt-in `gutterHeader?: ReactNode` prop (default = empty spacer so **All Stages stays unchanged** — column does NOT render there). `ResolvedStageBar.percentComplete: number | null` plumbed end-to-end through the resolver (+3 tests). Shared helper **[`parsePercentCompleteInput.ts`](../src/lib/parsePercentCompleteInput.ts)** (14 tests; empty / non-numeric / **explicit `0` (and anything that clamps or rounds to 0 — negatives, `0.4`) → null** so typing `0` clears the cell; > 100 clamps; fractionals rounded) used by gutter, modal header, and Workflow expanded card | `RECENT_FEATURES.md` → **v2.562**, **v2.560**, **v2.559**, **v2.554**, **v2.552**; `PROJECT_DOCUMENTATION.md` → Projects **Forecast Tab**; `GLOSSARY.md` → **Forecast tab (Projects)**, **Stage / Step** (Expected dates, Percent complete); `MIGRATIONS.md` → **`20260519214147_add_percent_complete_to_project_workflow_steps.sql`**; [`src/lib/parsePercentCompleteInput.ts`](../src/lib/parsePercentCompleteInput.ts); [`src/components/projects/ProjectsForecastSpecificTab.tsx`](../src/components/projects/ProjectsForecastSpecificTab.tsx); [`src/components/projects/ProjectsForecastSpecificStageModal.tsx`](../src/components/projects/ProjectsForecastSpecificStageModal.tsx); [`src/pages/Projects.tsx`](../src/pages/Projects.tsx) |
| **Workflow** stage cards (`/workflows/:projectId`, **v2.552**): assignees render as **name only** styled as a blue underline button → opens **Person contact info** modal (email + phone + User/Guest chip; reuses the existing `contacts` map, no new query); `PersonContactInfo` + `PersonDisplayWithContact` in **[`Workflow.tsx`](../src/pages/Workflow.tsx)**. **Tech notes** / **Office notes** disclosures default to **collapsed** when the corresponding `notes` / `private_notes` field is empty / whitespace-only (`isSectionDefaultExpanded(step, section)`), expanded when content exists. **Expected dates** — every stage card shows an `Expected:` line below the actual Start / End row backed by **`project_workflow_steps.scheduled_start_date`** / **`scheduled_end_date`**. Expanded view: `Expected: Start [MM/DD/YYYY] · End [MM/DD/YYYY]` (each date a clickable button; `Start set` / `End set` when unset). Collapsed view: `Exp: MM/DD → MM/DD`. Click opens the **Expected dates** modal with two `<input type="date">` fields + a **Duration (days)** field that auto-computes the missing date from the other two (start ↔ end ↔ duration). **Cascade rule**: when the next stage's `scheduled_start_date` is null, it defaults to the prior stage's `scheduled_end_date` (defaults-only — explicit downstream choices never get silently overwritten). Pure helpers `ymdFromDateLike` + `formatScheduledDateShort` in `Workflow.tsx`, reusing `ymdAddDays` / `ymdDaysBetween` from `src/utils/dateUtils.ts`. These columns feed the **Forecast** tab (**v2.554**). **v2.559** — new **`Complete: [ N ] %`** row directly under the Expected dates row inside every expanded stage card; edit gate `canManageStages || s.assigned_to_name === currentUserName` so assignees can update their own % progress without manager rights. Backed by new **`project_workflow_steps.percent_complete`** INT 0-100 nullable (migration **`20260519214147_add_percent_complete_to_project_workflow_steps.sql`**, CHECK 0-100). Uncontrolled `<input>` re-keyed off persisted value; Enter blurs to commit; parses through shared **[`parsePercentCompleteInput.ts`](../src/lib/parsePercentCompleteInput.ts)** (empty → null, **explicit `0` (and anything that clamps or rounds to 0 — negatives, `0.4`) → null**, clamp 0-100, round fractionals). New `updatePercentComplete(step, value)` mirrors `submitExpectedDates` (Supabase update + error toast + optimistic `setSteps`). Same field is editable from the Forecast Specific gutter **`%`** column and stage detail modal header — **v2.562** adds optimistic **`pendingPercentByStageId`** + **`refreshStages()`** + blur-on-Edit-exit for gutter commits | `RECENT_FEATURES.md` → **v2.562**, **v2.559**, **v2.554**, **v2.552**; `PROJECT_DOCUMENTATION.md` → Workflow Management → Person Assignment + Step Status Actions (Expected dates), **Forecast Tab**; `GLOSSARY.md` → **Stage / Step** (Expected dates, Percent complete); `MIGRATIONS.md` → **`20260519214147_add_percent_complete_to_project_workflow_steps.sql`**; [`src/lib/parsePercentCompleteInput.ts`](../src/lib/parsePercentCompleteInput.ts); [`src/pages/Workflow.tsx`](../src/pages/Workflow.tsx) |
| Jobs **Stages** + Workflow linked jobs: **thread notes**, merged **`job_schedule_blocks`** notes (**read-only Schedule rows**, **`jobThreadScheduleActivity.ts`**, **v2.445**, Realtime **`job_schedule_blocks`**), **Last activity** preview (thread-stats only — schedule notes excluded), composer **Enter** / **Shift+Enter**, **Arrived** / **Leaving** stamps **Detail** modal only (**v2.446**, **`submitStamp`**, **`jobThreadNoteStampBody.ts`**), activity **scroll-to-newest** (**`activityListMaxHeight`**), composer **auto-grow**; **Job Detail** header trade pill + bottom **Close** (**v2.447**, **`buildServiceTypeTradePill`**); **Last activity** Stripe **emailed customer** + **Resend invoice email** when one billed Stripe line has **`sent_to_customer_at`** (`StripeInvoiceSendFromStripeButton`, **`send-stripe-invoice`**); **Billed Awaiting Payment**: **Edit** beside **Open …** (`editJobIconBesideTimeOpen` in **`renderUnifiedStagesTable`**, `RECENT_FEATURES` v2.328); **Bank payments** / **Accounts Receivable Sorting** (org-wide **`app_settings`** **`bank_payments_sorting_config_v1`**, v2.334; counterparty/note **exclude** lists); **Kind** badges **`app_settings`** (`bank_payments_kind_badges_v1`, v2.333); **Accounts Receivable** **`bankPaymentsModalBilledRows`** (**`buildJobsStagesBoardLists(jobs, '').billedRows`**, v2.336); **Bank Payments** **Allocations** layout (picker + **Remove**, **Amount** row, **Add allocation** footer; **Memo (optional)**); **Edit Job** Mercury unlink frees deposit capacity via **`remove_jobs_ledger_payment_and_reconcile`** (v2.436); Dashboard **Unallocated bank deposits** (`count_mercury_transactions_for_bank_payments`, **`DashboardArBankUnallocatedBanner`**, **`useArBankUnallocatedCount`**); `jobs_ledger.stage_notes` removed; **Stages** thread-stats: **chunk 200**, generation guard, **320ms** debounce; narrow **`loadJobs`** reload on **`customer`** query param | `RECENT_FEATURES.md` → **v2.447**, **v2.446**, **v2.445**, v2.444, v2.436, v2.336, v2.334, v2.333, v2.332, v2.331, v2.330, v2.328, v2.303, v2.284, v2.183–v2.185; `PROJECT_DOCUMENTATION.md` → Jobs §6, Dashboard, §15 Banking; `MIGRATIONS.md` → `20260501030427_remove_jobs_ledger_payment_and_reconcile.sql`, `20260330023918`, `20260418061005`, `20260418063154`, `20260418073359`, `20260418074400`; `src/lib/serviceTypeTradePill.ts`; `src/lib/jobThreadScheduleActivity.ts`; `src/lib/jobThreadActivitySort.ts`; `src/lib/jobThreadNoteStampBody.ts`; `src/components/JobThreadNotesPanel.tsx`; `src/components/jobs/DetailJobModal.tsx`; `src/components/jobs/BankPaymentsModal.tsx`; `src/lib/bankingSortingConfig.ts`; `src/lib/bankPaymentsKindBadges.ts`; `src/lib/appSettingsKeys.ts`; `src/components/DashboardArBankUnallocatedBanner.tsx`; `src/hooks/useArBankUnallocatedCount.ts`; `src/components/jobs/StripeInvoiceSendFromStripeButton.tsx`; `src/hooks/useJobThreadNotes.ts`; `src/hooks/useJobThreadNotesForModal.ts`; `src/pages/Jobs.tsx`; `src/pages/Workflow.tsx`; `src/pages/Dashboard.tsx` |
| **Banking** (`/banking`): Mercury **Ledger** / **User Sort** / **Drag Sort** (**`tab=drag_sort`** — **Accounting Labels** sidebar + **Accounting Label** ledger column; org-wide Drag Sort labels + assignments + **built-in Schedule C defaults** (**`dragSortDefaultLabels`**, **v2.471**), optional **Schedule C line** + **description**, section **Collapse** / **Expand** for all label cards (**v2.474**), **v2.473** Equipment Lease / Property Lease built-ins, DnD + **v2.472** optimistic counts / memo rows / snappy overlay DnD, **v2.470**; **Quick label** fullscreen modal [**`BankingMercuryDragSortFocusModal.tsx`**](../src/components/banking/BankingMercuryDragSortFocusModal.tsx) + **`DragSortLabelBucketCard`** (**v2.481**–**v2.484**): one-at-a-time queue, **Undo** (two picks, **`v2.483`**), **`Search labels…`** beside **`Remaining unlabeled`**, compact transaction preview + grid title-row stats (**`v2.484`**), **`labelsCardsExpanded`** parity (**`v2.482`**)); **Counterparty** header **Counterparty frequency** modal (**v2.506**, [**`MercuryCounterpartyFrequencyModal.tsx`**](../src/components/banking/MercuryCounterpartyFrequencyModal.tsx), **`counterpartyFrequenciesAboveMin`**); **Accounting** tab (**`tab=accounting`**) — **Sorting Ledger** **`Sorting Ledger (n)`** + **Counterparty** **`Name (k)`** (**v2.503**, [**`bankingMercuryCounterpartyFrequency.ts`**](../src/lib/bankingMercuryCounterpartyFrequency.ts); **Accounting** modal copy includes **Search** + **More filters** + **Hide labeled**); **More filters** (**Sorting Ledger filters** modal; **v2.489**–**v2.492**, [**`bankingAccountingLedgerFilters.ts`**](../src/lib/bankingAccountingLedgerFilters.ts), [**`BankingMercuryAccountingLedgerFilterModal.tsx`**](../src/components/banking/BankingMercuryAccountingLedgerFilterModal.tsx): posted date, amount, **`kinds`**, **Exclude counterparty** **`excludeCounterpartyContains`**); **Rules** **`Search rules…`** (**v2.504**) + **Name**/**Label** header sort (**v2.505**, [**`sortAccountingRulesForTable`**](../src/lib/accountingRulesTableSearch.ts)); **New/Edit rule** [**`AccountingRuleFormModal.tsx`**](../src/components/banking/AccountingRuleFormModal.tsx) **`SearchableSelect`** + **`list_mercury_drag_sort_label_assignment_counts`** (**`20260505231245`**); rules / **Approvals** (**Approve all** **v2.487**) / read-only ledger [**`BankingMercuryAccountingTab.tsx`**](../src/components/banking/BankingMercuryAccountingTab.tsx), [**`accountingLabelRuleMatch.ts`**](../src/lib/accountingLabelRuleMatch.ts) (**`resolveAccountingRuleAmountBounds`** **v2.486**), shared [**`bankingMercuryDragSortLedger.tsx`**](../src/components/banking/bankingMercuryDragSortLedger.tsx) (**v2.485**–**v2.487**, **`20260504011219`**); **v2.480** — **Team notes** preview/editor **`colSpan`** aligns with **Counterparty** (**`bankingMercuryNotesSubRowColSpans`**); **v2.479** — **Team notes** layout: **divider under** the notes band, minimal gap vs summary row; **Drag Sort** read-only **bank \| note** line when **`mercuryBankDescriptionFromRaw`** applies; **v2.478** — **auto-grow** org field, **Save** closes editor, **Close** when empty, actions **right**; **v2.477** — org note preview **single line** + ellipsis; **v2.476** — transaction **note preview** row + **Edit note** / **Hide edit**; **v2.475** — org team notes control under **Amount**, no **Notes** column + User Sort header tools (**Config**, **User Card Link**, **Nicknames**); toolbar **search** + **Refresh** / **Reload**; **`auto_assign_user_id`** on card links — **v2.401**; dev **Stripe** **Invoices** & **Data**; **`product`/`tab`** query params; per-user **`banking_sorting_config_v1_*`**; Jobs **AR** filter **`app_settings`** **`bank_payments_sorting_config_v1`** (**v2.334**) | `RECENT_FEATURES.md` → **v2.505**, **v2.504**, **v2.503**, **v2.492**, **v2.490**, **v2.489**, **v2.487**, **v2.486**, **v2.485**, **v2.484**, **v2.483**, **v2.482**, **v2.481**, **v2.480**, **v2.479**, **v2.478**, **v2.477**, **v2.476**, **v2.475**, **v2.474**, **v2.473**, **v2.472**, v2.471, v2.470, v2.467, v2.401, v2.334, v2.330, v2.284; `PROJECT_DOCUMENTATION.md` → §15; `GLOSSARY.md` → **Accounting Label**, **Accounting rules**, **Mercury organization notes**; `ACCESS_CONTROL.md`; `MIGRATIONS.md` → **`20260504011219_mercury_accounting_label_rules_and_suggestions.sql`**, **`20260505231245_list_mercury_drag_sort_label_assignment_counts.sql`**, **`20260502202929_rename_drag_sort_rent_lease_builtin_names.sql`**, **`20260502193138_mercury_drag_sort_label_system_defaults.sql`**, **`20260502191955_mercury_drag_sort_labels_schedule_c.sql`**, **`20260502183057_mercury_drag_sort_labels.sql`**, `20270410130300`, `20260424161028_mercury_debit_card_auto_assign_user.sql`, **`20260502232908_mercury_transaction_org_notes.sql`**; `src/lib/bankingSortingConfig.ts`; `src/lib/bankingMercuryNotesSubRowColSpan.ts`; [`src/lib/bankingAccountingLedgerFilters.ts`](../src/lib/bankingAccountingLedgerFilters.ts); [`src/lib/bankingMercuryCounterpartyFrequency.ts`](../src/lib/bankingMercuryCounterpartyFrequency.ts); [`src/lib/accountingRulesTableSearch.ts`](../src/lib/accountingRulesTableSearch.ts); [`src/components/banking/BankingMercuryAccountingLedgerFilterModal.tsx`](../src/components/banking/BankingMercuryAccountingLedgerFilterModal.tsx); `src/pages/Banking.tsx`; `src/components/banking/BankingMercuryDragSortTab.tsx`; [`src/components/banking/BankingMercuryDragSortFocusModal.tsx`](../src/components/banking/BankingMercuryDragSortFocusModal.tsx); [`src/components/banking/dragSortLabelBucketCard.tsx`](../src/components/banking/dragSortLabelBucketCard.tsx); [`src/components/banking/BankingMercuryAccountingTab.tsx`](../src/components/banking/BankingMercuryAccountingTab.tsx); [`src/components/banking/AccountingRuleFormModal.tsx`](../src/components/banking/AccountingRuleFormModal.tsx); [`src/lib/accountingLabelRuleMatch.ts`](../src/lib/accountingLabelRuleMatch.ts); [`src/components/banking/bankingMercuryDragSortLedger.tsx`](../src/components/banking/bankingMercuryDragSortLedger.tsx); [`src/components/banking/MercuryCounterpartyFrequencyModal.tsx`](../src/components/banking/MercuryCounterpartyFrequencyModal.tsx); `src/components/BankingUserCardLinkModal.tsx`; `src/components/BankingStripeInvoicesPanel.tsx`; `src/components/BankingStripeWebhookEventsPanel.tsx`; `src/components/banking/MercuryTxNotesDisclosure.tsx` |
| **Schedule** planned blocks: **`job_schedule_blocks`**, Dispatch week hub/grid, **Linked** crew rows (**`shared_block_group_id`**, **+ → Linked copy** on job/hub cards, group edit); **Not coming in today** mark / show / undo lifecycle on Hub + JobWeek cells (chip + RPC `pay_staff_remove_not_coming_in_for_user_day`) | `RECENT_FEATURES.md` → **v2.535**, v2.257, v2.256, v2.255, v2.254; `GLOSSARY.md` → **Not coming in (Schedule Dispatch)**, Job schedule blocks; `MIGRATIONS.md` → **`20260515233801`**, `20260407033913`, `20260407052651`, `20260407061043`; `src/lib/jobScheduleBlocks.ts`; `src/lib/userTimeOffByCell.ts`; `src/lib/notComingInTimeOff.ts`; `src/pages/ScheduleDispatch.tsx`; `src/components/schedule/ScheduleDispatchGrid.tsx`; `src/components/schedule/ScheduleDispatchTimeOffChip.tsx`; `src/components/schedule/ScheduleDispatchUndoNotComingInModal.tsx`; `src/components/jobs/ScheduleJobModal.tsx` |
| Ready to Bill **customer gate** + **Edit Job** billing highlight; **`get_jobs_ledger_by_status.customer_id`**; RTB **Job: Send Job Back** / **Delete draft bill**; Edit Job **Ready to Bill** (**Preview / Stripe bill…**, **See in Stages**); **Outstanding billing** / **Payments received** / **Partial invoice** layout (`RECENT_FEATURES` v2.285); **Payments received** remove paths — **`remove_jobs_ledger_payment_and_reconcile`** (`RECENT_FEATURES` v2.436; **`MIGRATIONS.md`** **`20260501030427`**); **`BillCustomerModalProvider`**, **`preview-stripe-invoice`**, **`StripeBillPreSubmitPreview`**; Stripe **multi-line** from **`jobs_ledger_fixtures`** when **Line on bill** blank; **v2.527** **`invoice_items`** **`sequence_order`** asc (**`stripeInvoiceItemsFromFixtures.ts`**); **v2.528** staff **`lines`** (**`stripeInvoiceLinesDataForFixtureOrderDisplay`**, **`stripeInvoiceLinesForFixtureOrderDisplay.ts`**) ↔ **invoice.stripe.com** on **preview** / **`invoice_preview`** / **`get-stripe-invoice-details`** (`EDGE_FUNCTIONS.md`); Edit Job Specific Work **(n/500)** + scope disclosure (`v2.313`); **Partial invoice** break-off track **5%** snap + **`N% of job total`** after **+** (`v2.320`); **Bill Customer** modal top tabs **Stripe** / **HouseCall Pro** / **Physical invoice** (`v2.321`); collapsible **Line on bill** / **Memo** + memo preset normalization + **physical** email summary (`v2.325`); **fully invoiced** job → **`billed`** via **`maybePromoteJobToBilledAfterCustomerInvoice`** after **Stripe** / **HCP** / **Physical** success — **`promoteJobToBilledIfFullyInvoiced.ts`**, **`jobBillingUnallocatedDollars`** (`v2.366`; Edge **`send-physical-invoice-email`** does not **`update_job_status`**) | `RECENT_FEATURES.md` → **v2.528**, **v2.527**, v2.366, v2.325, v2.321, v2.320, v2.313, v2.285, v2.283, v2.190; `PROJECT_DOCUMENTATION.md` → Jobs §6, Dashboard; `MIGRATIONS.md` → **`20260501030427_remove_jobs_ledger_payment_and_reconcile.sql`**, `20260330065236`, `20260416182749_migrate_legacy_revenue_to_first_fixture.sql`; `EDGE_FUNCTIONS.md` → **create-stripe-invoice**, **preview-stripe-invoice**, **get-stripe-invoice-details**, **send-physical-invoice-email**; `src/contexts/BillCustomerModalContext.tsx`; `src/pages/Jobs.tsx`; `src/pages/Dashboard.tsx`; `src/components/jobs/SendRecordInvoiceModal.tsx`; `src/components/jobs/JobFormModal.tsx`; `src/lib/promoteJobToBilledIfFullyInvoiced.ts`; `src/lib/stripeInvoiceLineDescription.ts`; `src/lib/billCustomerMemoPresets.ts`; `src/lib/physicalInvoiceDocument.ts`; `supabase/functions/_shared/stripeInvoiceItemsFromFixtures.ts`; `supabase/functions/_shared/stripeInvoiceLinesForFixtureOrderDisplay.ts` |
| Jobs **Edit Job** billing: **Job Total** and payment **Amount** comma formatting | `RECENT_FEATURES.md` → v2.181; `PROJECT_DOCUMENTATION.md` → Jobs §6; `src/pages/Jobs.tsx`; `src/components/MoneyDecimalAmountInput.tsx` |
| Workflow **line items**: optional **`item_date`**; **Add Line Item** clipboard bulk import | `RECENT_FEATURES.md` → v2.181; `WORKFLOW_FEATURES.md` → Line Items For Office; `PROJECT_DOCUMENTATION.md` → workflow_step_line_items; `MIGRATIONS.md` → 20270329210000; `src/lib/parseWorkflowLineItemPaste.ts`; `src/pages/Workflow.tsx` |
| Clock sessions table UX, My Roles Goals gate, `user_dashboard_goals` / `user_daily_goals_ack` | `RECENT_FEATURES.md` → v2.149; `PROJECT_DOCUMENTATION.md` → Dashboard, People, Quickfill, Settings; `MIGRATIONS.md` → 20260329120000; `GLOSSARY.md` → Clock Sessions, My Roles Goals |
| Settings: Sharing and Adoption under **People & accounts** (`settings-people`); no `settings-sharing` jump | `RECENT_FEATURES.md` → v2.165; `PROJECT_DOCUMENTATION.md` → Settings §9; `ACCESS_CONTROL.md` → Settings matrix |
| People **Payroll** (`?tab=pay_stubs`; UI **Payroll**): **Less** + **Additional** (`pay_stub_additional_lines`, qty×rate; **prevailing wage** + **`source_clock_session_id`**, human **`description`**; **`stripPrevailingWageTag`** for legacy **`[pw:uuid]`** — v2.345) + **Net Pay** (gross − Less + Additional); full-width ledger name search; **Partial** installments (`pay_stub_payments`) vs net; Paid to date / Balance; **Record payment** (single amount, capped at balance, optional **employee credit** for overage); **Draft Payroll** prior week + crew merge (**v2.514**: **Cash Due**, grey **View**, **Hours** breakdown modal, **Print** week + paid summary, **dev** delete in modal — **`DraftPayrollModal.tsx`**, **`DraftPayrollPersonHoursBreakdownModal.tsx`**, **`draftPayrollPersonBreakdown.ts`**, **`payReportAssignmentsBreakdown.ts`**); **`person_offsets.employee_credit`**; per-row delete in payment detail; **Print** in row; dev trash delete | `RECENT_FEATURES.md` → **v2.514**, v2.345, v2.330, v2.252, v2.170, v2.172, v2.173, v2.174; `PROJECT_DOCUMENTATION.md` → People; `MIGRATIONS.md` → `20260420051645`, `20270408163000`; `GLOSSARY.md` → person_offsets, pay_stub_payments, pay_stub_deductions, pay_stub_additional_lines; `src/pages/People.tsx`; `src/lib/payStubPayments.ts`; `src/lib/payStubDeductions.ts`; `src/lib/payStubPrevailingWageLine.ts`; `src/components/pay/PayStubLessModal.tsx`; `src/components/pay/PayStubAdditionalModal.tsx`; `src/components/pay/PayStubDeleteIcon.tsx`; `src/components/pay/DraftPayrollModal.tsx`; `src/components/pay/DraftPayrollPersonHoursBreakdownModal.tsx`; `src/components/pay/PersonOffsetFormModal.tsx` |
| People Hours: **`PeopleHoursDashboardClockStrip`** (**`DashboardTeamActiveClockStrip`**, **`dashboard_clock_strip_scope`**, **`peopleHoursClockStripSelectedDay`** day nav — **v2.453**) above Hours chrome; **v2.455** — **Pay** merged into **Hours** (**`#cost-matrix`**, **`?section=rejected`**); **v2.495** — **`people-hours-sections-nav`** section chips **first** below pay toolbar (**`jumpToHoursTabSection`** / **`HoursTabCollapsibleSectionId`**); **Week range** always visible (**`people-hours-week`**, flat chrome, never collapsible, no bordered card shell); Audit modal edit mode, shared clock split/create modal, **Highlight by job**; manual grid blur → **My Time** proportional scale or draft (`peopleHoursProportionalScale.ts`, `peopleHoursManualDraftSession.ts`); **v2.533** — amber **`! n`** badge on cells where **pending closed clock sessions > `people_hours`** (Draft Payroll undercount), popover **Approve all (n)** + per-row reject (**`PeopleHoursPendingCellPopover`**), week-strip roll-up banner + **`PeopleHoursBulkApprovePendingModal`**, day-column dot + person-row **`+X.XX pending`** subline; pure helpers **`peopleHoursPendingByCell.ts`** (15 unit tests); plus **`DashboardMyTimeDayEditorModal.requestClose`** **`draftClusterIds`** so empty-cell drafts persist on Close even without a job; **v2.537** — grid cell display sum (**`sumClosedPendingClockHoursForCell`**) and cost-matrix **Unapproved** column (**`pendingUnapprovedCountsByWorkDate`**) now also filter **`rejected_at \|\| revoked_at`** so revoked rows drop off as soon as **`revoke_clock_sessions`** subtracts the hours; new Quickfill **Unassigned field time** section (**`peopleHoursUnallocatedRows.ts`**, **`QuickfillUnassignedFieldTimeSection.tsx`**, dev / master / assistant) with **Open day audit** mounting **`PeopleHoursDayAuditModal`**, which now shows a read-only **Dispatch** panel (**`usePersonDayScheduleData`** + **`QuickfillScheduleUserRow`**), per-row **Approved** / **Pending** / **Open** badge + inline **Approve** button → **`approveClockSessions`**, and a pending-approval banner with **Approve all (N)** when no crew assignments exist but pending sessions link to a job/bid; merged job/bid search shows **trade** pills on jobs (**`RECENT_FEATURES`** **v2.433**) | `RECENT_FEATURES.md` → **v2.537**, **v2.533**, **v2.495**, **v2.455**, **v2.453**, **v2.433**, v2.297, v2.291, v2.171; `PROJECT_DOCUMENTATION.md` → People §5 Hours; `GLOSSARY.md` → **Clock Sessions / Pending Clock Sessions**; `ACCESS_CONTROL.md`; `src/components/people/PeopleHoursDashboardClockStrip.tsx`; `src/components/people/PeopleHoursPendingCellPopover.tsx`; `src/components/people/PeopleHoursBulkApprovePendingModal.tsx`; `src/lib/peopleHoursPendingByCell.ts`; `src/lib/peopleHoursUnallocatedRows.ts`; `src/lib/dashboardClockStripScopeStorage.ts`; `src/lib/peopleHoursClockStripSelectedDay.ts`; `src/lib/approveClockSessions.ts`; `src/components/PeopleHoursDayAuditModal.tsx`; `src/components/quickfill/QuickfillUnassignedFieldTimeSection.tsx`; `src/components/ClockSessionEditSplitModal.tsx`; `src/components/DashboardMyTimeDayEditorModal.tsx`; `src/pages/People.tsx`; `src/pages/Quickfill.tsx` |
| Checklist (multi-assignee, links, Today/History/**Review**/Manage/**Roadmap**; header **Task** / Dispatch / Estimator for **subcontractor**/**helpers**/**estimator** **v2.450**; **Manage** search title/assignee **v2.416**; **Roadmap** — multi-roadmap + members **v2.408**, graph **`ChecklistTechTreeTab`**, **`ChecklistTechTreeRoadmapBar`**, **`ChecklistTechTreeRoadmapMembersModal`**, **`ChecklistTechTreeMapActionIconButtons`**, canvas full-screen + exit **v2.407**) | `RECENT_FEATURES.md` → **v2.450**, v2.416, v2.408, v2.407, v2.380, v2.107, v2.109; `MIGRATIONS.md` → **`20270519120000_subcontractor_helpers_estimator_checklist_task_definitions.sql`**, **`20260501205038_fix_checklist_items_rls_recursion.sql`**, **`20270427120000_checklist_tech_tree_multi_roadmap.sql`**; `ACCESS_CONTROL.md`; `PROJECT_DOCUMENTATION.md` → Key Features; `GLOSSARY.md` → Checklist / Roadmap; `src/pages/Checklist.tsx`; `src/lib/headerTaskDispatchEstimatorEligible.ts`; `src/components/checklist/ChecklistTechTreeTab.tsx` |
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
- **PO Generator ledger**: **`material_po_generator_entries`** — unique shop-style **PO codes** (10000–99999) tied to a job and user; optional **supply house**. **Supply Houses** invoice **Purchase Order #** can warn when a parsed code is missing from the visible ledger (**house** or **null** **`supply_house_id`**). **`parsePoGeneratorCodeFromPurchaseOrderName`** ignores **`NNNNN-N`** shop suffixes.
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
3. **Update types after schema changes**: `npm run gen-types:local` or `npm run gen-types:linked`; CLI **stderr** goes to the terminal (not into **`database.ts`** with a plain **`>**` redirect). See **`AGENTS.md`**.
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
