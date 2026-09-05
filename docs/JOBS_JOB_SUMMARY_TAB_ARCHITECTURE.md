# JobsJobSummaryTab Architecture Map

---
file: docs/JOBS_JOB_SUMMARY_TAB_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 sub-decomposition map (per PAGE_DECOMPOSITION_PLAYBOOK.md) for the extracted Jobs → Job Summary tab, src/components/jobs/JobsJobSummaryTab.tsx (2,862 lines) — inventory every logical region (module helpers, ledger table, person summary, Team Labor / Sub Labor / Parts Cost sections, HCP footer), its props coupling, drilldown-opener closures, indirect supabase touches, and an extraction order. Sections: What this surface is; The shared substrate; Master summary table; Per-region dossiers; Props inventory by region; Stage-A candidates; Preserve-quirks list; Recommended extraction order; What must stay in the parent.
audience: Developers, AI Agents
last_updated: 2026-07-29
---

## What this surface is

[`src/components/jobs/JobsJobSummaryTab.tsx`](../src/components/jobs/JobsJobSummaryTab.tsx) (2,862 lines, churn ~10 commits) is the **already-extracted** Jobs → Job Summary tab (extracted from `Jobs.tsx` as step J6, PR #34; the data seam followed in v2.826). It is the per-job cost-rollup ledger: an expandable table of jobs with Team Labor / Sub Labor / Parts Cost / Total Bill / Revenue-before-Overhead / % columns, and a deep expanded-row breakdown with per-cell drilldown modals, a charges timeline chart, and a print/PDF export.

Unlike every other surface mapped so far, this one is **fully presentational**: it contains **zero** `useState`/`useEffect`/`useMemo`/`useRef` and **zero** direct supabase calls. All state, caches, loaders, and the drilldown modal shell live in the parent ([`Jobs.tsx`](../src/pages/Jobs.tsx), ~2,020 lines) and its seam hook [`useJobSummaryData`](../src/hooks/useJobSummaryData.ts), arriving as **41 props** (`JobsJobSummaryTabProps`, lines ~366–423). The 2,862 lines are one giant JSX expression: a `flatMap` over `jobSummaryData` producing a main `<tr>` plus (when expanded) a sibling detail `<tr colSpan={9}>` containing four nested regions, with ~14 per-cell drilldown-opener closures defined inline.

So this sub-decomposition is **not** the usual "hoist state out of a God component" job — it is a **JSX partition**: split the expanded-row regions into sibling presentational components in `src/components/jobs/`, threading slices of the existing props. The playbook's Stage A still applies to the handful of inline pure computations; Stage B here means "cut a JSX region + its opener closures into a new component file."

Companion components already extracted and consumed by this file:

| File | Lines | Role |
|---|---|---|
| [`JobSummaryCostCellDrilldownModal.tsx`](../src/components/jobs/JobSummaryCostCellDrilldownModal.tsx) | 337 | Modal shell (rendered by **Jobs.tsx**, not this file) + exported `JobSummaryDrilldownMercuryTable`, `JobSummaryDrilldownTeamLaborByWorkDate` (rendered inside drilldown bodies built **here**) |
| [`JobSummaryChargesTimelineChart.tsx`](../src/components/jobs/JobSummaryChargesTimelineChart.tsx) | 509 | Cost/value/profit timeline atop each expanded row |

Pure logic already in `lib/` (Stage A largely done before this map): `jobSummaryPersonSummaryTable.ts`, `jobSummaryTeamLaborWorkDateTable.ts`, `partsPerPersonCostSummary.ts`, `jobSummaryPercentComplete.ts`, `jobSummaryHcpFilter.ts`, `jobSummaryDrilldownMercuryFilter.ts`, `jobs/jobFormatting.ts`, `jobs/subLaborCost.ts`, `personNameKey.ts`, `mercuryRawDebitCard.ts`, `ledgerDisplayPrefixes.ts`, `stagesJobReferenceDates.ts`, `formatDecimalWorkHoursHhMm.ts`, and the v2.820 print builder `jobsDocuments/jobSummaryCostBreakdown.ts` (called via the parent's `printJobSummaryCostBreakdown` thunk).

**How to read a dossier.** Line numbers are "as of v2.966" and rot — search the quoted symbol/JSX comment instead. "Owned local state: none" is literal for every region (the file has no state); each dossier instead lists **props consumed** (what the region would receive when extracted) and **inline closures** (what moves with it).

---

## The ledger view seam (v2.2692)

The refresh added a FOURTH substrate layer without breaking the "tab is presentational" rule: [`useJobSummaryView`](../src/hooks/useJobSummaryView.ts) runs page-side (Jobs.tsx, right after the `jobSummaryData` memo) and hands the tab ONE `view` prop — per-device prefs (Show · Worked in · Overhead method · sort; localStorage `jobs_jobSummary_view_v1`), the **job day ledger** for the window ([`lib/jobs/loadJobDayLedger.ts`](../src/lib/jobs/loadJobDayLedger.ts) → [`lib/jobs/jobDayLedger.ts`](../src/lib/jobs/jobDayLedger.ts): overhead pool $ by day + approved field sessions by (day, job); one-hour sessionStorage cache), and the enriched/filtered/sorted rows + totals from the pure [`lib/jobs/jobSummaryLedgerView.ts`](../src/lib/jobs/jobSummaryLedgerView.ts). The tab renders `view.rows` (each `{ row: JobSummaryRow, …computed }`) instead of filtering `jobSummaryData` itself; [`JobSummaryLedgerToolbar.tsx`](../src/components/jobs/JobSummaryLedgerToolbar.tsx) owns the search box, segmented controls, totals strip, hygiene chips, and the sortable `JobSummarySortHeader`. Columns are now Revenue (earned for in-progress) · Labor · Subs · Parts · Gross · Margin · Hours · days · Overhead · True profit · True % · % (14 incl. Job #/Name/Address; the detail row's `colSpan` follows). The expanded row gained an "Overhead — the math" `<details>` (day lines for day-share; one-line formula for lenses A/B/C) between the chart and the person summary. The parts fixes (internal transfers excluded, invoice-linked card charges counted once) live in `useJobsMercuryAllocations` + the memo, not here. PR 2 (v2.2695) consumes the same `view.ledger`: [`JobSummaryDaysView.tsx`](../src/components/jobs/JobSummaryDaysView.tsx) over the pure [`lib/jobs/jobDaysConcurrency.ts`](../src/lib/jobs/jobDaysConcurrency.ts) (day rows, summary, chart series), swapped in for the table when `view.prefs.view === 'days'` (the toolbar's leading View control).

## The shared substrate

Per the playbook, name the page's `setSharedBid` / `useBidPricingEngine` equivalents. For this surface **both exist, and both live one level up**:

1. **Selection pointer(s) — parent-owned, multi-select.** There is no single "selected job" — expansion is a set: `expandedJobSummaryJobIds: Set<string>` (+ setter), with two subordinate per-row selections: `jobSummaryTeamLaborPersonExpandedKeys: Set<string>` (keys are **`${job.id}::${breakdownIndex}`** — index-based, see quirk 3) and `jobSummaryBreakdownPersonSearchByJobId: Record<string, string>`. All three are `useState` in `Jobs.tsx` and must **stay there**: the parent's expanded-row lazy-load effects (Jobs.tsx ~1151/~1160) watch `expandedJobSummaryJobIds` to call `loadJobSummaryMercuryAllocationsForJob` / `loadJobSummaryInvoiceLinesForJob` / clock-session / report loaders. Collapsing a row prunes the other two states by `${job.id}::` prefix / key delete (the `toggle` closure, lines ~550–570).

2. **The drilldown pointer — the surface's most unusual seam.** `setJobSummaryCostDrilldown: (v: { title: string; body: ReactNode } | null) => void`. The modal **shell** (`JobSummaryCostCellDrilldownModal`, with Print/Export-CSV header) renders in Jobs.tsx's modal tail (~line 2009); this tab **builds the modal body JSX at click time** inside ~14 opener closures and pushes it up as a ReactNode into parent state (quirk #11 of `JOBS_TABS_ARCHITECTURE.md` — a snapshot, not a live view). Every extracted section needs exactly this one callback to keep all drilldowns working — it is the seam that makes the partition cheap.

3. **The data engine — done (v2.826), stays put.** [`useJobSummaryData`](../src/hooks/useJobSummaryData.ts) (ledger snapshot + min-HCP filter + five lazy per-job caches/loaders) plus the page-side `jobSummaryData` P&L memo (Jobs.tsx ~1284–1349), which joins the ledger with `tallyParts`, `invoiceAmountByJob`, `job.materials`, `mercuryCardChargesByJobId` (from the later-called `useJobsMercuryAllocations`), `laborJobs` (`laborJobSubCost`), and `teamLaborData`. This component only ever *reads* the resulting `JobSummaryRow[]` and the cache Maps. **No new hook seam is needed for this sub-decomposition** — the seam already exists; extractions are prop-threading only.

**Consequence:** every region below is extractable without touching state ownership. The risk profile is about **closure surface** (how many props/row-fields each opener captures), not about shared mutable state.

### Indirect supabase touches (via parent props — named for completeness)

This file issues no queries. The props it calls resolve to:

| Prop called here | Parent implementation | Tables / RPCs |
|---|---|---|
| `loadJobSummaryInvoiceLinesForJob` | `useJobSummaryData` | RPC `get_invoice_allocation_lines_for_jobs` |
| `loadJobSummaryMercuryAllocationsForJob` | `useJobSummaryData` → `fetchMercuryJobAllocationsWithAttributionForJob` | `mercury_transaction_job_allocations` + `mercury_transactions` |
| `printJobSummaryCostBreakdown` | Jobs.tsx thunk (~line 530) → `buildJobSummaryCostBreakdownHtml` | RPC `get_invoice_allocation_lines_for_jobs` (fallback when cache cold) |
| `handleJobSummaryMercuryReassignFromDrilldown` | `useJobsMercuryAllocations` | mercury allocation modal flow (`mercury_transaction_job_allocations` etc.) |
| (data props) `jobSummaryClockSessionsByJobId`, `jobSummaryReportsByJobId`, `jobSummaryReportPctByJobId`, ledger jobs | `useJobSummaryData` | `clock_sessions`, `reports`, RPC `list_latest_report_completion_pct`, ledger via `fetchJobsLedgerWithDetailsForStages` |
| `jobThreadStatsByJobId` | `useJobThreadNotes` | job thread notes/reports stats |
| `nicknameByDebitCard` | `useMercuryLedgerNicknames` | mercury nickname table |

---

## Master summary table

| Region | Anchor (search for) | Lines est. | Coupling | Risk | Status |
|---|---|---|---|---|---|
| Module helpers + types | `latestThreadActivity` … `JobsJobSummaryTabProps` | ~423 (1–423) | low (self-contained) | low | inline (module scope) |
| Toolbar + load/empty gates | `type="search"` / `tallyPartsLoading \|\| laborJobsLoading` | ~20 (466–485) | low | low | inline — stays in tab shell |
| Ledger table shell + main rows | `<thead style={{ background: 'var(--bg-subtle)' }}>` | ~145 (486–631) | med (owns `toggle` closure pruning 3 parent states) | low-med | inline — stays in tab shell |
| Expanded header + print + chart | `<JobSummaryExpandedHeader` | ~70 (632–700) | low | low | inline; header component already module-level |
| **Person summary section** | `const teamBreakdownLite =` | ~1,174 (701–1874) | high (11 drilldown openers; both lib row-builders) | med | inline — **the big extraction** |
| Team Labor details section | `Team Labor{' '}` summary | ~407 (1876–2282) | med (person-expand keys; clock sessions; orphan box) | med | inline |
| Sub Labor section | `Sub Labor{' '}` summary | ~45 (2283–2327) | low (`laborJobSubCost`) | low | inline — rides along |
| Parts Cost section | `Parts Cost{' '}` summary | ~439 (2328–2766) | med (2 lazy `onToggle` loaders; 2nd `buildPartsPerPersonCostRows` call) | med | inline |
| Total Bill section | `Total Bill{' '}` summary | ~27 (2767–2793) | none | trivial | inline — rides along |
| HCP min-filter footer | `Only include jobs with HCP # greater than` | ~55 (2805–2859) | low (localStorage write) | low | inline — stays in tab shell |

---

## Per-region dossiers

### Module helpers + types (lines ~1–423)

- **Contents:** imports (~68 lines); pure fn `latestThreadActivity(stat)` (newest of last note vs last report — duplicates the Stages "Last activity" pick logic); style consts `expandedHeaderLabelStyle`, `jobSummaryPartsCostDetailsBoxStyle`, `jobSummaryPartsCostFlatRowStyle`, `jobSummaryCostSectionBodyStyle`; component `JobSummaryExpandedHeader({ job, stat, onOpenJobDetail, onOpenEditJob })` (~135 lines — Job Detail / Edit Job buttons, Assigned list, `Job: <effectiveJobLedgerNumber>` + service type, `j:` field-reference date via `deriveStagesFieldReferenceYmd`, `b:` billing date via `deriveStagesBillingActivityDetail`, Last activity via `latestThreadActivity` + `getDispatchNoteDisplayMeta`); helpers `jobSummaryDrilldownCellKeyboard(e, onOpen)` (Enter/Space) and `jobSummaryBreakdownInteractiveClass(interactive, variant)` (returns `.jobSummaryBreakdownInteractive` / `…Muted`); `renderJobSummarySupplyHouseInvoiceTableContent(invoiceLoaded, invoiceRows, invoicesFromSupplyHouses)` (~70 lines — the supply-house invoice line table, with portal links via `supplyHouseWebsitePortalHref` + `openInExternalBrowser`); exported type **`JobSummaryRow`** (the parent memo's row shape — also imported by Jobs.tsx and the chart) and **`JobsJobSummaryTabProps`** (41 props).
- **Owned local state:** none (module scope).
- **External coupling:** `JobSummaryRow` is the contract with the parent's `jobSummaryData` memo and with `JobSummaryChargesTimelineChart` — moving it means updating those imports. `renderJobSummarySupplyHouseInvoiceTableContent` is called from **5 sites** (Parts Cost details + 4 drilldown bodies).
- **Extraction status + risk + approach:** Inline, **low risk**. `JobSummaryExpandedHeader` (+ `latestThreadActivity` + `expandedHeaderLabelStyle`) is a verbatim file move → `src/components/jobs/JobSummaryExpandedHeader.tsx`. `renderJobSummarySupplyHouseInvoiceTableContent` → a `JobSummarySupplyHouseInvoiceTable` component file (or keep as a render fn in a shared module) — it must land **before** the section extractions since drilldown bodies in two different regions call it. `JobSummaryRow`/props types can move to `src/types/jobSummary.ts` alongside the existing row types, or stay.

### Toolbar + load/empty gates (~466–485)

- **Render location:** top of the returned JSX: `error` / `jobSummaryLedgerError` banners, the `jobSummarySearch` input (controlled by parent state; parent seeds it from `?jobSummaryHcp=`), then the loading gate.
- **Props consumed:** `error`, `jobSummaryLedgerError`, `jobSummarySearch`, `setJobSummarySearch`, `tallyPartsLoading`, `laborJobsLoading`, `jobSummaryLedgerJobs`, `jobSummaryLedgerLoading`, `jobSummaryData` (length for empty state).
- **Quirk (load-bearing comment at line ~480):** the gate is `tallyPartsLoading || laborJobsLoading || (jobSummaryLedgerJobs === null && jobSummaryLedgerLoading)` — deliberately **not** `jobsListLoading`, because Job Summary has its own ledger loader and gating on the shared jobs list would spin forever when this tab is opened first.
- **Extraction status:** stays in the tab shell. No value in extracting.

### Ledger table shell + main rows (~486–631)

- **Render location:** the `<table>` with 9 columns (**Job # | Name | Address | Team Labor | Sub Labor | Parts Cost | Total Bill | Revenue before Overhead | %**), then `jobSummaryData.filter(...).flatMap((summaryRow) => …)`.
- **Inline logic that stays with the shell:** the search predicate (case-insensitive `includes` over `hcp_number`/`job_name`/`job_address`); per-row destructure of all 13 `JobSummaryRow` fields; `mileageCost = driveMileageCost ?? 0.7` / `timePerMile = driveTimePerMile ?? 0.02` fallbacks; `breakdownPersonQ` lookup; `teamBreakdownFiltered` (maps `breakdown` to `{ b, i }` pairs **preserving original index** before filtering with `personMatchesJobSummaryBreakdownFilter`) and `subLaborJobsFiltered`; the **`toggle`** closure (adds/removes `job.id` from `expandedJobSummaryJobIds`; on collapse also prunes `jobSummaryTeamLaborPersonExpandedKeys` by `${job.id}::` prefix and deletes the job's `jobSummaryBreakdownPersonSearchByJobId` entry).
- **Main-row cells:** `effectiveJobLedgerNumber(job.hcp_number, job.click_number)`; Team Labor and Revenue-before-Overhead render `—` unless `showTeamLaborAndProfit` (v2.660 pay lockdown — parent passes `authRole === 'dev' || 'master_technician' || 'controller'`); negative profit paints literal `#b91c1c`; `%` column = `formatJobSummaryPercentComplete(enriched.pct)`, where [`jobSummaryLedgerView.ts`](../src/lib/jobs/jobSummaryLedgerView.ts) `enrichJobSummaryRows` resolves `pct`/`pctSource` via `resolveJobSummaryPercentCompleteWithSource(reportPct, job.pct_complete, jobSummaryPaidInvoiceOpts(job.invoices, contractUsd))`. The paid-invoices → 100 branch fires **only when Σ invoices covers the contract** (`paidInvoicesCoverContract`, tolerance max($1, 0.5 %)); otherwise the chain falls through to the latest report % → `pct_complete` → null. `finished = pct === 100` and the contract-vs-earned Revenue switch inherit the gated %, and so does every kernel built on the enriched rows (Months, Scatter, Cycle, Ahead, Cut-by, Compare, the `jobs-stale-open` Dashboard card). Same resolver + opts in the Quickfill "Complete, no Total Bill" list (`quickfillCompleteNoBill.ts`) and the Cost Timeline's fallback value point (`resolveJobCurrentPercentFallback`).
- **Extraction status + risk + approach:** stays as the tab's own body — this IS the component after the sections leave. **Low-med risk**: the `toggle` closure writes three parent states; keep it here. The per-row derived values (`teamBreakdownFiltered`, `subLaborJobsFiltered`, `breakdownPersonQ`, `mileageCost`/`timePerMile`) are consumed by multiple sections below — after extraction the shell computes them once and passes them down.

### Expanded header + print + chart (~632–700)

- **Render location:** top of the detail `<tr colSpan={9}>`: `<JobSummaryExpandedHeader job stat={jobThreadStatsByJobId[job.id]} onOpenJobDetail onOpenEditJob />`, the "Cost breakdown" heading + **Print / Save as PDF** button, then `<JobSummaryChargesTimelineChart row={summaryRow} mercuryRows invoiceLines reports canAccessBankingForParts mileageCost timePerMile />`.
- **Inline closures:** the print button's async onClick — sets `setPrintCostBreakdownJobId(job.id)` (busy/disabled state, `aria-busy`), awaits `printJobSummaryCostBreakdown({ job, teamLaborRow: teamLaborRow ?? null, teamLaborCost, subLaborJobs, partsFromTally, billedMaterialsSum, invoicesFromSupplyHouses, cardCharges, totalBill, profit, tallyPartsForJob, mileageCost, timePerMile })`, clears in `finally`.
- **Props consumed:** `jobThreadStatsByJobId`, `onOpenJobDetail`, `onOpenEditJob`, `printCostBreakdownJobId`, `setPrintCostBreakdownJobId`, `printJobSummaryCostBreakdown`, `jobSummaryMercuryAllocationsByJobId`, `jobSummaryInvoiceLinesByJobId`, `jobSummaryReportsByJobId`, `canAccessBankingForParts`.
- **Extraction status + risk + approach:** **low risk**; becomes the top block of an eventual `JobSummaryExpandedRow` composition (extract last), or rides with the shell. Note the parent binds `onOpenJobDetail`/`onOpenEditJob` with `onSaved: () => void loadJobSummaryLedger()` refresh callbacks — the props seam already hides that.

### Person summary section (~701–1874) — the big one

- **Render location:** the first IIFE inside the detail row, `const teamBreakdownLite = (teamLaborRow?.breakdown ?? []).map(...)` through the closing `</section>`; renders the 6-column table **Name | Hours | Team Labor Cost | Card charges | Supply houses | Total**.
- **Derived (inline, per render):** `teamBreakdownLite`; `needMercury = !jobSummaryPartsCostIsZero(cardCharges)`; `cardColLoading = needMercury && !jobSummaryMercuryAllocationsByJobId.has(job.id)`; `tallyRollup: TallyLineForPersonRollup[]` (field-picked from `tallyPartsForJob`); `mRows`; `buildPartsPerPersonCostRows({ parts, billedMaterialsSum, invoiceJobTotal, mercuryRows, parentCardTotal })` → `ppRows`/`ppPersonFooter` (skipped while `cardColLoading`); `buildJobSummaryPersonSummaryRows({ teamBreakdown, ppRows })`; `partitionUnattributedFromJobSummaryPersonRows(personRows)` → `{ rows: personRowsForTable, unattributedCard }`; `filtered` (via `personMatchesJobSummaryBreakdownFilter(r.displayName, breakdownPersonQ)`); footer math `sumTeamF`/`sumCardF`/`personSummaryFooterTeam`/`personSummaryFooterCard`/`personSummaryFooterRowTotal` (filter-aware: filtered sums when a person search is active, else job totals); flags `hasAnyPerson`/`noRowsAfterFilter`/`hasUnassignedRowContent`.
- **Drilldown openers (11 closures, all ending in `setJobSummaryCostDrilldown({ title, body })`):**
  - Per person row: `openName` (row summary), `openHours` / `openTeam` (both render `JobSummaryDrilldownTeamLaborByWorkDate` off `laborEntry` found by `normalizePersonNameKey` match), `openCard` (calls `loadJobSummaryMercuryAllocationsForJob(job.id)` then renders `JobSummaryDrilldownMercuryTable` over `subMercury = filterJobSummaryMercuryRowsForPersonName(mRows, r.displayName)`, with `onReassignJob` → `handleJobSummaryMercuryReassignFromDrilldown(txId, job.id)` when `canAccessBankingForParts`), `openLineTotal` (team+card combined).
  - Unassigned row (rendered when `hasUnassignedRowContent`): `openUnassignedCard` (`filterJobSummaryMercuryRowsUnattributed(mRows)`), `openUnassignedSupply` (calls `loadJobSummaryInvoiceLinesForJob` then `renderJobSummarySupplyHouseInvoiceTableContent`), `openUnassignedTotal` (both).
  - Total footer row: `openTotalRowLabel` (explanatory), `openFooterHours` (full-job hours table off `teamLaborRow.breakdown`), `openFooterTeam` (filter-aware), `openFooterCard` (`mRowsForFooterCard` = `filterJobSummaryMercuryRowsForPersonNames(mRows, filtered names)` when filtered), `openFooterSupply`, `openFooterGrand`.
  - Interactivity gating is uniform: cells are buttons only when non-zero/non-loading (`jobSummaryPartsCostIsZero`, `cardColLoading`), styled via `jobSummaryBreakdownInteractiveClass`, keyboard via `jobSummaryDrilldownCellKeyboard`, and every onClick does `e.stopPropagation()` so the job row doesn't toggle.
- **Footer warning:** amber note when `Math.abs((sumCardF ?? 0) + unattributedCard − cardCharges) > 0.02` and no filter is active ("Per-person card totals may not match…").
- **Props consumed:** `setJobSummaryCostDrilldown`, `loadJobSummaryMercuryAllocationsForJob`, `loadJobSummaryInvoiceLinesForJob`, `handleJobSummaryMercuryReassignFromDrilldown`, `canAccessBankingForParts`, `nicknameByDebitCard`, `jobSummaryMercuryAllocationsByJobId`, `jobSummaryInvoiceLinesByJobId`; row fields `teamLaborRow`, `teamLaborCost`, `cardCharges`, `invoicesFromSupplyHouses`, `billedMaterialsSum`, `tallyPartsForJob`; shell-derived `breakdownPersonQ`.
- **Supabase:** indirect only (the two lazy loaders + reassign flow).
- **Extraction status + risk + approach:** Inline, **medium risk, highest value** (~41% of the file). Extract to `src/components/jobs/JobSummaryPersonSummarySection.tsx` taking `{ job, row fields…, breakdownPersonQ, caches, loaders, setJobSummaryCostDrilldown, canAccessBankingForParts, nicknameByDebitCard, handleJobSummaryMercuryReassignFromDrilldown }` — everything it needs is already a prop or a per-row value; **no state moves**. Risk is transcription volume (11 openers × careful gating), not coupling. Precondition: `renderJobSummarySupplyHouseInvoiceTableContent` must be importable (extract it first). Stage A first: the footer math block → pure function (see Stage-A table).

### Team Labor details section (~1876–2282)

- **Render location:** first `<details>` in the sections grid, summary `Team Labor $<total>`; body renders the Person|Hours table with per-person expandable work-date/punch sub-tables, then the orphan-sessions amber box.
- **Inline logic/closures:** per person (iterating `teamBreakdownFiltered` — the `{ b, i }` pairs from the shell): `personKey = \`${job.id}::${i}\`` (index into the **unfiltered** breakdown, preserved by the map-then-filter), `personExpanded` from `jobSummaryTeamLaborPersonExpandedKeys`, `togglePerson` closure; `sessionsForPerson` = clock sessions matched by `normalizePersonNameKey(s.users?.name)`; the expanded sub-table via `buildJobSummaryTeamLaborWorkDateTableRows(b.byWorkDate, sessionsForPerson)` interleaving `alloc` rows (Hrs/$) and `punch` rows (In/Out/Duration via `formatJobSummarySessionTimeOnly` / `formatJobSummaryDurationMinutes`), `isJobSummaryNoWorkDateKey` for undated rows, `allocTableTotals` reduce for the tfoot, and a "Loading clock sessions…" footer while `!jobSummaryDetailClockLoaded`; finally the **orphan block** — sessions whose normalized user name matches no breakdown name (or is empty), further filtered by `breakdownPersonQ`, rendered in the amber "Sessions not matched to a name above" table.
- **Props consumed:** `jobSummaryTeamLaborPersonExpandedKeys` + setter, `jobSummaryClockSessionsByJobId` (as shell-derived `jobSummaryDetailClockSessions`/`jobSummaryDetailClockLoaded`); row fields `teamLaborRow`, `teamLaborCost`; shell-derived `teamBreakdownFiltered`, `breakdownPersonQ`.
- **Supabase:** indirect — clock sessions are loaded by the **parent's** expanded-row effect (`loadJobSummaryClockSessionsForJob`), not by anything in this section; the section just renders whatever the Map holds.
- **Extraction status + risk + approach:** Inline, **medium risk** → `src/components/jobs/JobSummaryTeamLaborSection.tsx`. The person-expand Set + setter stay parent-owned and thread through (playbook: shared selection stays up — the shell's `toggle` prunes these keys on row collapse, so the tab must keep writing the same Set instance). Preserve the index-based key scheme and the `formatCurrency(b.hours)` hours display (quirks 3, 4). Stage A: orphan-session partition → pure fn.

### Sub Labor section (~2283–2327)

- **Render location:** second `<details>`, summary `Sub Labor $<total>`; a `<ul>` of `subLaborJobsFiltered` rows: `assigned_to_name · job_date: $<laborJobSubCost(lj, mileageCost, timePerMile)>`; empty states for no-sub-labor and no-filter-match.
- **Props consumed:** row field `subLaborJobs`, shell-derived `subLaborJobsFiltered`, `breakdownPersonQ`, `mileageCost`, `timePerMile`. All calc is already in `lib/jobs/subLaborCost.ts`.
- **Extraction status:** **trivial** — rides along with whichever composition wrapper is built; not worth its own PR.

### Parts Cost section (~2328–2766)

- **Render location:** third `<details>`, summary `Parts Cost $<total>`; body is a column of four flat-row-or-`<details>` blocks (flat when the amount is zero via `jobSummaryPartsCostIsZero`) plus a fifth conditional details:
  1. **Parts from Tally** — inline table over `tallyPartsForJob` with per-line `lineCost` (fixture rows: `fixture_cost × quantity`; part rows: `price_at_time × quantity`) and `label` (`fixture_name` or `part_name · fixture_name`); fallback copy when totals exist without line rows.
  2. **Other job charges** — `job.materials` sorted by `sequence_order`, description + amount rows.
  3. **Invoices from Supply Houses** — **lazy**: `onToggle` (open only) fires `loadJobSummaryInvoiceLinesForJob(job.id)`; body = `renderJobSummarySupplyHouseInvoiceTableContent`.
  4. **Card charges** — **lazy**: `onToggle` fires `loadJobSummaryMercuryAllocationsForJob(job.id)`; body = an **inline** mercury table (Posted | Counterparty | User | Debit Card | Allocated | Note) using `formatJobSummaryMercuryPostedAt`, `mercuryDebitCardIdFromRaw(tx?.raw)` + `nicknameByDebitCard` fallback `formatMercuryDebitCardIdCompact`, `Math.abs(row.amount)`, note join `[row.note, tx?.note, tx?.external_memo]`. This is a near-duplicate of `JobSummaryDrilldownMercuryTable` **minus** the reassign Actions column — keep the duplication (behavior-preserving; see quirk 7).
  5. **Cost by person (tally & card)** — shown when tally or card is non-zero; `onToggle` lazily loads mercury when needed; **rebuilds** `tallyRollup` and calls `buildPartsPerPersonCostRows` a second time (independently of the person summary section — see quirk 6); renders Person | Parts from Tally | Card charges | Row total with `ppFooter` totals row, filter-aware via `breakdownPersonQ`, a "Job-level (not in table above)" footnote, and the `!ppSumsOk` amber warning.
- **Props consumed:** row fields `partsCost`, `partsFromTally`, `billedMaterialsSum`, `invoicesFromSupplyHouses`, `cardCharges`, `tallyPartsForJob`, `job.materials`; caches `jobSummaryInvoiceLinesByJobId`, `jobSummaryMercuryAllocationsByJobId`; loaders (both lazy ones); `nicknameByDebitCard`; shell-derived `breakdownPersonQ`.
- **Extraction status + risk + approach:** Inline, **medium risk** → `src/components/jobs/JobSummaryPartsCostSection.tsx`. Self-contained apart from the shared invoice-table render fn (extract that first). Stage A first: the tally `lineCost`/`label` derivation → `lib/jobs/tallyLineCost.ts` (the same cost formula lives in the parent's `jobSummaryData` memo and in the print builder — one shared kernel, three call sites).

### Total Bill section (~2767–2793)

- **Render location:** fourth `<details>`, summary `Total Bill $<total>`; body is one line: "Revenue (billing): $…".
- **Extraction status:** **trivial** — rides along.

### HCP min-filter footer (~2805–2859)

- **Render location:** after the table: centered box "Only include jobs with HCP # greater than [n]", the "Showing {jobSummaryLedgerJobs.length} of {jobSummaryLedgerAllJobs.length} jobs after filter." count, and the help copy ("Jobs with no HCP #… −1 to include every HCP #").
- **Inline logic:** input onChange guard — rejects `''`/NaN/`< -1`, then `setJobSummaryMinHcpExclusive(v)` **and** `writeJobSummaryMinHcpExclusiveToStorage(v)` (localStorage key `jobs_jobSummary_minHcpExclusive` — **the file's only side effect**). The filter itself (`applyMinHcpFilter`, default 500, digit-only comparison) runs inside `useJobSummaryData`.
- **Props consumed:** `jobSummaryMinHcpExclusive`, `setJobSummaryMinHcpExclusive`, `jobSummaryLedgerJobs`, `jobSummaryLedgerAllJobs`.
- **Extraction status:** stays in the tab shell (it is the tab-level scope control, analogous to page-level filters elsewhere). Low risk if ever moved.

---

## Props inventory by region

The 41 props partition cleanly — this is the evidence the JSX partition is safe:

| Prop group | Props | Consumed by |
|---|---|---|
| Ledger/scope | `error`, `jobSummaryLedgerError`, `jobSummaryLedgerLoading`, `jobSummaryLedgerJobs`, `jobSummaryLedgerAllJobs`, `jobSummaryMinHcpExclusive` + setter, `jobSummaryData`, `jobSummarySearch` + setter, `tallyPartsLoading`, `laborJobsLoading` | shell + footer only |
| Expansion state | `expandedJobSummaryJobIds` + setter, `jobSummaryTeamLaborPersonExpandedKeys` + setter, `jobSummaryBreakdownPersonSearchByJobId` + setter | shell (`toggle`) + Team Labor section (person keys) |
| Lazy caches | `jobSummaryClockSessionsByJobId`, `jobSummaryInvoiceLinesByJobId`, `jobSummaryMercuryAllocationsByJobId`, `jobSummaryReportsByJobId`, `jobSummaryReportPctByJobId` | Team Labor / Parts Cost / Person summary / chart / main-row % |
| Loaders | `loadJobSummaryInvoiceLinesForJob`, `loadJobSummaryMercuryAllocationsForJob` | Person summary + Parts Cost (lazy `onToggle` and pre-drilldown) |
| Drilldown seam | `setJobSummaryCostDrilldown`, `handleJobSummaryMercuryReassignFromDrilldown`, `canAccessBankingForParts`, `nicknameByDebitCard` | Person summary (+ Parts Cost card table uses nicknames) |
| Row header | `jobThreadStatsByJobId`, `onOpenJobDetail`, `onOpenEditJob` | expanded header |
| Print | `printCostBreakdownJobId` + setter, `printJobSummaryCostBreakdown` | print button |
| Display gates | `showTeamLaborAndProfit`, `driveMileageCost`, `driveTimePerMile` | main row, Sub Labor, chart, print args |

---

## Stage-A candidates (pure logic still inline → `src/lib/*` + tests)

Most calc left this file long ago; what remains inline:

| Candidate | Currently | Target |
|---|---|---|
| Tally line cost + label (`lineCost`/`label`, Parts-from-Tally table ~2380–2387) | inline ternaries; formula duplicated in Jobs.tsx `jobSummaryData` memo and `jobsDocuments/jobSummaryCostBreakdown.ts` | `lib/jobs/tallyLineCost.ts` (`tallyLineCost(row)`, `tallyLineLabel(row)`) + tests; adopt at all three sites |
| `latestThreadActivity(stat)` (module fn, ~71–91) | in-file pure fn; re-implements the Stages Last-activity newest-of pick | `lib/jobThreadLatestActivity.ts` + tests (check `JobsStagesTab`'s copy for a shared home first) |
| Person-summary footer math (`sumTeamF`/`sumCardF`/`personSummaryFooterTeam`/`Card`/`RowTotal`, ~743–764) | inline in the IIFE | `computeJobSummaryPersonFooter({ filtered, breakdownFiltered, teamLaborCost, cardCharges, invoicesFromSupplyHouses, cardColLoading })` in `lib/jobSummaryPersonSummaryTable.ts` + tests (filter-aware branches, null-while-loading) |
| Orphan clock-session partition (~2216–2228) | inline filter chain (unmatched-or-empty normalized name, then person-search filter) | pure fn beside `jobSummaryTeamLaborWorkDateTable.ts` + test |
| `allocTableTotals` reduce (~2008–2017) | inline reduce | fold into `jobSummaryTeamLaborWorkDateTable.ts` (`sumAllocRows(rows)`) — trivial, optional |
| Ledger search predicate (~508–515) | inline in `.filter()` | `jobSummaryLedgerSearchMatch(job, q)` + test — tiny; bundle with another PR |
| Card-mismatch tolerance check (~1861–1865) | inline `Math.abs(...) > 0.02` | ride along with the footer-math kernel (same 0.02 constant as `partsPerPersonCostSummary`'s `sumsOk`) |

Already done (do not redo): person-summary row building, work-date/punch interleave, parts-per-person rollup, % complete resolution, HCP filter + storage, mercury person/unattributed filters, sub-labor cost, debit-card id parse/format, print HTML builder (v2.820), `domTableToCsv` (drilldown modal export).

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during moves)

1. **Loading gate ignores `jobsListLoading`** (comment at ~480) — Job Summary has its own ledger; gating on the shared list deadlocks when this tab is opened first.
2. **Drilldown bodies are snapshots.** `setJobSummaryCostDrilldown` stores ReactNode built from render-time values; an open modal does not update when caches refresh. `openCard`/`openUnassigned*`/`openFooter*` fire the lazy loader *before* building the body, so a cold cache can produce a body built from empty `mRows` — current behavior, keep it. (Quirk #11 in `JOBS_TABS_ARCHITECTURE.md`.)
3. **Team-labor person keys are index-based**: `${job.id}::${i}` where `i` is the index in the **unfiltered** `teamLaborRow.breakdown` (preserved via the shell's `.map((b, i) => ({ b, i }))` before filtering). Collapsing the job row prunes by `${job.id}::` prefix. Changing the key scheme silently breaks expanded-person persistence across person-search filtering.
4. **Hours display inconsistency is intentional-ish**: the Team Labor section renders hours with `formatCurrency(b.hours)` (plain 2-decimal) in its Person|Hours table, tfoot, and per-date rows, while the person summary table and drilldowns use `formatDecimalWorkHoursToHhMm`. Preserve both.
5. **Filter-aware footer semantics**: with a person-name filter active, footer Team/Card sum only the visible rows, but Hours and Supply stay **full-job** figures — the drilldown explainer copy (`openTotalRowLabel`, `openFooterHours`) documents exactly this; keep copy and math in sync.
6. **`buildPartsPerPersonCostRows` runs twice per expanded row** (person summary IIFE and Cost-by-person details), each with its own `tallyRollup` mapping. Dedup is a later refactor, not part of a behavior-preserving move (the second call site renders even when the first skipped due to `cardColLoading`).
7. **The Card-charges inline table duplicates `JobSummaryDrilldownMercuryTable`** minus the Actions/Reassign column. Folding them together changes who sees reassign affordances — not a decomposition change.
8. **Raw hexes** `#b91c1c` (negative profit) and `#6b7280` (card-loading grey, 3 sites) are in-file literals; the theme-tokenize CI tolerates the file as-is — carry them verbatim so extractions don't trip the sweep.
9. **0.02 tolerance** for both card-mismatch warnings (person-summary footer check here; `sumsOk` inside `partsPerPersonCostSummary`).
10. **`e.stopPropagation()` discipline**: every drilldown cell, `<summary>` element, and header button stops propagation so clicks never toggle the job row; `jobSummaryDrilldownCellKeyboard` handles Enter/Space with `preventDefault`. Non-interactive cells get `tabIndex={-1}` and no role.
11. **Zero-amount blocks flatten**: each Parts Cost sub-block renders a flat bold row instead of a `<details>` when its amount is zero (`jobSummaryPartsCostIsZero`), so lazy loaders never fire for empty sections.
12. **HCP input guard** silently ignores empty/NaN/`< -1` input; valid changes write **both** parent state and localStorage synchronously in onChange.
13. **`mileageCost ?? 0.7` / `timePerMile ?? 0.02`** fallbacks are applied in the shell per row (and again independently in the parent's memo) — keep the values aligned.
14. **`showTeamLaborAndProfit`** gates Team Labor and profit **cells** to `—` but the Person summary section still shows team-labor dollars from `teamLaborRow` — that row data is wage-derived and arrives empty for non-privileged viewers upstream (`utils/teamLabor.ts` splits flags from wages); do not add client-side masking during a move.
15. **`Number(invoicesFromSupplyHouses ?? 0)`** defensive coercions in the Unassigned/footer totals — keep them (the field is typed `number` but the coercion is load-bearing against legacy nulls).

---

## Recommended extraction order (value ÷ risk)

All Stage-B targets are sibling files in `src/components/jobs/`; the tab keeps its props type and public API unchanged throughout (Jobs.tsx is untouched by every step).

1. **Stage A sweep** — the table above; highest-leverage: `tallyLineCost` (3 call sites), the person-footer kernel, `latestThreadActivity`. Each independently shippable with tests.
2. **`JobSummaryExpandedHeader` → own file** (with `latestThreadActivity` import) — verbatim module-component move; the momentum-builder.
3. **`renderJobSummarySupplyHouseInvoiceTableContent` → `JobSummarySupplyHouseInvoiceTable`** — must precede steps 5–6 (5 call sites across two regions).
4. **Parts Cost section → `JobSummaryPartsCostSection`** — self-contained props slice; two lazy `onToggle` loaders thread straight through. Fold the trivial Sub Labor + Total Bill sections into the same PR (they're ~70 lines combined) or leave them in the shell.
5. **Team Labor section → `JobSummaryTeamLaborSection`** — threads `jobSummaryTeamLaborPersonExpandedKeys` + setter (stays parent-owned; the shell's `toggle` keeps pruning it) and the clock-session cache slice.
6. **Person summary section → `JobSummaryPersonSummarySection`** — the ~1,174-line prize; extract last of the sections because it has the most opener closures to transcribe. Do its Stage-A footer kernel first so the moved code is thinner.
7. **(Optional) `JobSummaryExpandedRow` composition** — once 4–6 exist, the detail `<tr>` body becomes header + print + chart + four section components; extracting the wrapper shrinks the tab to the shell + footer (~600–700 lines including the props type).

Verification per step: `npm run typecheck && npm run lint && npm test` green; behavior-preserving only (per the playbook — one region per commit).

## What must stay in the parent

- **In `Jobs.tsx` (unchanged by this whole track):** the `?tab=`/`?jobSummaryHcp=` URL handling; `jobSummaryCostDrilldown` state + the `JobSummaryCostCellDrilldownModal` shell (opened via bodies built here, closed by page/`onJobSummaryDrilldownClose`, and stacked under the shared `MercuryTransactionAllocationsModal` reassign flow); `useJobSummaryData` + the `jobSummaryData` P&L memo (a join over two hooks' outputs — cannot move down); the expanded-row lazy-load effects keyed on `activeTab`/`expandedJobSummaryJobIds`; `printJobSummaryCostBreakdown` (fetch-fallback thunk over the pure builder); all three expansion/search state sets; `showTeamLaborAndProfit` derivation from `authRole`.
- **In the tab shell (`JobsJobSummaryTab.tsx`) after sub-decomposition:** the search input + ledger table + main rows; the `toggle` closure (it writes three parent states); per-row derived values shared by 2+ sections (`breakdownPersonQ`, `teamBreakdownFiltered`, `subLaborJobsFiltered`, `mileageCost`/`timePerMile`, `cardColLoading` inputs); the HCP min-filter footer + its localStorage write; the `JobSummaryRow`/`JobsJobSummaryTabProps` contract.

## See also

- [`JOBS_TABS_ARCHITECTURE.md`](./JOBS_TABS_ARCHITECTURE.md) — the parent page's map (`job-summary` dossier: data seam v2.826, quirk #11 drilldown ReactNode, the duplicated team-labor loader).
- [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) — process, definition of done, anti-patterns.
- `docs/RECENT_FEATURES.md` — feature history for this surface: v2.396 (HCP min filter), v2.401 (Cost by person), v2.404 (per-cell drilldowns + CSV/Print), v2.405 (print section order), v2.660 (pay lockdown `showTeamLaborAndProfit`), v2.820/v2.826 (print builder + data seam), v2.966 (HCP → Job # headers); plus #215–#217/#231 (timeline chart, % column, expanded header).
