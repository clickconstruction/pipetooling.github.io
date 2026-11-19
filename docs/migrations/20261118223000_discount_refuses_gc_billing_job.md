# 20261118223000_discount_refuses_gc_billing_job.sql (2026-11-18, v2.7862)

Add discount refuses a job billed from the GC desk.

`apply_job_discount` (Bill Customer's **− Add discount**) adds a discount line and then writes the job's total again from its lines and its riders. A GC project's billing job is not priced by its lines. `gc_owner_billing_revenue` keeps its total at the contract, the interest billed and the riders. A discount there would have moved the total off the contract figure until the next Owner Billing write laid it again.

It was found while building Put on a bill ([`20261118060000`](./20261118060000_trip_bill_line.md), v2.7769). The owner's answer for a trip's line on such a job was to refuse: on a job we build as the GC the price changes only by a signed change order. This gives the discount the same answer.

## What it changes

One function restated: `apply_job_discount`, from its newest body (`20261010023000_revenue_keeps_check_fee.sql`), with one check added after the caller's own checks and before anything is written:

- a job that is some GC project's `billing_job_id` is refused with errcode `22023` and the words *This job is billed from Owner Billing on the GC desk. Its price changes only by a signed change order, so a discount goes on a change order there.*

Nothing else in the body changes. The file was generated from the newest body by a script, and a diff of the two bodies shows the check alone. `CREATE OR REPLACE` keeps the function's owner and grants.

## What it does not touch

- No job's total. No GC project had a billing job on prod when this was written (read 2026-11-18).
- The Job window's own line items. Its **− Add discount** adds a row to the form, and the form's save writes it. That door does not call this function. A GC billing job's lines edited there are a separate question, written up in the fragment.
- The riders. The total is still the lines plus `job_rider_fees`, as `jobRiderFeesSql.test.ts` pins.

## Locks

No DDL beyond the `CREATE OR REPLACE`. The file starts with `SET lock_timeout = '3s'`. It is idempotent.

## Tests

- `supabase/tests/trips/50_bill_line.sql`, step 12, on the bed's own GC billing job: an assistant's discount is refused in those words, the job keeps its total and gains no line, and a discount on another job is taken as before.
- `gcBillingJobDiscount.test.ts` reads this file and holds the client's sentence to the function's, word for word.

## Applied

2026-11-18 (01:05 UTC on the 19th), by `scripts/db-push.sh`, in the same push as `20261118213000`. The drift check after it read every file applied.

## Verified on prod

A read of the function's own text on prod found the refusal. No GC project had a billing job that day, so the refusal could not be met with a real job. The trips bed holds it, on a made-up GC billing job.
