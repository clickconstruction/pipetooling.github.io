SET lock_timeout = '3s';

-- Share this bill (v2.3375): who ELSE sees a bill on their statement.
--
-- Who pays (v2.3345) decided who a bill is addressed to. Since v2.3346 the
-- customer portal listed every bill on the viewer's jobs, naming the other
-- party when the viewer did not owe it — in both directions, and with the
-- other party's amounts riding in the payload either way. The owner's call
-- (2026-09-13): make it case by case. The office decides, per bill, whether
-- the non-paying party sees it on their statement; nothing is shown unless
-- someone ticked it.
--
--   jobs_ledger_invoices.shown_to_party
--     NULL      — nobody but the payer sees this bill (every existing row)
--     customer  — the job customer sees it on their statement (a GC-paid
--                 bill the owner asked to see)
--     gc        — the job's GC sees it on theirs (an owner-paid repair on a
--                 home the GC sent us)
--     Stamped by Bill Customer's "Show it on <other party>'s statement" tick
--     at send; changed afterwards from Edit Job → Bill. The only value the
--     portal reads.
--   jobs_ledger.show_bills_to_other_party
--     the job's memory: pre-ticks Bill Customer on this job's next bills and
--     decides a billed job's invoice-less shell remainder. Written directly
--     by the Edit-tab fact row and the Bill Customer tick (not part of the
--     identity autosave slice — a stale form must never revert a tick).
--
-- Additive and idempotent; no CREATE TABLE, so no read-only-block calls. The
-- two tables' existing RLS governs writes. The customer-portal edge function
-- reads both columns — deploy it after the push.

ALTER TABLE public.jobs_ledger_invoices
  ADD COLUMN IF NOT EXISTS shown_to_party text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_ledger_invoices_shown_to_party_check'
  ) THEN
    ALTER TABLE public.jobs_ledger_invoices
      ADD CONSTRAINT jobs_ledger_invoices_shown_to_party_check
      CHECK (shown_to_party IS NULL OR shown_to_party IN ('customer', 'gc'));
  END IF;
END $$;

COMMENT ON COLUMN public.jobs_ledger_invoices.shown_to_party IS
  'Share this bill (v2.3375): the non-paying party that sees this bill on their portal statement — customer | gc; NULL = nobody but the payer. The only value the portal reads.';

ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS show_bills_to_other_party boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.jobs_ledger.show_bills_to_other_party IS
  'Share this bill (v2.3375): pre-ticks "Show it on <other party>''s statement" in Bill Customer for this job''s next bills, and decides a billed job''s invoice-less shell remainder. Not in the identity autosave slice.';
