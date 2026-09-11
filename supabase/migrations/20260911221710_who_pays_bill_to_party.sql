SET lock_timeout = '3s';

-- Who pays the bill, PR 1: the job says who gets its bills, and each draft
-- invoice can pick a party instead of typing an email.
--
-- Until now a job carried a billed customer (customer_id / customer_email)
-- and, since v2.1175, a GC that was only a grouping link. Nothing recorded
-- which of them pays, so the office worked around it: entering the GC as the
-- customer too (72 open jobs), typing the GC's billing address into the
-- customer email (job 650), or opening two jobs at one address, one per
-- payer (14 pairs in 120 days). Every reader guessed differently.
--
--   jobs_ledger.bill_to_party
--     customer  — bills go to the job customer (default; existing jobs)
--     gc        — bills go to the job's GC (jobs_ledger.gc_customer_id)
--     split     — each invoice picks its payer (line-level tags follow in PR 3)
--   jobs_ledger_invoices.bill_to_party
--     NULL      — inherit the job's answer
--     customer / gc — this invoice's own pick (a split job's drafts, or an
--                 exception on a customer/GC job). bill_to_email (v2.1084,
--                 "someone else" — a tenant) still wins when set.
--   customers.billing_email
--     where bills go when THIS customer is billed as a GC (or by choice);
--     falls back to contact_info.email when blank.
--
-- Additive and idempotent; no CREATE TABLE, so no read-only-block calls. The
-- three tables' existing RLS governs writes. The edge functions
-- (create-stripe-invoice, preview-stripe-invoice, send-physical-invoice-email)
-- resolve the payer from these columns server-side — deploy them after the push.

ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS bill_to_party text NOT NULL DEFAULT 'customer';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_ledger_bill_to_party_check') THEN
    ALTER TABLE public.jobs_ledger
      ADD CONSTRAINT jobs_ledger_bill_to_party_check
      CHECK (bill_to_party IN ('customer', 'gc', 'split'));
  END IF;
END $$;

ALTER TABLE public.jobs_ledger_invoices
  ADD COLUMN IF NOT EXISTS bill_to_party text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_ledger_invoices_bill_to_party_check') THEN
    ALTER TABLE public.jobs_ledger_invoices
      ADD CONSTRAINT jobs_ledger_invoices_bill_to_party_check
      CHECK (bill_to_party IS NULL OR bill_to_party IN ('customer', 'gc'));
  END IF;
END $$;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS billing_email text;

COMMENT ON COLUMN public.jobs_ledger.bill_to_party IS
  'Who pays (v2.3345): customer | gc | split. gc bills jobs_ledger.gc_customer_id; split lets each invoice pick. Read by Bill Customer, the Stripe/physical edge functions, GC Review, the portals and the payment-terms readers.';
COMMENT ON COLUMN public.jobs_ledger_invoices.bill_to_party IS
  'This invoice''s payer pick (v2.3345): NULL inherits jobs_ledger.bill_to_party; customer | gc override it. bill_to_email (someone else) wins over both.';
COMMENT ON COLUMN public.customers.billing_email IS
  'Where bills go when this customer is billed (v2.3345) — typically a GC''s AP inbox, distinct from the estimating contact in contact_info.email. Blank = contact_info.email.';
