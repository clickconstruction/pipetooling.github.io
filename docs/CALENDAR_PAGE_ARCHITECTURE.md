# Calendar Page Architecture Map

---
file: docs/CALENDAR_PAGE_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the Calendar.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md) — inventory what every region of the 2,044-line src/pages/Calendar.tsx touches (state, effects, loaders, render helpers, tables, coupling, test coverage) so extraction can start without re-deriving the strategy. Sections — What this surface is; Master summary table; Per-region dossiers; Shared substrate; Stage-A inventory; Recommended extraction order; Hazards.
covers:
  - src/pages/Calendar.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
---

> **Line numbers are exact as of `a05cef4c4`** (from the `npm run map -- src/pages/Calendar.tsx` fact sheet) and rot with the next edit — search the symbol named beside each range; the range is only a hint. Re-run `npm run map` before trusting one.

## What this surface is

| File | Lines | Components | useState | Effects | useMemo | useCallback | useRef | Custom hooks | Handlers / inner fns | Last commit | Commits / 90 d |
|---|---|---|---|---|---|---|---|---|---|---|---|
| [`src/pages/Calendar.tsx`](../src/pages/Calendar.tsx) | 2,044 | 1 (+15 module fns) | 22 | 6 | 0 | 0 | 0 | 4 | 17 | 2026-09-06 `5799b55b9` | 12 |

[`src/pages/Calendar.tsx`](../src/pages/Calendar.tsx) is the **personal** month calendar at `/calendar` (`App.tsx` 332, lazy import at 21, no `ErrorBoundary` wrapper; `App.tsx` is the only importer). The signed-in user sees their own world on one month grid: workflow stages assigned to them by name, bid due dates (office + estimators), their prospect callbacks, and, per toggle, their salaried workday / time off, no-call-no-show marks, recorded clock time and planned dispatch blocks. Above the grid sits a **My Day** card (scrub day by day through planned work); below it an **Upcoming** list. Every role reaches it (`layoutRouteAccess.ts` lists `/calendar` for subcontractor, primary, superintendent and estimator; office roles are unrestricted); nav entries: `Layout.tsx` 1821 gear menu, `phoneDock.ts` 104, links from `DashboardMyScheduleSection.tsx` 341 and `Prospects.tsx` 2219. It is **not** a dispatch surface — roles in `CAN_VIEW_SCHEDULE_DISPATCH_ROLES` get a one-line pointer to `/schedule-dispatch` (996–1003).

- **Props / parent contract:** none — a route page. Context in: `useAuth` (288: `user`, `role`), `useLedgerPrefixMap` (289, J#/B# prefixes for session chips), `useMatchMedia(CALENDAR_MOBILE_CHROME_MQ = '(max-width: 640px)')` (290), `useJobDetailModal` (325, planned chips open Job Detail in place).
- **Module scope 35–285:** 10 type aliases (35–92), 5 constants (`CALENDAR_PLAN_CHIP_CAP` 37, `CALENDAR_MOBILE_CHROME_MQ` 40, three `CALENDAR_DAY_*` colors 106–109), 15 pure helpers (94–285) — all inline, none tested.
- **`Calendar()` 287–2044 (1,758 lines):** 22 `useState` (291–324), 6 effects (329–558), 0 memos / callbacks / refs, 17 inner functions (560–972: 3 loaders, 6 per-date selectors/builders, 3 month-nav handlers, 4 `render*` JSX helpers, 1 formatter). Two early returns (974 loading, **975 error — replaces the whole page**), then render-scope derivations 977–992 (`days`, `visibleDays`, `dayHeaders`, `gridColumns`, `monthName`, `centralNow`, `todayKey`, `isCurrentMonth`).
- **Render 994–2043 (1,050 lines).** Monster blocks: the `!loading` fragment 1010–2022 (1,013) containing the **month grid / day cell map 1081–1535 (455)**, the **inline day modal 1554–1878 (325)**, the **Upcoming section 1880–2020 (141)** and the **My Day card 1012–1060 (49)**; plus `renderPlannedWorkChips` 885–972 (88) and the three toggle renderers 801–883 (83).
- **Already extracted children:** [`PreviewJobModal`](../src/components/calendar/PreviewJobModal.tsx) (279 lines, 5 `useState`, 1 effect, 2 `useMemo`; also mounted by `ScheduleDispatchJobWeek.tsx` 1126) and [`PersonalTimeOffModal`](../src/components/PersonalTimeOffModal.tsx) (73 lines, wraps `TimeOffSettings`). Fact-sheet render children: `Link`×14, `PreviewJobModal`, `PersonalTimeOffModal`.
- **Not tab-switched.** No `activeTab`, no `useSearchParams`, no URL state at all: the only pointers are `currentMonth`, `myDayKey`, and three modal pointers. Every region renders together, gated by role (loaders), salary eligibility and three view toggles.
- **No money on this page.** Nothing renders dollars. The one pay-adjacent number is recorded hours (`aggregateCalendarClockedHoursByDate`, "Sum payable clock duration per work_date") — untested.

Related: salary layer semantics in [`SALARY_CLOCK_SESSIONS.md`](./SALARY_CLOCK_SESSIONS.md); the clock surfaces that write `clock_sessions` in [`CLOCK_SURFACES_ARCHITECTURE.md`](./CLOCK_SURFACES_ARCHITECTURE.md); the dispatch side that writes `job_schedule_blocks` in [`SCHEDULE_DISPATCH_ARCHITECTURE.md`](./SCHEDULE_DISPATCH_ARCHITECTURE.md); role access in [`ACCESS_CONTROL.md`](./ACCESS_CONTROL.md).

**Churn:** 12 commits in 90 days, mostly sweeps (theme tokens, dialog-role v2.2188, active-people/robot-bid filter v2.2893, papercut batch v2.2919). The shape-defining ones: My Day card + planned chips (2026-05-19), Personal Time Off modal (v2.1544), phone chip clamping (v2.1563).

### How to maintain this doc

- Flip a region's Status and point at the new file when it is extracted; regenerate the fact sheet (`npm run map -- src/pages/Calendar.tsx`) and bump `mapped_at` when refreshing ranges.

---

## Master summary table

| Region | Anchor (symbol + lines @ a05cef4c4) | ~Lines | Coupling | Risk | Status |
|---|---|---|---|---|---|
| Module types + pure helpers | types 35–92; `getBidSubmissionStatus` 94 … `calendarRecordedHasVisibleSummary` 283–285 | 250 | none (pure); `formatDateKey`/`getCentralDate*` used by most regions (not the page hints or month header) | low | inline, **0 tests** |
| Month / day pointers + month-bump | state `currentMonth` 320, `myDayKey` 324; effect 329–337; `prevMonth`/`nextMonth`/`today` 786–799; derivations 977–992 | 45 | read by the two month effects (359, 485), My Day, month header and grid — not the agenda effect 463, the day modal or Upcoming | **med — effect 329 has a live bug** (see Hazards) | inline |
| Agenda loaders (identity, stages, bids, callbacks) | effect 463–483; `loadAssignedSteps` 560–624; `loadBids` 626–673; `loadProspectCallbacks` 675–690 | 150 | `steps`/`bids`/`prospectCallbacks` read by grid, day modal, Upcoming, `PreviewJobModal`; `userName` gates the salary effect | med (role gates, name-match identity, robot-bid filter) | inline; `partitionBidsByScope` tested |
| Month personal layers (NCNS, clock, planned) | effect 359–461 | 103 | 4 maps read by grid, day modal, My Day | low-med | inline; session kernels tested, **hours sum untested** |
| Salary workday layer | effect 485–558; `getWorkdayResolutionForDate` 739–746 | 85 | 4 states read by grid, day modal, Upcoming, toggles | med (name-keyed identity drift) | inline; `resolveCalendarWorkday` tested |
| Per-date selectors + Upcoming builder | `getStepsForDate` 692–710, `getBidsForDate` 712–719, `getCallbacksForDate` 721–727, `getStepDateKey` 729–737, `buildUpcomingList` 748–775, `formatUpcomingDate` 777–784 | 95 | close over state **and** render-scope `todayKey`/`centralNow` (989–991) | low | inline, 0 tests |
| View toggles + prefs | effects 339–347, 349–357; `renderShowMyWorkdayToggle` 801–825, `renderShowRecordedTimeToggle` 827–858, `renderShowWeekendsToggle` 860–883; placements 1071–1074, 1537–1552 | 120 | flags read by grid + modal (`showWeekends` by the grid only); `localStorage` keys per user id | low | inline, 0 tests |
| Page hints | dispatch pointer 996–1003; "No stages assigned" 1004–1008 | 13 | `authRole`, `userName` | low | inline |
| My Day card + planned-chip list | card 1012–1060; `renderPlannedWorkChips` 885–972 | 137 | `myDayKey`, `plannedByWorkDate`, `JobDetailModalContext` | low | inline; `scheduleFormatWindow` tested |
| Month header | 1061–1079 | 19 | nav handlers + desktop toggles | low | inline |
| Month grid + day cell | 1081–1535 (cell map 1087–1534) | 455 | reads ~15 values; writes 3 modal pointers | **high** (widest read set) | inline |
| Day modal | `selectedDayForModal &&` IIFE 1554–1878 | 325 | reads every layer; writes `selectedDayForModal`, `previewJobModal`, `personalTimeOffOpen` | med-high | inline, no Escape handler |
| Upcoming list | `<section>` 1880–2020 | 141 | `buildUpcomingList()` + `formatUpcomingDate` | low | inline, 0 tests |
| Job preview modal | mount 2023–2034 | 12 | `previewJobModal`, `steps`, `authRole` | low | **extracted** → [`PreviewJobModal.tsx`](../src/components/calendar/PreviewJobModal.tsx) (no tests) |
| Personal time-off modal | mount 2035–2041 | 7 | `personalTimeOffOpen`, `authUser.id` | low | **extracted** → [`PersonalTimeOffModal.tsx`](../src/components/PersonalTimeOffModal.tsx) (render test, 2 cases) |

State by region (22): pointers 2 (`currentMonth`, `myDayKey`) · agenda 6 (`userName`, `steps`, `bids`, `prospectCallbacks`, `loading`, `error`) · month layers 4 (`ncnsByWorkDate`, `recordedByWorkDate`, `sessionsByWorkDate`, `plannedByWorkDate`) · salary layer 4 (`isSalaryLayerEligible`, `salaryTemplate`, `salaryOverridesByDate`, `timeOffRows`) · view toggles 3 (`showMyWorkday`, `showRecordedTime`, `showWeekends`) · modal pointers 3 (`selectedDayForModal`, `previewJobModal`, `personalTimeOffOpen` — parent-held and shared: the grid and the day modal set them, and the two extracted modals' mounts clear the last two through `onClose`).

---

## Per-region dossiers

### Module types + pure helpers

- **Location:** 35–285, above `export default function Calendar()` (287).
- **Types:** `UserRole` 35 (narrow local union — no `superintendent`, `primary`, `controller`), `PlannedBlockRow` 42–50, `CalendarStep` 52–60, `CalendarBid` 62–68, `CalendarProspectCallback` 70–75, three `Database` row aliases 77–79, `NcnsCalendarDayInfo` 81–85, `UpcomingListItem` 87–92 (5-way union).
- **Helpers:** bid status `getBidSubmissionStatus` 94–100 / `getBidSubmissionStatusColor` 102–104; `calendarGridDayAriaLabel` 111–119; date keys `formatDateKey` 122–127 (local getters), `shiftYmd` 141–148, `formatMyDayHeadingLabel` 151–168, `getCentralDateFromUTC` 170–189 (null on bad input), `getCentralDate` 191–204 (a local `Date` whose Y/M/D are the Chicago date); grid `getDaysInMonth` 207–229 (Sunday-start, adjacent-month padding), `getVisibleGridDateRange` 232–248; chip text `compactScheduleWindow` 134–138, `showScheduledSalaryProjectionForYmd` 251–253 (strictly after today), `ncnsCalendarChipTitle` 255–260 (157-char clip), `formatCalendarRecordedLine` 262–281, `calendarRecordedHasVisibleSummary` 283–285.
- **Duplicates elsewhere (note, don't silently swap):** `getCentralDateFromUTC` ≈ `calendarYmdInAppTzFromIso` ([`dateUtils.ts`](../src/utils/dateUtils.ts) 20, returns `''` not `null`); `formatDateKey(getCentralDate(new Date()))` ≈ `todayYmdInAppTz` (dateUtils 42) ≈ `scheduleTodayDateKey` ([`jobScheduleChicago.ts`](../src/lib/jobScheduleChicago.ts) 33); `shiftYmd` ≈ `ymdAddDays` (dateUtils 132, UTC math) ≈ `scheduleDateKeyAddDays` (jobScheduleChicago 95) and a private copy in `DashboardCrewDaySection.tsx` 62.
- **Tests:** none. Twin coverage: `todayYmdInAppTz` by `dateUtils.appTz.test.ts` (7 `it`) and `appTimeZoneSharedParity.test.ts` (3 `it`, one an `it.each` ×6); `scheduleTodayDateKey` / `scheduleDateKeyAddDays` by `jobScheduleChicago.test.ts`; `calendarYmdInAppTzFromIso` only indirectly (via `todayYmdInAppTz`); dateUtils `ymdAddDays` has no direct test (the parity test's `ymdAddDays` is the edge `_shared/appTimeZone` copy).
- **Approach:** Stage A first (see inventory) — the cheapest, safest PR on the page.

### Month / day pointers + month-bump effect

- **State:** `currentMonth` 320 (a `Date`; initial = today in Chicago, not the 1st), `myDayKey` 324 (YYYY-MM-DD, initial = Chicago today).
- **Writers:** `prevMonth` 786–788 / `nextMonth` 790–792 (1st of month), `today` 794–799 (both pointers), My Day arrows 1034/1052 (`shiftYmd` on `myDayKey`), effect **329–337** (if `myDayKey` falls outside `getVisibleGridDateRange(currentMonth)`, snap `currentMonth` to `myDayKey`'s month).
- **Readers:** effects 359 and 485 (deps include `currentMonth` → refetch), render derivations 977–992, My Day card (1047, 1058), month header (`monthName`), grid (1092 + `isCurrentMonth`). The day modal and Upcoming read neither pointer.
- **Tests:** none.
- **Status / approach:** stays in the parent permanently (both month effects, My Day, the header and the grid read it). Fix the effect-329 bug in its own PR **before** any move (Hazards #1).

### Agenda loaders — identity, stages, bids, callbacks

- **Effect 463–483** (`[authUser?.id]`, no cancel flag): reads `users` (`name, email, role, estimator_service_type_ids`) → `setUserName`, then **sequentially** awaits the three loaders with the DB role (not `useAuth`'s role), then `setLoading(false)`. No `authUser` → `loading=false` immediately.
- **`loadAssignedSteps` 560–624:** `project_workflow_steps` by **`assigned_to_name = users.name.trim()`** → `project_workflows` → `projects` (3 round trips) → `CalendarStep[]`. Error → `setError` (whole page replaced). All dates, not month-scoped.
- **`loadBids` 626–673:** code gate dev / master / assistant-like / estimator (628); `bids` with due date, `outcome` null or ≠ lost; estimators narrowed to `estimator_service_type_ids` (638–640); in parallel `fetchTwinUserIds()`; `partitionBidsByScope(...).people` drops robot/twin bids (652–664). Error → `setError`.
- **`loadProspectCallbacks` 675–690:** gate dev / master / assistant-like; `prospect_callbacks` by `user_id`; errors swallowed to `[]`.
- **Owned state:** `userName`, `steps`, `bids`, `prospectCallbacks`, `loading`, `error`.
- **Readers:** per-date selectors (grid + modal), `buildUpcomingList`, `PreviewJobModal` (`steps` prop → its props-only path), salary effect (`userName`), "No stages assigned" hint (1004).
- **Cross-surface:** Dashboard reads assigned steps through RPC `get_assigned_steps_with_projects_for_dashboard` ([`useDashboardBoot.ts`](../src/hooks/useDashboardBoot.ts) 201, 273), which since v2.1733 (migration `20260817012110`) matches `assigned_person_id` first and the name case-insensitively as fallback — so a step assigned by person id only, or under a differently-cased name, shows on the Dashboard but not here; [`previewJobModalStages.ts`](../src/lib/previewJobModalStages.ts) 20–24 documents that it "Matches Calendar `loadAssignedSteps`" (exact name, like this page). `project_workflow_steps.assigned_person_id` exists but is not used here.
- **Tests:** `bidBoardScope.test.ts` (6). Loaders themselves: none.
- **Risk:** med. **Approach:** hook seam `useCalendarAgenda(authUserId)` returning the 6 values; keep the name-match and role gates byte-identical.

### Month personal layers — NCNS, clock sessions, planned blocks

- **Effect 359–461** (`[authUser?.id, currentMonth]`, has a `cancelled` flag): grid-range bounded (`getVisibleGridDateRange`). `Promise.all` of `attendance_incidents` (`subject_user_id`, `incident_type='no_call_no_show'`, newest first → first row per `work_date` wins) and `clock_sessions` (`CLOCK_SESSION_CALENDAR_SELECT`, `user_id`); then `job_schedule_blocks` (`assignee_user_id`, ordered by date + start) in an inner try that **swallows errors** ("table may not exist until migration applied"). Any outer failure clears all four maps.
- **Owned state:** `ncnsByWorkDate` (Map), `recordedByWorkDate`, `sessionsByWorkDate`, `plannedByWorkDate`.
- **Kernels:** `calendarRawToClockSessionRow`, `isCalendarClockSessionActive`, `groupActiveClockSessionsByWorkDate` ([`calendarClockSessionDisplay.ts`](../src/lib/calendarClockSessionDisplay.ts), tested ×9); `aggregateCalendarClockedHoursByDate` ([`calendarClockedHoursByDate.ts`](../src/lib/calendarClockedHoursByDate.ts), **no test**).
- **Readers:** grid bottom stack (1329–1529), day modal (1565–1570), My Day card (1058).
- **Risk:** low-med. **Approach:** hook seam `useCalendarMonthLayers(uid, currentMonth)`; add the hours-aggregation test in Stage A.

### Salary workday layer

- **Effect 485–558** (`[authUser?.id, userName, currentMonth]`, **no cancel flag**): `people_pay_config.is_salary` by **`person_name = userName.trim()`** → `salary_work_schedule_templates` by `user_id` → (both present) `Promise.all` of `salary_work_schedule_day_overrides` (grid range) and `user_time_off` (overlapping grid range). Any miss/failure resets all four.
- **Owned state:** `isSalaryLayerEligible`, `salaryTemplate`, `salaryOverridesByDate`, `timeOffRows`.
- **Selector:** `getWorkdayResolutionForDate` 739–746 → [`resolveCalendarWorkday`](../src/lib/resolveCalendarWorkday.ts) (tested ×11; `timeOffKindLabel` from the same file).
- **Readers:** grid workday chips 1268–1328, day modal 1558–1564 / 1620–1669, `buildUpcomingList` 762–772, toggle placement 1072 / 1548.
- **Cross-surface drift:** [`selfSalaryClockState.ts`](../src/lib/selfSalaryClockState.ts) (identity Phase D, v2.1734) resolves salary id-first via RPC `self_salary_clock_state` with the name match as fallback; this effect still uses only the name match (Hazards #4).
- **Risk:** med. **Approach:** hook seam `useCalendarSalaryLayer(uid, userName, currentMonth)`; adopt `fetchSelfSalaryClockState` for the eligibility probe only in a separate behavior PR.

### Per-date selectors + Upcoming builder

- **`getStepsForDate` 692–710 / `getStepDateKey` 729–737:** a stage's day = `scheduled_start_date` (date string as-is, or timestamp → Chicago) else `started_at` → Chicago. The two functions encode the same rule twice (`getStepDateKey` also `.slice(0, 10)`s).
- **`getBidsForDate` 712–719:** `bid_due_date.slice(0, 10)` (no TZ conversion). **`getCallbacksForDate` 721–727:** `callback_date` → Chicago.
- **`buildUpcomingList` 748–775:** steps/bids/callbacks with key ≥ `todayKey`; when salary-eligible, time-off rows with `end_date ≥ todayKey` (keyed by `start_date`) and meaningful overrides; sorted by key. **`formatUpcomingDate` 777–784:** reads render-scope `centralNow`.
- **Hidden coupling:** `buildUpcomingList` and `formatUpcomingDate` read `todayKey` / `centralNow`, which are `const`s declared at 989–991 *after* them — works only because they run during render. An extracted kernel must take `todayKey` / `nowYear` as arguments.
- **Tests:** none. **Approach:** Stage A → `src/lib/calendar/calendarDayItems.ts`.

### View toggles + persisted prefs

- **State:** `showMyWorkday` 300, `showRecordedTime` 301, `showWeekends` 303 (initial `!mobileCalendarLayout`, evaluated once).
- **Effects 339–347 / 349–357:** read `calendar_show_my_workday_<uid>` / `calendar_show_recorded_time_<uid>` from `localStorage` (try/catch). Renderers write them on change (815, 848). **`showWeekends` is never persisted** although the comment at 302 says "Overridden by stored value once the user toggles".
- **Placement:** desktop inline in the month header (1071–1074, "Show my workday" only when salary-eligible); phone below the grid (1537–1552).
- **Tests:** none. **Risk:** low. **Approach:** `CalendarViewToggles` component (owns the `localStorage` writes); the three flags stay in the parent (grid + modal read `showMyWorkday` / `showRecordedTime`; `showWeekends` only feeds the grid derivations 977–987).

### Page hints

- 996–1003: `authRole ∈ CAN_VIEW_SCHEDULE_DISPATCH_ROLES` → pointer to `/schedule-dispatch` (uses `useAuth` role, unlike the loaders). 1004–1008: `!userName` → "No stages assigned…". Leave inline.

### My Day card + planned-chip list

- **Location:** 1012–1060 (only with `authUser?.id`); body `renderPlannedWorkChips(plannedByWorkDate[myDayKey] ?? [])` 1058.
- **`renderPlannedWorkChips` 885–972:** label `"<hcp> · <job name>"` / `'Job'`, `scheduleFormatWindow` + "Central", note; a chip with `job_id` and a Job Detail context becomes a button → `jobDetailModalCtx.openJobDetail({ jobId })` (optional `onChipClick` lets the day modal close first, 1699–1701). Reused by the day modal.
- **State:** writes `myDayKey` (arrows); reads `plannedByWorkDate`. `myDayKey` must stay in the parent (effect 329 + `today()`).
- **Tests:** `jobScheduleChicago.test.ts` (8) covers the window formatter only.
- **Risk:** low. **Approach:** `PlannedWorkChipList` (from 885–972) + `CalendarMyDayCard` (props: `dayKey`, `todayKey`, `planned`, `onShift`).

### Month header

- 1061–1079: prev / month name (`monthName` 988, `timeZone: APP_CALENDAR_TZ`) / next, desktop toggles, Today. Folds into the toggles or grid PR.

### Month grid + day cell

- **Location:** grid container 1081–1535; `dayHeaders` 1082–1086; `visibleDays.map` 1087–1534 (one 120-px cell per day; click / Enter / Space → `setSelectedDayForModal(day)`).
- **Top chips 1126–1250:** stages (1127–1190; status tint ternary; click → `setPreviewJobModal`; nested `Link` to `/workflows/:projectId`), bids (1191–1225; `Link` `/bids?bidId=…&tab=submission-followup`; `[on time|early|not sent]`), callbacks (1226–1249; `Link` `/prospects?tab=follow-up&prospect_id=…`).
- **Bottom stack 1251–1530:** workday chips 1268–1328 (time off → button opens `PersonalTimeOffModal`; scheduled blocks only for days after today → `Link` `/settings#settings-salary-workday`), NCNS badge 1329–1353, recorded total 1354–1380, session chips 1381–1453 (cap `CALENDAR_SESSION_CHIP_CAP` = 3, `+N`), planned chips 1454–1529 (cap `CALENDAR_PLAN_CHIP_CAP` = 3, `+N`; phone uses `compactScheduleWindow` and a space separator; label fallback `'Planned'`).
- **Reads:** `visibleDays`, `todayKey`, `isCurrentMonth`, `currentMonth`, 3 per-date selectors, `showMyWorkday`, `isSalaryLayerEligible`, `getWorkdayResolutionForDate`, `ncnsByWorkDate`, `showRecordedTime`, `recordedByWorkDate`, `sessionsByWorkDate`, `prefixMap`, `plannedByWorkDate`, `mobileCalendarLayout`. **Writes:** `selectedDayForModal`, `previewJobModal`, `personalTimeOffOpen`.
- **Tests:** session-chip kernels only (`calendarClockSessionDisplay.test.ts`); no render smoke for the page.
- **Risk:** high (widest read set; `stopPropagation` on every chip is load-bearing). **Approach:** last; split into `CalendarDayCell` (pure props per day, pre-bucketed by the parent) inside `CalendarMonthGrid`.

### Day modal (inline)

- **Location:** `selectedDayForModal && (() => { … })()` 1554–1878; overlay `zIndex: 50`, `role="dialog" aria-modal` 1593; closes on backdrop / Close button — **no Escape handler** anywhere in the file.
- **Derives 1555–1579:** per-date steps/bids/callbacks, the heading via `formatUpcomingDate` (1559 — so that formatter is shared with Upcoming, not Upcoming-only), `modalWorkday` (only when `showMyWorkday && isSalaryLayerEligible`), NCNS, recorded total, sessions, planned, `hasItems`.
- **Sections (order is the UI):** time off 1620–1647 (closes the day modal, opens `PersonalTimeOffModal`), scheduled workday 1648–1669, NCNS 1670–1693, planned work 1694–1703 (`renderPlannedWorkChips`), clock sessions 1704–1747 (full list with notes; "Scheduled" tag for `origin === 'salary_schedule'`), recorded total 1748–1765, stages 1766–1827 ("Job preview" opens `PreviewJobModal` **over** the still-open day modal), bids 1828–1852, callbacks 1853–1872.
- **Owned state if moved:** none of its own — `selectedDayForModal` stays in the parent (the grid writes it). Props = the day + the pre-bucketed layer slices + 3 callbacks.
- **Tests:** none. **Risk:** med-high. **Approach:** `CalendarDayModal` after the Stage-A bucket kernel exists, so the parent passes one `CalendarDayItems` object shared with the grid cell.

### Upcoming list

- **Location:** `<section>` 1880–2020; `buildUpcomingList()` 1883; five row kinds 1903–2014 (stage → `/workflows/:id`; bid → Bids follow-up; callback → Prospects follow-up; time off → `/settings#settings-time-off`; override → `/settings#settings-salary-workday`).
- **Tests:** none. **Risk:** low. **Approach:** first Stage-B extract → `CalendarUpcomingList({ items, todayYear })`.

### `PreviewJobModal` (extracted)

- Mount 2023–2034: `projectId`, `stepId`, `contextDateKey`, `steps` (full list → props-only path, no stage fetch), `authUserId`, `showJobsDeepLink = !isSubcontractorLikeRole(authRole)`. Inside: RPC `list_assigned_jobs_for_dashboard`, `job_schedule_blocks` by `assignee_user_id`; `fetchPreviewJobModalStageSummary` only when `steps` is omitted (the Schedule Dispatch job-week path). `zIndex: 1003`. **No tests** for the component or `previewJobModalStages.ts`.

### `PersonalTimeOffModal` (extracted)

- Mount 2035–2041 (only with `authUser.id`); wraps `TimeOffSettings`; `zIndex: 1100`. `PersonalTimeOffModal.render.test.tsx` (2). Note: saving time off here does **not** refresh `timeOffRows` — the salary effect only re-runs on uid / userName / month change.

---

## Shared substrate

There is **no selection pointer and no single data engine**; the page is three independent loaders feeding one render.

| Substrate | Where | Read by | Becomes |
|---|---|---|---|
| Pointers `currentMonth` + `myDayKey` | 320, 324; effect 329–337; 786–799 | both month effects, My Day, month header, grid | **stays in parent** |
| Agenda (all-time) | effect 463–483 + loaders 560–690 | grid, modal, Upcoming, `PreviewJobModal`, salary effect | `useCalendarAgenda(uid)` |
| Month layers (grid range) | effect 359–461 | grid, modal, My Day | `useCalendarMonthLayers(uid, currentMonth)` |
| Salary layer (grid range) | effect 485–558 | grid, modal, Upcoming, toggles | `useCalendarSalaryLayer(uid, userName, currentMonth)` |
| Render-scope "today" | `centralNow`, `todayKey`, `isCurrentMonth` 989–992 | grid, modal, My Day, Upcoming builder | stays; passed down as props |
| View flags | 300–303 | grid, modal, toggles | stay in parent |
| Contexts | `useLedgerPrefixMap`, `useJobDetailModal`, `useAuth` | session chips, planned chips, hints + preview | read where used (children may call the hooks themselves) |

All three hooks share one date vocabulary (`formatDateKey`, `getVisibleGridDateRange`) — which is why the Stage-A grid kernel goes first.

---

## Stage-A inventory

**Still inline → should move to `src/lib/calendar/*` with tests:**

| Target kernel | Symbols (lines) | Notes |
|---|---|---|
| `calendarGrid.ts` | `formatDateKey` 122–127, `shiftYmd` 141–148, `getCentralDateFromUTC` 170–189, `getCentralDate` 191–204, `getDaysInMonth` 207–229, `getVisibleGridDateRange` 232–248, `formatMyDayHeadingLabel` 151–168, `calendarGridDayAriaLabel` 111–119; the weekday filter / headers / columns at 977–987 as `buildMonthGridView(anchor, showWeekends)` | Keep local-`Date` semantics; test month edges (Sunday-start months, Dec→Jan padding, DST weeks). Do not swap in the dateUtils twins in the same PR (null vs `''`). |
| `calendarDayItems.ts` | `getStepDateKey` 729–737 (+ the duplicate rule in `getStepsForDate` 692–710), bid / callback day keys (712–727), `buildUpcomingList` 748–775 (take `todayKey`), `formatUpcomingDate` 777–784 (take the current year), a `bucketByDateKey` helper for the grid + modal | One bucketing pass per render replaces up to 42 cells × 3 `filter` calls. |
| `calendarChipText.ts` | `getBidSubmissionStatus` 94–100 + color 102–104, `compactScheduleWindow` 134–138, `showScheduledSalaryProjectionForYmd` 251–253, `ncnsCalendarChipTitle` 255–260, `formatCalendarRecordedLine` 262–281, `calendarRecordedHasVisibleSummary` 283–285; step status tint (3 copies: 1154–1161, 1771–1778, 1911); planned-block label (2 copies with different fallbacks: 904–907 `'Job'`, 1464–1471 `'Planned'`) | Preserve both fallbacks and the late-send-reads-"on time" rule (Hazards #6). |
| test gap | `aggregateCalendarClockedHoursByDate` ([`calendarClockedHoursByDate.ts`](../src/lib/calendarClockedHoursByDate.ts)) | Pay-adjacent hours sum with no test: add `calendarClockedHoursByDate.test.ts` (closed / open / rejected / revoked / zero-length). |

**Already extracted and consumed here:** `calendarClockSessionDisplay.ts` (9 tests), `resolveCalendarWorkday.ts` (11), `bidBoardScope.ts` (6), `jobScheduleChicago.ts` (8), `calendarClockedHoursByDate.ts` (0), `clockSessionSelect.ts` (constant), `fetchTwinUserIds.ts` (0), `scheduleDispatchEditRoles.ts`, `subcontractorLikeRole.ts`.

---

## Recommended extraction order

| # | Step | Expected size |
|---|---|---|
| 0 | **Separate bug-fix PR (not a move):** effect 329–337 fires on month changes too and snaps the month arrows back (Hazards #1); also the stale `#settings-time-off` link at 1973 | ~15 lines + a test |
| 1 | Stage A `calendarGrid.ts` + tests | ~130 lib, ~15 tests; page −130 |
| 2 | Stage A `calendarDayItems.ts` + `calendarChipText.ts` + tests, and the missing `calendarClockedHoursByDate.test.ts` | ~200 lib, ~30 tests; page −150 |
| 3 | `CalendarUpcomingList` (1880–2020) | ~150-line component; page −140 |
| 4 | `CalendarViewToggles` (801–883 + placements) | ~100; page −95 |
| 5 | `PlannedWorkChipList` (885–972) + `CalendarMyDayCard` (1012–1060) | ~150; page −135 |
| 6 | Hook seams `useCalendarAgenda`, `useCalendarMonthLayers`, `useCalendarSalaryLayer` (463–483 + 560–690; 359–461; 485–558 + 739–746) | ~350 across 3 hooks; page −340 |
| 7 | `CalendarDayModal` (1554–1878) | ~330; page −325 |
| 8 | `CalendarMonthGrid` + `CalendarDayCell` (1081–1535) | ~470; page −455 |

Add a `Calendar.render.test.tsx` smoke (`renderWithProviders`) at step 3 so later moves have a wiring net. End state: a ~300-line parent holding the pointers, view flags, 3 modal pointers, the three hook calls and the layout.

---

## Hazards

| # | Hazard | Where | What to do |
|---|---|---|---|
| 1 | **Month arrows snap back.** The "My Day scrubbed past the grid" effect has deps `[myDayKey, currentMonth]`, so it also runs after `prevMonth` / `nextMonth`; unless `myDayKey` lands in the new grid's padding days it resets `currentMonth` to `myDayKey`'s month. Simulating the kernels with `myDayKey = 2026-09-25`: next → Oct grid 09-27…10-31, back prev → Aug grid 07-26…09-05 — both snap back to September. Found by reading + simulation, not reproduced live. | effect 329–337; `prevMonth`/`nextMonth` 786–792 | Fix alone (step 0): move the bump into the My Day arrow handlers, or key it on `myDayKey` only. Never carry it silently into a hook. |
| 2 | **Error replaces the whole page.** `setError` from `loadAssignedSteps` / `loadBids` makes 975 return a bare red paragraph; callbacks and the two month effects swallow errors instead. | 571–573, 642–644, 975 | Preserve; a hook must surface `error` the same way. |
| 3 | **Two role sources.** Loaders gate on `users.role` read in effect 463; the dispatch hint and `showJobsDeepLink` use `useAuth().role`. Local `UserRole` (35) omits superintendent / primary / controller (controller passes through `isAssistantLike`). Superintendents and primaries get no bids or callbacks. | 35, 474–480, 628, 676, 996, 2032 | Keep both sources as-is during moves; row visibility beyond these code gates is whatever RLS returns (no RPCs, no edge functions on this page). |
| 4 | **Name-keyed identity.** Stages match `assigned_to_name = users.name`; salary eligibility matches `people_pay_config.person_name = users.name`. A renamed user loses stages and the salary layer here while `fetchSelfSalaryClockState` (id-first RPC) keeps the clock UI salaried and the Dashboard's id-first steps RPC keeps the stages. | 566–569, 498 | Behavior change → its own PR, not part of a move. |
| 5 | **Effect races.** Effect 485 (salary) and 463 (agenda) have no cancel flag; only 359 does. `currentMonth` is a `Date`, so every `setCurrentMonth` — including `today()` on the same month — refetches both month effects. | 359–461, 463–483, 485–558, 794–799 | Add cancellation when the hooks are built; keep the deps. |
| 6 | **Preserve-quirks.** `getBidSubmissionStatus` reports a bid sent *after* its due date as "on time" (only `sent < due` is "early"). Upcoming's time-off / override rows come from the grid-range fetch, so they change as you navigate months, while stages / bids / callbacks are all-time. Today's cell ring needs `isCurrentMonth`, so today on an adjacent month's padding row is not ringed. The planned-chip label falls back to `'Job'` in the list and `'Planned'` in the grid. `showWeekends` is not persisted despite its comment. | 94–100, 748–775, 1091, 904–907 / 1464–1471, 302–303 | Keep byte-identical during moves; fix separately if wanted. |
| 7 | **Stale deep link.** Upcoming time-off rows link to `/settings#settings-time-off`, a legacy anchor (`settingsDeepLink.ts` 7, 24 → Account tab, no section); the grid and day modal open `PersonalTimeOffModal` instead (v2.1544). | 1973 | Fix in step 0. |
| 8 | **URL deep links out (no URL state in).** `/workflows/:projectId`, `/bids?bidId=…&tab=submission-followup`, `/prospects?tab=follow-up&prospect_id=…`, `/settings#settings-salary-workday`, `/settings#settings-time-off`, `/schedule-dispatch`. | grid, modal, Upcoming | Keep the strings exactly; the bid / prospect params are read by those pages. |
| 9 | **Modal stacking + propagation.** Day modal `zIndex: 50`; `PreviewJobModal` 1003 opens over it; the time-off path closes the day modal first. Every chip in a cell calls `stopPropagation` so it does not also open the day modal. No Escape handler on the day modal. | 1554–1878, 1132–1148, 1179, 1197, 1230, 1280–1283 | Keep the ordering and the `stopPropagation` calls when splitting the cell. |
| 10 | **Unguarded table.** `job_schedule_blocks` read failures are swallowed ("table may not exist until migration applied") → empty My Day with no error. | 426–447 | Preserve; the comment is stale but harmless. |
| — | Money / realtime | — | No dollar amounts, no `supabase.channel` subscriptions, no RPC writes; the page is read-only apart from `localStorage` prefs. |
