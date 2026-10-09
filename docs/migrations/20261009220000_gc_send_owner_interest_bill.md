# 20261009220000_gc_send_owner_interest_bill.sql

GC mode, Owner Billing's O6b-2: our bill for the interest on late bills (v2.5003). The plan is `to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md` → PR 8, and the SQL is `to-dos/gc-mode/mockups/owner-billing-o6-money.md`'s *O6b-2's SQL as built*, byte for byte, on branch `spike/gc-mode` as amended at 8c2179e4b. It needs O1's `gc_owner_interest_bills` (`20261008010000`) and O4a-1's `invoice_id` on it with O4a's functions (`20261009200000`).

It is additive and idempotent: three functions created or replaced, no table, no lock on a table.

## What it does

1. **`gc_owner_billing_revenue(project)`**: the billing job's revenue, our price today (`gc_owner_contract_now`) plus every interest bill on the job. SECURITY INVOKER.
2. **`gc_send_owner_pay_app` and `gc_record_certificate`**, restated word for word from `20261009200000`. The only change is their revenue reset, which now calls `gc_owner_billing_revenue` in place of `gc_owner_contract_now`.
   - The first send's insert keeps `gc_owner_contract_now`, since no interest bill can exist before the billing job.
   - `gc_owner_contract_now` stays the contract, which the G702 reads.
   - The comments and the `COMMENT ON FUNCTION` text are O4a's as they were.
3. **`gc_send_owner_interest_bill(project, amount)`**, SECURITY INVOKER, under a lock on the project's row.
   - It refuses, in words: a project that is not there, a job with no rate (`owner_late_interest_pct_per_month`), a project with no billing job, and nothing to bill (the amount rounds to 0 or less).
   - It makes the bill on the billing job: `billed`, today, at noon Central, as a certificate's is.
   - It files the job's next interest bill: number, today, the amount to the cent, `invoice_id`, `created_by`.
   - It raises the job's revenue to `gc_owner_billing_revenue` and its last bill day to today.
   - It returns the interest bill's id. The window offers `ownerInterest().toBill` and never more; the database cannot work interest out.

**Why the revenue moves:** O4a kept the billing job's revenue at the contract so that a payment marks the job paid only once the whole contract is in. `mark_invoice_paid` sets `paid` once revenue ≤ payments_made. Paid interest beyond the contract could otherwise mark the job paid while a bill is still open, and the portal statement drops bills on paid jobs.

The money team's policies are the gate. An estimator is refused at the interest bill's insert, and a training account by O1's read-only blocks.

## The lock note

`CREATE OR REPLACE FUNCTION` and its grants take no lock on a table. `SET lock_timeout = '3s';` heads it as every migration's does. The two restated functions are replaced in place: a send or a certificate running at that moment finishes on the old body.

## Verify after the push

1. **The new functions are there once, SECURITY INVOKER, for the signed in only.** `SELECT count(*), bool_and(NOT prosecdef) FROM pg_proc WHERE proname IN ('gc_owner_billing_revenue', 'gc_send_owner_interest_bill');` gives `2, true`. Neither is executable by `anon`.
2. **The restated functions carry the helper.** `SELECT prosrc LIKE '%gc_owner_billing_revenue%' FROM pg_proc WHERE proname IN ('gc_send_owner_pay_app', 'gc_record_certificate');` gives `true` twice.
3. **Revenue unchanged on prod.** No interest bill exists yet, so every billing job's revenue still equals `gc_owner_contract_now` of its project.
4. **The check to the inbox** waits for Grace's yes in Helper 15's chat: an interest bill on the test project's late test bill, emailed to bids@clickplumbing.com only.

## The SQL beds

`scripts/pgtest-gc-owner-billing.sh` re-applies O4a's, O5b's and this migration in their order, so this one's restated functions are last. `20_scenario.sql` (O4a's readings) is unchanged and passes on them. `30_interest.sql` checks:
- the contract signed at 185,000, with the first send and the certificate at it;
- no interest bill without a rate, and nothing to bill refused;
- the interest bill to the cent, raising the revenue to 185,284.92;
- the restated send and certificate keeping it there;
- a second interest bill taking the next number;
- an estimator and a trainee stopped.
