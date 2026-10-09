---
name: "The schedule's PR 9: the rest of the plan's writes on real data, read back and cut in four"
rows: SCHEDULE_REAL_BUILD.md, The PRs in order, 9; mockups/schedule-pr1b.md, The holds (way 3); mockups/schedule-pr5.md and schedule-pr6.md (the writes and the io); GANTT_FEATURES.md G-37 (pull earlier), G-38 (the job's own work), G-39 (parts), G-41 (baselines), G-52 (the walk), G-73 to G-75 (waits), G-77 (not ready), G-82 (days back), G-83 (places), G-138 (uninsured)
branch: the plan on spike/schedule-pr9-plan (from origin/spike/gc-mode); the code from origin/main
status: plan 2026-10-09 by Helper 11, the Schedule lane, at the lead's ask. The lead approved the read-back's four cuts and its pick on catch 1 the same day. Nothing is built yet.
---

# The schedule's PR 9: the rest of the plan's writes, read back and cut in four

## What PR 9 is

*SCHEDULE_REAL_BUILD.md*, PR 9: "the walk, pulls, days got back, baselines, splits, places, added bars, inspections, milestones and waits", with the pulls and days back by way 3 and `chartHolds` and `pullHolds` as this PR's io. 8b's form left four of its pieces for PR 9: the papers (G-77), the place (G-83), the job's own bar's buttons (G-38) and an inspection's pass.

## No SQL beyond PR 5's

Every press has its function in PR 5's migration (`20261008040000_gc_schedule_writes`) or a plain write under RLS, and its io function in 6b's `scheduleIo.ts`, both on main. Each column it writes is in PRs 2 to 4's tables. A plan write sends the version it read and is refused with *The schedule changed while you were working.* A record sends none.

| Press | The prototype's action | Main's write | 6b's io | Version |
|---|---|---|---|---|
| An inspection passed | `passInspection` | `gc_schedule_pass_inspection` (and a date to meet of the same name met) | `passScheduleInspection` | none, a record |
| An inspection failed | `failInspection` | `gc_schedule_fail_inspection` (`gc_schedule_inspection_failures`: `note`, `package_ids`, `reinspect_on`) | `failScheduleInspection` | the plan's |
| The job's own work added (G-38) | `addScheduleActivity` | `gc_schedule_add_activity` (its waits, what waits on it, what that pushes) | `addScheduleActivity` | the plan's |
| … done, or not done after all | `setAddedActivityDone` | `gc_schedule_activities.done_on`, `kind = 'added'` | `setOwnWorkDone` | none |
| … taken off | `removeScheduleActivity` | `gc_schedule_remove_activity` | `removeScheduleActivity` | the plan's |
| A date to meet set or taken off | `setScheduleMilestone`, `removeScheduleMilestone` | `gc_schedule_milestones` (not under the guard) | `setScheduleMilestone`, `removeScheduleMilestone` | none |
| A wait added (G-73 to G-75) | `addScheduleWait` | `gc_schedule_add_wait` (the wait and the bars it holds) | `addScheduleWait` | none |
| A wait's step, or taken off | `setScheduleWaitStep`, `removeScheduleWait` | `gc_schedule_waits` | `setScheduleWaitStep`, `removeScheduleWait` | none |
| Places (G-83) | `setActivityPlaces` | `gc_schedule_set_places` (`place`, 40 characters, refused whole) | `setSchedulePlaces` | none |
| A line split, or one bar again (G-39) | `splitActivity`, `joinActivity` | `gc_schedule_split`, `gc_schedule_join` | `splitScheduleBar`, `joinScheduleBar` | the plan's |
| A new baseline (G-41) | `setScheduleBaseline` | `gc_schedule_baseline` | `setScheduleBaseline` | the plan's |
| Pull earlier (G-37) | `pullScheduleEarlier` | `gc_schedule_move`, `pull_finished` | `saveScheduleMove` with `pullMove` | the plan's |
| Days back (G-82) | `recoverScheduleDays` | `gc_schedule_move`, `recovery_how`, `recovery_after_activity_id`, `recovery_gap_was`, `recovery_gap`; Undo puts the gap back | `saveScheduleMove` with `recoveryMove` | the plan's |
| A move in the walk | `setScheduleActivity` with why | `gc_schedule_move` | `saveScheduleMove` | the plan's |
| The real days in the walk | `setActualDates` | `gc_schedule_activities.actual_start`, `actual_finish` | `setActualDates` | none |
| The walk kept (G-52) | `recordScheduleWalk` | `gc_schedule_walks` (`kept`, `move_ids`, `skipped`, `kept_early`) | `recordScheduleWalk` | none |

**The walk's move ids.** `gc_schedule_move` returns the version, not the move's id. PR 6's call 4 takes the move a press made as the newest on the reload. 9d matches it by its bar, its new days and its note, so a save someone else makes between the two still finds the right move.

## The kernels

**The screens' kernels are on main already:**

- the walk (`walk.ts`)
- the parts (`splitBars.ts`)
- places (`places.ts`)
- the job's own work (`addedActivity.ts`)
- waits (`waits.ts`)
- the baseline (`baseline.ts`)
- the lost days' note (`daysLost.ts`)
- the real days' words (`actualDates.ts`)
- what a move does to the bills (`billingForecast.ts`, O2)
- the not-ready blocks (`notReady.ts`, B2-ii)

**9c lifts five, word for word, with no caller:** `pullHolds`, `planPull` and `pullBehind` from `gcPullEarlier.ts`, and `recoveryOffers` and `recoveryFollowPeople` from `gcRecovery.ts`, each with its private helpers. The tests that read only them move from `gcPullEarlier.test.ts` (30 tests) and `gcRecovery.test.ts` (23). The tests that play the reducer stay on the spike.

**Way 3 is no longer needed.** 1b put the holds in PR 9 as an argument because they read five lanes' kernels that were not on main yet. Everything the five import is on main now:

- `rfiRows`, `submittalHolding` and `submittalState` (U2)
- `waitRows`, `openLateNotices` and `datesAsksOpen`
- `notReadyBars` and `notReadyWords` (B2-ii)
- `lateFinish` (O2)
- `partnerReach`, `FollowItem` with its `schedule` ref, and `FollowPerson`
- `pWeekday`
- `projectedFinish`, `scheduleMeasures`, `scheduleItems`, `lagOf`, `daysBetween`, `moveActivityName`, `scheduleFinish` and `TIGHT_SPARE_DAYS`

So the kernels keep their own signatures, and the spike re-exports them unchanged.

## Three catches

1. **The papers' hold reads stand-ins.**
   - `partnerFromRows` (`boardRows.ts`) sets `msa: 'none'`, `coiExpires: null` and `w9: false`, since a company's papers wait for B6.
   - 7b's chart already runs `withNotReady` through `chartHolds`. So on a job being built, every hired trade's bar that has not started shows held by "a signed master agreement, current insurance and a W-9". Once 8b keeps a real start, G-138's red "no insurance on file" note shows too.
   - It is a dev's window only, so nobody else sees it.
   - In PR 9, the same holds would stop every pull and every days-back offer, since a held bar never comes in.
   - **The pick (the lead's, 2026-10-09):** 9d waits for B6-b-ii, which reads the papers (B6-b-i is #5115, held as a draft). Nothing on the chart changes before then.
2. **The submittals' and RFIs' holds are empty on real data.**
   - The Schedule window reads the bare board. The Submittals window lays its register over first (`loadSchedule(withSubmittals(board, await loadGcSubmittals([id])), id)`, `GcProjects.tsx`).
   - 9d's io does the same for the Schedule window.
   - It lays the RFIs over too, once Building's U5b (#5144) brings their read.
3. **What stays with its own PR:**
   - the superintendent's look-ahead check and our crew's mark (PR 14)
   - a part's percent pickers and our crew's part (PR 16)
   - the time extension (PR 16)
   - the customer's letter (PR 15)
   - the what-if copy (PR 11)
   - Days back's *who has to agree* opens the Follow up sheet in the prototype, from **Call** and **Follow up**. That sheet is the Board lane's Follow up by person. It is not on main, and 7c-ii does not bring it: its call list leaves **Follow up** off until the sheet is there (`mockups/schedule-pr7c.md`). So 9d's offers show **Call**, a `tel:` link, and no **Follow up**, the same known difference as 7c-ii's. `recoveryFollowPeople` (9c) waits for the sheet.

## The four cuts

Each is one PR, one open at a time on the lane, behind the dev gate. Each has its release note, its fragment and its guide.

| Cut | What | Ported from the spike | About |
|---|---|---|---|
| **9a** | An inspection's pass and fail, with its re-inspection day. The job's own work: added with what it waits on and what waits on it, done or not, taken off. Dates to meet set and taken off. | `InspectionCheck`, `InspectionFailForm`, `AddActivityCard`, `MilestonesCard` with `MilestoneLine` and `TradePick` (`GcBuildingSchedule.tsx`), and the form's G-38 buttons | 350 lines |
| **9b** | Waits: added, each step, taken off. Places: in the form and on the places card, refused whole. A line split into parts and made one again, without the percent pickers. A new baseline with its name and why. | `WaitsCard`, `NewWait`, `BaselineCard` (`GcBuildingSchedule.tsx`), `GcPlaces.proto.tsx` (into main's `GcPlaces.tsx`), `GcSplitBars.tsx` | 715 lines |
| **9c** | The five kernels lifted with no caller, a lift config, and its spike follow-up | `gcPullEarlier.ts`, `gcRecovery.ts` and their tests | 400 lines of kernel, 53 tests |
| **9d** | The walk (G-52). Pull earlier (G-37). Days back on a late job (G-82). The not-ready block in the form (G-77, its paper buttons once B6-b-ii's company window sends a paper). Who has to agree with **Call** only, until the Board lane lifts the Follow up sheet. The holds' io (catch 2). After B6-b-ii. | `GcScheduleWalk.tsx`, `GcPullEarlier.tsx`, `GcRecovery.tsx`, `GcNotReady.tsx` | 940 lines |

The fail, the add, the take-off, a split, a join and a baseline are plan writes. They show 8a's refusal (`GcScheduleRefusal`), keep what the person typed, and read the schedule again. The records never conflict.

**A failed inspection pushes with main's `pushAfter`** (the lead's pick, 2026-10-09): only what waits on the inspection moves, down the line, each gap kept and done work left alone, as 8a's moves already push. The prototype's `failInspection` pushes with New project's `pushSchedule`, which walks the whole plan, ignores a wait's gap and moves done work. On a real job it would undo days back and move finished bars: a defect, not a spec. 9a names it as its known difference. The spike's reducer switches to `pushAfter` in a later follow-up, so the golden walk matches, when the lead says.

**Guides**, each with its share card:

- 9a: *record an inspection on the schedule*, and *add the job's own work to the schedule* (with its dates to meet).
- 9b: *split a line into parts* and *set a new baseline after a change order* (the plan's), and *track what the work waits on*. Places go in *move a bar on the schedule and say why*, beside the form.
- 9d: *walk the schedule each week*, with *pull work in when it finished early* and *get days back on a late job* as its sections.

**GLOSSARY.md**:

- 9b: wait, part, place and baseline.
- 9d: pull, days got back and walk.

`PROJECT_DOCUMENTATION.md`'s schedule paragraph gains each cut's presses.

**Checks:**

- 9a: render tests on main's test state for every press, a plan write's refusal, and a record with no version.
- 9b: the same, and places refused whole.
- 9c: `lift-same.cjs` green, and the moved tests pass on main's test state.
- 9d: the plan's own check, the walk on a real project with one bar kept and one moved. That writes prod rows on "GC test project, delete me", so it waits on Grace's own yes in the lane's chat.

**Order on the lane** (the lead's, 2026-10-09): 8b after 8a (#5151) merges, then 7c-ii (the call list in the window), then 9a, 9b and 9c, then 9d once B6-b-ii is in.
