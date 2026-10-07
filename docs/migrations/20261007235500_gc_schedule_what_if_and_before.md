# 20261007235500_gc_schedule_what_if_and_before.sql (2026-10-07, v2.4816)

GC mode, the real build, the schedule's PR 4: what if and before the job, as tables, from the prototype's model (`to-dos/gc-mode/SCHEDULE_REAL_BUILD.md` → *The tables*, on branch `spike/gc-mode`), after PR 3's `20261007220000_gc_schedule_moves_records.sql`. Three tables and one key. Nothing reads or writes them yet: the RPCs are the schedule's PR 5.

- **`gc_schedule_templates`**, company-wide: a GC job's shape saved to draw other jobs from.
  - `name`: at most 60 letters, and once whatever the case.
  - Where it came from: `from_project_id` (set null), `from_name` and `from_done_pct`.
  - `saved_on` and `saved_by`.
  - `lines`: a `TemplateLine[]` by trade and name, never empty.
  - `stages`, `weeks` and `aside_on`.
- **`gc_rough_schedules`**, one per GC project while we bid, keyed to `gc_projects`.
  - `start`, `stage_days`, `drawn_on` and `drawn_by`.
  - The weeks kept with our bid or at award: `kept_on`, `kept_weeks`, `kept_finish` and `kept_at`, all four or none.
  - The template it was drawn from, `template_id`, `template_name` and `template_used_on`, with its lines copied into `template_lines` (the prototype's `like`, a reserved word in SQL).
- **`gc_schedule_what_ifs`**: one person's copy of a schedule, keyed by (`project_id`, `user_id`). It holds `made_on`, `base_version`, `base` (each bar's dates, waits, limits and parts on the real schedule then) and `copy` (the copy's `ProjectSchedule` with the moves tried on it).
- **`gc_schedules_template_fkey`**: `gc_schedules.template_id` now references `gc_schedule_templates` (set null), added in a `DO` block that runs once.

**Append only:** a template's lines never change. `authenticated` has no UPDATE, DELETE or TRUNCATE on it, except `UPDATE (name, aside_on)`. The rough is redrawn until it is kept, and the copy is rewritten with each try, so both stay editable.

RLS: each table has one `FOR ALL` policy for `(SELECT public.is_dev())`, dev only while it is built (decision 4). The copy's policy also holds it to `user_id = (SELECT auth.uid())` (decision 6). The schedule's PR 10 swaps `is_dev()` for the job's team, and keeps the copy's person. `anon` has no privilege on them.

It ends with `apply_read_only_write_blocks()`, `apply_read_only_stmt_blocks()` and `apply_digital_twin_write_blocks()`.

Apply order: after PR 3's migration, and so after PR 2's, whose `gc_schedules` this references and gains a key on. No screen reads these until the schedule's PRs 11 and 12. It is additive and idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, the `DO` block's check). Each foreign key takes a short lock on the table it names: `projects`, `gc_projects`, `gc_schedules` and `users`. The new key on `gc_schedules` also checks its rows; nothing writes `template_id` before PR 5, so every row has none. In a busy moment the push stops at the 3-second lock timeout; run it again later.

## Verify after the push

1. **Each table is there, with RLS on, its own policy and the house rules.** This is PR 2's query, with these three names in its `IN (...)` list. Expect three rows. Each should read: `rls_on` true, `dev_policy` 1, `read_only_blocks` 3, `twin_fences` 3 and `stmt_trigger` 1. Then the new key:

   ```sql
   SELECT conname, confdeltype FROM pg_constraint WHERE conname = 'gc_schedules_template_fkey';
   ```

   Expect one row, with `confdeltype` `n` (set null).

2. **Each is empty.** Use PR 2's count query, with these three tables. Expect zeros.

3. **A read-only user's insert is refused.** Run it as PR 2's step 3:

   ```sql
   BEGIN;
   SELECT set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
     FROM public.users WHERE read_only LIMIT 1;
   SET LOCAL ROLE authenticated;
   INSERT INTO public.gc_schedule_templates (name, from_name, from_done_pct, saved_on, lines, stages, weeks)
     VALUES ('A check', 'A check', 0, DATE '2026-10-07', '[{}]', '[]', 1);
   ROLLBACK;
   ```

   Expect `ERROR: Read-only (training) mode: changes are blocked.`

4. **A template keeps its lines, and a copy its person, even for a dev.** Run each line in its own transaction as a dev who is not read-only: PR 2's step 4 opening, then the statement, then `ROLLBACK`.
   - `UPDATE public.gc_schedule_templates SET lines = lines;` gives `ERROR: permission denied for table gc_schedule_templates`.
   - `DELETE FROM public.gc_schedule_templates;` is refused the same way.
   - `UPDATE public.gc_schedule_templates SET name = name, aside_on = aside_on;` gives `UPDATE 0`: the door is open.
   - `INSERT INTO public.gc_schedule_what_ifs (project_id, user_id, made_on, base_version, base, copy) VALUES (gen_random_uuid(), gen_random_uuid(), DATE '2026-10-07', 0, '{}', '{}');` gives `ERROR: new row violates row-level security policy for table "gc_schedule_what_ifs"`. A copy for another person is refused before its schedule is looked at.

5. **Nobody signed out reaches them.** Run `BEGIN; SET LOCAL ROLE anon; SELECT count(*) FROM public.gc_schedule_templates; ROLLBACK;` and expect `ERROR: permission denied for table gc_schedule_templates`.

Then `npm run check:migration-drift`, and the types PR (`npm run gen-types:linked`).

## Rollback

Nothing reads these tables yet. Going back is a new migration with two steps. First it drops the key: `ALTER TABLE public.gc_schedules DROP CONSTRAINT IF EXISTS gc_schedules_template_fkey`. Then it drops the tables with `DROP TABLE IF EXISTS`, in this order: `gc_schedule_what_ifs`, `gc_rough_schedules`, `gc_schedule_templates`.

## Status

Written 2026-10-07 for the schedule's PR 4; not applied. The stamp skips past three claims not yet merged, 20261007230000, 20261007234000 and 20261007235000, on purpose, so it lands after them whichever is pushed first. The lead pushes it after PR 3's, and records here what steps 1 to 5 said.

Applied to prod 2026-10-07 with `supabase db push` after #4835 merged (the drift check reads 777 local, 777 remote, fully applied; types in the PR that follows). The five verify steps ran the same evening through the management API's query endpoint, every write inside a transaction that rolled back:

- Step 1: all three tables read `rls_on` true, `dev_policy` 1, `read_only_blocks` 3, `twin_fences` 3 and `stmt_trigger` 1; `gc_schedules_template_fkey` is there with `confdeltype` `n`.
- Step 2: all three empty.
- Step 3: the training-mode user's insert into `gc_schedule_templates` got `Read-only (training) mode: changes are blocked.`
- Step 4, as a dev who is not read-only: `UPDATE … SET lines = lines` and `DELETE` on `gc_schedule_templates` were both refused with `permission denied for table gc_schedule_templates`; `UPDATE … SET name = name, aside_on = aside_on` went through on 0 rows (the door is open); the insert of a copy for another person into `gc_schedule_what_ifs` was refused with `new row violates row-level security policy`.
- Step 5: `anon` got `permission denied for table gc_schedule_templates`.
