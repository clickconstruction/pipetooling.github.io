# 20261007210000_gc_schedule_tables.sql (2026-10-07, v2.4798)

GC mode, the real build, the schedule's PR 2: the schedule and its bars as tables, from the prototype's model (`to-dos/gc-mode/SCHEDULE_REAL_BUILD.md` → *The tables*, on branch `spike/gc-mode`). Nine tables. Nothing reads or writes them yet: the RPCs are the schedule's PR 5, the mapper PR 6.

- **`gc_schedules`**, one row per GC project with a schedule drawn, keyed by `project_id` (FK `gc_projects`). It holds `version`, which every plan write checks and bumps, with `drafted_on` and `drafted_by`. The template the draft came from is `template_id`, `template_name` and `template_used_on`; `template_id` gains its foreign key with `gc_schedule_templates` in PR 4. Then `updated_at` and `updated_by`.
- **`gc_schedule_activities`**, one row per bar.
  - `kind` is line, inspection or added, with a `position`.
  - A line has its `scope_item_id` and `package_id`. There is one bar per scope line.
  - Every bar has `start` and `finish`, and may have `not_before` and `must_finish_by`, `actual_start` and `actual_finish`, and a `place`.
  - The kind's own columns: `label` and `passed_on` for an inspection, and `label`, `who` and `done_on` for the job's own work.
- **`gc_schedule_activity_parts`**: a line's parts. Each has `from_day` and `days` from the line's start, a `share`, a `pct` and its real days. Each name appears once a line.
- **`gc_schedule_links`**: what each bar waits on. `gap` is in days, and below zero means side by side. The only `kind` is finish_start. Both ends are bars of one job.
- **`gc_schedule_milestones`**: the dates to meet, with `planned`, `package_id` and `met_on`. A null `package_id` means the job's own.
- **`gc_schedule_inspection_failures`**: an inspection that did not pass, with `failed_on`, a `note`, `package_ids` and `reinspect_on`.
- **`gc_schedule_baselines`** and **`gc_schedule_baseline_dates`**: the plan kept as it stood. A baseline has a `name`, `locked_on`, `locked_by` and `why`; a null name reads *At Start*. The dates table holds each bar's dates then.
- **`gc_schedule_changes`**: one line of words for each plan write, keyed by project and version. It is append only: `authenticated` has no UPDATE, DELETE or TRUNCATE on it.

RLS: each table has one `FOR ALL` policy for `(SELECT public.is_dev())`, dev only while it is built (decision 4). The schedule's PR 10 opens them to the job's team. `anon` has no privilege on them.

It ends with `apply_read_only_write_blocks()`, `apply_read_only_stmt_blocks()` and `apply_digital_twin_write_blocks()`.

Apply order: any. No screen reads these tables until the schedule's PR 7 (PR 6's reads and writes are called by none before it). It is additive and idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`). Each foreign key takes a short lock on the table it names: `gc_projects`, `gc_scope_items`, `gc_trade_packages` and `users`. In a busy moment the push stops at the 3-second lock timeout; run it again later.

## Verify after the push

1. **Each table is there, with RLS on, its own policy and the house rules.** Run it read only.

   ```sql
   BEGIN READ ONLY;
   SELECT c.relname AS table_name,
          c.relrowsecurity AS rls_on,
          count(*) FILTER (WHERE p.policyname = c.relname || '_dev') AS dev_policy,
          count(*) FILTER (WHERE p.policyname LIKE 'read_only_users_cannot_%' AND p.permissive = 'RESTRICTIVE') AS read_only_blocks,
          count(*) FILTER (WHERE p.policyname LIKE 'digital_twin_write_fence_%') AS twin_fences,
          (SELECT count(*) FROM pg_trigger t WHERE t.tgrelid = c.oid AND t.tgname = 'read_only_block_stmt') AS stmt_trigger
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
   LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
   WHERE c.relname IN ('gc_schedules', 'gc_schedule_activities', 'gc_schedule_activity_parts', 'gc_schedule_links',
     'gc_schedule_milestones', 'gc_schedule_inspection_failures', 'gc_schedule_baselines',
     'gc_schedule_baseline_dates', 'gc_schedule_changes')
   GROUP BY c.oid, c.relname, c.relrowsecurity
   ORDER BY c.relname;
   ROLLBACK;
   ```

   Expect nine rows. Each should read: `rls_on` true, `dev_policy` 1, `read_only_blocks` 3, `twin_fences` 3 and `stmt_trigger` 1.

2. **Each is empty.**

   ```sql
   SELECT (SELECT count(*) FROM public.gc_schedules) AS schedules,
          (SELECT count(*) FROM public.gc_schedule_activities) AS activities,
          (SELECT count(*) FROM public.gc_schedule_activity_parts) AS parts,
          (SELECT count(*) FROM public.gc_schedule_links) AS links,
          (SELECT count(*) FROM public.gc_schedule_milestones) AS milestones,
          (SELECT count(*) FROM public.gc_schedule_inspection_failures) AS failures,
          (SELECT count(*) FROM public.gc_schedule_baselines) AS baselines,
          (SELECT count(*) FROM public.gc_schedule_baseline_dates) AS baseline_dates,
          (SELECT count(*) FROM public.gc_schedule_changes) AS changes;
   ```

   Expect zeros.

3. **A read-only user's insert is refused.** This runs in a transaction that rolls back. The statement trigger refuses before any row is looked at, so the new schedule's id need not exist.

   ```sql
   BEGIN;
   SELECT set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
     FROM public.users WHERE read_only LIMIT 1;
   SET LOCAL ROLE authenticated;
   INSERT INTO public.gc_schedules (project_id, drafted_on) VALUES (gen_random_uuid(), DATE '2026-10-07');
   ROLLBACK;
   ```

   Expect `ERROR: Read-only (training) mode: changes are blocked.` If the first `SELECT` returns no row, no user is in training mode yet and this check waits for one. Without one, the insert would fail on RLS instead, which proves nothing about the block.

4. **A plan write's words stay as they were said, even for a dev.**

   ```sql
   BEGIN;
   SELECT set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
     FROM public.users WHERE role = 'dev' AND NOT read_only LIMIT 1;
   SET LOCAL ROLE authenticated;
   UPDATE public.gc_schedule_changes SET words = words;
   ROLLBACK;
   ```

   Expect `ERROR: permission denied for table gc_schedule_changes`. A `DELETE` gives the same.

5. **Nobody signed out reaches them.** Run `BEGIN; SET LOCAL ROLE anon; SELECT count(*) FROM public.gc_schedules; ROLLBACK;` and expect `ERROR: permission denied for table gc_schedules`.

Then `npm run check:migration-drift`, and the types PR (`npm run gen-types:linked`).

## Rollback

Nothing reads these tables yet. Going back is a new migration that drops them with `DROP TABLE IF EXISTS`, in this order: `gc_schedule_changes`, `gc_schedule_baseline_dates`, `gc_schedule_baselines`, `gc_schedule_inspection_failures`, `gc_schedule_milestones`, `gc_schedule_links`, `gc_schedule_activity_parts`, `gc_schedule_activities`, `gc_schedules`.

## Status

Written 2026-10-07 for the schedule's PR 2; not applied. The stamp skips past the uncollectible lane's two claims, 20261007190000 and 20261007200000, on purpose, so it lands after them whichever is pushed first. The lead pushes it after the merge and records here what steps 1 to 5 of *Verify after the push* said.

Applied to prod 2026-10-07 with `supabase db push` from a clean checkout of main (the ledger holds it; `npm run check:migration-drift` is fully applied; types in #4826). What the verify steps said, run from the app as the dev account against prod:

- Step 2: all nine tables read back empty, with the dev policy letting the dev read them.
- Step 3's dev half: a dev's insert into `gc_schedules` went in (version 0), a change line went in at version 1, and `finish < start` on a bar was refused by `gc_schedule_activities_dates_in_order`.
- Step 4: the dev's update and delete on `gc_schedule_changes` were both refused with `permission denied for table gc_schedule_changes`; deleting the schedule took its change line by cascade (0 left).
- Step 5: a signed-out call on `gc_schedules` with the anon key got 401 `permission denied for table gc_schedules`.
- Steps 1 and 3, run later the same day through the management API's query endpoint (the drift check's path) once PR 3 was applied: all nine tables read `rls_on` true, `dev_policy` 1, `read_only_blocks` 3, `twin_fences` 3 and `stmt_trigger` 1; the training-mode user's insert into `gc_schedules` got `Read-only (training) mode: changes are blocked.` and the table stayed empty.
