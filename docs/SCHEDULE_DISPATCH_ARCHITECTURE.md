# Schedule Dispatch Hub Architecture Map

---
file: docs/SCHEDULE_DISPATCH_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map (per PAGE_DECOMPOSITION_PLAYBOOK.md) for the Schedule Dispatch hub surface — ScheduleDispatchHub.tsx (~3,302 lines, presentational) + ScheduleDispatchHubPage.tsx (~2,384 lines, container), treated as one hot ~5.7k-line surface. Inventories every panel/region's state, memos, handlers, supabase tables/RPCs, and cross-region coupling so extraction can start without re-deriving the strategy.
audience: Developers, AI Agents
last_updated: 2026-08-13
---

## What this surface is

> **Anchors since v2.1613:** schedule blocks anchor to **exactly one of a job or a bid** (`job_schedule_blocks.job_id` is nullable; `bid_id` + one-anchor CHECK). Hub plumbing carries an opaque **anchor id** — the job uuid, or `bid:<uuid>` — produced by `scheduleBlockAnchorId()` and decoded by `scheduleBlockAnchorFromId()` (both in [`jobScheduleBlocks.ts`](../src/lib/jobScheduleBlocks.ts)); `hubJobTitleById` / `hubJobAddressById` carry `bid:`-keyed entries so every id-keyed lookup just works. The linked-group primitives (`updateJobScheduleBlockGroup`, `fetchJobScheduleBlockGroupLegs`, `move_job_schedule_block_group`) are **group-keyed** — they no longer take/filter by job. Job-only affordances (Job Detail, job week `?jobId=`, team fetch, week summaries) skip bid anchors.

The Schedule Dispatch hub is the week-grid scheduling surface at `/schedule-dispatch`. It is **already split into the playbook's two layers**, but both halves are individually oversized and hot (both files rank in the repo's top churn — dozens of `RECENT_FEATURES.md` entries touch them):

- [`src/components/schedule/ScheduleDispatchHubPage.tsx`](../src/components/schedule/ScheduleDispatchHubPage.tsx) (~2,384 lines) — the **container**: URL router, the `loadHub` data engine (all supabase IO), the interaction-mode state machine (card placement / linked copy / assign-job placement / multi-cell add), every mutation handler, and seven page-level modals. ~51 `useState`s.
- [`src/components/schedule/ScheduleDispatchHub.tsx`](../src/components/schedule/ScheduleDispatchHub.tsx) (~3,302 lines) — the **presentational** layer: one exported orchestrator (`ScheduleDispatchHub`) plus four in-file components (`HubJobsPanel`, `HubPeopleBlockCard`, `HubPeopleDayCell`, `HubPeoplePanel`). **Zero supabase access** — everything arrives as props (the exported `Props` type is ~90 fields). ~11 `useState`s, all UI-local.

**Relationship:** `ScheduleDispatchHubPage` owns 100% of the data and mode state and renders `<ScheduleDispatchHub …/>` inside a `DndContext`. The Hub component never mutates anything itself; it calls `on*` callbacks. So decomposition here is **not** the usual "pull state out of a God page" — it is (a) splitting the Hub file into per-panel component files (pure file moves), and (b) carving the Page's state clusters into hooks.

**Mounts (both must keep working):**
1. [`src/pages/ScheduleDispatch.tsx`](../src/pages/ScheduleDispatch.tsx) — thin router: no `?jobId=` → `<ScheduleDispatchHubPage variant="url" />`; with `?jobId=` → the separate `ScheduleDispatchJobWeek` (NOT this surface).
2. [`QuickfillTomorrowsScheduleSection`](../src/components/quickfill/QuickfillTomorrowsScheduleSection.tsx) — `<ScheduleDispatchHubPage variant="tomorrow" />`: single-day (tomorrow) embed; hides tabs, week nav, weekend toggle, Expected Manpower (the `showHubViewTabs` / `showWeekNavigation` / `showExpectedManpower` / `showHideWeekendToggle` props).

The hub view is tab-switched on `hubTab: 'people' | 'jobs' | 'day'` (URL `?hubTab=`, default `people`; local state in the tomorrow variant). The Day tab is **already a thin wrapper** around the extracted [`QuickfillScheduleSection`](../src/components/quickfill/QuickfillScheduleSection.tsx).

### How to read a dossier

Line numbers are "as of v2.1088" and rot — search the symbol. Each dossier lists: render location, **owned local state** (moves with the region), **cross-region/shared state** (stays in the parent), derived memos, handlers, supabase tables/RPCs, sub-components (extracted vs inline), external coupling, and extraction status + risk + approach.

### How to maintain this doc

Update the relevant dossier whenever a region is extracted or its state/handlers change; flip its Status and point at the new file. Prefer symbol names over line numbers.

---

## Master summary table

| Region | File | Anchor | Lines est. | Coupling | Risk | Status |
|---|---|---|---|---|---|---|
| Hub shell (tab bar, week nav, Dispatch Settings) | Hub | `export function ScheduleDispatchHub` (~2695–3061) | ~365 + ~90-line `Props` type | med (fans all props to panels; two `HubPeoplePanel` mounts) | low | inline — stays as coordinator |
| `jobs` tab — `HubJobsPanel` | Hub | `function HubJobsPanel` (~117–356) | ~240 | **low** (12 props, 2 own states) | **low** | inline — **extract first** |
| Block card + day cell — `HubPeopleBlockCard` / `HubPeopleDayCell` | Hub | ~358–1172 | ~815 | med (dnd-kit ids, mode flags, note-requirement context) | low-med | inline — pure file move as a pair |
| `people` tab — `HubPeoplePanel` | Hub | `function HubPeoplePanel` (~1174–2574) | ~1,400 | high (~55 props; rendered from two branches) | med | inline — extract after card/cell |
| Expected Manpower section | Hub | inside `HubPeoplePanel` (~2105–2571 + memos ~1352–1419) | ~530 | low-med (reads `hubWeekBlocks`, lanes, wages) | low | inline — separable sub-extraction |
| `day` tab | Hub | `hubTab === 'day'` (~2956–2962) | ~7 | low | — | **extracted** (`QuickfillScheduleSection`) |
| URL / variant router | Page | top of `ScheduleDispatchHubPage` (~144–282, 700–735, 1710–1842) | ~330 | high (writes mode state, reads `hubTab`/`weekStart`) | — | **stays in parent** (playbook rule) |
| `loadHub` data engine | Page | `const loadHub = useCallback` (~476–611) + state ~284–474 | ~330 | highest (every mutation ends in `loadHub({quiet:true})`) | med | inline — **seam hook** `useScheduleDispatchHubData` |
| Interaction-mode state machine | Page | mode state ~784–801, handlers ~803–1330 | ~450 | high (modes are mutually exclusive; router arms `?placeJob=`) | high | inline — extract to `useScheduleDispatchHubModes` after data seam |
| Add/Edit block modal cluster | Page | `blockModalState` + `saveBlockModal` (~771–783, 886–938, 1331–1490) | ~280 | med (fed by picker + assign flows) | med | inline — hookable (`useScheduleDispatchBlockModal`) |
| Assign-job picker cluster | Page | `hubAssignJobPicker*` (~1051–1329) + modal JSX ~2273–2333 | ~250 | med-high (three intents feed three other clusters) | med | inline — move with modes hook |
| Time-off / not-coming-in cluster | Page | ~1492–1663 | ~175 | low-med (calls `loadHub` + `refreshHubUserTimeOff`) | low | inline — hookable early |
| DnD + delete + note + share + linked-group modals | Page | ~1665–1708, 1863–1902, 2205–2355 | ~200 | low | low | inline — stays (page-level modals) |
| Vestigial job-week residue | Page | `jobId = ''` + `jobTitle`/`teamMembers`/`blocks`/`load` | ~60 | dead branches everywhere | — | see quirk #1 — do NOT delete during a move |

---

## Per-region dossiers — ScheduleDispatchHub.tsx (presentational)

### Hub shell — `ScheduleDispatchHub` (exported orchestrator)

- **Render location:** `export function ScheduleDispatchHub(…)` (~2695–3061); `Props` type ~2576–2667; toolbar style consts `hubPeopleToolbarBtn`/`hubPeopleToolbarIconBtn` ~2669–2693.
- **Owned local state:** `dispatchSettingsOpen` (Dispatch Settings modal toggle), plus the v2.1240 phone new-mode chrome: `mobileScheduleMenuOpen` / `mobileMoreMenuOpen` / `mobileQuickAssignOpen`. The phone layout (`mobileNewMode` prop, narrow route variant only; the v2.1240 Old/New toggle was removed in v2.1242 — the compact header is the sole phone rendering) is PAGE-driven: when active, the shell renders a compact header (segmented Day-first tabs + a "+ Schedule" sheet naming all four creation flows + a ⋯ menu), moves the week nav to shell level for People too, and mounts a shell-level `QuickAssignSheet` — every action routes through the same page callbacks as the desktop toolbar. Since v2.1243 the ⋯ menu is a shared `moreMenu` node rendered at EVERY width (the classic tab bar's standalone Dispatch Settings button is gone): it holds Visible hours… (Day view only — `QuickfillScheduleSection` reports `{ open, windowLabel }` via `onDaySettingsApiChange`, replacing its inline gear; the trigger tints while a window is active), Dispatch settings… (canEdit), and the Share slot. The page adds a one-shot replace-redirect to `?hubTab=day` on narrow new-mode mounts (skipped for explicit `hubTab`/`placeJob` deep links). Covered by `ScheduleDispatchHub.render.test.tsx`.
- **Derived memos:** `dispatchSettingsRoster` (maps `allPeopleRows` → `DispatchSettingsModalRosterRow[]`); scroll keys `hubJobsColumnScrollKey` / `hubPeopleColumnScrollKey` (= `${weekStart}-${columnFocusDayYmd}-…-${tabForKey}`).
- **Structure:** tab bar (`role="tablist"`, People | Jobs | Day) + right cluster (`weekNavRightSlot` = the page's Share button, and the Dispatch Settings button gated on `canEdit`); `ScheduleDispatchWeekNav` renders below the tab bar only on the `jobs` tab (on `people` it is passed INTO the panel as the `weekNav` prop so nav + toolbar share a line — see JSX comment ~2878); then one of: `HubPeoplePanel` (no-tabs embed branch), `QuickfillScheduleSection` (Day), `HubJobsPanel` (Jobs), `HubPeoplePanel` (People); finally `DispatchSettingsModal` (always mounted).
- **Quirk:** `HubPeoplePanel` is rendered from **two branches** (`!showHubViewTabs` embed vs `hubTab === 'people'`) with near-identical ~60-prop spreads — the embed branch omits `weekNav`. Any prop added to the panel must be added in both places (this has been a real drift hazard).
- **Sub-components (extracted):** `ScheduleDispatchWeekNav`, `DispatchSettingsModal`, `QuickfillScheduleSection`, `ScheduleDispatchPlusCopyMenu`, `QuickAssignSheet`, `ScheduleDispatchTimeOffChip` (the last three consumed by inner components).
- **Extraction status + risk + approach:** stays as the coordinator file. Low risk. Once the panels move to their own files, this shrinks to the tab bar + wrappers (~400 lines) and becomes the analog of a decomposed page. Reducing the duplicated panel spread to a single shared props object is a worthwhile (still behavior-preserving) cleanup during that move.

### `jobs` tab — `HubJobsPanel`

- **Render location:** `function HubJobsPanel` (~117–356), rendered behind `hubTab === 'jobs'`.
- **Owned local state:** `search`, `onlyWithBlocks` (default `true`), `jobsScrollRef`.
- **Cross-tab/shared state (props):** `rows: ScheduleDispatchHubMergedRow[]` (page's `hubMergedRows`), `loading`, `jobsError`, `summariesError`, `visibleDayKeys`, `hideWeekend`+`onHideWeekendChange` (shared with People's View menu — the same page state `hideWeekend`), `onOpenJob`, `scheduleTodayYmd`, `columnFocusDayYmd`, `columnScrollKey`.
- **Derived memos:** `filteredRows` (search over `hcp_number`/`job_name`/`displayTitle`, then `totalBlocks > 0` filter).
- **Handlers:** none of its own beyond the two filter inputs; row/Open buttons call `onOpenJob(jobId)` (navigates to the JobWeek grid via `?jobId=`).
- **Effects/hooks:** `useScrollScheduleDispatchColumnIntoView` (shared lib hook; scrolls the `?day=` column into view).
- **Supabase:** none (fully controlled).
- **Sub-components:** none inline; day-column styling from `scheduleDispatchColumnFocus` lib.
- **External coupling:** none beyond props.
- **Extraction status + risk + approach:** Inline. **Low risk — extract first.** Pure cut/paste to `src/components/schedule/HubJobsPanel.tsx` (or `ScheduleDispatchHubJobsPanel.tsx`); take `ScheduleDispatchHubMergedRow`, `shortDowLabel`, `hubDayColumnHeaderLabel`, and the `hubExpectedManpower*` style consts decisions with care — `hubDayColumnHeaderLabel` is used by Jobs, People, AND Expected Manpower, so Stage-A it into a lib first (see Stage-A table). This is the momentum-builder that validates the file split.

### Block card + day cell — `HubPeopleBlockCard` + `HubPeopleDayCell`

> **Phone move flows (v2.2736):** the card has two tap entry points beside drag — a grip tap arms `cardPlacementMode.variant = 'move'` when `tapGripToMove` (panel `isMobile`) is set, and a press-and-hold (`useLongPress`, fires on release) calls `onRequestMoveBlock` → the page's `ScheduleDispatchMoveBlockSheet`. Both end in `moveScheduleDispatchBlockTo` (the drop kernel). `onRequestMoveBlock` / `tapGripToMove` thread card ← cell ← panel (BOTH mounts) ← hub.

- **Render location:** `hubPeopleSalarySuffix` const + `function HubPeopleBlockCard` (~358–811); `function HubPeopleDayCell` (~813–1172). Rendered only by `HubPeoplePanel` rows.
- **Owned local state:** card — `plusButtonRef`; cell — none (all mode arbitration is derived from props). Both are effectively stateless.
- **Cross-tab/shared props (the coupling):** `cardPlacementMode`, `placementSourceWorkDate`, `plusMenuBlockId` + `onPlusMenuBlockIdChange` (page-owned so only one + menu is open across the grid), `linkedCopyMode` (+ `onLinkedCopyToggleBlock`), `hubMultiCellAddActive` + `hubMultiCellAddSelectedKeys` (+ toggle), `hubAssignJobPlacement` (+ `onHubAssignJobCellPick`), `groupMemberCountByGroupId`, `linkedGroupAccentByGroupId` + `highlightLinkedGroups`, `timeOffInfo` (from `userTimeOffByCell`), `getJobDisplayTitle`/`getJobAddress`, `onOpenJob`/`onOpenHubJobDetail`/`onDeleteBlock`/`onRequestEditBlockNote`/`onOpenLinkedGroup`/`onStartCardPlacement`/`onCardPlacementCellPick`/`onEmptyCellClick`/`onAddJobToScheduleForCell`/`onRequestUndoNotComingIn`/`onMarkNotComingInForCell`, `canEdit`, `scheduleTodayYmd`/`columnFocusDayYmd`, `isBottomRow`.
- **Derived logic:** card — `dragDisabled` (= `!canEdit || hubMultiCellAddActive || linkedCopyActive`), note-requirement colors via `effectiveNoteRequirement`/`editNoteIconColorForBlock`/`surroundingIconColorForRequirement` (past-day gate `block.work_date < scheduleTodayYmd`), linked accent lookup; cell — `cellBg` mode ladder (drag-over → assign-picking green → linked-wrong-day gray → placement sky → multi-select amber → time-off gray), `cellClickable`/`emptyCellClickable`/`multiSelectCellActive`/`showCellAddJobTriangle` gates.
- **Hooks/contexts:** `useDraggable` (card, `id: block.id`), `useDroppable` (cell, id from `scheduleDispatchCellDroppableId(workDate, personUserId)`, disabled on time-off), `useToastContext` (disabled-drag explainer toast, `SCHEDULE_DISPATCH_DRAG_DISABLED_READONLY_MESSAGE`), `useDispatchNoteRequirements` (context).
- **Supabase:** none.
- **Sub-components:** `ScheduleDispatchPlusCopyMenu` (extracted; anchored to `plusButtonRef`), `ScheduleDispatchTimeOffChip` (extracted), `ScheduleDispatchBlockNoteIcon` / `ScheduleDispatchLinkedChainsIcon` (extracted icons).
- **External coupling:** dnd-kit ids must stay in sync with the page's `handleHubDragEnd` (`executeScheduleDispatchBlockReassign` resolves `event.active.id` against `hubBlockById` and the droppable id parser in `scheduleDispatchDnd`).
- **Extraction status + risk + approach:** Inline. **Low-med risk.** Move the pair together (cell imports card) to `HubPeopleDayCell.tsx` — a verbatim file move; they own no state and all quirky behavior is prop-driven. Must be inside the same `DndContext` tree, which they remain. Do this before touching `HubPeoplePanel` so the panel move is smaller.

### `people` tab — `HubPeoplePanel`

- **Render location:** `HubPeoplePanelProps` type ~1174–1251; `function HubPeoplePanel` ~1253–2574. Rendered behind `hubTab === 'people'` AND by the `!showHubViewTabs` embed branch.
- **Owned local state:** `viewMenuOpen` + `viewMenuRef` (View dropdown: Hide Inactive / Hide weekend / Highlight linked), `search`, `onlyWithBlocksThisWeek`, `quickAssignOpen` (mobile Quick Assign sheet), `personSort: 'alpha' | 'role' | 'lanes'` (persisted per device, localStorage key `PEOPLE_SORT_STORAGE_KEY = 'pipetooling_dispatch_people_sort_v1'`, cycled by `cyclePersonSort` on the Person header), `peopleScrollRef`, plus the Expected Manpower collapse state (next dossier).
- **Cross-tab/shared state (props, stays in page):** everything in the card/cell dossier, plus `hideWeekend`/`onHideWeekendChange` (shared with Jobs tab), `highlightLinkedGroups`/`onHighlightLinkedGroupsChange` (page-owned, localStorage-persisted), `allPeopleRows`, `userIdsWithBlocksThisWeek`, `salariedUserIds`, `personDayBlocks`, `hubWeekBlocks`, `hubPeopleNameById`, `roleByUserId`, `swimLanes` (+ `onSwimLanesChanged` on the shell), `focusPersonUserId` (from `?focusPerson=`), `weekNav` slot, linked-copy apply callbacks (`onLinkedCopyApplyToPerson`/`onLinkedCopyApplyToLane`, `linkedCopyApplyBusy`), toolbar mode entry points (`onRequestHubAddJob`, `onRequestHubMultiCellAddMode`, `onStartLinkedCopyMode`), `onQuickAssignScheduled`, `userTimeOffByCell`, `showExpectedManpower`/`showHideWeekendToggle` (embed flags).
- **Derived memos:** `afterBlockFilter` (Hide Inactive), `filteredAssignees` (name OR lane match via `personMatchesLaneQuery` OR any visible block's job title), `peopleDisplayRows` (heading/person union rows: lanes via `buildSwimLaneDisplaySections`, role via `groupRosterUsersByAuthRoleSection`, else flat), `emptyMessage`, `missingNoteCount` (per focus/today column: blocks with no note whose `requirementForBlock` ≠ `'skip'`; past days always 0 — see quirk #6), plus the Expected Manpower memos.
- **Handlers:** `cyclePersonSort`; everything else is a prop callback.
- **Effects:** view-menu click-outside + Escape; `?focusPerson` `scrollIntoView` (element id `hub-person-row-${userId}`); `useScrollScheduleDispatchColumnIntoView`; Expected Manpower collapse reset (next dossier).
- **Hooks/contexts:** `useIsMobile` (mobile name pills, Quick Assign ⚡ button), `useDispatchNoteRequirements` (missing-note count).
- **Supabase:** none.
- **Sub-components:** `HubPeopleDayCell`/`HubPeopleBlockCard` (in-file), `QuickAssignSheet` (extracted; mobile only), `ScheduleDispatchWeekNav` (via `weekNav` slot), `ScheduleDispatchLinkedChainsIcon`.
- **External coupling:** lane-heading rows double as linked-copy stage-2 "whole crew" apply buttons; person-name cells double as stage-2 per-person apply buttons — both purely via props.
- **Extraction status + risk + approach:** Inline. **Medium risk** — the JSX is big but the state is clean; the cost is the ~55-prop interface (already declared as `HubPeoplePanelProps`, so the move is mechanical). Extract to `HubPeoplePanel.tsx` AFTER the card/cell pair and (ideally) after the Expected Manpower section is split out. All mode state stays page-owned; the panel keeps receiving it as props. Remember both render branches in the shell.

### Expected Manpower section (inside `HubPeoplePanel`)

- **Render location:** `visibleDayKeys.length > 0 && showExpectedManpower` section (~2105–2571): day-tab strip (per-day buttons + "All week"), stats line, lane breakdown line, collapsible per-job table with expandable assignee detail rows, week person-hours footer. Its memos/state sit at the top of `HubPeoplePanel` (~1346–1449).
- **Owned local state:** `expectedManpowerByJobSectionCollapsed`, `collapsedExpectedManpowerJobIds: Set<string>`, `prevHubExpectedManpowerKeyRef` (drives the collapse-reset effect: switching TO All-week collapses every job; switching between days clears collapses; `null` clears).
- **Cross-tab/shared state:** `hubExpectedManpowerDayKey` + `onHubExpectedManpowerDayChange` — **page-owned** (`ScheduleDispatchHubPage` keeps it valid across week changes: prefers previous → today → first visible day; `HUB_EXPECTED_MANPOWER_ALL_WEEK` sentinel survives). Reads `hubWeekBlocks`, `visibleDayKeys`, `getJobDisplayTitle`, `hubPeopleNameById`, `swimLanes`, `canShowExpectedManpowerPayroll`, `hubHourlyWageByUserId`, `onOpenJob`.
- **Derived memos:** `expectedManpowerWeekPersonHours` (`expectedManpowerPersonHoursTotalForDayKeys`), `expectedManpowerDayRows` (`expectedManpowerRowsForDay` / `expectedManpowerRowsForVisibleDays`), `expectedManpowerSelectionLabel`, `expectedManpowerJobGroups` (`expectedManpowerJobGroupsForDay`), `expectedManpowerDayStats` (inline reduction — Stage-A candidate), `expectedManpowerLaneRows` (`summarizeExpectedManpowerByLane`).
- **Supabase:** none. Payroll estimate is client-side: `expectedManpowerJobGroupPayrollEstimate(job.rows, wageLookup)` gated on `canShowExpectedManpowerPayroll` (dev, or master_technician in `pay_approved_masters`).
- **Extraction status + risk + approach:** Inline. **Low risk, high value** — nearly all calc already lives in [`lib/scheduleDispatchExpectedManpower.ts`](../src/lib/scheduleDispatchExpectedManpower.ts) and [`lib/dispatchSwimLaneSections.ts`](../src/lib/dispatchSwimLaneSections.ts). Extract to `HubExpectedManpowerSection.tsx` with props (`hubWeekBlocks`, `visibleDayKeys`, `dayKey` + `onDayKeyChange`, `getJobDisplayTitle`, `hubPeopleNameById`, `swimLanes`, `canShowPayroll`, `hourlyWageByUserId`, `onOpenJob`, `scheduleTodayYmd`); the collapse state and its reset effect move with it. This alone removes ~530 lines from `HubPeoplePanel`. Keep `hubExpectedManpowerDayKey` in the page (its week-change validity effect lives there).

### `day` tab — extracted

- **Render location:** `hubTab === 'day'` branch (~2956–2962): `<QuickfillScheduleSection hideConflictPrompt initialWorkDateYmd={dayTabWorkDateYmd} onBlocksSaved={onDayScheduleChanged} showDaySettings />`.
- **Coupling:** `onDayScheduleChanged` → page's `loadHub({ quiet: true })` so the People/Jobs week caches refresh after the Day view's dot auto-saves/add-blocks. `QuickfillScheduleSection` does its own data loading (shares lib helpers `fetchJobsLedgerForScheduleDispatchHub` etc., not the page's state).
- **Status:** **Done** — this is the target end-state shape for the other tabs.

---

## Per-region dossiers — ScheduleDispatchHubPage.tsx (container)

### URL / variant router (stays in parent)

- **Location:** top of the component (~144–282) + `placeJob` arming effect (~705–735) + nav callbacks (`shiftWeek` ~1710, `goThisWeek` ~1741, `setHubTab` ~1769, `openJobWeekGrid` ~1825).
- **URL params owned:** `?week=` (normalized to company week start via `companyWeekStartSundayContaining`; invalid → `getDefaultWeekRange().start`), `?day=` (column focus; stripped when not in `visibleDayKeys`), `?hubTab=` (`jobs`/`day`; absent = people), `?placeJob=<jobId>` (arms `hubAssignJobPlacement` once per `${jobId}|${weekStart}` via `placeJobArmKeyRef`; forces the people tab; stripped by `stripPlaceJobFromUrl` on cancel/consume/Esc), `?focusPerson=<userId>` (read inline at the `ScheduleDispatchHub` callsite), `?jobId=` (written by `openJobWeekGrid` — hands off to `ScheduleDispatchJobWeek` via the `ScheduleDispatch.tsx` router).
- **Variant handling:** `variant === 'tomorrow'` pins `weekStart` to tomorrow's week, `visibleDayKeys = [tomorrowYmd]`, `columnFocusDayYmd = tomorrowYmd`, swaps URL tab state for `localHubTab` (coerced back to `'people'` if it drifts), and makes week-nav actions `navigate('/schedule-dispatch?…')` (leave the embed) instead of `setSearchParams`.
- **localStorage:** `scheduleDispatchHideWeekend` (default hidden; `readScheduleDispatchHideWeekend`), `scheduleDispatchHighlightLinkedGroups` (`readScheduleDispatchHighlightLinkedGroups`); both persisted by effects.
- **Role gate:** `authLoading` → spinner; `role` not in `CAN_USE_SCHEDULE_DISPATCH` (from [`lib/scheduleDispatchEditRoles.ts`](../src/lib/scheduleDispatchEditRoles.ts), aliased import of `CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES`) → `<Navigate to="/dashboard" replace />`. `canEdit` uses the same set — view roles == edit roles on this surface.
- **Status:** **stays in the parent permanently** (playbook rule). Any extracted hook receives `weekStart`/`weekEnd`/`visibleDayKeys`/`isTomorrow` as inputs.

### `loadHub` data engine (the shared substrate) → seam hook `useScheduleDispatchHubData`

- **Location:** state ~284–474; `loadHub` ~476–611; trigger effect ~692–698; time-off refresh ~365–408; pay-approved-masters effect ~312–334.
- **Owned state (would move into the hook):** `hubLoading` + `hubLoadSeqRef` (monotonic seq so only the latest non-quiet run clears loading; **quiet refreshes never touch `hubLoading`**), `hubJobsError`, `hubSummariesError`, `hubJobs`, `hubWeekBlocks`, `hubTeamMemberUserIds`, `hubRoleByUserId`, `hubArchivedUserIds`, `hubPeopleNameById`, `hubHourlyWageByUserId`, `hubPayApprovedMasterIds`, `hubSalariedUserIds`, `hubUserTimeOffByCell` + `hubUserTimeOffPrimedRef` (skips the duplicate time-off refetch right after `loadHub` seeded the same `(weekStart, weekEnd, rosterKey)`).
- **Derived memos:** `hubSummaryRows` (`blocksToJobWeekSummaries`), `hubPersonDayBlocks` (`buildPersonDayBlockMap`), `hubJobTitleById` (`formatScheduleDispatchHubJobTitle`), `hubJobAddressById`, `hubAllPeopleRows` (team ∪ assignees, minus `hubArchivedUserIds`, name-sorted), `hubVisibleUserIdsSerialized`, `hubUserIdsWithBlocksThisWeek`, `hubBlockById`, `hubGroupMemberCountByGroupId`, `hubLinkedGroupAccentMap` (`buildLinkedGroupAccentMap`), `hubMergedRows` (jobs × aggregated summaries, sorted `totalBlocks` desc then `hcp_number` numeric desc), `canShowHubExpectedManpowerPayroll`; callbacks `getHubJobDisplayTitle`, `getHubJobAddress`, `refreshHubUserTimeOff`.
- **`loadHub` phases (v2.1030 shape — preserve):** A: `fetchJobsLedgerForScheduleDispatchHub` + `fetchJobScheduleBlocksForHubDateRange(weekStart, weekEnd)` + `fetchUsersTabRosterForScheduleDispatchHub(role === 'dev')` in parallel → B: `fetchTeamMemberUserIdsForJobIds(jobIds)` (150-id chunks) → C: `fetchUserNamesForIds` + `fetchArchivedUserIdSetForIds` + `fetchUserTimeOffForUsersInRange` in parallel over `rosterIds` → D: `Promise.allSettled([fetchSalariedUserIdSetFromUserIds(rosterIds, { nameByUserId }), wagesPromise])` where `wagesPromise` reads `people_pay_config` by person_name (only when `canShowHubExpectedManpowerPayroll`). Partial failures degrade to warning toasts, never throw the whole load.
- **Supabase tables/RPCs:** via lib — `jobs_ledger`, `jobs_ledger_team_members`, `users`, `job_schedule_blocks`, `user_time_off`; direct in page — `pay_approved_masters` (SELECT `master_id`), `people_pay_config` (SELECT `person_name, hourly_wage`). All wrapped in `withSupabaseRetry`.
- **External coupling:** **every mutation in the file ends with `loadHub({ quiet: true })`** (drag end, block save/delete, copies, linked-copy applies, note save, not-coming-in, undo, Quick Assign, Day-tab saves) — this is the page's equivalent of Bids' `useBidPricingEngine`.
- **Extraction status + risk + approach:** Inline. **Medium risk, do as Step 2 (seam).** Extract to `src/hooks/useScheduleDispatchHubData.ts` taking `{ weekStart, weekEnd, role, authUserId, enabled, showToast }` and returning one object the page destructures (so downstream references don't change). `canShowHubExpectedManpowerPayroll` is both an input to phase D and an output — keep it inside the hook. The `loadHub` dep on `canShowHubExpectedManpowerPayroll` currently re-runs the full load when the pay gate resolves; preserve that.

### Interaction-mode state machine

- **Location:** state ~784–801 (`cardPlacementMode`, `linkedCopyMode`, `plusMenuBlockId`, `hubAssignJobPlacement`, `hubMultiCellAddActive`, `hubMultiCellAddSelection`, `hubCellAddContext`, `hubAssignJobPickerIntent`, `linkedCopyApplyBusy`, `placeJobArmKeyRef`); Escape-key effects ~817–875; entry/exit handlers ~886–1243; apply handlers `onCardPlacementPickCell` ~967, `onLinkedCopyApplyToPerson` ~1148, `onLinkedCopyApplyToLane` ~1194, `applyHubMultiCellJob` ~613–690; the three mode banners in JSX ~1914–2102.
- **The invariant:** the modes are **mutually exclusive** — every entry handler (`onRequestHubAddJob`, `onRequestHubMultiCellAddMode`, `onStartLinkedCopyMode`, `onStartCardPlacement`, `openAddBlock`) zeroes all the others and calls `stripPlaceJobFromUrl()`. Escape exits whichever is active. `setHubTab('jobs'|'day')` and week changes also clear multi-cell/placement state.
- **Handlers/writes:** `onCardPlacementPickCell` → `insertScheduleDispatchCopiedLeg` (linked copies must stay on the source `work_date`; toast + `loadHub({quiet:true})`); `applyHubMultiCellJob` → per selected `hubPersonDayKey`: `fetchScheduleBlocksForAssigneesOnDay` → `scheduleOverlapsAny` skip → `insertJobScheduleBlock` with fixed 08:00–16:00 and a fresh `newJobScheduleSharedBlockGroupId()`, then a combined added/skipped/failed toast; linked-copy applies loop `insertScheduleDispatchCopiedLeg` per source (× per member for lanes) and summarize via `summarizeLinkedCopyApply` / `summarizeLinkedCopyLaneApply`.
- **Supabase:** `job_schedule_blocks` (via `jobScheduleBlocks.ts` + `scheduleDispatchMirrorInsert.ts`).
- **External coupling:** `?placeJob=` router arms `hubAssignJobPlacement`; `hubTab` gates `onStartCardPlacement` (people tab only); the Hub renders the mode UI purely from these props.
- **Extraction status + risk + approach:** Inline. **High risk — extract after the data seam**, as `useScheduleDispatchHubModes` (or leave in the page initially). The mutual-exclusion choreography is the hazard: keep all mode state in ONE hook/owner so the "clear everything else" pattern can't be half-moved. The mode banners could move to a small `ScheduleDispatchModeBanners` component (props: the three mode states + cancel/stage callbacks) — a low-risk JSX-only trim (~190 lines).

### Add/Edit block modal cluster

- **Location:** `ScheduleDispatchBlockModalState` type ~134; state ~771–783 (`blockModalState`, `addTimeStart`/`addTimeEnd` (defaults 08:00/16:00), `addNote`, `addSaving`, `addError`, `addBlockTimelineSegments`, `addBlockDraftByBlockId`); `openAddBlock` ~886–930 (builds sorted `AddBlockTimelineSegment[]` from the person-day's blocks and seeds the default range via `defaultNewBlockRangeInFirstGap`); `closeAdd` ~932; `saveBlockModal` ~1367–1490; display memos `blockModalPersonLabel`/`blockModalJobTitleForModal`/`blockModalWorkDate`/`addBlockModalTimeline` ~1331–1365; JSX `ScheduleDispatchAddBlockModal` ~2246–2263.
- **Save path (add):** `saveNewScheduleBlockForPersonDay` (lib; validates internally, consumes `addBlockDraftByBlockId` neighbor-time drafts) → toast → `closeAdd` → `loadHub({quiet:true})`. The `kind: 'edit'` branch is **dead on this page** — it early-returns unless `jobId` is truthy (see quirk #1) — and since v2.1344 it delegates to the shared `saveEditedScheduleBlockTimes` kernel (`src/lib/scheduleDispatchAddBlockSave.ts`: range validation, fresh-fetched linked-group legs, per-assignee overlap checks, group/solo update), the same kernel used by `ScheduleDispatchJobWeek`'s live edit path and Dispatch Mode → Schedule's tap-the-time edit.
- **Supabase:** `job_schedule_blocks` via lib helpers.
- **"Move day" row (v2.1377) — opt-in, and this page does NOT opt in.** `ScheduleDispatchAddBlockModal` renders a day-picker row only when a caller passes `onChangeWorkDate` **and** `mode === 'edit'`. Of the five call sites, only Dispatch Mode → Schedule passes it (it is the one surface with no drag-and-drop). This page, `ScheduleDispatchJobWeek`, Quickfill, and user-review pass nothing and are visually unchanged. Chips come from the pure kernel `src/lib/scheduleBlockMoveDayOptions.ts`; the modal keeps no day state of its own beyond "is the free-date input revealed".
- **"Remove" button (v2.1381) — second opt-in prop, and all three edit surfaces pass it.** `onRemove` renders a red-outline Remove button bottom-left of the footer (edit mode only). The modal owns no deletion logic: this page and `ScheduleDispatchJobWeek` close the modal and hand the block id to their existing `requestDeleteBlock` → `RemoveScheduleBlockConfirmModal` → `deleteJobScheduleBlock` flow; Dispatch Mode → Schedule grew the same confirm-modal flow locally. Single-row delete only — a linked crew-mate's block is untouched (crew-wide removal stays in `LinkedScheduleGroupModal`).
- **Extraction status + risk + approach:** Inline. **Medium risk.** Natural hook `useScheduleDispatchAddBlockModal` returning the modal props + `openAddBlock`; it is fed by the assign-picker and empty-cell flows, so extract alongside or after the modes hook. Do not silently delete the dead edit branch during the move (quirk #1).

### Assign-job picker cluster

- **Location:** `hubAssignJobPickerOpen`/`hubAssignJobPickerSearch`/`hubAssignJobPickerIntent` (`'toolbar' | 'cell' | 'multi'`)/`hubCellAddContext`; `closeHubAssignJobPicker` ~803; entry points `onRequestHubAddJob` (toolbar +), `onHubEmptyCellOpenChoice` (empty cell AND the corner + triangle — both wired to the same handler), `onRequestHubMultiCellAddChooseJob` (floating "Choose job" bar ~2210–2245); `onCreateNewJobFromHubJobPicker` ~1245–1281 (snapshots intent/ctx/multi keys, opens `jobFormModal.openNewJob`, then after `loadHub()` routes the new job id to multi-add / add-block / placement); memos `hubAssignJobPickerRows` (search over hcp/name/title/address/customer), `hubEmptyCellChoiceSubtitle`, `hubAssignJobPickerSubtitle`; JSX `ScheduleDispatchAssignJobPickerModal` ~2273–2333 (incl. `onOpenJobDetail` stacking Job Detail above the picker, and the `notComingIn` inline confirm for `'cell'` intent).
- **Coupling:** consumes `hubMergedRows`, `hubPeopleNameById`, `hubPersonDayBlocks` (from data engine); dispatches into `applyHubMultiCellJob`, `openAddBlock`, or `setHubAssignJobPlacement` depending on intent; `hubJobPickerSubline` (module-level pure fn ~95–108) builds the "Nd Mon D | address" subline.
- **Supabase:** none directly (writes happen in the dispatched flows).
- **Extraction status + risk + approach:** Inline. **Medium-high coupling** — it is the junction of three modes. Move with (or into) the modes hook; do not extract standalone first.

### Time-off / not-coming-in cluster

- **Location:** `notComingInBusy`; `markNotComingInForPersonDay` ~1494–1568 (records unpaid time off via `recordNotComingInForUserAsStaff`, then deletes the person-day's existing blocks via `deleteJobScheduleBlock` with per-failure counts, layered toasts incl. `result.alreadyMarked` and `result.syncWarning`, then `loadHub({quiet:true})` + `refreshHubUserTimeOff()`); `handleMarkNotComingInTodayFromAssignPicker` (picker `'cell'` intent path); `onMarkNotComingInForCell` (empty-cell "off" button); undo cluster ~1590–1663 (`undoNotComingInTarget`, `undoNotComingInBusy`, `handleRequestUndoNotComingIn` / `handleCancelUndoNotComingIn` / `handleConfirmUndoNotComingIn` → `removeNotComingInForUserAsStaff`); JSX `ScheduleDispatchUndoNotComingInModal` ~2265–2272.
- **Supabase:** `user_time_off` (select/insert via [`lib/notComingInTimeOff.ts`](../src/lib/notComingInTimeOff.ts)); RPC **`pay_staff_remove_not_coming_in_for_user_day`** (undo path; handles authz + salary sync); `job_schedule_blocks` (block removal). Cell chips read `hubUserTimeOffByCell` (`user_time_off` via [`lib/userTimeOffByCell.ts`](../src/lib/userTimeOffByCell.ts) — tested).
- **Extraction status + risk + approach:** Inline. **Low-med risk** — self-contained apart from needing `hubPeopleNameById`, `hubPersonDayBlocks`, `loadHub`, `refreshHubUserTimeOff`. Good early hook candidate (`useScheduleDispatchNotComingIn`) once the data seam exists.

### DnD + delete + note + share + linked-group modals

- **Location:** `sensors` (PointerSensor, 8px activation) + `handleHubDragEnd` ~1696–1708 → [`executeScheduleDispatchBlockReassign`](../src/lib/scheduleDispatchDragEnd.ts) (already lib; resolves against `hubBlockById`, success → quiet reload); delete cluster `deleteBlockId`/`deleteBlockBusy` + `requestDeleteBlock`/`cancelRequestDeleteBlock`/`confirmDeleteBlock` (+ Escape effect ~837) rendering `RemoveScheduleBlockConfirmModal`; block-note cluster `blockNoteEdit`/`blockNoteBusy`/`blockNoteError` + `saveHubBlockNote` ~1863–1893 (group-aware: `updateJobScheduleBlockGroup` when `shared_block_group_id`, else `updateJobScheduleBlock`) rendering `ScheduleDispatchBlockNoteModal`; `shareModalOpen` + `ScheduleShareModal` (Share button injected via `weekNavRightSlot`); `linkedGroupModalId` + `LinkedScheduleGroupModal` (opened from a card's chains button; receives `weekStart`/`weekEnd`/`getJobDisplayTitle`; does its own fetch); `openHubJobDetail` (Job Detail modal context with `scheduleContext` prefill); `closeJobDetail` effect ~745–748 (**depends on the stable `closeJobDetail` fn, NOT the context object** — regression guard, see quirk #5).
- **Supabase:** `job_schedule_blocks` (delete/update via lib).
- **Extraction status + risk + approach:** These are page-level modals opened from multiple flows → **stay in the parent** per the playbook. Low risk, no action needed beyond the seam hooks shrinking around them.

### Vestigial job-week residue (read before touching anything)

`const jobId = ''` (~152) is a **constant**. The page still carries the old hub+job-week dual-mode skeleton: `jobTitle`/`teamMembers`/`blocks` state (reset effect ~305), `blockById`/`nameByUserId` memos, a no-op `load()` (~738–740), and `jobId ? … : …` branches inside `openAddBlock`, `onCardPlacementPickCell`, `saveBlockModal` (whole edit path), `markNotComingInForPersonDay`, `confirmDeleteBlock`, `shiftWeek`/`goThisWeek`, and the `?week` normalize effect. The live job-week view is [`ScheduleDispatchJobWeek`](../src/components/schedule/ScheduleDispatchJobWeek.tsx), routed by `ScheduleDispatch.tsx`. **Decomposition must preserve these dead branches verbatim** (behavior-preserving rule); deleting them is a separate, later cleanup PR — flag it, don't fold it in.

---

## The shared substrate

There is **no per-record selection pointer** here (no `setSharedBid` analog — nothing like `?id=` selects a block/job across tabs; the closest thing, `?jobId=`, *leaves* this surface entirely). What the tabs share instead:

1. **The week-scoped data engine** (`loadHub` + its ~14 state atoms and ~13 memos, dossier above). People and Jobs are two projections of the same `hubWeekBlocks`/`hubJobs`; the Day tab re-fetches independently and pings back via `onDayScheduleChanged`. This engine is the page's `useBidPricingEngine` equivalent, and **building the `useScheduleDispatchHubData` seam is the unlock** for everything else.
2. **The interaction-mode state machine** (`cardPlacementMode` ∥ `linkedCopyMode` ∥ `hubAssignJobPlacement` ∥ `hubMultiCellAdd*` ∥ `plusMenuBlockId`) — mutually exclusive, page-owned, URL-armed (`?placeJob=`), rendered by the Hub purely as props. It must remain a single owner; splitting it across components would break the "entering one mode exits the others" choreography.
3. **The URL router** (`week`/`day`/`hubTab`/`placeJob`/`focusPerson`) — permanent parent resident.

Consequence for extraction: Hub-file splits are prop-preserving file moves (cheap); Page-file splits are hook extractions where the parent destructures the hook result so downstream references don't change.

---

## Shared infrastructure

- **Contexts consumed:** `useAuth` (page), `ToastContext` (both files), `JobFormModalContext` + `JobDetailModalContext` (page), `DispatchNoteRequirementsContext` (Hub card + panel — note the Hub reads a context directly rather than props; an extracted card keeps doing so).
- **Supabase inventory (all via `withSupabaseRetry`-wrapped lib helpers unless noted):** `jobs_ledger`, `jobs_ledger_team_members` (150-id `.in()` chunks), `users` (roster/names/archived), `job_schedule_blocks` (all verbs), `user_time_off`, `people_pay_config` (direct, wages by `person_name`), `pay_approved_masters` (direct), `dispatch_swim_lanes` + `dispatch_swim_lane_members` (cast `as never` — missing from generated types; via `fetchDispatchSwimLanes` and the `DispatchSettingsModal` manager). RPC: `pay_staff_remove_not_coming_in_for_user_day`. No realtime subscriptions anywhere on this surface.
- **Deep-link senders (verify before changing URL params):** Dashboard clock strip → `?focusPerson=`; job surfaces → `?placeJob=`; Quickfill tomorrow embed (no URL). `openJobWeekGrid` writes `?jobId=` for the sibling JobWeek surface.

## Preserve-quirks list (odd but load-bearing)

1. **`jobId = ''` vestigial dual-mode** — dead branches everywhere; keep verbatim (dossier above).
2. **Quiet vs loud loads** — `loadHub({quiet:true})` never sets `hubLoading`; the `hubLoadSeqRef` monotonic guard means an older loud load finishing late cannot clear a newer load's spinner. Every mutation refresh is quiet.
3. **`hubUserTimeOffPrimedRef`** — skips exactly one duplicate `user_time_off` fetch after `loadHub` seeds the same `(weekStart, weekEnd, rosterKey)`; later roster changes still refetch.
4. **Two `HubPeoplePanel` mounts** in the Hub shell (embed vs people tab) with hand-duplicated prop spreads.
5. **`closeJobDetail` effect dependency** — must depend on the stable callback, not the `jobDetailModal` context object (context identity changes on open → the modal used to self-close instantly).
6. **Missing-note indicator + card note colors gate on `work_date < scheduleTodayYmd`** — past days never light up red (`effectiveNoteRequirement`); `missingNoteCount` also returns 0 for past focus days.
7. **Multi-cell add uses a fixed 08:00–16:00 window** and a fresh `shared_block_group_id` per inserted block (not one group across the selection); overlapping cells are skipped, not errored.
8. **Linked copies must land on the source block's `work_date`** — enforced in cell-pick (`linkedWrongDay` graying) AND in `onCardPlacementPickCell`; lane/person applies always use `source.work_date`.
9. **Assign-picker stacking** — Job Detail (and Edit Job from it) stack **above** the picker; closing them lands back on the picker (comment at `onOpenJobDetail`).
10. **`personSort` localStorage** (`pipetooling_dispatch_people_sort_v1`) is per-device and lives in the panel, not the page; `hideWeekend` (default **hidden**) and `highlightLinkedGroups` localStorage live in the page.
11. **Wages are keyed by trimmed person NAME** (`people_pay_config.person_name` matched against `fetchUserNamesForIds`), not user id; 'Unknown' names are excluded; missing wage renders `$0` with the explanatory tooltip.
12. **`hubMergedRows` sort:** `totalBlocks` desc, then `hcp_number` **descending** with `numeric: true`.
13. **Drag disabled ≠ hidden** — the red drag strip stays visible and clicking it toasts `SCHEDULE_DISPATCH_DRAG_DISABLED_READONLY_MESSAGE`; drag is also disabled during multi-cell add and linked-copy modes.
14. **Escape handling is per-mode effects on `window`** (placement/assign, linked copy, multi-cell, delete-confirm each have their own listener with different guards, e.g. delete ignores Esc while busy).
15. **Tomorrow variant week-nav escapes the embed** — `shiftWeek`/`goThisWeek`/`openJobWeekGrid` `navigate()` to `/schedule-dispatch?…` instead of mutating local state.
16. **`move_job_schedule_block_group` has NO date predicate** — it moves every leg of a `(job_id, shared_block_group_id)` group whatever `work_date` each sits on. Harmless while groups were single-day; since "Add person to crew" (v2.1371) writes one leg per distinct job/date/window, **multi-day groups are routine and moving one day of one collapses the whole group onto a single date**. `saveEditedScheduleBlockTimes` guards this (refuses a day move when the fetched legs span `>1` `work_date`, v2.1377), but **the drag path `executeScheduleDispatchBlockReassign` still calls the RPC unguarded** — dragging one day of a multi-day crew group is a live bug. Proper fix is a date-scoped `move_job_schedule_block_group_day(job, group, from_date, to_date)` RPC that both paths share; until then do not add new callers.

---

## Stage-A pure-logic inventory (→ `src/lib/*` + tests before component moves)

Most calc already lives in tested libs (`scheduleDispatchLinkedCopy`, `scheduleDispatchColumnFocus`, `dispatchSwimLaneSections`, `dispatchNoteRequirements`, `userTimeOffByCell`, `notComingInTimeOff`, `salaryPayConfigGate`, `scheduleDispatchAddBlockTimeline`). What remains inline, individually shippable:

| Candidate | Currently | Target |
|---|---|---|
| `hubDayColumnHeaderLabel` + `shortDowLabel` | module-level in ScheduleDispatchHub.tsx, used by Jobs + People + Expected Manpower | `lib/scheduleDispatchHub.ts` (or `utils/dateUtils`) + test — **prerequisite for splitting the Hub file** |
| `hubJobPickerSubline` | module-level in ScheduleDispatchHubPage.tsx | `lib/scheduleDispatchHub.ts` + test (days-ago + address join rules) |
| `hubMergedRows` merge + sort | inline memo (page ~456–474) | `buildHubMergedRows(jobs, summaryRows)` in `lib/scheduleDispatchHub.ts` + test (quirk #12 comparator) |
| `expectedManpowerDayStats` reduction | inline memo (`HubPeoplePanel` ~1398) | pure fn in `lib/scheduleDispatchExpectedManpower.ts` + test |
| `missingNoteCount` loop | inline memo (`HubPeoplePanel` ~1562) | `countBlocksMissingNoteForDay(dayYmd, todayYmd, people, personDayBlocks, requirementForBlock)` in `lib/dispatchNoteRequirements.ts` + test (past-day zero rule) |
| `hubAssignJobPickerRows` filter | inline memo (page ~1283) | `filterHubJobPickerRows(rows, query)` + test (5-field match) |
| `HubJobsPanel.filteredRows` / `HubPeoplePanel.filteredAssignees` filters | inline memos | pure filter fns + tests (assignee filter's job-title-in-week and lane-query branches) |
| Phase-D wage mapping (`wageByName` → `wageByUserId`) | inline in `loadHub` | `buildHourlyWageByUserId(rows, rosterIds, nameByUserId)` + test (quirk #11 rules) |
| `applyHubMultiCellJob` result summary | inline string building | tiny `summarizeMultiCellAddResult({added, skippedOverlap, failed})` + test (mirrors the tested linked-copy summarizers) |
| Existing **untested** lib helpers this surface leans on | `lib/scheduleDispatchHub.ts` (`hubPersonDayKey`/`parseHubPersonDayKey`/`buildPersonDayBlockMap`/`aggregateWeekSummariesByJob`/`blocksToJobWeekSummaries`/`formatScheduleDispatchHubJobTitle`), `lib/scheduleDispatchExpectedManpower.ts`, `lib/jobScheduleOverlap.ts` | add colocated `*.test.ts` (no code moves needed) |

---

## Recommended extraction order (value ÷ risk)

1. **Stage-A sweep** — the table above; start with `hubDayColumnHeaderLabel` (unblocks every Hub-file split) and tests for the untested `scheduleDispatchHub.ts` / `scheduleDispatchExpectedManpower.ts` kernels.
2. **Hub file splits (pure moves, no state relocation):**
   a. `HubJobsPanel` → own file (smallest, validates the split).
   b. `HubPeopleBlockCard` + `HubPeopleDayCell` → own file (pair).
   c. `HubExpectedManpowerSection` → own file (collapse state + memos move with it; `hubExpectedManpowerDayKey` stays page-owned as a controlled prop).
   d. `HubPeoplePanel` → own file (now ~900 lines lighter; `HubPeoplePanelProps` already exists). Fix nothing else; both shell mounts keep working.
   After (d), `ScheduleDispatchHub.tsx` is a ~400-line shell.
3. **Data seam** — `useScheduleDispatchHubData` hook (the `loadHub` engine dossier). Parent destructures the result; zero JSX changes.
4. **Not-coming-in hook** — `useScheduleDispatchNotComingIn` (low coupling once the data hook exists).
5. **Modes + picker + add-block modal** — extract together (or in that dependency order) as `useScheduleDispatchHubModes` / `useScheduleDispatchAddBlockModal`; optionally split the mode banners into `ScheduleDispatchModeBanners`. This is the highest-risk step — the mutual-exclusion invariant must stay in one owner.
6. **Deferred cleanup PR (separate, NOT behavior-preserving):** remove the `jobId = ''` vestigial branches and dedupe the two `HubPeoplePanel` prop spreads.

**What must STAY in `ScheduleDispatchHubPage`:** the URL/variant router (`week`/`day`/`hubTab`/`placeJob`/`focusPerson` + tomorrow-variant navigation), the role gate/redirect, the `DndContext` + drag-end wiring, all cross-flow modals (add/edit block, delete confirm, undo not-coming-in, assign-job picker, linked-group, block note, share) and the Job Detail/Job Form context calls, `hubExpectedManpowerDayKey` and its week-validity effect, and ownership of the mode state machine (even if implemented via a hook, the page remains the single mount point).

Definition of done per step, verification gates (`npm run typecheck && npm run lint && npm test` after every move), and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md).
