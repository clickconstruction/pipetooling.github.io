# 20261010044000_trip_charge_rider.sql (2026-10-09, v2.5129)

A turnaway trip charge rides on its job like a fee, so no rewrite of the revenue from the line items writes it away. Shipped with v2.5129. Its client half makes Edit Job's Job Total and billing save count the trip charge (`riderFeeLineCents`), and keeps the money waterfall from reading its bill as money covering a line.

**Why.** `create_turnaway_trip_charge` (2026-07-04, `20260709130000`; newest body `20260927230000`) puts a trip charge on its own non-primary `ready_to_bill` bill and raises `jobs_ledger.revenue` by the same amount. Four writers then set the revenue from the line items again, and none knew the trip charge:
- Edit Job's billing save (line items plus riders);
- `apply_job_discount`;
- `record_job_tip_from_deposit`;
- `add_collect_payment_fixture_from_job_book`.

The first of them to run wrote the trip charge away while its bill kept it, so the job's total no longer covered its bills. The function's own comment named two of these as caveats. [`20261010023000`](20261010023000_revenue_keeps_check_fee.md) fixed the same gap for a returned check fee by counting the riders in `job_rider_fees`. But a trip charge had nothing to count: its only marker was the bill's memo. The office can rewrite that memo at send (`create-stripe-invoice`) or on a draft, and Split renames it per part. So this file gives a trip charge a rider record of its own on its bill, the way the check fee and the GC card fee (v2.5113) record theirs.

## What it does

1. **`job_rider_fees`**, restated byte for byte from `20261010026000`, its newest body, but for one more kind of `fee_lines` entry it sums: one whose `trip_charge` is a non-blank string. The other riders stay counted: the hazmat fees, a returned check fee (`case_id`) and a GC card fee (`card_bill`). The three SQL writers call it and are not restated. `gc_owner_billing_revenue` (`20261010026000`) adds `job_rider_fees(billing_job_id)`, so a GC billing job follows with no further change. The client twin is `riderFeeLineCents` (`src/lib/jobs/arReturnCaseFee.ts`), behind `jobFormRiderFeesDollars`.
2. **`create_turnaway_trip_charge`**, restated byte for byte from `20260927230000` but for its `INSERT`. The bill now carries `fee_lines = [{trip_charge: <reason>, amount}]`. The entry has no description, so the reprinted bill draws no row of its own for it (`billFeeLines`), and Stripe never reads `fee_lines`. Its comment is rewritten: the two caveats are gone, and deleting the bill now takes the trip charge out at the next rewrite.
3. **The trip charges made before this file** get the entry, but only a bill the function made. A bill must meet all of these:
   - its memo is exactly the function's (`Trip charge — client not home` or `Trip charge — site not ready`);
   - it is not the primary bill;
   - no line item is linked to it;
   - it has no `fee_lines` entry yet;
   - a dispatch request on the same job was closed the same company day with the function's exact note for the bill's amount and reason (*Trip charge created — $99.00 (client not home)*). Every trip charge made in the app closes one: `CreateTripChargeModal` always passes its request.

   A bill typed by hand, a split part, a renamed memo or a changed amount stays as it is. A second run changes nothing.

No table is created or altered. Each function keeps its signature, so `CREATE OR REPLACE` keeps its grants. `SET lock_timeout = '3s'` comes first.

**Locks.** The two `CREATE OR REPLACE FUNCTION`s lock only their functions. The backfill `UPDATE` takes `ROW EXCLUSIVE` on `jobs_ledger_invoices`, which is compatible with every read and write the app makes. It locks only the rows it marks: none on production as of 2026-10-10 02:42 UTC.

## Apply order

Client first (the merge), then the push. A client from before this merge counts no trip charge entry. Once the function writes them, that client's Edit Job would still drop a trip charge on save, as it does today, until it reloads.

## Checked before the PR

On PGlite 0.2.17 with stand-ins (`supabase/tests/revenue_riders/00_schema.sql`), and as the house bed `scripts/pgtest-revenue-riders.sh` on Postgres 15 in Docker (18 checks, all ok).
- The three functions as main defines them are lifted from their migrations.
- The seed is made through them.
- The migration is applied twice, then the scenario runs.

The seed:
- **Southern Post:** lines of $1,000 and 2 × $250, a $200 hazmat fee and a voided $75 one, a $30 returned check fee on bill 1, and a $99 trip charge (client not home) made by main's function.
- **Job B:** one bill per backfill guard. A $250 trip charge made by the function. One whose amount changed after. One with a check fee on it. One whose memo the office renamed. And typed by hand, each with a matching closed note: one with a line item on it, the primary bill, a split part, one made yesterday, and one with no note.

- **Before** (main, no migration): after the $99 trip charge the revenue is $1,829. Add discount ($10) then writes **$1,720**, losing the $99, while the bills total $929. Edit Job's save (the render test) writes $2,800 for Hawthorne where $2,899 is right.
- **After:**
  - the backfill marks exactly the two bills the function made, once each, and leaves the eight others alone;
  - `job_rider_fees` reads $329 for Southern Post (200 + 30 + 99), $0 for a job with no rider, and $0 for an unknown job;
  - Add discount writes **$1,819**;
  - a trip charge made now carries `[{"trip_charge": "site_not_ready", "amount": 250}]` from the start, with no description, and the revenue rises by $250;
  - a second press on its closed request is a duplicate and makes no second bill;
  - the next discount writes $2,064;
  - deleting that bill takes the $250 out at the next rewrite ($1,813).
- **Nine SQL mutants**, each alone, each failed the bed:
  - `job_rider_fees` without the trip charge key ($230);
  - the function writing no entry;
  - the backfill without, in turn, the exact memo, the primary guard, the empty `fee_lines` guard, the line item guard, the same day, the note's amount, and the dispatch request at all (3, 3, 3, 3, 3, 4 and 5 bills marked, where 2 is right).

## Verify after the push

Read-only, over the pooler, with `SET default_transaction_read_only = on`:

1. `SELECT prosrc LIKE '%''trip_charge''%' FROM pg_proc WHERE proname IN ('job_rider_fees', 'create_turnaway_trip_charge')` reads true twice.
2. **The backfill's set.** On 2026-10-10 at 02:42 UTC production held **no trip charge at all**. No bill memo mentioned *trip*, and no dispatch request was closed with *Trip charge created*. So the expected set is **0 bills**. The query that reads it after the push:
   ```sql
   SELECT i.id, i.job_id, i.amount, i.fee_lines
   FROM public.jobs_ledger_invoices i, jsonb_array_elements(coalesce(i.fee_lines, '[]'::jsonb)) l
   WHERE l ? 'trip_charge';
   ```
   A trip charge made between this check and the push is marked by the backfill if it passes the guards, and shows here.
3. **Jobs that already lost a trip charge.** None can exist, since no trip charge was ever made. For the record: a job whose bill carries a trip charge entry has its revenue at least its named lines plus `job_rider_fees(id)`, unless the total was set by hand.
