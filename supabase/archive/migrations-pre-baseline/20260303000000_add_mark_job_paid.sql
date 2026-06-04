-- RPC: mark_job_paid - when a whole job (status=billed) is marked paid,
-- add (revenue - payments_made) to jobs_ledger_payments and update payments_made.
-- Mirrors mark_invoice_paid behavior for whole-job flow.

CREATE OR REPLACE FUNCTION public.mark_job_paid(p_job_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_remaining NUMERIC;
  v_next_order INTEGER;
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

  -- Check permission via job access (same as mark_invoice_paid)
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
    -- Already fully paid; just set status
    UPDATE public.jobs_ledger SET status = 'paid', updated_at = NOW() WHERE id = p_job_id;
    RETURN jsonb_build_object('ok', true);
  END IF;

  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next_order
  FROM public.jobs_ledger_payments WHERE job_id = p_job_id;

  INSERT INTO public.jobs_ledger_payments (job_id, amount, sequence_order)
  VALUES (p_job_id, v_remaining, v_next_order);

  UPDATE public.jobs_ledger
  SET payments_made = COALESCE(payments_made, 0) + v_remaining,
      status = 'paid',
      updated_at = NOW()
  WHERE id = p_job_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
COMMENT ON FUNCTION public.mark_job_paid(UUID) IS 'Marks whole job as paid: adds remaining (revenue - payments_made) to jobs_ledger_payments, updates payments_made, sets status to paid.';
