---
name: "The schedule's PR 9d: the walk, Pull earlier, Days back and the not-ready block, on real data"
rows: SCHEDULE_REAL_BUILD.md, The PRs in order, 9; mockups/schedule-pr9.md, The four cuts (9d) and catches 1 to 3; GANTT_FEATURES.md G-37 (pull earlier), G-52 (the walk), G-77 (not ready), G-82 (days back), G-138 (uninsured); mockups/board-b6b.md (B6-b-ii's papers and the company window's Send a paper)
branch: the plan on claude/gc-schedule-pr9d-plan (from origin/spike/gc-mode at 5f6589ece); the code from origin/main, no migration
status: plan 2026-10-10 by gc 10, holding the Schedule lane while gc 1 is away, at the lead's ask. Nothing is cut or claimed. 9d's precondition is B6-b-ii (ii-a #5252 on main, ii-b cutting).
---

# The schedule's PR 9d: the walk, Pull earlier, Days back and the not-ready block

## What it is

The last of PR 9's four cuts (`schedule-pr9.md`). 9a, 9b and 9c are on main. 9d gives the kernels 9c lifted their caller and ports four of the spike's screens into the Schedule window, behind the same `canMove` the window's other presses take (a dev's until PR 10):

- **The walk (G-52)**: *Update the week* on a job being built, one bar at a time, each kept, moved with why, or given its real days, and the walk kept as a record.
- **Pull earlier (G-37)**: work that finished early, and what was right behind it brought in, on a press, never by itself.
- **Days back (G-82)**: on a job running past its date to meet, the ways to bring the finish in, each saved as one move.
- **Not ready (G-77, G-138)**: in the bar's form, the trade's papers that hold its start, with the press that gets each.
- **The holds' io (catch 2)**: the window reads the job's submittals and RFIs over the board before it reads the schedule, so their holds stop a pull as they stop a start.

No SQL. Every write is 8a's move save (`saveScheduleMove`, a plan write with the version read), 8b's real days (`setActualDates`, a record) or the walk's record (`recordScheduleWalk`), all on main since 6b.

## What a person sees

On a job being built, for someone who may move a bar. The chart card gains two lines at its top:

```
[ check the dates ]  It is Friday: walk it before the report goes.        [ Update the week · 4 ]
[ finished early ]   Footings finished 2 days early. 3 can start sooner.  [ Pull the work earlier ]
```

The walk line's chip reads *check the dates*, *part walked* or *walked* (`walkStanding`). The Friday sentence shows only on a Friday. The pull line shows only while `planPull` has an offer that is not quiet.

**The walk**, a window over the schedule (`Update the week`):

```
Update the week                                          The week · 2 of 4 · 1 kept · 1 moved
┌ Finished early ─────────────┐  Framing, Hill Country Interiors · drawn Mon Oct 5 to Fri Oct 16
│ Work that finished early    │  Does it still finish Fri Oct 16?
│  3 can start sooner         │  [ Yes, keep it ] [ Take Wed Oct 21, its pace ] [ A new finish day ] [ Skip for now ]
├ The week ───────────────────┤  [ It finished today ]
│ ✓ Footings · kept           │
│ › Framing                   │
│   Roofing                   │
│   Electrical rough          │
└─────────────────────────────┘
You can finish with some not looked at. The record says how many.          [ Close ] [ Finish the walk ]
```

- *A new finish day* (or start day) opens the move form: the day, the reason (`MOVE_REASONS`), *What happened, in your words.*, **Move it** or **Back**. It refuses *Pick the new day.* and *That is the day it already has.* as the spike does.
- *Add the N lost days* shows only when the daily log is laid over the schedule (`lostDaysMoveNote`). The window reads no logs yet (PR 16, G-58), so it does not show in 9d.
- The early item offers **Pull them earlier…** (the pull window), **Keep the dates** and **Skip for now**.
- Finished: *The week is updated*, *Walked today by Rosa. 1 kept, 1 moved, 2 not looked at.*, *What changed* with the walk's moves, and **Done**. With nothing looked at: *Nothing was looked at* and *The walk is not recorded. The schedule still reads as not walked.*

**Pull earlier**, a window:

```
Pull the work earlier
Work finished early. What was right behind it can start sooner.
Finished early     Footings · planned Fri Oct 9, done Wed Oct 7 · 2 days early
Can start sooner   [x] Framing · 2 days sooner          [x] Underground plumbing · 2 days sooner
Keeps its dates    Roofing · It keeps its dates, with the work before it.
Untick one a trade cannot start sooner. It keeps its dates, and so does what waits on it.
Why it moved [ Finished early ▾ ]   What happened, in your words [ ............ ]
Saved as one move by Rosa, today. Undo puts every date back.            [ Cancel ] [ Pull 2 earlier ]
```

The bar's own card shows **Pull the work earlier…** when the offer covers it (`GcPullBox`).

**Days back**, a card under the measures on a late job, and its window:

```
Days back
2 ways to bring the finish in. Each stands alone: save one and the list reads again.
  Electrical rough starts sooner, beside framing · 3 days back   [ Look at it ] [ Call Pecan Valley Electric ]
  A second crew on drywall · 2 days back                         [ Look at it ] [ Call Live Oak Drywall ]
```

The window: *Get days back*, what starts sooner or the second crew, what comes in behind it, what keeps its dates, *The finish: Fri Nov 20 → Tue Nov 17.*, who has to agree (*Pecan Valley Electric. Ask them before you save it.*), the reason and note, *Saved as one move by Rosa, today. Undo puts every date back.*, **Cancel** and **Save the move**. With nothing to offer: *Nothing on the red chain can come in yet.* and `recoveryNoneWords`.

**Not ready**, in the bar's form, from the kernel's words (`notReadyBlock`, and `uninsuredBlock` for a running bar):

```
Not ready to start Mon Oct 19
  No signed master agreement.  Sent Oct 6, not signed.   [ Remind them ]
  No current insurance.        Ran out Sep 15.           [ Ask for it ]
```

Each verb opens the company window (`useCompanyOpener`). See call 2 for where it lands.

## The presses on main

| Press | Kernel | Write | Version |
|---|---|---|---|
| Walk: a bar moved, or its pace taken | `planMove`, `moveRecord`, `moveWords` | `saveScheduleMove`, through the window's `save` | the plan's |
| Walk: its real start or finish | `actualWords` | `setActualDates`, through the window's `actual` | none, a record |
| Walk: finished | `walkTally`, `walkChanges` | `recordScheduleWalk` (`kept`, `moveIds`, `skipped`, `keptEarly`) | none, a record |
| Pull: saved | `planPull(read.state, project, leaveOut)`, then `pullMove` | `saveScheduleMove` with `offer.activities` | the plan's |
| Days back: saved | `recoveryOffers(read.state, project)` by key, then `recoveryMove` | `saveScheduleMove` with `offer.activities` | the plan's |
| Not ready: a verb | `notReadyBlock`, `uninsuredBlock` | none here. It opens the company window | none |

A pull and a days back save from the schedule as read, re-planned at the press, as the spike's reducer re-plans. Someone else's save in between is the version's refusal: 8a's `GcScheduleRefusal` names their move, keeps what was typed, and reads again. The baseline at Start is what every 8a move does on main, so 9d adds nothing for it.

## What 9d adds to main's kernels

Pure, with their tests, in `src/lib/gc/schedule/scheduleWindow.ts` beside `moveWords` (the window's words), and one new file:

- **`pullLogWords(project, offer, by)`** and **`recoveryLogWords(project, offer, by)`**: the line in the schedule's log, the spike reducer's words: *Rosa pulled 2 earlier on Fair Oaks Shops, Building D. {offer.note}* and *Rosa got 3 days back on Fair Oaks Shops, Building D. {offer.words.title}*.
- **`savedMoveId(before, after, move)`** in `src/lib/gc/schedule/savedMove.ts`: the walk's move ids. `gc_schedule_move` returns the version, not the move's id. 9d matches the move by its bar, its new days and its note among the moves the reload has and the read before did not, so a save someone else makes in between still finds ours (the plan's rule, `schedule-pr9.md`). Null when none matches, and the walk then records the moves it could match.

## The walk on main

The spike's walk dispatches to a synchronous reducer. On main each answer awaits its save:

- the list is fixed when the walk opens (`walkItems` once, as the spike's `useState`), and each answer reads the schedule as the save left it;
- the window's `save` and `actual` gain a return of the new read, so the walk can take the move's id (`savedMoveId`);
- a refusal shows in the walk under the bar, the schedule is read again, and the bar stays to answer again;
- **Finish the walk** records once, with what was kept, moved, skipped and kept early. A walk with nothing looked at records nothing, as the spike.

## The holds' io (catch 2)

`GcSchedule`'s load reads the job's submittals and RFIs and lays them over the board before `loadSchedule`: `loadSchedule(withRfis(withSubmittals(state, await loadGcSubmittals([id])), await loadGcRfis([id])), id)`, the way the Submittals and RFIs windows read. One new io function, `loadScheduleWithHolds(state, projectId)`, in `scheduleIo.ts`. On the chart this shows the submittal and RFI holds that read empty until now (7b drew them only from the board). Both tables are Building's and a dev's (see call 1).

## Where it sits in GcSchedule

- The chart card's top: `GcWalkLine`, then `GcPullLine`, each when the job is being built and `moves` is given.
- `GcDaysBack`: under the measures, when the job is being built, `moves` is given, and `lateFinish(state, project).late > 0` (the projected finish past the date to meet for substantial completion, `ownerFinishRisk`). The measures' late money, best offer and *Ask for the days* stay off (7b's call 4).
- The bar's card: `GcPullBox` when the offer covers the bar. `GcActivityEditor` gains a `ready` slot, and the window passes `GcNotReady` into it (its header already says the papers come with 9d).
- The three windows mount over the schedule at z 1250, as *Why it moved* does.
- `GcSchedule`'s header comment gains 9d's presses.

## Files

- New: `src/components/gc/GcScheduleWalk.tsx`, `GcPullEarlier.tsx`, `GcRecovery.tsx`, `GcNotReady.tsx`, each ported from the spike with its render test; `src/lib/gc/schedule/savedMove.ts` and its test.
- Changed: `GcSchedule.tsx` (the mounts, `save` and `actual` returning the read, the holds' io), `GcActivityEditor.tsx` (the `ready` slot), `scheduleIo.ts` (`loadScheduleWithHolds`), `scheduleWindow.ts` and its test (the two log lines).
- Docs: the guide *walk the schedule each week* with *pull work in when it finished early* and *get days back on a late job* as its sections, and *when a trade is not ready to start*; `GLOSSARY.md` (pull, days got back, walk); `PROJECT_DOCUMENTATION.md`'s schedule paragraph; the release note and fragment. No `ACCESS_CONTROL.md` change: no new gate.

## Tests

- `savedMove.test.ts`: our move found among two new ones; null when none matches; an undone move never matched.
- `scheduleWindow.test.ts`: the two log lines on Fair Oaks D.
- The four render tests, ported from the spike's (Walk 60 lines, Pull 152, Recovery 109, NotReady 100) onto main's test state, each press asserting its `MovePresses` call instead of a dispatch, a refusal shown, and every sentence through `plainWordsFailures`.
- `GcSchedule`: the walk line on a building job for `canMove` and not otherwise; the holds' io calls `loadGcSubmittals` and `loadGcRfis` with the job.
- Then the GC suites, the full suite, eslint, the theme check and the typecheck.

## Words changed from the spike

Two of the walk's sentences glue two ideas with a semicolon, which the plain-words rule refuses:

- *You can finish with some not looked at; the record says how many.* becomes *You can finish with some not looked at. The record says how many.*
- *This is the list the trades and the customer's Friday report will be told from. Telling them is the next phase; for now it is kept under the chart, in Changes to the schedule.* becomes *The trades and the customer's Friday report are told from this list. Telling them comes later. For now it is kept under the chart, in Changes to the schedule.*

The spike keeps its own words. A follow-up on the spike can take these.

## Left out, and why

- **Follow up** on Days back' who has to agree: the Board's Follow up sheet is not on main. **Call**, a `tel:` link, only, the known difference 7c-ii already has. `recoveryFollowPeople` waits for the sheet.
- **The billing line** (*Billing: …*) in the pull and days-back windows: the schedule reads the bare board, which carries no bills, and a bill's words are the money team's. It comes with the readers of PR 16.
- **Add the N lost days** in the walk: no daily log is laid over the schedule until PR 16 (G-58).
- **The what-if copy** paths: PR 11.
- **Tour stops** for the walk and Days back: main's tour has no schedule stops yet.

## Calls for the lead

1. **Holds the office cannot read, once PR 10 opens the schedule.** Submittals and RFIs are Building's dev-only tables, and a company's papers follow `person_contract_documents`' SELECT policy (a dev, a leader or an assistant: not the controller, not an estimator). After PR 10 an assistant's chart reads no submittal or RFI hold, and a controller's or an estimator's reads every hired trade as not ready. A pull would then bring in a bar a submittal holds. **My pick: (a)** Pull earlier and Days back show only to `canUseGcBuilding` (today a dev) until Building's door, and the walk, which only keeps or moves what its own person looks at, shows to `canMove`. (b) Leave it to PR 10 to gate. (c) Leave it to Building's door.
   **The lead's pick (2026-10-10): (a).** The clean fix is the read half of Building's door for the schedule's team, in O9's shape: a `FOR SELECT` policy for that team on `gc_submittals`, `gc_rfis` and their holds, beside each table's dev policy, and the same for a company's papers on `person_contract_documents`, the Board's to word. Once those read, Pull earlier and Days back move to `canMove` with the walk. The door PR checks this line.
2. **Where a not-ready verb lands.** The spike opens the company window at its Documents tab with the paper's send open (`openPartner(id, { tab: 'documents', doc, send: true })`). Main's opener takes only the company. **My pick:** if B6-b-ii-b's company window takes a tab and a paper when it lands, 9d opens it there. If 9d is ready first, the verb opens the company window plain, and a one-line follow-up points it at the paper.
3. **The walk's list**: fixed when the walk opens (the spike's), not re-read after each save. **My pick: fixed**, so the person walks the list they started.
4. **The two sentences reworded** above, for the plain-words rule.

## Is this the best we can do?

- **The move id from the database.** `gc_schedule_move` could return the move's id beside the version, and `savedMoveId` would go. That is a migration on PR 5's function for one caller. Matching by bar, days and note is the plan's rule already. Not taken.
- **One save path for the three.** The walk, the pull and the days back each build a `ScheduleMove` and call the window's one `save`, so the refusal, the reload and the log line work the same everywhere. Taken.
- **The holds read once for the window.** The Submittals and RFIs windows each read their own tables when they open. A shared read on the page would save a round trip when both are open. The schedule's read is one call per open window, so not now.

## Status

Plan 2026-10-10 by gc 10. The lead approved it the same day: call 1 (a), calls 2 to 4 as written, with gc 2 asked whether ii-b's opener takes a tab. Nothing cut or claimed. It cuts after B6-b-ii-b (#5264) is on main.
