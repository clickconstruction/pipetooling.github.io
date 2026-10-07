---
name: A check on a Stripe bill — hold the close, then move the stuck ones
number: 98
group: ready
status: >
  PR 1 on PR #4818 (v2.4801: Mark Paid · Check holds the Stripe close; Move to job… and Remove
  work on a held check; the daily sweep closes Stripe after seven days) · PR 2 built on
  claude/stripe-held-move (v2.4803: Move to job… on a check Stripe already holds, in one press)
  · left: the live tests, then job 186
summary: >
  **A check recorded on a Stripe bill no longer tells Stripe "paid" at once.** It is an
  ordinary payment for seven days, so a check on the wrong job moves with Move to job… and a
  check the bank returns comes off with Remove — no credit note, no send-back, no fresh
  invoice number. The sweep closes Stripe once the check has cleared. Left: the checks Stripe
  already holds (job 186 today), which still need the credit note and a fresh bill — PR 2
  puts that behind the same Move to job… so it is one press too.
next: >
  Deploy the three functions and push the migration, run both live tests below on test-mode
  bills, then job 186: Move to job… on Taunya's check (the owner's press — a real credit note
  and a fresh bill for Dudley Mason).
size: XS — live tests
blocker: none
ver: v2.4801
opinion: run the test-mode recipes first; job 186 (Dudley Mason, Taunya's check) is the first real use and sends the customer a fresh bill.
---

# A check on a Stripe bill — hold the close, then move the stuck ones

## The ask, in the owner's words

Taunya, 2026-10-07, on job 186 PLUM (Dudley Mason, a $6,200 Stripe bill marked paid by a
check that belonged on another job): *"need to be able to unlink payment"*. The row's ⋯ menu
offered *View the Stripe bill* and *Check didn't clear…* and nothing else.

The owner, asked whether the repair drawn for that row was the best we could do: *"No"* was
the agreed answer — the damage is the thing to stop. *"I like it, please come up with a code
plan and then build it."*

## The decision

The reason the repair needed a credit note, a send-back and a new invoice number was one
design choice: Mark Paid · Check told Stripe "paid" the moment the office typed it, and Stripe
never takes that back. The app already waits seven days on a check elsewhere (the lien-waiver
cell, `checkClearing.ts`), and Accounts Receivable closes Stripe only after the deposit is
matched. Mark Paid was the one door that skipped both.

So (PR 1, shipped as v2.4801):

- Mark Paid · Check at the whole open balance writes the ledger row only (`mark_invoice_paid`).
  The bill reads Paid here; the Stripe invoice stays open; the row is an ordinary payment.
- The daily sweep `close-held-stripe-marks` closes Stripe out of band seven days after the
  check's date, with the same `pt_*` metadata Mark Paid used to write. A check whose deposit
  the bank returned is never closed.
- Move to job… works on a held check, sent bill or not (the pay link is still open and the
  customer's number unchanged, so the bill just reads Billed again). Remove works too.
- Cash, wire, ACH, card and part payments keep closing Stripe at once.

Rejected: closing Stripe on the Accounts Receivable match instead of the clock (matching a
deposit to a held row links it, it does not close; one clock is simpler than two rules);
holding cash as well (cash does not bounce, and the mistake that happened was a check).

Accepted cost: the hosted pay link stays open for the week. A customer who just mailed a
check almost never also pays online; if one does, the webhook sees the app row already paid,
stamps Stripe's status, and the row locks as Stripe's — two payments to sort, as with any
double payment today.

## Where it plugs in

| Exists | PR 1 change |
|---|---|
| [`BilledPaymentConfirmationModal.tsx`](../../src/components/jobs/BilledPaymentConfirmationModal.tsx) — Mark Paid; Stripe bills went to `record-stripe-invoice-out-of-band-payment` | a whole-balance Check takes the `mark_invoice_paid` path; the hold note under the type |
| [`jobFormPaymentPredicates.ts`](../../src/lib/jobs/jobFormPaymentPredicates.ts) — `stripeHoldsPaymentReason` (v2.3784) | `stripeOwnsPaymentRow` = Stripe holds a record; the lock in `billsAndPayments.paymentSource`, `jobPaymentMove.paymentMoveBlock`, `jobFormPaymentActions`, the table and the line hangs on it |
| [`move_jobs_ledger_payment`](../../supabase/migrations/20261007213000_held_stripe_marks.sql) — refused every Stripe bill | refuses only while Stripe holds the row; the bill reconciles to Billed |
| new [`heldStripeMark.ts`](../../src/lib/jobs/heldStripeMark.ts), new [`close-held-stripe-marks`](../../supabase/functions/close-held-stripe-marks/index.ts), the pg_cron schedule | |

## PR 2 — Move to job… on a check Stripe already holds — BUILT v2.4803

The stuck rows (job 186 is one): the Stripe invoice is `paid` by our mark. Stripe never
reopens it, so the repair is still a credit note and a fresh bill — now one press, with the
money carried to the right job and the trail telling the truth. Built as the Undo window
already chains, not as a new server function (the plan's one departure: the two existing
functions plus one RPC and one insert needed no new surface, and each stop after the credit
note leaves words on screen). `docs/recent-features/v2.4803.md`.

| Exists | Change |
|---|---|
| `JobFormPaymentLine` hid Move to job… when `stripeOwnsPaymentRow` | shows it on a whole-bill mark (`stripeHeldMoveOffered`); the Move window lists *what happens, in order* |
| `reverse-stripe-invoice-out-of-band-payment`, `void-stripe-invoice-for-revert` | the first writes its `reason` as the credit note's memo; the second takes an optional `reason` for the note and the `removed` event — *Moved to J922 · wrong job* |
| the destination | `mark_invoice_paid` on its one open bill with room (a held mark), else a plain `jobs_ledger_payments` row; then the `moved` event (`stripeHeldPaymentMove.ts`) |

Owner's calls, taken 2026-10-07: re-bill is unavoidable and the guide says so; land on the
destination's one open bill when exactly one fits (held, not closed — v2.4801's rule);
the trace names the reason.

## The mock-up

[`before-after.html`](./before-after.html) — the Mark Paid window and the payment line before
and after PR 1, and PR 2's Move window on a Stripe-held row.

## How to verify

PR 1, on the dev server (`/dev-login?as=1&to=/jobs?tab=stages`), with a **test-mode** Stripe
bill on a throwaway job (Bill Customer with the Stripe toggle on *Test*):

1. On the Billed row press **Mark Paid**, pick **Check**, leave the whole balance. The window
   shows the hold note naming the close day. Confirm. The job moves to Paid in Full.
2. Open the job → **Bill** tab. The line reads *check · typed by hand* and *Stripe closes the
   bill <day>, once the check has cleared*. Its ⋯ menu holds **Move to job…** (enabled) and
   **Remove**; no *Check didn't clear…*. Open **View the Stripe bill**: Stripe still shows it
   open.
3. **Move to job…** to a second throwaway job. The first job's bill reads Billed again and the
   job is back in Billed Awaiting Payment; the second job carries the payment and both show the
   grey *moved* line.
4. The sweep by hand: `POST /functions/v1/close-held-stripe-marks` with the cron secret and
   `{ "dry_run": true }` — the moved bill is no longer held, so nothing lists. Move the payment
   back (or Mark Paid again) and set its date seven days back with Edit details; the dry run
   lists `would_close`; run without `dry_run` and Stripe shows the test invoice paid and the
   row's menu now holds *Check didn't clear…*.
5. Delete the throwaway jobs.

Do not rehearse on a live bill: step 4 closes a real Stripe invoice.

PR 2, on a **test-mode** Stripe bill marked paid (run the PR 1 recipe through step 4 first,
or Mark Paid · Cash to close Stripe at once):

1. Open the job → **Bill** tab. The line's ⋯ menu holds **Move to job…** with *reverses the
   Stripe mark; this bill goes out again*.
2. Press it. The window is titled *Move this check*; pick a second throwaway job with one
   open bill of the same amount. *What happens, in order* lists the credit note, the send-back,
   the landing on that bill, and the grey line.
3. Press **Move**. The first job is Ready to Bill with the Stripe test invoice showing a credit
   note whose memo reads *Moved to J<n> · wrong job*; the second job's bill reads Paid with the
   check held (*Stripe closes the bill …*); both jobs show the grey *moved* line.
4. Repeat onto a job with no open bill: the check lands under Other money with no bill picked.
5. Delete the throwaway jobs.
