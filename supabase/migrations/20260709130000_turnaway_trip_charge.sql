-- Turnaway trip charge (office side of the Turnaway feature).
--
-- PR 1 (20260709120000) lets a tech file a Turnaway: a field report + a
-- dispatch request with pending_action 'trip_charge_turnaway'. This migration
-- gives the office the billing tail: per-reason default amounts in
-- app_settings and an RPC that turns the dispatch item into a ready-to-bill
-- jobs_ledger_invoices row.

-- Per-reason default amounts (dollars, value_num). NULL = not configured: the
-- Create Trip Charge modal pre-fills nothing and requires a typed positive
-- amount. DO NOTHING keeps re-push idempotent without clobbering dev edits.
INSERT INTO public.app_settings (key, value_num)
VALUES
  ('trip_charge_client_not_home', NULL),
  ('trip_charge_site_not_ready', NULL)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_turnaway_trip_charge(
  p_job_id uuid,
  p_amount numeric,
  p_reason text,
  p_dispatch_request_id uuid DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
    (p_job_id, v_amount, 'ready_to_bill', v_seq, CURRENT_DATE, false, v_memo)
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
$$;

GRANT EXECUTE ON FUNCTION public.create_turnaway_trip_charge(uuid, numeric, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.create_turnaway_trip_charge(uuid, numeric, text, uuid) IS
  'Creates a ready_to_bill jobs_ledger_invoices row (non-primary, memo "Trip charge — <reason>") for a Turnaway and bumps jobs_ledger.revenue by the same amount, keeping ensure_single_ready_to_bill_invoice_for_job''s unallocated balance invariant. Office roles (dev/master_technician/assistant) with master access. Closes the originating dispatch request in the same transaction; a closed request short-circuits as duplicate. Known caveats: (1) delete_ready_to_bill_invoice on the trip-charge row does not unwind the revenue bump — the amount folds into the job''s billable remainder instead of vanishing; (2) add_collect_payment_fixture_from_job_book recomputes revenue = SUM(fixtures) on its narrow path, which would absorb the bump.';
