---
name: "Returned checks: the pieces left after the train"
number: 76
group: residual
status: >
  The returned-check train shipped 2026-10-01 — v2.4313 (a check that came back cannot pay a bill) ·
  v2.4320 (the case opens itself, one notice per case) · v2.4325 (work the case in Accounts Receivable) ·
  v2.4328 (the payer remembers) · v2.4330 (the unconditional waits for a check to clear) · v2.4333
  (Bill Customer's line, the clears-about note). Left: four pieces the plan set aside, none started.
summary: >
  Every check the bank sends back is now a case on top of To match, told to the office once,
  taken off every job in one press, closed when the new check lands. Four things were set aside
  on purpose and are kept here so they are not lost.
next: >
  Pick which, if any: (1) Stripe chargebacks and failed bank debits; (2) a returned-check fee
  line; (3) a check recorded by hand and never deposited; (4) the older customer-release queue
  waiting for a check to clear.
size: M (1) · S (2, after the owner's call and the fee amount) · M (3) · S (4)
blocker: (2) is the owner's call, and Texas caps the fee (the amount is not verified here).
opinion: leave all four until one happens; (1) first if a chargeback ever lands.
mockup: not required — each piece copies the case and its words, which exist
---

# Returned checks: the pieces left after the train

The plan, the two critiques and the twelve boards: *Returned checks — #76 mock-up* — https://claude.ai/artifact/9qbiCTmbaXnfPVKhFULoCN. The first drawing stays beside this card (`ar-returned-checks-before-after.html`). The release notes and `docs/recent-features/` v2.4313–v2.4333 carry what shipped.

## The pieces

1. **Stripe chargebacks and failed bank debits.** `stripe-webhook` handles `invoice.payment_failed` only by syncing the status (and skips it once the app row is paid); it reads no `charge.dispute.*`. A card chargeback after a bill reads paid has the same shape as a bounced check. When one lands: open a case on the Stripe bill from the webhook, the same pane and words.
2. **A returned-check fee.** Offer a fee line on the bill when a check bounces. The owner's call; Texas caps the processing fee, and the amount has not been verified here.
3. **A check recorded by hand and never deposited.** About a third of the last 90 days' payments carry no bank link; most are cards or untyped. Limited to payments typed as checks, a payment with no deposit after ten days could open a case like a rejected check (two in 90 days on 2026-10-01).
4. **The older customer-release queue** (`useLienReleasesOwedNudge`, the Dashboard's *lien-unconditional* card) still asks for a release the day a job is paid. The GC waiver cell waits seven days for a check (v2.4330); this queue could read the same `billCheckClearsYmd`.

## Where it plugs in

- The case: `mercury_transaction_ar_returned` (source bank · hand · rejected), `list_ar_return_cases`, `open_ar_rejected_check_cases` (20261001230000); the pane `src/components/jobs/ar/ArReturnCasePane.tsx`, kernel `src/lib/jobs/arReturnCase.ts`; the notice `supabase/functions/_shared/arReturnCaseNotify.ts`.
- Clearing: `src/lib/jobs/checkClearing.ts`.
