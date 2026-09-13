# 20260913150812_promise_payer_follows_bill_to_rule.sql (2026-09-13, v2.3374)

Payment promises are filed under the party that pays the bill. The two promise
writers from `20260911051414` (the `job_promised_pay_dates` trigger and
`add_job_payment_promise`) snapshotted `customer_id` as
`COALESCE(j.gc_customer_id, j.customer_id)` — the pre-v2.3345 guess that any
job with a GC is a job the GC pays. Every reader has followed
`jobs_ledger.bill_to_party` since v2.3346, so on a customer-pays job that names
a GC (Done Right's pretests) the homeowner's promise landed on the GC's
reliability record and pay-speed spread.

- New pure helper `job_bill_payer_customer_id(bill_to_party, customer_id, gc_customer_id)`
  holds the statement RPC's CASE for a job with no invoice pick in play: the GC
  entered as the job customer pays by definition; rule `gc` with a GC set → the
  GC; `customer`, `split`, or `gc` with no GC → the job customer. Client mirror:
  `jobPromisePayerCustomerId` in `src/lib/jobs/billToParty.ts` (tested one case
  per branch) — keep them in step.
- `CREATE OR REPLACE` of `job_promised_pay_dates_log_promise()` and
  `add_job_payment_promise(...)`, bodies verbatim except the payer line.
- One idempotent `UPDATE` re-snapshots office-sourced promise rows the old
  COALESCE misfiled (job rule bills the customer, a distinct GC is named, the
  row sits on the GC). Dry run on 2026-09-13: prod held **1** promise row in
  total, already filed correctly — the statement matches nothing today and
  exists for any promise recorded between merge and the push. Portal
  self-promises (`source = 'customer'`) are never rewritten.
- `add_customer_payment_promise` (`20260911052931`) is left as is: it accepts a
  job where the caller is either party because the portal already narrows the
  job list to what the viewer owes (`owedJobIdsForViewer`), which honors
  invoice-level picks on split jobs that a job-level rule cannot.

No CREATE TABLE, no new grants, no client change needed before the push — the
readers already key on the payer. Apply with `supabase db push` after merge.
