---
name: "Retainage on our trade jobs is money owed to us"
number: 165
group: gated
status: proposed 2026-10-24 from the trade ERP comparison (gap 5 of 9) · waiting on the owner's pick of the one source for the held amount
summary: >
  On our own trade jobs the AIA pay application is saved and downloaded, and retainage is a number
  the Lien desk uses for its § 53.057 notice, but the money a GC holds back shows nowhere as owed to
  us. The smallest useful version puts each trade job's retainage held on the AR screen as its own
  line, aged from when the job finished, and drafts the release bill when the job closes, beside
  the § 53.057 notice on the Lien desk.
next: The owner picks the one source for a job's held retainage (the latest saved pay application, or the Lien desk's number) and whether the release is a bill of its own; then a mock-up of the AR line.
size: S to M as a train of four (S · S · S · S); no migration unless the release needs a mark
blocker: The one source for the held amount.
opinion: build; reuse the latest saved pay application's number so the AIA window, AR and the Lien desk agree
---

# Retainage on our trade jobs is money owed to us (#165)

## The ask

The owner, 2026-10-24: *"Draft to-dos in the repo for the top five gaps, each with its smallest
useful version, as one docs PR."* This is gap 5 of the trade ERP comparison the owner ran the same day.
The owner kept its weight at 3 of 3. Its gap is 1, so it scores 3, tied with #164.

This is a proposal. Nothing here is built until the owner picks.

## What the comparison found

- Knowify builds pay applications from a schedule of values, prints G702 and G703, holds
  retainage on work and on stored materials, and bills the release as its own invoice, on its
  lowest paid tier.
- ServiceTitan keeps retainage in its own receivable account and releases it in full or in part.
- Contractor Foreman holds retainage, steps it down at milestones and releases it, and tracks
  retainage on subcontracts too.

## Today

- **The pay application** on a trade job is the AIA window
  ([`AiaG702G703Modal.tsx`](../../src/components/jobs/AiaG702G703Modal.tsx)), which fills the
  G702/G703 workbook for download and saves each application by number in `job_pay_applications`
  with `retainage_pct` and `retainage_held` (`lib/aiaPayApplicationsIo.ts`).
- **The Lien desk** reads `jobs_ledger.lien_retainage_held` for the § 53.057 retainage notice
  (`lib/jobs/lienDeskRetainage.ts`).
- **AR** (`/accounts-receivable`) reads billed bills (`jobs_ledger_invoices`). Retainage the GC
  holds is not a bill, so AR never shows it.
- **GC mode** already runs pay applications with retainage for the jobs where we are the GC
  (`gc_owner_pay_apps`, `gc_draws`). This to-do is about our own trade jobs.

## The decision (open)

- **One source for a job's held retainage.** The latest saved pay application's `retainage_held`
  is the number the GC signed; `lien_retainage_held` is the Lien desk's own. Two numbers for one
  amount will drift, so pick one and have the other read it.
- **The release**: a bill of its own, or a line on the job's last bill.

## The smallest useful version

1. **AR shows retainage held** per trade job as its own line, read from the one source, aged from
   when the job finished, with a door to the job.
2. **When the job closes**, the release bill is drafted with the amount filled, through the
   existing bill flow, and the Lien desk's § 53.057 row links to it.
3. **Paid releases** come off the line the way any bill does.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| The held amount | `job_pay_applications.retainage_held`, `jobs_ledger.lien_retainage_held` | one read: `lib/ar/retainageHeld.ts`, the held amount less what was released, and its age; pure and tested |
| AR | `/accounts-receivable` over `jobs_ledger_invoices` | a Retainage held section |
| The release bill | the job window's Bill flow | the draft with the amount filled |
| The notice | the Lien desk's § 53.057 row | a link to the release bill |

## The plan

1. **The kernel**, and the owner's pick of the one source.
2. **AR's Retainage held section**, read only.
3. **Draft the release bill** from the line and from job close.
4. **The Lien desk's link** to the release bill.

## How to verify

On a ZZ test job with two saved pay applications holding 10%: AR's Retainage held line shows the
latest application's held amount. Close the job, draft the release, record it paid, and see the
line clear. The Lien desk's § 53.057 row opens the same release bill.

## Open questions

- Which number is the one source.
- Whether a partial release is common enough to support now.
- Whether retainage we hold back from our own subs belongs on the same screen.
