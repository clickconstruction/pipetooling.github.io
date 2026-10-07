---
name: "The schedule's PR 1b: the rest of its kernels lifted to main"
rows: SCHEDULE_REAL_BUILD.md, The PRs in order, 1b; BUILD_MAP.md, Helper 1's first row
branch: the plan on spike/schedule-pr1b-plan (from origin/spike/gc-mode at a003a58e6); the code from origin/main once #4788 (1a) has merged and the spike reads main's copy
status: plan 2026-10-07 by Helper 1; the lead's go the same day on the three picks (two PRs at the seam, `company.ts` with `name` and `shortName` only and a two-line comment that these are the prototype's words for our GC entity until the owner names it, the holds by way 3 in PR 9). Each PR claims its version when it is cut. 1b-i was cut from main at 644c04128 once the spike read main's copy: #4792, v2.4777, 2026-10-07. 1b-ii was cut from main at 8ae0f8430 once the spike read 1b-i's: #4796, v2.4781, the same day. The 55 that wait are recorded in SCHEDULE_REAL_BUILD.md's PR 9 and PR 11 lines and BUILD_MAP's B2, P, U2 and O2 rows.
---

# The schedule's PR 1b: the rest of its kernels on main

## What I measured

This is the same trace as 1a, with 1a's 148 functions counted as on main. The config is
`to-dos/gc-mode/scripts/schedule-pr1b.lift.json`. Its `after` names 1a's config, which
`lift-extract.cjs` now reads: what an earlier lift placed counts as placed and is not written again.
1b-i's and 1b-ii's own configs, `schedule-pr1b-i.lift.json` and `schedule-pr1b-ii.lift.json`, run on a
spike that reads the lifts before them from main, so they have no `after`: what main has counts as
placed where it is, and a helper the follow-up kept counts at main's copy.

- **31 files** are traced: the rest of the schedule's kernels, and 1a's files with functions still on
  the spike. After 1a they hold **244** exported functions.
- **189 move.** They read only the schedule, 1a's functions, each other, and five small helpers
  (about 70 lines).
- **55 wait** for another lane's facts (below).
- **The cut is clean.** The extractor runs without a name left unplaced, so nothing that moves reads
  anything that waits.

## The 26 that stayed in 1a

| What | Now | Why |
|---|---|---|
| `crowdedWeeks`, `crowdedPlaces`, `crowdedSpells`, `placesSummary`, `morningCrowding` | **move** | People on site and crew counts move in 1b. |
| `crowdedCalls` | **moves** | It brings the Spanish date words, 14 lines, into the portal lane's file. |
| `whatIfKeptWords` | **moves** | Who to tell moves in 1b. |
| `lapsedInsuranceWords`, `NOT_READY_LATE_DAYS`, `holdWordsInList` (`gcNotReady`) | **move** | The morning list reads them. They are 22 lines with their private helpers. |
| The other 8 of `gcNotReady` | wait | They read Start's checklist, the papers and the promises, which are the Board lane's (B2). |
| `chartHolds`, `pullHolds`, `planPull`, `pullBehind`, `recoveryOffers`, `recoveryFollowPeople` | wait | They go to PR 9, by way 3 (below). |
| `whatIfDiff` | waits | It needs O2. The billing forecast is Owner Billing's: 599 lines. If PR 11 comes first, way 3 there. |
| `WHAT_IF_ACTIONS` | stays | It is the prototype's reducer's list. PR 11 decides what a copy takes on real data. |

## The holds: way 3 in PR 9, not their lanes' helpers now

**The holds read 611 lines of five lanes' own kernels:**

- Start's checklist (123)
- time extensions (93)
- the papers (73)
- RFIs (69)
- promises (38)
- the owner's finish risk (19)
- submittals (15)
- their shapes (140)

These are not small helpers. They are the core of B2, U2 and O2, and each lifts with its own plan and
review. So:

- **In PR 9, `planPull`, `pullBehind` and `recoveryOffers` take the holds as an argument.** That is
  way 3. The holds are the `GanttHold` list 1a already put on main. `recoveryOffers` also takes the
  late finish's days, which are O2's, the same way.
- **`chartHolds` and `pullHolds` become PR 9's io.** It composes the holds from what is on main by
  then:
  - After 1b, the schedule's own holds are there: waits (`waitHolds`), late notices and open date
    asks.
  - RFIs and submittals join when U2 lands.
  - The not-ready papers join when B2 does.
- **The morning list already takes the holds as an argument**, `morningList(state, project, holds)`,
  so it moves now.

## Also waiting, from 1b's own files

| Waits | For | It reads |
|---|---|---|
| `crewCountProblem`, `lateNoticeProblem` | the Portal lane (its trade writes) | the portal's word keys: `PortalKey` is `keyof typeof S`, the 895-line strings table |
| `portalCrewAsks` | the Portal lane, then PR 14 | the portal's look-ahead |
| `datesMessage`, `datesNotices` | the Portal lane, then PR 13 | the message in the trade's own language (that table) |
| `startNeeds`, `startReminders` | B2's Start and the Portal lane, then PR 14 | Start's checklist and the portal's words |
| `customerScheduleLetter` | O2, then PR 15 | the late finish |
| `lateFinish` | O2 (BUILD_MAP lists it) | the time extension and the owner's finish risk |
| `gcBuildingPromises`, all 6 | U2 (it is a `gcBuilding*` file) | Building's closeout, retainage, punch and submittals |
| `gcCallList` (8) and `gcCounts` (16) | B2, then PR 14 and PR 16 | the Board's people, the papers, Building and the time extension: 1,657 lines |

## What moves, and where

Paths are under `src/lib/gc/schedule/`. Every file moves whole except where a number is shown.

- **Keeping it true:** `walk.ts`, `staleSchedules.ts`, `waits.ts`, `logVsChart.ts`, `daysLost.ts`,
  `finishOutlook.ts`, `crewCounts.ts` (7 of 9), `peopleOnSite.ts`, `morningList.ts`,
  `lateNotices.ts` (24 of 25). Then crowding added to 1a's `places.ts`, and `notReady.ts` with its
  three.
- **The trades and the customer:** `tellTrades.ts` (6 of 8), `startReminders.ts` (2 of 4),
  `portalSchedule.ts`, `customerSchedule.ts`, `customerScheduleSend.ts` (3 of 4), and
  `whatIfKeptWords` added to 1a's `whatIf.ts`.
- **Before the job, and files:** `rough.ts`, `templates.ts`, `import.ts`, `theirDates.ts`,
  `export.ts`, `ganttPrint.ts`.

**The helpers** go under their lanes' files, so each lane's lift extends the file instead of moving the
function again. They come to about 70 lines:

| From | To | What |
|---|---|---|
| `gcBuildingLog` | `buildingLog.ts` | `onSiteWords` and `isWorkday`, with `weekday`, `WEEKDAY` and `onSite`. U2 extends it. |
| `gcFollowUpSheet` | `followUpSheet.ts` | `partnerReach`. U2 extends it. |
| `gcPromises` | `promises.ts` | `INSURANCE_ASK_DAYS`. The lane that lifts the trades' promises extends it. |
| `gcWords` | `words.ts` | `daysUntil` and `utcDay`, added. |
| `gcPortalI18n` | `portalI18n.ts` | `pWeekday` and `pDate`, with the Spanish month and weekday names. The Portal lane extends it with its words. |

**Our company's name.** `lateWaiting` reads `GC_COMPANY.shortName`, the "Click" in "Tell Click when…".
`GC_COMPANY` sits in the prototype's fixture, beside made-up estimators, an address and a pay contact.
Main's company name, `GC_STATEMENT_COMPANY_NAME`, is "Click Plumbing and Electrical": the Pipeline's
company, not GC mode's Click Construction. My pick is `src/lib/gc/company.ts` with only `name` and
`shortName`: the one record (the owner, 2026-10-02), with the made-up parts left behind. The
alternative is to pass it in.

## The types

- **`schedule/types.ts` gains 9 of the schedule's own shapes, whole:** `ScheduleTemplate`,
  `WaitKind`, `ScheduleWait`, `ScheduleSend`, `ScheduleImportPlace`, `ScheduleImportRow`,
  `ScheduleImport`, `RoughSchedule` and `CrewCount`.
- **`types.ts` gains the fields 1b's functions read, each word for word:**
  - `GcProject`: 13 more, 20 of its 54: `stage`, `owner`, `town`, `customerId`, `customerRole`,
    `closedOn`, `lostOn`, `waits`, `rough`, `scheduleSends`, `crewCounts`, `dailyLogs` and `address`.
    The narrow typecheck found `address` in 1b-ii; the first count missed it.
  - `GcState`: `customers` and `scheduleTemplates`.
  - `Partner`: `coiExpires`, `contact`, `email`, `phone` and `trades`.
  - `ChangeOrder`: `sentOn`.
  - New: `DailyLog` (4 of its 10 fields), `GcCustomer` (`id` and `name`), and `GcStage` whole.
  - `CustomerRole` is reused: main has it.
- **The extractor writes each trimmed shape again** with 1a's fields and 1b's, to replace 1a's in
  `types.ts`. `lift-same.cjs` checks every field against the spike's, as it did for 1a.

## The tests and their fixture

- **102 more of the prototype's tests move as they are:** 37 with 1b-i and 65 with 1b-ii. The
  export's 22 and the paper's 23 move nearly whole.
- **Main still tests what it holds.** 77 of the moved functions over three lines are not named by
  those tests. 1b adds a direct test on the test data for each, about 40 tests. 1a needed 33 for
  59. Crowding's cases are the spike's own, played through the kernels, as 1a's places were.
- **The test data grows** with the fields above: daily logs, waits, crew counts, the rough
  schedule, the sends, templates and customers. `schedule-test-state.ts` reads its fields from both
  configs.
- **The rest stay on the spike**, as in 1a: the tests that play the reducer or read another lane.
  They run against main's copy once the spike reads it.

## Before it starts

1a's spike follow-up comes first, as you said: delete and re-export, the typed re-exports, and the
test data held equal. 1b is cut from main after that, so the spike already reads 1a from main and
1b's re-exports follow the same pattern.

## Two PRs, at a clean seam

- **1b-i, keeping it true** (about 2,270 lines of kernels, 37 moved tests): the walk, stale
  schedules, waits, the log against the chart, days lost, the finish outlook, crew counts, people on
  site, the morning list, late notices, crowding, the three from `gcNotReady`, and the helpers. It
  reads only 1a.
- **1b-ii, the trades, the customer, before the job and files** (about 3,570 lines, 65 moved tests):
  tell the trades, the start reminders' two, the trade's chart, the customer's schedule and its
  sends, the what-if's kept words, the rough schedule, templates, import, their dates, the export and
  the print. It reads 1a and 1b-i.
- **The one cross-read decides the seam.** The walk and the morning list read the late notices, and
  the late notices read nothing else in 1b, so they go in 1b-i.

## Is this the best we can do?

1. **Move all 55 too, with their lanes' kernels.** That is the holds' 611 lines, the forecast's
   599, the call list and counts' 1,657, and the portal's words' 895: B2's, U2's, O2's and the Portal
   lane's lifts done inside the schedule's PR, without their own plans. **Dropped.**
2. **The 189 that read only the schedule, in two PRs at the seam.** The holds go by way 3 in PR 9;
   the rest come with their lanes. **I pick it.**
3. **All 189 in one PR:** about 5,800 lines of kernels, about 100 moved tests and about 40 direct
   ones. The review is mechanical (`lift-same.cjs` prints the table), but long. Your call.

Three calls for the lead:

- two PRs or one;
- the company's name in `company.ts` (`name` and `shortName` only), or passed in;
- the holds by way 3 in PR 9, as above.
