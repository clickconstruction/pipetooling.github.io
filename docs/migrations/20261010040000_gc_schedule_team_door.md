# 20261010040000_gc_schedule_team_door

**Version:** v2.5114 · **Date:** 2026-10-09 · **Plan:** `to-dos/gc-mode/mockups/schedule-pr10.md` on `spike/gc-mode` (GC mode, the schedule's PR 10). The migration is the plan's last ```sql block byte for byte, with only `v2.NNNN` filled in.

## What it does

- **One helper holds the schedule's audience.** `gc_on_schedule_team(p_project_id)` is true for the GC office (`gc_office_team()`: dev, the leaders, the assistants, the controller and estimators) and for the job's project manager (`gc_projects.project_manager_user_id = auth.uid()`). It is `STABLE SECURITY DEFINER`.
- **A twin for the templates.** `gc_on_any_schedule_team()` is true for the office and for the project manager of any GC job. A template belongs to no job.
- **Two lookups give a child row its job.** `gc_schedule_activity_project(activity_id)` and `gc_schedule_move_project(move_id)`, both `STABLE SECURITY DEFINER`. A child's policy never runs a subquery under its parent's policy.
- **The 23 tables swap `<table>_dev` for `<table>_team`**, one policy each for every verb, `USING` and `WITH CHECK` alike:
  - fourteen carry `project_id` and call the helper on it: `gc_schedules`, `gc_schedule_activities`, `gc_schedule_links`, `gc_schedule_milestones`, `gc_schedule_baselines`, `gc_schedule_changes`, `gc_schedule_late_notices`, `gc_schedule_walks`, `gc_schedule_moves`, `gc_schedule_waits`, `gc_schedule_wait_holds`, `gc_schedule_crew_counts`, `gc_schedule_sends` and `gc_rough_schedules`;
  - four reach their job through their activity: `gc_schedule_activity_parts`, `gc_schedule_inspection_failures`, `gc_schedule_baseline_dates` and `gc_schedule_lookahead_marks`;
  - three reach it through their move: `gc_schedule_move_pushes`, `gc_schedule_move_tells` and `gc_schedule_move_answers`;
  - `gc_schedule_what_ifs` adds `user_id = (SELECT auth.uid())`, so a what-if copy stays its own person's;
  - `gc_schedule_templates` takes `(SELECT gc_on_any_schedule_team())`, asked once a statement.
- **The functions need no change.** Every schedule function (`20261008040000_gc_schedule_writes`) is `SECURITY INVOKER` with no role check, so the policies are their gate. Owner Billing's `gc_draft_time_extension` counts the named moves as its caller, so a leader or the controller may now draft one; before, the moves read empty for them and it refused. The trade functions that touch the schedule's rows run under the portals' service role.

**Stays as it was:**

- **The job's superintendent sees nothing yet.** `/gc`, `gc_projects` and the board's reads are the office's. Building's door adds the superintendent to both helpers (a `project_superintendents` arm, assigned only, as `can_access_project_row` reads it), and no policy changes then.
- **Subcontractors, helpers and primaries** match no branch.
- **The trades and the customer** have no policy on any table. They read through their portals' functions.
- **Ten tables stay append-only by privilege**, which no policy can open: `gc_schedule_changes`, `gc_schedule_moves` (but `undone_on`, `undone_by`), `gc_schedule_move_pushes`, `gc_schedule_move_tells`, `gc_schedule_move_answers`, `gc_schedule_late_notices` (but the three *pushed back* columns), `gc_schedule_walks`, `gc_schedule_crew_counts`, `gc_schedule_sends` and `gc_schedule_templates` (but `name`, `aside_on`). `GC_SCHEDULE_APPEND_ONLY` in `src/lib/gc/doors.ts` lists them; `doors.test.ts` reads every `GRANT` and `REVOKE` in the migrations and fails when one gains a table-wide write or a column grant the list does not name.
- **Training mode and twins.** The restrictive blocks are untouched. A `users.read_only` user reads and never writes. A digital twin is an estimator: it reads the schedule, and the fence refuses its writes. One wrong-words bug, not a hole: the fence hides `gc_schedules` from `gc_schedule_bump`'s `UPDATE`, so a twin's plan write is refused with *The schedule changed while you were working.* Nothing is written. The follow-up is to name the fence there.
- **anon** has no grant on any of the 23.

`src/lib/gc/doors.ts` lists the 23 behind a fourth door, `schedule`, and `doors.test.ts` reads `gc_on_schedule_team(` and `gc_on_any_schedule_team(` as it. `GC_SCHEDULE_TEAM` / `canUseGcSchedule` in `src/lib/gc/access.ts` is the page's copy: the office's five roles. A project manager is not a role, and one outside the office cannot open `/gc` yet.

## Checked before the push: the bed

`scripts/pgtest-gc-schedule.sh` applies every migration to the Supabase Postgres image, re-applies this one (it must change nothing), runs `supabase/tests/gc_schedule/20_scenario.sql` and then `30_team_door.sql`. Locally on 2026-10-09: 107 checks, both PASSED.

- `20_scenario.sql` step 14, *a move by someone the policies keep out*, was an estimator. After this door an estimator is on the team, so it is a subcontractor now, with the same refusal.
- `30_team_door.sql`, its own fixture, two jobs P and Q, rolled back:

| Who | Reads | Writes |
|---|---|---|
| estimator | P's bars, a move's pushes (through its move), a split's parts (through their activity) | a move on the version it read (v2), a split (v3) |
| assistant, training mode | P's bars | refused: *Read-only (training) mode: changes are blocked.* |
| estimator, digital twin | P's bars | refused, nothing written (the wrong-words bug above) |
| project manager (a superintendent by role) | P's bars and parts, the estimator's move's push (through its move), the templates; none of Q's | a move on P (v4); on Q refused: *This job has no schedule yet.* |
| P's superintendent | nothing on any of the 23 | — |
| subcontractor | nothing on any of the 23 | — |
| what-if copy | the estimator reads its own; someone else on the team reads none | made for someone else: refused by the policy |
| append-only | — | the estimator's `UPDATE` of a change's words and `DELETE` of a move: *permission denied* |
| anon | *permission denied* | — |

Five mutants of the migration, each run through the whole bed, each caught:

1. The helper lets everyone in (`SELECT true`): 20_scenario's *a move by someone the policies keep out was allowed*.
2. No project manager arm: *the project manager reads P's bars and parts differs*.
3. `is_dev()` kept for the office: *an estimator reads P's bars differs*.
4. A what-if open to the whole team: *a what-if made for someone else was allowed*.
5. A move's rows looked up as an activity's: *the project manager reads the estimator's move's push, through its move differs*. It survived the first run, since the office is let in whatever the job: only the project manager proves a child row finds its job, so that check was added.

## Verify after the push

Each through the management API's query endpoint, each in `BEGIN … ROLLBACK` (`to-dos/gc-mode/scripts/verify/verify-040000.mjs` on the spike):

1. **The catalog, read only.** Each of the 23 tables has one `<table>_team` policy and no `_dev`. The four functions read `prosecdef` true. `gc_schedule_changes` shows no `UPDATE` or `DELETE` grant to `authenticated`. `anon` holds nothing on the 23.
2. **Reads per role, rolled back.** A sample estimator and a sample assistant read `gc_schedules` as a dev does. A sample superintendent and a sample primary read 0.
3. **A write, rolled back.** As a sample estimator, `gc_schedule_draft` on "GC test project, delete me" returns version 1, and the transaction rolls back. As a training account, the same draw is refused.
4. **The page**, a dev through **View as…**, once the client is on Pages: *Sample estimator*: the test project's card shows **Schedule** and the window opens. *Sample primary*: `/gc` lands on the Dashboard.

## Rollback

Re-create the 23 dev policies as `20261007210000`, `20261007220000` and `20261007235500` wrote them, drop the `_team` ones, then the four functions:

```sql
SET lock_timeout = '3s';
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gc_schedules', 'gc_schedule_activities', 'gc_schedule_activity_parts', 'gc_schedule_links',
    'gc_schedule_milestones', 'gc_schedule_inspection_failures', 'gc_schedule_baselines',
    'gc_schedule_baseline_dates', 'gc_schedule_changes', 'gc_schedule_late_notices', 'gc_schedule_walks',
    'gc_schedule_moves', 'gc_schedule_move_pushes', 'gc_schedule_move_tells', 'gc_schedule_move_answers',
    'gc_schedule_lookahead_marks', 'gc_schedule_waits', 'gc_schedule_wait_holds', 'gc_schedule_crew_counts',
    'gc_schedule_sends', 'gc_schedule_templates', 'gc_rough_schedules'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_team', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_dev', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()))', t || '_dev', t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS gc_schedule_what_ifs_team ON public.gc_schedule_what_ifs;
DROP POLICY IF EXISTS gc_schedule_what_ifs_dev ON public.gc_schedule_what_ifs;
CREATE POLICY gc_schedule_what_ifs_dev ON public.gc_schedule_what_ifs FOR ALL TO authenticated
  USING ((SELECT public.is_dev()) AND user_id = (SELECT auth.uid()))
  WITH CHECK ((SELECT public.is_dev()) AND user_id = (SELECT auth.uid()));
DROP FUNCTION IF EXISTS public.gc_on_schedule_team(uuid), public.gc_on_any_schedule_team(),
  public.gc_schedule_activity_project(uuid), public.gc_schedule_move_project(uuid);
```

The client's three gates fall back to empty reads for everyone but a dev, so a rollback needs no client deploy first.

## Applied

Not yet. The PR is a draft and arms only after the schedule's first live walk on prod (Grace's own yes), as the lead set.

## Status

- 2026-10-09: cut by gc 1 (the Schedule lane) from main at c5c29cc84. The bed green locally (107 checks) with five mutants each caught. Held as a draft.
