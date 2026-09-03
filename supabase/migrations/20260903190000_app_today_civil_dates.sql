SET lock_timeout = '3s';

-- v2.2703 — civil dates: the database session runs in UTC, so CURRENT_DATE is tomorrow's date
-- every evening after 7 PM Central (6 PM in winter). Three RPCs stamped it into date columns
-- (estimated_bill_date, paid_on) or validated against it. They now use public.app_today(),
-- the SQL twin of todayYmdInAppTz() (src/utils/dateUtils.ts / _shared/appTimeZone.ts).
-- Function bodies below are the live prod definitions (pg_get_functiondef) with only the
-- CURRENT_DATE expression changed — see docs/migrations/20260903190000_app_today_civil_dates.md.

CREATE OR REPLACE FUNCTION public.app_today()
RETURNS date
LANGUAGE sql
STABLE
AS $$ SELECT (now() AT TIME ZONE 'America/Chicago')::date $$;

COMMENT ON FUNCTION public.app_today() IS
  'Today''s civil date in the company calendar zone (America/Chicago). Use instead of CURRENT_DATE when writing to or validating a date column — the session zone is UTC.';

GRANT EXECUTE ON FUNCTION public.app_today() TO authenticated, service_role;

-- create_turnaway_trip_charge: CURRENT_DATE → public.app_today() (1 site)
CREATE OR REPLACE FUNCTION public.create_turnaway_trip_charge(p_job_id uuid, p_amount numeric, p_reason text, p_dispatch_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
  v_master_id UUID;
  v_can_update BOOLEAN := false;
  v_amount NUMERIC;
  v_reason_label TEXT;
  v_memo TEXT;
  v_dispatch_status TEXT;
  v_seq INT;
  v_inv_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- 'other' turnaways have no billable category; the modal requires picking one.
  IF p_reason = 'client_not_home' THEN
    v_reason_label := 'client not home';
  ELSIF p_reason = 'site_not_ready' THEN
    v_reason_label := 'site not ready';
  ELSE
    RETURN jsonb_build_object('error', 'Invalid reason');
  END IF;

  v_amount := round(p_amount, 2);
  IF v_amount IS NULL OR v_amount <= 0 OR v_amount > 100000 THEN
    RETURN jsonb_build_object('error', 'Amount must be between $0.01 and $100,000');
  END IF;

  -- FOR UPDATE serializes concurrent callers on the job row (revenue bump below).
  SELECT jl.status, jl.master_user_id
    INTO v_status, v_master_id
  FROM public.jobs_ledger jl
  WHERE jl.id = p_job_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  -- Office gating, same shape as set_job_collections_flag (dev/master_technician/assistant
  -- with master access). No job-status restriction: turnaways happen on scheduled and
  -- in-progress jobs, and the ready_to_bill invoice row bills independently of job status.
  v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
    AND (v_master_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = v_master_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = v_master_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), v_master_id));

  IF NOT v_can_update THEN
    RETURN jsonb_build_object('error', 'Not authorized to create a trip charge');
  END IF;

  -- Idempotency rides on the dispatch request: the first success closes it, so a
  -- double-click or a second office user gets the duplicate early-return.
  IF p_dispatch_request_id IS NOT NULL THEN
    SELECT dr.status INTO v_dispatch_status
    FROM public.dispatch_requests dr
    WHERE dr.id = p_dispatch_request_id
    FOR UPDATE;
    IF v_dispatch_status IS NULL THEN
      RETURN jsonb_build_object('error', 'Dispatch request not found');
    END IF;
    IF v_dispatch_status = 'closed' THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true);
    END IF;
  END IF;

  -- Must match buildTripChargeMemo in src/lib/turnawayTripCharge.ts.
  v_memo := 'Trip charge — ' || v_reason_label;

  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_seq
  FROM public.jobs_ledger_invoices
  WHERE job_id = p_job_id;

  INSERT INTO public.jobs_ledger_invoices
    (job_id, amount, status, sequence_order, estimated_bill_date, is_primary_rtb_bundle, stripe_invoice_memo)
  VALUES
    (p_job_id, v_amount, 'ready_to_bill', v_seq, public.app_today(), false, v_memo)
  RETURNING id INTO v_inv_id;

  -- Bump revenue by the same amount so ensure_single_ready_to_bill_invoice_for_job's
  -- unallocated math (revenue - payments - RTB/billed invoices) is invariant: the job's
  -- eventual final bill is unchanged by the trip charge.
  UPDATE public.jobs_ledger
  SET revenue = COALESCE(revenue, 0) + v_amount,
      updated_at = NOW()
  WHERE id = p_job_id;

  IF p_dispatch_request_id IS NOT NULL THEN
    UPDATE public.dispatch_requests
    SET status = 'closed',
        closed_at = NOW(),
        closed_by_user_id = auth.uid(),
        closed_note = 'Trip charge created — $' || to_char(v_amount, 'FM999,999,990.00') || ' (' || v_reason_label || ')'
    WHERE id = p_dispatch_request_id
      AND status = 'open';
  END IF;

  RETURN jsonb_build_object('ok', true, 'invoice_id', v_inv_id, 'amount', v_amount);
END;
$function$;

-- mark_job_paid: CURRENT_DATE → public.app_today() (1 site)
CREATE OR REPLACE FUNCTION public.mark_job_paid(p_job_id uuid, p_paid_on date DEFAULT NULL::date, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job RECORD;
  v_remaining NUMERIC;
  v_next_order INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT id, revenue, payments_made, status INTO v_job
  FROM public.jobs_ledger WHERE id = p_job_id FOR UPDATE;

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

  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next_order
  FROM public.jobs_ledger_payments WHERE job_id = p_job_id;

  INSERT INTO public.jobs_ledger_payments (job_id, amount, sequence_order, paid_on, note)
  VALUES (
    p_job_id,
    v_remaining,
    v_next_order,
    COALESCE(p_paid_on, public.app_today()),
    NULLIF(TRIM(COALESCE(p_note, '')), '')
  );

  -- B3: payments_made is trigger-maintained.
  UPDATE public.jobs_ledger
  SET status = 'paid',
      updated_at = NOW()
  WHERE id = p_job_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- create_billed_shell_invoice: CURRENT_DATE → public.app_today() (1 site)
CREATE OR REPLACE FUNCTION public.create_billed_shell_invoice(p_job_id uuid, p_billed_on date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF p_billed_on > public.app_today() THEN
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
$function$;
