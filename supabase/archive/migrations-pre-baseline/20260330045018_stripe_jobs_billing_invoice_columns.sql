-- Stripe + external send metadata for jobs billing; webhook-only RPC to mark paid (no auth.uid()).

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

COMMENT ON COLUMN public.customers.stripe_customer_id IS 'Stripe Customer id (cus_...); set when first invoice created via create-stripe-invoice.';

CREATE UNIQUE INDEX IF NOT EXISTS customers_stripe_customer_id_key
  ON public.customers (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

ALTER TABLE public.jobs_ledger_invoices
  ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_invoice_status TEXT,
  ADD COLUMN IF NOT EXISTS hosted_invoice_url TEXT,
  ADD COLUMN IF NOT EXISTS external_send_channel TEXT,
  ADD COLUMN IF NOT EXISTS external_send_note TEXT,
  ADD COLUMN IF NOT EXISTS sent_to_customer_at TIMESTAMPTZ;

COMMENT ON COLUMN public.jobs_ledger_invoices.stripe_invoice_id IS 'Stripe Invoice id (in_...) after finalize.';
COMMENT ON COLUMN public.jobs_ledger_invoices.stripe_invoice_status IS 'Last known Stripe invoice status (e.g. open, paid).';
COMMENT ON COLUMN public.jobs_ledger_invoices.hosted_invoice_url IS 'Stripe hosted invoice payment URL after finalize.';
COMMENT ON COLUMN public.jobs_ledger_invoices.external_send_channel IS 'When billed without Stripe: housecallpro | physical | stripe_manual.';
COMMENT ON COLUMN public.jobs_ledger_invoices.external_send_note IS 'Optional note for external send path.';
COMMENT ON COLUMN public.jobs_ledger_invoices.sent_to_customer_at IS 'When the invoice was sent to the customer (Tab A); may differ from billed_at.';

ALTER TABLE public.jobs_ledger_invoices
  DROP CONSTRAINT IF EXISTS jobs_ledger_invoices_external_send_channel_check;

ALTER TABLE public.jobs_ledger_invoices
  ADD CONSTRAINT jobs_ledger_invoices_external_send_channel_check
  CHECK (
    external_send_channel IS NULL
    OR external_send_channel IN ('housecallpro', 'physical', 'stripe_manual')
  );

CREATE UNIQUE INDEX IF NOT EXISTS jobs_ledger_invoices_stripe_invoice_id_key
  ON public.jobs_ledger_invoices (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

-- Same payment logic as mark_invoice_paid but for Stripe webhooks (no JWT). Only service_role may execute.
CREATE OR REPLACE FUNCTION public.mark_invoice_paid_from_stripe(p_invoice_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_next_order INTEGER;
BEGIN
  SELECT id, job_id, amount, status INTO v_invoice
  FROM public.jobs_ledger_invoices
  WHERE id = p_invoice_id;

  IF v_invoice.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;

  IF v_invoice.status <> 'billed' THEN
    RETURN jsonb_build_object('error', 'Invoice must be in Billed status to mark as paid');
  END IF;

  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next_order
  FROM public.jobs_ledger_payments
  WHERE job_id = v_invoice.job_id;

  INSERT INTO public.jobs_ledger_payments (job_id, amount, sequence_order)
  VALUES (v_invoice.job_id, v_invoice.amount, v_next_order);

  UPDATE public.jobs_ledger
  SET payments_made = COALESCE(payments_made, 0) + v_invoice.amount,
      status = CASE
        WHEN COALESCE(revenue, 0) <= COALESCE(payments_made, 0) + v_invoice.amount THEN 'paid'
        ELSE status
      END,
      updated_at = NOW()
  WHERE id = v_invoice.job_id;

  UPDATE public.jobs_ledger_invoices
  SET status = 'paid'
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.mark_invoice_paid_from_stripe(UUID) IS
  'Marks invoice paid (Stripe webhook). Same ledger effect as mark_invoice_paid; not for client use—EXECUTE granted to service_role only.';

REVOKE ALL ON FUNCTION public.mark_invoice_paid_from_stripe(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_invoice_paid_from_stripe(UUID) TO service_role;
