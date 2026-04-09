-- Link payments to invoices for partial pay; extend mark_invoice_paid / mark_job_paid / Stripe webhook.

ALTER TABLE public.jobs_ledger_payments
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.jobs_ledger_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_ledger_payments_invoice_id
  ON public.jobs_ledger_payments (invoice_id)
  WHERE invoice_id IS NOT NULL;

COMMENT ON COLUMN public.jobs_ledger_payments.invoice_id IS
  'When set, this payment applies toward this invoice (partial or full). NULL for job-level whole-bill payments.';

-- Single-arg mark_invoice_paid replaced by version with optional amount / paid_on / note (defaults preserve behavior).
DROP FUNCTION IF EXISTS public.mark_invoice_paid(UUID);

CREATE OR REPLACE FUNCTION public.mark_invoice_paid(
  p_invoice_id UUID,
  p_amount NUMERIC DEFAULT NULL,
  p_paid_on DATE DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_next_order INTEGER;
  v_applied NUMERIC;
  v_remaining NUMERIC;
  v_apply NUMERIC;
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

  SELECT COALESCE(SUM(amount), 0) INTO v_applied
  FROM public.jobs_ledger_payments
  WHERE invoice_id = p_invoice_id;

  v_remaining := COALESCE(v_invoice.amount, 0) - v_applied;

  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object('error', 'Invoice already fully paid');
  END IF;

  v_apply := COALESCE(p_amount, v_remaining);

  IF v_apply <= 0 THEN
    RETURN jsonb_build_object('error', 'Amount must be positive');
  END IF;

  IF v_apply > v_remaining THEN
    RETURN jsonb_build_object('error', 'Amount exceeds remaining balance on invoice');
  END IF;

  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next_order
  FROM public.jobs_ledger_payments
  WHERE job_id = v_invoice.job_id;

  INSERT INTO public.jobs_ledger_payments (job_id, amount, sequence_order, paid_on, note, invoice_id)
  VALUES (
    v_invoice.job_id,
    v_apply,
    v_next_order,
    COALESCE(p_paid_on, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date),
    NULLIF(trim(COALESCE(p_note, '')), ''),
    p_invoice_id
  );

  UPDATE public.jobs_ledger
  SET payments_made = COALESCE(payments_made, 0) + v_apply,
      status = CASE
        WHEN COALESCE(revenue, 0) <= COALESCE(payments_made, 0) + v_apply THEN 'paid'
        ELSE status
      END,
      updated_at = NOW()
  WHERE id = v_invoice.job_id;

  IF (v_applied + v_apply) >= COALESCE(v_invoice.amount, 0) THEN
    UPDATE public.jobs_ledger_invoices
    SET status = 'paid'
    WHERE id = p_invoice_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.mark_invoice_paid(UUID, NUMERIC, DATE, TEXT) IS
  'Applies payment toward a billed invoice (partial allowed). Links jobs_ledger_payments.invoice_id. Omits p_amount to pay remaining balance.';

DROP FUNCTION IF EXISTS public.mark_job_paid(UUID);

CREATE OR REPLACE FUNCTION public.mark_job_paid(
  p_job_id UUID,
  p_amount NUMERIC DEFAULT NULL,
  p_paid_on DATE DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_remaining NUMERIC;
  v_next_order INTEGER;
  v_apply NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT id, revenue, payments_made, status INTO v_job
  FROM public.jobs_ledger WHERE id = p_job_id;

  IF v_job.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  IF v_job.status <> 'billed' THEN
    RETURN jsonb_build_object('error', 'Job must be in Billed status to mark as paid');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary')
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = p_job_id
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

  v_remaining := COALESCE(v_job.revenue, 0) - COALESCE(v_job.payments_made, 0);

  IF v_remaining <= 0 THEN
    UPDATE public.jobs_ledger SET status = 'paid', updated_at = NOW() WHERE id = p_job_id;
    RETURN jsonb_build_object('ok', true);
  END IF;

  v_apply := COALESCE(p_amount, v_remaining);

  IF v_apply <= 0 THEN
    RETURN jsonb_build_object('error', 'Amount must be positive');
  END IF;

  IF v_apply > v_remaining THEN
    RETURN jsonb_build_object('error', 'Amount exceeds remaining balance on job');
  END IF;

  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next_order
  FROM public.jobs_ledger_payments WHERE job_id = p_job_id;

  INSERT INTO public.jobs_ledger_payments (job_id, amount, sequence_order, paid_on, note, invoice_id)
  VALUES (
    p_job_id,
    v_apply,
    v_next_order,
    COALESCE(p_paid_on, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date),
    NULLIF(trim(COALESCE(p_note, '')), ''),
    NULL
  );

  UPDATE public.jobs_ledger
  SET payments_made = COALESCE(payments_made, 0) + v_apply,
      status = CASE
        WHEN COALESCE(revenue, 0) <= COALESCE(payments_made, 0) + v_apply THEN 'paid'
        ELSE status
      END,
      updated_at = NOW()
  WHERE id = p_job_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.mark_job_paid(UUID, NUMERIC, DATE, TEXT) IS
  'Whole-job billed payment: adds amount to jobs_ledger_payments (invoice_id NULL). Omits p_amount to pay full remaining.';

CREATE OR REPLACE FUNCTION public.mark_invoice_paid_from_stripe(p_invoice_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_next_order INTEGER;
  v_applied NUMERIC;
  v_remaining NUMERIC;
BEGIN
  SELECT id, job_id, amount, status INTO v_invoice
  FROM public.jobs_ledger_invoices
  WHERE id = p_invoice_id;

  IF v_invoice.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;

  IF v_invoice.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF v_invoice.status <> 'billed' THEN
    RETURN jsonb_build_object('error', 'Invoice must be in Billed status to mark as paid');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_applied
  FROM public.jobs_ledger_payments
  WHERE invoice_id = p_invoice_id;

  v_remaining := COALESCE(v_invoice.amount, 0) - v_applied;

  IF v_remaining <= 0 THEN
    UPDATE public.jobs_ledger_invoices SET status = 'paid' WHERE id = p_invoice_id;
    RETURN jsonb_build_object('ok', true);
  END IF;

  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next_order
  FROM public.jobs_ledger_payments
  WHERE job_id = v_invoice.job_id;

  INSERT INTO public.jobs_ledger_payments (job_id, amount, sequence_order, paid_on, note, invoice_id)
  VALUES (
    v_invoice.job_id,
    v_remaining,
    v_next_order,
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date,
    'Stripe',
    p_invoice_id
  );

  UPDATE public.jobs_ledger
  SET payments_made = COALESCE(payments_made, 0) + v_remaining,
      status = CASE
        WHEN COALESCE(revenue, 0) <= COALESCE(payments_made, 0) + v_remaining THEN 'paid'
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
  'Marks invoice paid (Stripe webhook). Applies remainder after invoice-linked payments; idempotent if already paid.';
