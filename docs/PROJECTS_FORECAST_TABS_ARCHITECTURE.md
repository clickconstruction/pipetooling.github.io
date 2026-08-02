# Projects Forecast Tabs Architecture Map

---
file: docs/PROJECTS_FORECAST_TABS_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map (per PAGE_DECOMPOSITION_PLAYBOOK.md) for the Projects → Forecast → Specific surface — ProjectsForecastSpecificTab.tsx (2,326 lines) + ProjectsForecastSpecificStageModal.tsx (1,465 lines). Inventories every logical region's state, handlers, memos, supabase tables/RPCs, sub-components, and cross-region coupling so a future extraction can proceed without re-deriving the strategy.
audience: Developers, AI Agents
last_updated: 2026-08-02
key_sections:
  - "What this surface is"
  - "Master summary table"
  - "The shared substrate"
  - "ProjectsForecastSpecificTab.tsx — region dossiers"
  - "ProjectsForecastSpecificStageModal.tsx — region dossiers"
  - "Stage-A pure-logic inventory"
  - "Preserve-quirks list"
  - "Recommended extraction order"
  - "What must stay in the parent"
---

## What this surface is

Two files render the **Projects → Forecast → Specific** sub-tab (a per-job sparse/dense Gantt of `project_workflow_steps` with in-place drag editing, stage insertion, % complete tracking, and a stage-detail modal):

| File | Lines (2026-07-29) | Role |
|---|---|---|
| [`src/components/projects/ProjectsForecastSpecificTab.tsx`](../src/components/projects/ProjectsForecastSpecificTab.tsx) | 2,326 | The sub-tab: toolbar, job picker, sparse/dense Gantt orchestration, drag-edit engine, optimistic-overlay engine, 3 module-level presentational components |
| [`src/components/projects/ProjectsForecastSpecificStageModal.tsx`](../src/components/projects/ProjectsForecastSpecificStageModal.tsx) | 1,465 | The stage-detail modal: full-row readout + bundled Save editor (name / assignee / dates / length), save-on-blur notes ×2, header % editor, mounts the extracted line-items section |

Unlike the classic God pages (`Materials.tsx`, `Estimates.tsx`), this surface is **already the product of the playbook's method** — it lives under `src/components/projects/`, is fed by a thin 258-line data-owning parent ([`ProjectsForecastTab.tsx`](../src/components/projects/ProjectsForecastTab.tsx)), and its calculation layer is **already Stage-A complete**: nine `src/lib/projectsForecast*.ts` modules with colocated tests (`StageResolver`, `SpecificColumns`, `SpecificWindow`, `DragEdit`, `InsertStage`, `AlignStages`, `JobSearch`, `Colors`, `ToolbarStyles`), plus `fetchForecastStageDetail.ts`, `projectsForecastData.ts`, `projectsForecastStageLineItems.ts`, and `parsePercentCompleteInput.ts`. Both files each hold exactly 18 `useState`s. The remaining size is UI regions + the optimistic-overlay orchestration, so this map is about **sub-decomposition**: which regions can move to their own files/hooks, and which form an atomic cluster that must move together or not at all.

Sibling components already extracted (render targets, not extraction work): `ProjectsForecastTimelineGrid.tsx` (626 — dense grid, `forwardRef` handle), `ProjectsForecastSpecificGrid.tsx` (502 — sparse grid), `ProjectsForecastAlignStagesModal.tsx` (636 — owns its own `project_workflow_steps` writes), `ProjectsForecastInsertStageModal.tsx` (467 — pure form; the INSERT lives in the tab), `ProjectsForecastStageLineItemsSection.tsx` (1,023 — owns `workflow_step_line_items` CRUD via `projectsForecastStageLineItems.ts`).

**Churn:** the surface was built in a rapid burst at v2.552–v2.563 (creation → gutter chip display-numbers v2.553/554 → drag-edit + align + insert-stage → `%` column v2.559 → today-anchored 180-day window + pan pillars v2.560 → `%` optimistic persistence v2.562). `docs/RECENT_FEATURES.md` has **no entries touching either file after v2.563** (current app version v2.1088), so the surface is now **low-churn** — same posture as Materials: map written proactively, no extraction scheduled. One post-burst drive-by: the v2.662 controller-role sweep added `'controller'` to both `EDITOR_ROLES` (modal) and `ALIGN_EDITOR_ROLES` (lib) — the JSDoc comments still say "4 roles"; the sets have 5.

### How to read a dossier

Each region lists: render/definition location (anchored by symbol — line numbers are "as of v2.1088" and rot; search the symbol), **owned local state** (moves with the region), **cross-region/shared state** (stays where it is), **derived memos**, **handlers/functions**, **supabase tables + RPCs**, **sub-components** (extracted vs inline), **external coupling**, and an **extraction status + risk + approach**.

---

## Master summary table

| Region | File | Lines est. | Coupling | Risk | Status |
|---|---|---|---|---|---|
| Job selection + URL/localStorage router | Tab | ~180 (state/handlers ~80, dropdown JSX ~100) | low (writes `selectedJobId`, which everything reads) | low | inline — **stays in the tab** (it IS the tab's deep-link router) |
| Optimistic-overlay engine (`effectiveResolvedBars` + 4 reconcilers) | Tab | ~230 | **highest** — written by drag, insert, and % commit; read by both grids, modal, drag baseline | high | inline — the seam; extract as `useForecastSpecificOverlays` hook first |
| Drag-edit engine (pointer sessions + commit) | Tab | ~280 | high (writes `dragOverrides`; reads `stagesForDragRef` off `effectiveResolvedBars`) | med-high | inline — extract as `useForecastDragEdit` after/with the overlay hook |
| Insert-stage flow | Tab | ~160 | high (writes `dragOverrides` + both pending maps) | med | inline — moves with the overlay hook or stays until it exists |
| Percent-complete column | Tab | ~70 (+ cell inside `StageGutterLabel`) | med (writes `pendingPercentByStageId`; gated on `dragEdit`) | low-med | inline |
| Dense-window panning + Today reset | Tab | ~130 | low (self-contained; talks to grid via `denseGridRef` handle) | low | inline — clean hook candidate `useForecastSpecificPanWindow` |
| Toolbar + grid/modal mounts (JSX) | Tab | ~330 | n/a (renders everything above) | — | stays in the tab |
| `StageGutterLabel` + `PercentColumnGutterHeader` | Tab (module-level) | ~290 | low (props-only) | **lowest** | inline components — **pure file move, extract first** |
| `SpecificDenseStageBar` | Tab (module-level) | ~160 | low (props-only; imports `forecastBarColumnSpan` from grid file) | **lowest** | inline component — pure file move |
| Module-level pure helpers (dates/format/status) | Modal | ~120 | none | **lowest** | inline — Stage-A move to `lib/*` + tests |
| Detail load + seed effect | Modal | ~80 | med (everything reads `detail`) | med | stays in the modal shell |
| Bundled Save editor (name/assignee/dates/length) | Modal | ~380 (state+handlers ~150, JSX ~230) | med (start/end/length coupling logic is pure → Stage A) | med | inline — extract the coupling math, then optionally the section component |
| Notes ×2 (save-on-blur, RPC + fallback) | Modal | ~130 + `NotesCollapsible` ~80 | low | low | `NotesCollapsible` is already a module component — file move |
| Header % editor | Modal | ~150 (`HeaderPercentCompleteEditor` + `savePercent` + styles) | low | low | module component — file move |
| Line Items For Office | Modal | ~10 (mount) | — | — | **already extracted** (`ProjectsForecastStageLineItemsSection`, 1,023 lines) |
| `DetailField`, `ReasonBlock`, style consts | Modal | ~150 | none | lowest | move with whichever section takes them |

---

## The shared substrate

Two layers, both already in the shape the playbook prescribes:

1. **The data engine lives in the parent, `ProjectsForecastTab.tsx`** — the Bids `useBidPricingEngine` equivalent, except it's parent component state rather than a named hook: `jobs`, `workflowByProject`, `stagesByWorkflow`, `prefixMap`, `loadingJobs`/`loadingStages`, `loadJobs`/`loadStages` (generation-guarded via `loadGenRef`), and the realtime channel `projects-forecast-${authUserId}` on `project_workflow_steps` (workflow-ID `in.()` filter, cap `MAX_REALTIME_IN_IDS = 80`, unfiltered fallback) + `jobs_ledger`, debounced `REALTIME_DEBOUNCE_MS = 280` with a `useDocumentVisibility` gate. It hands the Specific tab everything via `sharedProps` (memoized), including `refreshStages: () => void loadStages(true)`. The Specific tab performs **writes only** — every read arrives as props and every write is reconciled by the parent's realtime → `loadStages` → new `stagesByWorkflow` → new `resolvedBars`.

2. **The selection pointer is `selectedJobId`**, owned by the Specific tab itself (not the parent): synced to URL `?forecastJob=` (via `useSearchParams`, `replace: true`) and localStorage `projects_forecast_specific_selected_job_v1` (`SELECTED_JOB_STORAGE_KEY`; read priority URL > localStorage via `readStoredJobId`). The All Steps sub-tab (label renamed from “All Stages”; component file `ProjectsForecastAllStagesTab.tsx` keeps its name) has no selection — so, like People, **only data is shared across sub-tabs, not a UI selection**. Sub-tab routing (`?forecastSub=`) lives in `ProjectsForecastTab`.

3. **Within the tab, the intra-tab substrate is `effectiveResolvedBars`** — `resolvedBars` (= pure `resolveForecastStages(selectedStages, todayYmd)`) merged with **four optimistic overlays**: `dragOverrides` (date shifts), `pendingSequenceOrderBumps`, `pendingInsertedRows`, `pendingPercentByStageId`. Every interactive region reads it (dense grid rows, drag baseline `dragStages`/`stagesForDragRef`, insert inputs `insertStageInputs`, modal lookup `openStageBar`), and three regions write its overlay inputs. Four reconciler effects drop overlay entries once `resolvedBars` catches up from the parent's realtime refetch, and a job-switch effect (`[selectedJobId]`) clears all four overlays + both pan overrides. **This overlay cluster is the extraction seam** — the equivalent of Bids' pricing engine: any sub-decomposition of drag-edit, insert, or % editing must first lift this cluster into a hook (suggested: `src/hooks/useForecastSpecificOverlays.ts`) or move the writers together with it.

Consequence for extraction: there is **no missing seam to invent** — the parent hook boundary exists (props), the pure logic is out (lib + tests), and the remaining risky coupling is entirely the overlay cluster inside the tab.

---

## ProjectsForecastSpecificTab.tsx — region dossiers

Props contract (all parent-owned): `jobs`, `workflowByProject`, `stagesByWorkflow`, `prefixMap`, `loading`, `myRole`, `refreshStages?`.

### Job selection + URL/localStorage router

- **Location:** module helpers `readStoredJobId` / `writeStoredJobId` / `buildJobLabel` (~155–198); state + URL-sync effect + `setSelectedJobId` (~209–282); search memo/effect/handler (~481–511); toolbar search-input + dropdown JSX (~1216–1301).
- **Owned local state:** `selectedJobId` (`setSelectedJobIdState`), `jobSearch`, `jobSearchOpen`, `wrapRef` (click-outside).
- **Cross-region/shared:** everything downstream keys off `selectedJobId` (`selectedJob`, `selectedWorkflowId`, `selectedStages`, the job-switch reset effect, `autoCenterTodayResetKey`). URL param `forecastJob` is the deep link.
- **Derived memos:** `selectedJob`, `selectedWorkflowId`, `selectedStages`, `filteredJobChoices` (empty query → selected job + first 15 others; else `filterForecastJobsBySearch(...)` capped at 25).
- **Handlers:** `setSelectedJobId` (state + localStorage + URLSearchParams write), `onPickJob`; URL→state sync effect on `urlJobId`; mousedown click-outside effect.
- **Supabase:** none (reads props only).
- **External coupling:** `?forecastJob=` deep link; localStorage `projects_forecast_specific_selected_job_v1`; lib `projectsForecastJobSearch.ts`, `ledgerDisplayPrefixes.ts`.
- **Extraction status + risk + approach:** Inline, **stays in the tab** — this is the tab's URL router and the playbook keeps routers with the component that owns the selection. If the tab is ever split further, this region is the "parent" the pieces report to.

### Optimistic-overlay engine (the seam)

- **Location:** overlay state declarations (~230–261), `effectiveResolvedBars` memo (~312–349), four reconciler effects (~1105–1166), job-switch reset effect (~1175–1182).
- **Owned local state:** `dragOverrides: ReadonlyMap<string, DragEditOverride>`, `pendingInsertedRows: readonly ResolvedStageBar[]`, `pendingSequenceOrderBumps: ReadonlyMap<string, number>`, `pendingPercentByStageId: ReadonlyMap<string, number | null>`, `dragSaving: boolean` (shared save-in-flight flag for drag commits AND inserts — greys the `+` buttons so concurrent writers can't race on `sequence_order`).
- **Cross-region/shared:** written by the drag-edit engine, the insert flow, and `onCommitPercentComplete`; read by `effectiveResolvedBars`, which feeds the dense grid, `dragStages`/`stagesForDragRef`, `insertStageInputs`, `openStageBar`, and the insert modal's "After: Step N" lookup. `resolvedBars` (pure memo off props) is the reconciliation target.
- **Derived memos:** `resolvedBars` (= `resolveForecastStages(selectedStages, todayYmd)`), `effectiveResolvedBars` (merge; **sorts by `sequenceOrder` only when bumps or pending rows exist** — drag-only edits deliberately skip the sort AND the bump merge to preserve per-tick allocation), `layout` (= `buildSpecificForecastColumns(...)` off **`resolvedBars`, not effective** — sparse columns don't reflow mid-drag), `spanByStageId`, `anyStageHasPercent`.
- **Handlers:** none directly — the reconcilers are effects: (1) drop `dragOverrides` entries whose `startYmd`/`endYmd` match `resolvedBars`; (2) drop `pendingInsertedRows` whose `stageId` arrived; (3) drop `pendingSequenceOrderBumps` whose persisted `sequenceOrder` matches; (4) drop `pendingPercentByStageId` on match. Each has an empty-collection early return to prevent effect loops. The reset effect on `[selectedJobId]` clears all four + `extendedRangeLeftYmd`/`RightYmd`.
- **Supabase:** none itself (the writers below own the writes).
- **Extraction status + risk + approach:** Inline. **Highest coupling on the surface** — this is the tab's `useBidPricingEngine` moment. Extract as `src/hooks/useForecastSpecificOverlays.ts` taking `(resolvedBars, selectedJobId)` and returning `{ effectiveResolvedBars, dragOverrides, setDragOverrides, pendingInsertedRows, setPendingInsertedRows, pendingSequenceOrderBumps, setPendingSequenceOrderBumps, pendingPercentByStageId, setPendingPercentByStageId, dragSaving, setDragSaving }` — the parent destructures so downstream references don't change. Do NOT split the four overlays apart: the insert flow writes three of them in one gesture and the no-snap-back guarantee depends on the reconcile-not-clear lifecycle.

### Drag-edit engine

- **Location:** `dragEdit` state + `BODY_DRAG_THRESHOLD_PX = 4` const (~137–141, 229); baseline refs (~651–697); `commitDragEdit` (~699–766); `onBarDragStart` (~914–996); `onBarBodyDragStart` (~1006–1090); unmount cleanup effect (~1093–1098); `onToggleDragEdit` (~1184–1201).
- **Owned local state:** `dragEdit` (the page's "Edit" toggle), refs `dragSessionRef` (`{ stageId, startX, originalStages, affectedStageIds, mode: DragEditMode, activated }`), `moveHandlerRef`, `upHandlerRef`, `stagesForDragRef`.
- **Cross-region/shared:** writes `dragOverrides` + `dragSaving` (overlay engine); baseline `dragStages` memo maps `effectiveResolvedBars` (post-override, so chained drags before reconcile use the visual origin); `dragEdit` also gates the `%` column (`canEditPercentComplete`), the `+` insert buttons (`insertButtonVisible`), disables the Show-dates toggle, and force-enables `showDates` when turned on.
- **Handlers:** `teardownDragListeners` (document listeners + `body.style.userSelect`/`cursor` reset), `commitDragEdit` (parallel `Promise.all` of per-row `project_workflow_steps` UPDATEs of `scheduled_start_date`/`scheduled_end_date` via `withSupabaseRetry`; on partial failure deletes ONLY failed ids from `dragOverrides` so failed bars snap back while successful ones hold until reconcile; toast per outcome), `onBarDragStart` (right-edge handle, `mode: 'extend'`, activates immediately, `preventDefault`+`stopPropagation`), `onBarBodyDragStart` (`mode: 'translate'`, activates past 4px so a stationary tap falls through to the bar's `onClick`; after a real drag installs a one-shot capture-phase click `swallow`), `onToggleDragEdit` (blurs any focused `data-forecast-pct="true"` input before leaving edit mode so a pending `0 → null` commit isn't lost on unmount). Per-tick math is pure `buildDragEditPlan(originalStages, stageId, deltaDays, mode)` from `lib/projectsForecastDragEdit.ts`; move handlers delete only `affectedStageIds` before re-applying the plan, preserving pending-reconciliation overrides on unrelated stages.
- **Supabase tables:** `project_workflow_steps` (UPDATE `scheduled_start_date`, `scheduled_end_date`).
- **External coupling:** `FORECAST_COL_W` (px→days conversion) imported from `ProjectsForecastTimelineGrid.tsx`; `canAlignStages(myRole)` gates the toolbar button.
- **Extraction status + risk + approach:** Inline. **Med-high risk** — document-level pointer listeners, refs-over-state idioms, and the overlay writes make this the second-hardest move. Extract as `src/hooks/useForecastDragEdit.ts` AFTER (or together with) the overlay hook, taking the overlay setters + `effectiveResolvedBars` + `showToast` and returning `{ dragEdit, onToggleDragEdit, onBarDragStart, onBarBodyDragStart, dragDisabledReason }`. Stage A is already done (`buildDragEditPlan` + tests).

### Insert-stage flow

- **Location:** `insertAfterStageId` state (~238), `insertStageInputs` memo (~773–783), `onConfirmInsertStage` (~790–912), gutter `+` gating (~525), toolbar "+ Add stage to start" button (~1382–1403), modal mount IIFE (~1506–1538).
- **Owned local state:** `insertAfterStageId: string | null | undefined` — **tri-state**: `undefined` = modal closed, `null` = insert at start (sequence 1), string = insert after that stage id.
- **Cross-region/shared:** writes `dragOverrides` (cascade shifts), `pendingInsertedRows`, `pendingSequenceOrderBumps`, `dragSaving`; reads `selectedWorkflowId`, `effectiveResolvedBars`, `todayYmd`; gated by `insertButtonVisible = dragEdit && canAlignStages(myRole)`.
- **Handlers:** `onConfirmInsertStage(name, lengthDays)` — plan via pure `planInsertStageAfter({ stages, afterStageId, todayYmd, lengthDays })` (`lib/projectsForecastInsertStage.ts`), then: (a) optimistic-merge `plan.shiftedOverrides` into `dragOverrides` pre-DB; (b) serial UPDATEs of `sequence_order` bumps **descending** (highest first, to survive a hypothetical `UNIQUE(workflow_id, sequence_order)`), combining the date shift into the same UPDATE per row; (c) INSERT the new row (`status: 'pending'`, mirroring `Workflow.tsx` `saveStep`) with `.select('id').single()`; then stage the optimistic `ResolvedStageBar` (`colorKey: forecastStageColorKey('pending', false)`, `percentComplete: null`) into `pendingInsertedRows` + bumps into `pendingSequenceOrderBumps` BEFORE closing the modal (one batched transition). Catch: delete only `shiftedIds` from `dragOverrides` + error toast.
- **Supabase tables:** `project_workflow_steps` (UPDATE `sequence_order`/dates; INSERT).
- **Sub-components:** `ProjectsForecastInsertStageModal` (**extracted**, 467 lines, pure form — receives `insertStageInputs`, the display-number/name lookup, `applying={dragSaving}`).
- **Extraction status + risk + approach:** Inline. **Medium risk** — the handler is self-contained but writes three overlay slices, so it moves with (or after) the overlay hook. No Stage A left (`planInsertStageAfter` is tested lib).

### Percent-complete column

- **Location:** gating consts (~525–552), `onCommitPercentComplete` (~557–584), `renderGutterLabel` (~586–615), `PERCENT_CELL_WIDTH_PX = 58` / `PERCENT_HEADER_RIGHT_PADDING_PX = 28` + `PercentColumnGutterHeader` (~1543–1576), percent cell inside `StageGutterLabel` (~1727–1804).
- **Owned local state:** none beyond the shared `pendingPercentByStageId` overlay.
- **Cross-region/shared:** `canEditPercentComplete = dragEdit && canAlignStages(myRole)`; `showPercentColumn = dragEdit || anyStageHasPercent` also drives `labelGutterWidth` 300↔260 on BOTH grids (`anyStageHasPercent` counts pending overlay entries so the column survives the first save).
- **Handlers:** `onCommitPercentComplete(stageId, next)` — optimistic overlay first, then UPDATE `project_workflow_steps.percent_complete` via `withSupabaseRetry`, then `refreshStages?.()` (parent silent refetch — realtime may not fire promptly in dev); on error deletes the overlay entry + toast. Input parsing is shared `parsePercentCompleteInput` (0/empty/negative → `null`; typing `0` clears).
- **Supabase tables:** `project_workflow_steps` (UPDATE `percent_complete`).
- **Extraction status + risk + approach:** Inline, **low-med risk** — moves naturally with `StageGutterLabel` (the cell) + the overlay hook (the state). v2.562 fixed subtle unmount/commit races here; preserve the blur-before-toggle and imperative-blank quirks verbatim.

### Dense-window panning + Today reset

- **Location:** `showDates` state + storage helpers (~135, 176–192, 218–223), pan state + `denseDayKeys` derivation (~382–413), `denseGridRef` + `pendingScrollAdjustPxRef` + pan callbacks + `useLayoutEffect` (~420–478), `onTodayClick` (~460–464), Today button JSX (~1318–1330).
- **Owned local state:** `showDates` (persisted to localStorage `projects_forecast_specific_show_dates_v1`), `extendedRangeLeftYmd`/`extendedRangeRightYmd` (`null` = default window), `todayResetTick` (counter composed into `autoCenterTodayResetKey`), refs `denseGridRef: ForecastTimelineGridHandle`, `pendingScrollAdjustPxRef: number | null` (one-shot, deliberately a ref not state).
- **Cross-region/shared:** `showDates` picks dense vs sparse grid; `dragEdit` force-enables it and disables the toggle; the job-switch reset effect clears both pan overrides (`reset_per_job` UX decision — no persistence).
- **Derived memos:** `denseDayKeys` (`computeForecastSpecificEffectiveWindow(todayYmd, left, right)` → `enumerateDaysInRange`; `[]` when `!showDates`), `denseDayKeyIndex`, `denseRangeStart`/`denseRangeEnd`, `todayYmd` (`todayYmdCentral()`, memoized once).
- **Handlers:** `onPanLeft` (extend left 90 days via `extendForecastSpecificWindowLeft`, stamp `pendingScrollAdjustPxRef = FORECAST_SPECIFIC_EXTEND_DAYS * FORECAST_COL_W`), `onPanRight` (no scroll adjust — new columns are off-screen right), `onTodayClick` (clear both overrides + bump `todayResetTick`), the `useLayoutEffect` keyed on `denseDayKeys.length` that consumes the ref via `denseGridRef.current?.adjustScrollLeftByPx(...)` pre-paint.
- **Supabase:** none.
- **External coupling:** `lib/projectsForecastSpecificWindow.ts` (tested); `ForecastTimelineGridHandle` + `FORECAST_COL_W` from the grid file; `autoCenterTodayResetKey={`${selectedJobId ?? ''}::${todayResetTick}`}` contract with the grid's auto-center effect.
- **Extraction status + risk + approach:** Inline. **Low risk, self-contained** — the cleanest hook candidate on the tab: `useForecastSpecificPanWindow(todayYmd, showDates, selectedJobId)` returning `{ denseDayKeys, denseDayKeyIndex, denseRangeStart, denseRangeEnd, denseGridRef, onPanLeft, onPanRight, onTodayClick, autoCenterTodayResetKey }`. Good momentum-builder if hooks extraction ever starts.

### Toolbar + grid/modal mounts (JSX shell)

- **Location:** the return block (~1214–1540): toolbar row (search wrapper, Today / Edit / Show dates / + Add stage to start / Align stages buttons), dense-vs-sparse grid switch, and three conditional modal mounts.
- **Owned local state:** `openStageId` (stage-modal pointer), `alignModalOpen`.
- **Cross-region/shared:** `openStageBar` memo (lookup in `effectiveResolvedBars`); auto-close effect drops `openStageId` when the stage vanishes from `resolvedBars` (job switch / deletion); `emptyState` string derived from `loading`/`jobs`/`resolvedBars`; `canAlign = canAlignStages(myRole)`, `alignDisabledReason`, `dragDisabledReason`.
- **Sub-components mounted:** `ProjectsForecastTimelineGrid<ResolvedStageBar>` (dense; rows = `effectiveResolvedBars`) / `ProjectsForecastSpecificGrid` (sparse; stages = `resolvedBars` + `layout`) — both receive `renderGutterLabel` (`rowLabel`) and conditional `gutterHeader`; `ProjectsForecastSpecificStageModal`; `ProjectsForecastAlignStagesModal` (receives raw `selectedStages`, writes DB itself, `onApplied` just closes — realtime refreshes the bars); `ProjectsForecastInsertStageModal`.
- **Extraction status:** stays — after the hooks/file-moves above, this shell plus the job router IS the target end-state of the tab (~600–700 lines).

### Module-level components (bottom of file)

- **`PercentColumnGutterHeader`** (~1558–1576): stateless, uses the two `PERCENT_*` consts. **`StageGutterLabel`** (~1578–1848): props-only (`resolved`, `displayNumber`, `onClick`, `insertButtonVisible/Disabled`, `onInsertAfter`, `percentComplete`, `percentEditable`, `onPercentCommit`, `showPercentCell`); renders chip (display number = row position `idx + 1`, NOT raw `sequence_order` — raw value surfaced in the tooltip), name, assignee, the uncontrolled percent input (re-keyed `pct-${stageId}-${percentComplete}`), and the `+` insert button (sibling, not nested — nested `<button>`s are invalid HTML).
- **`SpecificDenseStageBar`** (~1857–2012): one `useState` (`handleHover`); computes span via `forecastBarColumnSpan` (imported from the grid file); renders the bar + right-edge drag handle (12px, `col-resize`, stopPropagation click guard) and wires `onPointerDown` body-drag.
- **Extraction status + risk:** **Lowest risk on the surface — pure file moves.** `StageGutterLabel` + `PercentColumnGutterHeader` + the two `PERCENT_*` consts → `ProjectsForecastStageGutterLabel.tsx`; `SpecificDenseStageBar` → its own file. ~450 lines out of the tab with zero behavior surface.

---

## ProjectsForecastSpecificStageModal.tsx — region dossiers

Props contract: `stage: ResolvedStageBar` (header renders instantly from bar data), `projectId`, `myRole`, `onClose`. Role gate: `EDITOR_ROLES = {dev, master_technician, assistant, superintendent, controller}` via `canEditExpectedDates(myRole)` → `canEdit` (mirrors the `project_workflow_steps` UPDATE RLS).

### Module-level pure helpers

- **Location:** ~86–181: `todayYmdCentral` (duplicate of the tab's), `ymdDaysBetween`, `ymdFromDateLike` (slice 10 — handles both `date` and `timestamptz`), `DATE_FMT_LONG`/`DATETIME_FMT` (`Intl.DateTimeFormat`, `APP_CALENDAR_TZ`), `formatYmdLong` (noon-Central trick to dodge DST/UTC day-shift), `formatTimestamp`, `describeStatus` (status → label/bg/color/border; `rejected` renders as "Previous work incomplete"), `actualDurationLabel`, `wordCount`.
- **Extraction status:** **Stage-A candidates** — zero React, zero closure. See the inventory below.

### Detail load + seed effect (modal shell)

- **Location:** `load` (~217–238), seed effect (~243–259), ESC effect (gated `!saving`), body scroll-lock effect (~271–278), backdrop/`onBackdropClick` (dirty-confirm via `window.confirm`), `openInWorkflow` (`window.open('/workflows/${projectId}#step-${stageId}')` with `location.href` fallback), header/footer JSX.
- **Owned local state:** `detail: ForecastStageDetail | null`, `loading`, `loadError`, `touched` (guards the seed effect — a mid-edit user is never reset by realtime/refetch; reset to `false` after every successful save so the refetch re-seeds).
- **Handlers:** `load` via `fetchForecastStageDetail(stage.stageId)` — `null` result ⇒ "no longer accessible" error state.
- **Supabase tables:** `project_workflow_steps` (SELECT `*` `.maybeSingle()`; second SELECT for the next sibling — `workflow_id` match, `sequence_order` strictly greater, `limit(1)`) — both inside `lib/fetchForecastStageDetail.ts`.
- **Extraction status:** stays — this is the modal's spine.

### Bundled Save editor (Adjust stage)

- **Location:** form state (~194–200), validation derivations (~280–302), coupling handlers (~304–376), `handleSave` (~378–428), `handleClearDates` (~527–548), editor JSX (~822–1006), footer buttons (~1097–1134).
- **Owned local state:** `startVal`, `endVal`, `lengthVal`, `alsoPushNext`, `nameVal`, `assignedToVal`, `saving`, `saveError`.
- **Derived:** `dirty` memo (vs `detail.step` originals; `alsoPushNext` alone counts as dirty), `lengthNum`/`lengthInvalid`, `between`/`endBeforeStart`, `nameInvalid`, `saveDisabled`.
- **Handlers:** `handleStartChange` / `handleEndChange` / `handleLengthChange` / `extendEndByDays(days)` / `setStartToToday` / `setEndToToday` — the start/end/length auto-coupling that deliberately mirrors the Workflow page's Expected Dates modal ("+1 month" = 30-day approximation, tooltip says so); `handleSave` — single UPDATE of `{name, assigned_to_name, scheduled_start_date, scheduled_end_date}` on `detail.step.id`, then (if `alsoPushNext && detail.nextStage && endToWrite`) a second UPDATE setting the sibling's `scheduled_start_date = endToWrite` (failure of the second is a toast, not a rollback), then `setTouched(false)`, `lineItemsRefreshNonceRef.current += 1`, `await load()`; `handleClearDates` — UPDATE both dates to `null`.
- **Supabase tables:** `project_workflow_steps` (UPDATE ×2).
- **Extraction status + risk + approach:** Inline. **Medium risk.** Stage A first: the start/end/length coupling is pure state math — extract as `lib/projectsForecastStageDates.ts` (e.g. `applyStartChange`, `applyEndChange`, `applyLengthChange`, `applyExtendEnd`, each `(current: {startVal,endVal,lengthVal}, input) → next`) + tests; check whether Workflow's Expected Dates modal already has an extractable twin so both surfaces share one kernel. Then the section can become `ProjectsForecastStageAdjustSection` if wanted (takes `detail`, returns via callbacks) — but the win is modest; the JSX is straight-line.

### Notes ×2 (Notes for Tech / Notes for Office)

- **Location:** `saveNotes` (~434–464), `savePrivateNotes` (~466–496), mounts (~1017–1052), `NotesCollapsible` module component (~1149–1228).
- **Owned local state:** `notesExpanded` / `privateNotesExpanded` (`boolean | null` — `null` = "use default: expanded iff non-empty", matching Workflow's `isSectionDefaultExpanded`), `savingNotes`, `savingPrivateNotes`.
- **Handlers:** both save on textarea blur, skip no-op writes, and use **RPC-first with fallback**: `supabase.rpc('update_step_notes', {p_step_id, p_notes})` / `rpc('update_step_private_notes', {p_step_id, p_private_notes})`; when the error message includes `'Could not find the function'` they fall back to a direct UPDATE of `notes` / `private_notes`. Then `await load()`.
- **Supabase:** RPCs `update_step_notes`, `update_step_private_notes`; table `project_workflow_steps` (fallback UPDATE).
- **Sub-components:** `NotesCollapsible` — uncontrolled textarea, `key = textareaKey` (includes the persisted value so refetches re-key it), fully props-driven.
- **Extraction status + risk:** **Low.** `NotesCollapsible` is a pure file move. The two save callbacks could collapse into one parameterized helper during a later (non-behavior-preserving) pass — do NOT merge them during the move.

### Header % editor

- **Location:** `savePercent` (~503–525), mount in header (~707–715), `HeaderPercentCompleteEditor` module component (~1255–1315), `headerPercent*` style consts (~1400–1465).
- **Owned local state:** `savingPercent`.
- **Handlers:** `savePercent(next)` — early-return when `next === detail.step.percent_complete ?? null`; UPDATE `percent_complete`; toast on error; `await load()`. Input semantics identical to the tab's gutter cell: `parsePercentCompleteInput`, re-key `pct-header-${stageId}-${percentComplete}`, imperative DOM blank when parser returns null but the field shows text.
- **Supabase tables:** `project_workflow_steps` (UPDATE `percent_complete`).
- **Extraction status + risk:** **Low** — `HeaderPercentCompleteEditor` + its styles are a pure file move; note it intentionally does NOT use the tab's optimistic overlay (the modal refetches itself; the tab's grid catches up via realtime/`refreshStages`).

### Line Items For Office (already extracted)

- **Location:** mount only (~1057–1064): `<ProjectsForecastStageLineItemsSection stepId={step.id} stepName={step.name} myRole={myRole} refreshNonce={lineItemsRefreshNonceRef.current} />`, gated on `canEdit`; `lineItemsRefreshNonceRef` bumps after the bundled Save.
- **Supabase (inside the extracted component/lib):** `workflow_step_line_items` (SELECT/INSERT/DELETE via `lib/projectsForecastStageLineItems.ts`), `purchase_orders`, `purchase_order_items`, `supply_house_invoices` (picker reads). Populated PO/invoice pickers render only for dev / master_technician.
- **Extraction status:** **Done** — the target end-state pattern for the other modal sections.

### Presentational leftovers

`DetailField`, `ReasonBlock` (~1317–1344) and the shared style consts `dateInputStyle`, `chipBtnStyle`, `chipBtnPrimaryStyle`, `footerSecondaryStyle`, `footerPrimaryStyle` — move with whichever section extraction takes them; individually not worth a file.

---

## Stage-A pure-logic inventory

The heavy calc is **already in `lib/*` with tests** (resolver, sparse columns, window, drag plan, insert plan, align plan, job search, percent parsing). What remains inline:

| Candidate | Currently | Target |
|---|---|---|
| `todayYmdCentral` | **duplicated** in both files (deliberate local-clock stance documented in each) | one export in `lib/` (or `utils/dateUtils.ts`) + test; keep the stance comment |
| `ymdDaysBetween`, `ymdFromDateLike` | module-level in the modal | `lib/projectsForecastStageDetailFormat.ts` (or fold into `utils/dateUtils.ts` — check for existing equivalents first) + tests |
| `formatYmdLong` (noon-Central), `formatTimestamp`, `DATE_FMT_LONG`/`DATETIME_FMT` | module-level in the modal | same module + tests (pin the DST/day-shift behavior) |
| `describeStatus`, `actualDurationLabel`, `wordCount` | module-level in the modal | same module + tests (`describeStatus` pins the `rejected` → "Previous work incomplete" label) |
| start/end/length coupling (`handleStartChange`/`handleEndChange`/`handleLengthChange`/`extendEndByDays`) | closures over modal state | `lib/projectsForecastStageDates.ts` pure transitions + tests; look for a shareable twin in Workflow's Expected Dates modal |
| `readStoredJobId`/`writeStoredJobId`, `readShowDates`/`writeShowDates` | module-level in the tab (localStorage IO) | optional — thin IO wrappers; low value, fine to leave |
| `buildJobLabel` | module-level in the tab (pure over lib helpers) | optional move to `lib/projectsForecastJobSearch.ts` if a second caller appears |

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during a move)

1. **Local-clock "today"** (`todayYmdCentral`) — both files deliberately use browser-local time, not `APP_CALENDAR_TZ`; the rationale comments must travel with any dedupe.
2. **Drag-only edits skip the sort** in `effectiveResolvedBars` (and the bump merge) — preserves per-tick allocation; sorting fires only when bumps or pending rows exist.
3. **No snap-back lifecycle:** `commitDragEdit` never clears successful overrides — the reconciler drops them when `resolvedBars` catches up; only failed ids are cleared (visual revert = rejection signal).
4. **Sequence bumps write DESCENDING**, date shift combined into the same UPDATE per row (single-touch per row; survives a hypothetical UNIQUE index).
5. **Tri-state `insertAfterStageId`** (`undefined` closed / `null` at-start / string after-id) — do not collapse to `string | null`.
6. **`BODY_DRAG_THRESHOLD_PX = 4`** body-drag activation + the one-shot capture-phase click `swallow` after a real drag; right-edge drags activate immediately.
7. **`onToggleDragEdit` blurs `data-forecast-pct="true"` inputs** before leaving edit mode — the `0 → null` clear commits before the input unmounts (v2.562 fix).
8. **`parsePercentCompleteInput` maps `0` to `null`** (typing 0 clears) + the imperative `e.currentTarget.value = ''` blank in BOTH the gutter cell and the header editor (covers the `next === persisted` no-op-commit case).
9. **Pan clicks never move the viewport**: `←` compensates via `pendingScrollAdjustPxRef` (a ref, one-shot, consumed in a `useLayoutEffect` keyed on `denseDayKeys.length` — pre-paint); `→` needs no adjustment. `autoCenterTodayResetKey = ${selectedJobId}::${todayResetTick}` is the only re-center trigger.
10. **Window resets per job** (`reset_per_job`): the `[selectedJobId]` effect clears all four overlays AND both pan overrides; no persistence of pan state.
11. **`labelGutterWidth` 300↔260 flip** driven by `showPercentColumn` on both grids; `anyStageHasPercent` counts pending overlay entries so the column doesn't vanish right after the first save.
12. **Chip shows row position (`idx + 1`), not raw `sequence_order`** — raw value lives in the tooltip; the insert modal's "After: Step N" uses the same display number.
13. **Notes RPC-first with `'Could not find the function'` string-match fallback** to a direct UPDATE — keep both paths and the exact match string.
14. **Seed-once gated on `touched`** in the modal — realtime/refetch never clobbers a mid-edit form; `setTouched(false)` after save is what re-arms the seeding.
15. **`alsoPushNext` second UPDATE failure is a toast, not a rollback** — the primary save stands.
16. **"+1 month" = 30 days** (tooltip documents the approximation).
17. **`EDITOR_ROLES`/`ALIGN_EDITOR_ROLES` contain 5 roles including `controller`** (v2.662 sweep) while nearby JSDoc says "4 roles" — trust the Sets; if you touch the comments, fix them, but never shrink the Sets.
18. **`layout` (sparse columns) derives from `resolvedBars`, not `effectiveResolvedBars`** — sparse mode intentionally ignores in-flight overlays (drag-edit forces dense mode anyway).
19. **`percent_complete` writes take three different consistency paths** — gutter: optimistic overlay + `refreshStages()`; modal header: self-refetch (`load()`); both settle through the parent realtime. Keep all three.
20. **localStorage keys** `projects_forecast_specific_selected_job_v1`, `projects_forecast_specific_show_dates_v1` — versioned names; URL `?forecastJob=` wins over storage on read.

---

## Recommended extraction order (value ÷ risk)

The surface is low-churn and already playbook-shaped — **no extraction is scheduled**. When one starts:

1. **Module-component file moves (tab)** — `StageGutterLabel` + `PercentColumnGutterHeader` (+ `PERCENT_*` consts) → `ProjectsForecastStageGutterLabel.tsx`; `SpecificDenseStageBar` → own file. ~450 lines, zero risk, pure moves.
2. **Module-component file moves (modal)** — `NotesCollapsible`, `HeaderPercentCompleteEditor` (+ `headerPercent*` styles), optionally `DetailField`/`ReasonBlock`. ~300 lines, zero risk.
3. **Stage-A sweep (modal)** — the pure-helper table above: date/format/status helpers + the start/end/length coupling kernel, each with tests. Independently shippable; the coupling kernel is the highest-value item (pins the Workflow-parity behavior).
4. **`useForecastSpecificPanWindow` hook** — self-contained, validates the hook seam cheaply (the `po-generator`-equivalent momentum builder).
5. **`useForecastSpecificOverlays` hook (the seam)** — all four overlay maps + `dragSaving` + the four reconcilers + the job-switch reset + `effectiveResolvedBars`. Everything in steps 6–7 depends on this existing first.
6. **`useForecastDragEdit` hook** — pointer sessions, `commitDragEdit`, `onToggleDragEdit`; consumes the overlay hook's setters.
7. **Insert flow** — `onConfirmInsertStage` + `insertAfterStageId` either into a small `useForecastInsertStage` or left in the slimmed tab; it's one handler once the overlays are hooked.

After 1–7 the tab is the job router + toolbar + grid mounts (~600–700 lines) and the modal is shell + Adjust-stage section (~700–800), both at healthy sizes.

## What must stay in the parent

- **In `ProjectsForecastTab.tsx` (never moves into the sub-tab):** the data engine (`jobs`, `workflowByProject`, `stagesByWorkflow`, `prefixMap`, `loadJobs`/`loadStages`, `loadGenRef`), the realtime channel + debounce + visibility gate, `?forecastSub=` routing, the shared `error` banner, and `refreshStages`. If All Steps ever needs writes, promote this layer to `src/hooks/useProjectsForecastEngine.ts` — but as parent state it already satisfies the playbook's seam rule.
- **In `ProjectsForecastSpecificTab.tsx` (never moves into a child/hook consumer):** `selectedJobId` + the `?forecastJob=`/localStorage router, `openStageId`/`alignModalOpen`/`insertAfterStageId` (modal pointers — modals are opened from multiple regions: gutter, bar, toolbar), the three modal mounts, and whichever hook owns the overlay cluster (the tab destructures it; children receive values + callbacks as controlled props).
- **In `ProjectsForecastSpecificStageModal.tsx`:** `detail`/`load`/`touched` (every section reads `detail`; every save re-arms via `setTouched(false)` + `load()`), `lineItemsRefreshNonceRef`, ESC/scroll-lock/backdrop-confirm shell behavior, and `canEdit`.

## The biggest hazard

The **optimistic-overlay cluster is one mechanism, not four features**: `dragOverrides` is written by the drag move handler, the drag commit, AND the insert cascade; `effectiveResolvedBars` is simultaneously the render source, the drag baseline (`stagesForDragRef`), and the insert-plan input; and the four reconcilers + the job-switch reset are the only things preventing stale-overlay ghosts and snap-back flicker across the ~280ms realtime window. Extract it whole (step 5) before touching drag or insert — splitting it piecemeal, or letting a child own any overlay slice, breaks chained drags, the no-snap-back guarantee, or the same-frame insert render, all of which were individually hard-won fixes (v2.55x–v2.562).

Definition of done per step, verification gates (`npm run typecheck && npm run lint && npm test` after every move), and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md).
