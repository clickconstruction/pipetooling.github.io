-- Customer-visible Stripe invoice footer (optional per line). Empty in app = Stripe account default footer.
ALTER TABLE public.jobs_ledger_invoices
  ADD COLUMN IF NOT EXISTS stripe_invoice_footer text;

COMMENT ON COLUMN public.jobs_ledger_invoices.stripe_invoice_footer IS
  'Stripe Invoice.footer when set from Bill Customer; null = omit on create (Dashboard default).';
