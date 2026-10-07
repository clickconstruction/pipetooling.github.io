# 20261008010000_gc_owner_billing_tables.sql (2026-10-07, v2.4831)

GC mode, the real build, Owner Billing's O1. It adds the tables, from the prototype's model (`to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md` → *The tables*, on branch `spike/gc-mode`). It also adds `gc_sign_owner_contract`, which the Board's Get started (B6) calls. Nothing reads or writes these yet. Change orders on real data are O3; our bill is O4a.

**On `gc_projects`** (New Project's table; Owner Billing's columns):
- `owner_contract_signed_on`: written only by the RPC below.
- `owner_retainage_pct`: 10 to start, 0 to 100 (decision 6).
- The retainage step: `owner_retainage_step_at_pct`, `owner_retainage_step_to_pct` and `owner_retainage_step_way` (`after` or `all`). They are all null (held to the end) or all set. `at` is 1 to 99, and `to` is below the full percent.
- `owner_late_interest_pct_per_month`: null is none, otherwise above 0.
- `owner_late_finish_per_day`: null is none, otherwise 0 or more.
- `owner_pay_days`: the contract's days to pay after the certificate (decision 7), 0 to 365, null until typed.
- `billing_job_id`: unique, a key to `jobs_ledger`, set null if that job is deleted (decision 1). It is the only column that leans on decision 1 until O4a. If the owner turns that decision down, this one column is dropped.

**New tables:**
- **`gc_owner_contract_lines`**: the customer's price as signed, one row per trade and one each for `gc`, `contingency` and `fee`. A trade line names its package and our lines do not. It is unique with nulls not distinct, and the worth is 0 or more.
- **`gc_change_orders`**: changes to our contract with the customer.
  - The number is unique per project.
  - The description is never blank. The reason is `owner`, `field` or `plans`. `schedule_words` defaults to `none`.
  - `package_id` is null for our own work. `cost` and `price` are negative for a credit.
  - `status` is draft, sent, signed or declined. A sent change order has its `sent_on`. A signed or declined one has its `answered_on` and `answered_how` (`office` or `portal`), and no other has them.
  - `pct_done` is 0 to 100, and `days` is 0 or more.
  - `days_on_chart` holds the schedule moves a time extension asks for. A time extension has cost and price 0.
  - `plan_set_id` names the set that started it.
- **`gc_owner_pay_apps`**: our pay applications as each went.
  - The number is unique per project, with one `final` a project.
  - Dates: `period_to` and `sent_on`.
  - Money: the retainage percent and the step as it went (the same check), `retainage`, `work_to_date`, and `due`, which is above 0. A final pay application holds nothing.
  - The architect's certificate: `certified` and `certified_on` together. It is at most what we asked, to the cent, and less needs a `certified_note`.
- **`gc_owner_pay_app_lines`**: each line of a sent pay application, before our costs and fee are spread.
  - The line is `trade` or `self` (a package), `change_order` (a change order), or `gc`, `contingency` or `fee` (neither).
  - Each line keeps its `label`, `worth`, `done_to_date` and `stored`.
  - There is one row per line on a pay application.
- **`gc_owner_pay_reminders`**: our asks to pay a late bill, with the pay-by day, the note, the subject and lines as they went, and the email.
- **`gc_owner_interest_bills`**: the number is unique per project, with the day sent and an amount above 0.
- **`gc_owner_acceptances`**: one per project. It records the day, who accepted by name, `how` (`office` or `portal`) and a note.

**On `gc_schedule_moves`** (the schedule's table): the foreign key `gc_schedule_moves_change_order_fkey`, `change_order_id` → `gc_change_orders(id)`, on delete set null. That column's comment waited for it. Helper 1 (the schedule) agreed on 2026-10-07 that it ride here. No column changes.

**The trade keys are checked at commit** (`DEFERRABLE INITIALLY DEFERRED`). These are the trade keys on contract lines, change orders and pay application lines, and the change order key on pay application lines. A trade with a signed price, a change order or a billed line can't be deleted. A whole project still goes by cascade, because the check waits until every cascade has run.

**Append only:** pay applications, their lines, reminders and interest bills. `authenticated` has no UPDATE, DELETE or TRUNCATE on them, except two column grants:
- `UPDATE (certified, certified_on, certified_note, certified_by)` on pay applications, for the certificate;
- `UPDATE (email_send_log_id)` on reminders.

The bill links (`invoice_id` on pay applications and interest bills) and our conditional waiver's link come with O4a, with their own grants.

**`gc_sign_owner_contract(p_project_id uuid, p_signed_on date, p_worth jsonb DEFAULT NULL)`**: `SECURITY INVOKER`, for `authenticated` only.
- `p_worth` is the prototype's `ownerContractWorth` object: each trade's package id, then `gc`, `contingency` and `fee`, each to a number.
- It writes the day and every line in one transaction. It refuses, in words:
  - a line that is not this project's trade or one of the three;
  - an amount that is not a number, or one below zero;
  - a price missing a trade;
  - a price missing one of the three.
- **Signed already:** only the day moves, and the price stays as it was signed.
- **A null day marks it not signed:** it clears the day and the lines. It is refused once a pay application has gone out.
- **A project the caller cannot see:** "That GC project is not there."

RLS: each new table has one `FOR ALL` policy for `(SELECT public.is_dev())`, dev only while it is built (decision 2). The door PR opens them to the owner and the controller. `anon` has no privilege on them.

It ends with `apply_read_only_write_blocks()`, `apply_read_only_stmt_blocks()` and `apply_digital_twin_write_blocks()`.

Apply order: any time after New Project's tables, the plan sets and the schedule's moves (`20261007220000`). It names no Board table (`gc_companies`) and no statement of work, so it does not wait on B1.

It is additive and idempotent (`IF NOT EXISTS`, the guarded `ADD CONSTRAINT`, `DROP POLICY IF EXISTS`, `CREATE OR REPLACE`). It was run twice on an empty Postgres 15 with stand-ins for the tables it names. The second run changed nothing.

The `ALTER TABLE gc_projects` takes a short lock on it and on `jobs_ledger` (the `billing_job_id` key). `jobs_ledger` is busy while crews work, so push in a quiet moment. Each new table's keys take short locks on `gc_projects`, `gc_trade_packages`, `gc_plan_sets`, `gc_schedule_moves`, `email_send_log` and `users`. In a busy moment the push stops at the 3-second lock timeout; run it again later.

## Verify after the push

1. **Each table is there, with RLS on, its own policy and the house rules.** This is the schedule PR 2's query (`docs/migrations/20261007210000_gc_schedule_tables.md`, step 1), with these seven names in its `IN (...)` list: `'gc_owner_contract_lines', 'gc_change_orders', 'gc_owner_pay_apps', 'gc_owner_pay_app_lines', 'gc_owner_pay_reminders', 'gc_owner_interest_bills', 'gc_owner_acceptances'`. Expect seven rows. Each should read: `rls_on` true, `dev_policy` 1, `read_only_blocks` 3, `twin_fences` 3 and `stmt_trigger` 1.

2. **Each is empty, and the project's columns read their defaults.**

   ```sql
   SELECT (SELECT count(*) FROM public.gc_owner_contract_lines) AS contract_lines,
          (SELECT count(*) FROM public.gc_change_orders) AS change_orders,
          (SELECT count(*) FROM public.gc_owner_pay_apps) AS pay_apps,
          (SELECT count(*) FROM public.gc_owner_pay_app_lines) AS pay_app_lines,
          (SELECT count(*) FROM public.gc_owner_pay_reminders) AS reminders,
          (SELECT count(*) FROM public.gc_owner_interest_bills) AS interest_bills,
          (SELECT count(*) FROM public.gc_owner_acceptances) AS acceptances,
          (SELECT count(*) FROM public.gc_projects WHERE owner_retainage_pct = 10 AND owner_contract_signed_on IS NULL
             AND billing_job_id IS NULL AND owner_retainage_step_at_pct IS NULL) AS projects_at_defaults,
          (SELECT count(*) FROM public.gc_projects) AS projects;
   ```

   Expect zeros for the seven tables, and `projects_at_defaults` equal to `projects`.

3. **A read-only user's insert into `gc_change_orders` is refused.** This is the table the office will write most. It runs in a transaction that rolls back. The statement trigger refuses before any row or key is looked at, so the made-up project id is fine.

   ```sql
   BEGIN;
   SELECT set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
     FROM public.users WHERE read_only LIMIT 1;
   SET LOCAL ROLE authenticated;
   INSERT INTO public.gc_change_orders (project_id, number, description, reason)
     VALUES (gen_random_uuid(), 1, 'A check, rolled back', 'owner');
   ROLLBACK;
   ```

   Expect `ERROR: Read-only (training) mode: changes are blocked.` If the first `SELECT` returns no row, no user is in training mode yet, and this check waits for one.

4. **What went to the customer stays as it went, even for a dev, but for its two doors.** Each line runs in its own transaction as a dev who is not read-only. Use the schedule PR 2's step 4 opening, then the statement, then `ROLLBACK`.
   - `UPDATE public.gc_owner_pay_apps SET due = due;` gives `ERROR: permission denied for table gc_owner_pay_apps`.
   - `DELETE FROM public.gc_owner_pay_apps;` gives the same.
   - `UPDATE public.gc_owner_pay_apps SET certified_note = certified_note;` gives `UPDATE 0`: the certificate's door is open.
   - `DELETE FROM public.gc_owner_pay_app_lines;` gives `permission denied`.
   - `UPDATE public.gc_owner_pay_reminders SET note = note;` gives `permission denied`.
   - `UPDATE public.gc_owner_pay_reminders SET email_send_log_id = email_send_log_id;` gives `UPDATE 0`.
   - `DELETE FROM public.gc_owner_interest_bills;` gives `permission denied`.
   - `DELETE FROM public.gc_change_orders;` gives `DELETE 0`: a change order is not a record of what went.

5. **`gc_sign_owner_contract` writes the price and clears it.** Run it on the test project ("GC test project, delete me", `ef8905d1-039a-4cbc-9d69-9468cfea50e0`) as a dev, in a transaction that rolls back.

   ```sql
   BEGIN;
   SELECT set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
     FROM public.users WHERE role = 'dev' AND NOT read_only LIMIT 1;
   SET LOCAL ROLE authenticated;
   SELECT public.gc_sign_owner_contract('ef8905d1-039a-4cbc-9d69-9468cfea50e0', DATE '2026-10-08',
     (SELECT jsonb_object_agg(id::text, 1000) FROM public.gc_trade_packages WHERE project_id = 'ef8905d1-039a-4cbc-9d69-9468cfea50e0')
       || '{"gc": 100, "contingency": 50, "fee": 70}'::jsonb);
   SELECT count(*), sum(worth) FROM public.gc_owner_contract_lines WHERE project_id = 'ef8905d1-039a-4cbc-9d69-9468cfea50e0';
   SELECT public.gc_sign_owner_contract('ef8905d1-039a-4cbc-9d69-9468cfea50e0', NULL);
   SELECT count(*) FROM public.gc_owner_contract_lines WHERE project_id = 'ef8905d1-039a-4cbc-9d69-9468cfea50e0';
   ROLLBACK;
   ```

   Expect 8 lines for its five trades, summing 5220. Then expect 0 after the null. A price with one trade left out gives `The price must name every trade on the project.`

6. **The schedule's moves have their key.**

   ```sql
   SELECT conname, confdeltype FROM pg_constraint WHERE conname = 'gc_schedule_moves_change_order_fkey';
   ```

   Expect one row, with `confdeltype` `n` (set null).

7. **Nobody signed out reaches them.** Run `BEGIN; SET LOCAL ROLE anon; SELECT count(*) FROM public.gc_owner_pay_apps; ROLLBACK;` and expect `ERROR: permission denied for table gc_owner_pay_apps`.

Then `npm run check:migration-drift`, and the types PR (`npm run gen-types:linked`).

## Rollback

Nothing reads these yet. Going back is a new migration that does three things:
- drops `gc_sign_owner_contract`;
- drops `gc_schedule_moves_change_order_fkey`;
- drops the tables with `DROP TABLE IF EXISTS`, in this order: `gc_owner_acceptances`, `gc_owner_interest_bills`, `gc_owner_pay_reminders`, `gc_owner_pay_app_lines`, `gc_owner_pay_apps`, `gc_change_orders`, `gc_owner_contract_lines`;

then drops the eight `gc_projects` columns with their constraints.

## Status

Written 2026-10-07 for Owner Billing's O1 (v2.4831, clickconstruction/pipetooling.github.io#4851).

Applied to prod 2026-10-07 by the lead, with `supabase db push` from a clean checkout of main
(`npm run check:migration-drift`: 782 local, 782 remote; types in #4876). The verify steps ran the
same evening through the management API's query endpoint. Every write ran in a transaction that
rolled back. What they said:

- **Step 1.** All seven tables read: RLS on, one `_dev` policy, 3 read-only blocks, 3 twin fences,
  1 statement trigger. `anon` has no SELECT on them, which also answers step 7.
- **Step 2.** All seven are empty. The one `gc_projects` row reads its defaults: retainage 10, no
  signed day, no billing job, no step.
- **Step 3.** The training-mode user's insert into `gc_change_orders` got `Read-only (training)
  mode: changes are blocked.`
- **Step 4**, as a dev:
  - on `gc_owner_pay_apps`, `UPDATE due` and `DELETE` were refused with `permission denied`, and
    `UPDATE certified_note` went through on 0 rows;
  - on `gc_owner_pay_app_lines`, `DELETE` was refused;
  - on `gc_owner_pay_reminders`, `UPDATE note` was refused and `UPDATE email_send_log_id` went
    through on 0 rows;
  - on `gc_owner_interest_bills`, `DELETE` was refused;
  - on `gc_change_orders`, `DELETE` went through on 0 rows.
- **Step 5.** `gc_sign_owner_contract` on the test project wrote 8 lines summing 5220, and the
  null call left 0.
- **Step 6.** `gc_schedule_moves_change_order_fkey` is there, with `confdeltype` `n` (set null).
