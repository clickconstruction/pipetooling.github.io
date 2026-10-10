---
name: "The schedule's PR 12: before the job, the rough while we bid, templates, a schedule they hand us and their dates to meet"
rows: SCHEDULE_REAL_BUILD.md, The PRs in order, 12, and What if and before the job (the rough and the templates); mockups/G-44.md (templates), G-45.md (the rough), G-137.md (a schedule they hand us), G-145.md (their dates to meet only); GANTT_FEATURES.md G-44, G-45, G-137, G-145
branch: the plan on claude/gc-schedule-pr12-plan (from origin/spike/gc-mode at 3a1fad434); the code from origin/main in three cuts, no migration
status: plan 2026-10-10 by gc 1 at the lead's ask, checked against main at a699ca854. Amendment 1 (2026-10-10): gc 2 nodded calls 5 and 6 at their picks, with four conditions written in. For gc 4's co-sign (the Schedule lane's holder), then the lead's read-back. Nothing cut or claimed.
---

# The schedule's PR 12: before the job

## What it is

Four pieces of the prototype's Schedule tab, none of them on main's screens yet:

- **The rough while we bid** (G-45). A job still bidding shows a rough schedule in place of the chart: the start we
  assume, one row per stage with its days, its dates and its bar, the dates to meet, and the weeks to build. The weeks go
  to Our number. Once our bid goes in, the rough is kept as it went and reads that way.
- **Templates** (G-44). A job being built saves its schedule's shape as a template: no dates, companies, percents or
  moves. Every template shows where it came from and the jobs drawn from it, with **Rename** and **Set it aside**. The
  first draft and the rough both offer **Start from a template**, with the fit said before anything is drawn.
- **A schedule they hand us** (G-137). **Bring in their schedule** reads a file from the customer or the architect.
  It shows each of their activities with where it goes and why we guessed it, their dates to meet, our lines not in it,
  and what it could not read. **Make the schedule from it** draws the first schedule through the first draft's own
  kernel. It can also replace one drawn before Start that nobody walked or moved.
- **Their dates to meet** (G-145). On a job being built, the Milestones card's **Their dates** reads their file the same
  way. It shows each of their dates beside ours with the difference in days, and the office ticks the ones to take.
  **Take them** writes only the dates to meet. Nothing else moves and nothing is sent.

Everything under it is on main already:

- **The tables** are PR 4's: `gc_rough_schedules` and `gc_schedule_templates`, the template's name unique whatever the
  case, and its lines fixed by privilege.
- **The kernels** are PR 1b's, word for word from the prototype: `rough.ts`, `templates.ts`, `import.ts` and
  `theirDates.ts`, with `draftSchedule(project, start, stageDays, like)` in `schedule.ts`.
- **The writes** are PR 5's and 6b's:
  - `gc_schedule_draft` takes a template's id and keeps its name and day.
  - `gc_schedule_their_dates` is refused whole.
  - `scheduleIo.ts` has `drawSchedule`, `saveScheduleTemplate`, `renameScheduleTemplate`, `setAsideScheduleTemplate`,
    `setRoughSchedule` and `takeTheirDates`.
  - `loadSchedule` already reads the job's rough and every template.

What PR 12 adds: the four screens, ported from the prototype with their words; the reducer's guards and log lines as
press kernels beside 9a's and 9b's in `scheduleWindow.ts`; and two seams with the Board.

## The calls

**For gc 4's co-sign, each with the other way. Calls 5 and 6 also take gc 2's nod (the Board's files).**

1. **No migration.** The tables, the writes and the reads are PR 4's, 5's and 6's. A template is a plain insert, and a
   rename or a set aside is a column update the privileges allow (`UPDATE (name, aside_on)`). The rough is a plain
   upsert. A draw from a template, from a file or as a replacement is `gc_schedule_draft` (PR 5). Their dates are
   `gc_schedule_their_dates`. Nothing reads `gc_projects` beyond what those functions read today. *Other way:* none
   needed.

2. **Three cuts, one PR at a time on the lane:**
   - **12a, templates.** The Templates card on a job being built: save, rename and set aside. **Start from a template**
     on the first draft. This is the plan's own check: save Fair Oaks D's shape and draw a new job from it.
   - **12b, the rough while we bid.** It is the window's view of a bidding job, with **Start from a template**. The
     rough is kept at bid and at award (call 5), and Our number shows the weeks (call 6).
   - **12c, a file.** **Bring in their schedule** (G-137) and **Their dates** (G-145), both through `readScheduleFile`.

   12b reads 12a's `GcTemplatePick`, so 12a goes first. 12c stands alone. *Other way:* four cuts (12c in two), or one PR
   of about 1,000 lines. Three keeps each near 300 lines of screen, one reader per cut.

3. **The presses' rules are kernels.** The reducer's guards and log lines become pure functions in `scheduleWindow.ts`,
   as 9a's and 9b's did, each tested against what the reducer does:
   - `templateDraftPress(state, project, start, templateId)`: the rough's own copy when the rough was drawn from that
     template, else an offered template's lines. Its schedule carries `template: { id, name, on }`. Its line ends *It is
     drawn from the template {name}.*
   - `roughPress(state, project, start, days, templateId?)`: the job still bidding, not lost and before our bid goes in.
     It keeps only the stage days that differ from the usual. A template picked copies its lines, `null` goes back to
     the stage days alone, and a redraw with the same one keeps the rough's copy. Its line is `roughDrawnWords`.
   - `templateSavePress(state, project, name)`: a job being built, `templateNameProblem` first, then `templateShape`.
   - `importPress(project, imported)`: `importRefusal`, then `importedSchedule`. Nothing kept and no dates is refused.
     Its line is `made.words`, which names the file and who handed it.
   - `theirDatesPress(project, file, from, chosen)`: `theirDatesRefusal`, `withTheirDates`, `theirDatesLogWords`.

   The reducer stays on the spike, and each spike follow-up re-exports these from main. *Other way:* the guards inline in
   the components, untested apart from the render tests. That was rejected for 9a.

4. **The gates are the window's.** No new gate:
   - What reads (the rough, the templates and their uses, the import's and their dates' windows) opens with the
     window: a dev's until PR 10 (#5231, a held draft), the schedule's team after.
   - What writes rides the window's `moves` presses, as 9a's and 9b's do. The page's `canMove` turns it on: `role ===
     'dev'` today, `canUseGcSchedule` once PR 10 lands.
   - PR 12 cuts on main as it stands. Whichever of PR 10 and 12a lands second rebases over the other's three gate lines.
     PR 12 changes no gate.

   *Other way:* a gate of its own (`canUseGcTemplates`). That would be a fourth list that must agree with
   `GC_SCHEDULE_TEAM`.

5. **Keeping the rough at bid and at award: the page, after the Board's press.**
   - The prototype keeps the rough inside the reducer's `markBidSent` and `wonBid` (`keepRough(p, today, 'bid' |
     'award')`). Its weeks come from the first draft's kernel on the rough's lines, so SQL cannot work them out.
   - Default: after `markGcBidSent` or `markGcWon` succeeds, `GcProjects.tsx` calls a new `keepRoughAt(state, projectId,
     at)` in `scheduleIo.ts`. That reads the job's rough (`loadSchedule`), runs `keepRough`, and writes it with
     `setRoughSchedule` when it was drawn and not yet kept. Best effort: a failed keep shows one line beside the outcome
     strip, *The rough schedule's weeks were not kept with the bid. Open the schedule to keep them.*, and the bid stands.
   - The rough card locks once `ourBidSentOn` is set, kept or not. It reads its weeks live until they are kept.
   - Until PR 10 the rough's table is a dev's, so an estimator's bid-sent press keeps nothing. The card says the weeks are
     live, which is true.

   *Other way:* the Board's `gc_mark_bid_sent` takes the kept weeks from the client in one transaction: a migration on
   the Board's function, and the client works the weeks out either way.

   **gc 2's nod (amendment 1): the pick.** There is no migration on `gc_mark_bid_sent`, and it and the award guard stay
   as they are. gc 2's three conditions:
   - The keep runs only after the outcome press resolves, and it never throws into the handler. The outcome's own words
     and the board's reload come first. The keep's one line sits beside the strip and replaces neither.
   - A second **We sent our bid** does whatever `keepRough` says for a re-keep. Nothing is written when nothing changed:
     `keepRoughAt` writes only when `keepRough`'s result differs from the rough it read.
   - The edit stays inside the two outcome handlers, so a small hunk rebases clean under B2b-iii and later, which also
     touch `GcProjects.tsx`.

6. **Weeks to build on Our number: in 12b, with gc 2's nod.**
   - `GcOurNumber.tsx`'s header says *Weeks to build waits for the schedule's kernels on main*. They are there:
     `roughWeeks`, `proposalWeeksWords` and `bidSentWeeksWords`.
   - Default: 12b adds the prototype's **Weeks to build** stat and its line *For the proposal: We will build {job} in
     {n} weeks from the day we start.*, with **Copy**. It reads the rough the board does not carry: the page lays the
     money team's jobs' roughs over the board when Our number shows, one read of `gc_rough_schedules` by ids, as the
     money lens lays the schedules (O6b-3).
   - It is the money team's, as Our number is. Until PR 10 the rough reads empty for them, so the stat says *not drawn*,
     which is true.

   *Other way:* the Board lane adds it in its own PR, with 12b exporting the read. Either way it is one stat and one
   line in the Board's file.

   **gc 2's nod (amendment 1): the pick.**
   - 12b adds the stat and the line with **Copy**, and drops the header's *waits for the schedule's kernels on main* in
     the same PR.
   - Our number's money gate stays as it is. The page lays the roughs over the board for the money team only.
   - The new rows go after Our number's existing lines, not between them, so the price card's tests keep their order.
   - Nothing in B2b touches `GcOurNumber.tsx`. 12b's PR number goes to gc 2 when it opens.

7. **A file read in the browser, not kept.**
   - `readScheduleFile` reads the CSV or XML in the page. Nothing is uploaded.
   - The file's name and who handed it go in the draw's words (`importedSchedule().words`, `theirDatesLogWords`), so the
     log says where the schedule came from.
   - *Drop the plan PDF here* stays off; that is the owner's call for New project, and this is the same kind of thing.

   *Other way:* keep the handed file in the job's Drive folder as a received copy. A later PR, once the owner says files
   that come in are kept like the ones that go out (`docs/SENT_COPIES.md` covers only what we send).

8. **Bring in their schedule replaces only what the server lets it.**
   - It replaces a schedule drawn before Start that nobody walked or moved, as `importRefusal` words it.
   - `gc_schedule_draft` refuses a schedule with moves (*The schedule has moves with their reasons. They stay as they
     are.*) and one after Start (*A new set of plans is the way to change its schedule now.*). The window shows the
     kernel's words first and the server's if it disagrees.
   - **Bring in their schedule instead** sits on a drawn schedule only while `importRefusal` is null.

   *Other way:* only on an empty schedule. Simpler, but the case the prototype built for, our draft then their file the
   next day, would need a redraw first.

9. **Their dates: while no what-if copy is open.**
   - `theirDatesRefusal` refuses a job not being built and a schedule with no dates to meet.
   - PR 11's copy is a person's own, so **Their dates** hides while that person's copy shows, as the Milestones card's
     other presses do (PR 11, call 2).
   - The write is one record, refused whole, with no version, so it never meets *The schedule changed while you were
     working.*

   *Other way:* none.

10. **Guides, one per cut, each with its share card:**
    - 12a: *start a schedule from a template*, the one `SCHEDULE_REAL_BUILD.md` names, with a section for saving one.
    - 12b: *draw a rough schedule for our bid*.
    - 12c: *bring in a schedule someone handed us*, with a section for taking only their dates to meet.

    `GLOSSARY.md` gains *schedule template* in 12a and *rough schedule* in 12b, the two words `SCHEDULE_REAL_BUILD.md`'s
    docs list names. `roles` match the window's: a dev's until PR 10 lands, then the office's. Whichever lands second
    sets them. *Other way:* one guide for all three. That is too long for a first-timer, and the plain-words test would
    hold it to one idea a sentence anyway.

## The files

| Cut | Ported from the spike (each forked to `.proto` in its follow-up) | Main's files |
|---|---|---|
| 12a | `GcScheduleTemplates.tsx` (186 lines: `GcTemplatesCard`, `GcTemplatePick`) and its render test (5) | new `GcScheduleTemplates.tsx`; `GcSchedule.tsx` (the card on a job being built, the pick on `DraftCard`, two presses); `scheduleWindow.ts` (+2 kernels) |
| 12b | `GcRoughSchedule.tsx` (165) and its render test (5) | new `GcRoughSchedule.tsx`; `GcSchedule.tsx` (a bidding job shows it in place of *No schedule is drawn*); `scheduleWindow.ts` (+1); `scheduleIo.ts` (`keepRoughAt`, `loadRoughs`); `GcProjects.tsx` (the keep after the two outcome presses, the roughs for Our number); `GcOurNumber.tsx` (the stat and the line) |
| 12c | `GcScheduleImport.tsx` (268) and `GcTheirDates.tsx` (173) with their render tests (5 and 6) | two new files; `GcSchedule.tsx` (*Bring in their schedule* on `DraftCard` and on a drawn schedule before Start, **Their dates** on `GcMilestones`); `GcScheduleCards.tsx` (`GcMilestones` gains a `door` slot); `scheduleWindow.ts` (+2) |

Each port keeps the prototype's words. Each `dispatch({ type })` becomes a callback the window passes, as 9a and 9b did.
Each window passes the five window checks before its PR opens: the status-bar rule caught two straight ports on 10-10
(`HELPERS.md`).

## Tests

- **Kernels** (`scheduleWindow.test.ts`), each against the reducer's behavior:
  - 12a: a draw from a template, from the rough's own copy, and with an unknown template refused; a save, its name refused
    when taken, and its shape.
  - 12b: a rough drawn, redrawn with the same template, with another, and with none; refused after our bid or once lost;
    only the days that differ kept.
  - 12c: an import drawn and refused (moves, after Start, nothing kept), and their dates taken and refused.
- **Render** (each port's own tests from the spike, re-pointed at main's test state, plus):
  - `GcScheduleWindow.render.test.tsx`: each press with the version read where it is a plan write; none of it for
    someone who may not move a bar; a bidding job shows the rough, not *No schedule is drawn*.
  - `GcProjects.render.test.tsx` (12b): the rough kept after **We sent our bid**, and the line when the keep fails.
  - `GcOurNumber.render.test.tsx` (12b): **Weeks to build** with a rough, *not drawn* without one.
- **No SQL bed change.** No migration, and the draw from a template already runs in `gc_schedule`'s scenario (*Q drawn from
  the template, by its name that day*).

## Docs

- Each cut: its release note and fragment, its guide (call 10), and the schedule paragraph in `PROJECT_DOCUMENTATION.md`.
- 12a and 12b: `GLOSSARY.md`.
- 12b: `GcOurNumber.tsx`'s header loses *Weeks to build waits for the schedule's kernels on main*.
- No `ACCESS_CONTROL.md` change, since no gate moves. No `APP_DIRECTORY.md` change, since no page is added.

## Seams

- **PR 10 (#5231, held).** Only the gate lines (call 4) and the guides' `roles` (call 10).
- **PR 11 (the what-if copy, merged).** While a copy shows, the Templates card's save, **Bring in their schedule instead**
  and **Their dates** hide, as the Milestones card's presses do.
- **The Board (gc 2).** Call 5's keep after `markGcBidSent` and `markGcWon` in `GcProjects.tsx`'s outcome handlers.
  Call 6's stat and line in `GcOurNumber.tsx`.
- **Owner Billing (gc 5).** Nothing. The late finish reads the schedule, never the rough.
- **New project.** Nothing. The rough has no row until it is drawn, and New project writes none.

## The check (as a dev, on the test projects)

Each press writes prod rows, so the check waits on Grace's own yes in the lane's chat, with the other live checks:

1. 12a: save "GC test project, delete me"'s schedule as the template "Test shape, delete me", then draw a first draft on
   the bidding test project from it.
2. 12b: draw that project's rough from the template and see its weeks on Our number.
3. 12c: bring in a small CSV on a job with nothing drawn, and take one date from it on the building job.

Each template, rough and draw lands on a "delete me" project or name, for the call 4 sweep.

## Is this the best we can do?

Three ways it could be better:

1. **Keep the rough in the Board's press, not after it.** Call 5's best-effort keep can miss, and then the weeks that
   went with the bid are not kept. Passing the kept weeks into the Board's bid-sent function (the other way) makes it
   one transaction. That needs a Board migration, so I would wait until a missed keep shows up, unless gc 2 prefers it
   now.
2. **A received copy of the file they hand us.** The log names the file, but the file itself is gone once the window
   closes. Keeping it in the job's Drive folder would let anyone check the import against its source later. That is the
   owner's call on received files (call 7).
3. **Templates as a page of their own.** Today a template is seen only from a building job's Templates card, and offered
   from the draft and the rough. Once there are a dozen, a list on its own (where each came from, the jobs drawn from
   it, set aside or not) would serve the office better than any one job's card. That is a later PR once the list grows.

## Status

- 2026-10-10: planned by gc 1 at the lead's ask, from main at a699ca854 and the spike at 3a1fad434. Not cut, not claimed.
  For gc 4's co-sign and gc 2's nod on calls 5 and 6, then the lead's read-back.
- 2026-10-10, amendment 1: gc 2 nodded calls 5 and 6 at their picks, with three conditions on the keep and one on where
  Our number's new rows go. Each is written into its call.
