# Jobs Tabs Architecture Map

---
file: docs/JOBS_TABS_ARCHITECTURE.md
type: Engineering / Refactor Map
purpose: Step-0 map for the Jobs.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md) — inventory what every tab of src/pages/Jobs.tsx touches (state, loaders, handlers, memos, sub-components, supabase tables/RPCs, cross-tab coupling) to drive the multi-PR extraction, with the Stages board and the job-mutation engine mapped in depth.
audience: Developers, AI Agents
last_updated: 2026-07-19
---

## Overview

[`src/pages/Jobs.tsx`](../src/pages/Jobs.tsx) is a ~10,463-line "God component" (as of v2.736: 162 `useState` declarations, 56 `useEffect`, 23 `useMemo`, 26 `useCallback`, ~20 refs). It already shrank from ~15k through ad-hoc extractions **without** a Step-0 map — six tabs are thin(ish) wrappers today, but the remaining inline mass is concentrated in one place: the **Stages** tab (~3,450 lines of inline JSX) plus the **Sub Labor CRUD engine + its inline modal** (~1,900 lines combined). This map follows [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) and the format of [`DASHBOARD_SECTIONS_ARCHITECTURE.md`](./DASHBOARD_SECTIONS_ARCHITECTURE.md) / [`BIDS_TABS_ARCHITECTURE.md`](./BIDS_TABS_ARCHITECTURE.md).

Billing/lifecycle **behavior** (statuses, `update_job_status`, invoice ensure RPC, the three Bill Customer channels, Stripe modes, send-back semantics) is already mapped at the flow level in [`BILLING_FLOWS.md`](./BILLING_FLOWS.md) — this doc cross-references its sections ("Job billing lifecycle", "Invoices (`jobs_ledger_invoices`)", "Send-back / revert paths", "Stripe integration (test/live mode)") instead of restating them. This doc is about **where the code lives and what couples to what**.

The tabs switch on a single `activeTab` state (`JobsTab` union, search `type JobsTab` — module scope, ~line 199 as of v2.736):

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
5. **The file layout is:** module helpers/types (~1–279) → state block (~328–813, every `useState`/`useRef` in the component is declared here) → stages memos + mutation engine (~814–1313) → loaders + Sub Labor CRUD (~1315–2385) → print builders (~2386–3107) → URL router + effects (~3109–3786) → parts/mercury callbacks + memos + job-form glue (~3788–4559) → tab bar (~4561–4732) → per-tab JSX (~4734–8563) → modal tail (~8565–10460). Line numbers are "as of v2.736" and rot — search symbols.
6. **Shared app-level modal contexts** do the heavy lifting: `useJobFormModal` (New/Edit Job — [`JobFormModal`](../src/components/jobs/JobFormModal.tsx), itself a 7,137-line God component with its own future map), `useJobDetailModal` ([`DetailJobModal`](../src/components/jobs/DetailJobModal.tsx)), `useBillCustomerModal` (the three billing channels — see BILLING_FLOWS "The three billing channels (Bill Customer)"). These are already outside the page; the page only opens them via `tryOpenEditJob` / `openStagesDetailJobModal` / `billCustomer.openBillCustomer`.

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
| `stages` | Stages | **~3,450 inline lines** (`activeTab === 'stages'` → IIFE at `(() => {` after the loading block) | **inline — the monster** | ~55 state vars + 2 lock refs | **very high** (mutation engine, board lists, AR modal, 12+ modals, deep links) | high | Multi-PR: seam hook first, then section renderers, then toolbar/modals (see [order](#recommended-extraction-order-value--risk)) |
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
- Row-level pure helpers are extracted too: `lib/jobs/invoiceBilling.ts` (remaining/aging/est-bill-date kernels), `lib/stagesJobReferenceDates.ts` (j:/b: lines), `lib/jobs/jobFormatting.ts`, `lib/jobsStagesScheduleSessionSearch.ts`.
- **What remains inline is ORCHESTRATION:** the memo wiring above; `stagesJobsWithoutCustomer` / `stagesWorkingJobsWithoutPictures` memos + their auto-close effects; `billedAgingBuckets` (30/90-day buckets — inline math over `buildBilledStageRows`, a Stage-A candidate); `bankPaymentsModalBilledRows` (separate `buildJobsStagesBoardLists(jobs, '')` with EMPTY search so AR always sees all billed rows incl. Collections — quirk #9); `accountsReceivableButtonAccessibleName`; `stagesManHoursByJobId` / `stagesLaborBreakdownByJobId` (from `loadStagesManHours`, RPC `get_man_hours_by_job`, load-once ref).

#### Owned local state (moves with the tab, grouped)

- **Search:** `stagesSearchQuery`, `stagesSearchExtraJobIds` + `stagesScheduleSessionSearchBusy` (the debounced schedule/clock-session search effect, 350 ms, via `lib/jobsStagesScheduleSessionSearch`), `stagesIncludeScheduleTimeInSearch` (localStorage `jobs-stages-search-include-schedule-time`), plus the paid-list prefetch-on-search effect.
- **Sections:** `stagesSectionOpen` {waiting/working/readyToBill/billed/collections/paid}, `focusStagesSection` (jump nav scroll), `toggleStages` (closure).
- **Modes:** `stagesHamMode` (localStorage `jobs-stages-ham-mode`), `stagesFollowMoves` (localStorage `jobs-stages-follow-moves`) + `followMovedJob` + the job focus/flash pair `pendingStagesJobFocusId`/`stagesJobFlashId` (scroll-retry effect against `[data-stages-job-id]`).
- **Invoice focus:** `pendingStagesInvoiceFocusId`/`stagesInvoiceFlashId` + `applyStagesInvoiceFocus` (also consumed by the `?stagesInvoice=` deep link and the in-row jump chips) against `[data-stages-invoice-id]`.
- **Busy/locks:** `stagesStatusUpdatingId`, `stagesInvoiceUpdatingId`, `stagesInvoiceMutationLockRef`, `stagesInvoiceSendBackConfirmLockRef`.
- **Modal openers (single-opener, movable):** `billedTotalByNameModalOpen`/`billedTotalByNameExpandedName`, `stagesNoCustomerModalOpen`(+hover), `stagesNoJobPicturesModalOpen`(+hover), `jobBookModalOpen`, `combineSeparateModalOpen`, `capableToBillModalOpen`, `whenInvoiceBillModal`(+date), `invoiceEstimatedBillDateSavingId`, `createPartialInvoiceJob`/`Amount`/`creatingPartialInvoiceFromModal`, `scheduleModalJob`, `viewBillInvoice`, `lienToolingPrefillModal` (+`lienToolingSenderFallback` memo over `users`), `aiaG702StagesJob`, `markPaidJob`/`markPaidInvoice`, `bankPaymentsModalOpen`, `viewReportsJob`, `readyForBillingJob`/`Checked1`/`Checked2`, `sendBackJob`/`sendBackInvoice`/`sendBackChecked`/`sendBackStatusEventLine`/`sendBackInvoiceStripeExplainerAfterFailure`, `sendBackConfirmJob`, `collectionsConfirm`/`collectionsNoteDraft`/`collectionsSaving`, `confirmJobStatusJob` (**dead — quirk #3**).
- **Assigned/pct editors (ham mode):** `assignedEditJobId`/`assignedEditSelectedIds`/`assignedEditSavingId` + `assignedEditDropdownRef` + click-outside effect, `pctCompleteSavingId`.
- **Return-to-edit banner:** `returnEditBannerJobId` + three effects over `lib/returnEditJobFromStages` (sessionStorage handshake written by `JobFormModal`'s "See in Stages").

#### Cross-tab / shared state (stays in the parent)

`jobs`/`setJobs` (context), `customers` (loaded for stages+billing+job-form; feeds `customerListImpliesLinkedRow` "Not in Customers" badges), `users` (assigned-edit dropdown, schedule assignee candidates, lien sender fallback), `error` (global), `stagesManHours*` (loader could move with the tab — single consumer), the `useJobThreadNotes` engine (also consumed by Job Summary — stats for expanded rows), `arBankTxUnallocatedCount` (`useArBankUnallocatedCount`, enabled only on stages), and the entire [mutation engine](#the-job-mutation-engine-seam-candidate).

#### Section renderers (all closures inside the IIFE)

- `renderStagesTable(jobList, actionLabel, onAction, showTimeOpen?, onSendBack?, onSendBackSimple?, showRemaining?, showFinalBill?, showPctComplete?)` — **job-only table** used by Waiting, Working, Paid in Full. Rows include: HCP badge + service pill (`renderStagesJobHcpSubline`), job-name detail-modal button (`renderStagesOpenDetailJobName` — a parent-level useCallback), customer line (+"Not in Customers" flow → `openEditJobAndCreateCustomerFlow`), j:/b:/man-hours lines (`renderStagesFieldAndBillingLines`), assigned-edit dropdown + pct-complete editor (ham mode only; `updateJobTeamMembers` / `updateJobPctComplete`), Click Tooling wrench (`buildClickToolingUrl`), partial-invoice button (`setCreatePartialInvoiceJob`), AIA button (`showAiaG702G703` eligibility → `setAiaG702StagesJob`), Edit / detail / View Reports buttons, last-activity cell (`renderStagesLastActivityCell`), expandable `JobThreadNotesPanel` row, project banner row (`renderStagesProjectBannerRow`), linked-estimate footer (`renderStagesJobColumnEstimateFooter`).
- `renderUnifiedStagesTable(rows: StageRow[], options)` — **mixed job/invoice-row table** used by Ready to Bill, Billed Awaiting Payment, Collections. The 20-key options object (`onJobAction`/`onInvoiceAction`/`onViewBill`/`onJobSendBack`/`onInvoiceSendBack`/`onOpenLienTooling`/`onJobMoveToCollections`/`jobNoteLine`/labels/flags/`flashInvoiceId`) is effectively the future component's prop contract. Adds: est-bill-date ham ±1 buttons (`bumpInvoiceEstimatedBillDate`) and the date modal opener (`setWhenInvoiceBillModal`), Stripe emailed-customer hint + resend (`renderStagesStripeEmailedCustomerHint` → `StripeInvoiceSendFromStripeButton`), invoice jump chips (`renderStagesInvoiceJumpChips` → `applyStagesInvoiceFocus`).
- Smaller closures: `renderJobCustomerLine`, `renderStagesThreadExpandButton`, `renderStagesLastActivityLeadingControls` (schedule icon + thread toggle), `shouldSuppressStagesRowJobThreadToggle`, `stagesRowHasProjectBanner`.
- Section wiring (the return of the IIFE): Waiting → `renderStagesTable(waiting, 'Move to Working', updateJobStatus('working'))`; Working → `'Ready to Bill'` action (ham: direct `moveJobToReadyToBillWithStripePrep`, else `readyForBillingJob` double-checkbox confirm) + send-back-to-waiting + "Capable of Being Billed" modal; Ready to Bill → unified table with Bill Customer actions (`billCustomer.openBillCustomer`, customer-link guard → `openEdit(j, { billingCustomerHighlight: true })`), Send Job Back / `DELETE_DRAFT_BILL_LABEL`; Billed Awaiting Payment → Mark Paid (`BilledPaymentConfirmationModal` ×2), View Bill (`BilledBillViewModal`), Lien Tooling, Move to Collections, send-backs, aging chips + AR button + Print; Collections → Mark Paid / send-back-to-Billed via `collectionsConfirm` (`setJobCollectionsFlag` RPC `set_job_collections_flag`); Paid in Full → lazy `fetchPaidJobsIfNeeded` on expand, send-back-to-billed.
- Inline modals inside the IIFE: **Total by Name** (`billedTotalByNameModalOpen`, groups `billedActiveRows` by job name), **Capable of Being Billed** breakdown, **est-bill-date** (`whenInvoiceBillModal`).

#### Deep links & URL router (stays in the parent)

`?edit=` (forces stages, opens Edit Job), `?jobDetail=` (+location-state prefill), `?newJob=true` (stages/billing → JobFormModal; sub_sheet_ledger → labor modal), `?editLabor=` (forces sub_sheet_ledger), `?editParts=` (forces parts, expands+scrolls), `?openBankPayments=` (forces stages, opens AR modal, role-gated), `?stagesInvoice=` (focus+flash via `applyStagesInvoiceFocus`), `?stagesSection=` (open+scroll a section), `?showBilledTotalByName=true`, `?jobSummaryHcp=` (seeds Job Summary search), `?teamLaborJob=` (Team Labor focus), `?customer=` (jobs fetch filter + banner). All strip themselves with `setSearchParams(..., { replace: true })`.

#### The always-open AR wrapper page

[`src/pages/JobsAccountsReceivable.tsx`](../src/pages/JobsAccountsReceivable.tsx) (90 lines, route outside this page) re-implements the minimal substrate: `useJobsListCache` + its own `runFetchJobs(null)` effect + a **verbatim copy** of the `bankPaymentsModalBilledRows` memo (`buildJobsStagesBoardLists(jobs, '').billedRows`) + an always-`open` [`BankPaymentsModal`](../src/components/jobs/BankPaymentsModal.tsx) (1,482 lines, extracted) + `useJobFormModal` edit glue. Role gate `canRoleSeeArBankUnallocatedOrgNudge`. **Sharing model:** the two pages share the modal component and the lib builder, not any Jobs.tsx code — when Stages extracts, keep the AR target derivation in `lib/jobsStagesBoard.ts` (it already is) so both stay in lockstep. Cross-ref BILLING_FLOWS "Payments (`jobs_ledger_payments`)" and "Routes map".

#### Supabase (stages-only surface)

RPCs `update_job_status`, `delete_billed_invoice_on_send_back`, `delete_ready_to_bill_invoice`, `ensure_single_ready_to_bill_invoice_for_job`, `get_man_hours_by_job`, `set_job_collections_flag` (lib); tables `jobs_ledger` (pct_complete update), `jobs_ledger_invoices` (partial-invoice insert, est-bill-date update), `jobs_ledger_team_members` (assigned edit), `job_status_events` (send-back context line), `customers`; edge functions via `lib/voidStripeInvoiceForRevert` (see BILLING_FLOWS "Stripe integration (test/live mode)" and "Send-back / revert paths"); schedule/clock search via `lib/jobsStagesScheduleSessionSearch`; thread notes via `useJobThreadNotes` RPCs.

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
- **Extraction status + risk + approach:** **Partial; the biggest non-Stages win (~1,900 lines).** Stage A: the two print builders → `lib/jobsDocuments/subLaborSheet.ts` (one parameterized builder + tests — they differ only in data source); labor-line math already in `lib/peopleLaborJobItemLineCost`/`lib/jobs/subLaborCost`. Stage B in two PRs: (1) `useSubLaborLedger` hook (ledger + payments + labor-book + roster loaders and mutations); (2) `JobsSubLaborFormModal` component (the 1,230-line modal + form state + labor-book pickers + Add Subcontractor). `JobsSubLaborTab` then absorbs the payment/backcharge/edit-payment modals (single-opener). Drive/default-rate settings modals can move with the tab (openers only there). What stays: `loadTeamLaborData` consumers' wiring; the Billing→Sub Labor prefill callback.

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
- **Extraction status + risk + approach:** **Partial.** Stage A: `printJobSummaryCostBreakdown` → `lib/jobsDocuments/jobSummaryCostBreakdown.ts` (takes the explicit opts object it already has — near-mechanical); `jobSummaryData` math → `lib/jobSummaryPnl.ts` + tests. Stage B: `useJobSummaryData` hook (ledger loader + lazy caches + the memo). The drilldown-modal ReactNode state (`jobSummaryCostDrilldown`) is an anti-pattern to preserve as-is during the move (quirk #11).

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
| (adjacent) `setInvoiceEstimatedBillDate`/`bumpInvoiceEstimatedBillDate`, `updateJobTeamMembers`, `updateJobPctComplete`, `createInvoiceFromModal` (partial invoice + ensure RPC), collections via `setJobCollectionsFlag` | row-level writes; each patches or reloads `jobs` | no | n/a (Dashboard has mark-paid instead) |

**Inputs the hook needs:** `setJobs` + `loadJobs`/`scheduleLoadJobsAfterMutation` (from the cache context), `authRole` (Stripe mode via `stripeModeForBillingFromRole`), `setError`, `showToast`, `followMovedJob` (or return the moved-job event and let the tab react), the two busy-id states, and the lock refs (declare them inside the hook).

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
| `BilledBillViewModal`, `LienToolingPrefillModal`, `AiaG702G703Modal`, `BilledPaymentConfirmationModal` ×2, `ScheduleJobModal`, `JobBookModal`, `JobsCombineSeparateModal`, `StagesNoCustomerJobsModal`, `StagesAlertJobListModal`, Total-by-Name / Capable-to-Bill / est-bill-date / partial-invoice / Ready-to-Bill / send-back ×3 / collections / dead confirm (inline) | components / inline | Stages only | move with Stages |
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
| [`useJobThreadNotes`](../src/hooks/useJobThreadNotes.ts) (489 lines) | thread notes/activity/stats engine | Stages last-activity cells + `JobThreadNotesPanel`, Job Summary expanded rows |
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
| Print builders | `printLaborSubSheet`/`printJobSubSheet`/`printJobSummaryCostBreakdown`/`printBilledAwaitingPaymentReport` (~2386–3107) | Sub Labor, Job Summary, Stages | `lib/jobsDocuments/*` + tests (Stage A, ship first) |

### Parent-forever glue

- The **URL deep-link router** (all `?tab=`/`?edit=`/`?jobDetail=`/`?newJob=`/`?editLabor=`/`?editParts=`/`?openBankPayments=`/`?stagesInvoice=`/`?stagesSection=`/`?customer=` effects) and `activeTab` itself.
- The app contexts (`jobFormModal`, `jobDetailModal`, `billCustomer`, toast) and `tryOpenEditJob`'s busy-gate.
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
10. **Near-duplicate print builders + per-function `escapeHtml`.** `printLaborSubSheet` vs `printJobSubSheet` differ only in data source; all four print functions re-declare `escapeHtml` and repeat the print CSS. Consolidate only in the Stage-A lib move (same output bytes).
11. **`jobSummaryCostDrilldown` stores a ReactNode in state** (modal body built at click time). Preserve the pattern when the Job Summary data hook extracts.
12. **Optimistic status patch + 300 ms debounced refetch.** `executeUpdateJobStatus` patches `setJobs` immediately, then `scheduleLoadJobsAfterMutation` refetches (also re-running the Job Summary ledger when its snapshot loaded). The follow-cards scroll effect has a 700 ms retry specifically because the refetch re-keys rows. Keep the timings.
13. **`renderStagesOpenDetailJobName` lives at parent scope** (a `useCallback` above the IIFE) while every other stages renderer is an IIFE closure — it moves with the tab regardless; noted so the diff reviewer expects it.
14. **The serialized pipeline is module-level state** (`lib/jobsStagesSerializedPipeline.ts` holds the promise tail in module scope, documented "Used only from Jobs.tsx" — plus `JobsCombineSeparateModal.onAfterSuccess`). If the engine hook lands, the queue stays module-level (it must survive re-renders and be shared with the modal callback).
15. **Duplicated team-labor loader (and type).** Jobs.tsx's inline `loadTeamLaborData` is a near line-for-line copy of `utils/teamLabor.ts`'s exported `loadTeamLaborData(supabase)` — which `CrewJobsBlock` (the Team Labor tab's own body!) and `JobFormModal` actually call, so hopping Team Labor ↔ Crew P&L runs two copies of the same aggregation. Jobs.tsx also re-declares a structurally-matching local `TeamLaborRow` type while `JobsCrewPnlTab`/`JobsJobSummaryTab` import the util's type. Keep the inline copy byte-stable until the adoption PR runs a parity check (per the seam-candidates table).
16. **Ready-to-Bill double-checkbox vs ham one-click.** Non-ham RTB move requires two confirmations (`readyForBillingChecked1/2`); ham mode bypasses all confirms for status moves, invoice delete, and revert. The send-back **invoice** confirm additionally sets a Stripe explainer flag only *after a failed revert* (`sendBackInvoiceStripeExplainerAfterFailure`). Preserve exactly.

---

## Recommended extraction order (value ÷ risk)

One tab (or one Stage) per PR; `npm run typecheck && npm run lint && npm test` green after each. Stage-A lib moves ship first and independently.

1. **Stage A: print builders → `lib/jobsDocuments/`** (`subLaborSheet.ts` unifying the two sub-sheet printers, `billedAwaitingPaymentReport.ts`, `jobSummaryCostBreakdown.ts`) + tests. Zero UI risk, removes ~700 lines, and unblocks Sub Labor/Job Summary/Stages moves.
2. **`billing` → `JobsBillingTab`.** Smallest inline tab (~235 lines + 2 state vars); validates the wrapper pattern here; `onFillLaborFromBilling` stays a parent callback.
3. **Seam: `useSubLaborLedger`** (ledger + payments + labor book + roster loaders/mutations; behavior-preserving hook extraction).
4. **`sub_sheet_ledger` Stage B ×2:** `JobsSubLaborFormModal` (the 1,230-line inline modal + form state + Add Subcontractor), then fold the payment/backcharge/edit-payment + settings modals into `JobsSubLaborTab`. Biggest non-Stages line win (~1,900 total).
5. **Seam: `useJobsMercuryAllocations`** (Parts/Job Summary shared allocation cache + modal routing), then move the three mercury modals + remaining parts state into `JobsPartsTab`.
6. **Seam: `useJobSummaryData`** (ledger loader + lazy per-job caches + `jobSummaryData` memo) — Job Summary becomes a true thin wrapper; `JobsJobSummaryTab`'s own 2,862-line sub-decomposition is a later, separate track.
7. **Seam: `useJobsStagesMutations`** (the engine table above; locks + busy ids inside; convergence layer `lib/jobStatusMutationCore.ts` shared with `useDashboardBillingInvoices` as a follow-up).
8. **Stage A: remaining Stages math** (`billedAgingBuckets` bucketing, capable-to-bill kernel) into `lib/jobsStagesBoard.ts`.
9. **`stages` Stage B ×3:** (a) `JobsStagesTable` + `JobsStagesUnifiedTable` components (param lists → props; includes the row renderers and `JobThreadNotesPanel` wiring); (b) `JobsStagesTab` carrying toolbar, jump nav, search state, sections, and the single-opener modal cluster — consuming the mutations hook + shared contexts; (c) the send-back/confirm modal cluster and Total-by-Name/Capable modals move in the same PR as their opener sections. The URL router, `customers`/`users`, the cache wiring, and the AR page's parallel mount stay in the parent.
10. **Cleanup PRs (post-decomposition, behavior-changing):** remove the vestigial `'billed'` member and the dead `confirmJobStatusJob` modal; replace the inline `loadTeamLaborData` with the `utils/teamLabor.ts` export after a parity check (quirk #15).

> Already thin/extracted: Reports, Crew P&L, Team Labor, Inspections tabs; `JobsSubLaborTab`/`JobsPartsTab`/`JobsJobSummaryTab` renders; the board-list/StageRow/AR-target kernels; the app modal contexts; `BankPaymentsModal` + the AR wrapper page; `useJobThreadNotes`; `usePartsLedgerData`; the serialized pipeline.
