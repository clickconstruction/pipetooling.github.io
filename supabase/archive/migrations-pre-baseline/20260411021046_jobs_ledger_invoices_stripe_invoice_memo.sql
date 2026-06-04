-- Memo text sent to Stripe as invoice description; stored for UI (e.g. Edit Job Outstanding billing).
ALTER TABLE public.jobs_ledger_invoices
  ADD COLUMN IF NOT EXISTS stripe_invoice_memo TEXT;

COMMENT ON COLUMN public.jobs_ledger_invoices.stripe_invoice_memo IS
  'Stripe invoice description / memo from Bill Customer (create-stripe-invoice); optional.';
