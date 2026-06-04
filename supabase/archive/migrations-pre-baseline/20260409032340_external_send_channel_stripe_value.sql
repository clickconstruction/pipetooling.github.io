-- Allow jobs_ledger_invoices.external_send_channel = 'stripe' for Stripe finalized hosted invoices.

COMMENT ON COLUMN public.jobs_ledger_invoices.external_send_channel IS
  'housecallpro | physical | stripe_manual | stripe (Stripe finalized hosted invoice).';

ALTER TABLE public.jobs_ledger_invoices
  DROP CONSTRAINT IF EXISTS jobs_ledger_invoices_external_send_channel_check;

ALTER TABLE public.jobs_ledger_invoices
  ADD CONSTRAINT jobs_ledger_invoices_external_send_channel_check
  CHECK (
    external_send_channel IS NULL
    OR external_send_channel IN (
      'housecallpro',
      'physical',
      'stripe_manual',
      'stripe'
    )
  );
