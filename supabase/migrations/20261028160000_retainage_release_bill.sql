SET lock_timeout = '3s';

-- Punch list #165, PR 3 (release C of the owner's picks, 2026-10-26): on a trade job with no pay
-- application, the retainage a GC holds back is released by a bill drafted for the held amount.
-- The bill needs a mark the readers can find — AR's Retainage held line (lib/ar/retainageHeld.ts,
-- `releaseBillId`), the lien details and the Lien desk's § 53.057 row — so the line reads
-- "release drafted · not sent yet" / "release billed · awaiting payment" and leaves once the bill
-- is paid. On a job with pay applications the release is the final application at zero retainage
-- and the bill tied to it (job_pay_applications.invoice_id, v2.5032); nothing here touches that.
-- A boolean with a default is a catalog-only change on Postgres 11+: no table rewrite.

ALTER TABLE public.jobs_ledger_invoices
  ADD COLUMN IF NOT EXISTS retainage_release boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.jobs_ledger_invoices.retainage_release IS
  'Retainage release (v2.6017, punch list #165): true on the bill drafted for the retainage a GC held back on a trade job with no pay application (lib/ar/retainageHeld.ts reads it as the release). A deleted draft takes the mark with it; the AR line then offers the draft again.';
