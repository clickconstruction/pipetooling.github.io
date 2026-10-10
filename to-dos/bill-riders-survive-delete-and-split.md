---
name: "A fee on a bill survives the bill being deleted or split"
number: 105
group: ready
status: found 2026-10-09 while building the trip charge rider (PR #5255) · gap 2 (the split) built v2.5140: a trip charge moves to a part, a bill with a GC card fee is refused (GC mode's half) · gap 1 (the delete) built v2.5144, migration 20261010062000, pushed by the lead after the merge; with it Split refuses a bill that carries a returned check fee too · the write-down cap left
summary: >
  A fee rides on its bill: a returned check fee, a GC card fee, a turnaway trip charge. Each is a
  fee_lines entry that job_rider_fees counts, so every rewrite of the job's total keeps it. Two ways
  lose one. Deleting a bill that carries a returned check fee takes the fee with it, but the case
  still says the fee is on, and the office cannot add it again. Splitting a bill makes parts that
  carry no fee entry, so a trip charge or a card fee on that bill drops out of the total at the next
  change.
next: The write-down cap from After #5255. Then a live walk of each gap on a ZZ TEST job: a split of a trip charge, and a fee that comes off with its bill.
size: S–M (the delete, a migration) · S (the split, client only)
blocker: None.
ver: v2.5033 · 5091 · 5113
opinion: build — each loses money the job is owed, and nothing tells the office
mockup: not required — the case's line and the press already exist; the split screen does not change
---

# A fee on a bill survives the bill being deleted or split

## Where the riders live

A fee that rides on a job beyond its line items raises the job's revenue when it goes on, and every rewrite of the revenue from the line items adds it back through `job_rider_fees` (SQL) and `riderFeeLineCents` (client). Three of them live on a bill, as an entry in `jobs_ledger_invoices.fee_lines`:

- a returned check fee, an entry that names its case ([v2.5033](../docs/recent-features/v2.5033.md), counted since [v2.5091](../docs/recent-features/v2.5091.md));
- a GC card fee, an entry that names its card bill ([v2.5113](../docs/recent-features/v2.5113.md));
- a turnaway trip charge, an entry that names its trip charge (PR #5255, migration `20261010044000`).

So when the bill row goes, or is rebuilt without its `fee_lines`, the rider goes too.

## Gap 1: deleting a bill that carries a returned check fee

**What happens.** `add_ar_return_case_fee` writes the fee three times: the case's `fee_amount`, `fee_invoice_id`, `fee_added_at` and `fee_added_by` (`mercury_transaction_ar_returned`), the bill's `fee_lines` entry, and the job's revenue. Deleting the bill:

- sets the case's `fee_invoice_id` to null (its foreign key is `ON DELETE SET NULL`, `20261010003000`), and keeps `fee_amount`, `fee_added_at` and `fee_added_by`;
- takes the `fee_lines` entry with the row, so `job_rider_fees` no longer counts the $30, and the next rewrite drops it from the revenue.

The case still reads *The $30 fee is on its bill, added Oct 9 by …* (`arCaseFeeOffer`, `src/lib/jobs/arReturnCaseFee.ts`, which finds no bill and says *its bill*). `add_ar_return_case_fee` refuses a second press: *This case already has its fee*. The office cannot put the $30 back on any bill.

**Reproduction**, on a ZZ TEST job with a check that came back:

1. In Accounts Receivable → Came back, open the case and press **Add the $30 fee to bill N**. The bill reads $30 more, and so does the job's total.
2. Press **Take it off the job**, so the bill is billed again with no payment.
3. Send the bill back (`delete_billed_invoice_on_send_back` deletes the row).
4. Make any money edit in Edit Job. The job's total drops by $30.
5. The case reads *The $30 fee is on its bill, added …* and offers no press.

**The fix to weigh.** When the bill goes, the fee goes back to the case as unplaced, and the press runs again.

- A migration that restates `add_ar_return_case_fee` to take a case whose `fee_invoice_id` is null but whose `fee_added_at` is set, as a fee that left with its bill. Or a `BEFORE DELETE` trigger on `jobs_ledger_invoices` that clears the case's `fee_*` columns for the row it deletes, and logs the removal as an event so the history keeps it.
- `arCaseFeeOffer` reads that case as *The $30 fee left with bill N. Add it again to bill M*, where today it says *on its bill*.

The trigger is the smaller change and covers every delete path: send back, Delete on a ready-to-bill bill, and Split's void. Size S–M: one migration with a SQL bed, and the kernel's words.

## Gap 2: splitting a bill drops its riders

**What happens.** **Split** (`SplitBillModal.tsx`) voids the Stripe bill and removes its ledger row (`ensureLedgerInvoiceRemovedAfterStripeSendBack` → `delete_billed_invoice_on_send_back`). It then inserts one `ready_to_bill` part per slice, all `is_primary_rtb_bundle = false`, with the renamed memo (`splitBillPartMemo`) and no `fee_lines`. The rider leaves with the original row, and no part carries it. The next rewrite of the revenue drops it, though the parts still add up to the whole bill, so the job's total no longer covers its bills.

A returned check fee never sits on a Stripe bill (`add_ar_return_case_fee` refuses one). So this hits the riders that do: a turnaway trip charge sent as a Stripe bill, and a GC card fee on its card bill.

**Reproduction**, on a ZZ TEST job:

1. Make a turnaway trip charge, then send its bill as a Stripe invoice from Bill Customer.
2. **Split** it into two parts.
3. Make any money edit in Edit Job. The job's total drops by the trip charge, while the two parts still add up to it.

**The fix to weigh.** The split carries the original's `fee_lines` entries onto one part: the first part, which takes the original's place in the bill order. When a rider is larger than that part, the part that can hold it takes it. Split only rewrites the client's insert, and `create-stripe-invoice` never reads `fee_lines`, so the parts' Stripe invoices do not change. Size S: the insert and a render test.

A GC card bill's split also loses the card bill's link. That half is GC MODE's to weigh.

## After #5255

Helper 12's review of the trip charge rider (#5255) left four follow-ups and a nit, none blocking:

1. **A write-down leaves a trip charge's rider at its first amount.** `apply_agreed_write_down_to_billed_invoice` (`20260927230000`) lowers the bill's amount, but its `{trip_charge, amount}` entry keeps the original. The next rewrite then puts the whole charge back in the job's total. The waterfall also attributes more to the bill than it holds. A returned check fee has the same shape, but there the bill is mostly work. Here the bill is the charge. Two ways to fix it:
   - trim the entry with the write-down: restate the write-down to lower a trip charge entry by what it takes off, down to zero;
   - cap each bill's riders at the bill's amount, in `job_rider_fees` and in `riderFeeLineCents`.

   The cap covers every rider and every way a bill's amount goes down. **S**: one migration with a bed case, and the client twin.
2. **The backfill skips a trip charge bill that already carries another entry**, for example a returned check fee on it. The bed pins that, and it matched nothing on production. Appending the trip charge entry when the bill has none would cover it. **XS**, and only if such a bill ever exists.
3. **The waterfall now attributes a GC card fee to its bill too**: `riderFeeLineCents` replaced `returnedCheckFeeCents` in `dollarCoverageForSegments`. That is right, but `jobSegmentsCoverage.test.ts` has no `card_bill` case. **XS**: one test.
4. **The backfill cannot mark a trip charge made without a dispatch request** (`p_dispatch_request_id` null). The app's modal always passes one, and production has none. **XS**: a one-off if one appears.
5. **Nit:** `create_turnaway_trip_charge`'s office check repeats `OR public.is_office_or_estimator()`. It was carried byte for byte; drop it at the next restatement. **XS**.

## How to verify

- **Gap 1:** the reproduction above ends with the case offering **Add the $30 fee to bill M**. Pressing it puts the $30 back on bill M and in the job's total. A SQL bed covers the trigger, deleting a bill that carries the fee.
- **Gap 2:** a render test on Split, where a bill carrying a trip charge entry splits into two parts and the first part carries the entry. Then a live split of a ZZ TEST trip charge, followed by an Edit Job money edit that keeps the total.
