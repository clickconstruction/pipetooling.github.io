# Jobs Stages Tab Architecture Map (sub-decomposition)

---
file: docs/JOBS_STAGES_TAB_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 sub-decomposition map (per PAGE_DECOMPOSITION_PLAYBOOK.md) for the Pipeline board — src/components/jobs/JobsStagesTab.tsx (5,099 lines, 120 useState) and its shared row renderers jobsStagesRowShared.tsx (1,518), with short dossiers for the two section tables. The v2.3530–v2.3549 train moved the toolbar, jump strip, inline dialogs and table rows out; the tab has since grown back past 5k lines (billed-money engine, lien / legal desks, contract desk, phone board, follow-up deck). This map inventories every region at exact line ranges so the next round — hook seams for the money / row-flag / GC-round data, the deep-link consumer, the deck's duplicated section wiring — starts without re-deriving the strategy.
covers:
  - src/components/jobs/JobsStagesTab.tsx
  - src/components/jobs/jobsStagesRowShared.tsx
  - src/components/jobs/JobsStagesTable.tsx
  - src/components/jobs/JobsStagesUnifiedTable.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
---

> **Line numbers are as of `a05cef4c4`** (from the `npm run map` fact sheets). This is the hottest surface in the repo (195 commits in 90 days on the tab, 62 on `jobsStagesRowShared`) — search the symbol, and trust a range only while the symbol still sits at it.

## What this surface is

The Pipeline board (tab label "Pipeline"; the `stages` key, URL slug and `JobsStages*` filenames are unchanged): Waiting → Working → Ready to Bill → Billed Awaiting Payment → Collections → Paid in Full, rendered by [`JobsStagesTab`](../src/components/jobs/JobsStagesTab.tsx).

| File | Lines | Shape |
|---|---|---|
| [`JobsStagesTab.tsx`](../src/components/jobs/JobsStagesTab.tsx) | 5,099 | `forwardRef(function JobsStagesTabInner)` 468–5097. Hook census: **120 useState** · 0 useReducer · **51 effects** (incl. `useImperativeHandle` 2460) · 45 useMemo · 33 useCallback · 10 useRef · 20 custom-hook calls. **60 props** (`JobsStagesTabProps` 348–420) + **11-method** `JobsStagesTabHandle` (323–346). 179 local imports; 67 distinct child elements in the render (3031–5096) |
| [`jobsStagesRowShared.tsx`](../src/components/jobs/jobsStagesRowShared.tsx) | 1,518 | 23 module functions, zero hooks, zero Supabase; **33-field** `StagesRowRenderContext` (74–124, 8 optional); imported by 14 files |
| [`JobsStagesTable.tsx`](../src/components/jobs/JobsStagesTable.tsx) | 513 | job-only sections (Waiting / Working / Paid in Full); 65 prop fields |
| [`JobsStagesUnifiedTable.tsx`](../src/components/jobs/JobsStagesUnifiedTable.tsx) | 449 | job + invoice rows (Ready to Bill / Billed / Collections); 86 prop fields; row kinds in [`StagesUnifiedJobRow.tsx`](../src/components/jobs/StagesUnifiedJobRow.tsx) (434) / [`StagesUnifiedInvoiceRow.tsx`](../src/components/jobs/StagesUnifiedInvoiceRow.tsx) (358) |

Mapped in full: **6,617 lines** (the tab + `jobsStagesRowShared`); the two tables get short dossiers (§7 / §8), 962 more, and their two unified row files 792. Satellites (consumers of this map's seams, not mapped here):

| Satellite | Lines | Role |
|---|---|---|
| [`JobsStagesCardList.tsx`](../src/components/jobs/JobsStagesCardList.tsx) | 1,286 | Mobile-cards twin of both tables (`JobsStagesCardList` / `JobsStagesUnifiedCardList`), same props types — the tab swaps the tag (`StagesSectionList` / `StagesUnifiedSectionList`, 2139–2140). **Has no map of its own.** |
| [`JobsFollowupModal.tsx`](../src/components/jobs/JobsFollowupModal.tsx) | 1,010 | Follow-up deck; each card's row comes from the tab's `renderFollowupStageRow` (§4b) |
| [`JobsMapCard.tsx`](../src/components/jobs/JobsMapCard.tsx) / `JobsMapRail.tsx` | 809 / 143 | Jobs on a map (§2b) |
| [`PipelineOverview.tsx`](../src/components/jobs/PipelineOverview.tsx) | 249 | Money story + Today's Money Opportunities + Fix-ups (§2b) |
| `JobsStagesActivityBox.tsx` · `JobActivityView.tsx` · `JobActivityFeed.tsx` | 393 · 437 · 323 | Wide-screen activity box and the one expanded activity body |
| [`JobsStagesActivityExpandModal.tsx`](../src/components/jobs/JobsStagesActivityExpandModal.tsx) | 179 | One instance in the tail (4375). Trap: it holds a `JobWithDetails` **snapshot** — `onCommitPct` patches `pct_complete` in place (4386–4391); team edits show stale names until reopen |
| `JobsStagesThreadPanel.tsx` · `StagesExpandedThreadRow.tsx` | 177 · 89 | Expanded-row thread panel (mounts twice for a billed job — job row + invoice row) |
| `JobsStagesPhoneStrip.tsx` · `StagesPhoneRow.tsx` | 129 · 272 | Phone board (§4c) |

This is a *sub*-decomposition map. How the tab was carved out of `Jobs.tsx`, the page's URL router and the `useJobsStagesMutations` / `useJobThreadNotes` engines live in [`JOBS_TABS_ARCHITECTURE.md`](./JOBS_TABS_ARCHITECTURE.md) (§ `stages` dossier) — reference it, don't re-derive it. The Lien desk and GC Review mount here but have their own maps: [`LIEN_DESK_ARCHITECTURE.md`](./LIEN_DESK_ARCHITECTURE.md), [`GC_REVIEW_MODAL_ARCHITECTURE.md`](./GC_REVIEW_MODAL_ARCHITECTURE.md).

Changes since this map's previous refresh (829c507cd, v2.3792) — `jobsStagesRowShared.tsx` untouched; the tab gained: the returned-check badge + `openPaymentsReceived` (v2.3806, 563–579), the lien card on the money strip (v2.3799, `lienDeskMoneyCard` 1616), the Lien desk's ask-counsel sign-off wiring (v2.3790, 4732–4747), the GC-on-notice Edit Job focus doors (v2.3819, 4793–4809).

### Mount/state semantics (preserve in every extraction)

- `Jobs.tsx` (1907) renders `<JobsStagesTab ref={stagesTabRef} active={activeTab === 'stages'} …/>` **unconditionally**. The board is `{active && …}` (3035–4352); the **modal tail (4353–5096) renders regardless**, so Pipeline state survives tab switches.
- **Exception:** the six dialogs mounted inside the section IIFE (4194–4347: Weekly movement, Weekly money, GC Review, Total by Name, Capable, Est-bill-date) sit inside the `active` block — their open flags survive a tab switch, the dialogs unmount.
- **The handle** (`useImperativeHandle`, 2460–2509): `followMovedJob`, `focusSection` (= `focusStagesSection` 1832), `focusJob` (= `focusJobOnBoard` 2443), `focusInvoice` (= `applyStagesInvoiceFocus` 2215), `openBankPayments`, `openLegalDesk`, `openLienDesk`, `openWeeklyMovement`, `openWeeklyMoney`, `showBilledTotalByName`, `openMoneyMove` (keys `capable` / `chase90` / `fixDates` / `ar` / `chase` / `gcRoundCertify` / `gcRoundStart`, each clearing a live search first). `Jobs.tsx` calls every method except `openLienDesk`, which has no caller in `src/`.
- **URL: the tab is no longer read-only.** The page router still drives the handle for `?stagesSection` / `stagesJob` / `stagesInvoice` / `openBankPayments` / `stagesWeekly` / `stagesMoney` / `stagesMove` / `legal` / `showBilledTotalByName`. The tab itself consumes eight one-shot params and strips each with `navigate({ search }, { replace: true })`: `followups` (1314), `gcReview` (1326), `gcnotice` (1338), `liendesk` + `liendeskJob` / `liendeskPile` / `kind` (1351), `round` + `gc` (1366), `chase` (1381), `forecast` (1393), `rtb` (1849 — a layout-settle poller, below). Three more are lazy-init reads of `window.location.search`: `contractSweep` (925), `contract` (943), `view=recent` (1493). Read-only: `openBankPayments` for the loading hint (3389), `tab` for the return-edit banner (2254). The comments at 1491–1492 ("the tab never writes search params") and 942 are stale.

### Old/New views — retired

The Old / New pills (v2.1915) retired in v2.2012 (comment at 3179–3182): `PipelineOverview` is the only view, and it steps aside while the search box has text (`pipelineOverviewHiddenBySearch`, 3183). Its view-models come from [`lib/jobs/pipelineOverview.ts`](../src/lib/jobs/pipelineOverview.ts) over `cacheHeaderStats`.

---

## The shared substrate

There is **no selected-record pointer**. Six layers instead:

1. **Parent-injected engines (stay in `Jobs.tsx`).** The jobs cache props (`jobs`, `jobsListLoading`, `jobsListRefreshing`, `jobsListSnapshotAt`, `jobsListError`, `paidJobsLoading`, `jobsListDataKey`, `paidJobsMergedForKey`, `loadJobs`, `runFetchJobs`, `fetchPaidJobsIfNeeded`, `customerFilterForFetch`, `scheduleLoadJobsAfterMutation`), the 12 [`useJobsStagesMutations`](../src/hooks/useJobsStagesMutations.ts) values (8 functions + 4 busy ids) and the 15 [`useJobThreadNotes`](../src/hooks/useJobThreadNotes.ts) values (2 optional; shared with Job Summary). Any extraction re-threads them; it never re-hosts the hooks.
2. **The cache context's scope API, read directly** (`useJobsListCache`, 662–669): `cacheMergedScopes`, `cacheScopeLoading`, `cacheFetchScopeIfNeeded`, `cacheHeaderStats`, `cacheLeanBilledRows`, `cacheSetJobs`. Seven fetch-scope effects share one retry-until-merged shape: 672 (open sections), 781 (billed money modals → `NON_PAID_SCOPES`), 789 (Legal desk), 797 (paid profit chart → paid), 1095 (chase), 1477 (cross-section modals / display filters), 1508 (map).
3. **Board lists (the data engine).** `stagesBoardLists` (1531–1553) = `buildJobsStagesBoardLists` over the filter chain exclusions → GC → development → account man → contract coverage, plus search, combined extra ids, sort mode and the `next` comparator. `unfilteredBoardLists` (1576) = `buildJobsStagesBoardLists(jobs, '')` — **money-never-hides**: GC Review, the chase queue, the aging chart / forecast / who-owes-what modals, the Capable plan inputs, the round cards and the follow-up deck read it, never the filtered lists. `bankPaymentsModalBilledRows` (2052) is the same empty-search build's `billedRows` (AR sees Collections too), mirrored in `JobsAccountsReceivable.tsx`. `applyStagesInvoiceFocus` builds a third, search-aware copy on demand (2219). Builder tested in [`lib/jobsStagesBoard.ts`](../src/lib/jobsStagesBoard.ts) (90 tests).
4. **The selection analog: focus/flash + section-open.** `stagesSectionOpen` (653, persisted by the 654 effect), the job pair `pendingStagesJobFocusId` / `stagesJobFlashId` (649/650), the invoice pair (646/647). Writers: `focusStagesSection` 1832, `followMovedJob` 1890, `jumpToNumberMatches` 1998, `applyStagesInvoiceFocus` 2215, `focusJobOnBoard` 2443, `pickPhoneStage` 1304, `openFollowupBoardRow` 2856, `confirmCollectionsMove` 2922, the section headers' `toggleStages` (3418) and the Paid expand (4109), the Total-by-Name / Capable dialogs (4298 / 4320, section-open only), the who-owes-what modal's `onOpenBill` (4469–4478). **Must stay in the tab**; children get callbacks.
5. **The row-render context.** `StagesRowRenderContext` (33 fields) is the seam between the tab and the renderers. The tab builds `stagesTableShared` (2522–2578, 55 keys) and `stagesUnifiedTableShared` (2636–2648, that spread + 10 invoice keys) once and spreads them into the six section sites and the deck rows (the v2.3538 prop-bundle seam); the tables build the ctx from those props plus `useNavigate` / `useDispatchTaskModal` / `useChecklistAddModal`. Widen *this* seam, never invent a second one.
6. **Role gates.** `import * as stagesGates` ([`lib/jobs/stagesRoleGates.ts`](../src/lib/jobs/stagesRoleGates.ts), 10 tests) — 36 reads over 12 gates. Still inline: `bankReturnedEnabled` (565) and three `authRole === 'dev'` reads (4219, 4537, 4658).

---

## Region dossiers (inside `JobsStagesTab.tsx`)

### 1. Logic block (472–3029) — state clusters

Every `useState` and effect is assigned to exactly one cluster (sums: 120 / 51).

| Cluster | Anchors (lines) | useState | Effects | Data / loaders | Tests | Status |
|---|---|---|---|---|---|---|
| **A. Page context** | props destructure 472–533; `useSearchParams` / `useNavigate` 535–536; `useJobAccountEvidenceGapsNudge` 538; `useOwnerConfirmRows` 540 | 0 | 0 | hook RPCs | — | stays |
| **B. Focus / flash / sections** | 646–678; `focusStagesSection` 1832–1840; `followMovedJob` 1890–1900; `jumpToNumberMatches` 1998–2021; `jumpViaLeanLookup` 2029–2050; `applyStagesInvoiceFocus` 2215–2243; flash / scroll 2270–2318; `focusJobOnBoard` 2443–2458 | 5 | 6 | `fetchLeanJobIdsByNumber` + `fetchJobsLedgerWithDetailsForStages` → `cacheSetJobs` | tab render (toggle, `focusJob`, handle); `stagesSectionPrefs` 4, `stagesJobNumberJump` 4, `leanJobSearch` 4 | **stays** (substrate #4) |
| **C. Search** | 733–745; schedule/clock search 1904–1939 (350 ms); server all-jobs search 1948–1989 (300 ms); thread stats 2075–2087 (320 ms) | 5 | 3 | `fetchJobIdsMatchingScheduleOrClockSessions`, `fetchLeanJobSearchIds`, `refreshJobThreadStatsForJobIds` | `jobsStagesScheduleSessionSearch` 9, `stagesPaidSearchHint` 5; tab "search filters" | stays |
| **D. Modes** | 1238–1287; org default 1266–1271; toggles 2089–2157; `stagesEditModeActive` 2144 | 5 | 1 | localStorage + `useOrgDefault('jobs.stages.mobile_cards')` | tab (Edit mode, Mobile cards ×2) | stays (feed the ⋯ menu) |
| **E. Filters / sort / views / lists** | contract sweep + filter 925–949; `renderStagesOpenDetailJobName` 1404–1436; filters 1438–1489; recent view 1493–1499; map live rows 1506–1513; sort 1516–1529; `stagesBoardLists` 1531–1553; when pills 1556–1565; `unfilteredBoardLists` 1576; Capable 1582–1593 | 10 | 2 | — | `jobsStagesBoard` 90, `jobsStagesExcludeFilters` 10, `jobsStagesSortMode` 7, `stagesWhenPills` 5, `jobContractCoverage` 13, `capableToBillPlan` 5 | **stays** (substrate #3) |
| **F. Schedule + labor side maps** | upcoming 596–614; week so far 615–633; man-hours 639–644, loader 2190–2203, 80 ms effect 2324–2329, folds 2332–2350 | 4 | 3 | `fetchStagesUpcomingScheduleForJobs`, `fetchStagesWeekSoFarForJobs` (both keyed on `stagesUpcomingIdsKey` 600); RPC `get_man_hours_by_job` | `stagesUpcomingSchedule` 11, `stagesWorkedDays` 5; **man-hours folds untested** | extract `useStagesManHours` + fold kernel |
| **G. Row-flag lookups** | bank returned 563–579; demand letters 833–849; contract coverage 850–924; hazmat 956–985; lien releases 986–1000 | 5 | 5 | tables `job_demand_letters`, `job_contracts`, `estimates`, `job_hazmat_incidents`, `job_lien_releases`; hooks `useBankReturnedPaymentsNudge`, `useJobContractsNudge`, `useJobCrewPositions` (907); `job-contract-changed` window event (880) | `jobContractCoverage` 13, `bankReturnedDeposits` 8; loaders untested (fail-soft) | **seam candidate** (`useStagesRowFlags`) |
| **H. Billed-money data** | 1001–1100; `billedExpectedPayChipRenderer` 1106–1192; chase 1722–1747; money-modal scope kick 780–786 | 4 | 6 | RPCs `get_billed_customer_pay_speeds`, `list_job_promised_pay_dates`, `list_payment_promise_records`, `list_payment_chase_touches` (all cast `as never`, so the fact sheet's RPC list misses them) | `billedExpectedPay` 20, `paymentPromises` 19, `paymentChase` 18, `paymentReliability` 9; **the chip renderer, `BilledExpectedPayChip`, `BilledReliabilityLine` untested** | **seam candidate** (`useStagesBilledMoneyData`) |
| **I. GC statement round** | last-sent 692–716; round 1648–1720 | 5 | 3 | table `gc_statement_emails`; `listGcReviewCertifications`, `listGcStatementRoundMarks(Since)`, `listGcStatementSenders` | `gcStatementRounds` 14, `gcReviewCertification` 10, `temperatureBoard` 4, `gcReviewRollup` 9; `gcRoundCards` ready-total reduce (1718) inline | **seam candidate** (`useGcStatementRound`) |
| **J. Lien / legal desks** | `legalDesk` (its state is counted in N) + `useLegalMatters` 756–759; states here = `lienDesk` 1609, `gcNotice` 1612, `lienDeskIssuerGen` 1631; Legal scope kick 787–794; forecast work months 1594–1606; Lien desk 1607–1646 | 3 | 2 | `useLienDeskData` (light read while closed), `useForecastWorkMonths` ×2, `fetchPhysicalInvoiceIssuerFromAppSettings` (1633) | `lienDeskMoneyCard` 5, `lienClaimCorrection` 5, `lienSigner` 2 | stays; desks mapped in [`LIEN_DESK_ARCHITECTURE.md`](./LIEN_DESK_ARCHITECTURE.md) |
| **K. Deep-link consumers** | 1311–1402 (7 consume-once effects, 7 refs); `rtb` poller 1842–1887 | 0 | 8 | `navigate` replace | **none** | extract `useStagesDeepLinkParams` |
| **L. Confirm dialogs** | ready-for-billing 750–752; send-back 1207–1232; simple 1233; collections 1234–1237; effects 2159–2187; handlers 2898–3008 | 13 | 2 | table `job_status_events` (2165); `setJobCollectionsFlag` → RPC `set_job_collections_flag`; `prepareBilledInvoicesBeforeJobRevertToReadyToBill` (edge); `postSendBackReasonNote` | dialogs: `StagesSendBackModals` 4, `StagesSmallConfirmModals` 3; kernels `jobSendBackContext` 5, `jobSendBackNote` 9, `voidStripeInvoiceForRevert` 12; **handlers, `setJobCollectionsFlag`, `postSendBackReasonNote` untested** | dialogs extracted (v2.3535/3536); handlers stay |
| **M. Partial invoice** | 590, 636–637; `createInvoiceFromModal` 2352–2428; `reclampPartialInvoiceAmount` 2430–2437 | 3 | 0 | **INSERT `jobs_ledger_invoices`** + RPC `ensure_single_ready_to_bill_invoice_for_job` | `planPartialInvoice` (in `jobsStagesBoard.test`), `ensureRtbRemainderResult` 5, dialog 2; **the IO is untested — money write** | dialog extracted (v2.3537); IO stays |
| **N. Row openers + board modal flags** | openers 541–595, 635, 682, 753–754, 819–832, 889–892, 950–956, 1101; flags 680–732, 755–808, 1089, 1485, 1796; banner 587–588 | 54 | 8 | — | covered per modal (§6) | **stays** — written by the handle, overview, ☰ / ⋯ menus, rows |
| **O. Phone board + follow-up deck** | 1288–1310; `phoneNextInput` / `phoneRowsFor` 2579–2634; deck 2650–2877 | 4 | 1 | — | `jobNextLine` 12, `jobFollowupQueue` 17; **`phoneNextInput`, `renderFollowupStageRow`, `JobsFollowupModal`, `JobsStagesPhoneStrip`, `StagesPhoneRow` untested** | §4b / §4c |
| **P. Handle + prop bundles** | handle 2460–2509; `stagesTableShared` 2522–2578; `stagesUnifiedTableShared` 2636–2648; `stagesToolsFilters` 2880–2890; `sectionToolsOnSelect` 3011–3029 (14 doors) | 0 | 1 | — | tab "handle methods callable" | **stays** |
| **Q. AR memos** | 2052–2073 | 0 | 0 | `billedAgingBuckets` falls back to `cacheHeaderStats.billedAging` until `billed_all` merges | `stagesAccountsReceivableButton` 4, `invoiceBilling` 42 | stays |

Cluster N's 54 states: 20 single-job opener targets (`activityExpandJob`, `crewModalJob`, `newReportJob`, `manageJobPeople`, `scheduleModalJob` + `scheduleModalInitialDate`, `quickAssignJob`, `calendarJob`, `sessionNotesModal`, `markPaidJob`, `markPaidInvoice`, `viewBillInvoice`, `lienToolingPrefillModal`, `lienInstrumentsModal`, `jobContractModalJob`, `signedAgreement`, `aiaG702StagesJob`, `lienReleaseModal`, `hazmatFeeJob`, `promisedPayModalJob`), 31 board-level flags (incl. `billedAgingFilter`, `gcReviewStartRound` / `gcReviewRoundGcId`, `weeklyMoneyInitialMonday`, `billedTotalByNameExpandedName`, `stagesToolsMenuOpen`), `whenInvoiceBillModal` + date, and `returnEditBannerJobId`. Where anchors overlap, a state counts once: `ownerConfirmModalOpen` (541, a flag anchored with the openers), `jobContractModalJob` / `signedAgreement` (890 / 892) and `hazmatFeeJob` (956) inside G's ranges, `chaseModalOpen` (1089) inside H's and `stagesHideGroupsModalOpen` (1485) inside E's are N; 590 is M, 693 is I, `contractSweepOpen` (925) is E. Its eight effects: the paid-profit-chart scope kick (797), the alert auto-closes (1814, 1820, 1826), the Total-by-Name reset (2320) and the return-edit banner trio (2245, 2252, 2261).

### 2. Command bar + ⋯ tools menu (3044–3104) — extracted

- [`JobsStagesCommandBar.tsx`](../src/components/jobs/JobsStagesCommandBar.tsx) (442 lines, v2.3533): New Job, Follow-ups (+ `followupQueueCount`), Forecast (`canSeeBilledExpectedPay`), search + busy hints, Session notes, the # jump (`jumpToTypedNumber` 2892), applied-filter chips (sort / contract / GC / development / account man / Hide groups); the menu passed as `toolsMenu`. 5 render tests.
- [`JobsStagesToolsMenu.tsx`](../src/components/jobs/JobsStagesToolsMenu.tsx) (513 lines, v2.3532), 3066–3102: controlled `open` (the whole-board load at 1455–1464 reads it); `filters` = `stagesToolsFilters`; `gates` {lienDesk, jobContracts, officeTools, powerToggles}; `lienDeskCount`, `contractSweepCount`; seven doors (Lien desk, Put a GC on notice, contract sweep, Hide groups, Job Book, Total by Name, Combine / Separate); five `toggles`. 6 render tests.
- **What stays:** every filter / sort / toggle value and setter, the open flags, the counts, the gates.

### 2b. Map + money overview (3120–3266) — extracted children, tab-side wiring

- **Phone fold** (3126–3157): on the phone board the map + overview sit in one "Overview" block at `order: 99`, closed by default, remembered via `readDeviceString` / `writeDeviceString(STAGES_PHONE_OVERVIEW_KEY)`.
- **`JobsMapCard`** (3159–3178): `stagesBoardLists.filtered`, paid-scope load, `onNeedLiveRows` → `requestLiveRowsForMap` (the 1508 kick), pin → row via `jumpToNumberMatches` or `jumpViaLeanLookup`. 14 render tests.
- **`PipelineOverview`** (3183–3262): contract coverage + stage-gap door (sets `stagesContractFilter = 'missing'`), stats, three gates, AR count, the money-move doors (each clears the search first — v2.1960), `fixupCounts` {noCustomer, noPictures, noEmail, noJobAccount, ownerConfirm} + `onFixup` (no-job-account navigates to `/materials?tab=job-accounts&filter=no_account`), `gcRound`, `chase`, `burnAlert`, `lienNotices`. 9 render tests; kernel `pipelineOverview` 13.

### 3. Section tools ☰ + jump strip + alert modals (3267–3379) — extracted

- Desktop only (`phoneBoard ? null`): [`JobsStagesSectionToolsMenu`](../src/components/jobs/JobsStagesSectionToolsMenu.tsx) (v2.3549; `inputs` from the **unfiltered** lists so GC Review stays reachable; `onSelect = sectionToolsOnSelect`; 4 tests) + [`JobsStagesJumpStrip`](../src/components/jobs/JobsStagesJumpStrip.tsx) (v2.3534; `jumpStripCounts` 1750–1769 via `stagesJumpStripCount`; 2 tests). The *Back to board* pill (3313–3340) renders only while the Recently-added view is open.
- Alert modals: `StagesAlertJobListModal` ×2 (no email 3346, no pictures 3371), `StagesNoCustomerJobsModal` (3358), `OwnerConfirmListModal` (3364; 2 tests). Opened only from the overview's Fix-ups; lists from 1782–1795 with auto-close effects 1814–1830.
- Loading / snapshot lines (3380–3410) use `BoardSnapshotAgeChip` (module scope 446–464, v2.3610).

### 4. Section wiring IIFE (3411–4350)

`{(() => { … })()}` returns `JobsRecentlyAddedList` while `stagesRecentViewOpen`; otherwise:

- **Totals + helpers** (3416–3510): `waitingTotal` / `workingTotal` = `stagesJobsOpenBalanceTotal`; `capableToBillTotal` = `capableToBillTotalWithPlans(working, workingStageInputs)`; `readyToBillTotal` = `readyToBillRowsExposureTotal`; `billedTotal` / `collectionsTotal` = `billedRowsRemainingTotal`; `billedListRows` = the aging-chip filter over `billedActiveRows` (inline; list only, headers keep the whole section). `sectionShown` / `sectionMerged` / `sectionScopeBusy` / `sectionHdr` (header count + total from live rows when merged or searching, else `cacheHeaderStats`, else `…` — inline, untested); phone-strip numbers (3478–3498); `canManageCollections`; `paidSearchHint`.
- **Phone strip** (3513–3523) and **paid-search hint** row (3524–3560, `data-testid="stages-paid-search-hint"`).

| Section | Header (id via `stagesSectionElementId`) | Body | Wiring notes |
|---|---|---|---|
| Waiting | 3561 | 3573–3587 | `StagesSectionList {...stagesTableShared}`, `Move to Working` |
| Working | 3589 (when pills 3600–3617, `⇅ Next first` 3624) | 3639–3659 | `workingShown`; ham → `nudgeMissingBillingEmail` + direct move, else the `readyForBillingJob` confirm (on the phone board it carries `advanceConsequence`); send back → Waiting (ham direct / `sendBackConfirmJob`) |
| Ready to Bill | 3667 (owner ⚙ notify 3677–3688) | 3691–3765 | `StagesUnifiedSectionList {...stagesUnifiedTableShared}`, `Bill Customer`: customer-link guard (`jobLedgerHasCustomerForBilling`) → `billCustomer.openBillCustomer`; send-backs carry `sendBackJobBillingContext(j.invoices)` |
| Billed Awaiting Payment | 3767 (aging chips 3778–3819; GC Review 3823; AR button 3835 + unallocated badge 3852–3878; share 3880; aging chart 3892; forecast 3904; payment email 3916; aging-filter banner + Fix bill lines 3930–3972) | 3974–4016 | `billedExpectedPayChip={billedExpectedPayChipRenderer}`, `Mark Paid`, lien doors, Move to Collections (`setCollectionsConfirm` direction `to`) |
| Collections | 4018 (⚖ Legal desk 4031–4054; Lien desk 4055–4070) | 4073–4102 | `jobNoteLine={collectionsNoteLine}`; send-backs → `collectionsConfirm` direction `from` |
| Paid in Full | 4105 (lazy `fetchPaidJobsIfNeeded` via `queueMicrotask` 4112; count 4121–4132; profit chart 4145; paid email 4157) | 4170–4192 | `actionLabel={null}`; send back to Billed |

- **Status:** stays (highest coupling). Seam done (v2.3538 spreads). Open: the per-section *action* props are restated in the deck (§4b).

### 4b. Follow-up deck rows — `renderFollowupStageRow` (2650–2853) + deck glue (2856–2877)

- Renders the job's real Pipeline row for a deck card: `StagesSectionList` / `StagesUnifiedSectionList` with `hideHeader`; waiting / working pass `jobList={[job]}` (from `jobs`), the unified stages narrow `unfilteredBoardLists` rows to the one job; stage ∈ waiting / working / ready_to_bill / collections / billed. Writes 13 of the tab's confirm / opener states (fact sheet).
- **The problem:** each stage's action props are a near-verbatim copy of the §4 section site (Ready to Bill diffed at a05cef4c4: identical modulo `hideHeader`, `rows`, `phoneRows`, `onToggleProgressSort`, `openNewReportForJob`). Two copies of every stage move / send-back wiring drift independently.
- Glue: `openFollowupBoardRow` (closes the deck, opens the section, focus + flash), `openFollowupActivity` (activity modal over the deck), `followupLiveJobIds` / `followupLiveJobStages` (2876–2877).
- **Extraction:** build `stagesSectionActionProps[stage]` once at tab scope and spread it at both sites (§ order step 6). Untested today.

### 4c. Phone board (punch list #30)

- `phoneBoard = isMobile && stagesMobileCards` (1297); one stage at a time — `phoneActiveStage` = first open section (1303), `pickPhoneStage` closes the rest (1304), 1307 ensures one is open. `phoneRowFilter` all / needs / today; `phoneOverviewOpen` per device.
- `phoneNextInput` (2581–2615) composes `progressPaymentForJob`, `billedExpectedPayModel`, `stagesBillSentPctAlert`, quiet days, returned check, contract, upcoming, crew and the bill line into a `jobNextLine` input; `phoneRowsFor(stage)` (2616–2634) hands the tables `nextLineFor` / `advanceConfirm` / `advanceConsequence` / `onChip`.
- Status: stays for now; `phoneNextInput` is a pure-input builder — Stage-A candidate once H is a hook.

### 5. IIFE-mounted dialogs (4194–4347)

| Dialog | Lines | Notes |
|---|---|---|
| `JobsWeeklyMovementModal` | 4194–4200 | `canSchedule` = office gate |
| `JobsWeeklyMoneyModal` | 4201–4207 | `initialMondayYmd` from the handle / ☰ menu |
| `JobsGcReviewModal` | 4208–4289 | mapped in [`GC_REVIEW_MODAL_ARCHITECTURE.md`](./GC_REVIEW_MODAL_ARCHITECTURE.md). Tab-side: unfiltered billed + collections rows; `onPrint` → `buildGcStatementReportHtml`; `onCopyForEmail` → `gcStatementEmailSubject` / `…Html` / `…Text` + `copyRichHtmlToClipboard`; **`onSendStatement` invokes edge fn `send-gc-statement-email` inline (4259–4288)** then `refreshGcLastSent` |
| `StagesBilledTotalByNameModal` | 4290–4303 | v2.3530; kernel `buildBilledTotalByNameEntries` (tested) |
| `StagesCapableToBillModal` | 4304–4325 | v2.3530; rows `buildCapableToBillBreakdownRowsWithPlans` |
| `StagesEstBillDateModal` | 4326–4347 | v2.3530; `setInvoiceEstimatedBillDate` (mutation prop) |

None of the three v2.3530 dialogs has a render test.

### 6. The modal tail (4353–5096, rendered regardless of `active`)

| Line | Opener state | Component | Notes (data writes / reloads) |
|---|---|---|---|
| 4353 | `newReportJob` | `NewReportModal` | saved → `loadJobs` + thread stats + notes for the job |
| 4374 | `crewModalJob` | `StagesCrewModal` | opened through `StagesCrewModalContext` (3033) |
| 4375 | `activityExpandJob` | `JobsStagesActivityExpandModal` | `commitStagesPctWithNote` + snapshot patch; people door → `manageJobPeople` |
| 4407 | `calendarJob` | `JobCalendarModal` | seeds `scheduleModalInitialDate` + `scheduleModalJob`; week dispatch → `/schedule-dispatch?jobId=&week=` |
| 4425 | `readyForBillingJob` + checks | `StagesReadyForBillingConfirmModal` | `confirmReadyForBilling` |
| 4437 | `createPartialInvoiceJob` + amount | `StagesCreatePartialInvoiceModal` | `createInvoiceFromModal`; displays and clears page-global `error` |
| 4453 / 4456 / 4459 | `paidEmailSettingsOpen` / `paymentEmailSettingsOpen` / `readyToBillNotifySettingsOpen` | `PaidInFullEmailSettingsModal` ×3 (default / `payment` / `ready_to_bill`) | |
| 4462 | `billedBreakdownOpen` | `BilledByCustomerBreakdownModal` | unfiltered; writes focus/flash directly |
| 4494 | `billedAgingChartOpen` | `BilledAgingChartModal` | unfiltered |
| 4505 | `sessionNotesModal` | `SessionNotesModal` | "Open on board" → `focusJobOnBoard` |
| 4517 | `billedPaymentForecastOpen` | `BilledPaymentForecastModal` | unfiltered; `onPaySpeedsChanged` → `refreshBilledPaySpeeds`; lien notice → `setLienDesk` |
| 4559 | `forecastShareModalOpen` | `PaymentForecastShareModal` | |
| 4560 | `chaseModalOpen` | `PaymentChaseModal` | `chaseFullQueue`; recorded → reload touches + promises; Move to Collections → `collectionsConfirm` (z 80 over call mode z 70) |
| 4593 | `fixBillLinesOpen` | `FixBillLinesModal` | **filtered** `stagesBoardLists.billedActiveRows` |
| 4600 | `promisedPayModalJob` | `SetPromisedPayDateModal` | saved → reload promises + records |
| 4612 | `paidProfitChartOpen` | `PaidProfitChartModal` | **filtered** `stagesBoardLists.paid` (see quirk 4) |
| 4622 | `billedShareModalOpen` | `BilledReportShareModal` | print = filtered billed rows + search |
| 4629 | `legalDesk` | `LegalDeskModal` (always mounted) | **filtered** `stagesBoardLists.collectionsJobs` (4632, see quirk 4), contract coverage, `legalMatters`; many doors back into the board |
| 4661 | `bankPaymentsModalOpen` | `BankPaymentsModal` (always mounted) → [map](./AR_PAYMENT_MODALS_ARCHITECTURE.md) | `bankPaymentsModalBilledRows`; applied → `loadJobs` |
| 4673 / 4678 / 4685 | `jobBookModalOpen` / `stagesHideGroupsModalOpen` / `combineSeparateModalOpen` | `JobBookModal` / `JobsStagesHideGroupsModal` / `JobsCombineSeparateModal` | Combine → `runJobsStagesSerializedPipeline(loadJobs)` |
| 4690 | `viewBillInvoice` | `BilledBillViewModal` | Stripe details → `runFetchJobs` (retry once on coalesced `undefined`) + `findInvoiceWithJobFromJobs`; void → `scheduleLoadJobsAfterMutation` |
| 4712 | `lienDesk` | `LienDeskModal` → [map](./LIEN_DESK_ARCHITECTURE.md) | `legalSignoff.ask` writes `legalRpc('legal_add_entry')` (4743); the notice door fetches an unloaded job via `fetchJobWithDetailsById` (the affidavit door only toasts); `onOpenEditJob` focus mapping (4758) |
| 4782 | `gcNotice` | `GcOnNoticeModal` | not mapped here; `onOpenEditJob` focus mapping (4793–4808) — a longer, divergent copy of 4758's |
| 4812 / 4833 / 4841 | `lienInstrumentsModal` / `lienToolingPrefillModal` / `lienReleaseModal` | `LienInstrumentsModal` / `LienToolingPrefillModal` / `LienReleaseModal` | recorded → `loadDemandOutJobIds` + `syncLienDeskAfterRecord`; issued → `loadLienReleaseJobIds` |
| 4849 / 4857 / 4865 | `jobContractModalJob` / `signedAgreement` / `contractSweepOpen` | `JobContractModal` / `JobSignedAgreementModal` / `JobsContractSweepModal` | → `loadJobContractCoverage` / `loadJobs`; sweep can set the `missing` filter |
| 4879 / 4885 | `aiaG702StagesJob` / `hazmatFeeJob` | `AiaG702G703Modal` / `HazmatFeeModal` | hazmat created → `loadJobs` + `loadHazmatFeeJobIds` |
| 4893 / 4915 | `markPaidJob` / `markPaidInvoice` | `BilledPaymentConfirmationModal` ×2 | `stripeModeForBillingFromRole`; invoice mode also reloads promises |
| 4930 / 4941 / 4956 / 4964 | send-back invoice / job / simple / collections | the four `Stages…Modal`s (v2.3535–3536) | handlers in cluster L |
| 4974 | `quickAssignJob` | lazy `QuickAssignSheet` (177) in `Suspense` | scheduled → targeted `fetchStagesUpcomingScheduleForJobs([id])`, no `loadJobs` |
| 4997 | `scheduleModalJob` | `ScheduleJobModal` (keyed by job id) | assignees from `users` |
| 5015 | `manageJobPeople` | `ManageJobPeopleModal` | the only team-member writer on this surface; changed → `loadJobs` |
| 5023–5092 | `returnEditBannerJobId && active` | fixed "Back to Edit Job" banner | `tryOpenEditJob` with `initialJob` |

- **Tests:** render tests exist for `LienDeskModal` 34, `JobsMapCard` 14, `JobsContractSweepModal` 13, `BilledPaymentForecastModal` 10, `LienInstrumentsModal` 9, `JobsStagesActivityExpandModal` 7, `GcOnNoticeModal` 5, `PaymentChaseModal` 4, `BilledPaymentConfirmationModal` 4, `LegalDeskModal` 2, `JobContractModal` 2, `BankPaymentsModal` (five files). **None** for `BilledByCustomerBreakdownModal`, `BilledAgingChartModal`, `FixBillLinesModal`, `SetPromisedPayDateModal`, `PaidProfitChartModal`, `BilledReportShareModal`, `PaymentForecastShareModal`, `BilledBillViewModal`, `JobCalendarModal`, `ScheduleJobModal`, `ManageJobPeopleModal`, `SessionNotesModal`, `StagesCrewModal`, `HazmatFeeModal`, `LienReleaseModal`, `LienToolingPrefillModal`, `JobSignedAgreementModal`, `AiaG702G703Modal`, `JobBookModal`, `JobsCombineSeparateModal`, `PaidInFullEmailSettingsModal`.
- **Extraction:** every inline dialog is out; what remains is 744 lines of wiring. The billed-money group (4462–4622; `SessionNotesModal` 4505 sits inside it but is not money) can move behind one `StagesBilledMoneyModals` host once cluster H is a hook; the open flags stay in the tab (the handle, the overview, the ☰ menu and the Billed header write them) — except `forecastShareModalOpen`, written only by the forecast modal, which can move with the host.

### 7. [`JobsStagesTable.tsx`](../src/components/jobs/JobsStagesTable.tsx) (513 lines — job-only sections)

- Callers: the Waiting / Working / Paid sites (§4) and the deck (§4b), via `StagesSectionList`. 65 prop fields — the former `renderStagesTable` params + the shared bundle.
- `colgroup` 9rem / flex / 14.5rem / 140 (285–291), `tableLayout: fixed`, `minWidth: STAGES_TABLE_MIN_WIDTH` (800). No Supabase. The ham-mode assigned-edit dropdown the old map named is gone; team edits go through `ManageJobPeopleModal`.
- Tests: `JobsStagesTable.render.test.tsx` (9).
- **Open:** consume the shared bundle as one typed prop.

### 8. [`JobsStagesUnifiedTable.tsx`](../src/components/jobs/JobsStagesUnifiedTable.tsx) (449 lines — job + invoice rows)

- Callers: Ready to Bill / Billed / Collections sites and the deck, via `StagesUnifiedSectionList`. 86 prop fields. Builds one `StagesUnifiedRowContext` (type 162–179; built as `rowCtx` 368–390) per render; row kinds split into `StagesUnifiedJobRow` / `StagesUnifiedInvoiceRow` (v2.3548); icon buttons in `StagesRowActionButtons.tsx`, thread row in `StagesExpandedThreadRow` (v2.3541). No Supabase.
- Tests: `JobsStagesUnifiedTable.render.test.tsx` (10), `StagesRowActionButtons` (2).
- **Open:** the single typed prop, same as §7.

### 9. [`jobsStagesRowShared.tsx`](../src/components/jobs/jobsStagesRowShared.tsx) (1,518 lines — shared renderers)

Function-returning-JSX style throughout (blocks `memo`); no hooks, no Supabase — side effects are `navigate` (1152), `tel:` (1200), `showToast` (541), and the context's openers.

| Lines | Export | Size | Consumers | Notes |
|---|---|---|---|---|
| 74–124 | type `StagesRowRenderContext` | 51 | Tab, Table, UnifiedTable, CardList, ActivityBox | 33 fields |
| 137 / 150 | `STAGES_TABLE_MIN_WIDTH` = 800 / `STAGES_EDIT_MODE_RAIL_WIDTH` = 18 | — | tables, rows, CardList, BillingTab | sized columns total 516px |
| 152–190 | `renderStagesEditModeRail` | 39 | Table, CardList, both unified rows, `JobsBillingTab` (side `right`) | |
| 197–199 | `renderStagesExpandedRowPanel` | 3 | `StagesExpandedThreadRow` | `position: sticky; left: 0` |
| 202–211 | `renderStagesTwoLineHeader` (+ private style) | 8 | **none** | dead export |
| 240–268 / 270–297 | `renderStagesJobHcpChip` / `renderStagesJobHcpSubline` | 29 / 28 | chip: CardList, BillingTab, StagesPhoneRow · subline: Table, UnifiedJobRow | |
| 305–356 | `renderStagesThreadFullscreenJobHeader` | 52 | CardList, JobCalendarModal, ActivityExpandModal, StagesExpandedThreadRow | narrow `JobCalendarJobIdentity` |
| 359–368 | `stagesWhenForJob` | 10 | CardList (+ internal) | `deriveStagesWhen` |
| 376–440 | `renderStagesScheduleStripCells` | 65 | CardList (+ internal) | two-week strip; ✓ / hollow cells from `stagesWorkedByJobId` |
| 470–608 | `renderStagesFieldAndBillingLines` | 139 | Table, UnifiedTable | NEXT / ENDS / Not scheduled / Done, BILL / PAID (`stripBillParts`), man-hours; private `whenLine` 443–468 |
| 611–647 | `renderJobAddressWithMap` | 37 | Table, both unified rows | |
| 654–679 / 685–689 | `renderAccountManChip` / `accountManOnlyStripeStyle` | 26 / 5 | chip: DetailJobModal (+ internal) · stripe: Table, CardList, both unified rows | |
| 698–704 | `stagesInvoiceRowAccent{Row,Rail}Style` | — | CardList, UnifiedInvoiceRow | green = invoice |
| 706–831 | `renderJobCustomerLine` | 126 | Table, UnifiedTable | desktop customer / GC / development / Account Man |
| 840–980 | `renderJobCustomerAndAddressLine` | 141 | CardList | card twin — **the GC / development / Account-Man block (759–804 vs 911–953) is duplicated** |
| 982–986 / 991–1026 | `shouldSuppressStagesRowJobThreadToggle` / `renderStagesThreadExpandButton` | 5 / 36 | Table, CardList, both unified rows | |
| 1034–1081 | `renderStagesViewReportsButton` | 48 | CardList, UnifiedJobRow (+ footer) | |
| 1090–1287 | `renderStagesQuickActionsStack` | 198 | Table, UnifiedTable | schedule, week dispatch, call, Dispatch, task (`showTaskDispatchButton`) |
| 1296–1466 | `renderStagesJobCellActivityFooter` | 171 | Table, UnifiedTable | inner `renderStagesInvoiceJumpChips` 1321–1368, `renderStagesStripeEmailedCustomerHint` 1370–1423, `renderStagesContractChip` 1425–1454 (contract + ⚖ legal chip) |
| 1468–1473 / 1475–1497 | `stagesRowHasProjectBanner` / `renderStagesProjectBannerRow` | 6 / 23 | Table, both unified rows | |
| 1500–1518 | `renderStagesJobColumnEstimateFooter` | 19 | Table, CardList, both unified rows | |

- **Tests:** no direct test file. Covered indirectly by the render tests of `JobsStagesTable` (9), `JobsStagesUnifiedTable` (10), `JobsStagesCardList` (5), `JobsStagesActivityBox` (5); its kernels are tested — `stagesScheduleStrip` 24, `stagesJobReferenceDates` 11, `customerLinkHeuristics` 6, `accountMan` 4, `invoiceBilling` 42.
- **Status:** extracted; the work is componentizing the three biggest renderers and deleting the dead export.

---

## Supabase tables, RPCs and edge functions touched by `JobsStagesTab` directly

(Everything else flows through the mutation / thread-notes engines, the cache context, custom hooks and the extracted modals. `jobsStagesRowShared.tsx` and both tables touch none.)

| Where | Table / RPC / edge fn | Verb |
|---|---|---|
| `refreshGcLastSent` 694 | `gc_statement_emails` | SELECT (500 newest) |
| `loadDemandOutJobIds` 835 | `job_demand_letters` | SELECT live, sent |
| `loadJobContractCoverage` 857 | `job_contracts`, `estimates` (customer-accepted) | SELECT |
| `loadHazmatFeeJobIds` 974 / `loadLienReleaseJobIds` 989 | `job_hazmat_incidents` / `job_lien_releases` | SELECT `voided_at IS NULL` |
| money loaders 1017–1085 | RPCs `get_billed_customer_pay_speeds`, `list_job_promised_pay_dates`, `list_payment_promise_records`, `list_payment_chase_touches` | read |
| send-back effect 2159 | `job_status_events` (+ `users(name)`) | SELECT latest |
| `loadStagesManHours` 2190 | RPC `get_man_hours_by_job` | read (RLS-scoped) |
| `createInvoiceFromModal` 2352 | `jobs_ledger_invoices`; RPC `ensure_single_ready_to_bill_invoice_for_job` | **INSERT**; RPC |
| GC Review `onSendStatement` 4259 | edge fn `send-gc-statement-email` | invoke |
| Lien desk `legalSignoff.ask` 4743 | `legalRpc('legal_add_entry')` | write |
| `confirmCollectionsMove` 2922 | RPC `set_job_collections_flag` via `lib/setJobCollectionsFlag` | write |
| `confirmSendBackJob` 2982 | edge functions via `prepareBilledInvoicesBeforeJobRevertToReadyToBill` | Stripe void prep |
| search effects 1905 / 1948 | schedule / clock tables via `lib/jobsStagesScheduleSessionSearch`; lean search + detail fetch | SELECT |

---

## Master summary table

| Region | File / anchor | Lines | Coupling | Risk | Status |
|---|---|---|---|---|---|
| Substrate: focus, search, modes, filters, lists (B–E) | `JobsStagesTab` 646–2458 (scattered) | ~500 | highest | — | **stays** |
| Schedule + labor maps (F) | 596–644, 2190–2350 | ~90 | low | low | man-hours → hook + kernel |
| Row-flag lookups (G) | 563–579, 833–1000 | ~180 | low (reloaders called from the tail) | low | → `useStagesRowFlags` |
| Billed-money data (H) | 1001–1192, 1722–1747 | ~220 | med (chip renderer, phone rows, 3 modals, overview) | low | → `useStagesBilledMoneyData` |
| GC statement round (I) | 692–716, 1648–1720 | ~100 | low-med (feeds chase via temperature) | low | → `useGcStatementRound` |
| Lien / legal desk wiring (J) | 756–794, 1594–1646, 4629–4811 | ~260 | med | low-med | stays; focus mapping → kernel |
| Deep-link consumers (K) | 1311–1402, 1842–1887 | ~140 | med (writes J / N / O state; `rtb` calls `focusStagesSection`) | med | → `useStagesDeepLinkParams` |
| Confirm handlers (L) + partial invoice IO (M) | 2159–2187, 2352–2437, 2898–3008 | ~230 | high (mutations, focus) | — | dialogs **extracted**; handlers stay |
| Command bar + ⋯ menu | `JobsStagesCommandBar` / `JobsStagesToolsMenu` | 61 in tab | low | low | **extracted** (v2.3532/3533) |
| Map + overview | 3120–3266 | 147 | low | low | children **extracted**; wiring stays |
| ☰ menu + jump strip + alerts | 3267–3379 | 113 | low | low | **extracted** (v2.3534, v2.3549) |
| Section IIFE | 3411–4192 | ~780 | highest | — | stays; seam done (v2.3538) |
| Follow-up deck rows (4b) | 2650–2877 | 228 | high | med | dedupe with §4 |
| Phone board (4c) | 1288–1310, 2579–2634 | ~80 | med | low | stays |
| IIFE dialogs (5) | 4194–4347 | 154 | low-med | low | children **extracted**; GC send IO → lib |
| Modal tail (6) | 4353–5096 | 744 | med | low per item | inline dialogs all **extracted**; money group → host |
| Job-only table | `JobsStagesTable.tsx` | 513 | high (prop fan-in) | low-med | extracted; single typed prop open |
| Unified table | `JobsStagesUnifiedTable.tsx` + 2 row files | 449 + 792 | highest | — | **row kinds split** (v2.3548) |
| Shared row renderers | `jobsStagesRowShared.tsx` | 1,518 | med (14 importers) | low-med | extracted; componentize 3 renderers |

---

## Stage-A candidates (pure logic → `src/lib/*` + tests, before any component move)

Done: `buildBilledTotalByNameEntries` (v2.3530); section totals, the twelve role gates, AR button name, section element ids, `customerListImpliesLinkedRow` (v2.3531); `planPartialInvoice` + `reclampedPartialInvoiceInput` (v2.3537).

| Candidate | Currently | Target |
|---|---|---|
| Returned-check role gate | inline `bankReturnedEnabled` (565) | `stagesGates.canSeeBankReturned` + a matrix row in `stagesRoleGates.test.ts` |
| Signer fallbacks | `lienToolingSenderFallback` / `lienReleaseSignerFallback` (1193–1206) restate `lienSignerNameFor`; `LienInstrumentsModal` (4819) is handed `lienReleaseSignerFallback`, which reads the *release* modal's job, so it falls back to the session name — decide that before the swap | call the existing kernel ([`lib/jobs/lienSigner.ts`](../src/lib/jobs/lienSigner.ts), 2 tests) |
| Lien focus → Edit Job options | two divergent inline ternaries (4758, 4793–4808) | `lienFocusEditJobOptions(focus)` + tests; both desks call it |
| Man-hours folds | `stagesManHoursByJobId` / `stagesLaborBreakdownByJobId` (2332–2350) | `lib/jobs/stagesManHours.ts` + tests |
| Collections note line (money) | `collectionsNoteLine` open balance + claim gap (1618–1625) | kernel beside `collectionsClaimGapWords` + tests |
| Round / desk counts (money) | `gcRoundCards` ready total (1718), `lienDeskCount` (1614), `promiseSlipByCustomer` (1067–1072) | fold into `gcStatementRounds` / `lienDeskMoneyCard` / `paymentPromises` + tests |
| Section header fallback | `sectionHdr` + `billedListRows` (3430–3463) | `lib/jobs/stagesSectionHeader.ts` + tests |
| Deep-link table | 8 consume-once effects (1311–1402, 1849) | pure `stagesDeepLinkActions(searchParams)` → { opens, strippedSearch } + tests; the hook applies it |
| Week-dispatch URL | `/schedule-dispatch?jobId=&week=` built at 4420 and in `jobsStagesRowShared` 1152 (and four other surfaces) | one `scheduleDispatchWeekUrl(jobId, weekYmd)` + test |

Already-extracted lib (add tests only where missing): `buildJobsStagesBoardLists` + friends, `buildBilledAgingBuckets`, `stagesMoneyBar`, `stagesJobReferenceDates`, `jobsStagesScheduleSessionSearch`, `stagesUpcomingSchedule`, `stagesWorkedDays`, `stagesScheduleStrip`, `stagesWhenPills`, `billedAwaitingPaymentReport`, `voidStripeInvoiceForRevert`, `jobNextLine`, `billedExpectedPay`, `paymentChase`, `paymentPromises`. **No tests:** `setJobCollectionsFlag`, `postSendBackReasonNote`, `returnEditJobFromStages`, `formatMoveIntoStageByOnLine`, `jobsStagesSerializedPipeline`, `invoiceWithJobFromJobList`, `jobBillingContext`, `jobLedgerCustomerForBilling`; `progressPaymentForJob` only through `StagesStageBar.render`.

---

## Preserve-quirks list (load-bearing — do not "fix" during moves)

1. **Always-mounted + `active`-gated body; modal tail unconditional; the six IIFE dialogs unmount while inactive** (Mount/state semantics). Effects key on `active`.
2. **The tab consumes eight one-shot URL params itself** (consume-once refs + `replace` navigation; `rtb` arms `window.__rtbFocusArmedAt` for 5 s to survive the StrictMode double mount, then polls — first tick 400 ms, then every 300 ms, up to 100 tries — until the Ready to Bill header holds still). The page router and the `!jobsListLoading` handle gate stay in `Jobs.tsx`.
3. **`bankPaymentsModalBilledRows` builds with an EMPTY search**; `JobsAccountsReceivable.tsx` carries the same derivation — keep it in `lib/jobsStagesBoard.ts`.
4. **Money never hides:** money surfaces read `unfilteredBoardLists` (1567–1576 comment). Exceptions today, preserve until decided separately: `PaidProfitChartModal` (filtered `paid`), `FixBillLinesModal` and `BilledReportShareModal` (filtered billed rows), `LegalDeskModal` (filtered `collectionsJobs`, 4632).
5. **Page-global `error`:** the partial-invoice dialog displays and clears it; `createInvoiceFromModal` and `confirmSendBackJob` write it. Do not localize.
6. **`sendBackChecked` is shared** by the job and invoice send-back dialogs, reset by every close; `stagesInvoiceSendBackConfirmLockRef` guards double-confirm on the invoice path only.
7. **Send-back to `ready_to_bill` runs the Stripe void prep** (edge) *before* `updateJobStatus`; failure blocks the move (`setError(prep.message)`). RTB → Working requires a reason and posts it as a thread note after the move.
8. **Bill Customer success follows the move** (`followMovedJob(id, 'billed')`) only via `onSuccess`, not `onAfterEnsureSuccess`.
9. **Partial invoice:** the insert happens first; a failed remainder re-sync (`ensureRemainderResyncOutcome`) is reported after the reload, never rolled back.
10. **Timers:** flash 2,600 ms; invoice scroll 200 ms; job scroll 250 ms + one 700 ms retry; return-edit banner 10 s; man-hours load 80 ms; schedule search 350 ms; server search 300 ms; thread stats 320 ms; `rtb` poller above. All deliberate.
11. **`STAGES_TABLE_MIN_WIDTH = 800` + `tableLayout: fixed` + colgroup 9rem / flex / 14.5rem / 140** (the Progress & payment column widened to 14.5rem in v2.3462). `renderStagesExpandedRowPanel` is `position: sticky; left: 0` for phone side-scroll.
12. **Per-device storage:** `jobs-stages-ham-mode`, `jobs-stages-follow-moves`, `jobs-stages-edit-mode`, `jobs-stages-mobile-cards` (unset → `max-width: 559px` media query, then the org default once loaded; a device choice wins), `jobs-stages-search-include-schedule-time` (**default off** — `parseStagesIncludeScheduleTimePref` is `raw === 'true'`), `jobs-stages-phone-overview-open`, `pipetooling_stages_sections_v2`, `pipetooling_pipeline_sort_v1` (the progress sort is session-only), `jobs-stages-exclude-filters`. All try/catch-wrapped.
13. **Fail-soft loaders:** `loadStagesManHours` resets its load-once ref on error (retry next visit); the demand / hazmat / lien-release / contract / money loaders swallow failures — a not-yet-deployed RPC just hides the chip or card.
14. **Paid section:** `fetchPaidJobsIfNeeded` fires via `queueMicrotask` on expand only (search no longer prefetches paid — v2.1819; the lean server search covers it). The count reads "Expand to load" until `paidJobsMergedForKey === jobsListDataKey`; during a search it counts matches (`stagesPaidHeaderSearchCount`) and the `stagesPaidSearchHint` row leads the board.
15. **Money-move doors clear the search first** (overview callbacks and `openMoneyMove`, v2.1960).
16. **Edit-mode rails are role-gated in the tab** (`stagesEditModeActive` 2144) so a stale stored flag cannot surface them for other roles.
17. **`applyStagesInvoiceFocus` deps list `stagesSearchExtraJobIds` but the body reads `stagesCombinedExtraJobIds`** (2222 vs 2242) — a stale-closure risk when only the server ids change. Verify and fix in its own PR, not during a move.
18. **Dead code, each for its own PR:** handle method `openLienDesk` (no caller), `renderStagesTwoLineHeader` (no importer).
19. ~~Capable modal `aria-label` copy/paste bug~~ — fixed; it now reads "Capable of Being Billed — Breakdown".

---

## Recommended extraction order (value ÷ risk)

1. **Stage-A sweep II** (low risk, one kernel per PR): the table above — returned-check gate, signer fallbacks, lien focus mapping, man-hours folds, collections note line, round / desk counts, section header fallback, week-dispatch URL. Dead-code removals (quirk 18) as separate PRs.
2. **Billed-money data seam** (`useStagesBilledMoneyData`, cluster H): 4 states, 4 loader effects + the chase and money-modal scope kicks (1095, 781), 3 memos, the reloaders. Its state is written only by its own loaders, so it moves cleanly (inputs it must take: `chaseModalOpen`, `billedMoneyModalOpen` (780, from three N flags), `gcTemperatureById`, `cacheLeanBilledRows`, `unfilteredBoardLists`, the cache scope API); `billedExpectedPayChipRenderer` stays in the tab and reads the hook. Pay speeds + promised dates also load in `useJobBilledExpectedPay`; those two + chase touches in `usePipelineMoneyOpportunities` and `DashboardFinancialsSection`; one or more of the four also in `BidBoardCustomerReviewModal`, `loadBridgeData`, `useLegalPacketData`, `useCustomerTermsWarning`, `useGcOnNoticeData`, `useLienDeskData` — design the hook to be shareable.
3. **Row-flag seam** (`useStagesRowFlags`, cluster G): 5 states, 5 effects, 4 reloaders the tail calls (`onRecorded`, `onIssued`, `onCreated`, `onChanged`) — the hook returns them.
4. **GC statement round seam** (`useGcStatementRound`, cluster I). Returns `gcTemperatureById` — land with or before step 2, which reads it. The [GC Review map](./GC_REVIEW_MODAL_ARCHITECTURE.md) (its step 8) builds the hook inside the modal first; this step moves 1648–1720 onto it.
5. **Deep-link consumer** (`useStagesDeepLinkParams`, cluster K) over the Stage-A table from step 1. Medium: preserve the consume-once refs, `replace` navigation and the `rtb` window arm.
6. **Section action props, once** — build `stagesSectionActionProps[stage]` at tab scope and spread it into both the §4 sites and `renderFollowupStageRow` (§4b). Medium risk (the ham / non-ham and bundle flag combinations); removes a ~200-line duplicate. Move byte-identically; consolidate nothing else in the same PR.
7. **GC Review send IO → lib** (`onSendStatement` 4259–4288: edge invoke + response parse), so the IIFE only wires callbacks. Coordinate with the GC Review map.
8. **Billed-money modal host** (`StagesBilledMoneyModals`, 4462–4622) after step 2; open flags stay in the tab.
9. **Row renderers → components** in `jobsStagesRowShared`: `renderStagesQuickActionsStack` (198), `renderStagesJobCellActivityFooter` (171), `renderStagesFieldAndBillingLines` (139); pull the duplicated GC / development / Account-Man block out of the two customer-line renderers.
10. **Tables take the shared bundle as one typed prop** (§7 / §8).

**What must STAY in `JobsStagesTab`:** the imperative handle and everything it writes (`stagesSectionOpen`, both focus / flash pairs, the modal flags the handle opens), `stagesBoardLists` / `unfilteredBoardLists` / `bankPaymentsModalBilledRows`, the search state and effects, the mode toggles, the section wiring, the confirm handlers and the partial-invoice IO (they call the page's mutation engine and write focus), and the prop plumbing for the parent-injected engines. **What stays in `Jobs.tsx`** (unchanged from the parent map): the URL router for the handle's params, the jobs cache, `customers` / `users`, the `useJobsStagesMutations` / `useJobThreadNotes` call sites, and the app modal contexts (`useJobFormModal`, `useJobDetailModal`, `useBillCustomerModal`; the tables and card list call `useDispatchTaskModal` / `useChecklistAddModal` themselves).

Verification gates, definition of done and anti-patterns: [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) (`npm run typecheck && npm run lint && npm test` green after every step; behavior-preserving only; one region per commit).
