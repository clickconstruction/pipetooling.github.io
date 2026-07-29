SET lock_timeout = '3s';

-- Per-invoice "Bill to" override (v2.1084): bill part of a job to someone
-- other than the job's customer — e.g. the customer's tenant pays the hazmat
-- fee while the customer pays the rest. All columns NULL = the invoice goes to
-- the job's customer exactly as before; the override is "active" only when
-- bill_to_email is set (email is what every send channel needs).
--
-- bill_to_stripe_customer_id holds the SEPARATE Stripe customer created for
-- this invoice's recipient so create-stripe-invoice never rewrites the job
-- customer's saved customers.stripe_customer_id (one column shared by test and
-- live mode, same convention as customers.stripe_customer_id).
--
-- No new table -> no read-only sweep calls needed; the existing RLS policies
-- on jobs_ledger_invoices already cover these columns.

ALTER TABLE public.jobs_ledger_invoices
  ADD COLUMN IF NOT EXISTS bill_to_name text,
  ADD COLUMN IF NOT EXISTS bill_to_email text,
  ADD COLUMN IF NOT EXISTS bill_to_phone text,
  ADD COLUMN IF NOT EXISTS bill_to_stripe_customer_id text;

COMMENT ON COLUMN public.jobs_ledger_invoices.bill_to_name IS
  'Optional alternate recipient name for THIS invoice only (e.g. a tenant). NULL = job customer.';
COMMENT ON COLUMN public.jobs_ledger_invoices.bill_to_email IS
  'Alternate recipient email — the override is active only when this is set. Stripe/physical/notice sends go here instead of jobs_ledger.customer_email.';
COMMENT ON COLUMN public.jobs_ledger_invoices.bill_to_phone IS
  'Optional alternate recipient phone (display only).';
COMMENT ON COLUMN public.jobs_ledger_invoices.bill_to_stripe_customer_id IS
  'Stripe customer created for this invoice''s alternate recipient (test or live per the request mode). Never mirrored into customers.stripe_customer_id.';
