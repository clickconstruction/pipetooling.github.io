# 20261009200000_gc_owner_pay_app_send.sql

GC mode, Owner Billing's O4a-1: our bill to the customer (v2.4984). The plan is `to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md` → *The RPCs*, and the SQL is `to-dos/gc-mode/mockups/owner-billing-o4a.md`'s, byte for byte, on branch `spike/gc-mode` as amended at 57f9ab49b (*O4a-1 as amended*: the service type flagged and found by its flag, the comments naming the money team). It needs the billing-only job: `20261009130000_billing_only_jobs.sql` is applied, and **BO-2 (v2.4972, #5030) is merged and deployed before this push**, because the push creates a billing-only service type that only BO-2's client keeps out of the pickers.

It is additive and idempotent, and it creates no table.

## What it does

1. **The "General contracting" service type**, last in the order, billing-only, if missing. `jobs_ledger.service_type_id` is required, and the billing job is not Plumbing, Electrical or HVAC. Prod had no row of that name at the cut (read 2026-10-08), so `ON CONFLICT (name) DO NOTHING` does not fire there.
2. **Two links on `gc_owner_pay_apps`**:
   - `invoice_id` → `jobs_ledger_invoices`, the bill made at the certificate;
   - `conditional_waiver_id` → `job_lien_releases`, our conditional waiver with it.

   Both are `ON DELETE SET NULL`, with a column grant to `authenticated`. `gc_owner_interest_bills` gains `invoice_id` for O6.
3. **`gc_owner_pay_apps_links_once`** (BEFORE UPDATE): a link stays once written, and so does a recorded certificate. A nested trigger, the foreign key's own SET NULL, passes.
4. **`gc_owner_contract_now(project)`**: the signed lines plus every signed change order.
5. **`gc_send_owner_pay_app(project, app)`** files the pay application and its lines. The first send opens the project's billing job:
   - billing-only, `working`, "<project> (GC)";
   - for the project's customer, with no `project_id`;
   - the company owner as master, the next job number;
   - its service type found by `service_types.billing_only`, not by name, refusing in words when there is none;
   - revenue kept at the contract.
6. **`gc_record_certificate(pay_app, amount, on, note)`** records the certificate and makes the bill on the billing job for what was certified: `billed`, at noon Central that day. It records once, and certifying nothing makes no bill.

Both functions are SECURITY INVOKER. The GC tables' policies are the money team's (`gc_money_team()`: dev, the leaders and the controller, since the Owner Billing door, `20261009050000`), and the job and its bill go in under the Pipeline's own policies, which the money team passes (`is_office_staff()`). An estimator is refused by RLS.

## The lock note

- `ALTER TABLE gc_owner_pay_apps` / `gc_owner_interest_bills`: empty on prod at the push, so the instant locks queue nothing.
- **The two new foreign keys take a SHARE ROW EXCLUSIVE lock on `jobs_ledger_invoices` and `job_lien_releases`** while the migration applies. It is short, but it waits behind a write to a bill or a waiver and holds the next ones. `SET lock_timeout = '3s';` makes it fail fast, and the push goes in the **evening batch, after 23:00 UTC**. If it stops at the timeout, nothing is applied; push again a few minutes later.
- `INSERT INTO service_types`: one row.

## Verify after the push

Steps 3 to 5 run as a dev through the management API, in one transaction that rolls back: `BEGIN;`, then `set_config('request.jwt.claims', …)` for the dev BEFORE `SET LOCAL ROLE authenticated`, the step's statements, then `ROLLBACK;`. They use the test project, "GC test project, delete me" (`ef8905d1-039a-4cbc-9d69-9468cfea50e0`). Its contract is not marked signed on prod, so step 3 signs it inside the transaction first.

1. **The type is there once, billing-only.**
   `SELECT count(*), bool_and(billing_only) FROM service_types WHERE name = 'General contracting';` gives `1, true`.
2. **The columns, the trigger and the grants.**
   - `gc_owner_pay_apps` has `invoice_id` and `conditional_waiver_id`, and `gc_owner_interest_bills` has `invoice_id`.
   - `SELECT tgname FROM pg_trigger WHERE tgname = 'gc_owner_pay_apps_links_once';` gives 1 row.
   - `SELECT has_column_privilege('authenticated', 'public.gc_owner_pay_apps', 'invoice_id', 'UPDATE'), has_column_privilege('authenticated', 'public.gc_owner_pay_apps', 'due', 'UPDATE');` gives `true, false`.
3. **A send.** Sign the contract at test numbers, then send pay application 1 with every trade at 1,000 of 10,000:

   ```sql
   SELECT public.gc_sign_owner_contract('ef8905d1-039a-4cbc-9d69-9468cfea50e0', public.app_today(),
     (SELECT jsonb_object_agg(id::text, 10000) FROM public.gc_trade_packages WHERE project_id = 'ef8905d1-039a-4cbc-9d69-9468cfea50e0')
     || '{"gc": 5000, "contingency": 1000, "fee": 2000}'::jsonb);
   SELECT public.gc_send_owner_pay_app('ef8905d1-039a-4cbc-9d69-9468cfea50e0', jsonb_build_object(
     'number', 1, 'final', false, 'periodTo', public.app_today(), 'sentOn', public.app_today(),
     'retainagePct', 10, 'retainageStep', NULL,
     'workToDate', 1000 * n, 'retainage', 100 * n, 'due', 900 * n,
     'lines', lines))
   FROM (SELECT count(*) AS n, jsonb_agg(jsonb_build_object('line', 'trade', 'packageId', id, 'label', trade,
           'worth', 10000, 'doneToDate', 1000, 'stored', 0) ORDER BY position) AS lines
         FROM public.gc_trade_packages WHERE project_id = 'ef8905d1-039a-4cbc-9d69-9468cfea50e0') t;
   ```

   It returns an id. Then `gc_projects.billing_job_id` is set, and the job reads `billing_only`, `working`, "GC test project, delete me (GC)", the customer's name, `project_id` null, the General contracting type, and revenue = `gc_owner_contract_now('ef8905d1-…')`.
4. **A certificate.** `SELECT gc_record_certificate('<the id>', 900 * <trades>, app_today(), '');` returns a bill id. The bill reads `billed`, the amount, and `billed_at` at 12:00 Central today. The pay application's `invoice_id` is that bill.
5. **Once.**
   - The same call again is refused: *The certificate on pay application 1 is recorded already.*
   - `UPDATE gc_owner_pay_apps SET invoice_id = NULL WHERE id = '<the id>';` is refused: *Pay application 1 has its bill, so it keeps it.*

`ROLLBACK;` Then `npm run check:migration-drift`, and the types PR: `database.ts` gains `gc_owner_contract_now`, `gc_send_owner_pay_app`, `gc_record_certificate` and the three columns, and the dev-mcp catalog is rebuilt. **In the same PR, `src/lib/gc/ownerBillingRows.test.ts` gains `invoice_id: null` and `conditional_waiver_id: null` on its pay application row and `invoice_id: null` on its interest bill row**, since the generated Row types now carry them. Nothing else builds those rows.

## Tested

- **The whole-schema SQL bed**, `scripts/pgtest-gc-owner-billing.sh` (`npm run test:pg:gc-owner-billing`; `.github/workflows/sql-beds.yml` runs it on a PR that touches Owner Billing's SQL). Every migration applies in order, this one a second time with no change, then `supabase/tests/gc_owner_billing/20_scenario.sql` runs through RLS as a dev, the controller, an estimator and a dev in training mode, in one transaction that rolls back:
  - the service type once, billing-only and last; the grants and the trigger; anon reaching none of the functions;
  - every refusal of a send and of a certificate, in its words, and none of them filing anything;
  - the first send opening the billing job, the next sends keeping its revenue at the contract, the controller's send and certificate, a certificate of nothing making no bill;
  - the billing-only guards and searches holding for the job the send opened;
  - the certificate, the bill's link and the waiver's link staying once written, a deleted bill clearing its link, and the project's delete taking its pay applications and lines while the billing job stays.
- Before the cut, a local Postgres 15 run with stand-ins for the Pipeline tables (Helper 5; the mockup's *Checked on a local Postgres 15*).

## Status

**Applied to prod 2026-10-08 at 23:03 UTC** by the lead (GC MODE) from a clean checkout at main's tip (61a69da8c) with `scripts/db-push.sh`, in the evening batch; drift 808/808 after. The push noted the links-once trigger did not exist yet before creating it, as the idempotent `DROP TRIGGER IF EXISTS` says. Verified the same hour through the management API, every write rolled back:

- Step 1: `General contracting` once, `billing_only` true.
- Step 2: `gc_owner_pay_apps` has `invoice_id` and `conditional_waiver_id`, `gc_owner_interest_bills` has `invoice_id`, the trigger `gc_owner_pay_apps_links_once` is there, and `authenticated` may update `invoice_id` but not `due`.
- Steps 3 and 4, as a dev on the test project: the contract signed at test numbers, pay application 1 sent, and the billing job read `billing_only` true, `working`, customer *GC Test Owner LLC*, `project_id` null, type *General contracting* and revenue equal to `gc_owner_contract_now`; the certificate made a bill reading `billed`, $4,500 (five trades at $900), `billed_at` 12:00 Central, and the pay application's `invoice_id` is that bill.
- Step 5: a second certificate gave *The certificate on pay application 1 is recorded already.*; clearing `invoice_id` gave *Pay application 1 has its bill, so it keeps it.*
- After the rollbacks: 0 pay applications, no billing job on the project, 0 billing-only jobs.

The types PR follows (Helper 17), with the three null fields in `ownerBillingRows.test.ts`.
