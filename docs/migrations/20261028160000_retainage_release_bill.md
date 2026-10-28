# 20261028160000_retainage_release_bill.sql (2026-10-28, v2.6017)

Punch list #165, PR 3 (release C of the owner's picks of 2026-10-26). On a trade job with no pay application, the retainage a GC holds back is released by a bill drafted for the held amount. The bill needs a mark the readers can find, so AR's Retainage held line reads *release drafted · not sent yet* and *release billed · awaiting payment* and leaves once the bill is paid, the lien details say where the release stands, and the Lien desk's § 53.057 row (PR 4) can link to it.

## What it does

- `ALTER TABLE public.jobs_ledger_invoices ADD COLUMN IF NOT EXISTS retainage_release boolean NOT NULL DEFAULT false` — a catalog-only change on Postgres 11+ (a constant default is not a rewrite). Commented.
- No index: the readers take a job's bills by `job_id` and read the mark on the row.
- Nothing on `job_pay_applications`: on a job with applications the release is the final application at zero retainage and the bill tied to it (`invoice_id`, v2.5032).

## Who writes it

`markRetainageReleaseBill` (`src/lib/ar/retainageHeldIo.ts`), right after `draftRetainageReleaseBill` inserts the `ready_to_bill` draft with the memo *Retainage release* — from the AR line's *Draft the release bill…* and from the lien details once our contract on the job has ended. The row's existing update policies apply (the office roles that already change a bill's `shown_to_party`). A draft deleted through `delete_ready_to_bill_invoice` takes the mark with it, and the line offers the draft again.

## Order

The client reads the column through a fallback (a `42703` answer re-reads the bills without it) and refuses to draft a release bill until the column is there (`RetainageReleaseNotReady`, the draft taken back), so the client may deploy before the push. Push with `supabase db push` once the PR is on `main`.
