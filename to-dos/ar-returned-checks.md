---
name: "Returned checks: the pieces left after the train"
number: 76
group: close
status: >
  The returned-check train shipped 2026-10-01 — v2.4313 (a check that came back cannot pay a bill) ·
  v2.4320 (the case opens itself, one notice per case) · v2.4325 (work the case in Accounts Receivable) ·
  v2.4328 (the payer remembers) · v2.4330 (the unconditional waits for a check to clear) · v2.4333
  (Bill Customer's line, the clears-about note). All four pieces the plan set aside have shipped: (4) as
  punch list #83 row 5 (v2.4564), (3) as v2.4902, (1) as v2.4950 (Stripe disputes and failed bank
  debits; `check:edge-drift` read all 146 functions current at 20:35 UTC on 2026-10-09, so stripe-webhook
  and ar-returned-checks are deployed) and (2) as v2.5033 (*Add the $30 fee to bill N*, migration
  20261010003000 on prod 2026-10-09) with v2.5091 (the fee survives the revenue rewrites, migration
  20261010023000 on prod 2026-10-09, types #5196) and v2.5102 (the Bill tab no longer reads the fee as covering
  the next unbilled line, client only). Left: two live steps for (1), the office's and the owner's.
summary: >
  Every check the bank sends back is now a case on top of To match, told to the office once,
  taken off every job in one press, closed when the new check lands. Four things were set aside
  on purpose and kept here so they were not lost; all four have shipped, and two live steps for the
  Stripe cases are what keeps the card open.
next: >
  Grace subscribes the Stripe webhook endpoint (test and live) to `charge.dispute.created`,
  `charge.dispute.updated`, `charge.dispute.closed` and `payment_intent.payment_failed`; then one
  test-mode dispute on a ZZ TEST Stripe bill (Stripe's dispute test card: the case opens, the notice
  goes out, Put the bill back). Delete this card once those are done.
size: XS (two live steps, no code)
blocker: The office's and the owner's — a Stripe Dashboard setting and one test dispute.
ver: v2.4902 · 4950 · 5033 · 5091 · 5102
opinion: your call — the code is done; the two live steps are the office's and the owner's.
mockup: not required — each piece copies the case and its words, which exist
---

# Returned checks: the pieces left after the train

The plan, the two critiques and the twelve boards: *Returned checks — #76 mock-up* — https://claude.ai/artifact/9qbiCTmbaXnfPVKhFULoCN. The first drawing stays beside this card (`ar-returned-checks-before-after.html`). The release notes and `docs/recent-features/` v2.4313–v2.4333 carry what shipped.

## The pieces

1. **Stripe chargebacks and failed bank debits.** Shipped v2.4950: `stripe-webhook` opens a case on the bill (`ar_stripe_cases`, `record_ar_stripe_case`). It shows as *card disputed* until Stripe decides, *dispute lost* with **Put the bill back** (`put_back_lost_dispute_bill`) once the customer wins, or *bank payment failed* for an ACH debit.
2. **A returned-check fee.** Shipped v2.5033: *Add the $30 fee to bill N* on a Came back case (`add_ar_return_case_fee`, `list_ar_return_case_fees`, the bill's `fee_lines`, the case's `fee_*` columns; the kernel `src/lib/jobs/arReturnCaseFee.ts`). v2.5091 keeps the fee in the job's total when Edit Job, Add discount, a tip or Collect Payment rewrites the revenue (`job_rider_fees`). v2.5102 keeps it off the ② waterfall: the fee is its bill's own line, so it covers no unbilled line (`dollarCoverageForSegments`). Set aside on purpose: a Stripe bill takes no fee, a check that paid no bill by name gets no press, § 3.506(c) is on the hover and not checked, and the GC billing job's revenue reset (`gc_owner_billing_revenue`) still drops a fee — the GC crew's change.
   - **The cap**: $30 is a ceiling — Tex. Bus. & Com. Code § 3.506(b), *"may charge the drawer or indorser a maximum processing fee of $30"*, as amended by H.B. 2793 (82nd Leg., R.S., ch. 333, eff. Sept. 1, 2011; enrolled text at capitol.texas.gov/tlodocs/82R/billtext/html/HB02793F.htm); no later amendment to (b) found (read 2026-10-09).
3. **A check recorded by hand and never deposited.** Shipped v2.4902: an *unbanked* case under Came back (`ar_unbanked_check_cases`, `open_ar_unbanked_check_cases`, ten days, floor Jul 1 2026); eight opened quietly on the push.
4. **The older customer-release queue.** Shipped as punch list #83 row 5 (v2.4564): the Dashboard queue and the Bill Customer strip wait for a check to clear. A release with no bill-line snapshot still reads the job's total paid on the strip; none of the live conditional releases is one (2026-10-08).

## Where it plugs in

- The case: `mercury_transaction_ar_returned` (source bank · hand · rejected), `list_ar_return_cases`, `open_ar_rejected_check_cases` (20261001230000); the pane `src/components/jobs/ar/ArReturnCasePane.tsx`, kernel `src/lib/jobs/arReturnCase.ts`; the notice `supabase/functions/_shared/arReturnCaseNotify.ts`.
- Clearing: `src/lib/jobs/checkClearing.ts`.
