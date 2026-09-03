# People Review Tab Architecture Map

---
file: docs/PEOPLE_REVIEW_TAB_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the sub-decomposition of src/components/people/PeopleReviewTab.tsx (~3,777 lines) per PAGE_DECOMPOSITION_PLAYBOOK.md — an already-extracted People tab that kept growing. Inventories every logical region (state, memos, effects, loaders, supabase tables/RPCs, sub-components, coupling) so extraction can proceed without re-reading the whole file.
audience: Developers, AI Agents
last_updated: 2026-08-02
---

## What this surface is

[`src/components/people/PeopleReviewTab.tsx`](../src/components/people/PeopleReviewTab.tsx) is the **Review** tab of the People page — a dev-only analytics surface with two halves: the **Team Summary** table (one row per pay-config person: hours, overhead hours/labor, field hours, gross/net revenue, profit after overhead, per-hour rates, each cell opening a drilldown modal) and a **per-person Review panel** (headline stats, Jobs Worked with expandable per-job economics, Hours & Pay, Reports Filed, Tasks Completed/Outstanding) that expands when a name in the Team Summary is clicked.

It was extracted from `People.tsx` as one unit (see [`PEOPLE_TABS_ARCHITECTURE.md`](./PEOPLE_TABS_ARCHITECTURE.md) §review — People.tsx shrank 13,487 → 8,598 in that move) and had grown to **5,267 lines** before its own Stage-A decomposition began; after step 1 (popup builder → `lib/peopleDocuments/buildTeamSummaryHtml.ts`, v2.1305) it stands at **3,777 lines**. Hook census: **23 `useState`**, **3 `useEffect`**, **5 `useMemo` + 1 `useCallback`**, **2 `useRef`** (`teamSummaryReqIdRef`, `showPeopleForReviewRef`). It is a single default-exported component with no module-level sub-components; the bulk was three monsters:

| Block | Symbol | Approx lines |
|---|---|---|
| Per-person data loader | `loadReviewData` | ~665 |
| Team-wide union loader | `loadTeamReviewUnion` | ~290 |
| Popup Team Summary HTML/JS document builder | inside `openTeamSummaryWindow` | **extracted v2.1305** → [`lib/peopleDocuments/buildTeamSummaryHtml.ts`](../src/lib/peopleDocuments/buildTeamSummaryHtml.ts) (~1,490 moved) |
| Render IIFE (header, controls, inline table mount, per-person panel, contributors modal) | `return (() => { … })()` | ~1,537 |

This map is a **sub-decomposition** map: the parent-side facts (render gate, props contract, what stayed in `People.tsx`) are recorded in [`PEOPLE_TABS_ARCHITECTURE.md`](./PEOPLE_TABS_ARCHITECTURE.md) §review and are only summarized here. Line numbers are as of v2.1088 and rot — search the symbol.

### Parent contract (recap — do not change during sub-decomposition)

Rendered at `People.tsx` ~3866 behind `activeTab === 'review' && isDev` (the component only mounts when active, so no `activeTab` effect-gating exists inside). Props (`PeopleReviewTabProps`, lines 49–65): data `payConfig`, `archivedUserNames`, `authUser`, `isDev`, `users`, `people`; the **Review↔Hours bridge** `onOpenDayEditor` (→ parent's `handleInlineOpenDayEditor` → shared `DashboardMyTimeDayEditorModal`), `onDrilldownOpenChange`, `teamSummaryInlineRef`, `teamSummaryDataCacheRef`, `teamSummaryModalOpenRef`, `teamSummaryRefreshPendingRef`, `reviewHoursReopenAfterLoadRef`, `teamSummaryDrainTick`; and the shared helper `getDaysInRange`. The bridge refs stay parent-owned because the Hours tab and the shared My-Time editor read/write them.

---

## Master summary table

| Region | Anchor | ~Lines | Coupling | Risk | Status |
|---|---|---|---|---|---|
| A. 90-day overhead-rates engine | `reviewOverheadRates` state + effect at ~268 | ~215 | med — read by B, C, D, E (rates thread everywhere) | low as a hook, high as a component | inline |
| B. Roster + period scope (shared substrate) | `showPeopleForReview`, `getReviewDateRange` | ~120 | highest — every region reads it | must stay in this component | inline (stays) |
| C. Team Summary inline orchestration | `teamSummaryRows` + auto-refresh effect + `loadTeamReviewUnion`/`loadTeamSummaryData` | ~430 | high — bridge refs, cache, overhead rates, roster | med | partially extracted (`TeamSummaryInline` + `derivePersonTeamSummary` already out) |
| D. Team Summary popup document builder | popup branch of `openTeamSummaryWindow` | ~1,660 | low — pure HTML/JS string from a payload | low | **extracted (v2.1305)** → [`lib/peopleDocuments/buildTeamSummaryHtml.ts`](../src/lib/peopleDocuments/buildTeamSummaryHtml.ts) |
| E. Per-person Review panel | `loadReviewData` + render ~3656–4877 | ~1,900 | med — reads B, A, `teamSummaryBreakdowns` headline mirror | med-high (loader math is untested) | inline |
| F. Jobs Worked expanded-row detail grid | inside E, duplicated for labor + crew rows | ~600 (2 × ~300 near-identical) | low — pure render off a row object | low | inline (duplicated) |
| G. Labor/Profit contributors modal | `reviewLaborBreakdownContext` render ~4880–5005 | ~125 | low — reads `reviewLaborByJobAndPerson` | low | inline |

---

## Per-region dossiers

### A. 90-day overhead-rates engine

- **Render location:** no direct render of its own; state at ~206–232, load effect at ~268–420. Its numbers surface in the Team Summary meta line (~3481–3537), `teamSummaryOverheadDecomp` memo (~461–476), `teamSummaryBreakdowns` parts-rate memo (~480–498), the popup's `overheadDecompJson`, and the per-job Method A/B/C rows in the Jobs Worked expanded grid.
- **Owned local state:** `reviewOverheadRates` — one object: `ratePerHour`, `ratePerRevenueDecimal`, `ratePerLaborDollar`, `loading`, `windowStart`, `windowEnd`, `officeLabor90d`, `bidLabor90d`, `officeParts90d`, `invoices90d`, `fieldHours90d`, `fieldLaborUsd90d`.
- **Effect:** deps `[isDev, authUser?.id]`; cancelled-flag async. Window = rolling 90 days (`ymdAddDays(today, -89)` → today, en-CA local dates). Loads overhead sessions (office job OR `bid_id not null`), field sessions (non-office `job_ledger_id`), office parts, invoices; then `people_pay_config` wages. Computes the overhead pool via `buildOverheadWageLookup` + `buildOverheadDailyLabor` + `mergeOverheadDayTableRows` (all imported from [`lib/overheadDailyLabor`](../src/lib/overheadDailyLabor.ts) — Stage A already done for this calc), field hours/labor from approved closed sessions × wage, and the three Method A/B/C rates. On any error it resets the whole object to nulls (no error surface).
- **Supabase:** `clock_sessions` (two range SELECTs with `users!clock_sessions_user_id_fkey(name)` join), `jobs_ledger_invoices` (`amount, sent_to_customer_at` range), `people_pay_config` (`person_name, hourly_wage, is_salary`), plus `app_settings` + Tally parts indirectly via [`fetchOverheadOfficeJobLedgerIdFromAppSettings`](../src/lib/overheadOfficeJobSettings.ts) and [`loadOfficePartsUsdByDayExcludingInternalTransfer`](../src/lib/overheadPartsBucketLoader.ts) (fetch → Banking → Accounting bucket per Mercury tx → per-day sums with Internal Transfers EXCLUDED, degrading to everything-counted on bucket-fetch failure — the same shared loader the Overhead tab's 90-day KPI effect uses, so the two surfaces' office-parts pools cannot drift). Uses `withSupabaseRetry`.
- **External coupling:** duplicates the Overhead tab's engine on a fixed 90-day window (noted in the parent map: "the review tab's 90-day overhead-rate calc … also imports `buildOverheadDailyLabor`"). Independent of `reviewPeriod` — the rate window never follows the selected period.
- **Extraction status + risk + approach:** inline. **Extract as a hook, not a component**: `src/hooks/useReviewOverheadRates.ts` returning the state object (inputs: `isDev`, `authUser?.id`). Every consumer keeps reading `reviewOverheadRates.*` unchanged. Low risk — the effect is self-contained; the only subtlety is the silent-null error behavior (preserve it). Its pure tail (rate division with `> 0` guards) could get a small kernel + test, but the heavy calc already lives in tested `lib/overheadDailyLabor`.

### B. Roster + period scope — the shared substrate (stays)

- **Render location:** period controls render at ~3541–3623 (period `<select>`, custom From/To date inputs, the "Only Count Jobs Marked Paid in Full" checkbox).
- **Owned local state:** `reviewPeriod` (`ReviewPeriod` union: `today | yesterday | this_week | last_week | last_two_weeks | last_30_days | last_90_days | this_year | custom`; default `last_30_days`), `reviewCustomRangeStart`, `reviewCustomRangeEnd`, `reviewOnlyPaidInFull`, and the person pointer `selectedReviewPersonIndex` (−1 = none; index into `showPeopleForReview`).
- **Derived memos:** `externalOnlyPayConfigNamesLower` (people-rows with no matching `users` account, ~425), `showPeopleForReview` (payConfig keys − archived − external-only, sorted, ~438) + the stale-closure mirror `showPeopleForReviewRef` (assigned every render, read by `handleInlineTogglePerson` which is `useCallback([])`), `teamSummarySelectedPersonName` (~454).
- **Handlers/functions:** `getReviewDateRange()` (period → `[start, end]`; custom swaps out-of-order dates, half-filled pair collapses to single day, empty pair to today), `getReviewPeriodLabel()`, `handleInlineTogglePerson` (name → index toggle via the ref), the custom-range seeding logic inside the period `<select>` onChange (seeds From/To with the current effective range on first switch to Custom).
- **Supabase:** none directly.
- **External coupling:** everything — regions A(consumer-side), C, D, E all call `getReviewDateRange`/read `showPeopleForReview`/`reviewOnlyPaidInFull`; `selectedReviewPersonIndex` drives both the Team Summary row highlight and the per-person panel.
- **Extraction status + risk + approach:** **stays in `PeopleReviewTab`** — this is the component's selection pointer + scope engine (see [Shared substrate](#shared-substrate)). Stage A only: lift `getReviewDateRange` + `getReviewPeriodLabel` into `src/lib/people/reviewDateRange.ts` as pure functions of `(period, customStart, customEnd, now)` with tests (week-boundary, custom-swap, half-filled-pair cases). The state itself never moves; extracted children receive `[start, end]`, `days`, `onlyPaidInFull`, `selectedPersonName` + toggles as props.

### C. Team Summary inline orchestration

- **Render location:** header/meta block ~3494–3538 (period label, row count, clickable "Overhead (split)" meta → `teamSummaryInlineRef.current?.openOverheadRateDrilldown`); `<TeamSummaryInline>` mount ~3626–3654 (error / rows / loading three-way).
- **Owned local state:** `teamSummaryRows: TeamSummaryRow[] | null`, `teamSummaryLoading`, `teamSummaryError`, `teamSummaryReqIdRef` (request-id guard against stale async writes).
- **Cross-boundary state (props, parent-owned):** `teamSummaryDataCacheRef` (`{ rows, cacheKey }` popup cache), `teamSummaryModalOpenRef` + `teamSummaryRefreshPendingRef` + `teamSummaryDrainTick` (drilldown-open refresh deferral), `reviewHoursReopenAfterLoadRef` (re-open Hours drilldown after a My-Time save), `teamSummaryInlineRef` (imperative handle: `openDrilldown`, `openOverheadRateDrilldown`).
- **Derived memos:** `teamSummaryOverheadDecomp` (`OverheadRateDecomp` from region A), `teamSummaryBreakdowns` (`enrichTeamSummaryRowsForInline(rows, partsRate, payConfigSourceFn)` — the split-overhead model: partsRate = officeParts90d ÷ fieldHours90d).
- **Effect (auto-refresh, ~500–548):** deps `[isDev, reviewPeriod, reviewCustomRangeStart/End, reviewOnlyPaidInFull, payConfig, showPeopleForReview, reviewOverheadRates.ratePerHour, reviewOverheadRates.loading, teamSummaryDrainTick]`. Unconditionally nulls `teamSummaryDataCacheRef`; empty roster resets everything; skips while `payConfig` empty, custom range half-filled, or a drilldown is open (`teamSummaryModalOpenRef` → mark `teamSummaryRefreshPendingRef`, parent bumps `teamSummaryDrainTick` on close); else 200ms `setTimeout` → `openTeamSummaryWindow('inline')`.
- **Handlers/loaders:** `loadTeamReviewUnion(start, end, onlyPaidJobs, payConfigSnapshot)` — the Tier-3 one-shot team dataset (~290 lines) returning [`TeamReviewUnion`](../src/lib/people/teamReviewTypes.ts); `loadTeamSummaryData()` = union → `showPeopleForReview.map(name => derivePersonTeamSummary(union, name, payConfig, reviewOnlyPaidInFull, days))`; `buildTeamSummaryCacheKey()` (start/end + paid flag + sorted roster + payConfig wage/salary signature); the inline branch of `openTeamSummaryWindow('inline')` (reqId guard, sets rows, stamps the popup cache, fires the deferred `reviewHoursReopenAfterLoadRef` drilldown re-open on a 50ms timeout).
- **Supabase (in `loadTeamReviewUnion`):** `people_labor_jobs` (period + 2-year all-time), `people_labor_job_items`, `people_crew_jobs` (period + all-time), `people_crew_bids` (period only, modal display), `people_hours` (period + all-time), `app_settings` (`drive_mileage_cost`, `drive_time_per_mile`; defaults 0.70 / 0.02), `clock_sessions` (all-time overhead sessions, office-or-bid), `jobs_ledger_materials`; RPCs `list_tally_parts_with_po`, `get_jobs_ledger_by_ids[_paid_only]`, `get_jobs_ledger_by_hcp_numbers[_paid_only]`, `get_bids_by_ids`, `get_invoice_amounts_for_jobs`.
- **Sub-components (already extracted):** [`TeamSummaryInline`](../src/components/people/teamSummary/TeamSummaryInline.tsx) (~882 lines) + [`TeamSummaryDrilldownModal`](../src/components/people/teamSummary/TeamSummaryDrilldownModal.tsx) + [`drilldowns.tsx`](../src/components/people/teamSummary/drilldowns.tsx) (~1,624) + `formatters.ts`/`addressDisplay.ts` (tested) + `types.ts`/`teamSummaryStyles.ts`; pure kernel [`derivePersonTeamSummary`](../src/lib/people/derivePersonTeamSummary.ts) (tested) with shared types in [`teamReviewTypes.ts`](../src/lib/people/teamReviewTypes.ts).
- **External coupling:** the Review↔Hours bridge (all five refs + tick); overhead rates (A); roster/period (B). Crew pct math is **Convention 1** (share of total day, matching the `sync_crew_jobs_from_clock` trigger — see v2.539 in RECENT_FEATURES); changing the multiplicand silently breaks reconciliation with pay stubs and Quickfill.
- **Extraction status + risk + approach:** partially extracted (the render side is out; the orchestration is not). Next seam: move `loadTeamReviewUnion` to `src/lib/people/loadTeamReviewUnion.ts` — it is already a pure async function of `(start, end, onlyPaidJobs, payConfigSnapshot)` with zero component-state reads (verified: no `set*` calls inside), so this is a cut/paste move plus imports. Then a `useTeamSummaryData` hook (rows/loading/error + reqId + the auto-refresh effect + cache-key fn) becomes tractable; the bridge refs remain props threaded through. Med risk — the refresh-deferral choreography (modal-open ref, drain tick, cache stamping order) is subtle and untested; preserve it verbatim.

### D. Team Summary popup document builder

- **Render location:** the `else` (popup) branch of `openTeamSummaryWindow('popup')`, ~1700–3470: `window.open` + loading shell, then a single ~1,560-line template literal (`const html = …`) containing the standalone document's CSS, table skeleton, and an ES5 IIFE `<script>` with: formatters (`escH`, `fmtH`, `fmtPct`, `fmtPct1`, `fmtMoney`), cell builders (`nameTd`, `clickCellTd`, `hoursClickableTd`, `overheadHoursClickableTd`, `overheadLaborClickableTd`, `fieldHoursClickableTd`, `grossClickableTd`, `netClickableTd`, `profitClickableTd`, `grossPerHrClickableTd`, `netPerHrClickableTd`, `profitPerHrClickableTd`), `buildRowHtml`/`buildFooterHtml`, client-side sort+search (`compareRows`, `getVisibleRows`, `renderTable`), nine modal-body builders (`buildHoursBody`, `buildGrossBody`, `buildNetBody`, `buildProfitBody`, `buildGrossPerHourBody`, `buildNetPerHourBody`, `buildProfitPerHourBody`, `buildOverheadSessionsSection` + `buildOverheadHoursBody`, `buildOverheadLaborBody`, `buildFieldHoursBody`, `buildOverheadRateBody`), `openModal`/`closeModal`, modal-only print mode (`body.printing-modal` + `afterprint`), and the (now-inert) bridge plumbing — `bridgeTarget()` **returns null by design**, so popup name cells and day headers render static.
- **Owned local state:** none — the builder closes over `payConfig`, `reviewOverheadRates`, `showPeopleForReview`, `selectedReviewPersonIndex`, `getReviewPeriodLabel()` and serializes them into `breakdownsJson` / `overheadRateJson` / `overheadDecompJson` / `selectedPersonNameJson` (all `</`-escaped).
- **Data flow:** `dataPromise` = cache hit (`teamSummaryDataCacheRef` key match, popup only) or `loadTeamSummaryData()`. Rows are enriched by the SAME `enrichTeamSummaryRowsForInline` (split overhead model: own office/bid wages charged directly + field-hour share of office parts) that feeds `teamSummaryBreakdowns` — the popup's retired local all-hours enrichment (`profit − totalHours × overheadRate`) was removed in v2.1247 after the two windows were caught disagreeing on Profit and row order. Rates are read through `reviewOverheadRatesRef` inside the `.then()` so a rate load finishing mid-fetch still reaches the popup.
- **Sub-components:** none (dead `embeddedResizeScript` iframe-resize branch survives behind `isEmbedded` which is always false on this path — the inline iframe era ended when `TeamSummaryInline` landed; preserve, do not "clean up", during the move).
- **External coupling:** `showToast` for popup-blocked / loading / error; `window.open` + `document.write`.
- **Extraction status + risk + approach:** **extracted (v2.1305)** → [`src/lib/peopleDocuments/buildTeamSummaryHtml.ts`](../src/lib/peopleDocuments/buildTeamSummaryHtml.ts) + colocated test (12 cases: popup vs dead-embedded branch, meta states, JSON `</`-escaping, script machinery, determinism). Takes an explicit `TeamSummaryHtmlContext` (`{ isEmbedded, periodLabel, breakdowns, overheadRate, overheadRateLoading, overheadDecomp, selectedPersonName }`) and returns the HTML string — the `buildPayStubHtml` pattern. The template moved byte-verbatim (only `getReviewPeriodLabel()` → the threaded `periodLabel`); the dead `embeddedResizeScript` branch is preserved. Note `overheadDecomp` is typed as the WIDER `TeamSummaryHtmlOverheadDecomp` (raw nullable `reviewOverheadRates` fields) — the popup has always serialized raw nulls while the inline memo coerces to 0. The `openTeamSummaryWindow` shell (window management, cache check, enrichment call, toasts) stays in the component.

### E. Per-person Review panel

- **Render location:** gate chain at ~3656: empty roster message → `selectedReviewPersonIndex < 0` renders null (the Team Summary is the picker) → `reviewLoading` → the panel: **headline stats card** ~3666–3811 (mirrors the person's `teamSummaryBreakdowns` row via `tsRow` so the card matches the table; falls back to panel-local allocation while the row loads), **Jobs Worked** section ~3812–4707 (collapsible; collapsed = 3-stat strip; expanded = the big table of `reviewLaborJobs` + `reviewCrewJobs` rows with a totals `<tfoot>`), **Hours and Pay** ~4709–4785 (collapsible; per-day table using `getHoursForDay` + `getPayForPersonDate`), **Reports Filed** ~4787–4817, **Tasks Completed** ~4819–4845, **Tasks Outstanding** ~4847–4877.
- **Owned local state:** `reviewLoading`, `reviewLaborJobs: ReviewLaborJob[]`, `reviewCrewJobs: ReviewCrewJob[]`, `reviewAllocatedProfit` (+ a write-only `setReviewAllocatedRevenue`), `reviewHours` (`{work_date, hours}[]`), `reviewReports`, `reviewTasks`, `reviewTasksOutstanding`, `reviewJobsWorkedCollapsed`, `reviewJobExpandedKey` (`labor-${id}` / `crew-${job_id}-${work_date}`), `reviewLaborByJobAndPerson: Record<jobId, ReviewLaborContributor[]>`, `reviewHoursPayCollapsed`. The local types `ReviewLaborJob`/`ReviewCrewJob` (~124–185) carry ~25 numeric fields each (allocation outputs).
- **Effect (~1327–1343):** deps `[selectedReviewPersonIndex, reviewPeriod, reviewCustomRangeStart, reviewCustomRangeEnd, reviewOnlyPaidInFull, showPeopleForReview, users]`; clamps a dangling index to −1 (never falls back to person 0), then `loadReviewData(personName, false, reviewOnlyPaidInFull)`.
- **Handlers/loaders:** `loadReviewData(personName, forTeamSummary?, onlyPaidJobs?)` (~659–1325) — a 13-query `Promise.all` + three follow-up query waves. Computes, per job: drive cost (`miles × mileageCost + miles × timePerMile × rate`), labor-item hours (`is_fixed ? hrs_per_unit : count × hrs_per_unit`), lifetime `laborCostByHcp`/`teamLaborCostByJobId`/`personLaborCostByJobId`/`personHoursOnJobAllTime`, parts (`partsCostByJobId + invoiceAmountByJob + billedMaterialsByJobId`), `valueCreated = totalBill × (pctComplete ?? 100)/100`, `revenueBeforeOverhead = valueCreated − parts − totalJobLabor`, then cost-ratio allocation (`allocatedTotalBill`, `allocatedRevenueBeforeOverhead`, `userTotalContributionToBill/Revenue`) and the `reviewLaborByJobAndPerson` contributor breakdown. Salary convention throughout: weekday (Mon–Fri) = 8 h, else 0. The `forTeamSummary` early-return path (returns `{allocatedRevenue, allocatedProfit, hoursRows, totalHoursPaidJobs?}`) is a **legacy Tier-2 path** — `loadTeamSummaryData` now uses the union loader; verify remaining callers before deleting anything. Helpers used by the render: `getHoursForDay` (defined twice inline, in the headline card and Hours-and-Pay IIFEs), `getReviewPeriodPay`, `getPayForPersonDate`, `decimalToHms` (local copy — canonical version exists in [`lib/people/hoursGridTime.ts`](../src/lib/people/hoursGridTime.ts), note the copies round seconds differently), `stripAddressZipState` (near-duplicate of `compactAddressForHoursDisplay` in `teamSummary/addressDisplay.ts` — regexes differ; do not silently unify), `formatDateWithDay`, `formatHrsLabel`.
- **Supabase (in `loadReviewData`):** `people_labor_jobs` (×3 shapes: period/person, all-time/all-people, all-time/person), `people_labor_job_items` (×2 waves), `people_crew_jobs` (×3), `people_hours` (×4), `checklist_instances` (completed + outstanding, with `checklist_items(title, links)` + `checklist_instance_assignees!inner(user_id)`), `app_settings`, `jobs_ledger_materials`; RPCs `list_reports_with_job_info`, `list_tally_parts_with_po`, `get_jobs_ledger_by_ids[_paid_only]`, `get_jobs_ledger_by_hcp_numbers[_paid_only]`, `get_invoice_amounts_for_jobs`.
- **Sub-components:** `ChecklistTitleWithLinks` (extracted, tasks tables), `Link` (reports → `/jobs?report=…`). Ledger-number labels via `effectiveJobLedgerNumber`/`formatJobLedgerNumberLabel`/`resolveJobLedgerPrefix` + `prefixMap` (context). Everything else inline.
- **External coupling:** reads `users` (name→id for checklist queries), `payConfig` (wages/salary), `authRole` (`displayReportTemplateName`), region A rates (Method A/B/C rows), and `teamSummaryBreakdowns` (headline mirror — an intra-file dependency on region C's memo).
- **Extraction status + risk + approach:** inline. Two-stage: **Stage A** — lift `loadReviewData`'s pure allocation core into `src/lib/people/reviewPersonAllocation.ts` (shape it like `derivePersonTeamSummary`: fetched rows in, `ReviewLaborJob[]`/`ReviewCrewJob[]`/contributors out) + tests for the ratio edge cases (`denominator ≤ 0` with cost > 0 ⇒ ratio 1; pct-complete null ⇒ 100). **Stage B** — move the panel to `PeopleReviewPersonPanel.tsx` with props `{ personName, payConfig, reviewOverheadRates (or the hook), start, end, days, onlyPaidInFull, tsRow, prefixMap-context implied, users, authRole implied }`; the loader + its state move with it; `selectedReviewPersonIndex` stays in `PeopleReviewTab` (controlled selection, playbook rule). Med-high risk purely from untested math volume — do Stage A first.

### F. Jobs Worked expanded-row detail grid (sub-region of E)

- **Render location:** two near-identical `{expanded && (…)}` blocks — labor rows ~4056–4290, crew rows ~4398–4632. Each is a ~230-line 2-column grid: per-hr mirrors, Gross Revenue chain (total bill → progress → value created → user share), Costs chain (total labor, rest-of-team, user labor, labor rates excluding drive cost), Parts/Subs, Net Revenue chain, and the Method A/B/C overhead-profit rows with long strategy tooltips.
- **Owned state:** none beyond E's `reviewJobExpandedKey`.
- **Extraction status + risk + approach:** inline, **duplicated**. Extract once as `ReviewJobExpandedDetail` taking the row (the `ReviewLaborJob`/`ReviewCrewJob` shapes are field-compatible for everything the grid reads), `personName`, `prefixMap`, and `reviewOverheadRates`. Low risk, ~300-line dedupe. The two copies have drifted in only trivial ways (`address` vs `job_address`, number-label resolution) — diff carefully and preserve any real differences.

### G. Labor/Profit contributors modal

- **Render location:** ~4880–5005, gated on `reviewLaborBreakdownContext !== null`. Fixed-overlay modal listing `reviewLaborByJobAndPerson[ctx.jobId]` rows (person / hours / labor / share / profit slice in `profit` mode), "(you)" highlight via `ctx.userPersonName`, totals footer, and a mismatch footnote when `|sumOfRows − ctx.totalLaborOnJob| > 1`.
- **Owned local state:** `reviewLaborBreakdownContext: ReviewLaborBreakdownContext | null` (`{mode: 'labor'|'profit', jobId, jobName, jobAddress, jobNumberLabel, totalLaborOnJob, revenueBeforeOverhead, userPersonName}`); openers are the This-Labor / This-Profit cell `onClick`s in the Jobs Worked table (4 call sites).
- **Extraction status + risk + approach:** inline. Trivial `ReviewLaborBreakdownModal` component (props: `ctx`, `rows`, `onClose`, `formatCurrency` implied). Opened only from region E — moves with it or just before it. Low risk.

---

## Shared substrate

There is **no cross-tab selection pointer** at the People level (see the parent map) — but **within this component** there is a real one, plus a shared data engine:

1. **Selection pointer: `selectedReviewPersonIndex`** (int index into `showPeopleForReview`; −1 = none). Written by `handleInlineTogglePerson` (clicks in `TeamSummaryInline` name cells) and the clamp effect; read by the row highlight (`teamSummarySelectedPersonName`), the per-person load effect, and every `showPeopleForReview[selectedReviewPersonIndex]` in the panel render (~15 sites). **Stays in `PeopleReviewTab`** — any extracted panel gets `personName` as a controlled prop.
2. **Scope engine: `reviewPeriod` + custom range + `reviewOnlyPaidInFull` + `getReviewDateRange()` + `showPeopleForReview`.** Every loader and both table/panel renders consume it. Stays; Stage A makes the range calc a pure lib.
3. **Rate engine: `reviewOverheadRates`** (region A) — read by C's enrichment, D's payload, and E's Method A/B/C rows. Extract as a hook the parent component owns.
4. **Parent-owned bridge:** the six `teamSummary*`/`reviewHoursReopenAfterLoadRef` props form the Review↔Hours shared-modal substrate and live in `People.tsx`; no sub-extraction may absorb them.

Implication: sub-extractions here are **children of PeopleReviewTab**, which remains the orchestrator (the "parent" in playbook terms). Nothing should migrate back up to `People.tsx`.

## What must STAY in `PeopleReviewTab` (the local parent)

- `selectedReviewPersonIndex` + `handleInlineTogglePerson` + `showPeopleForReviewRef` (selection).
- `reviewPeriod`/`reviewCustomRangeStart`/`reviewCustomRangeEnd`/`reviewOnlyPaidInFull` state + the period-controls JSX (or a dumb controlled `PeopleReviewPeriodControls` at most).
- All bridge-ref prop threading (`teamSummaryInlineRef`, `teamSummaryDataCacheRef`, `teamSummaryModalOpenRef`, `teamSummaryRefreshPendingRef`, `reviewHoursReopenAfterLoadRef`, `teamSummaryDrainTick`, `onOpenDayEditor`, `onDrilldownOpenChange`).
- The auto-refresh effect's deferral choreography (until a `useTeamSummaryData` hook absorbs it wholesale).
- URL/deep-link: none exists inside this component (the `tab=review` guard is in `People.tsx`) — nothing to preserve here.

## Stage-A candidates (pure logic → `src/lib/*` + tests)

| Candidate | Currently | Target |
|---|---|---|
| Popup Team Summary HTML/JS document (~1,660 lines incl. 14 `build*Body`/cell-builder functions) | ~~template literal inside `openTeamSummaryWindow`~~ | **done (v2.1305)** — [`lib/peopleDocuments/buildTeamSummaryHtml.ts`](../src/lib/peopleDocuments/buildTeamSummaryHtml.ts) (explicit context object) + 12 tests |
| `loadTeamReviewUnion` | component method (already pure-async, no state reads) | `lib/people/loadTeamReviewUnion.ts` (types already in `teamReviewTypes.ts`) |
| `loadReviewData` allocation core (drive cost, item-hours reduce, cost maps, ratio allocation, contributor breakdown) | inline in the 665-line loader | `lib/people/reviewPersonAllocation.ts` + tests |
| `getReviewDateRange` + `getReviewPeriodLabel` | component functions | `lib/people/reviewDateRange.ts` (inject `now`) + tests |
| `buildTeamSummaryCacheKey` | component function | same module as above or `lib/people/teamSummaryCacheKey.ts` + test |
| `decimalToHms` (local copy) | duplicated (also in `quickfill/HoursSection.tsx`) | reuse [`lib/people/hoursGridTime.ts`](../src/lib/people/hoursGridTime.ts) — **behavioral diff**: local copy floors minutes then rounds seconds and pads `:00`; lib version rounds total seconds. Verify rendered strings match before swapping |
| `stripAddressZipState` | component function | compare with `teamSummary/addressDisplay.ts` `compactAddressForHoursDisplay` (different regex: comma/case handling); keep both or unify deliberately with tests |
| `formatDateWithDay`, `formatHrsLabel` | component functions | `lib/people/reviewFormat.ts` + tests (check `lib/format.ts` first) |
| Drive-cost + labor-item-hours formulas (repeated ~6× across both loaders) | copy-pasted expressions | `lib/people/laborCostMath.ts` (`driveCostFor(miles, rate, mileageCost, timePerMile)`, `sumLaborItemHours(items)`) + tests |

## Preserve-quirks list (load-bearing — do not "fix" during moves)

1. **Salary = 8 h Mon–Fri, 0 weekends**, computed via `new Date(d + 'T12:00:00').getDay()` (noon parse dodges UTC drift). Repeated in both loaders and the panel; keep identical everywhere.
2. **Convention 1 crew math**: pct × `dayHoursRaw` (share of total day), not day-minus-overhead. Matches the DB trigger and four other consumers (v2.539).
3. **Allocation ratio fallback**: `denominator > 0 ? cost/denominator : (cost > 0 ? 1 : 0)` — a person with cost on a zero-labor job gets 100%.
4. **`pctComplete ?? 100`** — jobs with no progress value count as fully complete for Value Created.
5. **Split overhead model everywhere** (since v2.1247): profit-after-overhead = `profit + overheadLaborCost − fieldHours × partsRate`, computed once in `enrichTeamSummaryRowsForInline` and consumed by all three surfaces (inline table, popup, drilldowns.tsx). Method A (`ratePerHour`, whole pool ÷ field hours) is a reference rate only. Any new surface must consume the shared enrichment, never recompute.
6. **Popup cache is stamped with the key computed *before* the load** so a mid-load invalidation still misses on the next click; auto-refresh clears the cache unconditionally.
7. **Drilldown-open refresh deferral**: `teamSummaryModalOpenRef` → `teamSummaryRefreshPendingRef` → parent bumps `teamSummaryDrainTick`. Losing this wipes a user's open modal on any realtime/payConfig change.
8. **`bridgeTarget()` returns null on purpose** — popup name cells/day headers are static; the embedded iframe era is dead code kept for the popup document's internal structure.
9. **Overhead-rate effect swallows errors** into an all-null reset (no error UI).
10. **`setReviewAllocatedRevenue` is write-only** (destructured without the value); the write-side stays so the diff reads as a move.
11. **Index clamp never falls back to person 0** — roster shrink sets selection to −1.
12. **App-settings defaults**: `drive_mileage_cost` 0.70, `drive_time_per_mile` 0.02.
13. **90-day rate window ignores `reviewPeriod`** — rolling `today−89 → today` always.
14. **Half-filled custom range does not trigger loads** (both the auto-refresh and the per-person effect rely on `getReviewDateRange`'s collapse rules plus the explicit skip in the refresh effect).
15. **Escaping in the popup doc**: JSON payloads `.replace(/</g,'\\u003c')`; ES5-only script with `\\'` apostrophe survival pattern (bit v2.539 once — see RECENT_FEATURES).

## Recent churn (from `docs/RECENT_FEATURES.md`, grep only)

The Team Summary half churned heavily through the v2.539–v2.547 wave (Convention-1 alignment, Overhead-labor column, iframe→client-side sort/search rebuild, popup cache, period-selector expansion, printable drilldowns, hierarchical Hours/Overhead breakdowns with `people_crew_bids` + `get_bids_by_ids` additions) — ~35 `TeamSummary` mentions overall, all predating or landing with the extraction from `People.tsx`. Since extraction the file is comparatively stable; the drilldown-modal presentation logic now lives mostly in `teamSummary/drilldowns.tsx`, but the popup builder in this file duplicates it and must be kept in sync until Stage A unifies the payload.

## H. Ranked view (v2.2678)

- **What:** the tab's default view since v2.2678 — verdict strip (profit after overhead + prior-period trend + gross→profit composition), amber hygiene strip, ranked profit bars with a shared zero line, and a per-person math drawer. The table (region C's `TeamSummaryInline`) stays behind a Ranked / Table control (`lib/people/reviewViewStorage.ts`, key `people_review_view_v1`).
- **Kernel:** [`lib/people/reviewRanked.ts`](../src/lib/people/reviewRanked.ts) — every function takes the enriched `TeamSummaryBreakdown[]` (region C's memo) and nothing else, so the view cannot disagree with the table. Components in [`components/people/review/`](../src/components/people/review/) are presentational.
- **Owned state:** `reviewView`, `reviewRankBy`, `reviewRankedSearch`, `teamSummaryPriorRows` / `teamSummaryPriorLoading` / `teamSummaryPriorReqIdRef`; `usePendingHoursApprovalsNudge(isDev && ranked)` feeds the hygiene strip.
- **Prior-period effect:** keyed on `teamSummaryRows` identity (ranked view only); calls `loadTeamReviewUnion` + `derivePersonTeamSummary` for `priorPeriodRange(getReviewDateRange())`, request-id guarded. Deliberately separate from region C's auto-refresh effect — the deferral choreography there is untouched.
- **Render:** in the table-mount block, `reviewView === 'ranked'` swaps `TeamSummaryInline` for the four components; the "Overhead (split)" meta line is clickable only in table view (the drilldown handle is null when the table is unmounted); region E's headline card returns null in ranked view (the drawer replaces it), the rest of the person panel renders unchanged.
- **Selection:** the ranked list's name buttons call `handleInlineTogglePerson` — the same pointer the table uses.
- **Next:** person-panel rework (jobs rolled up per job, recurring tasks collapsed, zero-hour rows named), then the Review-only math fixes from the 2026-09-03 audit.

## Recommended extraction order (value ÷ risk)

1. ~~**Stage A: `buildTeamSummaryHtml`**~~ — **done (v2.1305)**: popup document builder moved to [`lib/peopleDocuments/buildTeamSummaryHtml.ts`](../src/lib/peopleDocuments/buildTeamSummaryHtml.ts) + 12 tests; file dropped 5,267 → 3,777.
2. **Stage A: `loadTeamReviewUnion` → `lib/people/`** — already pure; unblocks the hook seam.
3. **Stage A sweep** — `reviewDateRange`, `laborCostMath`, cache key, formatter dedupe (with the `decimalToHms` diff check).
4. **`useReviewOverheadRates` hook** — region A; consumers unchanged.
5. **Stage A: `reviewPersonAllocation` kernel + tests** — de-risk the per-person math before any UI moves.
6. **`ReviewJobExpandedDetail` component** — dedupe the twin ~300-line grids (region F).
7. **`ReviewLaborBreakdownModal`** (region G) — trivial, can ride along with 6.
8. **`PeopleReviewPersonPanel` component** (region E, Stage B) — loader + panel state move; `personName` is a controlled prop.
9. **`useTeamSummaryData` hook** (region C) — last; absorbs rows/loading/error, the auto-refresh effect, and the cache logic; bridge refs threaded as inputs.

Verification per step: `npm run typecheck && npm run lint && npm test`, behavior-preserving only, one PR per step (see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md)).
