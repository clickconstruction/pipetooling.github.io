# Jobs Tabs Architecture Map

---
file: docs/JOBS_TABS_ARCHITECTURE.md
type: Engineering / Refactor Map
purpose: Step-0 map for the Jobs.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md) — inventory what every tab of src/pages/Jobs.tsx touches (state, loaders, handlers, memos, sub-components, supabase tables/RPCs, cross-tab coupling) to drive the multi-PR extraction, with the Stages board and the job-mutation engine mapped in depth.
audience: Developers, AI Agents
last_updated: 2026-07-20
---

## Overview

[`src/pages/Jobs.tsx`](../src/pages/Jobs.tsx) is a ~10,103-line "God component" (as of v2.820: 164 `useState` declarations, 57 `useEffect`, 25 `useMemo`, 26 `useCallback`, ~19 refs). It already shrank from ~15k through ad-hoc extractions **without** a Step-0 map — six tabs are thin(ish) wrappers today, but the remaining inline mass is concentrated in one place: the **Stages** tab (~3,560 lines of inline JSX) plus the **Sub Labor CRUD engine + its inline modal** (~1,900 lines combined). This map follows [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) and the format of [`DASHBOARD_SECTIONS_ARCHITECTURE.md`](./DASHBOARD_SECTIONS_ARCHITECTURE.md) / [`BIDS_TABS_ARCHITECTURE.md`](./BIDS_TABS_ARCHITECTURE.md).

> **Refreshed 2026-07-20** against v2.819 after the v2.738–v2.818 Stages feature run (20 PRs touched this file since the map was written at v2.736). The churn was almost entirely inside the Stages tab: the money columns merged into one Progress & payment cell, the View Reports column folded into Last activity, a quick-action icon stack, editable % complete at every section, the Hazmat Fee wizard, manage-job-people from the thread panel, and a `?stagesJob=` deep link. Details are integrated into the Stages dossier below.

Billing/lifecycle **behavior** (statuses, `update_job_status`, invoice ensure RPC, the three Bill Customer channels, Stripe modes, send-back semantics) is already mapped at the flow level in [`BILLING_FLOWS.md`](./BILLING_FLOWS.md) — this doc cross-references its sections ("Job billing lifecycle", "Invoices (`jobs_ledger_invoices`)", "Send-back / revert paths", "Stripe integration (test/live mode)") instead of restating them. This doc is about **where the code lives and what couples to what**.

The tabs switch on a single `activeTab` state (`JobsTab` union, search `type JobsTab` — module scope, ~line 209 as of v2.819):

```
'reports' | 'stages' | 'billing' | 'sub_sheet_ledger' | 'combined-labor'
| 'teams-summary' | 'parts' | 'job-summary' | 'inspections' | 'billed'
```

Tab-button labels differ from keys: `teams-summary` = **Crew P&L**, `combined-labor` = **Team Labor**, `sub_sheet_ledger` = **Sub Labor**. **`'billed'` is vestigial** — it is in the union and in `JOBS_TABS`, but there is no tab button and the URL router rewrites `?tab=billed` → `stages` (see [quirks](#quirks-preserve-dont-fix) #1).

### Key structural facts

1. **The jobs list does NOT live in this page.** `jobs`/`setJobs`/loading flags come from the app-level [`JobsListCacheContext`](../src/contexts/JobsListCacheContext.tsx) (`useJobsListCache`), shared with `JobDetailModalContext`, the Quickfill sections, and [`JobsAccountsReceivable.tsx`](../src/pages/JobsAccountsReceivable.tsx). `loadJobs()` = `runFetchJobs(customerFilterForFetch)`. The paid list is lazy (`fetchPaidJobsIfNeeded`).
2. **`loadJobs` runs only for `stages` / `billing` / `parts`** (`shouldLoadJobsListForActiveTab`, search that symbol). Other tabs render off whatever the shared cache already holds (quirk #2). Job Summary has its **own** full-org loader (`loadJobSummaryLedger` → `fetchJobsLedgerWithDetailsForStages({ statusScope: 'all', jobSummaryEnrich: true })`) that ignores `?customer=`.
3. **No realtime.** The page refetches on `visibilitychange` (stages/billing/parts) and via two debounce timers: `loadJobsFromEffectTimerRef` (50 ms, effect churn) and `loadJobsAfterMutationTimerRef` (300 ms, `scheduleLoadJobsAfterMutation` — also re-runs the Job Summary ledger loader when its snapshot was ever loaded).
4. **All Stages mutations are serialized** through [`runJobsStagesSerializedPipeline`](../src/lib/jobsStagesSerializedPipeline.ts) (a module-level promise tail; "Used only from Jobs.tsx") so rapid card moves cannot overlap. The Dashboard's parallel engine (`useDashboardBillingInvoices`) is *not* serialized — see [the job-mutation engine](#the-job-mutation-engine-seam-candidate).
5. **The file layout is:** module helpers/types (~1–289) → state block (~296–880, every `useState`/`useRef` in the component is declared here) → stages memos + mutation engine (~885–1340) → loaders + Sub Labor CRUD (~1350–2410) → print thunks (~2412–2610, thin wrappers over `lib/jobsDocuments/` since v2.820) → URL router + effects (~2620–3280) → parts/mercury callbacks + memos + job-form glue (~3300–4050) → tab bar (~4057–4240) → per-tab JSX (~4240–8190; Stages is ~4260–7820) → modal tail (~8190–10103). Line numbers are "as of v2.820" and rot — search symbols.
6. **Shared app-level modal contexts** do the heavy lifting: `useJobFormModal` (New/Edit Job — [`JobFormModal`](../src/components/jobs/JobFormModal.tsx), itself a God component now down to ~4,342 lines via its own mapped extraction, [`JOB_FORM_MODAL_ARCHITECTURE.md`](./JOB_FORM_MODAL_ARCHITECTURE.md)), `useJobDetailModal` ([`DetailJobModal`](../src/components/jobs/DetailJobModal.tsx)), `useBillCustomerModal` (the three billing channels — see BILLING_FLOWS "The three billing channels (Bill Customer)"). Since v2.743/v2.744 the Stages quick-action stack also consumes two more app contexts: `useDispatchTaskModal` (send job to Dispatch with a note) and `useChecklistAddModal` (send job as a task). These are already outside the page; the page only opens them via `tryOpenEditJob` / `openStagesDetailJobModal` / `billCustomer.openBillCustomer` / `dispatchTaskModal.openDispatchModal` / `checklistAddModal.openAddModal`.

### How to read a dossier

Each tab lists: render location (symbol anchor), **owned local state** (moves with the tab), **cross-tab/shared state** (stays in the parent), **derived memos**, **handlers**, **data deps / supabase tables + RPCs**, **sub-components** (extracted vs inline), **external coupling**, and **extraction status + risk + suggested approach** (Stage A = pure logic → `lib/*` + tests first; Stage B = component move).

### How to maintain this doc

- Flip a tab's Status and point at the new file whenever it is extracted; record what stayed in the parent and why.
- Treat line numbers as approximate anchors — search for the symbol when in doubt.

---

## Master summary table

Tabs in tab-bar order (Crew P&L first), then the vestigial member.

| Tab key | Label | Render | Status | Owned state in parent | Coupling | Risk | Recommended action |
|---|---|---|---|---|---|---|---|
| `teams-summary` | Crew P&L | thin wrapper `<JobsCrewPnlTab/>` | extracted (component owns its state) | 0 | med (reads `jobs` + `laborJobs` + `teamLaborData` + drive settings — all parent loaders) | — | Done; parent keeps the three data loaders (shared with 3 other tabs) |
| `reports` | Reports | thin wrapper `<JobsReportsTab/>` | extracted (self-loading) | 0 (component self-loads reports/templates) | low (`jobs` prop only seeds edit-modal; `error`/`setError` shared) | — | Done |
| `stages` | Stages | **~3,560 inline lines** (`activeTab === 'stages'` → IIFE at `(() => {` after the loading block) | **inline — the monster** | ~57 state vars + 2 lock refs | **very high** (mutation engine, board lists, AR modal, 14+ modals, deep links, 5 app contexts) | high | Multi-PR: seam hook first, then section renderers, then toolbar/modals (see [order](#recommended-extraction-order-value--risk)) |
| `billing` | Billing | ~235 inline lines (`activeTab === 'billing'`) | inline | 2 (`searchQuery`, `billingSortAsc`) | low-med (writes `fillLaborFromBillingJobAndSwitch` into Sub Labor; `openEdit`/`openNew`) | low | Extract `JobsBillingTab` after Stage A of the sort/filter memos |
| `combined-labor` | Team Labor | thin wrapper around shared `<CrewJobsBlock/>` | extracted component | 0 | low (`jobs.map(id)` filter from the cache; `teamLaborJob` URL param) | — | Done (CrewJobsBlock is shared app-wide; only the wrapper + param glue live here) |
| `sub_sheet_ledger` | Sub Labor | thin wrapper `<JobsSubLaborTab/>` **but the whole engine is parent-side** | **partial** | ~45 state vars (labor form, payments, roster, drive settings) | med (roster + drive settings shared with other tabs; `fillLaborFromBilling*` from Billing) | med | Extract the New/Edit Sub Labor modal (~1,230 lines) + CRUD engine into a component + `useSubLaborLedger` hook |
| `parts` | Parts | thin wrapper `<JobsPartsTab/>` | **partial** (list extracted; Mercury flows parent-side) | ~12 state vars + 4 refs (mercury allocations, unattributed modals) | med (mercury cache shared with Job Summary drilldowns) | med | Extract a `useJobsMercuryAllocations` hook shared by Parts + Job Summary, then move the modal glue |
| `job-summary` | Job Summary | thin wrapper `<JobsJobSummaryTab/>` (2,862-line component) | **partial** (render extracted; data layer parent-side) | ~14 state vars + 5 loaded-refs | med-high (reads parts/labor/team-labor/mercury from 4 other tabs' loaders) | med | Extract `useJobSummaryData` (ledger loader + lazy per-job loaders + `jobSummaryData` memo); print builder → `lib/jobsDocuments/` |
| `inspections` | Inspections | thin wrapper `<JobsInspectionsTab/>` | extracted (self-contained) | 0 | none (only `error`/`setError`) | — | Done |
| `billed` | — | no button; router rewrites to `stages` | **vestigial** | 0 | — | — | Keep the union member + redirect during decomposition; separate cleanup PR may remove it |

> Status legend: `inline` = rendered directly in `Jobs.tsx`; `partial` = child component exists but significant state/engine/modal mass remains in the parent; `extracted` = thin wrapper.

---

## Role-gating matrix

Two role sources exist and are checked in parallel almost everywhere: `authRole` (from `useAuth`) and `myRole` (fetched by `loadUsers` from `users.role` — quirk #6). `isAssistantLike` = `assistant | controller`.

### Tab visibility (tab bar flags, search `showPrimaryRestrictedTabs`)

| Tab | dev | master_technician | assistant | controller | estimator | primary | superintendent |
|---|---|---|---|---|---|---|---|
| Crew P&L (`showTeamsTab`) | ✓ | — | — | — | ✓ | — | — |
| Reports | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Stages (`showStagesAndBillingTabs`) | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Billing (`showStagesAndBillingTabs`) | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Team Labor (`showTeamLaborTab`) | ✓ | ✓ | — | ✓ (see quirk #5) | ✓ | — | — |
| Sub Labor | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Parts (`showSuperintendentExtraTabs`) | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Job Summary | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Inspections | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |

The URL router (the big effect on `[searchParams, myRole, authRole]`, search `// Redirect old receivables URLs`) *enforces* the same on deep links: primary → `reports` only; superintendent → `reports`/`sub_sheet_ledger`, default `reports`; assistant kicked off `combined-labor`; master/assistant-like kicked off `teams-summary`; legacy rewrites `receivables`→`reports`, `ledger`→`billing`, `labor`→`sub_sheet_ledger`, `billed`→`stages`; no tab defaults to `stages`.

### In-tab gates (Stages unless noted)

| Capability | Gate |
|---|---|
| Job Book button, Combine/Separate button | `['dev','master_technician','assistant','controller'].some(r => r === authRole \|\| r === myRole)` |
| Ham mode toggle | `['dev','assistant','controller'].includes(authRole \|\| myRole)` — **no master_technician, and `\|\|` short-circuit** (quirk #4) |
| Accounts Receivable button (BankPaymentsModal) | enabled for dev / master / assistant-like / **primary** (primaries can't reach Stages via the tab bar — the button gate is broader than the tab gate) |
| Move to Collections (`canManageCollections`) | dev / master / assistant-like (server RPC authoritative; this only hides the button) |
| Schedule icon (`canOpenJobScheduleModal`) | dev / master / assistant-like / superintendent |
| Parts banking flows (`canAccessBankingForParts`) | dev / master / assistant-like (authRole **or** myRole) |
| Job Summary Team Labor + Profit columns (`showTeamLaborAndProfit`) | dev / master / **controller** (not assistant) |
| Billing "Add Labor" fill icon + missing-team-labor flag | hidden for `authRole === 'primary'` |
| Sub Labor default-labor-rate save | `myRole === 'dev'` (client check; `saveDefaultLaborRate`) |
| Set % complete from the thread panel (`canEditJobPctComplete`, v2.757) | dev / master / assistant-like / **primary** — mirrors the `jobs_ledger` UPDATE RLS |
| Manage job people from the thread panel (`canManageJobPeople`, v2.751) | dev / master / **assistant only** (no controller) — mirrors the `jobs_ledger_team_members` INSERT/DELETE RLS |
| Hazmat Fee button (`canCreateHazmatFee`, v2.804) | dev / master / assistant-like — mirrors the `create_hazmat_fee_incident` RPC gate |
| Send-to-Dispatch quick action (v2.748) | `showTaskDispatchButton(authRole)` (`lib/headerTaskDispatchEstimatorEligible`) |

> The v2.75x-era gates above consult **`authRole` only** — no `myRole` fallback — unlike the older dual-source gates in the first half of this table (quirk #6). Preserve each expression verbatim when extracting.

---

## Per-tab dossiers

### `teams-summary` — Crew P&L

- **Render location:** `{activeTab === 'teams-summary' && <JobsCrewPnlTab .../>}`.
- **Owned state in parent:** none — [`JobsCrewPnlTab`](../src/components/jobs/JobsCrewPnlTab.tsx) (397 lines) owns its range/people state; math in `lib/crewPnlSummary.ts`.
- **Cross-tab/shared inputs:** `jobs` (from the shared cache — NOT loaded for this tab, quirk #2), `laborJobs` + `teamLaborData` + `laborJobsLoading`/`teamLaborLoading` (parent loaders, shared with billing/sub_sheet_ledger/job-summary), `driveMileageCost`/`driveTimePerMile` (parent `loadDriveSettings`), `jobDetailModal` opener.
- **Loaders that fire for this tab:** `loadLaborJobs` + `loadTeamLaborData` + `loadDriveSettings` (80 ms-delayed effects keyed on `activeTab`).
- **Supabase:** via parent loaders — `people_labor_jobs` (+items/payments), RPC `get_jobs_ledger_by_hcp_numbers`, `people_crew_jobs`, `people_hours`, `people_pay_config`, RPC `get_jobs_ledger_by_ids`, `app_settings`.
- **Status + approach:** **Extracted.** The three loaders stay in the parent (each feeds 3–4 tabs). Nothing further to do until a shared data hook exists (see [shared substrate](#shared-substrate)).

### `reports` — Reports

- **Render location:** `{activeTab === 'reports' && <ErrorBoundary><JobsReportsTab .../></ErrorBoundary>}` — the only tab wrapped in an ErrorBoundary.
- **Owned state in parent:** none — [`JobsReportsTab`](../src/components/jobs/JobsReportsTab.tsx) (859 lines) self-loads reports, templates, and role scoping (RPC `list_reports_with_job_info`, `report_templates`, `report_template_fields`, `reports`, `users`).
- **Cross-tab/shared inputs:** `jobs` (only to seed `initialJob` on edit; works fine when empty), `loadJobs`, `tryOpenEditJob`, `jobDetailModal`, `showToast`, `error`/`setError` (the page-global error, quirk #7), `authUser*`/`authRole`/`myRole`.
- **Status:** **Done.**

### `stages` — Stages (the monster)

The whole tab is one `{activeTab === 'stages' && (...)}` block: toolbar + jump nav (~4753–5227), then a single **IIFE** `{(() => { ... })()}` (~5228–8196) that destructures `stagesBoardLists`, declares all section render helpers as *closures*, and returns the six sections plus three inline modals. This closure nesting is why nothing here is trivially movable — every helper closes over parent state.

#### Board building (Stage A already done)

- `stagesBoardLists = useMemo(() => buildJobsStagesBoardLists(jobs, stagesSearchQuery, stagesSearchExtraJobIds))` — the board builder is **already extracted** to [`lib/jobsStagesBoard.ts`](../src/lib/jobsStagesBoard.ts) (473 lines, tested) and returns `{ filtered, waiting, working, paid, readyToBillJobs, billedJobs, readyToBillInvoices, billedInvoices, readyToBillRows, billedRows, billedActiveJobs, collectionsJobs, billedActiveRows, collectionsRows }`. Also from that lib: `jobBillingUnallocatedDollars`, `clampPartialInvoiceCentsToUnallocated`, `jobInCollections`, `locateStagesInvoiceSection`, `readyToBillRowsExposureTotal`, `stagesJobsWithoutCustomerFromFiltered`, `stagesWorkingJobsWithoutPicturesFromWorking`, `stagesSectionKeyForJobStatus`, the AR target builders (`bankPaymentTargets*`), and the `StageRow`/`InvoiceWithJob` types.
- Row-level pure helpers are extracted too: `lib/jobs/invoiceBilling.ts` (remaining/aging/est-bill-date kernels + `jobBilledUnpaidDollars`), `lib/stagesJobReferenceDates.ts` (j:/b: lines), `lib/jobs/jobFormatting.ts`, `lib/jobsStagesScheduleSessionSearch.ts`, and — new in the v2.74x–v2.80x run — [`lib/stagesMoneyBar.ts`](../src/lib/stagesMoneyBar.ts) (the Progress & payment segmented-bar model, tested) rendered by [`StagesProgressPaymentCell`](../src/components/jobs/StagesProgressPaymentCell.tsx) (214 lines — the first extracted Stages **row component**, with the inline % editor), `lib/jobs/stagesPctNote.ts` (pct-note body composer, tested), and [`JobAddressText`](../src/components/jobs/JobAddressText.tsx).
- **What remains inline is ORCHESTRATION:** the memo wiring above; `stagesJobsWithoutCustomer` / `stagesWorkingJobsWithoutPictures` memos + their auto-close effects; `billedAgingBuckets` (30/90-day buckets — inline math over `buildBilledStageRows`, a Stage-A candidate); `bankPaymentsModalBilledRows` (separate `buildJobsStagesBoardLists(jobs, '')` with EMPTY search so AR always sees all billed rows incl. Collections — quirk #9); `accountsReceivableButtonAccessibleName`; `stagesManHoursByJobId` / `stagesLaborBreakdownByJobId` (from `loadStagesManHours`, RPC `get_man_hours_by_job`, load-once ref).

#### Owned local state (moves with the tab, grouped)

- **Search:** `stagesSearchQuery`, `stagesSearchExtraJobIds` + `stagesScheduleSessionSearchBusy` (the debounced schedule/clock-session search effect, 350 ms, via `lib/jobsStagesScheduleSessionSearch`), `stagesIncludeScheduleTimeInSearch` (localStorage `jobs-stages-search-include-schedule-time`), plus the paid-list prefetch-on-search effect.
- **Sections:** `stagesSectionOpen` {waiting/working/readyToBill/billed/collections/paid}, `focusStagesSection` (jump nav scroll), `toggleStages` (closure).
- **Modes:** `stagesHamMode` (localStorage `jobs-stages-ham-mode`), `stagesFollowMoves` (localStorage `jobs-stages-follow-moves`) + `followMovedJob` + the job focus/flash pair `pendingStagesJobFocusId`/`stagesJobFlashId` (scroll-retry effect against `[data-stages-job-id]`).
- **Invoice focus:** `pendingStagesInvoiceFocusId`/`stagesInvoiceFlashId` + `applyStagesInvoiceFocus` (also consumed by the `?stagesInvoice=` deep link and the in-row jump chips) against `[data-stages-invoice-id]`.
- **Busy/locks:** `stagesStatusUpdatingId`, `stagesInvoiceUpdatingId`, `stagesInvoiceMutationLockRef`, `stagesInvoiceSendBackConfirmLockRef`.
- **Modal openers (single-opener, movable):** `billedTotalByNameModalOpen`/`billedTotalByNameExpandedName`, `stagesNoCustomerModalOpen`(+hover), `stagesNoJobPicturesModalOpen`(+hover), `jobBookModalOpen`, `combineSeparateModalOpen`, `capableToBillModalOpen`, `whenInvoiceBillModal`(+date), `invoiceEstimatedBillDateSavingId`, `createPartialInvoiceJob`/`Amount`/`creatingPartialInvoiceFromModal`, `scheduleModalJob`, `viewBillInvoice`, `lienToolingPrefillModal` (+`lienToolingSenderFallback` memo over `users`), `aiaG702StagesJob`, `hazmatFeeJob` (+`canCreateHazmatFee` gate + `openHazmatFee`, v2.804), `manageJobPeople` (+`canManageJobPeople` gate, v2.751), `markPaidJob`/`markPaidInvoice`, `bankPaymentsModalOpen`, `viewReportsJob`, `readyForBillingJob`/`Checked1`/`Checked2`, `sendBackJob`/`sendBackInvoice`/`sendBackChecked`/`sendBackStatusEventLine`/`sendBackInvoiceStripeExplainerAfterFailure`, `sendBackConfirmJob`, `collectionsConfirm`/`collectionsNoteDraft`/`collectionsSaving`, `confirmJobStatusJob` (**dead — quirk #3**).
- **Assigned editor (ham mode) + pct editor (all modes since v2.757):** `assignedEditJobId`/`assignedEditSelectedIds`/`assignedEditSavingId` + `assignedEditDropdownRef` + click-outside effect (assigned edit is still ham-only); `pctCompleteSavingId` now serves **every** section — the % editor lives inside `StagesProgressPaymentCell` (all three `renderStagesTable` calls pass `showPctComplete: true`; the unified table always wires `onPctCommit`) and in the thread panel's slider, whose commit path is `commitStagesPctWithNote` (posts a thread note via `submitJobThreadNoteWithBody` + `composePctCompleteNoteBody`, then updates `jobs_ledger.pct_complete`; gate `canEditJobPctComplete`).
- **Return-to-edit banner:** `returnEditBannerJobId` + three effects over `lib/returnEditJobFromStages` (sessionStorage handshake written by `JobFormModal`'s "See in Stages").

#### Cross-tab / shared state (stays in the parent)

`jobs`/`setJobs` (context), `customers` (loaded for stages+billing+job-form; feeds `customerListImpliesLinkedRow` "Not in Customers" badges), `users` (assigned-edit dropdown, schedule assignee candidates, lien sender fallback), `error` (global), `stagesManHours*` (loader could move with the tab — single consumer), the `useJobThreadNotes` engine (also consumed by Job Summary — stats for expanded rows), `arBankTxUnallocatedCount` (`useArBankUnallocatedCount`, enabled only on stages), and the entire [mutation engine](#the-job-mutation-engine-seam-candidate).

#### Section renderers (all closures inside the IIFE)

- `renderStagesTable(jobList, actionLabel, onAction, showTimeOpen?, onSendBack?, onSendBackSimple?, showPctComplete?)` — **job-only table** used by Waiting, Working, Paid in Full (the `showRemaining`/`showFinalBill` params died in the v2.741/v2.742 money-column merge; column count is a fixed 5). Rows include: HCP badge + service pill (`renderStagesJobHcpSubline`), job-name detail-modal button (`renderStagesOpenDetailJobName` — a parent-level useCallback), address line with map-pin link (`renderJobAddressWithMap` → `googleMapsSearchUrl` + `JobAddressText`, v2.748/v2.752), customer line with contact-card icon (+"Not in Customers" flow → `openEditJobAndCreateCustomerFlow`), j:/b:/man-hours lines (`renderStagesFieldAndBillingLines`), assigned-edit dropdown (ham mode; `updateJobTeamMembers`), the **Progress & payment cell** (`StagesProgressPaymentCell` fed by `buildStagesMoneyBarModel({totalBill, paymentsMade, pctComplete, billedUnpaid})`, inline % editor → `updateJobPctComplete`), a two-row action icon cluster — partial-invoice / Edit / detail on top, Click Tooling / AIA (`showAiaG702G703`) / Hazmat Fee (`openHazmatFee`, gated) below — last-activity cell (`renderStagesLastActivityCell`, now also carrying the `N Reports` footer button `renderStagesViewReportsFooterButton` — the dedicated View Reports **column is gone**, v2.738/v2.739), expandable `JobThreadNotesPanel` row, project banner row (`renderStagesProjectBannerRow`), linked-estimate footer (`renderStagesJobColumnEstimateFooter`).
- `renderUnifiedStagesTable(rows: StageRow[], options)` — **mixed job/invoice-row table** used by Ready to Bill, Billed Awaiting Payment, Collections. The 20-key options object (`onJobAction`/`onInvoiceAction`/`onViewBill`/`onJobSendBack`/`onInvoiceSendBack`/`onOpenLienTooling`/`onJobMoveToCollections`/`jobNoteLine`/labels/flags/`flashInvoiceId`) is effectively the future component's prop contract. Money display is the same `StagesProgressPaymentCell` (column count now 5), with per-row `footnote` variants (draft amount, merged-billed "This bill: paid · left", remainder, unallocated). Adds: est-bill-date ham ±1 buttons (`bumpInvoiceEstimatedBillDate`) and the date modal opener (`setWhenInvoiceBillModal`), Stripe emailed-customer hint + resend (`renderStagesStripeEmailedCustomerHint` → `StripeInvoiceSendFromStripeButton`), invoice jump chips (`renderStagesInvoiceJumpChips` → `applyStagesInvoiceFocus`).
- Smaller closures: `renderJobCustomerLine`, `renderJobAddressWithMap`, `renderStagesThreadExpandButton`, `renderStagesLastActivityLeadingControls` (since v2.743–v2.748 a **quick-action icon stack**: schedule modal, week dispatch → `navigate('/schedule-dispatch?jobId=…&week=…')`, `tel:` call-customer, send-to-Dispatch → `dispatchTaskModal.openDispatchModal` gated `showTaskDispatchButton(authRole)`, send-as-task → `checklistAddModal.openAddModal` with a preset title + `?jobDetail=` link — plus the thread toggle), `shouldSuppressStagesRowJobThreadToggle`, `stagesRowHasProjectBanner`.
- The expanded thread row passes the panel new v2.751/v2.757 props: `pctComplete`/`canEditPct`/`pctSaving`/`onCommitPct` (→ `commitStagesPctWithNote`) and `teamMembers` + `peopleAction` (→ `setManageJobPeople`, opens [`ManageJobPeopleModal`](../src/components/jobs/ManageJobPeopleModal.tsx)) — identically at all three `JobThreadNotesPanel` render sites.
- Section wiring (the return of the IIFE): Waiting → `renderStagesTable(waiting, 'Move to Working', updateJobStatus('working'))`; Working → `'Ready to Bill'` action (ham: direct `moveJobToReadyToBillWithStripePrep`, else `readyForBillingJob` double-checkbox confirm) + send-back-to-waiting + "Capable of Being Billed" modal; Ready to Bill → unified table with Bill Customer actions (`billCustomer.openBillCustomer`, customer-link guard → `openEdit(j, { billingCustomerHighlight: true })`), Send Job Back / `DELETE_DRAFT_BILL_LABEL`; Billed Awaiting Payment → Mark Paid (`BilledPaymentConfirmationModal` ×2), View Bill (`BilledBillViewModal`), Lien Tooling, Move to Collections, send-backs, aging chips + AR button + Print; Collections → Mark Paid / send-back-to-Billed via `collectionsConfirm` (`setJobCollectionsFlag` RPC `set_job_collections_flag`); Paid in Full → lazy `fetchPaidJobsIfNeeded` on expand, send-back-to-billed.
- Inline modals inside the IIFE: **Total by Name** (`billedTotalByNameModalOpen`, groups `billedActiveRows` by job name), **Capable of Being Billed** breakdown, **est-bill-date** (`whenInvoiceBillModal`).

#### Deep links & URL router (stays in the parent)

`?edit=` (forces stages, opens Edit Job), `?jobDetail=` (+location-state prefill), `?newJob=true` (stages/billing → JobFormModal; sub_sheet_ledger → labor modal), `?editLabor=` (forces sub_sheet_ledger), `?editParts=` (forces parts, expands+scrolls), `?openBankPayments=` (forces stages, opens AR modal, role-gated), `?stagesInvoice=` (focus+flash via `applyStagesInvoiceFocus`), `?stagesJob=` (v2.818 — opens the job's status section, scroll+flash the row via the job focus/flash pair; toast if the job isn't on the board; used by the Job Detail / Edit Job trade-pill shortcut), `?stagesSection=` (open+scroll a section), `?showBilledTotalByName=true`, `?jobSummaryHcp=` (seeds Job Summary search), `?teamLaborJob=` (Team Labor focus), `?customer=` (jobs fetch filter + banner). All strip themselves with `setSearchParams(..., { replace: true })`.

#### The always-open AR wrapper page

[`src/pages/JobsAccountsReceivable.tsx`](../src/pages/JobsAccountsReceivable.tsx) (90 lines, route outside this page) re-implements the minimal substrate: `useJobsListCache` + its own `runFetchJobs(null)` effect + a **verbatim copy** of the `bankPaymentsModalBilledRows` memo (`buildJobsStagesBoardLists(jobs, '').billedRows`) + an always-`open` [`BankPaymentsModal`](../src/components/jobs/BankPaymentsModal.tsx) (1,482 lines, extracted) + `useJobFormModal` edit glue. Role gate `canRoleSeeArBankUnallocatedOrgNudge`. **Sharing model:** the two pages share the modal component and the lib builder, not any Jobs.tsx code — when Stages extracts, keep the AR target derivation in `lib/jobsStagesBoard.ts` (it already is) so both stay in lockstep. Cross-ref BILLING_FLOWS "Payments (`jobs_ledger_payments`)" and "Routes map".

#### Supabase (stages-only surface)

RPCs `update_job_status`, `delete_billed_invoice_on_send_back`, `delete_ready_to_bill_invoice`, `ensure_single_ready_to_bill_invoice_for_job`, `get_man_hours_by_job`, `set_job_collections_flag` (lib), `create_hazmat_fee_incident` (via `lib/hazmatFee.ts`, which also reads `app_settings` for the fee default and the ToS §11 clause snapshot); tables `jobs_ledger` (pct_complete update), `jobs_ledger_invoices` (partial-invoice insert, est-bill-date update), `jobs_ledger_team_members` (assigned edit; also read/insert/delete inside `ManageJobPeopleModal` alongside `users`), `job_status_events` (send-back context line), `customers`; edge functions via `lib/voidStripeInvoiceForRevert` (see BILLING_FLOWS "Stripe integration (test/live mode)" and "Send-back / revert paths"); schedule/clock search via `lib/jobsStagesScheduleSessionSearch`; thread notes via `useJobThreadNotes` RPCs (incl. the pct-note write through `submitJobThreadNoteWithBody`).

#### Extraction status + risk + approach

**Inline; highest value, highest risk.** Order of operations: (1) Stage A the remaining pure bits (`billedAgingBuckets` bucketing, capable-to-bill math — computed twice, quirk #8 — and the print builder) into `lib/jobsStagesBoard.ts` / `lib/jobsDocuments/`; (2) build the **`useJobsStagesMutations` seam** (below) so the engine stops closing over page state; (3) extract `JobsStagesTable` + `JobsStagesUnifiedTable` as components (their param lists are already prop-shaped); (4) extract `JobsStagesTab` carrying the toolbar, jump nav, sections, single-opener modals, and search state, receiving the engine + shared modal openers as props. The URL router, `jobs` cache wiring, `customers`, `users`, and the shared contexts stay in the parent.

### `billing` — Billing

- **Render location:** `{activeTab === 'billing' && (...)}` (~235 lines): New Job button, search input, HCP sort toggle (persisted `jobs_billing_sort_asc_${uid}`), assistants-visibility hint, and a read-only table (HCP + Add-Labor/missing-team-labor icons, job/address, Specific Work fixtures, Other job charges materials, Contractors, Total Bill, Drive/Plans links, Edit).
- **Owned local state:** `searchQuery`, `billingSortAsc` (+ localStorage restore effect).
- **Derived memos:** `filteredJobs` (inline filter — not a memo), `sortedBillingJobs`, `laborJobHcps` + `teamLaborJobIds` (for the two red icons).
- **Cross-tab coupling:** `fillLaborFromBillingJobAndSwitch(job)` — switches to Sub Labor, resets + prefills the labor form from the job's team members (roster-name intersection) and opens the labor modal. Loaders for `laborJobs` + `teamLaborData` fire on this tab *solely* to power the two icons.
- **Supabase:** none beyond shared loaders.
- **Status + approach:** **Inline, low risk.** Stage A: move the fixtures/materials line-formatting and the sort comparator into `lib/jobs/`; Stage B: `JobsBillingTab` with `onFillLaborFromBilling` callback prop. The cross-tab prefill stays a parent callback.

### `combined-labor` — Team Labor

- **Render location:** thin wrapper around [`CrewJobsBlock`](../src/components/CrewJobsBlock.tsx) (1,249 lines, shared app-wide) with `jobIdsFilter={jobs.map(id)}`, `focusTeamLaborJobId={teamLaborJobParam}`, `onFocusTeamLaborConsumed` (strips `?teamLaborJob=`).
- **Owned state:** none.
- **Quirk:** `jobs` is not loaded for this tab (quirk #2) — the filter silently narrows to whatever the cache holds.
- **Status:** **Done** (the block self-loads its crew data). Only the param glue would move with a wrapper file; not worth a PR alone.

### `sub_sheet_ledger` — Sub Labor

- **Render location:** list = `<JobsSubLaborTab/>` ([447 lines](../src/components/jobs/JobsSubLaborTab.tsx), extracted); but the **New/Edit Sub Labor modal is ~1,230 inline lines** in the modal tail (`{(laborModalOpen || editingLaborJob) && (...)}`, search `'Edit Sub Labor'`), plus Make Payment / Backcharge / Edit Payment / Add Subcontractor / Default Labor Rate / Drive Settings inline modals.
- **Owned local state (parent, ~45 vars):** labor-form cluster (`laborAssignedTo`, `laborAddress`, `laborDistance`, `laborJobNumber`, `laborDate`, `laborFixtureEntryMode` simple/itemized, `laborFixtureRows`, `laborSaving`, `laborInvoiceLink*`), labor-book cluster (`serviceTypes`/`selectedServiceTypeId`, `fixtureTypes`, `laborBookVersions`/entries + version/entry edit forms, `applyingLaborBookHours`), ledger cluster (`laborJobs`, `laborJobNamesByHcp`, `laborJobsLoading`, `laborJobDeletingId`, `editingLaborJob`, `laborModalOpen` + section-open + `laborCrewSearch`), payments cluster (`makePayment*`, `backcharge*`, `editingPayment`/`editPayment*`), roster cluster (`people`, `users` partly, `showAddSubcontractorModal`/`newSubcontractor`/`addSubcontractorError`), settings (`driveSettings*`, `defaultLaborRate*`).
- **Handlers (the CRUD engine, ~1,000 lines):** `loadRoster`/`loadUsers`/`byKind`/`rosterNames*` (roster partitioning), `loadServiceTypes`/`loadFixtureTypes`/`loadLaborBookVersions`/`loadLaborBookEntries`/`applyLaborBookHoursToPeople`/`getOrCreateFixtureTypeId` + version/entry save/delete, `loadLaborJobs` (jobs + items + payments + RPC `get_jobs_ledger_by_hcp_numbers` name join), `saveLaborJob`/`saveEditedLaborJob`/`deleteLaborJob`/`updateLaborJobDate`, `recordLaborJobPayment`/`recordLaborJobBackcharge`/`deleteLaborJobPayment`/`updateLaborJobPayment`, `saveLaborInvoiceLinkDraft`, form plumbing (`resetLaborForm`, `openEditLaborJob`, `openNewLaborJob`, `fillLaborFromBilling`, `handleLaborFixtureEntryModeToggle`, `checkDuplicateName`, `handleSaveAddSubcontractor`), print (`printLaborSubSheet`, `printJobSubSheet` — near-duplicates, quirk #10), settings (`loadDriveSettings`/`saveDriveSettings`, `loadDefaultLaborRate`/`saveDefaultLaborRate`).
- **Derived:** `laborMissingFields`/`laborCanSubmit` (computed every render, not memoized), `subLaborOutstandingByPerson` (lib `buildSubLaborOutstandingByPerson`, tested) + `subLaborDueTotal`, crew-search partitions (`laborModal*Shown`).
- **Cross-tab coupling:** `laborJobs`+`teamLaborData`+drive settings feed Crew P&L, Job Summary, and Billing's icons; `fillLaborFromBillingJobAndSwitch` writes this tab's form from Billing; `?editLabor=` and `?newJob=true&tab=sub_sheet_ledger` deep links; roster (`people`/`users`) is also the Stages assigned-edit source (`users` only).
- **Supabase:** `people_labor_jobs`, `people_labor_job_items`, `people_labor_job_payments`, `people`, `users`, `service_types`, `fixture_types`, `labor_book_versions`, `labor_book_entries`, `app_settings` (`drive_mileage_cost`, `drive_time_per_mile`, `default_labor_rate`), RPC `get_jobs_ledger_by_hcp_numbers`.
- **Extraction status + risk + approach:** **Partial; the biggest non-Stages win (~1,900 lines).** Stage A **done (v2.820)**: the two print builders live in `lib/jobsDocuments/subLaborSheet.ts` (one parameterized builder + tests); labor-line math already in `lib/peopleLaborJobItemLineCost`/`lib/jobs/subLaborCost`. Stage B in two PRs: (1) `useSubLaborLedger` hook (ledger + payments + labor-book + roster loaders and mutations); (2) `JobsSubLaborFormModal` component (the 1,230-line modal + form state + labor-book pickers + Add Subcontractor). `JobsSubLaborTab` then absorbs the payment/backcharge/edit-payment modals (single-opener). Drive/default-rate settings modals can move with the tab (openers only there). What stays: `loadTeamLaborData` consumers' wiring; the Billing→Sub Labor prefill callback.

### `parts` — Parts

- **Render location:** `<JobsPartsTab/>` ([620 lines](../src/components/jobs/JobsPartsTab.tsx), extracted list/table) — but the **Mercury attribution flow is parent-side**, rendered in the modal tail: `PartsUnattributedMercuryListModal`, `PartsUnattributedAllJobsModal`, `MercuryTransactionAllocationsModal`.
- **Owned local state (parent):** `tallyPartsSearch`, `showMyJobsOnly`, `myJobIds`, `expandedPartsJobIds`, `pendingScrollToPartsJobId`; mercury cluster — `mercuryCardChargesByJobId` (also Job Summary), `partsTabMercuryAllocationsByJobId` + loaded/in-flight refs, `partsUnattribFlowJobIdRef`, `partsUnattribListJobId`, `partsAllocModalOpen`/`partsAllocModalData`, `allJobsUnattributed{Open,Loading,Lines}`, `bankingAttributionUsersOptions`.
- **Handlers:** `loadPartsTabMercuryForJob`/`refreshPartsTabMercuryForJob`/`updateMercuryCardTotalForOneJob`, `handleAssignToTransactionFromParts`, `handleQuickAddUserFromParts` (`mercuryQuickAssignUserAttribution`), `refetchAllJobsUnattributedData` (`fetchUnattributedMercuryLinesForManyJobs`, concurrency 5), `onPartsAllocSaved` (routes refresh to Parts and/or Job Summary flows via the two flow refs), `closePartsAllocModal` + dismiss/close-for-assign callbacks.
- **Data engine:** [`usePartsLedgerData`](../src/hooks/usePartsLedgerData.ts) (extracted hook; active on parts **and** job-summary) → `tallyParts`, `invoiceAmountByJob` (supply-house allocations), delete/update-fixture-cost mutations.
- **Cross-tab coupling:** the mercury allocation modal + `mercuryCardChargesByJobId` + `bankingAttributionUsersOptions` are **shared with Job Summary** (drilldown reassign flow via `jobSummaryMercuryEditFlowJobIdRef`); `jobs` list gates which jobs appear; `?editParts=` deep link.
- **Supabase:** `jobs_tally_parts` + `supply_house_invoice_job_allocations` (via hook), `mercury_transaction_job_allocations`, `jobs_ledger_team_members` (my-jobs filter), users options via `loadUsersOptionsForBankingAttribution`.
- **Extraction status + risk + approach:** **Partial.** The seam is a **`useJobsMercuryAllocations` hook** owning the per-job allocation cache, card totals, the alloc-modal open/save routing, and the two flow refs — consumed by both Parts and Job Summary (this is the page's closest analog to Dashboard's shared-engine rule). After that, the three mercury modals + remaining parts state move into `JobsPartsTab`. Risk med: the save-refresh routing (`onPartsAllocSaved`) touches both tabs' caches.

### `job-summary` — Job Summary

- **Render location:** `<JobsJobSummaryTab/>` ([2,862 lines](../src/components/jobs/JobsJobSummaryTab.tsx) — already its own sub-decomposition candidate) fed by ~35 props.
- **Owned parent state:** `jobSummaryLedgerAllJobs`/`jobSummaryLedgerJobs` (min-HCP filter memo, localStorage-backed `jobSummaryMinHcpExclusive`), loading/error + `loadJobSummaryLedgerRef`/snapshot ref, `jobSummarySearch` (seeded by `?jobSummaryHcp=`), `expandedJobSummaryJobIds`, `jobSummaryTeamLaborPersonExpandedKeys`, `jobSummaryBreakdownPersonSearchByJobId`, lazy per-job caches + loaded-refs (`jobSummaryClockSessionsByJobId`, `jobSummaryInvoiceLinesByJobId`, `jobSummaryMercuryAllocationsByJobId`, `jobSummaryReportsByJobId`, `jobSummaryReportPctByJobId`), `jobSummaryCostDrilldown` (modal content as ReactNode), `printCostBreakdownJobId`.
- **Derived:** **`jobSummaryData`** — the big per-job P&L memo joining tallyParts + supply-house invoices + billed materials + mercury card charges + sub-labor cost (`laborJobSubCost` with drive settings) + team-labor cost against `jobSummaryLedgerJobs` (on this tab) or `jobs` (elsewhere); sorted HCP-desc with empty-HCP first.
- **Handlers/effects:** `loadJobSummaryLedger` (own full-org fetch), five expand-driven lazy loaders (`clock_sessions` on person-expand, RPC `get_invoice_allocation_lines_for_jobs`, mercury allocations, `reports` timeline, RPC `list_latest_report_completion_pct` batch), `printJobSummaryCostBreakdown` (~500-line HTML print builder), `handleJobSummaryMercuryReassignFromDrilldown` (shared mercury modal), thread-stats effect for expanded rows (via `useJobThreadNotes`).
- **Cross-tab coupling:** consumes four other tabs' engines (parts hook, `laborJobs`, `teamLaborData`, drive settings, mercury card totals) — the join tab. `scheduleLoadJobsAfterMutation` re-runs its ledger loader after Stages mutations once the snapshot loaded.
- **Supabase:** `fetchJobsLedgerWithDetailsForStages` (all-status enriched), `clock_sessions`, `reports`, `mercury_transaction_job_allocations`, RPCs `get_invoice_allocation_lines_for_jobs`, `list_latest_report_completion_pct`.
- **Extraction status + risk + approach:** **Partial.** Stage A: `printJobSummaryCostBreakdown` → `lib/jobsDocuments/jobSummaryCostBreakdown.ts` **done (v2.820** — the page thunk still resolves the invoice/mercury/clock caches and fetch fallbacks, then calls the pure builder**)**; `jobSummaryData` math → `lib/jobSummaryPnl.ts` + tests still open. Stage B: `useJobSummaryData` hook (ledger loader + lazy caches + the memo). The drilldown-modal ReactNode state (`jobSummaryCostDrilldown`) is an anti-pattern to preserve as-is during the move (quirk #11).

### `inspections` — Inspections

- **Render location:** `<JobsInspectionsTab authUserId error onError/>` ([543 lines](../src/components/jobs/JobsInspectionsTab.tsx), self-loading).
- **Status:** **Done.** Only the shared `error` plumbing ties it to the parent.

### `billed` — vestigial union member

In `JobsTab` + `JOBS_TABS` but has **no tab button**; the URL router rewrites `?tab=billed` → `stages` (search `tab === 'billed'`), and the return-edit-banner effect treats `tab=billed` as "wants stages". Keep during decomposition (quirk #1).

---

## The job-mutation engine (seam candidate)

The Stages status/invoice mutation cluster is the page's equivalent of Bids' `useBidPricingEngine` — extract it as **`useJobsStagesMutations`** before any Stage-B move of the sections. Members (all currently plain functions closing over page state):

| Function | Does | Serialized? | Dashboard twin (in [`useDashboardBillingInvoices`](../src/hooks/useDashboardBillingInvoices.ts)) |
|---|---|---|---|
| `executeUpdateJobStatus` | RPC `update_job_status` → optimistic `setJobs` patch → `followMovedJob` → `scheduleLoadJobsAfterMutation`; failure toasts via `lib/updateJobStatusClientFeedback` (+conditional resync) | no (inner) | inlined in its `updateJobStatus` |
| `updateJobStatus` | queue wrapper | ✅ `runJobsStagesSerializedPipeline` | `updateJobStatus` — **not serialized** |
| `moveJobToReadyToBillWithStripePrep` | `prepareBilledInvoicesBeforeJobRevertToReadyToBill` (Stripe void/prep, edge fns) then status move | ✅ | `moveJobToReadyToBillWithStripePrep` — not serialized |
| `revertBilledInvoiceToReadyToBill` | non-Stripe → RPC `delete_billed_invoice_on_send_back` + `syncJobToReadyToBillIfNoBilledInvoicesRemain`; Stripe → `invokeVoidStripeInvoiceForRevert` + `ensureLedgerInvoiceRemovedAfterStripeSendBack` + sync | ✅ + `stagesInvoiceMutationLockRef` | `revertBilledDashboardInvoiceToReadyToBill` |
| `deleteInvoice` | RPC `delete_ready_to_bill_invoice` | ✅ + lock ref | `deleteInvoice` |
| (adjacent) `setInvoiceEstimatedBillDate`/`bumpInvoiceEstimatedBillDate`, `updateJobTeamMembers`, `updateJobPctComplete`, `commitStagesPctWithNote` (v2.757 — thread-note post via `submitJobThreadNoteWithBody` **then** the `pct_complete` update, one saving flag spans both), `createInvoiceFromModal` (partial invoice + ensure RPC), collections via `setJobCollectionsFlag` | row-level writes; each patches or reloads `jobs` | no | n/a (Dashboard has mark-paid instead) |

**Inputs the hook needs:** `setJobs` + `loadJobs`/`scheduleLoadJobsAfterMutation` (from the cache context), `authRole` (Stripe mode via `stripeModeForBillingFromRole`), `setError`, `showToast`, `followMovedJob` (or return the moved-job event and let the tab react), the two busy-id states, the lock refs (declare them inside the hook), and — since v2.757 — `submitJobThreadNoteWithBody` from the `useJobThreadNotes` engine (for `commitStagesPctWithNote`; either inject it or keep that one function beside the thread engine).

**Convergence with the Dashboard (explicit opportunity):** the four core functions are behavior-parallel to `useDashboardBillingInvoices` v2.727 (same RPCs, same Stripe prep libs `voidStripeInvoiceForRevert` / `syncJobToReadyToBillIfNoBilledInvoicesRemain`, same failure-feedback lib). Differences to reconcile *later, not during the move*: Jobs serializes through the module-level pipeline and Dashboard does not; Jobs patches the `jobs` cache optimistically while Dashboard prunes its invoice-unit lists; Jobs supports `toStatus: 'waiting'` (Dashboard's union starts at `working`); follow-cards is Jobs-only. A shared `lib/jobStatusMutationCore.ts` (pure request/interpret layer under both hooks) is the realistic convergence target — merging the hooks outright is blocked by the different list stores. Cross-ref BILLING_FLOWS "Send-back / revert paths" and "Client callers".

---

## Shared modals & contexts

Per the playbook: modals opened from 2+ tabs (or living in app contexts) stay parent/app-side; single-opener modals move with their tab.

| Modal | Source | Opened from | Stays / moves |
|---|---|---|---|
| `JobFormModal` (New/Edit Job) | `JobFormModalContext` (app) | every tab via `tryOpenEditJob`/`openNew`/`openEdit`, URL `?edit=`/`?newJob=` | **stays (app context)** |
| `DetailJobModal` | `JobDetailModalContext` (app) | Stages, Job Summary, Crew P&L, Reports, `?jobDetail=` | **stays (app context)** |
| Bill Customer flow | `BillCustomerModalContext` (app) | Stages RTB actions, partial-invoice full-remainder path | **stays (app context)** |
| `JobReportsModal` (`viewReportsJob`) | component | Stages tables (both renderers) | moves with Stages (single tab, multi-row) |
| `BankPaymentsModal` (AR) | component | Stages AR button, `?openBankPayments=`, **and the standalone `/jobs/accounts-receivable` page** | component shared; opener state moves with Stages; AR page keeps its own mount |
| `BilledBillViewModal`, `LienToolingPrefillModal`, `AiaG702G703Modal`, `HazmatFeeModal` (v2.804 — wizard component, 345 lines; `lib/hazmatFee.ts` + `lib/jobsDocuments/hazmatFeeNotice.ts`), `ManageJobPeopleModal` (v2.751 — 194 lines, self-contained `users`/`jobs_ledger_team_members` I/O), `BilledPaymentConfirmationModal` ×2, `ScheduleJobModal`, `JobBookModal`, `JobsCombineSeparateModal`, `StagesNoCustomerJobsModal`, `StagesAlertJobListModal`, Total-by-Name / Capable-to-Bill / est-bill-date / partial-invoice / Ready-to-Bill / send-back ×3 / collections / dead confirm (inline) | components / inline | Stages only | move with Stages |
| Sub Labor modal cluster (New/Edit ~1,230 lines, Make Payment, Backcharge, Edit Payment, Add Subcontractor, Drive Settings, Default Labor Rate — all inline) | inline | Sub Labor (+ Billing prefill opener, + `?editLabor=`/`?newJob=`) | move with Sub Labor (parent keeps the prefill + deep-link glue) |
| Mercury cluster (`PartsUnattributedMercuryListModal`, `PartsUnattributedAllJobsModal`, `MercuryTransactionAllocationsModal`) | components | Parts **and** Job Summary drilldown | **stays parent-side until `useJobsMercuryAllocations` exists**, then moves behind it |
| `JobSummaryCostCellDrilldownModal` | component | Job Summary | moves with Job Summary |

---

## Shared substrate

### Already-extracted engines consumed by the page

| Unit | Owns | Consumed by |
|---|---|---|
| [`JobsListCacheContext`](../src/contexts/JobsListCacheContext.tsx) | `jobs`, loading/refreshing, lazy paid merge, `runFetchJobs` coalescing | every tab + AR page + JobDetail context + Quickfill — **the page's master list; stays app-level** |
| [`usePartsLedgerData`](../src/hooks/usePartsLedgerData.ts) | tally parts + supply-house invoice totals + mutations | Parts, Job Summary |
| [`useJobThreadNotes`](../src/hooks/useJobThreadNotes.ts) (490 lines; + `submitJobThreadNoteWithBody` since v2.757) | thread notes/activity/stats engine | Stages last-activity cells + `JobThreadNotesPanel`, Job Summary expanded rows, `commitStagesPctWithNote` |
| [`lib/stagesMoneyBar.ts`](../src/lib/stagesMoneyBar.ts) (84 lines, tested) + [`StagesProgressPaymentCell`](../src/components/jobs/StagesProgressPaymentCell.tsx) (214 lines) | Progress & payment segmented-bar model + row cell with inline % editor | both Stages tables (every section) |
| `lib/jobs/stagesPctNote.ts` (tested), `lib/hazmatFee.ts` (tested) + `lib/jobsDocuments/hazmatFeeNotice.ts` (tested), [`JobAddressText`](../src/components/jobs/JobAddressText.tsx) | pct-note composer; hazmat defaults/ToS-clause loaders + `create_hazmat_fee_incident` caller + notice HTML; two-line address text | Stages (+ `HazmatFeeModal`) |
| `lib/jobsDocuments/` print builders (v2.820, all tested): [`subLaborSheet.ts`](../src/lib/jobsDocuments/subLaborSheet.ts) (one core replaces the two near-duplicate sub-sheet printers — quirk #10 resolved), [`billedAwaitingPaymentReport.ts`](../src/lib/jobsDocuments/billedAwaitingPaymentReport.ts), [`jobSummaryCostBreakdown.ts`](../src/lib/jobsDocuments/jobSummaryCostBreakdown.ts) (page passes resolved invoice/mercury/clock rows), `printWindow.ts` (shared window.open glue) | pure print HTML builders | Sub Labor, Stages Billed print, Job Summary |
| [`lib/jobsStagesBoard.ts`](../src/lib/jobsStagesBoard.ts) | board lists, StageRow builders, AR targets, collections predicate | Stages, AR modal rows (both pages), Dashboard-adjacent quickfill |
| [`lib/jobsStagesSerializedPipeline.ts`](../src/lib/jobsStagesSerializedPipeline.ts) | mutation serial queue | mutation engine, `JobsCombineSeparateModal.onAfterSuccess` |
| `lib/jobs/*` (`jobFormatting`, `invoiceBilling`, `subLaborCost`, `jobAddressUrls`), `lib/stagesJobReferenceDates`, `lib/subLaborOutstanding`, `lib/jobSummary*`, `lib/partsPerPersonCostSummary`, `lib/mercury*`, `lib/voidStripeInvoiceForRevert`, `lib/updateJobStatusClientFeedback`, `lib/syncJobToReadyToBillIfNoBilledInvoicesRemain`, `lib/returnEditJobFromStages`, `lib/jobsStagesScheduleSessionSearch` | pure kernels (mostly tested) | per domain |
| `useArBankUnallocatedCount`, `useMercuryLedgerNicknames`, `useSendBackCollectPaymentFlowNotice`, `useMatchMedia` | counts/nicknames/notice/layout | Stages, Parts/Job Summary, send-back modal |

### Data engines still inline (seam candidates)

| Inline engine | Anchor | Feeds | Candidate |
|---|---|---|---|
| Job-status + invoice mutations | `executeUpdateJobStatus` … `deleteInvoice` (~1114–1272) | Stages sections, send-back/confirm modals, Combine/Separate refresh | **`useJobsStagesMutations`** (+ shared core with `useDashboardBillingInvoices`) |
| Sub Labor ledger + labor book + roster + payments | `loadLaborJobs`/`loadRoster`/`saveLaborJob` … (~1315–2385) | Sub Labor, Crew P&L, Job Summary, Billing icons | `useSubLaborLedger` |
| Team labor aggregation | `loadTeamLaborData` (~1625) | Crew P&L, Job Summary, Billing icons, (Stages man-hours has its own RPC) | **near-verbatim duplicate of the exported `loadTeamLaborData(supabase)` in [`utils/teamLabor.ts`](../src/utils/teamLabor.ts)** (same 2-year window, salary 8h Mon–Fri rule, pct split, `get_jobs_ledger_by_ids` name join; the inline copy only inlines the pay-config fetch instead of `fetchLaborPayConfigMap`). Parity-check then adopt the util — the same move the Dashboard made for `useEstimatorInbox` (v2.719) |
| Mercury allocations + attribution | `loadPartsTabMercuryForJob` … `onPartsAllocSaved` (~3819–4050) | Parts, Job Summary | `useJobsMercuryAllocations` |
| Job Summary ledger + lazy caches + P&L memo | `loadJobSummaryLedger`, `jobSummaryData` (~361, ~4211) | Job Summary | `useJobSummaryData` |

### Parent-forever glue

- The **URL deep-link router** (all `?tab=`/`?edit=`/`?jobDetail=`/`?newJob=`/`?editLabor=`/`?editParts=`/`?openBankPayments=`/`?stagesInvoice=`/`?stagesSection=`/`?customer=` effects) and `activeTab` itself.
- The app contexts (`jobFormModal`, `jobDetailModal`, `billCustomer`, `dispatchTaskModal`, `checklistAddModal`, toast) and `tryOpenEditJob`'s busy-gate; `navigate` (week-dispatch quick action).
- `customers` + `refreshCustomersAfterJobFormSave` (stages + billing + job-form implied-customer logic).
- `users`/`people` roster (Stages assigned-edit + Sub Labor + schedule modal candidates) — until `useSubLaborLedger` claims `people` and Stages claims a `users` slice.
- `error` (global, cross-tab — quirk #7) and the two debounce timers + cleanup effect.
- localStorage keys: `jobs-stages-ham-mode`, `jobs-stages-follow-moves`, `jobs-stages-search-include-schedule-time` (move with Stages), `jobs_billing_sort_asc_${uid}` (moves with Billing), `jobSummaryMinHcpExclusive` storage (via lib, moves with Job Summary).

---

## Quirks (preserve, don't fix)

Behavior-preserving decomposition only — note these, don't "clean them up" mid-move:

1. **Vestigial `'billed'` tab.** Union member + `JOBS_TABS` entry with no button; `?tab=billed` rewrites to `stages`; the return-edit-banner effect also accepts `tab === 'billed'` as stages-intent. Removing it is a separate cleanup PR.
2. **`jobs` loads only on stages/billing/parts.** Crew P&L's `jobs` prop, Team Labor's `jobIdsFilter`, and Reports' edit-seed read the shared cache, which is **empty on a cold landing** at those tabs until another surface fetches. Long-standing behavior — do not add loaders during extraction.
3. **Dead wiring: `confirmJobStatusJob`.** State + fully rendered "Are you sure?" confirm modal (search `confirmJobStatusJob &&`) whose opener is never called — the only `setConfirmJobStatusJob(...)` calls are the modal's own `null` resets. Jobs' analog of Dashboard's dead `ReportEditModal`. Move it wholesale or leave it; flag for a cleanup PR.
4. **Ham-mode gate uses `authRole || myRole` short-circuit** (`['dev','assistant','controller'].includes(authRole || myRole)`) while the Job Book/Combine gates use `.some(r => r === authRole || r === myRole)`. Consequences: master_technician never gets ham mode, and a user whose `authRole` is set never falls through to `myRole`. Preserve both expressions verbatim.
5. **`controller` is assistant-like everywhere except the Team Labor redirect** — the router's `isAssistant` check is `role === 'assistant'` only, and `showTeamLaborTab` excludes only `assistant`, so controllers see/keep Team Labor while assistants are redirected.
6. **Dual role sources.** `myRole` (own `users` row) and `authRole` (auth hook) are both consulted, inconsistently ordered per gate. Tab flash is prevented by treating `null`+`null` as primary-restricted (`isPrimaryOrUnknown`).
7. **One global `error` state** is shared by every tab and the Sub Labor modal — an error set in one surface renders in others (e.g. a labor-save error shows in the Stages error paragraph). Keep the single state during extraction; pass `error`/`setError` down as today.
8. **Capable-of-Being-Billed math is computed twice** (section header total and again inside the modal IIFE) — keep both call sites; Stage A can share one lib function with identical results.
9. **`bankPaymentsModalBilledRows` deliberately rebuilds the board with an empty search** (`buildJobsStagesBoardLists(jobs, '')`) so AR targets ignore the Stages search and include Collections; `JobsAccountsReceivable.tsx` has a verbatim copy of the memo. Keep both; the lib builder is the single source.
10. **~~Near-duplicate print builders + per-function `escapeHtml`.~~ Resolved (v2.820):** the four printers moved to `lib/jobsDocuments/` — one parameterized sub-sheet core, shared per-file `escapeHtml`, same output bytes. The page keeps thin thunks named as before.
11. **`jobSummaryCostDrilldown` stores a ReactNode in state** (modal body built at click time). Preserve the pattern when the Job Summary data hook extracts.
12. **Optimistic status patch + 300 ms debounced refetch.** `executeUpdateJobStatus` patches `setJobs` immediately, then `scheduleLoadJobsAfterMutation` refetches (also re-running the Job Summary ledger when its snapshot loaded). The follow-cards scroll effect has a 700 ms retry specifically because the refetch re-keys rows. Keep the timings.
13. **`renderStagesOpenDetailJobName` lives at parent scope** (a `useCallback` above the IIFE) while every other stages renderer is an IIFE closure — it moves with the tab regardless; noted so the diff reviewer expects it.
14. **The serialized pipeline is module-level state** (`lib/jobsStagesSerializedPipeline.ts` holds the promise tail in module scope, documented "Used only from Jobs.tsx" — plus `JobsCombineSeparateModal.onAfterSuccess`). If the engine hook lands, the queue stays module-level (it must survive re-renders and be shared with the modal callback).
15. **Duplicated team-labor loader (and type).** Jobs.tsx's inline `loadTeamLaborData` is a near line-for-line copy of `utils/teamLabor.ts`'s exported `loadTeamLaborData(supabase)` — which `CrewJobsBlock` (the Team Labor tab's own body!) and `JobFormModal` actually call, so hopping Team Labor ↔ Crew P&L runs two copies of the same aggregation. Jobs.tsx also re-declares a structurally-matching local `TeamLaborRow` type while `JobsCrewPnlTab`/`JobsJobSummaryTab` import the util's type. Keep the inline copy byte-stable until the adoption PR runs a parity check (per the seam-candidates table).
16. **Ready-to-Bill double-checkbox vs ham one-click.** Non-ham RTB move requires two confirmations (`readyForBillingChecked1/2`); ham mode bypasses all confirms for status moves, invoice delete, and revert. The send-back **invoice** confirm additionally sets a Stripe explainer flag only *after a failed revert* (`sendBackInvoiceStripeExplainerAfterFailure`). Preserve exactly.
17. **Two % complete commit paths with different side effects.** The `StagesProgressPaymentCell` inline editor commits via `updateJobPctComplete` (bare `pct_complete` write); the thread panel's slider commits via `commitStagesPctWithNote` (posts a thread note first, then writes). Both share `pctCompleteSavingId`. They also use different gates: the cell editor renders wherever the table wires it, while the thread slider checks `canEditJobPctComplete` — and the v2.75x-era gates (`canEditJobPctComplete`, `canManageJobPeople`, `canCreateHazmatFee`, `showTaskDispatchButton`) consult **`authRole` only**, never `myRole`, unlike the older dual-source gates (quirk #6). Preserve both paths and every gate expression verbatim.

---

## Recommended extraction order (value ÷ risk)

One tab (or one Stage) per PR; `npm run typecheck && npm run lint && npm test` green after each. Stage-A lib moves ship first and independently.

> The v2.74x–v2.81x feature run already banked some of this incidentally: `lib/stagesMoneyBar.ts`, `lib/jobs/stagesPctNote.ts`, and `lib/hazmatFee.ts` are tested lib kernels, and `StagesProgressPaymentCell` is the first extracted Stages row component — so step 9(a) starts from thinner rows than when this map was first written. The order below is unchanged.

1. ~~**Stage A: print builders → `lib/jobsDocuments/`**~~ **Done (v2.820).** `subLaborSheet.ts` (unified the two sub-sheet printers), `billedAwaitingPaymentReport.ts`, `jobSummaryCostBreakdown.ts`, `printWindow.ts` + tests; removed ~580 lines. The page keeps thin print thunks (the cost-breakdown one still resolves the lazy caches / fetch fallbacks before calling the builder).
2. **`billing` → `JobsBillingTab`.** Smallest inline tab (~235 lines + 2 state vars); validates the wrapper pattern here; `onFillLaborFromBilling` stays a parent callback.
3. **Seam: `useSubLaborLedger`** (ledger + payments + labor book + roster loaders/mutations; behavior-preserving hook extraction).
4. **`sub_sheet_ledger` Stage B ×2:** `JobsSubLaborFormModal` (the 1,230-line inline modal + form state + Add Subcontractor), then fold the payment/backcharge/edit-payment + settings modals into `JobsSubLaborTab`. Biggest non-Stages line win (~1,900 total).
5. **Seam: `useJobsMercuryAllocations`** (Parts/Job Summary shared allocation cache + modal routing), then move the three mercury modals + remaining parts state into `JobsPartsTab`.
6. **Seam: `useJobSummaryData`** (ledger loader + lazy per-job caches + `jobSummaryData` memo) — Job Summary becomes a true thin wrapper; `JobsJobSummaryTab`'s own 2,862-line sub-decomposition is a later, separate track.
7. **Seam: `useJobsStagesMutations`** (the engine table above; locks + busy ids inside; `commitStagesPctWithNote` needs `submitJobThreadNoteWithBody` injected from the thread-notes engine; convergence layer `lib/jobStatusMutationCore.ts` shared with `useDashboardBillingInvoices` as a follow-up).
8. **Stage A: remaining Stages math** (`billedAgingBuckets` bucketing, capable-to-bill kernel) into `lib/jobsStagesBoard.ts`.
9. **`stages` Stage B ×3:** (a) `JobsStagesTable` + `JobsStagesUnifiedTable` components (param lists → props; includes the row renderers, the quick-action stack — which needs `navigate` + the dispatch-task/checklist contexts passed or consumed directly — and `JobThreadNotesPanel` wiring incl. the pct/people props); (b) `JobsStagesTab` carrying toolbar, jump nav, search state, sections, and the single-opener modal cluster — consuming the mutations hook + shared contexts; (c) the send-back/confirm modal cluster, Total-by-Name/Capable modals, and the `HazmatFeeModal`/`ManageJobPeopleModal` openers move in the same PR as their opener sections. The URL router, `customers`/`users`, the cache wiring, and the AR page's parallel mount stay in the parent.
10. **Cleanup PRs (post-decomposition, behavior-changing):** remove the vestigial `'billed'` member and the dead `confirmJobStatusJob` modal; replace the inline `loadTeamLaborData` with the `utils/teamLabor.ts` export after a parity check (quirk #15).

> Already thin/extracted: Reports, Crew P&L, Team Labor, Inspections tabs; `JobsSubLaborTab`/`JobsPartsTab`/`JobsJobSummaryTab` renders; the board-list/StageRow/AR-target kernels; the app modal contexts; `BankPaymentsModal` + the AR wrapper page; `useJobThreadNotes`; `usePartsLedgerData`; the serialized pipeline.
