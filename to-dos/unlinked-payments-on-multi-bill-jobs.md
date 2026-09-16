---
name: Which bill does an unlinked payment pay?
group: gated
status: the single-bill half shipped as v2.3515 (demand letter + which bills it covers) · the multi-bill rule is the owner's before any more code
summary: >
  **Which bill does an unlinked payment pay?** 191 payments worth $2.32M carry no `invoice_id`,
  and the two readers disagree in opposite directions: the invoice shows them on *every* open
  bill, the demand letter's claim counts *none* of them on a multi-bill job (a single-bill job
  counts them since v2.3515 — job 102 now reads $2,355). Three candidate rules; one kernel must
  answer for the invoice, the letter and the lien claim. The other half of Taunya's report — the bill-borrows-another-bill's-payment half —
  shipped as v2.3498.
next: >
  Pick one of the three candidate rules in the file; then one kernel answers for the invoice's
  payment history, the demand letter's claim and the lien claim together. Also decide whether the
  11 bills already sent with the old rendering are re-sent or corrected in place.
size: M once decided
blocker: An owner rule — guessing reintroduces the double credit v2.3498 removed.
ver: found at v2.3498 · single-bill half v2.3515
---

# Which bill does an unlinked payment pay?

## The ask

Taunya, on job 258's Lien instruments window: *"Notice at top says $9800 due but there's a payment applied here."* That report had two halves. The half where a bill printed **another bill's** payment is fixed (v2.3498). This file is the other half.

## The problem

`jobs_ledger_payments.invoice_id` is nullable. On prod (2026-09-16, read-only):

| Payments | Count | Dollars |
|---|---|---|
| Linked to a bill | 473 | $1,081,070 |
| **Unlinked (job-level)** | **191** | **$2,320,062** |

Most of the money on the ledger is not attached to a bill. Two surfaces then disagree about what a customer owes, in opposite directions:

- **The invoice's payment history** (`filterPaymentsForPhysicalInvoiceHistory`) shows unlinked payments on *every* open bill of the job. On a single-bill job that is right. On a multi-bill job the same money is subtracted from each bill separately.
- **The demand letter's claim amount** (`sumApplied` in `src/lib/jobsDocuments/demandLetter.ts`) counts *only* invoice-linked payments, so it ignores unlinked money entirely and can overstate the claim.

Live proof of each, both still true after v2.3498:

- **Job 102 · Samantha Coyle** — one bill $5,355, one unlinked $3,000 check. The invoice correctly reads *Balance due $2,355*. ~~The demand header read **$5,355.00 open**; the letter overstated by $3,000.~~ **Fixed in v2.3515**: on a job with exactly one sent bill, `paymentsAppliedToInvoice` counts unlinked money, so the letter now reads $3,000 paid / $2,355 due. Multi-bill jobs below are unchanged.
- **Job 273 · Dudley (Lennox)** — four unlinked payments totalling $38,780, three open bills ($13,420 · $3,500 · $665). Each bill separately subtracts all $38,780, so all three print zero due.
- **Job 251 · Michael Palmer** — two unlinked payments of $9,440 against two *already paid* bills ($23, $9,440) and one open bill ($4,720). The open bill prints zero.
- **Job 473 · Mike Holub** — $32,245 unlinked plus $4,900 on another bill, against a $9,455 open bill.

Six open bills are in this shape. Overstating is the dangerous direction: the demand letter and the § 53.056 notice are legal instruments.

## What it is NOT

Do **not** "fix" this by smearing unlinked money across open bills — that is exactly the double-credit v2.3498 removed. And do not simply drop unlinked payments from the invoice, which would tell job 102's customer they owe the whole $5,355 again.

## The decision needed

How does an unlinked payment attribute to bills? Candidates:

1. **Oldest bill first** — apply unlinked money to open bills in `sequence_order`, never more than each bill's amount. Matches how the office describes it, and needs no new data. A job that has taken more than its bills total would show the surplus somewhere.
2. **Single-bill jobs only** — attribute when the job has exactly one bill (unambiguous); on multi-bill jobs show unlinked money as a job-level note on neither bill, and make the office link it. Smallest, most honest, but leaves job 273 reading $17,585 owed with $38,780 sitting unattributed.
3. **Make the office link it** — a Needs You item listing the 191 unlinked payments; the invoice and the letter both count only linked money once the pile is worked down. Most correct long-term, most human hours.

Whichever is chosen, **one kernel must answer for every reader** — the invoice payment history, `paymentsAppliedToInvoice` in the demand letter (v2.3515 renamed `sumApplied` and pointed the modal's `demandableInvoices` at it, so the demand side already has one), and the lien claim amount — or these surfaces will drift apart again.

## Where it plugs in

- `src/lib/physicalInvoiceLineItems.ts` → `filterPaymentsForPhysicalInvoiceHistory` (the invoice side; v2.3498 comments mark the seam).
- `src/lib/jobsDocuments/demandLetter.ts` → `paymentsAppliedToInvoice` (was `sumApplied`), used by `buildDemandStatement`, `buildDemandLetterPrefill.outstanding`, and the modal's `demandableInvoices` (the claim side; single-bill rule since v2.3515).
- Table: `jobs_ledger_payments (job_id, invoice_id, amount, paid_on, sequence_order)`.

## How to verify

Read-only, on prod: open Pipeline → search the job → the ⚖/lien button → compare the header's *N open* against the exhibit's *Balance due*. Jobs 102, 273, 251 and 473 are the live specimens. The census query is in the v2.3498 fragment.

## Also still open from the same report

The **11 bills already sent** with a wrong balance (listed in the v2.3498 fragment) are not corrected by that PR — it fixes what the app renders from here on. Re-send or correct in place is an owner call.
