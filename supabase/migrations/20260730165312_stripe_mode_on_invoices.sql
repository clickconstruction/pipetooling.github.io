SET lock_timeout = '3s';

-- Stripe mode integrity, step A1 (FRAGILITY_REMEDIATION_PLAN.md).
--
-- Stripe test/live mode has been per-request and unrecorded: nothing stored
-- which mode an invoice was created in, so every later row-bound operation
-- (void, send, details, OOB, write-down) trusted the caller's stripe_mode —
-- the root of the cross-mode class (a test-mode void of a live invoice reads
-- "No such invoice" and deletes the ledger row, orphaning the live invoice).
-- Record the mode; later steps (A2/A3) make the row authoritative.

-- 1) jobs_ledger_invoices.stripe_mode ('live' | 'test'; NULL = pre-A1 legacy).
ALTER TABLE public.jobs_ledger_invoices
  ADD COLUMN IF NOT EXISTS stripe_mode text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jobs_ledger_invoices_stripe_mode_check'
      AND conrelid = 'public.jobs_ledger_invoices'::regclass
  ) THEN
    ALTER TABLE public.jobs_ledger_invoices
      ADD CONSTRAINT jobs_ledger_invoices_stripe_mode_check
      CHECK (stripe_mode IS NULL OR stripe_mode IN ('live', 'test'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.jobs_ledger_invoices.stripe_mode IS
  'Stripe mode this invoice''s Stripe objects live in (live|test). Stamped by create-stripe-invoice since A1; authoritative for row-bound Stripe operations since A3. NULL = created before A1 (treated as live; the webhook self-heals it from the verified event mode).';

-- 2) Backfill: existing Stripe-linked rows are live (decision 1 in the plan —
--    the client pref defaults to live and only devs can select test; a
--    mislabeled test row fails safe under the A2/A3 guards: it gets stuck
--    with a 409/mode_mismatch instead of deleted, and a dev corrects it).
UPDATE public.jobs_ledger_invoices
   SET stripe_mode = 'live'
 WHERE stripe_mode IS NULL
   AND stripe_invoice_id IS NOT NULL;

-- 3) Webhook observability: record each event's livemode.
ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS livemode boolean;

COMMENT ON COLUMN public.stripe_webhook_events.livemode IS
  'event.livemode of the received Stripe event, cross-checked against the signing secret that verified it (A2).';

-- Additive + idempotent; no CREATE TABLE, so read-only sweep calls are not
-- required. No RLS change: existing jobs_ledger_invoices policies cover the
-- new column; stripe_webhook_events remains dev-read/service-write.
