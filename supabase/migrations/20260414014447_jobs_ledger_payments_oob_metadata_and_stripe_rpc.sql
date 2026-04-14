-- Off-Stripe mark paid: payment metadata columns + Stripe webhook RPC accepts OOB fields from invoice metadata.

ALTER TABLE public.jobs_ledger_payments
  ADD COLUMN IF NOT EXISTS payment_type TEXT NULL,
  ADD COLUMN IF NOT EXISTS reference_number TEXT NULL;

COMMENT ON COLUMN public.jobs_ledger_payments.payment_type IS
  'How the customer paid (e.g. cash, check). Set for manual/OOB recording; NULL for legacy rows.';
COMMENT ON COLUMN public.jobs_ledger_payments.reference_number IS
  'Optional external reference (e.g. check number).';

-- Replace single-arg webhook RPC with optional OOB metadata (defaults preserve one-arg calls from webhook).
DROP FUNCTION IF EXISTS public.mark_invoice_paid_from_stripe(UUID);

CREATE OR REPLACE FUNCTION public.mark_invoice_paid_from_stripe(
  p_invoice_id UUID,
  p_payment_type TEXT DEFAULT NULL,
  p_reference_number TEXT DEFAULT NULL,
  p_paid_on DATE DEFAULT NULL,
  p_internal_note TEXT DEFAULT NULL
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
  v_paid_on DATE;
  v_pt TEXT;
  v_ref TEXT;
  v_note TEXT;
  v_row_note TEXT;
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

  v_paid_on := COALESCE(p_paid_on, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date);
  v_pt := NULLIF(trim(COALESCE(p_payment_type, '')), '');
  v_ref := NULLIF(trim(COALESCE(p_reference_number, '')), '');
  v_note := NULLIF(trim(COALESCE(p_internal_note, '')), '');

  IF v_pt IS NULL AND v_ref IS NULL AND v_note IS NULL THEN
    v_row_note := 'Stripe';
  ELSE
    v_row_note := v_note;
  END IF;

  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next_order
  FROM public.jobs_ledger_payments
  WHERE job_id = v_invoice.job_id;

  INSERT INTO public.jobs_ledger_payments (
    job_id,
    amount,
    sequence_order,
    paid_on,
    note,
    invoice_id,
    payment_type,
    reference_number
  )
  VALUES (
    v_invoice.job_id,
    v_remaining,
    v_next_order,
    v_paid_on,
    v_row_note,
    p_invoice_id,
    v_pt,
    v_ref
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

COMMENT ON FUNCTION public.mark_invoice_paid_from_stripe(UUID, TEXT, TEXT, DATE, TEXT) IS
  'Marks invoice paid (Stripe webhook). Optional OOB metadata when user recorded payment off-Stripe; else note defaults to Stripe.';

REVOKE ALL ON FUNCTION public.mark_invoice_paid_from_stripe(UUID, TEXT, TEXT, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_invoice_paid_from_stripe(UUID, TEXT, TEXT, DATE, TEXT) TO service_role;

-- mark_invoice_paid: add payment_type + reference_number for non-Stripe billed lines.
DROP FUNCTION IF EXISTS public.mark_invoice_paid(UUID, NUMERIC, DATE, TEXT);

CREATE OR REPLACE FUNCTION public.mark_invoice_paid(
  p_invoice_id UUID,
  p_amount NUMERIC DEFAULT NULL,
  p_paid_on DATE DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_payment_type TEXT DEFAULT NULL,
  p_reference_number TEXT DEFAULT NULL
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
  v_pt TEXT;
  v_ref TEXT;
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

  v_pt := NULLIF(trim(COALESCE(p_payment_type, '')), '');
  v_ref := NULLIF(trim(COALESCE(p_reference_number, '')), '');

  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next_order
  FROM public.jobs_ledger_payments
  WHERE job_id = v_invoice.job_id;

  INSERT INTO public.jobs_ledger_payments (
    job_id,
    amount,
    sequence_order,
    paid_on,
    note,
    invoice_id,
    payment_type,
    reference_number
  )
  VALUES (
    v_invoice.job_id,
    v_apply,
    v_next_order,
    COALESCE(p_paid_on, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date),
    NULLIF(trim(COALESCE(p_note, '')), ''),
    p_invoice_id,
    v_pt,
    v_ref
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

COMMENT ON FUNCTION public.mark_invoice_paid(UUID, NUMERIC, DATE, TEXT, TEXT, TEXT) IS
  'Applies payment toward a billed invoice (partial allowed). Optional payment_type and reference_number.';

-- mark_job_paid: add payment_type + reference_number.
DROP FUNCTION IF EXISTS public.mark_job_paid(UUID, NUMERIC, DATE, TEXT);

CREATE OR REPLACE FUNCTION public.mark_job_paid(
  p_job_id UUID,
  p_amount NUMERIC DEFAULT NULL,
  p_paid_on DATE DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_payment_type TEXT DEFAULT NULL,
  p_reference_number TEXT DEFAULT NULL
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
  v_pt TEXT;
  v_ref TEXT;
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

  v_pt := NULLIF(trim(COALESCE(p_payment_type, '')), '');
  v_ref := NULLIF(trim(COALESCE(p_reference_number, '')), '');

  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next_order
  FROM public.jobs_ledger_payments WHERE job_id = p_job_id;

  INSERT INTO public.jobs_ledger_payments (
    job_id,
    amount,
    sequence_order,
    paid_on,
    note,
    invoice_id,
    payment_type,
    reference_number
  )
  VALUES (
    p_job_id,
    v_apply,
    v_next_order,
    COALESCE(p_paid_on, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date),
    NULLIF(trim(COALESCE(p_note, '')), ''),
    NULL,
    v_pt,
    v_ref
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

COMMENT ON FUNCTION public.mark_job_paid(UUID, NUMERIC, DATE, TEXT, TEXT, TEXT) IS
  'Whole-job billed payment: optional payment_type and reference_number.';
