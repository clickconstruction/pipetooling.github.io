# 20261008040000_gc_schedule_writes.sql (2026-10-07, v2.4848)

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

Apply order: after PR 4's migration, since the functions read its tables. It changes no table: `CREATE OR REPLACE FUNCTION`, and the triggers in a `DO` block that makes each only where it is missing, so a second run changes nothing. Each `CREATE TRIGGER` takes a short lock on its table, and all ten are empty. In a busy moment the push stops at the 3-second lock timeout; run it again later. Its scenario, `supabase/tests/gc_schedule/20_scenario.sql`, runs against every migration in `npm run test:pg:gc-schedule`, and the *SQL beds* check runs it on the PR; the PR is armed only once that is green.

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

Written 2026-10-07 for the schedule's PR 5; not applied. The lead pushes it after PR 4's, and records here what steps 1 to 5 said.

Applied to prod 2026-10-07 with `supabase db push` from a clean checkout of main after #4866 merged (the drift check reads 783 local, 783 remote, fully applied; types in #4876). The five verify steps ran the same evening through the management API's query endpoint, every write inside a transaction that rolled back:

- Step 1: 23 `gc_schedule_*` functions, every one `SECURITY INVOKER` with `search_path=public`, none executable by `anon`, all executable by `authenticated` but `gc_schedule_plan_guard`; the guard trigger sits on the plan tables (`gc_schedules`, `gc_schedule_activities`, `gc_schedule_activity_parts`, `gc_schedule_links`, `gc_schedule_inspection_failures`, `gc_schedule_baselines`, `gc_schedule_baseline_dates`, `gc_schedule_changes`, `gc_schedule_moves`, `gc_schedule_move_pushes`).
- Step 2: a dev's plain insert into `gc_schedule_changes` got `Change the schedule through its own presses, so its version counts the change.`
- Step 3: the training-mode user's `gc_schedule_move` got `Read-only (training) mode: changes are blocked.` at the version's update.
- Step 4: on the test project, drawn with two lines and moved twice on version 1, the second move got `The schedule changed while you were working.` with DETAIL `{"read": 1, "version": 2, "changes": [{"version": 2, …, "words": "A check: the first move, then rolled back."}]}`; afterwards the schedule tables read zero rows and the test project's stage read `bidding`, so nothing stayed.
- Step 5: `anon` calling `gc_schedule_bump` got `permission denied for function gc_schedule_bump`.
