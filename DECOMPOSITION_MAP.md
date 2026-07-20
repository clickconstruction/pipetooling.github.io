# Decomposition map & plans (working doc)

> Generated 2026-07-19 by a 20-agent planning fleet (one planner per file > 2,400 lines;
> each read its target file in full plus `docs/PAGE_DECOMPOSITION_PLAYBOOK.md` and the matching
> architecture doc). Untracked scratch doc — line numbers are as of today and will rot.

## Repo size map

Source inventory (`src/**/*.ts(x)`, tests excluded): **1,114 files, 369,937 lines**.
`src/types/database.ts` is generated (Supabase types) — excluded from targeting.

| Size bucket | Files | Lines | % of src |
|---|---:|---:|---:|
| > 5,000 | 7 | 51,487 | 13.9% |
| 2,400 – 5,000 | 14 | 46,100 | 12.5% |
| 1,000 – 2,400 | 49 | 73,835 | 20.0% |
| 500 – 1,000 | 94 | 66,682 | 18.0% |
| ≤ 500 | 950 | 131,833 | 35.6% |

### Top 45 files by size

| # | File | Lines | Planned here |
|---:|---|---:|:--:|
| 1 | `src/types/database.ts` | 12,792 | ⛔ generated |
| 2 | `src/pages/Jobs.tsx` | 10,604 | ✅ |
| 3 | `src/pages/Materials.tsx` | 6,936 | ✅ |
| 4 | `src/components/bids/BidsTakeoffTab.tsx` | 5,642 | ✅ |
| 5 | `src/pages/Estimates.tsx` | 5,333 | ✅ |
| 6 | `src/pages/Settings.tsx` | 5,172 | ✅ |
| 7 | `src/components/people/PeopleReviewTab.tsx` | 5,008 | ✅ |
| 8 | `src/pages/Workflow.tsx` | 4,783 | ✅ |
| 9 | `src/pages/People.tsx` | 4,270 | ✅ |
| 10 | `src/components/jobs/JobFormModal.tsx` | 4,086 | ✅ |
| 11 | `src/components/DashboardMyTimeDayEditorModal.tsx` | 3,948 | ✅ |
| 12 | `src/pages/Bids.tsx` | 3,792 | ✅ |
| 13 | `src/pages/Prospects.tsx` | 3,374 | ✅ |
| 14 | `src/pages/Banking.tsx` | 3,105 | ✅ |
| 15 | `src/components/people/PeopleContractsTab.tsx` | 2,982 | ✅ |
| 16 | `src/components/DashboardTeamActiveClockStrip.tsx` | 2,871 | ✅ |
| 17 | `src/components/jobs/JobsJobSummaryTab.tsx` | 2,863 | ✅ |
| 18 | `src/components/bids/BidsPricingTab.tsx` | 2,611 | ✅ |
| 19 | `src/pages/Checklist.tsx` | 2,534 | ✅ |
| 20 | `src/components/jobs/SendRecordInvoiceModal.tsx` | 2,452 | ✅ |
| 21 | `src/components/schedule/ScheduleDispatchHub.tsx` | 2,429 | ✅ |
| 22 | `src/components/bids/BidsLaborTab.tsx` | 2,366 |  |
| 23 | `src/pages/JobTally.tsx` | 2,331 |  |
| 24 | `src/components/checklist/ChecklistTechTreeTab.tsx` | 2,313 |  |
| 25 | `src/components/banking/BankingMercuryAccountingTab.tsx` | 2,305 |  |
| 26 | `src/components/ClockInOutButton.tsx` | 2,213 |  |
| 27 | `src/pages/Dashboard.tsx` | 2,124 |  |
| 28 | `src/components/bids/BidSubmissionFollowupTab.tsx` | 2,082 |  |
| 29 | `src/components/people/PeopleOverheadTab.tsx` | 2,039 |  |
| 30 | `src/components/schedule/ScheduleDispatchHubPage.tsx` | 2,022 |  |
| 31 | `src/components/projects/ProjectsForecastSpecificTab.tsx` | 2,013 |  |
| 32 | `src/components/settings/SettingsDashboardTab.tsx` | 1,986 |  |
| 33 | `src/pages/Calendar.tsx` | 1,984 |  |
| 34 | `src/pages/Quickfill.tsx` | 1,885 |  |
| 35 | `src/components/jobs/CollectPaymentModal.tsx` | 1,654 |  |
| 36 | `src/components/people/teamSummary/drilldowns.tsx` | 1,625 |  |
| 37 | `src/components/projects/ProjectsJobHistoryDayModal.tsx` | 1,596 |  |
| 38 | `src/hooks/useBidPricingEngine.ts` | 1,563 |  |
| 39 | `src/pages/Documents.tsx` | 1,561 |  |
| 40 | `src/components/jobs/DetailJobModal.tsx` | 1,552 |  |
| 41 | `src/components/MercuryTransactionAllocationsModal.tsx` | 1,541 |  |
| 42 | `src/components/Layout.tsx` | 1,499 |  |
| 43 | `src/components/jobs/BankPaymentsModal.tsx` | 1,483 |  |
| 44 | `src/components/projects/ProjectsForecastSpecificStageModal.tsx` | 1,466 |  |
| 45 | `src/hooks/useDashboardMyTeamSectionState.ts` | 1,465 |  |

## Plan summary — 20 targeted files

If every plan below is executed: **84,776 lines → ~32,080 lines** in the parents 
(−62%), across **217 small PRs**. 
The removed lines move into named components, hooks, and unit-tested `src/lib/` kernels.

| File | Now | Est. after | Extractions | PRs |
|---|---:|---:|---:|---:|
| `src/pages/Jobs.tsx` | 10,603 | ~3,200 | 13 | 14 |
| `src/pages/Materials.tsx` | 6,935 | ~1,800 | 15 | 15 |
| `src/components/bids/BidsTakeoffTab.tsx` | 5,641 | ~2,700 | 9 | 10 |
| `src/pages/Estimates.tsx` | 5,333 | ~2,350 | 15 | 15 |
| `src/pages/Settings.tsx` | 5,171 | ~1,200 | 13 | 14 |
| `src/components/people/PeopleReviewTab.tsx` | 5,007 | ~1,400 | 10 | 10 |
| `src/pages/Workflow.tsx` | 4,782 | ~2,050 | 11 | 12 |
| `src/pages/People.tsx` | 4,269 | ~3,250 | 9 | 9 |
| `src/components/jobs/JobFormModal.tsx` | 4,085 | ~2,050 | 10 | 11 |
| `src/components/DashboardMyTimeDayEditorModal.tsx` | 3,947 | ~2,250 | 11 | 11 |
| `src/pages/Bids.tsx` | 3,791 | ~2,150 | 10 | 10 |
| `src/pages/Prospects.tsx` | 3,373 | ~1,000 | 12 | 12 |
| `src/pages/Banking.tsx` | 3,104 | ~1,300 | 11 | 12 |
| `src/components/people/PeopleContractsTab.tsx` | 2,981 | ~1,000 | 8 | 8 |
| `src/components/DashboardTeamActiveClockStrip.tsx` | 2,870 | ~850 | 9 | 9 |
| `src/components/jobs/JobsJobSummaryTab.tsx` | 2,862 | ~620 | 9 | 9 |
| `src/components/bids/BidsPricingTab.tsx` | 2,610 | ~1,160 | 6 | 6 |
| `src/pages/Checklist.tsx` | 2,533 | ~240 | 11 | 12 |
| `src/components/jobs/SendRecordInvoiceModal.tsx` | 2,451 | ~1,080 | 9 | 9 |
| `src/components/schedule/ScheduleDispatchHub.tsx` | 2,428 | ~430 | 9 | 9 |

## Recommended order of attack

Four waves, chosen by payoff-to-risk ratio and what's already in flight. Different domains can run
as parallel worktree sessions (the Dashboard-decomposition recipe); within one file, PRs are strictly
sequential.

**Wave 1 — quick wins with huge ratios (low risk, mostly leaf sections):**
1. `Checklist.tsx` 2,533 → ~240 — nearly everything is separable tab sections.
2. `ScheduleDispatchHub.tsx` 2,428 → ~430 — **wait for `feat/edit-job-ux-polish` to merge first**;
   this file has uncommitted changes on that branch right now.
3. `JobsJobSummaryTab.tsx` 2,862 → ~620 — print builders and drilldowns peel off cleanly.
4. `Prospects.tsx` 3,373 → ~1,000 — two boards that barely share state.

**Wave 2 — finish what's started (momentum + current Step-0 maps):**
5. `JobFormModal.tsx` 4,085 → ~2,050 — decomposition already underway (7,226 → 4,085 so far);
   continue with the plan below (payments table next, per the open thread).
6. `Jobs.tsx` 10,603 → ~3,200 — the single biggest payoff (−7.4k lines);
   `docs/JOBS_TABS_ARCHITECTURE.md` is current as of today, so the map is free.

**Wave 3 — the other >5k giants:**
7. `Materials.tsx` 6,935 → ~1,800 (−5.1k, 15 clean tab/book extractions)
8. `Settings.tsx` 5,171 → ~1,200 (−4.0k; several tabs already extracted, finish the set)
9. `PeopleReviewTab.tsx` 5,007 → ~1,400 and `Estimates.tsx` 5,333 → ~2,350
10. `BidsTakeoffTab.tsx` 5,641 → ~2,700 — hardest of the giants (tangled pricing state); do it
    with the Step-0 map open and favor kernel extractions first.

**Wave 4 — the 2.4k–4.8k mid-tier:** `Workflow.tsx`, `People.tsx`,
`DashboardMyTimeDayEditorModal.tsx`, `Bids.tsx`, `Banking.tsx`, `PeopleContractsTab.tsx`,
`DashboardTeamActiveClockStrip.tsx`, `BidsPricingTab.tsx`, `SendRecordInvoiceModal.tsx` — order by
whichever surface is being actively worked anyway, so refactors ride along with feature familiarity.

House rules for every PR (from the playbook + CLAUDE.md): one extraction per PR, auto-merge squash;
byte-identical behavior (no drive-by fixes — log them in the file's Risks section instead); favor
pure `src/lib/` kernels with tests wherever logic can leave the component; `npm test` +
typecheck/lint before push; theme tokens only (CI enforces); no help-guide changes needed for pure
refactors. After finishing a file, update its `docs/*_ARCHITECTURE.md` map.

---

## src/pages/Jobs.tsx — 10,603 → ~3,200 lines

src/pages/Jobs.tsx is the app's job-lifecycle hub: a 10,603-line tab-switched God component (10 tab keys, one vestigial) covering the Stages kanban-style billing board (waiting → working → ready-to-bill → billed → collections → paid, with a serialized status/invoice mutation engine, ~15 modals, and AR integration), a Billing summary table, the Sub Labor ledger (full CRUD engine + a ~1,000-line inline New/Edit modal + payments/backcharge/settings modals), Parts and Job Summary data layers (Mercury card-charge attribution, lazy per-job P&L caches, print builders), plus thin wrappers for the already-extracted Reports, Crew P&L, Team Labor, Parts, Job Summary, and Inspections tab components. The jobs list itself lives in the app-level JobsListCacheContext; the page owns the URL deep-link router, role gating, four inline data engines, four print builders, and all cross-tab glue. A complete, current Step-0 map exists at docs/JOBS_TABS_ARCHITECTURE.md (updated 2026-07-19) — this plan follows its recommended order.

**Already extracted:** Six tab renders are already components: JobsCrewPnlTab, JobsReportsTab, JobsSubLaborTab (list only), JobsPartsTab (list only), JobsJobSummaryTab (render only, 2,862 lines), JobsInspectionsTab, plus the Team Labor wrapper around shared CrewJobsBlock. Shared engines already out: JobsListCacheContext (the jobs list itself), usePartsLedgerData, useJobThreadNotes, useArBankUnallocatedCount, useSubLaborDueTotal. Pure kernels already out with tests: lib/jobsStagesBoard.ts (board lists, StageRow/AR-target builders), lib/jobsStagesScheduleSessionSearch.ts, lib/jobsStagesSerializedPipeline.ts, lib/jobs/invoiceBilling.ts, lib/jobs/jobFormatting.ts, lib/jobs/subLaborCost.ts, lib/subLaborOutstanding.ts, lib/stagesJobReferenceDates.ts, lib/stagesPctNote.ts, lib/jobSummary*.ts (HCP filter, pct, person tables), lib/updateJobStatusClientFeedback.ts. Standalone modals already components: BankPaymentsModal, JobBookModal, JobsCombineSeparateModal, BilledBillViewModal, LienToolingPrefillModal, AiaG702G703Modal, BilledPaymentConfirmationModal, ScheduleJobModal, StagesNoCustomerJobsModal, StagesAlertJobListModal, the Parts mercury modal trio, JobSummaryCostCellDrilldownModal, and the app-context modals (JobFormModal, DetailJobModal, Bill Customer flow). The Step-0 map docs/JOBS_TABS_ARCHITECTURE.md exists and is current.

### Internal structure

| Section | Lines | What it is |
|---|---|---|
| Module imports, helpers, types | 1–288 | Imports (heavy use of already-extracted lib/jobs/* kernels), JobsTab union + JOBS_TABS (~199), module-scope types/helpers |
| Component state block | 289–843 | export default function Jobs() at 289; ~162 useState + ~20 refs all declared here: stages cluster (~735–842), sub-labor cluster (~451–524), job-summary caches (~591–692), mercury/parts (~717–734); loadJobSummaryLedger callback at 391; scheduleLoadJobsAfterMutation at 431 |
| Stages board memos + row callbacks | 844–1144 | renderStagesOpenDetailJobName useCallback (858 — parent-scope quirk #13), stagesBoardLists memo (890, delegates to tested lib/jobsStagesBoard.ts), bankPaymentsModalBilledRows empty-search rebuild (1011, quirk #9), billedAgingBuckets inline math (1032 — Stage-A candidate), customerListImpliesLinkedRow (1097), ham/search toggles (1120–1144) |
| Job-status + invoice mutation engine | 1145–1344 | executeUpdateJobStatus (1145), updateJobStatus serialized wrapper (1175), moveJobToReadyToBillWithStripePrep (1180), revertBilledInvoiceToReadyToBill (1201), deleteInvoice (1277) — all serialized via lib/jobsStagesSerializedPipeline; the useJobsStagesMutations seam |
| Roster + Sub Labor CRUD engine + shared loaders | 1346–2416 | loadUsers/loadRoster + roster partitions (1346–1503), labor book loaders/editors (1504–1553, 1733–1959), loadLaborJobs (1554), loadStagesManHours (1641), loadTeamLaborData (1656 — near-duplicate of utils/teamLabor.ts, quirk #15), saveLaborJob/delete/payments (1984–2168), form plumbing incl. openEditLaborJob/resetLaborForm (2169–2302), saveEditedLaborJob (2303) |
| Print builders | 2417–3133 | printLaborSubSheet (2417) and printJobSubSheet (2471) — near-duplicates; printJobSummaryCostBreakdown (2525, ~500 lines, already takes an explicit opts object); printBilledAwaitingPaymentReport (3034); each re-declares escapeHtml (quirk #10) |
| URL deep-link router + tab/load effects | 3135–3819 | shouldLoadJobsListForActiveTab (3141), customers loader gate (3175), the big role-gated router effect incl. legacy rewrites (3243+), ?jobDetail= (3404), sub-labor/labor-book effects (3642–3672), per-tab loader effects (3688–3710), visibilitychange refetch, return-edit-banner handshake |
| Mercury/parts callbacks + Job Summary memo + job-form glue + row mutations | 3820–4609 | loadPartsTabMercuryForJob (3850), onPartsAllocSaved routing (4003), drive/default-rate settings (4132–4241), jobSummaryData P&L memo (4242), refreshCustomersAfterJobFormSave/openNew/openEdit (4327–4371), createInvoiceFromModal (4372), fillLaborFromBilling(+JobAndSwitch) (4460–4491), updateJobTeamMembers/updateJobPctComplete/est-bill-date setters (4492–4609) |
| Tab bar | 4610–4784 | Role-gated tab buttons (showStagesAndBillingTabs, showTeamsTab, etc.); labels differ from keys (teams-summary=Crew P&L, combined-labor=Team Labor, sub_sheet_ledger=Sub Labor) |
| Reports tab (extracted wrapper) | 4785–4803 | Thin <JobsReportsTab/> in the page's only ErrorBoundary |
| Stages tab — THE monster | 4804–8331 | Toolbar + jump nav + alert modals (4804–5278), then one IIFE (5279–8196): row-helper closures (5300–6073), renderStagesTable (6074), renderUnifiedStagesTable (6477), six section wirings (7621–7990), inline Total-by-Name (7991) / Capable-to-Bill (8173) / est-bill-date (8264) modals |
| Extracted tab wrappers | 8332–8696 | JobsSubLaborTab (8332), Team Labor CrewJobsBlock wrapper (8354), inline Billing tab (8369–8605, ~237 lines — last small inline tab), JobsCrewPnlTab (8606), JobsPartsTab (8618), JobsJobSummaryTab (8648, ~35 props), JobsInspectionsTab (8693) |
| Modal tail — Sub Labor cluster | 8697–10126 | Inline New/Edit Sub Labor modal (8697–9603, ~907 lines), Add Subcontractor (9604), Default Labor Rate (9679), Drive Settings (9712), JobReportsModal (9856), Ready-for-Billing double-checkbox (9868), partial-invoice (9892), BankPayments/JobBook/CombineSeparate/BilledBillView/Lien/AIA/mark-paid ×2 (9931–10020), Make Payment/Backcharge/Edit Payment (10021–10126) |
| Modal tail — Stages send-backs + shared modals | 10127–10603 | sendBackInvoice (10127), sendBackJob (10200), dead confirmJobStatusJob modal (10294, quirk #3), sendBackConfirmJob (10333), collectionsConfirm (10376), ScheduleJobModal (10456), ManageJobPeopleModal (10469), Parts mercury modal trio (10478–10516), JobSummaryCostCellDrilldownModal (10592) |

### Extraction candidates (easiest/safest first)

1. **subLaborSheet print builder (unifies printLaborSubSheet + printJobSubSheet)** — kernel, ~110 lines, low risk, unit-testable → `src/lib/jobsDocuments/subLaborSheet.ts`
   - Inputs: explicit context object: labor form/job fields (assigned names, address, distance, HCP, date, fixture rows, entry mode), drive settings, default labor rate; returns HTML string; parent keeps only the window.open/print glue
   - Notes: The two builders differ only in data source (quirk #10 in the map) — one parameterized builder, byte-identical output, colocated test. Keep the per-function escapeHtml consolidation output-identical.
2. **billedAwaitingPaymentReport print builder** — kernel, ~100 lines, low risk, unit-testable → `src/lib/jobsDocuments/billedAwaitingPaymentReport.ts`
   - Inputs: rows: StageRow[] (from lib/jobsStagesBoard), opts { searchFilter? }; returns HTML string
   - Notes: Currently printBilledAwaitingPaymentReport at ~line 3034. Pure HTML builder over already-extracted StageRow types.
3. **jobSummaryCostBreakdown print builder** — kernel, ~500 lines, low risk, unit-testable → `src/lib/jobsDocuments/jobSummaryCostBreakdown.ts`
   - Inputs: the explicit opts object printJobSummaryCostBreakdown (~line 2525) already takes: job summary row, parts/invoice/mercury/labor/team-labor detail, drive settings
   - Notes: Near-mechanical move per the map — the function already receives an explicit opts object rather than closing over state. Biggest single Stage-A win.
4. **JobsBillingTab** — component, ~237 lines, low risk → `src/components/jobs/JobsBillingTab.tsx`
   - Inputs: jobs, laborJobs/teamLaborData (for the two red icons), customers, authRole/myRole, openNew/openEdit, onFillLaborFromBilling (parent callback that switches to Sub Labor and prefills the labor form), error/setError, authUser.id (localStorage sort key jobs_billing_sort_asc_${uid})
   - Notes: Smallest inline tab; owns only searchQuery + billingSortAsc. Optional micro Stage-A first: sort comparator + fixtures/materials line formatting into lib/jobs/. Validates the wrapper pattern on this page.
5. **useSubLaborLedger** — hook, ~700 lines, medium risk → `src/hooks/useSubLaborLedger.ts`
   - Inputs: authUser, activeTab (load gating), setError, showToast; returns ledger (laborJobs, laborJobNamesByHcp, loading), roster (people/users partitions), labor book (service/fixture types, versions, entries), payments mutations, drive/default-rate settings, and all CRUD fns (saveLaborJob, saveEditedLaborJob, deleteLaborJob, record/delete/update payments, loadRoster, loadLaborJobs, ...)
   - Notes: Lines ~1346–2416 engine. Parent destructures the returned object so downstream refs are unchanged (playbook Step 2 seam pattern). laborJobs/teamLaborData/drive settings also feed Crew P&L, Job Summary, and Billing icons — the hook lives in the parent, not in the tab. Keep the inline loadTeamLaborData byte-stable (quirk #15 — duplicate of utils/teamLabor.ts; adoption is a later behavior-risk PR).
6. **JobsSubLaborFormModal (the inline New/Edit Sub Labor modal)** — component, ~1000 lines, medium risk → `src/components/jobs/JobsSubLaborFormModal.tsx`
   - Inputs: open/editingLaborJob, the useSubLaborLedger engine object, labor-form state cluster (laborAssignedTo, laborAddress, laborFixtureRows, entry mode, invoice-link draft ...) or move the form state inside, labor-book pickers, onClose/onSaved, print callbacks (now lib-backed), Add Subcontractor sub-modal (~9604–9678)
   - Notes: Lines ~8697–9678 in the modal tail. Opened by the tab, by Billing prefill, and by ?editLabor=/?newJob= deep links — the openers and prefill glue stay in the parent. Biggest single component move outside Stages.
7. **Sub Labor satellite modals fold into JobsSubLaborTab (Make Payment, Backcharge, Edit Payment, Drive Settings, Default Labor Rate)** — component, ~350 lines, low risk → `src/components/jobs/JobsSubLaborTab.tsx`
   - Inputs: the useSubLaborLedger engine; all five are single-opener modals used only from this tab (lines ~9679–9855 and ~10021–10126)
   - Notes: Absorb into the existing extracted tab component per the map. Default-rate save keeps its myRole === 'dev' client gate verbatim.
8. **useJobsMercuryAllocations** — hook, ~300 lines, medium risk → `src/hooks/useJobsMercuryAllocations.ts`
   - Inputs: activeTab, authUser, setError; owns mercuryCardChargesByJobId, partsTabMercuryAllocationsByJobId + loaded/in-flight refs, the two flow refs (partsUnattribFlowJobIdRef, jobSummaryMercuryEditFlowJobIdRef), alloc-modal open/data state, bankingAttributionUsersOptions, and loadPartsTabMercuryForJob / refresh / onPartsAllocSaved routing (~3850–4110)
   - Notes: Shared by Parts AND Job Summary drilldown — must be a parent-level hook (playbook cluster rule). Risk: onPartsAllocSaved routes cache refreshes to both tabs via the flow refs; preserve routing exactly. After this, the three mercury modals + remaining parts state (~12 vars) move into JobsPartsTab as a follow-up.
9. **useJobSummaryData** — hook, ~450 lines, medium risk → `src/hooks/useJobSummaryData.ts`
   - Inputs: activeTab, jobs (fallback source), laborJobs, teamLaborData, drive settings, usePartsLedgerData outputs, mercury card totals, authUser; owns loadJobSummaryLedger (~391) + snapshot refs, the five lazy per-job caches (clock sessions, invoice lines, mercury allocations, reports, report pct), and the jobSummaryData P&L memo (~4242)
   - Notes: Optionally split: Stage A the jobSummaryData join math into lib/jobSummaryPnl.ts + tests first. scheduleLoadJobsAfterMutation must still re-run the ledger loader (keep loadJobSummaryLedgerRef handshake). Preserve the ReactNode-in-state drilldown pattern (quirk #11).
10. **Stages aging/capable-to-bill kernels** — kernel, ~80 lines, low risk, unit-testable → `src/lib/jobsStagesBoard.ts`
   - Inputs: billed rows / board lists already produced by buildJobsStagesBoardLists
   - Notes: billedAgingBuckets (~1032, 30/90-day bucketing) and the Capable-of-Being-Billed math (computed twice — quirk #8; one lib fn, both call sites kept). Small PR; append to the existing tested lib file.
11. **useJobsStagesMutations (the job-status/invoice mutation engine)** — hook, ~250 lines, medium risk → `src/hooks/useJobsStagesMutations.ts`
   - Inputs: setJobs + loadJobs/scheduleLoadJobsAfterMutation (cache context), authRole (Stripe mode), setError, showToast, followMovedJob callback; owns stagesStatusUpdatingId/stagesInvoiceUpdatingId + the two lock refs internally; returns updateJobStatus, moveJobToReadyToBillWithStripePrep, revertBilledInvoiceToReadyToBill, deleteInvoice, plus row-level writes (est-bill-date set/bump, updateJobTeamMembers, updateJobPctComplete, createInvoiceFromModal, collections flag)
   - Notes: Lines ~1145–1344 + ~4372–4609. Serialization stays on the module-level lib/jobsStagesSerializedPipeline (quirk #14). Keep the optimistic-patch + 300ms debounced refetch timings (quirk #12). Prerequisite for any Stage-B move of the Stages sections. Later convergence with useDashboardBillingInvoices via a shared lib/jobStatusMutationCore.ts is explicitly NOT this PR.
12. **JobsStagesTable + JobsStagesUnifiedTable (the two section table renderers)** — component, ~1700 lines, high risk → `src/components/jobs/JobsStagesUnifiedTable.tsx`
   - Inputs: renderStagesTable's 9 params and renderUnifiedStagesTable's rows + 20-key options object become the prop contracts (the map notes they are already prop-shaped); plus the row-helper closures they call (renderStagesJobHcpSubline, renderStagesFieldAndBillingLines, renderStagesLastActivityCell, renderStagesProjectBannerRow, renderStagesOpenDetailJobName), ham-mode editors (assigned-edit dropdown, pct-complete), mutation engine fns, useJobThreadNotes panel wiring, flash/focus ids
   - Notes: Two files (JobsStagesTable.tsx sibling). Currently closures inside the IIFE at ~5279–7620 — highest closure-capture density in the file; every helper must become a prop or move in. Requires PRs for the mutations hook first. This is the riskiest diff; keep it a pure cut/paste of JSX with props threaded.
13. **JobsStagesTab (toolbar, jump nav, search, sections, single-opener modal cluster)** — component, ~1600 lines, high risk → `src/components/jobs/JobsStagesTab.tsx`
   - Inputs: stagesBoardLists inputs (jobs, search state moves in), the mutations hook object, bill-customer/job-form/detail-modal context openers, customers/users, man-hours map, AR count, deep-link focus props (pendingStagesInvoiceFocusId/pendingStagesJobFocusId + appliers stay controlled from the parent router), error/setError
   - Notes: Moves ~55 stages-owned state vars, the section wiring (~7621–7990), inline Total-by-Name/Capable/est-bill-date modals, and the ~20 single-opener modal states in the tail (send-backs, mark-paid, collections, ready-for-billing, partial invoice, lien, AIA, schedule, job book, combine/separate, AR opener, view-reports — incl. the dead confirmJobStatusJob modal moved wholesale, quirk #3). URL router, jobs cache wiring, customers/users loaders, and the AR page's parallel BankPaymentsModal mount stay in the parent. localStorage keys jobs-stages-ham-mode / follow-moves / include-schedule-time move with it.

### Suggested PR sequence

1. PR 1: Stage A — extract subLaborSheet.ts print builder to src/lib/jobsDocuments/ unifying printLaborSubSheet + printJobSubSheet (~110 lines) + tests — zero UI risk, starts the jobsDocuments/ convention, unblocks the Sub Labor moves
2. PR 2: Stage A — extract billedAwaitingPaymentReport.ts print builder (~100 lines) + tests — pure HTML over already-tested StageRow types
3. PR 3: Stage A — extract jobSummaryCostBreakdown.ts print builder (~500 lines) + tests — near-mechanical (explicit opts object already), biggest single low-risk line win
4. PR 4: extract JobsBillingTab (~237 lines) — smallest inline tab, 2 state vars, validates the thin-wrapper pattern; onFillLaborFromBilling stays a parent callback
5. PR 5: seam — extract useSubLaborLedger hook (~700 lines of loaders/CRUD) — parent destructures the return so downstream refs are unchanged; prerequisite for the modal move
6. PR 6: extract JobsSubLaborFormModal (~1,000 lines: the inline New/Edit modal + Add Subcontractor) — biggest non-Stages component win; deep-link/prefill openers stay in the parent
7. PR 7: fold the five Sub Labor satellite modals (payments, backcharge, edit payment, drive settings, default rate, ~350 lines) into the existing JobsSubLaborTab — all single-opener
8. PR 8: seam — extract useJobsMercuryAllocations hook (~300 lines) shared by Parts + Job Summary; then (same or follow-up PR) move the three mercury modals + remaining parts state into JobsPartsTab
9. PR 9: seam — extract useJobSummaryData hook (~450 lines: ledger loader, five lazy caches, jobSummaryData P&L memo) — Job Summary becomes a true thin wrapper
10. PR 10: Stage A — billedAgingBuckets + capable-to-bill kernels into lib/jobsStagesBoard.ts (~80 lines) + tests — clears the last pure math out of the Stages IIFE
11. PR 11: seam — extract useJobsStagesMutations hook (~250 lines engine) — locks/busy-ids inside; serialization stays module-level; required before any Stages JSX moves
12. PR 12: extract JobsStagesTable + JobsStagesUnifiedTable components (~1,700 lines) — the closure params are already prop-shaped; pure cut/paste with props threaded
13. PR 13: extract JobsStagesTab (~1,600 lines: toolbar, jump nav, search state, section wiring, single-opener modal cluster) — parent keeps router, cache wiring, customers/users, shared contexts
14. PR 14 (later, behavior-changing cleanup — NOT part of the refactor series): remove vestigial 'billed' tab member + dead confirmJobStatusJob modal; adopt utils/teamLabor.ts loadTeamLaborData after a parity check

### Risks & gotchas

- The Stages IIFE (~5279–8196) is all closures over ~55 parent state vars — every render helper captures parent scope, so PRs 12–13 are large prop-threading diffs; they must land only after the mutations hook (PR 11) exists or dozens of engine fns get threaded by hand (explicit playbook anti-pattern)
- Behavior quirks must be preserved verbatim (map quirks 1–16): dual role sources with inconsistent gate expressions (authRole || myRole short-circuit vs .some), the dead confirmJobStatusJob modal, the empty-search bankPaymentsModalBilledRows rebuild (verbatim copy in JobsAccountsReceivable.tsx must stay in lockstep via the lib builder), capable-to-bill math computed twice, optimistic patch + 300ms debounce + 700ms follow-scroll retry timings, ham-mode confirm bypasses
- loadTeamLaborData is a near-duplicate of utils/teamLabor.ts — tempting to dedupe during PR 5, but that is a behavior-risk change; keep the inline copy byte-stable until the separate parity-check PR
- The serialized mutation pipeline is module-level state shared with JobsCombineSeparateModal.onAfterSuccess — the mutations hook must keep calling lib/jobsStagesSerializedPipeline, never re-create the queue per-instance
- onPartsAllocSaved routes cache refreshes to Parts and/or Job Summary via two flow refs — the mercury hook (PR 8) must preserve that routing exactly or one tab shows stale allocations after a save from the other
- URL deep-link router touches nearly every tab's state (?edit, ?editLabor, ?editParts, ?openBankPayments, ?stagesInvoice, ?stagesSection, ?jobSummaryHcp, ?teamLaborJob, ?customer) — focus/flash state that the router writes must stay parent-owned and be passed down as controlled props, or deep links silently break
- No render-test harness — component moves (PRs 4, 6, 7, 12, 13) are verified only by typecheck/lint/manual smoke; this is why every pure kernel ships first behind vitest
- The file is actively churning (v2.757–760 added pct-complete editors to every Stages section this week; current branch has uncommitted sibling edits) — line anchors rot fast; each PR should re-anchor by symbol search, and worktree agents should branch from fresh main
- One global error state is shared by every tab and the Sub Labor modal (quirk #7) — keep the single state and pass error/setError down; giving tabs local error state would change visible behavior

---

## src/pages/Materials.tsx — 6,935 → ~1,800 lines

Materials.tsx is the ~6,935-line "God component" for the materials system: a six-tab surface ('parts-book' | 'assembly-book' | 'templates-po' | 'purchase-orders' | 'supply-houses' | 'po-generator') scoped by a service-type selector, with ~144 useStates, 23 useEffects, and two module-level components at the bottom of the file. It owns the parts catalog (paginated + Load-All modes with infinite scroll), assembly (template) CRUD with recursive cost calculation, a draft/finalized purchase-order engine shared across two tabs, PO print/HTML builders, a PO Generator ledger (RPC-allocated shop codes), and the URL deep-link router (?tab=, ?po=/location.state.openPOId, ?addPart, ?addAssembly, legacy price-book slug rewrite). One tab (supply-houses) is already extracted to SupplyHousesTab. The shared substrate is data, not a record pointer: five service-type-scoped caches plus the parts caches; the two real coupling clusters are the assembly selection (selectedTemplate/templateItems shared by assembly-book + templates-po, including shared filter state/refs rendered by both tabs) and the PO engine (allPOs/draftPOs/selectedPO/editingPO shared by templates-po + purchase-orders + the deep-link router). Note the page is LOW-CHURN (9 commits in 10 weeks) — its Step-0 map docs/MATERIALS_TABS_ARCHITECTURE.md exists precisely so extraction can start anytime; this plan follows that map.

**Already extracted:** SupplyHousesTab (src/components/SupplyHousesTab.tsx, ~1,367 lines — the supply-houses tab, rendered as a thin wrapper); PartFormModal (src/components/PartFormModal.tsx); SupplyHouseForm + SupplyHouseWebsiteLink (src/components/); lib/materialPOUtils.ts (expandTemplate/addExpandedPartsToPO, 150 lines — NO colocated tests yet, add them per the map); lib/parsePoGeneratorCodeFromPurchaseOrderName.ts (+test). Also relevant: docs/MATERIALS_TABS_ARCHITECTURE.md is the completed Step-0 map (updated 2026-07-19) — keep its per-tab Status fields updated as extractions land. No src/components/materials/ directory exists yet; the first component extraction creates it (naming follows the Bids/People pattern: Materials<Tab>Tab).

### Internal structure

| Section | Lines | What it is |
|---|---|---|
| Imports, shared types, module helpers | 1-147 | Imports; DB row type aliases; ServiceType/PartType/AssemblyType interfaces; PartWithPrices/TemplateItemWithDetails/POItemWithDetails/PurchaseOrderWithItems/PoGenerator* types; PARTS_PAGE_SIZE=50; module-level fetchPricesForParts (500-ID chunked batch price fetch + client re-sort); formatCurrency; MATERIALS_TABS union |
| Component state blocks | 149-337 | ~144 useStates in labeled clusters: role/service-types (162-171), Parts Book search/filter/paging + loadingPartsRef (172-204), Load-All mode + localStorage key (205-211), Supply House Management modal 9-field cluster (212-225), Templates & PO Builder (~30 states, 226-283), Add Item Modal cluster (284-296), five refs (297-301), Purchase Orders + poGen* clusters (303-323), poGenSupplyHouseResults useMemo (324-336) |
| Loaders | 338-1004 | loadRole, loadServiceTypes, loadPartTypes, loadAssemblyTypes (as-any cast), loadSupplyHouses (legacy-column fallback), loadPoGeneratorLedger (useCallback), loadParts (paginated; RPC price-count-sort special path), loadAllParts, loadMaterialTemplates, loadSupplyHouseStatsByServiceType (RPC + grouping loops), reloadPartsFirstPage, loadTemplateItems, loadAllTemplateItemsForStats, loadPurchaseOrders (per-PO Promise.all item loads + notes-author lookup), handleNavigateToPOFromSupplyHouses |
| Effects (URL router, reload, scroll, dropdowns) | 1005-1420 | 23 effects: boot loads; ?tab= guard with role redirect + legacy price-book rewrite; Load-All localStorage restore; service-type/loadAllMode master reload (six loaders in parallel); 300ms debounced parts search; templates-po/assembly-book stats load gate; ?po=/openPOId deep-link (seeds draftPOs/allPOs, double-rAF scroll); ?addPart/?addAssembly; location.state.refreshPrices; click-outside for pickers; editingPO.id item reload; window-scroll infinite scroll (200px threshold, loadingPartsRef guard, gated off in Load-All) |
| In-body pure helpers + derived values | 1421-1568 | filterPartsByQuery, filterTemplatesByQuery (pure functions in component body); sortedParts; displayParts Load-All client filter/sort IIFE; manufacturers; filteredPOs; templateIdsWithItems; filteredTemplates; template stats (partIdsWithNoPrice from the PAGINATED parts cache — quirk); calculateAssemblyCost (recursive, cycle-guarded, closes over allTemplateItemsForStats + partIdToLowestPrice) |
| Handlers: parts / supply houses / templates / items / POs / po-gen | 1569-2948 | Part modal open/save (1569-1603); supply-house modal CRUD (1604-1720); template CRUD (1721-1806); item CRUD with quantity-merge + self-reference guard (1807-2004); PO functions (2005-2948): create/expand via lib/materialPOUtils, updatePOItem, fetchPricesForPart, printPO + printPOForSupplyHouse inline HTML builders (2260-2353), updatePartPriceInBook (price 0 = delete), updatePOItemSupplyHouse (optimistic 4-way state write), formatTimeSince, confirm/unconfirm price (zero-delta history insert), updatePOName, duplicatePOAsDraft (sequential copy, rollback on failure), finalizePO, addNotesToFinalizedPO (add-only race-guarded), deletePO, handlePoGeneratorGenerate |
| Render open: role gate, service-type row, tab buttons | 2949-3090 | visibleServiceTypes per-role filter; access-denied gate; service-type button row (hidden on supply-houses); role-gated tab buttons writing ?tab= |
| Parts Book tab JSX | 3091-3346 | Toolbar (search, part-type/manufacturer filters, price-count sort, Load-All toggle, supply-house stats header), parts table with expandable price rows, infinite-scroll footer |
| Shared page-level modals | 3348-3556 | PartFormModal wiring (extracted component; opened from 3 tabs + ?addPart), Part Prices Modal (wraps in-file PartPricesManager), inline Supply House Management Modal (wraps extracted SupplyHouseForm; legacy duplicate of SupplyHousesTab CRUD — load-bearing for roles without the Supply Houses tab) |
| Assembly Book tab JSX | 3557-4123 | Filter/search toolbar (shared filter state + filterAssemblyTypeDropdownRef also rendered by templates-po), assembly card list with cost/unpriced badges, detail panel: parts with expandable prices + inline qty editor, nested assemblies, cost summary, TemplatePricesManager bundle prices, quick actions |
| Assemblies & PO Builder (templates-po) tab JSX | 4124-5024 | Two-column grid: left = assembly list (second copy of filter dropdown) + selected-assembly items table + inline add-item pickers + bundle prices; right = create-PO-from-template / add-template-to-PO, draft PO list, editingPO detail with per-item qty/supply-house/price/notes editing |
| Template Form Modal + Add Item Modal | 5026-5373 | Template Form Modal (5026-5099; opened from assembly-book, templates-po, ?addAssembly — stays parent); Add Item to Assembly Modal (5101-5372; opened from assembly-book only — moves with it) |
| Purchase Orders tab JSX | 5374-5975 | selectedPO detail card (add-only notes, items table with draft-only price editing + confirmation, tax footer with '8.25' default and inconsistent \|\|0 vs \|\|8.25 fallbacks, print/delete/duplicate/finalize), then search/status filter + all-POs table |
| PO Generator tab JSX | 5976-6386 | Role-gated generate card (debounced job search via RPC, user search, optional supply house, notes) + newest-200 ledger table |
| Supply Houses tab wrapper (already extracted) | 6387-6396 | Thin role-gated render of SupplyHousesTab with 5 props — the target end-state for every other tab |
| TemplatePricesManager (module component) | 6401-6579 | Self-contained assembly bundle-price CRUD on material_template_prices; rendered by both assembly-book and templates-po detail panels; props: template, supplyHouses |
| PartPricesManager (module component) | 6581-6935 | Self-contained part price CRUD + per-supply-house price history viewer (material_part_prices, material_part_price_history); rendered by the shared Part Prices Modal; onPricesUpdated callback patches parent caches |

### Extraction candidates (easiest/safest first)

1. **assemblyCost** — kernel, ~45 lines, low risk, unit-testable → `src/lib/materials/assemblyCost.ts`
   - Inputs: (templateId, items: TemplateItemWithDetails-like[], lowestPriceByPartId: Map, parentQuantity, visited?) — currently a closure at lines 1527-1567
   - Notes: Recursive with cycle guard (visited set) and quantity multiplication — the highest-value untested calc on the page. Tests: recursion depth, quantity multiply, cycle guard, missing-price parts.
2. **materialsFilters** — kernel, ~60 lines, low risk, unit-testable → `src/lib/materials/materialsFilters.ts`
   - Inputs: filterPartsByQuery(partList, query, limit=50), filterTemplatesByQuery(...) at 1422-1446, plus the displayParts Load-All filter/sort IIFE at 1451-1480 as a pure function taking (allParts, clientSearchQuery, filterPartTypeId, filterManufacturer, sortByPriceCountAsc)
   - Notes: Pure functions already sitting in the component body; used by part pickers in 3 tabs.
3. **poItemDetails (loadPOWithItems)** — kernel, ~120 lines, low risk, unit-testable → `src/lib/materials/poItemDetails.ts`
   - Inputs: (supabase, poId) — wraps the purchase_order_items SELECT with material_parts(*), supply_houses(*), source_template join + the itemsWithDetails mapping, copy-pasted ~10x across the file
   - Notes: Single biggest de-duplication win per the architecture map. Test the pure row->POItemWithDetails mapping; the query wrapper takes supabase as an arg.
4. **poPrint document builders** — kernel, ~95 lines, low risk, unit-testable → `src/lib/materialsDocuments/poPrint.ts`
   - Inputs: buildPoPrintHtml(po, { pricesPerItem }) and buildPoSupplyHousePrintHtml(po, taxPercent) — pure HTML string builders from printPO/printPOForSupplyHouse (2260-2353); the draft-mode Promise.all(fetchPricesForPart) stays in the caller
   - Notes: Follows the lib/bidDocuments pattern. Tests: escapeHtml, finalized vs draft thead/rows, grand total, with-tax footer. Print surfaces stay light-themed (inline print CSS is customer-facing, exempt from token rule).
5. **fetchPricesForParts + shared formatters** — kernel, ~70 lines, low risk, unit-testable → `src/lib/materials/fetchPricesForParts.ts`
   - Inputs: Module-level already (lines 108-145): fetchPricesForParts (500-ID chunks, client re-sort — preserve batch size, it is the v2.46 disk-IO optimization), formatCurrency, plus formatTimeSince from 2471-2489
   - Notes: Test the chunk-grouping/re-sort logic (extract groupPricesByPart as the pure core); check for existing formatCurrency/formatTimeSince equivalents in lib first per the map. Also fold in groupSupplyHouseStats from loadSupplyHouseStatsByServiceType's grouping loops (722-790).
6. **TemplatePricesManager** — component, ~175 lines, low risk → `src/components/materials/TemplatePricesManager.tsx`
   - Inputs: template: MaterialTemplate, supplyHouses: SupplyHouse[]
   - Notes: Verbatim file move of the module component at 6411-6579 — fully self-contained (own state, own supabase calls). Creates the src/components/materials/ dir.
7. **PartPricesManager** — component, ~355 lines, low risk → `src/components/materials/PartPricesManager.tsx`
   - Inputs: part, supplyHouses, onPricesUpdated (parent-owned callback that patches parts/allParts/templateItems caches — keep in parent)
   - Notes: Verbatim move of 6581-6935 + the PriceHistory type at 6401-6403. Self-contained CRUD + price-history viewer.
8. **MaterialsPoGeneratorTab** — component, ~545 lines, low risk → `src/components/materials/MaterialsPoGeneratorTab.tsx`
   - Inputs: supplyHouses, selectedServiceTypeId, myRole, onError/setError, showToast (or use ToastContext directly); moves the ~14 poGen* states, the poGenSupplyHouseResults memo, loadPoGeneratorLedger, handlePoGeneratorGenerate, and all four activeTab-gated effects (mount-gating replaces the activeTab guard)
   - Notes: The momentum-builder extraction (the page's 'bid-costs'). JSX 5977-6385 + state 303-336 + loader 472-501 + handler 2912-2948. Fully self-contained; only DB-level coupling to SupplyHousesTab invoice warnings.
9. **useMaterialsPurchaseOrders (PO engine seam)** — hook, ~130 lines, medium risk → `src/hooks/useMaterialsPurchaseOrders.ts`
   - Inputs: selectedServiceTypeId, setError; returns { allPOs, draftPOs, selectedPO, editingPO, setters, userNamesMap, loadPurchaseOrders } — parent destructures so downstream references are unchanged; includes the editingPO.id reload effect (uses loadPOWithItems from Stage A)
   - Notes: The seam both templates-po and purchase-orders consume. The ?po=/openPOId deep-link router and handleNavigateToPOFromSupplyHouses STAY in the parent and call the hook's setters (playbook rule).
10. **MaterialsPurchaseOrdersTab** — component, ~950 lines, medium risk → `src/components/materials/MaterialsPurchaseOrdersTab.tsx`
   - Inputs: PO engine values/setters from the hook, supplyHouses, myRole, setError, showToast, onDuplicateToDraft (switches parent tab to templates-po), selectedPODetailRef (or move ref in, parent scrolls via callback)
   - Notes: JSX 5374-5975 + owned state (poStatusFilter, poSearchQuery, viewedPOTaxPercent, notes/duplicate/price-editing clusters) + tab-local handlers (finalizePO, addNotesToFinalizedPO, deletePO, duplicatePOAsDraft, print callers, confirm/unconfirm price, updatePartPriceInBook, addPartPriceFromPOModal, loadAvailablePricesForPart). updatePOItemSupplyHouse's 4-way optimistic write moves to the hook. Preserve the ||0 vs ||8.25 tax fallbacks and add-only notes race guard verbatim.
11. **useMaterialsCatalog (parts seam)** — hook, ~250 lines, medium risk → `src/hooks/useMaterialsCatalog.ts`
   - Inputs: authUser, myRole, visibleServiceTypes context; returns parts, allParts, loadAllMode + localStorage persistence, pagination state/refs, loadParts/loadAllParts/reloadPartsFirstPage, partTypes, assemblyTypes, supplyHouses, serviceTypes, selectedServiceTypeId, and the service-type-change master-reload effect
   - Notes: Hook lives in the parent (pickers in 3 other tabs read parts/allParts). Preserve: PARTS_PAGE_SIZE=50, RPC price-count-sort special path (silently ignored with filters), Load-All default OFF, legacy supply_houses column fallback, assembly_types as-any cast.
12. **MaterialsPartsBookTab** — component, ~420 lines, medium risk → `src/components/materials/MaterialsPartsBookTab.tsx`
   - Inputs: catalog values from useMaterialsCatalog, expandedPartId + setter (shared with assembly-book), openAddPart/openEditPart/setViewingPartPrices callbacks, openSupplyHousesModal callback
   - Notes: JSX 3091-3346 + search/filter/paging state + the debounced-search and infinite-scroll effects. The shared modals (PartFormModal, Part Prices Modal) stay parent-level (opened from 3 tabs + URL). The legacy Supply House Management Modal (3399-3556 + 9-field state + CRUD handlers 1604-1720) is opened only from this tab's toolbar — move it with the tab or as its own follow-up component; do NOT delete it (roles without the Supply Houses tab depend on it).
13. **useMaterialsAssemblies (assembly cluster seam)** — hook, ~220 lines, high risk → `src/hooks/useMaterialsAssemblies.ts`
   - Inputs: selectedServiceTypeId, activeTab, setError; returns materialTemplates, selectedTemplate, templateItems, allTemplateItemsForStats, partIdToLowestPrice, shared filters (templateSearchQuery, filterAssemblyTypeIds, filterIncludeEmpty, dropdown open state + ref), loadMaterialTemplates/loadTemplateItems/loadAllTemplateItemsForStats, template CRUD
   - Notes: Lifting the shared filter state/ref here is what preserves the current filter carry-over between assembly-book and templates-po (quirk 7 — the same instances are rendered by both tabs today). selectedTemplate stays a parent-owned controlled prop.
14. **MaterialsAssemblyBookTab** — component, ~850 lines, high risk → `src/components/materials/MaterialsAssemblyBookTab.tsx`
   - Inputs: assembly-cluster values from the hook, selectedTemplate + onSelectTemplate (controlled), catalog parts/allParts, expandedPartId + setter, partIdsWithNoPrice-based stats, modal-opener callbacks (openAddTemplate, openEditPart, setViewingPartPrices), item CRUD callbacks or hook-owned versions
   - Notes: JSX 3557-4123 + the Add Item Modal (5101-5372, opened only from this tab) + inline qty-editor state + addItemModal cluster. Preserve quantity-merge and self-reference guard in handleAddItemFromModal, and partIdsWithNoPrice computed from the PAGINATED parts cache (quirk 5).
15. **MaterialsTemplatesPoTab** — component, ~1050 lines, high risk → `src/components/materials/MaterialsTemplatesPoTab.tsx`
   - Inputs: Both seams (useMaterialsAssemblies + useMaterialsPurchaseOrders values), selectedTemplate controlled, parts/allParts, supplyHouses, modal openers; owns the ~30-state template add-item form + draft-PO item-editing clusters and refs
   - Notes: Extract LAST — intersection of both clusters. JSX 4124-5024 + owned handlers (addItemToTemplate, createPOFromTemplate/createEmptyPO/addTemplateToPO via lib/materialPOUtils, updatePOItem, removePOItem, PO-name editing, loadSupplyHouseOptionsForPart). Template Form Modal (5026-5099) stays parent (opened from 2 tabs + ?addAssembly).

### Suggested PR sequence

1. PR 1: Stage A — extract calculateAssemblyCost to src/lib/materials/assemblyCost.ts + tests (~45 lines) — highest-value untested calc (recursion, cycle guard, quantity multiply); zero UI change, creates the lib/materials/ dir
2. PR 2: Stage A — extract filterPartsByQuery/filterTemplatesByQuery + the displayParts Load-All filter/sort to src/lib/materials/materialsFilters.ts + tests (~60 lines) — already-pure body functions used by pickers in 3 tabs
3. PR 3: Stage A — extract loadPOWithItems (the ~10x-duplicated purchase_order_items join + itemsWithDetails mapping) to src/lib/materials/poItemDetails.ts + test on the pure mapping — biggest de-duplication win; both later PO extractions depend on it
4. PR 4: Stage A — extract printPO/printPOForSupplyHouse HTML builders to src/lib/materialsDocuments/poPrint.ts + tests (~95 lines) — builders become pure (price rows injected); the draft N+1 fetch stays in the caller
5. PR 5: Stage A — move module-level fetchPricesForParts + formatCurrency/formatTimeSince + the supply-house stats grouping to src/lib/materials/ + tests — preserve 500-ID chunking and client re-sort (v2.46 disk-IO quirk); also add the missing tests for lib/materialPOUtils.ts here or as PR 5b
6. PR 6: extract TemplatePricesManager to src/components/materials/TemplatePricesManager.tsx (~175 lines) — verbatim move of a self-contained module component; creates the components/materials/ dir
7. PR 7: extract PartPricesManager to src/components/materials/PartPricesManager.tsx (~355 lines) — verbatim move; onPricesUpdated cache-patching callback stays parent-owned
8. PR 8: extract MaterialsPoGeneratorTab (~545 lines) — the momentum-builder: fully self-contained state + 4 gated effects, smallest prop surface, validates the tab seam exactly like bid-costs did for Bids
9. PR 9: build useMaterialsPurchaseOrders seam (src/hooks/, ~130 lines) — PO caches + loadPurchaseOrders + editingPO.id reload effect; parent destructures so nothing downstream changes; deep-link router stays in parent
10. PR 10: extract MaterialsPurchaseOrdersTab (~950 lines) against the PO seam — preserve tax-fallback inconsistency, add-only notes race guard, optimistic 4-way supply-house write (lives in the hook), sequential duplicatePOAsDraft
11. PR 11: build useMaterialsCatalog seam (~250 lines) — parts/allParts caches, pagination, Load-All persistence, reference-data loaders, service-type master-reload effect; hook stays in the parent (3 other tabs read the caches)
12. PR 12: extract MaterialsPartsBookTab (~420 lines incl. the legacy Supply House Management Modal + its 9-field state cluster, opened only from this tab's toolbar) — shared PartFormModal/Part Prices Modal wiring stays parent-level
13. PR 13: build useMaterialsAssemblies seam (~220 lines) — lift the shared filter state + filterAssemblyTypeDropdownRef into the hook to preserve cross-tab filter carry-over; selectedTemplate stays a parent controlled prop
14. PR 14: extract MaterialsAssemblyBookTab (~850 lines incl. the Add Item Modal, opened only from this tab) — preserve quantity-merge, self-reference guard, and paginated-cache partIdsWithNoPrice source
15. PR 15: extract MaterialsTemplatesPoTab (~1,050 lines) — last, at the intersection of both seams; Template Form Modal and both shared modals stay page-level

### Risks & gotchas

- Cross-tab shared render state (quirk 7): filterAssemblyTypeDropdownRef + assembly filter states are rendered by BOTH assembly-book and templates-po (legal only because one tab mounts at a time). Splitting the tabs without lifting these into useMaterialsAssemblies would silently drop the filter carry-over between tabs.
- Optimistic 4-way writes: updatePOItemSupplyHouse patches selectedPO/editingPO/draftPOs/allPOs and reverts via server reload; the ?po= router and handleNavigateToPOFromSupplyHouses seed draftPOs/allPOs before loadPurchaseOrders settles. The PO hook must own all four setters or the seeding paths break.
- No render-test harness: every Stage-B move is verified only by typecheck/lint/manual click-through — which is why Stage A must land first so the calc is under vitest before JSX moves.
- External deep-link senders depend on the parent router staying put: JobsPartsTab (?tab=purchase-orders&po=), BidsTakeoffTab (state.openPOId), SupplyHousesTab (callback + openPOId fallback), plus ?addPart/?addAssembly and the legacy price-book slug rewrite — all must remain in Materials.tsx.
- Load-bearing quirks that look like bugs (preserve verbatim per the map's 16-item quirks list): tax fallback ||0 vs ||8.25; price 0 = DELETE the price row; partIdsWithNoPrice computed from the paginated parts cache; draft printPO N+1 price fetches; Load-All default OFF + 500-ID chunking (v2.46 disk-IO optimization); add-only finalized-PO notes race guard; assembly_types queried as-any (missing from generated types); supply_houses legacy-column fallback SELECT.
- The legacy Supply House Management Modal duplicates SupplyHousesTab CRUD but is the ONLY supply-house editing path for estimator/primary/superintendent roles — folding it away is a permissions behavior change, not a refactor; keep it during decomposition.
- Page is low-churn (9 commits in 10 weeks): merge-conflict risk is minimal, but so is urgency — the map explicitly notes no extraction is scheduled, so sequence PRs opportunistically rather than blocking other work.
- Theme-token CI: any style touched during moves must keep CSS variables (var(--text-muted) etc.); the print-HTML builders' inline hexes are customer-facing/light-pinned print surfaces — move them verbatim into lib/materialsDocuments/ rather than tokenizing.

---

## src/components/bids/BidsTakeoffTab.tsx — 5,641 → ~2,700 lines

BidsTakeoffTab is the Takeoff tab of the Bids page (itself extracted from Bids.tsx in 2026-05 and grown since). For a selected bid it renders either the Exact materials model (per-count-row template mappings creating purchase orders) or the Rough model (drag-sortable per-fixture part lines priced from the catalog, with assembly bundles), plus a takeoff-book admin section (versions/entries mapping fixture names to templates per stage), a materials-by-stage cost roll-up moved in from the Labor tab, and PO creation/printing. It hosts seven embedded modals (add-assembly/template, rough add-assembly picker, template preview, PO review, add-parts-to-template, edit-assembly, bundle breakdown, part prices) plus a remove-confirm dialog, two createPortal popovers (numeric entry pad, template picker), and a 620-line module-level SortableRoughPartLineRow. All pricing-engine data/loaders arrive as props from useBidPricingEngine; selection and the shared tax percent are parent-controlled.

**Already extracted:** The file is itself an extraction from Bids.tsx (2026-05-30, mapped in docs/BIDS_TABS_ARCHITECTURE.md). Stage-A kernels already exist and are used by it: src/lib/bids/bidTakeoffHelpers.ts (+test), src/lib/bids/assemblyBundleBreakdown.ts (+test), src/lib/bidDocuments/takeoffBreakdown.ts, src/lib/bidDocuments/costEstimatePage.ts, src/lib/materialPOUtils.ts, src/lib/materialPartCatalogPrice.ts. Shared sub-components already out: ModalShell, PartFormModal, NumericEntryPad, TakeoffPartEditIcon, SupplyHouseWebsiteLink, BidProjectCell, MyBidsToggle, BidWorkflowTabTitleWithPreview. Sibling modals AssignTakeoffPartModal/GenerateUnitCostModal exist but serve other surfaces — nothing inside this file has been sub-extracted yet.

### Internal structure

| Section | Lines | What it is |
|---|---|---|
| Imports + local types + props interface | 1-147 | Imports (dnd-kit, lib kernels, bidDocuments builders, shared modals), MaterialPart/SupplyHouse/PartType types, BidsTakeoffEngine type, 60-prop BidsTakeoffTabProps (engine values/loaders injected per BIDS_TABS_ARCHITECTURE) |
| Component signature + state block | 149-364 | Destructure of ~55 props, dnd sensors, ~80 useState vars grouped by feature: search, rough part picker/numpad, remove-confirm, PO creation, template picker/preview cache, takeoff-book admin, add-template (Add Assembly) modal, part form, add-parts-to-template modal, part-prices modal, bundle breakdown, edit-template modal, PO-review modal |
| Lookup loaders + mount effects | 366-450 | loadPartTypes/loadSupplyHouses + six small useEffects (mount loads, reset-on-bid-change, service-type reload) |
| Add-Assembly modal + part-form + add-parts + edit-template CRUD | 451-1013 | closeTakeoffAddTemplateModal, openSaveAsAssemblyFromRough, saveTakeoffNewTemplate (500-603, forks into template-create vs rough-line bundle collapse), item helpers, add-parts modal fns (637-657) + savePartsToTemplate (894-961), edit-template modal fns 658-893 (open/close, saveEditTemplateName v2.591 rename, price CRUD, item CRUD), handleBidsPartFormSave (975-1013) |
| Takeoff-book version/entry CRUD + apply | 1015-1280 | Version form open/save/delete (1015-1076), entry form open/save/delete (1077-1198), applyTakeoffBookTemplates (1199-1280) which writes takeoffMappings from book entries |
| Exact-model mapping CRUD | 1281-1413 | setTakeoffMapping/saveTakeoffMapping (bids_takeoff_template_mappings upsert), addTakeoffTemplate, removeTakeoffMapping |
| Rough part-line CRUD + qty numpad + drag reorder | 1414-1699 | persistTakeoffRoughPartLine, setRoughPartLinePartAndCatalogPrice, resetRoughLineToCatalogPrice, updateTakeoffRoughPartLine, numpad focus/blur/input/escape handlers (1556-1607), add/remove line, remove-confirm helpers, handleRoughPartLinesDragEnd (1652-1699) |
| PO creation + print | 1700-1948 | createPOFromTakeoff (1700-1780, links POs to cost_estimates), addTakeoffToExistingPO (1781-1826), printTakeoffBreakdown (1827-1948, delegates to lib/bidDocuments/takeoffBreakdown) |
| Rough catalog refresh + add-assembly-from-rough + bundle plumbing | 1949-2124 | takeoffRoughCatalogLowestPartIdsKey memo, refreshTakeoffRoughCatalogLowest, applyRoughAddAssemblyTemplate (expand template to lines), insertRoughBundleLine, applyRoughAddAssemblyBundle |
| Effects: bundle part rows, preview cache, modal data loads, click-outside | 2125-2334 | Lazy bundle-part-lines loader (2136-2156) + invalidate/toggle helpers, then ~8 useEffects: template preview cache fill, existing-PO items load, PO-review modal data load, part-prices modal load, bundle-breakdown load, click-outside/escape handlers |
| Part-price modal handlers + derived memos/filters | 2335-2460 | applyBundleQuoteToLine, updatePartPriceInModal, addPartPriceInModal (2341-2416); bidsScopedForTakeoff/filteredBidsForTakeoff, takeoffMappedCount/RoughFilledLineCount, filterTemplatesByQuery/takeoffTemplatePickerOptions/filterPartsByQuery (2433-2459, pure) |
| JSX: remove-confirm dialog + header/search | 2461-2553 | return; remove-confirm modal (2463-2539), bid search input + MyBidsToggle when no bid selected |
| JSX: selected-bid detail (exact table / rough dnd list) | 2554-3298 | Bid header card, takeoff-book selector + Apply button (2657-2709), exact-model mapping table (2710-3040), rough-model DndContext + SortableContext rendering SortableRoughPartLineRow (3041-3261), PO buttons + success message (3262-3298) |
| JSX: Add-Assembly (Add Template) modal | 3299-3468 | ModalShell: name/description, item rows (part-or-template with searchable dropdowns), supply-house bundle prices, apply-price-to-line override |
| JSX: rough Add-Assembly picker modal + template preview modal | 3471-3652 | Assembly picker for a rough count row (3471-3588, expand-as-parts vs add-as-bundle), template parts-preview modal (3589-3652) |
| JSX: bid picker table + takeoff-book admin section | 3655-3944 | filteredBidsForTakeoff table when nothing selected (3663-3691); collapsible TAKEOFF BOOK admin (3692-3804) + version form modal (3805-3838) + entry form modal (3840-3944) |
| JSX: MATERIALS BY STAGE section | 3946-4099 | Moved from Labor tab: three-stage PO cards (exact) or rough roll-up with tax inputs; reads selectedBidForCostEstimate + costEstimateMaterialTotal* + costEstimatePOModalTaxPercent |
| JSX: PO-review modal + shared PartFormModal | 4100-4256 | PO-review modal with print-for-review/supply-house actions (4100-4243); PartFormModal wiring (4245-4255) |
| JSX: Add-Parts-to-Template modal | 4257-4411 | Searchable part dropdown + quantity, savePartsToTemplate, create-new-part handoff to PartFormModal |
| JSX: Edit-Template (Edit Assembly) modal | 4412-4700 | Editable assembly name, item list with add/remove, nested-template support, inline supply-house bundle price CRUD, per-part edit/prices icons |
| JSX: bundle-breakdown + part-prices modals | 4701-4922 | Bundle breakdown (4702-4815: parts list, a-la-carte totals per supply house, clickable bundle quotes); part-prices modal (4816-4922: per-supply-house price edit/add) |
| JSX: portals (numpad + template picker) | 4923-5019 | createPortal NumericEntryPad for rough qty (4923-4954) and the floating template-picker dropdown list (4955-5013) |
| SortableRoughPartLineRow (module-level component) | 5021-5641 | ~620-line dnd-kit sortable row: part picker popover, qty input wired to numpad, unit-price status vs catalog lowest, bundle-line rendering with grayed display-only part rows, save-as-assembly button |

### Extraction candidates (easiest/safest first)

1. **takeoffPickerFilters (filterTemplatesByQuery + filterPartsByQuery)** — kernel, ~30 lines, low risk, unit-testable → `src/lib/bids/takeoffPickerFilters.ts`
   - Inputs: pure: (templates|parts, query, limit) — no React; colocated takeoffPickerFilters.test.ts
   - Notes: Stage-A warm-up per playbook: currently inline at lines 2433–2459; used by the template-picker portal, Add-Assembly picker, and part dropdowns. Consider also moving the small qty-focus/draft helpers if not already in bidTakeoffHelpers.
2. **SortableRoughPartLineRow** — component, ~620 lines, low risk → `src/components/bids/SortableRoughPartLineRow.tsx`
   - Inputs: already fully prop-driven (line, lineIdx, row, takeoffAddTemplateParts, picker/numpad state + setters, catalog-lowest map, callbacks) — it is a module-level component at 5021–5641 with zero closure captures; move file + imports (dnd-kit, CSS vars) verbatim
   - Notes: Biggest single safe win; matches the playbook note that module-level sortable rows move as-is. dnd-kit + roughCountMultiplier imports come along.
3. **TakeoffBundleBreakdownModal** — component, ~160 lines, low risk → `src/components/bids/TakeoffBundleBreakdownModal.tsx`
   - Inputs: bundleBreakdownModal ({templateId, lineId, assemblyName} | null), onClose, onApplyQuote(lineId, price, supplyHouseName); loads its own data via lib/bids/assemblyBundleBreakdown.loadBundleBreakdown (already kernelized + tested)
   - Notes: JSX 4702–4815 + state at 332–334 + its load effect (~2278–2310 block). applyBundleQuoteToLine stays in parent (writes takeoffRoughPartLines).
4. **TakeoffPartPricesModal** — component, ~210 lines, low risk → `src/components/bids/TakeoffPartPricesModal.tsx`
   - Inputs: partPricesModal ({partId, partName, defaultAddPrice} | null), onClose, supplyHouses, onPricesChanged (parent refreshes catalog-lowest + template previews)
   - Notes: JSX 4816–4922, state 322–329, handlers updatePartPriceInModal/addPartPriceInModal (2341–2416) and its load effect move in; CRUD is self-contained against material_part_prices. Opened from both Add-Assembly and Edit-Assembly rows, so the open setter stays a parent-passed callback.
5. **TakeoffAddPartsToTemplateModal** — component, ~280 lines, low risk → `src/components/bids/TakeoffAddPartsToTemplateModal.tsx`
   - Inputs: open/templateId/templateName, onClose, parts list (takeoffAddTemplateParts), onSaved (refresh previews + invalidateBundleParts), onCreatePart (opens shared PartFormModal), filterPartsByQuery from the new kernel
   - Notes: JSX 4257–4411, state 312–319, fns openAddPartsToTemplateModal/closeAddPartsToTemplateModal (637–657) + savePartsToTemplate (894–961). Opened from the template-preview modal too — opener stays in parent.
6. **TakeoffMaterialsByStageSection (incl. PO-review modal)** — component, ~380 lines, medium risk → `src/components/bids/TakeoffMaterialsByStageSection.tsx`
   - Inputs: selectedBidForCostEstimate, costEstimate, purchaseOrdersForCostEstimate, costEstimateMaterialTotal* (3 stages), costEstimatePOModalTaxPercent + setter (shared, stays parent-owned), setCostEstimatePO, loadPurchaseOrdersForCostEstimate; print builders already in lib/bidDocuments/costEstimatePage
   - Notes: Section JSX 3946–4099 + PO-review modal 4100–4243 + state costEstimatePOModalPoId/Data (363–364) + its load effect. Both blocks were themselves moved here from the Labor tab, so they are a proven cohesive unit. Medium only because taxPercent is shared with Labor/Pricing — keep it a controlled prop.
7. **TakeoffBookAdminSection** — component, ~480 lines, medium risk → `src/components/bids/TakeoffBookAdminSection.tsx`
   - Inputs: engine props takeoffBookVersions/takeoffBookEntries/setTakeoffBookEntries, selectedTakeoffBookVersionId + setter, takeoffBookEntriesVersionId + setter, loadTakeoffBookVersions/loadTakeoffBookEntries, materialTemplates, setError
   - Notes: Collapsible admin UI 3692–3944 (incl. version form 3805–3838 and entry form 3840–3944) + state 241–251 + CRUD fns 1015–1198. applyTakeoffBookTemplates (1199–1280) and the per-bid selector/Apply button (2657–2709) stay in the parent — they write takeoffMappings/bids.
8. **TakeoffEditAssemblyModal** — component, ~550 lines, medium risk → `src/components/bids/TakeoffEditAssemblyModal.tsx`
   - Inputs: open/templateId/templateName, onClose, parts list, supplyHouses, filterPartsByQuery/filterTemplatesByQuery kernel, materialTemplates, onTemplateChanged (loadMaterialTemplates + invalidateBundleParts + preview-cache bust), onEditPart (shared PartFormModal), onOpenPartPrices (shared TakeoffPartPricesModal)
   - Notes: JSX 4412–4700, state 340–361, fns 658–893 (openEditTemplateModal/saveEditTemplateName/loadEditTemplatePrices/add-update-removeEditTemplatePrice/loadEditTemplateItems/add-removeEditTemplateItem). Medium risk from three cross-modal callbacks and the v2.591 rename side-effect (material_templates.name) — preserve exactly.
9. **TakeoffAddAssemblyModal** — component, ~470 lines, high risk → `src/components/bids/TakeoffAddAssemblyModal.tsx`
   - Inputs: open state + saveAsAssemblyCountRowId + takeoffAddTemplateForMappingId, onClose, parts/templates lists, supplyHouses, onSaved(templateId) — parent keeps the rough-line collapse: saveTakeoffNewTemplate's save-as-assembly branch mutates takeoffRoughPartLines via insertRoughBundleLine and applies mapping via setTakeoffMapping
   - Notes: JSX 3299–3468, state 254–280, fns 451–636 + 962–974. High risk: the save path forks into (a) plain template create, (b) collapse-rough-lines-into-bundle (openSaveAsAssemblyFromRough at 470–494, bundle-price override index), and (c) auto-assign to the originating mapping. Split the DB-write portion into a lib kernel (e.g. lib/bids/saveTakeoffAssembly.ts) first, or pass the whole post-save continuation in as one callback.

### Suggested PR sequence

1. PR 1: Stage A — extract filterTemplatesByQuery/filterPartsByQuery to src/lib/bids/takeoffPickerFilters.ts + tests (~30 lines) — pure, zero risk, gives later modal PRs a shared import and validates the seam.
2. PR 2: move SortableRoughPartLineRow to its own file (~620 lines) — already module-level with explicit props; a verbatim file move with imports, the single biggest safe reduction.
3. PR 3: extract TakeoffBundleBreakdownModal (~160 lines) — leaf modal whose data loader is already a tested kernel; only one callback (apply quote) points back at parent state.
4. PR 4: extract TakeoffPartPricesModal (~210 lines) — self-contained material_part_prices CRUD; do before the assembly modals since both of them open it via callback.
5. PR 5: extract TakeoffAddPartsToTemplateModal (~280 lines) — leaf modal using the PR-1 filter kernel; onSaved callback keeps preview-cache/bundle invalidation in the parent.
6. PR 6: extract TakeoffMaterialsByStageSection + embedded PO-review modal (~380 lines) — cohesive block previously moved from the Labor tab; taxPercent stays a controlled prop per the architecture map.
7. PR 7: extract TakeoffBookAdminSection (~480 lines) — version/entry CRUD is self-contained against engine props; applyTakeoffBookTemplates and the per-bid selector stay in the parent because they write takeoffMappings.
8. PR 8: extract TakeoffEditAssemblyModal (~550 lines) — after PRs 4–5 its cross-modal openers are simple callbacks; behavior-preserve the v2.591 name-rename side-effect.
9. PR 9: extract TakeoffAddAssemblyModal (~470 lines) — last because of the save-as-assembly rough-line collapse coupling; optionally precede with a Stage-A kernel for the save/expand DB writes.
10. Each PR: npm run typecheck && npm run lint && npm test green, one commit, gh pr merge --auto --squash, and update the BidsTakeoffTab entry in docs/BIDS_TABS_ARCHITECTURE.md (what moved, what stayed).

### Risks & gotchas

- No render-test harness — every Stage-B move is verified only by typecheck/lint/manual smoke, so diffs must read as pure cut/paste moves; resist any cleanup while moving.
- Cross-modal chaining: PartFormModal (stays in parent at line 4245) and TakeoffPartPricesModal are opened from both the Add-Assembly and Edit-Assembly modals, and the template-preview modal opens Add-Parts — all openers must remain parent-passed callbacks or the chain breaks.
- saveTakeoffNewTemplate (500–603) is the tangle point: its save-as-assembly branch collapses rough part lines into a bundle line (insertRoughBundleLine, 2047–2069) and auto-assigns the originating mapping — extracting the Add-Assembly modal without keeping that continuation in the parent will corrupt rough-line state.
- Shared state must not migrate: costEstimatePOModalTaxPercent (read by Labor + Pricing), selectedBidForTakeoff/selectedBidForCostEstimate selection, and all useBidPricingEngine values/loaders stay parent-injected per the playbook's controlled-props rule.
- Cache-invalidation web: takeoffTemplatePreviewCache, bundlePartsByTemplateId (invalidateBundleParts), and takeoffRoughCatalogLowestByPartId are each written by multiple flows (part-price edits, template edits, assembly saves); extracted modals should signal via onSaved/onPricesChanged callbacks and leave the caches in the parent for now.
- Inline styles contain literal saturated action colors (#3b82f6, #b91c1c) which are allowed, but any new neutral hexes introduced during the move will fail the theme-tokenize CI check — copy styles verbatim.
- Working tree currently has unrelated schedule/jobs WIP — stage only the takeoff files per PR, never git add -A.

---

## src/pages/Estimates.tsx — 5,333 → ~2,350 lines

Estimates.tsx is a two-surface routed page (default export switches on the :id URL param): (1) EstimateList — the /estimates index with Stages/Ledger tabs, search, customer filter, thread-notes expansion, and create-draft; rendered via two large sibling presentational components (EstimateListTable for desktop, EstimateListCards for narrow viewports); (2) EstimateDetail — a ~3,360-line mega-component that is simultaneously the draft editor (customer picker + gate, title/brand/expiry, line-items editor with a full line-item-catalog modal including an admin "Edit book" tab and per-item history, supporting-document fieldset with Google Drive link check, accept-notify recipients, internal notes, save/send/delete), the sent/accepted read-only view (acceptance record, signature preview, customer activity events, job create/unlink), and the three-tab customer-experience preview (email HTML / acceptance page / thank-you) with per-estimate copy overrides. Substantial pure logic (list bucketing/search, line-item stub shapes, accept-URL validation, catalog event summaries) and a ~200-line style-constants block live inline. Unlike Bids/People this page has no activeTab seams inside the detail view — extraction units are visually-distinct sections and modals, not tabs. Per the playbook it has "no map yet", so a Step-0 docs/ESTIMATES_ARCHITECTURE map must be written first.

**Already extracted:** Components in src/components/estimates/: CreateJobFromEstimateModal, EstimateAcceptBody, CustomerAcceptanceRecordModal, AcceptHeaderBrandPicker, EstimateCustomerDocument (exports EstimateLineItemsTable + estimatePublicLineItems), EstimateCustomerAttachmentCard, EstimateCustomerAcceptLinkButtons, EstimateCustomerThankYou, EstimateAcceptTypedSignatureLine, EstimateSentDocumentModal, EstimateTermsHeaderNotice, IpAddressMapButton, EstimateCustomerThankYou. Lib kernels: estimateCatalogApi, estimateCustomerExperience, estimateLineItemNormalize, estimateLineItemCatalog, estimateLineItemRecents, estimateRouteSegment, estimateStaffAcceptPreview, estimateAcceptHeaderBrand, estimateEmailHtmlPreview, estimateCustomerAttachment, formatEstimateListUpdated, addCalendarDaysYmd, checkGoogleDriveAttachmentUrl, estimatePublicTerms, createJobFromEstimateSubmit. Hook: useEstimateThreadNotes. The customer-facing accept flow (EstimateAccept.tsx page) was clearly decomposed already; the staff page itself has had logic shaved but no component-level extraction.

### Internal structure

| Section | Lines | What it is |
|---|---|---|
| Imports + module constants | 1-131 | ~110 imports (heavy reuse of existing estimates lib/components), ESTIMATE_CATALOG_EDITOR_ROLES, SEND_EMAIL_RE, ESTIMATE_EMAIL_FROM_LABEL, PREVIEW_EMAIL_ACCEPT_URL, accept-URL sessionStorage prefix |
| Customer-activity leaf components | 133-233 | EstimateCustomerActivityDetails (open-state <details>), EstimateDetailCustomerActivitySection (events list w/ IpAddressMapButton), estimateCustomerEventLabel() |
| Accept-URL pure helpers | 235-252 | isUsableCustomerAcceptUrl, normalizeCustomerAcceptUrlCandidate — pure URL validation, currently untested |
| CX override config | 254-319 | CX_FIELD_LABELS, CX_OVERRIDE_SECTIONS (Email / Acceptance page / Thank you), cxOverrideFieldRows() |
| Row types + misc constants | 321-378 | EstimateRow/EstimateListRow/EstimateDetailRow types, EstimateNotifyUserOption, estimateAcceptNotifySeparatorLabel, ESTIMATE_JOB_SECTION_HASH, create-job button styles |
| Page CSS strings + est* style factories | 380-581 | estimatesPageShellCss, focus-visible CSS, highlight-pulse CSS, line-item row CSS, estInputBase/estInputBlock, estPrimaryButton/estSecondaryButton/estSendButton/estDangerOutlineButton/estSmall*Button — ~200 lines of pure style constants |
| Line-item stub + format pure helpers | 583-680 | estimateLinkedJobHcp, DEFAULT_DRAFT_FIRST_LINE_ITEM, isDefaultDraftStubShape, defaultDraftFirstLine, emptyDraftLine, emptyCatalogEditRow, lineItemsFromJson/sumLineItems (thin wrappers over lib), formatMoney, statusLabel, resolveMasterUserId (async supabase) |
| EstimateDraftCustomerGate + title helpers | 682-724 | Interaction-blocking overlay component for drafts without a customer; defaultEstimateTitle, isGenericEstimateTitle |
| List pure helpers | 726-806 | estimateListCustomerSubline, estimateListCustomerColumnLines, estimateListRowMatchesSearch, sortEstimatesByUpdatedDesc, splitFollowupRows (Stages bucketing: draft→Unsent, sent+declined→Sent, accepted; superseded omitted) — all pure and untested |
| List shared types + cell styles | 808-859 | EstimateListStagesThread (thread-notes props bundle), EstimateListTableProps, customer-cell style constants |
| EstimateListTable component | 861-1228 | Desktop table: expand-thread button, last-activity cell, status cell w/ acceptance-record + create-job/linked-job, JobThreadNotesPanel expansion rows |
| EstimateListCards component | 1230-1554 | Mobile card twin of the table (same props incl. stagesThread); duplicated expand/customer/status/last-activity render logic |
| EstimateList page component | 1556-1966 | List state (tab/search/rows/modals), useEstimateThreadNotes wiring, load() w/ ?customer= filter, createDraft, Stages (3 bucketed sections) vs Ledger tabpanels, CustomerAcceptanceRecordModal + CustomerSnapshotModal + CreateJobFromEstimateModal mounts |
| EstimateDetail: state + refs | 1968-2051 | ~55 useState hooks (row, draft fields, attachment check, catalog modal cluster, cx overrides, notify recipients, customer notes) + refs incl. autosave tracking ref |
| EstimateDetail: effects + loaders | 2053-2519 | Route-reset effect, #estimate-job hash scroll, signature signed-URL, catalog load, notify-user options load (role-bucketed), app_settings CX load, recents load, customer-events load + focus-refresh, main load() (segment resolve, draft defaults, notify hydration, frozen attachment), refetchCustomersAfterEdit, openDraftCustomerForEdit |
| EstimateDetail: derived memos + CX helpers | 2521-2926 | acceptNotifyOtherSelectOptions (role bucketing + separators), requestCustomerFirst gate toast, customerAttachmentPreview, previewEmailTo, customerAcceptUrl, staffResolvedExperience, customerEmailPreviewHtml, openStaffAcceptCustomerPreview, renderCxDraftSectionFields (~130-line JSX helper incl. accept_page_footer hide-checkbox special case) |
| EstimateDetail: handlers | 2928-3333 | handleSelectCustomer/handleCustomerSearchChange, saveDraft, customer-link autosave effect (eslint-disabled deps, reads latest closure), sendToCustomer (edge fn fetch), checkCustomerAttachmentUrl, job create/unlink open+confirm, deleteDraft, updateLine, recents chips memo, catalogFiltered, applyFromCatalogEntry, loadHistoryForCatalogItem, catalogEventSummary, saveCatalogEdits |
| Render: draft customer picker section | 3344-3564 | CustomerSearchCombobox + selected-customer card (email override reveal, phone, edit-customer link, recent note preview, CustomerNotesTable expansion) |
| Render: draft editor body | 3565-4724 | Inside EstimateDraftCustomerGate: header/status, sent-only line-items block (3599-3622), AcceptHeaderBrandPicker with slots — title editor, For/Expires fields, line-items slot containing the inline catalog modal (3843-4204) and line editor rows (4205-4380), supporting-doc placeholder, terms; then supporting-document fieldset (4470-4620), accept-notify fieldset (4621-4687), internal notes, Save/Send/Delete buttons |
| Render: sent/accepted view | 4726-4949 | Locked notify-recipients box, accepted EstimateCustomerDocument card, customer/email lines, acceptance record (signature signed-URL / typed line), customer-activity section, Job section (create / linked+unlink), sent-status activity + accept-link buttons |
| Render: customer-experience preview | 4951-5205 | Second gate wrapper: <details> with email/page/thankyou preview tabs — email HTML preview (dangerouslySetInnerHTML from buildEstimateEmailHtml), EstimateAcceptBody staffPreview, EstimateCustomerThankYou; per-tab CX override fields when draft |
| Render: modals | 5207-5325 | Inline create-customer modal (NewCustomerForm), inline unlink-job confirm dialog, CreateJobFromEstimateModal + CustomerSnapshotModal mounts |
| Default export router | 5329-5333 | Estimates(): renders EstimateDetail when :id param present, else EstimateList |

### Extraction candidates (easiest/safest first)

1. **estimateListRows kernel** — kernel, ~120 lines, low risk, unit-testable → `src/lib/estimateListRows.ts`
   - Inputs: Pure: EstimateListRow-shaped rows, search string. Exports statusLabel, formatEstimateMoney (formatMoney), estimateLinkedJobHcp, estimateListCustomerSubline, estimateListCustomerColumnLines, estimateListRowMatchesSearch, sortEstimatesByUpdatedDesc, splitFollowupRows + the EstimateListRow type
   - Notes: Classic Stage A. splitFollowupRows encodes the Stages bucketing rule (declined counts as Sent, superseded hidden) — exactly the decision logic the repo wants under unit tests. statusLabel/formatMoney are used by both list and detail, so both import from the kernel afterwards.
2. **estimateDraftLineStubs kernel** — kernel, ~100 lines, low risk, unit-testable → `src/lib/estimateDraftLineStubs.ts`
   - Inputs: Pure: line-item shapes (EstimateLineItemNormalized, EstimateCatalogLineItem). Exports DEFAULT_DRAFT_FIRST_LINE_ITEM, isDefaultDraftStubShape, defaultDraftFirstLine, emptyDraftLine, emptyCatalogEditRow, catalogEntryToLineItem, isBlankDraftLine, isReplaceableStubLine, defaultEstimateTitle, isGenericEstimateTitle
   - Notes: isDefaultDraftStubShape has a subtle legacy-vs-new stub rule (default text in line_item vs description) that deserves tests. catalogEntryToLineItem/isBlankDraftLine/isReplaceableStubLine currently live inside EstimateDetail's body but capture nothing — pure moves.
3. **estimateAcceptUrlSession kernel** — kernel, ~50 lines, low risk, unit-testable → `src/lib/estimateAcceptUrlSession.ts`
   - Inputs: Pure: url string candidates; optional sessionStorage read/write wrappers keyed by estimate id. Exports PREVIEW_EMAIL_ACCEPT_URL, ESTIMATE_ACCEPT_URL_SESSION_PREFIX, isUsableCustomerAcceptUrl, normalizeCustomerAcceptUrlCandidate, readStoredAcceptUrl/writeStoredAcceptUrl
   - Notes: URL-shape validation (/estimate/accept path + non-empty t param, preview sentinel rejected) is pure and untested today; the three sessionStorage try/catch blocks in EstimateDetail collapse into two helpers.
4. **estimateCatalogEventSummary kernel** — kernel, ~45 lines, low risk, unit-testable → `src/lib/estimateCatalogEventSummary.ts`
   - Inputs: Pure: EstimateCatalogItemEventRow (+ money formatter import). Exports catalogEventSummary
   - Notes: Formats create/update/delete/restore history lines. Zero closure captures; a natural companion test to estimateCatalogApi. Ships in the same PR wave as the catalog modal Stage A.
5. **estimatePageStyles constants** — constants, ~210 lines, low risk → `src/lib/estimatePageStyles.ts`
   - Inputs: None. Exports ESTIMATES_PAGE_CLASS, estimatesListPageCss, estimateDetailPageCss (+ constituent CSS strings), estInputBase/estInputBlock, estPrimaryButton/estSecondaryButton/estSendButton/estDangerOutlineButton/estSmallSecondaryButton/estSmallPrimaryButton, list create-job button styles
   - Notes: Every subsequent component extraction imports these instead of re-declaring, so this must land before the component PRs. Keep raw saturated hexes (#3b82f6, #ea580c) as-is — theme-token CI only bans neutral hexes; the neutral values already use var(--…) tokens.
6. **EstimateDetailCustomerActivitySection** — component, ~110 lines, low risk → `src/components/estimates/EstimateDetailCustomerActivitySection.tsx`
   - Inputs: estimateId, status ('sent'|'customer_accepted'), defaultOpen, loading, events: Tables<'estimate_customer_events'>[]
   - Notes: Already a fully props-driven leaf (plus its private EstimateCustomerActivityDetails wrapper and estimateCustomerEventLabel). Pure cut/paste — the ideal first component PR to validate the seam.
7. **EstimateDraftCustomerGate + EstimateUnlinkJobConfirmModal** — component, ~120 lines, low risk → `src/components/estimates/EstimateDraftCustomerGate.tsx`
   - Inputs: Gate: active, onBlockedInteraction, children. Confirm modal (own PR, src/components/estimates/EstimateUnlinkJobConfirmModal.tsx): open, busy, onCancel, onConfirm
   - Notes: Two tiny leaf extractions, one per PR. The gate is used twice in EstimateDetail; the unlink dialog (5250-5304) is a self-contained inline modal with 4 props.
8. **EstimateListTable** — component, ~400 lines, low risk → `src/components/estimates/EstimateListTable.tsx`
   - Inputs: rows, setAcceptanceModalEstimateId, setCreateJobFromListRow, showCustomerColumn?, onCustomerSnapshotRequest?, stagesThread? (EstimateListStagesThread bundle) — the props type already exists at line 821
   - Notes: Already props-complete; only internal dependency is useAuth (kept, it's a context hook) and the lib helpers extracted in Stage A. Export EstimateListStagesThread + EstimateListTableProps + the shared cell-style constants from this file for the cards twin.
9. **EstimateListCards** — component, ~340 lines, low risk → `src/components/estimates/EstimateListCards.tsx`
   - Inputs: Same EstimateListTableProps, imported from EstimateListTable.tsx
   - Notes: Mobile twin, identical props. Do not merge/dedupe the duplicated expand/status/last-activity logic during the move (behavior-preserving rule); note the duplication in the map for a later pass.
10. **EstimateList (whole list surface)** — component, ~430 lines, medium risk → `src/components/estimates/EstimateList.tsx`
   - Inputs: None — self-contained: owns listTab/search/rows/modal state, useEstimateThreadNotes, useSearchParams (?customer=), navigate. Estimates.tsx just renders <EstimateList />
   - Notes: After the table/cards PRs this is mostly loaders + layout. resolveMasterUserId (used by createDraft) moves with it or to estimateListRows kernel. This finishes the list half: Estimates.tsx drops to roughly the detail component + router.
11. **EstimateLineItemCatalogModal** — component, ~480 lines, medium risk → `src/components/estimates/EstimateLineItemCatalogModal.tsx`
   - Inputs: open, onClose, canManageCatalog, catalogLineItems, reloadCatalog: () => Promise<void>, onPickEntry: (entry: EstimateCatalogLineItem) => void. Modal-local state moves in: catalogModalTab, catalogEditRows, catalogSaveBusy, catalogEventsByItemId, catalogHistoryOpenId/LoadingId, catalogEditorNames, catalogFilter + Escape-key and filter-reset effects + catalogFiltered memo, loadHistoryForCatalogItem, saveCatalogEdits
   - Notes: Biggest single win in the detail view (render 3843-4204 + ~10 state hooks + handlers 3219-3333). The one cross-boundary handler, applyFromCatalogEntry, stays in the parent (it mutates lines + recents) and is passed as onPickEntry; the modal closes itself after pick. useToastContext can be consumed inside directly.
12. **EstimateCxOverrideFields** — component, ~230 lines, medium risk → `src/components/estimates/EstimateCxOverrideFields.tsx`
   - Inputs: section: CxOverrideSectionConfig (config + CX_FIELD_LABELS/CX_OVERRIDE_SECTIONS constants move into this file), values: Partial<Record<EstimateExperienceOverrideKey,string>>, onChange(next) or a setField(key,value|remove) callback, defaults: cxTemplateDefaults, omitKeys?
   - Notes: Replaces the renderCxDraftSectionFields closure (2796-2926) + the CX config block (254-319). The delete-key-when-default reducer logic and the accept_page_footer hide-checkbox special case move verbatim. Parent keeps cxOverrideFields state and acceptanceCxOmitKeys().
13. **EstimateCustomerExperienceSection** — component, ~300 lines, medium risk → `src/components/estimates/EstimateCustomerExperienceSection.tsx`
   - Inputs: row, isDraft, customerPreviewTab + setter (or own the tab state — it is used by nothing else, so it moves in), staffResolvedExperience, customerEmailPreviewHtml, previewEmailTo, customerAcceptUrl + onCopy/onOpen, onOpenStaffPreview, acceptancePreviewForLine, draft field values (title, validUntil, lines, terms, totalCents), acceptanceDocHeaderBrand, customerAttachmentPreview, acceptorSignatureSignedUrl, cx-override slot props (values/onChange/defaults/omitKeys)
   - Notes: The details-wrapped preview tabs (4951-5205). Prop list is wide but read-only except the CX fields (handled by EstimateCxOverrideFields, which lands first). customerPreviewTab state is section-local and moves in.
14. **EstimateDraftCustomerSection** — component, ~280 lines, high risk → `src/components/estimates/EstimateDraftCustomerSection.tsx`
   - Inputs: customers, customersLoading, customerId, customerSearch, onSearchChange, onSelectCustomer, onClear, onRequestCreateNew, highlight + sectionRef (for the gate scroll/pulse), selectedCustomer, crmEmailForSelected, sendEmailOverride + setter + reveal state, onEditCustomer, customer-notes bundle (entries/loading/refetch/expanded/toggle/labels)
   - Notes: Render 3344-3564. High coupling: the customer-gate (requestCustomerFirst) needs the section ref and highlight class, handleSelectCustomer rewrites title/forAddress/email in the parent, and the autosave effect watches customerId. Selection state stays in the parent (playbook rule); this is a late extraction after the safer ones prove the seams.
15. **EstimateDraftLineItemsEditor** — component, ~300 lines, high risk → `src/components/estimates/EstimateDraftLineItemsEditor.tsx`
   - Inputs: lines, onUpdateLine(i, patch), onRemoveLine(i), onAddLine, recentChips, onPickCatalogEntry, catalog-open button props (canManageCatalog, catalogCount, onOpenCatalog), totalCents, terms + onTermsChange, termsHeading, customerAttachmentPreview
   - Notes: The lineItemsSlot subtree (3802-4467 minus the catalog modal). It is passed into AcceptHeaderBrandPicker as a slot, so the parent keeps the slot wiring and passes this component in. Do only after EstimateLineItemCatalogModal is out, or the slot drags the modal with it.

### Suggested PR sequence

1. PR 0: write docs/ESTIMATES_ARCHITECTURE.md (Step-0 map; playbook explicitly lists Estimates as 'no map yet' and requires the map before extraction). Record that the page's seams are list-vs-detail + detail sections, not tabs; note there is no shared selection pointer (routing owns it).
2. PR 1: Stage A — extract src/lib/estimateListRows.ts + tests (~120 lines: statusLabel, formatMoney, customer sublines, search match, sort, splitFollowupRows). Zero-risk pure moves; puts the Stages bucketing rule under test before any list component moves.
3. PR 2: Stage A — extract src/lib/estimateDraftLineStubs.ts + tests (~100 lines: stub-shape detection, default/empty line factories, catalogEntryToLineItem, title defaults). Unblocks both the line-items editor and catalog modal moves.
4. PR 3: Stage A — extract src/lib/estimateAcceptUrlSession.ts + tests (~50 lines: accept-URL validation + sessionStorage helpers) and src/lib/estimateCatalogEventSummary.ts + tests (~45 lines) — two tiny kernels, one PR each if reviewers prefer, but each is a trivially safe pure move.
5. PR 4: extract src/lib/estimatePageStyles.ts (~210 lines of CSS strings + est* style factories). No behavior; prerequisite so later component PRs import instead of duplicating styles.
6. PR 5: extract EstimateDetailCustomerActivitySection (~110 lines) to src/components/estimates/. Already props-complete leaf; validates the component seam cheaply.
7. PR 6: extract EstimateDraftCustomerGate (~45 lines); PR 6b: extract EstimateUnlinkJobConfirmModal (~75 lines). Tiny leaf components, one per PR per ship-small.
8. PR 7: extract EstimateListTable (~400 lines) with EstimateListTableProps/EstimateListStagesThread exported from the new file. Props already exist verbatim — pure cut/paste after PRs 1 and 4.
9. PR 8: extract EstimateListCards (~340 lines), importing the shared props type from EstimateListTable.tsx. Keep the duplicated render logic as-is (behavior-preserving).
10. PR 9: extract EstimateList (~430 lines) to src/components/estimates/EstimateList.tsx; Estimates.tsx becomes router + EstimateDetail only (~3,500 lines). This completes the list half.
11. PR 10: extract EstimateLineItemCatalogModal (~480 lines incl. its 10 state hooks + handlers); parent keeps applyFromCatalogEntry as onPickEntry. Biggest detail-side win.
12. PR 11: extract EstimateCxOverrideFields (~230 lines: CX config constants + renderCxDraftSectionFields as a component).
13. PR 12: extract EstimateCustomerExperienceSection (~300 lines: the details-wrapped email/page/thankyou preview tabs, owning customerPreviewTab locally, consuming EstimateCxOverrideFields).
14. PR 13: extract EstimateDraftCustomerSection (~280 lines) — done late because of the gate-ref/highlight and title-rewrite coupling; selection + autosave stay in the parent.
15. PR 14 (optional/stretch): extract EstimateDraftLineItemsEditor (~300 lines) as the lineItemsSlot content passed to AcceptHeaderBrandPicker. Only after PR 10; if the prop threading proves noisy, stop after PR 13 — the parent is already at target size.

### Risks & gotchas

- EstimateDetail is one mega-component with no activeTab gates — extractions are section-level, so several PRs (customer section, line-items editor) thread 10+ props; the playbook's 'tab-local state moves' rule maps to 'section-local state moves' and shared draft-field state (title, lines, terms, customerId, validUntil...) must all stay in the parent.
- The customer-link autosave effect (lines 3006-3020) deliberately disables exhaustive-deps and relies on saveDraft reading the latest closure state; saveDraft, resolveCustomerEmailForPersist, and buildCustomerExperienceOverridesPayload must stay in the parent or the stale-closure behavior could silently change.
- applyFromCatalogEntry mutates both lines and the per-user recents (localStorage) — when extracting the catalog modal it must remain a parent callback (onPickEntry), not move into the modal.
- The draft editor's main content is passed to AcceptHeaderBrandPicker via slots (documentTitleSlot/forFieldSlot/expiresOnSlot/lineItemsSlot); extracting slot content means the parent keeps the slot wiring, and the catalog modal must come out of the lineItemsSlot subtree first (it is rendered inside it, lines 3843-4204).
- statusLabel/formatMoney are used by list AND detail — extract once to the kernel in PR 1 and update all call sites in the same PR to avoid drift/duplication.
- EstimateDraftCustomerGate's requestCustomerFirst uses customerSearchSectionRef + a DOM querySelector into CustomerSearchCombobox's input — the ref must be forwarded into EstimateDraftCustomerSection or that focus/scroll behavior breaks (also depends on the '.customer-search-combobox input' class, easy to lose in a move).
- Theme CI: the CSS-string/style extraction must not 'clean up' literal saturated colors (#3b82f6, #ea580c, #15803d etc. are intentional action/status colors); only neutral hexes are banned and those already use tokens.
- No render-test harness — each PR's safety net is typecheck/lint/unit tests plus a manual smoke of the draft flow (create → pick customer → line items → send preview) and the Stages list; the accepted/sent read-only paths need a prod-data eyeball since drafts can't reach them locally.
- customer_experience preview renders dangerouslySetInnerHTML from buildEstimateEmailHtml — keep the eslint-disable comment and the escaping contract intact when moving EstimateCustomerExperienceSection.
- sendToCustomer calls the send-estimate-to-customer edge function directly with fetch; it stays in the parent (touches row/customers/sendEmailOverride/lastAcceptUrl) — do not extract it with any section.

---

## src/pages/Settings.tsx — 5,171 → ~1,200 lines

Settings is the app's tab-switched settings surface for nine runtime roles. The JSX for all ten tabs was already extracted (src/components/settings/Settings*Tab.tsx), so the remaining 5,171 lines are the parent "engine room": ~282 useState declarations, a God-loader (loadData, ~310 lines) that branch-loads per role, and the handler engines for tabs whose JSX moved out — adoption/sharing, email/notification templates + edge-function test senders, five parallel catalog CRUD engines, people-directory/groups, jobs admin, dashboard financial-pin loaders, and report settings — all threaded down as enormous prop lists (SettingsDashboardTab ~120 props, SettingsCatalogsTab ~110, SettingsTemplatesTab ~85). One large JSX section (Sharing & Adoption, ~280 lines) plus two modals (merge-duplicates, orphaned material prices) are still fully inline. The remaining decomposition is mostly Stage-A/seam work: push each tab's engine into a hook or self-contained component, collapsing the prop membranes, then dissolve loadData.

**Already extracted:** Extensive — Settings shrank ~12k → ~5.1k pre-map. JSX tabs: SettingsRecentPushNotifications (self-contained), SettingsAccountTab, SettingsAccountSchedulingTab, SettingsAccountBackupTrailing, SettingsDashboardTab (1,985 lines), SettingsPeopleTab, SettingsDataTab, SettingsJobsTab, SettingsCatalogsTab (1,207 lines), SettingsCatalogsProspectsTab, SettingsTemplatesTab (1,034 lines), SettingsAdvancedTab, SettingsHowItWorksTab. Self-contained blocks: ActiveAccountsPanel (+useActiveAccountsManagement), DeletedRecordsSection, BulkDeleteAlertSettingsBlock, TripChargeAmountsSettingsBlock, MapDefaultViewSettingsBlock, JobBookSettingsSection/JobBookEditorPanel, BidCoverLetterDefaultsSettingsBlock, BillCustomerMemo/PhysicalInvoiceFooter/PhysicalInvoiceIssuer/StripeInvoiceFooter dev blocks. Hooks/kernels: useSettingsBackupExports, useDeletedRecordsArchive, resolveSettingsDeepLink, buildSalariedWorkdayPickerRows, getMergedFilteredPins, mergePersonUserDuplicates finders, settingsTemplates lib (partial). The remaining work is engine (state/handler) extraction, not JSX.

### Internal structure

| Section | Lines | What it is |
|---|---|---|
| Imports & local types | 1-89 | Imports; local UserRole union (quirk: omits 'controller' though it's live at runtime — preserve casts) |
| Module helpers | 91-205 | SettingsGroup (hidden=display:none wrapper), SettingsTabBar (role=tablist, pageTabStyle), getSettingsJumpGroups (role-filtered tab list) — the page shell; stays |
| State block | 210-684 | ~282 useState declarations grouped by tab, with small handlers interleaved: handleSignOut (479), handleTestNotification (489), handleEnableLocation (538), loadMyReportsRef (662), impersonation state + handleBackToMyAccount (663-684) |
| Orphan material prices engine | 686-755 | loadOrphanMaterialPrices (classifies material_part_prices joins), deleteOrphanPrice, deleteAllOrphanPrices — pairs with inline modal JSX at 4822-4910 |
| Financial-pin loaders (dev) | 757-799 | loadBilledTotalAndPinnedUsers, loadSupplyHousesAPTotalAndPinnedUsers, loadExternalTeamTotalAndPinnedUsers, loadCostMatrixPinnedUsers — Dashboard-tab dev cluster |
| loadData God-loader | 800-1133 | refreshSelfPaySalaryForPayName + loadData: runs on authUser.id change, role-branched loads (users, people, adoptions, templates, app_settings batch, catalogs, job counts RPC, group members); the re-sync callback for all self-contained children |
| Groups + Jobs admin handlers | 1134-1239 | toggleDispatchGroupMember, toggleEstimatorGroupMember, saveJobOwnerOverrides, confirmReassignJobs, saveDefaultLaborRate |
| Prospects/estimate copy savers | 1240-1307 | saveProspectCopyDefaults, saveEstimateCustomerCopyDefaults, saveEstimatePublicTerms, saveEstimateLineItemCatalog — engine for SettingsCatalogsProspectsTab |
| Profile + report settings | 1308-1424 | saveMyProfile (dup-name check + pay-table cascade), saveReportSettings, saveReportNotificationPreferences + toggles |
| People directory (dev) | 1425-1506 | loadPeopleForDev, saveNonUserPersonEdit, deleteNonUserPerson |
| Adoption/sharing engine | 1507-1807 | loadAssistantsAndAdoptions (includes controllers via cast), loadPrimariesAndAdoptions, loadSuperintendentsAndAdoptions, toggleAdoption ×3, handleAdoptionMasterChange, loadMastersAndShares, toggleSharing; adoptionMasterId derived at 1597 — engine for the INLINE Sharing & Adoption JSX |
| Pay-approved masters | 1808-1844 | loadPayApprovedMasters, togglePayApproved |
| Templates engine | 1845-2345 | notification_templates + email_templates CRUD; openEditTemplate holds ~45-line inline email-defaults map (1977-2043); replaceTemplateVariables pure fn (2044); sendTestEmail / sendTestNotificationTemplate / sendWorkflowNotificationEmailTest — three test senders with identical ~25-line refreshSession + FunctionsHttpError-unwrap boilerplate |
| Catalogs engines (×5) | 2346-3330 | Service Types 2346-2506 (ledger-prefix validation + reloadLedgerPrefixMap), Fixture/Book Names 2507-2728 (loadFixtureTypeCounts 2526-2608 does pure lowercase fixture_name/alias matching vs takeoff entries — Stage-A kernel), Counts Quick-add 2729-2901 (nested group+item CRUD), Part Types 2902-3117, Assembly Types 3118-3330; identical swap-move sequence_order logic ×5 |
| Effects block | 3332-3770 | 32 useEffect: loadData trigger, muted tasks, ignored task types, My Reports load + realtime channel (3488-3550), pins, template test-target default, catalog per-selection loads — incl. two verbatim-duplicated part-type effects (3655-3669 vs 3753-3767; preserve) |
| Claim-code / password / merge | 3771-3993 | handleClaimCode (claim-dev edge fn → loadData), openPasswordChange/handlePasswordChange (re-verify + updateUser), openFindDuplicatesModal/handleMergeDuplicate (lib kernels already exist), checkDuplicateName |
| Deep-link + tab-snap effects | 3994-4056 | resolveSettingsDeepLink apply effect (retries + anchor polling, v2.737), activeSettingsTab validity snap — router; stays in parent |
| Render: shell | 4067-4128 | Impersonation banner, header with Sign out / Change password, SettingsTabBar — stays |
| Render: tab wrappers | 4129-4339 | Recent-push display:none wrapper (4129), Account group + SettingsAccountTab/SchedulingTab (4130-4203), Dashboard group + SettingsDashboardTab ~120 props (4204-4339) |
| Render: People group + INLINE Sharing & Adoption | 4340-4681 | SettingsPeopleTab wrapper, then the only large inline JSX left: collapsible Sharing and Adoption (4395-4675) — Adopt Assistants / Primaries / Superintendents / Share with other Master, three identical dev master-picker selects; TeamFeedbackMasterAggregates (4678) |
| Render: Data / Jobs / Prospects | 4683-4783 | SettingsDataTab (4683), SettingsJobsTab (4714), SettingsCatalogsProspectsTab conditional-mount (4745-4783) |
| Render: inline modals | 4784-4910 | Merge-duplicates modal (4784-4820), Orphaned-material-prices modal (4822-4910) |
| Render: Catalogs / Templates / Advanced | 4912-5125 | SettingsCatalogsTab ~110 props (4912-5024), SettingsTemplatesTab ~85 props (5025-5110), SettingsAdvancedTab (5111-5125) |
| Render: page-level modals + How-it-works | 5126-5171 | ReportViewModal/ReportEditModal/MyReportsModal/ChecklistItemMuteModal (shared with Dashboard tab — stay), SettingsHowItWorksTab (5168) |

### Extraction candidates (easiest/safest first)

1. **settingsTemplates Stage-A kernel (email defaults map + replaceTemplateVariables + invokeEdgeWithRefreshedSession util)** — kernel, ~110 lines, low risk, unit-testable → `src/lib/settingsTemplates.ts`
   - Inputs: Pure: template type → default subject/body; (template, variables) → {subject, body}; edge-invoke util takes fn name + payload. lib file already exists with substituteNotificationVariables — extend it + add tests
   - Notes: The ~45-line defaults map lives inline in openEditTemplate (lines 1977-2043); replaceTemplateVariables at 2044-2056 is already pure. The three test senders (sendTestEmail 2057, sendWorkflowNotificationEmailTest 2154, sendTestNotificationTemplate 1913) share identical refreshSession + FunctionsHttpError-unwrap boilerplate ×3 — extract once. Preserve the alert() success and copy verbatim (quirk #9)
2. **settingsCatalogs Stage-A kernels (takeoff fixture-name/alias count matching + swapSequenceOrder)** — kernel, ~90 lines, low risk, unit-testable → `src/lib/settingsCatalogs.ts`
   - Inputs: (fixtureTypes, takeoffEntries) → counts via lowercase fixture_name/alias_names matching (from loadFixtureTypeCounts, lines 2526-2608); swapSequenceOrder(list, item, direction) → the two rows to swap — same logic repeated in moveServiceType/moveFixtureType/moveCountsFixtureGroup/movePartType/moveAssemblyType
   - Notes: Pure data-shaping only; the supabase writes stay in the handlers. Unblocks the Stage-B catalogs hook with the risky matching logic under tests first
3. **SettingsSharingAdoptionSection + useMasterAdoptions** — component, ~620 lines, low risk → `src/components/settings/SettingsSharingAdoptionSection.tsx`
   - Inputs: myRole, myUserId (authUser.id), users (for the dev master-picker) — otherwise self-contained: hook owns loads (master_assistants/master_primaries/master_superintendents/master_shares) + toggles + adoptionMasterId derivation
   - Notes: The map's order #1: the only large inline JSX (4395-4675, ~280 lines) + handlers 1507-1807 (~300 lines) + ~17 state vars. Hook at src/hooks/useMasterAdoptions.ts. Follows ActiveAccountsPanel/DeletedRecordsSection precedent. Preserve quirk #11: three identical master-picker selects; sharing always acts as self even when dev manages another master
4. **useSettingsTemplatesEngine** — hook, ~500 lines, low risk → `src/hooks/useSettingsTemplatesEngine.ts`
   - Inputs: users, templateTestTargetUserId (+setter), showToast, setError — returns the ~30 template state vars + CRUD/test handlers SettingsTemplatesTab currently receives as ~85 props
   - Notes: Map order #2. Dev-only, almost fully isolated. Engine at lines 1845-2345 + report-settings 1348-1424 + dev-gated load effects ~3594-3651. emailTemplates existence-check by the workflow-fn test stays inside the hook. Also fix the stale delete-all-estimates doc comment in SettingsTemplatesTab when touching it (quirk noted in map)
5. **useSettingsCatalogs** — hook, ~1000 lines, medium risk → `src/hooks/useSettingsCatalogs.ts`
   - Inputs: myRole, estimatorServiceTypeIds, reloadLedgerPrefixMap, setError, showToast — must keep returning serviceTypes to the parent (cross-tab: estimator default-selection sync effect ~3680, visibleServiceTypesForMaterials)
   - Notes: Map order #3, biggest single win: five parallel CRUD engines (2346-3330) + their per-selection load effects (3655-3767). Preserve quirk #5 (two verbatim-duplicated part-type effects) and quirk #6 (loads never clear on deselect). Tab stays mounted while hidden — effects run regardless; keep that
6. **Orphan-material-prices modal → SettingsCatalogsTab** — component, ~160 lines, low risk → `src/components/settings/SettingsCatalogsTab.tsx`
   - Inputs: None new — moves loaders 686-755, OrphanedPriceRow type + 4 state vars (461-477), and modal JSX 4822-4910 into the tab that already receives loadOrphanMaterialPrices/setViewingOrphanPrices as props; those props disappear
   - Notes: Modal is opened only from the Catalogs tab's Manage Parts section — single-surface, clean cut. Can ride with or directly after the useSettingsCatalogs PR
7. **Merge-duplicates modal + handlers → SettingsPeopleTab** — component, ~160 lines, low risk → `src/components/settings/SettingsPeopleTab.tsx`
   - Inputs: onMerged reload callback (today: loadData) — moves openFindDuplicatesModal/handleMergeDuplicate (3872-3934), 3 state vars (621-623), modal JSX (4784-4820); opened via ActiveAccountsPanel's onOpenFindDuplicates which already threads through this tab
   - Notes: Pure logic already lives in src/lib/mergePersonUserDuplicates.ts with tests — reuse, don't re-extract (quirk #10)
8. **useSettingsPeopleDirectory** — hook, ~250 lines, medium risk → `src/hooks/useSettingsPeopleDirectory.ts`
   - Inputs: myRole, authUser.id, setError, showToast — owns myPeople/nonUserPeople/group-membership/pay-approved state + loadPeopleForDev, saveNonUserPersonEdit, deleteNonUserPerson (1425-1506), toggleDispatchGroupMember/toggleEstimatorGroupMember (1134-1181), loadPayApprovedMasters/togglePayApproved (1808-1844)
   - Notes: Map order #4. Medium only because payApprovedMasterIds also gates TeamFeedbackMasterAggregates in the parent render, and the Additional People section is the sole render site of the shared error state (quirk #4) — thread setError as today
9. **useSettingsJobsAdmin + Advanced claim-code fold** — hook, ~160 lines, low risk → `src/hooks/useSettingsJobsAdmin.ts`
   - Inputs: users, jobCountByUserId (from loadData), setError, showToast — saveJobOwnerOverrides/confirmReassignJobs/saveDefaultLaborRate (1182-1239) + ~14 state vars. Same PR: move code/codeError/codeSubmitting + handleClaimCode (3771-3803) into SettingsAdvancedTab with an onRoleMaybeChanged reload callback
   - Notes: Preserve the 'controller' in creators list and the dynamic job_owner_override_<userId> app_settings keys (delete-when-empty). Claim-code move is trivial (map order #4 tail)
10. **useSettingsFinancialPins** — hook, ~180 lines, medium risk → `src/hooks/useSettingsFinancialPins.ts`
   - Inputs: myRole (dev gate), users — the four loaders (757-799) + ~20 pin state vars + useWeeklyTeamLaborTotal; SettingsDashboardTab keeps doing its own writes (quirk #8), hook exposes reloads
   - Notes: Map order #5a. First cut into the ~120-prop Dashboard membrane; dev-only cluster so blast radius is small despite the tab's overall coupling
11. **useSettingsMyReports** — hook, ~130 lines, high risk → `src/hooks/useSettingsMyReports.ts`
   - Inputs: authUser.id, showMyReports gate — owns list_my_reports load + the settings-my-reports-changes realtime channel (effect 3488-3550) and hands its reload fn to the parent (loadMyReportsRef) for the page-level ReportEditModal/MyReportsModal onSaved wiring, which stays in the parent
   - Notes: Map order #5b. High risk: state is shared between the Dashboard tab section and page-level modals (selectedReport/reportForEdit stay parent-owned); only the loader + subscription move
12. **useSettingsTeamLeaderAssignments** — hook, ~90 lines, medium risk → `src/hooks/useSettingsTeamLeaderAssignments.ts`
   - Inputs: users, myRole — rows + sortedTeamLeaderAssignments/filteredTeamLeaderAssignments/teamHoursMemberPickerUsers memos; child keeps its own insert/update/delete writes
   - Notes: Map order #5c. Completes the Dashboard-residue trio before any sub-decomposition of the 1,985-line SettingsDashboardTab itself (a separate follow-on effort tracked in the map)
13. **useSettingsAccount** — hook, ~280 lines, medium risk → `src/hooks/useSettingsAccount.ts`
   - Inputs: authUser, pushNotifications, showToast — profile state + saveMyProfile/checkDuplicateName (1308-1347, 3935-3993), password modal state + handlers (3804-3871; modal opened from the shell header so openPasswordChange stays exposed), handleTestNotification (489), handleEnableLocation + permission effect (538), self-salaried check, dev all-salaried picker load
   - Notes: Map order #6, lowest churn — last. myProfileName feeds the salaried-workday self check; keep useSettingsBackupExports a single parent instance (shared by Account trailing + Data tab)

### Suggested PR sequence

1. PR 1: extract Sharing & Adoption → SettingsSharingAdoptionSection + useMasterAdoptions (~620 lines) — map's order #1: the only large inline JSX, single-surface, proven ActiveAccountsPanel precedent; biggest low-risk win and validates the self-contained-section seam
2. PR 2 (Stage A): move email-template defaults map + replaceTemplateVariables into src/lib/settingsTemplates.ts + tests, add shared invokeEdgeWithRefreshedSession util (~110 lines) — puts the only real pure logic of the templates engine under tests before the hook move
3. PR 3 (Stage B): extract useSettingsTemplatesEngine (~500 lines, ~30 state vars) — dev-only and almost fully isolated (users + shared test-target only), collapses SettingsTemplatesTab's ~85 props
4. PR 4 (Stage A): extract takeoff fixture-name/alias count matching + swapSequenceOrder into src/lib/settingsCatalogs.ts + tests (~90 lines) — the riskiest calc in the catalogs engine goes under tests first
5. PR 5 (Stage B): extract useSettingsCatalogs (~1,000 lines) — biggest single win; medium risk so it comes after the seam pattern is re-proven in PRs 1-3; must keep serviceTypes exposed for the estimator sync + reloadLedgerPrefixMap
6. PR 6: move orphan-material-prices modal + loaders into SettingsCatalogsTab (~160 lines) — finishes the catalogs surface while context is fresh
7. PR 7: move merge-duplicates modal + handlers into SettingsPeopleTab (~160 lines) — leaf modal, lib kernels already tested
8. PR 8: extract useSettingsPeopleDirectory (~250 lines) — people/groups/pay-approved residue; needs care around the shared error render site and payApprovedMasterIds gate
9. PR 9: extract useSettingsJobsAdmin + fold claim-code into SettingsAdvancedTab (~160 lines) — two small low-risk cleanups bundled per the map's order #4 tail
10. PR 10: extract useSettingsFinancialPins (~180 lines) — first cut into the Dashboard tab's ~120-prop membrane; dev-only cluster
11. PR 11: extract useSettingsMyReports (~130 lines) — realtime channel + loader; highest coupling (page-level modals), done only after the hook pattern is routine
12. PR 12: extract useSettingsTeamLeaderAssignments (~90 lines) — completes the Dashboard residue trio
13. PR 13: extract useSettingsAccount (~280 lines) — lowest churn, lowest priority per the map
14. Ongoing tail of PRs 3-13: dissolve loadData incrementally — each new hook owns its reload and onActiveAccountsDataChanged / claim-code success call only the affected reloads (map order #7; never a big-bang PR)

### Risks & gotchas

- Hot file: 29 commits in 10 weeks — small per-PR diffs and fast merges matter; the current branch (feat/edit-job-ux-polish) has unrelated WIP in the tree, so stage specific files only
- Mixed mount semantics must be preserved per tab: most tabs stay mounted display:none (self-contained children keep loading while hidden); SettingsAccountSchedulingTab and SettingsCatalogsProspectsTab conditional-mount — a hook move that changes when effects run is a behavior change
- The local UserRole union omits 'controller' but the role is live at runtime via casts ('controller' as 'assistant' in loadAssistantsAndAdoptions, controller in job-owner creators) — preserve casts verbatim; unifying on the app-wide UserRole is a separate cleanup
- The shared error state is written by many handlers but renders almost nowhere (quirk #4) — thread setError as-is; surfacing it is a UX change, not part of decomposition
- Preserve known quirks: duplicated part-type effects (3655-3669 vs 3753-3767), catalog loads never clearing on deselect, blocking alert() on test-email success, three identical adoption master-picker selects, default tab = Recent push
- loadData is the reload contract for self-contained children (onActiveAccountsDataChanged, claim-code success, merge) — every extracted hook must expose a reload the parent can call where loadData did, until loadData is fully dissolved
- serviceTypes and users are cross-tab shared substrate — useSettingsCatalogs must keep exposing serviceTypes (estimator sync effect + ledger-prefix reload); users stays parent-loaded until multiple hooks stop needing it
- No render-test harness — hook/component moves are verified only by typecheck/lint/existing unit tests plus manual smoke; keeping each Stage-B diff a near-pure cut/paste move is the real safety mechanism
- SettingsDashboardTab writes to supabase directly while loads live in the parent — when hook-ifying (PRs 10-12) keep write paths in the child, don't round-trip them through the new hooks
- docs/SETTINGS_TABS_ARCHITECTURE.md must be updated per PR (flip status, point at new file) — its line anchors rot with every extraction

---

## src/components/people/PeopleReviewTab.tsx — 5,007 → ~1,400 lines

The dev-only Review tab extracted from People.tsx (PR #9 of that decomposition). It renders the Team Summary table (via the already-extracted TeamSummaryInline) plus a per-person drill-in panel: period/custom-range controls, a headline stats panel, a Jobs Worked table (labor + crew rows with expandable per-job detail), Hours & Pay, Reports Filed, Tasks Completed/Outstanding, and a labor/profit-contributors modal. It owns three heavyweight data pipelines: loadReviewData (per-person, ~13 Supabase queries + a cost-allocation engine), loadTeamReviewUnion (team-wide union fetch feeding the tested derivePersonTeamSummary kernel), and a 90-day overhead-rates effect. Its single largest block is openTeamSummaryWindow, which builds a ~1,600-line standalone HTML document string (styles + embedded vanilla-JS IIFE with sort/filter/drilldown-modals/print/postMessage bridge) for the 'Open in new window' popup. The Review↔Hours shared-modal bridge (refs + drain tick + day-editor opener) stays parent-owned in People.tsx and arrives as props.

**Already extracted:** The tab itself is an extraction from People.tsx (People 13,487 → 8,598). Prior sub-extractions serving it: src/components/people/teamSummary/ (TeamSummaryInline, TeamSummaryDrilldownModal, drilldowns.tsx, formatters.ts + tests, addressDisplay.ts + tests, types.ts, teamSummaryStyles.ts) and the Stage-A kernels src/lib/people/derivePersonTeamSummary.ts (+tests) and src/lib/people/teamReviewTypes.ts. The Review↔Hours bridge (DashboardMyTimeDayEditorModal, bridge refs, drain tick) deliberately stayed in People.tsx.

### Internal structure

| Section | Lines | What it is |
|---|---|---|
| Imports + props contract | 1-83 | Imports (overheadDailyLabor helpers, TeamSummaryInline, derivePersonTeamSummary, teamReviewTypes) and PeopleReviewTabProps: payConfig/roster inputs plus the parent-owned Review↔Hours bridge refs (teamSummaryInlineRef, cache/modal-open/refresh-pending/reopen refs, teamSummaryDrainTick, onOpenDayEditor). |
| Local helper + state block | 84-255 | decimalToHms (deliberate verbatim copy of parent's, per comment), local types (ReviewPeriod, ReviewLaborJob, ReviewCrewJob, ReviewReport, ReviewTask, ReviewLaborContributor, ReviewLaborBreakdownContext) and ~25 useState: period/custom range, review data sets, reviewOverheadRates (12-field object), teamSummaryRows/loading/error + reqId ref, collapse/expand UI bits. |
| handleInlineTogglePerson | 256-265 | Stable useCallback toggling selectedReviewPersonIndex via showPeopleForReviewRef (stale-closure-safe roster mirror). |
| 90-day overhead-rates load effect | 267-419 | Fetches office/bid vs field clock_sessions, office parts, invoices, pay config; aggregates via buildOverheadWageLookup/buildOverheadDailyLabor/mergeOverheadDayTableRows into the reviewOverheadRates state (ratePerHour / ratePerRevenue / ratePerLaborDollar + 90d decomposition). |
| Roster + team-summary memos | 421-497 | externalOnlyPayConfigNamesLower, showPeopleForReview (+ref mirror), teamSummarySelectedPersonName, teamSummaryOverheadDecomp, teamSummaryBreakdowns (enrichTeamSummaryRowsForInline with split-overhead partsRate). |
| Debounced team-summary refresh effect | 499-547 | Invalidates the popup cache ref, guards half-finished custom range and open-drilldown (defers via teamSummaryRefreshPendingRef/drainTick), then debounce-calls openTeamSummaryWindow('inline'). |
| Pure period/format helpers | 549-656 | getReviewDateRange (9 period modes incl. custom swap logic), stripAddressZipState, formatDateWithDay, formatHrsLabel, getReviewPeriodPay/getPayForPersonDate (salary=8h weekday convention). |
| loadReviewData (per-person loader + allocation engine) | 658-1323 | ~13 parallel Supabase queries (labor/crew jobs, hours, reports RPC, checklist tasks, settings, tally parts) then a large pure allocation pipeline: parts/labor/drive cost maps, per-job contributor upserts, lifetime vs in-period hour maps, allocation ratios; early-returns a summary for forTeamSummary, else sets ~9 state slices. |
| Person-selection load effect | 1325-1341 | Clamps dangling selectedReviewPersonIndex and triggers loadReviewData on selection/period/filter change. |
| loadTeamReviewUnion (Tier-3 team union fetch) | 1343-1639 | One team-wide query set (period + 2y lookback labor/crew/hours, crew bids, overhead sessions, tally parts, ledger RPCs incl. paid-only variants) shaped into the TeamReviewUnion object consumed by derivePersonTeamSummary. Zero closure captures — all inputs are parameters. |
| loadTeamSummaryData + cache key + period label | 1641-1683 | Maps roster through derivePersonTeamSummary; buildTeamSummaryCacheKey (sorted roster + payConfig signature string); getReviewPeriodLabel. |
| openTeamSummaryWindow (popup/inline orchestrator + HTML doc builder) | 1685-3468 | Inline path sets teamSummaryRows + handles drilldown-reopen ref; popup path builds a ~1,560-line standalone HTML document string: full stylesheet (deliberately raw-hex, standalone light doc), table skeleton, and a vanilla-JS IIFE (cell builders, sort/filter/reset, per-cell drilldown modals incl. hours/gross/net/profit/overhead-rate breakdowns, modal-only print mode, postMessage bridge + embedded resize script) then document.write into the popup. |
| Render: header + controls row | 3471-3622 | Derived overhead-meta consts; Team Summary meta block (info-button bridges to teamSummaryInlineRef.openOverheadRateDrilldown); period select with custom-range seeding, From/To date inputs, Only-Paid-in-Full checkbox. |
| Render: TeamSummaryInline mount | 3624-3652 | Error/loading/rows branch; passes breakdowns, overheadDecomp, selection, bridge callbacks, onOpenInNewWindow → openTeamSummaryWindow('popup'). |
| Render: per-person headline stats panel | 3654-3809 | IIFE deriving panel totals (prefers matching teamSummaryBreakdowns row so headline matches the table; falls back to local allocation), then the inline-grid of Gross/Net/Profit-after-overhead rows with tooltip SVGs. |
| Render: Jobs Worked section | 3810-4705 | Collapsible header; collapsed 3-stat summary bar; full table: labor rows (3950-4290) and crew rows (4292-4630) each with click-to-expand detail row and This-Labor/This-Profit cells that open the breakdown modal; tfoot dedup-by-job totals (4630-4699). |
| Render: Hours and Pay section | 4707-4783 | Collapsible per-day hours/pay table using getHoursForDay (salary weekday-8h rule), decimalToHms display, totals footer. |
| Render: Reports + Tasks sections | 4785-4876 | Reports Filed table (displayReportTemplateName + Link to /reports), Tasks Completed and Tasks Outstanding tables (ChecklistTitleWithLinks). |
| Render: labor/profit breakdown modal | 4878-5003 | Fixed-overlay modal fed by reviewLaborBreakdownContext + reviewLaborByJobAndPerson: contributors table with share %, profit slices, '(you)' highlight, and a mismatch footnote when rows don't sum to the job header total. |

### Extraction candidates (easiest/safest first)

1. **reviewPeriod kernels (computeReviewDateRange + reviewPeriodLabel + buildTeamSummaryCacheKey)** — kernel, ~130 lines, low risk, unit-testable → `src/lib/people/reviewPeriod.ts`
   - Inputs: period, customStart, customEnd, today (injected for tests); label map; cache key takes [start,end], onlyPaidInFull, roster[], payConfig
   - Notes: Stage A opener. getReviewDateRange (549-611) is pure once `today` is a parameter — date-boundary logic (week Sunday math, custom-range swap, YTD) is exactly what the repo wants under vitest. Fold in getReviewPeriodLabel (1669-83) and buildTeamSummaryCacheKey (1653-67). stripAddressZipState/formatDateWithDay/formatHrsLabel can ride along in the same file or a reviewFormat.ts. Component keeps thin wrappers bound to state.
2. **buildTeamSummaryWindowDoc (popup HTML document builder)** — kernel, ~1660 lines, low risk, unit-testable → `src/lib/peopleDocuments/teamSummaryWindowDoc.ts`
   - Inputs: explicit context object: rows (TeamSummaryRow[]), payConfigSourceFor(name) lookup, overheadRate, overheadRateLoading, overheadDecomp, periodLabel, isEmbedded, selectedPersonName
   - Notes: The single biggest win: lines ~1777-3436 (enrichment/sort, breakdownsPayload, JSON escaping, stylesheet, table skeleton, the entire vanilla-JS IIFE, embeddedResizeScript) are a pure string builder — matches the playbook's `lib/<page>Documents/*` print/HTML-builder rule (see lib/bidDocuments precedent). openTeamSummaryWindow stays in the component (~120 lines) owning window.open, cache-ref protocol, toasts, reqId guards. Preserve the < JSON escaping and the postMessage type strings verbatim (parent People.tsx listens for them). The raw hexes are exempt: it is a standalone light popup document, and moving the string to lib keeps theme-tokenize CI status unchanged. Tests: assert marker strings, escaping of <script>-breaking input, embedded vs popup differences.
3. **loadTeamReviewUnion** — kernel, ~290 lines, low risk → `src/lib/people/loadTeamReviewUnion.ts`
   - Inputs: start, end, onlyPaidJobs, payConfigSnapshot — already its full parameter list; imports supabase + overheadDailyLabor helpers directly
   - Notes: Zero closure captures today (lines 1349-1639) — a literal cut/paste move next to teamReviewTypes.ts (its types already live there). Precedent: fetchOverheadOfficePartsByDay lives in lib. The pure shaping inside (overhead bucketing loop, laborCostByHcp, teamLaborCostByJobId) could gain tests later by splitting fetch from shape, but the move alone is safe and mechanical.
4. **PeopleReviewLaborBreakdownModal** — component, ~130 lines, low risk → `src/components/people/PeopleReviewLaborBreakdownModal.tsx`
   - Inputs: context (ReviewLaborBreakdownContext — type moves with it), rows (ReviewLaborContributor[] for ctx.jobId), onClose; formatCurrency + stripAddressZipState imported from lib
   - Notes: Classic leaf modal (4878-5003): opened only from Jobs Worked cells, closes via setReviewLaborBreakdownContext(null). Parent keeps the context state (opened from the still-inline table); passes rows pre-resolved so the modal doesn't need the whole reviewLaborByJobAndPerson map. Do first among components to shrink the later Jobs Worked diff.
5. **loadReviewOverheadRates fetch kernel** — kernel, ~140 lines, low risk, unit-testable → `src/lib/people/loadReviewOverheadRates.ts`
   - Inputs: none (async fetcher; internally fetchOverheadOfficeJobLedgerIdFromAppSettings + supabase); returns the 12-field rates object or null on error
   - Notes: The effect body (271-415) minus setState. Effect shrinks to ~20 lines (cancelled guard + setReviewOverheadRates). The pure field-hours/wage aggregation loop (354-373) can be a small exported pure function with tests; the query assembly stays untested fetch code.
6. **derivePersonReviewJobs allocation kernel** — kernel, ~430 lines, medium risk, unit-testable → `src/lib/people/derivePersonReviewJobs.ts`
   - Inputs: fetched-rows context object (laborRows, allTime labor/crew rows, items maps, hours maps, ledger rows, parts/invoice/materials maps, mileageCost, timePerMile, payConfig, personName, start/end, usePaidOnly) → { laborJobs, crewJobs, allocatedRevenue, allocatedProfit, breakdownByJob, reports, tasks, outstandingTasks }
   - Notes: The pure shaping inside loadReviewData (roughly 731-1296 + 1306-1320): cost maps, contributor upserts, allocation ratios, the in-place post-allocation pass. Mirrors the proven derivePersonTeamSummary precedent. Medium risk: the forTeamSummary early-return (1260-1269) and the second fetch wave (1140-1164) interleave fetch and derive — split as two derive calls around the second fetch, preserving semantics exactly. ReviewLaborJob/ReviewCrewJob types move to teamReviewTypes.ts or a new reviewJobTypes.ts. loadReviewData shrinks to ~180 lines of fetch + setState.
7. **PeopleReviewJobsWorked** — component, ~880 lines, medium risk → `src/components/people/PeopleReviewJobsWorked.tsx`
   - Inputs: reviewLaborJobs, reviewCrewJobs, collapsed + onToggleCollapsed, expandedKey + onToggleExpanded, onOpenBreakdown(ctx), personName; imports useLedgerPrefixMap/formatJobLedgerNumberLabel and the lib formatters itself
   - Notes: Largest render section (3810-4705): collapsed summary bar, header tooltips, labor + crew row maps with expanded detail rows, dedup-by-job tfoot totals. All inputs are leaf props already; the This-Labor/This-Profit cells call onOpenBreakdown instead of setReviewLaborBreakdownContext. Medium only for diff size and the shared row types (import from the kernel PR's types).
8. **PeopleReviewHeaderControls** — component, ~135 lines, low risk → `src/components/people/PeopleReviewHeaderControls.tsx`
   - Inputs: periodLabel, rowCount, overheadMetaText/clickable, onOverheadMetaClick (bridges to teamSummaryInlineRef), reviewPeriod + setter (with custom-range seeding callback), customStart/End + setters, onlyPaidInFull + setter, showMeta flag
   - Notes: Lines 3492-3622. Pure presentational controls row; all state stays in the tab and passes as controlled props. The custom-range seeding on first 'custom' selection moves in (it only reads getReviewDateRange, passed as a prop or recomputed via the PR-1 kernel).
9. **PeopleReviewPersonStatsPanel** — component, ~150 lines, low risk → `src/components/people/PeopleReviewPersonStatsPanel.tsx`
   - Inputs: tsRow (TeamSummaryBreakdown | undefined), fallback aggregates (panelHours, reviewLaborJobs/crewJobs totals, reviewAllocatedProfit), overheadRatesLoading
   - Notes: Lines 3654-3809. The tsRow-preferred / fallback-derivation IIFE plus the stats grid with tooltip SVGs. Consider computing the derived headline numbers in a tiny pure helper (derivePersonPanelStats) inside the same PR for testability of the fallback logic.
10. **PeopleReviewActivitySections (Hours & Pay + Reports + Tasks)** — component, ~175 lines, low risk → `src/components/people/PeopleReviewActivitySections.tsx`
   - Inputs: personName, payConfig cfg, days, reviewHours, hoursPayCollapsed + setter, reviewReports, reviewTasks, reviewTasksOutstanding, decimalToHms/getPayForPersonDate helpers (or their lib equivalents)
   - Notes: Lines 4707-4876: three small sibling sections that always render together under the person panel. One PR keeps each extraction meaningful without three trivial PRs. Keep the local decimalToHms copy verbatim (do NOT dedupe against lib/people/hoursGridTime in the same pass — behavior-preserving rule; note the duplication for a later cleanup).

### Suggested PR sequence

1. PR 1: Stage A — extract reviewPeriod kernels (computeReviewDateRange/label/cacheKey, ~130 lines) to lib/people/reviewPeriod.ts + tests — safest possible start, puts the date-boundary logic under vitest before anything else moves, and both later loaders depend on it.
2. PR 2: Stage A — extract buildTeamSummaryWindowDoc (~1,660 lines) to lib/peopleDocuments/teamSummaryWindowDoc.ts + tests — the biggest single shrink (file drops to ~3,350); pure string builder with an explicit context object, per the playbook's Documents rule; openTeamSummaryWindow keeps only window/cache orchestration.
3. PR 3: Stage A — move loadTeamReviewUnion (~290 lines) to lib/people/loadTeamReviewUnion.ts — zero closure captures, literal cut/paste next to its own types file.
4. PR 4: Stage B — extract PeopleReviewLaborBreakdownModal (~130 lines) — leaf modal with 3 props; doing it before Jobs Worked keeps that later diff clean.
5. PR 5: Stage A — extract loadReviewOverheadRates (~140 lines) to lib/people/ + test the field-hours aggregation loop; the effect becomes a ~20-line cancelled-guard shell.
6. PR 6: Stage A — extract derivePersonReviewJobs allocation kernel (~430 lines) + tests — the risky cost-allocation math gets unit tests before the big render move; loadReviewData becomes fetch + derive + setState.
7. PR 7: Stage B — extract PeopleReviewJobsWorked (~880 lines) — largest render section; all leaf props, breakdown-modal opener as callback; do after PRs 4/6 so types and modal are already out.
8. PR 8: Stage B — extract PeopleReviewHeaderControls (~135 lines) — controlled-props controls row.
9. PR 9: Stage B — extract PeopleReviewPersonStatsPanel (~150 lines) — headline stats with tsRow-fallback helper.
10. PR 10: Stage B — extract PeopleReviewActivitySections (~175 lines, Hours & Pay + Reports + Tasks) — final sweep; parent tab is left as state + loaders + thin section wrappers. Update docs/PEOPLE_TABS_ARCHITECTURE.md status per PR (each PR also needs its docs/RECENT_FEATURES.md entry per CLAUDE.md).

### Risks & gotchas

- openTeamSummaryWindow interleaves parent-owned bridge refs (teamSummaryDataCacheRef, teamSummaryModalOpenRef, reviewHoursReopenAfterLoadRef, reqId ref) with the doc build — only the pure HTML string may move; the cache-key stamping and inline/popup branch protocol must stay in the component byte-for-byte.
- The popup document embeds JSON via template interpolation with < escaping and speaks a postMessage protocol (team-summary-resize, select-person, day-editor bridge) that People.tsx listens for — any drift in message type strings or escaping silently breaks the popup/inline bridge, and there is no render-test harness to catch it; manual popup + inline smoke check required after PR 2.
- loadReviewData's forTeamSummary early return sits mid-pipeline between two fetch waves — the derivePersonReviewJobs kernel split must preserve that short-circuit (team-summary callers must not pay for the second fetch wave) and the in-place post-allocation mutation semantics.
- decimalToHms is a deliberate verbatim duplicate of lib/people/hoursGridTime's version (documented in-file); do not dedupe during any move — behavior-preserving only.
- The popup HTML stylesheet uses raw neutral hexes by design (standalone light document); keep them when moving to lib and confirm scripts/theme-tokenize.mjs --check still passes on the new lib file (print/customer-facing surfaces are the sanctioned exception, but verify CI treats lib strings the same way).
- Salary '8h Mon–Fri' convention and 'crew pct = share of total day' (Convention 1) are encoded in at least four loops across both loaders — kernel extraction must not normalize them into one helper in the same pass; preserve each occurrence and note the duplication.
- This tab is dev-only (isDev gate) with prod data behind it; the only verification beyond typecheck/lint/test is a signed-in visual check in the preview browser, which is the user's live prod session — read-only smoke checks only.

---

## src/pages/Workflow.tsx — 4,782 → ~2,050 lines

Workflow.tsx is the per-project workflow/stages page (route /workflows/:projectId). It loads (or lazily creates, behind a promise-mutex ref) the project's workflow, renders every workflow step as a collapsible status card (status transitions: start/complete/approve/reject/skip/reopen, expected-dates planning, percent-complete, notes for tech, private office notes, per-step financial line items with PO/supply-house-invoice linking, notification subscriptions, an action ledger), shows a projections-vs-ledger financial summary table, manages project superintendents and linked jobs (with job-thread notes panel), and drives 15 inline modals plus one module-level embedded component (StepFormModal, which itself contains an Add Person sub-modal and an assignee autocomplete). It also contains a full email/push notification engine (sendWorkflowNotifications) that fires on step transitions.

**Already extracted:** Pure kernels only: src/lib/parseWorkflowLineItemPaste.ts and src/lib/parsePercentCompleteInput.ts (both with tests) are already consumed by this page. No src/components/workflow/ directory exists yet and no WORKFLOW architecture map has been written (the playbook explicitly lists Workflow.tsx as "no map yet" — Step 0 map must be written first). docs/WORKFLOW_FEATURES.md exists but is a feature doc, not a decomposition map.

### Internal structure

| Section | Lines | What it is |
|---|---|---|
| Imports + DB row type aliases | 1-27 | supabase, hooks (useAuth, useToastContext, useEditProjectModal, useJobThreadNotes), parse kernels already in lib (parseWorkflowLineItemPaste, parsePercentCompleteInput), and 11 Database row type aliases (Step, Project, Workflow, StepAction, LineItem, Projection, PurchaseOrder, ...) |
| Module-level pure helpers | 29-118 | formatDatetime, formatDateShort, daysOpen, daysBetween, formatAmount, formatLineItemDate, ymdFromDateLike, formatScheduledDateShort, ymdAddDays, ymdDaysBetween, getStepStatusStyle — all pure, zero React, currently untested |
| PersonDisplayWithContact embedded component | 120-177 | Small presentational component: clickable assignee name that opens the contact modal; takes contacts map + userNames set + onOpenContact callback |
| State block + role flags + row predicates | 179-293 | ~40 useStates (step modals, line items, projections, PO/invoice pickers, superintendents, collapse maps), useJobThreadNotes destructure, role-derived flags (canManageStages, isDevOrMaster, canSeePrivateNotesAndApprove, canAssignSuperintendents), pure predicates isRowDefaultCollapsed / isStepEmpty / isSectionDefaultExpanded, ensureWorkflowPromises + lastLoadedWorkflowId refs |
| ensureWorkflow (find-or-create with mutex) | 295-363 | Promise-dedup per projectId; insert-conflict retry; sets workflow state |
| Project/superintendent/jobs loaders | 365-465 | loadProject (+projectMaster), loadProjectSuperintendents, loadProjectJobs, loadAllSuperintendents, add/removeProjectSuperintendent |
| loadSteps + subscriptions + actions | 467-550 | Loads steps (subcontractor-filtered by assigned_to_name), step_subscriptions map, step_actions map |
| PO / invoice / line-item loaders and linkers | 552-822 | loadFinalizedPOs (with totals rollup), loadSupplyHouseInvoices, loadPODetails, loadInvoiceDetails, addPOToStep, addInvoiceToStep, loadLineItemsForSteps |
| Load effects | 824-923 | Main project+workflow+steps effect (with cancellation + skip-redundant guards), staggered line-items/projections/PO+invoice effects, superintendents effect, jobs effect, job-thread stats effect |
| Projections CRUD | 925-1012 | loadProjections, saveProjection, deleteProjection, openEditProjection, calculateProjectionsTotal |
| Hash-scroll, templates, role/roster/contacts effects | 1014-1104 | #step-<id> scroll effect, workflow_templates load, user role + roster + personContacts + userNames load (superintendent-adoption branch) |
| refreshSteps + normalizeUrl + ledger math | 1106-1212 | refreshSteps (workflow-state resync), normalizeUrl (pure), calculateLedgerTotal, UnifiedRow type + buildUnifiedRows (pure merge of projections and per-step line items into a two-column table model) |
| Notification engine | 1214-1496 | getCurrentUserName, recordAction (action ledger insert), sendNotification (edge-fn invoke send-workflow-notification), sendWorkflowNotifications (per-action-type fan-out: assigned person, ME subscribers, next/prior assignee cross-step handoffs, with contact resolution) |
| Step CRUD + template + copy | 1498-1750 | openAddStep/openEditStep/closeStepForm, createFromTemplate, copyStep (sequence bump + dependency copy), saveStep (insert-at-beginning/after ordering logic) |
| Status transitions + expected dates + percent complete | 1752-2045 | updateStepStatus, findPreviousStep/findNextStep, markStarted/submitSetStart, openExpectedDates (seed from prior stage end), updatePercentComplete, submitExpectedDates (cascades next-stage start), clearExpectedDates, markCompleted/markApproved (auto-reopen rejected next step), markReopened, updateNotifyAssigned/CrossStep/Me, updateNotes/updatePrivateNotes (RPC with table-update fallback) |
| Line item CRUD + reject/skip/delete/assign | 2048-2301 | saveLineItem, importLineItemsFromPaste/Clipboard, deleteLineItem, openEditLineItem, submitReject (reopens/notices previous step), submitSkip, deleteStep (dependency cleanup), assignPerson (optimistic with RPC fallback + rollback) |
| Render: header + jobs + superintendents + step chain | 2303-2520 | Loading/error gates, project link + edit-project modal opener, projectMaster line, superintendent chips + add-select, job chips with JobThreadNotesPanel toggle, Hide Old Stages toggle, Add step button, clickable status-colored step-chain breadcrumb |
| Render: Projections + Ledger section | 2522-2700 | Summary bar (Projections / Ledger / Left totals, role-gated) + expandable unified table built from buildUnifiedRows with edit/delete projection actions |
| Render: step cards list | 2702-3489 | Empty state with create-from-template panel; old-stages collapse summary row; per-step card: collapse chevron row with status pills, technician/office action buttons, expected-dates row, percent-complete inline input, next-step-rejected banner, notify checkbox table, action ledger, Notes for Tech + Notes for Office textareas (uncontrolled, keyed), line-items table with PO/invoice view buttons + add buttons, edit/delete/re-open footer |
| Render: 15 inline modals | 3491-4273 | StepFormModal mount (3491), confirm-delete line item (3506), confirm-delete step w/ type-to-confirm (3540), reject (3581), skip (3601), set-start (3628), expected-dates w/ start-end-length linked handlers (3648), assign-person roster picker (3792), line-item editor w/ clipboard import (3861), projection editor (3963), add-PO picker (4019), add-invoice picker w/ search (4062), view-PO table (4139), view-invoice (4189), person-contact (4218) |
| StepFormModal embedded component | 4278-4782 | Module-level component: step name + quick-phrase buttons, insert-after select, assignee autocomplete (loadMastersAndSubs w/ superintendent adoption branch, dropdown, duplicate-name check), Add Person sub-modal, start/end datetime, depends-on select, Copy button |

### Extraction candidates (easiest/safest first)

1. **workflowFormat** — kernel, ~130 lines, low risk, unit-testable → `src/lib/workflowFormat.ts`
   - Inputs: None — module-level pure functions (formatDatetime, formatDateShort, daysOpen, daysBetween, formatAmount, formatLineItemDate, ymdFromDateLike, formatScheduledDateShort, ymdAddDays, ymdDaysBetween, getStepStatusStyle) plus normalizeUrl lifted out of the component body; StepStatus type import
   - Notes: Straight cut/paste from lines 29-118 + 1133-1157 with a colocated workflowFormat.test.ts. Do NOT dedupe against utils/dateUtils.ymdAddDays during the move (behavior-preserving; note the duplication in the map). getStepStatusStyle returns theme-token colors plus the literal saturated #E87600 — keep as-is.
2. **workflowProjectionsLedger** — kernel, ~90 lines, low risk, unit-testable → `src/lib/workflowProjectionsLedger.ts`
   - Inputs: projections: Projection[], steps: Step[], lineItems: Record<string, LineItem[]>
   - Notes: buildUnifiedRows + UnifiedRow type (1170-1212) and calculateProjectionsTotal (1006-1012) / calculateLedgerTotal (1160-1168) become pure functions taking explicit args instead of closures. Prime unit-test target: stage-name merging, projection/ledger row zipping, memo joining.
3. **WorkflowStepFormModal** — component, ~505 lines, low risk → `src/components/workflow/WorkflowStepFormModal.tsx`
   - Inputs: Existing props unchanged: viewerRole, step, dependsOnStepId, insertAfterStepId, steps, onSave, onClose, onCopy, toDatetimeLocal, fromDatetimeLocal. It already reads useAuth itself.
   - Notes: Biggest easy win: StepFormModal (4278-4782) is already a self-contained module-level component with an explicit props interface — the move is pure cut/paste plus an import. Includes its Add Person sub-modal and assignee autocomplete.
4. **WorkflowExpectedDatesModal** — component, ~150 lines, low risk → `src/components/workflow/WorkflowExpectedDatesModal.tsx`
   - Inputs: value: ExpectedDatesState (step, expectedStart, expectedEnd, lengthDays, updateNextStage, hasNextStage, seededFromPrior), onChange(patch), onSave, onClear, onClose — plus ymdAddDays/ymdDaysBetween from the workflowFormat kernel
   - Notes: Lines 3648-3790. The start/end/length linked-field handlers move with it (they only touch modal-local state via setField). submitExpectedDates/clearExpectedDates stay in the parent (they write steps state and cascade to the next stage).
5. **WorkflowStepActionModals** — component, ~250 lines, low risk → `src/components/workflow/WorkflowStepActionModals.tsx`
   - Inputs: rejectStep + setRejectStep + onSubmitReject; skipStep + setSkipStep + onSubmitSkip; setStartStep + setSetStartStep + onSubmitSetStart; confirmDeleteStep + deleteStepConfirmText + setters + onDeleteStep + isStepEmpty; confirmDeleteLineItem + setter + onDeleteLineItem
   - Notes: One PR bundling the five small state-driven confirm/reason modals (3506-3646): delete-line-item, delete-step (type-to-confirm), reject, skip, set-start. All submit handlers stay in the parent; each modal is a leaf that renders parent state and calls callbacks. isStepEmpty needs lineItems so pass the computed boolean, not the map.
6. **WorkflowLineItemModals** — component, ~310 lines, low risk → `src/components/workflow/WorkflowLineItemModals.tsx`
   - Inputs: editingLineItem + setEditingLineItem + onSave + onImportFromClipboard + lineItemPasteImporting; addingPOToStep + availablePOs + onAddPO + onClose; addingInvoiceToStep + availableInvoices + invoiceSearchText + setter + onAddInvoice; viewingPO/viewingInvoice + close setters; formatAmount/formatDateShort/formatLineItemDate/normalizeUrl from kernel
   - Notes: Lines 3861-4216: line-item editor (with clipboard import button), add-PO picker, add-invoice picker (search filter can stay inline — it is presentational), view-PO table, view-invoice. All CRUD handlers stay in the parent.
7. **WorkflowPersonContactModal** — component, ~130 lines, low risk → `src/components/workflow/WorkflowPersonContactModal.tsx`
   - Inputs: PersonContactInfo | null + onClose; co-locate PersonDisplayWithContact (exported) taking name/contacts/userNames/onOpenContact
   - Notes: Moves the PersonContactInfo type, PersonDisplayWithContact (120-177), and the contact modal (4218-4273) together — they are one feature. Also fold the tiny projection editor modal (3963-4017) into this PR or its own micro-PR; it is 55 lines with saveProjection staying in the parent.
8. **WorkflowProjectionsLedgerSection** — component, ~185 lines, low risk → `src/components/workflow/WorkflowProjectionsLedgerSection.tsx`
   - Inputs: projections, steps, lineItems, isDevOrMaster, canManageStages, expanded + onToggleExpanded (or own the projectionsLedgerExpanded state locally — it is used nowhere else), onAddProjection, onEditProjection, onDeleteProjection; consumes the workflowProjectionsLedger kernel
   - Notes: Lines 2522-2700. Depends on the kernel PR landing first. projectionsLedgerExpanded is tab-local so it moves in per playbook rule 3.
9. **workflowNotifications** — kernel, ~290 lines, medium risk, unit-testable → `src/lib/workflowNotifications.ts`
   - Inputs: Explicit context object: { projectId, projectName, workflowOrigin (window.location.origin), authUserId, supabase-backed lookups }. sendNotification + sendWorkflowNotifications + getContactForName (1250-1496) move out with project/workflow/authUser closures replaced by parameters.
   - Notes: Not pure (supabase + edge-fn invoke) but the repo's lib/*Documents pattern allows explicit-context modules. Optionally split a truly pure planner (given step flags + action type + next/prior steps, return the list of notifications to send) into workflowNotificationPlan.ts with unit tests — that is where the fan-out decision bugs would live. recordAction stays in the parent (writes stepActions state).
10. **WorkflowPageHeader** — component, ~190 lines, medium risk → `src/components/workflow/WorkflowPageHeader.tsx`
   - Inputs: project, projectMaster, projectJobs, steps, canAssignSuperintendents, canManageStages, projectSuperintendents, allSuperintendents, projectSuperintendentSaving, onAddSuperintendent, onRemoveSuperintendent, oldStagesCollapsed + toggle, onAddStep, onEditProject, plus the 9 useJobThreadNotes values/setters and authRole for JobThreadNotesPanel
   - Notes: Lines 2303-2520. Prop-heavy because of the job-thread wiring; consider passing the whole useJobThreadNotes return as one object prop. The step-chain breadcrumb (scroll-to-step) moves with it, using getStepStatusStyle from the kernel.
11. **WorkflowStepCard** — component, ~700 lines, high risk → `src/components/workflow/WorkflowStepCard.tsx`
   - Inputs: step, isCollapsed + onToggleCollapsed, sectionExpanded slice + onToggleSection, lineItems[step.id], stepActions[step.id], userSubscriptions[step.id], personContacts, userNames, currentUserName, role flags (canManageStages, canSeePrivateNotesAndApprove), availablePOs/availableInvoices presence flags, and ~18 callbacks (onAssign, onSetStart, onMarkCompleted, onMarkApproved, onReject, onSkip, onReopen, onEditStep, onDeleteStep, onOpenExpectedDates, onUpdatePercentComplete, onUpdateNotes, onUpdatePrivateNotes, onUpdateNotifyAssigned, onUpdateNotifyMe, onUpdateCrossStepNotify, onOpenContact, line-item callbacks)
   - Notes: The 690-line per-step card body (2793-3485). Do LAST, after every kernel exists, so the diff is a pure JSX+props move. Preserve the uncontrolled textarea/input key patterns (key includes the persisted value) exactly — they are the autosave mechanism. The old-stages summary/displayItems computation and all mutation handlers stay in the parent. This single move takes the parent below ~2400 lines.

### Suggested PR sequence

1. PR 1: Step-0 map — write docs/WORKFLOW_ARCHITECTURE.md (per the playbook, Workflow.tsx has no map yet; copy the section shape from BIDS_TABS_ARCHITECTURE.md, inventory the sections above, record that selection is per-step-inline rather than a shared pointer). No code change.
2. PR 2: extract workflowFormat kernel (~130 lines) + tests — Stage A, zero-risk pure functions used by every later component move; unblocks all Stage-B PRs.
3. PR 3: extract workflowProjectionsLedger kernel (~90 lines) + tests — the page's only real calc logic (unified projections/ledger row merge) gets under unit tests before any UI moves.
4. PR 4: extract WorkflowStepFormModal (~505 lines) — already a self-contained module-level component; pure file move + import, the single biggest safe line-count win.
5. PR 5: extract WorkflowStepActionModals (~250 lines) — five leaf confirm/reason modals with parent-owned state and callbacks; trivial props.
6. PR 6: extract WorkflowLineItemModals (~310 lines) — line-item editor + PO/invoice pickers and viewers; consumes PR 2 formatters.
7. PR 7: extract WorkflowExpectedDatesModal (~150 lines) — needs ymd kernels from PR 2 for its linked start/end/length handlers.
8. PR 8: extract WorkflowPersonContactModal + PersonDisplayWithContact + projection editor modal (~185 lines combined) — small leaf components, clears the remaining minor modals.
9. PR 9: extract WorkflowProjectionsLedgerSection (~185 lines) — consumes PR 3 kernel; projectionsLedgerExpanded state moves in (single-consumer state).
10. PR 10: extract workflowNotifications lib (~290 lines) — Stage A for the step-card cluster: replace project/workflow/authUser closures with an explicit context param; optionally split a pure notification-plan kernel with tests.
11. PR 11: extract WorkflowPageHeader (~190 lines) — prop-heavy (job-thread hook passthrough) but behavior-isolated.
12. PR 12: extract WorkflowStepCard (~700 lines) — the finale; by now all formatters, ledger math, and the notification engine are out, so the diff is a JSX + props move. All mutation handlers, refreshSteps, ensureWorkflow refs, and collapse-state maps stay in the parent.

### Risks & gotchas

- No render-test harness: the step card has dozens of role-gated branches (canManageStages vs assigned-tech vs subcontractor) — each Stage-B move must be manually smoke-checked in the preview browser per role, since only kernels get automated tests.
- Uncontrolled-input autosave pattern: notes/private-notes textareas and the percent-complete input use key={id + persisted value} + defaultValue + onBlur. Moving them into WorkflowStepCard must preserve the exact key composition or edits will be silently dropped/reset.
- ensureWorkflow promise-mutex and lastLoadedWorkflowId refs guard against duplicate workflow creation and redundant loads; they must stay in the parent untouched — threading them into a hook prematurely risks re-introducing the concurrent-create bug the mutex fixed.
- sendWorkflowNotifications refetches all steps from the DB while findNextStep/findPreviousStep use local state — two sources of truth for step order. Preserve both verbatim in PR 10 (behavior-preserving); flag the duplication in the map for a later pass.
- ymdAddDays/ymdDaysBetween duplicate utils/dateUtils helpers with possibly divergent semantics — the kernel PR must move, not merge, them.
- Theme CI: card borders use literal saturated hexes (#bae6fd, #E87600, #b91c1c) that pass today because they are non-neutral; moved styles must be copied byte-for-byte so scripts/theme-tokenize.mjs --check stays green.
- Subcontractor access model lives inside loadSteps (assigned_to_name filter + empty-result access error); it stays in the parent and must not leak into any extracted component.
- assignPerson and notes updates use RPC-with-fallback ('Could not find the function' string match) — preserve the fallback chains exactly when they move near the step card.

---

## src/pages/People.tsx — 4,269 → ~3,250 lines

People.tsx is the tab-switched People page shell — the remnant of a ~21,435-line God component whose decomposition is documented (and mostly complete) in docs/PEOPLE_TABS_ARCHITECTURE.md. Today it: wires the five shared hooks (usePeopleRoster, usePeopleAccess, usePayConfig, usePeopleHoursData, useCrewJobMap) plus useUsersTabTags; owns the URL deep-link router and ~60 remaining state vars; renders thin wrappers for 14 extracted tabs and the still-inline Hours-tab section stack (all sub-sections already componentized); and hosts the two deliberately-retained clusters the pay_stubs extraction left behind — the Draft Payroll / Forecast orchestration (pending-approval counts, salaried payroll windows, realtime snapshot ref) and the Record-payment / mark-paid / employee-credit flow — plus ~520 lines of pay-stub HTML document assembly (generatePayStub, buildPayStubViewHtml, printPayStub) that is heavily self-duplicated, the ~275-line tab nav bar, and several small inline modals (record payment, delete-confirm, person form, invite confirm, edit-user-note).

**Already extracted:** Extensive — this file is the near-finished reference case in docs/PAGE_DECOMPOSITION_PLAYBOOK.md (21,435 → 4,269). Tabs: PeopleUsersTab (+useUsersTabTags/PeopleUserTagsPanel/peopleUsersTabShared), PeopleTeamsTab, PeopleOverheadTab, PeopleEmploymentTab, PeoplePayStubsTab, PeopleVehiclesTab, PeopleHousingTab, PeopleOffsetsTab, PeopleLicensesTab, PeopleContractsTab, PeopleReviewTab, WriteupsContractsSubTab, TeamFeedbackDevSettingsBlock, PeopleAppActivityPanel. Hours sub-sections: PeopleHoursTeams, PeopleHoursDueSummaries, PeopleHoursSessions, PeopleHoursWeekRange, PeopleHoursGrid, PeopleHoursGridJobHighlight, PeopleHoursPendingBanner, peopleHoursTabShared. Hooks: usePeopleAccess, usePeopleRoster, useCrewJobMap, usePayConfig, usePeopleHoursData. Kernels: lib/people/{buildAddSessionPeople, computeWeekdayCostTotals, derivePersonTeamSummary, hoursGridTime, shouldOfferManualHoursSession} and lib/peopleDocuments/buildPayStubHtml (all with tests). Do not re-propose any of these.

### Internal structure

| Section | Lines | What it is |
|---|---|---|
| Imports | 1-134 | 134 imports: extracted tab components, hooks, lib kernels, modal components |
| Module constants + types | 136-215 | todayYyyyMmDdLocal/paidAtIsoFromYyyyMmDd helpers, Z_PEOPLE_* z-index ladder, HoursTabSectionId types + scroll-id/initial-open maps, PeopleTab union (15 keys), realtime max-ids constant |
| Hook wiring + state | 217-604 | usePeopleRoster/usePeopleAccess/useUsersTabTags/usePayConfig/usePeopleHoursData/useCrewJobMap calls, ~60 useState vars (hours dates, pay-stub cluster, draft-payroll cluster, mark-paid cluster, hours-tab sections, editors), the Review-Hours bridge refs, realtimeCallbacksRef, loadPeopleHoursRef |
| loadPersonProjects | 605-675 | Users-tab active-projects loader: 3 supabase queries then pure grouping of steps→workflows→projects into projectsByPerson |
| URL deep-link router + section-scroll effects | 677-912 | tab= param router with per-tab permission redirects, legacy team_costs/pay redirects, contracts_sub=writeups redirect, vestigial #cost-matrix hash handler, section=rejected deep link, hours focus/flash scroll choreography, activity-viewer access resolution |
| Small callbacks + status loaders | 914-975 | openHoursMyTimeFromSession/ForGridCell, hoursAllowNcnsFromMyTime, push-subscriptions / location / contract-signing-status load effects |
| Roster actions | 977-1099 | archivePerson, restorePerson, isAlreadyUser, inviteAsUser (with auto-merge of duplicates), confirmAndInvite, handleMergeDuplicate |
| payConfigRosterSections memo + archived names | 1101-1173 | roster sectioning memo (sub/helper account-vs-external slices) synced into payConfigRosterSectionsRef, salary-template indicator effect, loadArchivedUserNames |
| Draft-payroll pending + hours-correct loaders | 1175-1244 | loadDraftPayrollPendingApprovals (fetch-id guarded count), loadHoursDaysCorrect, toggleHoursDayCorrect |
| loadPayStubs | 1246-1335 | chunked load of pay_stubs + payments/deductions/additional-lines maps; returns a snapshot consumed by the offset-form onSaved |
| Pay-report data helpers | 1337-1441 | getVehiclesForPersonInPeriod, getHousingForPersonInPeriod, getPendingOffsetsForPayReport, getPersonContact — per-person period lookups feeding the stub HTML builders |
| generatePayStub + bulk generate | 1443-1715 | creates pay_stubs + pay_stub_days rows (dual-rate office/job split, salaried windows), then assembles crew maps + jobs/bids labels and builds preview HTML; bulkGenerateMissingPayStubsInModal loops it |
| buildPayStubViewHtml / viewPayStub / printPayStub | 1717-1959 | two near-identical ~115-line assembly paths (view vs print) fetching stub days, crew rows, jobs/bids maps, vehicles/housing/offsets/payments, then buildPayStubHtml; viewPayStubInModal wraps into PayStubViewModal state |
| deletePayStub + mark-paid handlers | 1961-2080 | optimistic delete, openPayStubMarkPaidModal (prefills remaining), closePayStubMarkPaidModal, openEmployeeCreditFromRecordPayment (excess→offset draft), confirmPayStubMarkPaid |
| Teams CRUD data + display order | 2082-2135 | loadTeams, mergeDuplicates detection effect, loadHoursDisplayOrder, moveHoursRow |
| Load-orchestration effects | 2138-2249 | hours-tab master load (80ms debounce, per-permission loader fan-out), employment/pay_stubs/review tab loads, draft-payroll realtime snapshot + pending-count + breakdown-close effects, offset form open/close |
| Cross-tab bridges | 2251-2368 | handleInlineOpenDayEditor / handleDraftPayrollBreakdownOpenDayEditor / handleInlineDrilldownOpenChange (Review↔Hours and DraftPayroll↔MyTime bridges), crew-jobs load effects, realtime fan-out assignment |
| openManualHoursDraftFromBlur + team CRUD | 2370-2470 | grid-blur → proportional-scale draft session flow; addTeam/updateTeamName/addTeamMember/removeTeamMember/deleteTeam |
| Hours/pay compute helpers + derived lists | 2472-2711 | getHoursForPersonDate/getEffectiveHours/canEditHours/getDisplayHours/getHoursGridDisplayHours/getCostForPersonDate(+Teams)/getPayroll* (with draftPayrollSalaryWindows effect), showPeopleForHours/Matrix orderings, forecastUnpaidRows memo, teamsFiltered, week-shift + navigation helpers |
| Pending-by-cell + job-highlight memos, correctness helpers | 2713-2824 | peopleHoursPendingByCellMap/Summary memos + popover-sync effects, jobHighlightPeople/Cells memo, isCorrectDayMissingJob/getRunPayrollReviewDayItems/hasUnassignedCorrectDays, derived permission flags, writeupUserSelectOptions |
| Tab nav bar render | 2828-3103 | ~14 permission-gated tab buttons, each repeating the setActiveTab + setSearchParams pattern, plus divider pipes and the page title |
| Thin tab wrappers (users/teams/overhead/pay_stubs) | 3105-3195 | prop-heavy but thin renders of PeopleUsersTab, PeopleTeamsTab, PeopleOverheadTab, PeoplePayStubsTab |
| Pay-stub delete-confirm modal (inline) | 3197-3230 | small fixed-overlay confirm dialog |
| Record-payment (mark-paid) modal (inline) | 3232-3366 | ~135-line modal: amount/date/note inputs, net/remaining math via payStub kernels, excess→employee-credit panel |
| Forecast / DraftPayroll / breakdown modal hosts | 3368-3436 | PayrollForecastModal, DraftPayrollModal (~40 props from parent compute), DraftPayrollPersonHoursBreakdownModal |
| Hours tab render | 3439-3771 | pay-tools bar, PeoplePayConfigModal, ReviewHoursModal, section-jump nav, clock-strip section (last inline sub-section), PeopleHoursWeekRange/Grid/Sessions/DueSummaries/Teams wrappers, merge-duplicates banner, SalariedWorkdaysBulkModal |
| Remaining thin tab wrappers | 3773-3861 | employment/vehicles/housing/offsets/licenses/contracts/writeups/review/feedback/activity |
| PersonOffsetFormModal host | 3863-3892 | employee-credit entry point; onSaved re-syncs the open Record-payment modal from a fresh loadPayStubs snapshot |
| Person form / invite-confirm / edit-user-note modals (inline) | 3894-4008 | add-edit person form (fields owned by usePeopleRoster), invite confirm, edit-user-note modal with its own supabase save |
| Hours modal hosts | 4010-4089 | HoursUnassignedModal, PeopleHoursDayAuditModal, pending-cell popover, bulk-approve modal, ClockSessionEditSplitModal |
| My-Time editor hosts | 4091-4265 | hoursManualDraftEditor DashboardMyTimeDayEditorModal (with the approved-sum resync onSaved), PayStubViewModal, hoursMyTimeEditor DashboardMyTimeDayEditorModal (payroll-origin + review-reopen bridges) |

### Extraction candidates (easiest/safest first)

1. **PeopleTabNav** — component, ~275 lines, low risk → `src/components/people/PeopleTabNav.tsx`
   - Inputs: activeTab, onSelectTab(tab: PeopleTab) (parent keeps setActiveTab + setSearchParams inside one callback), and the gate flags: isDev, canAccessTeamsTab, canAccessOverheadTab, canAccessPay, canOpenHoursTab, canAccessLicenses, canAccessContracts, canSeeActivityTab; plus narrow-scroll wrapper styles (tabStyle import moves with it)
   - Notes: Lines 2828-3103. Purely presentational and the single biggest cheap win: 14 near-identical permission-gated buttons all repeating the same setActiveTab+setSearchParams pattern, collapsible to a config array inside the component. Selection/URL state stays in the parent per playbook rule 2 — the component only calls onSelectTab(key). Keep the divider-pipe conditions ((canAccessTeamsTab||canAccessOverheadTab)&&canOpenHoursTab, canAccessPay&&canAccessLicenses) exactly.
2. **buildForecastUnpaidRows** — kernel, ~40 lines, low risk, unit-testable → `src/lib/people/buildForecastUnpaidRows.ts`
   - Inputs: payStubs, payStubPaymentsByStubId, payStubDeductionsByStubId, payStubAdditionalByStubId (returns PayrollForecastUnpaidRow[])
   - Notes: Lines 2608-2640: the forecastUnpaidRows memo body is already pure (net-pay/remaining math over the existing payStubPayments/payStubDeductions kernels, oldest-balance-first sort). Classic Stage-A: money math gains unit tests (fully-paid skip, tolerance boundary, sort tie-break on personName). Parent keeps a one-line useMemo calling the kernel.
3. **PayStubRecordPaymentModal** — component, ~170 lines, low risk → `src/components/pay/PayStubRecordPaymentModal.tsx`
   - Inputs: stub (payStubMarkPaidTarget), paymentsByStubId/deductionsByStubId/additionalByStubId (or precomputed net/remaining), amount/date/note values + setters, markingPayStubId, onConfirm, onClose, onOpenEmployeeCredit, zIndex
   - Notes: Lines 3232-3366 (the Record-payment modal) plus optionally the tiny delete-confirm modal at 3197-3230 as PayStubDeleteConfirmModal in the same file/PR. Conservative seam: state + confirmPayStubMarkPaid/openEmployeeCreditFromRecordPayment stay in the parent (they touch loadPayStubs, the offset form, and recordPaymentRefreshAfterEmployeeCreditRef) and pass down as callbacks — mirrors the PeoplePayStubsTab bridge design. Lives in components/pay/ next to PayStubLessModal/PayStubAdditionalModal siblings. Green #059669/red #dc2626 action colors stay literal per theme rules.
4. **payStubDocumentData (pure prep kernels)** — kernel, ~90 lines, low risk, unit-testable → `src/lib/peopleDocuments/payStubDocumentData.ts`
   - Inputs: crew rows / crew-bid rows, dayRows, personName; hours rows + isSalary + day range for the fallback
   - Notes: Stage-A prep for the assembly dedup: lift the pure repeated blocks — buildCrewAssignmentMaps (crew/bid rows → crewByDatePerson + crewBidsByDatePerson + jobIds/bidIds sets; repeated verbatim 3x at 1587-1610, 1742-1761, 1870-1889) and deriveStubDayRowsFallback (pay_stub_days rows or salaried-weekday-8/0 / people_hours fallback; repeated at 1724-1735 and 1852-1862). Both get unit tests. Callers shrink but keep behavior byte-identical.
5. **assemblePayStubDocument** — kernel, ~430 lines, medium risk, unit-testable → `src/lib/peopleDocuments/assemblePayStubDocument.ts`
   - Inputs: explicit context object: stub (or generate params), users, people, payConfig, plus the supabase client (repo precedent: fetchSalariedPayrollWindows takes supabase as an arg); returns the built HTML string
   - Notes: The big dedup: buildPayStubViewHtml (1718-1831) and printPayStub (1846-1959) are ~95% identical async assembly pipelines, and generatePayStub (1443-1674) repeats the same crew-maps/jobs-maps/vehicles/housing/offsets fan-out. Move the shared fetch+assemble into one lib function (getVehiclesForPersonInPeriod / getHousingForPersonInPeriod / getPendingOffsetsForPayReport / getPersonContact move with it, taking users/people as params instead of closures). Parent keeps thin callers: viewPayStub → openPayStubWindow(html,false), printPayStub → openPayStubWindow(html,true), viewPayStubInModal → setPayStubViewModal, and generatePayStub keeps its DB-insert half but delegates document assembly. Medium risk because these are payroll-money documents with three subtly different variants (generate passes physicalPayments: [], print flag differs) and no render tests — diff each variant against the kernel output carefully.
6. **PeoplePersonFormModal** — component, ~90 lines, low risk → `src/components/people/PeoplePersonFormModal.tsx`
   - Inputs: the usePeopleRoster form cluster: formOpen, editing, kind/setKind, name/setName, email/setEmail, phone/setPhone, notes/setNotes, saving, handleSave, closeForm; optionally the inviteConfirm dialog (inviteConfirm, onConfirm=confirmAndInvite, onCancel) in the same file
   - Notes: Lines 3894-3944: the add/edit person form modal plus the tiny invite-confirm dialog. All field state already lives in usePeopleRoster, so this is a pure JSX move with controlled props — the map's earlier 'stays in parent' call predates the roster hook and no longer buys anything. KINDS/KIND_LABELS import from peopleUsersTabShared moves with it.
7. **PeopleEditUserNoteModal** — component, ~65 lines, low risk → `src/components/people/PeopleEditUserNoteModal.tsx`
   - Inputs: editingUserNote value + setEditingUserNote (or value/onChange/onClose), onSaved (parent runs loadPeople), setError; the supabase users-update moves into the component (precedent: PeopleHoursSessions imports supabase directly)
   - Notes: Lines 3946-4008 plus the userNoteSaving state (527) which moves in as local state. Self-contained leaf modal opened only from PeopleUsersTab via the setEditingUserNote prop the parent already passes — the parent keeps only the editingUserNote pointer.
8. **groupActiveProjectsByPerson** — kernel, ~45 lines, low risk, unit-testable → `src/lib/people/groupActiveProjectsByPerson.ts`
   - Inputs: steps rows, workflows rows, projects rows (the three query results)
   - Notes: Lines 646-674 inside loadPersonProjects: the workflowToProject map + per-person dedupe/sort grouping is pure and testable (dedupe by project id, name sort, trimmed-name skip). The three supabase queries stay in the parent loader (or move into usePeopleRoster later). Small but free.
9. **useDraftPayrollOrchestration** — hook, ~220 lines, high risk → `src/hooks/useDraftPayrollOrchestration.ts`
   - Inputs: canAccessPay, activeTab, payStubPeriodStart/End + setters, payConfig, getHoursForPersonDate, setError; returns draftPayrollModalOpen/setters, pending-approval count/loading/error + loader ref, draftPayrollSalaryWindows, getPayrollEffectiveHours/getPayrollCostForPersonDate, the realtime snapshot ref
   - Notes: The last meaningful cluster: draft-payroll state (442-454, 2520), loadDraftPayrollPendingApprovals (1175-1211), the snapshot/pending/breakdown-close/salary-window effects (2191-2227, 2328-2339, 2522-2556), and the payroll compute helpers. High risk: the realtime fan-out (2352-2368) reads the snapshot ref, the My-Time editor payrollOrigin bridge (4188-4265) calls the loaders directly, and DraftPayrollModal consumes Hours-owned compute — this is why the pay_stubs extraction deliberately left it. Do last, only if the hub still feels heavy; the breakdown/editor bridge callbacks stay in the parent either way.

### Suggested PR sequence

1. PR 1: extract PeopleTabNav (~275 lines) — biggest pure-presentational win in the file, zero data coupling, collapses 14 copy-pasted buttons into a config-driven component; validates the onSelectTab seam while URL/tab state stays in the parent per the playbook.
2. PR 2: extract buildForecastUnpaidRows kernel + tests (~40 lines) — pure payroll math currently untested; classic Stage-A with no UI movement.
3. PR 3: extract PayStubRecordPaymentModal (+ PayStubDeleteConfirmModal) (~170 lines) — leaf modals with all mutation handlers staying in the parent as callbacks, mirroring the conservative seam the pay_stubs tab extraction established.
4. PR 4: extract payStubDocumentData pure kernels + tests (~90 lines) — Stage-A prep: buildCrewAssignmentMaps and deriveStubDayRowsFallback are repeated verbatim 2-3x across the document builders; tests land before the risky move.
5. PR 5: extract assemblePayStubDocument (~430 lines) — dedupe buildPayStubViewHtml/printPayStub/generatePayStub's shared assembly into lib/peopleDocuments with explicit deps; the highest-value extraction left but a payroll-money path, so it goes after its kernels exist and gets careful per-variant diffing.
6. PR 6: extract PeoplePersonFormModal (+ invite-confirm dialog) (~90 lines) — pure JSX move since usePeopleRoster already owns all form state.
7. PR 7: extract PeopleEditUserNoteModal (~65 lines) — self-contained leaf modal, supabase save moves in, parent keeps the open-pointer.
8. PR 8: extract groupActiveProjectsByPerson kernel + tests (~45 lines) — small pure grouping out of loadPersonProjects.
9. PR 9 (optional, high risk): useDraftPayrollOrchestration hook (~220 lines) — the deliberately-deferred draft-payroll cluster; only attempt after PRs 1-8 land and with the realtime-snapshot-ref and My-Time payrollOrigin bridges kept in the parent.

### Risks & gotchas

- Payroll-money paths (generatePayStub / print / view) have no render tests and three subtly different variants (generate passes physicalPayments: [], print vs view differ only in the openPayStubWindow print flag, modal path returns HTML for state) — the PR-5 dedup must preserve each variant byte-for-byte; land the PR-4 kernels + tests first.
- Render-order-sensitive ref assignments: payConfigRosterSectionsRef (1158), rosterDepsRef (533), realtimeCallbacksRef fan-out (2352-2368), and loadPeopleHoursRef/loadAllClockSessionsRef are assigned during render and read lazily by hooks/mutators — extractions must not move code across these assignment points.
- The URL deep-link router (677-818) and hours focus/flash scroll effects target DOM ids rendered by child sections (people-hours-*, people-hours-rejected, people-hours-col-<date>) — keep ids stable through any Hours-layout moves.
- Quirk to preserve, not fix, during extraction: the vestigial #cost-matrix hash handler (779-785) spreads a costMatrix key that no longer exists in HoursTabCollapsibleSectionId and scrolls to a dead anchor — the architecture map documents it as a deliberate legacy-deep-link vestige.
- The Record-payment ↔ PersonOffsetFormModal choreography (recordPaymentRefreshAfterEmployeeCreditRef, onSaved re-snapshot at 3870-3890) spans both modals — PR 3 must keep that state and both handlers in the parent or the employee-credit refresh silently breaks.
- Working tree has unrelated WIP on feat/edit-job-ux-polish (schedule/jobs files) — branch each extraction PR from origin/main and stage only the touched files, per repo convention.
- Every extraction must update docs/PEOPLE_TABS_ARCHITECTURE.md (flip status, link new file) and add its docs/RECENT_FEATURES.md entry per CLAUDE.md; npm run typecheck && npm run lint && npm test after each PR.

---

## src/components/jobs/JobFormModal.tsx — 4,085 → ~2,050 lines

The New/Edit Job modal — the app's single writer of a job's core row and child tables (payments, materials, fixtures, team members) from this surface. It owns the remount-by-key lifecycle (mount-only init loads customers/projects/bids/service-types/users, then forks new vs edit), all shared form-field state, the prefill appliers (bid/estimate import), the money-path handlers (createInvoice, move-to-Ready-to-Bill, payment remove/Mercury-unlink RPCs, the saveJob delete+reinsert engine that overwrites payments_made), delete/migrate orchestration, and the wiring for ~10 nested/tail modals. Eight sections have already been extracted to sibling JobForm* components plus three colocated hooks (useBreakOffSlider, useJobCostSnapshot, useJobMigrate) and seven tested lib/jobs kernels; what remains inline is the header row, identity fields, customer block (+create-customer modal), Project|Plans|Bid links section, source-estimate banner, three nested confirm/preview overlays, the labor-cost loader effect, and the save engine.

**Already extracted:** Stage A (all in src/lib/jobs/ with tests): jobFormBreakOff, jobFormMoney, jobFormPaymentPredicates, jobFormRows, jobFormServiceTypes, jobFormTypes, editJobBillingBar. Stage B components (src/components/jobs/): JobFormPeoplePicker (#436), JobFormFixturesSection (#435), JobFormDeleteMigrateModals (#437), JobFormInvoiceList (#430), JobFormPaymentsTable, JobFormPartsCostSection, JobFormLaborCostPanel, JobFormBreakOffSection, JobFormMaterialsCostAccordion, JobFormImportEstimateOrBidModal, MoneyLifecycleBar. Colocated hooks: useBreakOffSlider, useJobCostSnapshot, useJobMigrate. Shell-level modals already external components: JobBidLinkChoiceModal, JobProjectLinkChoiceModal, AgreedWriteDownModal, BilledBillViewModal, CustomerAcceptanceRecordModal. Note: docs/JOB_FORM_MODAL_ARCHITECTURE.md's line anchors are stale (written at v2.736 / 7,137 lines) — its dossiers and extraction order remain the authority; update Status flags there per PR.

### Internal structure

| Section | Lines | What it is |
|---|---|---|
| Module-scope helpers + z-index ladder | 1-201 | Imports; JOB_FIELD_* style consts, ClipboardPasteGlyph, pasteTextToField (move with Identity fields); z-index ladder 1010-1013 (stays); formatJobFormBidLinkTitle (moves with Links section); ProjectOption type; JobFormModalProps |
| Context wiring + shell/tail-modal state + Stripe memo backfill | 203-303 | Auth/toast/billCustomer/jobDetailOpenerBridge/newProjectModal contexts; onSavedRef/onCreatedJobIdRef; editing/billViewInvoice/agreedWriteDownInvoice; refetchEditingFromBillView; stripeMemoBackfillKey memo + serial edge-fn backfill effect (stays in shell) |
| Form-field state block | 304-529 | ~60 useState decls: source-estimate (304-306), hcp help popover state+effect (309-325), identity/customer/link fields, highlight gates, payments/materials/fixtures rows, stripe fixture preview state+memo+Esc effect (403-422), jobTotalBidDollars + billingBar memos, breakOff/migrate/costSnapshot hook calls, newJobImportBlockedByContent dirty gate (440-491), labor state (524-529) |
| Derived memos, role gates, delete-gate calc, refs | 531-655 | visibleJobFormServiceTypes, persistedLedgerPaymentIds, jobFormServiceTypeSelectOptions, jobFormMissingFields/CanSubmit, editJobEffectiveHcp, labor link gates, partsCostStyleTotal, hasMigrateableCosts/costCheckErrored/reassignRequired; 11 scroll/focus refs (645-655) |
| Customer display helpers | 657-687 | getCustomerDisplay, extractContactFromCustomer, customerListImpliesLinkedRow, customerTypeShortLabel — all used only by the customer block + create-customer modal |
| Lifecycle: closeForm / applyEditJob / resetNewForm | 689-810 | closeForm resets nested overlays; applyEditJob hydrates every field from the job row incl. break-off prefill; resetNewForm. Stay in shell permanently |
| Prefill appliers | 812-1012 | applyPrefillFromBid (812-919) and applyPrefillFromEstimate (921-1012) — write customer/identity/fixture fields; consumed by Import modal + openNewJob prefill. Stay in shell (write fields owned by multiple sections) |
| Init effect + prefill timing + bid-summary backfill | 1014-1168 | Mount-only useLayoutEffect (1014-1143) loading 5 reference caches then forking new/edit; bid-prefill one-shot effect (1145-1153); linkedBidSummary backfill (1155-1168). Stays — the remount-by-key contract lives here |
| Source-estimate loader effect | 1170-1197 | Queries estimates by job_ledger_id into sourceEstimateForJob — moves with the banner extraction |
| Team + sub-labor loader effect | 1200-1316 | Keyed on editing.id + hcpNumber; loadTeamLaborData filtered to job; sub-labor case-insensitive HCP match, laborItemsSubtotal + drive-cost math (defaults 0.7/0.02 from app_settings) — hook + kernel extraction target |
| Highlight-gate + customer-sync + similar-customer effects | 1318-1404 | billing/fixtures/pictures highlight scroll+auto-clear effects (1318-1367); customerId->customerSearch/dateMet sync (1369-1377); similar-customers loader for create-customer modal (1379-1404) |
| Scroll callbacks + jump-link styles + payment-remove memos | 1406-1497 | billedMaterialsTotalDisplay; scrollToProject/JobPlans/BidSection callbacks (1412-1448) + 3 style consts (move with Links section); paymentRemovePreview + paymentRemoveConfirmsPersistedRpc memos (1476-1497, move with payment confirm modals) |
| Money-path invoice handlers | 1500-1658 | getEditJobBillableRemaining; moveWorkingJobToReadyToBillFromEdit (Stripe void-prep + update_job_status RPC); createInvoice (clamp, full-remainder-opens-BillCustomer special case, jobs_ledger_invoices insert + ensure_single_ready_to_bill RPC). Stay in shell |
| Row handlers: payments / materials / fixtures | 1660-1881 | add/update/remove for the three row grids incl. locked-row re-freeze (1668-1682), remove-confirm routing with lock toasts (1701-1726), confirmRemovePaymentRow RPC (1728-1781), Mercury unlink RPC handlers (1783-1843). Handlers stay shell; confirm-overlay JSX extracts |
| Customer create/link/import handlers | 1883-2003 | handleCreateCustomerFromJob (customer-master invariant, immediate jobs_ledger.customer_id write in edit mode), handleLinkToSimilarCustomer (immediate link), handleCustomerImport (clipboard parse) — move with the customer section |
| saveJob — MONEY-PATH save engine | 2005-2244 | Edit branch: resolve master/customer, UPDATE jobs_ledger (payments_made overwrite), dispatch-request auto-close, delete+reinsert payments/materials/fixtures (errors unchecked), team diff, paid->billed demote. New branch: insert + child inserts + onCreatedJobId. Tail: date_met backfill. Highest-risk piece |
| deleteJob / migrate / confirmDeleteJob | 2246-2311 | Direct jobs_ledger delete; migrate_job_ledger_costs_and_delete RPC wrapper. Thin; feed JobFormDeleteMigrateModals (already extracted); stay in shell |
| Render: loading + shell overlay + header row | 2313-2602 | initDone loading overlay (2313-2329); backdrop (2331-2358); header: title, HCP/C# help popover, Import vs Job Detail center button, right 'Link to: Bid \| Project' quick links (2359-2602) — JobFormHeaderRow target |
| Render: source-estimate banner + error | 2603-2659 | Green banner with estimate link + 'View contract & acceptance' opener (2603-2646); shell error paragraph (2647-2659, stays) |
| Render: identity fields | 2660-2782 | HCP / C# / Job Name (clipboard paste) row; Service type SearchableSelect; Last manual bill date + Job Address (paste) row — JobFormIdentityFields target |
| Render: people picker wrapper | 2783 | Already a thin <JobFormPeoplePicker/> wrapper |
| Render: customer block | 2784-3105 | Collapsible Customer header with 'Not in Customers' chip + clipboard Import; link-to-customer search dropdown (archived-filtered), create/clear buttons, name/phone/email, locked Date Met, Customer Files + Customer Pictures with highlight wrappers — JobFormCustomerSection target |
| Render: Project | Plans | Bid links section | 3106-3348 | Chevron + jump-link row, expandable panel: project select-or-disconnect (implies customer), Job Plans URL, bid link-or-disconnect + cover-letter link — JobFormLinksSection target |
| Render: billing header + extracted section wrappers | 3350-3474 | Billing legend + MoneyLifecycleBar (3350-3386); thin wrappers: JobFormFixturesSection, JobFormBreakOffSection, JobFormInvoiceList, JobFormPaymentsTable, JobFormLaborCostPanel, JobFormPartsCostSection |
| Render: footer actions | 3476-3540 | Delete (hidden for primary) / Cancel / missing-fields list / Save — shell chrome, stays |
| Render: payment-remove confirm overlay | 3542-3650 | 'Remove payment?' with RPC-vs-form-only copy fork + before/after remaining table — extract with Mercury overlay |
| Render: Stripe fixture preview dialog | 3651-3742 | stripe-fixture-line-preview-dialog showing buildFixtureStripeLineDescriptionForStripe output — belongs inside JobFormFixturesSection (its only opener) |
| Render: Mercury-unlink confirm overlay | 3743-3840 | 'Unlink and remove?' with double-count warning + paid->billed demote note — extract with payment-remove overlay |
| Render: delete/migrate + link-choice modal wiring | 3841-3934 | JobFormDeleteMigrateModals wrapper (3841-3859); JobBidLinkChoiceModal / JobFormImportEstimateOrBidModal / JobProjectLinkChoiceModal wiring incl. new-project prefill builder — stays in shell (multi-section openers) |
| Render: create-customer-from-job modal (inline) | 3935-4024 | Residential/Commercial toggle, similar-customer 'link instead' list, create button — moves with the customer section |
| Render: tail modals | 4027-4083 | AgreedWriteDownModal, BilledBillViewModal (3-attempt refetch retry loop on close), CustomerAcceptanceRecordModal — stay in shell per playbook (opened from 2+ sections), except CustomerAcceptanceRecordModal which moves with the source-estimate banner (single opener) |

### Extraction candidates (easiest/safest first)

1. **Stripe fixture preview dialog into JobFormFixturesSection** — component, ~110 lines, low risk → `src/components/jobs/JobFormFixturesSection.tsx`
   - Inputs: Nothing new — the section already receives fixtures and setStripeFixturePreviewRowId. Move stripeFixturePreviewRowId state (404), the row memo (405-411), the Esc effect (412-422), and the dialog JSX (3651-3742) into the section; delete the setter prop. The section wraps its remove-row call to clear the local preview id before invoking the removeFixtureRow prop (today the shell's removeFixtureRow clears it, 1879).
   - Notes: Finishes the map's original §7+§17 unit — the dialog's only opener is inside the section. Wait for the branch's in-flight JobFormFixturesSection.tsx edits to land first (file is dirty in the working tree).
2. **JobFormSourceEstimateBanner** — component, ~85 lines, low risk → `src/components/jobs/JobFormSourceEstimateBanner.tsx`
   - Inputs: editingJobId: string | null (only external dependency). Owns sourceEstimateForJob/sourceEstimateLoading/contractModalEstimateId state (304-306), the loader effect (1170-1197), the banner JSX (2603-2646), and the CustomerAcceptanceRecordModal wiring (4078-4082, its sole opener). resetNewForm's two setter calls (800-801) are dead in edit mode and drop out with the state.
   - Notes: Cleanest remaining vertical slice — map §2, flagged 'good early win'. Banner renders only when editing, so gating on editingJobId preserves behavior.
3. **JobFormPaymentConfirmModals** — component, ~230 lines, low risk → `src/components/jobs/JobFormPaymentConfirmModals.tsx`
   - Inputs: paymentRemoveConfirmRowId + setter, paymentRemoveRpcBusy, unlinkMercuryConfirmRowId + setter, unlinkingMercuryPaymentId, payments, jobTotalBidDollars, editingStatus (for the paid-demote copy), editing + persistedLedgerPaymentIds (for the RPC-vs-form-only memo), confirmRemovePaymentRow, confirmUnlinkMercuryFromBankRow, nestedOverlayZIndex. The paymentRemovePreview and paymentRemoveConfirmsPersistedRpc memos (1476-1497) move in; the RPC handlers stay shell-side callbacks.
   - Notes: Completes the map's §16+§18 (their owning table JobFormPaymentsTable is already out but the overlays stayed). Same shape as JobFormDeleteMigrateModals. Confirm state stays in the shell — closeForm/applyEditJob reset it.
4. **JobFormIdentityFields** — component, ~175 lines, low risk → `src/components/jobs/JobFormIdentityFields.tsx`
   - Inputs: hcpNumber/clickNumber/jobName/jobAddress/lastBillDate/formServiceTypeId + their six setters, jobFormServiceTypeSelectOptions. Takes JSX 2660-2782 plus module-scope ClipboardPasteGlyph, pasteTextToField, and the two JOB_FIELD_* style consts (114-151); jobNameInputRef/jobAddressInputRef become section-local.
   - Notes: Map §3 — controlled, wide-but-shallow props. All fields are save-engine inputs so everything arrives as props+setters; no owned state at all.
5. **JobFormHeaderRow** — component, ~255 lines, low risk → `src/components/jobs/JobFormHeaderRow.tsx`
   - Inputs: mode, isEditing + editingId, newJobImportBlockedByContent, bidId, projectId, and four callbacks: onOpenImport, onOpenBidLink, onOpenProjectLink, onOpenJobDetail (shell keeps the closeForm-then-bridge sequencing inside that callback). Owns hcpHelpOpen + ref + outside-click/Esc effect (309-325) and JSX 2359-2602.
   - Notes: Map §1, scheduled 'late' — now everything around it is out so it is unblocked. Pure presentational fork on mode/link state; the three modals it opens stay shell-owned.
6. **useJobFormLaborCosts + sub-labor sum kernel** — hook, ~135 lines, medium risk, unit-testable → `src/components/jobs/useJobFormLaborCosts.ts`
   - Inputs: Hook: { editingJobId, editingHcpNumber, hcpNumber } -> { teamLaborLoading/Row/Error, subLaborLoading/Data/Error }. Moves the six useState decls (524-529) and the loader effect (1200-1316). Stage A first: the pure sub-labor aggregation (matching-jobs filter, items-by-job grouping, laborItemsSubtotal + drive-cost formula, 1256-1299) goes to src/lib/jobs/editJobSubLaborSum.ts with tests pinning the 0.7/0.02 defaults and case-insensitive HCP match.
   - Notes: Map §13's data half (the render half JobFormLaborCostPanel is already out). Hook stays CALLED IN THE SHELL — its outputs feed hasMigrateableCosts/costCheckErrored (delete gate) and the migrate preview, not just the panel. Medium only because the effect is inside the file-top eslint-disable; the extracted hook must declare real deps identical to today's key set (editing?.id, editing?.hcp_number, hcpNumber).
7. **JobFormLinksSection** — component, ~310 lines, medium risk → `src/components/jobs/JobFormLinksSection.tsx`
   - Inputs: projectId + setProjectId, bidId + setBidId, linkedBidSummary + setter, jobPlansLink + setter, customerId + setCustomerId (project-implies-customer), projects, prefixMap (or a preformatted bid title), projectFilesPlansExpanded + setter (stays shell-owned: resetNewForm and both link-modal onLinked callbacks set it), onOpenBidLink callback, showToast. Moves JSX 3106-3348, the three scroll callbacks (1412-1448), the three style consts (1450-1474), formatJobFormBidLinkTitle (168-180), and 8 of the refs (647-655).
   - Notes: Map §6. The one sharp edge: JobProjectLinkChoiceModal's onLinked (3927-3931) focuses jobFormProjectDisconnectRef from the SHELL. Either export an imperative handle (focusProjectDisconnect) or have the shell pass the ref in — pick one and note it in the PR; behavior (focus after link) must survive.
8. **JobFormCustomerSection** — component, ~560 lines, high risk → `src/components/jobs/JobFormCustomerSection.tsx`
   - Inputs: customerId/Name/Email/Phone/dateMet/googleDriveLink/jobPicturesLink + setters, jobAddress + setJobAddress (picker backfills blank address), customers + setCustomers, customersLoading, customerExpanded + setter (applyEditJob writes it), customerSearch + setter + customerDropdownOpen (owned, but the sync effect 1369-1377 writes customerSearch — moves in), editing, projects + projectId + authUser (master resolution for the 'Not in Customers' chip and create-customer), authRole, highlight gates + billingCustomerHighlightRef/jobPicturesLinkHighlightRef + input ref, createCustomerFromJobModalOpen + setter (init effect can auto-open it, 1130-1133 — so open-state stays shell), onImmediateCustomerLinked callback wrapping the refetch + onSaved firing. Moves: customer block JSX (2784-3105), create-customer modal JSX (3935-4024), handlers handleCreateCustomerFromJob/handleLinkToSimilarCustomer/handleCustomerImport (1883-2003), similar-customers effect (1379-1404), display helpers (657-687), and modal-local state (355-360).
   - Notes: Map §5+§21 — the largest remaining slice and the riskiest UI move: two handlers write jobs_ledger.customer_id IMMEDIATELY in edit mode (quirk #18) and the customer-master invariant comment must move verbatim. Prefill appliers + init + link modals keep writing the same fields from the shell via the passed setters (documented touch-points; no change needed). Consider splitting: PR a = section JSX with handlers left as shell callbacks; PR b = handlers + create-customer modal move in.
9. **jobFormSave payload builders (Stage A)** — kernel, ~120 lines, medium risk, unit-testable → `src/lib/jobs/jobFormSave.ts`
   - Inputs: Pure functions extracted from saveJob: buildJobsLedgerWritePayload (the trim/null-coercion field map shared by update 2035-2054 and insert 2166-2185), filterValidPayments/filterValidMaterials/filterValidFixtures, paymentInsertRow/materialInsertRow/fixtureInsertRow mappers (sequence_order, unit>0-else-null, trimmed-or-null description), diffTeamMembers(existingIds, formIds) -> {toAdd, toRemove}, shouldDemotePaidToBilled(status, revNum, paymentsMadeNum) with the +0.01 tolerance.
   - Notes: The map's inventory row that was never shipped. Pins the save engine's exact field semantics (incl. quirk #4: fixtures with only scope notes silently dropped) under vitest before the sequence moves. saveJob body shrinks to calling the builders — write sequence unchanged.
10. **useJobFormSave runner (Stage B)** — hook, ~240 lines, high risk → `src/components/jobs/useJobFormSave.ts`
   - Inputs: All form values + editing + customers/projects + authUser, callbacks {onClose: closeForm, onSaved: onSavedRef, onCreatedJobId, setError, setSaving, showToast}. Moves the saveJob sequence (2005-2244) verbatim: same write order, same UNCHECKED child-row errors, same non-transactionality, same payments_made overwrite, with the map's prescribed TODO(billing) comment at the seam referencing BILLING_FLOWS #9/#10.
   - Notes: The very last move per the map's order (step 18). Byte-equivalent behavior is the acceptance bar; any transactional fix is a separate later behavioral PR, never this one. Do only after Stage A has the builders under test.

### Suggested PR sequence

1. PR 1: fold the Stripe fixture preview dialog + its state/effect into JobFormFixturesSection (~110 lines) — completes an already-shipped section's unit, zero new props; do it first but AFTER the branch's pending JobFormFixturesSection edits merge to avoid a conflict.
2. PR 2: extract JobFormSourceEstimateBanner with its loader effect and CustomerAcceptanceRecordModal (~85 lines) — the cleanest vertical slice left; one prop in (editingJobId).
3. PR 3: extract JobFormPaymentConfirmModals (payment-remove + Mercury-unlink overlays + their two memos, ~230 lines) — mirrors the proven JobFormDeleteMigrateModals shape; RPC handlers stay shell callbacks, so no money-path code moves.
4. PR 4: extract JobFormIdentityFields (~175 lines incl. module-scope paste helpers) — zero owned state, pure controlled props; big line win for low thought.
5. PR 5: extract JobFormHeaderRow (~255 lines + help-popover state) — now unblocked since the sections around it are out; three opener callbacks keep the modals shell-owned.
6. PR 6: Stage A editJobSubLaborSum kernel + tests, then move the labor loader into useJobFormLaborCosts called from the shell (~135 lines) — outputs still feed the delete gate, so only the effect body relocates.
7. PR 7: extract JobFormLinksSection (~310 lines: JSX + scroll callbacks + refs) — resolve the shell-side focus of jobFormProjectDisconnectRef (imperative handle or passed-in ref) explicitly in the PR description.
8. PR 8 (optionally 8a/8b): extract JobFormCustomerSection + create-customer modal + immediate-link handlers (~560 lines) — the big one; catalogue the prefill-applier/init/link-modal touch points in the PR body per the map's instruction before moving.
9. PR 9: Stage A src/lib/jobs/jobFormSave.ts payload builders + vitest coverage (~120 lines) — pins saveJob's field trims, null coercions, team diff, and the paid-to-billed +0.01 predicate before anything else moves.
10. PR 10: Stage B useJobFormSave runner (~240 lines) — move the write sequence byte-equivalent (same order, same unchecked errors) with the TODO(billing) transactional note; last move, only after PR 9 is merged and green.
11. Every PR: flip the section's Status in docs/JOB_FORM_MODAL_ARCHITECTURE.md, add the docs/RECENT_FEATURES.md entry, and verify npm run typecheck && npm run lint && npm test.

### Risks & gotchas

- saveJob is the MONEY-PATH: it overwrites jobs_ledger.payments_made and deliberately does NOT check child delete/insert errors (quirks #1-#3). PRs 9-10 must preserve this byte-for-byte — 'fixing' the unchecked errors or making it transactional in the same pass is the map's explicit anti-pattern.
- Mount-only init contract: the file-top eslint-disable react-hooks/exhaustive-deps covers every effect; extracted hooks (useJobFormLaborCosts, useJobFormSave) leave that umbrella and must declare dep arrays that reproduce today's exact firing behavior under the remount-by-key lifecycle.
- Customer section performs immediate DB writes in edit mode (handleCreateCustomerFromJob / handleLinkToSimilarCustomer update jobs_ledger.customer_id before Save and fire onSaved) while prefill appliers, init, and both link-choice modals write the same customer fields from the shell — the setter-based seam must keep both writers coherent.
- Ref coupling in the Links section: JobProjectLinkChoiceModal's onLinked (shell-level) focuses jobFormProjectDisconnectRef inside the section-to-be; needs an imperative handle or a passed-in ref to preserve the focus-after-link behavior.
- removeFixtureRow currently clears the Stripe-preview id from the shell (line 1879); after PR 1 the section must clear its now-local preview state before delegating, or a removed row's preview dialog lingers.
- No render-test harness exists — component moves are verified only by typecheck/lint/unit tests plus manual smoke in the preview browser (which holds a signed-in PROD session; look, don't write).
- Working tree already has uncommitted edits to JobFormFixturesSection.tsx and JobFormModal.tsx imports on branch feat/edit-job-ux-polish — sequence PR 1 after that branch merges, and stage files individually (never git add -A).
- docs/JOB_FORM_MODAL_ARCHITECTURE.md line anchors are stale (v2.736); trust its dossiers/order but re-anchor by symbol, and update it per extraction so it does not drift further.
- Theme-token CI: any styles that move must keep their var(--*) tokens; the few literal saturated action colors (#3b82f6, #b91c1c) are intentionally literal and should move unchanged.

---

## src/components/DashboardMyTimeDayEditorModal.tsx — 3,947 → ~2,250 lines

The "My Time" day-editor modal: given one person + one work date, it loads that day's clock_sessions (or accepts parent-seeded/draft sessions from People → Hours), groups them into time-contiguous clusters, and lets the user split/merge segments (visual drag-strip or form layout), edit focus notes, assign jobs/bids per segment, apply schedule-proportional splits, add disjoint sessions, adjust/force-close punch times, reject sessions, record NCNS, mark "not coming in", and persist everything through a large branching save routine that picks between direct updates, own_* RPCs, and leader RPCs depending on self-vs-lead editing, week-fence overrides, cluster homogeneity, and salary-schedule metadata. It is rendered from Dashboard, People (Review/Hours), user-review schedule sections, and quickfill surfaces. Heavy pure logic already lives in src/lib (myTimeDayTimeline, myTimeDaySavePlan, etc.) and five sub-components already extracted to src/components/my-time-day-editor/.

**Already extracted:** Components in src/components/my-time-day-editor/: MyTimeDayClusterVisual (1054 lines), MyTimeDayClusterForm (988), MyTimeMergeSegmentsModal, MyTimeSegmentMergeDirectionModal, AddDisjointSessionModal, useMyTimeCompactMergeMedia, myTimeDayEditorDatetime. Lib kernels with tests: myTimeDayTimeline.ts, myTimeDaySavePlan.ts (3 test files), myTimeMixedClusterSingleSegmentPartition.ts, persistMyTimeClusterForSegmentAssign.ts, splitOwnClockSessionSegments.ts, leaderClockSessionSplit.ts, applyScheduleProportionsToClockSession.ts, salaryScheduleSync.ts, salaryZonedWallClock.ts, resolveCalendarWorkday. Shared modals reused (not owned here): AssignFocusModal, ForceClockOutModal, AdjustClockSessionTimesModal.

### Internal structure

| Section | Lines | What it is |
|---|---|---|
| Imports | 1-102 | Heavy imports from already-extracted lib kernels (myTimeDayTimeline, myTimeDaySavePlan, split RPC wrappers) and my-time-day-editor sub-components. |
| Module constants + pure helpers | 104-256 | formatDurationMs, tap/drag constants, StripTapSession type, and 8 pure functions: buildPayloads, singleSegmentTimesMatchSession, stripJobBidForSegmentRpc, noteOnlyApprovedSafe, comparableSplit, listDirtyClusterIds, sessionJobBidKey, listClustersDirtyFromJobBidChange, plus MergeJobChoiceState type. Zero React — untested kernel material. |
| Props type + component signature | 258-337 | 16-prop contract covering self vs team-lead editing, week-fence override, People→Hours proportional seed, salary prefetch, NCNS gating. |
| Gating + sub-flow state | 338-463 | Week-fence/prior-week-ack derivation, not-coming-in state, auth state, force-clock-out / adjust-times / add-disjoint / reject / NCNS state slots, draft job-bid assign + saved callbacks. |
| Reject-session flow | 464-527 | handleRejectSession / confirmRejectSession: rejected_at update + recompute_people_hours RPC, per-dialog error state. |
| Auth, subject label, day-session fetch | 529-676 | auth.getUser effect, subject display-name resolution, clock_sessions day fetch effect + fetchDaySessionsForEditor + resolvedSessions memo. |
| Salary strip prefetch effect | 678-790 | Self-contained effect: probes salary_work_schedule_templates / day overrides / user_time_off, resolves calendar workday, runs syncSalaryClockSessionsForUserDay when day is empty; sets stripEmptyDayHint/timeOffLabel/busy. |
| NCNS gating + titles | 792-873 | sortedSessions memo, job_schedule_blocks probe for NCNS-with-no-sessions, ncnsClickAllowed + ncnsButtonTitle derivations. |
| Job/bid label loader | 875-970 | extraJobLabels/extraBidLabels state + effect calling get_jobs_ledger_by_ids / get_bids_by_ids RPCs, formatting via ledger prefix map; mergedJobLabels/mergedBidLabels memos (966-970). |
| Timeline derivations | 972-1104 | sessionsKey, nowTick 15s interval, sessionClusters, add-disjoint defaults + confirm (draft session insert into local state), dayTotalClockedMs, modalTitleText, buildDayTimeline items, day span, multi-day subtitle. |
| Split-state seeding + mutation handlers | 1106-1330 | splitByCluster/initialSnapshot seeding per sessionsKey, open-session boundary ticking, patchCluster, applyInnerBoundaryDragMs, openMergeJobChoiceForCluster, confirmMergeJobChoice, commitInnerBoundary. |
| NCNS action handlers | 1331-1462 | runRecordNcns (record_ncns_and_reject_sessions_for_day RPC), enterNcnsDialogFromSessions, forceClockOutOpenSessionsThenOpenNcns sweep, preclose continue/close, handleNcnsHeaderClick. |
| Layout toggle + strip gesture engine | 1464-1971 | layoutMode state + Visual/Form toggle JSX (1469-1519), then ~450 lines of pointer machinery: drag ctx refs, stable window listeners, pointermove mapping Y→ms, tap-to-add-split with move-threshold cancel, alt-click boundary jump, startDrag, handleStripPointerDown, unmount cleanup, arrow-key nudge (handleStripKeyDown). |
| Save gates | 1973-2017 | editorInitialized and canSave derivations (payload validity, mixed-cluster partition feasibility). |
| persistDirtyChangesAsync | 2019-2314 | ~300-line save decision tree: draft INSERT, note-only UPDATE, proportional-seed UPDATE, single-segment mixed partition, per-row persist, coalesced mixed partition, own_*/leader split/replace RPC selection via editingSelf + fenceOverridden; salary-sync toast. |
| Dirty computation + save/discard orchestration | 2316-2541 | effectiveDirtyIds/isOnlyProportionalSeed memo, closeTopmostSubFlow, requestSave (approved-hours confirm), discardConfirmOpen, requestDiscard/confirmDiscard, Escape handler. |
| Main modal JSX | 2543-3184 | Backdrop + dialog shell, header/title/subtitle, prior-week ack gate panel, loading/empty states, proportional-seed banner, timeline map rendering MyTimeDayClusterVisual/Form per cluster with ~25 wired props, add-disjoint '+' button, footer (Not-coming-in + NCNS buttons duplicated at 3009-3054 and 3113-3167, Cancel/Save). |
| Extracted sub-modal renders | 3185-3249 | MyTimeMergeSegmentsModal, AssignFocusModal, ForceClockOutModal, AdjustClockSessionTimesModal, AddDisjointSessionModal — thin wired renders. |
| Inline NCNS preclose dialog | 3250-3357 | Clock-out-open-sessions-first alertdialog with approved-hours warning + error slot. |
| Inline reject-session dialog | 3358-3477 | Reject confirm alertdialog: times line, approved-hours warning, error slot, busy states. |
| Inline NCNS dialog (3 phases) | 3478-3770 | simple / approved_warn / approved_confirm phases with details textarea, payroll-ack checkbox, error slot. |
| Inline not-coming-in confirm dialog | 3771-3856 | Unpaid-day-off confirm dialog. |
| Inline discard-changes confirm dialog | 3857-3946 | Keep-editing / discard alertdialog shown by requestDiscard when dirty. |

### Extraction candidates (easiest/safest first)

1. **myTimeDayEditorDirty (kernel: buildPayloads + dirty/compare helpers)** — kernel, ~140 lines, low risk, unit-testable → `src/lib/myTimeDayEditorDirty.ts`
   - Inputs: DayEditorSession / SplitEditorState types from myTimeDayTimeline; no React. Exports buildPayloads, singleSegmentTimesMatchSession, stripJobBidForSegmentRpc, noteOnlyApprovedSafe, comparableSplit, listDirtyClusterIds, sessionJobBidKey, listClustersDirtyFromJobBidChange.
   - Notes: Stage A per playbook — module-level pure functions at lines 129-242, zero closure captures, currently untested. Colocate myTimeDayEditorDirty.test.ts (payload validity edges: blank notes, MIN_SEGMENT_MS, open-last segment; dirty detection incl. job/bid-only change). persistDirtyChangesAsync, canSave, and resolveAssignSessionForSegment all call these, so extract before touching those.
2. **MyTimeDiscardChangesDialog** — component, ~90 lines, low risk → `src/components/my-time-day-editor/MyTimeDiscardChangesDialog.tsx`
   - Inputs: personLabel, dateStr, onKeepEditing, onDiscard
   - Notes: Lines 3857-3946. Pure leaf alertdialog, no busy states, four props. Easiest component win; matches MyTimeMergeSegmentsModal sibling naming.
3. **MyTimeNotComingInConfirmDialog** — component, ~88 lines, low risk → `src/components/my-time-day-editor/MyTimeNotComingInConfirmDialog.tsx`
   - Inputs: busy, onCancel, onConfirm
   - Notes: Lines 3771-3856. Leaf confirm dialog; keep the literal purple accent hexes (#6b21a8/#f3e8ff/#e9d5ff — saturated action colors are allowed literal per CLAUDE.md).
4. **MyTimeRejectSessionDialog** — component, ~122 lines, low risk → `src/components/my-time-day-editor/MyTimeRejectSessionDialog.tsx`
   - Inputs: session (DayEditorSession), dateStr, busy, error, onCancel, onConfirm(session)
   - Notes: Lines 3358-3477. Confirm/error/busy fully parent-owned; dialog is presentational. Reject mutation handlers (464-527) stay in parent.
5. **MyTimeNcnsPrecloseDialog** — component, ~110 lines, low risk → `src/components/my-time-day-editor/MyTimeNcnsPrecloseDialog.tsx`
   - Inputs: openSessions (DayEditorSession[]), busy, error, onCancel, onContinue
   - Notes: Lines 3250-3357. Leaf alertdialog; force-clock-out sweep logic stays in parent.
6. **MyTimeNcnsDialog (3-phase)** — component, ~295 lines, low risk → `src/components/my-time-day-editor/MyTimeNcnsDialog.tsx`
   - Inputs: phase ('simple'|'approved_warn'|'approved_confirm'), personLabel, dateStr, details + onDetailsChange, payrollAck + onPayrollAckChange, busy, error, onCancel, onBack, onAdvanceToConfirm, onRecord
   - Notes: Lines 3478-3770. Biggest single JSX block left. Controlled component: ncnsUi/ncnsDetails/ncnsPayrollAck state stays in parent (closeTopmostSubFlow and reset-on-dateStr effects read them). NCNS_DETAILS_MAX_LEN constant moves with it.
7. **MyTimeEditorFooterAttendanceButtons** — component, ~60 lines, low risk → `src/components/my-time-day-editor/MyTimeEditorFooterAttendanceButtons.tsx`
   - Inputs: showNotComingIn, notComingInBusy, onNotComingIn, showNcns, ncnsEnabled, ncnsTitle, ncnsBusyLike (saving/ncnsBusy/precloseOpen), onNcnsClick, saving
   - Notes: The Not-coming-in + NCNS button pair is duplicated verbatim at 3009-3054 (editable footer) and 3122-3167 (read-only/empty footer) — ~110 duplicated lines collapse to one ~90-line component used twice, net ~-60 in parent. Behavior-preserving dedupe of identical JSX, not a redesign.
8. **useMyTimeJobBidLabels** — hook, ~100 lines, low risk → `src/components/my-time-day-editor/useMyTimeJobBidLabels.ts`
   - Inputs: sortedSessions, jobLabels, bidLabels, prefixMap, resetKey ({effectiveSubjectUserId, dateStr}); returns { mergedJobLabels, mergedBidLabels }
   - Notes: Lines 875-970: extraJobLabels/extraBidLabels state + RPC-backed label fetch effect + merge memos. Fully self-contained (only reads sortedSessions and the label props); sibling hook precedent: useMyTimeCompactMergeMedia. Preserve the JSON.stringify-serialized deps quirk and the fallback 'Job xxxxxxxx…' labels.
9. **useMyTimeSalaryStripPrefetch** — hook, ~118 lines, medium risk → `src/components/my-time-day-editor/useMyTimeSalaryStripPrefetch.ts`
   - Inputs: enabled (prefetchSalarySessionsWhenEmpty), sessionsPropLength, sessionsLoading, fetchedSessions, inSaveableRange, effectiveSubjectUserId, dateStr, showToast, onSynced (bump sessionsFetchNonce); returns { busy, stripEmptyDayHint, stripTimeOffLabel }
   - Notes: Lines 649-652 + 678-790: the salary template/override/time-off probe + resolveCalendarWorkday + syncSalaryClockSessionsForUserDay effect, its done-key ref, and the clear-hint-on-sessions effect (788-790). Medium only because it writes three parent-read states and bumps the fetch nonce — return values + one callback keep the seam clean.
10. **persistMyTimeDayDirtyClusters** — kernel, ~300 lines, medium risk, unit-testable → `src/lib/persistMyTimeDayDirtyClusters.ts`
   - Inputs: dirtyClusterIds, sessionClusters, splitByCluster, nowMs, ctx { editingSelf, fenceOverridden, effectiveSubjectUserId, dateStr, peopleHoursGridProportionalSeed, rpcs { runSplitSeg, runSplitCluster, runReplaceMixed } }; returns { showSalarySyncToast } or throws DatabaseError
   - Notes: Lines 2019-2314 minus setError/showToast (parent keeps the catch + toast). Follows the exact precedent of src/lib/persistMyTimeClusterForSegmentAssign.ts (async DB module in lib, RPC fns injected). No React in the body — every branch already routes through tested kernels (myTimeDaySavePlan, myTimeMixedClusterSingleSegmentPartition). Unit-test the branch *selection* by injecting fake supabase-call wrappers, or at minimum test error-message construction; the RPC-choice ternaries (editingSelf && !fenceOverridden) must move verbatim — this is prod payroll data. resolveAssignSessionForSegment shares the rpcs-selection triple; extract a tiny pickMyTimeSplitRpcs(editingSelf, fenceOverridden) helper in the same file and use it from both.
11. **useMyTimeStripGestures** — hook, ~420 lines, high risk → `src/components/my-time-day-editor/useMyTimeStripGestures.ts`
   - Inputs: allowTimelineEdits, saving, layoutMode, sessionClustersRef-equivalent (pass sessionClusters + nowTick; hook keeps its own refs), splitByCluster + setSplitByCluster, patchCluster, applyInnerBoundaryDragMs (or move it in too); returns { stripRefs, focusedHandle, setFocusedHandle, startDrag, handleStripPointerDown, handleStripKeyDown, cancelBoundaryDrag, cancelStripTapGesture }
   - Notes: Lines 1522-1971 (drag ctx, stable window listeners via mutable refs, pointer-move Y→ms mapping, tap-to-split with snap, alt-click boundary jump, layoutMode reset effect at 1785-1789, unmount cleanup at 1914-1944) plus module constants STRIP_TAP_MOVE_THRESHOLD_PX, MY_TIME_BOUNDARY_DRAG_BODY_CLASS, StripTapSession type, and applyInnerBoundaryDragMs/commitInnerBoundary (1183-1205, 1312-1329) which only the gestures use. High risk: 6+ mutable refs mirroring state, window-level listeners whose add/remove pairing depends on stable identities, body-class side effects, and closeTopmostSubFlow needs cancelBoundaryDrag/cancelStripTapGesture back from the hook. Do last, in one careful PR, manual visual verification of drag/tap/alt-click/Escape on both layouts.

### Suggested PR sequence

1. PR 1: Stage A — extract myTimeDayEditorDirty kernel (~140 lines) to src/lib with tests. Safest possible start (module-level pure functions, no closures), and canSave/persist/assign all depend on it, so it must land before any component/persist move.
2. PR 2: extract MyTimeDiscardChangesDialog (~90 lines). Smallest leaf dialog, zero busy/error wiring — validates the dialog-extraction seam.
3. PR 3: extract MyTimeNotComingInConfirmDialog (~88 lines). Same shape as PR 2.
4. PR 4: extract MyTimeRejectSessionDialog (~122 lines). Adds busy/error props but handlers stay in parent.
5. PR 5: extract MyTimeNcnsPrecloseDialog (~110 lines). Same pattern.
6. PR 6: extract MyTimeNcnsDialog (~295 lines). Biggest dialog; fully controlled so the parent's phase/reset/closeTopmostSubFlow logic is untouched.
7. PR 7: extract MyTimeEditorFooterAttendanceButtons (~60 net lines). Collapses the verbatim-duplicated NCNS/Not-coming-in button pair used in both footers.
8. PR 8: extract useMyTimeJobBidLabels hook (~100 lines). Self-contained label-fetch effect; low coupling, returns two memos.
9. PR 9: extract useMyTimeSalaryStripPrefetch hook (~118 lines). Self-contained salary-sync effect; needs the onSynced nonce callback seam.
10. PR 10: extract persistMyTimeDayDirtyClusters to src/lib (~300 lines) with pickMyTimeSplitRpcs helper reused by resolveAssignSessionForSegment; add branch-selection tests with injected RPC fakes. Done after PR 1 so buildPayloads/noteOnlyApprovedSafe are already importable.
11. PR 11: extract useMyTimeStripGestures hook (~420 lines). Last because of ref/window-listener coupling and the closeTopmostSubFlow ↔ cancel-gesture dependency; requires manual drag/tap/keyboard verification in the preview browser.

### Risks & gotchas

- No render-test harness: every dialog/hook move (PRs 2-9, 11) can only be verified by typecheck/lint plus manual checks in the signed-in preview browser — and that session is prod, so save-path testing must be done on a scratch day/user or read-only.
- persistDirtyChangesAsync writes prod payroll data (clock_sessions, people_hours via RPCs). The own_* vs leader RPC selection (editingSelf && !fenceOverridden) and every branch guard must move verbatim; a wrong branch silently reroutes around the week fence or drops the approved-hours re-approval flow.
- The gesture engine (PR 11) relies on mutable refs (splitByClusterRef, sessionClustersRef, nowTickRef, dragRef, stripTapSessionRef) and stable window-listener identities; moving it risks stale-closure bugs and leaked pointer captures. closeTopmostSubFlow must keep calling the hook's cancel functions in the same priority order.
- closeTopmostSubFlow's dismissal priority (not-coming-in > ncns > preclose > merge > assign > reject > forceClockOut > adjustTimes > addDisjoint > drag > tap) is behavior users depend on for Escape/backdrop; dialog extractions must not change which state gates which dialog.
- The splitByCluster seeding effect intentionally depends only on sessionsKey (eslint-disable) so job/bid refreshes do not wipe in-editor splits — any extraction touching nearby code must preserve that exact dependency quirk.
- The job/bid label effect uses JSON.stringify(jobLabels) as a dep on purpose; keep it when hookifying or risk refetch loops.
- Literal saturated hexes (#3b82f6, #b45309, #dc2626, #6b21a8, #f3e8ff, #fcd34d, #fecaca, #f59e0b) are allowed action/status colors — do not 'fix' them to tokens during moves, and do not introduce raw neutral hexes (CI theme check).
- This modal is mounted from 12+ call sites (Dashboard, People, PeopleReviewTab, quickfill, userReview sections); the Props contract must not change in any PR.

---

## src/pages/Bids.tsx — 3,791 → ~2,150 lines

Bids.tsx is the tab-switched Bids page parent, already decomposed from ~18,800 lines (all 14 workflow tabs are extracted components per docs/BIDS_TABS_ARCHITECTURE.md). What remains is the page's shared substrate: the shared-bid selection pointer (setSharedBid/selectBidAndSyncUrl), the URL deep-link router with per-tab pending-refs, the useBidPricingEngine/useBidPricingRows seams (destructure + prop-threading), master-data loaders (role, service types, bids, customers, contacts, fixture types), the BidFormModal controller (saveBid/saveBidAndOpenCounts/deleteBid, service-type-switch/duplicate, bid-date-sent attestation flow), a large duplicated tab-navigation chrome, and six page-level modals rendered inline (attestation, delete-confirm, notes quick-edit, evaluate checklist, two call-script modals, materials-model switch).

**Already extracted:** All 14 workflow tabs: BidsBidBoardTab (+BidBoardEstimatingHealthSection), BidsBuilderReviewTab, BidsWorkingBoard, BidsBidCostsTab, BidsEstimatorsTab, BidsCountsTab, BidsTakeoffTab, BidsLaborTab, BidsPricingTab, BidsCoverLetterTab, BidSubmissionFollowupTab, BidRfiTab, BidChangeOrderTab, BidLienReleaseTab. Also: useBidPricingEngine + lib/bids/bidPricingEngineTypes, useBidPricingRows, useBidEditForm, BidFormModal, WorkingBoardArchiveConfirmDialog, BidPartyDetailModal, BidVersionPicker, MyBidsToggle, ModalShell, lib/bidDocuments/{approvalPdf,pricingPage,costEstimatePage,takeoffBreakdown,coverLetter}, lib/bids/{submissionSections,submissionHides,bidFormatting,bidStyles,bidContactInfo} — do not re-propose any of these.

### Internal structure

| Section | Lines | What it is |
|---|---|---|
| Imports + module types/constants | 1-162 | Imports (1-71); BID_DATE_SENT_ATTESTATION_NULLS map (78-97); ServiceType/EvaluateChecklistItem types (99-114); evaluateChecklist content constant (116-162) |
| Hooks + role/service-type/fixture state + fixture helpers | 164-238 | Context hooks, myRole/loading/error/activeTab, service-type + fixture-type state; getFixtureTypeIdByName + getOrCreateFixtureTypeId (auto-create fixture type, supabase insert) |
| Master data + bid-form + attestation state | 240-323 | bids/customers/contacts state; BidFormModal state (editingBid, savingBid, delete state, evaluate/script modal flags); onlyMyBids/isMyBid; bid-date-sent attestation state block (274-288); useBidEditForm destructure (290-320); notes-modal state (321-323) |
| Selections + deep-link state + apply* callbacks | 325-510 | 8 selectedBidFor* pointers; submission/bid-board/builder-review/working deep-link highlight state + refs; applyBidBoardDeepLinkToBid (388-415), applySubmissionFollowupDeepLinkToBid (417-435), applyBuilderReviewDeepLinkFromBid (443-470); working-board archive-confirm state (472-485) |
| useBidPricingEngine destructure | 512-594 | ~80-symbol destructure of the pricing-engine hook (state, setters, loaders) fed by the 4 engine selections |
| Cover-letter maps + shared-bid pointer | 597-638 | 8 coverLetterXxxByBid maps (shared with downloadApprovalPdf); setSharedBid / closeSharedBidAndClearUrl / selectBidAndSyncUrl (hoisted function declarations referenced by the hook call above) |
| Small effects + master loaders | 644-965 | Tick/watermark/bid-form-focus effects (644-698); loadRole (702-741), loadEstimatorUsers, loadCustomers, loadServiceTypes, loadFixtureTypes, loadBids (834-879), archiveWorkingBoardBid + promptArchiveWorkingBoardBid + Esc effect (881-941), loadCustomerContacts, loadCustomerContactPersons |
| downloadApprovalPdf wrapper | 1002-1020 | Thin wrapper resolving bid + priceBookVersions + serviceTypes + the 8 cover-letter values into ApprovalPdfContext (Stage A already done) |
| URL deep-link router | 1045-1370 | loadRole effect; lostSummary deep-link effect (1049-1066); BIDS_TABS const; the big tab/bidId router effect (1070-1252) incl. role redirects + cross-service-type fetch; 4 pending-deep-link retry effects (1254-1319); timeout cleanup (1321-1332); OPEN_BID_EDIT_QUERY effect (1334-1370) |
| Bulk-load + scroll + shared cost-estimate effects | 1372-1501 | Role-gated initial load; service-type-change reload; builder-review all-trades reload; contact-scroll + labor-direct-costs-scroll effects (1431-1458); shared cost-estimate loader effect gated on labor\|\|takeoffs (1462-1501, writes costEstimateDistanceInput) |
| BidFormModal controller handlers | 1504-1682 | openNewBid / openNewBidWithCustomer / openEditBid / clearBidDateSentAttestationFlow / closeBidForm; saveLossReasonFromLostSummaryModal; refreshBidServiceTypeSwitchSiblings / duplicateBidToServiceTypeHandler / openExistingBidFromServiceTypeSwitch |
| Bid-date-sent attestation logic | 1683-1837 | getBidDateSentAttestationPayloadMerge, validateBidDateSentAttestationForSave, promptBidDateSentAttestationIfNeeded, input change/blur handlers, cancel/confirm modal handlers, insertPendingBidSentFollowupSubmissionNoteAfterSave |
| Outcome note + save/delete handlers | 1839-2162 | insertOutcomeChangeBidNoteAfterSave; handleLastContactClick; saveBid (1882-1986) and saveBidAndOpenCounts (1988-2110) with ~50-line near-duplicate payload builders (the second omits account_manager_id — a quirk to preserve); saveBidSubmissionQuickAdd; deleteBid; saveNotesModal |
| Derived data + tab-bar building blocks | 2164-2409 | openGcBuilderOrCustomerModal; working-board memos (2181-2199); tab-bar style objects + working/bid-costs/estimators tab-button JSX fragments (2201-2342); useBidPricingRows call; getGcBuilderPhone/Email; viewing-party derived bid lists; visibleServiceTypes |
| Guards + page chrome render | 2411-2900 | Loading/access guards; error banner; materials-model switch modal (2445-2517); service-type toggle + primary tabs + New Bid grid (2520-2663); duplicated no-service-type primary tabs + workflow tab row (2665-2900) — the largest remaining inline JSX block (~480 lines, heavily duplicated narrow/wide variants) |
| Extracted-tab thin wrappers | 2902-3382 | WorkingBoardArchiveConfirmDialog + the 14 tab wrappers incl. 3 BidVersionPicker renders and the giant BidsTakeoffTab/BidsLaborTab/BidsPricingTab prop lists (this prop-threading is the intended cost of the engine seam; stays) |
| BidFormModal + page-level modals | 3384-3790 | BidFormModal wrapper (3385-3426); Bid Sent Attestation modal JSX (3428-3560, ~132 lines); delete-bid confirm modal (3564-3603); notes quick-edit modal (3606-3635, note: nothing appears to set notesModalBid to a bid anymore — verify before moving, may be dead); 2 BidPartyDetailModal renders (3638-3668); Evaluate checklist modal (3671-3734); Sent Bid Script + Bid Question Script modals (3737-3785) |

### Extraction candidates (easiest/safest first)

1. **BidScriptModals** — component, ~55 lines, low risk → `src/components/bids/BidScriptModals.tsx`
   - Inputs: showSentBidScript, showBidQuestionScript, onCloseSent, onCloseQuestion (open flags stay in the parent — they are set via callbacks passed to BidSubmissionFollowupTab)
   - Notes: Lines 3737-3785: two static-content script modals. Pure JSX move; hardcoded script text moves with the component. Zero shared state.
2. **BidEvaluateChecklistModal** — component, ~120 lines, low risk → `src/components/bids/BidEvaluateChecklistModal.tsx`
   - Inputs: open, onClose (evaluateModalOpen stays in the parent — opened via onOpenEvaluateChecklist callback from BidsBidBoardTab); the component owns evaluateChecked state and the evaluateChecklist content constant (module lines 110-162 move with it)
   - Notes: Modal JSX 3671-3734 + evaluateChecklist const 116-162 + evaluateChecked state. Checked state resets on open/close — preserve the reset-on-open behavior (parent currently does setEvaluateChecked({}) before opening).
3. **BidDeleteAndNotesModals** — component, ~80 lines, low risk → `src/components/bids/BidDeleteConfirmModal.tsx`
   - Inputs: Delete modal: open, editingBid, deleting, error, onDelete, onCancel; confirm-text state moves into the child. Notes modal: bid, onClose, onSaved (or drop if dead)
   - Notes: Delete-confirm modal 3564-3603 (deleteConfirmProjectName can move into the child if BidFormModal only needs a reset callback — verify setDeleteConfirmProjectName prop usage in BidFormModal first). The notes quick-edit modal 3606-3635 appears orphaned (nothing in the parent sets notesModalBid to a bid) — grep before moving; if dead, delete in its own tiny PR instead of extracting.
4. **buildBidSavePayload** — kernel, ~100 lines, low risk, unit-testable → `src/lib/bids/bidSavePayload.ts`
   - Inputs: bidForm.values, bidDateSent, editingBid (bool + role gate for bid_number), myRole flags, includeAccountManager flag
   - Notes: Dedupes the ~50-line near-identical payload objects in saveBid (1900-1931) and saveBidAndOpenCounts (2006-2036). CRITICAL quirk: saveBidAndOpenCounts's payload omits account_manager_id — preserve via a flag, do not 'fix'. Pure data-shaping, ideal vitest target (trim/null coercion, number parsing, outcome normalization).
5. **bidDateSentAttestation kernel** — kernel, ~90 lines, low risk, unit-testable → `src/lib/bids/bidDateSentAttestation.ts`
   - Inputs: bidDateSent, savedBaseline, editingBid.bid_date_sent, pendingAttestation + pendingAttestationForDate; plus BID_DATE_SENT_ATTESTATION_NULLS (moves here from module scope, lines 78-97)
   - Notes: Stage A for the attestation flow: pure decision logic from getBidDateSentAttestationPayloadMerge (1683-1696), validateBidDateSentAttestationForSave (1698-1708), the should-prompt predicate inside promptBidDateSentAttestationIfNeeded, and buildAttestationPayload from confirmBidSentAttestationModal (1787-1796). Uses existing normalizeBidDateInput. Unit-test date-change/revert/pending-match branches.
6. **BidSentAttestationModal + useBidDateSentAttestation** — component, ~300 lines, medium risk → `src/components/bids/BidSentAttestationModal.tsx`
   - Inputs: Hook (src/hooks/useBidDateSentAttestation.ts) owns: bidDateSent, savedBidDateSentRef, 3 ack flags + 3 ack timestamps, pending payload/date, followup-note draft, modal-open flag; returns handleBidDateSentInputChange/Blur, promptIfNeeded, validateForSave, getPayloadMerge, clearFlow, pendingFollowupNote. Modal takes open/ack state/estimatorUsers/authUser/confirm/cancel from the hook
   - Notes: Stage B after the kernel: modal JSX 3428-3560 (~132 lines) + state block 274-288 + handlers 1710-1812. saveBid/saveBidAndOpenCounts and openNewBid/openEditBid/closeBidForm all call into the flow, so the hook return must cover prompt/validate/merge/clear. BidFormModal also receives bidDateSent + handlers + pending values as props — thread from the hook unchanged.
7. **BidsTabsNav** — component, ~560 lines, medium risk → `src/components/bids/BidsTabsNav.tsx`
   - Inputs: activeTab, onSelectTab(tab) (parent impl: setActiveTab + setSearchParams — one callback replaces 14 identical inline onClicks), visibleServiceTypes, selectedServiceTypeId, onSelectServiceType (parent adds closeSharedBidAndClearUrl), myRole (bid-costs dev gate, superintendent hides pricing/cover-letter/submission), narrowViewport640, workingInboxCount, onNewBid
   - Notes: The biggest win: style objects + tab-button fragments (2201-2342) + service-type/primary-tab grid (2520-2663) + duplicated no-service-type variant and workflow tab row (2665-2900). ~4x-duplicated Bid Board/Builder Review button JSX collapses naturally but keep it a mechanical move first (dedupe within the child is fine — output DOM unchanged). useWorkingBoardInboxCount call and badge can move into the child (parent doesn't use inboxCount elsewhere — verify). Uses existing tabStyle/bidsTabStyle from lib/bids/bidStyles; keep the red badge hex (saturated status color, allowed).
8. **useBidsMasterData** — hook, ~280 lines, medium risk → `src/hooks/useBidsMasterData.ts`
   - Inputs: authUser, activeTab, selectedServiceTypeId + setter, setError; engine loaders needed by the bulk-load effects (loadTakeoffBookVersions, loadLaborBookVersions, loadTemplatePriceBookVersions, loadMaterialTemplates) passed in as callbacks
   - Notes: The proven use<Page><Engine> seam pattern: myRole + role service-type-id state, serviceTypes/fixtureTypes, bids/customers/contacts/contactPersons/estimatorUsers/lastContactFromEntries state, loadRole/loadServiceTypes/loadFixtureTypes/loadBids/loadCustomers/loadCustomerContacts/loadCustomerContactPersons/loadEstimatorUsers (702-965) and the three role-gated bulk-load effects (1372-1416). Parent destructures the return so downstream references are unchanged. Ordering hazard: useBidPricingEngine takes loadBids as input — the new hook must be called before it; loadBids becomes a stable callback rather than a hoisted function declaration.
9. **useWorkingBoardArchive** — hook, ~110 lines, low risk → `src/hooks/useWorkingBoardArchive.ts`
   - Inputs: authUser, myRole, bids, loadBids, setEditingBid, showToast
   - Notes: The 'working cleanup' the architecture map still lists as remaining: archiveWorkingBoardBid + promptArchiveWorkingBoardBid + confirm state + Esc effect (472-485, 881-941) + the three workingBoard* memos (2181-2199). Returns state + handlers for WorkingBoardArchiveConfirmDialog, BidFormModal's archive button, BidsWorkingBoard props, and BidsBidBoardTab's workingBoardArchivedBids prop.
10. **useBidsDeepLinkRouter** — hook, ~330 lines, high risk, unit-testable → `src/hooks/useBidsDeepLinkRouter.ts`
   - Inputs: location.search, setSearchParams, navigate, bids, serviceTypes.length, selectedServiceTypeId + setter, myRole, authUser, setActiveTab, setSharedBid, the four apply*DeepLink callbacks + their highlight state/refs, openNewBid, openEditBid, showToast
   - Notes: Lines 1045-1370: lostSummary effect, the big tab/bidId router, 4 pending-retry effects, timeout cleanup, OPEN_BID_EDIT_QUERY effect, plus the apply* callbacks and highlight state (342-485). The playbook says the router stays in the parent for tab extractions — since those are done, moving it to a page-scoped hook is the only way to shrink it further, but the effect graph is timing-sensitive (pending refs, cross-service-type fetch-and-switch, role redirects). Do last, after everything else is stable. Optional Stage A first: promote the duplicated outcome→sectionKey mapping (388-401 and 417-431) into lib/bids/submissionSections.ts with a test.

### Suggested PR sequence

1. PR 1: extract BidScriptModals (~55 lines) — smallest, zero-coupling static modals; validates the residual-extraction pass cheaply.
2. PR 2: extract BidEvaluateChecklistModal (~120 lines incl. the module-level checklist constant) — leaf modal, one open-flag prop; checked-state moves in.
3. PR 3: extract BidDeleteConfirmModal (~40 lines) and resolve the notes quick-edit modal (extract or delete-if-dead after grep, ~30 lines) — leaf modals with clear props.
4. PR 4 (Stage A): add lib/bids/bidSavePayload.ts kernel + tests (~100 duplicated lines collapse to one tested function) — must preserve the account_manager_id omission quirk in saveBidAndOpenCounts.
5. PR 5 (Stage A): add lib/bids/bidDateSentAttestation.ts kernel + tests — pure prompt/validate/merge/payload decisions behind unit tests before any UI moves.
6. PR 6 (Stage B): extract BidSentAttestationModal + useBidDateSentAttestation hook (~300 lines) — consumes the PR 5 kernel; saveBid/openEditBid/BidFormModal keep working through the hook's returned handlers.
7. PR 7: extract BidsTabsNav (~560 lines, biggest single win) — presentational chrome with a single onSelectTab callback; verify narrow/wide + role-gated variants visually in the preview browser (no render tests exist).
8. PR 8: extract useBidsMasterData hook (~280 lines) — the seam pattern proven by useBidPricingEngine; parent destructures the return so downstream references are unchanged; mind the loadBids-into-engine call order.
9. PR 9: extract useWorkingBoardArchive hook (~110 lines) — closes the 'working cleanup' item still open in BIDS_TABS_ARCHITECTURE.md.
10. PR 10 (last, optional): extract useBidsDeepLinkRouter (~330 lines) — highest risk; only after PRs 1-9 are green and stable, ideally preceded by a tiny Stage-A PR promoting the duplicated outcome→sectionKey mapping into lib/bids/submissionSections.ts with a test.

### Risks & gotchas

- No render-test harness: every component move (especially BidsTabsNav and the modals) can only be verified by typecheck/lint plus manual checks in the preview browser, which holds the user's signed-in PROD session — verify read-only, do not exercise saves against prod data.
- Hoisting trap: setSharedBid and loadBids are function declarations referenced by the useBidPricingEngine call ABOVE their definitions (lines 583-594 vs 608/834). Converting them to consts or moving them into hooks changes evaluation order — useBidsMasterData must be wired before the engine hook call.
- saveBid vs saveBidAndOpenCounts payloads differ deliberately (no account_manager_id in the counts path). The dedupe kernel must encode this quirk or it silently changes which user is stamped as account manager on save-and-open-counts.
- The deep-link router (1045-1370) is timing-sensitive: pending-bid refs, retry effects keyed on bids arriving, cross-service-type fetch-and-switch, and role-based redirects. Extracting it can reorder effect execution; it is intentionally last and optional.
- BidFormModal receives ~15 attestation/delete-related props from this file; the attestation hook extraction (PR 6) must keep that prop contract byte-identical or touch BidFormModal in the same PR (making the diff larger than a pure move).
- The notes quick-edit modal (3606-3635) looks dead (nothing sets notesModalBid) — confirm with a repo-wide grep before extracting; deleting dead code is a separate behavior-neutral PR, not part of an extraction.
- docs/BIDS_TABS_ARCHITECTURE.md declares Bids.tsx 'done' — each landed PR must update that map (and docs/RECENT_FEATURES.md per repo convention) so the doc does not drift from reality.
- Theme-token CI: moved JSX carries inline styles; keep existing var(--*) tokens and saturated action colors as-is — do not 'clean up' hexes during the move (node scripts/theme-tokenize.mjs --check src runs in CI).

---

## src/pages/Prospects.tsx — 3,373 → ~1,000 lines

Prospects is a top-level tab-switched page for cold-outreach pipeline management. It has two top tabs — "Customers" (the prospect pipeline) and "Team" (already extracted to TeamProspectsTab) — and four sub-tabs under Customers: Follow Up (a one-prospect-at-a-time calling workstation with warmth counter, per-prospect calling locks, a session timer + time ledger, comments with quick-notes, notes editing, and copy/mailto email templates with placeholder substitution), Prospect List (search + warmth-bucketed desktop table / mobile cards with send-back/not-a-fit/delete actions), Convert (prospect → customer + contact persons + initial bids via NewCustomerForm), and Activity (dev/assistant-only 30-day team activity tables). It owns ~60 useState hooks, ~15 supabase loaders (prospects, prospect_comments, prospect_timer_events, prospect_callbacks, prospect_calling_locks, prospect_email_sent, user_prospect_copy_templates, user_prospect_quick_notes, app_settings), a URL router for ?tab= and ?prospect_id= deep links, and seven inline modals.

**Already extracted:** TeamProspectsTab (src/components/prospects/TeamProspectsTab.tsx — the whole top-level Team tab) plus lib kernels with tests: src/lib/teamProspectRanking.ts, src/lib/teamProspectSourceSummary.ts, src/lib/prospectTeamActivity.ts, src/lib/prospectTeamActivityChartData.ts, src/lib/prospectWarmthCounts.ts. Note: no docs/PROSPECTS_TABS_ARCHITECTURE.md exists yet — the playbook's Step-0 map must be written first.

### Internal structure

| Section | Lines | What it is |
|---|---|---|
| Imports | 1-10 | React, router, supabase, useAuth, ToastContext, NewCustomerForm, TeamProspectsTab, loadProspectTeamActivity |
| Module constants, icons, types | 12-91 | COPY_TEMPLATE_KEYS/LABELS + app_settings key maps, Envelope/EnvelopeCheck/Edit inline SVG icons, ProspectsTopTab/ProspectsTab/Prospect/ProspectComment types, PROSPECTS_TABS, DIDNT_ANSWER_MOVE_NEXT_KEY localStorage key, tabStyle |
| Pure formatter helpers | 93-154 | formatDateTime, formatDaysSince, formatDueBadge, formatInteractionType, formatTimerButtonName, formatTimerSeconds, formatWebsiteDisplay, getWebsiteHref — all pure, zero React |
| Pure copy-template functions | 156-224 | getBlankPlaceholderFields, getBlankFieldsForMail, substituteCopyPlaceholders — pure placeholder validation + substitution logic, zero React |
| State declarations | 226-351 | ~60 useStates grouped by feature: follow-up list/index/comments/timer, edit-modal fields, callback fields, prospect-list search/sections/selection, quick notes, timer-history + my-time modals, ledger seconds, convert form, new-prospect fields, copy-template defaults/overrides/editing, activity teamDataByDate |
| URL tab router + tab setters | 353-423 | ?tab= router effect (team/activity access fallbacks), ?newProspect=true opener effect, setTab, openTeamTab |
| Data loaders | 425-647 | loadFollowUpProspects (locks-aware, prospect_id URL pinning), loadComments, loadTimerEvents, loadMyTimeStats, loadMyTimeToday, loadProspectListProspects, loadCopyTemplates, loadPersonPhone, loadQuickNotes |
| Per-tab load effects + notes/copy handlers | 649-1056 | boot + per-tab load effects; saveFollowUpNotes/cancel; getResolvedCopyText/Subject, handleCopyTemplate, handleOpenMail, openEditCopyModal, saveCopyTemplate; convert prefill effects; email-sent + ledger loaders/effects; loadTeamActivity; loadScheduledCallback; calling-lock acquire/release effect; follow-up session timer effects; comment textarea autoresize; didnt-answer preference load |
| Action handlers | 1058-1532 | updateUrlProspectId, warmth +/-/reset, edit-modal open/save/delete, callback open/save, saveTimerEvent, handleNoLongerFit, handleCantReach, handleSendBack/NotAFit/Delete from list, handleDidntAnswer/Answered/AddComment, quick-note add/delete/click, handleNextProspect, list section toggle/select, getEffectiveMasterId, saveNewProspect, handleConvertSubmit |
| Access gates + early returns | 1534-1556 | canAccessFollowUp role gate, authLoading return, estimator-without-access return |
| Top tab bars + Team tab | 1558-1637 | Customers/Team top row, Follow Up\|Prospect List\|Convert\|Activity sub-tab bar, New Prospect button, <TeamProspectsTab> render (already extracted) |
| Follow Up tab render | 1639-2171 | warmth/edit/callback/fit-status button groups + three timers (1651-1807), comments section with Didn't Answer/Answered + quick notes (1809-1969), info card + notes editor + copy-template buttons row (1971-2131), didnt-answer-move-next pref + my-time link (2133-2169) |
| Prospect List tab render | 2173-2462 | search input, inline IIFE that filters + buckets by warmth/not-a-fit/cant-reach + sorts (2194-2243), collapsible warmth sections with desktop table and mobile cards + row actions |
| Convert tab render | 2464-2669 | prospect selector + summary, NewCustomerForm (pre-filled), contact-person cards, bid cards, convert submit row |
| Activity tab render | 2671-2725 | 30-day date loop rendering per-day team marked/updated tables from teamDataByDate |
| Edit prospect modal | 2727-2853 | 6-field edit form + delete button; serves both Follow Up current prospect and list rows (editingProspect) |
| Callback modal | 2855-2930 | date/time/note fields → prospect_callbacks insert |
| Copy template edit modal | 2932-3066 | subject + body editor with placeholder-chip insertion at cursor via copyTemplateTextareaRef |
| Copy blank fields modal | 3068-3111 | lists blank placeholder fields blocking copy/mail |
| Timer history modal | 3113-3185 | last 100 prospect_timer_events table (self-loads via loadTimerEvents) |
| My time modal | 3187-3264 | today/yesterday/7-day/lifetime stats + live session bonus from followUpTimerSeconds |
| New Prospect modal | 3266-3370 | 6-field create form → saveNewProspect (getEffectiveMasterId owner resolution) |

### Extraction candidates (easiest/safest first)

1. **prospectFollowUpFormat (+ prospectTypes)** — kernel, ~105 lines, low risk, unit-testable → `src/lib/prospectFollowUpFormat.ts`
   - Inputs: none — pure functions of (iso string | null), seconds, url strings
   - Notes: Stage A. Move formatDateTime, formatDaysSince, formatDueBadge, formatInteractionType, formatTimerButtonName, formatTimerSeconds, formatWebsiteDisplay, getWebsiteHref (lines 93-154) with a colocated test. In the same PR move the Prospect and ProspectComment types (lines 55-81) to src/lib/prospectTypes.ts — every later component extraction imports them, so this unblocks the whole sequence. Also write docs/PROSPECTS_TABS_ARCHITECTURE.md (playbook Step 0) in this PR.
2. **prospectCopyTemplates kernel** — kernel, ~115 lines, low risk, unit-testable → `src/lib/prospectCopyTemplates.ts`
   - Inputs: template/subject strings, {name,email}, Prospect, personPhone, CopyTemplateKey, ProspectComment[]
   - Notes: Stage A. Move COPY_TEMPLATE_KEYS/LABELS, APP_SETTINGS_KEYS, APP_SUBJECT_SETTINGS_KEYS, CopyTemplateKey type (12-31) plus getBlankPlaceholderFields, getBlankFieldsForMail, substituteCopyPlaceholders (156-224). Placeholder-substitution and blank-field-detection rules (including the _______ per-template special cases) are exactly the decision logic the repo wants under unit tests.
3. **prospectListWarmthGroups kernel** — kernel, ~60 lines, low risk, unit-testable → `src/lib/prospectListWarmthGroups.ts`
   - Inputs: Prospect[], search query string
   - Notes: Stage A for the Prospect List tab. Lift the inline IIFE at 2194-2243: search filter over company/contact/phone/email, bucketing into warmth groups + NO_LONGER_FIT_KEY(-1)/CANT_REACH_KEY(-2), per-group last-contact-desc sort, and descending warmth key order. Export the sentinel keys so the tab component and the URL-select effect (683-687) share them. Distinct from existing prospectWarmthCounts.ts (used elsewhere for counts only).
4. **ProspectsActivityTab** — component, ~90 lines, low risk → `src/components/prospects/ProspectsActivityTab.tsx`
   - Inputs: none beyond mount (canAccess gating stays in parent render condition); moves teamDataByDate + teamLoading state and loadTeamActivity (965-982, 348-350) into the tab
   - Notes: Leaf tab, state used nowhere else, loader already lives in lib/prospectTeamActivity.ts. The parent keeps only the activeTab==='activity' && canAccessActivityTab gate. Classic first component win.
5. **ProspectsNewProspectModal** — component, ~150 lines, low risk → `src/components/prospects/ProspectsNewProspectModal.tsx`
   - Inputs: open, onClose, resolveMasterId (existing getEffectiveMasterId), authUserId, onCreated (parent reloads followUp + list)
   - Notes: Modal JSX 3266-3370 + the six new* field states (307-314) + newProspectError + saveNewProspect (1452-1488) move in; parent keeps newProspectModalOpen (opened from tab bar and from the ?newProspect=true deep-link effect) and passes it down. resolveMasterId prop mirrors the pattern already used for TeamProspectsTab.
6. **ProspectsTimeModals (timer history + my time)** — component, ~165 lines, low risk → `src/components/prospects/ProspectsTimeModals.tsx`
   - Inputs: timerHistoryOpen/myTimeOpen + onClose callbacks, authUserId, sessionBonusSeconds (followUpTimerSeconds when on follow-up)
   - Notes: Two sibling self-loading modals (3113-3185, 3187-3264) plus their state (281-288) and loaders loadTimerEvents (487-510) and loadMyTimeStats (512-538) — load on open inside the component. One-file-two-modals matches the JobFormDeleteMigrateModals precedent. followUpTimerSeconds stays in the parent (shared with the follow-up header timers) and arrives as sessionBonusSeconds.
7. **ProspectEditModal** — component, ~170 lines, medium risk → `src/components/prospects/ProspectEditModal.tsx`
   - Inputs: prospect (editingProspect ?? currentProspect), saving, onClose, onSave(fields), onDelete()
   - Notes: Modal JSX 2727-2853 + the six edit* field states (250-255), initialized from the prospect prop on open. saveEdit and handleDeleteProspect STAY in the parent — they mutate both shared lists (followUpProspects, prospectListProspects) and the current index/URL — and are passed as onSave/onDelete. openEditModal/openEditModalForProspect collapse to setting a parent editTarget.
8. **ProspectCallbackModal** — component, ~110 lines, low risk → `src/components/prospects/ProspectCallbackModal.tsx`
   - Inputs: open, prospect, authUserId, saving-free (owns its own saving), onClose, onSaved (parent re-runs loadScheduledCallback)
   - Notes: Modal JSX 2855-2930 + callbackDate/Time/Note state (258-260) + openCallbackModal defaulting + saveCallback insert (1174-1199). Only cross-tab touch is refreshing scheduledCallback in the parent — do it via onSaved callback.
9. **ProspectCopyTemplatesSection** — component, ~420 lines, medium risk → `src/components/prospects/ProspectCopyTemplatesSection.tsx`
   - Inputs: prospect (currentProspect), comments, authUser {id,email}, authUserName, showToast via context
   - Notes: The whole copy-template feature is used only inside Follow Up: buttons row (2074-2128) + edit modal (2932-3066) + blank-fields modal (3068-3111) + envelope icons (33-49) + state (317-346) + loaders loadCopyTemplates (570-613), loadPersonPhone (615-637), loadEmailSentTemplateKeys (902-919) + handlers 725-825. After the prospectCopyTemplates kernel PR this is mostly a cut/paste move. Email-sent set is per-prospect — reload inside on prospect.id change, same as today.
10. **ProspectsListTab** — component, ~360 lines, medium risk → `src/components/prospects/ProspectsListTab.tsx`
   - Inputs: prospects (prospectListProspects), loading, canAccess, saving, selectedProspect + onSelectProspect (navigates to follow-up, stays parent), onEditProspect, onSendBack, onNotAFit, onDelete, authUserId
   - Notes: Render 2173-2462 + search/sectionOpen/ledgerSecondsMap state (264-267, 295) + loadProspectLedgerSecondsMap (941-963, load-on-mount). prospectListProspects itself STAYS in the parent (written by edit/delete/send-back/cant-reach/notes handlers and read by Convert). The ?prospect_id select effect (676-694) also stays (URL router glue) — pass sectionOpen up or convert it to an initiallyOpenSection prop; simplest behavior-preserving option: keep selectedProspectForList + sectionOpen in the parent as controlled props.
11. **ProspectsConvertTab** — component, ~350 lines, medium risk → `src/components/prospects/ProspectsConvertTab.tsx`
   - Inputs: prospectListProspects, followUpProspects, defaultProspectId (currentProspect?.id), authUserId, navigate via hook, canAccess
   - Notes: Render 2464-2669 + convert* state (298-304) + effects 827-882 (first-interaction date, service types, contact prefill) + handleConvertSubmit (1490-1532). All convert state is tab-local; it only reads the two shared prospect arrays. The activeTab==='convert' load gates become mount effects inside the component.
12. **ProspectsFollowUpTab** — component, ~700 lines, high risk → `src/components/prospects/ProspectsFollowUpTab.tsx`
   - Inputs: followUpProspects + setFollowUpProspects, currentProspectIndex + setter, currentProspect, comments + loadComments, saving + setSaving, followUpTimerSeconds + reset, updateUrlProspectId, quickNotes + handlers, scheduledCallback, prospectLedgerSeconds, myTimeTodaySeconds, didntAnswerMoveNext + persist, openEditModal, openCallbackModal, openTimerHistory, openMyTime, canAccessFollowUp
   - Notes: Last and largest: render 1639-2171 plus the follow-up handler cluster (didnt-answer/answered/add-comment 1316-1384, warmth 1068-1091, no-longer-fit/cant-reach 1211-1265, next-prospect 1410-1421, quick notes 1386-1408, notes save 702-723). The shared substrate (followUpProspects list, currentProspectIndex, followUpTimerSeconds, saving, calling-lock effect 1011-1022, URL prospect_id router) is written by list/edit/new-prospect flows too, so consider a Step-2 seam first: src/hooks/useProspectFollowUpEngine.ts owning list+index+timer+lock+loaders, destructured by the parent and passed to both this tab and the list/edit callbacks. Without the hook the prop surface is ~25 props; with it, one engine object.

### Suggested PR sequence

1. PR 1: Step-0 map (docs/PROSPECTS_TABS_ARCHITECTURE.md) + extract prospectFollowUpFormat kernel and prospectTypes (~105 lines) — pure functions with tests; the shared Prospect/ProspectComment types unblock every later component move.
2. PR 2: extract prospectCopyTemplates kernel (~115 lines) — placeholder substitution + blank-field detection under unit tests before any copy UI moves (Stage A for the copy feature).
3. PR 3: extract prospectListWarmthGroups kernel (~60 lines) — filter/bucket/sort IIFE becomes a tested pure function; Stage A for the List tab.
4. PR 4: extract ProspectsActivityTab (~90 lines) — leaf tab with fully tab-local state; cheapest component win, validates the wrapper pattern.
5. PR 5: extract ProspectsNewProspectModal (~150 lines) — self-contained create form; parent keeps only the open flag (deep-link opener) and an onCreated reload callback.
6. PR 6: extract ProspectsTimeModals (~165 lines) — timer-history + my-time modals self-load on open; only prop coupling is sessionBonusSeconds.
7. PR 7: extract ProspectCallbackModal (~110 lines) — small modal, onSaved callback refreshes the parent's scheduledCallback.
8. PR 8: extract ProspectEditModal (~170 lines) — field state moves in; save/delete stay in parent as callbacks because they mutate both shared lists and the URL/index.
9. PR 9: extract ProspectCopyTemplatesSection (~420 lines) — buttons row + 2 modals + copy state/loaders; mostly cut/paste now that PR 2 holds the logic.
10. PR 10: extract ProspectsListTab (~360 lines) — controlled selection + sectionOpen from parent (URL glue stays), handlers passed down; uses PR 3 kernel.
11. PR 11: extract ProspectsConvertTab (~350 lines) — tab-local convert state and effects move wholesale; reads shared prospect arrays via props.
12. PR 12 (optionally 12a/12b): build useProspectFollowUpEngine hook seam, then extract ProspectsFollowUpTab (~700 lines) — the coupled cluster goes last per the playbook, after every satellite (modals, copy section, timers) is already out.

### Risks & gotchas

- Shared prospect arrays: followUpProspects and prospectListProspects are each read/written by handlers spanning Follow Up, Prospect List, Convert, edit/delete, send-back, and new-prospect flows — both must stay in the parent for the whole sequence; moving either into a tab breaks cross-tab consistency.
- URL deep-link coupling: ?tab= router (353-402), ?prospect_id= pinning inside loadFollowUpProspects (451-465), the prospect_id index-sync effect (884-890), the prospect-list select effect (676-694), and the ?newProspect=true opener all live in the parent and must not move (playbook rule).
- Calling-lock lifecycle: the acquire/release effect (1011-1022) keys on topTab/activeTab/currentProspect and its cleanup deletes the lock; handlers (no-longer-fit, cant-reach, next-prospect) also delete locks explicitly. Moving it into ProspectsFollowUpTab changes mount/unmount timing — verify lock release still fires on tab switch and prospect change.
- followUpTimerSeconds is shared substrate: rendered in the Follow Up header, reset by nav handlers, added as a live bonus in the My Time modal, and reset by the visibilitychange listener — it must stay parent-owned and be passed down, or the Stage-B diffs will silently change timing behavior.
- The shared saving flag serializes mutations across Follow Up buttons, list row actions, edit modal, and callback modal; extracted components must keep receiving it (or its setter) rather than minting their own, to preserve the mutual-exclusion behavior.
- prospect_timer_events queries use (supabase as any) casts — preserve them verbatim when moving loaders (behavior-preserving rule; fixing types is a separate pass).
- No render-test harness: component moves are verified only by typecheck/lint/manual smoke, so keep each Stage-B diff a pure cut/paste and land the three kernels (with tests) first.
- Raw hexes exist in the moved JSX (e.g. #3b82f6 buttons, #eff6ff selected row, #f3f4f6 row borders); saturated action colors are allowed but running scripts/theme-tokenize.mjs --check on new files may flag neutrals like #f3f4f6/#eff6ff — carry them over unchanged only if CI already passes on this file, otherwise tokenize in a separate non-refactor commit.

---

## src/pages/Banking.tsx — 3,104 → ~1,300 lines

Banking is the tab-switched money surface (dev + assistant/master-tech roles) over Mercury bank data and Stripe. It owns the URL-driven view router (product=mercury|stripe, seven Mercury sub-tabs, two Stripe sub-tabs, with per-role tab gating/normalization), the master mercury_transactions list engine (three loaders: 15k master fetch, unlabeled-only RPC, keyset-paginated labeled view, plus a tab-aware dispatcher and a seq-token race guard), the allocations/attribution data layer (person/user/job maps shared by five tabs), per-user accounting prefs (hide-labeled / apply-rules / approve-by-default synced to localStorage + banking_user_prefs), account and debit-card nickname CRUD, sync/backfill/CSV-import edge-function handlers, and two still-inline render surfaces: the Ledger tab and the User Sort (sorting) tab, both rendering a large embedded BankingMercuryTable component. Five Mercury tabs (Drag Sort, Accounting, User Review, Category Review, Reconciliation), both Stripe panels, and all nine modals are already extracted; the parent just wires props.

**Already extracted:** Extensive prior work: all five heavy Mercury tabs are extracted (src/components/banking/BankingMercuryDragSortTab, BankingMercuryAccountingTab, BankingMercuryUserReviewTab, BankingMercuryCategoryReviewTab, BankingMercuryReconciliationTab), both Stripe panels (src/components/BankingStripeInvoicesPanel, BankingStripeWebhookEventsPanel), nine modals (BankingAccountNicknamesModal, BankingDebitCardNicknamesModal, BankingDebitCardRecentTxModal, BankingSortingConfigModal, BankingUserCardLinkModal, MercuryBackfillModal, MercuryImportCsvModal, ManualAccountsModal, MercuryTransactionAllocationsModal), the org-notes disclosure suite (banking/MercuryTxNotesDisclosure), and ~20 tested lib kernels (bankingMercurySearch, bankingSortingConfig, bankingSortingCounts, bankingMercuryNotesSubRowColSpan, bankingAttributionOptions, bankingDragSortStorage, bankingUserPrefs, fetchMercuryTransactionRaws, fetchMercuryRelationsByTxIds, mercuryRawDebitCard, mercuryKindLabels, …). What remains inline: the URL view parser, two dropdown menus, the shared BankingMercuryTable (+SortTh + TransactionDetailPanel), pure sort/format helpers, the Ledger and User Sort panels, and the parent's data/prefs/nickname engines. No docs/BANKING_TABS_ARCHITECTURE.md map exists yet (Step 0 of the playbook).

### Internal structure

| Section | Lines | What it is |
|---|---|---|
| Imports | 1-88 | React/router/supabase imports plus ~20 already-extracted banking components/modals and ~15 lib kernels |
| Module types, constants, view parser | 89-165 | MercuryTxRow alias, list caps, SortKey, BankingProduct/MercuryBankingTab/StripeBankingTab/BankingView/BankingPageRole types, and pure parseBankingView(params, role) URL-to-view resolver |
| BankingNicknamesMenu (embedded component) | 167-287 | Self-contained dropdown menu (click-outside + Escape handling) opening account/debit-card nickname modals; controlled via menuOpen prop; used in two places (Sorting toolbar + Ledger panel) |
| BankingLedgerAdvancedMenu (embedded component) | 289-471 | Self-contained 'Advanced' dropdown: Refresh from Mercury, Backfill, Import CSV, Manual accounts, Reload table; all actions via callback props |
| Pure helpers | 473-546 | sortMercuryRowsStable (3-key stable sort with id tiebreak), formatCurrency, formatDate, formatDateTime, formatMercuryCategory — all pure, no React |
| Shared table styles + SortTh | 548-596 | bankingAllocMuted / bankingAllocLinkButtonStyle CSSProperties constants and the SortTh sortable-header cell component |
| TransactionDetailPanel (embedded component) | 598-693 | Expanded-row detail grid (ids, amounts, dates, category, dashboard link) + raw Mercury JSON pre block; pure presentational on one MercuryTxRow |
| BankingMercuryTable (embedded component) | 695-1096 | The big shared transaction table used by both Ledger and Sorting panels: 4 layout-variant flags, allocation Person/Jobs cells, org-note preview/editor sub-rows (MercuryTxNotesDisclosure), expandable detail rows; only local state is notesExpandedTxId — everything else is 20 explicit props |
| Banking() state block | 1098-1189 | ~35 useState/useRef: role, rows/loading/error, filters, sort states, nickname maps + drafts, 9 modal-open flags, allocation maps, accounting prefs (hideLabeled/applyRules/approveByDefault + hydration gate), labeled keyset cursor + paging refs, listLoadSeqRef race token, autoApplyResetTick |
| View routing callbacks + role/pref effects | 1191-1426 | bankingView memo over parseBankingView; setMercurySubTab/setStripeSubTab/setBankingProduct URL writers; menu/modal reset effects; role fetch; accounting-pref localStorage hydration + cross-device banking_user_prefs sync (syncPrefAcrossDevices + three onChange callbacks + DB read-back effect); non-privileged redirect; assistant/master-tech tab normalization effect |
| Row loaders + dispatcher | 1428-1618 | loadAllRows (15k master), loadUnlabeledRows (RPC), loadLabeledFirstPage / loadLabeledNextPage (keyset pagination with depth-preserving silent refresh), all guarded by listLoadSeqRef tokens; isAccountingLabeledView + loadRowsForActiveView tab-aware dispatcher |
| Nickname loaders + alloc-modal opener | 1620-1670 | loadNicknames / loadDebitCardNicknames selects; openAllocModalForMercuryRow with lazy raw hydration |
| Raw-hydration effects | 1672-1751 | Three effects lazily fetching raw JSON: initial load orchestrator (rows+nicknames), drag_sort/accounting batch hydration, recent-tx-modal hydration, expanded-row hydration — all write setRows via applyMercuryRawPatch |
| Allocations/attribution engine | 1753-1896 | loadMercuryAllocations (job allocations + person/user attributions + job/person/user name lookups feeding 6 state maps) + its effect; users/people attribution options load effect; attributionOptions memo |
| Derived memos + sort/expand glue | 1898-2061 | setSortForColumn/setSortingSortForColumn, accountOptions/kindOptions, search enrich contexts, filteredSorted, sorting slice (filterMercuryRowsForSorting → search → sort), org-note fetch ids + useMercuryOrgNotesByTxId, books-filtered lists + totals, sortingUnmatchedCounts, handleSortingConfigSave, expanded-row-visibility reconciliation effect |
| Action handlers | 2063-2242 | handleSync / handleBackfill (sync-mercury-transactions edge fn + autoApplyResetTick bump), handleImportCsv (import-manual-transactions edge fn), persistNickname/clearNicknameRow, persistDebitCardNickname/clearDebitCardNicknameRow |
| Role gates + page header | 2244-2522 | Loading/access gates; dev-only Mercury\|Stripe product tablist; Mercury 7-tab / Stripe 2-tab tablist; Sorting-tab toolbar region (Configuration, User Card Link, BankingNicknamesMenu) |
| User Sort tab panel (inline) | 2524-2696 | Non-dev explainer, search input, sync/reload buttons, error banner, unmatched counts + visible total + truncation warning, BankingMercuryTable in sorting layout |
| Extracted-tab wrappers | 2698-2799 | Thin prop-wired renders of BankingMercuryDragSortTab, BankingMercuryAccountingTab, BankingMercuryUserReviewTab, BankingMercuryCategoryReviewTab, BankingMercuryReconciliationTab — already done, nothing to extract |
| Ledger tab panel (inline) | 2801-2968 | Nicknames + Advanced menus, error banner, account/kind filters + search, filtered total + truncation warning, BankingMercuryTable in ledger layout |
| Stripe panel wrappers | 2970-2980 | BankingStripeInvoicesPanel / BankingStripeWebhookEventsPanel — already extracted |
| Modals block | 2982-3101 | Nine already-extracted modals wired to parent state: account/debit-card nicknames, recent-tx, backfill, import CSV, manual accounts, allocations, sorting config, user-card link |

### Extraction candidates (easiest/safest first)

1. **bankingMercuryTableFormat (sortMercuryRowsStable + formatCurrency/formatDate/formatDateTime/formatMercuryCategory + SortKey type)** — kernel, ~90 lines, low risk, unit-testable → `src/lib/bankingMercuryTableFormat.ts`
   - Inputs: None — pure functions over MercuryTxRow fields and sort state; export SortKey so parent and table share it
   - Notes: Stage A prerequisite for the table move. Distinct from the existing bankingMercuryLedgerTableSort.ts (that one serves the User Review ledger modal with a different key set — do not merge them, behavior-preserving). Tests: NaN/null posted_at ordering, id tiebreak stability, category name vs JSON fallback.
2. **parseBankingView + BankingView/BankingProduct/MercuryBankingTab/StripeBankingTab/BankingPageRole types** — kernel, ~80 lines, low risk, unit-testable → `src/lib/bankingViewRouting.ts`
   - Inputs: URLSearchParams + role; pure. Parent keeps the setSearchParams writers and normalization effects
   - Notes: Pure per-role URL→view resolver with non-obvious fallbacks (assistant/master-tech default to accounting; invoices/data coerce to ledger for dev-mercury). Unit tests lock the role-gating matrix cheaply — highest test value in the file.
3. **BankingNicknamesMenu** — component, ~121 lines, low risk → `src/components/banking/BankingNicknamesMenu.tsx`
   - Inputs: menuOpen, onMenuOpenChange, showAccount, showDebit, onOpenAccount, onOpenDebit (already a fully prop-driven module-level component — pure cut/paste)
   - Notes: menuOpen state stays in the parent: the same nicknamesMenuOpen backs both render sites (Sorting toolbar and Ledger panel) and is reset by a tab-change effect.
4. **BankingLedgerAdvancedMenu** — component, ~183 lines, low risk → `src/components/banking/BankingLedgerAdvancedMenu.tsx`
   - Inputs: menuOpen, onMenuOpenChange, syncing, loading, onRefreshFromMercury, onReloadTable, optional onBackfillFromMercury/onImportCsv/onManageManualAccounts (already fully prop-driven)
   - Notes: Pure cut/paste; keep the literal #2563eb action blue (saturated action colors stay literal per CLAUDE.md).
5. **BankingMercuryTable (+ SortTh + TransactionDetailPanel + alloc style constants)** — component, ~530 lines, low risk → `src/components/banking/BankingMercuryTable.tsx`
   - Inputs: The existing 20-prop BankingMercuryTableProps (displayRows, sort/onSortColumn, expandedRowId/setExpandedRowId controlled from parent, nickname maps, allocation maps, onEditAllocations, 4 layout flags, orgNotesByTxId/onOrgNoteUpdated); imports the Stage-A format/sort kernel
   - Notes: Biggest single win. Props interface already exists and is explicit; only local state (notesExpandedTxId) moves with it. SortTh and TransactionDetailPanel are used nowhere else — move them into the same file as private components. expandedRowId stays controlled (parent reconciles it against visible rows on tab/filter change).
6. **useBankingAccountingPrefs** — hook, ~120 lines, low risk → `src/hooks/useBankingAccountingPrefs.ts`
   - Inputs: userId, showToast; returns { hideLabeledTransactions, onHideLabeledTransactionsChange, applyRulesByDefault, onApplyRulesByDefaultChange, approveByDefault, onApproveByDefaultChange, accountingPrefsHydrated }
   - Notes: Clean seam: the three per-user toggles + localStorage hydration + banking_user_prefs cross-device sync (syncPrefAcrossDevices) + DB read-back effect are all keyed only on user?.id. Parent consumes hideLabeledTransactions in the loader dispatcher and accountingPrefsHydrated as the first-fetch gate — both come back as stable values. Storage kernels (bankingDragSortStorage, bankingUserPrefs) are already extracted and tested.
7. **BankingMercurySortingTab (User Sort panel)** — component, ~175 lines, medium risk → `src/components/banking/BankingMercurySortingTab.tsx`
   - Inputs: isDevBanking, bankingSearchText/setBankingSearchText (shared with Ledger + DragSort — stays parent-owned), syncing/onSync, loading/onReload, error, sortingUnmatchedCounts, sortingTotalAmount, booksSortingFilteredSorted, rows.length, rowsTruncated, sortingSort/onSortColumn, expandedRowId/setExpandedRowId, nickname maps, allocation maps, onEditAllocations, orgNotesByTxId/onOrgNoteUpdated, searchQueryNorm (for empty-message choice)
   - Notes: Panel body only (lines 2524-2696); the Sorting toolbar in the page header (Configuration / User Card Link / Nicknames buttons, lines 2452-2520) stays in the parent because it lives inside the shared header flex row and toggles parent-owned modals. Do after the table PR so this imports the extracted BankingMercuryTable. sortingSort state can move in or stay — keep it parent-owned (matches controlled-selection principle and costs 2 props).
8. **BankingMercuryLedgerTab (Ledger panel)** — component, ~170 lines, medium risk → `src/components/banking/BankingMercuryLedgerTab.tsx`
   - Inputs: accountFilter/setAccountFilter + kindFilter/setKindFilter (shared with DragSortTab — parent-owned), bankingSearchText/setBankingSearchText, accountOptions/kindOptions, nickname maps, menu open states + setters (nicknamesMenuOpen shared with Sorting toolbar), syncing/loading/error, onSync/onReload, modal openers (backfill, import CSV, manual accounts, account+debit nicknames), myRole gates, filteredSorted/totalAmount/rows.length/rowsTruncated, sort/onSortColumn, expandedRowId/setExpandedRowId, allocation maps, onEditAllocations, orgNotesByTxId/onOrgNoteUpdated
   - Notes: ~28 props but all leaf reads/callbacks — matches the prop pattern of the sibling DragSort/Accounting tabs. Renders the extracted BankingNicknamesMenu + BankingLedgerAdvancedMenu + BankingMercuryTable, so it lands after PRs 3-5.
9. **useBankingMercuryRows (list engine: master/unlabeled/keyset loaders + dispatcher)** — hook, ~250 lines, medium risk → `src/hooks/useBankingMercuryRows.ts`
   - Inputs: myRole, bankingView (product + mercuryTab), hideLabeledTransactions, showToast; returns { rows, setRows, loading, setLoading, error, setError, rowsTruncated, loadAllRows, loadRowsForActiveView, isAccountingLabeledView, labeledHasMore, labeledLoadingMore, loadLabeledNextPage }
   - Notes: The page's data-engine seam (playbook principle 4). Must move atomically: all four loaders + listLoadSeqRef + labeledCursor/labeledHasMore/labeledLoadingMore + labeledLoadingMoreRef/labeledLoadedCountRef — the seq-token race guard spans them. Must expose setRows because the three raw-hydration effects, openAllocModalForMercuryRow, and applyMercuryRawPatch writes stay in the parent (they also touch modal state). Also expose setError/setLoading for handleSync. Verify with manual smoke on Accounting hide-labeled toggle + labeled infinite scroll.
10. **useBankingMercuryAllocations (attribution/allocation maps engine)** — hook, ~190 lines, medium risk → `src/hooks/useBankingMercuryAllocations.ts`
   - Inputs: canAccessBanking, rows, showToast; returns { allocationsByTxId, personIdByTxId, userIdByTxId, personNameById, userNameById, jobLabelByIdBanking, usersSelectOptions, peopleAttribRows, attributionOptions, loadMercuryAllocations }
   - Notes: Lines 1753-1896 + 8 state decls + attributionOptions memo (buildBankingAttributionOptions kernel already extracted/tested). loadMercuryAllocations must stay referentially exposed — it is the refresh callback for the allocations modal, user-card-link modal, and both review tabs. Effect re-fires on rows identity, same as today.
11. **useBankingNicknames (account + debit-card nickname CRUD)** — hook, ~160 lines, medium risk → `src/hooks/useBankingNicknames.ts`
   - Inputs: myRole/canAccess, showToast; returns { nicknameByAccount, nicknameByDebitCard, nicknameDrafts, setNicknameDrafts, savingNicknameId, savingDebitCardNicknameId, loadNicknames, loadDebitCardNicknames, persistNickname, clearNicknameRow, persistDebitCardNickname, clearDebitCardNicknameRow }
   - Notes: loadNicknames/loadDebitCardNicknames (1620-1651) + the four persist/clear handlers (2144-2242) + 6 state decls. Note the existing src/hooks/useMercuryLedgerNicknames.ts serves a different surface — pick the useBankingNicknames name to avoid collision. Parent keeps modal-open flags and the load orchestration in handleSync/handleBackfill/handleImportCsv (which call these loaders).

### Suggested PR sequence

1. PR 0 (with PR 1 or standalone): write docs/BANKING_TABS_ARCHITECTURE.md — the playbook's Step 0 map does not exist for Banking; copy the section shape from BIDS_TABS_ARCHITECTURE.md and record the already-extracted tab inventory above.
2. PR 1: extract bankingMercuryTableFormat kernel (~90 lines + tests) — Stage A before any table move; pure, zero risk, locks the NaN-date/tiebreak sort semantics under test.
3. PR 2: extract parseBankingView → src/lib/bankingViewRouting.ts (~80 lines + tests) — pure role/URL matrix, highest unit-test value in the file, no render change.
4. PR 3: extract BankingNicknamesMenu → src/components/banking/ (~120 lines) — already fully prop-driven module component; pure cut/paste.
5. PR 4: extract BankingLedgerAdvancedMenu → src/components/banking/ (~185 lines) — same shape as PR 3.
6. PR 5: extract BankingMercuryTable (+SortTh, TransactionDetailPanel) → src/components/banking/BankingMercuryTable.tsx (~530 lines) — biggest single win; props interface already exists, imports the PR 1 kernel; expandedRowId stays controlled from the parent.
7. PR 6: extract useBankingAccountingPrefs hook (~120 lines) — self-contained per-user prefs cluster keyed on user.id; parent destructures, dispatcher wiring unchanged.
8. PR 7: extract BankingMercurySortingTab panel (~175 lines) — after PRs 3+5 so it composes the extracted menu + table; search text, sorts, and expandedRowId remain parent-owned props.
9. PR 8: extract BankingMercuryLedgerTab panel (~170 lines) — after PRs 3-5; ~28 leaf props matching the sibling tab pattern; account/kind filters stay parent-owned (shared with DragSortTab).
10. PR 9: extract useBankingMercuryRows hook (~250 lines) — the loader cluster moves atomically with its seq-token refs; exposes setRows/setError for the hydration effects and sync handlers that stay behind; do late so earlier PRs shrink the blast radius first.
11. PR 10: extract useBankingMercuryAllocations hook (~190 lines) — allocation/attribution maps + options; loadMercuryAllocations returned for the four modal/tab refresh callsites.
12. PR 11: extract useBankingNicknames hook (~160 lines) — nickname loads + CRUD; last because handleSync/handleBackfill/handleImportCsv orchestration over its loaders is easiest to verify once everything else is settled.

### Risks & gotchas

- No docs/BANKING_TABS_ARCHITECTURE.md exists — the playbook mandates the Step 0 map before extraction starts; write it first and flip statuses per PR.
- Cross-tab shared state is the main trap: bankingSearchText (Sorting panel + Ledger panel + DragSortTab), accountFilter/kindFilter (Ledger + DragSortTab), expandedRowId (both BankingMercuryTable render sites + a parent reconciliation effect), and nicknamesMenuOpen (Sorting toolbar + Ledger panel) must all stay parent-owned controlled props — a child pulling any of these in breaks a sibling tab.
- setRows is written from many places outside the loaders (three raw-hydration effects, openAllocModalForMercuryRow's merge, applyMercuryRawPatch); the rows hook (PR 9) must expose setRows or those effects silently diverge onto stale state.
- The listLoadSeqRef monotonic token spans all four loaders plus the labeled paging refs — splitting the loader cluster across PRs reintroduces the race (stale response clobbering the active view) the token exists to prevent; move it atomically.
- loadRowsForActiveView identity is a dependency of the initial-load effect and is closed over by handleSync/handleBackfill/handleImportCsv, ManualAccountsModal.onChanged, and AccountingTab.onAfterAssignmentChange — the hook must return it with the same useCallback dep semantics or the first-fetch gating (accountingPrefsHydrated) double-fires.
- The Sorting toolbar (lines 2452-2520) renders inside the shared page-header flex row, not the tab panel — extracting it with the Sorting panel would change layout; leave it in the parent.
- Behavior quirks to preserve verbatim: labeled silent-refresh reloads to the user's scrolled depth (labeledLoadedCountRef), autoApplyResetTick bump on sync/backfill, User Review tab skipping the master fetch, hide-labeled hydration gate deferring the first fetch, and duplicate rows shown struck-through in Ledger but filtered from books totals.
- There is no render-test harness — component PRs (5, 7, 8) ship verified only by typecheck/lint + manual smoke in the preview browser (prod session), so keep each one a pure cut/paste diff.
- Naming collisions: bankingMercuryLedgerTableSort.ts and useMercuryLedgerNicknames.ts already exist for other surfaces — the new kernel/hook names above deliberately avoid them; do not consolidate behavior into the existing files during a refactor pass.

---

## src/components/people/PeopleContractsTab.tsx — 2,981 → ~1,000 lines

PeopleContractsTab is the People-page Contracts tab (itself extracted from People.tsx in an earlier pass, PR #23) that has regrown into a God component. It self-loads four Supabase tables (contract_templates, contract_template_documents, person_contract_assignments, person_contract_documents), derives a per-person expandable roster table with lineage-versioned document rows and red/yellow/green rollup chips, and owns five inline modals: Manage templates (template CRUD with Contract-Book-sourced documents and person-doc backfill), Assign template (assign/unassign with placeholder cleanup), Add/Edit document (a two-tab upload-signed / request-signature form with contract-text and canonical-URL sub-fragments), Delete confirm, and Send-for-signature (calls the send-contract-for-signature edge function with an email preview). It also wires two already-extracted modals (ContractBookModal, PersonContractSignedRecordModal). Roughly 45 useState hooks live at the top, all modal/form state flattened into one scope.

**Already extracted:** ContractBookModal and PersonContractSignedRecordModal (src/components/contracts/) are already standalone components wired from this tab; pure kernels already in src/lib: contractBodyFormat.ts, contractSigningContent.ts, contractSendEmailPreview.ts, contractSigningRollup.ts (the Users-tab rollup), renderContractBodyToSafeHtml.ts. The tab itself was extracted out of People.tsx in the earlier People decomposition (PR #23) and has since regrown; no sub-extractions of this tab exist yet.

### Internal structure

| Section | Lines | What it is |
|---|---|---|
| Imports + module-level pure helpers | 1-56 | Imports (existing lib kernels: contractBodyFormat, contractSigningContent, contractSendEmailPreview) plus three module-level pure functions: formatContractBookLastEditedCalendarDate, isDeletablePersonContractStatus, personContractDocumentHasStaffData — already pure, untested. |
| Types + props | 58-110 | Person/UserRow row types, PeopleContractsTabProps, and component-local types ContractTemplate, ContractTemplateDocument, PersonContractAssignment, PersonContractDocument, PersonContractTableRow (defined INSIDE the component body — must be hoisted to a lib types module before any modal extraction). |
| State block (~45 useStates + useIds) | 111-175 | Data caches (templates/templateDocs/assignments/personDocs), loading/error, search, selected person, five modal-open flags, the entire Add/Edit document form (12+ fields), send-modal fields, canonical-URL check state, template-form state. |
| Small memos + UI effects | 176-235 | templateBookPickerOptions memo, canonicalUrlIsCheckable, checkCanonicalDocumentUrl callback, canonical-check reset effect, edit-modal collapse reset effect, click-outside effect for the row actions menu. |
| Shared document-modal field fragments | 236-435 | contractBodyFormatBtn style fn, contractDocModalContractTextField JSX memo (format toggle + textarea + Contract Book button), contractDocModalCanonicalUrlField JSX memo (URL input + Check link + status messages), handleContractAddTabKeyDown roving-tab keyboard handler. All belong to the Add/Edit document modal. |
| loadContracts loader | 437-467 | Parallel 4-table Supabase load populating the four data caches; the only data loader; re-called after every mutation. |
| Row-derivation logic (kernel material) | 469-605 | getAggregateStatusForTemplate, listAppliedContractBookVersionOptions, resolveAppliedContractTemplateDocIdForSave, getDocumentsForPerson (lineage grouping, latest-version sort, template placeholder rows, applied-version pin resolution via bookForVersion), getAggregateStatus. Pure over the four data arrays — closure-captured but no React. |
| Derived memos | 607-678 | contractsPersonNamesSorted (people+users union), contractsSearchNormalized, contractsPersonNamesFiltered, contractDocumentSearchLines, contractSendEmailPreview (wraps existing buildContractSendEmailPreview kernel). |
| Upsert payload builder (kernel material) | 680-744 | getContractDocumentUpsertPayload — encodes the tab-dependent save rules (request_signature forces unsent/null url; upload_signed forces signed/no signing body; dashboard-prompt suppression when signed). Pure over form values; currently untested. |
| Contract Book pick glue | 746-763 | handlePickContractFromBook (prefills document form from a library entry) + contractBookPickFromDocumentModal flag deciding whether ContractBookModal is in pick mode. |
| Document CRUD handlers | 765-973 | saveContractDocument (update vs insert with fresh lineage), toggleContractDashboardPrompt, openContractDocumentEditModal (form hydration), deleteContractDocument, saveContractDocumentAndOpenSend (insert then transition into send modal). |
| sendContractForSignature | 975-1048 | Email validation, JWT session fetch, POST to the send-contract-for-signature edge function, toast/result handling, send-modal state reset. |
| Template form handlers | 1050-1242 | openTemplateForm/closeTemplateForm, templateFormBookSourceValidationError, saveTemplate (multi-step: rename, remove docs + delete empty person placeholders, insert docs copied from Contract Book source rows, backfill person_contract_documents for assignees), deleteContractTemplate. |
| Assign-template state + handlers | 1244-1390 | assignTemplateSelectedId/SearchQuery/Saving/UnassigningTemplateId states, filteredAssignContractTemplates memo + reset effect, assignTemplateToPerson (assignment insert + per-doc create-or-refresh person rows), unassignTemplateFromPerson (delete assignment, clear applied pins, delete empty placeholders). |
| Mount load effect | 1392-1397 | 80ms-delayed initial loadContracts. |
| Main render: header + search + roster table | 1399-1912 | Header with Contract Book / Manage templates buttons, error/loading, search box + matching-documents panel, and the person table; each expanded row (1567-1902) renders Assign/Add buttons plus the per-person documents table with status chips, dashboard-prompt toggle, send button, and the ⋯ actions menu. |
| Manage templates modal (inline) | 1914-2104 | Template list + create/edit form with Contract-Book SearchableSelect picker and document-name list. |
| Assign template modal (inline) | 2106-2320 | Assigned-templates list with Unassign, template search, radiogroup selection, Assign/Cancel. |
| Add/Edit document modal (inline) | 2322-2746 | Two-tab (Upload Signed / Request Signature) add flow vs collapsible-section edit flow; consumes the shared field fragments; Save / Send / Delete footer. |
| Delete-document confirm modal (inline) | 2748-2832 | Overlay confirm dialog with signed-record warning; opened from both the row menu and the edit modal. |
| Extracted-modal wiring | 2834-2850 | PersonContractSignedRecordModal + ContractBookModal (already components in src/components/contracts/) with pick-mode handoff. |
| Send-for-signature modal (inline) | 2852-2978 | Signer email/subject/intro fields with live email preview (dangerouslySetInnerHTML from the tested contractSendEmailPreview builder), Send email button. |

### Extraction candidates (easiest/safest first)

1. **personContractTableRows kernel (types + row derivation)** — kernel, ~190 lines, low risk, unit-testable → `src/lib/personContractTableRows.ts`
   - Inputs: Explicit arrays: contractTemplates, contractTemplateDocuments, personContractAssignments, personContractDocuments; personName. Exports the hoisted types (ContractTemplate, ContractTemplateDocument, PersonContractAssignment, PersonContractDocument, PersonContractTableRow) plus getDocumentsForPerson, getAggregateStatus, getAggregateStatusForTemplate, and the module helpers isDeletablePersonContractStatus / personContractDocumentHasStaffData / formatContractBookLastEditedCalendarDate.
   - Notes: Stage-A prerequisite for every modal PR: hoisting the component-local types unblocks typed props everywhere. Lineage grouping / latest-version / applied-pin resolution is the riskiest untested logic in the file — gains real unit tests (empty lineage, placeholder rows, stale pin ignored, version sort). Sibling precedent: src/lib/contractSigningRollup.ts.
2. **personContractDocumentUpsert kernel (payload + applied-version options)** — kernel, ~140 lines, low risk, unit-testable → `src/lib/personContractDocumentUpsert.ts`
   - Inputs: Form values object (personName, documentName, url, signingBody, format, canonicalUrl, status, signedAt, note, dashboardPrompt, appliedTemplateDocId), mode ('edit' | 'add_request_signature' | 'add_upload_signed'), plus the data arrays for listAppliedContractBookVersionOptions / resolveAppliedContractTemplateDocIdForSave.
   - Notes: Encodes the tab-dependent save rules (upload_signed forces signed + strips signing body/canonical; request_signature forces unsent + null url; dashboard prompt suppressed when signed). Pure, currently untested, and consumed by three save paths — highest test value per line.
3. **PeopleContractsSendModal** — component, ~230 lines, low risk → `src/components/people/PeopleContractsSendModal.tsx`
   - Inputs: docId, the matching PersonContractDocument (or personContractDocuments to look it up), onClose, onSent (calls loadContracts). Moves in: contractSendEmail/Subject/Intro/Saving state, contractSendEmailPreview memo, sendContractForSignature (edge-function fetch), and its own error line (currently shares contractsError — keep a local error inside the modal, resetting parent error on open, which preserves visible behavior).
   - Notes: Leaf modal: opened from the row Send button and from saveContractDocumentAndOpenSend; both just set docId + open. Cleanest first component win.
4. **PeopleContractsDeleteConfirmModal** — component, ~120 lines, low risk → `src/components/people/PeopleContractsDeleteConfirmModal.tsx`
   - Inputs: target: PersonContractDocument, onClose, onDeleted (parent closes edit modal if it was editing the same id, then loadContracts). Moves in: contractDocumentDeleting state + deleteContractDocument supabase call. Parent keeps contractDocumentDeleteTarget/Open state since both the row menu and the edit modal open it.
   - Notes: canDeletePeopleContracts gate stays in the parent (render-guard) and inside the delete call.
5. **PeopleContractsTemplateManagerModal** — component, ~400 lines, medium risk → `src/components/people/PeopleContractsTemplateManagerModal.tsx`
   - Inputs: contractTemplates, contractTemplateDocuments, personContractAssignments, personContractDocuments, canDeletePeopleContracts, onClose, onSaved (loadContracts). Moves in: template form state (editingContractTemplate, templateFormName/DocumentNames/SourceByName, templateBookPickerValue/Options memo, mode, saving), openTemplateForm/closeTemplateForm, templateFormBookSourceValidationError, saveTemplate, deleteContractTemplate, and the modal JSX (1914-2104).
   - Notes: Self-contained data-wise (reads the four caches, only exits via onSaved), but saveTemplate is a long multi-step write sequence — diff must be a pure move. Its error display switches from contractsError to a local error surfaced inside the modal (same visual position).
6. **PeopleContractsAssignTemplateModal** — component, ~370 lines, medium risk → `src/components/people/PeopleContractsAssignTemplateModal.tsx`
   - Inputs: personName (selectedContractsPersonName), contractTemplates, contractTemplateDocuments, personContractAssignments, personContractDocuments, canDeletePeopleContracts, onClose, onSaved. Moves in: assignTemplateSelectedId/SearchQuery/Saving/UnassigningTemplateId, filteredAssignContractTemplates memo + reset effect, assignTemplateToPerson, unassignTemplateFromPerson, modal JSX (2106-2320).
   - Notes: Selection of WHICH person stays in the parent (controlled prop per playbook); the modal owns only its template pick. assign/unassign write sequences move verbatim.
7. **PeopleContractsDocumentModal (Add/Edit document)** — component, ~780 lines, high risk → `src/components/people/PeopleContractsDocumentModal.tsx`
   - Inputs: Open-request prop: { mode: 'add', personName } | { mode: 'edit', doc: PersonContractDocument } (parent keeps openContractDocumentEditModal trigger but hydration moves into the modal via an on-open effect); data arrays for applied-version options; canDeletePeopleContracts; callbacks onClose, onSaved, onRequestSend(docId) (parent opens PeopleContractsSendModal), onRequestDelete(doc) (parent opens delete confirm), onOpenContractBook (ContractBookModal STAYS in the parent — it is opened from the tab header too, and its pick-mode handoff writes this modal's form).
   - Notes: The big one: ~14 form states, the two shared JSX field fragments (236-435), handleContractAddTabKeyDown, getContractDocumentUpsertPayload call sites, saveContractDocument, saveContractDocumentAndOpenSend, canonical-URL check state + effects, and modal JSX 2322-2746. The Contract-Book pick handoff (handlePickContractFromBook writes form fields while ContractBookModal renders in the parent) is the tangle: solve by having the parent hold a 'pendingBookPick' entry prop or by moving handlePickContractFromBook into the modal via a ref/callback registration. Do last, after kernels shrink its logic to wiring.
8. **PeopleContractsPersonRow (expanded person documents section)** — component, ~350 lines, medium risk → `src/components/people/PeopleContractsPersonRow.tsx`
   - Inputs: personName, rows (from getDocumentsForPerson kernel), assignments+templates for chips, canDeletePeopleContracts, contractDashboardPromptSavingId, actionsMenuOpenId + setter, and callbacks: onAssign, onAddDocument, onEditDocument, onSend, onToggleDashboardPrompt, onViewSigned, onDeleteDocument, onToggleExpand.
   - Notes: Optional final polish: pure leaf render (1511-1905 map body) but with ~8 callbacks. Only worth doing after the modals are out; skip if the parent is already comfortable (~1.3k).

### Suggested PR sequence

1. PR 1: Stage A — extract src/lib/personContractTableRows.ts (~190 lines: hoisted row types + getDocumentsForPerson/getAggregateStatus/getAggregateStatusForTemplate + the three module helpers) with personContractTableRows.test.ts covering lineage grouping, placeholder rows, stale applied-pin fallback, and traffic-light rollup — first because every later PR needs the hoisted types, and it puts the file's riskiest untested logic behind tests.
2. PR 2: Stage A — extract src/lib/personContractDocumentUpsert.ts (~140 lines: getContractDocumentUpsertPayload + listAppliedContractBookVersionOptions + resolveAppliedContractTemplateDocIdForSave) with tests for the three save modes' field-forcing rules — second because it de-risks the eventual document-modal move.
3. PR 3: extract PeopleContractsSendModal (~230 lines incl. sendContractForSignature + email-preview memo) — easiest leaf modal, two clean open paths, no shared form state.
4. PR 4: extract PeopleContractsDeleteConfirmModal (~120 lines incl. deleteContractDocument) — trivial leaf; parent keeps the delete-target state since two surfaces open it.
5. PR 5: extract PeopleContractsTemplateManagerModal (~400 lines: template form state + saveTemplate/deleteContractTemplate + modal JSX) — self-contained data-wise; verbatim move of the multi-step write sequence.
6. PR 6: extract PeopleContractsAssignTemplateModal (~370 lines: assign state/handlers + modal JSX) — personName stays a controlled prop from the parent.
7. PR 7: extract PeopleContractsDocumentModal (~780 lines: form state, shared field fragments, save handlers, canonical-URL check) — last because of the ContractBookModal pick handoff and the save-then-open-send / delete-confirm transitions, all resolved via onRequestSend/onRequestDelete/pendingBookPick props; by now its logic is kernel calls so the diff is mostly JSX.
8. PR 8 (optional): extract PeopleContractsPersonRow (~350 lines of expanded-row JSX) if the parent still feels heavy after PR 7.

### Risks & gotchas

- contractsError is a single shared error string displayed in five different modals AND the tab header; each modal extraction converts its slice to modal-local error state — visually identical but the diffs must reset the parent error on open/close exactly as today to stay behavior-preserving.
- ContractBookModal is opened from three places (tab header, document-modal Contract text button, template manager references it in copy) and its onPickEntry writes document-modal form fields — it must stay in the parent, and PR 7 needs a deliberate handoff design (pendingBookPick prop or callback registration) rather than a blind cut/paste.
- saveTemplate, assignTemplateToPerson, and unassignTemplateFromPerson are sequential multi-row Supabase write loops with no transaction; moving them is safe only as verbatim moves — any 'cleanup' during PR 5/6 risks changing partial-failure behavior.
- getDocumentsForPerson is called inside memos AND inline in render (filter + search-lines + row map); PR 1 must thread the four data arrays explicitly at every call site — easy to miss one and capture stale closures.
- Component-local types (PersonContractDocument etc.) are referenced by ~30 states/handlers; the type hoist in PR 1 touches many lines but zero behavior — keep it in the same PR as the kernel so it never ships half-done.
- No render-test harness: modal PRs are verified only by typecheck/lint/manual smoke against the signed-in preview session (prod data) — keep each PR to one modal so a visual regression is bisectable.
- The 80ms-delayed mount loadContracts and the click-outside actions-menu effect stay in the parent; do not let them ride along into a modal extraction.
- Inline styles use some literal saturated action colors (#3b82f6, #0ea5e9, #b91c1c) which are allowed, but any new file must keep neutral colors as CSS variables or scripts/theme-tokenize.mjs --check fails CI.

---

## src/components/DashboardTeamActiveClockStrip.tsx — 2,870 → ~850 lines

Dashboard (and People → Hours / Quickfill) "team clock activity strip": a bordered card stacking three orange-headed tables — "Currently In" (live open sessions with elapsed tick, job/bid assign popovers, salary-schedule synthetic rows and materialize action), "Clocked in today" (per-person day rows with three-state expand mode persisted in localStorage, needs-attention filtering, expandable per-session detail with approve/reject/revoke controls), and "Jobs worked today" (per-job aggregation with expandable session lists and field-report links). It also owns the strip's top-right chrome (scope toggle, copy-day-job-mix mode, schedule-day email, add-session, needs-attention toggle), an optimistic-approval id set that reconciles against refetched rows, the session-actions modal wiring, an inline reject-confirm modal, and openers for the user-review and job-detail context modals. Heavy prop surface (~25 props) injected by useDashboardMyTeamSectionState-derived parents; most embedded child widgets (AssignSessionJobPopover, StripClockTimeMapButton, ClockSessionStripApproveControl, ClockSessionStripActionsModal, CopyDayJobMixModal, ScheduleDayEmailModal) are already extracted siblings.

**Already extracted:** Sibling extractions that already came out of this surface: src/components/ClockSessionStripActionsModal.tsx, src/components/ClockSessionStripApproveControl.tsx (incl. deriveClockSessionStripApproveStatus), src/components/clock-sessions/AssignSessionJobPopover.tsx, src/components/clock-sessions/StripClockTimeMapButton.tsx, src/components/day-job-mix/CopyDayJobMixModal.tsx, src/components/ScheduleDayEmailModal.tsx, src/components/icons/JobsWorkedTodayReportIcon.tsx, plus lib kernels src/lib/dashboardClockStripScopeStorage.ts, src/lib/approveClockSessions.ts, src/types/clockSessions.ts label formatters. DASHBOARD_SECTIONS_ARCHITECTURE.md tracks the parent-side cluster orchestration (DashboardClockStripCluster) separately — that is parent work, not internal decomposition of this file, which has no map yet.

### Internal structure

| Section | Lines | What it is |
|---|---|---|
| Imports + module constants | 1-63 | Imports (hook types from useDashboardMyTeamSectionState, clockSessions type/label helpers, already-extracted strip widgets), empty-set defaults, timeOpts |
| Pure row/status/payload helpers | 64-239 | findTodaySessionInStrip, stripApproveStatusForSession (optimistic merge), stripSessionIsPendingApprovalMerged, stripClockedInTodayDisplayLabel, stripRowHasPendingApprovalMerged, stripRowHasClosedSalaryScheduleNoOpenSession, stripRowInFocusedClockedInView, stripActionsPayloadFromSession, normalizeStripActionsPayloadFallback, personName, stripPersonDisplayName, shortJobOrBidLabel, sessionDurationSeconds, formatDurationFromSeconds, formatElapsedOpen — all pure, zero JSX |
| StripClockOverlapBadge | 240-264 | Tiny presentational overlap warning badge component + title constant |
| Strip style constants + z-index ladder | 266-604 | ~40 CSSProperties constants (srOnly, th/td, orange header typography, summary-cell/session-memo/link styles, chevron buttons, scopeBtn factory, formatHoursH) and STRIP_POPOVER_Z/ACTIONS/INNER/REJECT z-indexes |
| Reject payload type + expand-mode localStorage persistence | 606-674 | StripRejectClockSessionPayload; ClockedInTodayExpandMode read/persist/cycle (with legacy-key migration) and jobs-worked-today collapsed read/persist |
| Row filter predicates + table mode | 676-694 | ClockedInTodayTableMode, stripRowHasUnassignedSession, stripRowEligibleForApplyScheduleProportions |
| Component signature + ~25 props | 696-779 | Inline props type: sessions, hoursTodayByUserId, clockedInTodayRows, jobsWorkedTodayRows, scope toggle props, assign/approve callbacks, feature flags (copy mix, schedule email, add session), report key maps |
| Context hooks + modal openers + header wrap | 780-833 | useAuth/useLedgerPrefixMap/useUserReviewModal/useJobDetailModal, openUserReview, openJobDetailFromSessionEmbeds, useMatchMedia narrow-header branch, wrapMergedJobsHeaderTitles |
| Local state + report opener + actions-payload memo + reconciliation effects | 834-959 | nowMs tick, salaryMaterializeBusy, stripApproveBusy, stripRejectConfirm, stripActionsSession (+iOS selection-clear effect), optimisticStripApprovedIds, copy-mix/email/report-view state, openJobsWorkedTodayReport RPC, stripActionsPayload memo, 3 effects reconciling optimistic ids and stale actions session |
| Approve / revoke / reject handlers | 961-1101 | handleStripSessionApprove (approveClockSessions RPC), handleStripSessionRevoke (revoke_clock_sessions RPC + confirm), requestStripSessionReject, requestRejectFromActionsModal, performStripSessionReject (direct clock_sessions update), Escape-key effect |
| Visibility memos + expand-mode layout effect | 1102-1161 | clockedInTodayFocusedRows/unassignedRows/bodyRows memos, table mode + collapsed-ids state, overlap-by-user map, showClockedInTodayToggle, useLayoutEffect auto-cycling empty expand modes |
| Chrome layout flags + header-reserve styles | 1163-1204 | scopeShowsOverlay, showCurrentlyInTable, chromeOverlaysHeaderBar, stripTopRightHeaderReserve clamp() paddings, mergeClockedInHeaderIntoJobs |
| Header chrome + expand toggle elements | 1205-1389 | stripHeaderChromeInner (schedule-email SVG button, copy-mix toggle, needs-attention toggle, add-session), citExpandModeToggle, citExpandModeTitleButton, jobsExpandModeTitleButton (near-duplicate JSX blocks) |
| Render: top-right chrome overlay + scope toggle | 1397-1461 | Absolute-positioned chrome bar and My Team / Company scope button group |
| Render: Currently In table | 1462-1711 | Open-sessions table: name→user-review button, salary (s) suffix, Today hours→My-Time editor, elapsed \| in-time map buttons, job/bid column with AssignSessionJobPopover and salary materialize action |
| Render: Clocked in today section | 1712-2192 | Per-person rows (chevron, name + overlap badge + copy-mix icon, hours \| first-in) plus expanded per-session detail table with ClockSessionStripApproveControl, map-time buttons, assign popover, job/bid links, memo |
| Render: Jobs worked today section | 2193-2739 | Per-job rows (merged-header variant embedding CIT toggles, report-missing icon, job-detail button, [hours • people]) plus expanded session list with approve control, report-view button, map times, duration→My-Time editor |
| Modals wiring | 2742-2869 | ClockSessionStripActionsModal props, INLINE reject-confirm dialog (2761-2838), CopyDayJobMixModal, ScheduleDayEmailModal, ReportViewModal |

### Extraction candidates (easiest/safest first)

1. **clockSessionStripRowStatus (kernel)** — kernel, ~180 lines, low risk, unit-testable → `src/lib/clockSessionStripRowStatus.ts`
   - Inputs: TodaySessionStripRow/ClockedInTodayStripRow (types from useDashboardMyTeamSectionState) + optimistic id ReadonlySet + nowMs; deriveClockSessionStripApproveStatus imported from ClockSessionStripApproveControl
   - Notes: Stage A. Moves lines 64-135 + 208-238 + 501-503 + 676-694: stripApproveStatusForSession, stripSessionIsPendingApprovalMerged, stripRowHasPendingApprovalMerged, stripRowHasClosedSalaryScheduleNoOpenSession, stripRowInFocusedClockedInView, stripRowHasUnassignedSession, stripRowEligibleForApplyScheduleProportions, stripClockedInTodayDisplayLabel, findTodaySessionInStrip, personName/stripPersonDisplayName, sessionDurationSeconds, formatDurationFromSeconds, formatElapsedOpen, formatHoursH. Pure decision logic used by all three tables — highest test value (optimistic merge, salary split-day filter, apply-schedule eligibility). Add clockSessionStripRowStatus.test.ts.
2. **clockSessionStripActionsPayload (kernel)** — kernel, ~110 lines, low risk, unit-testable → `src/lib/clockSessionStripActionsPayload.ts`
   - Inputs: TodaySessionStripRow, LedgerPrefixMap, ClockSessionStripActionsPayload type (import from ClockSessionStripActionsModal)
   - Notes: Stage A. Moves lines 137-206: stripActionsPayloadFromSession + normalizeStripActionsPayloadFallback (job/bid label fallbacks, /jobs?edit and /bids?bidId href construction). Add tests for fallback normalization and href encoding.
3. **dashboardClockStripSectionStorage (kernel)** — kernel, ~70 lines, low risk, unit-testable → `src/lib/dashboardClockStripSectionStorage.ts`
   - Inputs: none (localStorage)
   - Notes: Stage A. Moves lines 612-674: ClockedInTodayExpandMode type/guard, read/persist/cycle (incl. legacy-key migration), jobs-worked-today collapsed read/persist. Naming mirrors existing src/lib/dashboardClockStripScopeStorage.ts. Test cycle order + legacy '1'/'0' migration with a localStorage stub.
4. **stripClockStripStyles (constants) + StripClockOverlapBadge** — constants, ~340 lines, low risk → `src/components/clock-sessions/stripClockStripStyles.tsx`
   - Inputs: none (pure CSSProperties constants, scopeBtn factory, z-index ladder, srOnly, badge component)
   - Notes: Moves lines 240-604 (minus formatHoursH, already in kernel PR). Prerequisite for the three table-section extractions — they all consume these constants, so exporting them from one module avoids duplication. Pure move; keep literal #ff6600 orange etc. exactly as-is (behavior-preserving; saturated action colors stay literal per CLAUDE.md).
5. **StripRejectClockSessionConfirmModal** — component, ~120 lines, low risk → `src/components/clock-sessions/StripRejectClockSessionConfirmModal.tsx`
   - Inputs: payload: StripRejectClockSessionPayload | null, busy: boolean, zIndex, onCancel, onConfirm; move the Escape-key effect (965-975) inside
   - Notes: Moves the inline reject dialog (2761-2838) + StripRejectClockSessionPayload type (606-610) + esc effect. Clean leaf: parent keeps stripRejectConfirm state and performStripSessionReject; modal is fully controlled.
6. **useClockStripSessionApprovalActions (hook seam)** — hook, ~250 lines, medium risk → `src/hooks/useClockStripSessionApprovalActions.ts`
   - Inputs: clockedInTodayRows, authUserId, prefixMap, onClockSessionsMutated, onJobBidAssignError
   - Notes: Playbook Step-2 seam for the two coupled sections. Moves lines 835-838, 858-860, 896-959, 961-1101: stripApproveBusy/stripRejectConfirm/stripActionsSession/optimisticStripApprovedIds state, stripActionsPayload memo, the three reconciliation effects, approve/revoke/reject handlers. Returns one object the parent destructures (names unchanged) and later passes into CIT/Jobs section components. Medium: many interlocking setState closures — move verbatim.
7. **StripCurrentlyInTable** — component, ~270 lines, medium risk → `src/components/clock-sessions/StripCurrentlyInTable.tsx`
   - Inputs: sessions, hoursTodayByUserId, nowMs, showJobBidColumn, shortCurrentlyInHeader, stripTopRightHeaderReserve (style prop), onJobBidSaved, onJobBidAssignError, onOpenStripMyTimeEditor, onMaterializeSalarySession, openUserReview, userReviewModalAvailable, openJobDetailFromSessionEmbeds; uses useLedgerPrefixMap internally
   - Notes: Moves render lines 1462-1711 + salaryMaterializeBusyUserId state (835, local to this table). Leaf section: reads no CIT/Jobs state; only cross-cutting input is the parent-computed stripTopRightHeaderReserve padding and header shortening flag.
8. **StripClockedInTodaySection** — component, ~500 lines, high risk → `src/components/clock-sessions/StripClockedInTodaySection.tsx`
   - Inputs: clockedInTodayRows, clockedInTodayBodyRows, clockedInTodaySectionOpen, mergeClockedInHeaderIntoJobs, citExpandModeToggle (ReactNode from parent), stripTopRightHeaderReserve, nowMs, approval object from useClockStripSessionApprovalActions, canApproveClockSessions, authUserId, copyDayJobMixMode/copyJobMixChrome + onOpenCopyDayJobMix, onOpenStripMyTimeEditor, onJobBidSaved/onJobBidAssignError, onApplyScheduleProportionsForSession, clockStripWorkDateResolved, openUserReview, openJobDetailFromSessionEmbeds
   - Notes: Moves render 1712-2192 + collapsedClockedInTodayUserIds state (row-detail expand, single consumer). Expand-mode state, visibility memos, and the auto-cycle layout effect (1102-1161) STAY in the parent — the merged Jobs header and header chrome also read them. High risk: ~15 closure captures and the duplicated #clocked-in-today-section-toggle id contract with the Jobs merged header (preserve exactly).
9. **StripJobsWorkedTodaySection** — component, ~560 lines, high risk → `src/components/clock-sessions/StripJobsWorkedTodaySection.tsx`
   - Inputs: jobsWorkedTodayRows, clockedInTodayRows.length, mergeClockedInHeaderIntoJobs, jobsWorkedTodaySectionCollapsed + onToggleCollapsed, citExpandModeToggle/citExpandModeTitleButton/jobsExpandModeTitleButton (ReactNode props), wrapMergedJobsHeaderTitles, stripTopRightHeaderReserve, nowMs, approval object, canApproveClockSessions, clockStripOverlapByUserId, jobsWorkedTodayReportKeys/IdByKey/IdsWithReport, openJobsWorkedTodayReport, onOpenStripMyTimeEditor, jobDetailModal opener
   - Notes: Moves render 2193-2739 + collapsedJobsWorkedTodayJobLedgerIds state + openJobsWorkedTodayReport handler + stripViewingReport/ReportViewModal (single consumers). High risk: the merged CIT+Jobs header renders parent-owned toggle elements — pass them as ReactNode props rather than re-deriving; jobsWorkedTodaySectionCollapsed must stay parent-owned (feeds mergeClockedInHeaderIntoJobs).

### Suggested PR sequence

1. PR 1: extract clockSessionStripRowStatus kernel + tests (~180 lines) — pure, zero-risk Stage A; puts the optimistic-approve merge, needs-attention filters, salary split-day rule, and duration formatters under unit tests before any JSX moves; every later PR imports it.
2. PR 2: extract clockSessionStripActionsPayload kernel + tests (~110 lines) — second Stage A slice; payload/href builders are self-contained and shared by both section components extracted later.
3. PR 3: extract dashboardClockStripSectionStorage kernel + tests (~70 lines) — localStorage expand-mode persistence incl. legacy-key migration, mirroring the existing dashboardClockStripScopeStorage.ts naming.
4. PR 4: extract stripClockStripStyles constants module + StripClockOverlapBadge (~340 lines) — mechanical move of shared CSSProperties/z-indexes; required so the three table sections can be extracted without duplicating styles.
5. PR 5: extract StripRejectClockSessionConfirmModal (~120 lines) — classic embedded-modal easy win; fully controlled props, no shared state.
6. PR 6: extract useClockStripSessionApprovalActions hook (~250 lines) — the Step-2 seam: approval/optimistic/actions-modal state + handlers move verbatim into one hook the parent destructures; unblocks the two coupled sections without threading a dozen setters.
7. PR 7: extract StripCurrentlyInTable (~270 lines) — first render section; leaf-most of the three (no CIT/Jobs coupling), takes parent-computed header-reserve style as a prop.
8. PR 8: extract StripClockedInTodaySection (~500 lines) — after the hook seam exists; expand-mode state and visibility memos stay in the parent (merged header + chrome read them), toggle buttons passed in as nodes.
9. PR 9: extract StripJobsWorkedTodaySection (~560 lines) — last because the merged CIT+Jobs header is the tightest coupling; takes the parent's toggle elements as ReactNode props and brings ReportViewModal + report-open handler with it.

### Risks & gotchas

- Merged-header coupling: mergeClockedInHeaderIntoJobs renders Clocked-in-today toggle buttons INSIDE the Jobs-worked-today table header, and the element id clocked-in-today-section-toggle is intentionally rendered by whichever variant is visible (aria-labelledby contract). The CIT and Jobs sections must receive these toggles as parent-built ReactNode props; re-deriving them in children would duplicate ids or break aria wiring.
- stripTopRightHeaderReserve (clamp() padding reserving space for the absolute chrome overlay) is applied to the last header/body cells of ALL THREE tables — it must be computed once in the parent and passed down, or the overlay will overlap moved sections.
- optimisticStripApprovedIds is read by both the Clocked-in-today and Jobs-worked-today session rows and by the focused-row filter; it must live in the shared hook (PR 6), never in a section component, or optimistic approve will stop hiding rows in the sibling section.
- The useLayoutEffect at 1142-1161 auto-cycles empty expand modes and writes localStorage; it reads clockedInTodayBodyRows.length which derives from filters moving to the kernel — keep the effect and its memos in the parent to avoid a mount-order behavior change.
- Behavior quirks to preserve verbatim: legacy localStorage key migration (612-651), the duplicated citExpandModeToggle vs citExpandModeTitleButton JSX (near-identical but different styles/labels — do not dedupe during the move), the iOS selection-clear double-rAF effect (841-856), and window.confirm inside handleStripSessionRevoke.
- Theme-tokenize CI: the styles module move (PR 4) relocates literal colors (#ff6600 orange, #f59e0b, #bfdbfe, #dc2626); these pass today as saturated action colors — run node scripts/theme-tokenize.mjs --check src after the move to confirm the new file path still passes, and do not 'fix' them mid-move.
- nowMs (45s tick via useIntervalNowMs) drives elapsed labels in all three sections; pass it down as a prop rather than re-instantiating the interval per child, or ticks will desync and add timers.
- No render-test harness exists: PRs 7-9 are verifiable only by typecheck/lint plus manual smoke on Dashboard, People → Hours, and Quickfill (the three mount points, incl. hideCurrentlyInTable and non-today work dates), so keep each diff a pure cut/paste move.

---

## src/components/jobs/JobsJobSummaryTab.tsx — 2,862 → ~620 lines

JobsJobSummaryTab is the presentational body of the Jobs page's Job Summary tab: a per-job cost-rollup ledger table (HCP #, name, address, team labor, sub labor, parts, total bill, revenue-before-overhead, % complete) where each row expands into a large detail panel — quick links + Stages metadata header, a charges timeline chart, an interactive per-person cost summary table whose every cell opens a drilldown modal (bodies built at click time and pushed into parent state via setJobSummaryCostDrilldown), collapsible Team Labor / Sub Labor / Parts Cost / Total Bill sections with nested work-date + clock-session and Mercury/supply-house tables, and a min-HCP filter footer. Per its own header comment it is deliberately stateless: all data, caches, expansion sets, and loaders live in Jobs.tsx and arrive as ~35 props; virtually all calculation is already in src/lib kernels (jobSummaryPersonSummaryTable, partsPerPersonCostSummary, jobSummaryTeamLaborWorkDateTable, jobSummaryPercentComplete, jobSummaryDrilldownMercuryFilter, jobs/jobFormatting). The remaining 2.8k lines are almost entirely JSX, so this decomposition is mostly Stage-B section moves with two small Stage-A kernels left to harvest.

**Already extracted:** This tab is itself an extraction from Jobs.tsx (per docs/JOBS_TABS_ARCHITECTURE.md, status "partial — render extracted; data layer parent-side"). Sibling extractions already done: JobSummaryCostCellDrilldownModal.tsx (drilldown modal + shared JobSummaryDrilldownMercuryTable / JobSummaryDrilldownTeamLaborByWorkDate tables), JobSummaryChargesTimelineChart.tsx, and lib kernels with tests: jobSummaryPersonSummaryTable.ts, partsPerPersonCostSummary.ts, jobSummaryTeamLaborWorkDateTable.ts, jobSummaryPercentComplete.ts, jobSummaryHcpFilter.ts, jobSummaryDrilldownMercuryFilter.ts, jobs/jobFormatting.ts formatters, stagesJobReferenceDates.ts. The parent-side useJobSummaryData / useJobsMercuryAllocations seams are a separate track owned by JOBS_TABS_ARCHITECTURE.md — do not touch them here.

### Internal structure

| Section | Lines | What it is |
|---|---|---|
| Imports + lib-kernel wiring | 1-68 | Header comment (declares the file presentational) and imports — nearly all logic comes from existing src/lib kernels and the two already-extracted drilldown/chart components. |
| latestThreadActivity helper | 70-91 | Pure function picking the newer of last note vs last report from JobThreadNoteStats (same logic as Stages Last-activity cell). No React. Kernel candidate. |
| JobSummaryExpandedHeader embedded component | 93-237 | Module-level component (plus expandedHeaderLabelStyle const): Job Detail / Edit Job buttons, Assigned list, HCP number + j:/b: reference dates, Last-activity preview. Props: job, stat, onOpenJobDetail, onOpenEditJob. Leaf. |
| Drilldown cell chrome helpers | 239-256 | jobSummaryDrilldownCellKeyboard (Enter/Space handler) and jobSummaryBreakdownInteractiveClass (CSS class picker) — tiny shared helpers used throughout the person-summary section. |
| Supply-house invoice table renderer | 258-328 | renderJobSummarySupplyHouseInvoiceTableContent(loaded, rows, total): loading/empty/table states with portal-link buttons. Called from 5 places (person-summary drilldowns, Unassigned row, footer, Parts section). Leaf component candidate. |
| Shared section style consts | 330-348 | jobSummaryPartsCostDetailsBoxStyle, jobSummaryPartsCostFlatRowStyle, jobSummaryCostSectionBodyStyle — used by Team Labor, Sub Labor, Parts, Total Bill sections. |
| JobSummaryRow + props types | 349-423 | Exported JobSummaryRow shape (produced by parent's jobSummaryData memo) and the ~40-field JobsJobSummaryTabProps. |
| Component signature + destructure | 425-464 | Default export destructuring all props. |
| Top chrome: errors, search, gates, table head | 465-506 | Error paragraphs, search input, loading/empty gates (with the do-not-gate-on-jobsListLoading quirk comment), 9-column ledger table header. |
| Row filter + per-row prelude | 507-570 | Inline search predicate over hcp/name/address; per-row destructure of JobSummaryRow; mileage/timePerMile defaults (0.7 / 0.02 hardcoded fallbacks); breakdown person-filter derivations; expand/collapse toggle that also prunes person-expansion keys and per-job search. |
| Main ledger row JSX | 571-631 | Clickable/keyboard-expandable summary row with role-gated Team Labor / profit masking (showTeamLaborAndProfit) and % complete via resolveJobSummaryPercentComplete. |
| Expanded header + print + timeline chart | 632-700 | Detail row opening: JobSummaryExpandedHeader, Print/Save-as-PDF button (delegates to parent printJobSummaryCostBreakdown with busy state), JobSummaryChargesTimelineChart. |
| Person-summary section: build + per-person rows | 701-1162 | Giant IIFE: builds person rows from kernels (buildPartsPerPersonCostRows, buildJobSummaryPersonSummaryRows, partitionUnattributedFromJobSummaryPersonRows), derives footer sums (743-764), then renders the Name/Hours/Team/Card/Supply/Total table where each cell defines an openX() closure that builds a drilldown ReactNode and calls setJobSummaryCostDrilldown. |
| Person-summary Unassigned row | 1163-1377 | Unattributed-card + supply-house row with three drilldown openers (card / supply / combined), all gated on cardColLoading and zero checks. |
| Person-summary footer Total row | 1378-1858 | Footer IIFE: filtered-vs-full-job footer amounts, mRowsForFooterCard, and six openFooter* drilldown builders (label explainer, hours, team, card, supply, grand) each with its own inline table JSX. |
| Card-mismatch warning + section close | 1859-1874 | Amber warning when per-person card totals drift >$0.02 from job card total (uses sumCardF/unattributedCard from section scope). |
| Team Labor details section | 1875-2282 | Collapsible <details>: per-person rows expandable (jobSummaryTeamLaborPersonExpandedKeys, key `${job.id}::${i}`) into a combined crew-allocation + clock-session work-date table (buildJobSummaryTeamLaborWorkDateTableRows), plus the amber orphan-sessions box (2212-2272) for sessions not matching any breakdown name. |
| Sub Labor section | 2283-2327 | Small collapsible list of sub-labor jobs costed via laborJobSubCost(lj, mileageCost, timePerMile), filtered by the person search. |
| Parts Cost section | 2328-2766 | Collapsible <details> with four nested sub-details: Parts from Tally line table, Other job charges (materials sorted by sequence_order), Invoices from Supply Houses (lazy-loads on toggle), Card charges Mercury table (lazy-loads on toggle, debit-card nickname resolution), and the Cost-by-person tally+card rollup table (buildPartsPerPersonCostRows again) with sums-mismatch warning. |
| Total Bill section | 2767-2793 | Trivial collapsible showing revenue (billing) total. |
| Row/table close | 2794-2804 | Return [mainRow, detailRow], close flatMap/tbody/table. |
| Min-HCP filter footer | 2805-2862 | Number input persisting via writeJobSummaryMinHcpExclusiveToStorage, 'Showing X of Y jobs' count, explanatory copy. Fully leaf. |

### Extraction candidates (easiest/safest first)

1. **latestThreadActivity → jobSummaryThreadActivity kernel** — kernel, ~22 lines, low risk, unit-testable → `src/lib/jobSummaryThreadActivity.ts`
   - Inputs: JobThreadNoteStats | undefined (type from src/hooks/useJobThreadNotes)
   - Notes: Stage A. Pure note-vs-report recency pick with report-preview formatting; add jobSummaryThreadActivity.test.ts covering note-only / report-only / tie / invalid-date / preview-vs-template cases. Doc notes it mirrors the Stages Last-activity pick — do NOT unify with Stages logic in this pass, just move.
2. **Section chrome: styles + drilldown-cell helpers** — constants, ~45 lines, low risk → `src/components/jobs/jobSummarySectionChrome.ts`
   - Inputs: none (exports jobSummaryPartsCostDetailsBoxStyle, jobSummaryPartsCostFlatRowStyle, jobSummaryCostSectionBodyStyle, expandedHeaderLabelStyle, jobSummaryDrilldownCellKeyboard, jobSummaryBreakdownInteractiveClass)
   - Notes: Lines 93-100, 239-256, 330-348. Pure consts + two tiny DOM-event helpers (KeyboardEvent typed — keep .ts, no JSX). This is the enabler PR: every later section extraction imports from here instead of re-declaring. Class names jobSummaryBreakdownInteractive(Muted) live in index.css — unchanged.
3. **JobSummaryExpandedHeader** — component, ~140 lines, low risk → `src/components/jobs/JobSummaryExpandedHeader.tsx`
   - Inputs: job: JobWithDetails, stat: JobThreadNoteStats | undefined, onOpenJobDetail(jobId), onOpenEditJob(jobId)
   - Notes: Already a self-contained module-level component (102-237); the move is mechanical. Imports the thread-activity kernel (PR 1) and expandedHeaderLabelStyle from chrome (PR 2). Matches sibling naming (JobSummary* prefix like JobSummaryChargesTimelineChart).
4. **JobSummarySupplyHouseInvoiceTable** — component, ~72 lines, low risk → `src/components/jobs/JobSummarySupplyHouseInvoiceTable.tsx`
   - Inputs: invoiceLoaded: boolean, invoiceRows: JobSummaryInvoiceAllocationLine[], invoicesFromSupplyHouses: number
   - Notes: Convert renderJobSummarySupplyHouseInvoiceTableContent (258-328) into a component (or keep as an exported render function to leave the 5 call sites byte-identical — the function-returning-ReactNode form is safest for behavior preservation). Needed by both the person-summary and Parts section extractions, so it ships before them.
5. **JobSummaryHcpFilterFooter** — component, ~57 lines, low risk → `src/components/jobs/JobSummaryHcpFilterFooter.tsx`
   - Inputs: jobSummaryMinHcpExclusive: number, setJobSummaryMinHcpExclusive(n), jobSummaryLedgerJobs / jobSummaryLedgerAllJobs (or just their lengths as numbers)
   - Notes: Lines 2805-2859. Fully leaf; keeps the writeJobSummaryMinHcpExclusiveToStorage persistence call inside (localStorage key already lib-wrapped in jobSummaryHcpFilter.ts). Preserve the -1 / NaN guard exactly.
6. **Person-summary footer math → jobSummaryPersonSummaryFooter kernel** — kernel, ~45 lines, low risk, unit-testable → `src/lib/jobSummaryPersonSummaryFooter.ts`
   - Inputs: filtered person rows ({hours, teamLabor, card}[]), breakdownPersonQ, teamLaborCost, cardCharges, invoicesFromSupplyHouses, cardColLoading
   - Notes: Stage A for the person-summary section: the sumTeamF/sumCardF/personSummaryFooterTeam/Card/RowTotal derivations (743-764) plus the filtered-vs-full footer amounts at 1379-1387 and the >$0.02 card-mismatch predicate (1861-1869). Returns one object; unit-test the filtered vs unfiltered and loading-null branches. Removes the trickiest arithmetic from the upcoming big JSX move.
7. **JobSummaryTeamLaborSection** — component, ~410 lines, medium risk → `src/components/jobs/JobSummaryTeamLaborSection.tsx`
   - Inputs: jobId, teamLaborRow, teamLaborCost, teamBreakdownFiltered ({b,i}[] — keep parent-computed to preserve index-based person keys), breakdownPersonQ, clockSessions + clockLoaded (from jobSummaryClockSessionsByJobId), jobSummaryTeamLaborPersonExpandedKeys + setter
   - Notes: Lines 1875-2282. Per-person expansion stays controlled from the parent (Set keyed `${job.id}::${i}` — the row-collapse pruning in the toggle at 550-570 depends on that key shape, so pass the set + setter, never localize). Work-date table math already lives in buildJobSummaryTeamLaborWorkDateTableRows kernel. Includes the orphan-sessions amber box.
8. **JobSummaryPartsCostSection** — component, ~440 lines, medium risk → `src/components/jobs/JobSummaryPartsCostSection.tsx`
   - Inputs: job (materials + id), partsCost, partsFromTally, billedMaterialsSum, invoicesFromSupplyHouses, cardCharges, tallyPartsForJob, breakdownPersonQ, jobSummaryInvoiceLinesByJobId + jobSummaryMercuryAllocationsByJobId map entries (or has/get results), loadJobSummaryInvoiceLinesForJob, loadJobSummaryMercuryAllocationsForJob, nicknameByDebitCard
   - Notes: Lines 2328-2766. Self-contained <details> tree; lazy-load-on-toggle handlers move with it (they only call parent loader props). Reuses PR 4's supply-house table and chrome styles. All rollup math already in buildPartsPerPersonCostRows kernel. Preserve the onToggle open-check and the '#f3f4f6' / '#6b7280' literals byte-for-byte (pre-existing; do not let theme-tokenize auto-fix rewrite them in this diff).
9. **JobSummaryPersonSummarySection** — component, ~1170 lines, high risk → `src/components/jobs/JobSummaryPersonSummarySection.tsx`
   - Inputs: summaryRow fields (job, teamLaborRow, teamLaborCost, cardCharges, invoicesFromSupplyHouses, billedMaterialsSum, tallyPartsForJob), breakdownPersonQ, jobSummaryMercuryAllocationsByJobId + jobSummaryInvoiceLinesByJobId (has/get), setJobSummaryCostDrilldown, loadJobSummaryInvoiceLinesForJob, loadJobSummaryMercuryAllocationsForJob, handleJobSummaryMercuryReassignFromDrilldown, nicknameByDebitCard, canAccessBankingForParts
   - Notes: Lines 701-1874: the whole IIFE (per-person rows + Unassigned row + footer Total row + mismatch warning) becomes one file. High only because of sheer size and ~15 drilldown-builder closures — but every capture is already a prop of this tab, so it threads cleanly. Preserve quirk #11: drilldown bodies are ReactNodes built at click time and stored in parent state via setJobSummaryCostDrilldown — keep that exact pattern. If the PR is too big to review, split within the same file over two PRs: footer row (1378-1858) as an internal subcomponent first, then the rest. Optional later simplification (separate pass, not this move): a local MercuryDrilldownTable wrapper to collapse the 6 identical JobSummaryDrilldownMercuryTable prop blocks.

### Suggested PR sequence

1. PR 1: extract latestThreadActivity → src/lib/jobSummaryThreadActivity.ts + test (~22 lines) — pure Stage-A kernel, zero UI risk, puts the only untested logic in the file behind tests and unblocks the ExpandedHeader move.
2. PR 2: extract section chrome (3 style consts + expandedHeaderLabelStyle + jobSummaryDrilldownCellKeyboard + jobSummaryBreakdownInteractiveClass) → src/components/jobs/jobSummarySectionChrome.ts (~45 lines) — trivial move that every later section PR imports; doing it first keeps those diffs pure cut/paste.
3. PR 3: extract JobSummaryExpandedHeader → src/components/jobs/JobSummaryExpandedHeader.tsx (~140 lines) — already a module-level leaf component with 4 props; mechanical after PRs 1-2.
4. PR 4: extract renderJobSummarySupplyHouseInvoiceTableContent → src/components/jobs/JobSummarySupplyHouseInvoiceTable.tsx (~72 lines) — leaf renderer used from 5 call sites; must exist before the person-summary and Parts section moves so they import it rather than duplicate it.
5. PR 5: extract JobSummaryHcpFilterFooter → src/components/jobs/JobSummaryHcpFilterFooter.tsx (~57 lines) — leaf footer with 4 props; easy momentum win, independent of everything else.
6. PR 6: extract person-summary footer math → src/lib/jobSummaryPersonSummaryFooter.ts + test (~45 lines) — Stage A before the big Stage-B move: the filtered-vs-full-job footer totals and the $0.02 card-mismatch predicate gain unit tests while still called inline.
7. PR 7: extract JobSummaryTeamLaborSection → src/components/jobs/JobSummaryTeamLaborSection.tsx (~410 lines) — medium: controlled person-expansion Set stays parental (key shape `${jobId}::${i}` is load-bearing for the collapse-pruning in the row toggle); calc already kernel-ized so the diff is a JSX move.
8. PR 8: extract JobSummaryPartsCostSection → src/components/jobs/JobSummaryPartsCostSection.tsx (~440 lines) — medium: self-contained details tree with lazy-load-on-toggle; depends on PRs 2 and 4.
9. PR 9: extract JobSummaryPersonSummarySection → src/components/jobs/JobSummaryPersonSummarySection.tsx (~1,170 lines) — the big one goes last, after chrome (PR 2), supply table (PR 4), and footer kernel (PR 6) have shrunk and de-risked it; optionally land as two PRs (footer row subcomponent first) if review size demands.

### Risks & gotchas

- Quirk #11 (JOBS_TABS_ARCHITECTURE.md): drilldown modal bodies are ReactNodes built at click time and stored in parent state via setJobSummaryCostDrilldown. The person-summary extraction must keep building bodies in click closures and calling the prop — do not convert to a data-driven modal in the same pass.
- All expansion/search state is parent-owned and controlled (expandedJobSummaryJobIds, jobSummaryTeamLaborPersonExpandedKeys, jobSummaryBreakdownPersonSearchByJobId). The row toggle (lines 550-570) prunes person keys by the `${job.id}::` prefix and deletes the per-job search on collapse — extracted sections must receive sets + setters as props, never localize them, or collapse-cleanup breaks (playbook rule 2/3).
- The person-summary section, Sub Labor section, and Team Labor section all read the same breakdownPersonQ filter; the footer totals and the mismatch warning depend on values (sumCardF, unattributedCard, filtered) computed mid-section — extract the whole 701-1874 range as one unit (PR 9) so no cross-section value threading is invented.
- Pre-existing raw neutral hexes (#6b7280 at 1089/1253/1758, #f3f4f6 at 2443, plus border hexes #bfdbfe/#fde68a) currently pass CI; a pure move must keep them byte-identical and must not run theme-tokenize auto-fix over the new files in the same diff, or the PR stops reading as a move.
- Hardcoded fallbacks mileageCost=0.7 / timePerMile=0.02 (lines 534-535) are quirks to preserve verbatim (playbook rule 7).
- Parent-side work (useJobSummaryData, useJobsMercuryAllocations seams, print builders → lib/jobsDocuments) is a separate track already mapped in JOBS_TABS_ARCHITECTURE.md — this plan must not reach into Jobs.tsx beyond the tab's existing props, and printJobSummaryCostBreakdown stays a prop.
- No render-test harness exists: every Stage-B PR is verified only by typecheck/lint/existing tests plus manual expansion of a job row (person drilldowns, lazy Mercury/supply loads, print button) — keep each PR to one section so visual regression surface stays small.
- The inline search predicate (508-515) is trivial but if ever kernel-ized (e.g. into a jobMatchesJobSummarySearch helper) preserve exact trim/lowercase/includes semantics; it also interacts with the parent's ?jobSummaryHcp= deep-link seeding of jobSummarySearch.

---

## src/components/bids/BidsPricingTab.tsx — 2,610 → ~1,160 lines

BidsPricingTab is the Pricing tab of the Bids page (already once-extracted from Bids.tsx; part of the counts→takeoffs→labor→pricing engine cluster fed by useBidPricingEngine via props). It renders: a bid search/list when no bid is selected; for a selected bid, a toolbar (Share/CSV/Print/Review, cost-vs-price view toggle, price-book template picker) and the main pricing grid — per-fixture price-book assignment dropdowns, inline unit-price overrides, margin/%-of-total cells with submission-hide toggles, and a full "Our cost" breakdown footer (materials/labor/travel/direct-costs subtotals). It also owns the collapsible Price Book panel (bid Pricings vs shared Template catalog, entry CRUD), four inline modals (per-row margin breakdown, version form, delete-version confirm, entry form), and wires three already-extracted modals (GenerateUnitCost, AssignTakeoffPart, PackageAndSend). All Supabase CRUD for price_book_versions/price_book_entries/bid_pricing_assignments/bid_count_row_custom_prices/bid_count_row_submission_hides lives inline here.

**Already extracted:** This tab was itself extracted from Bids.tsx (2026-05-30). Prior extractions serving this surface: GenerateUnitCostModal.tsx, AssignTakeoffPartModal.tsx, PackageAndSendBidPricingModal.tsx, BidProjectCell.tsx, MyBidsToggle.tsx, BidWorkflowTabTitleWithPreview.tsx (components); src/lib/bidDocuments/pricingPage.ts (print/CSV builders), src/lib/bidPricingRowCalculations.ts + src/hooks/useBidPricingRows.ts (grid row calc), src/hooks/useBidPricingEngine.ts (data engine, parent-owned), src/lib/bids/{pickActivePricing,resolveCurrentPriceBookTemplateId,bidCostCalc,submissionHides,laborRowHours,bidFormatting,bidStyles}.ts (kernels).

### Internal structure

| Section | Lines | What it is |
|---|---|---|
| Imports + props type | 1-120 | Imports (engine types, pricingPage doc builders, extracted modals) and the ~68-prop BidsPricingTabProps: controlled selection, engine data/loaders from useBidPricingEngine, shared taxPercent, pricingRowsForGrid from useBidPricingRows, navigation callbacks. |
| Module constants + PricingBreakdownRow type | 122-156 | addPricingMenuItemStyle, MARGIN_FLAG_COLOR map, and the self-contained PricingBreakdownRow payload type for the per-line breakdown modal. |
| Component signature + local state | 158-270 | Prop destructuring plus ~30 useStates: search queries, price-book panel open, version/entry form fields, delete-version modal set, templates-panel state (editingTemplateId/templateEntries), assignment search/dropdown, breakdown-row, assign-takeoff row, view model, unit-price edit values, generate-unit-cost params, package-send open. |
| Tab-local effects | 272-315 | Reset modals on service-type change; auto-calc entry total from rough/top/trim; document-level click-outside closer for assignment dropdown + add-pricing menu (keyed on data-* attributes). |
| Pricings-vs-Templates panel derivation + loaders | 317-386 | panelVersions/panelVersionId/panelEntries resolution, isBidOwnedPricing, currentPriceBookTemplateId, loadTemplateEntries (direct supabase read), reloadPanelEntries/Versions, templates-mode default effect, selectPanelVersion. |
| Version-form openers + row resolvers | 388-438 | openAddTemplate/openAddBlankPricing/openClonePricing (set pricingFormMode), resolvePricingEntryForCountRow (assignment or fixture-name match), pricingRowCanToggleOmitFromSubmission. |
| Assignment + override CRUD handlers | 440-576 | savePricingAssignment, removePricingAssignment, togglePricingAssignmentFixedPrice, togglePricingRowOmitFromSubmission, updateUnitPriceOverride (3-branch write across bid_pricing_assignments / bid_count_row_custom_prices). Used only by the grid. |
| Version form + delete handlers | 578-726 | openEditPricingVersion, closePricingVersionForm, savePricingVersion (rename / new template / new blank / clone via clone_price_book_version_to_bid RPC), openDeletePricingVersionModal, confirmDeletePricingVersion (typed-name guard + re-activation cascade via pickActivePricing). |
| Entry form handlers | 728-818 | openNew/openEdit/closePricingEntryForm, savePricingEntry (getOrCreateFixtureTypeId + insert/update against panelVersionId), deletePricingEntry. |
| Version switch / clone / template select | 820-884 | handlePricingVersionChange, attachAndActivateNewBidPricing (stamps bid_version_id, activates + persists), cloneTemplateIntoBidAndActivate, onSelectPriceBookTemplate (reuse-or-clone with pricebookSwitchBusy guard). |
| Print/CSV actions | 886-940 | buildPricingPrintContext (assembles PricingPrintContext from props), printPricingPage, downloadPricingCsv (blob download + toast), printAllPricingPages — all delegate to lib/bidDocuments/pricingPage. |
| Bid list filter | 942-952 | onlyMyBids scope + text search across project/address/customer/builder/bid-number. |
| Render: search bar, detail header + toolbar, picker | 954-1195 | Search input + MyBidsToggle; selected-bid card header with Share/CSV/Print/Review/close buttons; Cost-vs-Price view toggle; price-book template dropdown; Apply Matching Price Book Entries button; go-to-Labor prompt. |
| Render: pricing grid (IIFE) | 1196-1927 | Large IIFE computing totalCost breakdown (materials + labor + driving + estimator + travel + team labor + 5 direct-cost buckets), mapping pricingRowsForGrid into display rows, uncosted-revenue detection; then the table: assignment search dropdowns, fixed-price checkbox, inline unit-price override input + GenerateUnitCost trigger, revenue/margin cells with breakdown + submission-hide toggles, cost-breakdown footer rows with tab-navigation links, total + uncosted warning rows. |
| Render: per-line breakdown modal (inline) | 1930-2069 | Revenue → Our cost → Margin dialog fed entirely by the PricingBreakdownRow payload; uncosted-fixture warning; only external dep is setPricingBreakdownRow(null). |
| Render: AssignTakeoffPartModal wiring | 2070-2085 | Already-extracted modal; onAssigned reloads pricing for the bid. |
| Render: bid list table | 2086-2112 | Project + Bid Date table over filteredBidsForPricing when no bid selected. |
| Render: Price Book panel | 2113-2341 | Collapsible section: Pricings-vs-Templates toggle, template chip list with edit buttons, 'Set up pricing' dropdown menu (blank/duplicate/from-template), entries table with search + add-from-search, Add entry button. |
| Render: version form modal (inline) | 2342-2395 | Name input; title branches on editing/template/clone mode; Delete-version button opens the confirm modal. |
| Render: delete-version confirm modal (inline) | 2396-2486 | Type-the-name-to-confirm destructive modal with 90-day-restore copy. |
| Render: entry form modal (inline) | 2487-2569 | Fixture datalist + rough/top/trim inputs, auto-calculated read-only total, delete branch; shows the shared error prop inline. |
| Render: extracted-modal wiring | 2572-2607 | GenerateUnitCostModal (onApply → updateUnitPriceOverride) and PackageAndSendBidPricingModal (fed by pricingPackageSource prop). |

### Extraction candidates (easiest/safest first)

1. **BidPricingBreakdownModal** — component, ~155 lines, low risk → `src/components/bids/BidPricingBreakdownModal.tsx`
   - Inputs: row: PricingBreakdownRow (move the type + MARGIN_FLAG_COLOR-independent styles with it), onClose: () => void
   - Notes: Lines 1930-2069 + type at 143-156. The payload was deliberately designed self-contained — zero closure captures beyond onClose. Purest leaf extraction in the file; parent keeps the pricingBreakdownRow state and renders the component.
2. **pricingCostBreakdown** — kernel, ~120 lines, low risk, unit-testable → `src/lib/bids/pricingCostBreakdown.ts`
   - Inputs: costEstimate, laborRows, equipment/permit/subcontractor/waste/other rows, materialTotal(RoughIn|TopOut|TrimSet), laborRate, distanceFromOffice, taxPercent, teamLaborCost, countRowsLength
   - Notes: Stage A for the grid move. Lifts lines 1197-1219 (totalMaterials, laborCost, numTrips/drivingCost, estimatorCost, travelCost, 5 direct-cost buckets, totalCost) plus the labor/direct-cost subtotal math at 1815 and 1857, and the uncosted-revenue bucketing at 1270-1273, into a pure function returning a named breakdown object. Composes existing lib/bids/bidCostCalc helpers; colocated pricingCostBreakdown.test.ts. Puts the money math under tests before the big Stage-B grid move.
3. **BidPricingVersionModals** — component, ~150 lines, low risk → `src/components/bids/BidPricingVersionModals.tsx`
   - Inputs: Controlled: formOpen, editingVersion, formMode, nameInput + setter, saving, onSubmit(savePricingVersion), onCancel, onRequestDelete; deleteOpen, versionToDelete, deleteNameInput + setter, deleteError, onConfirmDelete, onCancelDelete
   - Notes: Lines 2342-2486 (version form + delete-confirm dialogs) as one controlled-modals file, matching the JobFormDeleteMigrateModals precedent. All state + the savePricingVersion/confirmDeletePricingVersion handlers stay in the parent (they touch template loading, activation cascade, loadBids); the diff is pure JSX relocation.
4. **BidPricingEntryFormModal** — component, ~95 lines, low risk → `src/components/bids/BidPricingEntryFormModal.tsx`
   - Inputs: Controlled: open (pricingEntryFormOpen && panelVersionId), editingEntry, fixtureName/roughIn/topOut/trimSet/total values + setters, saving, error, fixtureTypes, onSubmit(savePricingEntry), onCancel, onDelete
   - Notes: Lines 2487-2569. Must stay controlled: the fixture-name field is prefilled from two other surfaces (grid assignment dropdown 'Add to Price Book' at 1438-1447 and panel search add at 2304-2312), so field state remains parent-owned until both callers are extracted. The auto-total effect (291-301) stays in the parent with the state.
5. **BidsPricingPriceBookPanel** — component, ~300 lines, medium risk → `src/components/bids/BidsPricingPriceBookPanel.tsx`
   - Inputs: templatesMode + setTemplatesMode, templatePriceBookVersions, priceBookVersions, selectedPricingVersionId, setError; callbacks: onSelectPanelVersion, onOpenAddTemplate, onOpenAddBlankPricing, onOpenClonePricing, onOpenEditVersion, onOpenEditEntry, onOpenNewEntry, onRequestNewEntryFromSearch(name)
   - Notes: Lines 2113-2341 (render) + templates-panel substrate at 317-386: editingTemplateId/templateEntries state, loadTemplateEntries, the templates-mode default effect, and priceBookSectionOpen/priceBookSearchQuery/addPricingMenuOpen state move in. Wrinkles: panelVersionId/panelEntries are also read by parent-owned savePricingEntry and the entry-modal open gate — either lift editingTemplateId back up as a controlled prop or have the panel report it via onEditingTemplateChange; and the add-pricing-menu click-outside listener (309-311) must move with addPricingMenuOpen while the assignment-dropdown half stays with the grid.
6. **BidsPricingGrid** — component, ~850 lines, high risk → `src/components/bids/BidsPricingGrid.tsx`
   - Inputs: selectedBidForPricing, selectedPricingVersionId, engine data (pricingCountRows, pricingLaborRows, cost rows, material totals, laborRate, fixtureMaterialsFromTakeoff, assignments, customPrices, submissionHides), pricingRowsForGrid, teamLaborDataForBids, taxPercent, pricingViewModel, priceBookEntries, loadBidPricingAssignments, setError; callbacks: onOpenBreakdown(row), onAssignTakeoff(row), onRequestNewPriceBookEntry(name), onNavigateBidToTab, onNavigateToLaborDirectCosts
   - Notes: Lines 1196-1927 (the grid IIFE + table) plus its private substrate: assignment CRUD handlers 440-576 (grid-only consumers), resolvePricingEntryForCountRow + omit-toggle guard 416-438, and grid-local state (pricingAssignmentSearches, pricingAssignmentDropdownOpen + its click-outside half, unitPriceEditValues, savingUnitPriceOverride, savingPricingAssignment, generateUnitCostModalParams) with the GenerateUnitCostModal wiring (2572-2586) moving in since updateUnitPriceOverride is its onApply. Do LAST: after PRs 1-5 its modals are components and its totals math is a tested kernel, so the diff reads as a cut/paste move despite the size. 'Apply Matching Price Book Entries' button (1157-1182) writes pricingAssignmentSearches, so it moves too or gets a callback.

### Suggested PR sequence

1. PR 1: extract BidPricingBreakdownModal (~155 lines) — the per-line margin-breakdown dialog has a deliberately self-contained payload type and only an onClose callback; zero-risk leaf that validates the seam.
2. PR 2: Stage A — extract pricingCostBreakdown kernel to src/lib/bids/pricingCostBreakdown.ts + tests (~100 lines out of the component) — puts the grid's totalCost/subtotal/uncosted-revenue money math under unit tests before any grid JSX moves; composes existing bidCostCalc helpers.
3. PR 3: extract BidPricingVersionModals (~150 lines) — version form + delete-confirm as controlled modals (JobFormDeleteMigrateModals pattern); save/delete handlers stay in the parent because they drive the activation cascade and template reloads.
4. PR 4: extract BidPricingEntryFormModal (~95 lines) — controlled fields because the grid dropdown and the price-book panel both prefill the fixture name; pure JSX relocation.
5. PR 5: extract BidsPricingPriceBookPanel (~300 lines) — takes the templates-panel state, loadTemplateEntries, and section/search/menu state with it; modal openers arrive as callbacks (modals already extracted in PRs 3-4), so coupling is now just callbacks + the panelVersionId hand-back.
6. PR 6: extract BidsPricingGrid (~850 lines) — the big one, last: with its modals componentized (PRs 1, 3, 4) and its math kerneled (PR 2), the remaining diff is a mostly-mechanical move of the table JSX, the assignment/override CRUD handlers, grid-local edit state, and the GenerateUnitCostModal wiring.

### Risks & gotchas

- No render-test harness — every Stage-B move is verified only by typecheck/lint/unit tests plus a manual smoke pass in the preview browser (which holds the user's signed-in prod session; look, don't write).
- The document-level click-outside effect (lines 303-315) serves two unrelated dropdowns via data-* attributes; it must be split so the assignment-dropdown half moves with the grid (PR 6) and the add-pricing-menu half with the panel (PR 5) — merging or dropping either breaks close-on-outside-click.
- Entry-form prefill is invoked from three call sites (grid dropdown, panel search, Add entry); its field state must stay parent-owned through PR 4-6, with extracted callers using an onRequestNewPriceBookEntry(name) callback — letting the modal own its fields would break the prefill paths.
- panelVersionId/panelEntries (templates-vs-pricings resolution) are read by both the panel render and the parent-owned savePricingEntry + entry-modal gate; PR 5 must keep editingTemplateId observable by the parent (controlled prop or change callback) or entry saves in Templates mode will target the wrong version.
- updateUnitPriceOverride has a 3-branch write path across bid_pricing_assignments and bid_count_row_custom_prices — move it verbatim in PR 6 (behavior-preserving only); it is exercised from both the inline input and GenerateUnitCostModal.onApply, so both must move together.
- Moved JSX carries pre-existing raw neutral hexes (#374151, #9ca3af, #f3f4f6, borderTop '#fde68a') into new files — run node scripts/theme-tokenize.mjs --check src before each PR; if the check flags the new file, tokenize only via the script's auto-fix, not by hand-redesigning colors.
- The delete-version cascade (confirmDeletePricingVersion) touches selection re-activation, saveBidSelectedPriceBookVersion, and loadBids — it stays in the parent permanently; only its dialogs extract (PR 3).
- Parallel WIP exists in the working tree (feat/edit-job-ux-polish); stage only the extraction's files per PR, never git add -A.

---

## src/pages/Checklist.tsx — 2,533 → ~240 lines

Checklist page: a five-tab surface (Today / History / Review / Manage / Roadmap) for personal and team recurring-task checklists backed by checklist_items (templates), checklist_instances (dated occurrences), and their assignee join tables. The parent component is already a thin tab router (~190 lines) that owns role loading, ?tab= / ?roadmap= URL state, the shared ChecklistItemEditModal (editItemId), and the page error banner. All the weight is in four tab components defined inline in the same file: ChecklistTodayTab (complete/uncomplete with optimistic update, notes autosave, forward-task modal, mute modal, repeat-on-completion instance creation), ChecklistHistoryTab (per-user completion heat-grid with dev-only cell-cycling edit mode), ChecklistOutstandingTab a.k.a. the Review tab (outstanding-by-person table with dnd-kit reordering, remind push notifications, dev mark-complete/delete/forward, plus ChecklistReviewInboxes), and ChecklistManageTab (template CRUD table with Incomplete/Repeating/Complete sections, search, assignee filter, delete-confirm modal). The Roadmap tab (ChecklistTechTreeTab) and review inboxes were already extracted to src/components/checklist/.

**Already extracted:** src/components/checklist/ already holds ChecklistTechTreeTab.tsx (Roadmap tab) plus its satellite modals/toolbar (ChecklistTechTreeAddGroupModal, AddTaskModal, GroupModal, LineUpModal, LinksModal, MapActionIconButtons, RoadmapBar, RoadmapMembersModal, RoadmapToolbar) and ChecklistReviewInboxes.tsx; src/components/ holds ChecklistAddModal.tsx (opened via ChecklistAddModalContext), ChecklistItemEditModal.tsx, ChecklistItemMuteModal.tsx, ChecklistTitleWithLinks.tsx; src/lib/ holds tested kernels checklistTechTreeGraph.ts, checklistTechTreeLayout.ts, checklistTechTreeSearch.ts; src/utils/checklistOrder.ts (getNextDisplayOrders). No docs/CHECKLIST_TABS_ARCHITECTURE.md map exists yet.

### Internal structure

| Section | Lines | What it is |
|---|---|---|
| Imports + module types + helpers | 1-55 | Imports (dnd-kit, supabase, extracted checklist components), UserRole and ChecklistTab types, ChecklistInstance shared type, tabStyle alias, toLocalDateString() date helper used by 3 tabs |
| Checklist parent (tab router) | 57-247 | Role load, ?tab= URL sync with role-based default, canManageChecklists/canEditTechTree gates, editItemId + shared ChecklistItemEditModal, error banner, tab-strip JSX, thin renders of the five tabs (Roadmap already a wrapper around ChecklistTechTreeTab) |
| ChecklistTodayTab | 249-868 | Today + Upcoming lists: loadToday (overdue show_until_completed merge + display_order sort), loadUpcoming, toggleComplete with optimistic update + in-flight ref, sendCompletionNotifications, maybeCreateNextInstance (days_after_completion repeat), notes autosave, isNotificationRecipient, mute modal wiring, and an inline Forward-task modal (770-856) with its saveFwd (532-583) |
| ChecklistHistoryTab | 870-1125 | Per-user completion grid over N months: loadHistory, byItem/sortedDates/instanceByKey pure bucketing built inline in render (930-955), dev-only edit mode handleCycleStatus (957-1026) cycling incomplete->deleted->completed, heat-grid table render with status colors |
| OutstandingInstance type + sortable row/list | 1127-1380 | OutstandingInstance type (1127-1132); OutstandingByPersonSortableRow (1134-1311): useSortable row with drag handle + dev complete/edit/delete/forward icon buttons; OutstandingByPersonSortableList (1313-1380): DndContext/SortableContext wrapper with non-manager plain-list fallback |
| ChecklistOutstandingTab (Review tab) | 1382-2068 | Outstanding-by-person: loadOutstanding with dateRange filters + per-user grouping and display_order sort (1649-1741), checklist-item-saved window listener, markComplete (dup of notify + next-instance logic, 1455-1530), saveFwd (dup of Today's, 1532-1582), sendReminder body composition (1584-1609), drag reorder persistence (1611-1647), by-person table + expanded sortable list render, ChecklistReviewInboxes, inline delete-confirm modal (1900-1978), inline Forward-task modal (1979-2065) |
| ChecklistItem type + ChecklistManageTab | 2070-2533 | ChecklistItem template type (2070-2088); Manage tab (2090-2533): loadItems with per-item instance completion derivation, checklist-item-saved listener, search filter memo, isRepeating/isItemComplete classification + Incomplete/Repeating/Complete orderedEntries builder (2200-2240), repeat-label + start-date formatting inline in cells (2402-2419), delete-confirm modal (2445-2521), mute modal |

### Extraction candidates (easiest/safest first)

1. **checklistRepeat kernel (types + date helpers)** — kernel, ~60 lines, low risk, unit-testable → `src/lib/checklist/checklistRepeat.ts`
   - Inputs: scheduled_date string, repeat_type, repeat_days_after, repeat_end_date; also exports toLocalDateString and the shared ChecklistInstance type (or split types into src/lib/checklist/checklistTypes.ts in the same PR)
   - Notes: computeNextInstanceDate() is duplicated verbatim in ChecklistTodayTab.maybeCreateNextInstance (459-494) and ChecklistOutstandingTab.markComplete (1497-1523). Pure date math -> unit tests. Rewire both call sites; supabase inserts stay put.
2. **checklistNotificationRecipients kernel** — kernel, ~40 lines, low risk, unit-testable → `src/lib/checklist/checklistNotificationRecipients.ts`
   - Inputs: item {notify_on_complete_user_id, notify_creator_on_complete, created_by_user_id}, authUserId
   - Notes: getCompletionRecipients() duplicated in sendCompletionNotifications (436-441) and markComplete (1481-1486); isNotificationRecipient() duplicated at 506-517 and 2193-2198. Four copies collapse to two tested functions.
3. **ChecklistForwardTaskModal** — component, ~220 lines, medium risk → `src/components/checklist/ChecklistForwardTaskModal.tsx`
   - Inputs: instance {id, checklist_item_id, scheduled_date, title}, initialAssigneeId ('' from Today, rowUserId from Review), users list, authUserId, onClose, onSaved (Today reloads today+upcoming; Review reloads outstanding), setError
   - Notes: The Forward-task modal JSX (770-856 and 1979-2065) and saveFwd (532-583 and 1532-1582) are near-identical duplicates. Modal owns fwdTitle/fwdAssigneeId/fwdSaving. This is a consolidation, not a pure move: preserve the two initial-assignee behaviors and the quirk that the select has no empty option (Today opens with fwdAssigneeId='' so submit stays disabled until a pick). Removes ~300 lines from the page.
4. **checklistHistoryGrid kernel** — kernel, ~50 lines, low risk, unit-testable → `src/lib/checklist/checklistHistoryGrid.ts`
   - Inputs: instances ChecklistInstance[], selectedUserId
   - Notes: buildChecklistHistoryGrid() -> {byItem, sortedDates, instanceByKey} from the inline render-body computation at 930-955, including the completed/completed_by_other/incomplete status rule. Pure, easy tests.
5. **ChecklistHistoryTab** — component, ~260 lines, low risk → `src/components/checklist/ChecklistHistoryTab.tsx`
   - Inputs: authUserId, canViewOthers, canEditHistory, setError
   - Notes: Fully leaf: props already exactly match the current inline signature (870). Owns users/selectedUserId/monthsBack/editMode/cyclingCell/deletedCells and handleCycleStatus. Straight cut/paste move.
6. **checklistManageSections kernel** — kernel, ~100 lines, low risk, unit-testable → `src/lib/checklist/checklistManageSections.ts`
   - Inputs: items ChecklistItem[], itemCompletion map, searchQuery, completedOpen
   - Notes: isRepeating, isItemComplete, filterItems (search over title+assignees, 2179-2191), buildManageRowEntries (2225-2240), formatRepeatLabel (2402-2409), formatStartDate (2412-2419); exports the ChecklistItem type. All pure and testable.
7. **ChecklistManageTab** — component, ~450 lines, low risk → `src/components/checklist/ChecklistManageTab.tsx`
   - Inputs: authUserId, role, setError, setEditItemId
   - Notes: Leaf tab; props already match inline signature (2090). Owns items/users/filter/search/mute/delete-modal state, loadItems + instance-completion derivation, and the checklist-item-saved window listener (keep the global event contract). Uses ChecklistAddModalContext internally - fine to keep the hook call inside.
8. **ChecklistTodayTab** — component, ~460 lines, low risk → `src/components/checklist/ChecklistTodayTab.tsx`
   - Inputs: authUserId, isDev, setError
   - Notes: ~620 lines today; ~460 after the fwd modal + repeat/notification kernels land. Owns today/upcoming loads, optimistic toggleComplete with toggleCompleteInFlightRef, notes autosave, mute modal. Props already match inline signature (249).
9. **checklistOutstanding kernel** — kernel, ~90 lines, low risk, unit-testable → `src/lib/checklist/checklistOutstanding.ts`
   - Inputs: raw query rows, dateRange, display_order rows
   - Notes: groupOutstandingByUser() = filter (assignees>0, repeat_type==='once' for non_repeating, reminder_scope filter for missed) + per-user grouping + display_order sort + count-desc sort (1676-1740); buildReminderBody(titles) (1586-1593). Pure and testable. Date-window computation stays at the call site (uses Date.now).
10. **ChecklistOutstandingSortableList (+Row)** — component, ~250 lines, low risk → `src/components/checklist/ChecklistOutstandingSortableList.tsx`
   - Inputs: userId, instances, reorderingUserId, canManageChecklists, isDev, onDragEnd, completingInstanceId, deletingInstanceId, onMarkComplete, onDeleteInstance, onOpenFwd, setEditItemId; exports the OutstandingInstance type (or move it to lib/checklist types)
   - Notes: OutstandingByPersonSortableRow (1134-1311) + OutstandingByPersonSortableList (1313-1380) already have fully explicit prop interfaces - zero closure captures. Pure cut/paste into one file.
11. **ChecklistReviewTab** — component, ~480 lines, medium risk → `src/components/checklist/ChecklistReviewTab.tsx`
   - Inputs: authUserId, isDev, canManageChecklists, setError, setEditItemId
   - Notes: The remaining ChecklistOutstandingTab body (~690 now; ~480 after fwd modal + kernels): loadOutstanding, markComplete, sendReminder, drag persistence, delete-confirm modal, ChecklistReviewInboxes render, checklist-item-saved listener, ChecklistAddModalContext. Medium only because it is the largest move and the tab is the role-gated default landing tab - verify the deep-link default still works.

### Suggested PR sequence

1. PR 0 (with PR 1): write docs/CHECKLIST_TABS_ARCHITECTURE.md per the playbook's Step 0 - the map does not exist yet; cheap since this plan is the inventory.
2. PR 1: Stage A - extract src/lib/checklist/checklistRepeat.ts (+ checklistTypes.ts for ChecklistInstance/UserRole) with computeNextInstanceDate + toLocalDateString + tests (~60 lines) - lowest risk, kills the Today/Review duplication of the repeat-date math, and creates the lib/checklist/ home every later PR imports from.
3. PR 2: Stage A - extract src/lib/checklist/checklistNotificationRecipients.ts + tests (~40 lines) - dedupes 4 copies of recipient/mute-visibility logic across Today, Review, and Manage before those tabs move.
4. PR 3: extract ChecklistForwardTaskModal.tsx (~220 lines, removes ~300) - consolidates the twin fwd modals + saveFwd so Today and Review both shrink before their Stage-B moves; the one extraction needing careful behavior-preservation review (initial assignee, post-save reload callbacks).
5. PR 4: Stage A - extract src/lib/checklist/checklistHistoryGrid.ts + tests (~50 lines) - History's only logic, done right before its move.
6. PR 5: Stage B - move ChecklistHistoryTab.tsx (~260 lines) - smallest tab, props already explicit; validates the component seam.
7. PR 6: Stage A - extract src/lib/checklist/checklistManageSections.ts + tests (~100 lines) - Manage's classification/section/label logic gains tests before the UI moves.
8. PR 7: Stage B - move ChecklistManageTab.tsx (~450 lines) - leaf tab, carries its window-event listener and delete/mute modals with it.
9. PR 8: Stage B - move ChecklistTodayTab.tsx (~460 lines) - now slim after PRs 1-3; owns its optimistic-toggle state.
10. PR 9: Stage A - extract src/lib/checklist/checklistOutstanding.ts + tests (~90 lines) - Review's grouping/filtering/reminder-body logic tested before the big move.
11. PR 10: Stage B - move ChecklistOutstandingSortableList.tsx (+Row, ~250 lines) - already prop-driven with zero closure captures; shrinks the Review tab before its own move.
12. PR 11: Stage B - move ChecklistReviewTab.tsx (~480 lines) - last and largest move, smallest possible diff after PRs 3, 9, 10; verify the role-based default-tab deep link still lands on Review.

### Risks & gotchas

- The Forward-task modal extraction (PR 3) is a consolidation of two near-duplicates, not a pure move: the copies differ in initial assignee ('' vs rowUserId) and post-save reloads (today+upcoming vs outstanding); both behaviors and the no-empty-option select quirk (submit disabled until a user is picked in Today) must be preserved via props.
- Two tabs (Review, Manage) subscribe to the global 'checklist-item-saved' window event fired by ChecklistAddModal/EditModal - the listeners must move with their tabs and the event name must not change, or saves stop refreshing lists.
- Date logic is timezone-sensitive: toLocalDateString uses local time while loadOutstanding uses toLocaleDateString('en-CA'); kernel tests must construct dates explicitly and not assume UTC, and the quirky next_day/next_week start computation (both use tomorrow) is a preserve-as-is quirk.
- toggleComplete's optimistic update + in-flight ref and History's deletedCells 2-second visual-delete timeout are fragile interaction sequences - Stage-B moves must be verbatim cut/paste, no 'improvements'.
- Several raw hexes exist in the moved JSX (#3b82f6 buttons, #22c55e/#eab308/#ef4444 heat-grid, #b91c1c delete, #f3f4f6 row borders) - the saturated action/status ones are allowed literal, but #f3f4f6/#f9fafb/#d1d5db are raw neutrals that scripts/theme-tokenize.mjs may flag once lines move; run the checker and let it auto-fix rather than hand-editing (behavior-preserving).
- Review is the role-gated default tab written into the URL on first load - after PR 11 confirm the ?tab default replace still works for dev/master/assistant roles.
- No docs/CHECKLIST_TABS_ARCHITECTURE.md exists; the playbook requires the Step-0 map before extraction starts (folded into PR 1).

---

## src/components/jobs/SendRecordInvoiceModal.tsx — 2,451 → ~1,080 lines

The "Bill Customer" modal: a three-tab surface (Stripe hosted invoice / HouseCall Pro outside-bill record / Physical PDF invoice email) opened from Jobs or Edit Job with either a job payload or a specific ledger-invoice payload. It ensures a single ready-to-bill invoice row via RPC, fetches full job details for line items, debounce-previews the Stripe invoice through the preview-stripe-invoice edge function, and submits via create-stripe-invoice / send-physical-invoice-email edge functions or a direct jobs_ledger_invoices update for outside bills, promoting the job to Billed on success. It also hosts an Edit-Dates sub-modal, a lowercase-leading-description lint hint shared by two tabs, dev-only Stripe live/test mode toggling, and click-to-edit wiring into BillCustomerPreviewLineEditModal for fixture/material/override line edits. Nearly all document/preset/parsing logic already lives in src/lib (physicalInvoiceDocument/Pdf/Footer, stripeInvoicePreview/Footer/LineDescription, billCustomerMemoPresets, billCustomerPreviewLineRefs), so the remaining bulk is state orchestration and three large inline tab JSX blocks with heavily repeated disclosure-section markup.

**Already extracted:** Extensive prior work sits beside the file: SendRecordInvoiceModal.types.ts (payload types); leaf components BillCustomerPreviewLineEditModal, PhysicalInvoicePreview, StripeBillPreSubmitPreview, HostedStripeBillPanel, StripeInvoiceSharePanel, StripeInvoicePreviewMeta, StripeInvoiceLinesSummary, StripeInvoiceSendFromStripeButton, StripeBillingModeToggle; and lib kernels billCustomerMemoPresets, billCustomerPreviewLineRefs, billCustomerInvoiceDescriptionIssueChrome, physicalInvoiceDocument/Pdf/Footer/Issuer/JobContext/LineItems, stripeInvoicePreview/Footer/LineDescription/ShareCopy, billingStripeModePref, invoiceLineDescriptionLeadingLowercase, promoteJobToBilledIfFullyInvoiced, jobLedgerCustomerForBilling, fetchJobWithDetailsById — do not re-propose any of these.

### Internal structure

| Section | Lines | What it is |
|---|---|---|
| Imports + re-exported types | 1-89 | ~35 imports (mostly already-extracted lib kernels and sibling components); re-exports JobBillingContext and SendRecordInvoicePayload. |
| Module constants, styles, and pure helpers | 91-260 | BillCustomerMainTab type; lowercase-hint copy + style; 9 CSSProperties style constants (field label, control, textarea, disclosure toggle, modifications shell/title, date-link button) + billCustomerTopTabButtonStyle(); pure helpers billCustomerLineOnBillSummaryLine, todayIsoDate, defaultStripeLineDescriptionFromJob, jobHasBillableStripeSpecificWorkFixtures, stripeInvoiceFooterSummaryLine. |
| BillCustomerMemoPresetRow embedded component | 262-329 | Leaf preset-chip row (apply/clear memo presets) used by all three tabs; props presets/valueForHighlight/onApplyBoth only. |
| CreateStripeInvoiceFnResponse type + component signature | 331-361 | Edge-function response shape; component props (payload, onClose, onSuccess, onAfterEnsureSuccess, onAfterOobUnwindSuccess, jobUpdating, invoiceUpdating, overlayZIndex). |
| State declarations + small callbacks | 362-462 | ~30 useState hooks (tab, dates, memos, footers, disclosure-open flags, ensure/preview/submit state, stripeResult/stripeSuccessInvoice, mode pref); payload destructuring; handleHostedStripeOobUnwindSuccess, handleAfterVoidStripeInvoiceSuccess, applyMemoPresetToBoth; preset memos. |
| Open/reset + presets-fetch + job-details effects | 464-562 | Reset-all-state-on-open effect (464-519); fetch footer/memo/issuer presets from app settings then re-default (521-543); fetch JobWithDetails and compute stripeFixtureMultiLineAvailable (545-562). |
| Ensure-RTB-invoice effect | 564-623 | RPC ensure_single_ready_to_bill_invoice_for_job when opened for a job row; sets ensuredInvoice/billAmountStr; calls onAfterEnsureSuccess. |
| Debounced Stripe preview effect | 625-743 | 450ms-debounced invoke of preview-stripe-invoice with request-id race guarding and stale-while-revalidate ref; canPreview gate; 20-entry dependency array. |
| Submit handlers | 745-1001 | submitPhysicalInvoiceEmail (745-846: build doc, PDF blob->base64, invoke send-physical-invoice-email, promote to billed); confirmOutsideBill (848-906: update jobs_ledger_invoices to billed via housecallpro channel); submitStripeInvoice (908-1001: invoke create-stripe-invoice, promote, refetch job for success panel). |
| Derived memos + line-edit session wiring | 1003-1147 | lineLeadingLowercaseHint memo collecting candidate descriptions per tab (1003-1058); physicalFixture/MaterialEditRefs + physicalPreviewDbBacked memos; lineEditSession state + handleStripePreviewLineClick / openPhysicalServiceLineEdit / openPhysicalMaterialLineEdit callbacks. |
| Guards, no-customer early return, derived render values | 1149-1258 | null/open guard; busy flag; no-customer-linked blocking mini-modal (1155-1188); outsideReady/physicalSendReady flags; physicalDocPreview build; openPhysicalInvoicePdfInNewTab; date-input style. |
| Modal shell: header + tab bar | 1260-1339 | Overlay + card, title with RTB amount, dev-only StripeBillingModeToggle, three tab buttons. |
| HouseCall Pro tab render | 1341-1432 | Ensure status lines, date input, memo disclosure (preset row + textarea), error, Cancel/Save calling confirmOutsideBill. |
| Physical invoice tab render | 1434-1856 | Ensure/email warnings; Invoice Modifications shell with three disclosure sections (line-item override, memo, physical footer with preset chips); service/due date link buttons opening edit-dates modal; PDF Preview button; PhysicalInvoicePreview with click-to-edit rows; lowercase hint; Cancel/Send email. |
| Stripe tab render | 1858-2342 | Ensure status; success branch A HostedStripeBillPanel (1866-1882); success branch B fallback share panel + StripeInvoicePreviewMeta/LinesSummary (1883-1945); form branch: Invoice Modifications shell with line-override/memo/Stripe-footer disclosures incl. Plumbing/Electrical preset buttons (1948-2259), StripeBillPreSubmitPreview (2260-2298), error + lowercase hint, Cancel/Create Stripe invoice. |
| Edit-dates sub-modal | 2345-2434 | Overlay dialog editing draftServiceYmd (physical only) + draftDueYmd, Save commits to sentDate/stripeDueDate. |
| BillCustomerPreviewLineEditModal mount | 2435-2451 | Line-edit modal wired to lineEditSession with refresh callbacks. |

### Extraction candidates (easiest/safest first)

1. **billCustomerModalKernels (pure helpers)** — kernel, ~90 lines, low risk, unit-testable → `src/lib/billCustomerModalKernels.ts`
   - Inputs: None (pure functions): billCustomerLineOnBillSummaryLine(line), todayIsoDate(), defaultStripeLineDescriptionFromJob(job: JobBillingContext), jobHasBillableStripeSpecificWorkFixtures(fixtures), stripeInvoiceFooterSummaryLine(footer, activePreset) — plus constants BILL_CUSTOMER_LINE_ON_BILL_SUMMARY_MAX, BILL_CUSTOMER_LINE_ON_BILL_PLACEHOLDER, BILL_CUSTOMER_LEADING_LOWERCASE_HINT
   - Notes: Stage A per playbook. Colocate billCustomerModalKernels.test.ts covering summary truncation at 48 chars, billable-fixture qty/unit edge cases (count null -> qty 1, zero-dollar rows skipped), and footer summary branches. jobHasBillableStripeSpecificWorkFixtures notes it mirrors the Edge buildStripeInvoiceItemsFromFixtures — preserve exactly.
2. **billCustomerModalStyles (shared style constants)** — constants, ~115 lines, low risk → `src/components/jobs/billCustomerModalStyles.ts`
   - Inputs: None: BILL_CUSTOMER_FIELD_LABEL_STYLE, BILL_CUSTOMER_CONTROL_STYLE, BILL_CUSTOMER_TEXTAREA_STYLE, BILL_CUSTOMER_DISCLOSURE_TOGGLE_STYLE, BILL_CUSTOMER_MODIFICATIONS_STACK_STYLE, BILL_CUSTOMER_INVOICE_MODIFICATIONS_SHELL_STYLE, BILL_CUSTOMER_INVOICE_MODIFICATIONS_TITLE_STYLE, BILL_CUSTOMER_PHYSICAL_DATE_LINK_BUTTON_STYLE, billCustomerLeadingLowercaseHintParagraphStyle, billCustomerTopTabButtonStyle(active)
   - Notes: Prerequisite for every later component move — the tab components all consume these styles, so they must live in an importable module first. CSSProperties objects, so a components/ (or lib/, matching scheduleBlockActionChromeStyle.ts) module both fit; keep theme tokens as-is.
3. **BillCustomerMemoPresetRow** — component, ~70 lines, low risk → `src/components/jobs/BillCustomerMemoPresetRow.tsx`
   - Inputs: presets: BillCustomerMemoPreset[], valueForHighlight: string, onApplyBoth: (body: string) => void
   - Notes: Already a fully-formed module-level leaf component (lines 262-329) with zero closure captures — a pure cut/paste move. Used by all three tabs, so it must be page-level (shared) per the playbook's modal-opened-from-2+-tabs rule.
4. **BillCustomerEditDatesModal** — component, ~95 lines, low risk → `src/components/jobs/BillCustomerEditDatesModal.tsx`
   - Inputs: open, showServiceDate (tab === 'physical'), draftServiceYmd + onDraftServiceYmdChange, draftDueYmd + onDraftDueYmdChange, onCancel, onSave, zIndex (overlayZIndex + 20)
   - Notes: Lines 2345-2434. Leaf sub-modal; drafts stay controlled in the parent so the Save commit logic (physical also sets sentDate) is a parent callback — behavior identical. Matches the JobFormDeleteMigrateModals precedent of extracting embedded modals first.
5. **collectBillCustomerLineDescriptionsForHint** — kernel, ~55 lines, low risk, unit-testable → `src/lib/billCustomerLowercaseHintDescriptions.ts`
   - Inputs: Pure function of: job (JobBillingContext), tab, trimmed stripeLineDescription override, stripePreview lines, physicalDoc (already-built PhysicalInvoiceDocument | null) — returns string[] fed to existing invoiceDescriptionsNeedLowercaseLeadingHint
   - Notes: Stage A for the lineLeadingLowercaseHint memo (1003-1058). Pass the built physical doc in rather than rebuilding it inside the kernel (the memo currently rebuilds buildPhysicalInvoiceDocument — preserve by building in the caller and passing down; note this duplicate build as a preserved quirk). Unit-test the per-tab description collection branches.
6. **useBillCustomerStripePreview** — hook, ~135 lines, medium risk → `src/hooks/useBillCustomerStripePreview.ts`
   - Inputs: open, job (id/customer_id/customer_email/customer_name), tab, suppress flag (stripeResult || stripeSuccessInvoice), billAmountStr, stripeDueDate, kind, invoiceId, ensuredInvoiceId, ensureLoading, ensureError, stripeLineDescription, stripeModeForBilling, stripeFixtureMultiLineAvailable — returns { stripePreview, stripePreviewLoading, stripePreviewError }
   - Notes: Moves the debounced preview effect (625-743) plus its state (414-419) and both refs (reqId, stale-while-revalidate existsRef) into one hook. Self-contained: nothing else writes stripePreview except the open-reset effect — replicate that reset inside the hook keyed on open. Keep the 450ms debounce, race-guard, and canPreview gate byte-identical; the 20-entry dep array must be reproduced faithfully.
7. **BillCustomerHousecallProTab** — component, ~95 lines, low risk → `src/components/jobs/BillCustomerHousecallProTab.tsx`
   - Inputs: kind, ensureLoading, ensureError, sentDate + onSentDateChange, externalNote + onExternalNoteChange, memoSectionOpen + onToggleMemoSection, memoPresets, onApplyMemoPresetToBoth, outsideError, outsideReady, busy, onCancel (onClose), onConfirmOutsideBill, billDateInputStyle
   - Notes: Lines 1341-1432, the smallest tab. Note memoSectionOpen and externalNote are shared with the physical/stripe tabs, so they stay parent-owned and come down as controlled props per the playbook. confirmOutsideBill stays in the parent (writes shared ensure/promote flow) and is passed as a callback.
8. **BillCustomerPhysicalInvoiceTab** — component, ~430 lines, medium risk → `src/components/jobs/BillCustomerPhysicalInvoiceTab.tsx`
   - Inputs: job, kind, ensureLoading/ensureError, physicalDocPreview (built in parent — also used by hint + submit), stripeLineDescription + setter, externalNote + setter, physicalInvoiceFooter + setter, disclosure open flags (lineOnBill/memo/physicalFooter) + toggles, memoPresets + onApplyMemoPresetToBoth, physicalFooterPresets + active id, date link labels, onOpenEditDates, onOpenPdfPreview + physicalPdfPreviewLoading, physicalPreviewDbBacked, openPhysicalServiceLineEdit/openPhysicalMaterialLineEdit, authRole, physicalError, lineLeadingLowercaseHint, physicalSendReady, busy, onCancel, onSubmit (submitPhysicalInvoiceEmail), defaultLineDescription reset callback
   - Notes: Lines 1434-1856 plus the physical-only derived labels (1216-1225). Large prop surface (~25) but every prop is a straight controlled pass-down; no state moves because stripeLineDescription, externalNote, dates, and disclosure flags are all shared with the Stripe tab. submitPhysicalInvoiceEmail and openPhysicalInvoicePdfInNewTab stay in the parent (they read ensure state and physicalDocPreview). Do after the styles/kernels/memo-row/edit-dates PRs so the moved JSX only imports.
9. **BillCustomerStripeTab** — component, ~490 lines, medium risk → `src/components/jobs/BillCustomerStripeTab.tsx`
   - Inputs: job, kind, ensureLoading/ensureError, stripeSuccessInvoice, stripeResult, handleHostedStripeOobUnwindSuccess, handleAfterVoidStripeInvoiceSuccess, onClose, overlayZIndex, stripeFallbackLedgerInvoiceId, stripeModeForBilling, billAmountStr, stripeDueDate, stripeMemo + setter, stripeInvoiceFooter + setter + activeStripeFooterPreset, stripeLineDescription + setter, disclosure flags + toggles (shared), memoPresets + onApplyMemoPresetToBoth, stripePreview/Loading/Error, onEditDueDate, handleStripePreviewLineClick, lineLeadingLowercaseHint, stripeError, outsideReady, busy, onSubmit (submitStripeInvoice)
   - Notes: Lines 1858-2342: three internal branches (HostedStripeBillPanel success, fallback share panel, pre-submit form). Biggest and last component move; the heavy lifting (preview hook, hint kernel, styles, memo row) must already be out so this is JSX-only. submitStripeInvoice stays in the parent — it writes stripeSuccessInvoice/stripeResult and calls onSuccess/promote. The dev-only mode toggle in the header stays in the parent shell.

### Suggested PR sequence

1. PR 1: extract billCustomerModalKernels to src/lib + tests (~90 lines) — Stage A first per playbook; pure, zero-risk, puts the Edge-mirroring fixture-billability check under unit tests before anything else moves.
2. PR 2: extract billCustomerModalStyles (~115 lines) — the shared CSSProperties constants every later component PR imports; must exist before any JSX moves or each move re-declares styles.
3. PR 3: extract BillCustomerMemoPresetRow component (~70 lines) — already module-level with zero closures; pure cut/paste, unblocks all three tab moves which render it.
4. PR 4: extract BillCustomerEditDatesModal (~95 lines) — classic embedded-modal easy win; drafts stay controlled in the parent so the diff is a move.
5. PR 5: extract collectBillCustomerLineDescriptionsForHint kernel + tests (~55 lines) — Stage A for the lowercase-hint memo shared by the physical and stripe tabs, so both later tab PRs just call the lib.
6. PR 6: extract useBillCustomerStripePreview hook (~135 lines) — the debounce/race-guard preview engine comes out behind a stable seam before the Stripe tab moves; riskiest logic isolated in its own reviewable diff.
7. PR 7: extract BillCustomerHousecallProTab (~95 lines) — smallest tab, validates the controlled-props seam (shared memo state stays in parent) cheaply.
8. PR 8: extract BillCustomerPhysicalInvoiceTab (~430 lines) — by now JSX-only; physicalDocPreview and submit stay in the parent since the hint memo and submit handler both consume them.
9. PR 9: extract BillCustomerStripeTab (~490 lines) — last and largest; after PRs 1-6 it is a pure JSX move with props for the shared modification-disclosure state.

### Risks & gotchas

- Shared cross-tab state is the main trap: stripeLineDescription, externalNote, memoSectionOpen, lineOnBillSectionOpen, sentDate, and stripeDueDate are read/written by 2-3 tabs plus the edit-dates modal and submit handlers — all must stay parent-owned controlled props; letting a tab own any of them silently breaks the 'memo applies to both' and date-sync behaviors.
- The debounced Stripe preview effect has a 20-entry dependency array, a request-id race guard, and a stale-while-revalidate ref keyed on open; the hook extraction (PR 6) must reproduce deps and the open-reset exactly or previews will flicker or go stale — verify manually in the preview browser against a real job.
- physicalDocPreview is built inline during render AND rebuilt inside the lineLeadingLowercaseHint memo AND rebuilt in submitPhysicalInvoiceEmail — three independent builds of the same document. Preserve this quirk (do not dedupe during extraction); note it for a later behavior-neutral cleanup.
- jobHasBillableStripeSpecificWorkFixtures must stay semantically identical to the Edge function's buildStripeInvoiceItemsFromFixtures (comment at line 226) — the PR 1 tests should encode current behavior, not 'fixed' behavior.
- No render-test harness exists, so every component PR is verified only by typecheck/lint/tests + a manual open of Bill Customer from both Jobs row and Edit Job (overlayZIndex path) for both payload kinds (job and invoice) across all three tabs.
- The modal is mounted from multiple parents (Jobs page and JobFormModal) — its props contract must not change; all extractions are internal.
- Existing raw hexes (#3b82f6, #9ca3af, #2563eb, #15803d, #d1d5db) are saturated action/status colors the theme rule permits as literals — carry them over verbatim; do not tokenize mid-refactor.
- No architecture map exists for this modal (only flow docs in BILLING_FLOWS.md); per the playbook, write a short Step-0 section (this plan's section table) into docs — e.g. a SEND_RECORD_INVOICE_MODAL section appended to BILLING_FLOWS.md or a small dedicated map — in PR 1 so status can be flipped per extraction.

---

## src/components/schedule/ScheduleDispatchHub.tsx — 2,428 → ~430 lines

ScheduleDispatchHub is the presentational core of the Schedule/Dispatch surface: a controlled, week-scoped hub rendered by ScheduleDispatchHubPage (which owns all data loading, DnD context, URL state, and modals). It renders the week nav, a People/Jobs/Day tab bar, and two large embedded panels: a Jobs summary table (blocks-per-day per job) and the People grid (person x day cells of draggable schedule-block cards with copy/link/note/delete controls, time-off chips, multi-cell add, and placement-picking flows), plus an Expected Manpower analytics section (per-day/all-week person-hours by job with expandable assignee detail and an optional payroll estimate). It also hosts the DispatchSettingsModal trigger and is reused in an embedded "Quickfill tomorrow" mode via show* flags. Nearly all state is lifted to the page; the file's bulk is five embedded components' JSX plus a handful of inline pure computations (search filters, missing-note count, day stats).

**Already extracted:** Substantial: this surface has already been heavily decomposed. Siblings extracted from the dispatch surface: ScheduleDispatchWeekNav, ScheduleDispatchPlusCopyMenu, ScheduleDispatchTimeOffChip, DispatchSettingsModal, ScheduleDispatchGrid, ScheduleDispatchJobWeek, ScheduleDispatchAssignJobPickerModal, ScheduleDispatchAddBlockModal, ScheduleDispatchBlockNoteModal, ScheduleDispatchUndoNotComingInModal, LinkedScheduleGroupModal, ScheduleShareModal. Lib kernels already exist and are consumed here: scheduleDispatchHub.ts (fetches, hubPersonDayKey, aggregations), scheduleDispatchExpectedManpower.ts, scheduleDispatchColumnFocus.ts (+test), scheduleDispatchDnd.ts, scheduleDispatchDragHelp.ts, dispatchNoteRequirements.ts (+test), scheduleDispatchMobileNamePill.ts, scheduleBlockActionChromeStyle.ts, scheduleDispatchLinkedGroupPalette.ts. What remains un-extracted is the five embedded components in this one file plus a few inline pure computations.

### Internal structure

| Section | Lines | What it is |
|---|---|---|
| Imports | 1-58 | Heavy reuse of existing lib kernels (scheduleDispatchExpectedManpower, scheduleDispatchColumnFocus, scheduleDispatchHub, dispatchNoteRequirements, scheduleBlockActionChromeStyle) and sibling components (WeekNav, PlusCopyMenu, TimeOffChip, DispatchSettingsModal, QuickfillScheduleSection). |
| Expected-manpower style consts + label helpers + merged-row type | 59-105 | hubExpectedManpowerSrOnly/SectionTh/RowTd CSS consts, HUB_EXPECTED_MANPOWER_* consts, shortDowLabel() and hubDayColumnHeaderLabel() pure date-label helpers, exported ScheduleDispatchHubMergedRow type (only used inside this file). |
| HubJobsPanel (embedded component) | 107-346 | Jobs tab: local search + only-with-blocks filter state, filteredRows memo (pure filter), sticky-first-column table of jobs x visible days with per-day block counts and Open buttons. Leaf component with a fully explicit 11-prop contract (HubJobsPanelProps 107-119). |
| HubPeopleBlockCard (embedded component) | 348-737 | One schedule-block card in a people-grid cell: dnd-kit useDraggable drag strip (with read-only explainer toast), job title / time window / note buttons, note-requirement coloring via DispatchNoteRequirementsContext, linked-group chains float, minus (delete) and plus (copy) buttons with ScheduleDispatchPlusCopyMenu. Explicit 18-prop contract; includes hubPeopleSalarySuffix const at 348-354 (actually used by HubPeoplePanel). |
| HubPeopleDayCell (embedded component) | 739-1013 | One person x day <td>: dnd-kit useDroppable, cell background state machine (drag-over / assign-job picking / placement picking / linked-wrong-day / multi-select / time-off), cell click routing, time-off chip rendering, block card list, corner add-job triangle. Explicit 28-prop contract. |
| HubPeoplePanel props type | 1015-1069 | ~50-prop controlled contract: day keys, people rows, personDayBlocks map, placement/multi-add state + callbacks, expected-manpower inputs, time-off map, show* flags for the Quickfill embed. |
| HubPeoplePanel — filters, memos, missing-note count | 1071-1292 | Local search / only-with-blocks / EM-collapse state; expectedManpowerWeekPersonHours, expectedManpowerDayRows, selection label, expectedManpowerJobGroups, expectedManpowerDayStats memos; collapse-reset effect on day-key change (1202-1222); afterBlockFilter + filteredAssignees people-search memos (1224-1242); emptyMessage memo; missingNoteCount memo (1266-1292) using note-requirement context. |
| HubPeoplePanel — toolbar + people grid JSX | 1294-1568 | Error banners, +/++ add buttons, search box, Hide Inactive / Hide weekend / Highlight linked toggles, then the person x day table: sticky name column with salaried (s) suffix, day headers with missing-note badge, rows of HubPeopleDayCell. |
| HubPeoplePanel — Expected Manpower section JSX | 1570-2022 | Day / All-week tablist, day stats summary line, collapsible scheduled-by-job table with per-job expandable assignee detail sub-tables (Day/Person/Hours/Window), optional payroll estimate, week person-hours footer. |
| ScheduleDispatchHub Props type + toolbar style consts | 2027-2123 | ~65-prop controlled contract mirroring the panel props plus hubTab, week-nav callbacks, and Quickfill-embed show* flags; hubPeopleToolbarBtn/IconBtn consts. |
| ScheduleDispatchHub (main component) | 2125-2428 | Column-scroll keys, dispatchSettingsOpen state + roster memo, week nav, People/Jobs/Day tab bar + Dispatch Settings button, then two near-identical HubPeoplePanel render sites (Quickfill embed at 2300-2351 vs People tab at 2368-2419), HubJobsPanel, QuickfillScheduleSection for the Day tab, DispatchSettingsModal. |

### Extraction candidates (easiest/safest first)

1. **scheduleDispatchHubDayLabels (move shortDowLabel + hubDayColumnHeaderLabel into lib)** — kernel, ~10 lines, low risk, unit-testable → `src/lib/scheduleDispatchHub.ts`
   - Inputs: dateKey: string (uses referenceDateForWorkDateYmd + APP_CALENDAR_TZ + formatMmDdSlash)
   - Notes: Stage-A prerequisite: hubDayColumnHeaderLabel is used by HubJobsPanel, HubPeoplePanel, and the Expected Manpower section, so it must live in lib before any of those components move to their own files. Add scheduleDispatchHub.test.ts coverage (the lib file currently has no test). Also move the ScheduleDispatchHubMergedRow type here in the same PR so later component files don't import a type from the parent component.
2. **scheduleDispatchHubFilters (jobs-row filter + people/assignee filter + empty message)** — kernel, ~70 lines, low risk, unit-testable → `src/lib/scheduleDispatchHubFilters.ts`
   - Inputs: filterHubJobsRows(rows, search, onlyWithBlocks); filterHubAssignees(people, search, visibleDayKeys, personDayBlocks, getJobDisplayTitle, onlyWithBlocksThisWeek, userIdsWithBlocksThisWeek); hubPeopleEmptyMessage(counts + error flags)
   - Notes: Pure filters currently inline in memos at 145-160 and 1224-1260. The people filter searches both person names and job titles across the week's blocks — worth unit tests. Components keep thin useMemo wrappers calling the kernel.
3. **scheduleDispatchMissingNotes (missing-note count for the focus day)** — kernel, ~40 lines, low risk, unit-testable → `src/lib/scheduleDispatchMissingNotes.ts`
   - Inputs: missingNoteDayYmd, scheduleTodayYmd, people rows, personDayBlocks map, requirementForBlock: (args) => requirement
   - Notes: Lines 1266-1292 including the past-day-returns-0 rule (history never lights up red) — a genuinely testable business rule. Takes the requirement resolver as a function parameter so the kernel stays React-free (the context hook stays in the component).
4. **expectedManpowerDayStats (aggregate person-hours / people / jobs for a day selection)** — kernel, ~25 lines, low risk, unit-testable → `src/lib/scheduleDispatchExpectedManpower.ts`
   - Inputs: rows: ExpectedManpowerRow[] (the existing kernel's row type)
   - Notes: Lines 1185-1200; belongs next to its siblings in the existing scheduleDispatchExpectedManpower.ts kernel. Add a test case to that kernel's test file (create if absent).
5. **ScheduleDispatchHubJobsPanel** — component, ~250 lines, low risk → `src/components/schedule/ScheduleDispatchHubJobsPanel.tsx`
   - Inputs: Existing HubJobsPanelProps verbatim: rows (ScheduleDispatchHubMergedRow[]), loading, jobsError, summariesError, visibleDayKeys, hideWeekend + onHideWeekendChange, onOpenJob, scheduleTodayYmd, columnFocusDayYmd, columnScrollKey
   - Notes: Lines 107-346. Leaf table with local search/filter state only; props type already exists so this is a pure cut-paste move. Depends on PR 1 (label helper + merged-row type in lib). Re-export ScheduleDispatchHubMergedRow from ScheduleDispatchHub.tsx if any external import appears later (currently none — grep shows the type is only used in this file).
6. **ScheduleDispatchHubPeopleBlockCard** — component, ~395 lines, low risk → `src/components/schedule/ScheduleDispatchHubPeopleBlockCard.tsx`
   - Inputs: Existing explicit 18-prop inline type: block, workDate, scheduleTodayYmd, canEdit, hubMultiCellAddActive, linkPeerCount, highlightLinkedGroups, linkedGroupAccentByGroupId, onOpenLinkedGroup, cardPlacementMode, plusMenuOpen, onPlusMenuBlockIdChange, onStartCardPlacement, getJobDisplayTitle, onOpenJob, onOpenHubJobDetail, onDeleteBlock, onRequestEditBlockNote
   - Notes: Lines 356-737. Consumes ToastContext + DispatchNoteRequirementsContext and dnd-kit useDraggable — all fine in a moved file since the page-level DndContext wraps it unchanged. The hubPeopleSalarySuffix const (348-354) stays behind (it belongs to HubPeoplePanel). Zero shared closure captures — props are already fully explicit.
7. **ScheduleDispatchHubPeopleDayCell** — component, ~285 lines, low risk → `src/components/schedule/ScheduleDispatchHubPeopleDayCell.tsx`
   - Inputs: Existing explicit 28-prop inline type (personUserId, workDate, cellBlocks, canEdit, placement/assign/multi-add state + callbacks, timeOffInfo, groupMemberCountByGroupId, getJobDisplayTitle, open/delete/note callbacks)
   - Notes: Lines 739-1013. Imports the just-extracted block card + useDroppable + ScheduleDispatchTimeOffChip. The cell-background state machine (815-854) could optionally become a tiny kernel (cellBg decision from flags) in the same PR if desired, but is small enough to move as-is. Sequenced after the block-card PR.
8. **ScheduleDispatchHubExpectedManpower** — component, ~540 lines, medium risk → `src/components/schedule/ScheduleDispatchHubExpectedManpower.tsx`
   - Inputs: hubWeekBlocks, visibleDayKeys, hubExpectedManpowerDayKey + onHubExpectedManpowerDayChange (parent/URL-controlled selection stays controlled), getJobDisplayTitle, hubPeopleNameById, canShowExpectedManpowerPayroll, hubHourlyWageByUserId, onOpenJob, scheduleTodayYmd
   - Notes: Moves lines 1570-2022 JSX plus its dedicated memos and section-local collapse state from 1133-1222 (expectedManpowerByJobSectionCollapsed, collapsedExpectedManpowerJobIds, the day-key-change reset effect, expectedManpowerDayRows/JobGroups/DayStats/selection-label memos, expectedManpowerWeekPersonHours) and the style consts at 59-90. Medium only because the move spans two non-contiguous regions of HubPeoplePanel; the day-key selection itself stays controlled by the parent so no behavior risk. Depends on PR 4 (dayStats kernel) and PR 1 (label helper).
9. **ScheduleDispatchHubPeoplePanel** — component, ~480 lines, medium risk → `src/components/schedule/ScheduleDispatchHubPeoplePanel.tsx`
   - Inputs: Existing HubPeoplePanelProps (1015-1069) verbatim — ~50 controlled props; also hubPeopleToolbarIconBtn/hubPeopleToolbarBtn consts and hubPeopleSalarySuffix move with it
   - Notes: Do LAST: after the EM section, day cell, and filter/missing-note kernels are out this shrinks to toolbar + people-grid table + thin kernel-backed memos (~450-480 lines) and the move is mostly mechanical. Medium risk purely from the 50-prop threading and the fact that the parent renders it at TWO call sites (Quickfill embed at 2300 and People tab at 2369) — both must pass identical props; consider having the parent build one shared props object to keep the two sites in lockstep.

### Suggested PR sequence

1. PR 1: Stage A — move shortDowLabel/hubDayColumnHeaderLabel and the ScheduleDispatchHubMergedRow type into src/lib/scheduleDispatchHub.ts + add scheduleDispatchHub.test.ts (~10 lines moved) — prerequisite for every component move since three sections share the label helper; also gives the lib file its first tests.
2. PR 2: Stage A — extract scheduleDispatchHubFilters.ts kernel (jobs-row filter, people/assignee search filter, empty-message chooser) + tests (~70 lines) — de-risks the two panel moves by putting their only real logic behind unit tests first.
3. PR 3: Stage A — extract scheduleDispatchMissingNotes.ts kernel + tests (~40 lines) — the past-day/skip-requirement counting rule is the subtlest logic in the file; test it before the panel JSX moves.
4. PR 4: Stage A — move expectedManpowerDayStats into src/lib/scheduleDispatchExpectedManpower.ts + test (~25 lines) — completes the pure-logic sweep; everything left is JSX.
5. PR 5: Stage B — extract ScheduleDispatchHubJobsPanel.tsx (~250 lines) — the easiest component: leaf table, props type already written, no contexts, no dnd.
6. PR 6: Stage B — extract ScheduleDispatchHubPeopleBlockCard.tsx (~395 lines) — fully explicit props, contexts travel fine; innermost first so the cell can import it next.
7. PR 7: Stage B — extract ScheduleDispatchHubPeopleDayCell.tsx (~285 lines) — imports the card from PR 6; explicit props, single droppable hook.
8. PR 8: Stage B — extract ScheduleDispatchHubExpectedManpower.tsx (~540 lines) — section-local collapse state + memos move with it; day-key selection stays a controlled prop; depends on PRs 1 and 4.
9. PR 9: Stage B — extract ScheduleDispatchHubPeoplePanel.tsx (~480 lines after PRs 7-8 hollowed it out) — mechanical 50-prop move; update both parent call sites (People tab + Quickfill embed) identically, ideally via one shared props object built in the parent.

### Risks & gotchas

- Two identical HubPeoplePanel render sites in the parent (Quickfill embed at ~2300 and People tab at ~2369): any prop-threading slip during PR 9 silently diverges the Quickfill-tomorrow embed from the Schedule page. Verify both surfaces (Schedule > People tab AND the Quickfill tomorrow snapshot) after PRs 8-9; the show* flags (showExpectedManpower, showHideWeekendToggle, showWeekNavigation, showHubViewTabs) only exercise on the embed path.
- dnd-kit coupling: HubPeopleBlockCard (useDraggable) and HubPeopleDayCell (useDroppable) must remain rendered inside the DndContext owned by ScheduleDispatchHubPage. Pure file moves are safe — but do not introduce any wrapper/provider or lazy boundary around them.
- ScheduleDispatchHubMergedRow is exported from the component file; today only this file uses it, but move it to lib (PR 1) rather than leaving a component-to-component type import, and keep a re-export from ScheduleDispatchHub.tsx for one release if any out-of-tree branch imports it.
- No docs/<SURFACE>_ARCHITECTURE.md exists for the schedule/dispatch surface — the playbook's Step 0. Write a short SCHEDULE_DISPATCH_ARCHITECTURE.md (or add a section to an existing doc) in PR 1 and flip statuses per PR, per playbook convention.
- The working branch (feat/edit-job-ux-polish) already has uncommitted modifications to ScheduleDispatchHub.tsx, ScheduleDispatchGrid.tsx, and ScheduleDispatchHubPage.tsx — land or stash that WIP before starting, or every extraction PR will conflict; line ranges in this plan are from the current working tree.
- Note-requirement coloring flows through DispatchNoteRequirementsContext consumed at two levels (card + panel); after extraction both new files consume the same context — no provider moves, but a missed import will typecheck fine in isolation and fail at runtime only if the provider is absent, so smoke-test the People grid renders.
- Theme-token CI: several literal saturated colors (#2563eb, #1d4ed8, #ca8a04, #b91c1c, #93c5fd) are intentional action/status colors and allowed — do not 'fix' them during moves; conversely do not introduce raw neutral hexes when splitting style consts.
