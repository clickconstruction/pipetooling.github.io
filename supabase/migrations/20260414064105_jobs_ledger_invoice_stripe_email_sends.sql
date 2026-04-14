-- Append-only log when send-stripe-invoice successfully emails the customer (service role INSERT).
-- SELECT RLS matches jobs_ledger_invoices visibility (superintendent migration pattern).

CREATE TABLE public.jobs_ledger_invoice_stripe_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jobs_ledger_invoice_id UUID NOT NULL REFERENCES public.jobs_ledger_invoices(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL,
  stripe_invoice_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_ledger_invoice_stripe_email_sends_invoice_sent
  ON public.jobs_ledger_invoice_stripe_email_sends (jobs_ledger_invoice_id, sent_at DESC);

COMMENT ON TABLE public.jobs_ledger_invoice_stripe_email_sends IS
  'One row per successful PipeTooling send-stripe-invoice (Stripe invoices.sendInvoice); sent_at matches jobs_ledger_invoices.sent_to_customer_at for that action.';

ALTER TABLE public.jobs_ledger_invoice_stripe_email_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invoice send log readable with jobs ledger invoices"
ON public.jobs_ledger_invoice_stripe_email_sends
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger_invoices inv
    INNER JOIN public.jobs_ledger j ON j.id = inv.job_id
    WHERE inv.id = jobs_ledger_invoice_stripe_email_sends.jobs_ledger_invoice_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (
        SELECT 1 FROM public.master_superintendents
        WHERE master_id = j.master_user_id AND superintendent_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = auth.uid()
        AND assistant_id = j.master_user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = j.master_user_id
        AND assistant_id = auth.uid()
      )
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);
