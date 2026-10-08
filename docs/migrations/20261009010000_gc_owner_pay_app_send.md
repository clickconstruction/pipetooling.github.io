# 20261009010000_gc_owner_pay_app_send.sql (stamp and version claimed at the cut)

GC mode, Owner Billing's O4a: our bill to the customer. The plan is `to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md` → *The RPCs*, and the SQL is `to-dos/gc-mode/mockups/owner-billing-o4a.md`'s, byte for byte, on branch `spike/gc-mode`. **The billing-only job's migration (`mockups/billing-only-job.md`) is pushed first:** this one sets `jobs_ledger.billing_only`.

It is additive and idempotent, and it creates no table.

## What it does

1. **The "General contracting" service type**, last in the order, if missing. `jobs_ledger.service_type_id` is required, and the billing job is not Plumbing, Electrical or HVAC.
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
   - revenue kept at the contract.
6. **`gc_record_certificate(pay_app, amount, on, note)`** records the certificate and makes the bill on the billing job for what was certified: `billed`, at noon Central that day. It records once, and certifying nothing makes no bill.

Both functions are SECURITY INVOKER, so the GC tables' dev-only policies and the Pipeline's own insert policies decide who may.

## The lock note

- `ALTER TABLE gc_owner_pay_apps` / `gc_owner_interest_bills`: empty on prod at the push, so the instant locks queue nothing.
- `INSERT INTO service_types`: one row.
- No busy table is touched. `SET lock_timeout = '3s';` is first anyway.

## Verify after the push

Each step from 3 on runs as a dev, in one transaction that rolls back, on the test project. Its contract must be signed at test numbers, with a signed change order at 50%.

1. **The type is there once.** `SELECT count(*) FROM service_types WHERE name = 'General contracting';` gives 1.
2. **The columns, the trigger and the grants.**
   - `\d gc_owner_pay_apps` shows `invoice_id` and `conditional_waiver_id`.
   - `SELECT tgname FROM pg_trigger WHERE tgname = 'gc_owner_pay_apps_links_once';` gives 1 row.
3. **A send.** `SELECT gc_send_owner_pay_app('<project>', '<the window's payload>');` returns an id. Then:
   - `gc_projects.billing_job_id` is set;
   - the job reads `billing_only`, `working`, "<project> (GC)", the customer's name, revenue = `gc_owner_contract_now('<project>')`, `project_id` null.
4. **A certificate.** `SELECT gc_record_certificate('<the id>', <due>, app_today(), '');` returns a bill id. The bill reads `billed`, the amount, and `billed_at` at 12:00 Central today. The pay application's `invoice_id` is that bill.
5. **Once.**
   - The same call again is refused: *The certificate on pay application 1 is recorded already.*
   - `UPDATE gc_owner_pay_apps SET invoice_id = NULL WHERE id = '<the id>';` is refused: *Pay application 1 has its bill, so it keeps it.*

`ROLLBACK;` Then `npm run check:migration-drift`, and the types PR: `database.ts` gains the two functions, the three columns and `gc_owner_contract_now`. In the same PR, O5a's test rows gain `invoice_id: null` and `conditional_waiver_id: null`, since the generated Row types now carry them.

Tested before the cut on a local Postgres 15, with O1's and O3's migrations and stand-ins for the Pipeline tables. The cases are in the mockup's *Checked on a local Postgres 15*.
