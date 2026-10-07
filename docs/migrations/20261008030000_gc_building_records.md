# 20261008030000_gc_building_records.sql (2026-10-07, v2.4827)

GC mode, the real build, the Building lane's U1: the job's records while we build, as tables, from the prototype's model (`to-dos/gc-mode/BUILDING_REAL_BUILD.md` → *The tables*, U1, on branch `spike/gc-mode`). Ten tables. Nothing reads or writes them yet: the writes are U3 to U5, the mapper U3.

- **`gc_daily_logs`**: the superintendent's log, one a day per project (`log_date`). It keeps `sky`, `high`, `low`, `weather_stop`, `done`, `visitors`, `photos_url` (a Drive link, never a copy), `written_on` and `written_by`. `written_on` before `log_date` is refused.
  - **`gc_daily_log_crews`**: each trade on site that day, with its `workers` (from 1). One row a trade a day.
  - **`gc_daily_log_delays`**: what held work up. Each has its `package_id` (null: the job's own), one of the look-ahead's five reasons, and a `note`.
- **`gc_punch_items`**: what is left to fix on a trade's work, with `text`, `where_on`, `photo_url` and `added_on`. Then `fixed_on` (the trade's word) and `checked_on` / `checked_by` (our check). A send back is counted (`sent_back_times`) with the last note and day. An item cannot be checked before it is fixed.
- **`gc_submittals`**: the register. Each has its `number` (once a project), the trade, `title`, `kind` (product data, shop drawings or samples), `spec_section`, `lead_days`, `needed_by` and `asked_on`.
  - **`gc_submittal_holds`**: the scope lines it holds until approved.
  - **`gc_submittal_rounds`**: each time it was sent (`round` from 1), from the trade's portal or recorded by the office. It keeps `file_name` and `drive_url`, the day it went to the architect, and the answer (approved, approved as noted, or revise). A revise needs a note. An answer needs the round to have gone to the architect.
- **`gc_rfis`**: questions during construction. Each has its `number` (once a project), `question`, `sheets`, the trade (`package_id`) and who asked (`asked_by_company_id`, `gc_companies`; null: our own people). Then `needed_days` (default 3), the day it went to the architect, and the answer.
  - The answer is `answered_on`, `answer_text`, `answered_by` (architect or us) and `impact` (none, plans or cost), with `cost` and `days`.
  - The architect answers only what was sent to them. A cost answer has a cost or days, and any other has neither.
  - **`gc_rfi_holds`**: the scope lines it holds until answered.
- **`gc_weekly_reports`**: the weekly report to the customer as it went, every send kept. It records the week (a Monday), `sent_on`, from me or from the company, who sent it and to whom, whether the architect was copied, the subject and the body. It is append only: `authenticated` has no UPDATE, DELETE or TRUNCATE on it.

What it does not touch: **inspections**. They are the schedule's bars and failures (`gc_schedule_activities` kind `inspection`, `gc_schedule_inspection_failures`, from `20261007210000_gc_schedule_tables`), and Building reads them (decision 1). There is no Building inspections table. Also not here: the change order an RFI starts (`gc_rfis.change_order_id` comes with U5, once Owner Billing's `gc_change_orders` is on main) and the trades' money (U6).

RLS: each table has one `FOR ALL` policy for `(SELECT public.is_dev())`, dev only while it is built (decision 4). Building's door PR opens them to the job's team. `anon` has no privilege on them.

It ends with `apply_read_only_write_blocks()`, `apply_read_only_stmt_blocks()` and `apply_digital_twin_write_blocks()`.

**Apply order: after `20261008020000_gc_company_record` (B1, the Board lane), which makes `gc_companies`.** `gc_rfis.asked_by_company_id` names it, so this one fails without it. The lead pushes the two in one batch, B1 first. If B1 slips, this one waits with it. No screen reads these tables until U3. It is additive and idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`). Each foreign key takes a short lock on the table it names: `gc_projects`, `gc_trade_packages`, `gc_scope_items`, `gc_companies`, `email_send_log` and `users`. In a busy moment the push stops at the 3-second lock timeout; run it again later.

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
   WHERE c.relname IN ('gc_daily_logs', 'gc_daily_log_crews', 'gc_daily_log_delays', 'gc_punch_items',
     'gc_submittals', 'gc_submittal_holds', 'gc_submittal_rounds', 'gc_rfis', 'gc_rfi_holds', 'gc_weekly_reports')
   GROUP BY c.oid, c.relname, c.relrowsecurity
   ORDER BY c.relname;
   ROLLBACK;
   ```

   Expect ten rows. Each should read: `rls_on` true, `dev_policy` 1, `read_only_blocks` 3, `twin_fences` 3 and `stmt_trigger` 1.

2. **Each is empty.**

   ```sql
   SELECT (SELECT count(*) FROM public.gc_daily_logs) AS logs,
          (SELECT count(*) FROM public.gc_daily_log_crews) AS crews,
          (SELECT count(*) FROM public.gc_daily_log_delays) AS delays,
          (SELECT count(*) FROM public.gc_punch_items) AS punch,
          (SELECT count(*) FROM public.gc_submittals) AS submittals,
          (SELECT count(*) FROM public.gc_submittal_holds) AS submittal_holds,
          (SELECT count(*) FROM public.gc_submittal_rounds) AS rounds,
          (SELECT count(*) FROM public.gc_rfis) AS rfis,
          (SELECT count(*) FROM public.gc_rfi_holds) AS rfi_holds,
          (SELECT count(*) FROM public.gc_weekly_reports) AS weekly_reports;
   ```

   Expect zeros.

3. **A read-only user's insert is refused.** This runs in a transaction that rolls back. The statement trigger refuses before any row is looked at, so the project's id need not exist.

   ```sql
   BEGIN;
   SELECT set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
     FROM public.users WHERE read_only LIMIT 1;
   SET LOCAL ROLE authenticated;
   INSERT INTO public.gc_daily_logs (project_id, log_date, sky, high, low, written_on)
     VALUES (gen_random_uuid(), DATE '2026-10-08', 'clear', 85, 65, DATE '2026-10-08');
   ROLLBACK;
   ```

   Expect `ERROR: Read-only (training) mode: changes are blocked.` If the first `SELECT` returns no row, no user is in training mode yet and this check waits for one.

4. **The rules hold, even for a dev.** On the test project ("GC test project, delete me", `ef8905d1-039a-4cbc-9d69-9468cfea50e0`), in a transaction that rolls back:

   ```sql
   BEGIN;
   SELECT set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
     FROM public.users WHERE role = 'dev' AND NOT read_only LIMIT 1;
   SET LOCAL ROLE authenticated;
   -- A log written before its day.
   INSERT INTO public.gc_daily_logs (project_id, log_date, sky, high, low, written_on)
     VALUES ('ef8905d1-039a-4cbc-9d69-9468cfea50e0', DATE '2026-10-09', 'clear', 85, 65, DATE '2026-10-08');
   ROLLBACK;
   ```

   Expect `gc_daily_logs_written_after`. Then the same way:
   - an RFI answered by the architect with no day sent gives `gc_rfis_architect_was_asked`;
   - an RFI with impact `cost` and a cost and days of 0 gives `gc_rfis_cost_answer`;
   - a weekly report with a Tuesday `week_of` gives `gc_weekly_reports_week_is_monday`.

5. **A weekly report stays as it went, even for a dev.** As step 4's dev, `UPDATE public.gc_weekly_reports SET body = body;` gives `ERROR: permission denied for table gc_weekly_reports`. A `DELETE` gives the same.

6. **Nobody signed out reaches them.** Run `BEGIN; SET LOCAL ROLE anon; SELECT count(*) FROM public.gc_daily_logs; ROLLBACK;` and expect `ERROR: permission denied for table gc_daily_logs`.

Then `npm run check:migration-drift`, and the types PR (`npm run gen-types:linked`).

## Rollback

Nothing reads these tables yet. Going back is a new migration that drops them with `DROP TABLE IF EXISTS`, in this order: `gc_weekly_reports`, `gc_rfi_holds`, `gc_rfis`, `gc_submittal_rounds`, `gc_submittal_holds`, `gc_submittals`, `gc_punch_items`, `gc_daily_log_delays`, `gc_daily_log_crews`, `gc_daily_logs`.

## Status

Written 2026-10-07 for the Building lane's U1; not applied. Its stamp sorts after B1's `20261008020000`, door 1's `20261008003000` and O1's `20261008010000`, the claims outstanding when it was cut. The lead pushes it after B1 and records here what steps 1 to 6 of *Verify after the push* said.

Applied to prod 2026-10-07 with `supabase db push` from a clean checkout of main, after B1's `20261008020000` in the same batch (the ledger holds it; `npm run check:migration-drift` read 782 of 782; types in #4876). What *Verify after the push* said:

- **Steps 1 to 3, and step 4's first check** (the lead, through the management API's query endpoint, every write rolled back):
  - Step 1: all ten tables read RLS on, one `_dev` policy, 3 read-only blocks, 3 twin fences and 1 statement trigger, and `anon` has no SELECT.
  - Step 2: all ten are empty.
  - Step 3: the training-mode user's insert into `gc_daily_logs` got `Read-only (training) mode: changes are blocked.`
  - Step 4: a dev's log written before its day was refused by `gc_daily_logs_written_after`, and a dev's UPDATE on `gc_weekly_reports` got `permission denied for table gc_weekly_reports`.
- **The rest of step 4, and steps 5 and 6** (Helper 4, from the app on `127.0.0.1:5304`, signed in as the dev account through the page's `supabase` client). Each insert named a project, package or submittal id that matches nothing, so a check refused it first, or the foreign key did after, and nothing was written:
  - An RFI answered by the architect with no day sent: `gc_rfis_architect_was_asked`.
  - A cost answer with a cost and days of 0, and a no-change answer with a cost of $100: both `gc_rfis_cost_answer`.
  - An answered day with no answer: `gc_rfis_answer_whole`.
  - A submittal round answered *revise* with no note: `gc_submittal_rounds_revise_says_why`. One answered before it went to the architect: `gc_submittal_rounds_answered_after_sent`.
  - A submittal with a blank title: `gc_submittals_titled`.
  - A weekly report for the week of Tue Oct 6: `gc_weekly_reports_week_is_monday`.
  - A punch item checked before it was fixed: `gc_punch_items_checked_once_fixed`.
  - A valid RFI on a project that does not exist passed every check and was refused only by `gc_rfis_project_id_fkey` (409).
  - Step 5's DELETE on `gc_weekly_reports`: `403 permission denied for table gc_weekly_reports`.
  - Step 6, signed out with the anon key: `401 permission denied` on `gc_daily_logs`, `gc_rfis` and `gc_weekly_reports`.
  - Afterwards the dev read all six record tables it wrote to as empty.
