# JobsJobSummaryTab Architecture Map

---
file: docs/JOBS_JOB_SUMMARY_TAB_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 sub-decomposition map (per PAGE_DECOMPOSITION_PLAYBOOK.md) for the extracted Jobs → Job Summary tab, src/components/jobs/JobsJobSummaryTab.tsx (3,276 lines) — every logical region (module helpers, toolbar, alternate-view switch, ledger table + main rows, expanded-row header / overhead math / person summary / Team / Sub Labor / Parts Cost / Total Bill sections, totals footer, HCP floor footer), its props coupling, drilldown-opener closures, indirect supabase touches, test coverage, and an extraction order. Sections: What this surface is; The ledger view seam; The shared substrate; Master summary table; Per-region dossiers; Props inventory by region; Stage-A candidates; Test coverage; Preserve-quirks list; Recommended extraction order; What must stay in the parent.
covers:
  - src/components/jobs/JobsJobSummaryTab.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
---

**Line numbers are as of `a05cef4c4` and rot** — search the quoted symbol or JSX text instead; every region below is anchored by both. Regenerate the facts with `npm run map -- src/components/jobs/JobsJobSummaryTab.tsx`.

## What this surface is

[`src/components/jobs/JobsJobSummaryTab.tsx`](../src/components/jobs/JobsJobSummaryTab.tsx) (3,276 lines, 47 commits in 90 days, 52 local imports) is the **already-extracted** Jobs → Job Summary tab (extracted from `Jobs.tsx` as step J6, PR #34; data seam v2.826; ledger-view seam v2.2692). It is the per-job cost-rollup ledger: a sortable, groupable table of jobs with an expandable detail row (header, print, charges chart, overhead math, per-person summary with per-cell drilldowns, Team / Sub Labor / Parts Cost / Total Bill sections), plus eight alternate views (Timeline, Rework, Ahead, Capacity, Scatter, Cycle, Months, Days) that replace the table when chosen.

It is still **fully presentational**: 0 `useState` · 0 `useReducer` · 0 effects · 0 `useMemo` · 0 `useCallback` · 0 `useRef` · 0 custom hooks, and **zero** direct supabase calls (tables —, RPCs —, edge fns —). Everything arrives from the parent ([`Jobs.tsx`](../src/pages/Jobs.tsx), 2,274 lines) through **44 declared props** (`JobsJobSummaryTabProps`, lines 404–472; 43 are destructured — `jobSummaryReportPctByJobId` is declared and passed by Jobs.tsx:2140 but never read here, since the % resolution moved into `useJobSummaryView`). Two components live in the file: `JobsJobSummaryTab` (476–3276; render 521–3275) and the module-level `JobSummaryExpandedHeader` (125–271). The render is one JSX expression: a view-mode ternary chain, then a `flatMap` over `view.groups` → `group.rows` producing a main `<tr>` plus (when expanded) a detail `<tr><td colSpan={15}>` holding the expanded regions, with **14** drilldown-opener closures defined inline.

So this sub-decomposition is a **JSX partition**, not a state hoist: split the expanded-row regions (and the alternate-view switch) into sibling presentational components in `src/components/jobs/`, threading slices of the existing props. Stage A still applies to the inline money math; Stage B means "cut a JSX region + its closures into a new component file."

Companion components already extracted and consumed by this file:

| File | Lines | Role |
|---|---|---|
| [`JobSummaryLedgerToolbar.tsx`](../src/components/jobs/JobSummaryLedgerToolbar.tsx) | 350 | Search box, segmented controls, totals strip, hygiene chips, overhead chip; also exports `JobSummarySortHeader` (×15 here) and `JobSummaryTileMoney` |
| [`JobSummaryCutByPanel.tsx`](../src/components/jobs/JobSummaryCutByPanel.tsx) | 139 | Cut-by panel above the table + `JobSummaryGroupRow` (group header rows) |
| [`JobSummaryJobCell.tsx`](../src/components/jobs/JobSummaryJobCell.tsx) | 53 | The one Job identity cell (caret + number + name + chips / address) |
| [`PercentProvenanceChip.tsx`](../src/components/jobs/PercentProvenanceChip.tsx) | 44 | "who set this %" badge under the % cell |
| [`JobSummaryChargesTimelineChart.tsx`](../src/components/jobs/JobSummaryChargesTimelineChart.tsx) | 614 | Cost/value/profit timeline atop each expanded row (imports `JobSummaryRow` back from this file) |
| [`JobSummaryCostCellDrilldownModal.tsx`](../src/components/jobs/JobSummaryCostCellDrilldownModal.tsx) | 338 | Modal shell (rendered by **Jobs.tsx** 2264–2270, not here) + `JobSummaryDrilldownMercuryTable` (×6 here) and `JobSummaryDrilldownTeamLaborByWorkDate` (×3) used inside drilldown bodies built here |
| View components: [`JobSummaryTimelineView`](../src/components/jobs/JobSummaryTimelineView.tsx) 675 · [`JobSummaryDaysView`](../src/components/jobs/JobSummaryDaysView.tsx) 338 · [`JobSummaryCycleView`](../src/components/jobs/JobSummaryCycleView.tsx) 240 · [`JobSummaryScatterView`](../src/components/jobs/JobSummaryScatterView.tsx) 233 · [`JobSummaryMonthsView`](../src/components/jobs/JobSummaryMonthsView.tsx) 227 · [`JobSummaryAheadView`](../src/components/jobs/JobSummaryAheadView.tsx) 215 · [`JobSummaryReworkView`](../src/components/jobs/JobSummaryReworkView.tsx) 203 · [`JobSummaryCapacityView`](../src/components/jobs/JobSummaryCapacityView.tsx) 181 | — | One per non-`jobs` view mode; each over its own tested kernel in `src/lib/jobs/` |
| [`AmountSmallCents.tsx`](../src/components/AmountSmallCents.tsx) (shared) | 33 | `AmountSmallCents` ×40 / `SignedAmountSmallCents` ×38 — every money cell |

Pure logic already in `lib/` (Stage A largely done): `jobSummaryPersonSummaryTable.ts`, `jobSummaryTeamLaborWorkDateTable.ts`, `partsPerPersonCostSummary.ts`, `jobSummaryPercentComplete.ts`, `jobPercentProvenance.ts`, `jobSummaryHcpFilter.ts`, `jobSummaryFooterCopy.ts`, `jobSummaryDrilldownMercuryFilter.ts`, `jobs/jobFormatting.ts` (incl. `jobSummaryPartsCostIsZero`, `personMatchesJobSummaryBreakdownFilter`), `jobs/jobSummaryLedgerView.ts` (enrich / search / filter / sort / group / totals), `jobs/jobSummaryBurn.ts`, `jobs/jobSummaryShareOfTotal.ts`, `jobs/profitLabels.ts`, `jobs/stagesScheduleStrip.ts`, `jobs/moneyStoryDoor.ts`, `jobs/jobDayLedger.ts`, `jobs/subLaborCost.ts` and `jobs/cardChargeAllocationFilter.ts` (both re-export shims over `supabase/functions/_shared/`, v2.3638/v2.3645), `personNameKey.ts`, `mercuryRawDebitCard.ts` (shim), `ledgerDisplayPrefixes.ts`, `stagesJobReferenceDates.ts`, `jobScheduleChicago.ts`, `formatDecimalWorkHoursHhMm.ts`, `supplyHouseWebsite.ts`, and the print builder `jobsDocuments/jobSummaryCostBreakdown.ts` (called via the parent's `printJobSummaryCostBreakdown` thunk).

**How to read a dossier.** "Owned local state: none" is literal for every region (the file has no hooks); each dossier instead lists **props consumed** (what the region would receive when extracted) and **inline closures** (what moves with it).

---

## The ledger view seam (v2.2692)

**Overhead allocation (v2.3258–v2.3259):** the ledger gained `leadDays` (60 days before the window — `loadJobDayLedger`'s default `JOB_DAY_LEDGER_LEAD_DAYS`, which `useJobSummaryView` does not override), and the pure [`lib/jobs/overheadAllocation.ts`](../src/lib/jobs/overheadAllocation.ts) turns a ledger + `OverheadAllocationSettings` (smoothing window · carry share · idle cap · open definition) into per-day landings and per-job shares that reconcile to the pool. `useJobSummaryView` reads the org default through [`useOverheadAllocationSettings`](../src/hooks/useOverheadAllocationSettings.ts) (`app_settings.overhead_allocation_v1`), lets a dev explore per device via `prefs.overheadDials`, and hands the tab `view.overhead` (`settings · appDefault · isOverride · explore · saveAppDefault`, plus the `allocation` the Days view reads); `enrichJobSummaryRows({ settings })` and `jobSummaryHygiene(ledger, settings)` take the same settings, so the Jobs table, Months, Cut by, Compare and the hygiene chips agree. The toolbar's overhead chip opens [`OverheadDialsPopover`](../src/components/jobs/OverheadDialsPopover.tsx) for devs (`canEditOverheadDials`, Jobs.tsx:2152); the expanded row's "Overhead — the math" grows *By hours* / *Carry* columns and *open, not worked* lines when carry is on.

The seam added a layer without breaking the "tab is presentational" rule: [`useJobSummaryView`](../src/hooks/useJobSummaryView.ts) runs page-side (Jobs.tsx:1579, after the `jobSummaryData` memo, with `search: jobSummarySearch`, `reportPctByJobId`, `initialView: ?view=`, `budgetByJobId` from `useJobBudgetFootings`) and hands the tab ONE `view` prop — per-device prefs (view mode · Show · Worked in · Overhead method · sort · cut by · compare · target margin · per-view chart options; localStorage `jobs_jobSummary_view_v1`), the **job day ledger** for the window ([`lib/jobs/loadJobDayLedger.ts`](../src/lib/jobs/loadJobDayLedger.ts) → [`lib/jobs/jobDayLedger.ts`](../src/lib/jobs/jobDayLedger.ts)), `allRows` (before filters), `rows` / `groups` / `totals` / `concentration` / `compare` / `hiddenByStatus` from the pure [`lib/jobs/jobSummaryLedgerView.ts`](../src/lib/jobs/jobSummaryLedgerView.ts) (the text search is `jobSummaryRowMatchesSearch` inside `filterAndSortJobSummaryRows` — no longer inline here), and records one `job-summary-view` row in `ui_nav_clicks` per open. The tab renders `view.rows` (each `{ row: JobSummaryRow, …computed }`) grouped by `view.groups` when a Cut by is set.

**View modes** (`JobSummaryViewMode`: `jobs` · `days` · `timeline` · `months` · `cycle` · `scatter` · `capacity` · `ahead` · `rework`): every mode except `jobs` renders its view component **instead of** the table (lines 529–639), before the load gate. **Columns** of the `jobs` table are 15 `JobSummarySortHeader`s: Job (one identity cell since v2.3176) · Revenue (`Revenue*` when any row shows earned revenue — v2.3575: the window's approved hours earn their share of the contract) · Labor · Subs · Parts · Gross · Margin · Hours · days · Overhead · True profit · True % · Burn · Proj. margin (v2.3191; footing glyph ◆ bid / ✎ typed, v2.3300) · $/hr · %. The detail row's `colSpan={15}`, the group row and the 15-cell `<tfoot>` follow. The parts fixes (internal transfers excluded, invoice-linked card charges counted once, refunds netted — v2.3519) live in `useJobsMercuryAllocations` + the parent memo; this file only renders the signed amounts.

## The shared substrate

Per the playbook, name the page's `setSharedBid` / `useBidPricingEngine` equivalents. For this surface **both exist, and both live one level up**:

1. **Selection pointer(s) — parent-owned, multi-select.** Expansion is a set: `expandedJobSummaryJobIds: Set<string>` (Jobs.tsx:373), with two subordinate per-row selections: `jobSummaryTeamLaborPersonExpandedKeys: Set<string>` (375; keys are **`${job.id}::${breakdownIndex}`** — see quirk 3) and `jobSummaryBreakdownPersonSearchByJobId: Record<string, string>` (378). All three **stay in Jobs.tsx** for this track: the parent's thread-stats effect (Jobs.tsx 472–475, feeding the expanded header's Last activity) and lazy-load effects (1358–1391) watch `expandedJobSummaryJobIds` (and, for clock sessions, the person keys) to call the loaders, and the money-story door effect (1283–1303) adds a job id from `?job=` (`MONEY_STORY_JOB_PARAM`) and scrolls to `jobSummaryRowDomId(job.id)`. (Hoisting them with those five effects into the tab or a hook is the parent map's step 15 — a state move outside this JSX partition; `expandedJobSummaryJobIds` must stay reachable by the door.) Collapsing a row prunes the other two states by `${job.id}::` prefix / key delete (the `toggle` closure, 734–754). **Finding:** nothing writes a value into `jobSummaryBreakdownPersonSearchByJobId` — Jobs.tsx only hands its setter to the tab (2135), and the tab's only write is `toggle`'s delete — so `breakdownPersonQ` (722) is always `''` and every person-filter branch below is unreachable (quirk 5).

2. **The drilldown pointer — the surface's most unusual seam.** `setJobSummaryCostDrilldown: (v: { title: string; body: ReactNode } | null) => void` (parent state at Jobs.tsx:381, set by the tab; cleared to `null` by `useJobsMercuryAllocations()` via `onJobSummaryDrilldownClose` (433) and by the shell's `onClose` (2266)). The modal **shell** (`JobSummaryCostCellDrilldownModal`) renders in Jobs.tsx's modal tail (2264–2270); this tab **builds the modal body JSX at click time** inside 14 opener closures and pushes it up as a ReactNode (quirk #11 of `JOBS_TABS_ARCHITECTURE.md` — a snapshot, not a live view). Every extracted section needs exactly this one callback to keep its drilldowns working — the seam that makes the partition cheap.

3. **The data engine — done, stays put.** [`useJobSummaryData`](../src/hooks/useJobSummaryData.ts) (Jobs.tsx:186; ledger snapshot + min-HCP floor + lazy per-job caches/loaders), the page-side `jobSummaryData` P&L memo (Jobs.tsx 1477–1571, joining the ledger with `tallyParts`, `invoiceAmountByJob`, `job.materials`, `mercuryCardChargesByJobId`, `laborJobs`, `teamLaborData`, drive settings), and `useJobSummaryView` (above). This component only *reads* the resulting rows, the `view` bundle and the cache Maps. **No new hook seam is needed** — extractions are prop-threading only.

**Consequence:** every region below is extractable without touching state ownership. The risk profile is **closure surface** (how many props / row fields each opener captures), not shared mutable state.

### Indirect supabase touches (via parent props — named for completeness)

This file issues no queries. The props it calls or reads resolve to:

| Prop called / read here | Parent implementation | Tables / RPCs |
|---|---|---|
| `loadJobSummaryInvoiceLinesForJob` | `useJobSummaryData` | RPC `get_invoice_allocation_lines_for_jobs` |
| `loadJobSummaryMercuryAllocationsForJob` | `useJobSummaryData` → `fetchMercuryJobAllocationsWithAttributionForJob` (paged; Internal-Transfers rows dropped and invoice-linked rows flagged by `cardChargeAllocationFilter`) | `mercury_transaction_job_allocations` + `mercury_transactions` (+ supply-invoice links) |
| `printJobSummaryCostBreakdown` | Jobs.tsx thunk (569–703) → `buildJobSummaryCostBreakdownHtml` | RPC `get_invoice_allocation_lines_for_jobs` (cold-cache fallback), `mercury_transaction_job_allocations`, `people`, `users` |
| `handleJobSummaryMercuryReassignFromDrilldown` | `useJobsMercuryAllocations` | mercury allocation modal flow (`mercury_transaction_job_allocations` etc.) |
| (data) `jobSummaryClockSessionsByJobId`, `jobSummaryReportsByJobId`, `jobSummaryReportPctByJobId`, `jobSummaryReportDateByJobId`, ledger jobs | `useJobSummaryData` | `clock_sessions`, `reports`, RPC `list_latest_report_completion_pct`, ledger via `fetchJobsLedgerWithDetailsForStages` |
| (data) `view` | `useJobSummaryView` | job day ledger (`loadJobDayLedger`), `app_settings.overhead_allocation_v1`, `ui_nav_clicks` telemetry |
| `jobThreadStatsByJobId` | `useJobThreadNotes` (Jobs.tsx:468) | RPC `jobs_ledger_thread_note_stats` |
| `nicknameByDebitCard` | `useMercuryLedgerNicknames` (Jobs.tsx:135) | `mercury_debit_card_nicknames` |

---

## Master summary table

| Region | Anchor (search for) | Lines | Coupling | Risk | Tests | Status |
|---|---|---|---|---|---|---|
| Module helpers + types | `latestThreadActivity` … `EMPTY_REPORT_DATES` | 474 (1–474) | low (self-contained) | low | header date strips via tested kernels; `latestThreadActivity`, supply-table render fn: none | inline (module scope) |
| Banners + toolbar | `<JobSummaryLedgerToolbar view=` | 7 (522–528) | low | low | `JobSummaryTileMoney` smoke (2) | toolbar **extracted**; mount stays in shell |
| Alternate-view switch | `view.prefs.view === 'timeline'` | 111 (529–639) | low (`view` + 5 props; 3 identical `onOpenJob` closures) | low | view kernels tested; Days render smoke (2); switch itself none | views **extracted** (8 files); switch inline |
| Load / empty gates | `tallyPartsLoading \|\| laborJobsLoading` | 24 (640–663) | low | low | none | inline — stays in shell |
| Cut-by panel + table head | `<JobSummaryCutByPanel` / `label="Job" sortKey="job"` | 28 (665–692) | low | low | ledger-view kernel (27) | panel + headers **extracted**; `<thead>` inline |
| Group + main rows | `view.groups.length > 0 ? view.groups` / `const toggle = () =>` | 199 (694–892) | med (`toggle` writes 3 parent states; 15 cells; Burn IIFE 849–876) | low-med | enrich/burn/% kernels tested; `JobSummaryJobCell` smoke (2); Burn-cell label + red flag: none | inline — stays in shell |
| Expanded header + print + chart | `<JobSummaryExpandedHeader` | 67 (898–964) | low | low | print builder (5), chart kernel `jobChargesTimeline` (53) | header module-level; chart extracted |
| Overhead — the math | `Overhead — the math:` | 77 (965–1041) | low (`enriched` + `view.overhead.settings` + `view.ledger.rates`) | low | allocation kernels tested (overheadAllocation 22, jobDayLedger 10); A/B/C formula sentences: none | inline |
| **Person summary section** | `const teamBreakdownLite =` | 1,180 (1042–2221) | high (14 drilldown openers; both lib row-builders) | med | row builders (9 + 4); **footer money math (computed twice) and mercury filters: none** | inline — **the big extraction** |
| Team section | `Team{' '}` summary | 407 (2223–2629) | med (person-expand keys; clock sessions; orphan box) | med | work-date table (3); orphan partition, `allocTableTotals`: none | inline |
| Sub Labor section | `Sub Labor{' '}` summary | 45 (2630–2674) | low (`laborJobSubCost`) | low | `subLaborCost` (5) | inline — rides along |
| Parts Cost section | `Parts Cost{' '}` summary | 445 (2675–3119) | med (2 lazy `onToggle` loaders; 2nd `buildPartsPerPersonCostRows` call) | med | parts-per-person (4), `cardChargeCostUsd` (5); **tally `lineCost`/`label` inline: none** | inline |
| Total Bill section | `Total Bill{' '}` summary | 27 (3120–3146) | none | trivial | — | inline — rides along |
| Totals footer + earned note | `<tfoot>` / `view.totals.earnedRows > 0` | 35 (3156–3190) | low (`view.totals`) | low | `summarizeJobSummaryRows` via ledger-view tests | inline — stays in shell |
| HCP floor footer | `Hide older imported jobs with HCP # at or below` | 80 (3194–3273) | low (localStorage write) | low | `jobSummaryHcpFilter` (4), `jobSummaryFooterCopy` (5) | inline — stays in shell |

The tab has **no render test of its own**; the only end-to-end cover is `e2e/jobs-tabs.spec.ts` (opens `job-summary`, waits for "True profit").

---

## Per-region dossiers

### Module helpers + types (1–474)

- **Contents:** imports (1–89); pure fn `latestThreadActivity(stat)` (93–113; newest of last note vs last report); `expandedHeaderLabelStyle` (115–122); component **`JobSummaryExpandedHeader({ job, stat, onOpenJobDetail, onOpenEditJob })`** (125–271 — Job Detail / Edit Job buttons, Assigned list, `Job: <effectiveJobLedgerNumber>` + service type, **FIELD** / **BILL** lines from `stripFieldParts` / `stripBillParts` against `scheduleTodayDateKey()` with the old `j:` / `b:` codes kept in the hover (v2.3792), Last activity via `latestThreadActivity` + `getDispatchNoteDisplayMeta`); `jobSummaryDrilldownCellKeyboard(e, onOpen)` (273–282, Enter/Space); `jobSummaryBreakdownInteractiveClass(interactive, variant)` (284–290); `renderJobSummarySupplyHouseInvoiceTableContent(invoiceLoaded, invoiceRows, invoicesFromSupplyHouses)` (293–362 — supply-house invoice line table with portal links via `supplyHouseWebsitePortalHref` + `openInExternalBrowser`); style consts `jobSummaryPartsCostDetailsBoxStyle` / `…FlatRowStyle` / `jobSummaryCostSectionBodyStyle` (364–381); exported type **`JobSummaryRow`** (384–402; 15 fields incl. `cardChargesLinkedToInvoices` and `costLines` since v2.2692/v2.2725 — imported (type-only) by the chart alone; Jobs.tsx imports just the default export and its memo satisfies the type structurally); exported **`JobsJobSummaryTabProps`** (404–472, 44 props); `EMPTY_REPORT_DATES` (474, default for the optional `jobSummaryReportDateByJobId`).
- **Owned local state:** none (module scope).
- **External coupling:** `JobSummaryRow` is the contract with the parent memo and `JobSummaryChargesTimelineChart`. `renderJobSummarySupplyHouseInvoiceTableContent` is called from **5 sites** (4 drilldown bodies in the person summary at 1541 / 1575 / 1948 / 2019, and Parts Cost at 2844). `latestThreadActivity` re-implements a pick that also lives in `JobsStagesActivityBox.tsx` (~121) and `JobsStagesCardList.tsx` (~361).
- **Extraction status + risk + approach:** Inline, **low risk**. `JobSummaryExpandedHeader` (+ `latestThreadActivity` + `expandedHeaderLabelStyle`) is a verbatim move → `src/components/jobs/JobSummaryExpandedHeader.tsx`. `renderJobSummarySupplyHouseInvoiceTableContent` → a `JobSummarySupplyHouseInvoiceTable` component; it must land **before** the Person summary and Parts Cost extractions. `JobSummaryRow` / props types can move to `src/types/jobSummary.ts` or stay.

### Banners + toolbar (522–528)

- **Render location:** `error` / `jobSummaryLedgerError` banners, then `<JobSummaryLedgerToolbar view search={jobSummarySearch} setSearch={setJobSummarySearch} showMoney={showTeamLaborAndProfit} canEditOverheadDials />`, then the load-bearing comment at 528 (quirk 1).
- **Extraction status:** toolbar extracted; the mount stays in the shell.

### Alternate-view switch (529–639)

- **Render location:** a ternary chain on `view.prefs.view` — `timeline` → `JobSummaryTimelineView` (530–545), `rework` (547–557), `ahead` (559–568), `capacity` (570), `scatter` (572–586), `cycle` (588–604), `months` (606–618), `days` (620–639); anything else falls through to the gates and the table.
- **Inline logic:** per-render `new Map(...)` builds — `statusByJob` from `jobSummaryLedgerAllJobs` (×2), `userNameById` from `users` (×3), `jobLabelById` (Days, via `effectiveJobLedgerNumber`); three identical `onOpenJob(jobNumber)` closures (Rework, Scatter, Cycle) that call `setJobSummarySearch(jobNumber)` then `view.setPrefs({ view: 'jobs', status: 'all' })`; `compareLabel` string from `view.prefs.compareTo` (×2); `view.setPrefs` setters for per-view chart options.
- **Props consumed:** `view`, `users`, `canOpenSessionNotes`, `jobSummaryLedgerAllJobs`, `setJobSummarySearch`, `showTeamLaborAndProfit`.
- **Extraction status + risk + approach:** views extracted; the switch is inline, **low risk** → `src/components/jobs/JobSummaryAltView.tsx` rendering the chosen view; the tab keeps one `view.prefs.view !== 'jobs'` test to mount it, else the gates + table (a parent cannot observe a child returning `null`). Pure prop threading; dedups the three `onOpenJob` closures and the `userNameById` maps. Keep the "no hooks" property (quirk 17) unless adding a memo is a deliberate decision.

### Load / empty gates (640–663)

- **Inline logic:** the gate `tallyPartsLoading || laborJobsLoading || (jobSummaryLedgerJobs === null && jobSummaryLedgerLoading)` (quirk 1); "No billing jobs yet" when `jobSummaryData` is empty; when `view.rows` is empty, the v2.3178 message naming `view.hiddenByStatus` with a **show all statuses** button (`view.setPrefs({ status: 'all' })`), else the generic no-match copy.
- **Extraction status:** stays in the tab shell.

### Cut-by panel + table head (665–692)

- **Render location:** `<JobSummaryCutByPanel groups concentration targetTrueMarginPct showMoney cutLabel />` (label from `JOB_SUMMARY_CUT_OPTIONS`), the scroll wrapper, `<table>`, and the `<thead>` of 15 `JobSummarySortHeader`s (titles from `PROFIT_FIGURE_LABELS` and `JOB_OVERHEAD_METHODS`).
- **Extraction status:** components extracted; the `<thead>` stays with the table (quirk 20: Burn and Proj. margin share `sortKey="projMargin"`).

### Group + main rows (694–892)

- **Render location:** `(view.groups.length > 0 ? view.groups : [{ key: '__all', … }]).flatMap(group => [<JobSummaryGroupRow …/>?, ...group.rows.flatMap(enriched => …)])`.
- **Per-row derived values (shared by 2+ expanded sections):** destructure of 14 `JobSummaryRow` fields (701–716); `expanded`; `mileageCost = driveMileageCost ?? 0.7` / `timePerMile = driveTimePerMile ?? 0.02` (718–719); `jobSummaryDetailClockSessions` / `…Loaded` (720–721); `breakdownPersonQ` (722); `teamBreakdownFiltered` (723–730; `{ b, i }` pairs preserving the unfiltered index); `subLaborJobsFiltered` (731–733); the **`toggle`** closure (734–754; adds/removes `job.id`, on collapse prunes person keys by prefix and deletes the job's person-search entry).
- **Main-row cells (755–891):** `<tr id={jobSummaryRowDomId(job.id)} role="button">` (quirk 19); `JobSummaryJobCell` with write-down / discount chips (money-gated) and a collections chip; Revenue with the earned tooltip (contract × % × window hours ÷ lifetime hours) and "earned ½?" tag; Labor (money-gated); Subs; Parts + `costLines` tag slices; Gross / Margin / Overhead / True profit / True % (money-gated; under-target red via `jobSummaryRowUnderTarget`); Hours · days (`…` while the ledger loads, amber `+` when `priorHours > 0`); **Burn + Proj. margin IIFE** (849–876: `burnText`, footing glyph, `burnProjectedMarginForSort`, `pmUnder` red flag); $/hr; `%` via `formatJobSummaryPercentComplete(enriched.pct)` + `PercentProvenanceChip` dated from `jobSummaryReportDateByJobId` (v2.3441) falling back to `latestReportPercent(jobSummaryReportsByJobId…)`.
- **Extraction status + risk + approach:** stays as the tab body — this IS the component after the sections leave. **Low-med risk**: `toggle` writes three parent states; keep it here. Optional later: a `JobSummaryLedgerMainRow` for the 15 cells. Stage A first: the Burn IIFE → a tested label kernel.

### Expanded header + print + chart (898–964)

- **Render location:** top of the detail row (`<td colSpan={15}>` at 896): `<JobSummaryExpandedHeader job stat={jobThreadStatsByJobId[job.id]} onOpenJobDetail onOpenEditJob />`, "Cost breakdown" + **Print / Save as PDF** button, then `<JobSummaryChargesTimelineChart row mercuryRows invoiceLines reports canAccessBankingForParts teamLaborIncluded={showTeamLaborAndProfit} mileageCost timePerMile overheadDays />` (`overheadDays = enriched.overheadLines` only when money is shown and the method is `day`).
- **Inline closures:** the print button's async onClick (918–940) — `setPrintCostBreakdownJobId(job.id)` (busy/disabled, `aria-busy`), awaits `printJobSummaryCostBreakdown({ job, teamLaborRow ?? null, teamLaborCost, subLaborJobs, partsFromTally, billedMaterialsSum, invoicesFromSupplyHouses, cardCharges, totalBill, profit, tallyPartsForJob, mileageCost, timePerMile })`, clears in `finally`.
- **Props consumed:** `jobThreadStatsByJobId`, `onOpenJobDetail`, `onOpenEditJob`, `printCostBreakdownJobId`, `setPrintCostBreakdownJobId`, `printJobSummaryCostBreakdown`, `jobSummaryMercuryAllocationsByJobId`, `jobSummaryInvoiceLinesByJobId`, `jobSummaryReportsByJobId`, `canAccessBankingForParts`, `showTeamLaborAndProfit`, `view.prefs.method`.
- **Extraction status:** **low risk**; becomes the top block of an eventual `JobSummaryExpandedRow`. The parent binds `onOpenJobDetail` / `onOpenEditJob` with `loadJobSummaryLedger()` refresh callbacks (Jobs.tsx 2143–2146) — the prop seam already hides that.

### Overhead — the math (965–1041)

- **Render location:** a `<details onClick={stopPropagation}>` shown when `showTeamLaborAndProfit && enriched.overheadUsd != null`; summary "Overhead — the math: $X by <method label> over N days · M open days → true profit $Y".
- **Inline logic:** for `method === 'day'` a day table over `enriched.overheadLines` (Day · Job h · Of field h · Landed that day / Day's pool · By hours + Carry when `overheadCarryUsd > 0` · Share); for methods A / B / C a one-line formula sentence from `view.ledger.rates.methodA/B/C` (1024–1028); a footnote describing the pool, smoothing window, carry share and idle cap from `view.overhead.settings`, and uncharged `priorHours`.
- **Props consumed:** `showTeamLaborAndProfit`, `view` (prefs.method, overhead.settings, ledger.rates); row value `enriched`; shell-derived `overheadMethodLabel` (893).
- **Extraction status + risk + approach:** inline, **low risk** → `src/components/jobs/JobSummaryOverheadMath.tsx` (`{ enriched, method, methodLabel, settings, rates }`). Numbers all come from tested kernels; only the formula sentences are untested copy.

### Person summary section (1042–2221) — the big one

- **Render location:** the IIFE starting `const teamBreakdownLite = (teamLaborRow?.breakdown ?? []).map(...)` through `</section>`; a 7-column table **Name | Hours | Team Cost | Card charges | Supply houses | Total | % of total** (the last column v2.3181, `shareOfTotalLabel(rowSum, personSummaryFooterRowTotal)`).
- **Sub-blocks:** derivations 1043–1105 · empty states + `<thead>` 1106–1183 · person rows `filtered.map` 1184–1509 · Unassigned row 1510–1725 · Total footer row 1726–2205 · card-mismatch warning 2208–2216.
- **Derived (inline, per render):** `teamBreakdownLite`; `needMercury = !jobSummaryPartsCostIsZero(cardCharges)`; `cardColLoading`; `tallyRollup: TallyLineForPersonRollup[]`; `mRows`; `buildPartsPerPersonCostRows(...)` → `ppRows` / `ppPersonFooter` (skipped while `cardColLoading`); `buildJobSummaryPersonSummaryRows({ teamBreakdown, ppRows })`; `partitionUnattributedFromJobSummaryPersonRows` → `{ rows: personRowsForTable, unattributedCard }`; `filtered`; footer math `sumTeamF` / `sumCardF` / `personSummaryFooterTeam` / `personSummaryFooterCard` / `personSummaryFooterRowTotal` (1084–1100) — **recomputed** in the footer IIFE as `teamFooterAmt` / `cardFooterAmt` (1727–1729); flags `hasAnyPerson` / `noRowsAfterFilter` / `hasUnassignedRowContent`. Person-row Total is `rowSum = r.teamLabor + r.card` (supply is job-level, shown only in Unassigned and the footer).
- **Drilldown openers (14 closures, each ending in `setJobSummaryCostDrilldown({ title, body })`):**
  - Person row (5): `openName` (1195), `openHours` (1234) / `openTeam` (1253) (both `JobSummaryDrilldownTeamLaborByWorkDate` off `laborEntry` matched by `normalizePersonNameKey`), `openCard` (1274; fires `loadJobSummaryMercuryAllocationsForJob` then `JobSummaryDrilldownMercuryTable` over `filterJobSummaryMercuryRowsForPersonName(mRows, r.displayName)`, with `onReassignJob` → `handleJobSummaryMercuryReassignFromDrilldown(txId, job.id)` when `canAccessBankingForParts`), `openLineTotal` (1297).
  - Unassigned row (3, when `hasUnassignedRowContent`): `openUnassignedCard` (1513; `filterJobSummaryMercuryRowsUnattributed`), `openUnassignedSupply` (1536; fires `loadJobSummaryInvoiceLinesForJob` then the supply-table render fn), `openUnassignedTotal` (1548).
  - Total footer row (6): `openTotalRowLabel` (1736), `openFooterHours` (1756), `openFooterTeam` (1814), `openFooterCard` (1900; `mRowsForFooterCard`), `openFooterSupply` (1937), `openFooterGrand` (1957).
  - Uniform gating: cells are buttons only when non-zero / not loading (`jobSummaryPartsCostIsZero`, `cardColLoading`), class from `jobSummaryBreakdownInteractiveClass`, keyboard via `jobSummaryDrilldownCellKeyboard`, every onClick `e.stopPropagation()`.
- **Footer warning:** amber "Per-person card totals may not match…" when `ppPersonFooter != null`, `!cardColLoading`, `cardCharges` is non-zero, `Math.abs((sumCardF ?? 0) + unattributedCard − cardCharges) > 0.02` and no filter is active (2208–2216).
- **Props consumed:** `setJobSummaryCostDrilldown`, `loadJobSummaryMercuryAllocationsForJob`, `loadJobSummaryInvoiceLinesForJob`, `handleJobSummaryMercuryReassignFromDrilldown`, `canAccessBankingForParts`, `nicknameByDebitCard`, `jobSummaryMercuryAllocationsByJobId`, `jobSummaryInvoiceLinesByJobId`; row fields `teamLaborRow`, `teamLaborCost`, `cardCharges`, `invoicesFromSupplyHouses`, `billedMaterialsSum`, `tallyPartsForJob`; shell-derived `breakdownPersonQ`.
- **Supabase:** indirect only (the two lazy loaders + reassign flow).
- **Extraction status + risk + approach:** Inline, **medium risk, highest value** (36% of the file). Extract to `src/components/jobs/JobSummaryPersonSummarySection.tsx`; the 480-line footer row is big enough to be its own `JobSummaryPersonSummaryFooterRow` inside the same PR. Risk is transcription volume (14 openers), not coupling. Preconditions: the supply-table component, and the Stage-A footer kernel (money math, untested, computed twice). Resolving the dead person filter first (quirk 5) removes a filter branch from almost every block.

### Team section (2223–2629)

- **Render location:** first `<section><details>` in the sections grid (2222), summary **`Team $<total>`** (renamed from "Team Labor", v2.3012); body = Person | Hours table with per-person expandable work-date / punch sub-tables, a Total row (`teamLaborRow.manHours`), then the orphan-sessions amber box; fallbacks "No team labor for this job." / "(no per-person breakdown)".
- **Inline logic / closures:** per person over `teamBreakdownFiltered`: `personKey = \`${job.id}::${i}\``, `personExpanded`, `togglePerson` (2269–2276); `sessionsForPerson` by `normalizePersonNameKey(s.users?.name)`; the sub-table via `buildJobSummaryTeamLaborWorkDateTableRows(b.byWorkDate, sessionsForPerson)` interleaving `alloc` and `punch` rows, `isJobSummaryNoWorkDateKey`, `allocTableTotals` reduce (2355–2364), "Loading clock sessions…" while `!jobSummaryDetailClockLoaded`; the **orphan block** (2559–2619) — sessions whose normalized name matches no breakdown name (or is empty), then filtered by `breakdownPersonQ`.
- **Props consumed:** `jobSummaryTeamLaborPersonExpandedKeys` + setter; shell-derived `jobSummaryDetailClockSessions` / `…Loaded`, `teamBreakdownFiltered`, `breakdownPersonQ`; row fields `teamLaborRow`, `teamLaborCost`.
- **Supabase:** indirect — the parent loads clock sessions only for jobs that have at least one person row expanded (Jobs.tsx 1358–1366), so the orphan box and punch rows appear only after a person is expanded.
- **Extraction status + risk + approach:** Inline, **medium risk** → `src/components/jobs/JobSummaryTeamSection.tsx`. The person-expand Set + setter stay parent-owned and thread through. Preserve the index key scheme and the `formatCurrency(b.hours)` hours display (quirks 3, 4). Stage A: orphan partition → pure fn.

### Sub Labor section (2630–2674)

- **Render location:** second `<details>`, summary `Sub Labor $<total>`; `<ul>` of `subLaborJobsFiltered`: `assigned_to_name · job_date: $<laborJobSubCost(lj, mileageCost, timePerMile)>`; empty states.
- **Props consumed:** row fields `subLaborCost`, `subLaborJobs`; shell-derived `subLaborJobsFiltered`, `breakdownPersonQ`, `mileageCost`, `timePerMile`.
- **Extraction status:** **trivial** — rides along with Parts Cost.

### Parts Cost section (2675–3119)

- **Render location:** third `<details>`, summary `Parts Cost $<total>` + `costLines` tag slices; body is a column of blocks, each a flat bold row when its amount is zero (`jobSummaryPartsCostIsZero`) or a `<details>` otherwise:
  1. **Parts from Tally** (2700–2759) — table over `tallyPartsForJob` with inline `lineCost` (fixture rows `fixture_cost × quantity`, part rows `price_at_time × quantity`) and `label` (2732–2739).
  2. **Other job charges** (2760–2816) — `job.materials` sorted by `sequence_order`.
  3. **Invoices from Supply Houses** (2817–2851) — **lazy**: `onToggle` (open only) fires `loadJobSummaryInvoiceLinesForJob(job.id)`; body = the supply-table render fn.
  4. **Card charges** (2852–2947) — **lazy**: `onToggle` fires `loadJobSummaryMercuryAllocationsForJob(job.id)`; body = an inline mercury table (Posted | Counterparty | User | Debit Card | Allocated | Note); Allocated is signed since v2.3519 (`cardChargeCostUsd(row.amount)`, `−$` prefix + "refund" tag). Near-duplicate of `JobSummaryDrilldownMercuryTable` minus Actions (quirk 7).
  5. **Cost by person (tally & card)** (2948–3114) — shown when tally or card is non-zero; `onToggle` lazily loads mercury; **rebuilds** `tallyRollup` and calls `buildPartsPerPersonCostRows` a second time (2995; quirk 6); Person | Parts from Tally | Card charges | Row total with `ppFooter`, the "Job-level (not in table above)" footnote and the `!ppSumsOk` amber warning.
- **Props consumed:** row fields `partsCost`, `costLines`, `partsFromTally`, `billedMaterialsSum`, `invoicesFromSupplyHouses`, `cardCharges`, `tallyPartsForJob`, `job.materials`; caches `jobSummaryInvoiceLinesByJobId`, `jobSummaryMercuryAllocationsByJobId`; both lazy loaders; `nicknameByDebitCard`; shell-derived `breakdownPersonQ`.
- **Extraction status + risk + approach:** Inline, **medium risk** → `src/components/jobs/JobSummaryPartsCostSection.tsx` (fold Sub Labor + Total Bill in). Stage A first: replace the inline `lineCost` with the existing tested `tallyLineTotal` from `partsPerPersonCostSummary.ts` and add a `tallyLineLabel` beside it.

### Total Bill section (3120–3146)

- **Render location:** fourth `<details>`, summary `Total Bill $<total>`; body "Revenue (billing): $…".
- **Extraction status:** **trivial** — rides along.

### Totals footer + earned note (3156–3190)

- **Render location:** `<tfoot>` with 15 cells from `view.totals` (jobs count, revenue, labor, subs, parts, gross, margin, hours, overhead, true profit, true %, burning-jobs count, projected true margin, $/hr, blank) — money cells gated by `showTeamLaborAndProfit`; then the `*` earned-revenue footnote when `view.totals.earnedRows > 0` (v2.3575).
- **Extraction status:** stays in the shell with the table.

### HCP floor footer (3194–3273)

- **Render location:** after the table: "Hide older imported jobs with HCP # at or below [n]", the `jobSummaryFloorFooter({ shown, hidden, floor })` sentence (`src/lib/jobSummaryFooterCopy.ts`, v2.2914) with a **show all** button (floor → −1), and the help copy. The hidden count is `jobSummaryHiddenByMinHcp` from `useJobSummaryData` (server-side floor drop + any client-side raise).
- **Inline logic:** input onChange guard (3224–3229) — rejects `''` / NaN / `< -1`, then `setJobSummaryMinHcpExclusive(v)` **and** `writeJobSummaryMinHcpExclusiveToStorage(v)` (localStorage `jobs_jobSummary_minHcpExclusive`); the show-all button writes −1 to both (3250–3253). These are the file's only side effects.
- **Props consumed:** `jobSummaryMinHcpExclusive`, `setJobSummaryMinHcpExclusive`, `jobSummaryLedgerJobs`, `jobSummaryLedgerAllJobs`, `jobSummaryHiddenByMinHcp`.
- **Extraction status:** stays in the tab shell (tab-level scope control).

---

## Props inventory by region

The 44 declared props partition cleanly — the evidence the JSX partition is safe:

| Prop group | Props | Consumed by |
|---|---|---|
| Ledger view | `view` | toolbar, alternate-view switch, gates, cut-by, `<thead>`, group + main rows, chart (`overheadDays`), overhead math, `<tfoot>` |
| Session-notes door | `canOpenSessionNotes`, `users` | Timeline + Days views (`users` also → `userNameById` for Rework / Scatter / Cycle) |
| Ledger / scope | `error`, `jobSummaryLedgerError`, `jobSummaryLedgerLoading`, `jobSummaryLedgerJobs`, `jobSummaryLedgerAllJobs`, `jobSummaryHiddenByMinHcp`, `jobSummaryMinHcpExclusive` + setter, `jobSummaryData`, `jobSummarySearch` + setter, `tallyPartsLoading`, `laborJobsLoading` | banners, toolbar, alternate-view switch (`…AllJobs`, `setJobSummarySearch`), gates, HCP footer |
| Expansion state | `expandedJobSummaryJobIds` + setter, `jobSummaryTeamLaborPersonExpandedKeys` + setter, `jobSummaryBreakdownPersonSearchByJobId` + setter | shell (`toggle`) + Team (person keys); person-search map is only read (`breakdownPersonQ`) and pruned by `toggle`; nothing ever adds a value |
| Lazy caches | `jobSummaryClockSessionsByJobId`, `jobSummaryInvoiceLinesByJobId`, `jobSummaryMercuryAllocationsByJobId`, `jobSummaryReportsByJobId`, `jobSummaryReportDateByJobId`, `jobSummaryReportPctByJobId` (**unused here**) | Team / Parts Cost / Person summary / chart / main-row % chip |
| Loaders | `loadJobSummaryInvoiceLinesForJob`, `loadJobSummaryMercuryAllocationsForJob` | Person summary + Parts Cost (lazy `onToggle` and pre-drilldown) |
| Drilldown seam | `setJobSummaryCostDrilldown`, `handleJobSummaryMercuryReassignFromDrilldown`, `canAccessBankingForParts`, `nicknameByDebitCard` | Person summary (+ Parts Cost card table nicknames; chart reads `canAccessBankingForParts`) |
| Row header | `jobThreadStatsByJobId`, `onOpenJobDetail`, `onOpenEditJob` | expanded header |
| Print | `printCostBreakdownJobId` + setter, `printJobSummaryCostBreakdown` | print button |
| Display gates | `showTeamLaborAndProfit`, `canEditOverheadDials`, `driveMileageCost`, `driveTimePerMile` | toolbar, views (`showMoney`), main row, chart, overhead math, Sub Labor, print args, `<tfoot>` |

---

## Stage-A candidates (pure logic still inline → `src/lib/*` + tests)

| Candidate | Currently | Target |
|---|---|---|
| Person-summary footer math (`sumTeamF` / `sumCardF` / `personSummaryFooterTeam` / `…Card` / `…RowTotal`, 1084–1100; recomputed as `teamFooterAmt` / `cardFooterAmt` 1727–1729) | inline, twice, **untested money math** | `computeJobSummaryPersonFooter({ filtered, teamLaborCost, cardCharges, invoicesFromSupplyHouses, cardColLoading, filterActive })` in `lib/jobSummaryPersonSummaryTable.ts` + tests; both sites read it |
| Card-mismatch tolerance check (2208–2212) | inline `Math.abs(...) > 0.02` | ride along with the footer kernel, which then also takes `unattributedCard` and `hasPpFooter` (note: `partsPerPersonCostSummary`'s `sumsOk` uses `< 0.01`, not this `> 0.02` — keep each as-is) |
| Tally line cost + label (2732–2739) | inline; the same formula is re-spelled in Jobs.tsx:1483, `jobsDocuments/jobSummaryCostBreakdown.ts:340`, `jobChargesTimeline.ts:155`, `JobsPartsTab.tsx:266`, `PeopleReviewTab.tsx:1154/1926`, `fetchOverheadOfficePartsByDay.ts:217/353` | adopt the existing, tested `tallyLineTotal` (`partsPerPersonCostSummary.ts:27`) here; add `tallyLineLabel` beside it + test. Other sites belong to their own maps |
| Burn / Proj. margin cell (849–876) | inline IIFE: `burnText`, footing glyph, `pmUnder` red flag | `jobSummaryBurnCell({ burn, pct, showMoney, targetTrueMarginPct, budgetGlyph })` in `lib/jobs/jobSummaryBurn.ts` + tests |
| `latestThreadActivity(stat)` (93–113) | in-file pure fn; 3 copies (+ `JobsStagesActivityBox.tsx` ~121, `JobsStagesCardList.tsx` ~361) | `lib/jobThreadLatestActivity.ts` + tests; adopt here first |
| Orphan clock-session partition (2563–2575) | inline filter chain | pure fn beside `jobSummaryTeamLaborWorkDateTable.ts` + test |
| `allocTableTotals` reduce (2355–2364) | inline | `sumAllocRows(rows)` in `jobSummaryTeamLaborWorkDateTable.ts` — trivial, optional |
| Overhead formula sentences (1024–1028) | inline template strings over `view.ledger.rates` | `overheadMethodFormula(method, enriched, rates)` beside `JOB_OVERHEAD_METHODS` — tiny, optional |

Already done (do not redo): person-summary row building, work-date / punch interleave, parts-per-person rollup + `tallyLineTotal`, % complete resolution + provenance, HCP filter + storage + footer copy, mercury person / unattributed filters, sub-labor cost, card-charge cost sign, debit-card id parse / format, share of total, ledger enrich / **search** (`jobSummaryRowMatchesSearch`) / filter / sort / group / totals, burn projection, field / bill strip, row DOM id, print HTML builder, `domTableToCsv` (drilldown modal export).

## Test coverage

| Kernel / component read here | Test file (it/test count) | Region |
|---|---|---|
| `jobs/jobSummaryLedgerView.ts` (934 lines) | `jobSummaryLedgerView.test.ts` (27) | main rows, gates, `<tfoot>`, search |
| `jobSummaryPercentComplete.ts` / `jobPercentProvenance.ts` | 34 / 23 | main-row % + chip |
| `jobs/jobSummaryBurn.ts` | 9 | Burn cell (projection only) |
| `jobs/profitLabels.ts` · `jobs/moneyStoryDoor.ts` · `ledgerDisplayPrefixes.ts` | 8 · 8 · 9 | headers, row id, Job cell |
| `jobs/stagesScheduleStrip.ts` · `stagesJobReferenceDates.ts` · `jobScheduleChicago.ts` | 24 · 11 · 8 | expanded header |
| `jobChargesTimeline.ts` (chart kernel) · `jobsDocuments/jobSummaryCostBreakdown.ts` | 53 · 5 | chart, print |
| `jobs/overheadAllocation.ts` · `jobs/jobDayLedger.ts` | 22 · 10 | overhead math (numbers) |
| `jobSummaryPersonSummaryTable.ts` · `partsPerPersonCostSummary.ts` · `jobs/jobSummaryShareOfTotal.ts` | 9 · 4 · 3 | person summary, Cost by person |
| `jobs/jobFormatting.ts` (incl. `jobSummaryPartsCostIsZero`, `personMatchesJobSummaryBreakdownFilter`) | 32 | every section |
| `jobSummaryTeamLaborWorkDateTable.ts` · `formatDecimalWorkHoursHhMm.ts` | 3 · 4 | Team, drilldowns |
| `jobs/subLaborCost.ts` · `jobs/cardChargeAllocationFilter.ts` (shims) | 5 · 5 | Sub Labor, Card charges |
| `jobSummaryHcpFilter.ts` · `jobSummaryFooterCopy.ts` · `supplyHouseWebsite.ts` | 4 · 5 · 9 | HCP footer, supply table |
| `jobSummaryDrilldownMercuryFilter.ts` (34 lines) · `mercuryRawDebitCard` · `personNameKey.ts` | **none** (debit-card parse only mocked in two unrelated tests) | person summary drilldowns, card tables |
| `JobSummaryJobCell` · `JobSummaryDaysView` · `JobSummaryTileMoney` · `AmountSmallCents` | render smokes (2 · 2 · 2 · 3) | Job cell, Days view, toolbar |
| `JobsJobSummaryTab.tsx` itself | **none** (e2e `jobs-tabs.spec.ts` marker only) | — |

**Risk flags (untested money math):** the person-summary footer totals (two copies), the card-mismatch check, the inline tally `lineCost`, the Unassigned total `unattributedCard + Number(invoicesFromSupplyHouses ?? 0)`, the Burn `pmUnder` red flag, and the mercury filters that decide which card charges each person's drilldown shows.

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during moves)

1. **Loading gate ignores `jobsListLoading`** (comment at 528) — Job Summary has its own ledger; gating on the shared list deadlocks when this tab is opened first. The gate is reached only in `jobs` mode; the eight alternate views render before it and handle loading from the `view` bundle themselves (seven take `view.ledgerLoading`; Ahead takes none).
2. **Drilldown bodies are snapshots.** `setJobSummaryCostDrilldown` stores ReactNode built from render-time values; an open modal does not update when caches refresh. `openCard` / `openLineTotal` / `openUnassigned*` / `openFooterCard` / `openFooterSupply` / `openFooterGrand` fire the lazy loader *before* building the body (`openFooterHours` / `openFooterTeam` / `openTotalRowLabel` fire none). The card openers return early while `cardColLoading`, but a cold invoice cache freezes the supply render fn's "Loading…" into the body — current behavior, keep it.
3. **Team person keys are index-based**: `${job.id}::${i}` where `i` indexes the **unfiltered** `teamLaborRow.breakdown` (preserved via `.map((b, i) => ({ b, i }))` before filtering). Collapsing the row prunes by `${job.id}::` prefix, and the parent's clock-session effect (Jobs.tsx 1358–1366) keys on the same prefix. Keep the scheme.
4. **Hours display inconsistency is intentional-ish**: the Team section renders hours with `formatCurrency(...)` (2319, 2427, 2514, 2554), while the person summary table and drilldowns use `formatDecimalWorkHoursToHhMm`. Preserve both.
5. **The person filter is dead but wired.** `jobSummaryBreakdownPersonSearchByJobId` has no writer that adds a value (no input in the tab or Jobs.tsx; `toggle` only deletes), so `breakdownPersonQ` is always `''`: the filtered-footer sums, "No people match your search.", "Totals include everyone; table rows are filtered.", the orphan filter and `mRowsForFooterCard`'s filtered branch never run. The semantics they encode (footer Team / Card sum visible rows; Hours and Supply stay full-job; explainer copy in `openTotalRowLabel` / `openFooterHours`) are kept verbatim during moves; deleting the state + branches, or restoring an input, is its own decision (see order step 1).
6. **`buildPartsPerPersonCostRows` runs twice per expanded row** (1065 in the person summary, 2995 in Cost by person), each with its own `tallyRollup`. Both skip under the same condition (card total non-zero, mercury not loaded — the second renders "Loading…", 2986–2990). Dedup is a later refactor.
7. **The Card-charges inline table duplicates `JobSummaryDrilldownMercuryTable`** minus the Actions / Reassign column, and signs refunds its own way (`cardChargeCostUsd` + `AmountSmallCents prefix` + "refund" tag vs the drilldown's `CardChargeCostAmount`). Folding them changes who sees reassign — not a decomposition change.
8. **Raw hex** `#6b7280` (card-column loading grey) is an in-file literal at 3 sites (1433, 1600, 2102); carry it verbatim so extractions don't trip the theme sweep. (The old `#b91c1c` negative-profit literal is gone — cells use `var(--text-red-700)`.)
9. **Two different tolerances**: the person-summary card-mismatch warning fires at `> 0.02` (2211); Cost by person's `!ppSumsOk` warning uses `partsPerPersonCostSummary`'s `< 0.01` checks. Do not unify them during a move.
10. **`e.stopPropagation()` discipline**: every drilldown cell, `<summary>`, header button, the Overhead `<details>` (966) and the Team person rows stop propagation so clicks never toggle the job row; `jobSummaryDrilldownCellKeyboard` handles Enter/Space with `preventDefault`. Non-interactive cells get `tabIndex={-1}` and no role.
11. **Zero-amount blocks flatten**: each Parts Cost sub-block renders a flat bold row instead of a `<details>` when its amount is zero, so lazy loaders never fire for empty sections.
12. **HCP input guard** silently ignores empty / NaN / `< -1`; valid changes (and show all → −1) write **both** parent state and localStorage synchronously.
13. **`mileageCost ?? 0.7` / `timePerMile ?? 0.02`** fallbacks are applied per row here (718–719) and again in the parent memo — keep the values aligned.
14. **`showTeamLaborAndProfit`** gates Labor, Gross, Margin, Overhead, True profit, True %, Burn, Proj. margin, the write-down / discount chips, the `<tfoot>` money cells, the Overhead math `<details>`, the chart's `teamLaborIncluded` / `overheadDays`, and `showMoney` on every view — but the Person summary and Team sections still show team-labor dollars from `teamLaborRow`, which arrives wage-less for non-privileged viewers upstream (`utils/teamLabor.ts`). Do not add client-side masking during a move.
15. **`Number(invoicesFromSupplyHouses ?? 0)`** defensive coercions in the Unassigned / footer totals — keep them (typed `number`, load-bearing against legacy nulls).
16. **`onOpenJob` crosses owners**: Rework / Scatter / Cycle jump back to the table by writing the parent's `jobSummarySearch` *and* the view hook's prefs (`view: 'jobs', status: 'all'`); keep both writes together.
17. **The tab has zero hooks**, so the alternate-view switch rebuilds `new Map(...)` lookups every render (`statusByJob` ×2, `userNameById` ×3, `jobLabelById`). Adding `useMemo` in an extracted component is fine but a deliberate change, not part of the move.
18. **`Revenue*` and the footnote travel together**: both key off `view.totals.earnedRows > 0`.
19. **`id={jobSummaryRowDomId(job.id)}` on the main row** is the money-story door's scroll target (Jobs.tsx 1283–1303).
20. **Burn and Proj. margin share `sortKey="projMargin"`** (682–683) — both headers sort by projected margin.
21. **`colSpan={15}`** on the detail row must track the 15 `JobSummarySortHeader`s and the 15 `<tfoot>` cells.

---

## Recommended extraction order (value ÷ risk)

All Stage-B targets are sibling files in `src/components/jobs/`; the tab keeps its props type and public API unchanged throughout (Jobs.tsx is untouched except by step 1's cleanup option).

1. **Decide the dead person filter** (quirk 5) — delete `jobSummaryBreakdownPersonSearchByJobId` + every `breakdownPersonQ` branch (behavior-neutral today; touches Jobs.tsx props) or restore an input. Deleting first thins every later transcription.
2. **Stage A sweep** — the table above; in priority order: the person-footer kernel (untested money, two copies), `tallyLineTotal` adoption, the Burn-cell kernel, `latestThreadActivity`, orphan partition; plus tests for `jobSummaryDrilldownMercuryFilter.ts`. Each independently shippable.
3. **Alternate-view switch → `JobSummaryAltView`** (111 lines) — pure prop threading over already-extracted views; the new momentum-builder.
4. **`JobSummaryExpandedHeader` → own file** (with `latestThreadActivity`) — verbatim module-component move.
5. **`renderJobSummarySupplyHouseInvoiceTableContent` → `JobSummarySupplyHouseInvoiceTable`** — must precede steps 7 and 9 (5 call sites across two regions).
6. **Overhead math → `JobSummaryOverheadMath`** (77 lines) — self-contained, reads only `enriched` + `view` slices.
7. **Parts Cost (+ Sub Labor + Total Bill) → `JobSummaryPartsCostSection`** — two lazy `onToggle` loaders thread straight through.
8. **Team → `JobSummaryTeamSection`** — threads the person-expand Set + setter (parent-owned) and the clock-session slice.
9. **Person summary → `JobSummaryPersonSummarySection`** (+ `…FooterRow`) — the 1,180-line prize with 14 openers; last of the sections, after its footer kernel.
10. **(Optional) `JobSummaryExpandedRow` composition and `JobSummaryLedgerMainRow`** — the detail `<tr>` becomes header + print + chart + overhead + sections; the tab shrinks to the shell (types, toolbar / view-switch mounts, gates, `<thead>`, rows + `toggle`, `<tfoot>`, HCP footer — roughly 650–750 lines).

Verification per step: `npm run typecheck && npm run lint && npm test` green; behavior-preserving only (one region per commit, per the playbook).

## What must stay in the parent

- **In `Jobs.tsx` (unchanged by this whole track):** URL handling — `?tab=`, `?jobSummaryHcp=` → `jobSummarySearch` (1401–1405), `?view=` → `useJobSummaryView({ initialView })`, and the `?job=` money-story landing effect (1283–1303); `jobSummaryCostDrilldown` state (381) + the `JobSummaryCostCellDrilldownModal` shell (2264–2270, rendered after the shared `MercuryTransactionAllocationsModal` at 2247 that the reassign action opens); `useJobSummaryData` (186) + the `jobSummaryData` P&L memo (1477–1571, a join over several hooks' outputs) + `useJobSummaryView` (1579); the thread-stats effect (472–475), the lazy-load effects keyed on `activeTab` / `expandedJobSummaryJobIds` (1358–1391) and the ledger-load effect (1393–1399); `printJobSummaryCostBreakdown` (569–703); all three expansion / search state sets (373, 375, 378) and `printCostBreakdownJobId` (370); the role derivations `showTeamLaborAndProfit` (2151), `canEditOverheadDials` (2152), `canOpenSessionNotes` (2126).
- **In the tab shell (`JobsJobSummaryTab.tsx`) after sub-decomposition:** banners + toolbar mount, the view-switch mount, the gates, cut-by + `<thead>`, group + main rows with `toggle`; per-row values shared by 2+ sections (`breakdownPersonQ` if kept, `teamBreakdownFiltered`, `subLaborJobsFiltered`, `mileageCost` / `timePerMile`, clock-session slice, `overheadMethodLabel`); `<tfoot>` + earned note; the HCP floor footer + its localStorage write; the `JobSummaryRow` / `JobsJobSummaryTabProps` contract.

## See also

- [`JOBS_TABS_ARCHITECTURE.md`](./JOBS_TABS_ARCHITECTURE.md) — the parent page's map (`job-summary` dossier: data seam v2.826, quirk #11 drilldown ReactNode).
- [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) — process, definition of done, anti-patterns.
- `docs/recent-features/` fragments (and the frozen `docs/RECENT_FEATURES.md`) — feature history for this surface: v2.396 (HCP min filter), v2.401 (Cost by person), v2.404 (per-cell drilldowns + CSV/Print), v2.660 (pay lockdown), v2.820/v2.826 (print builder + data seam), v2.2692/v2.2695 (ledger view + Days), v2.2711–v2.2831 (Timeline, Months, Cycle, Scatter, Capacity, Ahead, Rework; Cut by + $/hr v2.2820), v2.2852 (% provenance), v2.2914 (floor footer), v2.2945 (money-story door), v2.3012 (Team rename), v2.3176 (Job column), v2.3181 (% of total), v2.3191/v2.3300 (Burn + footing), v2.3259 (overhead dials), v2.3441 (dated % badge), v2.3519 (signed refunds), v2.3575 (earned revenue by hours), v2.3792 (FIELD / BILL header).
