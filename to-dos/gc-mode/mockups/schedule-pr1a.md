---
name: "The schedule's PR 1a: its kernels lifted to main (the schedule, the chart and moving)"
rows: SCHEDULE_REAL_BUILD.md, The PRs in order, 1a; BUILD_MAP.md, Helper 1's first row
branch: the plan on spike/schedule-pr1a-plan (from origin/spike/gc-mode at 41f3abe59); the code on claude/gc-schedule-pr1a-kernels, cut from origin/main
status: plan 2026-10-07 by Helper 1, for the lead's go. Nothing built.
---

# The schedule's PR 1a: its kernels on main

## What I measured first

I traced what each of the 14 kernels calls with the TypeScript compiler, symbol by symbol, over the
spike's `src/lib/gcMode` at 41f3abe59.

- **Moved whole, the 14 files reach 71 of the prototype's modules, 24,684 lines.** That is every
  lane's kernels, the made-up data, both portals, owner billing and the AIA workbook filler. Lifted
  that way, 1a would carry most of the prototype.
- **Function by function, 151 of their 174 exports read only the schedule.** They also call seven
  small helpers from other files, about 300 lines. In all they need about 2,300 lines.
- **The other 23 read another lane** (below). With their private helpers, they are 771 lines.
- **None of the 151 calls one of the 23**, so the cut is clean.

My plan's list grouped these kernels without this check. The cut below is the fix.

## What moves, and where

The rule: a function moves when everything it calls is the schedule's or one of the helpers below.
It moves word for word. Only its imports change. The rest waits in the spike for what it reads.

| The spike's file | On main | Moves | Stays in the spike |
|---|---|---|---|
| `gcBuildingSchedule` | `schedule/schedule.ts` | all 37 | |
| `gcGantt` | `schedule/gantt.ts` | all 22 | |
| `gcSplitBars` | `schedule/splitBars.ts` | all 17 | |
| `gcScheduleMoves` | `schedule/moves.ts` | all 15 | |
| `gcBaseline` | `schedule/baseline.ts` | all 7 | |
| `gcChangeOrderDays` | `schedule/changeOrderDays.ts` | all 7 | |
| `gcAddedActivity` | `schedule/addedActivity.ts` | all 4 | |
| `gcActualDates` | `schedule/actualDates.ts` | all 3 | |
| `gcPlaces` | `schedule/places.ts` | 16 of 19 | `crowdedWeeks`, `crowdedCalls`, `morningCrowding` |
| `gcWhatIf` | `schedule/whatIf.ts` | 8 of 11 | `whatIfDiff`, `whatIfKeptWords`, `WHAT_IF_ACTIONS` |
| `gcPullEarlier` | `schedule/pullEarlier.ts` | 8 of 11 | `planPull`, `pullBehind`, `pullHolds` |
| `gcRecovery` | `schedule/recovery.ts` | 7 of 9 | `recoveryOffers`, `recoveryFollowPeople` |
| `gcChartHolds` | | none | `chartHolds` |
| `gcNotReady` | | none | all 11 |

Paths are under `src/lib/gc/`.

**The helpers.** Each lands under its own lane's file name, so that lane's lift later extends the
file instead of moving the function again:

| From | To | What |
|---|---|---|
| `gcNewProject` | `schedule/draft.ts` | the first draft: `scheduleDraft` with `SCHEDULE_STAGES`, `TRADE_STAGE`, `STAGE_WORDS`, `lineStage`, `stageChain`, `draftLines`, `INSPECTION_DAYS`, `templateKey`, `plusDays` (221 lines). It is the schedule's own draft. |
| `gcBids` | `bids.ts` | `carriedAmount`, `leveledTotal`, `takenAlternatesTotal`: a line's worth before its statement of work. Board's B2 extends it. |
| `gcExclusions` | `exclusions.ts` | `exclusionCoversTotal`, added beside the `fold` already there. |
| `gcBuilding` | `building.ts` | `addDays`, `crewStages` with `CREW_STAGE_WEIGHTS`, `sentBackOpen`. Building's U2 extends it. |
| `gcOwnerBilling` | `ownerBilling.ts` | `changeOrderDays`, `signedChangeOrders`, `projectChangeOrders`, `contractDaysAdded`. Owner Billing's O2 extends it and finds `gcChangeOrderDays` already moved. |
| `gcLookups` | `lookups.ts` | `partnerById`, `ownBidPriced` |
| `gcWords` | `words.ts` | `shortDate`, `weekdayDate` |

**What stays, and when it comes:**

| What | It reads | It comes |
|---|---|---|
| `chartHolds`, all of `gcNotReady` | RFIs, submittals, waits, Start's checklist, the trades' papers and insurance | when holds reach main |
| `planPull`, `pullBehind`, `pullHolds`, `recoveryOffers`, `recoveryFollowPeople` | the holds, late notices, open date asks, the late finish, the follow-up sheet | PR 9, which should take the holds as an input (way 3 below) |
| `crowdedWeeks`, `crowdedCalls`, `morningCrowding` | crew counts, people on site, the morning list | 1b, with `gcCrewCounts` and `gcPeopleOnSite` |
| `whatIfDiff` | the billing forecast | with Owner Billing's forecast |
| `whatIfKeptWords` | who to tell | PR 13, with Tell the trades |
| `WHAT_IF_ACTIONS` | the prototype's reducer, the actions a copy takes | with PR 11, if its screen needs the list. Main has no reducer. |

## The types

- **`schedule/types.ts`, new.** The schedule's own shapes, word for word from `gcTypes.ts`:
  - `ProjectSchedule`, `ScheduleActivity`, `ActivityPart`, `InspectionFailure`
  - `ScheduleMilestone`, `ScheduleBaseline`, `LookAheadMark`, `LookAheadReason`
  - `ScheduleMove`, `ScheduleMoveReason`
  - `ScheduleWhatIf`, `WhatIfBase`, `TemplateLine`, `TemplateUse`
  - `ScheduleWalk` and `LateNotice`, since `ProjectSchedule` names them. Their kernels wait for 1b.

  The chart's own types (`GanttHold`, `GanttBar`, `ScheduleItem` and the rest) move in their kernels'
  files.
- **`types.ts`, additions.** The rest of the job as main's kernels read it, under the prototype's
  names, each with only the fields its kernels read:
  - `GcState`: 2 of its 10 (`today`, `partners`).
  - `GcProject`: 7 of 54.
  - `TradePackage`: 10 of 13.
  - `Partner`: 2 of 26.
  - `Invite` 3 of 10, `SubBid` 7 of 14, `BidAlternate`, `QuoteExclusion`.
  - `Sow` 4 of 14, `SovLine` 4 of 6, `Draw` 1 of 15, `DrawSentBack`.
  - `ChangeOrder` 8 of 15, `ScopeItem` 2 of 4.

  `ScopeExclusion` is already there and is reused.
  - *Why the prototype's names:* every moved function reads word for word. The prototype's own
    records fit as they are, which is what `types.ts` already does for the plan kernels. A lane that
    lifts later adds the fields its kernels read.
  - *Why not New project's `GcProjectView`:* its trades carry no bids, statement of work or
    schedule. PR 6's mapper builds this `GcProject` from it and the schedule's rows.

## The tests, and their fixture

The 14 files hold 205 tests:

- **61 read only the made-up data and the moved functions.** They move as they are. Only the import
  of the data changes. By file: schedule 23, gantt 22, moves 6, recovery 5, places 2, pulls 2,
  splits 1.
- **112 play actions through the prototype's reducer**, which main does not have. 63 play only the
  schedule's presses. 49 play another lane's too: a trade's report, a change order signed, our
  crew's report, Start, a submittal answered. They also check the press itself, like its log line
  and a refused press, not only the kernels.
- **32 more test the 23 that stay**, or call another lane's kernels.

**The fixture: a test-only copy of the slice these kernels read**, `schedule/testState.ts`:

- What it holds: the made-up data's today, its companies (id and name) and its five jobs, with the
  fields in the types above. That is 26 KB, about 2,000 lines.
- Its export: `initialGcState()`, under the same name, so the moved tests change only their import.
  Each call returns a fresh copy.
- A script on the spike writes it from the fixture, never a hand. From the follow-up on, a spike
  test holds the two equal.
- *Why a copy and not a smaller fixture per test:* the 61 pin the prototype's own numbers (Fair
  Oaks D's Dec 11 finish, Roofing's 10 days slipped). A smaller fixture would rewrite every
  expectation, and the lift would no longer be shown to be the same.
- *Why only the slice:* the whole made-up state is 67 KB and carries every lane.

**The 144 that cannot run on main stay in the spike.** There they run against main's copy, which the
spike re-exports, so each keeps pinning the moved code. The press tests come to main with the
presses in PR 8 and 9, which take the reducer's cases into the screen's io. The cross-lane tests
come with their lanes. `BUILD_MAP.md` says a kernel moves *with its test unchanged*. For these 144
that cannot hold, so this is the nearest I can keep to it.

**Main still tests what it holds.** The 61 call 48 of the 151 moved names. 59 moved functions over
three lines are not called by any of them, among them Undo and Redo, a move's record, a split's
parts, keeping a what-if, a new baseline, the real days and places. 1a adds a direct test on the
slice for each, about 20 tests. Each test is written against the spike's code first, so it pins the
prototype's own answer.

## How the spike reads main's copy (a follow-up spike commit, not in this PR)

Once the lead merges main into the spike:

1. **The files re-export.** The 14 files and the seven helpers' files delete what moved and
   re-export it from main, as `gcPlans.ts` does from `../gc/plans`. The barrel and every caller
   read as before.
2. **The full types stay.** `gcTypes.ts` keeps its full shapes, and main's narrower ones take them
   as they are. A few kernels hand back the caller's own records: a chart item's trade,
   `whatIfProject`, `inspectedTrades`. For those, the spike's re-export gives back the spike's
   fuller type. That is a typed re-export, not logic, and main's text stays word for word.
3. **Every test runs unchanged.** The spike's 205 tests and the golden test now run against main's
   copy. The golden test must pass without `-u`. That is the proof the lift changed nothing.
4. **The slice is held equal.** The spike test that holds `testState.ts` equal to its fixture lands
   here.

## The PR, on main's rules

- **Branch and version:** `claude/gc-schedule-pr1a-kernels` from origin/main, claimed with
  `npm run claim -- --branch claude/gc-schedule-pr1a-kernels`. The version gets
  `src/content/releaseNotes/v2.NNNN.ts` (kind infra, roles dev, no file paths) and
  `docs/recent-features/v2.NNNN.md`.
- **What it does not touch:** no migration, no edge function, no screen and no help guide, since no
  flow changes. No golden test.
- **The session card:** it goes in the ledger when I start. No session is on `src/lib/gc` now.
- **Checks:** `npm run typecheck` in the background, `npx eslint` on the files, and `npm test` for
  `src/lib/gc`.
- **For the review:** a script on the spike compares each moved declaration on the branch with the
  spike's at the base, imports aside. The PR body carries its output.
- **Size:** about 2,300 lines of kernels, 400 of types, 2,000 of test data, and about 80 tests. It
  splits at a clean seam if you want two PRs: 1a-i the schedule and the chart, then 1a-ii moving,
  which reads 1a-i.

## Is this the best we can do?

1. **Move the 14 files whole, with all they reach.** That is 71 modules and 24,684 lines, every
   lane's kernels and the made-up data. **Dropped.**
2. **Move what reads only the schedule:** 151 of the 174, with seven small helpers, each in its
   lane's file. The 23 that read another lane wait in the spike. **I pick it.**
3. **Move all 174, passing the other lanes' facts in as arguments:** the holds, crew counts, the
   billing shift, who to tell.
   - Against it now: it changes about 25 signatures and their callers, and main has no lane code
     for the tests to build those facts from.
   - For it later: it is the right shape for pulls and recovery offers on real data, so PR 9
     should weigh it.

   **Not now.**

Three calls for the lead:

- the helpers' homes in their lanes' files;
- one PR or two;
- the 144 tests staying in the spike while main gets direct tests.
