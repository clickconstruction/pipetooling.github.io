---
name: "The schedule's PR 6: the mapper and the io"
rows: SCHEDULE_REAL_BUILD.md, The PRs in order, 6; Kernels that move over (A mapper builds it from the rows); Writing it
branch: the plan on spike/schedule-pr6-plan (from origin/spike/gc-mode at 6d1a076b7); the code from origin/main when each PR is cut
status: plan 2026-10-07 by Helper 1 at the lead's ask, while PR 5 (#4866) waits on its SQL bed. Nothing is built. It waits for the lead's go on the five calls.
---

# The schedule's PR 6: the mapper and the io

## What it is

The schedule's rows read back as the shapes the kernels read, and every press written through PR 5's
functions. No migration and no screen. It comes as two PRs (call 1).

**PR 6a, the mapper and the reads.** It can be cut as soon as #4847 (the types for PR 4's tables) is on
main. It calls no new function, so it typechecks then.

- `src/lib/gc/schedule/rows.ts`, pure:
  - `ScheduleRows`: the rows one job's schedule is kept in, each row typed from the generated table
    types (`Tables<'gc_schedule_moves'>` and the rest).
  - `scheduleFieldsFromRows(rows, names)`: the job's schedule fields, `schedule`, `waits`,
    `scheduleSends`, `crewCounts`, `whatIf` and `rough`, as the kernels keep them.
  - `gcProjectFrom(view, customerName)`: New project's `GcProjectView` as the kernels' `GcProject`
    (call 3).
  - `scheduleStateFromRows(input)`: the `GcState` the kernels take, with `today`, the job, its
    customer, the templates and no partners yet. The schedule's version is kept beside it.
- `src/lib/gc/scheduleIo.ts`, beside `gcIo.ts`: `loadSchedule(projectId)` reads the rows, the names
  of the people they name, and the templates, then runs the mapper. It returns
  `{ state, project, version }`.
- `src/lib/gc/schedule/rows.direct.test.ts`: the round trip (*The test*).

**PR 6b, the writes.** It is cut once PR 5 is pushed and its types are in, since its calls name PR 5's
functions.

- `src/lib/gc/schedule/writes.ts`, pure: the payloads PR 5's functions take, built from the kernels'
  records:
  - `barsForRpc(before, after)`: every bar whose plan changed, with only the keys that changed;
  - `moveForRpc(move, idOf)`: a `ScheduleMove` as `p_move`;
  - `draftForRpc(schedule, newId)`: a first draft or a file's schedule. An inspection's or the job's
    own `lineId` (`${projectId}-insp-roughin`) gets a new uuid, and every wait that names it is
    pointed at the new id;
  - `partsForRpc`, `placesForRpc`, `theirDatesForRpc`, `waitForRpc` and `failureForRpc`.
- `src/lib/gc/scheduleIo.ts` gains one function per press.
  - The plan writes: draw, move (every kind), undo, redo, keep a what-if, a baseline, split, join,
    the job's own work on and off, and an inspection failed.
  - The records: places, an inspection passed, their dates and a wait.
  - The plain writes:
    - the walk;
    - the real days, and the job's own work done;
    - a date to meet set or taken off;
    - the superintendent's check, and our crew's mark;
    - a wait's steps, and its removal;
    - the push back on a late notice;
    - a template saved, renamed or set aside: `templateSaveProblem` first, and a duplicate name
      (`23505` on `gc_schedule_templates_name_once`) said as *Another template has that name.*;
    - the rough;
    - the person's own what-if copy made, tried in or thrown away.
  - Every press returns the job read back (call 4).
  - A stale press throws the `DatabaseError`, and `scheduleChangedRefusal` (PR 5) reads it. PR 8's
    window shows it.
- `src/lib/gc/schedule/writes.direct.test.ts`: the payloads' shapes (*The test*).

## Five calls for the lead

1. **Two PRs: 6a now, 6b after PR 5's types.** The mapper needs only PR 2 to 4's tables, all typed
   once #4847 merges. The writes name PR 5's functions, which fail `npm run typecheck` until
   PR 5 is pushed (day 2) and its types PR merges. *My pick:* two PRs, so the mapper lands and PR 7
   can start on it while PR 5 waits for its push. *The other way:* one PR held until day 2.
2. **Where it lives.** The mapper and the payloads are pure kernels with tests, in
   `src/lib/gc/schedule/` (`rows.ts`, `writes.ts`). The io, which imports `supabase`, sits beside
   `gcIo.ts` as `src/lib/gc/scheduleIo.ts`, as *The PRs in order* says ("the schedule's io beside
   `gcIo.ts`"). *My pick:* so.
3. **The job the kernels read.** New project's mapper gives a `GcProjectView`. The schedule's kernels
   read the prototype's `GcProject`, which is lean: its trades, its stage, the day it started, and the
   schedule's own fields. `gcProjectFrom` makes one:
   - the stage: `bidding` reads `pursuing`. `buyout` and `building` stay. `closed` reads `building`,
     since `GcStage` has no closed and closeout is the Building lane's (U3);
   - each trade with its scope lines, and `sow: null`. So `scheduleLinesOf` reads the scope lines, and
     a line's id is its scope line's (PR 5's call 6). A trade's statement of work comes with B6, and
     keeps its lines' ids (decision 2);
   - our own trade's `selfPerform` with no percent until the schedule's PR 16 reads its Pipeline job
     (G-51);
   - `startedOn` from `gc_projects.started_on` once B1 adds it, else null;
   - `owner` is the customer's name, and `town` is empty;
   - no partners until B1. A kernel that names a trade's company names none yet, and the chart reads
     its trade.

   *My pick:* this adapter, its own function with its own test.
4. **Read after every write.** Every press reloads the job's rows, so the version, a move's id and a
   new bar's id come back from the database. The screen never patches its own copy. A load is about
   twenty small selects for one job, in two rounds. *My pick:* reload. It also gives the walk its
   moves' ids. `gc_schedule_move` returns the version, and the move it made is the newest on the
   reload.
5. **Names.** A record keeps who as a user id (PR 3's call). The kernels keep a name. A load reads
   `users (id, name)` once, for the ids its rows name, and the mapper puts the name where the kernel
   wants it. A move keeps its mover's name as it read that day (`made_by_name`), and is read as it
   is. *My pick:* one read a load, beside the rows.

## The rows, and what each becomes

| Table | In the kernels | How |
|---|---|---|
| `gc_schedules` | the version, beside the job; `schedule.template` | `{ id, name, on }` from `template_id`, `template_name`, `template_used_on`. No row: no schedule |
| `gc_schedule_activities` | `schedule.activities`, by `position` | `lineId` is the row's id. A line's `packageId` is its package's; an inspection's and the job's own work's is `''`. An inspection gets `{ label, passedOn, failed }`, the job's own work `{ label, who, doneOn }`. Limits, real days and a place only when set |
| `gc_schedule_links` | each bar's `after`, oldest wait first, and `lag` | `lag` holds only gaps that are not 0 |
| `gc_schedule_activity_parts` | a bar's `parts`, by `position` | `from` is `from_day` |
| `gc_schedule_inspection_failures` | `inspection.failed`, oldest first | `on`, `note`, `packageIds`, `reinspectOn` |
| `gc_schedule_milestones` | `schedule.milestones`, by `position` | |
| `gc_schedule_baselines`, with their dates | `baseline`, the newest by `created_at`, and `baselines`, the others, oldest first | a null name leaves `name` unset (*At Start*); `by` is `locked_by`'s name |
| `gc_schedule_moves`, with pushes, tells and answers | `schedule.moves`, newest first by (`schedule_version`, `made_at`) | `id` is the row's, `on` is `made_on`, `by` is `made_by_name`. The tells give `toldOn` (the first) and `toldTo` (company ids). The answers give `answers`, `partnerId` being the company's id. The kind's columns give `changeOrderId`, `lateNoticeId`, `pull`, `recovery`, `fromWhatIf` and `parts`. `undoneBy` is a name |
| `gc_schedule_walks` | `schedule.walks`, newest first | `by` is a name |
| `gc_schedule_lookahead_marks` | `schedule.lookAhead` | `packageId` from its bar |
| `gc_schedule_late_notices` | `schedule.lateNotices`, newest first | `partnerId` is the company's id; `pushedBack` is `{ on, by, note }` with a name; `kept` is `{ on }` |
| `gc_schedule_waits`, with their holds | `project.waits` | an empty `who` reads as the kind's own (`waitKind(kind).who`); `shippedOn` on a delivery only |
| `gc_schedule_crew_counts` | `project.crewCounts`, newest first | `partnerId` is the company's id |
| `gc_schedule_sends` | `project.scheduleSends`, oldest first | `by` is a name |
| `gc_schedule_what_ifs`, the person's own | `project.whatIf` | `copy` as the kernel kept it, its bars' places read from the real bars (decision 6); `by` is the person's name |
| `gc_rough_schedules` | `project.rough` | `template_lines` is `like` |
| `gc_schedule_templates`, all | `state.scheduleTemplates`, oldest first | `by` is a name |

A row the mapper cannot place is left out, never guessed: a link to a bar not on the job, a mark on a
bar that is gone.

## The test

**6a, the round trip** (`rows.direct.test.ts`). Fair Oaks D in the test state has 30 bars, its
baseline at Start, 15 marks and 3 waits, but no moves, walks or parts. The test first gives it one of
every record, through the kernels, never by hand:

- a move with its pushes (`planMove`, `moveRecord`) and the same move undone (`undoMove`);
- a pull and days got back, recorded by `pullMove` and `recoveryMove` from offers made in the test
  (`planPull` and `recoveryOffers` come to main with PR 9);
- a split line (`splitParts`) with a part's own move;
- a new baseline (`withNewBaseline`);
- a walk, a late notice pushed back, a told move with an answer, crew counts and a send;
- a what-if copy with a move tried (`whatIfCopy`), a rough drawn from a template, and the template
  itself (`templateShape`).

A test-only `rowsFromSchedule(project, version)` writes it as the tables' rows, the way PR 5's
functions would. `scheduleFieldsFromRows` must read it back equal to the job, field for field. A
second case reads the rows shuffled, to hold the mapper to its own order, never the rows' order. A
third case drops a bar, to show a link to it and its mark left out.

**`gcProjectFrom`'s own cases**: each stage, a trade we do ourselves, a trade with no scope lines, and
a job before B1 (no `started_on`).

**6b, the payloads** (`writes.direct.test.ts`):

- `barsForRpc` gives every bar the kernel moved, at its new dates, and nothing else.
- `moveForRpc` gives every push and the kind's own keys, so PR 5's "the move and its bars agree"
  passes on every kind of move the kernels make.
- `draftForRpc` makes new uuids for a draft's inspections and points every wait at them.
- PR 5's words test grows by one case. Every key the SQL reads (`->> '…'`) is a key `writes.ts`
  sends. A key renamed on one side fails `npm test`, never a press (*Is this the best we can do?*,
  way 1).

## The check

- **6a**: the round trip in `npm test`, the GC suite, eslint, and the typecheck. No screen calls it
  yet, so nothing to walk. PR 7 is its first reader.
- **6b**: the payload tests. Then the build doc's own check, once PR 5 is pushed and its types are in.
  On the dev server, signed in as a dev, draw *GC test project, delete me*'s first draft through
  `drawSchedule`, read it back through `loadSchedule`, and compare with the kernel's draft. Then move
  a bar and see the version come back as 2.
- **The test rows that leaves** are the owner's call 13, beside the test project's other rows. The
  guard holds a schedule against a dev's delete, so the lead clears it as postgres, if the owner
  says so:

  ```sql
  BEGIN;
  SET LOCAL gc.schedule_plan_write = 'on';
  DELETE FROM public.gc_schedules WHERE project_id = 'ef8905d1-039a-4cbc-9d69-9468cfea50e0';
  COMMIT;
  ```

  Its bars, moves, changes and records go with it by cascade.

## Docs each PR touches

- **6a and 6b**: a release note (infra, dev) and its fragment each. No migration, no screen, no guide.
- `PROJECT_DOCUMENTATION.md`, `docs/ACCESS_CONTROL.md` and `GLOSSARY.md` wait for PR 7, the first
  screen.
- On the spike: *Kernels that move over* in `SCHEDULE_REAL_BUILD.md` names `rows.ts`, `writes.ts`
  and `scheduleIo.ts`, and its *Status*.

## When each is cut

1. **6a** is cut from `origin/main` once #4847 is on main. Claim the version at the cut. Add the
   files, run the GC suite, eslint and the typecheck. Open the PR and arm it: it waits on no
   non-required check.
2. **6b** is cut from `origin/main` once PR 5's types PR is on main, the same way.
3. Message the lead with each PR and the commands' results.

## Is this the best we can do?

Three ways it could be better:

1. **One contract for the payloads.** PR 5's functions take `jsonb`, so the generated types say
   `Json`. A key renamed in `writes.ts` or in the SQL would show only when someone presses. *I pick
   it, in 6b:* the words test reads every `->> '…'` key the SQL takes and checks `writes.ts` sends it.
   That costs one test case, not a schema.
2. **One read instead of twenty.** A `gc_schedule_read(project)` function could return the whole job
   as one `jsonb`. *Not now:* it needs a migration, and a lane gets one a day. Twenty small selects
   for one job, in two rounds, are fast enough for a tab. If PR 7 feels slow, it is a small
   migration then.
3. **The mapper and the SQL tested together.** The bed proves the SQL, and the round trip proves the
   mapper on rows the test made. Only 6b's live check proves them against each other. A third test
   could read the bed's rows through the mapper. *Not now:* it needs Node inside the bed. The live
   check on the test project covers it once, and typecheck holds the column names.

## Status

Plan written 2026-10-07 by Helper 1 at the lead's ask, on `spike/schedule-pr6-plan` from
`origin/spike/gc-mode` at 6d1a076b7. PR 5 is #4866, held as a draft until its SQL bed is green. #4847,
PR 4's types, is open. Nothing is built.
