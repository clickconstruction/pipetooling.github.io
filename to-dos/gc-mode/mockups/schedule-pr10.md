---
name: "The schedule's PR 10: the schedule opens to the office team and the job's project manager"
rows: SCHEDULE_REAL_BUILD.md, decision 4 (who may move a bar), Who may read and write (G-133) and The PRs in order, 10; door-2-board.md, the pattern; the ledger's "PR 10 the team door, files the print"
branch: the plan on claude/gc-schedule-pr10-plan (from origin/spike/gc-mode at 22631c2a7); the PR from origin/main, its own migration
status: plan 2026-10-09 by gc 1, the Schedule lane, at the lead's ask. The lead's calls the same day: the office team and the project manager now; the job's superintendent waits for Building's door, which owns /gc for the field; no cross-lane migration. Nothing cut or claimed. The PR is built and held. It arms only after the schedule's first live walk on prod, which waits on Grace's own yes.
---

# The schedule's PR 10: the schedule opens to its team

## What it is

The schedule has been a dev's since PR 7b. Its 23 tables are `is_dev()` only, and so is its one door on
`/gc`: the **Schedule** button on each project's card and its window. PR 10 opens both to the people
who run a job:

- **The GC office**: dev, the leaders, the assistants, the controller and estimators, as
  `gc_office_team()` names them since door 2.
- **The job's project manager**: `gc_projects.project_manager_user_id`.

They read and write alike, since the schedule carries no money (decision 4). One helper,
`gc_on_schedule_team(project_id)`, holds that audience, and every policy calls it. Building's door adds
the job's superintendent there later, in one place.

It also files the print. The chart's **Print or PDF** goes to the customer and the trades, so it keeps a
copy in Documents like every other print (`docs/SENT_COPIES.md`). `GcGanttPrint.tsx` comes off
`PRINTS_OWED`.

## What stays

- **The job's superintendent** sees nothing yet. The `/gc` page, `gc_projects` and the board's reads are
  the office's (door 1's `_team` policies). A superintendent who could read the schedule could not open
  the page that shows it. Building's door opens `/gc` to the field, and it adds the superintendent
  to the schedule's helper in the same PR (*What Building's door adds* below).
- **Subcontractors, helpers and primaries** match no branch, so they see nothing.
- **The trades and the customer** have no policy on any table. They read through their portals'
  functions, which run with the service role and check the link.
- **The append-only rows** stay append-only. Privileges hold them, not a missing policy, so no policy
  can open them. They are `gc_schedule_changes`, `gc_schedule_moves` (but `undone_on` and
  `undone_by`), its pushes, tells and answers, and `gc_schedule_templates` (but `name` and `aside_on`).
  `gc_schedule_late_notices` keeps its one column grant, *pushed back*.
- **Training mode and twins.** The restrictive blocks the three migrations made stay untouched. A
  `users.read_only` user reads and never writes. A digital twin is an estimator, so it reads the
  schedule, and the fence refuses its writes, since no schedule row is its own bid's.
- **anon** has no grant on any of the 23 tables.

## The functions need no change

Every schedule function in `20261008040000_gc_schedule_writes` is `SECURITY INVOKER` with no role check
inside, so the policies are their gate too. The same holds for the three other lanes' functions that
read or write the schedule's rows:

- `gc_draft_time_extension` (Owner Billing's O3) counts the named moves in `gc_schedule_moves`. Today a
  leader or the controller is refused *Each move must be one of this job's schedule moves*, since the
  moves read empty for them. PR 10 lets them draft one.
- `gc_trade_rfi_ask` and `gc_trade_sow_report` run under the portals' service role, so nothing changes.

No function writes a child row in the same statement as its parent. Each insert of a part, a push, a
failure or a baseline's dates comes after the row it hangs from, in its own statement, so a child's
policy can look its job up.

## The 23 policies, named

Each `<table>_dev` policy goes, and a `<table>_team` policy takes its place: one policy a table, for every
verb, `USING` and `WITH CHECK` alike.

**Fourteen carry their job** (`gc_on_schedule_team(project_id)`):

| From `20261007210000` | From `20261007220000` | From `20261007235500` |
|---|---|---|
| `gc_schedules_dev` | `gc_schedule_late_notices_dev` | `gc_rough_schedules_dev` |
| `gc_schedule_activities_dev` | `gc_schedule_walks_dev` | |
| `gc_schedule_links_dev` | `gc_schedule_moves_dev` | |
| `gc_schedule_milestones_dev` | `gc_schedule_waits_dev` | |
| `gc_schedule_baselines_dev` | `gc_schedule_wait_holds_dev` | |
| `gc_schedule_changes_dev` | `gc_schedule_crew_counts_dev` | |
| | `gc_schedule_sends_dev` | |

**Four reach their job through their activity** (`gc_on_schedule_team(gc_schedule_activity_project(activity_id))`):
`gc_schedule_activity_parts_dev`, `gc_schedule_inspection_failures_dev`,
`gc_schedule_baseline_dates_dev` and `gc_schedule_lookahead_marks_dev`.

**Three reach it through their move** (`gc_on_schedule_team(gc_schedule_move_project(move_id))`):
`gc_schedule_move_pushes_dev`, `gc_schedule_move_tells_dev` and `gc_schedule_move_answers_dev`.

**Two have their own shape:**

- `gc_schedule_what_ifs_dev`: a what-if copy stays its own person's (decision 6). The team check, and
  `user_id = (SELECT auth.uid())`.
- `gc_schedule_templates_dev`: a template belongs to no job. Anyone on the team of any GC job,
  `(SELECT gc_on_any_schedule_team())`, asked once a statement.

The two lookups, `gc_schedule_activity_project` and `gc_schedule_move_project`, are `STABLE SECURITY
DEFINER`. They return a row's job, and nothing more, so a child's policy never runs a subquery under its
parent's policy.

## What the screens read

**`src/lib/gc/access.ts`** gains the client's copy:

- `GC_SCHEDULE_TEAM`, the same five roles as `GC_OFFICE_TEAM`, and `canUseGcSchedule(role)`.
- The project manager is not a role, so the client cannot know it. That costs nothing today: a project
  manager outside the office cannot open `/gc` at all.
- Building's door widens this list with the page's gate.

**`src/pages/GcProjects.tsx`** has three gates, not two. Each `role === 'dev'` becomes
`canUseGcSchedule(role)`:

1. The **Schedule** button on each project's card (line 1095).
2. The window's project (line 970).
3. `canMove` on `GcScheduleWindow` (line 1270). The team reads and writes alike, so whoever opens it
   may move a bar.

The comments at lines 220 and 969, `GcSchedule.tsx`'s line 82 and `GcScheduleWindow.tsx`'s header
lose "a dev's until the schedule's PR 10".

**Two readers in another lane see real rows for the first time.** The money lens and the bill window
(`GcProjects.tsx` lines 729 and 767, Owner Billing's O6b-3) read each job's schedule for its late finish.
Under the dev-only policy a leader or the controller read none, so no late finish fee showed. After
PR 10 it shows. That is the lane's intent, and Helper 15 (gc 5 on this Mac) hears it before the PR arms.

## Print or PDF files a copy

`GcGanttPrint.tsx`'s **Print or PDF** calls `printAndFile(html, filing)` in place of
`printHtmlInNewWindow(html)`:

- `kind: 'gc_schedule_print'`. It lands under *Other* on the Documents page, since no group claims
  `gc_schedule`.
- `title`: the print's own title, the one a browser offers as the PDF's name.
- `recipientName`: the customer's name on the customer's pages. *The job's team* on the team's pages,
  which go to the trades on site.
- `customerId`: the project's customer.
- `source`: `{ table: 'gc_schedules', id: projectId }`.
- No `jobIds`. A GC project is not a Pipeline job until Start, and the board's project carries no
  billing job. The copy shows on the Documents page and under the customer.

`GcSchedule.tsx` passes the project's id, its customer's id and name in the new `filing` prop beside
`input`. A blocked pop-up files nothing, and the window says *The print window was blocked. Allow
pop-ups for this site and press it again.*, as the other `printAndFile` callers do. A repeat of the same
pages points at the first file (the copy's hash), so pressing it twice does not pile up.

`sentCopiesCoverage.test.ts` loses its only `PRINTS_OWED` row, and the list is empty. The stale check
fails if the row is left in.

## The doors list

`src/lib/gc/doors.ts` gains a fourth door:

- `schedule`: `gc_on_schedule_team(project)`. The GC office and the job's project manager, and the job's
  superintendent once Building's door adds it.
- The 23 schedule entries become `schedule('Schedule')`, and `SCHEDULE_OPENS` goes.
- `doors.test.ts`'s `doorOf` reads `gc_on_schedule_team(` or `gc_on_any_schedule_team(` as `schedule`,
  before the office check.
- One new test, in door 2's shape: the 23 tables read `schedule`, and the what-if policy still names
  `auth.uid()`.
- `access.test.ts` pins `GC_SCHEDULE_TEAM` to `gc_office_team()`'s roles while `doors.ts` lists the
  schedule as `schedule`, so Building's door changes both.

## The guides

Seven guides say *Only devs can … for now. The rest of the office gets the Schedule window later.*,
not six. 7c-ii's *see who to call about the schedule* is the seventh:

- *move a bar on the schedule and say why*
- *record an inspection on the schedule*
- *add the job's own work to the schedule*
- *see who to call about the schedule*
- *track what the work waits on*
- *split a line into parts*
- *set a new baseline after a change order*

Each one's `roles: dev` becomes `roles: dev, master_technician, assistant, controller, estimator`, as door
2's guides read. The sentence becomes *The office and estimators can open the schedule. Superintendents
get it later.* That passes `src/lib/plainWords.ts`'s rules.

## The bed cases

`supabase/tests/gc_schedule/` holds the schedule's bed (`scripts/pgtest-gc-schedule.sh`, already a line
in `scripts/sql-beds.txt`).

**One step in `20_scenario.sql` must change**, or it passes for the wrong reason:

- Step 14's *a move by someone the policies keep out* is an estimator today. After PR 10 an estimator is
  on the team, and the move would save.
- It becomes a subcontractor, with the same refusal, *This job has no schedule yet.*
- The header's *an estimator (no policy on the schedule's tables yet)* becomes *a subcontractor*.

**A new `30_team_door.sql`** runs after it. The script runs both, and applies the door's migration a
second time first, which must change nothing. Its cases, each as `authenticated` with the claim set
first, inside one transaction that rolls back:

1. **An estimator** reads P's bars, moves one with the version it read (the version goes up by one),
   and reads that move's pushes. That is a child read through `gc_schedule_move_project`.
2. **An assistant in training mode** reads P's bars, and its move is refused: *Read-only (training) mode:
   changes are blocked.*
3. **An estimator who is a digital twin** reads P's bars, and its move is refused by the fence.
4. **The project manager**: a user whose role is `superintendent`, named in `project_manager_user_id`
   on P only.
   - It reads P's bars and P's parts after a split.
   - It reads none of Q's bars, and its move on Q is refused: *This job has no schedule yet.*
   - It reads the templates.
5. **The job's superintendent**: a `project_superintendents` row on P, not the project manager. It reads
   0 rows from each of the 23 tables, which pins the lead's call. Building's door flips this case.
6. **A subcontractor** reads 0 rows from each of the 23 tables, the templates included.
7. **A what-if copy**: the estimator keeps its own on P. The assistant reads 0 of it, and the
   estimator's insert with someone else's `user_id` is refused by the policy.
8. **Append-only**: as the estimator, an `UPDATE` of `gc_schedule_changes.words` and a `DELETE` from
   `gc_schedule_moves` are each refused with *permission denied*. The policy lets them in. The
   privilege does not.
9. **anon** gets *permission denied* on `gc_schedules`.

It ends with *gc_schedule team door PASSED*. The script greps for both lines.

## Verify after the push

On prod, each step through the management API's query endpoint (`to-dos/gc-mode/scripts/verify/`,
a new `verify-<stamp>.mjs`), each in `BEGIN … ROLLBACK`:

1. **The catalog, read only.**
   - Each of the 23 tables has one `<table>_team` policy and no `_dev`.
   - The four functions read `prosecdef` true.
   - `gc_schedule_changes` still shows no `UPDATE` or `DELETE` grant to `authenticated`.
   - `anon` holds nothing on the 23.
2. **Reads per role, rolled back.**
   - A sample estimator and a sample assistant read `gc_schedules`. The schedule has no row on prod
     until the first walk, so the count is the same as a dev's.
   - A sample superintendent and a sample primary read 0.
3. **A write, rolled back.**
   - As a sample estimator, `gc_schedule_draft` on "GC test project, delete me" returns version 1.
   - Then it rolls back, so nothing is left.
   - As a training account, the same draw is refused.
4. **The page**, a dev through **View as…**, after the client is on Pages:
   - *Sample estimator*: the test project's card shows **Schedule**, and the window opens.
   - *Sample primary*: `/gc` lands on the Dashboard as before.

Step 3 writes inside a transaction that never commits, the way the 10-09 verify scripts did. It sends
nothing.

## The PR

**Title:** `v2.NNNN GC mode: the schedule opens to the office team and the job's project manager, and
its print files a copy (real build, schedule PR 10, migration <stamp>)`

**Files:**

- `supabase/migrations/<stamp>_gc_schedule_team_door.sql`, the block below.
- `docs/migrations/<stamp>_gc_schedule_team_door.md`: what it opens, what stays, the bed's matrix as it
  came out, the four verify steps, and the rollback. The rollback re-creates the 23 `_dev` policies as
  the three migrations wrote them, drops the `_team` ones and drops the four functions.
- `src/lib/gc/access.ts` and `access.test.ts`; `src/lib/gc/doors.ts` and `doors.test.ts`.
- `src/pages/GcProjects.tsx` (three gates, two comments); `GcSchedule.tsx` (the filing prop, a comment);
  `GcScheduleWindow.tsx` (its header).
- `GcGanttPrint.tsx` and `GcGanttPrint.render.test.tsx`. The test mocks `sentCopiesIo` and holds the
  filing: its kind, title, recipient and source, and nothing filed on a blocked pop-up.
- `src/lib/sent/sentCopiesCoverage.test.ts`: `PRINTS_OWED` loses its row.
- The seven guides' `roles` and their one sentence.
- `supabase/tests/gc_schedule/20_scenario.sql` (step 14), `30_team_door.sql` (new),
  `scripts/pgtest-gc-schedule.sh` (runs both, re-applies the door).
- `docs/ACCESS_CONTROL.md` line 147: *The schedule's 23 tables … stay dev only until the schedule's PR 10*
  becomes the team, the helper, the project manager, and the superintendent at Building's door.
- `PROJECT_DOCUMENTATION.md`'s schedule paragraph: *a dev's* becomes the office team's.
- `src/content/releaseNotes/v2.NNNN.ts` (roles: the office team) and
  `docs/recent-features/v2.NNNN.md`.

**Checks:**

- The bed green in CI.
- vitest over `src/lib/gc`, `src/components/gc`, `GcProjects`, `src/lib/sent`, `releaseNotes`, the four
  help-guide suites and `src/lib/twins`.
- eslint on the changed files; theme, timezone, pronouns and the five window checks.
- `bash scripts/check-migrations.sh`.
- `npm run typecheck` last.

**After the merge**, the lead's:

1. `bash scripts/db-push.sh` from the clean checkout.
2. The four verify steps, and a Status docs PR.
3. "pushed <stamp>" for the types. The four new functions join `database.ts`'s Functions, and no client
   code calls them.
4. Tell Helper 15 that the money lens reads real schedules, and tell Building's lane the two lines it
   adds.

## What Building's door adds

One `CREATE OR REPLACE` of each helper, with a third arm in both:

```sql
OR EXISTS (
  SELECT 1 FROM public.gc_projects g
  JOIN public.project_superintendents s ON s.project_id = g.project_id
  WHERE g.project_id = p_project_id AND s.superintendent_id = auth.uid() AND public.is_superintendent()
)
```

That is `can_access_project_row`'s own superintendent branch, assigned only (v2.2836). The helper does
not call `can_access_project_row` itself, because it lets primaries in too. `gc_on_any_schedule_team()`
takes the same arm without the job, and `GC_SCHEDULE_TEAM` gains `superintendent` with the page's gate.
No policy changes.

## Is this the best we can do?

Three ways it could be better:

1. **The office asked once a statement, not once a row.**
   - Every policy calls `gc_on_schedule_team` for each row. A `SECURITY DEFINER` SQL function is never
     inlined, so a read of one job's 200 bars makes 200 calls, each two index lookups.
   - That is a few milliseconds today. A policy of `(SELECT gc_office_team()) OR
     gc_on_schedule_team(project_id)` would skip the per-row work for the office.
   - It costs naming the audience in two places, which door 2 ruled out. I would wait until a read is
     slow.
   - The children could also carry `project_id` themselves, a column and a backfill on seven tables,
     so no lookup runs. That is too much DDL for a door.
2. **A project manager picker.**
   - The project manager arm reads a column nothing writes yet: no form and no function sets
     `project_manager_user_id`.
   - Until one does, the door opens to the office alone, and the arm is ready.
   - New project's form, or the Board's Get started (B6-c), is its natural place. A project manager
     outside the office would still need the page's gate, the same as a superintendent.
3. **A test that holds the append-only grants.**
   - The append-only rows rest on `REVOKE` lines in three migrations. A later door that granted
     `UPDATE` on `gc_schedule_changes` would open the ledger with no policy changing.
   - `doors.test.ts` could read the grants as it reads the policies, and fail when one of the append-only
     tables gains `UPDATE` or `DELETE` for `authenticated`.

## Status

- 2026-10-09: planned by gc 1 at the lead's ask, from main at 624aa2926 and the spike at 22631c2a7. Not
  cut, not claimed.
- The PR is built and held. It arms only after the schedule's first live walk on prod (Grace's own yes,
  typed in the lane's chat), as the lead set.

## The SQL as it will be

```sql
SET lock_timeout = '3s';

-- GC mode, the schedule's PR 10 (v2.NNNN): the schedule opens to its team (G-133,
-- to-dos/gc-mode/mockups/schedule-pr10.md on branch spike/gc-mode).
--   1) public.gc_on_schedule_team(project) says who is on one job's schedule: the GC office
--      (gc_office_team(): dev, the leaders, the assistants, the controller and estimators) and the
--      job's project manager (gc_projects.project_manager_user_id). Building's door adds the job's
--      superintendent here and in the next function, and nowhere else.
--   2) public.gc_on_any_schedule_team() says who is on the team of any GC job, for the templates,
--      which belong to no job.
--   3) Two lookups give a child row its job: its activity's, or its move's.
--   4) The 23 tables swap their dev-only policy for the team, one policy each for every verb. A what-if
--      copy stays its own person's. The functions on them are SECURITY INVOKER, so this is their gate
--      too.
-- What stays: the append-only rows keep their missing UPDATE and DELETE privileges, which no policy
-- can open. anon has no grant on any of the 23. The trades and the customer read through their
-- portals' functions, never these tables. src/lib/gc/doors.ts lists each table's door; doors.test.ts
-- holds the migrations to it.

-- 1) Who is on one job's schedule.
CREATE OR REPLACE FUNCTION public.gc_on_schedule_team(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.gc_office_team()
    OR EXISTS (
      SELECT 1 FROM public.gc_projects g
      WHERE g.project_id = p_project_id AND g.project_manager_user_id = auth.uid()
    );
$$;

COMMENT ON FUNCTION public.gc_on_schedule_team(uuid) IS
  'GC mode (the schedule''s PR 10, v2.NNNN): who may read and write one GC job''s schedule (G-133): the GC office (gc_office_team()) and the job''s project manager. Building''s door adds the job''s superintendent here and in gc_on_any_schedule_team(). Change the audience here, never in a policy. The client''s copy is GC_SCHEDULE_TEAM in src/lib/gc/access.ts.';

-- 2) Who is on the team of any GC job: the templates.
CREATE OR REPLACE FUNCTION public.gc_on_any_schedule_team()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.gc_office_team()
    OR EXISTS (SELECT 1 FROM public.gc_projects g WHERE g.project_manager_user_id = auth.uid());
$$;

COMMENT ON FUNCTION public.gc_on_any_schedule_team() IS
  'GC mode (the schedule''s PR 10, v2.NNNN): who may read and write the schedule templates, which belong to no job: anyone gc_on_schedule_team() lets onto some GC job. Building''s door adds the superintendent here too.';

-- 3) A child row's job.
CREATE OR REPLACE FUNCTION public.gc_schedule_activity_project(p_activity_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT project_id FROM public.gc_schedule_activities WHERE id = p_activity_id;
$$;

COMMENT ON FUNCTION public.gc_schedule_activity_project(uuid) IS
  'GC mode (the schedule''s PR 10, v2.NNNN): the GC job a schedule activity is on, for the policies of the rows that hang from an activity (its parts, an inspection''s failures, a baseline''s dates, the look-ahead marks).';

CREATE OR REPLACE FUNCTION public.gc_schedule_move_project(p_move_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT project_id FROM public.gc_schedule_moves WHERE id = p_move_id;
$$;

COMMENT ON FUNCTION public.gc_schedule_move_project(uuid) IS
  'GC mode (the schedule''s PR 10, v2.NNNN): the GC job a schedule move is on, for the policies of the rows that hang from a move (its pushes, tells and answers).';

REVOKE EXECUTE ON FUNCTION public.gc_on_schedule_team(uuid), public.gc_on_any_schedule_team(),
  public.gc_schedule_activity_project(uuid), public.gc_schedule_move_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_on_schedule_team(uuid), public.gc_on_any_schedule_team(),
  public.gc_schedule_activity_project(uuid), public.gc_schedule_move_project(uuid) TO authenticated, service_role;

-- 4) The 23 tables: one policy each for every verb.
-- The fourteen that carry their job.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gc_schedules', 'gc_schedule_activities', 'gc_schedule_links', 'gc_schedule_milestones',
    'gc_schedule_baselines', 'gc_schedule_changes', 'gc_schedule_late_notices', 'gc_schedule_walks',
    'gc_schedule_moves', 'gc_schedule_waits', 'gc_schedule_wait_holds', 'gc_schedule_crew_counts',
    'gc_schedule_sends', 'gc_rough_schedules'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_dev', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_team', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.gc_on_schedule_team(project_id)) WITH CHECK (public.gc_on_schedule_team(project_id))',
      t || '_team', t);
  END LOOP;
END $$;

-- The four that reach their job through their activity.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gc_schedule_activity_parts', 'gc_schedule_inspection_failures', 'gc_schedule_baseline_dates',
    'gc_schedule_lookahead_marks'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_dev', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_team', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.gc_on_schedule_team(public.gc_schedule_activity_project(activity_id))) WITH CHECK (public.gc_on_schedule_team(public.gc_schedule_activity_project(activity_id)))',
      t || '_team', t);
  END LOOP;
END $$;

-- The three that reach it through their move.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gc_schedule_move_pushes', 'gc_schedule_move_tells', 'gc_schedule_move_answers'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_dev', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_team', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.gc_on_schedule_team(public.gc_schedule_move_project(move_id))) WITH CHECK (public.gc_on_schedule_team(public.gc_schedule_move_project(move_id)))',
      t || '_team', t);
  END LOOP;
END $$;

-- A what-if copy stays its own person's (decision 6).
DROP POLICY IF EXISTS gc_schedule_what_ifs_dev ON public.gc_schedule_what_ifs;
DROP POLICY IF EXISTS gc_schedule_what_ifs_team ON public.gc_schedule_what_ifs;
CREATE POLICY gc_schedule_what_ifs_team ON public.gc_schedule_what_ifs FOR ALL TO authenticated
  USING (public.gc_on_schedule_team(project_id) AND user_id = (SELECT auth.uid()))
  WITH CHECK (public.gc_on_schedule_team(project_id) AND user_id = (SELECT auth.uid()));

-- A template belongs to no job: anyone on the team of any GC job, asked once a statement.
DROP POLICY IF EXISTS gc_schedule_templates_dev ON public.gc_schedule_templates;
DROP POLICY IF EXISTS gc_schedule_templates_team ON public.gc_schedule_templates;
CREATE POLICY gc_schedule_templates_team ON public.gc_schedule_templates FOR ALL TO authenticated
  USING ((SELECT public.gc_on_any_schedule_team())) WITH CHECK ((SELECT public.gc_on_any_schedule_team()));
```
