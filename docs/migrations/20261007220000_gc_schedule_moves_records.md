# 20261007220000_gc_schedule_moves_records.sql (2026-10-07, v2.4809)

GC mode, the real build, the schedule's PR 3: moves and the records as tables, from the prototype's model (`to-dos/gc-mode/SCHEDULE_REAL_BUILD.md` → *The tables*, on branch `spike/gc-mode`), after PR 2's `20261007210000_gc_schedule_tables.sql`. Eleven tables. Nothing reads or writes them yet: the RPCs are the schedule's PR 5, and the trades' writes come through their portal's function in PR 14.

- **`gc_schedule_moves`**, one row per move.
  - The bar (`activity_id`, set null if the bar is removed) and its name that day (`activity_name`).
  - Who and when: `made_on`, `made_at`, `made_by` and `made_by_name`.
  - The dates before and after, the `reason` (one of twelve) and the `note` (never blank).
  - `links_changed`, and `finish_from` and `finish_to`.
  - Undo's pair, `undone_on` and `undone_by`.
  - What kind of move it was: `change_order_id` (its key comes with Owner Billing), `late_notice_id`, `pull_finished`, the `recovery_*` columns, `from_what_if_on` and `parts`.
  - `schedule_version`, keyed (deferred) to its line in `gc_schedule_changes`.
- **`gc_schedule_move_pushes`**: what each move pushed, with its dates before and after.
- **`gc_schedule_move_tells`** and **`gc_schedule_move_answers`**: the companies told of a move, with what the message showed and its email, and each one's answer. There is one answer per company, and only from a company told.
- **`gc_schedule_walks`**: one per weekly walk, recorded at its end. It holds the bars `kept`, the `move_ids` made during it, `skipped` and `kept_early`.
- **`gc_schedule_lookahead_marks`**: a bar's done or not done for a week (a Monday). It records who marked it (a company, or our own crew) and our superintendent's check, and there is one per bar and week.
- **`gc_schedule_waits`** and **`gc_schedule_wait_holds`**: what the work waits on from outside the trades, and the bars each holds. Both ends are of one job.
- **`gc_schedule_late_notices`**: a trade's late notice, with the office's push back and the company's kept day. Its bar is of the same job.
- **`gc_schedule_crew_counts`**: a trade's people a day for a week, 0 to 50. The newest counts.
- **`gc_schedule_sends`**: the customer's schedule as it was sent.

**Append only:** moves, their pushes, tells and answers, walks, late notices, crew counts and sends. `authenticated` has no UPDATE, DELETE or TRUNCATE on them, except two column grants: `UPDATE (undone_on, undone_by)` on moves, which Undo sets and Redo clears, and `UPDATE (pushed_back_on, pushed_back_by, pushed_back_note)` on late notices, for the office's push back. A notice's `kept_on` is the company's, from its portal's function with the service role. Marks, waits and wait holds change as the prototype changes them.

RLS: each table has one `FOR ALL` policy for `(SELECT public.is_dev())`, dev only while it is built (decision 4). The schedule's PR 10 opens them to the job's team. `anon` has no privilege on them.

It ends with `apply_read_only_write_blocks()`, `apply_read_only_stmt_blocks()` and `apply_digital_twin_write_blocks()`.

Apply order: after PR 2's migration, whose `gc_schedules`, `gc_schedule_activities` and `gc_schedule_changes` these reference. No screen reads them until the schedule's PR 7. It is additive and idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`). Each foreign key takes a short lock on the table it names: PR 2's three, `gc_trade_packages`, `email_send_log` and `users`. In a busy moment the push stops at the 3-second lock timeout; run it again later.

## Verify after the push

1. **Each table is there, with RLS on, its own policy and the house rules.** This is PR 2's query, with these eleven names in its `IN (...)` list. Expect eleven rows. Each should read: `rls_on` true, `dev_policy` 1, `read_only_blocks` 3, `twin_fences` 3 and `stmt_trigger` 1.

2. **Each is empty.** This is PR 2's count query, with these eleven tables. Expect zeros.

3. **A read-only user's insert is refused.** Run it as PR 2's step 3. The statement trigger refuses before any row or key is looked at, so the made-up schedule id is fine:

   ```sql
   BEGIN;
   SELECT set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
     FROM public.users WHERE read_only LIMIT 1;
   SET LOCAL ROLE authenticated;
   INSERT INTO public.gc_schedule_sends (project_id, sent_on, sent_to, subject, lines)
     VALUES (gen_random_uuid(), DATE '2026-10-07', 'A check', 'A check, rolled back', '{}');
   ROLLBACK;
   ```

   Expect `ERROR: Read-only (training) mode: changes are blocked.`

4. **The records stay as they were kept, even for a dev, but for their two doors.** Each line runs in its own transaction as a dev who is not read-only. Use PR 2's step 4 opening, then the statement, then `ROLLBACK`.
   - `DELETE FROM public.gc_schedule_moves;` gives `ERROR: permission denied for table gc_schedule_moves`. This is the build doc's own check.
   - `UPDATE public.gc_schedule_moves SET note = note;` is refused the same way.
   - `UPDATE public.gc_schedule_moves SET undone_on = undone_on;` gives `UPDATE 0`: Undo's door is open.
   - `UPDATE public.gc_schedule_late_notices SET kept_on = kept_on;` gives `permission denied`: the kept day is the company's.
   - `UPDATE public.gc_schedule_late_notices SET pushed_back_on = pushed_back_on;` gives `UPDATE 0`.
   - `DELETE FROM public.gc_schedule_crew_counts;` gives `permission denied`.
   - `DELETE FROM public.gc_schedule_waits;` gives `DELETE 0`: a wait can be taken off.

5. **Nobody signed out reaches them.** Run `BEGIN; SET LOCAL ROLE anon; SELECT count(*) FROM public.gc_schedule_moves; ROLLBACK;` and expect `ERROR: permission denied for table gc_schedule_moves`.

Then `npm run check:migration-drift`, and the types PR (`npm run gen-types:linked`).

## Rollback

Nothing reads these tables yet. Going back is a new migration that drops them with `DROP TABLE IF EXISTS`, in this order: `gc_schedule_sends`, `gc_schedule_crew_counts`, `gc_schedule_wait_holds`, `gc_schedule_waits`, `gc_schedule_lookahead_marks`, `gc_schedule_move_answers`, `gc_schedule_move_tells`, `gc_schedule_move_pushes`, `gc_schedule_moves`, `gc_schedule_walks`, `gc_schedule_late_notices`.

## Status

Written 2026-10-07 for the schedule's PR 3; not applied. The lead pushes it after PR 2's, and records here what steps 1 to 5 said.
