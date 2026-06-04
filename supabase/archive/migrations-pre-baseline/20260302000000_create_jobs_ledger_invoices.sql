-- Create jobs_ledger_invoices for partial invoices per job
-- Invoices flow: ready_to_bill -> billed -> paid. When paid, amount is added to jobs_ledger_payments and jobs_ledger.payments_made.
-- Jobs stay in Working; only invoices move through Ready to Bill and Billed stages.

CREATE TABLE IF NOT EXISTS public.jobs_ledger_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready_to_bill' CHECK (status IN ('ready_to_bill', 'billed', 'paid')),
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jobs_ledger_invoices_job_id ON public.jobs_ledger_invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_ledger_invoices_status ON public.jobs_ledger_invoices(status);
ALTER TABLE public.jobs_ledger_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Devs, masters, assistants, primary can read jobs ledger invoices"
ON public.jobs_ledger_invoices
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_invoices.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
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
CREATE POLICY "Devs, masters, assistants, primary can insert jobs ledger invoices"
ON public.jobs_ledger_invoices
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_invoices.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = j.master_user_id
        AND assistant_id = auth.uid()
      )
    )
  )
);
CREATE POLICY "Devs, masters, assistants, primary can update jobs ledger invoices"
ON public.jobs_ledger_invoices
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_invoices.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
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
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary')
  )
);
CREATE POLICY "Devs, masters, assistants, primary can delete jobs ledger invoices"
ON public.jobs_ledger_invoices
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_invoices.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
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
COMMENT ON TABLE public.jobs_ledger_invoices IS 'Partial invoices per job. Flow: ready_to_bill -> billed -> paid. When paid, amount added to jobs_ledger_payments and jobs_ledger.payments_made.';
-- RPC: mark_invoice_paid - adds payment to job and marks invoice paid
CREATE OR REPLACE FUNCTION public.mark_invoice_paid(p_invoice_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_next_order INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT id, job_id, amount, status INTO v_invoice
  FROM public.jobs_ledger_invoices
  WHERE id = p_invoice_id;

  IF v_invoice.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;

  IF v_invoice.status <> 'billed' THEN
    RETURN jsonb_build_object('error', 'Invoice must be in Billed status to mark as paid');
  END IF;

  -- Check permission via job access (same as jobs_ledger_payments)
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary')
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = v_invoice.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized to update this job');
  END IF;

  -- Get next sequence_order for payments
  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next_order
  FROM public.jobs_ledger_payments
  WHERE job_id = v_invoice.job_id;

  -- Insert payment
  INSERT INTO public.jobs_ledger_payments (job_id, amount, sequence_order)
  VALUES (v_invoice.job_id, v_invoice.amount, v_next_order);

  -- Update jobs_ledger.payments_made
  UPDATE public.jobs_ledger
  SET payments_made = COALESCE(payments_made, 0) + v_invoice.amount,
      status = CASE
        WHEN COALESCE(revenue, 0) <= COALESCE(payments_made, 0) + v_invoice.amount THEN 'paid'
        ELSE status
      END,
      updated_at = NOW()
  WHERE id = v_invoice.job_id;

  -- Mark invoice as paid
  UPDATE public.jobs_ledger_invoices
  SET status = 'paid'
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
COMMENT ON FUNCTION public.mark_invoice_paid(UUID) IS 'Marks invoice as paid: adds amount to jobs_ledger_payments, updates jobs_ledger.payments_made, sets job status to paid if fully paid.';
