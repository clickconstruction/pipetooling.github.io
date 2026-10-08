# People Review Tab Architecture Map

---
file: docs/PEOPLE_REVIEW_TAB_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the sub-decomposition of src/components/people/PeopleReviewTab.tsx (4,167 lines) per PAGE_DECOMPOSITION_PLAYBOOK.md — an already-extracted People tab that kept growing — plus its extracted popup document builder and the Team Summary drilldown bodies. Inventories every region (state, memos, effects, loaders, tables/RPCs, sub-components, coupling, test coverage) so extraction can proceed without re-reading the whole file.
covers:
  - src/components/people/PeopleReviewTab.tsx
  - src/lib/peopleDocuments/buildTeamSummaryHtml.ts
  - src/components/people/teamSummary/drilldowns.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-10-06
---

> **Line numbers are as of `a05cef4c4`** (the `mapped_at` commit) and drift with every edit — search the symbol named beside each range. Regenerate the fact sheets with `npm run map -- <file>`.

## What this surface is

[`src/components/people/PeopleReviewTab.tsx`](../src/components/people/PeopleReviewTab.tsx) is the **Review** tab of the People page — a dev-only analytics surface with three layers: the **Team Summary** (one row per pay-roster person: hours, overhead hours/labor, field hours, gross/net revenue, profit after overhead, per-hour rates; each cell opens a drilldown from [`teamSummary/drilldowns.tsx`](../src/components/people/teamSummary/drilldowns.tsx)), shown either as the **Ranked view** (default since v2.2678: verdict strip, hygiene strip, ranked bars, math drawer) or the **Table** (`TeamSummaryInline`); and a **per-person panel** (headline card, Jobs Worked rolled up per job with per-day detail grids, Hours and Pay, Reports Filed, Tasks Completed/outstanding) that opens when a name is clicked or arrives through the Vectors → Review URL door.

It was extracted from `People.tsx` as one unit (see [`PEOPLE_TABS_ARCHITECTURE.md`](./PEOPLE_TABS_ARCHITECTURE.md) §review), grew to 5,267 lines, dropped to 3,777 after the popup builder moved out (v2.1305), and has **regrown to 4,167 lines** (36 commits in 90 days) through the ranked view, the earned convention, Wheels, card-charge and tag cost lines, the URL door and the roster view. One default-exported component `PeopleReviewTab` (178–4167, 3,990 lines; render 2397–4166, 1,770 lines) plus five module helpers: `throwIfQueryError` (99–106), `paged` (117–122), `laborRowJobId` (133–135), `fetchJobStatusesByIds` (138–152), `signedCurrency` (154–156).

**Hook census (fact sheet @ a05cef4c4):** 32 `useState` · 0 `useReducer` · 7 `useEffect` · 14 `useMemo` · 3 `useCallback` · 7 `useRef` (`reviewDoorRef` 221, `reviewReqIdRef` 240, `teamSummaryReqIdRef` 361, `teamSummaryPriorReqIdRef` 391, `reviewOfficeLikeReqIdRef` 398, `showPeopleForReviewRef` 685, `reviewOverheadRatesRef` 692) · 5 custom hooks (`useToastContext` 196, `useAuth` 197, `useLedgerPrefixMap` 198, `usePendingHoursApprovalsNudge` 392, `useCategoryTags` 395) · 51 local imports. Tables: `jobs_ledger`, `clock_sessions`, `jobs_ledger_invoices`, `people`, `people_pay_config`, `people_labor_job_assignees`, `people_labor_jobs`, `people_crew_jobs`, `people_hours`, `checklist_instances`, `app_settings`, `people_labor_job_items`, `jobs_ledger_materials`, `mercury_transaction_job_allocations`, `people_crew_bids`, `mercury_transactions`. RPCs: `list_reports_with_job_info`, `list_tally_parts_with_po`, `get_jobs_ledger_by_ids[_paid_only]`, `get_invoice_amounts_for_jobs`, `get_bids_by_ids`. Edge functions: none.

| Largest blocks | Symbol | Lines |
|---|---|---|
| ~~Per-person loader~~ | `loadReviewData` + `loadReviewDataCore` | moved v2.3981 → `lib/people/loadReviewPersonData.ts`, then split v2.4011: the reads stay there (264 lines), the shaping is `lib/people/reviewPersonAllocation.ts` (661, pure); the tab keeps the resets, the stale guard and the commits |
| ~~Team-wide union loader~~ | `loadTeamReviewUnion` | moved v2.3955 → `lib/people/loadTeamReviewUnion.ts` (438 lines) |
| ~~90-day overhead-rates effect~~ | effect `[isDev, authUser?.id]` | moved v2.3974 → `hooks/useReviewOverheadRates.ts` + `lib/people/loadReviewOverheadRates.ts` |
| Team Summary window shell | `openTeamSummaryWindow` | 2230–2394 (165) |
| Person panel render | `showPeopleForReview.length === 0 ? … : …` chain | 2641–4037 (1,397) — incl. two 235-line expanded grids |
| Popup document builder | **extracted v2.1305** → [`buildTeamSummaryHtml`](../src/lib/peopleDocuments/buildTeamSummaryHtml.ts) | 1,575-line module |
| Drilldown bodies | **already out** → [`drilldowns.tsx`](../src/components/people/teamSummary/drilldowns.tsx) | 1,625-line module (region I) |

This is a **sub-decomposition** map: the parent-side facts are in [`PEOPLE_TABS_ARCHITECTURE.md`](./PEOPLE_TABS_ARCHITECTURE.md) §review and only summarized here.

### Parent contract (recap — do not change during sub-decomposition)

Mounted at `People.tsx` 4153–4172 behind `activeTab === 'review' && isDev` (mounts only when active, so no `activeTab` gating inside); the parent's own effect at `People.tsx` 2315–2324 reloads `payConfig`, archived names and the roster on an 80 ms timeout when the tab opens. Props (`PeopleReviewTabProps`, 158–176): data `payConfig`, `archived` (the page's `ArchivedRoster`: a pay row's `person_id` decides before its name, v2.4910), `payRoster` (v2.3698 roster-view verdict, `PayRosterIndex | null`), `authUser`, `isDev`, `users`, `people`; the **Review↔Hours bridge** `onOpenDayEditor` (→ parent `handleInlineOpenDayEditor` → shared `DashboardMyTimeDayEditorModal`), `onDrilldownOpenChange`, `teamSummaryInlineRef`, `teamSummaryDataCacheRef`, `teamSummaryModalOpenRef`, `teamSummaryRefreshPendingRef`, `reviewHoursReopenAfterLoadRef`, `teamSummaryDrainTick`; and the helper `getDaysInRange`. The bridge refs stay parent-owned because the Hours tab and the shared My-Time editor read/write them.

---

## Master summary table

| Region | Anchor (symbol · lines) | ~Lines | Coupling | Risk | Status | Tests |
|---|---|---|---|---|---|---|
| A. 90-day overhead-rates engine | `reviewOverheadRates` state 326–352 · effect 411–647 · `reviewOverheadRatesRef` 692–693 | ~265 | med — read by C memos + auto-refresh effect, popup, H, E headline card, F tooltips; written only by its effect | low as a hook | **hook + loader since v2.3974** (still a duplicate of `lib/overheadPoolSnapshot`) | `loadReviewOverheadRates` 11, `useReviewOverheadRates` 6, and the kernels (`overheadDailyLabor` 35, `overheadRateMethods` 8, `overheadAvgDailyCost` 9, `overheadPartsBucketLoader` 7); effect untested |
| B. Roster + period scope + URL door | `showPeopleForReview` 665–674 · `getReviewDateRange` 948–957 · door 218–233, 675–681 | ~190 | highest — every region reads it | must stay | inline (stays); range calc **extracted** | `reviewDateRange` 5, `reviewDoor` 3, `rosterPeople` 6; label + external-only memo untested |
| C. Team Summary orchestration | `teamSummaryRows` 358–361 · effect 898–946 · `loadTeamReviewUnion` (in `lib/people` since v2.3955) · `openTeamSummaryWindow` 2230–2394 | ~375 | high — bridge refs, cache, A, B | med | render side and union loader extracted; refresh inline | `derivePersonTeamSummary` 12, `formatters` (enrichment), cost kernels, `loadTeamReviewUnion` 15 |
| D. Popup document builder | shell in `openTeamSummaryWindow` 2256–2271, 2307–2374 | 1,575 (module) | low — pure string from a context | low | **extracted (v2.1305)** | `buildTeamSummaryHtml.test.ts` 12 |
| E. Per-person panel | `loadReviewDataCore` 1025–1754 · effect 1756–1772 · render 2641–4037 | ~2,350 | med — reads B, A, C's `teamSummaryBreakdowns` | med (the loader is in `lib/people` since v2.3981, its shaping a pure kernel since v2.4011; 16 + 31 tests) | loader, rollups + earned rule extracted; render inline | `reviewEarned` 5, `reviewJobsRollup` 3, `reviewTasksRollup` 4; **loader untested** |
| F. Jobs Worked expanded grids | `renderLaborRow` 2968–3309 (grid 3072–3306) · `renderCrewRow` 3310–3651 (grid 3414–3648) | 2 × 235 | low — pure render off a row | low | inline, **duplicated** | none |
| G. Labor/Profit contributors modal | `reviewLaborBreakdownContext` 363–373 · render 4038–4163 | ~140 | low | low | inline | none |
| H. Ranked view | `reviewView` 380–384 · memos 744–773 · effects 778–799, 868–896 · render 2548–2575, 2586–2615 | ~160 | med — reads C's rows/breakdowns | low | components + kernel **extracted** (v2.2678) | `reviewRanked` 17, `reviewOfficeLikeCharges` 4; `reviewViewStorage` + 4 components none |
| I. Drilldown bodies | `drilldowns.tsx` (15 components) | 1,625 (module) | low — props only; one context hook | low | **already a leaf module** | none (helpers `formatters` 5, `addressDisplay` 10) |

No render smoke exists for `PeopleReviewTab`, `TeamSummaryInline` or `drilldowns.tsx` (`git grep` over `*.test.*` / `e2e/` finds only `buildTeamSummaryHtml.test.ts`).

---

## Per-region dossiers

### A. 90-day overhead-rates engine

- **Render location:** none of its own. Surfaces in the header meta line (2403–2417, 2447–2461), `teamSummaryOverheadDecomp` (704–719, `?? 0` coercion), `teamSummaryBreakdowns` (723–741) and `reviewSplitPartsRate` (744–747), the popup payload (2313–2336, read through `reviewOverheadRatesRef`), `PeopleReviewVerdictStrip ratesLoading` (2592), `<TeamSummaryInline>` rate props (2620–2621), E's headline card `…`/`—` placeholders (`.loading` at 2749, 2765, 2813), and the Method A/B/C rows + tooltips in region F.
- **Owned local state (in `useReviewOverheadRates` since v2.3974; the tab reads what the hook returns):** `reviewOverheadRates` (326–352) — `ratePerHour`, `ratePerRevenueDecimal`, `ratePerLaborDollar`, `loading`, `windowStart`, `windowEnd`, `officeLabor90d`, `bidLabor90d`, `officeParts90d`, `invoices90d`, `fieldHours90d`, `fieldLaborUsd90d`; mirror `reviewOverheadRatesRef` (692–693).
- **Effect (411–647, now the hook's; its body is `loadReviewOverheadRates` in `lib/people`):** deps `[isDev, authUser?.id]`; cancelled flag. Window = `denverCalendarDayKey(Date.now())` − 89 days → today (company calendar). Paged fetches: overhead sessions (office job OR `bid_id not null`), field sessions (non-office `job_ledger_id`), office parts via `loadOfficePartsUsdByDayExcludingInternalTransfer`, invoices (Stripe test-mode excluded, fetched a day wide and re-bucketed by `bucketInvoiceRevenueByAppTzDay`), `people` → `account_user_id` link rows; then `people_pay_config` (dual-rate fields). Pool via `buildOverheadWageLookup[ByPersonId]` + `buildOverheadDailyLabor` + `mergeOverheadDayTableRows`; field hours/labor via `buildOtherJobsLaborByDay`; rates via `computeOverheadRateMethods`. Any throw → all-null reset.
- **Supabase:** `clock_sessions`, `jobs_ledger_invoices`, `people`, `people_pay_config`; `app_settings` + parts indirectly.
- **External coupling:** [`lib/overheadPoolSnapshot.ts`](../src/lib/overheadPoolSnapshot.ts) (v2.2676, "the ONE 90-day overhead scan", 9 tests) now serves People → Overhead, the Dashboard card, the Bridge and the job day ledger from the same kernels — **Review still runs its own copy**. Independent of `reviewPeriod`.
- **Extraction approach:** ~~`useReviewOverheadRates(isDev, authUser?.id)` returning the same object; consumers unchanged~~ (done v2.3974, the scan verbatim as `loadReviewOverheadRates({ isCancelled })`). Preferred body: `loadOverheadPoolSnapshotInputs()` + `loadOverheadPoolSnapshot()` mapped onto the 12 fields (`rates.methodA/B/C`, `windowStart/End`, `poolTrend.totals.*`, `lensDetail.denominators.*`). **Parity checked 2026-09-27** (`lib/people/reviewOverheadParity.test.ts`, both scans over the same rows): the twelve figures agree to float rounding over a window with both edges, every person kind and every session state, an empty window, a pool with no denominator, no office job, and more sessions than a page — the math is the same kernels, added in a different order. They differ only in what a bad read does: the snapshot's person-link fetch fails soft to `[]` and prices by name (a renamed person's wage is then not found) where Review's throws into the all-null reset; the snapshot pages pay config, Review's un-ranged read stops at PostgREST's 1,000 rows. The snapshot also runs one read Review does not need (unassigned salary time). Keep the silent all-null reset.

### B. Roster + period scope + URL door — the shared substrate (stays)

- **Render location:** controls column 2470–2576 — period `<select>` 2472–2497 (seeds the custom pair from the current range on first switch to Custom), custom From/To 2498–2532, "Only Count Jobs Marked Paid in Full" 2538–2547.
- **Owned local state:** `selectedReviewPersonIndex` 212 (−1 = none), `reviewPeriod` 213 (`ReviewPeriodKind`: `today | yesterday | this_week | last_week | last_two_weeks | last_30_days | last_90_days | this_year | custom`; default `last_30_days`), `reviewCustomRangeStart/End` 216–217, `reviewOnlyPaidInFull` 375, `reviewDoorPeriodApplied` 224 + `reviewDoorRef` 221–223.
- **Memos/effects:** `externalOnlyPayConfigNamesLower` 652–663 (people rows with no `users` account); `showPeopleForReview` 665–674 (payConfig keys − archived − not `isPayRosterRow(payRoster, …)` (v2.3698) − external-only, sorted); `showPeopleForReviewRef` 685–686 (read by `handleInlineTogglePerson` 400–409, `useCallback([])`); `teamSummarySelectedPersonName` 697–703. Door: period effect 225–233 (sets `custom` + range once), person effect 675–681 (`reviewDoorPersonIndex` once the roster is in).
- **Functions:** `getReviewDateRange` 948–957 → `computeReviewDateRange(period, {start,end}, denverCalendarDayKey(now))` (**extracted v2.2688**, [`lib/people/reviewDateRange.ts`](../src/lib/people/reviewDateRange.ts)); `getReviewPeriodLabel` 2214–2228 (label map still local).
- **URL:** `/people?tab=review&review_person=&review_from=&review_to=` (built by `reviewDoorHref` in `BridgeVectorsPanel`, parsed by `parseReviewDoor`), read once at mount.
- **Extraction:** stays. Stage A leftovers: move the `getReviewPeriodLabel` label map into `reviewDateRange.ts`; extracted children receive `[start, end]`, `days`, `onlyPaidInFull`, `selectedPersonName` + toggles as props.

### C. Team Summary orchestration

- **Render location:** header meta 2435–2464 (clickable "Overhead (split)" only in table view → `teamSummaryInlineRef.current?.openOverheadRateDrilldown`); mount 2579–2639 — error 2581–2584, ranked (region H) 2586–2615, `<TeamSummaryInline>` 2617–2631 (`showInlineMeta={false}`, `onOpenInNewWindow` → popup), placeholder 2633–2637.
- **Owned local state:** `teamSummaryRows`, `teamSummaryLoading`, `teamSummaryError` (358–360), `teamSummaryReqIdRef` 361.
- **Cross-boundary (props):** `teamSummaryDataCacheRef`, `teamSummaryModalOpenRef` + `teamSummaryRefreshPendingRef` + `teamSummaryDrainTick`, `reviewHoursReopenAfterLoadRef`, `teamSummaryInlineRef`.
- **Memos:** `teamSummaryOverheadDecomp` 704–719; `teamSummaryBreakdowns` 723–741 = `enrichTeamSummaryRowsForInline(rows, partsRate, payConfigSource)`, partsRate = officeParts90d ÷ fieldHours90d.
- **Auto-refresh effect (898–946):** deps `[isDev, reviewPeriod, reviewCustomRangeStart/End, reviewOnlyPaidInFull, payConfig, showPeopleForReview, reviewOverheadRates.ratePerHour, reviewOverheadRates.loading, teamSummaryDrainTick]`. Nulls the popup cache; empty roster resets; skips while payConfig empty, custom pair half-filled, or a drilldown is open (→ pending flag); else 200 ms → `openTeamSummaryWindow('inline')`.
- **Loaders:** `loadTeamReviewUnion(start, end, onlyPaidJobs, payConfigSnapshot, tagLookups, users)` — **in [`lib/people/loadTeamReviewUnion.ts`](../src/lib/people/loadTeamReviewUnion.ts) since v2.3955, 15 tests; the ranges below are the component's as of `mapped_at`** — 1780–2184 → [`TeamReviewUnion`](../src/lib/people/teamReviewTypes.ts). Phases: lookback `min(start, today−2y)` 1792–1793; period overhead sessions 1804–1830; 10-query wave 1832–1860; overhead buckets 1862–1922; hours maps 1931–1938; labor items 1940–1957; Convention-1 team crew cost/hours 1971–1993; ledger + bids RPCs 2016–2033; job statuses 2036–2038; sheet cost 2040–2049; invoices/materials/card rows 2061–2088; **Wheels** fuel exclusion 2090–2139 (gone since v2.4653: a deal's fuel stays on the jobs, and its fuel on no job comes from `reviewVehicleFuel.ts`); card rule 2140–2148; tag cost lines 2149–2155; return 2157–2183. Callers: `loadTeamSummaryData` 2186–2193 and the prior-period effect (882). **Read the `users` prop by closure (2096, 2105)** — the only non-parameter input, now its last parameter; no state reads or writes. `buildTeamSummaryCacheKey` 2198–2212; `openTeamSummaryWindow` 2230–2394 (inline branch: reqId guard, set rows, stamp cache, 50 ms Hours-drilldown re-open 2294–2304).
- **Supabase (union):** `clock_sessions`, `people_labor_jobs` ×2, `people_labor_job_items`, `people_crew_jobs` ×2, `people_crew_bids`, `people_hours` ×2, `app_settings`, `jobs_ledger` (statuses), `jobs_ledger_materials`, `mercury_transaction_job_allocations`, `mercury_transactions`; RPCs `list_tally_parts_with_po`, `get_jobs_ledger_by_ids[_paid_only]`, `get_bids_by_ids`, `get_invoice_amounts_for_jobs`; indirect `loadWheelsSnapshot`, `loadCardChargeExclusions`, `fetchLabelIdByTxId`, and since v2.4653 `loadFuelOffJobsByUserId` (RPC `list_card_charges_window` + `loadSpendingDirectory`, only when someone has a vehicle deal; it replaced `fetchAttributionsByMercuryTxIds`).
- **Sub-components (extracted):** [`TeamSummaryInline`](../src/components/people/teamSummary/TeamSummaryInline.tsx) (882) → `TeamSummaryDrilldownModal` (178) + region I; `formatters.ts`/`addressDisplay.ts` (tested), `types.ts`, `teamSummaryStyles.ts`; kernel [`derivePersonTeamSummary`](../src/lib/people/derivePersonTeamSummary.ts) (465 lines, 12 tests).
- **Extraction:** ~~`lib/people/loadTeamReviewUnion.ts` with `users` added as a parameter~~ (done v2.3955) — cut/paste plus imports, the four helpers it calls (`paged`, `throwIfQueryError`, `laborRowJobId`, `fetchJobStatusesByIds`) are shared with the panel loader and live in `lib/people/reviewLoaderQueries.ts` since v2.3944 (14 tests), so the move takes no private copy; then a `useTeamSummaryData` hook (rows/loading/error, reqId, auto-refresh, cache key) with the bridge refs and `categoryTags.lookups` (shared with H) as inputs. Preserve the deferral choreography verbatim.

### D. Team Summary popup document builder — extracted

- **Module:** [`src/lib/peopleDocuments/buildTeamSummaryHtml.ts`](../src/lib/peopleDocuments/buildTeamSummaryHtml.ts) — `TeamSummaryHtmlOverheadDecomp` 37–49 (raw nullable rate fields, WIDER than `OverheadRateDecomp`), `TeamSummaryHtmlContext` 51–64 (`isEmbedded`, `periodLabel`, `breakdowns`, `overheadRate`, `overheadRateLoading`, `overheadDecomp`, `selectedPersonName`), `buildTeamSummaryHtml` 66–1575. One template literal: CSS, table skeleton, ES5 IIFE with formatters (`escH` 310, `fmtH`, `fmtPct`, `fmtMoney`), cell builders (`nameTd` 331 … `profitPerHrClickableTd` 437; `overheadBurdenTd` 399 is **not** clickable), `buildRowHtml` 443, `buildFooterHtml` 467, sort/search (`compareRows` 512 … `renderTable` 597), modal bodies `buildHoursBody` 691 … `buildOverheadRateBody` 1260, bridge plumbing (`bridgeTarget` 1330 returns null by design), `openModal` 1415 / `closeModal` 1484, print mode 1554–1560.
- **Shell in the component:** `openTeamSummaryWindow('popup')` — `window.open` + loading doc 2256–2271; cache hit (`teamSummaryDataCacheRef` key match) or `loadTeamSummaryData()`; enrichment with the same `enrichTeamSummaryRowsForInline` 2341–2345; `buildTeamSummaryHtml` 2354–2362 (`isEmbedded` is always false here — the inline branch returned at 2305); error doc 2383–2391.
- **Coverage:** 12 tests (popup vs dead-embedded branch, meta states, JSON `</`-escaping, script machinery, determinism). 5 commits in 90 days (the v2.1305 extraction, then v2.2686, v2.2688, v2.3360, v2.3370 copy/wage changes).

### E. Per-person panel

- **Render location (2641–4037):** empty roster 2641–2642 → no selection (null) 2643–2646 → `reviewError` + Retry 2647–2669 → `reviewLoading` 2670–2671 → panel: **headline card** IIFE 2674–2819 (mirrors `tsRow` from `teamSummaryBreakdowns` 2687–2704, falls back to panel allocation while it loads; returns null in ranked view 2706); **Jobs Worked** 2820–3821 (header 2821–2834 with rollup counts, collapsed strip 2839–2887, table 2889–3817: thead 2891–2962, tbody IIFE 2964–3733 = `renderLaborRow`/`renderCrewRow` + one header row per job from `reviewJobsRollup` 3652–3732, tfoot 3735–3815); **Hours and Pay** 3823–3916 (`getHoursForDay`, `getReviewPeriodPay`); **Reports Filed** 3918–3948; **Tasks Completed** 3950–3976; **Tasks outstanding** 3978–4035 (`reviewTasksRollup` lines).
- **Owned local state:** `reviewLoading` 234, `reviewError` 239 + `reviewReqIdRef` 240, `reviewLaborJobs`/`reviewCrewJobs` 303–304, write-only `setReviewAllocatedRevenue` 305, `reviewAllocatedProfit` 306, `reviewHours` 307, `reviewReports` 309, `reviewTasks`/`reviewTasksOutstanding` 311–312, `reviewJobsWorkedCollapsed` 313, `reviewJobExpandedKey` 314, `reviewJobGroupsOpen` 317, `reviewLaborByJobAndPerson` 325, `reviewHoursPayCollapsed` 374. Local types `ReviewLaborJob` 241–272 / `ReviewCrewJob` 273–302 (~30 fields each), `ReviewReport` 308, `ReviewTask` 310, `ReviewLaborContributor` 318–324.
- **Memos:** `reviewJobsRollup` 802–850 (→ `buildReviewJobsRollup`), `reviewTasksRollup` 851–854, callback `toggleReviewJobGroup` 855–862.
- **Effect (1756–1772):** deps `[selectedReviewPersonIndex, reviewPeriod, reviewCustomRangeStart, reviewCustomRangeEnd, reviewOnlyPaidInFull, showPeopleForReview, users]`; clamps a dangling index to −1, else `loadReviewData(name, reviewOnlyPaidInFull)`.
- **Loaders:** `loadReviewData` 1008–1023 (reqId guard, `reviewError`, `finally` clears loading) → `loadReviewDataCore` 1025–1754, **which since v2.3981 resets the panel, awaits [`loadReviewPersonData`](../src/lib/people/loadReviewPersonData.ts) and commits what comes back; the phases below are that function's, the ranges the component's as of `mapped_at`**. Phases: reset 1032–1044; identity (userId, personId) 1046–1056; office job 1061; 12-query wave 1078–1124; settings defaults 1148–1149; tally parts 1151–1157; hours maps 1159–1166; labor items 1171–1182; crew maps 1185–1210; Convention-1 team crew cost 1212–1224; ledger RPC 1228–1256; statuses 1258–1259; sheet cost + contributor maps 1261–~1370; invoices/materials/card rows 1373–1390; card rule 1399–1405; office/paid filters 1407–1421; `laborJobs` 1422–1473; `crewJobs` 1483–~1530; lifetime-hours wave 1580–1584; allocation via `reviewJobEarned`/`reviewShareRatio` 1642–1685; per-row ratios 1698–1723 (sheet rows get `costRatio = 0`); stale guard 1727; commits 1729–1752. Helpers: `stripAddressZipState` 959–961, `formatDateWithDay` 963–971, `formatHrsLabel` 973–982, `getReviewPeriodPay` 984–991, `getPayForPersonDate` 993–999; `decimalToHms` imported from `lib/people/hoursGridTime` (dedupe done).
- **Dead path (removed v2.3904):** the `forTeamSummary` branch (1013, stubs 1093–1113, 1135, 1580–1582, early return 1687–1696) had **zero callers** — both call sites (1770, 2656) passed `false`, and nothing outside the file calls `loadReviewData`. The parameter is gone from both functions, which now return nothing, and `reqId` is required; the file is 4,140 lines, so every range after 1013 sits up to 27 lines higher than written here.
- **Supabase:** `people_labor_job_assignees`, `people_labor_jobs` ×2, `people_labor_job_items` ×2, `people_crew_jobs` ×3, `people_hours` ×4, `checklist_instances` ×2 (`checklist_items(title, links)` + `checklist_instance_assignees!inner`), `app_settings`, `jobs_ledger` (statuses), `jobs_ledger_materials`, `mercury_transaction_job_allocations`; RPCs `list_reports_with_job_info`, `list_tally_parts_with_po`, `get_jobs_ledger_by_ids[_paid_only]`, `get_invoice_amounts_for_jobs`.
- **Sub-components:** `ChecklistTitleWithLinks` ×3, `Link` (reports), `Fragment`; ledger labels via `effectiveJobLedgerNumber` / `formatJobLedgerNumberLabel` / `resolveJobLedgerPrefix` + `prefixMap`.
- **External coupling:** `users`/`people`/`payConfig` props, `authRole` (`displayReportTemplateName`), region A (Method rows), region C's `teamSummaryBreakdowns` (headline), `reviewView` (H).
- **Extraction:** ~~delete the dead `forTeamSummary` path~~ (done v2.3904); **Stage A** ~~the loader whole to `lib/people/loadReviewPersonData.ts`~~ (done v2.3981, 16 tests over a mocked client; row types in `reviewPersonTypes.ts`), then, under those tests, ~~`lib/people/reviewPersonAllocation.ts` — fetched rows in, `ReviewLaborJob[]`/`ReviewCrewJob[]`/contributors out~~ (done v2.4011: `reviewPersonJobScope` names the jobs after the first wave, `buildReviewPersonAllocation` shapes everything read; 31 tests, no mock); ~~**Stage B** `PeopleReviewPersonPanel.tsx`~~ **done v2.4914** ([`review/PeopleReviewPersonPanel.tsx`](../src/components/people/review/PeopleReviewPersonPanel.tsx), 6 render cases): the render branch, its state, the rollups, the four helpers, the loader and the load, verbatim. It takes `{ selectedPersonName, hasSelection, roster, payConfig, people, users, period, customRangeStart, customRangeEnd, onlyPaidInFull, reviewView, overheadRates, teamSummaryBreakdowns, getDaysInRange }` and reads `useAuth` / `useLedgerPrefixMap` itself. It stays mounted while the roster has anyone, because the tab never reset Jobs Worked's and Hours and Pay's collapse, the open job groups or the expanded row across a person switch; `roster` and `users` stay load keys, as in the tab's effect. `selectedReviewPersonIndex` and its clamp stay in the tab.

### F. Jobs Worked expanded-row detail grid (sub-region of E)

- **Render location:** `renderLaborRow` 2968–3309 with `{expanded && …}` 3072–3306; `renderCrewRow` 3310–3651 with 3414–3648 — both inside the tbody IIFE, called from the per-job group rows (3726–3728). Each grid: per-hr mirrors, Gross chain, Costs chain, Parts/Subs, Net chain, Method A/B/C rows (3213–3302 / 3555–3644) with long tooltips.
- **State:** none beyond `reviewJobExpandedKey` (`labor-${id}` / `crew-${job_id}-${work_date}`).
- **Extraction:** ~~one `ReviewJobExpandedDetail` taking the row, `personName`, `prefixMap`, rates~~ **done v2.4909** ([`review/ReviewJobExpandedDetail.tsx`](../src/components/people/review/ReviewJobExpandedDetail.tsx), 6 render cases). The diff found the two grids byte-identical; the copies differ only in the row heads (`address` vs `job_address`, the number label, the `job_id` guard on the Labor and Profit cells), which stay in the tab. `signedCurrency` and `stripAddressZipState` moved to [`review/reviewFormat.ts`](../src/components/people/review/reviewFormat.ts).

### G. Labor/Profit contributors modal

- **Render location:** 4038–4163 on `reviewLaborBreakdownContext !== null`; rows = `reviewLaborByJobAndPerson[ctx.jobId]`, "(you)" highlight, totals footer, mismatch footnote when `|sumOfRows − totalLaborOnJob| > 1` (4155). Since v2.4911 a sub sheet's row is costed as the job costs it (`laborJobSubCost`: a line's direct $ and rate override count), so the rows add up to the job's total; before, a direct-$ line with no hours (JP1007's $2,150) showed as "—" and the footnote fired. A sheet with several assignees is still one row under all the names; whether it splits is on the owner's list.
- **State:** `reviewLaborBreakdownContext` 373 (`ReviewLaborBreakdownContext` 363–372: `mode`, `jobId`, `jobName`, `jobAddress`, `jobNumberLabel`, `totalLaborOnJob`, `revenueBeforeOverhead`, `userPersonName`); openers at 3009, 3043, 3351, 3385; closers 4049, 4066; **also reset to null by E's loader** (`loadReviewDataCore` 1043). That reset, plus `reviewLaborByJobAndPerson` (E-owned, read only here), means the context state moves with E's panel in Stage B, not into the modal.
- **Extraction:** ~~`ReviewLaborBreakdownModal({ ctx, rows, onClose })`; rides with F~~ **done v2.4909** with F ([`review/ReviewLaborBreakdownModal.tsx`](../src/components/people/review/ReviewLaborBreakdownModal.tsx) with its `ReviewLaborBreakdownContext` type, 5 render cases); the context state stays in the tab.

### H. Ranked view (v2.2678)

- **Owned state:** `reviewView` 380 (`readReviewViewFromStorage`, key `people_review_view_v1`) + `changeReviewView` 381–384 — shared, not H-only: it also switches C's mount (2586) and E's headline card (2706), so it stays in the parent; `reviewRankBy` 385, `reviewRankedSearch` 386 (setters passed to `PeopleReviewRankedList` 2606, 2608); `teamSummaryPriorRows`/`teamSummaryPriorLoading` 389–390 + `teamSummaryPriorReqIdRef` 391; `reviewOfficeLikeCharges` 397 + `reviewOfficeLikeReqIdRef` 398; `pendingApprovals` (392), `reviewCostLineTags` memo 396. `categoryTags` (395) is **shared with C**: its `.lookups` feeds `loadTeamReviewUnion` from C's `loadTeamSummaryData` (2189) as well as from H's prior-period effect (882).
- **Memos:** `reviewSplitPartsRate` 744–747, `teamSummaryPriorBreakdowns` 748–755, `reviewVerdict` 756–759, `reviewRankedBars` 760–763, `reviewPersonMath` 764–769, `reviewHygieneItems` 770–773 — all from [`lib/people/reviewRanked.ts`](../src/lib/people/reviewRanked.ts) over the enriched breakdowns, so the view cannot disagree with the table.
- **Effects:** office-like charges 778–799 (v2.2698, `loadOfficeLikeChargeRows` + `summarizeOfficeLikeCharges`, fails soft to null); prior period 868–896 (`priorPeriodRange` → `loadTeamReviewUnion` + `derivePersonTeamSummary`, reqId-guarded). Both keyed on `teamSummaryRows` identity, ranked view only, separate from C's deferral choreography.
- **Render:** view toggle 2548–2575; ranked block 2586–2615 (`PeopleReviewVerdictStrip`, `PeopleReviewHygieneStrip`, `PeopleReviewRankedList` → `handleInlineTogglePerson`, `PeopleReviewMathDrawer`); E's headline card returns null in ranked view.

### I. Drilldown bodies — `teamSummary/drilldowns.tsx` (absorbed)

[`src/components/people/teamSummary/drilldowns.tsx`](../src/components/people/teamSummary/drilldowns.tsx) — 1,625 lines, 15 function components, no state/effects, one context hook (`useJobFormModal` 1289 in `FieldHoursBody`; null outside the provider → plain-text Job cell). Imported only by `TeamSummaryInline.tsx`, whose `renderDrilldownBody` (838–882) switches drilldown type → body. Module consts `editJobLinkBtnStyle` 38–49, `negStyle` 51, `dashStyle` 52; private `DashCell` 55–57, `HoursDaySection` 64–144, `OverheadSessionsSection` 892–977.

| Body (exported) | Lines | Props | Local math | Popup twin (`buildTeamSummaryHtml.ts`) |
|---|---|---|---|---|
| `HoursBreakdownBody` | 146–316 | `hb`, `personName`, `clickableDay`, `onOpenDayEditor?` | sort day rows | `buildHoursBody` 691 (+`buildDaySectionHtml` 651) |
| `GrossRevenueBody` | 318–411 | `gb` | — | `buildGrossBody` 761 |
| `NetRevenueBody` | 413–498 | `nb` | — | `buildNetBody` 804 |
| `ProfitBody` | 500–595 | `entry`, `overheadDecomp` | partsRate 522–525 | `buildProfitBody` 844 |
| `GrossPerHourBody` | 597–706 | `entry` | per-job $/hr rows 620–636 | `buildGrossPerHourBody` 892 |
| `NetPerHourBody` | 708–826 | `entry` | per-job $/hr rows 713–731 | `buildNetPerHourBody` 955 |
| `ProfitPerHourBody` | 828–889 | `entry`, `overheadDecomp` | — | `buildProfitPerHourBody` 1018 |
| `OverheadHoursBody` | 979–1057 | `entry` | office/bid split | `buildOverheadHoursBody` 1113 |
| `OverheadBurdenBody` | 1059–1153 | `entry`, `overheadDecomp` | partsRate 1068 | **none** (popup cell not clickable) |
| `OverheadLaborBody` | 1155–1278 | `entry` | wage = `overheadWage \|\| 0`, dual-rate label | `buildOverheadLaborBody` 1145 |
| `FieldHoursBody` | 1280–1477 | `entry`, `overheadRate` | allocated/unaccounted field hrs | `buildFieldHoursBody` 1185 |
| `OverheadRateBody` | 1479–1625 | `overheadDecomp` | — | `buildOverheadRateBody` 1260 |

- **Data contract:** reads pre-computed `TeamSummaryBreakdown` fields (derive + enrich); the popup's ES5 copies must stay self-contained, so the two sets are **kept in sync by hand** (8 commits in 90 days here, 5 in the builder — v2.2686/2688/3360/3370 each touched both).
- **Extraction status:** already a leaf presentational module — no Stage B. Worth doing: a `drilldowns.render.test.tsx` smoke over a fixture breakdown, and lifting the two per-hour row derivations + partsRate into `teamSummary/formatters.ts` with tests.

---

## Shared substrate

There is **no cross-tab selection pointer** at the People level — but **within this component** there is one, plus shared engines:

1. **Selection pointer: `selectedReviewPersonIndex`** (index into `showPeopleForReview`; −1 = none). Written by `handleInlineTogglePerson` (table name cells and ranked list), the door effect (675–681) and the clamp effect (1756–1772); read by `teamSummarySelectedPersonName`, the per-person load effect, `reviewPersonMath`, `openTeamSummaryWindow` (2351, embedded-only so dead on the popup path), and every `showPeopleForReview[selectedReviewPersonIndex]` in the panel. Stays; extracted children get `personName` as a controlled prop.
2. **Scope engine: `reviewPeriod` + custom pair + `reviewOnlyPaidInFull` + `getReviewDateRange()` + `showPeopleForReview`.** Every loader, all three views and the popup consume it. Stays.
3. **Rate engine: `reviewOverheadRates`** (A) — read by C, D, E (headline), F, H. Becomes a hook the component owns.
4. **Enriched rows: `teamSummaryBreakdowns`** (C) — read by the table, the ranked view (H), the headline card (E) and (re-enriched) the popup (D). One enrichment for every surface.
5. **Parent-owned bridge:** the six `teamSummary*` / `reviewHoursReopenAfterLoadRef` props + `onOpenDayEditor` / `onDrilldownOpenChange` live in `People.tsx`; no sub-extraction may absorb them.

Sub-extractions here are **children of `PeopleReviewTab`**, which remains the orchestrator. Nothing migrates back up to `People.tsx`.

## What must STAY in `PeopleReviewTab` (the local parent)

- `selectedReviewPersonIndex` + `handleInlineTogglePerson` + `showPeopleForReviewRef` (selection).
- `reviewPeriod` / custom pair / `reviewOnlyPaidInFull` state + the controls JSX (or a dumb `PeopleReviewPeriodControls`).
- `reviewView` + `changeReviewView` — it switches C's mount and E's headline card.
- The URL door (`reviewDoorRef`, `reviewDoorPeriodApplied`, effects 225–233 and 675–681) — it writes the scope and selection state above.
- All bridge-ref prop threading and the auto-refresh deferral choreography (until `useTeamSummaryData` absorbs it wholesale).

## Stage-A candidates (pure logic → `src/lib/*` + tests)

| Candidate | Currently | Target |
|---|---|---|
| Popup Team Summary HTML/JS document | — | **done (v2.1305)** — `buildTeamSummaryHtml` + 12 tests |
| `getReviewDateRange` | — | **done (v2.2688)** — `computeReviewDateRange` + 5 tests |
| `decimalToHms` local copy | — | **done** — imported from `lib/people/hoursGridTime` (11 tests) |
| Earned/share rule | — | **done (v2.3360)** — `reviewEarned.ts` + 5 tests |
| Sub-sheet cost | — | **done (v2.2686)** — `laborJobSubCost` (re-export of `supabase/functions/_shared/subLaborCost.ts`, 5 tests) |
| Card-charge rule | — | **done (v2.3394)** — `summarizeCardChargeAllocations` + `netCardChargesByJobId` (5 + 3 tests) |
| `loadTeamReviewUnion` | **done (v2.3955)** — was a component method reading `users` by closure; calls `paged` / `throwIfQueryError` / `laborRowJobId` / `fetchJobStatusesByIds` (also used by the panel loader) — **the four are in `lib/people/reviewLoaderQueries.ts` (v2.3944, 14 tests)** | `lib/people/loadTeamReviewUnion.ts` (`users` is the last parameter; types in `teamReviewTypes.ts`) + 15 tests over a mocked client |
| `loadReviewDataCore` shaping (cost maps, row shaping, allocation, contributors 1737–1751) | — | **done (v2.4011)** — `lib/people/reviewPersonAllocation.ts` (`reviewPersonJobScope` + `buildReviewPersonAllocation`), every shaping line carried in order, 31 tests; the loader's 16 passed unchanged across the cut |
| Split partsRate (officeParts90d ÷ fieldHours90d) | — | **done (v2.3917)** — `splitPartsRate` in `teamSummary/formatters.ts` + 5 tests; the tab's four copies pass its null on, the two drilldowns read null as 0. The popup's copy (`buildTeamSummaryHtml.ts` 864) is text inside the page's inline script and stays |
| Pay-source closure (`salary`/`hourly`/`unknown`) | — | **done (v2.3917)** — `payConfigSourceFor(payConfig)` in `teamSummary/formatters.ts` + 4 tests |
| `getReviewPeriodLabel` label map, `buildTeamSummaryCacheKey` | — | **done (v2.3924)** — `reviewPeriodLabel` in `reviewDateRange.ts` (3 tests) and `buildTeamSummaryCacheKey` in `lib/people/teamSummaryCacheKey.ts` (8 tests); the tab keeps two thin wrappers that read its state (`getReviewPeriodLabel`, `teamSummaryCacheKey`) |
| Drive-cost + item-hours expressions | drive 4× (1270, 1297, 1328, 1430), item-hours 4× (1294, 1355, 1424, 1614) in the panel loader | now inside `reviewPersonAllocation.ts`, still four copies each — name them there (or reuse `laborJobSubCost` internals), under the kernel's tests |
| `stripAddressZipState` | component function | compare with `addressDisplay.compactAddressForHoursDisplay` (regexes differ — unify only with tests) |
| `formatDateWithDay`, `formatHrsLabel` | component functions | `lib/people/reviewFormat.ts` + tests (check `lib/format.ts` first) |

## Preserve-quirks list (load-bearing — do not "fix" during moves)

1. **Salaried = clocked hours like everyone** (v2.3370) — no weekday-8 h rule remains in any calculation.
2. **Convention 1 crew math:** crew hours = day hours × pct (1485–1486; team cost 1212–1224, 1971–1993) — matches the `sync_crew_jobs_from_clock` trigger.
3. **Earned rule** (`reviewJobEarned`): finished (`ready_to_bill`/`billed`/`paid`) → 100%, a set % → that %, nothing → 50% (`assumedHalf`); a status fetch failure reads as not finished (`fetchJobStatusesByIds` fails soft).
4. **Share rule** (`reviewShareRatio`): 0 with no period hours; 1 when lifetime hours are 0 (data gap); capped at 1. Sub-sheet rows get `costRatio = 0` (1703) — a job cost, not a share.
5. **Split overhead model everywhere:** profit after overhead = net + overhead labor (stored negative) − field hours × partsRate + `vehicleCost` (Wheels deal, v2.2735; since v2.4653 the fixed $/field h plus the person's fuel on no job), computed once in `enrichTeamSummaryRowsForInline` and consumed by table, ranked view, popup, drilldowns. Method A is a reference rate only.
6. **Popup cache stamped with the key computed *before* the load**; the auto-refresh clears it unconditionally.
7. **Drilldown-open refresh deferral:** `teamSummaryModalOpenRef` → `teamSummaryRefreshPendingRef` → parent bumps `teamSummaryDrainTick`.
8. **`bridgeTarget()` returns null** and the `isEmbedded` branch is dead but kept.
9. **Overhead-rate effect swallows errors** into an all-null reset.
10. **`setReviewAllocatedRevenue` is write-only.**
11. **Index clamp never falls back to person 0**; the door selects once, only if the name is on the roster.
12. **App-settings defaults:** `drive_mileage_cost` 0.70, `drive_time_per_mile` 0.02 (1148–1149).
13. **90-day window ignores `reviewPeriod`** and anchors on the company calendar day.
14. **Half-filled custom range does not trigger loads.**
15. **Popup escaping:** JSON `.replace(/</g,'\\u003c')`; ES5-only script.
16. **`throwIfQueryError`** — a failed query in a wave throws (stub waves tolerated); **`paged`** — company-wide and multi-year reads page past `max_rows`; the person-scoped period `people_hours` read (1091) stays single-shot.
17. **Lookback = `min(start, today − 2y)`** in both loaders (1075–1076, 1792–1793).
18. **Configured office job is excluded** from crew assignments and sheets (1204–1206, 1407–1415).
19. **Sort sentinels differ** in drilldowns: `GrossPerHourBody` sorts null $/hr as −1, `NetPerHourBody` as −Infinity.

## Known drift (flag — fix in its own PR, never inside a move)

- **Panel ≠ union on fuel card charges (fixed v2.4653):** the union no longer removes a vehicle-deal person's fuel-tag card charges, so Jobs Worked and the table count the same card charges per job. The panel still has no tag cost lines.
- **Retired cost-share wording still shown** after v2.3360/v2.3370: panel tooltips 2712, 2727, 2936–2937, 2952, 3088, 3430, 4078 describe labor-cost-share allocation; 3802 says "salaried: 8 h per weekday assumed"; popup captions `buildTeamSummaryHtml.ts` 800 and 840 say "Your cost ÷ Total labor" over columns that now show hours (777–778). The inline drilldowns were updated (400, 485).
- **Overhead-labor wage fallback:** inline `entry.overheadWage || 0` (drilldowns 1163) vs popup `overheadWage || hourlyWage || 0`.
- **Orphan comments (fixed v2.3924):** the local `decimalToHms` note is gone, the `signedCurrency` docblock sits on its function, the door comment names `review_person/review_from/review_to`, the two iframe/`onMessage`-era comments say what runs now, and the `drilldowns.tsx` header no longer counts the bodies and points at `lib/people`.

## Recent churn

Since the v2.1305 map: 19 commits reshaped this file — overhead pool without Internal Transfers + revenue bucketing (v2.1307, v2.1319), ranked view + person-panel rollups (v2.2678, v2.2682), sub-sheet costing + office rate (v2.2686), per-hour/paid-only basis + company-calendar periods (v2.2688), office-like hygiene line (v2.2698), Central-day anchor (v2.2703), fuel classifier + tag cost lines (v2.2708, v2.2725), Wheels (v2.2735, v2.2739), sheet→job link (v2.3068, v2.3435), earned convention (v2.3360), URL door (v2.3366), clocked salaried hours (v2.3370), card-charge rule (v2.3394), roster view (v2.3698). v2.2686–v2.3370 also changed `drilldowns.tsx` and `buildTeamSummaryHtml.ts` — every Team Summary copy/math change lands in three places (drilldowns, popup builder, panel tooltips) and the panel tooltips were missed (see Known drift).

## Recommended extraction order (value ÷ risk)

Done: ~~`buildTeamSummaryHtml`~~ (v2.1305), ~~`reviewDateRange`~~ (v2.2688), ~~`decimalToHms` dedupe~~, ~~ranked-view kernel + components~~ (v2.2678), ~~`reviewEarned`~~ (v2.3360).

1. ~~**Delete the dead `forTeamSummary` path**~~ — **done v2.3904**: the parameter, its six query stubs, the empty all-time rows and the early return left `loadReviewData`/`loadReviewDataCore`; both callers pass one argument fewer (4,167 → 4,140 lines).
2. ~~**Stage A sweep**~~ — **done**: `splitPartsRate` (6 copies across both files) and `payConfigSourceFor` (3) in v2.3917; the period label map, the cache key and the orphan comments in v2.3924 (4,140 → 4,091 lines over the two).
3. ~~**`loadTeamReviewUnion` → `lib/people/`**~~ — **done**: its four helpers first (`lib/people/reviewLoaderQueries.ts`, v2.3944, 4,091 → 4,034 lines), then the loader with `users` as its last parameter (v2.3955, 4,034 → 3,610 lines; two callers; 15 tests over a mocked client — windows, the paid-only switch, a hand-built week, overhead buckets, the Wheels fuel exclusion, a failed read).
4. **`useReviewOverheadRates` hook** (A) — ~~the hook, consumers unchanged~~ **done v2.3974** (the scan verbatim in `lib/people/loadReviewOverheadRates.ts`, 17 tests; 3,610 → 3,337 lines); the parity check is done (2026-09-27, the figures agree — region A); left: adopting `loadOverheadPoolSnapshot`, which is the owner's call on the two bad-read differences, not a math question.
5. **Stage A: `reviewPersonAllocation` kernel + tests** (E, 1261–1751) — the largest untested money math. ~~First the loader whole to `lib/people/loadReviewPersonData.ts`~~ **done v2.3981** (verbatim, 16 tests over a mocked client that pin each row's money and the person's share; 3,337 → 2,584 lines); then ~~the pure kernel~~ **done v2.4011** (`reviewPersonAllocation.ts`, 31 tests; the loader is 264 lines of reads); left: decide the fuel divergence in a separate fix PR, and the drive-cost / item-hours expressions the kernel still repeats four times each.
6. ~~**`ReviewJobExpandedDetail`** (F) — dedupe the twin 235-line grids~~ — **done v2.4909** (the grids were byte-identical; one component draws both; 2,584 → 1,981 lines with step 7).
7. ~~**`ReviewLaborBreakdownModal`** (G) — rides with 6~~ — **done v2.4909**, in the same PR.
8. ~~**`PeopleReviewPersonPanel`** (E, Stage B) — panel state and the thin `loadReviewDataCore` move (the read is already in `lib/people`); `personName`, `tsRow`, `reviewView` are props~~ — **done v2.4914** (1,981 → 855 lines; the headline card reads `teamSummaryBreakdowns` itself, so no `tsRow` prop).
9. **`useTeamSummaryData` hook** (C) — last; absorbs rows/loading/error, the auto-refresh effect and the cache; bridge refs as inputs.

Side track (not a move): a render smoke for `drilldowns.tsx` (region I) and a copy-fix PR for the Known-drift wording.

Verification per step: `npm run typecheck && npm run lint && npm test`, behavior-preserving only, one PR per step (see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md)).
