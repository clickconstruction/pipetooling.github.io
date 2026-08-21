SET lock_timeout = '3s';

-- create_billed_shell_invoice — the repair for Billed "no bill line" shells
-- (v2.1931's cohort): a billed job with open money but no billed invoice
-- line can't age, be chased, or be forecast. This materializes the missing
-- line for the FULL open remainder, backdated to the real bill-out date the
-- office supplies, so the row immediately joins the aging chips, the aging
-- chart, and the payment forecast.
--
-- Amount = revenue − payments_made − Σ(ready_to_bill line amounts). Billed
-- lines don't enter the subtraction because having one disqualifies the job
-- (that's the shell definition, asserted below).
--
-- The billed_at trigger (jobs_ledger_invoices_billed_at_fn) COALESCEs a
-- provided billed_at on INSERT, so the backdate sticks. estimated_bill_date
-- gets the same day for the est-date fallback displays.
--
-- Gate: office writers (dev / master_technician / assistant-like) — the same
-- set that can bill customers. Read-only training accounts are stopped by
-- the read_only_block_stmt statement trigger.

CREATE OR REPLACE FUNCTION public.create_billed_shell_invoice(p_job_id uuid, p_billed_on date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
  v_job public.jobs_ledger%ROWTYPE;
  v_rtb_alloc numeric;
  v_amount numeric;
  v_seq integer;
  v_invoice_id uuid;
BEGIN
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
           SELECT 1 FROM public.users u
           WHERE u.id = auth.uid() AND u.role = 'master_technician'
         )
    INTO v_ok;
  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'Not allowed to create bill lines';
  END IF;
  IF p_billed_on IS NULL THEN
    RAISE EXCEPTION 'A bill-out date is required';
  END IF;
  IF p_billed_on > CURRENT_DATE THEN
    RAISE EXCEPTION 'The bill-out date cannot be in the future';
  END IF;

  SELECT * INTO v_job FROM public.jobs_ledger WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;
  IF COALESCE(v_job.status, '') <> 'billed' THEN
    RAISE EXCEPTION 'Job is not in Billed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.jobs_ledger_invoices i
    WHERE i.job_id = p_job_id AND i.status = 'billed'
  ) THEN
    RAISE EXCEPTION 'Job already has a bill line';
  END IF;

  SELECT COALESCE(SUM(i.amount), 0) INTO v_rtb_alloc
  FROM public.jobs_ledger_invoices i
  WHERE i.job_id = p_job_id AND i.status = 'ready_to_bill';

  v_amount := round(
    (COALESCE(v_job.revenue, 0) - COALESCE(v_job.payments_made, 0) - v_rtb_alloc)::numeric,
    2
  );
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'No open money to put on a bill line';
  END IF;

  SELECT COALESCE(MAX(i.sequence_order), 0) + 1 INTO v_seq
  FROM public.jobs_ledger_invoices i
  WHERE i.job_id = p_job_id;

  INSERT INTO public.jobs_ledger_invoices (job_id, amount, status, sequence_order, billed_at, estimated_bill_date)
  VALUES (
    p_job_id,
    v_amount,
    'billed',
    v_seq,
    (p_billed_on::timestamp + INTERVAL '12 hours') AT TIME ZONE 'America/Chicago',
    p_billed_on
  )
  RETURNING id INTO v_invoice_id;

  RETURN jsonb_build_object('invoiceId', v_invoice_id, 'amount', v_amount);
END;
$$;

COMMENT ON FUNCTION public.create_billed_shell_invoice(uuid, date) IS
  'Materialize the missing billed invoice line (full open remainder, backdated to the supplied bill-out date) for a billed job that has none — the Fix bill lines repair. Dev/master/assistant-like only.';

REVOKE EXECUTE ON FUNCTION public.create_billed_shell_invoice(uuid, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_billed_shell_invoice(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_billed_shell_invoice(uuid, date) TO authenticated;
