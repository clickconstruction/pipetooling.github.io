# 20261010023000_revenue_keeps_check_fee.sql (2026-10-09, v2.5091)

Every rewrite of a job's revenue from its line items keeps a returned check's fee. Shipped with v2.5091, whose client half fixes Edit Job's billing save the same way (`jobFormRiderFeesDollars`).

**Why.** `add_ar_return_case_fee` (v2.5033, `20261010003000`) puts the $30 on the bill the check paid (`amount` and `fee_lines`) and raises `jobs_ledger.revenue` by $30, as `create_hazmat_fee_incident` does. Four writers then set the revenue from the line items again, and none of them knew the fee: Edit Job's billing save (the line items plus the hazmat riders), `apply_job_discount` and `record_job_tip_from_deposit` (the line items plus the un-voided hazmat fees), and `add_collect_payment_fixture_from_job_book` (the line items alone). The first of them to run wrote the $30 away while the bill kept it, so the job's total no longer covered its bills.

## What it does

1. **`job_rider_fees(p_job_id uuid) RETURNS numeric`**, `LANGUAGE sql STABLE`, SECURITY INVOKER. The riders, the fees that ride on a job beyond its line items:
   - its un-voided hazmat fees (`job_hazmat_incidents.fee_amount`, `voided_at IS NULL`), the sum the two functions below already added;
   - every returned check fee on its bills: a `jobs_ledger_invoices.fee_lines` entry whose `case_id` is a non-blank string, with an amount that is a JSON number or a plain decimal string, each rounded to the cent and never below zero. A line that names no case is not counted.

   The client's twin is `jobFormRiderFeesDollars` over `returnedCheckFeeCents` (`src/lib/jobs/jobFormMoneyTotals.ts`, `arReturnCaseFee.ts`), with the same rules. `EXECUTE` is revoked from `PUBLIC` and `anon` and granted to `authenticated` and `service_role`. Called from inside the SECURITY DEFINER functions below, it reads as their owner.
2. **`apply_job_discount`**, restated byte for byte from `20260911000000` but for its revenue sum: the named rows' count × price plus `job_rider_fees(p_job_id)`, in place of its own hazmat sum.
3. **`record_job_tip_from_deposit`**, restated byte for byte from `20260916060000` the same way.
4. **`add_collect_payment_fixture_from_job_book`**, restated byte for byte from `20260902152109` but for its revenue sum, which counted the line items alone. It now adds `job_rider_fees`, so it also stops dropping a hazmat fee, the rewrite v2.1029 fixed in the client.

Each keeps its signature, so `CREATE OR REPLACE` keeps its grants and its comment. No table is created or altered. `SET lock_timeout = '3s'` comes first, and the file is idempotent.

**Left as it is.** `gc_owner_billing_revenue` keeps a GC billing job at the contract plus the interest billed, and every pay application, certificate and interest bill resets the revenue to it. A returned check fee on one of that job's bills would be dropped there. Its SQL is lifted byte for byte from `spike/gc-mode`, so adding `job_rider_fees(billing_job_id)` to it is the GC crew's change. Turnaway trip charges are a separate gap: `create_turnaway_trip_charge` raises the revenue with no line and no rider, so these rewrites drop a trip charge as they always have.

## Apply order

Either. The client half needs nothing from this file, and these functions need nothing from the client. Before the push, Edit Job keeps the fee and the three functions still drop it. Regenerate `src/types/database.ts` and the dev-mcp catalog after the push: `job_rider_fees` is new, and no client calls it.

## Checked before the PR

On PGlite 0.5.8 with stand-ins for the tables and helpers the four bodies read, two beds from one seed. Southern Post has $13,680 on bill 1 with the $30 fee, a $2,000 line not billed, a $500 hazmat fee and a voided $250 one. Bill 2 carries a fee line with no case, a blank case, a bad amount, a negative one, a numeric case, two junk entries and a case-named `"20"`. Bill 3's `fee_lines` is an object, and bill 4's is null.

- **Before** (the three functions as main defines them): Add discount wrote $16,080, the tip $16,230 and Collect Payment $15,830. Each lost the $30, and Collect Payment lost the $20 and the $500 too.
- **After** (the file applied twice):
  - `job_rider_fees` reads $550 for Southern Post (500 + 30 + 20), $0 for a job with no rider, and $0 for an unknown job;
  - Add discount writes $16,130, the tip $16,280 and Collect Payment $16,380;
  - on a job with no rider the three write $900, $1,025 and $1,150, its lines alone;
  - Add discount answers the revenue it wrote, a sub still cannot record a tip, and the office still cannot use the field's Collect Payment;
  - `anon` cannot run `job_rider_fees`, `apply_job_discount` or `record_job_tip_from_deposit`, `authenticated` can, and each keeps its comment.
- **Four SQL mutants**, each alone, each failed the bed: `job_rider_fees` without its case check ($655), counting a voided hazmat fee ($800), the tip without the riders ($15,730), and Collect Payment counting the riders twice ($16,930).
- `src/lib/jobs/jobRiderFeesSql.test.ts` pins the newest bodies in CI. Every function that sets the revenue to a figure it worked out from the line items must add `job_rider_fees`, except `create_job_from_estimate`, which sums a job it has just made.

## Verify after the push

Read-only, over the pooler:

1. `SELECT public.job_rider_fees(id) FROM jobs_ledger WHERE id = <a job with a hazmat fee>` equals that job's un-voided hazmat fees.
2. `SELECT prosrc LIKE '%job_rider_fees(p_job_id)%' FROM pg_proc WHERE proname IN ('apply_job_discount', 'record_job_tip_from_deposit', 'add_collect_payment_fixture_from_job_book')` reads true three times.
3. Any job whose bill carries a `fee_lines` entry naming a case: its revenue equals its named lines plus `job_rider_fees`, unless it holds a trip charge or a hand-set total. A job short by its fee lost it before this fix, and its revenue is raised by hand.
