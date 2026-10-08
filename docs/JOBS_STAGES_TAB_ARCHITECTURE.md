# Jobs Stages Tab Architecture Map (sub-decomposition)

---
file: docs/JOBS_STAGES_TAB_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 sub-decomposition map (per PAGE_DECOMPOSITION_PLAYBOOK.md) for the Pipeline board — src/components/jobs/JobsStagesTab.tsx (4,909 lines, 114 useState) and its shared row renderers jobsStagesRowShared.tsx (1,632), with short dossiers for the two section tables. The v2.3530–v2.3549 train moved the toolbar, jump strip, inline dialogs and table rows out; the tab grew back past 5k lines (billed-money engine, lien / legal desks, contract desk, phone board, follow-up deck) and the hook sweep of v2.4073–v2.4117 brought it under again. This map inventories every region at exact line ranges so the next round — hook seams for the money / row-flag / GC-round data, the deep-link consumer, the deck's duplicated section wiring — starts without re-deriving the strategy.
covers:
  - src/components/jobs/JobsStagesTab.tsx
  - src/components/jobs/jobsStagesRowShared.tsx
  - src/components/jobs/JobsStagesTable.tsx
  - src/components/jobs/JobsStagesUnifiedTable.tsx
mapped_at: 58caa94ee
audience: Developers, AI Agents
last_updated: 2026-10-08
---

> **Line numbers are as of `58caa94ee`** (v2.4706, from the `npm run map` fact sheets). This is the hottest surface in the repo (253 commits in 90 days on the tab, 82 on `jobsStagesRowShared`) — search the symbol, and trust a range only while the symbol still sits at it.

## What this surface is

The Pipeline board (tab label "Pipeline"; the `stages` key, URL slug and `JobsStages*` filenames are unchanged): Waiting → Working → Ready to Bill → Billed Awaiting Payment → Collections → Paid in Full, rendered by [`JobsStagesTab`](../src/components/jobs/JobsStagesTab.tsx).

| File | Lines | Shape |
|---|---|---|
| [`JobsStagesTab.tsx`](../src/components/jobs/JobsStagesTab.tsx) | 4,909 | `forwardRef(function JobsStagesTabInner)` 478–4907. Hook census: **114 useState** · 0 useReducer · **35 effects** (incl. `useImperativeHandle` 2339) · 48 useMemo · 28 useCallback · 3 useRef · 29 custom-hook calls. **60 props** (`JobsStagesTabProps` 358–430) + **11-method** `JobsStagesTabHandle` (333–356). 202 local imports; 68 distinct child elements in the render (3034–4906) |
| [`jobsStagesRowShared.tsx`](../src/components/jobs/jobsStagesRowShared.tsx) | 1,632 | 24 module functions, zero hooks, zero Supabase; **37-field** `StagesRowRenderContext` (80–145, 12 optional; `propertyKindByJobId` / `onPropertyKindSaved` since v2.4160, the contract-chip openers since v2.4342); `stagesOpenRowStyle` / `STAGES_OPEN_ROW_BAR` (v2.4131: the opened row and its thread row as one blue-barred card, under the amber flash); imported by 15 files |
| [`JobsStagesTable.tsx`](../src/components/jobs/JobsStagesTable.tsx) | 529 | job-only sections (Waiting / Working / Paid in Full); 69 prop fields |
| [`JobsStagesUnifiedTable.tsx`](../src/components/jobs/JobsStagesUnifiedTable.tsx) | 467 | job + invoice rows (Ready to Bill / Billed / Collections); 91 prop fields; row kinds in [`StagesUnifiedJobRow.tsx`](../src/components/jobs/StagesUnifiedJobRow.tsx) (420) / [`StagesUnifiedInvoiceRow.tsx`](../src/components/jobs/StagesUnifiedInvoiceRow.tsx) (376) |

Mapped in full: **6,541 lines** (the tab + `jobsStagesRowShared`); the two tables get short dossiers (§7 / §8), 996 more, and their two unified row files 796. Satellites (consumers of this map's seams, not mapped here):

| Satellite | Lines | Role |
|---|---|---|
| [`JobsStagesCardList.tsx`](../src/components/jobs/JobsStagesCardList.tsx) | 1,318 | Mobile-cards twin of both tables (`JobsStagesCardList` / `JobsStagesUnifiedCardList`), same props types — the tab swaps the tag (`StagesSectionList` / `StagesUnifiedSectionList`, 2034–2035). **Has no map of its own.** |
| [`JobsFollowupModal.tsx`](../src/components/jobs/JobsFollowupModal.tsx) | 1,011 | Follow-up deck; each card's row comes from the tab's `renderFollowupStageRow` (§4b) |
| [`JobsMapCard.tsx`](../src/components/jobs/JobsMapCard.tsx) / `JobsMapRail.tsx` | 830 / 143 | Jobs on a map (§2b) |
| [`PipelineOverview.tsx`](../src/components/jobs/PipelineOverview.tsx) | 253 | Money story + Today's Money Opportunities + Fix-ups (§2b) |
| [`StagesCustomerTimelineChips.tsx`](../src/components/jobs/StagesCustomerTimelineChips.tsx) | 40 | v2.4815: a search that names one to three customers offers each one's timeline; mounted once above the paid-search hint. The rows' GC name is the other Pipeline door (`renderGcTimelineDoor` in `jobsStagesRowShared`) |
| `JobsStagesActivityBox.tsx` · `JobActivityView.tsx` · `JobActivityFeed.tsx` | 414 · 437 · 325 | Wide-screen activity box and the one expanded activity body |
| [`JobsStagesActivityExpandModal.tsx`](../src/components/jobs/JobsStagesActivityExpandModal.tsx) | 179 | One instance in the tail (4155). Trap: it holds a `JobWithDetails` **snapshot** — `onCommitPct` patches `pct_complete` in place (4169); team edits show stale names until reopen |
| `JobsStagesThreadPanel.tsx` · `StagesExpandedThreadRow.tsx` | 177 · 92 | Expanded-row thread panel (mounts twice for a billed job — job row + invoice row) |
| `JobsStagesPhoneStrip.tsx` · `StagesPhoneRow.tsx` | 129 · 272 | Phone board (§4c) |

This is a *sub*-decomposition map. How the tab was carved out of `Jobs.tsx`, the page's URL router and the `useJobsStagesMutations` / `useJobThreadNotes` engines live in [`JOBS_TABS_ARCHITECTURE.md`](./JOBS_TABS_ARCHITECTURE.md) (§ `stages` dossier) — reference it, don't re-derive it. The Lien desk and GC Review mount here but have their own maps: [`LIEN_DESK_ARCHITECTURE.md`](./LIEN_DESK_ARCHITECTURE.md), [`GC_REVIEW_MODAL_ARCHITECTURE.md`](./GC_REVIEW_MODAL_ARCHITECTURE.md).

Changes since this map's previous line-number anchor (a05cef4c4, v2.3819; the census was re-taken at 58caa94ee, v2.4706, after some seventy commits on the tab): the hook sweep took three clusters out of the tab (billed-money loaders v2.4073, the deep-link doors v2.4080, the row-flag lookups v2.4110) and built each stage's action props once (v2.4117); the Pipeline row train (v2.4128–v2.4390: the property badge, the open-row card, the bill's dates block, the progress bar, the see-all door) landed in the sections and in `jobsStagesRowShared`; the stage bar (v2.4512–v2.4527) and the Lien desk doors (v2.4520–v2.4631) in the strip and the tail; `gcNoticeRereadKey` (v2.4628) and the `ownerrecords` door (v2.4702) are the newest states. Before that (829c507cd → a05cef4c4) the tab had gained the returned-check badge + `openPaymentsReceived` (v2.3806), the lien card on the money strip (v2.3799, `lienDeskMoneyCard`), the Lien desk's ask-counsel sign-off wiring (v2.3790, `legal_add_entry` at 4546) and the GC-on-notice Edit Job focus doors (v2.3819, the `GcOnNoticeModal` mount in §6). The Do now (Next up until v2.4630) train (punch list #82): a plain open of the Lien desk passes `initialKind='next'` (v2.4583); the `lienDesk` state's `kind` union gained `next` and `retainage`, and the `LienInstrumentsModal` mount takes `onOpenLienDesk` (the window closes itself and the desk opens on the job, the next-step card's door) and `onOpenRelease` (v2.4585); the desk's three views (v2.4588) changed nothing in the host. Since v2.4612 the `lienDesk` state carries `aim` (`Date.now()` on each press of a next-step door, passed as `aimKey`), so a desk already open on the job still switches to the tab. Since the v2.4706 census two commits touched the tab — v2.4711 (`canEditFirm`, one line) and v2.4735 (`openLastWork` + `onLastWorkSaved`, twelve lines) — so a range below sits up to thirteen lines low; the file is 4,922 lines on 2026-10-06.

### Mount/state semantics (preserve in every extraction)

- `Jobs.tsx` (1900) renders `<JobsStagesTab ref={stagesTabRef} active={activeTab === 'stages'} …/>` **unconditionally**. The board is `{active && …}` (3038–4131); the **modal tail (4132–4906) renders regardless**, so Pipeline state survives tab switches.
- **Exception:** the six dialogs mounted inside the section IIFE (3963–4129: Weekly movement, Weekly money, GC Review, Total by Name, Capable, Est-bill-date) sit inside the `active` block — their open flags survive a tab switch, the dialogs unmount.
- **The handle** (`useImperativeHandle`, 2339–2385): `followMovedJob`, `focusSection` (= `focusStagesSection` 1764; since v2.4759 on the phone board it is `pickPhoneStage` — one stage open — so a `?stagesSection=` door lands on its stage), `focusJob` (= `focusJobOnBoard` 2322), `focusInvoice` (= `applyStagesInvoiceFocus` 2111), `openBankPayments`, `openLegalDesk`, `openLienDesk`, `openWeeklyMovement`, `openWeeklyMoney`, `showBilledTotalByName`, `openMoneyMove` (keys `capable` / `chase90` / `fixDates` / `ar` / `chase` / `gcRoundCertify` / `gcRoundStart`, each clearing a live search first). `Jobs.tsx` calls every method except `openLienDesk`, which has no caller in `src/`.
- **URL: the tab is no longer read-only.** The page router still drives the handle for `?stagesSection` / `stagesJob` / `stagesInvoice` / `openBankPayments` / `stagesWeekly` / `stagesMoney` / `stagesMove` / `legal` / `showBilledTotalByName`. The tab hands ten one-shot params to [`useStagesDeepLinkParams`](../src/hooks/useStagesDeepLinkParams.ts) (called at 1297, v2.4080), which consumes each once and strips it with `navigate({ search }, { replace: true })`: `followups`, `gcReview`, `gcnotice`, `liendesk` + `liendeskJob` / `liendeskPile` (any pile, v2.4561) / `kind` (with none of the three the desk opens on Do now (Next up until v2.4630), v2.4586), `lienwindow` + `lientab` (v2.4562: a job's Lien window on a tab, the job read by id; build the address with `lienWindowHref`), `ownerrecords` (v2.4702: the Lien desk with Records for an owner on the property holding that job; build the address with `ownerRecordsHref`), `round` + `gc`, `chase`, `forecast`; `rtb` is [`useStagesRtbFocus`](../src/hooks/useStagesDeepLinkParams.ts) (1775 — a layout-settle poller, below). Three more are lazy-init reads of `window.location.search`: `contractSweep` (882), `contract` (900), `view=recent` (1390). Read-only: `openBankPayments` for the loading hint (3302), `tab` for the return-edit banner (2150). The comments at 1387 ("the tab never writes search params") and 897 are stale.

### Old/New views — retired

The Old / New pills (v2.1915) retired in v2.2012 (comment at 3191–3194): `PipelineOverview` is the only view, and it steps aside while the search box has text (`pipelineOverviewHiddenBySearch`, 2957). Its view-models come from [`lib/jobs/pipelineOverview.ts`](../src/lib/jobs/pipelineOverview.ts) over `cacheHeaderStats`.

---

## The shared substrate

There is **no selected-record pointer**. Six layers instead:

1. **Parent-injected engines (stay in `Jobs.tsx`).** The jobs cache props (`jobs`, `jobsListLoading`, `jobsListRefreshing`, `jobsListSnapshotAt`, `jobsListError`, `paidJobsLoading`, `jobsListDataKey`, `paidJobsMergedForKey`, `loadJobs`, `runFetchJobs`, `fetchPaidJobsIfNeeded`, `customerFilterForFetch`, `scheduleLoadJobsAfterMutation`), the 12 [`useJobsStagesMutations`](../src/hooks/useJobsStagesMutations.ts) values (8 functions + 4 busy ids) and the 15 [`useJobThreadNotes`](../src/hooks/useJobThreadNotes.ts) values (2 optional; shared with Job Summary). Any extraction re-threads them; it never re-hosts the hooks.
2. **The cache context's scope API, read directly** (`useJobsListCache`, 672–679): `cacheMergedScopes`, `cacheScopeLoading`, `cacheFetchScopeIfNeeded`, `cacheHeaderStats`, `cacheLeanBilledRows`, `cacheSetJobs`. Eight fetch-scope effects share one retry-until-merged shape: 686 (open sections), 792 (billed money modals → `NON_PAID_SCOPES`), 800 (Legal desk), 807 (paid profit chart → paid), 976 (chase), 1376 (cross-section modals / display filters), 1406 (map), 1514 (Lien desk → `billed_all`, the Calendar's rows, v2.4321).
3. **Board lists (the data engine).** `stagesBoardLists` (1426–1447) = `buildJobsStagesBoardLists` over the filter chain exclusions → GC → development → account man → contract coverage, plus search, combined extra ids, sort mode and the `next` comparator. `unfilteredBoardLists` (1471) = `buildJobsStagesBoardLists(jobs, '')` — **money-never-hides**: GC Review, the chase queue, the aging chart / forecast / who-owes-what modals, the Capable plan inputs, the round cards and the follow-up deck read it, never the filtered lists. `bankPaymentsModalBilledRows` (1940) is the same empty-search build's `billedRows` (AR sees Collections too), mirrored in `JobsAccountsReceivable.tsx`. `applyStagesInvoiceFocus` builds a third, search-aware copy on demand (2118). Builder tested in [`lib/jobsStagesBoard.ts`](../src/lib/jobsStagesBoard.ts) (90 tests).
4. **The selection analog: focus/flash + section-open.** `stagesSectionOpen` (663, persisted by the 664 effect), the job pair `pendingStagesJobFocusId` / `stagesJobFlashId` (659/660), the invoice pair (656/657). Writers: `focusStagesSection` 1764, `followMovedJob` 1778, `jumpToNumberMatches` 1886, `applyStagesInvoiceFocus` 2111, `focusJobOnBoard` 2322, `pickPhoneStage` 1259, `openFollowupBoardRow` 2778, `confirmCollectionsMove` 2844, the section headers' `toggleStages` (3331) and the Paid expand (3878), the Total-by-Name / Capable dialogs (4077 / 4099, section-open only), the who-owes-what modal's `onOpenBill` (4246–4255). **Must stay in the tab**; children get callbacks.
5. **The row-render context.** `StagesRowRenderContext` (37 fields) is the seam between the tab and the renderers. The tab builds `stagesTableShared` (2398–2459, 55 keys) and `stagesUnifiedTableShared` (2531–2543, that spread + 10 invoice keys) once and spreads them into the six section sites and the deck rows (the v2.3538 prop-bundle seam); the tables build the ctx from those props plus `useNavigate` / `useDispatchTaskModal` / `useChecklistAddModal`. Widen *this* seam, never invent a second one.
6. **Role gates.** `import * as stagesGates` ([`lib/jobs/stagesRoleGates.ts`](../src/lib/jobs/stagesRoleGates.ts), 10 tests) — 37 reads over 12 gates. Still inline: `bankReturnedEnabled` (575) and three `authRole === 'dev'` reads (3990, 4314, 4435).

---

## Region dossiers (inside `JobsStagesTab.tsx`)

### 1. Logic block (482–3033) — state clusters

Every `useState` and effect is assigned to exactly one cluster (sums 114 / 35 at 58caa94ee: rows G, H and K count what stays after their hooks, J gained `gcNoticeRereadKey`; the other rows carry the a05cef4c4 census, which summed to 120 / 51).

| Cluster | Anchors (lines) | useState | Effects | Data / loaders | Tests | Status |
|---|---|---|---|---|---|---|
| **A. Page context** | props destructure 482–543; `useSearchParams` / `useNavigate` 545–546; `useJobAccountEvidenceGapsNudge` 548; `useOwnerConfirmRows` 550 | 0 | 0 | hook RPCs | — | stays |
| **B. Focus / flash / sections** | 656–688; `focusStagesSection` 1764–1772; `followMovedJob` 1778–1788; `jumpToNumberMatches` 1886–1909; `jumpViaLeanLookup` 1917–1938; `applyStagesInvoiceFocus` 2111–2139; flash / scroll 2166–2214; `focusJobOnBoard` 2322–2337 | 5 | 6 | `fetchLeanJobIdsByNumber` + `fetchJobsLedgerWithDetailsForStages` → `cacheSetJobs` | tab render (toggle, `focusJob`, handle); `stagesSectionPrefs` 4, `stagesJobNumberJump` 4, `leanJobSearch` 4 | **stays** (substrate #4) |
| **C. Search** | 741–753; schedule/clock search 1792–1827 (350 ms); server all-jobs search 1836–1877 (300 ms); thread stats 1970–1982 (320 ms) | 5 | 3 | `fetchJobIdsMatchingScheduleOrClockSessions`, `fetchLeanJobSearchIds`, `refreshJobThreadStatsForJobIds` | `jobsStagesScheduleSessionSearch` 9, `stagesPaidSearchHint` 5; tab "search filters" | stays |
| **D. Modes** | 1193–1242; org default 1221–1226; toggles 1984–2052; `stagesEditModeActive` 2039 | 5 | 1 | localStorage + `useOrgDefault('jobs.stages.mobile_cards')` | tab (Edit mode, Mobile cards ×2) | stays (feed the ⋯ menu) |
| **E. Filters / sort / views / lists** | contract sweep + filter 880–904; `renderStagesOpenDetailJobName` 1299–1331; filters 1333–1384; recent view 1388–1394; map live rows 1401–1408; sort 1411–1424; `stagesBoardLists` 1426–1448; when pills 1451–1460; `unfilteredBoardLists` 1471; Capable 1477–1488 | 10 | 2 | — | `jobsStagesBoard` 90, `jobsStagesExcludeFilters` 10, `jobsStagesSortMode` 7, `stagesWhenPills` 5, `jobContractCoverage` 13, `capableToBillPlan` 5 | **stays** (substrate #3) |
| **F. Schedule + labor side maps** | upcoming 606–624; week so far 625–643; man-hours 649–654, loader 2085–2098, 80 ms effect 2220–2225, folds 2228–2229 | 4 | 3 | `fetchStagesUpcomingScheduleForJobs`, `fetchStagesWeekSoFarForJobs` (both keyed on `stagesUpcomingIdsKey` 610); RPC `get_man_hours_by_job` | `stagesUpcomingSchedule` 11, `stagesWorkedDays` 5; **man-hours folds untested** | extract `useStagesManHours` + fold kernel |
| **G. Row-flag lookups** | bank returned 575–579 (`useBankReturnedPaymentsNudge` 576); `useDemandOutJobIds` 838; `useJobContractCoverage` 844 (the `job-contract-changed` listener lives in the hook); `useJobContractsNudge` 858, `useJobCrewPositions` 862; `openHazmatFee` 917–924; `useHazmatAndReleaseJobIds` 926 | 0 | 0 | tables `job_demand_letters`, `job_contracts`, `estimates`, `job_hazmat_incidents`, `job_lien_releases`; hooks `useBankReturnedPaymentsNudge`, `useJobContractsNudge`, `useJobCrewPositions` (862); `job-contract-changed` window event (845) | `jobContractCoverage` 13, `bankReturnedDeposits` 8; loaders untested (fail-soft) | **moved v2.4110** → [`useStagesRowFlags`](../src/hooks/useStagesRowFlags.ts) (three hooks: demand letters, contract coverage, hazmat + releases); bank returned was already `useBankReturnedPaymentsNudge` |
| **H. Billed-money data** | `useBilledMoneyData` 964 (the four loaders, their reloaders and the slip memo); money-modal scope kick 792; chase kick 976; `billedBillLineRenderer` 1092 (v2.4130: the words line under the bar + what sits under the cell); `chaseFullQueue` 1635 | 0 | 2 | RPCs `get_billed_customer_pay_speeds`, `list_job_promised_pay_dates`, `list_payment_promise_records`, `list_payment_chase_touches` (all cast `as never`, so the fact sheet's RPC list misses them) | `billedExpectedPay` 20, `paymentPromises` 19, `paymentChase` 18, `paymentReliability` 9; **the chip renderer, `BilledExpectedPayChip`, `BilledReliabilityLine` untested** | **loaders moved v2.4099** → [`useBilledMoneyData`](../src/hooks/useBilledMoneyData.ts) (the 4 states, loaders, reloaders, slip memo); scope kicks + chase memos still in the tab |
| **I. GC statement round** | last-sent 702–716; round 1546–1635 | 5 | 3 | table `gc_statement_emails`; `listGcReviewCertifications`, `listGcStatementRoundMarks(Since)`, `listGcStatementSenders` | `gcStatementRounds` 14, `gcReviewCertification` 10, `temperatureBoard` 4, `gcReviewRollup` 9; `gcRoundCards` (1604) ready-total reduce inline | **seam candidate** (`useGcStatementRound`) |
| **J. Lien / legal desks** | `legalDesk` (765, its state is counted in N) + `useLegalMatters` 767; states here = `lienDesk` 1504, `gcNotice` 1507, `gcNoticeRereadKey` 1508 (v2.4628: the desk re-reads on close), `lienDeskIssuerGen` 1528; Legal scope kick 800; forecast work months 1501–1527; Lien desk 1509–1545 | 4 | 2 | `useLienDeskData` (light read while closed), `useForecastWorkMonths` ×2, `fetchPhysicalInvoiceIssuerFromAppSettings` (1534) | `lienDeskMoneyCard` 5, `lienClaimCorrection` 5, `lienSigner` 2 | stays; desks mapped in [`LIEN_DESK_ARCHITECTURE.md`](./LIEN_DESK_ARCHITECTURE.md) |
| **K. Deep-link consumers** | `useStagesDeepLinkParams` 1297 (ten doors, one effect, one consumed set per mount); `useStagesRtbFocus` 1775 (the `rtb` poller) | 0 | 0 | `navigate` replace | 16 (hook) | **moved v2.4080** → [`useStagesDeepLinkParams` + `useStagesRtbFocus`](../src/hooks/useStagesDeepLinkParams.ts) |
| **L. Confirm dialogs** | ready-for-billing 758–760; send-back 1162–1187; simple 1188; collections 1189–1192; effects 2054–2082; handlers 2820–2930 | 13 | 2 | table `job_status_events` (2060); `setJobCollectionsFlag` → RPC `set_job_collections_flag`; `prepareBilledInvoicesBeforeJobRevertToReadyToBill` (edge); `postSendBackReasonNote` | dialogs: `StagesSendBackModals` 4, `StagesSmallConfirmModals` 3; kernels `jobSendBackContext` 5, `jobSendBackNote` 9, `voidStripeInvoiceForRevert` 12; **handlers, `setJobCollectionsFlag`, `postSendBackReasonNote` untested** | dialogs extracted (v2.3535/3433); handlers stay |
| **M. Partial invoice** | 600, 646–647; `createInvoiceFromModal` 2231–2307; `reclampPartialInvoiceAmount` 2309–2316 | 3 | 0 | **INSERT `jobs_ledger_invoices`** + RPC `ensure_single_ready_to_bill_invoice_for_job` | `planPartialInvoice` (in `jobsStagesBoard.test`), `ensureRtbRemainderResult` 5, dialog 2; **the IO is untested — money write** | dialog extracted (v2.3537); IO stays |
| **N. Row openers + board modal flags** | openers 551–605, 645, 692, 761–762, 827–836, 845–848, 905–911, 979; flags 690–740, 763–816, 967, 1380, 1712; banner 597–598 | 53 | 8 | — | covered per modal (§6) | **stays** — written by the handle, overview, ☰ / ⋯ menus, rows |
| **O. Phone board + follow-up deck** | 1252–1265; `phoneNextInput` / `phoneRowsFor` 2461–2530; deck 2699–2799 | 4 | 1 | — | `jobNextLine` 12, `jobFollowupQueue` 17; **`phoneNextInput`, `renderFollowupStageRow`, `JobsFollowupModal`, `JobsStagesPhoneStrip`, `StagesPhoneRow` untested** | §4b / §4c |
| **P. Handle + prop bundles** | handle 2339–2385; `stagesTableShared` 2398–2459; `stagesUnifiedTableShared` 2531–2543; `stagesToolsFilters` 2802–2812; `sectionToolsOnSelect` 2933–2955 (14 doors) | 0 | 1 | — | tab "handle methods callable" | **stays** |
| **Q. AR memos** | 1940–1961 | 0 | 0 | `billedAgingBuckets` falls back to `cacheHeaderStats.billedAging` until `billed_all` merges | `stagesAccountsReceivableButton` 4, `invoiceBilling` 42 | stays |

Cluster N's 52 states: 18 single-job opener targets (`activityExpandJob`, `crewModalJob`, `newReportJob`, `manageJobPeople`, `scheduleModalJob` + `scheduleModalInitialDate`, `quickAssignJob`, `calendarJob`, `sessionNotesModal`, `markPaidJob`, `markPaidInvoice`, `viewBillInvoice`, `lienInstrumentsModal`, `jobContractModalJob`, `aiaG702StagesJob`, `lienReleaseModal`, `hazmatFeeJob`, `promisedPayModalJob`), 31 board-level flags (incl. `billedAgingFilter`, `gcReviewStartRound` / `gcReviewRoundGcId`, `weeklyMoneyInitialMonday`, `billedTotalByNameExpandedName`, `stagesToolsMenuOpen`), `whenInvoiceBillModal` + date, and `returnEditBannerJobId`. Where anchors overlap, a state counts once: `ownerConfirmModalOpen` (551, a flag anchored with the openers), `jobContractModalJob` (846) and `hazmatFeeJob` (911) inside G's ranges, `chaseModalOpen` (967) inside H's and `stagesHideGroupsModalOpen` (1380) inside E's are N; 600 is M, 701 is I, `contractSweepOpen` (880) is E. Its eight effects: the paid-profit-chart scope kick (805), the alert auto-closes (1730, 1736, 1742), the Total-by-Name reset (2216) and the return-edit banner trio (2141, 2148, 2157).

### 2. Command bar + ⋯ tools menu (3049–3110) — extracted

- [`JobsStagesCommandBar.tsx`](../src/components/jobs/JobsStagesCommandBar.tsx) (442 lines, v2.3533): New Job, Follow-ups (+ `followupQueueCount`), Forecast (`canSeeBilledExpectedPay`), search + busy hints, Session notes, the # jump (`jumpToTypedNumber` 2814), applied-filter chips (sort / contract / GC / development / account man / Hide groups); the menu passed as `toolsMenu`. 5 render tests.
- [`JobsStagesToolsMenu.tsx`](../src/components/jobs/JobsStagesToolsMenu.tsx) (513 lines, v2.3532), 3072–3110: controlled `open` (the whole-board load at 1350–1359 reads it); `filters` = `stagesToolsFilters`; `gates` {lienDesk, jobContracts, officeTools, powerToggles}; `lienDeskCount`, `contractSweepCount`; seven doors (Lien desk, Put a GC on notice, contract sweep, Hide groups, Job Book, Total by Name, Combine / Separate); five `toggles`. 6 render tests.
- **What stays:** every filter / sort / toggle value and setter, the open flags, the counts, the gates.

### 2b. Map + money overview (3111–3197) — extracted children, tab-side wiring

- **Phone fold** (3133–3162): on the phone board the map + overview sit in one "Overview" block at `order: 99`, closed by default, remembered via `readDeviceString` / `writeDeviceString(STAGES_PHONE_OVERVIEW_KEY)`.
- **`JobsMapCard`** (3168–3196): `stagesBoardLists.filtered`, paid-scope load, `onNeedLiveRows` → `requestLiveRowsForMap` (1402; the 1406 kick), pin → row via `jumpToNumberMatches` or `jumpViaLeanLookup`. 15 render tests.
- **`PipelineOverview`** (`renderPipelineOverview` 2956–3033, drawn at 3163–3197; the deck, `JobsFollowupModal`, sits at 3111–3125): contract coverage + stage-gap door (sets `stagesContractFilter = 'missing'`), stats, three gates, AR count, the money-move doors (each clears the search first — v2.1960), `fixupCounts` {noCustomer, noPictures, noEmail, noJobAccount, ownerConfirm} + `onFixup` (no-job-account navigates to `/materials?tab=job-accounts&filter=no_account`), `gcRound`, `chase`, `burnAlert`, `lienNotices`. 9 render tests; kernel `pipelineOverview` 13.

### 3. Section tools ☰ + jump strip + alert modals (3199–3323) — extracted

- Desktop only (`phoneBoard ? null`): [`JobsStagesSectionToolsMenu`](../src/components/jobs/JobsStagesSectionToolsMenu.tsx) (v2.3549; `inputs` from the **unfiltered** lists so GC Review stays reachable; `onSelect = sectionToolsOnSelect`; each row's line icon is named by the kernel (`StagesToolGlyph`) and drawn by [`StagesToolsMenuGlyph`](../src/components/jobs/StagesToolsMenuGlyph.tsx) since v2.4524; 5 tests) + [`JobsStagesJumpStrip`](../src/components/jobs/JobsStagesJumpStrip.tsx) (v2.3534; `jumpStripCounts` via `stagesJumpStripCount`). Since v2.4512 the strip is the **stage bar**: it owns the whole row (`leading` = the ☰ menu, `trailing` = the *Back to board* pill, drawn only while the Recently-added view is open; `tail` = `StagesLienDeskShortcut`, the gavel beside the last stage that opens the Lien desk for `lienDeskEligible` roles, v2.4520), sticks to the top (`.stagesStageBar`), prints each section's dollars (`jumpStripTotals`, the headers' own `stagesSectionHeader` totals), and lights the section being scrolled through — kernel [`stagesStageBar.ts`](../src/lib/jobs/stagesStageBar.ts) (`stageBarItems`, `stagesActiveSection`, `STAGE_BAND_COLOR`; 6 tests), 4 render tests. It sets `--stages-jump-offset` on the document so a section header (`.stagesSectionBand`, colored by `stageColorVar`, title by `StagesSectionBandTitle`) lands just under it.
- Alert modals: `StagesAlertJobListModal` ×2 (no email 3259, no pictures 3284), `StagesNoCustomerJobsModal` (3271), `OwnerConfirmListModal` (3277; 2 tests). Opened only from the overview's Fix-ups; lists from 1698–1711 with auto-close effects 1730–1746.
- Loading / snapshot lines (3293–3321) use `BoardSnapshotAgeChip` (module scope 456–474, v2.3610).

### 4. Section wiring IIFE (3324–4129)

`{(() => { … })()}` returns `JobsRecentlyAddedList` while `stagesRecentViewOpen`; otherwise:

- **Totals + helpers** (3336–3410): `waitingTotal` / `workingTotal` = `stagesJobsOpenBalanceTotal`; `capableToBillTotal` = `capableToBillTotalWithPlans(working, workingStageInputs)`; `readyToBillTotal` = `readyToBillRowsExposureTotal`; `billedTotal` / `collectionsTotal` = `billedRowsRemainingTotal`; `billedListRows` = the aging-chip filter over `billedActiveRows` (inline; list only, headers keep the whole section). `sectionShown` / `sectionMerged` (every scope of `scopesForStagesSection` landed, v2.4761) / `sectionScopeBusy` / `sectionHdr` (header count + total from live rows when merged or searching, else `cacheHeaderStats`, else `…` — inline, untested); phone-strip numbers (3375–3395); `canManageCollections`; `paidSearchHint`.
- **Phone strip** (3411–3420) and **paid-search hint** row (3421–3457, `data-testid="stages-paid-search-hint"`).

| Section | Header (id via `stagesSectionElementId`) | Body | Wiring notes |
|---|---|---|---|
| Waiting | 3458 | 3470–3479 | `StagesSectionList {...stagesTableShared}`, `Move to Working` |
| Working | 3481 (when pills 3492–3509, `⇅ Next first` 3516) | 3531–3541 | `workingShown`; ham → `nudgeMissingBillingEmail` + direct move, else the `readyForBillingJob` confirm (on the phone board it carries `advanceConsequence`); send back → Waiting (ham direct / `sendBackConfirmJob`) |
| Ready to Bill | 3549 (owner ⚙ notify 3559–3570) | 3573–3582 | `StagesUnifiedSectionList {...stagesUnifiedTableShared}`, `Bill Customer`: customer-link guard (`jobLedgerHasCustomerForBilling`) → `billCustomer.openBillCustomer`; send-backs carry `sendBackJobBillingContext(j.invoices)` |
| Billed Awaiting Payment | 3584 (aging chips 3595–3636; GC Review 3640; AR button 3652 + unallocated badge 3669–3695; share 3697; aging chart 3709; forecast 3721; payment email 3733; aging-filter banner + Fix bill lines 3747–3789) | 3791–3801 | `billedExpectedPayChip={billedExpectedPayChipRenderer}`, `Mark Paid`, lien doors, Move to Collections (`setCollectionsConfirm` direction `to`) |
| Collections | 3803 (⚖ Legal desk 3816–3839; Lien desk 3840–3855) | 3858–3871 | `jobNoteLine={collectionsNoteLine}`; send-backs → `collectionsConfirm` direction `from`; `billedBillLine={billedBillLineRenderer}` since v2.4758 — before it only the Billed site (3799) wired the renderer, so its Collections-shell branch (1106–1140: *In Collections N days · no bill line* with the flag day in its title, and *They said…*) never rendered (punch list #93 A). Since v2.4792 (punch list #94) the site renders `collectionsRows` (the chased ones), then the **Uncollectible band** (`data-stages-uncollectible-band`: count, dollars) over a second `StagesUnifiedSectionList` of `uncollectibleRows` with `stagesSectionActionProps.uncollectible` (Mark Paid, View Bill, no lien door, `rowStamp: uncollectibleFactsFor` → `StagesUncollectibleStamp` in the money cell, *Put back* (v2.4818; was *Put it back in Collections*)); the Collections props gain `onJobMarkUncollectible` (the *Uncollectible…* door → `StagesUncollectibleConfirmModal`, reason required → `setJobUncollectible`, then `mark-stripe-invoice-uncollectible` per Stripe bill) |
| Paid in Full | 3874 (lazy `fetchPaidJobsIfNeeded` via `queueMicrotask` 3881; count 3890–3901; profit chart 3914; paid email 3926) | 3939–3961 | `actionLabel={null}`; send back to Billed |

- **Status:** stays (highest coupling). Seam done (v2.3538 spreads); the per-section *action* props are built once as `stagesSectionActionProps` (v2.4117) and spread here and in the deck (§4b). Paid in Full keeps its props at its site (no deck row).

### 4b. Follow-up deck rows — `renderFollowupStageRow` (2699–2777) + deck glue (2778–2799)

- Renders the job's real Pipeline row for a deck card: `StagesSectionList` / `StagesUnifiedSectionList` with `hideHeader`; waiting / working pass `jobList={[job]}` (from `jobs`), the unified stages narrow `unfilteredBoardLists` rows to the one job; stage ∈ waiting / working / ready_to_bill / collections / billed. Writes 13 of the tab's confirm / opener states (fact sheet).
- **Action props (v2.4117):** each stage spreads `stagesSectionActionProps[stage]`, the same object the §4 sites spread. Before that the deck held a second copy of every stage's wiring; the extraction diffed the two and found three differences — Working's Ready to Bill confirm carries the phone board's consequence line only at the section site (kept: the section overrides `onAction` through `readyToBillFromWorking`), a comment, and the collections gate spelled two ways (same value).
- Glue: `openFollowupBoardRow` (closes the deck, opens the section, focus + flash), `openFollowupActivity` (activity modal over the deck), `followupLiveJobIds` / `followupLiveJobStages` (2798–2799).
- **Tests:** the tab's render smoke pins the section moves (Move to Working; Ready to Bill and Mark Waiting confirm, or act directly in ham mode); the deck rows are still untested.

### 4c. Phone board (punch list #30)

- `phoneBoard = isMobile && stagesMobileCards` (1252); one stage at a time — `phoneActiveStage` = first open section (1258), `pickPhoneStage` closes the rest (1259), 1262 ensures one is open. `phoneRowFilter` all / needs / today; `phoneOverviewOpen` per device.
- `phoneNextInput` (2461–2509) composes `progressPaymentForJob`, `billedExpectedPayModel`, `stagesBillSentPctAlert`, quiet days, returned check, contract, upcoming, crew and the bill line (`phoneBillWords`, v2.4760: a Billed / Collections bill row reads `billedReferenceYmd`, the rest the latest event) into a `jobNextLine` input; `phoneRowsFor(stage)` (2510–2530) hands the tables `nextLineFor` / `advanceConfirm` / `advanceConsequence` / `onChip`.
- Status: stays for now; `phoneNextInput` is a pure-input builder — Stage-A candidate once H is a hook.

### 5. IIFE-mounted dialogs (3963–4129)

| Dialog | Lines | Notes |
|---|---|---|
| `JobsWeeklyMovementModal` | 3963–3969 | `canSchedule` = office gate |
| `JobsWeeklyMoneyModal` | 3970–3976 | `initialMondayYmd` from the handle / ☰ menu |
| `JobsGcReviewModal` | 3977–4069 | mapped in [`GC_REVIEW_MODAL_ARCHITECTURE.md`](./GC_REVIEW_MODAL_ARCHITECTURE.md). Tab-side: unfiltered billed + collections rows; `onPrint` → `buildGcStatementReportHtml`; `onCopyForEmail` → `gcStatementEmailSubject` / `…Html` / `…Text` + `copyRichHtmlToClipboard`; **`onSendStatement` invokes edge fn `send-gc-statement-email` inline (4035–4068)** then `refreshGcLastSent` |
| `StagesBilledTotalByNameModal` | 4070–4083 | v2.3530; kernel `buildBilledTotalByNameEntries` (tested) |
| `StagesCapableToBillModal` | 4084–4105 | v2.3530; rows `buildCapableToBillBreakdownRowsWithPlans` |
| `StagesEstBillDateModal` | 4106–4125 | v2.3530; `setInvoiceEstimatedBillDate` (mutation prop) |

None of the three v2.3530 dialogs has a render test.

### 6. The modal tail (4132–4906, rendered regardless of `active`)

| Line | Opener state | Component | Notes (data writes / reloads) |
|---|---|---|---|
| 4132 | `newReportJob` | `NewReportModal` | saved → `loadJobs` + thread stats + notes for the job |
| 4153 | `crewModalJob` | `StagesCrewModal` | opened through `StagesCrewModalContext` (3036) |
| 4154 | `activityExpandJob` | `JobsStagesActivityExpandModal` | `commitStagesPctWithNote` + snapshot patch; people door → `manageJobPeople` |
| 4186 | `calendarJob` | `JobCalendarModal` | seeds `scheduleModalInitialDate` + `scheduleModalJob`; week dispatch → `/schedule-dispatch?jobId=&week=` |
| 4202 | `readyForBillingJob` + checks | `StagesReadyForBillingConfirmModal` | `confirmReadyForBilling` |
| 4214 | `createPartialInvoiceJob` + amount | `StagesCreatePartialInvoiceModal` | `createInvoiceFromModal`; displays and clears page-global `error` |
| 4230 / 4233 / 4236 | `paidEmailSettingsOpen` / `paymentEmailSettingsOpen` / `readyToBillNotifySettingsOpen` | `PaidInFullEmailSettingsModal` ×3 (default / `payment` / `ready_to_bill`) | |
| 4239 | `billedBreakdownOpen` | `BilledByCustomerBreakdownModal` | unfiltered; writes focus/flash directly |
| 4271 | `billedAgingChartOpen` | `BilledAgingChartModal` | unfiltered |
| 4282 | `sessionNotesModal` | `SessionNotesModal` | "Open on board" → `focusJobOnBoard` |
| 4294 | `billedPaymentForecastOpen` | `BilledPaymentForecastModal` | unfiltered; `onPaySpeedsChanged` → `refreshBilledPaySpeeds`; lien notice → `setLienDesk` |
| 4336 | `forecastShareModalOpen` | `PaymentForecastShareModal` | |
| 4337 | `chaseModalOpen` | `PaymentChaseModal` | `chaseFullQueue`; recorded → reload touches + promises; Move to Collections → `collectionsConfirm` (z 80 over call mode z 70) |
| 4370 | `fixBillLinesOpen` | `FixBillLinesModal` | **filtered** `stagesBoardLists.billedActiveRows` |
| 4377 | `promisedPayModalJob` | `SetPromisedPayDateModal` | saved → reload promises + records |
| 4389 | `paidProfitChartOpen` | `PaidProfitChartModal` | **filtered** `stagesBoardLists.paid` (see quirk 4) |
| 4399 | `billedShareModalOpen` | `BilledReportShareModal` | print = filtered billed rows + search |
| 4406 | `legalDesk` | `LegalDeskModal` (always mounted; `canEditFirm={authRole === 'dev'}` since v2.4711 — the firm window from the firm's name; `uncollectibleJobs` since v2.4794 — the rail's *Given up on* group) | **filtered** `stagesBoardLists.collectionsJobs` (4409, see quirk 4), contract coverage, `legalMatters`; many doors back into the board |
| 4438 | `bankPaymentsModalOpen` | `BankPaymentsModal` (always mounted) → [map](./AR_PAYMENT_MODALS_ARCHITECTURE.md) | `bankPaymentsModalBilledRows`; applied → `loadJobs` |
| 4454 / 4459 / 4466 | `jobBookModalOpen` / `stagesHideGroupsModalOpen` / `combineSeparateModalOpen` | `JobBookModal` / `JobsStagesHideGroupsModal` / `JobsCombineSeparateModal` | Combine → `runJobsStagesSerializedPipeline(loadJobs)` |
| 4471 | `viewBillInvoice` | `BilledBillViewModal` | Stripe details → `runFetchJobs` (retry once on coalesced `undefined`) + `findInvoiceWithJobFromJobs`; void → `scheduleLoadJobsAfterMutation` |
| 4493 | `lienDesk` | `LienDeskModal` → [map](./LIEN_DESK_ARCHITECTURE.md) | `legalSignoff.ask` writes `legalRpc('legal_add_entry')` (4546); the notice door fetches an unloaded job via `fetchJobWithDetailsById` (the affidavit door only toasts); `onOpenEditJob` focus mapping (4560) |
| 4599 | `gcNotice` | `GcOnNoticeModal` | not mapped here; `onOpenEditJob` focus mapping (4610–4611) — a longer, divergent copy of 4560's |
| 4615 / 4638 | `lienInstrumentsModal` / `lienReleaseModal` | `LienInstrumentsModal` / `LienReleaseModal` | recorded → `loadDemandOutJobIds` + `syncLienDeskAfterRecord`; issued → `loadLienReleaseJobIds`; since v2.4735 the state carries `openLastWork` (the desk's `onOpenCalendarLastWork` opens the window on the last-day line) and `onLastWorkSaved` bumps the lien clocks and re-reads the desk |
| 4646 / 4675 | `jobContractModalJob` / `contractSweepOpen` | `JobContractModal` (given the row's `coverage` — a signed chip lands on its signed state, v2.4183; the separate `JobSignedAgreementModal` is gone; a second signer named on the paper, v2.4186) / `JobsContractSweepModal` | → `loadJobContractCoverage` / `loadJobs`; sweep can set the `missing` filter |
| 4689 / 4695 | `aiaG702StagesJob` / `hazmatFeeJob` | `AiaG702G703Modal` / `HazmatFeeModal` | hazmat created → `loadJobs` + `loadHazmatFeeJobIds` |
| 4703 / 4725 | `markPaidJob` / `markPaidInvoice` | `BilledPaymentConfirmationModal` ×2 | `stripeModeForBillingFromRole`; invoice mode also reloads promises |
| 4740 / 4751 / 4766 / 4774 | send-back invoice / job / simple / collections | the four `Stages…Modal`s (v2.3535–3536) | handlers in cluster L |
| (4932 at HEAD) | `uncollectibleConfirm` (`{ job, direction: 'mark' \| 'unmark' }`) | `StagesUncollectibleConfirmModal` (v2.4792; `firmWarning` from `uncollectibleFirmWarning` over `legalMatters`, v2.4794) | mark: reason required → `setJobUncollectible`, then `mark-stripe-invoice-uncollectible` per Stripe bill; unmark is *Put back* |
| 4784 | `quickAssignJob` | lazy `QuickAssignSheet` (177) in `Suspense` | scheduled → targeted `fetchStagesUpcomingScheduleForJobs([id])`, no `loadJobs` |
| 4807 | `scheduleModalJob` | `ScheduleJobModal` (keyed by job id) | assignees from `users` |
| 4825 | `manageJobPeople` | `ManageJobPeopleModal` | the only team-member writer on this surface; changed → `loadJobs` |
| 4833–4903 | `returnEditBannerJobId && active` | fixed "Back to Edit Job" banner | `tryOpenEditJob` with `initialJob` |

- **Tests:** render tests exist for `LienDeskModal` 34, `JobsMapCard` 15, `JobsContractSweepModal` 13, `BilledPaymentForecastModal` 10, `LienInstrumentsModal` 9, `JobsStagesActivityExpandModal` 7, `GcOnNoticeModal` 5, `PaymentChaseModal` 4, `BilledPaymentConfirmationModal` 4, `LegalDeskModal` 2, `JobContractModal` 10 (three files: the rail, the reopen, the signed state — v2.4183), `BankPaymentsModal` (five files), `AiaG702G703Modal` 37. **None** for `BilledByCustomerBreakdownModal`, `BilledAgingChartModal`, `FixBillLinesModal`, `SetPromisedPayDateModal`, `PaidProfitChartModal`, `BilledReportShareModal`, `PaymentForecastShareModal`, `BilledBillViewModal`, `JobCalendarModal`, `ScheduleJobModal`, `ManageJobPeopleModal`, `SessionNotesModal`, `StagesCrewModal`, `HazmatFeeModal`, `LienReleaseModal`, `JobBookModal`, `JobsCombineSeparateModal`, `PaidInFullEmailSettingsModal`.
- **Extraction:** every inline dialog is out; what remains is 775 lines of wiring. The billed-money group (4239–4399; `SessionNotesModal` 4282 sits inside it but is not money) can move behind one `StagesBilledMoneyModals` host once cluster H is a hook; the open flags stay in the tab (the handle, the overview, the ☰ menu and the Billed header write them) — except `forecastShareModalOpen`, written only by the forecast modal, which can move with the host.

### 7. [`JobsStagesTable.tsx`](../src/components/jobs/JobsStagesTable.tsx) (529 lines — job-only sections)

- Callers: the Waiting / Working / Paid sites (§4) and the deck (§4b), via `StagesSectionList`. 69 prop fields — the former `renderStagesTable` params + the shared bundle.
- `colgroup` 14rem / flex / 14.5rem / 140 (298–303; Crew & Dates 9rem → 14rem in v2.4128), `tableLayout: fixed`, `minWidth: STAGES_TABLE_MIN_WIDTH` (880). No Supabase. The ham-mode assigned-edit dropdown the old map named is gone; team edits go through `ManageJobPeopleModal`.
- Tests: `JobsStagesTable.render.test.tsx` (9).
- **Open:** consume the shared bundle as one typed prop.

### 8. [`JobsStagesUnifiedTable.tsx`](../src/components/jobs/JobsStagesUnifiedTable.tsx) (467 lines — job + invoice rows)

- Callers: Ready to Bill / Billed / Collections sites and the deck, via `StagesUnifiedSectionList`. 91 prop fields. Builds one `StagesUnifiedRowContext` (type 172–179; built as `rowCtx` 386–408) per render; row kinds split into `StagesUnifiedJobRow` / `StagesUnifiedInvoiceRow` (v2.3548); icon buttons in `StagesRowActionButtons.tsx`, thread row in `StagesExpandedThreadRow` (v2.3541). No Supabase. A bill row's own line (*This bill · paid … left*) is `StagesBillRowLine` (v2.4349, kernel `stagesBillRowLine`), and `stagesRowIconGrid` (v2.4305, 3 tests) says how many icons sit on each row of the icon block.
- Tests: `JobsStagesUnifiedTable.render.test.tsx` (10), `StagesRowActionButtons` (2).
- **Open:** the single typed prop, same as §7.

### 9. [`jobsStagesRowShared.tsx`](../src/components/jobs/jobsStagesRowShared.tsx) (1,632 lines — shared renderers)

Function-returning-JSX style throughout (blocks `memo`); no hooks, no Supabase — side effects are `navigate` (1277), `tel:` (the call button in `renderStagesQuickActionsStack`), `showToast` (627, 767), and the context's openers.

| Lines | Export | Size | Consumers | Notes |
|---|---|---|---|---|
| 80–145 | type `StagesRowRenderContext` | 66 | Tab, Table, UnifiedTable, CardList, ActivityBox | 37 fields |
| 153–165 | `stagesContractChipFor` | 13 | Table, CardList, both unified rows, StagesPhoneRow | the contract chip's words and door (v2.4342, kernel `contractRowChip`) |
| 179 / 208 | `STAGES_TABLE_MIN_WIDTH` = 880 / `STAGES_EDIT_MODE_RAIL_WIDTH` = 18 | — | tables, rows, CardList, BillingTab | sized columns total 516px |
| 188–195 | `STAGES_OPEN_ROW_BAR` / `stagesOpenRowStyle` | 6 | Table, CardList, both unified rows | the opened row's blue bar + tint (v2.4131) |
| 210–248 | `renderStagesEditModeRail` | 39 | Table, CardList, both unified rows, `JobsBillingTab` (side `right`) | |
| 255–257 | `renderStagesExpandedRowPanel` | 3 | `StagesExpandedThreadRow` | `position: sticky; left: 0` |
| 260–269 | `renderStagesTwoLineHeader` (+ private style) | 8 | **none** | dead export |
| 298–326 / 328–355 | `renderStagesJobHcpChip` / `renderStagesJobHcpSubline` | 29 / 28 | chip: CardList, BillingTab, StagesPhoneRow · subline: Table, UnifiedJobRow | |
| 363–414 | `renderStagesThreadFullscreenJobHeader` | 52 | CardList, JobCalendarModal, ActivityExpandModal, StagesExpandedThreadRow | narrow `JobCalendarJobIdentity` |
| 417–426 | `stagesWhenForJob` | 10 | CardList (+ internal) | `deriveStagesWhen` |
| 435–505 | `renderStagesScheduleStripCells` | 71 | CardList (+ internal) | two-week strip; ✓ / hollow cells from `stagesWorkedByJobId` |
| 535–702 | `renderStagesFieldAndBillingLines` | 168 | Table, UnifiedTable | NEXT / ENDS / Not scheduled / Done, BILL / PAID (`stripBillParts`), man-hours; private `whenLine` 508–533 |
| 712–773 | `renderJobAddressWithMap` | 62 | Table, both unified rows | `(ctx, job)` since v2.4160: the map link and `PropertyKindBadge` (C / R / ?, `lib/jobs/propertyKindBadge.ts`; `usePropertyKinds` runs in the tab) in one bottom-aligned row |
| 780–805 / 811–815 | `renderAccountManChip` / `accountManOnlyStripeStyle` | 26 / 5 | chip: DetailJobModal (+ internal) · stripe: Table, CardList, both unified rows | |
| 824–830 | `stagesInvoiceRowAccent{Row,Rail}Style` | — | CardList, UnifiedInvoiceRow | green = invoice |
| 832–963 | `renderJobCustomerLine` | 132 | Table, UnifiedTable | desktop customer / GC / development / Account Man |
| 972–1112 | `renderJobCustomerAndAddressLine` | 141 | CardList | card twin — **the GC / development / Account-Man block (891–936 vs 1043–1085) is duplicated** |
| 1114–1118 / 1123–1158 | `shouldSuppressStagesRowJobThreadToggle` / `renderStagesThreadExpandButton` | 5 / 36 | Table, CardList, both unified rows | |
| 1169–1204 | `renderStagesSeeAllButton` (was `renderStagesViewReportsButton` + the Sessions link, v2.4324) | 36 | CardList, UnifiedJobRow (+ footer) | the trail's door where no activity box draws; words from `lib/jobs/stagesRowDoors.ts` |
| 1215–1388 | `renderStagesQuickActionsStack` | 174 | Table, UnifiedTable | schedule, week dispatch, call, Dispatch, task (`showTaskDispatchButton`) |
| 1398–1577 | `renderStagesJobCellActivityFooter` | 180 | Table, UnifiedTable | inner `renderStagesInvoiceJumpChips` 1426–1473, `renderStagesStripeEmailedCustomerHint` 1475–1528, `renderStagesContractChip` 1425–1454 (contract + ⚖ legal chip; since v2.4342 its words and door come from `stagesContractChipFor` → `contractRowChip`, shared with the phone card and the phone row's chip) |
| 1579–1584 / 1586–1608 | `stagesRowHasProjectBanner` / `renderStagesProjectBannerRow` | 6 / 23 | Table, both unified rows | |
| 1611–1629 | `renderStagesJobColumnEstimateFooter` | 19 | Table, CardList, both unified rows | |
| 1632 | `stagesActionMoveStackStyle` | — | Table, CardList, both unified rows | the Send back / Collections stack under the icons (v2.4147) |

- **Tests:** no direct test file. Covered indirectly by the render tests of `JobsStagesTable` (9), `JobsStagesUnifiedTable` (10), `JobsStagesCardList` (5), `JobsStagesActivityBox` (5); its kernels are tested — `stagesScheduleStrip` 24, `stagesJobReferenceDates` 11, `customerLinkHeuristics` 6, `accountMan` 4, `invoiceBilling` 42.
- **Status:** extracted; the work is componentizing the three biggest renderers and deleting the dead export.

---

## Supabase tables, RPCs and edge functions touched by `JobsStagesTab` directly

(Everything else flows through the mutation / thread-notes engines, the cache context, custom hooks and the extracted modals; the four rows marked with a hook file are reads the tab used to make itself and now makes through that hook. `jobsStagesRowShared.tsx` and both tables touch none.)

| Where | Table / RPC / edge fn | Verb |
|---|---|---|
| `refreshGcLastSent` 702 | `gc_statement_emails` | SELECT (500 newest) |
| `useDemandOutJobIds` 838 (loader in `hooks/useStagesRowFlags.ts`) | `job_demand_letters` | SELECT live, sent |
| `useJobContractCoverage` 844 (same hook file) | `job_contracts`, `estimates` (customer-accepted) | SELECT |
| `useHazmatAndReleaseJobIds` 926 (same hook file) | `job_hazmat_incidents` / `job_lien_releases` | SELECT `voided_at IS NULL` |
| `useBilledMoneyData` 964 (loaders in `hooks/useBilledMoneyData.ts`) | RPCs `get_billed_customer_pay_speeds`, `list_job_promised_pay_dates`, `list_payment_promise_records`, `list_payment_chase_touches` | read |
| send-back effect 2054 | `job_status_events` (+ `users(name)`) | SELECT latest |
| `loadStagesManHours` 2085 | RPC `get_man_hours_by_job` | read (RLS-scoped) |
| `createInvoiceFromModal` 2231 | `jobs_ledger_invoices`; RPC `ensure_single_ready_to_bill_invoice_for_job` | **INSERT**; RPC |
| GC Review `onSendStatement` 4035 | edge fn `send-gc-statement-email` | invoke |
| Lien desk `legalSignoff.ask` 4546 | `legalRpc('legal_add_entry')` | write |
| `confirmCollectionsMove` 2844 | RPC `set_job_collections_flag` via `lib/setJobCollectionsFlag` | write |
| `confirmSendBackJob` 2904 | edge functions via `prepareBilledInvoicesBeforeJobRevertToReadyToBill` | Stripe void prep |
| search effects 1793 / 1836 | schedule / clock tables via `lib/jobsStagesScheduleSessionSearch`; lean search + detail fetch | SELECT |

---

## Master summary table

| Region | File / anchor | Lines | Coupling | Risk | Status |
|---|---|---|---|---|---|
| Substrate: focus, search, modes, filters, lists (B–E) | `JobsStagesTab` 656–2337 (scattered) | ~500 | highest | — | **stays** |
| Schedule + labor maps (F) | 606–654, 2085–2229 | ~90 | low | low | man-hours → hook + kernel |
| Row-flag lookups (G) | 575–579, 838–926 (hook calls) | ~20 | low (reloaders called from the tail) | low | → `useStagesRowFlags` (shipped v2.4110) |
| Billed-money data (H) | 964 (hook call); 792, 976 (scope kicks); 1092, 1635 | ~60 | med (chip renderer, phone rows, 3 modals, overview) | low | → `useBilledMoneyData` (loaders shipped v2.4099) |
| GC statement round (I) | 702–716, 1546–1635 | ~100 | low-med (feeds chase via temperature) | low | → `useGcStatementRound` |
| Lien / legal desk wiring (J) | 764–802, 1489–1544, 4406–4614 | ~260 | med | low-med | stays; focus mapping → kernel |
| Deep-link consumers (K) | 1297, 1775 (hook calls) | 2 | med (writes J / N / O state; `rtb` calls `focusStagesSection`) | med | → `useStagesDeepLinkParams` (shipped v2.4080) |
| Confirm handlers (L) + partial invoice IO (M) | 2054–2082, 2231–2316, 2820–2930 | ~230 | high (mutations, focus) | — | dialogs **extracted**; handlers stay |
| Command bar + ⋯ menu | `JobsStagesCommandBar` / `JobsStagesToolsMenu` | 62 in tab | low | low | **extracted** (v2.3532/3533) |
| Map + overview | 3111–3197 | 87 | low | low | children **extracted**; wiring stays |
| ☰ menu + jump strip + alerts | 3199–3323 | 125 | low | low | **extracted** (v2.3534, v2.3549) |
| Section IIFE | 3324–3962 | ~640 | highest | — | stays; seam done (v2.3538) |
| Follow-up deck rows (4b) | 2699–2799 | 101 | high | med | dedupe with §4 |
| Phone board (4c) | 1252–1265, 2461–2530 | ~85 | med | low | stays |
| IIFE dialogs (5) | 3963–4129 | 167 | low-med | low | children **extracted**; GC send IO → lib |
| Modal tail (6) | 4132–4906 | 775 | med | low per item | inline dialogs all **extracted**; money group → host |
| Job-only table | `JobsStagesTable.tsx` | 529 | high (prop fan-in) | low-med | extracted; single typed prop open |
| Unified table | `JobsStagesUnifiedTable.tsx` + 2 row files | 467 + 796 | highest | — | **row kinds split** (v2.3548) |
| Shared row renderers | `jobsStagesRowShared.tsx` | 1,632 | med (14 importers) | low-med | extracted; componentize 3 renderers |

---

## Stage-A candidates (pure logic → `src/lib/*` + tests, before any component move)

Done: `buildBilledTotalByNameEntries` (v2.3530); section totals, the twelve role gates, AR button name, section element ids, `customerListImpliesLinkedRow` (v2.3531); `planPartialInvoice` + `reclampedPartialInvoiceInput` (v2.3537).

| Candidate | Currently | Target |
|---|---|---|
| ~~Returned-check role gate~~ | **done v2.3857** — `stagesGates.canSeeBankReturned` (the office pool), its matrix row in `stagesRoleGates.test.ts`; the tab reads it at the nudge hook | the Dashboard's `officeEligible` (`DashboardPinnedQuickRow` 372) is the same set folded with the banner and sign-in checks — a later fold |
| ~~Signer fallbacks~~ | **done v2.3858** — both memos gone; the tooling prefill, the release and the instruments windows read `lienDeskSignerFor(job.master_user_id)` (the desk's `lienSignerNameFor` callback) for their own job | the instruments window's fallback had read the *release* modal's job (session name when that window was closed) — decided as a fix: each window signs as its own job's master |
| ~~Lien focus → Edit Job options~~ | **done v2.3859** — `lib/jobs/lienFocusEditJobOptions.ts` (`lienFocusEditJobOptions(focus)`, 5 tests); the Lien desk and Put a GC on notice both spread it into `tryOpenEditJob` | the desk's `onOpenEditJob` prop still types the narrower focus union; widening it to `LienDoorFocus` is a one-line follow-up when the desk gains a door |
| ~~Man-hours folds~~ | **done v2.3860** — `lib/jobs/stagesManHours.ts` (`stagesManHoursByJobId`, `stagesLaborBreakdownByJobId`, 4 tests); the tab keeps the two memos as one-liners | — |
| ~~Collections note line (money)~~ | **done v2.3861** — `collectionsNoteLine(job, correction)` beside `collectionsClaimGapWords` in `lienClaimCorrection.ts` (+1 test); the tab's callback is one line | — |
| ~~Round / desk counts (money)~~ | **done v2.3862** — `statementRoundCards` (`gcStatementRounds.ts`), `lienDeskCount` (`lienDeskMoneyCard.ts`), `promiseSlipByCustomer` (`paymentPromises.ts`), one test each; the tab's three sites are one-liners | — |
| ~~Section header fallback~~ | **done v2.3863** — `lib/jobs/stagesSectionHeader.ts` (`stagesSectionHeader`, `stagesSectionLoadingSuffix`, `billedListRows`, 6 tests); the tab's `sectionHdr` / `sectionLoadingSuffix` / `billedListRows` are one-liners | — |
| ~~Deep-link table~~ | **done v2.3865** — `lib/jobs/stagesDeepLinks.ts` (`parseStagesDeepLinks`, `stripStagesDeepLink`, `STAGES_DEEP_LINK_PARAMS`; 8 tests); the tab parses once (`deepLinks` memo) and each of the eight doors consumes from it | the hook that applies it shipped with step 5 (v2.4080) |
| ~~Week-dispatch URL~~ | **done v2.3864** — `scheduleDispatchWeekUrl(jobId, weekYmd, dayYmd?)` in `lib/scheduleDispatchDayLink.ts` (+1 test); the tab, `jobsStagesRowShared`, the card list (×2), the job window, the Dashboard's job-mode card and Quickfill call it | the week-and-day links with no job (Quickfill, the hours audit, the user day/week sections, the team board) still build their own — a later fold |

Already-extracted lib (add tests only where missing): `buildJobsStagesBoardLists` + friends, `buildBilledAgingBuckets`, `stagesMoneyBar`, `stagesJobReferenceDates`, `jobsStagesScheduleSessionSearch`, `stagesUpcomingSchedule`, `stagesWorkedDays`, `stagesScheduleStrip`, `stagesWhenPills`, `billedAwaitingPaymentReport`, `voidStripeInvoiceForRevert`, `jobNextLine`, `billedExpectedPay`, `paymentChase`, `paymentPromises`. **No tests:** `setJobCollectionsFlag`, `postSendBackReasonNote`, `returnEditJobFromStages`, `formatMoveIntoStageByOnLine`, `jobsStagesSerializedPipeline`, `invoiceWithJobFromJobList`, `jobBillingContext`, `jobLedgerCustomerForBilling`; `progressPaymentForJob` only through `StagesStageBar.render`.

---

## Preserve-quirks list (load-bearing — do not "fix" during moves)

1. **Always-mounted + `active`-gated body; modal tail unconditional; the six IIFE dialogs unmount while inactive** (Mount/state semantics). Effects key on `active`.
2. **The board consumes ten one-shot URL params** ([`useStagesDeepLinkParams`](../src/hooks/useStagesDeepLinkParams.ts): consumed once per mount, in the old effect order, each door stripping its own params from the same pre-strip URL with `replace`; `rtb` arms `window.__rtbFocusArmedAt` for 5 s to survive the StrictMode double mount, then polls — first tick 400 ms, then every 300 ms, up to 100 tries — until the Ready to Bill header holds still). The page router and the `!jobsListLoading` handle gate stay in `Jobs.tsx`.
3. **`bankPaymentsModalBilledRows` builds with an EMPTY search**; `JobsAccountsReceivable.tsx` carries the same derivation — keep it in `lib/jobsStagesBoard.ts`.
4. **Money never hides:** money surfaces read `unfilteredBoardLists` (1462–1471 comment). Exceptions today, preserve until decided separately: `PaidProfitChartModal` (filtered `paid`), `FixBillLinesModal` and `BilledReportShareModal` (filtered billed rows), `LegalDeskModal` (filtered `collectionsJobs`, 4409).
5. **Page-global `error`:** the partial-invoice dialog displays and clears it; `createInvoiceFromModal` and `confirmSendBackJob` write it. Do not localize.
6. **`sendBackChecked` is shared** by the job and invoice send-back dialogs, reset by every close; `stagesInvoiceSendBackConfirmLockRef` guards double-confirm on the invoice path only.
7. **Send-back to `ready_to_bill` runs the Stripe void prep** (edge) *before* `updateJobStatus`; failure blocks the move (`setError(prep.message)`). RTB → Working requires a reason and posts it as a thread note after the move.
8. **Bill Customer success follows the move** (`followMovedJob(id, 'billed')`) only via `onSuccess`, not `onAfterEnsureSuccess`.
9. **Partial invoice:** the insert happens first; a failed remainder re-sync (`ensureRemainderResyncOutcome`) is reported after the reload, never rolled back.
10. **Timers:** flash 2,600 ms; invoice scroll 200 ms; job scroll 250 ms + one 700 ms retry; return-edit banner 10 s; man-hours load 80 ms; schedule search 350 ms; server search 300 ms; thread stats 320 ms; `rtb` poller above. All deliberate.
11. **`STAGES_TABLE_MIN_WIDTH = 880` + `tableLayout: fixed` + colgroup 14rem / flex / 14.5rem / 140** (the Progress & payment column widened to 14.5rem in v2.3462; Crew & Dates to 14rem in v2.4128). `renderStagesExpandedRowPanel` is `position: sticky; left: 0` for phone side-scroll.
12. **Per-device storage:** `jobs-stages-ham-mode`, `jobs-stages-follow-moves`, `jobs-stages-edit-mode`, `jobs-stages-mobile-cards` (unset → `max-width: 559px` media query, then the org default once loaded; a device choice wins), `jobs-stages-search-include-schedule-time` (**default off** — `parseStagesIncludeScheduleTimePref` is `raw === 'true'`), `jobs-stages-phone-overview-open`, `pipetooling_stages_sections_v2`, `pipetooling_pipeline_sort_v1` (the progress sort is session-only), `jobs-stages-exclude-filters`. All try/catch-wrapped.
13. **Fail-soft loaders:** `loadStagesManHours` resets its load-once ref on error (retry next visit); the demand / hazmat / lien-release / contract / money loaders swallow failures — a not-yet-deployed RPC just hides the chip or card.
14. **Paid section:** `fetchPaidJobsIfNeeded` fires via `queueMicrotask` on expand only (search no longer prefetches paid — v2.1819; the lean server search covers it). The count reads "Expand to load" until `paidJobsMergedForKey === jobsListDataKey`; during a search it counts matches (`stagesPaidHeaderSearchCount`) and the `stagesPaidSearchHint` row leads the board.
15. **Money-move doors clear the search first** (overview callbacks and `openMoneyMove`, v2.1960).
16. **Edit-mode rails are role-gated in the tab** (`stagesEditModeActive` 2039) so a stale stored flag cannot surface them for other roles.
17. **`applyStagesInvoiceFocus` deps list `stagesSearchExtraJobIds` but the body reads `stagesCombinedExtraJobIds`** (2118 vs 2138) — a stale-closure risk when only the server ids change. Verify and fix in its own PR, not during a move.
18. **Dead code, each for its own PR:** handle method `openLienDesk` (no caller), `renderStagesTwoLineHeader` (no importer).
19. ~~Capable modal `aria-label` copy/paste bug~~ — fixed; it now reads "Capable of Being Billed — Breakdown".

---

## Recommended extraction order (value ÷ risk)

1. **Stage-A sweep II** (low risk, one kernel per PR): the table above — returned-check gate, signer fallbacks, lien focus mapping, man-hours folds, collections note line, round / desk counts, section header fallback, week-dispatch URL. Dead-code removals (quirk 18) as separate PRs.
2. **Billed-money data seam** (cluster H). **Loaders shipped v2.4099:** [`useBilledMoneyData`](../src/hooks/useBilledMoneyData.ts) holds the 4 states, 4 loader effects, the reloaders and the slip memo, gated by inputs rather than a role, called where the first loader stood. Left in the tab: the chase and money-modal scope kicks (they read the tab's cache scope API, `chaseModalOpen`, `billedMoneyModalOpen`) and the chase memos (`gcTemperatureById`, `cacheLeanBilledRows`, `unfilteredBoardLists`) — they move with step 8's modal host, not here; `billedExpectedPayChipRenderer` stays in the tab and reads the hook. Pay speeds + promised dates also load in `useJobBilledExpectedPay`; those two + chase touches in `usePipelineMoneyOpportunities` and `DashboardFinancialsSection`; one or more of the four also in `BidBoardCustomerReviewModal`, `loadBridgeData`, `useLegalPacketData`, `useCustomerTermsWarning`, `useGcOnNoticeData`, `useLienDeskData` — the hook is shareable; their adoption is the playbook's shared-seam row 10.
3. **Row-flag seam** (cluster G). **Shipped v2.4110:** [`useStagesRowFlags.ts`](../src/hooks/useStagesRowFlags.ts) holds three hooks — `useDemandOutJobIds`, `useJobContractCoverage`, `useHazmatAndReleaseJobIds` — each called where its loader stood (they straddle the contract nudge and crew-position hooks), returning the reloaders the tail calls.
4. **GC statement round seam** (`useGcStatementRound`, cluster I). Returns `gcTemperatureById` — land with or before step 2, which reads it. The [GC Review map](./GC_REVIEW_MODAL_ARCHITECTURE.md) (its step 8) builds the hook inside the modal first; this step moves 1546–1635 onto it.
5. **Deep-link consumer** (cluster K). **Shipped v2.4080:** [`useStagesDeepLinkParams`](../src/hooks/useStagesDeepLinkParams.ts) runs the seven modal doors (one effect, the old order, one consumed set for the mount) over the Stage-A table; `useStagesRtbFocus` keeps the `rtb` strip, window arm and poll at the tab's old site, after `focusStagesSection`.
6. **Section action props, once** — **shipped v2.4117:** `stagesSectionActionProps` (waiting, working, readyToBill, billed, collections) built at tab scope by a script from the section sites and spread into both the §4 sites and `renderFollowupStageRow` (§4b); the ~100-line duplicate is gone.
7. **GC Review send IO → lib** (`onSendStatement` 4035–4068: edge invoke + response parse), so the IIFE only wires callbacks. Coordinate with the GC Review map.
8. **Billed-money modal host** (`StagesBilledMoneyModals`, 4239–4399) after step 2; open flags stay in the tab.
9. **Row renderers → components** in `jobsStagesRowShared`: `renderStagesQuickActionsStack` (174), `renderStagesJobCellActivityFooter` (180), `renderStagesFieldAndBillingLines` (168); pull the duplicated GC / development / Account-Man block out of the two customer-line renderers.
10. **Tables take the shared bundle as one typed prop** (§7 / §8).

**What must STAY in `JobsStagesTab`:** the imperative handle and everything it writes (`stagesSectionOpen`, both focus / flash pairs, the modal flags the handle opens), `stagesBoardLists` / `unfilteredBoardLists` / `bankPaymentsModalBilledRows`, the search state and effects, the mode toggles, the section wiring, the confirm handlers and the partial-invoice IO (they call the page's mutation engine and write focus), and the prop plumbing for the parent-injected engines. **What stays in `Jobs.tsx`** (unchanged from the parent map): the URL router for the handle's params, the jobs cache, `customers` / `users`, the `useJobsStagesMutations` / `useJobThreadNotes` call sites, and the app modal contexts (`useJobFormModal`, `useJobDetailModal`, `useBillCustomerModal`; the tables and card list call `useDispatchTaskModal` / `useChecklistAddModal` themselves).

Verification gates, definition of done and anti-patterns: [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) (`npm run typecheck && npm run lint && npm test` green after every step; behavior-preserving only; one region per commit).
