# Jobs Tabs Architecture Map

---
file: docs/JOBS_TABS_ARCHITECTURE.md
type: Engineering / Refactor Map
purpose: Step-0 map for src/pages/Jobs.tsx (per PAGE_DECOMPOSITION_PLAYBOOK.md) — the Jobs page's tab router and shared-substrate host. Inventories what every tab's render, page-side state, loaders, effects, deep links and role gates touch, maps the page-side Pipeline contract (60 props + the imperative handle), the Pipeline burn card and the Job Summary P&L join in depth, and ranks what is left to extract. Tab internals live in the per-tab maps it links.
covers:
  - src/pages/Jobs.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
---

## Overview

[`src/pages/Jobs.tsx`](../src/pages/Jobs.tsx) is a **tab router + shared-substrate host**, not a God component. At `a05cef4c4` it is **2,274 lines**: module types/consts (82–102) and one component `Jobs` (104–2274, render 1700–2273). Hook census (fact sheet): **27 `useState`**, 0 `useReducer`, **38 effects**, **11 `useMemo`**, **7 `useCallback`**, **8 `useRef`**, **21 custom-hook calls**; 12 inner handlers; 109 commits in the 90 days to 2026-09-24. Direct data: tables `users`, `people`, `customers`, `jobs_ledger_team_members`, `app_settings`, `mercury_transaction_job_allocations`; RPC `get_invoice_allocation_lines_for_jobs` (both in the print thunk). The v2.820–v2.831 extraction train took it from 10,684 to 1,990 lines (print builders → lib, `JobsBillingTab`, `useSubLaborLedger`, `JobsSubLaborFormModal`, `SubLaborPaymentModals`, `useJobsMercuryAllocations`, `useJobSummaryData`, `useJobsStagesMutations`, Stages math → lib, the Stages tables, `JobsStagesTab`); feature work since has added +284 lines — the Subs fold, the Pipeline burn card, the Job Summary view/budget hooks, six more deep links, role-gate bounces — almost all of it router effects and cross-tab joins, not tab UI.

> **Line numbers are as of `a05cef4c4`** (from `npm run map -- src/pages/Jobs.tsx`). They rot — search the symbol; every region below is anchored by name *and* range.

> **Refreshed 2026-09-25** against `a05cef4c4` (the previous full pass was v2.831). What changed on the page: `sub_sheet_ledger` + `work_orders` folded into one **`subs`** tab (v2.2927); the Drive Settings / Default Labor Rate modals were removed (v2.1631, values only); the Billing → Sub Labor "Add Labor" fill was retired (v2.1623); the duplicated team-labor loader now calls the util (v2.1625); the dead `confirmJobStatusJob` modal is gone (v2.3545); the Pipeline burn card (v2.3191/v2.3300), `useJobSummaryView` (v2.2692), `useJobBudgetFootings`, `useRoleGate` bounces (v2.2882), the card-charge short-circuit (v2.3569) and the `?stagesWeekly=` / `?stagesMoney=` / `?stagesMove=` / `?legal=` / `?job=` / `?editFocus=` deep links landed. `JobsStagesTab` grew to 5,099 lines and has its own map.

Billing/lifecycle **behavior** (statuses, `update_job_status`, invoice ensure RPC, the three Bill Customer channels, Stripe modes, send-back semantics) is mapped in [`BILLING_FLOWS.md`](./BILLING_FLOWS.md) ("Job billing lifecycle", "Invoices (`jobs_ledger_invoices`)", "Send-back / revert paths", "Stripe integration (test/live mode)"). This doc is about **where the code lives and what couples to what**. Deeper maps: Pipeline internals → [`JOBS_STAGES_TAB_ARCHITECTURE.md`](./JOBS_STAGES_TAB_ARCHITECTURE.md); Job Summary internals → [`JOBS_JOB_SUMMARY_TAB_ARCHITECTURE.md`](./JOBS_JOB_SUMMARY_TAB_ARCHITECTURE.md); `JobsSubLaborFormModal` / `DetailJobModal` / `JobsCombineSeparateModal` → [`JOBS_MODALS_ARCHITECTURE.md`](./JOBS_MODALS_ARCHITECTURE.md); New/Edit Job → [`JOB_FORM_MODAL_ARCHITECTURE.md`](./JOB_FORM_MODAL_ARCHITECTURE.md).

The tabs switch on one `activeTab` state (`JobsTab` union, `type JobsTab` line 88; `JOBS_TABS` line 96):

```
'reports' | 'stages' | 'billing' | 'subs' | 'combined-labor'
| 'teams-summary' | 'parts' | 'job-summary' | 'inspections' | 'billed'
```

Tab-button labels differ from keys: `stages` = **Pipeline** (key, URL slug and filenames unchanged since the v2.1251 rename), `teams-summary` = **Crew P&L**, `combined-labor` = **Team**, `subs` = **Subs** (Work / Pay switch). `SUBS_TAB_ALIASES` (line 98) rewrites the retired slugs: `work_orders` → Subs Work, `sub_sheet_ledger` / `labor` → Subs Pay. **`'billed'` is vestigial** — in the union and `JOBS_TABS`, no button, the router rewrites it to `stages` ([quirk #1](#quirks-preserve-dont-fix)).

### Key structural facts

1. **The jobs list does NOT live in this page.** `jobs`/`setJobs` and 12 more cache values (loading/refreshing/snapshot/error flags, `runFetchJobs`, `runFetchScopes`, `refreshMergedScopes`, `refreshHeaderStats`, `fetchPaidJobsIfNeeded`) are destructured from the app-level [`JobsListCacheContext`](../src/contexts/JobsListCacheContext.tsx) at 139–154, shared with `JobDetailModalContext`, the Quickfill sections, `DashboardArDepositsModal` and [`JobsAccountsReceivable.tsx`](../src/pages/JobsAccountsReceivable.tsx). `loadJobs` (219–228) = `runFetchJobs(customerFilterForFetch)` + a forced `refreshHeaderStats`. Pipeline's scoped load paints from the primary rows and enriches after (v2.3600): `fetchJobsLedgerStagesPrimary` → `setJobs` → flags clear → `fetchStagesEnrichment` once across the open sections (`get_stages_enrichment` RPC, chunked passes as fallback) → `patchJobsById`; `jobsListEnriching` is true in between. Since v2.3610 the cache can hand the board the rows this device last saw (`jobsListSnapshotAt`, passed to the tab).
2. **The shared load runs only for the tabs in [`JOBS_TABS_THAT_LOAD_THE_JOBS_LIST`](../src/lib/jobsListLoadGate.ts)** — `stages` / `billing` / `parts` / `subs` / `job-summary` (tested). `shouldLoadJobsListForActiveTab` (710) gates the load effect (712–733, 50 ms debounce): Pipeline calls `loadJobsScopedForStages` (236–238, scopes from `readStagesSectionOpenPrefs`), other tabs `loadJobsForTab` (243–246); both pass `kind: 'tab'` so a switch back within 30 s of a complete load is free (`boardIsFreshForTab`, [`lib/jobs/boardRefetchTtl.ts`](../src/lib/jobs/boardRefetchTtl.ts), v2.3603). Crew P&L and Reports render off whatever the cache holds ([quirk #2](#quirks-preserve-dont-fix)). Job Summary paints from its **own** full-org loader in `useJobSummaryData` that ignores `?customer=`.
3. **No realtime.** Refetch on `visibilitychange` (735–745, same tab gate; Pipeline → `refreshMergedScopes`, others → `runFetchJobs`) and via two debounce timers: `loadJobsFromEffectTimerRef` (50 ms) and `loadJobsAfterMutationTimerRef` (300 ms, `scheduleLoadJobsAfterMutation` 267–284 — Pipeline refreshes only its merged scopes, other tabs full-reload, header stats forced, and the Job Summary ledger re-runs when its snapshot was ever loaded). Cleanup effect 477–488.
4. **All Pipeline status/invoice mutations are serialized** through [`runJobsStagesSerializedPipeline`](../src/lib/jobsStagesSerializedPipeline.ts) (module-level promise tail, 14 lines; callers `useJobsStagesMutations` and `JobsStagesTab`). The Dashboard's parallel engine (`useDashboardBillingInvoices`) is *not* serialized — see [the job-mutation engine](#the-job-mutation-engine-seam-candidate).
5. **Layout:** see [Page regions](#page-regions-as-of-a05cef4c4) — the order is hooks/state → loaders + print thunks → load effects → the URL router + deep-link effects → tab-keyed loader effects → cross-tab joins (`jobSummaryData`, burn alert) → job-form glue → tab bar → per-tab renders → always-mounted modal tail.
6. **Shared app-level modal contexts** do the heavy lifting: `useJobFormModal` (New/Edit Job — [`JobFormModal`](../src/components/jobs/JobFormModal.tsx), 5,457 lines, its own map), `useJobDetailModal` ([`DetailJobModal`](../src/components/jobs/DetailJobModal.tsx)), `useBillCustomerModal` (BILLING_FLOWS "The three billing channels (Bill Customer)"). The Pipeline row quick actions also consume `useDispatchTaskModal` / `useChecklistAddModal` — called in the section tables (`JobsStagesTable`, `JobsStagesUnifiedTable`, `JobsStagesCardList`) and handed to `jobsStagesRowShared.tsx`'s renderers through the row context, not the page. The page only opens contexts via `tryOpenEditJob` (256–265, busy-gated) / `openNew` / `openEdit` / `openEditJobAndCreateCustomerFlow` (1643–1678) / `openStagesDetailJobModal` (436–448) / `billCustomer` (passed through).

### Page regions (as of a05cef4c4)

| Region | Symbols | Lines | Serves | Tests |
|---|---|---|---|---|
| URL param reads + Team focus glue | `customerFilterForFetch` (memo) + ref, `teamLaborJobParam`/`teamWeekParam`/`teamExceptionsParam`, `onFocusTeamLaborConsumed` | 108–128 | Team, all loaders | — |
| Contexts + cache destructure | `useAuth`, `useMatchMedia` ×2 (`shortNewJobButtonLabel`, `stickyTabStrip`), `useMercuryLedgerNicknames`, toast, job form, bill customer, `useJobsListCache`, `useJobDetailModal` | 130–155 | all | — |
| `activeTab` + Pipeline burn arming | `activeTab`/`activeTabRef`, `pipelineBurnWanted`, `pipelineBurnArmed` + effect, `pipelineBurnReportIds`; then the shared `users` / `people` / `error` states (177–179) | 156–179 | router, Pipeline, Job Summary loaders; roster + `error` → every tab | `showJobCostBreakdownTeamLabor` (jobDetailModalRole.test.ts); arming untested |
| Job Summary data seam | `useJobSummaryData` destructure (21 values) | 186–208 | Job Summary, burn, print | hook untested |
| Jobs-list load wiring | timers, `ensurePaidJobsLoaded`, `loadJobs`, `loadJobsScopedForStages`, `loadJobsForTab`, `jobsListPipelineBusy`, `pendingNewJobFocusId`, `tryOpenEditJob`, `scheduleLoadJobsAfterMutation` | 209–284 | every cache tab | `stagesSectionPrefs.test.ts`, `boardRefetchTtl.test.ts` |
| Subs ledger seam + handle refs | `customers`, `editingLaborJob`, drive/rate values, `useSubLaborLedger` (18 values), `myRole`, `useRoleGate`, `subLaborFormRef`/`subLaborPaymentModalsRef`/`subLaborPaymentMoveRemoveRef`/`stagesTabRef` | 286–333 | Subs, Crew P&L, Job Summary, Billing; Pipeline (`customers`, `stagesTabRef`) | hook untested; `useRoleGate.render.test.tsx` |
| Parts + mercury seam | `canAccessBankingForParts`, `teamLaborData`/`teamLaborLoading`, `usePartsLedgerData`, Parts/Subs/Job Summary UI state, `jobListForCardCharges`, `useJobsMercuryAllocations` (27 values), `pendingScrollToPartsJobId`, `openStagesDetailJobModal` | 335–448 | Parts, Job Summary, burn | hooks untested; `fetchMercuryJobAllocationsWithAttributionForJob.test.ts` |
| Thread-notes + mutation seams | `useJobThreadNotes` (15 values), JS thread-stats effect, timer cleanup, `useJobsStagesMutations` (12 values) | 452–521 | Pipeline, Job Summary | hooks untested |
| Loaders + print thunks | `loadUsers`, `loadRoster`, `loadTeamLaborData`, `printJobSubSheet`, `printJobSummaryCostBreakdown` | 524–703 | Subs, Pipeline (`users`), Crew P&L, Job Summary | `utils/teamLabor.test.ts`, `subLaborSheet.test.ts`, `jobSummaryCostBreakdown.test.ts`; thunk's fetch fallback untested |
| Load effects | tab load (also runs `loadUsers` on every tab, 714 — `myRole` + the roster), visibility, customers (Pipeline / Billing / while the job form is open) | 706–759 | cache tabs; `loadUsers` → all | `jobsListLoadGate.test.ts`, `customerArchive.test.ts` |
| URL tab router | one effect on `[searchParams, myRole, authRole, roleGateBounce]` | 761–922 | all | `roleGate.test.ts`; e2e `jobs-tabs.spec.ts` |
| Deep-link effects | `?newJob=`, `?edit=`, `?jobDetail=`, `?stagesWeekly=`, `?stagesMoney=`, `?stagesMove=`, `?openBankPayments=`, `?legal=`, `?editLabor=`, `?editParts=` (+scroll), `?stagesInvoice=`, `?stagesSection=`, `?stagesJob=`, `?job=` (money story), new-job reveal, `?showBilledTotalByName=` | 924–1340 | Pipeline (10 handle calls), Subs, Parts, Job Summary | `moneyStoryDoor.test.ts`, `stagesMoneyMoveLink.test.ts`, `weeklyMoneyReportLink.test.ts`; e2e `deep-links.spec.ts` (7 links); effects untested |
| Tab-keyed loader effects | roster (1321–1326), labor jobs (1343–1348), team labor (1350–1355), drive + default rate (1444–1452) + `loadDriveSettings`/`loadDefaultLaborRate` | 1321–1459 | Subs, Billing, Team, Crew P&L, Job Summary, burn | — |
| Job Summary lazy-load effects | clock sessions, mercury, invoice lines, reports, ledger load, `?jobSummaryHcp=` seed | 1358–1405 | Job Summary | — |
| Parts effects | close all-jobs on leave, all-jobs refetch, per-row mercury, `myJobIds` | 1407–1434 | Parts | — |
| Cross-tab joins | `laborJobHcps`, `teamLaborJobIds`, **`jobSummaryData`**, `jobSummaryUserNameById`, `jobSummaryJobIds`, `useJobBudgetFootings`, `useJobSummaryView`, **`pipelineBurnAlert`**, `subLaborOutstandingByPerson` (+`subLaborDueTotal`) | 1464–1631 | Billing, Job Summary, Pipeline, Subs | `subLaborOutstanding.test.ts`, `jobSummaryBurn.test.ts`, `subLaborCost.test.ts`; **`jobSummaryData` math untested** |
| Job-form glue | `refreshCustomersAfterJobFormSave`, `openNew`, `openEdit`, `openEditJobAndCreateCustomerFlow` | 1633–1678 | Pipeline, Billing, Subs Work | — |
| Tab-visibility flags | `isPrimaryOrUnknown` … `subsView` | 1686–1698 | tab bar, Subs | `subsViewFromParam` via `JobsSubsTab.render.test.tsx` |
| Render: tab strip + customer banner | 9 tab buttons, sticky on phones (v2.3749) | 1702–1881 | — | e2e `jobs-tabs.spec.ts` |
| Render: tabs | Reports 1883–1900, `JobsStagesTab` 1907–1976, Subs 1978–2043, Team 2045–2052, Billing 2054–2070, Crew P&L 2072–2082, Parts 2084–2112, Job Summary 2114–2163, Inspections 2165–2167 | 1883–2167 | — | see dossiers |
| Render: always-mounted modal tail | `JobsSubLaborFormModal` 2169–2198, `SubLaborPaymentModals` 2202–2209, `SubLaborPaymentMoveRemoveModals` 2210–2217, mercury trio 2218–2262, `JobSummaryCostCellDrilldownModal` 2263–2271 | 2169–2271 | Subs, Parts, Job Summary | see dossiers |

No test renders `Jobs.tsx` itself; the page is covered only by the e2e smoke specs above and the render tests of its children.

### How to read a dossier

Each tab lists: render location (symbol + range), **owned page state** (moves with the tab), **cross-tab/shared state** (stays in the parent), derived memos, handlers/effects, data deps (tables/RPCs), sub-components, coupling, tests, and **status + risk + next move** (Stage A = pure logic → `lib/*` + tests first; Stage B = component move).

### How to maintain this doc

- Regenerate the fact sheet (`npm run map -- src/pages/Jobs.tsx`), amend the ranges and counts in place, and bump `mapped_at`.
- Flip a tab's Status and point at the new file whenever something is extracted; record what stayed in the parent and why. Tab internals belong in the per-tab maps, not here.

---

## Master summary table

Tabs in tab-bar order (Crew P&L first), then the vestigial member. "Page state" counts the page's `useState`s that serve only that tab (27 total = 9 shared — `activeTab`, `myRole`, `error`, `users`, `customers`, `driveMileageCost` / `driveTimePerMile`, `teamLaborData` / `teamLaborLoading` — + 2 Pipeline + 5 Subs + 5 Parts + 6 Job Summary).

| Tab key | Label | Render (as of a05cef4c4) | Status | Page state | Coupling | Risk | Tests | Recommended action |
|---|---|---|---|---|---|---|---|---|
| `teams-summary` | Crew P&L | `<JobsCrewPnlTab/>` 2072–2082 (639 lines, 7 props) | extracted | 0 | med (`jobs` + `laborJobs` + `teamLaborData` + drive values — parent loaders) | — | `crewPnlSummary.test.ts`; no render test | Done |
| `reports` | Reports | `<ErrorBoundary><JobsReportsTab/>` 1883–1900 (515 lines, 12 props) | extracted (self-loading) | 0 | low | — | no render test | Done |
| `stages` | Pipeline | **always-mounted** `<JobsStagesTab ref active/>` 1907–1976 (5,099 lines, **60 props** + 11-method handle) | **extracted (v2.831)**; internal train v2.3530–v2.3549 → [its map](./JOBS_STAGES_TAB_ARCHITECTURE.md) | 2 (`pendingNewJobFocusId`, `pipelineBurnArmed`) | high (60 props; 10 router effects drive the handle; the burn card reads the Job Summary join) | med | `JobsStagesTab.render.test.tsx`; e2e `stages-board.spec.ts` | Page-side: burn seam + deep-link kernel (steps 12–13) |
| `billing` | Billing | `<JobsBillingTab/>` 2054–2070 (344 lines, 13 props) | extracted (v2.821) | 0 | low-med (`laborJobHcps` / `teamLaborJobIds` / `teamLaborLoading` injected) | — | render test + `billingTab.test.ts` | Done |
| `combined-labor` | Team | `<JobsTeamTab/>` 2045–2052 (170 lines) | extracted (v2.2974, self-loading) | 0 | low (`teamLaborJob` / `teamWeek` / `teamExceptions` params) | — | render test + `teamBoard.test.ts` | Done |
| `subs` | Subs | `<JobsSubsTab/>` 1978–2043 (75-line Work/Pay shell) → Work `JobsSubsWorkView` (1,312) / Pay `JobsSubLaborTab` (875) + 3 always-mounted modals (2169–2217) | **extracted** (v2.2927 fold) | 5 | med (3 imperative handles; roster shared with Pipeline `users`; 6 deep-link inputs) | low | render tests (shell, Work, form modal, payments); none for Pay list / move-remove | Optional Pay-glue wrapper (step 16) |
| `parts` | Parts | `<JobsPartsTab/>` 2084–2112 (627 lines, 25 props) + mercury trio in the tail 2218–2262 | **partial** | 5 + 6 effects | med (mercury hook shared with Job Summary) | med | no render tests; mercury fetch kernels tested | Move the two parts-only modals + UI state in (step 14) |
| `job-summary` | Job Summary | `<JobsJobSummaryTab/>` 2114–2163 (3,276 lines, **44 props**, 0 hooks — fully controlled) | **seams done** (`useJobSummaryData` v2.826, `useJobSummaryView` v2.2692); P&L join page-side | 6 + 8 effects + 2 join memos | high (the join tab; `jobSummaryData` also feeds the Pipeline burn card and the print thunk) | **med-high — 95-line money memo untested** | no render test; many `lib/jobs/jobSummary*` kernels tested | Stage A first (steps 10–11) |
| `inspections` | Inspections | `<JobsInspectionsTab/>` 2165–2167 (777 lines, 3 props) | extracted (self-contained) | 0 | none (`error` only) | — | no render test | Done |
| `billed` | — | no button; router rewrites to `stages` (904–910) | **vestigial** | 0 | — | — | — | Cleanup PR (step 17) |

> Status legend: `inline` = rendered directly in `Jobs.tsx`; `partial` = child component exists but state/engine/modal mass remains in the parent; `extracted` = thin wrapper.

---

## Role-gating matrix

Two role sources are checked in parallel almost everywhere: `authRole` (`useAuth`) and `myRole` (set by `loadUsers` from the user's own `users.role` row — quirk #6). `isAssistantLike` = `assistant | controller`.

### Tab visibility (flags at 1686–1698)

| Tab | dev | master_technician | assistant | controller | estimator | primary | superintendent |
|---|---|---|---|---|---|---|---|
| Crew P&L (`showTeamsTab`) | ✓ | — | — | — | ✓ | — | — |
| Reports | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pipeline, Billing (`showStagesAndBillingTabs`) | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Team (`showTeamLaborTab`) | ✓ | ✓ | — | ✓ (quirk #5) | ✓ | — | — |
| Subs (`showPrimaryRestrictedTabs`) | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ **Pay only** (`subsViewFromParam(view, canSeeWork=false)` → `'pay'`) |
| Parts, Job Summary, Inspections (`showSuperintendentExtraTabs`) | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |

`null`+`null` roles count as primary-restricted (`isPrimaryOrUnknown`, 1687) so the bar never flashes wrong tabs.

**The URL router** (761–922) enforces the same on deep links, in this order: `SUBS_TAB_ALIASES` rewrite → `?edit=` forces `stages` → `?editLabor=` forces `subs&view=pay` → `?editParts=` forces `parts` → `?openBankPayments=` / `?legal=` force `stages` when `canRoleSeeArBankUnallocatedOrgNudge(authRole)` → legacy `receivables`→`reports`, `ledger`→`billing` → role bounces through `useRoleGate` (v2.2882: toast once, then land; keys `team-labor` for assistants on `combined-labor`, `crew-pnl` for master/assistant-like on `teams-summary`, both for superintendents, `jobs-tab` for any other disallowed tab) → superintendent allowed `reports`/`subs`, default `reports` → primary allowed `reports` only → `billed`→`stages` → any `JOBS_TABS` member → no tab defaults to `stages`.

### Page-side gates (in `Jobs.tsx`)

| Capability | Expression (verbatim) | Line |
|---|---|---|
| Parts / Job Summary banking + mercury quick-add (`canAccessBankingForParts`) | dev / master / assistant-like on `authRole` **or** `myRole` | 335–344 |
| Pipeline burn card (`pipelineBurnWanted`) | `activeTab === 'stages' && showJobCostBreakdownTeamLabor(authRole)` (dev / master / controller) | 162 |
| `?stagesMoney=` | `authRole ?? myRole` ∈ dev / controller; master + assistant-like get a `pipeline-money` bounce | 1062–1070 |
| `?openBankPayments=`, `?legal=` | `canRoleSeeArBankUnallocatedOrgNudge(authRole)` (dev / master / assistant-like); waits while `authRole == null` | 1126, 1162 |
| Job Summary Session notes (`canOpenSessionNotes`) | `['dev','master_technician','assistant','controller'].some(r => r === authRole \|\| r === myRole)` | 2126 |
| Job Summary Team Labor + Profit columns (`showTeamLaborAndProfit`) | `authRole` ∈ dev / master / **controller** (not assistant) | 2151 |
| Job Summary overhead dials (`canEditOverheadDials`) | `authRole === 'dev'` | 2152 |
| Subs Work view (`canSeeWork`) | `showSuperintendentExtraTabs` | 1981 |

### Pipeline in-tab gates

Every Pipeline gate (Job Book / Combine, Ham + Edit mode, AR, Collections, Schedule, % complete, manage people, Hazmat, money charts) lives in [`lib/jobs/stagesRoleGates.ts`](../src/lib/jobs/stagesRoleGates.ts) since v2.3531, pinned per role by `stagesRoleGates.test.ts`; the dossier is in the [Stages map](./JOBS_STAGES_TAB_ARCHITECTURE.md). Two shapes survive verbatim there: `canSeeStagesPowerToggles` judges `authRole || myRole` (quirk #4) and `canUseStagesOfficeTools` uses `.some(r => r === authRole || r === myRole)`; the single-role gates read `authRole` only. The Send-to-Dispatch quick action is `showTaskDispatchButton(authRole)` in `jobsStagesRowShared.tsx`.

---

## Per-tab dossiers

### `teams-summary` — Crew P&L

- **Render:** `{activeTab === 'teams-summary' && <JobsCrewPnlTab/>}` 2072–2082 → [`JobsCrewPnlTab`](../src/components/jobs/JobsCrewPnlTab.tsx) (639 lines; owns range/people state; math in `lib/crewPnlSummary.ts`, tested).
- **Inputs (7):** `jobs` (shared cache — not loaded for this tab, quirk #2), `laborJobs`, `teamLaborData`, `loading` (`laborJobsLoading || teamLaborLoading`), `driveMileageCost`/`driveTimePerMile`, `onOpenJobDetail`.
- **Loaders that fire:** `loadLaborJobs` (1343–1348), `loadTeamLaborData` (1350–1355), drive + default rate (1444–1452) — 80 ms-delayed, `activeTab`-keyed.
- **Supabase:** via parent loaders — `people_labor_jobs` (+ items/payments/assignees, via `useSubLaborLedger`), team labor via `utils/teamLabor.loadTeamLaborData`, `app_settings`; the tab itself reads `app_settings`, `jobs_ledger`, `people`. Joins sheets to jobs by `job_ledger_id` first (v2.3065).
- **Status:** **Done.** The loaders stay in the parent (each feeds 3–5 tabs).

### `reports` — Reports

- **Render:** 1883–1900, the only tab wrapped in `ErrorBoundary` → [`JobsReportsTab`](../src/components/jobs/JobsReportsTab.tsx) (515 lines; self-loads `reports`, `report_templates`, `report_template_fields`, RPC `list_reports_with_job_info`).
- **Inputs (12):** `jobs` (seeds edit only), `loadJobs`, `tryOpenEditJob`, `jobDetailModal`, `showToast`, `error`/`onError` (quirk #7), auth id/email/role/profile name, `myRole`.
- **Status:** **Done.**

### `stages` — Pipeline (extracted v2.831)

The whole tab is [`JobsStagesTab`](../src/components/jobs/JobsStagesTab.tsx) — 5,099 lines, 120 `useState`, 51 effects at `a05cef4c4`. Its toolbar, jump nav, section wiring, the section tables ([`JobsStagesTable`](../src/components/jobs/JobsStagesTable.tsx) 513, [`JobsStagesUnifiedTable`](../src/components/jobs/JobsStagesUnifiedTable.tsx) 449, [`jobsStagesRowShared.tsx`](../src/components/jobs/jobsStagesRowShared.tsx) 1,518), the board builders, the modal tail, its tables/RPCs and its quirks are mapped in [`JOBS_STAGES_TAB_ARCHITECTURE.md`](./JOBS_STAGES_TAB_ARCHITECTURE.md). This dossier is the **page-side contract**.

**Mount/state semantics (preserve):** the page renders `<JobsStagesTab ref={stagesTabRef} active={activeTab === 'stages'} …/>` **unconditionally** (1907). The body renders only when `active`; the modal tail renders regardless — so search, section open/close, modal openers and focus/flash survive tab switches. Tab-keyed effects inside key on `active`.

**Imperative handle (`JobsStagesTabHandle`, 11 methods)** — how page code writes tab-owned state:

| Method | Called by (page) | Lines |
|---|---|---|
| `followMovedJob(jobId, toStatus)` | `useJobsStagesMutations` input `(id, st) => stagesTabRef.current?.followMovedJob(id, st)` | 519 |
| `focusSection(key)` | `?stagesSection=` (waiting/working/readyToBill/billed/collections) | 1248–1261 |
| `focusJob(jobId)` | `?stagesJob=`; new-job reveal (`pendingNewJobFocusId`, set by `onCreatedJobId` from `openNew` / `?newJob=`; dropped off-tab) | 1266–1277, 1308–1317 |
| `focusInvoice(invoiceId)` → `boolean` | `?stagesInvoice=` (return value ignored) | 1232–1243 |
| `openBankPayments()` | `?openBankPayments=` (role gate + strip stay page-side) | 1107–1142 |
| `openWeeklyMovement()` | `?stagesWeekly=` (v2.1436) | 1015–1035 |
| `openWeeklyMoney(weekMonday)` | `?stagesMoney=` + `&stagesMoneyWeek=` via `parseStagesMoneyWeekParam` (v2.1443) | 1048–1078 |
| `showBilledTotalByName()` | `?showBilledTotalByName=true` | 1328–1340 |
| `openMoneyMove(key)` | `?stagesMove=` via `parseStagesMoneyMoveKey` (v2.2145, Quickfill → Jobs Cleanup) | 1084–1104 |
| `openLegalDesk(payerKey, tab)` | `?legal=<key\|1>` + `&legalTab=fees` (v2.3293) | 1149–1175 |
| `openLienDesk(jobId)` | **no caller anywhere** (defined in the tab's `useImperativeHandle` only) | — |

**Props (60, `JobsStagesTabProps`):** `active` · page `error`/`setError` (2) · jobs cache (13: `jobs`, loading/refreshing/`jobsListSnapshotAt`/`jobsListError`/`paidJobsLoading`/`jobsListDataKey`/`paidJobsMergedForKey`, `loadJobs`, `runFetchJobs`, `fetchPaidJobsIfNeeded`, `customerFilterForFetch`, `scheduleLoadJobsAfterMutation`) · identity/roster (8: `authUser`, `authRole`, `authProfileName`, `myRole`, `users`, `customers`, `showToast`, `shortNewJobButtonLabel`) · page callbacks (9: `openNew`, `openEdit`, `openEditJobAndCreateCustomerFlow`, `tryOpenEditJob`, `pipelineBurnAlert`, `onShowBurnList`, `openStagesDetailJobModal`, `refreshCustomersAfterJobFormSave`, `billCustomer`) · the 12 `useJobsStagesMutations` values · 15 `useJobThreadNotes` values. The tab reads `searchParams` itself and consumes eight one-shot params of its own (`followups`, `gcReview`, `gcnotice`, `liendesk`, `round`, `chase`, `forecast`, `rtb` — stripped via `navigate`, listed in [its map](./JOBS_STAGES_TAB_ARCHITECTURE.md)); it also calls `useArBankUnallocatedCount` / `useSendBackCollectPaymentFlowNotice` internally.

#### The burn card cluster (page-side, v2.3191; footing v2.3300)

| Symbol | Lines | Does |
|---|---|---|
| `pipelineBurnWanted` | 162 | on Pipeline and `showJobCostBreakdownTeamLabor(authRole)` |
| `pipelineBurnArmed` + effect | 163–168 | 2.5 s after the board shows; **sticky once armed** |
| `pipelineBurnReportIds` | 169–175 | open-status job ids → `useJobSummaryData({ extraReportPctJobIds })` |
| arming side effects | 361, 1344, 1351, 1578 | turns on `usePartsLedgerData`, `loadLaborJobs`, `loadTeamLaborData`, `useJobBudgetFootings` while on Pipeline |
| `pipelineBurnAlert` | 1595–1621 | `jobSummaryData` rows in waiting/working/ready_to_bill → `projectJobSummaryBurn` (pct from report-% else `resolveJobCurrentPercentFallback`; field days from `teamLaborRow.breakdown`; target from `jobSummaryView.prefs.targetTrueMarginPct`; budget footing) → `buildPipelineBurnAlert`; null until team labor loads |
| `onShowBurnList` | 1938–1945 | `jobSummaryView.setPrefs({ status: 'in_progress', sortKey: 'projMargin', sortDir: 'asc' })` + `?tab=job-summary` |

Tests: `jobSummaryBurn.test.ts` covers `projectJobSummaryBurn` / `buildPipelineBurnAlert`; the row assembly (spent = team + sub + parts, field-day count, `J<num>` label) is inline and untested.

#### Deep links & URL router (stay in the parent; write tab state via the handles)

All strip themselves with `setSearchParams(…, { replace: true })`. `?tab=` (router), `?edit=` (+ `&editFocus=payments` → `paymentsReceivedHighlight`, v2.3795; 963–981, waits for the list), `?jobDetail=` (+ `location.state` prefill; 984–1009), `?newJob=true` (+ `&project=`; stages/billing → `openNewJob`, `subs&view=pay` → sub-sheet form; 924–959), `?editLabor=` (1179–1201), `?editParts=` (1205–1228), `?openBankPayments=`, `?legal=` (+`legalTab`), `?stagesWeekly=`, `?stagesMoney=` (+`stagesMoneyWeek`), `?stagesMove=`, `?stagesInvoice=`, `?stagesSection=`, `?stagesJob=`, `?showBilledTotalByName=true`, `?job=` (`MONEY_STORY_JOB_PARAM` on `tab=job-summary`, 1283–1303 via `resolveMoneyStoryLanding`), `?jobSummaryHcp=` (seeds search, not stripped; 1401–1405), `?view=` (Subs view; Job Summary `initialView`), `?wo=` / `?wof=` (Subs Work), `?teamLaborJob=` / `?teamWeek=` / `?teamExceptions=1` (Team; stripped by `onFocusTeamLaborConsumed`), `?customer=` (fetch filter + banner 1870–1881, cleared by the banner button).

> **Handle-gating rule (v2.832, extended v2.835/v2.838):** every effect that calls an imperative handle (`stagesTabRef`, `subLaborFormRef`) gates on a **loaded-once** signal — `!jobsListLoading` for Pipeline, `laborJobsLoadedOnce` for Subs (`laborJobsLoading` alone is not enough: it starts false). The role-gated ones (`?openBankPayments=`, `?legal=`, `?stagesMoney=`) also **wait while the role is `null`** instead of stripping. On a cold load the earliest effect passes run before the handle attaches; an ungated optional-chained call no-ops while the param strips and the link dies. The nine URL-driven Pipeline handle effects follow it today (the tenth, the new-job reveal 1308–1317, has no `jobsListLoading` gate — it waits for the new id to land in `jobs`); it has broken three times, and nothing but e2e (`deep-links.spec.ts`: `showBilledTotalByName`, `openBankPayments`, `stagesWeekly`, `stagesMoney`, `editLabor`, `newJob`, `stagesSection`) pins it.

#### The always-open AR wrapper page

[`src/pages/JobsAccountsReceivable.tsx`](../src/pages/JobsAccountsReceivable.tsx) (119 lines, own route) re-implements the minimal substrate: `useJobsListCache` + its own `runFetchJobs(null)` (one mount effect + an `onApplied` refetch) + a **verbatim copy** of the tab's `bankPaymentsModalBilledRows` memo (`buildJobsStagesBoardLists(jobs, '').billedRows`) + an always-`open` [`BankPaymentsModal`](../src/components/jobs/BankPaymentsModal.tsx) (2,618 lines) + role gate `canRoleSeeArBankUnallocatedOrgNudge`. The two pages share the modal and the lib builder, no Jobs.tsx code (quirk #9).

#### Status

**Extracted (v2.831).** Page-side leftovers: the burn cluster (a join over Job Summary data, not tab UI) and ten near-identical handle deep-link effects — both candidates in the [order](#recommended-extraction-order-value--risk).

### `billing` — Billing

- **Render:** 2054–2070 → [`JobsBillingTab`](../src/components/jobs/JobsBillingTab.tsx) (344 lines; owns search + sort, localStorage `jobs_billing_sort_asc_${uid}`; kernels [`lib/jobs/billingTab.ts`](../src/lib/jobs/billingTab.ts), tested).
- **Inputs (13):** cache `jobs` + loading/refreshing/error, page `error`, `authUserId`/`authRole`, `shortNewJobButtonLabel`, `laborJobHcps` (1464–1467) + `teamLaborJobIds` (1469–1472) + `teamLaborLoading` — the labor and team-labor loaders fire on this tab solely for the tab's `billingJobNeedsAttention` filter — `openNew`/`openEdit`.
- **Coupling:** `laborJobHcps` is keyed on the sheet's `job_number` text, not `job_ledger_id` (quirk #19). The Billing → Sub Labor "Add Labor" fill was retired in v2.1623.
- **Status:** **Done.** Render test + kernel tests.

### `combined-labor` — Team

- **Render:** 2045–2052 → [`JobsTeamTab`](../src/components/jobs/JobsTeamTab.tsx) (170 lines) with `focusJobId` / `focusWeek` / `focusExceptions` (v2.3051) / `onFocusConsumed`; sub-files in [`components/jobs/team/`](../src/components/jobs/team/).
- **Data:** self-loading — [`useTeamBoardWeek`](../src/hooks/useTeamBoardWeek.ts) → [`lib/fetchTeamBoardWeek.ts`](../src/lib/fetchTeamBoardWeek.ts) → [`lib/teamBoard.ts`](../src/lib/teamBoard.ts) (`buildTeamBoard`, tested). Does not read the page's `jobs`. The page still fires `loadLaborJobs` / `loadTeamLaborData` on this tab (1344, 1351) though the tab consumes neither.
- **Status:** **Done.** Render test.

### `subs` — Subs (Work / Pay; v2.2927 fold of `work_orders` + `sub_sheet_ledger`)

- **Render (1978–2043):** [`JobsSubsTab`](../src/components/jobs/JobsSubsTab.tsx) (75-line shell) takes `view` (`subsView`, 1698), `canSeeWork`, `onViewChange` (writes `?view=pay` / deletes it), and four slots:
  - **Work** — [`JobsSubsWorkView`](../src/components/jobs/JobsSubsWorkView.tsx) (1,312 lines, 10 props; superintendents get `null`): reads the page's `jobs`, self-loads `step_commitments`, `job_stage_windows`, `people_labor_jobs`, `project_workflow_steps`, `jobs_ledger`, `people`, `users`, RPC `create_sheet_for_work_order`; `?wo=` / `?wof=` deep links; `onOpenSheet` resolves the sheet in the page's `laborJobs` and calls `subLaborFormRef.openEdit`; `onSetSheetStage` = `setLaborJobStage`; its toolbar portals into `subsWorkToolbarHost` (a `<div ref={setSubsWorkToolbarHost}>` in the `workToolbar` slot).
  - **Pay** — `SubLaborToolbar` (`payToolbar`: search + New) and [`JobsSubLaborTab`](../src/components/jobs/JobsSubLaborTab.tsx) `hideToolbar` (875 lines, 20 props: ledger values, `subLaborOutstandingByPerson` / `subLaborDueTotal`, openers through the handles, `onPrintJobSubSheet`, date/stage mutations, reload).
- **Always-mounted modal trio (tail):** [`JobsSubLaborFormModal`](../src/components/jobs/JobsSubLaborFormModal.tsx) 2169–2198 (2,623 lines, 45 `useState`, 27 props; handle `open` / `openNew` / `openEdit` / `openNewWithJobNumber` / `openWithBillingPrefill` — the last has had **no page caller since v2.1623**, only its render test; mapped in [`JOBS_MODALS_ARCHITECTURE.md`](./JOBS_MODALS_ARCHITECTURE.md)); [`SubLaborPaymentModals`](../src/components/jobs/SubLaborPaymentModals.tsx) 2202–2209 (276 lines; handle `openMakePayment` / `openBackcharge` / `openEditPayment` / `clearEditPayment`; `onRequestRemove` hands off); [`SubLaborPaymentMoveRemoveModals`](../src/components/jobs/SubLaborPaymentMoveRemoveModals.tsx) 2210–2217 (259 lines, v2.3562; handle `openMove` / `openRemove` / `clear`). The form modal's `onClearEditPayment` clears both payment handles; it receives `setActiveTab` directly.
- **Owned page state (5):** `people` (178, `loadRoster`), `editingLaborJob` (289 — the form modal's controlled value + setter: its `openEdit` sets it for `?editLabor=`, and `useSubLaborLedger`'s `onLaborJobsReloaded` re-syncs it, 318), `defaultLaborRateValue` (292) — these three are read only by `JobsSubLaborFormModal` — `subLaborSearch` (366), `subsWorkToolbarHost` (368). Shared: `users` (Pipeline + Job Summary + this tab's form modal), drive values (Crew P&L + Job Summary; legacy rows only).
- **Engine:** [`useSubLaborLedger`](../src/hooks/useSubLaborLedger.ts) (293–324; 358 lines): `people_labor_jobs` + items / payments / payment events / assignees, `jobs_ledger`, `projects`, `users`; RPCs `set_sub_sheet_stage`, `move_labor_job_payment`, `remove_labor_job_payment`, `restore_labor_job_payment`.
- **Loaders/effects:** `loadRoster` (548–553; `people` where `archived_at` is null, then `loadUsers`) on Subs only (1321–1326); `loadLaborJobs` (1343–1348); drive + default rate (1444–1452 — the settings modals were removed in v2.1631; editing is Settings-side). Deep links: aliases (768–778), `?editLabor=<sheet id | job number>` (router force 791–803; effect 1179–1201 — id wins, number fallback, else `openNewWithJobNumber`), `?newJob=true&tab=subs&view=pay` (924–939), `?view=`, `?wo=`, `?wof=`.
- **Derived:** `subLaborOutstandingByPerson` (1623–1630, `lib/subLaborOutstanding`, tested) + `subLaborDueTotal` (1631). `printJobSubSheet` (565–567) → `lib/jobsDocuments/subLaborSheet` (tested).
- **Tests:** render tests for `JobsSubsTab`, `JobsSubsWorkView`, `JobsSubLaborFormModal`, `SubLaborPaymentModals`; none for `JobsSubLaborTab` or `SubLaborPaymentMoveRemoveModals`; `useSubLaborLedger` untested.
- **Status:** **Extracted.** What remains page-side is glue: three handle refs, the roster (shared), the Pay search + outstanding memo.

### `parts` — Parts

- **Render:** 2084–2112 → [`JobsPartsTab`](../src/components/jobs/JobsPartsTab.tsx) (627 lines, 25 props). The **mercury attribution modals render in the page tail**: `PartsUnattributedMercuryListModal` (2218–2231, 277 lines), `PartsUnattributedAllJobsModal` (2232–2245, 272), `MercuryTransactionAllocationsModal` (2246–2262, 1,705 — also opened from the Job Summary drilldown).
- **Owned page state (5):** `tallyPartsSearch` (364), `showMyJobsOnly` (365), `myJobIds` (371), `expandedPartsJobIds` (372), `pendingScrollToPartsJobId` (435). `showMyJobsOnly` / `myJobIds` are also `useJobsMercuryAllocations` inputs (`unattributedScopeInputs`).
- **Effects (6 + 1 router force):** `?editParts=` expand (1205–1217) + scroll (1220–1228), close all-jobs on leave (1407–1409), all-jobs refetch (1411–1414), per-row mercury load (1416–1423), `myJobIds` from `jobs_ledger_team_members` (1426–1434).
- **Engines:** [`usePartsLedgerData`](../src/hooks/usePartsLedgerData.ts) (351–363; 106 lines; active on parts, job-summary **and** an armed burn card): `jobs_tally_parts`, `supply_house_invoice_job_allocations`, RPCs `get_invoice_amounts_for_jobs`, `list_tally_parts_with_po`. [`useJobsMercuryAllocations`](../src/hooks/useJobsMercuryAllocations.ts) (395–434; 473 lines): card totals + invoice-linked and tag slices + `costLineTags` (for Job Summary), the per-job allocation cache, unattributed/all-jobs lists, the alloc-modal routing (`onPartsAllocSaved` refreshes Parts and/or Job Summary via `touchJobSummaryMercuryAllocations`), banking users options. Its job list is `jobListForCardCharges` (386–394): the JS ledger on job-summary (`jobs` until it loads), `jobs` on parts, the stable empty `NO_JOBS_FOR_CARD_CHARGES` elsewhere (v2.3569 — stops ~80 requests on the Pipeline).
- **Tests:** none for the tab, the three modals or either hook; `fetchMercuryJobAllocationsWithAttributionForJob.test.ts`, `fetchUnattributedMercuryForManyJobs.test.ts` cover the fetch kernels.
- **Status:** **Partial.** Next: move the two parts-only unattributed modals + the five UI states + the parts effects into `JobsPartsTab`; `MercuryTransactionAllocationsModal` stays page-side while Job Summary opens it.

### `job-summary` — Job Summary

- **Render:** 2114–2163 → [`JobsJobSummaryTab`](../src/components/jobs/JobsJobSummaryTab.tsx) (3,276 lines, 0 hooks, **44 props**; internals in [its map](./JOBS_JOB_SUMMARY_TAB_ARCHITECTURE.md)).
- **Data seams:** [`useJobSummaryData`](../src/hooks/useJobSummaryData.ts) (186–208; 325 lines; inputs `authUserId`, `activeTab`, `extraReportPctJobIds`): ledger snapshot via `fetchJobsLedgerWithDetailsForStages` + min-HCP filter, five lazy per-job caches (`clock_sessions`, invoice lines via `get_invoice_allocation_lines_for_jobs`, mercury via `fetchMercuryJobAllocationsWithAttributionForJob`, `reports`, report-% via `list_latest_report_completion_pct` + `jobSummaryReportDateByJobId`, v2.3441), `touchJobSummaryMercuryAllocations`. [`useJobSummaryView`](../src/hooks/useJobSummaryView.ts) (1579–1589; 275 lines; v2.2692): prefs, the job day ledger, enriched rows; `initialView` = `?view=`. [`useJobBudgetFootings`](../src/hooks/useJobBudgetFootings.ts) (1578; 44 lines; `job_budgets`) over `jobSummaryJobIds` (1577). Order matters: `useJobSummaryData` is called before `useJobsMercuryAllocations` (which consumes its ledger + touch fn), so the P&L join that reads the mercury hook's totals must sit after both — page-level.
- **Owned page state (6):** `jobSummarySearch` (369 — also the `search` input of the page-level `useJobSummaryView`, whose prefs the burn card reads), `printCostBreakdownJobId` (370), `expandedJobSummaryJobIds` (373 — also written by the money-story deep link), `jobSummaryTeamLaborPersonExpandedKeys` (375), `jobSummaryBreakdownPersonSearchByJobId` (378 — the tab only prunes it on collapse; nothing writes a value, [its map](./JOBS_JOB_SUMMARY_TAB_ARCHITECTURE.md) quirk 5), `jobSummaryCostDrilldown` (381, a ReactNode — quirk #11; also closed by `useJobsMercuryAllocations` through its `onJobSummaryDrilldownClose` input, 433).
- **Effects (8):** thread stats for expanded rows (472–475), money-story landing (1283–1303), lazy loads for expanded rows — clock sessions (1358–1366), mercury (1368–1375), invoice lines (1377–1384), reports (1386–1391) — ledger load (1393–1399), `?jobSummaryHcp=` seed (1401–1405).
- **`jobSummaryData` (1477–1571) — the page's biggest money kernel, inline and untested.** Source rows: the JS ledger on this tab (`[]` until loaded), else the Pipeline cache `jobs`. Per job: parts = tally (`fixture_cost` when `part_id` is null, else `price_at_time`, × quantity) + supply-house invoices + billed `materials` + card charges − card charges linked to invoices (clamped, v2.2692); tag cost lines sliced from the counted card charges, each clamped (v2.2725); sub labor = `laborJobSubCost(job, mileage ?? 0.70, timePerMile ?? 0.02)` summed **by lower-cased `job_number` ↔ `hcp_number`** (quirk #19); team labor from `teamLaborData`; profit = `revenue` − parts − labor. Sorted empty-HCP first, then HCP descending (numeric). Feeds the tab, `jobSummaryView`, `jobSummaryJobIds` → budget footings, `pipelineBurnAlert`, and (via the tab) the print thunk.
- **`printJobSummaryCostBreakdown` (569–703, 135 lines):** invoice lines from the hook cache or an RPC fallback; mercury rows from the hook cache or an **inline 80-line fetch + attribution join (604–687)** — an older, diverged copy of the tested `lib/fetchMercuryJobAllocationsWithAttributionForJob` (the lib, which the hook cache uses, pages past 1,000 rows, also selects `mercury_account_id`, drops Internal-Transfer rows via `cardChargeAllocationFilter` and sets `linkedToSupplyInvoice`; the inline copy does none of these, so a cache-miss print can list rows the cached path drops); then the tested builder `lib/jobsDocuments/jobSummaryCostBreakdown` + `openHtmlPrintWindow`.
- **Callbacks:** `onOpenJobDetail` / `onOpenEditJob` reload the JS ledger on save; `handleJobSummaryMercuryReassignFromDrilldown` comes from the mercury hook; gates in the [page-side table](#page-side-gates-in-jobstsx).
- **Tests:** no render test for the tab; the `lib/jobs/jobSummary*` kernels, `moneyStoryDoor`, `jobSummaryCostBreakdown`, `jobSummaryPercentComplete` are tested; `jobSummaryData`, the print thunk's fetch fallback and all three hooks are not.
- **Status:** **Seams done.** Next: Stage A on the join and the print fallback (steps 10–11), then the UI state (step 15).

### `inspections` — Inspections

- **Render:** 2165–2167 → [`JobsInspectionsTab`](../src/components/jobs/JobsInspectionsTab.tsx) (777 lines; self-loads `inspections`, `inspection_types`, `inspection_quick_links`, `inspection_portal_credentials`) with `authUserId` / `error` / `onError`.
- **Status:** **Done.**

### `billed` — vestigial union member

In `JobsTab` + `JOBS_TABS`, no button; the router rewrites `?tab=billed` → `stages` (904–910) and `JobsStagesTab`'s return-edit banner treats `tab=billed` as stages-intent (`urlWantsStages`). Quirk #1.

---

## The job-mutation engine (seam candidate)

**Extracted (v2.828)** → [`useJobsStagesMutations`](../src/hooks/useJobsStagesMutations.ts) (405 lines; called at 499–521, untested). The page destructures 12 values and passes all of them to `JobsStagesTab`. The hook owns the core status/invoice mutations, the est-bill-date and % complete row-writes, the busy ids (`stagesStatusUpdatingId`, `stagesInvoiceUpdatingId`, `invoiceEstimatedBillDateSavingId`, `pctCompleteSavingId`) and the invoice lock ref; the serialized queue stays module-level (quirk #14); optimistic patch + 300 ms debounce unchanged (quirk #12).

| Function | Does | Serialized? | Dashboard twin ([`useDashboardBillingInvoices`](../src/hooks/useDashboardBillingInvoices.ts)) |
|---|---|---|---|
| `executeUpdateJobStatus` (inner) | RPC `update_job_status` → optimistic `setJobs` patch → `followMovedJob` → `scheduleLoadJobsAfterMutation`; failure toasts via `lib/updateJobStatusClientFeedback` | — | inlined in its `updateJobStatus` |
| `updateJobStatus` | queue wrapper | ✅ | not serialized |
| `moveJobToReadyToBillWithStripePrep` | `prepareBilledInvoicesBeforeJobRevertToReadyToBill` (Stripe void/prep) then the status move | ✅ | not serialized |
| `revertBilledInvoiceToReadyToBill` | non-Stripe → RPC `delete_billed_invoice_on_send_back` + `syncJobToReadyToBillIfNoBilledInvoicesRemain`; Stripe → `invokeVoidStripeInvoiceForRevert` + ledger cleanup + sync | ✅ + lock ref | `revertBilledDashboardInvoiceToReadyToBill` |
| `deleteInvoice` | RPC `delete_ready_to_bill_invoice` | ✅ + lock ref | `deleteInvoice` |
| `setInvoiceEstimatedBillDate` / `bumpInvoiceEstimatedBillDate`, `updateJobPctComplete`, `commitStagesPctWithNote` (thread note via `submitJobThreadNoteWithBody`, then `pct_complete`) | row writes | no | n/a |

**Inputs:** `{ authRole, setError, showToast, setJobs, loadJobs, scheduleLoadJobsAfterMutation, followMovedJob, submitJobThreadNoteWithBody }` — `followMovedJob` is the tab's handle method; `submitJobThreadNoteWithBody` comes from `useJobThreadNotes`, so the hook is called after that destructure.

**Convergence with the Dashboard (not built):** the core functions are behavior-parallel to `useDashboardBillingInvoices` (same RPCs, same Stripe prep libs, same failure-feedback lib). Differences: Jobs serializes, Dashboard does not; Jobs patches the `jobs` cache, Dashboard prunes its invoice-unit lists; Jobs supports `toStatus: 'waiting'`; follow-cards is Jobs-only. A shared `lib/jobStatusMutationCore.ts` request/interpret layer is the realistic target (file does not exist). Cross-ref BILLING_FLOWS "Send-back / revert paths" and "Client callers".

---

## Shared modals & contexts

Per the playbook: modals opened from 2+ tabs (or living in app contexts) stay parent/app-side; single-opener modals move with their tab.

| Modal | Source | Opened from | Stays / moves |
|---|---|---|---|
| `JobFormModal` (New/Edit Job) | `JobFormModalContext` (app) | Pipeline, Billing, Reports, Job Summary via `tryOpenEditJob` / `openNew` / `openEdit`; Subs Work via its own `useJobFormModal`; `?edit=` / `?newJob=` | **stays (app context)** |
| `DetailJobModal` | `JobDetailModalContext` (app) | Pipeline, Job Summary, Crew P&L, Reports, `?jobDetail=` | **stays (app context)** |
| Bill Customer flow | `BillCustomerModalContext` (app) | Pipeline (prop), Subs Work (own hook) | **stays (app context)** |
| Every Pipeline modal (AR `BankPaymentsModal`, Lien / Legal desks, weekly movement/money, send-backs, Hazmat, job people, …) | components in `JobsStagesTab` | Pipeline + the handle deep links | **in `JobsStagesTab`** — see [its map](./JOBS_STAGES_TAB_ARCHITECTURE.md); the AR page keeps its own `BankPaymentsModal` mount |
| `JobsSubLaborFormModal`, `SubLaborPaymentModals`, `SubLaborPaymentMoveRemoveModals` | components, page tail | Subs Pay + Work, `?editLabor=` / `?newJob=` (handles); Make Payment from the Pay list, the Work board and the form modal | **stay page-side** — three always-mounted handle siblings, each opened from 2+ surfaces |
| `PartsUnattributedMercuryListModal`, `PartsUnattributedAllJobsModal` | components, page tail | Parts only | **move into `JobsPartsTab`** (step 14) |
| `MercuryTransactionAllocationsModal` | component, page tail | Parts **and** the Job Summary drilldown | stays page-side while shared |
| `JobSummaryCostCellDrilldownModal` | component, page tail (body = ReactNode state) | Job Summary (the mercury hook closes it before the reassign flow and after its save) | moves with Job Summary's UI state (step 15) |
| ~~Drive Settings / Default Labor Rate~~ | — | — | **removed (v2.1631)**; values still load (1444–1459) |

---

## Shared substrate

### Already-extracted engines consumed by the page

| Unit | Owns | Consumed by | Tests |
|---|---|---|---|
| [`JobsListCacheContext`](../src/contexts/JobsListCacheContext.tsx) (569 lines) | `jobs`, loading/refreshing/snapshot, scoped + paid loads, header stats | every tab + AR page + JobDetail context + Quickfill + Dashboard AR deposits modal — **stays app-level** | kernels (`boardRefetchTtl`, `stagesEnrichment`, `fetchJobsLedgerWithDetailsForStages`) tested |
| [`usePartsLedgerData`](../src/hooks/usePartsLedgerData.ts) (106) | tally parts + supply-house totals + mutations | Parts, Job Summary join, burn | — |
| [`useJobsMercuryAllocations`](../src/hooks/useJobsMercuryAllocations.ts) (473) | card totals (+ invoice-linked, tag slices, `costLineTags`), allocation cache, unattributed lists, alloc-modal routing | Parts, Job Summary | fetch kernels only |
| [`useJobSummaryData`](../src/hooks/useJobSummaryData.ts) (325) | JS ledger + five lazy caches + report-% (+ burn extras) | Job Summary, burn, print | — |
| [`useJobSummaryView`](../src/hooks/useJobSummaryView.ts) (275) + [`useJobBudgetFootings`](../src/hooks/useJobBudgetFootings.ts) (44) | JS prefs / day ledger / enriched rows; `job_budgets` footings | Job Summary, burn | `jobSummaryLedgerView.test.ts` (kernel) |
| [`useJobsStagesMutations`](../src/hooks/useJobsStagesMutations.ts) (405) | Pipeline mutation engine | `JobsStagesTab` | — |
| [`useJobThreadNotes`](../src/hooks/useJobThreadNotes.ts) (556) | thread notes / activity / stats | Pipeline (15 props), Job Summary (stats), `commitStagesPctWithNote` | — |
| [`useSubLaborLedger`](../src/hooks/useSubLaborLedger.ts) (358) | sheets, payments, stage, move/remove/restore | Subs, Crew P&L, Billing, Job Summary, burn | — |
| [`useRoleGate`](../src/hooks/useRoleGate.ts) (66) + `lib/roleGate.ts` | bounce toast + landing | URL router, `?stagesMoney=` | render test + kernel test |
| [`utils/teamLabor.ts`](../src/utils/teamLabor.ts) `loadTeamLaborData` (imported as `fetchTeamLaborRows`) | team labor aggregation | `loadTeamLaborData` (556–563) → Crew P&L, Billing, Job Summary, burn | `teamLabor.test.ts` |
| `lib/jobsDocuments/` (`subLaborSheet`, `jobSummaryCostBreakdown`, `printWindow`) | print HTML | Subs, Job Summary | builders tested; `printWindow` not |
| [`lib/jobsStagesBoard.ts`](../src/lib/jobsStagesBoard.ts) (816) | board lists, StageRows, AR targets | Pipeline, AR page | tested |
| [`lib/jobsStagesSerializedPipeline.ts`](../src/lib/jobsStagesSerializedPipeline.ts) | mutation queue | mutation hook, `JobsStagesTab` | — |
| Page-read kernels: `jobsListLoadGate`, `stagesSectionPrefs`, `stagesMoneyMoveLink`, `weeklyMoneyReportLink`, `moneyStoryDoor`, `jobSummaryBurn`, `jobSummaryPercentComplete`, `ledgerDisplayPrefixes`, `jobDetailModalRole`, `subLaborOutstanding`, `jobs/subLaborCost`, `customerArchive`, `fetchMercuryRelationsByTxIds` | pure | this page | all tested |
| `people/fetchActiveUsers` | active-users query (`loadUsers`) | `users` roster | — |

### Data engines still inline (seam candidates)

| Inline engine | Anchor | Feeds | Candidate |
|---|---|---|---|
| **Job Summary P&L join** | `jobSummaryData` 1477–1571 | Job Summary, `jobSummaryView`, budget footings, burn alert, print | Stage A → `lib/jobs/jobSummaryRows.ts` (`buildJobSummaryRows`) + tests; the tally-part line cost it repeats appears in 7 other files, two of which already export tested kernels (`tallyLineTotal`, `tallyPartEventAmount`) — reuse one |
| **Burn cluster** | 162–175, 1578, 1595–1621 | Pipeline burn card, JS/parts/labor loaders | a `usePipelineBurn` seam called at the top (arming + report ids), plus a pure `buildPipelineBurnRows` over the join rows |
| **Pipeline deep-link effects** | ten effects in 1015–1340 | `stagesTabRef` | pure `resolveStagesDeepLink(params, { role, activeTab, jobsListLoading })` → wait / strip / call, + a `useJobsStagesDeepLinks` hook the parent calls (the router stays in the parent) |
| Print mercury fallback | `printJobSummaryCostBreakdown` 604–687 | Job Summary print | adopt `fetchMercuryJobAllocationsWithAttributionForJob` (or the hook's force loader) after a parity check |
| Roster loaders | `loadUsers` / `loadRoster` 524–553 | Pipeline + Job Summary (`users`), Subs form (`users` + `people`) | stays parent-side while shared |
| ~~Team labor aggregation~~ | **resolved (v2.1625)** — `loadTeamLaborData` calls the util | — | done |
| ~~Mutations / mercury / JS ledger~~ | **extracted** (v2.828 / v2.825 / v2.826) | — | done |

### Parent-forever glue

- The URL router (761–922), every deep-link effect's strip + gate, and `activeTab`.
- The app contexts and `tryOpenEditJob`'s busy gate; the job-form glue (1633–1678).
- `customers` (747–759 + `refreshCustomersAfterJobFormSave`, the same query twice) — loaded on Pipeline / Billing and while the job form is open, but read only by `JobsStagesTab` (1930, its row context).
- `users` / `people` roster; the shared labor / team-labor / drive loaders.
- `error` (global — quirk #7), both debounce timers + cleanup.
- The four always-mounted handle refs (`stagesTabRef`, `subLaborFormRef`, `subLaborPaymentModalsRef`, `subLaborPaymentMoveRemoveRef`).
- localStorage keys live in children: `jobs-stages-ham-mode`, `jobs-stages-follow-moves`, `jobs-stages-search-include-schedule-time` (JobsStagesTab / `lib/jobsStagesScheduleSessionSearch`), `jobs_billing_sort_asc_${uid}` (JobsBillingTab), the Pipeline section-open prefs (read page-side via `readStagesSectionOpenPrefs`), JS min-HCP (in `useJobSummaryData`).

---

## Quirks (preserve, don't fix)

Behavior-preserving decomposition only — note these, don't "clean them up" mid-move:

1. **Vestigial `'billed'` tab.** Union member + `JOBS_TABS` entry, no button; `?tab=billed` → `stages` (904–910); `JobsStagesTab`'s return-edit banner accepts it as stages-intent. Separate cleanup PR.
2. **`jobs` loads only on stages / billing / parts / subs / job-summary.** Crew P&L's `jobs` and Reports' edit seed read the shared cache, **empty on a cold landing** until another surface fetches. Do not add loaders during extraction.
3. **~~Dead `confirmJobStatusJob` modal~~ Resolved (v2.3545, Stages decomposition PR 12).**
4. **Ham-mode gate uses `authRole || myRole`** while Job Book / Combine use `.some(r => r === authRole || r === myRole)` — both now named in `lib/jobs/stagesRoleGates.ts` (`canSeeStagesPowerToggles`, `canUseStagesOfficeTools`), tested. Master never gets ham mode; a set `authRole` never falls through.
5. **`controller` is assistant-like everywhere except Team** — the router's `isAssistant` is `=== 'assistant'` (864) and `showTeamLaborTab` excludes only assistant + superintendent, so controllers keep Team while assistants bounce.
6. **Dual role sources**, inconsistently ordered per gate; `null`+`null` treated as primary-restricted (`isPrimaryOrUnknown`).
7. **One global `error` state** shared by every tab and the Subs form modal (the page never calls `setError` itself; hooks and children do). Keep it; pass `error`/`setError` down.
8. **~~Capable-to-bill computed twice~~ Resolved (v2.829).**
9. **`bankPaymentsModalBilledRows` rebuilds the board with an empty search** so AR ignores the Pipeline search and includes Collections — in `JobsStagesTab` and, verbatim, in `JobsAccountsReceivable.tsx` (line 38). Keep both; the lib builder is the single source.
10. **~~Near-duplicate print builders~~ Resolved (v2.820).**
11. **`jobSummaryCostDrilldown` stores a ReactNode in state** (381), built at click time; a data hook must not own it.
12. **Optimistic status patch + 300 ms debounced refetch** (`LOAD_JOBS_AFTER_MUTATION_MS`, 213). The follow-cards scroll retry in `JobsStagesTab` is 700 ms because the refetch re-keys rows. Keep the timings.
13. **`openStagesDetailJobModal`** (436–448) stays a page `useCallback` over the detail context; `JobsStagesTab`'s `renderStagesOpenDetailJobName` wraps it. The `?jobDetail=` effect builds the same `HCP · name` prefill separately (988–994).
14. **The serialized pipeline is module-level state** — it must survive re-renders and be shared by the hook and `JobsStagesTab`; any engine move keeps it module-level.
15. **~~Duplicated team-labor loader~~ Resolved (v2.1625):** the page imports `utils/teamLabor`'s `loadTeamLaborData` as `fetchTeamLaborRows` and its `TeamLaborRow` type.
16. **Ready-to-Bill double checkbox vs ham one-click** — inside `JobsStagesTab` (`readyForBillingChecked1/2`, `sendBackInvoiceStripeExplainerAfterFailure`). Preserve exactly.
17. **Two % complete commit paths** — `updateJobPctComplete` (bare write) and `commitStagesPctWithNote` (thread note first), sharing `pctCompleteSavingId` in the mutation hook.
18. **The burn card arms once and stays armed** (163–168): after 2.5 s on Pipeline for dev / master / controller, the Job Summary cost loads (parts ledger, sheets, team labor, report-% for open jobs, budget footings) run on the Pipeline and keep running on every later tab for the session. Intended ("the loads are the same caches Job Summary reads"); keep the 2.5 s delay and the stickiness.
19. **Sub-labor cost joins on the sheet's `job_number` text** — `jobSummaryData` (1487–1495, 1529), `laborJobHcps` (1464–1467, Billing's needs-attention flag) and the `?editLabor=` fallback (1190) — although sheets link by `job_ledger_id` since v2.3055 ("job_number is display text") and Crew P&L moved to the link in v2.3065. A linked sheet with a blank or different number adds $0 to Job Summary / burn; two jobs sharing a number share its cost. Behavior change → its own PR after the Stage-A kernel exists (step 10), with a parity count on prod rows.
20. **Unused handle methods:** `JobsStagesTabHandle.openLienDesk` has no caller; `JobsSubLaborFormModalHandle.openWithBillingPrefill` has had none since v2.1623 (only its render test). Remove in a cleanup PR, not mid-move.
21. **Labor and team-labor loaders fire on Team** (1344, 1351) though `JobsTeamTab` self-loads and reads neither (its four props are the focus params). Dropping `combined-labor` from those two conditions is a (safe) behavior change; separate PR.

---

## Recommended extraction order (value ÷ risk)

One step per PR; `npm run typecheck && npm run lint && npm test` green after each. Stage-A lib moves ship first and independently.

**Done (v2.820–v2.831):** 1 print builders → `lib/jobsDocuments/` (v2.820) · 2 `JobsBillingTab` (v2.821) · 3 `useSubLaborLedger` (v2.822) · 4 `JobsSubLaborFormModal` + `SubLaborPaymentModals` (v2.823–v2.824) · 5 `useJobsMercuryAllocations` seam (v2.825) · 6 `useJobSummaryData` (v2.826) · 7 `useJobsStagesMutations` (v2.828) · 8 remaining Stages math → lib (v2.829) · 9 `JobsStagesTable` / `JobsStagesUnifiedTable` (v2.830) + `JobsStagesTab` (v2.831), Jobs.tsx 6,875 → 4,786 → 1,990. Since then, done incidentally: team-labor util adoption (v2.1625), dead confirm modal removed (v2.3545), Pipeline gates → `stagesRoleGates.ts` (v2.3531).

Open, ranked:

10. **Stage A: `jobSummaryData` → `lib/jobs/jobSummaryRows.ts` + tests.** Highest value: 95 lines of untested money math (parts, card-charge de-dupe, tag slices, sub + team labor, profit) feeding Job Summary, the burn card, budget footings and the print. Pure input → rows; the memo becomes a one-line call with the same 13 deps. For the tally-part line cost, reuse a kernel that already exists and is tested — `tallyLineTotal` (`lib/partsPerPersonCostSummary.ts`) or its twin `tallyPartEventAmount` (`lib/jobChargesTimeline.ts`, "MUST match the `jobSummaryData` memo") — instead of minting a new one; the inline formula also sits in `JobsJobSummaryTab`, `JobsPartsTab`, `PeopleReviewTab` (×2), `fetchOverheadOfficePartsByDay` (×2) and `jobsDocuments/jobSummaryCostBreakdown` (cross-surface). Keep the `job_number` join byte-identical (quirk #19). Risk low.
11. **Stage A: the print thunk's mercury fallback** (604–687) → `fetchMercuryJobAllocationsWithAttributionForJob` after a field-by-field parity check. Not a pure move: the attribution precedence (person, then user) matches, but the lib pages, selects `mercury_account_id` and drops Internal-Transfer rows, so a cache-miss print changes to match the cached path — call that out in the PR. −80 lines, risk low.
12. **Deep-link kernel + hook.** `resolveStagesDeepLink` (pure: wait / strip / call per param, role and `jobsListLoading` gates) with tests that pin the handle-gating rule; a `useJobsStagesDeepLinks(stagesTabRef, …)` hook the parent calls replaces the ten effects (~200 lines of effect bodies, ~250 with their param reads and comments). The router stays in the parent. Risk med (cold-load races; keep the e2e deep-link spec green).
13. **Burn seam.** `usePipelineBurn({ activeTab, authRole, jobs })` → `{ wanted, armed, reportIds }` called above `useJobSummaryData`; `buildPipelineBurnRows(jobSummaryData, …)` kernel + tests for the row assembly; the alert memo becomes a call. Depends on 10. Risk low-med (hook order).
14. **Parts: move the two unattributed modals + five UI states + the parts effects into `JobsPartsTab`** (`MercuryTransactionAllocationsModal` stays while Job Summary opens it; `showMyJobsOnly` / `myJobIds` are hook inputs, so lift them via props or move the hook call with them). Risk med (`onPartsAllocSaved` routes refreshes to both tabs).
15. **Job Summary UI state** — the six states + the five expanded-row effects (472–475, 1358–1391) into `JobsJobSummaryTab` or a `useJobSummaryExpandedRows` hook; `expandedJobSummaryJobIds` must stay reachable by the money-story deep link (keep it in the parent or add a handle). Two more reach outside the tab: `jobSummarySearch` feeds the page-level `useJobSummaryView`, and the mercury hook closes `jobSummaryCostDrilldown` (433) — so the page-side hook is the fit; [the Job Summary map](./JOBS_JOB_SUMMARY_TAB_ARCHITECTURE.md) keeps the tab presentational and the three expanded-row states in the parent until this step runs. Risk med.
16. **Subs Pay glue (optional, low value)** — `subLaborSearch` + `subLaborOutstandingByPerson` + the `SubLaborToolbar` wiring into a Pay wrapper; the handles and roster stay.
17. **Cleanup PRs (behavior-changing):** remove vestigial `'billed'`; drop the unused handle methods (quirk #20); stop the labor loaders on Team (quirk #21); switch the sub-labor joins to `job_ledger_id` (quirk #19); converge the mutation engine with the Dashboard (`lib/jobStatusMutationCore.ts`).

> Already thin/extracted: Reports, Crew P&L, Team, Inspections, Billing, Subs; the Pipeline surface; the board-list / StageRow / AR-target kernels; the app modal contexts; `BankPaymentsModal` + the AR wrapper page; the seven engine hooks above; the serialized pipeline.
