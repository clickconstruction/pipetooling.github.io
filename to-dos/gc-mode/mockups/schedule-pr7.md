---
name: "The schedule's PR 7: the Schedule tab on real data, read only"
rows: SCHEDULE_REAL_BUILD.md, The PRs in order, 7, and Docs each PR touches; GANTT_FEATURES.md G-13 (one company), G-19 (the list on a phone), G-21 (Print or PDF), G-136 (Export)
branch: the plan on spike/schedule-pr7-plan (from origin/spike/gc-mode at dcc6d5118); the code from origin/main once 6b (#5009) merges
status: plan 2026-10-08 by Helper 1 at the lead's ask; approved the same day at all six picks, cut in three (7a, 7b, 7c; When it is cut). Nothing is built yet.
---

# The schedule's PR 7: the Schedule tab on real data, read only

## What it is

The first screen on the schedule's tables. A dev opens a GC project's schedule on `/gc` and sees it
drawn from the database:
- the chart with its links, spare days and what holds each bar;
- the list on a phone;
- Print or PDF, and Export;
- a bar opened by a press.

Nothing moves yet; that is PR 8. There is one press, *Draw a first draft* (call 2). It stays dev only
until PR 10 (G-133), as the lead set.

- **The window, new on main**: `src/components/gc/GcScheduleWindow.tsx`. A dev-only **Schedule**
  button on each project card opens it from `?schedule=<projectId>` (call 1), the way **The plans**
  and **Questions about the plans** open theirs. Its body is a component of its own, `GcSchedule`, so
  a project page can take it unchanged the day the doors bring one (*Is this the best*, way 1).
- **The chart, lifted from the spike word for word**, with only the imports re-pointed to main:
  - `GcGantt.tsx` (1,395 lines), with `GcGanttList.tsx` (106), `GcGanttPrint.tsx` (104),
    `GcScheduleExport.tsx` (117) and `GcPeopleStrip.tsx` (104). `GcGantt` sends nothing: every change
    it can make is a callback, and the window passes none;
  - `GcCrowdedLane` alone, into a new `GcPlaces.tsx`. PR 9 appends the places card and the place
    line;
  - `gcBuildingCss.ts` (30 lines), for `twoLines`. Helper 4's Draws tab reads it from main once it is
    there;
  - main's `Chip` (`gcUi.tsx`) gains the spike's `small` prop, word for word. The chart uses it
    three times.
- **Two kernels, lifted with their tests**:
  - `chartHolds` (`gcChartHolds.ts`, 36 lines) as `src/lib/gc/schedule/chartHolds.ts`. It composes
    RFIs, submittals, waits and a trade's papers, each already on main. PR 9's holds build on it;
  - `downloadTextFile` (`gcDownloadFile.ts`) as `src/lib/gc/downloadFile.ts`, for Export.
- **The measures, lifted from the Schedule tab's root** (call 4): `Measures`, `FinishMeasure`,
  `Measure`, `finishSentence`, `LookAhead`, `MARK_WORDS` and `ScheduleWhy` move out of
  `GcBuildingSchedule.tsx` into `src/components/gc/GcScheduleMeasures.tsx`. Read only: the late
  finish's money, the best offer and *Ask for the days* (G-141) are left unset.
- **The opened bar, new on main** (call 3): `GcScheduleBar`, a card under the chart for the bar
  pressed. It shows the bar's name and company, its days, what it waits on and what waits on it, its
  spare days, what holds it, its real days, its parts and its place, each in a kernel's words. The
  editor comes with PR 8.

## The reads

**On the board state `/gc` already holds** (`board`, from `boardStateFromRows`, read when the page
loads). No new request:
- The project from `boardProjectFromView`: its name and address, its stage, the days it starts,
  started and was lost, and its trades with their scope lines. A line's bar id is its scope line's
  (PR 5, call 6). Our own crew's trade reads *Our own crew*.
- The companies (`partners`): their papers, for what holds a bar (G-77, `withNotReady`).
  - The trades are not awarded on the board until B6. Until then a hired trade's bars name the
    trade, not a company (`companyOf`), and the company select (G-13) lists the trades.
- `today`, the company day, and the customers, for the customer's pages in Print and Export (G-21,
  G-136).

What the board does not carry yet reads empty, and its layer draws nothing until its lane maps it
onto the project:
- Building's RFIs and submittals, as holds;
- its daily logs: days lost, the log's notes, people on site;
- Owner Billing's change orders: their tails and the late finish.

The schedule's own read of change orders comes with PR 16, through `gc_change_orders_office`.

**On opening the window**: `loadSchedule(board, projectId)` (6a). It reads the schedule's own rows
only, never the board again:
- Round 1, fifteen reads at once: `gc_schedules`, `gc_schedule_activities`, `_links`, `_milestones`,
  `_baselines`, `_moves`, `_walks`, `_late_notices`, `_waits`, `_wait_holds`, `_crew_counts` and
  `_sends`, the reader's own `gc_schedule_what_ifs` row, `gc_rough_schedules` and
  `gc_schedule_templates`.
- Round 2, seven reads keyed by the bars', moves' and baselines' ids, a hundred at a time: parts,
  inspection failures, look-ahead marks, baseline dates, pushes, tells and answers.
- One read of `users (id, name)` for the people the rows name.

That is 23 requests for one job, made when the window opens and again after a draw. No kernel reads
on its own: each reads what `loadSchedule` laid over the board.

## Six calls for the lead

1. **Where it opens.** A **Schedule** button on each project card, a dev's only, opening a window
   from `?schedule=<projectId>` the way the plans, questions and change orders open theirs.
   *My pick:* the button. *The other way:* a sixth view pill beside Project Board, with a project
   picker.
2. **One press: Draw a first draft.** Without it the window is empty on every real project, and the
   build doc's check draws one.
   - It is `draftSchedule` on the board's project, sent through 6b's `drawSchedule` with no version
     and the spike's own log line as its words.
   - It starts on the project's start day, or the rough's, or the Monday after next, as the spike's
     card does.
   - It offers no template until PR 12 brings them. It is closed while we bid (the rough is PR 12's)
     and on a lost job, in the SQL's own words.

   *My pick:* carry it. *The other way:* strictly read only, and the 6b live check's draw is the only
   schedule on prod until PR 8.
3. **The opened bar.** The spike opens `ActivityEditor`, a form all through. *My pick:* a read-only
   card, new on main, from the kernels' words; PR 8 puts the editor there for those who may move.
   *The other way:* the editor with its inputs off. That is not word for word, and PR 8 lifts it
   whole anyway.
4. **The measures with the chart**: work against the plan, the projected finish, the next date to
   meet and the look-ahead, lifted read only from the root. *My pick:* now. They are read only, and
   they say whether the job is on time, which is the first thing a tester asks. *The other way:* they
   wait for PR 8.
5. **The call list (G-115) waits for its own PR, 7c.** Its kernel `gcCallList.ts` is 784 lines and
   spike-only, and it brings `GcCallList`, `PeopleRows` and `theirWork` with it. The window holds
   the chart's company (`company`, `onCompany`, G-13) from the start, so 7c plugs in without touching
   `GcGantt`. *My pick:* 7c after 7b. *The other way:* all in PR 7, about 1,200 lines more.
6. **`lift-same.cjs` reads a `.tsx`.** Today it adds `.ts` to each `from`. It needs one line on the
   spike's script so the components' lift is checked like the kernels'. `lift-extract.cjs` stays as
   it is: the components are placed by a script of their own. *My pick:* so; it is Helper
   7's script, for their nod. *The other way:* the components are diffed by hand in the PR body.

## What lifts, and the check that it is word for word

Two configs on the spike, each checked with `lift-same.cjs`. The kernels are placed with
`lift-extract.cjs`. It reads only `.ts`, so the components are placed by a script that moves each
declaration by name with its comment and re-points the imports, as G-130's move was made:
- `schedule-pr7.lift.json`, for the kernels. `gcChartHolds` goes to `schedule/chartHolds.ts` with
  `gcChartHolds.test.ts`, and `gcDownloadFile` to `downloadFile.ts`.
- `schedule-pr7-ui.lift.json`, for the components (`spikeDir` and `mainBase` both
  `src/components/gc`). It moves:
  - `GcGantt`, `GcGanttList`, `GcGanttPrint`, `GcScheduleExport` and `GcPeopleStrip`, each whole;
  - `GcPlaces#GcCrowdedLane`;
  - `gcBuildingCss`, whole;
  - `gcUi#Chip`, appended;
  - the measures, from `GcBuildingSchedule` to `GcScheduleMeasures.tsx`.

The tests that move are the ones that read only what moves and the made-up data. The rest play the
prototype's reducer or render its Schedule tab, and stay on the spike:
- `GcGantt.render.test.tsx`: all eleven, each rendering `GcGantt` alone;
- `GcGanttPrint.render.test.tsx` and `GcScheduleExport.render.test.tsx`: the first describe of each.
  The cases that render `GcBuildingScheduleTab` or call `gcReducer` stay;
- `GcPlaces.render.test.tsx`: *the chart's lane* (two);
- `gcChartHolds.test.ts`, whole.

The made-up data is main's `schedule/testState.ts` in place of `gcFixture.ts`. Each test that moves
is checked by its title. Each check's table goes in the PR body.

## The gate

`role === 'dev'` in two places, the page's own way (`GcProjects.tsx`, as the company window's
**Their portal** is gated): the card's **Schedule** button, and the window, which opens for no one
else from a link. The tables' policies are dev only until PR 10 too, so a non-dev's read would come
back empty either way. The gate keeps the button off their card. PR 10 swaps both for the office team,
with `gc_on_schedule_team()` calling `gc_office_team()`.

## The test

- The lifted tests, on main's test state.
- `GcScheduleWindow.render.test.tsx`, new, with `loadSchedule` and `drawSchedule` mocked:
  - **Fair Oaks D, read back**, opens with the measures and the chart: its bars and links, with
    **Print or PDF** and **Export** on the toolbar.
  - **A press on a bar** opens its card: its days, its waits, its spare days and what holds it, in
    plain words (`plainWordsFailures`).
  - **A phone width** opens the list (G-19).
  - **Helotes, buying out with nothing drawn**, shows **Draw a first draft**. The press sends
    `draftSchedule` on the board's job, with no version and the log's words, and the chart shows what
    comes back.
  - **Boerne, still bidding**, shows the rough's sentence and no draw.
- `GcProjects.render.test.tsx` gains two cases: the **Schedule** button for a dev, and none for the
  office team.

## The check

On the dev server, signed in as a dev:

1. `/gc`, then *GC test project, delete me*, then **Schedule**.
2. **Draw a first draft** from its start day. If 6b's live check drew it already, it opens drawn.
3. Its bars, links and finish are the kernel's draft on the same trades. Run `draftSchedule` on the
   board's job in the console, and compare its activities, waits and finish with what the window
   drew.
4. Open a bar. Then at 375 px, after a reload (a hidden pane gets no resize event), the list. Then
   **Print or PDF** opens the paper, and **Export** saves the spreadsheet.
5. Signed in as an estimator: no **Schedule** button.

The rows it draws stay with the test project's others, for the owner's call 4.

## Docs

- A release note (feature, dev) and its fragment.
- `docs/PROJECT_DOCUMENTATION.md`, §20, amended in place:
  - the page "holds six windows" becomes seven, with the **Schedule** window, a dev's, named;
  - the closing "The schedule tab and the rest of GC mode open lane by lane" names it.
- `docs/ACCESS_CONTROL.md`: the sentence "The schedule's tables (`gc_schedule_*`) and its tab stay
  dev only until the schedule's PR 10" names the **Schedule** button and window.
- `docs/GLOSSARY.md`: **spare days**, **the critical path** and **the look-ahead**, the words the
  window shows first. Each later term comes with the PR that shows it.
- No help guide while it is a dev's only. The first is PR 8's, *move a bar on the schedule and say
  why*, as *Docs each PR touches* says.
- No `docs/twins/APP_DIRECTORY.md` change: it is a window on `/gc`, not a page.
- On the spike, the follow-up after the merge:
  - the lifted components and kernels are re-exported from main, and the spike's Schedule tab reads
    them from there;
  - the tests that moved are deleted on the spike;
  - the LIFTS entry and both configs are pinned, and `lift-same.cjs --all` is green.

## When it is cut

From `origin/main`, in order after 6b (#5009) merges, since 7b's draw imports `drawSchedule`. G-130
(#5008) touches none of these files. About 3,500 lines in all, about 2,700 of them lifted word for word
and checked by script: 2,200 of components and kernels, 500 of tests. The lead's word: three PRs, each
claimed at its cut, so the queue clears faster and 7a's review is the script's.
- **7a, the lifts with no caller**: the components, the measures, `chartHolds` and `downloadTextFile`
  with their tests, `Chip`'s `small` and `gcBuildingCss.ts`. Cut after 6b merges, so the two never go
  DIRTY on each other.
- **7b, the window**: `GcScheduleWindow` with its body, the bar card, *Draw a first draft*, the gate
  and the docs. Cut after 7a merges.
- **7c, the call list** (G-115): `gcCallList.ts`, `GcCallList`, `PeopleRows` and `theirWork`. Measured on 2026-10-08, it needs Follow up's people model, the counts and a customer-send kernel too, and is cut in two: 7c-i the kernels, 7c-ii the window (`schedule-pr7c.md`).

The one-line change to `lift-same.cjs` (call 6) rides the lane's `spike/schedule-follow`, with the
lead's nod while Helper 7 is away. 7a's configs are pinned in its follow-up, so `--all` proves its
lines.

## Is this the best we can do?

1. **One body for the tab, wherever it opens.** `GcSchedule` is the tab and the window only frames
   it. *Picked:* when a project page comes, it mounts the same component, with the same reads.
2. **One read for the board and the schedule.** The window could reload the board with the schedule,
   so a company added since the page loaded shows. *Not now:* the board is the page's, and its refresh
   is already the page's job (`refreshBoard`).
3. **The chart's companies before the award.** A hired trade's bars could name the company whose
   quote we carry, not the trade. *Not now:* `companyOf` names the awarded company only, and B6
   brings the award. Naming a carried quote's company would be a rule of our own the spike never had.

## Status

Plan 2026-10-08 by Helper 1 at the lead's ask, from `origin/spike/gc-mode` at dcc6d5118 and
`origin/main` at 4a39557ca (6a merged). 6b is #5009 and G-130 is #5008, both armed. Approved the same day at all six picks, and cut in three:
7a, 7b and 7c (*When it is cut*). Nothing is built yet.
