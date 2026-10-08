---
name: "Returned checks: the pieces left after the train"
number: 76
group: residual
status: >
  The returned-check train shipped 2026-10-01 — v2.4313 (a check that came back cannot pay a bill) ·
  v2.4320 (the case opens itself, one notice per case) · v2.4325 (work the case in Accounts Receivable) ·
  v2.4328 (the payer remembers) · v2.4330 (the unconditional waits for a check to clear) · v2.4333
  (Bill Customer's line, the clears-about note). Of the four pieces the plan set aside, (4) shipped as
  punch list #83 row 5 (v2.4564), (3) as v2.4902 and (1) as v2.4950 (Stripe disputes and failed bank
  debits); (2) is left, the owner's call.
summary: >
  Every check the bank sends back is now a case on top of To match, told to the office once,
  taken off every job in one press, closed when the new check lands. Four things were set aside
  on purpose and are kept here so they are not lost.
next: >
  (2) a returned-check fee line once the owner answers (a row in owner-decisions-pending.md).
  After v2.4950 merges: the push, the stripe-webhook and ar-returned-checks deploys, the four Stripe
  endpoint events (Grace), and one test-mode dispute on a ZZ TEST Stripe bill.
size: S (2, after the owner's call and the fee amount)
blocker: (2) is the owner's call, and Texas caps the fee (the amount is not verified here).
opinion: leave (2) until the owner answers.
mockup: not required — each piece copies the case and its words, which exist
---

# Returned checks: the pieces left after the train

The plan, the two critiques and the twelve boards: *Returned checks — #76 mock-up* — https://claude.ai/artifact/9qbiCTmbaXnfPVKhFULoCN. The first drawing stays beside this card (`ar-returned-checks-before-after.html`). The release notes and `docs/recent-features/` v2.4313–v2.4333 carry what shipped.

## The pieces

1. **Stripe chargebacks and failed bank debits.** Shipped v2.4950: `stripe-webhook` opens a case on the bill (`ar_stripe_cases`, `record_ar_stripe_case`). It shows as *card disputed* until Stripe decides, *dispute lost* with **Put the bill back** (`put_back_lost_dispute_bill`) once the customer wins, or *bank payment failed* for an ACH debit.
2. **A returned-check fee.** Offer a fee line on the bill when a check bounces. The owner's call; Texas caps the processing fee, and the amount has not been verified here.
3. **A check recorded by hand and never deposited.** Shipped v2.4902: an *unbanked* case under Came back (`ar_unbanked_check_cases`, `open_ar_unbanked_check_cases`, ten days, floor Jul 1 2026); eight opened quietly on the push.
4. **The older customer-release queue.** Shipped as punch list #83 row 5 (v2.4564): the Dashboard queue and the Bill Customer strip wait for a check to clear. A release with no bill-line snapshot still reads the job's total paid on the strip; none of the live conditional releases is one (2026-10-08).

## Where it plugs in

- The case: `mercury_transaction_ar_returned` (source bank · hand · rejected), `list_ar_return_cases`, `open_ar_rejected_check_cases` (20261001230000); the pane `src/components/jobs/ar/ArReturnCasePane.tsx`, kernel `src/lib/jobs/arReturnCase.ts`; the notice `supabase/functions/_shared/arReturnCaseNotify.ts`.
- Clearing: `src/lib/jobs/checkClearing.ts`.
