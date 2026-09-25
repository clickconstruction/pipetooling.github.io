# Projects Forecast Tabs Architecture Map

---
file: docs/PROJECTS_FORECAST_TABS_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map (per PAGE_DECOMPOSITION_PLAYBOOK.md) for the Projects → Forecast → Specific surface — ProjectsForecastSpecificTab.tsx (2,326 lines) + ProjectsForecastSpecificStageModal.tsx (1,471 lines) — plus the Projects → Job History day-cell modal ProjectsJobHistoryDayModal.tsx (1,595 lines, absorbed 2026-09-25). Inventories every logical region's state, handlers, memos, supabase tables/RPCs, sub-components, test coverage and cross-region coupling so a future extraction can proceed without re-deriving the strategy.
covers:
  - src/components/projects/ProjectsForecastSpecificTab.tsx
  - src/components/projects/ProjectsJobHistoryDayModal.tsx
  - src/components/projects/ProjectsForecastSpecificStageModal.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
key_sections:
  - "What this surface is"
  - "Master summary table"
  - "The shared substrate"
  - "ProjectsForecastSpecificTab.tsx — region dossiers"
  - "ProjectsForecastSpecificStageModal.tsx — region dossiers"
  - "ProjectsJobHistoryDayModal.tsx — region dossiers"
  - "Test coverage"
  - "Stage-A pure-logic inventory"
  - "Preserve-quirks list"
  - "Recommended extraction order"
  - "What must stay in the parent"
---

## What this surface is

**Line numbers are exact as of `a05cef4c4` (v2.3819) and rot with every commit — search the symbol name, not the number.** Regenerate facts with `npm run map -- <file>` before trusting a range.

Three files, two Projects page tabs (`/projects`, `src/pages/Projects.tsx`, `?tab=` = `stages` | `job-history` | `forecast`):

| File | Lines | Hook census (fact sheet) | Churn | Role |
|---|---|---|---|---|
| [`ProjectsForecastSpecificTab.tsx`](../src/components/projects/ProjectsForecastSpecificTab.tsx) | 2,326 (tab body 206–1700 = 1,495) | 19 `useState` (18 in the tab + 1 in `SpecificDenseStageBar`) · 12 effects (11 `useEffect` + 1 `useLayoutEffect`) · 17 `useMemo` · 15 `useCallback` · 7 `useRef` · 2 custom hooks (`useSearchParams`, `useToastContext`) · 6 components · 7 module fns | 6 commits / 90 d, last 2026-08-01 `e2dcdd02d` (v2.1197) | Forecast → **Specific** sub-tab: toolbar, job picker, sparse/dense Gantt orchestration, drag-edit engine, optimistic-overlay engine, running-balance money layer, 5 module-level presentational components |
| [`ProjectsForecastSpecificStageModal.tsx`](../src/components/projects/ProjectsForecastSpecificStageModal.tsx) | 1,471 (modal body 184–1145 = 962) | 17 `useState` · 4 effects · 1 `useMemo` · 4 `useCallback` · 1 `useRef` · 2 custom hooks (`useToastContext`, `useConfirmDialog`) · 5 components · 9 module fns | 9 commits / 90 d, last 2026-09-07 `ccce915b8` (v2.2976 Leader copy) | Stage-detail modal: readout + bundled Save editor (name / assignee / dates / length), save-on-blur notes ×2, header % editor, mounts the extracted line-items section |
| [`ProjectsJobHistoryDayModal.tsx`](../src/components/projects/ProjectsJobHistoryDayModal.tsx) | 1,595 (modal body 173–878 = 706) | 13 `useState` (11 in the modal + 2 in `DayContextMiniGantt`) · 4 effects (3 `useEffect` + 1 `useLayoutEffect`) · 8 `useMemo` · 1 `useCallback` · 4 `useRef` · 1 custom hook (`useNarrowViewport640`, mini-Gantt) · 6 components · 7 module fns | 7 commits / 90 d, last 2026-08-17 `5c2034cf4` (v2.1749 90vh sweep) | **Job History** day-cell modal: mini-Gantt orientation strip, People & sessions, Costs on this day (labor / card / supply), Reports filed on this day. Read-only — no writes |

Hosts: the Specific tab is mounted only by [`ProjectsForecastTab.tsx`](../src/components/projects/ProjectsForecastTab.tsx) (270 lines — the data-owning parent; `?forecastSub=` = `specific` (default) | `all-stages` (label "All Steps") | `subs`); the stage modal only by the Specific tab (1646–1653); the day modal only by [`ProjectsJobHistoryTab.tsx`](../src/components/projects/ProjectsJobHistoryTab.tsx) (815 lines; pointer `dayModal` state 133, conditional mount 708–723). The day modal shares no state with the Forecast files — it is here because it had no map; its only code link to Forecast is `lib/projectsJobHistoryData.ts` (`enumerateDaysInRange` is imported by the Specific tab, `peopleCountColor` by the day modal).

The Forecast half is **already the product of the playbook's method**: fed by a thin parent, and its calculation layer is Stage-A complete — tested `src/lib/projectsForecast*.ts` modules (`StageResolver`, `SpecificColumns`, `SpecificWindow`, `DragEdit`, `InsertStage`, `AlignStages`, `JobSearch`, `Data`, `StageLineItems`) plus `parsePercentCompleteInput.ts`, `workflowMoneyFlow.ts`, `forecastBalanceSeries.ts`; untested helpers `projectsForecastColors.ts`, `projectsForecastToolbarStyles.ts` (styles), `fetchForecastStageDetail.ts`. The exception is the **v2.1196–v2.1197 money layer** (running-balance gutter column + balance step-line strip, +314 lines on the tab), whose totals, margin % and event mapping sit inline and untested. The day modal's cost math is in the tested `lib/projectsJobHistoryDayCosts.ts`; its loader, role-gated totals and row flatteners are inline. So this map is about **sub-decomposition** — which regions move to their own files/hooks, and which form an atomic cluster that moves together or not at all.

Sibling components already extracted (render targets, not extraction work): `ProjectsForecastTimelineGrid.tsx` (664 — dense grid, `forwardRef` handle, optional `footer` prop since v2.1197), `ProjectsForecastSpecificGrid.tsx` (502 — sparse grid), `ProjectsForecastAlignStagesModal.tsx` (636 — owns its own `project_workflow_steps` writes), `ProjectsForecastInsertStageModal.tsx` (467 — pure form; the INSERT lives in the tab), `ProjectsForecastStageLineItemsSection.tsx` (1,023 — owns `workflow_step_line_items` CRUD via `projectsForecastStageLineItems.ts`), `ProjectsForecastSubsTab.tsx` (217 — Subs sub-tab, v2.1221; takes no shared props). Job History siblings: `ProjectsJobHistoryTimeline.tsx` (719), `HistoryRangeBar.tsx` (115), `JobHistoryDayList.tsx` (101).

**Churn:** all three files are **low-churn** — the Specific tab has not changed since v2.1197 (2026-08-01); the stage modal's post-map edits are the v2.1877 confirm sweep (`window.confirm` → `useConfirmDialog`) and v2.2976 copy; the day modal's is the v2.1749 safe-area/90vh sweep. Map written proactively; no extraction scheduled.

### How to read a dossier

Each region lists: location (symbol + line range @`a05cef4c4`), **owned local state** (moves with the region), **cross-region/shared state** (stays where it is), **derived memos**, **handlers/functions**, **supabase tables + RPCs**, **sub-components** (extracted vs inline), **tests**, and an **extraction status + risk + approach**.

---

## Master summary table

| Region | File | Anchor (lines) | Size | Coupling | Risk | Tests | Status |
|---|---|---|---|---|---|---|---|
| Job selection + URL/localStorage router | Tab | helpers 161–204, state 217–221, `setSelectedJobId` 278–288, `filteredJobChoices`…`onPickJob` 576–606, JSX 1319–1403 | ~190 | low (writes `selectedJobId`, which everything reads) | low | `projectsForecastJobSearch` (12) | inline — **stays in the tab** (it IS the deep-link router) |
| Money / running balance (v2.1196–97) | Tab | 308–369, `balanceSeries` 490–508, chips 1485–1521, footer 1599–1609, module 1711–1854, gutter cell 2013–2040 | ~275 | low-med (own reads; feeds gutter width, gutter cell, chips, dense footer) | low-med | `workflowMoneyFlow` (5), `forecastBalanceSeries` (4); **inline totals / margin / event mapping untested** ⚠ | inline — Stage-A kernel first, then `useForecastSpecificMoney` |
| Optimistic-overlay engine (`effectiveResolvedBars` + 4 reconcilers) | Tab | state 235–267, memo 381–418, reconcilers 1208–1269, reset 1278–1285 | ~165 | **highest** — written by drag, insert, % commit; read by dense grid, modal, drag baseline, insert inputs, balance strip | high | none | inline — the seam; `useForecastSpecificOverlays` |
| Drag-edit engine (pointer sessions + commit) | Tab | 747–869, 1017–1201, `onToggleDragEdit` 1287–1304 | ~325 | high (writes `dragOverrides`/`dragSaving`; baseline off `effectiveResolvedBars`) | med-high | `projectsForecastDragEdit` (14) | inline — `useForecastDragEdit` after the overlay hook |
| Insert-stage flow | Tab | `insertStageInputs` 876–886, `onConfirmInsertStage` 893–1015, JSX 1522–1543, mount 1665–1697 | ~200 | high (writes 3 overlay slices + `dragSaving`) | med | `projectsForecastInsertStage` (16) | inline — moves with/after the overlay hook |
| Percent-complete column | Tab | 615–679, `renderGutterLabel` 681–718, header 1702–1752, cell 2041–2118 | ~105 + cell 78 | med (writes `pendingPercentByStageId`; gated on `dragEdit`) | low-med | `parsePercentCompleteInput` (14) | inline |
| Dense-window panning + Today reset | Tab | 439–482, 510–573, Today button 1413–1433 | ~130 | low (self-contained; `denseGridRef` handle) | low | `projectsForecastSpecificWindow` (13) | inline — `useForecastSpecificPanWindow` |
| Toolbar + grid/modal mounts (JSX shell) | Tab | 720–745, `emptyState` 1305–1315, render 1317–1699 | ~400 | n/a (renders everything above) | — | none | stays in the tab |
| `StageGutterLabel` + `PercentColumnGutterHeader` (+ `PERCENT_*`/`BALANCE_*` consts, `formatGutterBalance`) | Tab (module) | 1702–1758, 1856–2162 | ~370 | low (props-only) | **lowest** | none | inline components — pure file move |
| `SpecificDenseStageBar` | Tab (module) | 2171–2326 | 156 | low (props-only; `forecastBarColumnSpan` from grid file) | **lowest** | none | inline component — pure file move |
| `ForecastBalanceStrip` + `ForecastBalanceStripGutterCell` (+ `FORECAST_BALANCE_STRIP_H`) | Tab (module) | 1761–1854 | ~95 | none (props-only) | **lowest** | none (SVG y-scale) | inline components — pure file move |
| Module-level pure helpers (dates/format/status) | Stage modal | 87–182 | ~96 | none | **lowest** | none | inline — Stage-A move to `lib/*` + tests |
| Detail load + seed effect (modal shell) | Stage modal | `load` 219–236, effects 238–280, `onBackdropClick` 552–563, `openInWorkflow` 565–572 | ~110 | med (everything reads `detail`) | med | `fetchForecastStageDetail` untested | stays in the modal shell |
| Bundled Save editor (name/assignee/dates/length) | Stage modal | state 196–202, derivations 282–304, coupling 306–378, `handleSave` 380–430, `handleClearDates` 529–550, JSX 828–1018, footer 1104–1139 | ~420 | med (start/end/length coupling is pure → Stage A) | med | none | inline — extract the coupling math, then optionally the section |
| Notes ×2 (save-on-blur, RPC + fallback) | Stage modal | 436–498, mounts 1023–1058, `NotesCollapsible` 1155–1234 | ~130 + 80 | low | low | none | `NotesCollapsible` — file move |
| Header % editor | Stage modal | `savePercent` 505–527, mount ~714, `HeaderPercentCompleteEditor` 1261–1321, styles 1406–1471 | ~150 | low | low | `parsePercentCompleteInput` (14) | module component — file move |
| Line Items For Office | Stage modal | mount 1060–1070 | ~10 | — | — | `projectsForecastStageLineItems` (20) | **already extracted** |
| `DetailField`, `ReasonBlock`, style consts | Stage modal | 1323–1399 | ~77 | none | lowest | none | move with whichever section takes them |
| Module formatters (time/duration/date) | Day modal | 104–171, `formatHoursDecimal` 1065–1072 | ~76 | none | **lowest** | none ⚠ (`sumSessionMinutes` = man-hours) | inline — Stage-A |
| Day data loader | Day modal | `loadGenRef` 206, effect 208–391 | ~190 | **highest in file** — writes all 11 states (sole writer of 9; the two expand sets also have toggles) | med | none (kernels it feeds are tested) | inline — hook seam `useJobHistoryDayData` |
| Modal shell (backdrop, header actions, ESC) | Day modal | ESC 393–400, render 472–597 | ~130 | low | low | none | stays |
| People & sessions | Day modal | `grouped` 402–419, `peopleAndSessionsSummary` 424–433, JSX 607–715 | ~135 | low (reads `sessions`/`userNames`/`loading`) | low | none | inline — optional section component |
| Costs on this day | Day modal | `dayCosts` 437–448, `toggleCostRow` 450–457, JSX 717–799, `DayCostRow` 932–1045, details 1047–1162 | ~90 inline + ~230 module | med (reads 7 loader-written states — 5 via `dayCosts` + `loading`, `costsFetchFailed`; role gate inlined ×3) | low-med | `projectsJobHistoryDayCosts` (29), `bidBoardWeeklyEstimatorLaborCost` (15); **role total + row flatteners untested** ⚠ | module components — file move; role math — Stage A |
| Reports filed on this day | Day modal | `toggleReportExpanded` 459–466, JSX 801–869 | ~80 | low | low | `reportTemplateDisplayName` (13) | inline |
| `DayContextMiniGantt` (+ `MINI_*` consts, `miniExtendButtonStyle`) | Day modal (module) | 923–930, 1164–1577, 1579–1595 | ~440 | none (props-only) | **lowest** | `peopleCountColor` tested in `projectsJobHistoryData.test.ts`; component none | inline component — pure file move |
| `authUserId` placeholder | Day modal | 871–873 | 3 | none | — | — | leave as is during moves (see quirk 32) |

No `*.render.test.tsx` or e2e spec names any of the three files.

---

## The shared substrate

1. **The Forecast data engine lives in the parent, `ProjectsForecastTab.tsx`** — parent component state rather than a named hook: `jobs`, `workflowByProject`, `stagesByWorkflow`, `prefixMap`, `loadingJobs`/`loadingStages`, `loadJobs`/`loadStages` (generation-guarded via `loadGenRef`), and the realtime channel `projects-forecast-${authUserId}` on `project_workflow_steps` (workflow-ID `in.()` filter, cap `MAX_REALTIME_IN_IDS = 80`, unfiltered fallback) + `jobs_ledger`, debounced `REALTIME_DEBOUNCE_MS = 280` with a `useDocumentVisibility` gate. It hands the Specific tab everything via memoized `sharedProps` (`jobs`, `workflowByProject`, `stagesByWorkflow`, `prefixMap`, `loading`, `refreshStages: () => void loadStages(true)`) + `myRole`. Stage data is **write-only** in the tab — every stage read arrives as props and every stage write is reconciled by realtime → `loadStages` → new `stagesByWorkflow` → new `resolvedBars`. **One exception since v2.1196:** the tab's money layer SELECTs `workflow_projections` + `workflow_step_line_items` itself (effect 315–351), outside the parent engine and outside realtime (the channel watches neither table).

2. **The selection pointer is `selectedJobId`**, owned by the Specific tab itself (not the parent): synced to URL `?forecastJob=` (via `useSearchParams`, `replace: true`) and localStorage `projects_forecast_specific_selected_job_v1` (`SELECTED_JOB_STORAGE_KEY` 140; read priority URL > localStorage via `readStoredJobId`). All Steps and Subs have no selection — **only data is shared across sub-tabs, not a UI selection**. Sub-tab routing (`?forecastSub=`) lives in `ProjectsForecastTab`.

3. **Within the tab, the intra-tab substrate is `effectiveResolvedBars`** (381–418) — `resolvedBars` (303–306, = pure `resolveForecastStages(selectedStages, todayYmd)`) merged with **four optimistic overlays**: `dragOverrides` (date shifts), `pendingSequenceOrderBumps`, `pendingInsertedRows`, `pendingPercentByStageId`. Readers: dense grid rows, drag baseline `dragStages`/`stagesForDragRef` (754–767), `insertStageInputs` (876–886), modal lookup `openStageBar` (720–723), the insert modal's "After: Step N" lookup (1673–1683), and the balance strip's `balanceSeries` (490–508). Three regions write its overlay inputs. Four reconciler effects drop overlay entries once `resolvedBars` catches up; the job-switch effect (1278–1285) clears all four overlays + both pan overrides. **This overlay cluster is the extraction seam** — any sub-decomposition of drag-edit, insert, or % editing must first lift it into a hook (`src/hooks/useForecastSpecificOverlays.ts`) or move the writers with it. Note `resolvedBars` (not effective) feeds `layout`, `anyStageHasPercent`, `moneyBalances`, the modal auto-close effect and `emptyState`.

4. **The day modal's substrate is its loader effect** (208–391): one effect, keyed `[open, jobId, workDateYmd]`, resets and then writes all 11 states (`loading`, `error`, `sessions`, `userNames`, `reports`, `expandedReportIds`, `mercuryAllocs`, `supplyAllocs`, `wageByName`, `costsFetchFailed`, `expandedCostRows`) behind `loadGenRef` (206). Every section reads its output; nothing else writes except the two expand toggles. Its pointer (`dayModal: { bar, workDateYmd }`) lives in the host `ProjectsJobHistoryTab` (133), which also owns day-swapping (`onDayModalSelectWorkDate` 460–462) and closes the modal after Open Edit Job / Open Job Detail (438–455).

Consequence for extraction: the parent hook boundary exists (props), the Forecast pure logic is out (lib + tests) except the money layer, and the remaining risky coupling is the overlay cluster inside the tab. The day modal needs one hook seam (the loader) and is otherwise file moves.

---

## ProjectsForecastSpecificTab.tsx — region dossiers

Props contract (`Props` 125–138, all parent-owned): `jobs`, `workflowByProject`, `stagesByWorkflow`, `prefixMap`, `loading`, `myRole`, `refreshStages?`.

### Job selection + URL/localStorage router

- **Location:** module helpers `readStoredJobId` (161–170) / `writeStoredJobId` (172–180) / `buildJobLabel` (200–204); state 217–221; URL→state effect 272–276; `setSelectedJobId` 278–288; `selectedJob` / `selectedWorkflowId` / `selectedStages` 292–302; `filteredJobChoices` 576–584; `wrapRef` 586 + click-outside effect 587–597; `onPickJob` 599–606; toolbar search input + dropdown JSX 1319–1403 (clear button 1339–1355, dropdown 1358–1403).
- **Owned local state:** `selectedJobId` (`setSelectedJobIdState`), `jobSearch`, `jobSearchOpen`, ref `wrapRef`.
- **Cross-region/shared:** everything downstream keys off `selectedJobId` (`selectedJob`, `selectedWorkflowId`, `selectedStages`, the money effect, the job-switch reset effect, `autoCenterTodayResetKey`). URL param `forecastJob` is the deep link.
- **Derived memos:** `selectedJob`, `selectedStages`, `filteredJobChoices` (empty query → selected job + first 15 others; else `filterForecastJobsBySearch(...)` capped at 25). `selectedWorkflowId` is a plain derived local.
- **Handlers:** `setSelectedJobId` (state + localStorage + URLSearchParams write), `onPickJob`.
- **Supabase:** none (reads props only).
- **External coupling:** `?forecastJob=`; localStorage `projects_forecast_specific_selected_job_v1`; `lib/projectsForecastJobSearch.ts`, `lib/ledgerDisplayPrefixes.ts`.
- **Tests:** `projectsForecastJobSearch.test.ts` (12). Storage helpers and `buildJobLabel` untested.
- **Extraction status:** Inline, **stays in the tab** — the playbook keeps routers with the component that owns the selection. If the tab is ever split further, this region is the "parent" the pieces report to.

### Money / running balance (v2.1196–v2.1197)

- **Location:** `canSeeMoney` (310), `moneyProjections`/`moneyItems` state (311–314), fetch effect (315–351), `moneyItemsByStep` (352–358), `moneyBalances` (360–367), `showBalanceColumn` (368–369), `balanceSeries` (490–508), `balanceValue` IIFE inside `renderGutterLabel` (701–705), toolbar margin/balance chips (1485–1521), dense-grid `footer` prop (1599–1609), `labelGutterWidth` term on both grids (1578, 1634); module: `BALANCE_CELL_WIDTH_PX = 82` (1713), `formatGutterBalance` (1756–1758), `FORECAST_BALANCE_STRIP_H = 56` (1761), `ForecastBalanceStripGutterCell` (1765–1790), `ForecastBalanceStrip` (1797–1854), balance cell in `StageGutterLabel` (2013–2040).
- **Owned local state:** `moneyProjections: MoneyFlowProjectionInput[]`, `moneyItems: {step_id, amount, item_date}[]`.
- **Cross-region/shared:** reads `selectedWorkflowId`, `selectedStages`, `resolvedBars` (totals + per-row balance), `effectiveResolvedBars` + `denseDayKeys` + `showDates` (strip). Writes nothing outside itself; `showBalanceColumn` widens the gutter on both grids and adds a `PercentColumnGutterHeader` label.
- **Derived memos:** `moneyItemsByStep` (sum of `amount || 0` per step), `moneyBalances` (`buildWorkflowMoneyFlow(orderedIds, moneyProjections, moneyItemsByStep)` + inline `projectionsTotal` / `ledgerTotal`; `null` when `!canSeeMoney`), `balanceSeries` (projections → `+amount` on the bar's `startYmd` when `placement === 'before'`, else `endYmd`; line items → `−amount` on `item_date` else the step's `endYmd`; → `buildForecastBalanceSeries(denseDayKeys, events)`; `null` when not dense, no column, or no events).
- **Handlers:** none — the fetch is an effect with a `cancelled` flag; `catch {}` is fail-soft (the column simply doesn't render) and per-response `.error` is ignored.
- **Supabase tables:** `workflow_projections` (SELECT `id, step_id, placement, amount, sequence_order` by `workflow_id`), `workflow_step_line_items` (SELECT `step_id, amount, item_date` `in` step ids).
- **Sub-components:** `ForecastBalanceStripGutterCell`, `ForecastBalanceStrip` (SVG step-line, dashed $0 line, red wash on days < −0.004), inline chips.
- **External coupling:** `lib/workflowMoneyFlow.ts` (shared with `src/pages/Workflow.tsx` ~2554, which duplicates the totals + margin formula at 2559–2611); `ProjectsForecastTimelineGrid`'s `footer` prop.
- **Tests:** kernels only (`workflowMoneyFlow.test.ts` 5, `forecastBalanceSeries.test.ts` 4). **Untested inline money math ⚠:** totals (364–365), margin % `((projectionsTotal − ledgerTotal) / projectionsTotal) × 100` (1503), balance chip (1518), per-row `projected − spent` (704), the event mapping (490–508), `formatGutterBalance`, the strip's y-scale.
- **Extraction status + risk + approach:** Inline, **low-med risk**, self-contained. Stage A first: a shared totals kernel (e.g. `lib/workflowMoneyTotals.ts` → `{ projectionsTotal, ledgerTotal, marginPct, balance }`) used by both this tab and `Workflow.tsx` (see the Stage-A inventory's money-totals row), plus `buildForecastBalanceEvents(projections, items, barByStepId)` next to `buildForecastBalanceSeries`, each with tests. Then `useForecastSpecificMoney(canSeeMoney, selectedWorkflowId, selectedStages, resolvedBars)` → `{ moneyProjections, moneyItems, moneyBalances, showBalanceColumn }`; `balanceSeries` either stays in the tab or takes `effectiveResolvedBars`/`denseDayKeys` as args. Strip components → file move with the gutter label.

### Optimistic-overlay engine (the seam)

- **Location:** overlay state (235–267: `dragOverrides` 236, `dragSaving` 239, `pendingInsertedRows` 253, `pendingSequenceOrderBumps` 259, `pendingPercentByStageId` 265; the same block declares `dragEdit` 235 and `insertAfterStageId` 244, owned by Drag-edit and Insert-stage), `effectiveResolvedBars` (381–418), `layout` (421–431) + `spanByStageId` (433–437), four reconciler effects (1208–1222, 1229–1236, 1240–1252, 1255–1269), job-switch reset effect (1278–1285).
- **Owned local state:** `dragOverrides: ReadonlyMap<string, DragEditOverride>`, `pendingInsertedRows: readonly ResolvedStageBar[]`, `pendingSequenceOrderBumps: ReadonlyMap<string, number>`, `pendingPercentByStageId: ReadonlyMap<string, number | null>`, `dragSaving: boolean` (shared save-in-flight flag for drag commits AND inserts — greys the `+` buttons so concurrent writers can't race on `sequence_order`).
- **Cross-region/shared (fact sheet):** `dragOverrides` written by `commitDragEdit`, `onConfirmInsertStage`, `onBarDragStart`, `onBarBodyDragStart`, reconciler 1208, reset 1278; `dragSaving` written by `commitDragEdit` + `onConfirmInsertStage`, read by `renderGutterLabel`, the Edit / + Add stage buttons (1434, 1522) and the insert modal (1665); `pendingPercentByStageId` written by `onCommitPercentComplete`, read by `anyStageHasPercent`.
- **Derived memos:** `resolvedBars`, `effectiveResolvedBars` (merge; **sorts by `sequenceOrder` only when bumps or pending rows exist** — drag-only edits skip the sort AND the bump merge to preserve per-tick allocation; defensive `novelPending` filter avoids double bars before the reconciler runs), `layout` (= `buildSpecificForecastColumns(...)` off **`resolvedBars`, not effective** — sparse columns don't reflow mid-drag), `spanByStageId`, `anyStageHasPercent`.
- **Handlers:** none directly — the reconcilers are effects: (1) drop `dragOverrides` entries whose `startYmd`/`endYmd` match `resolvedBars`; (2) drop `pendingInsertedRows` whose `stageId` arrived; (3) drop `pendingSequenceOrderBumps` whose persisted `sequenceOrder` matches; (4) drop `pendingPercentByStageId` on match. Each has an empty-collection early return to prevent effect loops. The reset effect on `[selectedJobId]` clears all four + `extendedRangeLeftYmd`/`RightYmd` (its comment still says "all three overlays").
- **Supabase:** none itself (the writers below own the writes).
- **Tests:** none (no component test exercises the overlay lifecycle).
- **Extraction status + risk + approach:** Inline. **Highest coupling on the surface** — the tab's `useBidPricingEngine` moment. Extract as `src/hooks/useForecastSpecificOverlays.ts` taking `(resolvedBars, selectedJobId)` and returning `{ effectiveResolvedBars, dragOverrides, setDragOverrides, pendingInsertedRows, setPendingInsertedRows, pendingSequenceOrderBumps, setPendingSequenceOrderBumps, pendingPercentByStageId, setPendingPercentByStageId, dragSaving, setDragSaving }` — the tab destructures so downstream references don't change. The reset effect also clears the pan overrides: either pass an `onJobSwitch` callback or keep a second `[selectedJobId]` effect in the pan hook. Do NOT split the four overlays apart: the insert flow writes three of them in one gesture and the no-snap-back guarantee depends on the reconcile-not-clear lifecycle.

### Drag-edit engine

- **Location:** `BODY_DRAG_THRESHOLD_PX = 4` (147); `dragEdit` state (235); `dragStages` memo (754–763) + `stagesForDragRef` (764) + sync effect (765–767); `dragSessionRef` (768), `moveHandlerRef`/`upHandlerRef` (786–787); `teardownDragListeners` (789–800); `commitDragEdit` (802–869); `onBarDragStart` (1017–1099); `onBarBodyDragStart` (1109–1193); unmount cleanup effect (1196–1201); `onToggleDragEdit` (1287–1304); `dragDisabledReason` (741–745).
- **Owned local state:** `dragEdit` (the page's "Edit" toggle), refs `dragSessionRef` (`{ stageId, startX, originalStages, affectedStageIds, mode: DragEditMode, activated }`), `moveHandlerRef`, `upHandlerRef`, `stagesForDragRef`.
- **Cross-region/shared:** writes `dragOverrides` + `dragSaving`; baseline `dragStages` maps `effectiveResolvedBars` (post-override, so chained drags before reconcile use the visual origin); `dragEdit` also gates the `%` column (`canEditPercentComplete` 630), the `+` insert buttons (`insertButtonVisible` 620), disables the Show-dates toggle (1462–1484), force-enables `showDates` when turned on, and turns on `draggable`/`onBodyDragStart` on dense bars (1617–1619).
- **Handlers:** `teardownDragListeners` (document listeners + `body.style.userSelect`/`cursor` reset), `commitDragEdit` (parallel `Promise.all` of per-row `project_workflow_steps` UPDATEs of `scheduled_start_date`/`scheduled_end_date` via `withSupabaseRetry`; on partial failure deletes ONLY failed ids from `dragOverrides` so failed bars snap back while successful ones hold until reconcile; toast per outcome), `onBarDragStart` (right-edge handle, `mode: 'extend'`, activates immediately, `preventDefault`+`stopPropagation`), `onBarBodyDragStart` (`mode: 'translate'`, activates past 4px so a stationary tap falls through to the bar's `onClick`; after a real drag installs a one-shot capture-phase click `swallow`), `onToggleDragEdit` (blurs any focused `data-forecast-pct="true"` input before leaving edit mode so a pending `0 → null` commit isn't lost on unmount). Per-tick math is pure `buildDragEditPlan(originalStages, stageId, deltaDays, mode)`; move handlers delete only `affectedStageIds` before re-applying the plan, preserving pending-reconciliation overrides on unrelated stages.
- **Supabase tables:** `project_workflow_steps` (UPDATE `scheduled_start_date`, `scheduled_end_date`).
- **External coupling:** `FORECAST_COL_W` (px→days) from `ProjectsForecastTimelineGrid.tsx`; `canAlignStages(myRole)` gates the Edit button (1434).
- **Tests:** `projectsForecastDragEdit.test.ts` (14) for the plan; pointer/commit wiring untested.
- **Extraction status + risk + approach:** Inline. **Med-high risk** — document-level pointer listeners, refs-over-state idioms, and the overlay writes. Extract as `src/hooks/useForecastDragEdit.ts` AFTER (or together with) the overlay hook, taking the overlay setters + `effectiveResolvedBars` + `showToast` and returning `{ dragEdit, onToggleDragEdit, onBarDragStart, onBarBodyDragStart, dragDisabledReason }`. Stage A is already done.

### Insert-stage flow

- **Location:** `insertAfterStageId` state (244), `insertStageInputs` memo (876–886), `onConfirmInsertStage` (893–1015), gutter `+` gating (`insertButtonVisible` 620), toolbar "+ Add stage to start" (1522–1543), modal mount IIFE (1665–1697).
- **Owned local state:** `insertAfterStageId: string | null | undefined` — **tri-state**: `undefined` = modal closed, `null` = insert at start (sequence 1), string = insert after that stage id. Its setter is spread across the tab: `renderGutterLabel`'s `onInsertAfter` (695, the gutter `+` — a Percent-column unit), the toolbar button (1522–1543), the modal's `onClose` (1665–1697) and `onConfirmInsertStage`'s success path — so the setter must travel with the region.
- **Cross-region/shared:** writes `dragOverrides` (cascade shifts), `pendingInsertedRows`, `pendingSequenceOrderBumps`, `dragSaving`; reads `selectedWorkflowId`, `effectiveResolvedBars`, `todayYmd`; gated by `insertButtonVisible = dragEdit && canAlignStages(myRole)`.
- **Handlers:** `onConfirmInsertStage(name, lengthDays)` — plan via pure `planInsertStageAfter({ stages, afterStageId, todayYmd, lengthDays })`, then: (a) optimistic-merge `plan.shiftedOverrides` into `dragOverrides` pre-DB; (b) serial UPDATEs of `sequence_order` bumps **descending** (highest first, to survive a hypothetical `UNIQUE(workflow_id, sequence_order)`), combining the date shift into the same UPDATE per row; (c) INSERT the new row (`status: 'pending'`, mirroring `Workflow.tsx` `saveStep`) with `.select('id').single()`; then stage the optimistic `ResolvedStageBar` (`colorKey: forecastStageColorKey('pending', false)`, `percentComplete: null`) into `pendingInsertedRows` + bumps into `pendingSequenceOrderBumps` BEFORE closing the modal (one batched transition). Catch: delete only `shiftedIds` from `dragOverrides` + error toast.
- **Supabase tables:** `project_workflow_steps` (UPDATE `sequence_order`/dates; INSERT).
- **Sub-components:** `ProjectsForecastInsertStageModal` (**extracted**, 467 lines, pure form — receives `insertStageInputs`, the display-number/name lookup, `applying={dragSaving}`).
- **Tests:** `projectsForecastInsertStage.test.ts` (16) for the plan; the write sequence is untested.
- **Extraction status + risk + approach:** Inline. **Medium risk** — self-contained handler, but writes three overlay slices, so it moves with (or after) the overlay hook.

### Percent-complete column

- **Location:** `insertButtonVisible` (620), `canEditPercentComplete` (630), `anyStageHasPercent` (641–646) + `showPercentColumn` (647), `onCommitPercentComplete` (652–679), `renderGutterLabel` (681–718), `PERCENT_CELL_WIDTH_PX = 58` (1707) / `PERCENT_HEADER_RIGHT_PADDING_PX = 28` (1710), `PercentColumnGutterHeader` (1720–1752; props `showPercent`, `showBalance`), percent cell inside `StageGutterLabel` (2041–2118; editable branch 2056–2116).
- **Owned local state:** none beyond the shared `pendingPercentByStageId` overlay.
- **Cross-region/shared:** `canEditPercentComplete = dragEdit && canAlignStages(myRole)`; `showPercentColumn = dragEdit || anyStageHasPercent` drives `labelGutterWidth` on BOTH grids — `(showPercentColumn ? 300 : 260) + (showBalanceColumn ? BALANCE_CELL_WIDTH_PX + 6 : 0)` (1578, 1634); `anyStageHasPercent` counts pending overlay entries so the column survives the first save. `renderGutterLabel` also carries the money layer's `showBalanceCell` / `balanceValue`.
- **Handlers:** `onCommitPercentComplete(stageId, next)` — optimistic overlay first, then UPDATE `project_workflow_steps.percent_complete` via `withSupabaseRetry`, then `refreshStages?.()`; on error deletes the overlay entry + toast. Input parsing is shared `parsePercentCompleteInput` (0/empty/negative → `null`).
- **Supabase tables:** `project_workflow_steps` (UPDATE `percent_complete`).
- **Tests:** `parsePercentCompleteInput.test.ts` (14).
- **Extraction status + risk + approach:** Inline, **low-med risk** — moves with `StageGutterLabel` (the cell) + the overlay hook (the state). Preserve the blur-before-toggle and imperative-blank quirks verbatim.

### Dense-window panning + Today reset

- **Location:** `showDates` state (224) + `setShowDates` (226–229) + storage helpers `readShowDates`/`writeShowDates` (182–198); pan state `extendedRangeLeftYmd`/`RightYmd` (451–452), `todayResetTick` (460); `denseDayKeys` (468–476), `denseDayKeyIndex` (477–480), `denseRangeStart`/`End` (481–482); `denseGridRef` (515), `pendingScrollAdjustPxRef` (528); `onPanLeft` (530–537), `onPanRight` (539–546), `onTodayClick` (555–559); `useLayoutEffect` (568–573); Today button (1413–1433; rendered when `hasJob && showDates`, 1421–1433); Show-dates toggle (1462–1484).
- **Owned local state:** `showDates` (localStorage `projects_forecast_specific_show_dates_v1`), `extendedRangeLeftYmd`/`extendedRangeRightYmd` (`null` = default window), `todayResetTick`, refs `denseGridRef: ForecastTimelineGridHandle`, `pendingScrollAdjustPxRef: number | null` (one-shot, deliberately a ref).
- **Cross-region/shared:** `showDates` picks dense vs sparse grid (1566) and gates `balanceSeries`; `dragEdit` force-enables it and disables the toggle; the job-switch reset effect clears both pan overrides (`reset_per_job`).
- **Derived memos:** `denseDayKeys` (`computeForecastSpecificEffectiveWindow(todayYmd, left, right)` → `enumerateDaysInRange`; `[]` when `!showDates`), `denseDayKeyIndex` (`buildForecastDayKeyIndex`), `todayYmd` (290, `todayYmdCentral()`, memoized once).
- **Handlers:** `onPanLeft` (extend left 90 days, stamp `pendingScrollAdjustPxRef = FORECAST_SPECIFIC_EXTEND_DAYS * FORECAST_COL_W`), `onPanRight` (no scroll adjust), `onTodayClick` (clear both overrides + bump `todayResetTick`), the `useLayoutEffect` keyed on `denseDayKeys.length` that consumes the ref via `denseGridRef.current?.adjustScrollLeftByPx(...)` pre-paint.
- **Supabase:** none.
- **External coupling:** `lib/projectsForecastSpecificWindow.ts`; `ForecastTimelineGridHandle` + `FORECAST_COL_W` + `buildForecastDayKeyIndex` from the grid file; `autoCenterTodayResetKey={`${selectedJobId ?? ''}::${todayResetTick}`}` (1598).
- **Tests:** `projectsForecastSpecificWindow.test.ts` (13).
- **Extraction status + risk + approach:** Inline. **Low risk, self-contained** — `useForecastSpecificPanWindow(todayYmd, showDates, selectedJobId)` returning `{ denseDayKeys, denseDayKeyIndex, denseRangeStart, denseRangeEnd, denseGridRef, onPanLeft, onPanRight, onTodayClick, autoCenterTodayResetKey }`. Good momentum-builder.

### Toolbar + grid/modal mounts (JSX shell)

- **Location:** `onOpenStage` (611–613), `openStageBar` (720–723), auto-close effect (727–732), `hasJob`/`canAlign`/`alignDisabledReason`/`dragDisabledReason` (734–745), `emptyState` (1305–1315), render (1317–1699): toolbar row (search wrapper 1320–1403, Today 1413–1433, Edit 1434–1461, Show dates 1462–1484, money chips 1485–1521, + Add stage to start 1522–1543, Align stages 1544–1562), dense grid (1566–1623) vs sparse grid (1624–1644), stage modal (1646–1653), align modal (1655–1663), insert modal (1665–1697).
- **Owned local state:** `openStageId` (stage-modal pointer), `alignModalOpen`.
- **Cross-region/shared:** `openStageBar` looks up `effectiveResolvedBars`; the auto-close effect drops `openStageId` when the stage vanishes from `resolvedBars`.
- **Sub-components mounted:** `ProjectsForecastTimelineGrid<ResolvedStageBar>` (dense; rows = `effectiveResolvedBars`, `renderRow` → `SpecificDenseStageBar`, optional balance `footer`) / `ProjectsForecastSpecificGrid` (sparse; stages = `resolvedBars` + `layout`) — both receive `renderGutterLabel` and the conditional `PercentColumnGutterHeader`; `ProjectsForecastSpecificStageModal`; `ProjectsForecastAlignStagesModal` (raw `selectedStages`, writes DB itself, `onApplied` just closes); `ProjectsForecastInsertStageModal`.
- **Tests:** none.
- **Extraction status:** stays — after the hooks/file-moves, this shell plus the job router IS the tab's end state.

### Module-level components (bottom of file)

- **`PercentColumnGutterHeader`** (1720–1752): stateless; renders the `balance` and/or `%` labels using the `PERCENT_*`/`BALANCE_*` consts.
- **`ForecastBalanceStripGutterCell`** (1765–1790) / **`ForecastBalanceStrip`** (1797–1854): stateless money renderers (see Money region).
- **`StageGutterLabel`** (1856–2162, render 1916–2161): props-only (`resolved`, `displayNumber`, `onClick`, `insertButtonVisible/Disabled`, `onInsertAfter`, `percentComplete`, `percentEditable`, `onPercentCommit`, `showPercentCell`, `showBalanceCell`, `balanceValue`); renders chip (display number = row position `idx + 1`, raw `sequence_order` in the tooltip), name, assignee (1980–1996), the balance cell (2013–2040, sits LEFT of %), the uncontrolled percent input (2041–2118, re-keyed `pct-${stageId}-${percentComplete}`), and the `+` insert button (2119–2159; sibling, not nested — nested `<button>`s are invalid HTML).
- **`SpecificDenseStageBar`** (2171–2326): one `useState` (`handleHover` 2198); `barStyle` (2217–2239), `tooltipParts` (2240–2249); span via `forecastBarColumnSpan`; right-edge drag handle (2267–2323, 12px, `col-resize`, stopPropagation click guard) + `onPointerDown` body-drag.
- **Tests:** none.
- **Extraction status + risk:** **Lowest risk on the surface — pure file moves.** `StageGutterLabel` + `PercentColumnGutterHeader` + `PERCENT_*`/`BALANCE_CELL_WIDTH_PX` + `formatGutterBalance` → `ProjectsForecastStageGutterLabel.tsx`; the two strip components + `FORECAST_BALANCE_STRIP_H` → `ProjectsForecastBalanceStrip.tsx` (imports `formatGutterBalance` from the gutter file or a lib); `SpecificDenseStageBar` → its own file. ~620 lines out of the tab with zero behavior surface.

---

## ProjectsForecastSpecificStageModal.tsx — region dossiers

Props contract (`Props` 64–73): `stage: ResolvedStageBar` (header renders instantly from bar data), `projectId`, `myRole`, `onClose`. Role gate: `EDITOR_ROLES` (75–81) = `{dev, master_technician, assistant, superintendent, controller}` via `canEditExpectedDates(myRole)` (83–85) → `canEdit` (187) (mirrors the `project_workflow_steps` UPDATE RLS).

### Module-level pure helpers

- **Location:** 87–182: `todayYmdCentral` (87–96, duplicate of the tab's), `ymdDaysBetween` (98–110), `ymdFromDateLike` (112–117, slice 10 — handles both `date` and `timestamptz`), `DATE_FMT_LONG`/`DATETIME_FMT` (119–133, `Intl.DateTimeFormat`, `APP_CALENDAR_TZ`), `formatYmdLong` (135–140, noon trick `T12:00:00` to dodge DST/UTC day-shift), `formatTimestamp` (142–147), `describeStatus` (149–166; `rejected` renders as "Previous work incomplete"), `actualDurationLabel` (168–177), `wordCount` (179–182).
- **Tests:** none. **Extraction status:** **Stage-A candidates** — zero React, zero closure.

### Detail load + seed effect (modal shell)

- **Location:** `load` callback (219–236), load effect (238–240), seed effect (245–261), ESC effect (264–270, gated `!saving`), body scroll-lock effect (273–280), `onBackdropClick` (552–563, **async** — dirty-confirm via `useConfirmDialog` "Discard your changes to expected dates?" since v2.1877), `openInWorkflow` (565–572, `window.open('/workflows/${projectId}#step-${stageId}')` with `location.href` fallback), header/footer JSX, load-error branch (744–760).
- **Owned local state:** `detail: ForecastStageDetail | null`, `loading`, `loadError`.
- **Cross-region/shared:** `touched` (202) guards the seed effect — a mid-edit user is never reset by refetch — but only the Save editor writes it (the four coupling handlers, the name / assignee / also-push inputs at 852, 872, 983, and `handleSave` / `handleClearDates`, which reset it to `false` so the refetch re-seeds). The seed effect writes the editor's six form states and the Notes region's two expand flags (259–260). The shell reads the editor's `saving` (ESC 266, header × button 729–736, `onBackdropClick` 553) and `dirty` (`onBackdropClick`).
- **Handlers:** `load` via `fetchForecastStageDetail(stage.stageId)` — `null` ⇒ "no longer accessible" error state.
- **Supabase tables:** `project_workflow_steps` (SELECT `*` `.maybeSingle()`; second SELECT for the next sibling — `workflow_id` match, `sequence_order` strictly greater, `limit(1)`) — both inside `lib/fetchForecastStageDetail.ts` (untested).
- **Extraction status:** stays — this is the modal's spine.

### Bundled Save editor (Adjust stage)

- **Location:** form state (196–202), validation derivations `lengthNum`/`lengthInvalid`/`between`/`endBeforeStart`/`nameInvalid`/`saveDisabled` (282–304) + `dirty` memo (287–300), coupling handlers `handleStartChange` (306–322) / `handleEndChange` (324–333) / `handleLengthChange` (335–353) / `extendEndByDays` (355–370) / `setStartToToday` (372–374) / `setEndToToday` (376–378), `handleSave` (380–430), `handleClearDates` (529–550), editor JSX (828–1018), footer buttons (1104–1139).
- **Owned local state:** `startVal`, `endVal`, `lengthVal`, `alsoPushNext`, `nameVal`, `assignedToVal`, `saving`, `saveError`. The six form states are seeded by the shell's seed effect (245–261); `saving` is also read by the shell (see above); the editor writes the shell's `touched`.
- **Handlers:** the start/end/length auto-coupling deliberately mirrors the Workflow page's Expected Dates modal; the +1 day / +1 week / +1 month extend chips (`extendEndByDays`) and the Today setters are Forecast-only ("+1 month" = 30-day approximation, tooltip says so); `handleSave` — single UPDATE of `{name, assigned_to_name, scheduled_start_date, scheduled_end_date}`, then (if `alsoPushNext && detail.nextStage && endToWrite`, 405) a second UPDATE setting the sibling's `scheduled_start_date = endToWrite` (failure of the second is a toast, not a rollback), then `setTouched(false)`, `lineItemsRefreshNonceRef.current += 1` (423), `await load()`; `handleClearDates` — UPDATE both dates to `null`.
- **Supabase tables:** `project_workflow_steps` (UPDATE ×2).
- **Tests:** none.
- **Extraction status + risk + approach:** Inline. **Medium risk.** Stage A first: pure transitions (`applyStartChange`, `applyEndChange`, `applyLengthChange`, `applyExtendEnd`, each `(current: {startVal,endVal,lengthVal}, input) → next`) + tests. Workflow's Expected Dates modal has the twin of the first three (`handleStartChange` / `handleEndChange` / `handleLengthChange`, `Workflow.tsx` 3692–3731), and [`WORKFLOW_PAGE_ARCHITECTURE.md`](./WORKFLOW_PAGE_ARCHITECTURE.md) plans the two-consumer kernel as `src/lib/workflow/expectedDatesLinkage.ts`, so put the linkage there. `applyExtendEnd` has no Workflow twin. Then optionally `ProjectsForecastStageAdjustSection` — modest win; the JSX is straight-line.

### Notes ×2 (Notes for Tech / Notes for Office)

- **Location:** `saveNotes` (436–466), `savePrivateNotes` (468–498), mounts (1023–1037, 1042–1058), `NotesCollapsible` (1155–1234).
- **Owned local state:** `notesExpanded` / `privateNotesExpanded` (`boolean | null` — `null` = "expanded iff non-empty"; the shell's seed effect also writes them, `prev ?? non-empty`, 259–260), `savingNotes`, `savingPrivateNotes`.
- **Handlers:** save on textarea blur, skip no-op writes, **RPC-first with fallback**: `rpc('update_step_notes', {p_step_id, p_notes})` / `rpc('update_step_private_notes', {p_step_id, p_private_notes})`; on `'Could not find the function'` (448, 480) fall back to a direct UPDATE of `notes` / `private_notes`. Then `await load()`.
- **Supabase:** RPCs `update_step_notes`, `update_step_private_notes`; `project_workflow_steps` (fallback UPDATE).
- **Sub-components:** `NotesCollapsible` — uncontrolled textarea, `key = textareaKey` (includes the persisted value so refetches re-key it), fully props-driven.
- **Extraction status + risk:** **Low.** `NotesCollapsible` is a pure file move. Do NOT merge the two save callbacks during the move.

### Header % editor

- **Location:** `savePercent` (505–527), mount in header (~714), `HeaderPercentCompleteEditor` (1261–1321), `headerPercent*` style consts (1406–1471).
- **Owned local state:** `savingPercent`.
- **Handlers:** `savePercent(next)` — early-return when `next === detail.step.percent_complete ?? null`; UPDATE `percent_complete`; toast on error; `await load()`. Input semantics identical to the tab's gutter cell (`parsePercentCompleteInput`, re-key `pct-header-${stageId}-${percentComplete}`, imperative DOM blank).
- **Supabase tables:** `project_workflow_steps` (UPDATE `percent_complete`).
- **Extraction status + risk:** **Low** — pure file move; intentionally does NOT use the tab's optimistic overlay.

### Line Items For Office (already extracted)

- **Location:** mount only (1060–1070): `<ProjectsForecastStageLineItemsSection stepId={step.id} stepName={step.name} myRole={myRole} refreshNonce={lineItemsRefreshNonceRef.current} />`, gated on `canEdit`; `lineItemsRefreshNonceRef` (217) bumps after the bundled Save.
- **Supabase (inside the extracted component/lib):** `workflow_step_line_items` (SELECT/INSERT/UPDATE/DELETE via `lib/projectsForecastStageLineItems.ts`, 20 tests), `purchase_orders`, `purchase_order_items`, `supply_house_invoices` (picker reads).
- **Extraction status:** **Done** — the target end-state pattern for the other sections. Line-item edits here do not reach the Specific tab's balance column until its next stage refetch (quirk 23).

### Presentational leftovers

`DetailField` (1323–1332), `ReasonBlock` (1334–1350) and `dateInputStyle`, `chipBtnStyle`, `chipBtnPrimaryStyle`, `footerSecondaryStyle`, `footerPrimaryStyle` (1352–1399) — move with whichever section takes them.

---

## ProjectsJobHistoryDayModal.tsx — region dossiers

Props contract (`Props` 69–93): `open`, `onClose`, `jobId`, `jobTitle` (pre-formatted), `workDateYmd`, `bar: ProjectsJobHistoryBar` (drives the mini-Gantt), `todayYmd`, `authUserId`, `userRole: UserRole | null`, `onOpenEditJob`, `onOpenJobDetail`, `onSelectWorkDate?`. Host: `ProjectsJobHistoryTab` passes `open` literally `true` inside `{dayModal && …}` (708–723). `Z_INDEX = 1040` (54). Read-only — no writes anywhere in the file.

### Module formatters

- **Location:** `formatChicagoTime` (104–114; null → "— still clocked in"), `formatSessionDuration` (116–127), `sumSessionMinutes` (130–140; closed sessions only, per-session minute rounding), `formatHoursMinutes` (143–150), `formatHeadingDate` (152–161), `formatMonthDay` (164–171), `formatHoursDecimal` (1065–1072, trims trailing zeros).
- **Tests:** none ⚠ — `sumSessionMinutes` is the "Man hours" figure and is a second hours computation independent of the kernel's `approvedClosedSessionHours`.
- **Extraction status:** **Stage-A** — zero React. Check `src/lib/userDaySummaryFormat.ts` first: it already exports a tested `formatSessionDuration(ms)` (used by `UserDaySummaryModal`).

### Day data loader (the file's substrate)

- **Location:** `loadGenRef` (206), effect (208–391, deps `[open, jobId, workDateYmd]`).
- **Owned local state (all written here; only `expandedReportIds` / `expandedCostRows` are also written elsewhere, by `toggleReportExpanded` / `toggleCostRow`):** `loading`, `error`, `sessions: ClockSessionRow[]`, `userNames: Map`, `reports: ReportRow[]`, `expandedReportIds` (seeded with every fetched report id), `mercuryAllocs`, `supplyAllocs`, `wageByName`, `costsFetchFailed`, `expandedCostRows` (reset to empty).
- **Sequence:** reset all 11 → (1) `clock_sessions` SELECT `id, user_id, clocked_in_at, clocked_out_at, notes` for `job_ledger_id = jobId`, `work_date = workDateYmd`, `approved_at` not null, `rejected_at`/`revoked_at` null, ordered by `clocked_in_at` (via `withSupabaseRetry`) → (2) `fetchUserNamesForIds` (soft-fail to empty map) → (3) `rpc('list_reports_with_job_info')`, filtered client-side to `job_ledger_id === jobId` and `calendarYmdInAppTzFromIso(created_at) === workDateYmd` (error → `error` banner) → (4) `Promise.allSettled` of `mercury_transaction_job_allocations` (`amount, note, mercury_transactions(posted_at, counterparty_name)` by `job_id`), `supply_house_invoice_job_allocations` (`pct, supply_house_invoices(invoice_date, amount, invoice_number, supply_houses(name))` by `job_id`), `people_pay_config` (`person_name, hourly_wage`, all rows) — each rejection sets `costsFetchFailed`; fulfilled rows are **flattened inline** (309–383, object-or-array join normalization) into `DayCostMercuryAllocationInput` / `DayCostSupplyAllocationInput`, and pay rows go through `buildHourlyWageLookupByNormalizedName`. Every await is followed by a `gen !== loadGenRef.current` bail.
- **Supabase:** tables `clock_sessions`, `mercury_transaction_job_allocations`, `supply_house_invoice_job_allocations`, `people_pay_config`; RPC `list_reports_with_job_info`.
- **Tests:** none for the loader or the flatteners ⚠ (they shape the money inputs).
- **Extraction status + risk + approach:** Inline, **medium risk** — `src/hooks/useJobHistoryDayData.ts(open, jobId, workDateYmd)` returning `{ loading, error, sessions, userNames, reports, mercuryAllocs, supplyAllocs, wageByName, costsFetchFailed }`; the two expansion sets stay in the modal and re-seed from an effect on `reports` / `workDateYmd` (preserve "all reports open, cost rows closed" per day). Stage A first: move the two flatteners into `lib/projectsJobHistoryDayCosts.ts` with tests. Splitting job-scoped cost reads from day-scoped reads (quirk 30) is a behavior change — separate PR.

### Modal shell

- **Location:** ESC effect (393–400), `if (!open) return null` (468), backdrop + dialog + header (472–589: title, heading date, Open Edit Job / Open Job Detail / Close), error banner (592–596), mini-Gantt mount (598–605), style consts `sectionHeadingStyle` / `mutedStyle` / `reportToggleStyle` (880–905).
- **Extraction status:** stays.

### People & sessions

- **Location:** `grouped` (402–419; by user, sorted by name, "Unknown user" fallback), `peopleAndSessionsSummary` (424–433; man-hours, distinct people, session count), JSX (607–715; loading branch 611–714, per-session note 692–705).
- **Reads:** `sessions`, `userNames`, `loading`. **Tests:** none. **Status:** inline, low risk — optional `ProjectsJobHistoryDaySessions` section once the loader hook exists.

### Costs on this day

- **Location:** `dayCosts` (437–448, `buildDayCostBreakdown({ sessions, userNamesById, wageByNormalizedName, mercuryAllocations, supplyAllocations, workDateYmd })`), `toggleCostRow` (450–457), JSX (717–799; role-gated labor row 731–748, total row 769–791, `costsFetchFailed` footnote 794–798); module `DayCostRow` (932–1045), `detailTableStyle`/`detailTdStyle`/`detailTdRightStyle` (1047–1063), `DayLaborDetail` (1074–1106), `DayMercuryDetail` (1108–1133), `DaySupplyDetail` (1135–1162).
- **Owned local state:** `expandedCostRows: Set<'labor' | 'mercury' | 'supply'>` (written by the loader reset + `toggleCostRow`).
- **Role gate:** `userRole === 'dev' || 'master_technician' || 'controller'` inlined three times (731, 781, 786) — labor row visible, "Total" = `totalUsd`; everyone else sees no labor row and "Total (excl. team labor)" = `totalUsd − laborUsd` (788). `≥ ` prefix when `dayCosts.laborIncomplete` (784), for every role.
- **Tests:** `projectsJobHistoryDayCosts.test.ts` (29: labor/mercury/supply cost + lines, `buildDayCostBreakdown`, `formatUsd`), `bidBoardWeeklyEstimatorLaborCost.test.ts` (15). **Untested ⚠:** the role-dependent total + `≥` rule, the flatteners feeding it.
- **Extraction status + risk + approach:** **Low-med.** Stage A: `dayCostTotalForRole(breakdown, canSeeLabor) → { label, usd, approximate }` + a named `canSeeDayLabor(role)` in the lib, tested. Then `DayCostRow` + the three detail tables + `formatHoursDecimal` → `ProjectsJobHistoryDayCosts.tsx` (pure file move, ~230 lines).

### Reports filed on this day

- **Location:** `toggleReportExpanded` (459–466, plain function), JSX (801–869; expanded body 852–863 renders `ReportDetailBody` from `ReportViewModal.tsx` with `fieldLayout="inline"`), title via `displayReportTemplateName(template_name, userRole)`.
- **Owned local state:** `expandedReportIds` (loader-seeded; also written by `toggleReportExpanded`). Reads the loader's `reports` and `loading`.
- **Tests:** `reportTemplateDisplayName.test.ts` (13); section untested. **Status:** inline, low risk.

### `DayContextMiniGantt` (module component)

- **Location:** consts `MINI_COL_W = 40`, `MINI_ROW_H = 36`, `MINI_BAR_H = 24`, `MINI_EXTEND_STEP = 30`, `MINI_INITIAL_PADDING_WIDE = 5`, `MINI_INITIAL_PADDING_NARROW = 2` (923–930); component (1164–1577; render 1282–1576); `miniExtendButtonStyle` (1579–1595).
- **Owned state/refs:** `daysBefore`, `daysAfter` (1183–1184), `initialPaddingRef` (1180), `scrollRef` (1185), `pendingScrollSideRef` (1186); `useNarrowViewport640` (1176).
- **Effects/memos:** reset on `[selectedYmd]` (1190–1194); `useLayoutEffect` on `[daysBefore, daysAfter]` (1209–1222) adds `MINI_EXTEND_STEP × MINI_COL_W` to `scrollLeft` after a left extension; `dayKeys` (1233–1239), three `Intl.DateTimeFormat` memos (1241–1252), `dayKeyIndex` (1254–1258); handlers `onClickExtendLeft`/`Right` (1224–1231).
- **Render:** bar with per-day `peopleCountColor(count)` cells, count from `bar.perDayCounts.get(ymd)` (1404–1470), selected-day marker when outside the bar (1474–1494), clickable day row → `onSelectDay` (1523–1560; same-day clicks ignored).
- **Tests:** `peopleCountColor` in `projectsJobHistoryData.test.ts`; component none.
- **Extraction status + risk:** **Lowest** — props-only (`bar`, `selectedYmd`, `todayYmd`, `onSelectDay?`) → `ProjectsJobHistoryDayMiniGantt.tsx` with its consts and style, ~440 lines, zero behavior surface.

---

## Test coverage

| Kernel (`src/lib/`) | Tests | Feeds |
|---|---|---|
| `projectsForecastStageResolver` | 22 | `resolvedBars` |
| `projectsForecastSpecificColumns` | 18 | sparse `layout` |
| `projectsForecastInsertStage` | 16 | insert plan |
| `projectsForecastAlignStages` | 15 | `canAlignStages` gate (+ align modal) |
| `projectsForecastDragEdit` | 14 | drag plan |
| `parsePercentCompleteInput` | 14 | gutter % cell + header % editor |
| `projectsForecastSpecificWindow` | 13 | dense window / pan |
| `projectsForecastJobSearch` | 12 | job picker |
| `workflowMoneyFlow` | 5 | per-step balance (`moneyBalances.flow`) |
| `forecastBalanceSeries` | 4 | balance strip |
| `projectsForecastData` / `projectsForecastStageLineItems` | 5 / 20 | parent engine / line-items section |
| `projectsJobHistoryDayCosts` | 29 | day costs + `formatUsd` |
| `bidBoardWeeklyEstimatorLaborCost` | 15 | wage lookup |
| `projectsJobHistoryData` | 20 | `peopleCountColor`, `enumerateDaysInRange` |
| `reportTemplateDisplayName` | 13 | report titles |
| `projectsForecastColors`, `projectsForecastToolbarStyles`, `fetchForecastStageDetail` | — | untested |

Component tests: **none** for the three files. **Untested money math (risk flags):** Specific tab totals / margin % / per-row balance / balance-event mapping / `formatGutterBalance` (Money region); day modal role-dependent total + `≥` rule and the allocation-row flatteners (Costs + loader regions).

---

## Stage-A pure-logic inventory

| Candidate | Currently | Target |
|---|---|---|
| Money totals + margin (`projectionsTotal`, `ledgerTotal`, `(p − l)/p × 100`, `p − l`) | inline in the tab (360–369, 1503, 1518) **and** `Workflow.tsx` (2559–2611) | `lib/workflowMoneyTotals.ts` + tests; both call it (pin the `Number(p.amount ?? 0)` vs `p.amount || 0` difference first). Workflow's rail-only helpers (`itemsTotalByStepId`, `railAmount`, `balanceColor`) stay beside `buildWorkflowMoneyFlow` — the ledger-rail row of [`WORKFLOW_PAGE_ARCHITECTURE.md`'s Stage-A inventory](./WORKFLOW_PAGE_ARCHITECTURE.md#stage-a-pure-logic-inventory-extract-to-lib--tests-before-any-component-moves) names the same kernel |
| Balance-event mapping (projection placement → start/end day; line item → `item_date` else step end) | `balanceSeries` memo (490–508) | `buildForecastBalanceEvents` in `lib/forecastBalanceSeries.ts` + tests |
| `formatGutterBalance` | module fn (1756–1758) | same lib or the gutter-label file + test |
| Day-cost role total + labor gate | inline JSX (731, 781–789) | `dayCostTotalForRole` / `canSeeDayLabor` in `lib/projectsJobHistoryDayCosts.ts` + tests |
| Mercury / supply join flatteners | loader effect (309–373) | `flattenMercuryAllocationRows` / `flattenSupplyAllocationRows` in the same lib + tests — or the one shared Mercury allocation loader/flattener that `PAGE_DECOMPOSITION_PLAYBOOK.md` shared-kernel row 13 plans across ~8 callers (check it first) |
| `formatChicagoTime`, `formatSessionDuration`, `sumSessionMinutes`, `formatHoursMinutes`, `formatHoursDecimal`, `formatHeadingDate`, `formatMonthDay` | module fns in the day modal | `lib/projectsJobHistoryDayFormat.ts` (or reuse `userDaySummaryFormat.ts`) + tests |
| `todayYmdCentral` | **duplicated** in the tab (149), the stage modal (87) and `ProjectsForecastAllStagesTab.tsx` (74) | one export in `lib/` + test; keep the local-clock stance comment |
| `ymdDaysBetween`, `ymdFromDateLike`, `formatYmdLong`, `formatTimestamp`, `DATE_FMT_LONG`/`DATETIME_FMT`, `describeStatus`, `actualDurationLabel`, `wordCount` | module-level in the stage modal (98–182) | `lib/projectsForecastStageDetailFormat.ts` (check `utils/dateUtils.ts` for equivalents) + tests; pin DST/day-shift and `rejected` → "Previous work incomplete" |
| start/end/length coupling | closures in the stage modal (306–378) | pure transitions + tests in `src/lib/workflow/expectedDatesLinkage.ts`, shared with Workflow's twin (3692–3731; planned in `WORKFLOW_PAGE_ARCHITECTURE.md`); `extendEndByDays` is Forecast-only |
| `readStoredJobId`/`writeStoredJobId`, `readShowDates`/`writeShowDates` | module-level in the tab (localStorage IO) | optional — thin IO wrappers; fine to leave |
| `buildJobLabel` | module-level in the tab | optional move to `lib/projectsForecastJobSearch.ts` if a second caller appears |

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during a move)

1. **Local-clock "today"** (`todayYmdCentral`) — the tab, the stage modal and All Steps deliberately use browser-local time, not `APP_CALENDAR_TZ`; the rationale comments travel with any dedupe.
2. **Drag-only edits skip the sort** in `effectiveResolvedBars` (and the bump merge) — sorting fires only when bumps or pending rows exist.
3. **No snap-back lifecycle:** `commitDragEdit` never clears successful overrides — the reconciler drops them when `resolvedBars` catches up; only failed ids are cleared.
4. **Sequence bumps write DESCENDING**, date shift combined into the same UPDATE per row.
5. **Tri-state `insertAfterStageId`** (`undefined` closed / `null` at-start / string after-id) — do not collapse to `string | null`.
6. **`BODY_DRAG_THRESHOLD_PX = 4`** body-drag activation + the one-shot capture-phase click `swallow` after a real drag; right-edge drags activate immediately.
7. **`onToggleDragEdit` blurs `data-forecast-pct="true"` inputs** before leaving edit mode (v2.562 fix).
8. **`parsePercentCompleteInput` maps `0` to `null`** + the imperative `e.currentTarget.value = ''` blank in BOTH the gutter cell and the header editor.
9. **Pan clicks never move the viewport**: `←` compensates via `pendingScrollAdjustPxRef` (one-shot ref consumed in a `useLayoutEffect` keyed on `denseDayKeys.length`); `→` needs none. `autoCenterTodayResetKey = ${selectedJobId}::${todayResetTick}` is the only re-center trigger.
10. **Window resets per job** (`reset_per_job`): the `[selectedJobId]` effect clears all four overlays AND both pan overrides; no pan persistence.
11. **`labelGutterWidth` = `(showPercentColumn ? 300 : 260) + (showBalanceColumn ? BALANCE_CELL_WIDTH_PX + 6 : 0)`** on both grids; `anyStageHasPercent` counts pending overlay entries so the % column doesn't vanish right after the first save.
12. **Chip shows row position (`idx + 1`), not raw `sequence_order`** — raw value in the tooltip; the insert modal's "After: Step N" uses the same number.
13. **Notes RPC-first with `'Could not find the function'` string-match fallback** to a direct UPDATE — keep both paths and the exact string.
14. **Seed-once gated on `touched`** in the stage modal; `setTouched(false)` after save re-arms seeding.
15. **`alsoPushNext` second UPDATE failure is a toast, not a rollback.**
16. **"+1 month" = 30 days** (tooltip documents it).
17. **`EDITOR_ROLES`/`ALIGN_EDITOR_ROLES` contain 5 roles including `controller`** while the stage modal's `Props` JSDoc (69–70) and the tab's header comment (36–37) still describe 4 — trust the Sets; never shrink them.
18. **`layout` (sparse columns) derives from `resolvedBars`, not `effectiveResolvedBars`** — sparse mode ignores in-flight overlays (drag-edit forces dense mode anyway).
19. **`percent_complete` writes take three consistency paths** — gutter: optimistic overlay + `refreshStages()`; modal header: self-refetch (`load()`); both settle through parent realtime.
20. **localStorage keys** `projects_forecast_specific_selected_job_v1`, `projects_forecast_specific_show_dates_v1`; URL `?forecastJob=` wins on read.
21. **Money visibility differs by file:** the tab's `canSeeMoney` is `dev || master_technician` (310, same as Workflow's `isDevOrMaster`) — no `controller`; the day modal's labor gate includes `controller`. Don't unify during a move.
22. **Balance column vs strip read different bar sets:** `moneyBalances` / per-row balance use `resolvedBars` order (don't move mid-drag); `balanceSeries` uses `effectiveResolvedBars` (follows in-flight drags and inserts).
23. **Money reads ride stage refetches:** the money effect's deps include `selectedStages`, whose identity changes on every parent `loadStages`; realtime watches neither money table, so a line-item or projection change alone doesn't refresh the balance. Fail-soft: `catch {}` and ignored `.error`.
24. **`showBalanceColumn` hides when both totals are exactly 0**; the margin chip hides when `projectionsTotal === 0` (division guard); unanchored projections count in the chip totals but not in the strip.
25. **Totals parse differently from Workflow:** the tab sums `Number(p.amount ?? 0)` (364); `Workflow.tsx` sums `p.amount || 0` (2559). A shared kernel must pick one deliberately.
26. **Dirty-confirm is async** (`await confirmDialog(...)`, `danger: true`) — callers wrap as `() => void onBackdropClick()`.
27. **Day loader resets all 11 states per run** and bails on `loadGenRef` after every await; cost queries use `Promise.allSettled` so one failed category shows the "may be incomplete" footnote instead of an error; a reports-RPC error shows the banner while sessions still render.
28. **All reports start expanded; cost rows start collapsed** — both re-seeded on every day change.
29. **`list_reports_with_job_info` is fetched whole** and filtered client-side by job + app-TZ calendar day of `created_at`.
30. **Job-scoped cost rows are re-fetched on every day change** (effect deps `[open, jobId, workDateYmd]`) although `buildDayCostBreakdown` filters by day — the state comment at 193–194 implies a single fetch; the code refetches. Performance only.
31. **Non-labor roles' total:** "Total (excl. team labor)" = `totalUsd − laborUsd`, still prefixed `≥ ` whenever `laborIncomplete` (784); `people_pay_config` is queried for every role, and for a role whose read returns no rows every session counts as "missing wage" (so `≥` shows on any day with sessions). Looks like a display bug — fix deliberately, not during a move.
32. **`authUserId`** is referenced only by a no-op expression (871–873) "reserved for future" affordances.
33. **Mini-Gantt padding** is 5 days (wide) / 2 (≤ 640 px) via `initialPaddingRef` so a viewport flip mid-extension doesn't clobber manual expansion; reset only on `selectedYmd`; its block comment (917–919) still says the initial state shows only the selected day and that each extend click snaps to the added side (the code keeps the view pinned).
34. **Host closes the day modal after Open Edit Job / Open Job Detail** (`ProjectsJobHistoryTab` 438–455) — the file header (11–13) says the parent modals "stack on top"; the host is authoritative.
35. **Sessions shown are approved, not rejected, not revoked**; open sessions render "— still clocked in", add 0 man-hours, but count as a person and a session.

---

## Recommended extraction order (value ÷ risk)

The three files are low-churn — **no extraction is scheduled**. When one starts (re-ranked 2026-09-25 with the money layer and the day modal):

1. **Money Stage-A (Forecast + Workflow)** — `lib/workflowMoneyTotals.ts` (totals, margin, balance) consumed by both the Specific tab and `Workflow.tsx`, `buildForecastBalanceEvents`, `formatGutterBalance`, each tested. Highest value (untested money math duplicated across two surfaces), low risk.
2. **Day-modal Stage-A** — allocation-row flatteners, `dayCostTotalForRole` / `canSeeDayLabor`, and the time/duration formatters (reuse `userDaySummaryFormat.ts` where it fits), each tested.
3. **Pure file moves (zero coupling)** — day modal: `DayContextMiniGantt` (~440) and `DayCostRow` + 3 detail tables (~230); tab: `StageGutterLabel` + `PercentColumnGutterHeader` + consts + `formatGutterBalance` (~370), balance strip pair (~95), `SpecificDenseStageBar` (156); stage modal: `NotesCollapsible`, `HeaderPercentCompleteEditor` (+ styles), `DetailField`/`ReasonBlock`.
4. **Stage-modal Stage-A** — date/format/status helpers + the start/end/length coupling kernel (Workflow-parity, via the shared `expectedDatesLinkage.ts`).
5. **`useJobHistoryDayData` hook** — the day modal's one seam; single writer, clean return shape.
6. **`useForecastSpecificMoney` hook** — fetch + totals; reads only `selectedWorkflowId`/`selectedStages`/`resolvedBars`.
7. **`useForecastSpecificPanWindow` hook** — self-contained momentum builder.
8. **`useForecastSpecificOverlays` hook (the seam)** — four overlays + `dragSaving` + reconcilers + job-switch reset + `effectiveResolvedBars`. Steps 9–10 depend on it.
9. **`useForecastDragEdit` hook** — pointer sessions, `commitDragEdit`, `onToggleDragEdit`.
10. **Insert flow** — `onConfirmInsertStage` + `insertAfterStageId` into `useForecastInsertStage` or left in the slimmed tab.

After 1–10: the tab is the job router + toolbar + grid mounts (~800–900 lines), the stage modal is shell + Adjust-stage section (~700–800), the day modal is shell + three sections (~650).

## What must stay in the parent

- **In `ProjectsForecastTab.tsx`:** the data engine (`jobs`, `workflowByProject`, `stagesByWorkflow`, `prefixMap`, `loadJobs`/`loadStages`, `loadGenRef`), the realtime channel + debounce + visibility gate, `?forecastSub=` routing, the shared `error` banner, and `refreshStages`. Promote to `src/hooks/useProjectsForecastEngine.ts` only if All Steps ever needs writes.
- **In `ProjectsForecastSpecificTab.tsx`:** `selectedJobId` + the `?forecastJob=`/localStorage router, `openStageId`/`alignModalOpen`/`insertAfterStageId` (modal pointers opened from gutter, bar and toolbar), the three modal mounts, and whichever hooks own the overlay cluster and the money layer (the tab destructures them; children receive values + callbacks).
- **In `ProjectsForecastSpecificStageModal.tsx`:** `detail`/`load`/`touched`, `lineItemsRefreshNonceRef`, ESC/scroll-lock/backdrop-confirm shell behavior, and `canEdit`.
- **In `ProjectsJobHistoryTab.tsx` (host):** the `dayModal` pointer, day-swapping (`onDayModalSelectWorkDate`), and the Edit Job / Job Detail openers.
- **In `ProjectsJobHistoryDayModal.tsx`:** the loader (or its hook call), `expandedReportIds`/`expandedCostRows` (UI state), and the role gate.

## The biggest hazard

The **optimistic-overlay cluster is one mechanism, not four features**: `dragOverrides` is written by the drag move handler, the drag commit, AND the insert cascade; `effectiveResolvedBars` is simultaneously the render source, the drag baseline (`stagesForDragRef`), the insert-plan input and the balance strip's bar source; and the four reconcilers + the job-switch reset are the only things preventing stale-overlay ghosts and snap-back flicker across the ~280ms realtime window. Extract it whole (step 8) before touching drag or insert — splitting it piecemeal, or letting a child own any overlay slice, breaks chained drags, the no-snap-back guarantee, or the same-frame insert render (v2.55x–v2.562 fixes). The second hazard is quieter: **the money numbers on both files have no test above the kernels** — do steps 1–2 before moving any money-rendering code, so a move can't silently change a total.

Definition of done per step, verification gates (`npm run typecheck && npm run lint && npm test` after every move), and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md).
