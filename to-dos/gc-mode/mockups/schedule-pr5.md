---
name: "The schedule's PR 5: the writes, so a press is all or nothing"
rows: SCHEDULE_REAL_BUILD.md, The PRs in order, 5; Writing it (the RPCs); Two people on one schedule (G-134); decisions 5, 7 and 9
branch: the plan on spike/schedule-pr5-plan (from origin/spike/gc-mode at e00f74a7e); the migration from origin/main when the PR is cut, after PR 4 (#4835, on main since 3fea13814) is pushed
status: plan 2026-10-07 by Helper 1 at the lead's ask. Nothing is built. It waits for the lead's go on the seven calls.
---

# The schedule's PR 5: the writes, so a press is all or nothing

## What it is

- **One migration**, `<stamp>_gc_schedule_writes.sql`, with 23 functions and one trigger:
  - **the version step**, `gc_schedule_bump`. It checks the version a press read, bumps it and keeps
    the press's words. A press on an old version is refused: *The schedule changed while you were
    working.* Its DETAIL is every change since, as JSON (decision 5);
  - **eleven plan writes**, one for each press that changes the plan: draw, move, undo, redo, keep a
    what-if, a new baseline, split, join, put the job's own work on, take it off, and an inspection
    failed. Each checks and bumps the version, keeps the plan at Start first on a job being built
    (decision 7), and returns the new version;
  - **four records that touch several rows**, with no version (decision 9): places, an inspection
    passed with its date met, their dates to meet, and a wait with the bars it holds;
  - **six shared steps** the plan writes call: keep the plan at Start, set the bars, check why it moved,
    save a move, does a move still sit, and put a move back or forward;
  - **the guard**, a trigger on the plan's ten tables. The plan's rows change only inside a plan write,
    so the version counts every change (call 1).
- **The SQL tests**: `supabase/tests/gc_schedule/20_scenario.sql`, run by `scripts/pgtest-gc-schedule.sh`
  (`npm run test:pg:gc-schedule`) against every migration. Nothing on the office Mac runs Postgres:
  Docker answers "permission denied" and there is no server binary. So a new workflow,
  `.github/workflows/sql-beds.yml`, runs the bed on the PR (*Is this the best we can do?*, way 1).
- **The two template refusals, worded before the table refuses them**: `templateSaveProblem` in
  `src/lib/gc/schedule/templates.ts`, with its tests (call 7).
- **One copy of the words**: `src/lib/gc/schedule/writes.words.test.ts`. Every refusal the SQL shares
  with a kernel must be the kernel's own sentence, and every sentence the SQL says must be plain words.
- **With it**: the migration doc, a release note (infra, dev) and its fragment.
- **Not in it**: the types (the types PR after the push), the io that calls these (PR 6), and every
  screen (PR 7 on). The trades' writes are `gc_trade_<verb>` functions in PRs 13, 14 and 16, as agreed
  with Helper 3 (`PORTAL_REAL_BUILD.md`). Nothing here reads or writes a company.

## Seven calls for the lead

1. **The guard: the plan changes only inside a plan write.** Decision 5's promise is the version, but
   the plan's tables also take plain writes under RLS. A dev's PATCH to `gc_schedule_activities` moves
   a bar, and no version knows. A trigger on the ten plan tables refuses an insert, a delete, or an
   update of a plan column, unless a plan write turned on this transaction's flag
   (`gc.schedule_plan_write`). `gc_schedule_bump` turns it on after the version is checked, and the
   plan write turns it off before it returns. That is the house pattern of `app.quick_add_rpc` and
   `app.promise_event_written`.
   - Records pass: a bar's real days, place, pass and day done, a part's percent and real days. So do
     a milestone, a mark, a wait, a late notice and a crew count, whose tables have no guard.
   - A cascade passes (`pg_trigger_depth() > 1`): a bar that goes with its scope line, its trade or
     its job.
   - *My pick:* in PR 5. Nothing writes these tables yet, so the triggers lock no live rows. And every
     later writer, PR 16's plan sets among them, has to come through the version. *The other way:*
     trust the io (PR 6) to call only these functions, and add the guard with PR 10's policy swap.
2. **A record's day is the company's, from the server.** `public.app_today()` (America/Chicago)
   stamps `made_on`, `undone_on`, `locked_on`, `failed_on`, `passed_on`, `met_on`, `drafted_on` and
   `template_used_on`. PRs 2 to 4 gave these no default, so the writer gives the company day. Here the
   writer is the function, and `app_today()` is the company day without the screen's clock. The plain
   writes still send the screen's day. *My pick:* `app_today()`.
3. **One `gc_schedule_move` for every kind of move.** *Writing it* lists `gc_schedule_pull` and
   `gc_schedule_recover` apart from the move, and puts a part's move, a late notice taken and a change
   order's days under the move. All of them write the same thing: the bars' new days and one move row
   with its pushes. The kind is in the row's own columns: `pull_finished`, `recovery_*`, `parts`,
   `late_notice_id` and `change_order_id`. *My pick:* one function. Then one check, that the move and
   its bars agree, serves every kind.
4. **The walk is a plain insert.** *Writing it* lists `gc_schedule_walk` as a plan write that writes
   the walk's moves. PR 3's call 2 settled that the moves are saved as they are made during the walk,
   each through the move. The walk is kept once at its end, with their ids. So the walk is one row, a
   record. Its real days are the plain write `setActualDates` already makes. *My pick:* a plain
   insert. Its table refuses a walk that looked at nothing, and `recordScheduleWalk` refuses it first.
5. **Undo and Redo replay the move on the server.** They send the move's id, not dates. The move's
   row holds where every bar was and went: its own bar, its pushes, a side-by-side gap and a part's
   days. The server puts back exactly what the move did. It also checks the kernel's rule: the newest
   standing move, no wait changed, and every bar it touched still where the move left it
   (`undoableMove`, `redoableMove`). *My pick:* replay. It is the one write whose record already is
   the answer.
6. **A line's bar takes its scope line's id.** For a `line`, `gc_schedule_activities.id` is its
   `scope_item_id` (one bar per line already, `gc_schedule_activities_one_per_line`). Then the
   prototype's `lineId` is the bar's id for every kind, and the mapper (PR 6) keeps one id, not two.
   *My pick:* yes. A redraw keeps a line's id, and nothing it could mislead survives a redraw: a redraw
   is refused once the schedule was walked or moved.
7. **The template refusals live in the kernel, and the insert stays plain** (decision 9).
   `templateSaveProblem(state, project, name)` gives every reason Save as a template stops, in the
   prototype reducer's order. The screen asks it before the insert. The table's checks stay the last
   line, without words. A second person saving the same name at the same moment meets the unique
   index (23505), and the io (PR 6) maps it to *Another template has that name.* *The other way:* a
   `gc_schedule_save_template` function that words them in SQL. *My pick:* the kernel, for one copy of
   the words and decision 9 as decided.

## The functions

Every function is `SECURITY INVOKER` with `search_path = public`. EXECUTE goes to `authenticated`
only, so the tables' policies decide who may: dev only until PR 10. Every plan write takes
`p_version` (the version the press read) and `p_words` (the change's line, the prototype's log line),
and returns the new version.

| Function | Its other arguments | The prototype's | It refuses | It writes |
|---|---|---|---|---|
| `gc_schedule_draft` | `p_draft` | `draftSchedule`, `importSchedule` (G-137) | a lost job; one while we bid; bars with no id, name or days; a wait on a bar not in the draft; a template gone; in place of one drawn before: a job that started, one walked, one with moves or a baseline (`importRefusal`) | the header (a null version makes it at 1), the template's name that day, the bars (a line's id is its scope line's), their waits, a template's parts, the dates to meet |
| `gc_schedule_move` | `p_move`, `p_bars` | `setScheduleActivity`, `moveActivityPart`, `pullScheduleEarlier` (G-37), `recoverScheduleDays` (G-82), Take on a late notice (G-117), a change order's days (G-76) | no reason, a note under 8 letters (`moveWhyProblem`); a finish before its start (`planMove`); bars and record that disagree; a bar, push or part not on this schedule; a late notice not on the bar, or taken | the bars as the kernel left them (days, limits, waits with gaps, parts' days), the move and its pushes, after the plan at Start |
| `gc_schedule_undo` | `p_move_id` | `undoScheduleMove` (G-40) | a move not on this schedule, undone already, not the newest standing, that changed a wait, or whose bars moved since | every bar back from the move's own record, its gap, its parts' days; `undone_on`, `undone_by` |
| `gc_schedule_redo` | `p_move_id` | `redoScheduleMove` (G-40) | a move standing already, not the newest, or whose bars moved since | the same, forward; the undo pair cleared |
| `gc_schedule_keep_what_if` | `p_moves`, `p_bars` | `keepWhatIf` (G-81) | nothing tried; a move with no reason or sentence; no copy of this person's open | the bars as the copy left them, each move tried, oldest first, with `from_what_if_on`, then the copy deleted |
| `gc_schedule_baseline` | `p_name`, `p_why` | `setScheduleBaseline` (G-41) | no name; no baseline kept yet | a named baseline and its dates, the plan as it stands |
| `gc_schedule_split` | `p_activity_id`, `p_parts` | `splitActivity` (G-39) | under two parts, a part with no name, two with one name, a part with no days, shares not adding to 100 (`splitParts`); not a line; split already; parts that do not span the line | the parts |
| `gc_schedule_join` | `p_activity_id` | `joinActivity` (G-39) | one bar already | the parts deleted |
| `gc_schedule_add_activity` | `p_bar`, `p_holds_up`, `p_bars` | `addScheduleActivity` (G-38) | no name, no owner, no days (`addedActivityProblem`); a bar both before it and waiting on it; a bar not on this schedule | the bar, its waits, the waits of the bars it holds up, and what that pushes |
| `gc_schedule_remove_activity` | `p_activity_id` | `removeScheduleActivity` (G-38) | a trade's line or an inspection | the bar deleted, its waits with it |
| `gc_schedule_fail_inspection` | `p_activity_id`, `p_failure`, `p_bars` | `failInspection` | no words; a re-inspection not after today; a job not being built; not an inspection; passed already; the inspection not at its re-inspection day with its days kept | the failure (this job's trades only), the inspection at its day and what that pushes |
| `gc_schedule_set_places` | `p_places` | `setActivityPlaces` (G-83) | a bar not on this schedule; an inspection or the job's own work; a place over 40 letters, the whole press | each place, tidied as kept |
| `gc_schedule_pass_inspection` | `p_activity_id` | `passInspection` | a job not being built; not an inspection; passed already | `passed_on`, and a date to meet of the same name met |
| `gc_schedule_their_dates` | `p_dates` | `takeTheirDates` (G-145) | a job not being built; this person's what-if open (`theirDatesRefusal`); a date with no name or day; one of ours met or not here; two of theirs on one of ours (`withTheirDates`), the whole press | ours moved, theirs added as the job's own |
| `gc_schedule_add_wait` | `p_wait` | `addScheduleWait` (G-73 to G-75) | an unknown kind, no title, no expected day; no schedule; a trade or a bar not on this job | the wait (an empty who reads as the kind's own) and its holds |

The six shared steps are `gc_schedule_keep_start`, `gc_schedule_set_bars`, `gc_schedule_check_why`,
`gc_schedule_save_move`, `gc_schedule_move_sits` and `gc_schedule_put_move`. They are callable, as
any function is for the signed-in, but alone they change nothing: the guard refuses their writes
without a plan write's flag. `gc_schedule_bump` alone only bumps a version it was handed, with words.

**The order inside a plan write** is always the same:

1. The person's own input first: why it moved, the dates, the parts, the names. A refusal there is
   theirs to fix, so it comes before the version.
2. The version, which also locks the schedule's row to the end of the transaction.
3. What the schedule says: the move is the newest, the bar is a line, the job started.
4. The plan at Start, kept if it is due.
5. The writes, with the flag on, then the flag off.

## What the screen sends

The kernel works the press out and sends its answer. PR 6's io builds these from the kernel's
records. A line's id is its scope line's id; an inspection's or the job's own bar's is the id the
draw gave it.

- **A bar's new plan** (`p_bars`, an array): `{ "id", "start", "finish" }`, and when they change:
  `"notBefore"` and `"mustFinishBy"` (null takes a limit off), `"after": [{ "id", "gap" }]` (the
  bar's whole list of waits), `"parts": [{ "id", "fromDay", "days" }]`.
- **A move** (`p_move`, the kernel's `ScheduleMove`): `{ "activityId", "activityName", "reason",
  "note", "from": { "start", "finish" }, "to": {…}, "linksChanged", "finishFrom", "finishTo",
  "pushed": [{ "activityId", "from", "to" }] }`. By its kind, it adds `"pullFinished": [ids]`,
  `"recovery": { "how", "afterActivityId", "gapWas", "gap" }`, `"lateNoticeId"`, `"changeOrderId"`,
  or `"parts": { "id", "was": [{ "id", "from", "days" }], "now": […] }`. The server sets the day, the
  moment, the mover and the mover's name.
- **A draft** (`p_draft`): `{ "template": { "id" }, "bars": [{ "kind", "scopeItemId", "packageId",
  "id", "label", "who", "start", "finish", "notBefore", "mustFinishBy", "place", "after": [{ "id",
  "gap" }], "parts": [{ "id", "name", "fromDay", "days", "share", "pct" }] }], "milestones": [{ "id",
  "label", "planned", "packageId", "metOn" }] }`.
- **A split** (`p_parts`): `[{ "id", "name", "fromDay", "days", "share", "pct" }]`, `splitParts`'s parts.
- **The job's own work** (`p_bar`): `{ "id", "label", "who", "start", "finish", "after": [{ "id",
  "gap" }] }`, with `p_holds_up` the bars that wait on it from now on.
- **A failure** (`p_failure`): `{ "note", "packageIds", "reinspectOn" }`.
- **Places** (`p_places`): `{ "<bar id>": "Roof" | null }`.
- **Their dates** (`p_dates`): `[{ "id" (one of ours), "label", "planned" }]`. A date with no id is
  theirs, new.
- **A wait** (`p_wait`): `{ "id", "kind", "title", "packageId", "who", "askedOn", "expectedOn",
  "note", "activityIds" }`.

## The version and its refusal

- **The check** is one statement, as *Two people on one schedule* says:
  `UPDATE gc_schedules SET version = version + 1 … WHERE project_id = $1 AND version = $2`. No row
  back means someone saved first. The row stays locked until the transaction ends, so two plan writes
  on one job never interleave.
- **A first draft** sends no version. `gc_schedule_bump` makes the schedule's row at version 1, with
  the draw's words. A second person drawing at the same moment meets that row and is refused the same
  way. So PR 2's open question is settled: the draw writes version 1.
- **The refusal**: `P0001`, message *The schedule changed while you were working.*, and DETAIL as JSON:

  ```json
  {"read": 1, "version": 2, "changes": [{"version": 2, "at": "2026-11-04T20:14:03.512+00:00", "by": "…", "name": "Robert Douglas", "words": "Electrical · Lighting now runs Mon Sep 14 to Fri Oct 30. Robert: The fixtures ship a week late."}]}
  ```

  `name` is read from `users` as the caller may see it, so it can be null; the words carry the name too.
- **The client** (PR 6's io) gets a `DatabaseError` through `checkSupabaseError`. Its `serverMessage`
  starts with the phrase, and its `details` is the JSON. PR 8's window shows each change's time and
  words. It reloads the chart behind it and keeps the person's reason and words.
- **A press sent twice.** If the answer to a saved press is lost, a second press goes on the old
  version and is refused by the person's own change. PR 8's window says *It was saved.* when every
  change since is this person's own, with these words (*Is this the best we can do?*, way 2).
- **What never conflicts**: places, a pass, their dates, a wait, and every plain record carry no
  version (decision 5).

## The two template refusals

`templateShape` makes the shape Save as a template keeps, and the table refuses two shapes it can
make, in words no person should read:

- **No lines** (`gc_schedule_templates_lines_listed`). A template keeps a job's trade lines and the
  first draft's two inspections. A schedule whose trades have no lines keeps only its inspections, and
  a schedule with neither keeps nothing. A template of inspections alone covers no line on another job
  (`templateCovers`), so the guard asks for one trade's line, not one line.
- **Under a week** (`gc_schedule_templates_weeks_counted`). `drawWeeks` counts from the first start to
  substantial completion's planned day. Planned before the first start, that is under one.

They are worded in the kernel, before the insert, beside the reducer's other two reasons:

```ts
/**
 * Why a job's schedule cannot be saved as a template, in the office's words, or null when it can (G-44;
 * the schedule's PR 5). Save as a template asks before it writes, so the table's own checks never
 * speak: a template keeps at least one trade's line, and its weeks come out at one or more.
 */
export function templateSaveProblem(state: GcState, project: GcProject, name: string): string | null {
  if (project.stage !== 'building') return 'Only a job being built can be saved as a template.'
  const named = templateNameProblem(state, name)
  if (named) return named
  const shape = templateShape(state, project)
  if (!shape) return 'Draw the schedule first.'
  if (!shape.lines.some((l) => l.trade !== '')) return "A template keeps the trades' lines. This schedule has none yet."
  const w = project.schedule ? drawWeeks(project.schedule) : null
  if (w && shape.weeks < 1) return `Substantial completion is planned ${weekdayDate(w.finish)}, before the work starts ${weekdayDate(w.start)}. Move it to a day after the work starts.`
  return null
}
```

Its tests go in `templates.direct.test.ts`, on the test state's Fair Oaks Shops, Building D:

- Fair Oaks D under a new name can go (null).
- Helotes, in buyout, gets *Only a job being built can be saved as a template.*
- A name another template has gets *Another template has that name.*
- Fair Oaks D with its inspections alone: `templateShape` keeps no trade's line, and the words are *A
  template keeps the trades' lines. This schedule has none yet.*
- Fair Oaks D with substantial completion moved to Mon Jun 1: `templateShape` gives weeks under one,
  and the words name that day and the first start: *Substantial completion is planned Mon Jun 1,
  before the work starts …*
- Every refusal passes `plainWordsFailures`.

## The SQL as it will be

```sql
SET lock_timeout = '3s';

-- GC mode, the real build, the schedule's PR 5 (v2.NNNN): the schedule's writes, so a press is all or
-- nothing (to-dos/gc-mode/SCHEDULE_REAL_BUILD.md on branch spike/gc-mode, "Writing it" and "Two people
-- on one schedule"; the plan is to-dos/gc-mode/mockups/schedule-pr5.md). The kernels stay in
-- TypeScript: a press works its answer out in the screen and sends the answer here. Every plan write
-- sends the version of the schedule it read; gc_schedule_bump checks it and bumps it, and keeps the
-- press's words, or refuses with "The schedule changed while you were working." and every change
-- since, as JSON in the DETAIL (decision 5). The plan at Start is kept first on a job being built
-- (decision 7). A record that touches several rows is a function with no version; every other
-- record stays a plain write under RLS (decision 9). A trigger lets the plan's own rows change only
-- inside a plan write, so the version counts every change. Each function is SECURITY INVOKER, so the
-- tables' policies decide who may: dev only until the schedule's PR 10. A record's day is the
-- company's, public.app_today(), never the server's UTC date.

-- ---------------------------------------------------------------------------------------------
-- The guard: the plan changes only inside a plan write
-- ---------------------------------------------------------------------------------------------

-- gc_schedule_bump turns this transaction's flag on once the version is checked, and the plan write
-- turns it off before it returns (the house pattern of app.quick_add_rpc). A record never needs it: a
-- real day, a place, a pass, a day done, a part's percent. A row that goes with its job, its trade or
-- its scope line passes too, since it changes inside the cascade's own trigger.
CREATE OR REPLACE FUNCTION public.gc_schedule_plan_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_setting('gc.schedule_plan_write', true) IS DISTINCT FROM 'on' AND pg_trigger_depth() < 2 THEN
    IF TG_OP <> 'UPDATE' THEN
      RAISE EXCEPTION 'Change the schedule through its own presses, so its version counts the change.' USING ERRCODE = 'P0001';
    ELSIF TG_TABLE_NAME = 'gc_schedule_activities' THEN
      -- A bar's plan: which bar it is and its days and limits. Its real days, place, pass and day done are records.
      IF (NEW.project_id, NEW.kind, NEW.scope_item_id, NEW.package_id, NEW.start, NEW.finish, NEW.not_before, NEW.must_finish_by)
         IS DISTINCT FROM (OLD.project_id, OLD.kind, OLD.scope_item_id, OLD.package_id, OLD.start, OLD.finish, OLD.not_before, OLD.must_finish_by) THEN
        RAISE EXCEPTION 'Change the schedule through its own presses, so its version counts the change.' USING ERRCODE = 'P0001';
      END IF;
    ELSIF TG_TABLE_NAME = 'gc_schedule_activity_parts' THEN
      -- A part's plan: its days and share. Its percent and real days are its reports.
      IF (NEW.activity_id, NEW.from_day, NEW.days, NEW.share) IS DISTINCT FROM (OLD.activity_id, OLD.from_day, OLD.days, OLD.share) THEN
        RAISE EXCEPTION 'Change the schedule through its own presses, so its version counts the change.' USING ERRCODE = 'P0001';
      END IF;
    ELSE
      RAISE EXCEPTION 'Change the schedule through its own presses, so its version counts the change.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.gc_schedule_plan_guard() IS
  'GC mode (v2.NNNN): the trigger that lets a schedule''s plan change only inside a plan write (gc_schedule_bump sets gc.schedule_plan_write for the transaction), so gc_schedules.version counts every change (decision 5). Records pass: a bar''s real days, place, pass and day done, a part''s percent and real days. A cascade passes (pg_trigger_depth() > 1).';

-- On the plan's ten tables, made only where missing, so a second run takes no lock.
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['gc_schedules', 'gc_schedule_activities', 'gc_schedule_activity_parts', 'gc_schedule_links',
    'gc_schedule_inspection_failures', 'gc_schedule_baselines', 'gc_schedule_baseline_dates', 'gc_schedule_changes',
    'gc_schedule_moves', 'gc_schedule_move_pushes'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'gc_schedule_plan_guard' AND tgrelid = format('public.%I', v_table)::regclass
    ) THEN
      EXECUTE format('CREATE TRIGGER gc_schedule_plan_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.gc_schedule_plan_guard()', v_table);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------------------
-- The steps every plan write shares
-- ---------------------------------------------------------------------------------------------

-- A plan write's first step (decision 5). It checks the version the press read and bumps it, keeps the
-- press's words as the change, and turns on the flag the guard reads; the plan write turns it off
-- before it returns. No version read: a first draft, which makes the schedule's row at version 1. A
-- version that is not the schedule's: refused, with every change since, oldest first, as JSON in the
-- DETAIL. The row stays locked to the end of the transaction, so two writes never interleave.
CREATE OR REPLACE FUNCTION public.gc_schedule_bump(p_project_id uuid, p_version integer, p_words text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
  v_since jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF btrim(coalesce(p_words, '')) = '' THEN
    RAISE EXCEPTION 'A change to the schedule needs its words.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('gc.schedule_plan_write', 'on', true);
  IF p_version IS NULL THEN
    INSERT INTO public.gc_schedules (project_id, version, drafted_on, drafted_by)
    VALUES (p_project_id, 1, public.app_today(), auth.uid())
    ON CONFLICT (project_id) DO NOTHING
    RETURNING version INTO v_version;
  ELSE
    UPDATE public.gc_schedules
       SET version = version + 1, updated_at = now(), updated_by = auth.uid()
     WHERE project_id = p_project_id AND version = p_version
    RETURNING version INTO v_version;
  END IF;
  IF v_version IS NULL THEN
    IF p_version IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.gc_schedules WHERE project_id = p_project_id) THEN
      RAISE EXCEPTION 'This job has no schedule yet. Draw its first draft.' USING ERRCODE = 'P0001';
    END IF;
    SELECT jsonb_build_object(
             'read', p_version,
             'version', (SELECT s.version FROM public.gc_schedules s WHERE s.project_id = p_project_id),
             'changes', coalesce(jsonb_agg(jsonb_build_object('version', c.version, 'at', c.made_at, 'by', c.made_by, 'name', u.name, 'words', c.words) ORDER BY c.version), '[]'::jsonb))
      INTO v_since
      FROM public.gc_schedule_changes c
      LEFT JOIN public.users u ON u.id = c.made_by
     WHERE c.project_id = p_project_id AND c.version > coalesce(p_version, 0);
    RAISE EXCEPTION 'The schedule changed while you were working.' USING ERRCODE = 'P0001', DETAIL = v_since::text;
  END IF;
  INSERT INTO public.gc_schedule_changes (project_id, version, made_by, words)
  VALUES (p_project_id, v_version, auth.uid(), btrim(p_words));
  RETURN v_version;
END;
$$;

-- The plan as it stands kept as the baseline At Start (decision 7): on a job that started and has none
-- yet, before the plan write that calls it changes anything. Its day is the job's Start day once Start
-- records one (gc_projects.started_on, the Board lane's B1, read so this needs no change when it
-- lands), and until then the day of this first change.
CREATE OR REPLACE FUNCTION public.gc_schedule_keep_start(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_project jsonb;
  v_baseline uuid;
BEGIN
  SELECT to_jsonb(g) INTO v_project FROM public.gc_projects g WHERE g.project_id = p_project_id;
  IF v_project IS NULL
     OR NOT (v_project ->> 'stage' IN ('building', 'closed') OR v_project ->> 'started_on' IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.gc_schedule_baselines WHERE project_id = p_project_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.gc_schedule_baselines (project_id, name, locked_on, locked_by)
  VALUES (p_project_id, NULL, coalesce((v_project ->> 'started_on')::date, public.app_today()), auth.uid())
  RETURNING id INTO v_baseline;
  INSERT INTO public.gc_schedule_baseline_dates (baseline_id, activity_id, start, finish)
  SELECT v_baseline, a.id, a.start, a.finish FROM public.gc_schedule_activities a WHERE a.project_id = p_project_id;
END;
$$;

-- The bars as the kernel left them (the answer, not the question): each bar's new days, and when sent,
-- its limits, its whole list of waits with their gaps, and its parts' days. A key left out leaves that
-- part of the bar as it is. A limit sent as null comes off.
CREATE OR REPLACE FUNCTION public.gc_schedule_set_bars(p_project_id uuid, p_bars jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_bar_in jsonb;
  v_wait_in jsonb;
  v_part_in jsonb;
  v_id uuid;
  v_start date;
  v_finish date;
  v_after uuid[];
BEGIN
  FOR v_bar_in IN SELECT value FROM jsonb_array_elements(coalesce(p_bars, '[]'::jsonb)) LOOP
    v_id := nullif(v_bar_in ->> 'id', '')::uuid;
    v_start := nullif(v_bar_in ->> 'start', '')::date;
    v_finish := nullif(v_bar_in ->> 'finish', '')::date;
    IF v_start IS NULL OR v_finish IS NULL THEN
      RAISE EXCEPTION 'It needs a start and a finish.' USING ERRCODE = 'P0001';
    END IF;
    IF v_finish < v_start THEN
      RAISE EXCEPTION 'It has to finish on or after it starts.' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.gc_schedule_activities
       SET start = v_start,
           finish = v_finish,
           not_before = CASE WHEN v_bar_in ? 'notBefore' THEN nullif(v_bar_in ->> 'notBefore', '')::date ELSE not_before END,
           must_finish_by = CASE WHEN v_bar_in ? 'mustFinishBy' THEN nullif(v_bar_in ->> 'mustFinishBy', '')::date ELSE must_finish_by END
     WHERE project_id = p_project_id AND id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A bar in this change is not on this schedule. Reload the schedule and try again.' USING ERRCODE = 'P0001';
    END IF;
    IF v_bar_in ? 'after' THEN
      v_after := ARRAY(SELECT nullif(w.v ->> 'id', '')::uuid FROM jsonb_array_elements(coalesce(v_bar_in -> 'after', '[]'::jsonb)) AS w(v));
      IF v_id = ANY (v_after) THEN
        RAISE EXCEPTION 'A bar cannot wait on itself.' USING ERRCODE = 'P0001';
      END IF;
      IF EXISTS (
        SELECT 1 FROM unnest(v_after) AS f(id)
        WHERE f.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.gc_schedule_activities a WHERE a.project_id = p_project_id AND a.id = f.id)
      ) THEN
        RAISE EXCEPTION 'A wait names a bar that is not on this schedule.' USING ERRCODE = 'P0001';
      END IF;
      DELETE FROM public.gc_schedule_links WHERE to_activity_id = v_id AND NOT (from_activity_id = ANY (v_after));
      FOR v_wait_in IN SELECT value FROM jsonb_array_elements(coalesce(v_bar_in -> 'after', '[]'::jsonb)) LOOP
        INSERT INTO public.gc_schedule_links (project_id, from_activity_id, to_activity_id, gap)
        VALUES (p_project_id, (v_wait_in ->> 'id')::uuid, v_id, coalesce((v_wait_in ->> 'gap')::integer, 0))
        ON CONFLICT (from_activity_id, to_activity_id) DO UPDATE SET gap = EXCLUDED.gap;
      END LOOP;
    END IF;
    IF v_bar_in ? 'parts' THEN
      FOR v_part_in IN SELECT value FROM jsonb_array_elements(coalesce(v_bar_in -> 'parts', '[]'::jsonb)) LOOP
        IF coalesce((v_part_in ->> 'fromDay')::integer, -1) < 0 OR coalesce((v_part_in ->> 'days')::integer, 0) < 1 THEN
          RAISE EXCEPTION 'Each part has to finish on or after it starts.' USING ERRCODE = 'P0001';
        END IF;
        UPDATE public.gc_schedule_activity_parts
           SET from_day = (v_part_in ->> 'fromDay')::integer, days = (v_part_in ->> 'days')::integer
         WHERE activity_id = v_id AND id = nullif(v_part_in ->> 'id', '')::uuid;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'A part in this change is not on its bar.' USING ERRCODE = 'P0001';
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- Why a bar moved, the person's own: a reason from the list and their words, a sentence at least
-- (moveWhyProblem; MOVE_NOTE_MIN is 8). Checked before the version, so the person fixes their words first.
CREATE OR REPLACE FUNCTION public.gc_schedule_check_why(p_reason text, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF coalesce(btrim(p_reason), '') NOT IN ('weather', 'trade before', 'materials', 'crew', 'customer', 'plans', 'inspection', 'us', 'change order', 'other', 'early', 'recovery') THEN
    RAISE EXCEPTION 'Pick why it moved.' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(btrim(coalesce(p_note, ''))) < 8 THEN
    RAISE EXCEPTION 'Say what happened, in a sentence.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- One move as the kernel recorded it (ScheduleMove), with what it pushed, under the version its plan
-- write made. Its day is the company's and its name the mover's as it reads today. A late notice it
-- takes is this bar's, and taken once. Returns the move's id.
CREATE OR REPLACE FUNCTION public.gc_schedule_save_move(p_project_id uuid, p_version integer, p_move jsonb, p_at timestamptz)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_bar uuid := nullif(p_move ->> 'activityId', '')::uuid;
  v_notice uuid := nullif(p_move ->> 'lateNoticeId', '')::uuid;
  v_after uuid := nullif(p_move #>> '{recovery,afterActivityId}', '')::uuid;
  v_push_in jsonb;
BEGIN
  IF nullif(p_move #>> '{from,start}', '') IS NULL OR nullif(p_move #>> '{from,finish}', '') IS NULL
     OR nullif(p_move #>> '{to,start}', '') IS NULL OR nullif(p_move #>> '{to,finish}', '') IS NULL
     OR nullif(p_move ->> 'finishFrom', '') IS NULL OR nullif(p_move ->> 'finishTo', '') IS NULL THEN
    RAISE EXCEPTION 'It needs a start and a finish.' USING ERRCODE = 'P0001';
  END IF;
  IF (p_move #>> '{to,finish}')::date < (p_move #>> '{to,start}')::date THEN
    RAISE EXCEPTION 'It has to finish on or after it starts.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gc_schedule_activities WHERE project_id = p_project_id AND id = v_bar)
     OR (v_after IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.gc_schedule_activities WHERE project_id = p_project_id AND id = v_after))
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(coalesce(p_move -> 'pushed', '[]'::jsonb)) AS x(v)
       WHERE NOT EXISTS (SELECT 1 FROM public.gc_schedule_activities a WHERE a.project_id = p_project_id AND a.id = nullif(x.v ->> 'activityId', '')::uuid)
     )
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(coalesce(p_move -> 'pullFinished', '[]'::jsonb)) AS x(v)
       WHERE NOT EXISTS (SELECT 1 FROM public.gc_schedule_activities a WHERE a.project_id = p_project_id AND a.id = nullif(x.v #>> '{}', '')::uuid)
     ) THEN
    RAISE EXCEPTION 'A bar in this change is not on this schedule. Reload the schedule and try again.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_move -> 'parts') = 'object' AND NOT EXISTS (
    SELECT 1 FROM public.gc_schedule_activity_parts WHERE activity_id = v_bar AND id = nullif(p_move #>> '{parts,id}', '')::uuid
  ) THEN
    RAISE EXCEPTION 'A part in this change is not on its bar.' USING ERRCODE = 'P0001';
  END IF;
  IF v_notice IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.gc_schedule_late_notices WHERE id = v_notice AND project_id = p_project_id AND activity_id = v_bar) THEN
      RAISE EXCEPTION 'That late notice is not on this bar.' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.gc_schedule_moves WHERE late_notice_id = v_notice AND undone_on IS NULL) THEN
      RAISE EXCEPTION 'That late notice was taken already.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  INSERT INTO public.gc_schedule_moves (
    project_id, activity_id, activity_name, made_on, made_at, made_by, made_by_name,
    from_start, from_finish, to_start, to_finish, reason, note, links_changed, finish_from, finish_to,
    change_order_id, late_notice_id, pull_finished,
    recovery_how, recovery_after_activity_id, recovery_gap_was, recovery_gap,
    from_what_if_on, parts, schedule_version
  ) VALUES (
    p_project_id, v_bar, coalesce(nullif(btrim(p_move ->> 'activityName'), ''), 'An activity'),
    public.app_today(), p_at, auth.uid(),
    coalesce((SELECT nullif(btrim(u.name), '') FROM public.users u WHERE u.id = auth.uid()), nullif(btrim(p_move ->> 'madeByName'), ''), 'The office'),
    (p_move #>> '{from,start}')::date, (p_move #>> '{from,finish}')::date, (p_move #>> '{to,start}')::date, (p_move #>> '{to,finish}')::date,
    btrim(p_move ->> 'reason'), btrim(p_move ->> 'note'), coalesce((p_move ->> 'linksChanged')::boolean, false),
    (p_move ->> 'finishFrom')::date, (p_move ->> 'finishTo')::date,
    nullif(p_move ->> 'changeOrderId', '')::uuid, v_notice,
    CASE WHEN jsonb_typeof(p_move -> 'pullFinished') = 'array'
      THEN ARRAY(SELECT (x.v #>> '{}')::uuid FROM jsonb_array_elements(p_move -> 'pullFinished') AS x(v)) END,
    nullif(p_move #>> '{recovery,how}', ''), v_after,
    (p_move #>> '{recovery,gapWas}')::integer, (p_move #>> '{recovery,gap}')::integer,
    nullif(p_move ->> 'fromWhatIfOn', '')::date,
    CASE WHEN jsonb_typeof(p_move -> 'parts') = 'object' THEN p_move -> 'parts' END,
    p_version
  ) RETURNING id INTO v_id;
  FOR v_push_in IN SELECT value FROM jsonb_array_elements(coalesce(p_move -> 'pushed', '[]'::jsonb)) LOOP
    INSERT INTO public.gc_schedule_move_pushes (move_id, activity_id, from_start, from_finish, to_start, to_finish)
    VALUES (v_id, (v_push_in ->> 'activityId')::uuid,
            (v_push_in #>> '{from,start}')::date, (v_push_in #>> '{from,finish}')::date,
            (v_push_in #>> '{to,start}')::date, (v_push_in #>> '{to,finish}')::date);
  END LOOP;
  RETURN v_id;
END;
$$;

-- True while every bar a move touched sits where the move left it (p_at_from false: Undo's test) or
-- where Undo put it back (p_at_from true: Redo's), as undoableMove and redoableMove ask. A bar since
-- removed does not sit anywhere.
CREATE OR REPLACE FUNCTION public.gc_schedule_move_sits(p_move_id uuid, p_at_from boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
           SELECT 1 FROM public.gc_schedule_moves m JOIN public.gc_schedule_activities a ON a.id = m.activity_id
           WHERE m.id = p_move_id
             AND a.start = CASE WHEN p_at_from THEN m.from_start ELSE m.to_start END
             AND a.finish = CASE WHEN p_at_from THEN m.from_finish ELSE m.to_finish END)
     AND NOT EXISTS (
           SELECT 1 FROM public.gc_schedule_move_pushes x LEFT JOIN public.gc_schedule_activities a ON a.id = x.activity_id
           WHERE x.move_id = p_move_id
             AND (a.id IS NULL
               OR a.start <> CASE WHEN p_at_from THEN x.from_start ELSE x.to_start END
               OR a.finish <> CASE WHEN p_at_from THEN x.from_finish ELSE x.to_finish END))
$$;

-- A kept move put back (p_back) or forward again: its bar and every bar it pushed, the gap a
-- side-by-side move changed on its wait (G-82), and a part's days (G-39), all from the move's own
-- record, so Undo and Redo do exactly what the move did, the other way.
CREATE OR REPLACE FUNCTION public.gc_schedule_put_move(p_move_id uuid, p_back boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_move public.gc_schedule_moves;
  v_part_in jsonb;
BEGIN
  SELECT * INTO v_move FROM public.gc_schedule_moves WHERE id = p_move_id;
  UPDATE public.gc_schedule_activities
     SET start = CASE WHEN p_back THEN v_move.from_start ELSE v_move.to_start END,
         finish = CASE WHEN p_back THEN v_move.from_finish ELSE v_move.to_finish END
   WHERE id = v_move.activity_id;
  UPDATE public.gc_schedule_activities a
     SET start = CASE WHEN p_back THEN x.from_start ELSE x.to_start END,
         finish = CASE WHEN p_back THEN x.from_finish ELSE x.to_finish END
    FROM public.gc_schedule_move_pushes x
   WHERE x.move_id = v_move.id AND a.id = x.activity_id;
  IF v_move.recovery_how = 'side' AND v_move.recovery_after_activity_id IS NOT NULL THEN
    UPDATE public.gc_schedule_links
       SET gap = CASE WHEN p_back THEN coalesce(v_move.recovery_gap_was, 0) ELSE coalesce(v_move.recovery_gap, 0) END
     WHERE from_activity_id = v_move.recovery_after_activity_id AND to_activity_id = v_move.activity_id;
  END IF;
  FOR v_part_in IN
    SELECT value FROM jsonb_array_elements(coalesce(v_move.parts -> (CASE WHEN p_back THEN 'was' ELSE 'now' END), '[]'::jsonb))
  LOOP
    UPDATE public.gc_schedule_activity_parts
       SET from_day = (v_part_in ->> 'from')::integer, days = (v_part_in ->> 'days')::integer
     WHERE activity_id = v_move.activity_id AND id = (v_part_in ->> 'id')::uuid;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- The plan writes: each checks and bumps the version and returns the new one
-- ---------------------------------------------------------------------------------------------

-- The first draft (draftSchedule, from a template's lines when one is named, G-44), or a file's
-- schedule (importSchedule, G-137): the bars, what each waits on, a split line's parts (a template's)
-- and the dates to meet, as the kernel drew them. A line's bar takes its scope line's id. With a
-- version read, it takes the place of a schedule drawn before Start that nobody walked or moved
-- (importRefusal). Never while we bid or on a lost job.
CREATE OR REPLACE FUNCTION public.gc_schedule_draft(p_project_id uuid, p_version integer, p_words text, p_draft jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
  v_stage text;
  v_lost date;
  v_template uuid := nullif(p_draft #>> '{template,id}', '')::uuid;
  v_ids uuid[];
  v_bar_in jsonb;
  v_wait_in jsonb;
  v_part_in jsonb;
  v_ms_in jsonb;
  v_id uuid;
  v_kind text;
  v_i integer := 0;
  v_j integer;
BEGIN
  SELECT stage, lost_on INTO v_stage, v_lost FROM public.gc_projects WHERE project_id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No GC project with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_lost IS NOT NULL THEN
    RAISE EXCEPTION 'This job was lost.' USING ERRCODE = 'P0001';
  END IF;
  IF v_stage = 'bidding' THEN
    RAISE EXCEPTION 'While we bid, the rough schedule is the one to draw.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_draft -> 'bars') IS DISTINCT FROM 'array' OR jsonb_array_length(p_draft -> 'bars') = 0 THEN
    RAISE EXCEPTION 'A draft needs its bars.' USING ERRCODE = 'P0001';
  END IF;
  -- Every bar's id: a line's is its scope line's, the others' the kernel's.
  v_ids := ARRAY(
    SELECT CASE WHEN d.v ->> 'kind' = 'line' THEN nullif(d.v ->> 'scopeItemId', '')::uuid ELSE nullif(d.v ->> 'id', '')::uuid END
    FROM jsonb_array_elements(p_draft -> 'bars') AS d(v)
  );
  IF EXISTS (SELECT 1 FROM unnest(v_ids) AS i(id) WHERE i.id IS NULL) THEN
    RAISE EXCEPTION 'Each bar in the draft needs its id.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_draft -> 'bars') AS d(v)
    WHERE coalesce(d.v ->> 'kind', '') NOT IN ('line', 'inspection', 'added')
       OR (d.v ->> 'kind' <> 'line' AND btrim(coalesce(d.v ->> 'label', '')) = '')
       OR (d.v ->> 'kind' = 'added' AND btrim(coalesce(d.v ->> 'who', '')) = '')
  ) THEN
    RAISE EXCEPTION 'Each inspection and each of the job''s own bars needs its name.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_draft -> 'bars') AS d(v)
    WHERE nullif(d.v ->> 'start', '') IS NULL OR nullif(d.v ->> 'finish', '') IS NULL
  ) THEN
    RAISE EXCEPTION 'It needs a start and a finish.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_draft -> 'bars') AS d(v) WHERE (d.v ->> 'finish')::date < (d.v ->> 'start')::date) THEN
    RAISE EXCEPTION 'It has to finish on or after it starts.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_draft -> 'bars') AS d(v)
    WHERE char_length(regexp_replace(btrim(coalesce(d.v ->> 'place', '')), '\s+', ' ', 'g')) > 40
  ) THEN
    RAISE EXCEPTION 'A place is 40 characters at most.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_draft -> 'bars') AS d(v), jsonb_array_elements(coalesce(d.v -> 'after', '[]'::jsonb)) AS w(v)
    WHERE NOT coalesce(nullif(w.v ->> 'id', '')::uuid = ANY (v_ids), false)
  ) THEN
    RAISE EXCEPTION 'A wait names a bar that is not on this schedule.' USING ERRCODE = 'P0001';
  END IF;
  IF v_template IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.gc_schedule_templates WHERE id = v_template) THEN
    RAISE EXCEPTION 'That template is gone. Draw without it, or pick another.' USING ERRCODE = 'P0001';
  END IF;

  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);

  IF p_version IS NOT NULL THEN
    -- In place of a schedule drawn before: never once the job started, was walked, or has moves or a baseline.
    IF v_stage IN ('building', 'closed') THEN
      RAISE EXCEPTION 'This job started. A new set of plans is the way to change its schedule now.' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.gc_schedule_walks WHERE project_id = p_project_id) THEN
      RAISE EXCEPTION 'The schedule was walked. Its record stays as it is.' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.gc_schedule_moves WHERE project_id = p_project_id)
       OR EXISTS (SELECT 1 FROM public.gc_schedule_baselines WHERE project_id = p_project_id) THEN
      RAISE EXCEPTION 'The schedule has moves with their reasons. They stay as they are.' USING ERRCODE = 'P0001';
    END IF;
    DELETE FROM public.gc_schedule_activities WHERE project_id = p_project_id;
    DELETE FROM public.gc_schedule_milestones WHERE project_id = p_project_id;
    UPDATE public.gc_schedules SET drafted_on = public.app_today(), drafted_by = auth.uid() WHERE project_id = p_project_id;
  END IF;

  -- The template it came from (G-44), by its name that day.
  UPDATE public.gc_schedules
     SET template_id = v_template,
         template_name = (SELECT t.name FROM public.gc_schedule_templates t WHERE t.id = v_template),
         template_used_on = CASE WHEN v_template IS NULL THEN NULL ELSE public.app_today() END
   WHERE project_id = p_project_id;

  FOR v_bar_in IN SELECT value FROM jsonb_array_elements(p_draft -> 'bars') LOOP
    v_kind := v_bar_in ->> 'kind';
    IF v_kind = 'line' THEN
      v_id := (v_bar_in ->> 'scopeItemId')::uuid;
      IF NOT EXISTS (
        SELECT 1 FROM public.gc_scope_items s JOIN public.gc_trade_packages k ON k.id = s.package_id
        WHERE s.id = v_id AND k.id = nullif(v_bar_in ->> 'packageId', '')::uuid AND k.project_id = p_project_id
      ) THEN
        RAISE EXCEPTION 'A line in the draft is not on this job.' USING ERRCODE = 'P0001';
      END IF;
    ELSE
      v_id := (v_bar_in ->> 'id')::uuid;
    END IF;
    INSERT INTO public.gc_schedule_activities (
      id, project_id, kind, position, scope_item_id, package_id, start, finish, not_before, must_finish_by, place, label, who
    ) VALUES (
      v_id, p_project_id, v_kind, v_i,
      CASE WHEN v_kind = 'line' THEN v_id END,
      CASE WHEN v_kind = 'line' THEN (v_bar_in ->> 'packageId')::uuid END,
      (v_bar_in ->> 'start')::date, (v_bar_in ->> 'finish')::date,
      nullif(v_bar_in ->> 'notBefore', '')::date, nullif(v_bar_in ->> 'mustFinishBy', '')::date,
      nullif(regexp_replace(btrim(coalesce(v_bar_in ->> 'place', '')), '\s+', ' ', 'g'), ''),
      CASE WHEN v_kind <> 'line' THEN btrim(v_bar_in ->> 'label') END,
      CASE WHEN v_kind = 'added' THEN btrim(v_bar_in ->> 'who') END
    );
    v_i := v_i + 1;
  END LOOP;

  -- What each waits on, then a split line's parts, once every bar is in.
  FOR v_bar_in IN SELECT value FROM jsonb_array_elements(p_draft -> 'bars') LOOP
    v_id := CASE WHEN v_bar_in ->> 'kind' = 'line' THEN (v_bar_in ->> 'scopeItemId')::uuid ELSE (v_bar_in ->> 'id')::uuid END;
    FOR v_wait_in IN SELECT value FROM jsonb_array_elements(coalesce(v_bar_in -> 'after', '[]'::jsonb)) LOOP
      IF (v_wait_in ->> 'id')::uuid = v_id THEN
        RAISE EXCEPTION 'A bar cannot wait on itself.' USING ERRCODE = 'P0001';
      END IF;
      INSERT INTO public.gc_schedule_links (project_id, from_activity_id, to_activity_id, gap)
      VALUES (p_project_id, (v_wait_in ->> 'id')::uuid, v_id, coalesce((v_wait_in ->> 'gap')::integer, 0))
      ON CONFLICT (from_activity_id, to_activity_id) DO NOTHING;
    END LOOP;
    v_j := 0;
    FOR v_part_in IN SELECT value FROM jsonb_array_elements(coalesce(v_bar_in -> 'parts', '[]'::jsonb)) LOOP
      INSERT INTO public.gc_schedule_activity_parts (id, activity_id, position, name, from_day, days, share, pct)
      VALUES (
        coalesce(nullif(v_part_in ->> 'id', '')::uuid, gen_random_uuid()), v_id, v_j, btrim(v_part_in ->> 'name'),
        (v_part_in ->> 'fromDay')::integer, (v_part_in ->> 'days')::integer, (v_part_in ->> 'share')::numeric,
        coalesce((v_part_in ->> 'pct')::numeric, 0)
      );
      v_j := v_j + 1;
    END LOOP;
  END LOOP;

  -- The dates to meet: dry-in, the rough-in inspection, substantial completion, and theirs from a file.
  v_j := 0;
  FOR v_ms_in IN SELECT value FROM jsonb_array_elements(coalesce(p_draft -> 'milestones', '[]'::jsonb)) LOOP
    IF nullif(v_ms_in ->> 'packageId', '') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.gc_trade_packages WHERE id = (v_ms_in ->> 'packageId')::uuid AND project_id = p_project_id
    ) THEN
      RAISE EXCEPTION 'That trade is not on this project.' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.gc_schedule_milestones (id, project_id, label, planned, package_id, met_on, position)
    VALUES (
      coalesce(nullif(v_ms_in ->> 'id', '')::uuid, gen_random_uuid()), p_project_id, btrim(v_ms_in ->> 'label'),
      (v_ms_in ->> 'planned')::date, nullif(v_ms_in ->> 'packageId', '')::uuid, nullif(v_ms_in ->> 'metOn', '')::date, v_j
    );
    v_j := v_j + 1;
  END LOOP;

  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- A move with why (the owner, 2026-10-05): a drag, an end pulled, the editor, a part's own move (G-39),
-- a pull when work finished early (G-37), days got back (G-82), a late notice taken (G-117) or a
-- change order's days (G-76). The move's kind is in its own columns. Its bars and its record agree:
-- every bar the change dates is the moved bar at its new days, or one it pushed at its new days, and
-- every bar it pushed is dated, so Undo and Redo put back exactly this.
CREATE OR REPLACE FUNCTION public.gc_schedule_move(p_project_id uuid, p_version integer, p_words text, p_move jsonb, p_bars jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
BEGIN
  PERFORM public.gc_schedule_check_why(p_move ->> 'reason', p_move ->> 'note');
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p_bars, '[]'::jsonb)) AS b(v) WHERE b.v ->> 'id' = p_move ->> 'activityId')
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(coalesce(p_bars, '[]'::jsonb)) AS b(v)
       WHERE NOT (
         (b.v ->> 'id' = p_move ->> 'activityId' AND b.v ->> 'start' = p_move #>> '{to,start}' AND b.v ->> 'finish' = p_move #>> '{to,finish}')
         OR EXISTS (
           SELECT 1 FROM jsonb_array_elements(coalesce(p_move -> 'pushed', '[]'::jsonb)) AS x(v)
           WHERE x.v ->> 'activityId' = b.v ->> 'id' AND x.v #>> '{to,start}' = b.v ->> 'start' AND x.v #>> '{to,finish}' = b.v ->> 'finish'
         )
       )
     )
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(coalesce(p_move -> 'pushed', '[]'::jsonb)) AS x(v)
       WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p_bars, '[]'::jsonb)) AS b(v) WHERE b.v ->> 'id' = x.v ->> 'activityId')
     ) THEN
    RAISE EXCEPTION 'The move and its bars do not agree. Reload the schedule and try again.' USING ERRCODE = 'P0001';
  END IF;
  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);
  PERFORM public.gc_schedule_keep_start(p_project_id);
  PERFORM public.gc_schedule_set_bars(p_project_id, p_bars);
  PERFORM public.gc_schedule_save_move(p_project_id, v_version, p_move, now());
  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- Undo (G-40): the newest move still standing, put back where it found every bar it touched, while
-- each still sits where the move left it (undoableMove). A move that changed what its bar waits on is
-- put back by hand. The move stays on the record, undone today by this person.
CREATE OR REPLACE FUNCTION public.gc_schedule_undo(p_project_id uuid, p_version integer, p_move_id uuid, p_words text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
  v_move public.gc_schedule_moves;
BEGIN
  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);
  SELECT * INTO v_move FROM public.gc_schedule_moves WHERE id = p_move_id AND project_id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That move is not on this schedule.' USING ERRCODE = 'P0001';
  END IF;
  IF v_move.undone_on IS NOT NULL THEN
    RAISE EXCEPTION 'That move was undone already.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_schedule_moves o WHERE o.project_id = p_project_id AND o.undone_on IS NULL
               AND (o.schedule_version, o.made_at) > (v_move.schedule_version, v_move.made_at)) THEN
    RAISE EXCEPTION 'Only the newest move can be undone.' USING ERRCODE = 'P0001';
  END IF;
  IF v_move.links_changed OR NOT public.gc_schedule_move_sits(v_move.id, false) THEN
    RAISE EXCEPTION 'A bar this move touched has changed since. Move it back by hand, with its own reason.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.gc_schedule_keep_start(p_project_id);
  PERFORM public.gc_schedule_put_move(v_move.id, true);
  UPDATE public.gc_schedule_moves SET undone_on = public.app_today(), undone_by = auth.uid() WHERE id = v_move.id;
  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- Redo (G-40): the newest undone move put forward again, while no move made after it stands and every
-- bar it touched still sits where the undo left it (redoableMove). It stands again.
CREATE OR REPLACE FUNCTION public.gc_schedule_redo(p_project_id uuid, p_version integer, p_move_id uuid, p_words text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
  v_move public.gc_schedule_moves;
BEGIN
  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);
  SELECT * INTO v_move FROM public.gc_schedule_moves WHERE id = p_move_id AND project_id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That move is not on this schedule.' USING ERRCODE = 'P0001';
  END IF;
  IF v_move.undone_on IS NULL THEN
    RAISE EXCEPTION 'That move stands already.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_schedule_moves o WHERE o.project_id = p_project_id
               AND (o.schedule_version, o.made_at) > (v_move.schedule_version, v_move.made_at)) THEN
    RAISE EXCEPTION 'Only the newest move can be put back.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.gc_schedule_move_sits(v_move.id, true) THEN
    RAISE EXCEPTION 'A bar this move touched has changed since. Move it again by hand, with its own reason.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.gc_schedule_keep_start(p_project_id);
  PERFORM public.gc_schedule_put_move(v_move.id, false);
  UPDATE public.gc_schedule_moves SET undone_on = NULL, undone_by = NULL WHERE id = v_move.id;
  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- Keep (G-81, decision 6): the person's own what-if copy's standing moves, oldest first, as real moves
-- with their reasons, kept from a copy made that day; the real bars take the copy's plan; then the copy
-- goes. One version for the press, each move a microsecond after the one before, so Undo takes the
-- newest first. Whether the copy's base still holds is the kernel's (whatIfBaseChanges): the version
-- says the real schedule is still the one it read.
CREATE OR REPLACE FUNCTION public.gc_schedule_keep_what_if(p_project_id uuid, p_version integer, p_words text, p_moves jsonb, p_bars jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
  v_made_on date;
  v_move_in jsonb;
  v_i integer := 0;
BEGIN
  IF jsonb_typeof(p_moves) IS DISTINCT FROM 'array' OR jsonb_array_length(p_moves) = 0 THEN
    RAISE EXCEPTION 'Nothing was tried in the what-if.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_moves) AS mv(v)
    WHERE coalesce(btrim(mv.v ->> 'reason'), '') NOT IN ('weather', 'trade before', 'materials', 'crew', 'customer', 'plans', 'inspection', 'us', 'change order', 'other', 'early', 'recovery')
       OR char_length(btrim(coalesce(mv.v ->> 'note', ''))) < 8
  ) THEN
    RAISE EXCEPTION 'Give each move a reason and a sentence.' USING ERRCODE = 'P0001';
  END IF;
  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);
  SELECT made_on INTO v_made_on FROM public.gc_schedule_what_ifs WHERE project_id = p_project_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'There is no what-if open.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.gc_schedule_keep_start(p_project_id);
  PERFORM public.gc_schedule_set_bars(p_project_id, p_bars);
  FOR v_move_in IN SELECT value FROM jsonb_array_elements(p_moves) LOOP
    PERFORM public.gc_schedule_save_move(p_project_id, v_version, v_move_in || jsonb_build_object('fromWhatIfOn', v_made_on), now() + interval '1 microsecond' * v_i);
    v_i := v_i + 1;
  END LOOP;
  DELETE FROM public.gc_schedule_what_ifs WHERE project_id = p_project_id AND user_id = auth.uid();
  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- A new baseline after a signed change order (G-41): the plan as it stands, named, with why. The one
-- it retires stays, named. Only once the plan at Start is kept (withNewBaseline).
CREATE OR REPLACE FUNCTION public.gc_schedule_baseline(p_project_id uuid, p_version integer, p_name text, p_why text, p_words text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
  v_baseline uuid;
BEGIN
  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Give the new baseline a name.' USING ERRCODE = 'P0001';
  END IF;
  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);
  IF NOT EXISTS (SELECT 1 FROM public.gc_schedule_baselines WHERE project_id = p_project_id) THEN
    RAISE EXCEPTION 'The plan at Start is not kept yet. The first change after Start keeps it.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.gc_schedule_baselines (project_id, name, locked_on, locked_by, why)
  VALUES (p_project_id, btrim(p_name), public.app_today(), auth.uid(), nullif(btrim(coalesce(p_why, '')), ''))
  RETURNING id INTO v_baseline;
  INSERT INTO public.gc_schedule_baseline_dates (baseline_id, activity_id, start, finish)
  SELECT v_baseline, a.id, a.start, a.finish FROM public.gc_schedule_activities a WHERE a.project_id = p_project_id;
  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- A trade's line split into parts (G-39), each with its name, its first day and its days from the
-- line's start, its share from its days and the line's percent to start from (splitParts). The first
-- part starts and the last ends with the line, which keeps its dates.
CREATE OR REPLACE FUNCTION public.gc_schedule_split(p_project_id uuid, p_version integer, p_activity_id uuid, p_parts jsonb, p_words text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
  v_bar public.gc_schedule_activities;
  v_part_in jsonb;
  v_i integer := 0;
BEGIN
  IF jsonb_typeof(p_parts) IS DISTINCT FROM 'array' OR jsonb_array_length(p_parts) < 2 THEN
    RAISE EXCEPTION 'Split it into two parts or more.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_parts) AS pt(v) WHERE btrim(coalesce(pt.v ->> 'name', '')) = '') THEN
    RAISE EXCEPTION 'Give each part a name.' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(DISTINCT lower(btrim(pt.v ->> 'name'))) FROM jsonb_array_elements(p_parts) AS pt(v)) <> jsonb_array_length(p_parts) THEN
    RAISE EXCEPTION 'Give each part its own name.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_parts) AS pt(v)
    WHERE coalesce((pt.v ->> 'fromDay')::integer, -1) < 0 OR coalesce((pt.v ->> 'days')::integer, 0) < 1
  ) THEN
    RAISE EXCEPTION 'Each part has to finish on or after it starts.' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT sum(coalesce((pt.v ->> 'share')::numeric, 0)) FROM jsonb_array_elements(p_parts) AS pt(v)) <> 100 THEN
    RAISE EXCEPTION 'The parts'' shares have to add up to 100.' USING ERRCODE = 'P0001';
  END IF;
  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);
  SELECT * INTO v_bar FROM public.gc_schedule_activities WHERE project_id = p_project_id AND id = p_activity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A bar in this change is not on this schedule. Reload the schedule and try again.' USING ERRCODE = 'P0001';
  END IF;
  IF v_bar.kind <> 'line' THEN
    RAISE EXCEPTION 'Only a trade''s line splits into parts.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_schedule_activity_parts WHERE activity_id = p_activity_id) THEN
    RAISE EXCEPTION 'It is split already. Make it one bar first.' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT min((pt.v ->> 'fromDay')::integer) FROM jsonb_array_elements(p_parts) AS pt(v)) <> 0
     OR (SELECT max((pt.v ->> 'fromDay')::integer + (pt.v ->> 'days')::integer) FROM jsonb_array_elements(p_parts) AS pt(v)) <> v_bar.finish - v_bar.start + 1 THEN
    RAISE EXCEPTION 'The first part starts % and the last ends %, as the line does. Move a part after the split to change that.',
      to_char(v_bar.start, 'Dy Mon FMDD'), to_char(v_bar.finish, 'Dy Mon FMDD') USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.gc_schedule_keep_start(p_project_id);
  FOR v_part_in IN SELECT value FROM jsonb_array_elements(p_parts) LOOP
    INSERT INTO public.gc_schedule_activity_parts (id, activity_id, position, name, from_day, days, share, pct)
    VALUES (
      coalesce(nullif(v_part_in ->> 'id', '')::uuid, gen_random_uuid()), p_activity_id, v_i, btrim(v_part_in ->> 'name'),
      (v_part_in ->> 'fromDay')::integer, (v_part_in ->> 'days')::integer, (v_part_in ->> 'share')::numeric,
      coalesce((v_part_in ->> 'pct')::numeric, 0)
    );
    v_i := v_i + 1;
  END LOOP;
  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- A split line made one bar again (G-39): its parts go, its dates stay.
CREATE OR REPLACE FUNCTION public.gc_schedule_join(p_project_id uuid, p_version integer, p_activity_id uuid, p_words text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
BEGIN
  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);
  IF NOT EXISTS (SELECT 1 FROM public.gc_schedule_activities WHERE project_id = p_project_id AND id = p_activity_id) THEN
    RAISE EXCEPTION 'A bar in this change is not on this schedule. Reload the schedule and try again.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gc_schedule_activity_parts WHERE activity_id = p_activity_id) THEN
    RAISE EXCEPTION 'It is one bar already.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.gc_schedule_keep_start(p_project_id);
  DELETE FROM public.gc_schedule_activity_parts WHERE activity_id = p_activity_id;
  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- The job's own work on the chart (G-38): mobilize, cure time, the customer's own work. Its name and
-- whose it is, its days, what it waits on, the bars that wait on it from now on, and what that pushes
-- (addedActivityProblem's words, in its order).
CREATE OR REPLACE FUNCTION public.gc_schedule_add_activity(p_project_id uuid, p_version integer, p_bar jsonb, p_holds_up uuid[], p_bars jsonb, p_words text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
  v_id uuid := coalesce(nullif(p_bar ->> 'id', '')::uuid, gen_random_uuid());
  v_label text := btrim(coalesce(p_bar ->> 'label', ''));
  v_who text := btrim(coalesce(p_bar ->> 'who', ''));
  v_start date := nullif(p_bar ->> 'start', '')::date;
  v_finish date := nullif(p_bar ->> 'finish', '')::date;
  v_after uuid[] := ARRAY(SELECT nullif(w.v ->> 'id', '')::uuid FROM jsonb_array_elements(coalesce(p_bar -> 'after', '[]'::jsonb)) AS w(v));
  v_holds uuid[] := coalesce(p_holds_up, '{}');
  v_wait_in jsonb;
BEGIN
  IF v_label = '' THEN
    RAISE EXCEPTION 'Give it a name.' USING ERRCODE = 'P0001';
  END IF;
  IF v_who = '' THEN
    RAISE EXCEPTION 'Say whose it is.' USING ERRCODE = 'P0001';
  END IF;
  IF v_start IS NULL OR v_finish IS NULL THEN
    RAISE EXCEPTION 'It needs a start and a finish.' USING ERRCODE = 'P0001';
  END IF;
  IF v_finish < v_start THEN
    RAISE EXCEPTION 'It has to finish on or after it starts.' USING ERRCODE = 'P0001';
  END IF;
  IF v_holds && v_after THEN
    RAISE EXCEPTION 'A bar cannot both come before it and wait on it.' USING ERRCODE = 'P0001';
  END IF;
  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);
  IF EXISTS (
    SELECT 1 FROM unnest(v_after || v_holds) AS f(id)
    WHERE f.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.gc_schedule_activities a WHERE a.project_id = p_project_id AND a.id = f.id)
  ) THEN
    RAISE EXCEPTION 'A wait names a bar that is not on this schedule.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.gc_schedule_keep_start(p_project_id);
  INSERT INTO public.gc_schedule_activities (id, project_id, kind, position, start, finish, label, who)
  VALUES (v_id, p_project_id, 'added',
          (SELECT coalesce(max(a.position), -1) + 1 FROM public.gc_schedule_activities a WHERE a.project_id = p_project_id),
          v_start, v_finish, v_label, v_who);
  FOR v_wait_in IN SELECT value FROM jsonb_array_elements(coalesce(p_bar -> 'after', '[]'::jsonb)) LOOP
    INSERT INTO public.gc_schedule_links (project_id, from_activity_id, to_activity_id, gap)
    VALUES (p_project_id, (v_wait_in ->> 'id')::uuid, v_id, coalesce((v_wait_in ->> 'gap')::integer, 0))
    ON CONFLICT (from_activity_id, to_activity_id) DO NOTHING;
  END LOOP;
  INSERT INTO public.gc_schedule_links (project_id, from_activity_id, to_activity_id, gap)
  SELECT p_project_id, v_id, h.id, 0 FROM unnest(v_holds) AS h(id)
  ON CONFLICT (from_activity_id, to_activity_id) DO NOTHING;
  PERFORM public.gc_schedule_set_bars(p_project_id, p_bars);
  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- The job's own work taken off the chart (G-38). Only that comes off: a trade's line and an inspection
-- stay. Whatever waited on it stops waiting (its links go with it), and the moves keep its name.
CREATE OR REPLACE FUNCTION public.gc_schedule_remove_activity(p_project_id uuid, p_version integer, p_activity_id uuid, p_words text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
  v_kind text;
BEGIN
  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);
  SELECT kind INTO v_kind FROM public.gc_schedule_activities WHERE project_id = p_project_id AND id = p_activity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A bar in this change is not on this schedule. Reload the schedule and try again.' USING ERRCODE = 'P0001';
  END IF;
  IF v_kind <> 'added' THEN
    RAISE EXCEPTION 'Only the job''s own work comes off. A trade''s line and an inspection stay.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.gc_schedule_keep_start(p_project_id);
  DELETE FROM public.gc_schedule_activities WHERE id = p_activity_id;
  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- An inspection that did not pass (failInspection), on a job being built: the day, what failed, whose
-- work it was, and the day it is looked at again. The inspection moves to that day with its days kept,
-- and what waits on it moves out, as the kernel worked it out (pushSchedule).
CREATE OR REPLACE FUNCTION public.gc_schedule_fail_inspection(p_project_id uuid, p_version integer, p_activity_id uuid, p_failure jsonb, p_bars jsonb, p_words text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
  v_bar public.gc_schedule_activities;
  v_note text := regexp_replace(btrim(coalesce(p_failure ->> 'note', '')), '\s+', ' ', 'g');
  v_again date := nullif(p_failure ->> 'reinspectOn', '')::date;
BEGIN
  IF v_note = '' THEN
    RAISE EXCEPTION 'Say what failed.' USING ERRCODE = 'P0001';
  END IF;
  IF v_again IS NULL OR v_again <= public.app_today() THEN
    RAISE EXCEPTION 'Pick a day after today for the re-inspection.' USING ERRCODE = 'P0001';
  END IF;
  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);
  IF NOT EXISTS (SELECT 1 FROM public.gc_projects WHERE project_id = p_project_id AND stage = 'building') THEN
    RAISE EXCEPTION 'Inspections are recorded on a job being built.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_bar FROM public.gc_schedule_activities WHERE project_id = p_project_id AND id = p_activity_id;
  IF NOT FOUND OR v_bar.kind <> 'inspection' THEN
    RAISE EXCEPTION 'Only an inspection passes or fails.' USING ERRCODE = 'P0001';
  END IF;
  IF v_bar.passed_on IS NOT NULL THEN
    RAISE EXCEPTION 'This inspection passed already.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_bars, '[]'::jsonb)) AS b(v)
    WHERE nullif(b.v ->> 'id', '')::uuid = p_activity_id
      AND (b.v ->> 'start')::date = v_again
      AND (b.v ->> 'finish')::date = v_again + (v_bar.finish - v_bar.start)
  ) THEN
    RAISE EXCEPTION 'The inspection moves to its re-inspection day, its days kept.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.gc_schedule_keep_start(p_project_id);
  INSERT INTO public.gc_schedule_inspection_failures (activity_id, failed_on, note, package_ids, reinspect_on)
  VALUES (
    p_activity_id, public.app_today(), v_note,
    ARRAY(
      SELECT k.id FROM public.gc_trade_packages k
      WHERE k.project_id = p_project_id
        AND k.id IN (SELECT (x.v #>> '{}')::uuid FROM jsonb_array_elements(coalesce(p_failure -> 'packageIds', '[]'::jsonb)) AS x(v))
      ORDER BY k.position
    ),
    v_again
  );
  PERFORM public.gc_schedule_set_bars(p_project_id, p_bars);
  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- The records that touch several rows: no version (decision 9)
-- ---------------------------------------------------------------------------------------------

-- Where bars' work is (G-83, setActivityPlaces): each bar's place set or cleared, as the office keeps
-- it, refused whole when any of it is (placeChanges). A copy's bars read their places from these.
-- Returns how many changed.
CREATE OR REPLACE FUNCTION public.gc_schedule_set_places(p_project_id uuid, p_places jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_raw jsonb;
  v_place text;
  v_kind text;
  v_count integer := 0;
  v_n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_places) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Say which bars and where.' USING ERRCODE = 'P0001';
  END IF;
  FOR v_key, v_raw IN SELECT key, value FROM jsonb_each(p_places) LOOP
    SELECT kind INTO v_kind FROM public.gc_schedule_activities WHERE project_id = p_project_id AND id = v_key::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A bar in this change is not on this schedule. Reload the schedule and try again.' USING ERRCODE = 'P0001';
    END IF;
    IF v_kind <> 'line' THEN
      RAISE EXCEPTION 'An inspection and the job''s own work take no place.' USING ERRCODE = 'P0001';
    END IF;
    IF char_length(regexp_replace(btrim(coalesce(v_raw #>> '{}', '')), '\s+', ' ', 'g')) > 40 THEN
      RAISE EXCEPTION 'A place is 40 characters at most.' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  FOR v_key, v_raw IN SELECT key, value FROM jsonb_each(p_places) LOOP
    v_place := nullif(regexp_replace(btrim(coalesce(v_raw #>> '{}', '')), '\s+', ' ', 'g'), '');
    UPDATE public.gc_schedule_activities SET place = v_place
     WHERE project_id = p_project_id AND id = v_key::uuid AND place IS DISTINCT FROM v_place;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_count := v_count + v_n;
  END LOOP;
  RETURN v_count;
END;
$$;

-- An inspection passed (passInspection), on a job being built: today, and a date to meet of the same
-- name not met yet is met the same day. Returns that date's id, or null.
CREATE OR REPLACE FUNCTION public.gc_schedule_pass_inspection(p_project_id uuid, p_activity_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_bar public.gc_schedule_activities;
  v_met uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gc_projects WHERE project_id = p_project_id AND stage = 'building') THEN
    RAISE EXCEPTION 'Inspections are recorded on a job being built.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_bar FROM public.gc_schedule_activities WHERE project_id = p_project_id AND id = p_activity_id;
  IF NOT FOUND OR v_bar.kind <> 'inspection' THEN
    RAISE EXCEPTION 'Only an inspection passes or fails.' USING ERRCODE = 'P0001';
  END IF;
  IF v_bar.passed_on IS NOT NULL THEN
    RAISE EXCEPTION 'This inspection passed already.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_schedule_activities SET passed_on = public.app_today() WHERE id = p_activity_id;
  UPDATE public.gc_schedule_milestones SET met_on = public.app_today()
   WHERE id = (
     SELECT m.id FROM public.gc_schedule_milestones m
     WHERE m.project_id = p_project_id AND m.met_on IS NULL AND lower(btrim(m.label)) = lower(btrim(v_bar.label))
     ORDER BY m.position, m.created_at
     LIMIT 1
   )
  RETURNING id INTO v_met;
  RETURN v_met;
END;
$$;

-- Their dates to meet from a file (takeTheirDates, G-145), on a job being built with no what-if copy of
-- this person's open: one of ours takes their day (the kernel took the signed change orders' days off
-- substantial completion), and a new one comes in as the job's own, not met. Refused whole
-- (withTheirDates). Returns how many dates it took.
CREATE OR REPLACE FUNCTION public.gc_schedule_their_dates(p_project_id uuid, p_dates jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gc_projects WHERE project_id = p_project_id AND stage = 'building' AND lost_on IS NULL)
     OR NOT EXISTS (SELECT 1 FROM public.gc_schedules WHERE project_id = p_project_id) THEN
    RAISE EXCEPTION 'Their dates come in on a job being built.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_schedule_what_ifs WHERE project_id = p_project_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'A what-if copy is open. Keep it or throw it away first.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_dates) IS DISTINCT FROM 'array' OR jsonb_array_length(p_dates) = 0 THEN
    RAISE EXCEPTION 'Tick a date to take.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_dates) AS d(v)
    WHERE btrim(coalesce(d.v ->> 'label', '')) = '' OR nullif(d.v ->> 'planned', '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Each date needs a name and a day.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_dates) AS d(v)
    WHERE nullif(d.v ->> 'id', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.gc_schedule_milestones m
        WHERE m.id = (d.v ->> 'id')::uuid AND m.project_id = p_project_id AND m.met_on IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'One of our dates is met already, or not on this job.' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) <> count(DISTINCT d.v ->> 'id') FROM jsonb_array_elements(p_dates) AS d(v) WHERE nullif(d.v ->> 'id', '') IS NOT NULL) THEN
    RAISE EXCEPTION 'Two of their dates land on one of ours.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_schedule_milestones m
     SET planned = (d.v ->> 'planned')::date
    FROM jsonb_array_elements(p_dates) AS d(v)
   WHERE nullif(d.v ->> 'id', '') IS NOT NULL AND m.id = (d.v ->> 'id')::uuid AND m.project_id = p_project_id;
  INSERT INTO public.gc_schedule_milestones (project_id, label, planned, position)
  SELECT p_project_id, btrim(d.v ->> 'label'), (d.v ->> 'planned')::date,
         (SELECT coalesce(max(m.position), -1) FROM public.gc_schedule_milestones m WHERE m.project_id = p_project_id) + d.n::integer
    FROM jsonb_array_elements(p_dates) WITH ORDINALITY AS d(v, n)
   WHERE nullif(d.v ->> 'id', '') IS NULL;
  RETURN jsonb_array_length(p_dates);
END;
$$;

-- What the work waits on from outside the trades (addScheduleWait, G-73 to G-75), with the bars it
-- holds until it is in. An empty who reads as the kind's own. Returns the wait's id.
CREATE OR REPLACE FUNCTION public.gc_schedule_add_wait(p_project_id uuid, p_wait jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid := coalesce(nullif(p_wait ->> 'id', '')::uuid, gen_random_uuid());
  v_kind text := coalesce(p_wait ->> 'kind', '');
  v_title text := btrim(coalesce(p_wait ->> 'title', ''));
  v_pkg uuid := nullif(p_wait ->> 'packageId', '')::uuid;
  v_expected date := nullif(p_wait ->> 'expectedOn', '')::date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF v_kind NOT IN ('delivery', 'decision', 'permit', 'utility') THEN
    RAISE EXCEPTION 'Pick what the work waits on.' USING ERRCODE = 'P0001';
  END IF;
  IF v_title = '' THEN
    RAISE EXCEPTION 'Give it a name.' USING ERRCODE = 'P0001';
  END IF;
  IF v_expected IS NULL THEN
    RAISE EXCEPTION 'Say when it is expected.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gc_schedules WHERE project_id = p_project_id) THEN
    RAISE EXCEPTION 'This job has no schedule yet. Draw its first draft.' USING ERRCODE = 'P0001';
  END IF;
  IF v_pkg IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.gc_trade_packages WHERE id = v_pkg AND project_id = p_project_id) THEN
    RAISE EXCEPTION 'That trade is not on this project.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_wait -> 'activityIds', '[]'::jsonb)) AS h(v)
    WHERE NOT EXISTS (SELECT 1 FROM public.gc_schedule_activities a WHERE a.project_id = p_project_id AND a.id = nullif(h.v #>> '{}', '')::uuid)
  ) THEN
    RAISE EXCEPTION 'A wait names a bar that is not on this schedule.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.gc_schedule_waits (id, project_id, kind, title, package_id, who, asked_on, expected_on, note)
  VALUES (v_id, p_project_id, v_kind, v_title, v_pkg, btrim(coalesce(p_wait ->> 'who', '')),
          nullif(p_wait ->> 'askedOn', '')::date, v_expected, nullif(btrim(coalesce(p_wait ->> 'note', '')), ''));
  INSERT INTO public.gc_schedule_wait_holds (project_id, wait_id, activity_id)
  SELECT DISTINCT p_project_id, v_id, (h.v #>> '{}')::uuid FROM jsonb_array_elements(coalesce(p_wait -> 'activityIds', '[]'::jsonb)) AS h(v);
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- What each is, for the catalog, and who may call them
-- ---------------------------------------------------------------------------------------------

COMMENT ON FUNCTION public.gc_schedule_bump(uuid, integer, text) IS
  'GC mode (v2.NNNN): a plan write''s first step (decision 5): checks and bumps gc_schedules.version and keeps the press''s words in gc_schedule_changes, or refuses with "The schedule changed while you were working." and every change since as JSON in the DETAIL. A null version makes a first draft''s row at version 1. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_draft(uuid, integer, text, jsonb) IS
  'GC mode (v2.NNNN): the first draft, from the kernel or a template''s lines or a file (G-44, G-137), or one in place of a schedule drawn before Start that nobody walked or moved: its bars, waits, parts and dates to meet. A line''s bar takes its scope line''s id. Returns the new version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_move(uuid, integer, text, jsonb, jsonb) IS
  'GC mode (v2.NNNN): a move with why, of any kind (a drag, the editor, a part''s own move, a pull, days got back, a late notice taken, a change order''s days): the bars as the kernel left them and the move with what it pushed, which must agree. Keeps the plan at Start first. Returns the new version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_undo(uuid, integer, uuid, text) IS
  'GC mode (v2.NNNN): Undo (G-40): the newest standing move put back from its own record, while every bar it touched sits where it left them. Returns the new version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_redo(uuid, integer, uuid, text) IS
  'GC mode (v2.NNNN): Redo (G-40): the newest undone move put forward again from its own record, while no newer move stands. Returns the new version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_keep_what_if(uuid, integer, text, jsonb, jsonb) IS
  'GC mode (v2.NNNN): Keep (G-81): the person''s own what-if copy''s moves as real moves with their reasons, the bars as the copy left them, then the copy goes. One version for the press. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_baseline(uuid, integer, text, text, text) IS
  'GC mode (v2.NNNN): a new named baseline (G-41), the plan as it stands; the ones before stay. Returns the new version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_split(uuid, integer, uuid, jsonb, text) IS
  'GC mode (v2.NNNN): a trade''s line split into parts (G-39), the first starting and the last ending with it. Returns the new version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_join(uuid, integer, uuid, text) IS
  'GC mode (v2.NNNN): a split line made one bar again (G-39). Returns the new version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_add_activity(uuid, integer, jsonb, uuid[], jsonb, text) IS
  'GC mode (v2.NNNN): the job''s own work on the chart (G-38), with its waits, the bars that wait on it and what that pushes. Returns the new version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_remove_activity(uuid, integer, uuid, text) IS
  'GC mode (v2.NNNN): the job''s own work off the chart (G-38); a trade''s line and an inspection stay. Returns the new version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_fail_inspection(uuid, integer, uuid, jsonb, jsonb, text) IS
  'GC mode (v2.NNNN): an inspection that did not pass, on a job being built: the failure, the inspection at its re-inspection day and what that pushes. Returns the new version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_set_places(uuid, jsonb) IS
  'GC mode (v2.NNNN): where bars'' work is (G-83), set or cleared, refused whole. A record: no version. Returns how many changed. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_pass_inspection(uuid, uuid) IS
  'GC mode (v2.NNNN): an inspection passed today, and a date to meet of the same name met. A record: no version. Returns that date''s id or null. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_their_dates(uuid, jsonb) IS
  'GC mode (v2.NNNN): their dates to meet from a file (G-145), on a job being built, refused whole. A record: no version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_add_wait(uuid, jsonb) IS
  'GC mode (v2.NNNN): what the work waits on from outside the trades (G-73 to G-75), with the bars it holds. A record: no version. Returns its id. SECURITY INVOKER.';

-- The signed-in only; the tables' policies decide the rest (dev only until the schedule's PR 10). The
-- shared steps are callable too: alone, the guard refuses what they would write, and the version step
-- alone only bumps a version it was handed.
DO $$
DECLARE
  v_fn text;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.gc_schedule_bump(uuid, integer, text)',
    'public.gc_schedule_keep_start(uuid)',
    'public.gc_schedule_set_bars(uuid, jsonb)',
    'public.gc_schedule_check_why(text, text)',
    'public.gc_schedule_save_move(uuid, integer, jsonb, timestamptz)',
    'public.gc_schedule_move_sits(uuid, boolean)',
    'public.gc_schedule_put_move(uuid, boolean)',
    'public.gc_schedule_draft(uuid, integer, text, jsonb)',
    'public.gc_schedule_move(uuid, integer, text, jsonb, jsonb)',
    'public.gc_schedule_undo(uuid, integer, uuid, text)',
    'public.gc_schedule_redo(uuid, integer, uuid, text)',
    'public.gc_schedule_keep_what_if(uuid, integer, text, jsonb, jsonb)',
    'public.gc_schedule_baseline(uuid, integer, text, text, text)',
    'public.gc_schedule_split(uuid, integer, uuid, jsonb, text)',
    'public.gc_schedule_join(uuid, integer, uuid, text)',
    'public.gc_schedule_add_activity(uuid, integer, jsonb, uuid[], jsonb, text)',
    'public.gc_schedule_remove_activity(uuid, integer, uuid, text)',
    'public.gc_schedule_fail_inspection(uuid, integer, uuid, jsonb, jsonb, text)',
    'public.gc_schedule_set_places(uuid, jsonb)',
    'public.gc_schedule_pass_inspection(uuid, uuid)',
    'public.gc_schedule_their_dates(uuid, jsonb)',
    'public.gc_schedule_add_wait(uuid, jsonb)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_fn);
  END LOOP;
  REVOKE ALL ON FUNCTION public.gc_schedule_plan_guard() FROM PUBLIC, anon, authenticated;
END $$;
```

## The SQL tests

The repo's whole-schema beds (`scripts/pgtest-*.sh`) start the Supabase Postgres image in Docker,
apply every file in `supabase/migrations` in order, and run a scenario that raises on its first
failed check. PR 5 adds one more, the same way as `pgtest-bid-changes.sh`.

**`scripts/pgtest-gc-schedule.sh`**, run as `npm run test:pg:gc-schedule`:

```bash
#!/usr/bin/env bash
# Runs supabase/tests/gc_schedule against a throwaway copy of the WHOLE schema (v2.NNNN, the schedule's PR 5).
#
#   npm run test:pg:gc-schedule
#
# The same bed as scripts/pgtest-bid-changes.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). The schedule's writes are then applied a
# second time, which must change nothing. The scenario draws, moves, undoes, splits and keeps as a dev
# through RLS, inside one transaction that rolls back: two presses on one version, the refusals in the
# kernels' words, the plan at Start, the records that touch several rows, and the guard. It raises on
# its first failed assertion and ends with "gc_schedule PASSED". PGTEST_KEEP=1 leaves the container
# up. Needs docker; .github/workflows/sql-beds.yml runs it on a PR that touches the schedule's SQL.
# Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55443}"
NAME="pgtest-gc-schedule"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_gc_schedule_writes.sql)"

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" "$IMAGE" >/dev/null
[ -n "${PGTEST_KEEP:-}" ] || trap 'docker rm -f "$NAME" >/dev/null 2>&1' EXIT
for _ in $(seq 1 90); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
sleep 5
psql_as() { local user="$1"; shift; docker exec -i -e PGPASSWORD=pg "$NAME" psql -U "$user" -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_as supabase_admin -f - < supabase/tests/combined_copies/00_prod_extras.sql >/dev/null
for f in supabase/migrations/*.sql; do
  psql_as postgres -f - < "$f" >/dev/null 2>"/tmp/$NAME.err" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "/tmp/$NAME.err" | head -20; exit 1; }
done
# A second run must change nothing: every function is replaced as it was, and the guard's DO block
# makes no second trigger.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"/tmp/$NAME.err" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "/tmp/$NAME.err" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/gc_schedule/20_scenario.sql 2>&1 || true)"
if ! grep -q "gc_schedule PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "gc-schedule bed ok"
```

**`.github/workflows/sql-beds.yml`**, a workflow of its own, so `check:workflow-parity` (which holds
`ci.yml`'s and `deploy.yml`'s `checks` jobs equal) is not touched. It is not a required check, so PR
5 is armed only once it is green (*When it is cut*, step 6):

```yaml
name: SQL beds

# The whole-schema SQL beds (scripts/pgtest-*.sh) need Docker, and no session on the office Mac can
# reach it. GitHub's runners have it. A PR that touches the schedule's SQL runs its bed here before
# the lead pushes the migration (the schedule's PR 5).
on:
  pull_request:
    paths:
      - 'supabase/migrations/*gc_schedule*'
      - 'supabase/tests/gc_schedule/**'
      - 'scripts/pgtest-gc-schedule.sh'
      - '.github/workflows/sql-beds.yml'
  workflow_dispatch:

jobs:
  gc-schedule:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: The schedule's writes against every migration
        run: bash scripts/pgtest-gc-schedule.sh
```

**`supabase/tests/gc_schedule/20_scenario.sql`**: two jobs made as postgres, every press made as a dev
through RLS, and checks read in statements of their own. A statement never sees what a function it
calls wrote, so each check comes after its press.

```sql
-- The schedule's writes (v2.NNNN, the schedule's PR 5): every plan write checks and bumps the
-- version, refuses a stale one with every change since, refuses a move with no reason and a finish
-- before its start, keeps the plan at Start first, and writes all of a press or none of it; the
-- records that touch several rows; and the guard that keeps the plan's rows for the plan writes.
-- Presses run as a dev through RLS, one job's fixture made as postgres; everything runs inside one
-- transaction that rolls back. Raises on the first failed assertion; ends with
-- "gc_schedule PASSED". See scripts/pgtest-gc-schedule.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Who: a dev, a dev in training mode, and an estimator (no policy on the schedule's tables yet).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000005d1', 'dev@schedule.test'),
  ('00000000-0000-0000-0000-0000000005d2', 'trainee@schedule.test'),
  ('00000000-0000-0000-0000-0000000005d3', 'estimator@schedule.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000005d1', 'dev@schedule.test', 'Schedule Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000005d2', 'trainee@schedule.test', 'Schedule Trainee', 'dev'),
  ('00000000-0000-0000-0000-0000000005d3', 'estimator@schedule.test', 'Schedule Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000005d2';

-- Two GC jobs in buyout: P with Electrical (rough-in, trim) and Plumbing (rough-in), Q with Electrical.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000005c1', 'Schedule Test Owner', '00000000-0000-0000-0000-0000000005d1');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000005a1', 'Schedule test P', '00000000-0000-0000-0000-0000000005c1'),
  ('00000000-0000-0000-0000-0000000005a2', 'Schedule test Q', '00000000-0000-0000-0000-0000000005c1');
INSERT INTO public.gc_projects (project_id, stage) VALUES
  ('00000000-0000-0000-0000-0000000005a1', 'buyout'),
  ('00000000-0000-0000-0000-0000000005a2', 'buyout');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position) VALUES
  ('00000000-0000-0000-0000-0000000005b1', '00000000-0000-0000-0000-0000000005a1', 'Electrical', 0),
  ('00000000-0000-0000-0000-0000000005b2', '00000000-0000-0000-0000-0000000005a1', 'Plumbing', 1),
  ('00000000-0000-0000-0000-0000000005b3', '00000000-0000-0000-0000-0000000005a2', 'Electrical', 0);
INSERT INTO public.gc_scope_items (id, package_id, position, label) VALUES
  ('00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-0000000005b1', 0, 'Rough-in'),
  ('00000000-0000-0000-0000-0000000005e2', '00000000-0000-0000-0000-0000000005b1', 1, 'Trim'),
  ('00000000-0000-0000-0000-0000000005e3', '00000000-0000-0000-0000-0000000005b2', 0, 'Rough-in'),
  ('00000000-0000-0000-0000-0000000005e4', '00000000-0000-0000-0000-0000000005b3', 0, 'Service');

CREATE SCHEMA gst;
CREATE FUNCTION gst.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`; with `detail_has`, a DETAIL that holds it too.
-- The statement's own writes go with the refusal (a subtransaction), as a refused press's do.
CREATE FUNCTION gst.refused(label text, stmt text, want text, detail_has text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_detail text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    IF detail_has IS NOT NULL AND position(detail_has IN coalesce(v_detail, '')) = 0 THEN
      RAISE EXCEPTION '% was refused without % in its detail: %', label, detail_has, v_detail;
    END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- Sign in as someone (the claims auth.uid() reads).
CREATE FUNCTION gst.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- What the job's bars read: each bar's name or line id, its days, one line each.
CREATE FUNCTION gst.bars(p_project uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(coalesce(a.label, right(a.id::text, 3)) || ' ' || a.start || '..' || a.finish, E'\n' ORDER BY a.position)
  FROM public.gc_schedule_activities a WHERE a.project_id = p_project $$;
CREATE FUNCTION gst.version(p_project uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT version::text FROM public.gc_schedules WHERE project_id = p_project $$;
GRANT USAGE ON SCHEMA gst TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gst TO authenticated;
-- What a press returned, for the steps after it: a statement never sees what a function it calls
-- wrote, so each check reads in a statement of its own.
CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON ids TO authenticated;

-- Our template, as Save as a template keeps it (a plain insert, decision 9), for the draw on Q.
INSERT INTO public.gc_schedule_templates (id, name, from_name, from_done_pct, saved_on, saved_by, lines, stages, weeks) VALUES (
  '00000000-0000-0000-0000-000000000591', 'Schedule test shape', 'Schedule test P', 40, DATE '2026-10-07', '00000000-0000-0000-0000-0000000005d1',
  '[{"trade": "Electrical", "label": "Service", "stage": "roughIn", "days": 5, "after": [], "offset": 0}]', '[]', 2);

SELECT gst.as_user('00000000-0000-0000-0000-0000000005d1');
SET LOCAL ROLE authenticated;

-- 1 · The first draft of P: five bars, their waits, two dates to meet, at version 1, with its words.
SELECT gst.same('the first draft makes version 1', public.gc_schedule_draft('00000000-0000-0000-0000-0000000005a1', NULL,
  'Drew a first draft of the schedule on Schedule test P: 5 activities from Mon Nov 2.',
  $j${"bars": [
    {"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000005e1", "packageId": "00000000-0000-0000-0000-0000000005b1", "start": "2026-11-02", "finish": "2026-11-13", "after": []},
    {"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000005e3", "packageId": "00000000-0000-0000-0000-0000000005b2", "start": "2026-11-02", "finish": "2026-11-13", "after": []},
    {"kind": "inspection", "id": "00000000-0000-0000-0000-0000000005f1", "label": "Rough-in inspection", "start": "2026-11-16", "finish": "2026-11-17",
     "after": [{"id": "00000000-0000-0000-0000-0000000005e1", "gap": 0}, {"id": "00000000-0000-0000-0000-0000000005e3", "gap": 0}]},
    {"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000005e2", "packageId": "00000000-0000-0000-0000-0000000005b1", "start": "2026-11-18", "finish": "2026-11-24",
     "after": [{"id": "00000000-0000-0000-0000-0000000005f1", "gap": 0}]},
    {"kind": "inspection", "id": "00000000-0000-0000-0000-0000000005f2", "label": "Final inspection", "start": "2026-11-25", "finish": "2026-11-26",
     "after": [{"id": "00000000-0000-0000-0000-0000000005e2", "gap": 0}]}],
   "milestones": [
    {"id": "00000000-0000-0000-0000-000000000572", "label": "Rough-in inspection", "planned": "2026-11-17"},
    {"id": "00000000-0000-0000-0000-000000000571", "label": "Substantial completion", "planned": "2026-11-29"}]}$j$::jsonb)::text, '1');
SELECT gst.same('the draft: its bars, a line by its scope line''s id',
  gst.bars('00000000-0000-0000-0000-0000000005a1'),
  E'5e1 2026-11-02..2026-11-13\n5e3 2026-11-02..2026-11-13\nRough-in inspection 2026-11-16..2026-11-17\n5e2 2026-11-18..2026-11-24\nFinal inspection 2026-11-25..2026-11-26');
SELECT gst.same('the draft: four waits, two dates to meet, one line of words',
  (SELECT count(*) FROM public.gc_schedule_links WHERE project_id = '00000000-0000-0000-0000-0000000005a1')::text || ' ' ||
  (SELECT count(*) FROM public.gc_schedule_milestones WHERE project_id = '00000000-0000-0000-0000-0000000005a1')::text || ' ' ||
  (SELECT string_agg(version || ': ' || words, ' | ') FROM public.gc_schedule_changes WHERE project_id = '00000000-0000-0000-0000-0000000005a1'),
  '4 2 1: Drew a first draft of the schedule on Schedule test P: 5 activities from Mon Nov 2.');

-- 2 · A second first draft, as if a second person drew at once: refused, naming the first.
SELECT gst.refused('a second first draft',
  $q$SELECT public.gc_schedule_draft('00000000-0000-0000-0000-0000000005a1', NULL, 'Drew it again.',
    '{"bars": [{"kind": "inspection", "id": "00000000-0000-0000-0000-0000000005f9", "label": "Final inspection", "start": "2026-11-25", "finish": "2026-11-26"}]}')$q$,
  'The schedule changed while you were working.', 'Drew a first draft of the schedule on Schedule test P');

-- 3 · Why it moved comes first: no reason, a word for a reason, a finish before its start.
SELECT gst.refused('a move with no reason', $q$SELECT public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 1, 'Moved.',
    '{"activityId": "00000000-0000-0000-0000-0000000005e3", "note": "The crew is short this week.", "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "to": {"start": "2026-11-03", "finish": "2026-11-13"}, "finishFrom": "2026-11-26", "finishTo": "2026-11-26", "pushed": []}',
    '[{"id": "00000000-0000-0000-0000-0000000005e3", "start": "2026-11-03", "finish": "2026-11-13"}]')$q$, 'Pick why it moved.');
SELECT gst.refused('a move with a word for a reason', $q$SELECT public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 1, 'Moved.',
    '{"activityId": "00000000-0000-0000-0000-0000000005e3", "reason": "crew", "note": "short", "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "to": {"start": "2026-11-03", "finish": "2026-11-13"}, "finishFrom": "2026-11-26", "finishTo": "2026-11-26", "pushed": []}',
    '[{"id": "00000000-0000-0000-0000-0000000005e3", "start": "2026-11-03", "finish": "2026-11-13"}]')$q$, 'Say what happened, in a sentence.');
SELECT gst.refused('a finish before its start', $q$SELECT public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 1, 'Moved.',
    '{"activityId": "00000000-0000-0000-0000-0000000005e3", "reason": "crew", "note": "The crew is short this week.", "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "to": {"start": "2026-11-13", "finish": "2026-11-03"}, "finishFrom": "2026-11-26", "finishTo": "2026-11-26", "pushed": []}',
    '[{"id": "00000000-0000-0000-0000-0000000005e3", "start": "2026-11-13", "finish": "2026-11-03"}]')$q$, 'It has to finish on or after it starts.');
SELECT gst.refused('a move whose bars and record disagree', $q$SELECT public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 1, 'Moved.',
    '{"activityId": "00000000-0000-0000-0000-0000000005e3", "reason": "crew", "note": "The crew is short this week.", "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "to": {"start": "2026-11-03", "finish": "2026-11-13"}, "finishFrom": "2026-11-26", "finishTo": "2026-11-26", "pushed": []}',
    '[{"id": "00000000-0000-0000-0000-0000000005e3", "start": "2026-11-03", "finish": "2026-11-13"}, {"id": "00000000-0000-0000-0000-0000000005f1", "start": "2026-11-17", "finish": "2026-11-18"}]')$q$,
  'The move and its bars do not agree.');
SELECT gst.same('nothing refused touched the version', gst.version('00000000-0000-0000-0000-0000000005a1'), '1');

-- 4 · Two people on one schedule (G-134): A saves first on version 1; B's press on version 1 is refused
-- with A's words, and nothing of B's is written; B presses again on version 2 and it saves.
SELECT gst.same('move A saves as version 2', public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 1,
  'Electrical · Rough-in now runs Wed Nov 4 to Tue Nov 17. 3 activities after it move out. Schedule Dev: The switchgear ships two days late.',
  $j${"activityId": "00000000-0000-0000-0000-0000000005e1", "activityName": "Electrical · Rough-in", "reason": "materials", "note": "The switchgear ships two days late.",
      "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "to": {"start": "2026-11-04", "finish": "2026-11-17"}, "finishFrom": "2026-11-26", "finishTo": "2026-11-28",
      "pushed": [
        {"activityId": "00000000-0000-0000-0000-0000000005f1", "from": {"start": "2026-11-16", "finish": "2026-11-17"}, "to": {"start": "2026-11-18", "finish": "2026-11-19"}},
        {"activityId": "00000000-0000-0000-0000-0000000005e2", "from": {"start": "2026-11-18", "finish": "2026-11-24"}, "to": {"start": "2026-11-20", "finish": "2026-11-26"}},
        {"activityId": "00000000-0000-0000-0000-0000000005f2", "from": {"start": "2026-11-25", "finish": "2026-11-26"}, "to": {"start": "2026-11-27", "finish": "2026-11-28"}}]}$j$::jsonb,
  $j$[{"id": "00000000-0000-0000-0000-0000000005e1", "start": "2026-11-04", "finish": "2026-11-17"},
      {"id": "00000000-0000-0000-0000-0000000005f1", "start": "2026-11-18", "finish": "2026-11-19"},
      {"id": "00000000-0000-0000-0000-0000000005e2", "start": "2026-11-20", "finish": "2026-11-26"},
      {"id": "00000000-0000-0000-0000-0000000005f2", "start": "2026-11-27", "finish": "2026-11-28"}]$j$::jsonb)::text, '2');
SELECT gst.refused('move B on version 1 is refused with move A''s words', $q$SELECT public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 1,
    'Plumbing · Rough-in now runs Tue Nov 3 to Fri Nov 13. Schedule Dev: The crew starts a day late.',
    '{"activityId": "00000000-0000-0000-0000-0000000005e3", "reason": "crew", "note": "The crew starts a day late.", "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "to": {"start": "2026-11-03", "finish": "2026-11-13"}, "finishFrom": "2026-11-28", "finishTo": "2026-11-28", "pushed": []}',
    '[{"id": "00000000-0000-0000-0000-0000000005e3", "start": "2026-11-03", "finish": "2026-11-13"}]')$q$,
  'The schedule changed while you were working.', 'The switchgear ships two days late.');
SELECT gst.same('nothing of move B was written', gst.bars('00000000-0000-0000-0000-0000000005a1'),
  E'5e1 2026-11-04..2026-11-17\n5e3 2026-11-02..2026-11-13\nRough-in inspection 2026-11-18..2026-11-19\n5e2 2026-11-20..2026-11-26\nFinal inspection 2026-11-27..2026-11-28');
SELECT gst.same('move B saves on version 2, as version 3', public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 2,
  'Plumbing · Rough-in now runs Tue Nov 3 to Fri Nov 13. Schedule Dev: The crew starts a day late.',
  '{"activityId": "00000000-0000-0000-0000-0000000005e3", "activityName": "Plumbing · Rough-in", "reason": "crew", "note": "The crew starts a day late.", "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "to": {"start": "2026-11-03", "finish": "2026-11-13"}, "finishFrom": "2026-11-28", "finishTo": "2026-11-28", "pushed": []}',
  '[{"id": "00000000-0000-0000-0000-0000000005e3", "start": "2026-11-03", "finish": "2026-11-13"}]')::text, '3');
SELECT gst.same('each move keeps its version, its day, its mover and what it pushed',
  (SELECT string_agg(m.schedule_version || ' ' || m.activity_name || ' ' || (m.made_on = public.app_today()) || ' ' || m.made_by_name || ' ' ||
     (SELECT count(*) FROM public.gc_schedule_move_pushes x WHERE x.move_id = m.id), ' | ' ORDER BY m.schedule_version)
   FROM public.gc_schedule_moves m WHERE m.project_id = '00000000-0000-0000-0000-0000000005a1'),
  '2 Electrical · Rough-in true Schedule Dev 3 | 3 Plumbing · Rough-in true Schedule Dev 0');

-- 5 · Undo and Redo (G-40): only the newest standing move; each bar back where the move found it.
SELECT gst.refused('undo a move a newer one stands on', $q$SELECT public.gc_schedule_undo('00000000-0000-0000-0000-0000000005a1', 3,
    (SELECT id FROM public.gc_schedule_moves WHERE schedule_version = 2 AND project_id = '00000000-0000-0000-0000-0000000005a1'), 'Undid a move.')$q$,
  'Only the newest move can be undone.');
SELECT gst.same('undo move B, as version 4', public.gc_schedule_undo('00000000-0000-0000-0000-0000000005a1', 3,
  (SELECT id FROM public.gc_schedule_moves WHERE schedule_version = 3 AND project_id = '00000000-0000-0000-0000-0000000005a1'),
  'Schedule Dev undid a move: Plumbing · Rough-in is back to Nov 2 to Nov 13.')::text, '4');
SELECT gst.same('undo: the bar is back and the move is undone today, by its undoer',
  (SELECT a.start || ' ' || (m.undone_on = public.app_today()) || ' ' || (m.undone_by = '00000000-0000-0000-0000-0000000005d1')
   FROM public.gc_schedule_moves m JOIN public.gc_schedule_activities a ON a.id = m.activity_id WHERE m.schedule_version = 3 AND m.project_id = '00000000-0000-0000-0000-0000000005a1'),
  '2026-11-02 true true');
SELECT gst.same('redo move B, as version 5', public.gc_schedule_redo('00000000-0000-0000-0000-0000000005a1', 4,
  (SELECT id FROM public.gc_schedule_moves WHERE schedule_version = 3 AND project_id = '00000000-0000-0000-0000-0000000005a1'),
  'Schedule Dev put a move back: Plumbing · Rough-in is Nov 3 to Nov 13 again.')::text, '5');
SELECT gst.refused('redo a move that stands', $q$SELECT public.gc_schedule_redo('00000000-0000-0000-0000-0000000005a1', 5,
    (SELECT id FROM public.gc_schedule_moves WHERE schedule_version = 3 AND project_id = '00000000-0000-0000-0000-0000000005a1'), 'Put it back.')$q$,
  'That move stands already.');

-- 6 · Start (decision 7): the first plan write after it keeps the plan as it stood, At Start.
RESET ROLE;
UPDATE public.gc_projects SET stage = 'building' WHERE project_id = '00000000-0000-0000-0000-0000000005a1';
SET LOCAL ROLE authenticated;
SELECT gst.same('move C after Start, as version 6', public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 5,
  'Electrical · Trim now runs Mon Nov 23 to Fri Nov 27. Final inspection moves out 1 day. Schedule Dev: The fixtures came in a week late.',
  '{"activityId": "00000000-0000-0000-0000-0000000005e2", "activityName": "Electrical · Trim", "reason": "materials", "note": "The fixtures came in a week late.", "from": {"start": "2026-11-20", "finish": "2026-11-26"}, "to": {"start": "2026-11-23", "finish": "2026-11-27"}, "finishFrom": "2026-11-28", "finishTo": "2026-11-29",
    "pushed": [{"activityId": "00000000-0000-0000-0000-0000000005f2", "from": {"start": "2026-11-27", "finish": "2026-11-28"}, "to": {"start": "2026-11-28", "finish": "2026-11-29"}}]}',
  '[{"id": "00000000-0000-0000-0000-0000000005e2", "start": "2026-11-23", "finish": "2026-11-27"}, {"id": "00000000-0000-0000-0000-0000000005f2", "start": "2026-11-28", "finish": "2026-11-29"}]')::text, '6');
SELECT gst.same('the plan at Start was kept before move C, unnamed',
  (SELECT count(*) || ' ' || coalesce(max(b.name), 'At Start') || ' ' || max(d.start) || '..' || max(d.finish)
   FROM public.gc_schedule_baselines b JOIN public.gc_schedule_baseline_dates d ON d.baseline_id = b.id AND d.activity_id = '00000000-0000-0000-0000-0000000005e2'
   WHERE b.project_id = '00000000-0000-0000-0000-0000000005a1'),
  '1 At Start 2026-11-20..2026-11-26');

-- 7 · A new baseline after a signed change order (G-41): named, the one at Start kept.
SELECT gst.refused('a new baseline with no name', $q$SELECT public.gc_schedule_baseline('00000000-0000-0000-0000-0000000005a1', 6, '  ', '', 'Set a baseline.')$q$,
  'Give the new baseline a name.');
SELECT gst.same('a new baseline, as version 7', public.gc_schedule_baseline('00000000-0000-0000-0000-0000000005a1', 6, 'After change order 1', 'The curb was signed.',
  'Schedule Dev set a new baseline on Schedule test P, After change order 1: The curb was signed. The plan at Start is kept.')::text, '7');
SELECT gst.same('two baselines, the newest with the plan as it stands',
  (SELECT string_agg(coalesce(b.name, 'At Start') || ' ' || d.start, ' | ' ORDER BY b.created_at, b.name NULLS FIRST)
   FROM public.gc_schedule_baselines b JOIN public.gc_schedule_baseline_dates d ON d.baseline_id = b.id AND d.activity_id = '00000000-0000-0000-0000-0000000005e2'
   WHERE b.project_id = '00000000-0000-0000-0000-0000000005a1'),
  'At Start 2026-11-20 | After change order 1 2026-11-23');

-- 8 · Split a line into parts (G-39), move a part, undo it, and make it one bar again.
SELECT gst.refused('a split into one part', $q$SELECT public.gc_schedule_split('00000000-0000-0000-0000-0000000005a1', 7, '00000000-0000-0000-0000-0000000005e1',
    '[{"name": "Whole", "fromDay": 0, "days": 14, "share": 100, "pct": 0}]', 'Split it.')$q$, 'Split it into two parts or more.');
SELECT gst.refused('a split that does not start with the line', $q$SELECT public.gc_schedule_split('00000000-0000-0000-0000-0000000005a1', 7, '00000000-0000-0000-0000-0000000005e1',
    '[{"name": "First floor", "fromDay": 1, "days": 6, "share": 50, "pct": 0}, {"name": "Second floor", "fromDay": 7, "days": 7, "share": 50, "pct": 0}]', 'Split it.')$q$,
  'The first part starts Wed Nov 4 and the last ends Tue Nov 17, as the line does.');
SELECT gst.refused('a split of an inspection', $q$SELECT public.gc_schedule_split('00000000-0000-0000-0000-0000000005a1', 7, '00000000-0000-0000-0000-0000000005f1',
    '[{"name": "Half", "fromDay": 0, "days": 1, "share": 50, "pct": 0}, {"name": "Other half", "fromDay": 1, "days": 1, "share": 50, "pct": 0}]', 'Split it.')$q$,
  'Only a trade''s line splits into parts.');
SELECT gst.same('split Electrical · Rough-in in two, as version 8', public.gc_schedule_split('00000000-0000-0000-0000-0000000005a1', 7, '00000000-0000-0000-0000-0000000005e1',
  '[{"id": "00000000-0000-0000-0000-000000000581", "name": "First floor", "fromDay": 0, "days": 7, "share": 50, "pct": 0},
    {"id": "00000000-0000-0000-0000-000000000582", "name": "Second floor", "fromDay": 7, "days": 7, "share": 50, "pct": 0}]',
  'Schedule Dev split Electrical · Rough-in on Schedule test P into 2 parts: First floor, Second floor.')::text, '8');
SELECT gst.same('a part''s own move, as version 9', public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 8,
  'Electrical · Rough-in, Second floor now runs Fri Nov 13 to Thu Nov 19. Schedule Dev: The second floor deck is not poured yet.',
  '{"activityId": "00000000-0000-0000-0000-0000000005e1", "activityName": "Electrical · Rough-in", "reason": "trade before", "note": "The second floor deck is not poured yet.",
    "from": {"start": "2026-11-04", "finish": "2026-11-17"}, "to": {"start": "2026-11-04", "finish": "2026-11-19"}, "finishFrom": "2026-11-29", "finishTo": "2026-11-29",
    "pushed": [{"activityId": "00000000-0000-0000-0000-0000000005f1", "from": {"start": "2026-11-18", "finish": "2026-11-19"}, "to": {"start": "2026-11-20", "finish": "2026-11-21"}}],
    "parts": {"id": "00000000-0000-0000-0000-000000000582",
              "was": [{"id": "00000000-0000-0000-0000-000000000581", "from": 0, "days": 7}, {"id": "00000000-0000-0000-0000-000000000582", "from": 7, "days": 7}],
              "now": [{"id": "00000000-0000-0000-0000-000000000581", "from": 0, "days": 7}, {"id": "00000000-0000-0000-0000-000000000582", "from": 9, "days": 7}]}}',
  '[{"id": "00000000-0000-0000-0000-0000000005e1", "start": "2026-11-04", "finish": "2026-11-19",
     "parts": [{"id": "00000000-0000-0000-0000-000000000581", "fromDay": 0, "days": 7}, {"id": "00000000-0000-0000-0000-000000000582", "fromDay": 9, "days": 7}]},
    {"id": "00000000-0000-0000-0000-0000000005f1", "start": "2026-11-20", "finish": "2026-11-21"}]')::text, '9');
SELECT gst.same('undo the part''s move, as version 10', public.gc_schedule_undo('00000000-0000-0000-0000-0000000005a1', 9,
  (SELECT id FROM public.gc_schedule_moves WHERE schedule_version = 9 AND project_id = '00000000-0000-0000-0000-0000000005a1'),
  'Schedule Dev undid a move: Electrical · Rough-in is back to Nov 4 to Nov 17.')::text, '10');
SELECT gst.same('undo put the part''s days, the line and its push back',
  (SELECT string_agg(p.name || ' ' || p.from_day || '+' || p.days, ' | ' ORDER BY p.position) FROM public.gc_schedule_activity_parts p WHERE p.activity_id = '00000000-0000-0000-0000-0000000005e1')
  || ' / ' || (SELECT start || '..' || finish FROM public.gc_schedule_activities WHERE id = '00000000-0000-0000-0000-0000000005e1')
  || ' / ' || (SELECT start || '..' || finish FROM public.gc_schedule_activities WHERE id = '00000000-0000-0000-0000-0000000005f1'),
  'First floor 0+7 | Second floor 7+7 / 2026-11-04..2026-11-17 / 2026-11-18..2026-11-19');
SELECT gst.same('one bar again, as version 11', public.gc_schedule_join('00000000-0000-0000-0000-0000000005a1', 10, '00000000-0000-0000-0000-0000000005e1',
  'Schedule Dev made Electrical · Rough-in on Schedule test P one bar again.')::text, '11');
SELECT gst.refused('one bar made one bar', $q$SELECT public.gc_schedule_join('00000000-0000-0000-0000-0000000005a1', 11, '00000000-0000-0000-0000-0000000005e1', 'Joined it.')$q$,
  'It is one bar already.');

-- 9 · The job's own work (G-38): on with a wait and a bar that waits on it, off again; a line stays.
SELECT gst.refused('the job''s own work with no owner', $q$SELECT public.gc_schedule_add_activity('00000000-0000-0000-0000-0000000005a1', 11,
    '{"id": "00000000-0000-0000-0000-0000000005f3", "label": "Mobilize", "who": " ", "start": "2026-11-02", "finish": "2026-11-03", "after": []}', '{}', '[]', 'Added it.')$q$,
  'Say whose it is.');
SELECT gst.same('Mobilize on, as version 12', public.gc_schedule_add_activity('00000000-0000-0000-0000-0000000005a1', 11,
  '{"id": "00000000-0000-0000-0000-0000000005f3", "label": "Mobilize", "who": "Our own crew", "start": "2026-11-02", "finish": "2026-11-03", "after": []}',
  '{00000000-0000-0000-0000-0000000005e1}', '[]',
  'Schedule Dev put Mobilize on Schedule test P''s schedule, Mon Nov 2 to Tue Nov 3, Our own crew. 1 activity waits on it.')::text, '12');
SELECT gst.same('Electrical · Rough-in waits on Mobilize',
  (SELECT count(*)::text FROM public.gc_schedule_links WHERE from_activity_id = '00000000-0000-0000-0000-0000000005f3' AND to_activity_id = '00000000-0000-0000-0000-0000000005e1'), '1');
SELECT gst.refused('a trade''s line taken off', $q$SELECT public.gc_schedule_remove_activity('00000000-0000-0000-0000-0000000005a1', 12, '00000000-0000-0000-0000-0000000005e3', 'Took it off.')$q$,
  'Only the job''s own work comes off.');
SELECT gst.same('Mobilize off, as version 13', public.gc_schedule_remove_activity('00000000-0000-0000-0000-0000000005a1', 12, '00000000-0000-0000-0000-0000000005f3',
  'Mobilize came off Schedule test P''s schedule.')::text, '13');
SELECT gst.same('nothing waits on Mobilize now',
  (SELECT count(*)::text FROM public.gc_schedule_links WHERE from_activity_id = '00000000-0000-0000-0000-0000000005f3'), '0');

-- 10 · An inspection fails and moves to its re-inspection day; another passes and meets its date.
SELECT gst.refused('a failure with no words', $q$SELECT public.gc_schedule_fail_inspection('00000000-0000-0000-0000-0000000005a1', 13, '00000000-0000-0000-0000-0000000005f2',
    '{"note": "  ", "packageIds": [], "reinspectOn": "2031-01-06"}', '[]', 'It failed.')$q$, 'Say what failed.');
SELECT gst.refused('a re-inspection today', format($q$SELECT public.gc_schedule_fail_inspection('00000000-0000-0000-0000-0000000005a1', 13, '00000000-0000-0000-0000-0000000005f2',
    '{"note": "Missing labels.", "packageIds": [], "reinspectOn": "%s"}', '[]', 'It failed.')$q$, public.app_today()), 'Pick a day after today for the re-inspection.');
SELECT gst.same('the final inspection fails, as version 14', public.gc_schedule_fail_inspection('00000000-0000-0000-0000-0000000005a1', 13, '00000000-0000-0000-0000-0000000005f2',
  '{"note": "Panel labels missing.", "packageIds": ["00000000-0000-0000-0000-0000000005b1", "00000000-0000-0000-0000-0000000005b3"], "reinspectOn": "2031-01-06"}',
  '[{"id": "00000000-0000-0000-0000-0000000005f2", "start": "2031-01-06", "finish": "2031-01-07"}]',
  'The final inspection failed on Schedule test P: Panel labels missing. It was Electrical''s work. Re-inspection Mon Jan 6.')::text, '14');
SELECT gst.same('the failure keeps only this job''s trades, and the bar moved',
  (SELECT f.note || ' ' || cardinality(f.package_ids) || ' ' || f.reinspect_on FROM public.gc_schedule_inspection_failures f WHERE f.activity_id = '00000000-0000-0000-0000-0000000005f2')
  || ' / ' || (SELECT start || '..' || finish FROM public.gc_schedule_activities WHERE id = '00000000-0000-0000-0000-0000000005f2'),
  'Panel labels missing. 1 2031-01-06 / 2031-01-06..2031-01-07');
INSERT INTO ids SELECT 'met', public.gc_schedule_pass_inspection('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000005f1');
SELECT gst.same('the rough-in inspection passes today and meets its date, with no version',
  (SELECT (id = '00000000-0000-0000-0000-000000000572')::text FROM ids WHERE k = 'met')
  || ' ' || (SELECT (passed_on = public.app_today())::text FROM public.gc_schedule_activities WHERE id = '00000000-0000-0000-0000-0000000005f1')
  || ' ' || (SELECT (met_on = public.app_today())::text FROM public.gc_schedule_milestones WHERE id = '00000000-0000-0000-0000-000000000572')
  || ' ' || gst.version('00000000-0000-0000-0000-0000000005a1'), 'true true true 14');
SELECT gst.refused('a pass twice', $q$SELECT public.gc_schedule_pass_inspection('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000005f1')$q$,
  'This inspection passed already.');

-- 11 · Places (G-83), refused whole; their dates to meet (G-145); a wait with what it holds (G-73).
SELECT gst.refused('a place on an inspection, beside a good one', $q$SELECT public.gc_schedule_set_places('00000000-0000-0000-0000-0000000005a1',
    '{"00000000-0000-0000-0000-0000000005e1": "Roof", "00000000-0000-0000-0000-0000000005f1": "Inside"}')$q$,
  'An inspection and the job''s own work take no place.');
SELECT gst.refused('a place of 41 letters', format($q$SELECT public.gc_schedule_set_places('00000000-0000-0000-0000-0000000005a1', '{"00000000-0000-0000-0000-0000000005e1": "%s"}')$q$, repeat('x', 41)),
  'A place is 40 characters at most.');
SELECT gst.same('two places kept', public.gc_schedule_set_places('00000000-0000-0000-0000-0000000005a1',
  '{"00000000-0000-0000-0000-0000000005e1": "  Level   2 ", "00000000-0000-0000-0000-0000000005e3": "Roof"}')::text, '2');
SELECT gst.same('a place already there is no change', public.gc_schedule_set_places('00000000-0000-0000-0000-0000000005a1',
  '{"00000000-0000-0000-0000-0000000005e3": "Roof"}')::text, '0');
SELECT gst.same('places are tidied as kept, with no version',
  (SELECT string_agg(place, ' | ' ORDER BY position) FROM public.gc_schedule_activities WHERE project_id = '00000000-0000-0000-0000-0000000005a1' AND place IS NOT NULL)
  || ' / ' || gst.version('00000000-0000-0000-0000-0000000005a1'), 'Level 2 | Roof / 14');
SELECT gst.refused('their date on one of ours that is met', $q$SELECT public.gc_schedule_their_dates('00000000-0000-0000-0000-0000000005a1',
    '[{"id": "00000000-0000-0000-0000-000000000572", "label": "Rough-in inspection", "planned": "2026-11-20"}]')$q$,
  'One of our dates is met already, or not on this job.');
SELECT gst.same('their dates: two taken', public.gc_schedule_their_dates('00000000-0000-0000-0000-0000000005a1',
  '[{"id": "00000000-0000-0000-0000-000000000571", "label": "Substantial completion", "planned": "2026-12-04"}, {"label": "Owner move-in", "planned": "2026-12-18"}]')::text, '2');
SELECT gst.same('their dates: one of ours moved, one of theirs added as the job''s own, with no version',
  (SELECT string_agg(label || ' ' || planned, ' | ' ORDER BY position) FROM public.gc_schedule_milestones WHERE project_id = '00000000-0000-0000-0000-0000000005a1')
  || ' / ' || gst.version('00000000-0000-0000-0000-0000000005a1'),
  'Rough-in inspection 2026-11-17 | Substantial completion 2026-12-04 | Owner move-in 2026-12-18 / 14');
SELECT gst.refused('a wait that holds another job''s bar', $q$SELECT public.gc_schedule_add_wait('00000000-0000-0000-0000-0000000005a1',
    '{"kind": "delivery", "title": "Switchgear", "who": "", "expectedOn": "2026-11-10", "activityIds": ["00000000-0000-0000-0000-0000000005e4"]}')$q$,
  'A wait names a bar that is not on this schedule.');
INSERT INTO ids SELECT 'wait', public.gc_schedule_add_wait('00000000-0000-0000-0000-0000000005a1',
  '{"kind": "delivery", "title": "Switchgear", "packageId": "00000000-0000-0000-0000-0000000005b1", "who": "", "expectedOn": "2026-11-10", "activityIds": ["00000000-0000-0000-0000-0000000005e1"]}');
SELECT gst.same('a wait, its empty who kept for the kind''s own, and the bar it holds, with no version',
  (SELECT w.title || ' [' || w.who || '] ' || (SELECT count(*) FROM public.gc_schedule_wait_holds h WHERE h.wait_id = w.id)
   FROM public.gc_schedule_waits w WHERE w.id = (SELECT id FROM ids WHERE k = 'wait'))
  || ' / ' || gst.version('00000000-0000-0000-0000-0000000005a1'), 'Switchgear [] 1 / 14');

-- 12 · Keep a what-if (G-81): the person's copy's two moves, oldest first, one version; the copy goes;
-- Undo takes the newest kept first.
INSERT INTO public.gc_schedule_what_ifs (project_id, user_id, made_on, base_version, base, copy)
VALUES ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000005d1', DATE '2026-10-07', 14, '{}', '{}');
SELECT gst.refused('a keep with a move with no reason', $q$SELECT public.gc_schedule_keep_what_if('00000000-0000-0000-0000-0000000005a1', 14, 'Kept a what-if.',
    '[{"activityId": "00000000-0000-0000-0000-0000000005e1", "reason": "other", "note": "No"}]', '[]')$q$,
  'Give each move a reason and a sentence.');
SELECT gst.same('a what-if kept, as version 15', public.gc_schedule_keep_what_if('00000000-0000-0000-0000-0000000005a1', 14,
  'Schedule Dev kept a what-if on Schedule test P: 2 moves on the schedule, each with its reason.',
  $j$[{"activityId": "00000000-0000-0000-0000-0000000005e1", "activityName": "Electrical · Rough-in", "reason": "us", "note": "Tried a day later first, it frees the lift.",
       "from": {"start": "2026-11-04", "finish": "2026-11-17"}, "to": {"start": "2026-11-05", "finish": "2026-11-18"}, "finishFrom": "2031-01-07", "finishTo": "2031-01-07", "pushed": []},
      {"activityId": "00000000-0000-0000-0000-0000000005e3", "activityName": "Plumbing · Rough-in", "reason": "us", "note": "Plumbing follows the lift by a day.",
       "from": {"start": "2026-11-03", "finish": "2026-11-13"}, "to": {"start": "2026-11-04", "finish": "2026-11-14"}, "finishFrom": "2031-01-07", "finishTo": "2031-01-07", "pushed": []}]$j$,
  '[{"id": "00000000-0000-0000-0000-0000000005e1", "start": "2026-11-05", "finish": "2026-11-18"}, {"id": "00000000-0000-0000-0000-0000000005e3", "start": "2026-11-04", "finish": "2026-11-14"}]')::text, '15');
SELECT gst.same('the kept moves: one version, tried in a copy that day, in their order; the copy is gone',
  (SELECT string_agg(m.activity_name || ' ' || m.schedule_version || ' ' || m.from_what_if_on, ' | ' ORDER BY m.made_at)
   FROM public.gc_schedule_moves m WHERE m.project_id = '00000000-0000-0000-0000-0000000005a1' AND m.from_what_if_on IS NOT NULL)
  || ' / ' || (SELECT count(*) FROM public.gc_schedule_what_ifs WHERE project_id = '00000000-0000-0000-0000-0000000005a1'),
  'Electrical · Rough-in 15 2026-10-07 | Plumbing · Rough-in 15 2026-10-07 / 0');
SELECT gst.refused('the first kept move, while the second stands', format($q$SELECT public.gc_schedule_undo('00000000-0000-0000-0000-0000000005a1', 15, '%s', 'Undid it.')$q$,
    (SELECT id FROM public.gc_schedule_moves WHERE project_id = '00000000-0000-0000-0000-0000000005a1' AND activity_name = 'Electrical · Rough-in' AND from_what_if_on IS NOT NULL)),
  'Only the newest move can be undone.');
SELECT gst.refused('a keep with no copy open', $q$SELECT public.gc_schedule_keep_what_if('00000000-0000-0000-0000-0000000005a1', 15, 'Kept a what-if.',
    '[{"activityId": "00000000-0000-0000-0000-0000000005e1", "reason": "us", "note": "Tried a day later first."}]', '[]')$q$,
  'There is no what-if open.');

-- 13 · The guard: the plan changes only through its presses, even for a dev; a record does not need one.
SELECT gst.refused('a bar''s days written straight to the table', $q$UPDATE public.gc_schedule_activities SET start = start + 1 WHERE id = '00000000-0000-0000-0000-0000000005e3'$q$,
  'Change the schedule through its own presses');
SELECT gst.refused('a wait taken off straight from the table', $q$DELETE FROM public.gc_schedule_links WHERE project_id = '00000000-0000-0000-0000-0000000005a1'$q$,
  'Change the schedule through its own presses');
SELECT gst.refused('a line of words written straight to the table', $q$INSERT INTO public.gc_schedule_changes (project_id, version, words) VALUES ('00000000-0000-0000-0000-0000000005a1', 99, 'Nobody pressed this.')$q$,
  'Change the schedule through its own presses');
SELECT gst.refused('a move marked undone straight in the table', $q$UPDATE public.gc_schedule_moves SET undone_on = DATE '2026-10-07' WHERE project_id = '00000000-0000-0000-0000-0000000005a1'$q$,
  'Change the schedule through its own presses');
SELECT gst.refused('the version written straight to the table', $q$UPDATE public.gc_schedules SET version = 0 WHERE project_id = '00000000-0000-0000-0000-0000000005a1'$q$,
  'Change the schedule through its own presses');
UPDATE public.gc_schedule_activities SET actual_start = DATE '2026-11-05' WHERE id = '00000000-0000-0000-0000-0000000005e1';
SELECT gst.same('a real day is a record: written straight, no version',
  (SELECT actual_start::text FROM public.gc_schedule_activities WHERE id = '00000000-0000-0000-0000-0000000005e1') || ' ' || gst.version('00000000-0000-0000-0000-0000000005a1'),
  '2026-11-05 15');

-- 14 · Another job's bar, a reader in training mode, and someone the policies do not let in.
SELECT gst.same('Q drawn from the template, by its name that day', public.gc_schedule_draft('00000000-0000-0000-0000-0000000005a2', NULL,
  'Drew a first draft of the schedule on Schedule test Q: 2 activities from Mon Nov 2. It is drawn from the template Schedule test shape.',
  '{"template": {"id": "00000000-0000-0000-0000-000000000591"},
    "bars": [{"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000005e4", "packageId": "00000000-0000-0000-0000-0000000005b3", "start": "2026-11-02", "finish": "2026-11-06", "after": []},
             {"kind": "inspection", "id": "00000000-0000-0000-0000-0000000005f8", "label": "Final inspection", "start": "2026-11-09", "finish": "2026-11-10",
              "after": [{"id": "00000000-0000-0000-0000-0000000005e4", "gap": 0}]}]}')::text, '1');
SELECT gst.same('Q keeps the template''s name as it read today',
  (SELECT template_name || ' ' || (template_used_on = public.app_today()) FROM public.gc_schedules WHERE project_id = '00000000-0000-0000-0000-0000000005a2'),
  'Schedule test shape true');
SELECT gst.refused('a move on P naming Q''s bar', $q$SELECT public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 15, 'Moved.',
    '{"activityId": "00000000-0000-0000-0000-0000000005e4", "reason": "crew", "note": "The crew is short this week.", "from": {"start": "2026-11-02", "finish": "2026-11-06"}, "to": {"start": "2026-11-03", "finish": "2026-11-07"}, "finishFrom": "2031-01-07", "finishTo": "2031-01-07", "pushed": []}',
    '[{"id": "00000000-0000-0000-0000-0000000005e4", "start": "2026-11-03", "finish": "2026-11-07"}]')$q$,
  'A bar in this change is not on this schedule.');
SELECT gst.same('Q drawn again before Start, as version 2', public.gc_schedule_draft('00000000-0000-0000-0000-0000000005a2', 1, 'Drew the schedule on Schedule test Q again.',
  '{"bars": [{"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000005e4", "packageId": "00000000-0000-0000-0000-0000000005b3", "start": "2026-11-09", "finish": "2026-11-13", "after": []}]}')::text, '2');
SELECT gst.same('the new draw took the old one''s place, with no template',
  gst.bars('00000000-0000-0000-0000-0000000005a2') || ' / ' ||
  (SELECT coalesce(template_name, 'no template') FROM public.gc_schedules WHERE project_id = '00000000-0000-0000-0000-0000000005a2'),
  '5e4 2026-11-09..2026-11-13 / no template');
SELECT gst.same('a move on Q, as version 3', public.gc_schedule_move('00000000-0000-0000-0000-0000000005a2', 2, 'Electrical · Service now runs Tue Nov 10 to Mon Nov 16. Schedule Dev: The utility moved the cutover.',
  '{"activityId": "00000000-0000-0000-0000-0000000005e4", "activityName": "Electrical · Service", "reason": "customer", "note": "The utility moved the cutover.", "from": {"start": "2026-11-09", "finish": "2026-11-13"}, "to": {"start": "2026-11-10", "finish": "2026-11-16"}, "finishFrom": "2026-11-13", "finishTo": "2026-11-16", "pushed": []}',
  '[{"id": "00000000-0000-0000-0000-0000000005e4", "start": "2026-11-10", "finish": "2026-11-16"}]')::text, '3');
SELECT gst.refused('Q drawn again once it has a move', $q$SELECT public.gc_schedule_draft('00000000-0000-0000-0000-0000000005a2', 3, 'Drew it again.',
    '{"bars": [{"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000005e4", "packageId": "00000000-0000-0000-0000-0000000005b3", "start": "2026-11-09", "finish": "2026-11-13", "after": []}]}')$q$,
  'The schedule has moves with their reasons. They stay as they are.');
SELECT gst.refused('P drawn again after Start', $q$SELECT public.gc_schedule_draft('00000000-0000-0000-0000-0000000005a1', 15, 'Drew it again.',
    '{"bars": [{"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000005e1", "packageId": "00000000-0000-0000-0000-0000000005b1", "start": "2026-11-09", "finish": "2026-11-13", "after": []}]}')$q$,
  'A new set of plans is the way to change its schedule now.');
RESET ROLE;
UPDATE public.gc_projects SET stage = 'bidding' WHERE project_id = '00000000-0000-0000-0000-0000000005a2';
SET LOCAL ROLE authenticated;
SELECT gst.refused('a draw while we bid', $q$SELECT public.gc_schedule_draft('00000000-0000-0000-0000-0000000005a2', 3, 'Drew it again.',
    '{"bars": [{"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000005e4", "packageId": "00000000-0000-0000-0000-0000000005b3", "start": "2026-11-09", "finish": "2026-11-13", "after": []}]}')$q$,
  'While we bid, the rough schedule is the one to draw.');

SELECT gst.as_user('00000000-0000-0000-0000-0000000005d2');
SELECT gst.refused('a move in training mode', $q$SELECT public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 15, 'Moved.',
    '{"activityId": "00000000-0000-0000-0000-0000000005e3", "reason": "crew", "note": "The crew is short this week.", "from": {"start": "2026-11-04", "finish": "2026-11-14"}, "to": {"start": "2026-11-05", "finish": "2026-11-15"}, "finishFrom": "2031-01-07", "finishTo": "2031-01-07", "pushed": []}',
    '[{"id": "00000000-0000-0000-0000-0000000005e3", "start": "2026-11-05", "finish": "2026-11-15"}]')$q$,
  'Read-only (training) mode: changes are blocked.');
SELECT gst.as_user('00000000-0000-0000-0000-0000000005d3');
SELECT gst.refused('a move by someone the policies keep out', $q$SELECT public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 15, 'Moved.',
    '{"activityId": "00000000-0000-0000-0000-0000000005e3", "reason": "crew", "note": "The crew is short this week.", "from": {"start": "2026-11-04", "finish": "2026-11-14"}, "to": {"start": "2026-11-05", "finish": "2026-11-15"}, "finishFrom": "2031-01-07", "finishTo": "2031-01-07", "pushed": []}',
    '[{"id": "00000000-0000-0000-0000-0000000005e3", "start": "2026-11-05", "finish": "2026-11-15"}]')$q$,
  'This job has no schedule yet.');
SELECT gst.as_user('00000000-0000-0000-0000-0000000005d1');

-- 15 · The two template refusals the kernel words first (templateSaveProblem): the table holds the
-- same two shapes without the words, as the last line.
SELECT gst.refused('a template with no lines, straight to the table', $q$INSERT INTO public.gc_schedule_templates (name, from_name, from_done_pct, saved_on, lines, stages, weeks)
    VALUES ('No lines', 'Schedule test P', 0, DATE '2026-10-07', '[]', '[]', 1)$q$, 'gc_schedule_templates_lines_listed');
SELECT gst.refused('a template under a week, straight to the table', $q$INSERT INTO public.gc_schedule_templates (name, from_name, from_done_pct, saved_on, lines, stages, weeks)
    VALUES ('No weeks', 'Schedule test P', 0, DATE '2026-10-07', '[{"trade": "Electrical", "label": "Service"}]', '[]', 0)$q$, 'gc_schedule_templates_weeks_counted');

-- 16 · The words: one line for each plan write, in order, and nothing else on the record.
SELECT gst.same('P has a line of words for each of its 15 versions',
  (SELECT count(*) || ' ' || min(version) || '..' || max(version) FROM public.gc_schedule_changes WHERE project_id = '00000000-0000-0000-0000-0000000005a1'), '15 1..15');

RESET ROLE;
DO $$ BEGIN RAISE NOTICE 'gc_schedule PASSED'; END $$;
ROLLBACK;
```

What the scenario holds, in its sixteen steps:

| Step | What it proves |
|---|---|
| 1 | A first draft makes version 1 with its words: five bars, a line under its scope line's id, four waits, two dates to meet |
| 2 | A second first draft is refused, naming the first's words |
| 3 | No reason, a word for a reason, a finish before its start, and bars that disagree with their move are refused before the version moves |
| 4 | **The build doc's check (G-134):** A saves on version 1; B on version 1 is refused with A's words in the DETAIL, and nothing of B is written; B saves on version 2 |
| 5 | Undo refuses a move a newer one stands on; Undo and Redo put a bar back and forward from the move's record, with the undo pair |
| 6 | After Start, the first plan write keeps the plan as it stood, At Start |
| 7 | A new baseline needs a name; the one at Start stays |
| 8 | A split's refusals in `splitParts`' words; a part's own move; Undo puts the part's days, its line and its push back; join |
| 9 | The job's own work on, with the bar it holds up; a trade's line will not come off; the job's own work off, its waits with it |
| 10 | An inspection fails to its re-inspection day, keeping only this job's trades; another passes and meets its date, with no version |
| 11 | Places are refused whole, then kept tidied; their dates to meet; a wait and the bar it holds; none moves the version |
| 12 | Keep turns a copy's two moves into real ones under one version, in order, then deletes the copy; Undo takes the newest kept first |
| 13 | **The guard:** a bar's days, a wait, a change line, an undone mark and the version written straight to the tables are refused, even for a dev; a real day is not |
| 14 | Another job's bar is refused; a draw from a template keeps its name that day; a redraw before Start takes the place, and is refused once moved, after Start, or while we bid; training mode and a role with no policy are refused |
| 15 | The table's own two template checks, the last line under the kernel's words |
| 16 | One line of words for each of the job's fifteen versions |

## One copy of the words

`src/lib/gc/schedule/writes.words.test.ts`, in `npm test`:

```ts
/**
 * The schedule's PR 5: the database says a refusal the way the screen does. Every sentence a kernel
 * says before a save, the migration's functions say word for word, so a press refused on either side
 * reads the same. Every sentence the functions say is plain words (src/lib/plainWords.ts).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { plainWordsFailures, plainWordsSentences } from '../../plainWords'
import { addedActivityProblem } from './addedActivity'
import { importRefusal } from './import'
import { MOVE_NOTE_MIN, MOVE_REASONS, moveWhyProblem, planMove } from './moves'
import { PLACE_MAX, placeProblem } from './places'
import { splitParts } from './splitBars'
import { initialGcState } from './testState'
import { theirDatesRefusal } from './theirDates'
import type { ScheduleMove } from './types'
import { keepWhatIf, whatIfCopy } from './whatIf'

const dir = join(process.cwd(), 'supabase', 'migrations')
const file = readdirSync(dir).find((f) => f.endsWith('_gc_schedule_writes.sql'))
const SQL = file ? readFileSync(join(dir, file), 'utf8') : ''
/** Each sentence the functions raise, as a person reads it: quotes undone, a day where the SQL puts one. */
const raised = [...SQL.matchAll(/RAISE EXCEPTION '((?:[^']|'')*)'/g)].map((m) => (m[1] ?? '').replace(/''/g, "'").replace(/%/g, 'Wed Nov 4'))
/** The SQL says it, as SQL spells it. */
const says = (sentence: string | null | undefined) => Boolean(sentence) && SQL.includes((sentence ?? '').replace(/'/g, "''"))

const s = initialGcState()
const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!
const schedule = fairOaks.schedule!
const bar = schedule.activities.find((a) => !a.inspection && !a.added)!
const tried: ScheduleMove = {
  id: 'move-1', on: s.today, by: 'Robert', lineId: bar.lineId, from: { start: bar.start, finish: bar.finish }, to: { start: bar.start, finish: bar.finish },
  reason: 'other', note: 'No reason yet. Keep asks for one.', pushed: [], finishFrom: bar.finish, finishTo: bar.finish, noWhy: true,
}
const { noWhy: _noWhy, ...stood } = tried
const copy = whatIfCopy(fairOaks, 'Robert', s.today)!

describe("the schedule's writes say a refusal the way the screen does", () => {
  it('finds the migration', () => {
    expect(file).toBeTruthy()
  })

  it('says why a move cannot save in moveWhyProblem’s and planMove’s words, with its numbers', () => {
    for (const w of [moveWhyProblem(null, ''), moveWhyProblem('crew', 'short'), planMove(fairOaks, bar.lineId, '', '')?.problem, planMove(fairOaks, bar.lineId, '2026-11-13', '2026-11-03')?.problem]) expect(says(w), w ?? '').toBe(true)
    expect(SQL.match(new RegExp(`\\) < ${MOVE_NOTE_MIN}\\b`, 'g'))?.length).toBe(2)
    const lists = [...SQL.matchAll(/NOT IN \(('weather'[^)]*)\)/g)].map((m) => (m[1] ?? '').split(',').map((x) => x.trim().replace(/'/g, '')).sort())
    expect(lists).toEqual([0, 1].map(() => MOVE_REASONS.map((r) => r.key).sort()))
  })

  it('words the job’s own work, a split and a place as their kernels do', () => {
    const one = (name: string, start = bar.start, finish = bar.finish) => ({ name, start, finish })
    const problem = (r: ReturnType<typeof splitParts>) => ('problem' in r ? r.problem : null)
    for (const w of [
      addedActivityProblem('', 'Our own crew', '2026-11-02', '2026-11-03'),
      addedActivityProblem('Mobilize', ' ', '2026-11-02', '2026-11-03'),
      problem(splitParts(bar, [one('Whole')], 0)),
      problem(splitParts(bar, [one(' '), one('B')], 0)),
      problem(splitParts(bar, [one('A'), one('a')], 0)),
      problem(splitParts(bar, [one('A', bar.finish, bar.start), one('B')], 0)),
      placeProblem('x'.repeat(PLACE_MAX + 1)),
    ]) expect(says(w), w ?? '').toBe(true)
    // Both parts start on the line's last day, so the first does not start with the line.
    const span = problem(splitParts(bar, [one('A', bar.finish), one('B', bar.finish)], 0)) ?? ''
    expect(span.endsWith('as the line does. Move a part after the split to change that.')).toBe(true)
    expect(says('as the line does. Move a part after the split to change that.')).toBe(true)
  })

  it('words a draw, a keep and their dates as importRefusal, keepWhatIf and theirDatesRefusal do', () => {
    const job = (id: string) => s.projects.find((p) => p.id === id)!
    const notStarted = { ...fairOaks, startedOn: null }
    const keep = (p: typeof fairOaks) => {
      const r = keepWhatIf(p, {}, 'Robert', s.today)
      return 'problem' in r ? r.problem : null
    }
    for (const w of [
      importRefusal(job('boerne')),
      importRefusal({ ...job('helotes'), lostOn: '2026-10-01' }),
      plainWordsSentences(importRefusal(fairOaks) ?? '')[1],
      importRefusal({ ...notStarted, schedule: { ...schedule, walks: [{ id: 'walk-1', on: s.today, by: 'Robert', kept: [bar.lineId], moveIds: [], skipped: 0 }] } }),
      importRefusal({ ...notStarted, schedule: { ...schedule, walks: [], baseline: null, moves: [stood] } }),
      keep({ ...fairOaks }),
      keep({ ...fairOaks, whatIf: copy }),
      keep({ ...fairOaks, whatIf: { ...copy, schedule: { ...copy.schedule, moves: [tried] } } }),
      theirDatesRefusal(job('helotes')),
      theirDatesRefusal({ ...fairOaks, whatIf: copy }),
    ]) expect(says(w), w ?? '').toBe(true)
  })

  it('says every refusal in plain words', () => {
    expect(raised.length).toBeGreaterThan(40)
    expect(raised.flatMap(plainWordsFailures)).toEqual([])
  })
})
```

## The migration doc as it will be

````markdown
# <stamp>_gc_schedule_writes.sql (2026-10-08, v2.NNNN)

GC mode, the real build, the schedule's PR 5: the schedule's writes, so a press is all or nothing, from the prototype's model (`to-dos/gc-mode/SCHEDULE_REAL_BUILD.md` → *Writing it* and *Two people on one schedule*; the plan is `to-dos/gc-mode/mockups/schedule-pr5.md`, both on branch `spike/gc-mode`). Twenty-three functions and a trigger, after PR 4's `20261007235500_gc_schedule_what_if_and_before.sql`. No table changes. Nothing calls them until the schedule's PR 6.

- **The version step**, `gc_schedule_bump(project, version, words)`. It checks the version a press read and bumps it, and keeps the press's words in `gc_schedule_changes`. A null version makes a first draft's row at version 1. Any other version that is not the schedule's is refused: `P0001`, *The schedule changed while you were working.*, with every change since as JSON in the DETAIL (`read`, `version`, and `changes` with each one's `version`, `at`, `by`, `name` and `words`).
- **Eleven plan writes**, each checking and bumping the version and returning the new one:
  - `gc_schedule_draft` and `gc_schedule_move` (every kind of move);
  - `gc_schedule_undo` and `gc_schedule_redo`, which replay the move's own record;
  - `gc_schedule_keep_what_if` and `gc_schedule_baseline`;
  - `gc_schedule_split`, `gc_schedule_join`, `gc_schedule_add_activity` and `gc_schedule_remove_activity`;
  - `gc_schedule_fail_inspection`.

  Each keeps the plan at Start first on a job that started (`gc_schedule_keep_start`), but the draw and the baseline.
- **Four records that touch several rows**, with no version: `gc_schedule_set_places`, `gc_schedule_pass_inspection`, `gc_schedule_their_dates` and `gc_schedule_add_wait`.
- **Six shared steps**: `gc_schedule_keep_start`, `gc_schedule_set_bars`, `gc_schedule_check_why`, `gc_schedule_save_move`, `gc_schedule_move_sits` and `gc_schedule_put_move`.
- **The guard**: `gc_schedule_plan_guard`, a `BEFORE INSERT OR UPDATE OR DELETE` row trigger on `gc_schedules`, `gc_schedule_activities`, `gc_schedule_activity_parts`, `gc_schedule_links`, `gc_schedule_inspection_failures`, `gc_schedule_baselines`, `gc_schedule_baseline_dates`, `gc_schedule_changes`, `gc_schedule_moves` and `gc_schedule_move_pushes`.
  - It refuses a change to the plan unless a plan write set `gc.schedule_plan_write` for the transaction.
  - A bar's real days, place, pass and day done, and a part's percent and real days, are records and pass.
  - A cascade passes.

Every function is `SECURITY INVOKER` with `search_path = public`, so the tables' policies decide who may: dev only until the schedule's PR 10. EXECUTE goes to `authenticated` only; `PUBLIC` and `anon` have none. A record's day is `public.app_today()`, the company's.

Apply order: after PR 4's migration, since the functions read its tables. It changes no table: `CREATE OR REPLACE FUNCTION`, and the triggers in a `DO` block that makes each only where it is missing, so a second run changes nothing. Each `CREATE TRIGGER` takes a short lock on its table, and all ten are empty. In a busy moment the push stops at the 3-second lock timeout; run it again later. The SQL ran green in `npm run test:pg:gc-schedule` on the PR (the *SQL beds* check).

## Verify after the push

1. **The functions and the guards are there.** Run it read only.

   ```sql
   BEGIN READ ONLY;
   SELECT p.proname, p.prosecdef AS definer, array_to_string(p.proconfig, ',') AS config,
          has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_may,
          has_function_privilege('authenticated', p.oid, 'EXECUTE') AS signed_in_may
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.proname LIKE 'gc\_schedule\_%'
   ORDER BY p.proname;
   SELECT string_agg(c.relname, ', ' ORDER BY c.relname) AS guarded
   FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
   WHERE t.tgname = 'gc_schedule_plan_guard' AND NOT t.tgisinternal;
   ROLLBACK;
   ```

   Expect 23 rows. Every `definer` should be false and every `config` `search_path=public`. `anon_may` should be false on all. `signed_in_may` should be true on all but `gc_schedule_plan_guard`. `guarded` names the ten tables.

2. **The guard holds the plan, even for a dev.** Run it in a transaction that rolls back:

   ```sql
   BEGIN;
   SELECT set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
     FROM public.users WHERE role = 'dev' AND NOT read_only LIMIT 1;
   SET LOCAL ROLE authenticated;
   INSERT INTO public.gc_schedule_changes (project_id, version, words) VALUES (gen_random_uuid(), 1, 'A check, rolled back.');
   ROLLBACK;
   ```

   Expect `ERROR: Change the schedule through its own presses, so its version counts the change.` The guard fires before the row's keys are looked at.

3. **A read-only user's press is refused.** Run it as PR 2's step 3. The read-only trigger refuses at the version's update, before any row is looked at:

   ```sql
   BEGIN;
   SELECT set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
     FROM public.users WHERE read_only LIMIT 1;
   SET LOCAL ROLE authenticated;
   SELECT public.gc_schedule_move('ef8905d1-039a-4cbc-9d69-9468cfea50e0', 1, 'A check, rolled back.',
     '{"activityId": "00000000-0000-0000-0000-000000000001", "reason": "other", "note": "A check, rolled back.", "from": {"start": "2026-11-02", "finish": "2026-11-06"}, "to": {"start": "2026-11-03", "finish": "2026-11-09"}, "finishFrom": "2026-11-06", "finishTo": "2026-11-09", "pushed": []}',
     '[{"id": "00000000-0000-0000-0000-000000000001", "start": "2026-11-03", "finish": "2026-11-09"}]');
   ROLLBACK;
   ```

   Expect `ERROR: Read-only (training) mode: changes are blocked.`

4. **Two moves on one version: the second is refused with the first's words** (the build doc's own check). As a dev, on the test project *GC test project, delete me*, in a transaction that rolls back. The project is set past bidding inside it, then drawn with two of its lines, then moved twice on version 1:

   ```sql
   BEGIN;
   SELECT set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
     FROM public.users WHERE role = 'dev' AND NOT read_only LIMIT 1;
   SET LOCAL ROLE authenticated;
   DO $$
   DECLARE
     v_project uuid := 'ef8905d1-039a-4cbc-9d69-9468cfea50e0';
     v_a record;
     v_b record;
   BEGIN
     UPDATE public.gc_projects SET stage = 'buyout' WHERE project_id = v_project;
     SELECT s.id, s.package_id INTO v_a FROM public.gc_scope_items s JOIN public.gc_trade_packages k ON k.id = s.package_id
       WHERE k.project_id = v_project ORDER BY k.position, s.position LIMIT 1;
     SELECT s.id, s.package_id INTO v_b FROM public.gc_scope_items s JOIN public.gc_trade_packages k ON k.id = s.package_id
       WHERE k.project_id = v_project ORDER BY k.position, s.position OFFSET 1 LIMIT 1;
     PERFORM public.gc_schedule_draft(v_project, NULL, 'A check: drawn, then rolled back.', jsonb_build_object('bars', jsonb_build_array(
       jsonb_build_object('kind', 'line', 'scopeItemId', v_a.id, 'packageId', v_a.package_id, 'start', '2026-11-02', 'finish', '2026-11-06', 'after', '[]'::jsonb),
       jsonb_build_object('kind', 'line', 'scopeItemId', v_b.id, 'packageId', v_b.package_id, 'start', '2026-11-09', 'finish', '2026-11-13',
         'after', jsonb_build_array(jsonb_build_object('id', v_a.id, 'gap', 0))))));
     PERFORM public.gc_schedule_move(v_project, 1, 'A check: the first move, then rolled back.',
       jsonb_build_object('activityId', v_a.id, 'activityName', 'A check', 'reason', 'other', 'note', 'A check, rolled back.',
         'from', jsonb_build_object('start', '2026-11-02', 'finish', '2026-11-06'), 'to', jsonb_build_object('start', '2026-11-03', 'finish', '2026-11-09'),
         'finishFrom', '2026-11-13', 'finishTo', '2026-11-16',
         'pushed', jsonb_build_array(jsonb_build_object('activityId', v_b.id,
           'from', jsonb_build_object('start', '2026-11-09', 'finish', '2026-11-13'), 'to', jsonb_build_object('start', '2026-11-10', 'finish', '2026-11-16')))),
       jsonb_build_array(jsonb_build_object('id', v_a.id, 'start', '2026-11-03', 'finish', '2026-11-09'),
                         jsonb_build_object('id', v_b.id, 'start', '2026-11-10', 'finish', '2026-11-16')));
     PERFORM public.gc_schedule_move(v_project, 1, 'A check: the second move, on the same version.',
       jsonb_build_object('activityId', v_b.id, 'activityName', 'A check', 'reason', 'other', 'note', 'A check, rolled back.',
         'from', jsonb_build_object('start', '2026-11-09', 'finish', '2026-11-13'), 'to', jsonb_build_object('start', '2026-11-11', 'finish', '2026-11-13'),
         'finishFrom', '2026-11-13', 'finishTo', '2026-11-13', 'pushed', '[]'::jsonb),
       jsonb_build_array(jsonb_build_object('id', v_b.id, 'start', '2026-11-11', 'finish', '2026-11-13')));
   END $$;
   ROLLBACK;
   ```

   Expect `ERROR: The schedule changed while you were working.` with `DETAIL: {"read": 1, "version": 2, "changes": [{"version": 2, … "words": "A check: the first move, then rolled back."}]}`. Then PR 2's count query, which should still read zeros: nothing stayed.

5. **Nobody signed out calls them.** Run `BEGIN; SET LOCAL ROLE anon; SELECT public.gc_schedule_bump(gen_random_uuid(), 0, 'A check.'); ROLLBACK;` and expect `ERROR: permission denied for function gc_schedule_bump`.

Then `npm run check:migration-drift`, and the types PR (`npm run gen-types:linked`).

## Rollback

Nothing calls these until the schedule's PR 6. Going back is a new migration with two steps. First it drops the ten triggers: `DROP TRIGGER IF EXISTS gc_schedule_plan_guard ON public.<table>`. Then it drops the 23 functions with `DROP FUNCTION IF EXISTS`, each with its arguments as the migration declares them.

## Status

Written 2026-10-08 for the schedule's PR 5; not applied. The lead pushes it after PR 4's, and records here what steps 1 to 5 said.
````

## Drift from `SCHEDULE_REAL_BUILD.md`

These are what this plan does that *Writing it* does not say, or says another way. PR 5's own commit on the spike amends *Writing it* to match, line by line, once the lead agrees.

- **The guard** (call 1) is new. It makes decision 5's version a rule of the database.
- **The days from the server** (call 2): `app_today()` in every function.
- **One `gc_schedule_move`** (call 3): no `gc_schedule_pull` and no `gc_schedule_recover`.
- **The walk is a plain insert** (call 4): no `gc_schedule_walk`.
- **Undo and Redo send the move's id** (call 5), and the server replays its record.
- **A line's bar takes its scope line's id** (call 6), so "Two ids meet in it" becomes one.
- **The template refusals are the kernel's** (call 7).
- **The wait's function is `gc_schedule_add_wait`**, not `gc_schedule_wait`, so its name says what it does beside the plain writes that change one.
- **The plan at Start** is kept by every plan write but the draw and the baseline: decision 7's "the first plan write after Start", word for word. The prototype kept it on five presses only. So now a split, a join, or the job's own work taken off, made first after Start, keeps the plan as it stood before it too.
- **A first draft makes version 1** with its words, and a second first draft is refused like any stale press. That settles PR 2's open question.
- **A copy's places** are the real bars' (decision 6), read so by the mapper (PR 6). So `gc_schedule_set_places` writes the real bars only, and never a copy's JSON.
- **The refusal's DETAIL** is `{ read, version, changes: [{ version, at, by, name, words }] }`.
- **The SQL is tested** in a whole-schema bed on CI before the push. PR 2 to 4 said there is no local Postgres; there still is not, but GitHub's runners have Docker.

## The check

- **Before the merge (CI)**: `scripts/check-migrations.sh` (the lock timeout and unique stamps), `src/lib/releaseNotes.test.ts`, the new words test and the template tests in `npm test`, and the new *SQL beds* check, which runs the whole scenario against every migration.
- **By hand before opening the PR**:
  - Read the SQL against PR 2 to 4's tables, name by name: every column, constraint and key it writes.
  - Grep that every name it calls exists on main: `public.app_today()`, `auth.uid()`, `public.users(name)`, and PR 2 to 4's twenty-three tables.
  - Run `npx vitest run src/lib/gc` and the release notes test, `npx eslint` on the touched TS files, and `npm run typecheck` in the background.
- **After the push (the lead)**: the doc's *Verify after the push*, steps 1 to 5. Step 4 is the build doc's own check: two moves on one version, the second refused with the first's words.
- **Then** `npm run check:migration-drift` and the types PR. PR 6 waits for the types, since the new function names fail `npm run typecheck` until they are in `src/types/database.ts`.

## When it is cut

1. After the lead's go, branch from `origin/main`. PR 4 is on main. If Helper 5's O2a or Helper 3's P0 has merged, they changed `testState.ts` and two direct tests, and PR 5 rebases on them.
2. Take the next stamp after main's newest and after every claim not yet merged. The claims reached `20261008030000` tonight, so the stamp will be `20261008040000` or later. Claim it from the PR's own branch: `npm run claim -- --migration supabase/migrations/<stamp>_gc_schedule_writes.sql`.
3. Claim the version with `npm run claim -- --branch <branch>`. Fill it into the eighteen `v2.NNNN` (the header's and each function's comment), the runner's header, and the doc's first line.
4. Add the migration, its doc, the scenario, the runner, its `package.json` line (`"test:pg:gc-schedule": "bash scripts/pgtest-gc-schedule.sh"`), the workflow, `templateSaveProblem` with its tests, the words test, the release note and its fragment.
5. Run the checks above.
6. Open the PR and wait for *SQL beds* to go green. It is not a required check, so an early `gh pr merge <n> --auto` could merge before it finishes. Then arm it with `gh pr merge <n> --auto`.
7. Message the lead that a migration is waiting, with the PR and the bed's run. I never apply it.

**The release note** (infra, dev), two bullets:

- The GC mode schedule gets its writes. Every change to a schedule's plan checks the version it read. When two people change one schedule at once, the second is told what changed and by whom, and nothing of theirs is lost.
- The plan changes only through those writes, even for a dev, and each change is kept with its words. Only a dev can use them while they are built, and no screen calls them yet.

**The fragment** starts `# v2.NNNN — GC mode: the schedule's writes, so two people on one schedule never overwrite each other (2026-10-08)`, names the migration and its doc, and lists the functions, the guard, the bed and the workflow, as PR 4's fragment did.

## Docs this PR touches

- `docs/migrations/<stamp>_gc_schedule_writes.md`, as above.
- `src/content/releaseNotes/v2.NNNN.ts` and `docs/recent-features/v2.NNNN.md`.
- The bed's home is its runner's header and the migration doc, as with every other bed.
- No help guide, since nothing a person sees changes. No `docs/ACCESS_CONTROL.md`: the tables stay dev only, and the functions are invokers. No `PROJECT_DOCUMENTATION.md`, `GLOSSARY.md` or `docs/EDGE_FUNCTIONS.md`: no screen and no function.
- On the spike: *Writing it* in `SCHEDULE_REAL_BUILD.md`, as *Drift* says, and its *Status*.

## What later PRs take from this

- **PR 6, the mapper and the io**:
  - One function the screen calls for each of these, building the payloads from the kernel's records.
  - The refusal read from `DatabaseError.serverMessage` and `details`.
  - A template's duplicate name (23505) mapped to *Another template has that name.*
  - Moves read newest first by (`schedule_version`, `made_at`).
  - A copy's places read from the real bars.
  - `lineId` is the bar's id.
- **PR 7, the tab, read only**:
  - It gates itself to `role === 'dev'` until PR 10. Door 1 opens `/gc` to the office, so the page's own gate no longer holds it (the lead's note).
  - It lifts `GcGantt.tsx` from the spike after Helper 7's G-13 control lands there (Helper 7's note).
- **Helper 7's G-130** (`network.ts`) fits between this PR and PR 8. It touches no file here.
- **PR 8, moves**: the window reads the refusal. It says *It was saved.* when every change since is this person's own, with the same words.
- **PR 10, the team**:
  - `gc_on_schedule_team()` calls Helper 6's `gc_office_team()` for its office branch (door 1).
  - The guard stays as it is.
  - These functions need no change, since RLS decides.
- **PR 16, the readers**:
  - A plan set that pushes the schedule comes through `gc_schedule_bump`, as the guard requires.
  - A trade's part report writes record columns, which the guard lets through.

## Is this the best we can do?

Three ways it could be better:

1. **Run the SQL before it reaches prod.** No session on the office Mac can run Postgres: Docker
   answers "permission denied", and there is no server binary. So PRs 2 to 4 met their first Postgres
   on prod, in the lead's verify steps. That was safe for empty tables. Twenty-three functions are
   another matter, and the verify steps on prod reach only the draw and two moves. GitHub's runners
   have Docker. *I pick it, in this PR:* the workflow and the bed above. The PR is armed only once
   *SQL beds* is green. The cost is one small workflow file, which every later SQL PR in the lane can
   reuse by adding its bed to the list.
2. **A press sent twice.** If the answer to a saved press is lost after the commit, the person
   presses again on the old version and their own change refuses them. The window can say *It was
   saved.* when every change since is theirs (PR 8). The other way is a press id, kept unique on its
   change line, so a repeat gets back the version it made. *Not now:* PR 8's reading covers it with
   no new column. A press id would add a column to PR 2's table and an argument to every write. If
   testers ever see a repeat refused, it is a small migration.
3. **A bar that goes with its scope line moves no version.** The guard lets a cascade through. So a
   scope line taken off a job with a schedule takes its bar with no line of words. A press made before
   it is then refused as *A bar in this change is not on this schedule*: worded, but without who or
   why. A trigger could write that change's line. *Not now:* nothing takes a scope line off a job
   with a schedule today, and PR 16's plan sets come through the version on purpose. If a door to take
   scope off after award ever appears, it goes through `gc_schedule_bump` like any plan write.

## Status

Plan written 2026-10-07 by Helper 1 at the lead's ask, on `spike/schedule-pr5-plan` from
`origin/spike/gc-mode` at e00f74a7e, and checked against `main` at 043b04edb. PR 4 merged as #4835 (3fea13814).

- The SQL was written and read through by hand. No Postgres runs on this Mac, so nothing in it has
  run yet. Its first run is the *SQL beds* check on the PR (way 1).
- The words test and the template tests are written out here, not run. They run with `npm test` when
  the PR is cut.
- Seams agreed tonight:
  - with Helper 3: the trades' `gc_trade_*` functions in PRs 13, 14 and 16, and LIFTS left to their follow-up;
  - with Helper 5: `timeExtension.ts` stays at `src/lib/gc/`, and `whatIfDiff` waits for PR 11 on their forecast;
  - with Helper 7: G-130 goes between PR 5 and PR 8, and G-13's control lands before PR 7 lifts the chart.
- The owner's calls this plan raises: none. The seven calls are the lead's.
