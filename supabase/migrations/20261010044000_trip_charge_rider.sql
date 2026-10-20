SET lock_timeout = '3s';

-- v2.5129: a turnaway trip charge rides on the job like a fee, so no rewrite of the revenue writes it away.
--
-- create_turnaway_trip_charge (2026-07-04, 20260709130000; its newest body 20260927230000) puts a trip charge on its own
-- ready_to_bill bill and raises jobs_ledger.revenue by the same amount. Nothing recorded it as anything but the
-- bill's memo, which the office can rewrite when it sends the bill. So the four writers that set the revenue from the
-- line items again (Edit Job's billing save, apply_job_discount, record_job_tip_from_deposit and
-- add_collect_payment_fixture_from_job_book) wrote the trip charge away while its bill kept it, and the job's total no
-- longer covered its bills. v2.5091 (20261010023000) closed the same gap for a returned check fee by counting the
-- riders in job_rider_fees; this file gives a trip charge a rider of its own.
--
-- 1. job_rider_fees, restated byte for byte from 20261010026000 (its newest body) but for one more kind of fee_lines
--    entry it sums: one that names its trip charge. The three SQL writers call it and are not restated, and
--    gc_owner_billing_revenue (20261010026000) adds it too. The client twin is riderFeeLineCents
--    (src/lib/jobs/arReturnCaseFee.ts), behind jobFormRiderFeesDollars.
-- 2. create_turnaway_trip_charge, restated byte for byte from 20260927230000 but for its INSERT, which writes that
--    entry on the bill: {trip_charge: <reason>, amount}. It has no description, so the printed bill draws no row of its
--    own for it.
-- 3. The trip charges made before this file get the entry, but only a bill the function made: the function's exact
--    memo, not the primary bill, no line item on it, no fee_lines entry yet, and a dispatch request on the same job
--    closed the same day with the function's exact note for the bill's amount and reason. A bill typed by
--    hand stays as it is. On 2026-10-09 production held no trip charge at all, so this matches nothing there today.
--
-- No table is created or altered. Each function keeps its signature, so CREATE OR REPLACE keeps its grants.

-- 1 ---------------------------------------------------------------------------------------------------------

-- job_rider_fees, restated byte for byte from 20261010026000 but for one more kind of fee_lines entry it sums: one
-- that names its trip charge (v2.5129), beside one that names its case (v2.5033) or its card bill (v2.5113).
CREATE OR REPLACE FUNCTION public.job_rider_fees(p_job_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    coalesce((SELECT sum(h.fee_amount)
              FROM public.job_hazmat_incidents h
              WHERE h.job_id = p_job_id AND h.voided_at IS NULL), 0)
    + coalesce((SELECT sum(CASE
                             WHEN ((jsonb_typeof(l->'case_id') = 'string' AND btrim(l->>'case_id') <> '')
                                   OR (jsonb_typeof(l->'card_bill') = 'string' AND btrim(l->>'card_bill') <> '')
                                   OR (jsonb_typeof(l->'trip_charge') = 'string' AND btrim(l->>'trip_charge') <> ''))
                              AND (jsonb_typeof(l->'amount') = 'number'
                                   OR (jsonb_typeof(l->'amount') = 'string' AND btrim(l->>'amount') ~ '^[0-9]+(\.[0-9]+)?$'))
                             THEN greatest(round(btrim(l->>'amount')::numeric, 2), 0)
                           END)
                FROM public.jobs_ledger_invoices i
                CROSS JOIN LATERAL jsonb_array_elements(
                  CASE WHEN jsonb_typeof(i.fee_lines) = 'array' THEN i.fee_lines ELSE '[]'::jsonb END
                ) AS l
                WHERE i.job_id = p_job_id), 0)
$function$;

COMMENT ON FUNCTION public.job_rider_fees(uuid) IS
  'v2.5091, widened by v2.5113 and v2.5129: the riders, the fees that ride on a job beyond its line items: its un-voided hazmat fees, every returned check fee on its bills (a jobs_ledger_invoices.fee_lines entry that names its case), every GC card fee (an entry that names its card bill) and every turnaway trip charge (an entry that names its trip charge). Every rewrite of jobs_ledger.revenue from the line items adds it. The client twin is jobFormRiderFeesDollars.';

-- 2 ---------------------------------------------------------------------------------------------------------

-- create_turnaway_trip_charge, restated byte for byte from 20260927230000 but for its INSERT, which writes the bill's
-- trip charge entry.
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
  v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller'))
    AND (v_master_id = auth.uid()
      OR public.is_dev()
      OR public.is_office_or_estimator()
      OR public.is_office_or_estimator()
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

  -- v2.5129: the bill carries the trip charge as its rider, a fee_lines entry that names it, so job_rider_fees counts
  -- it and every rewrite of the revenue from the line items keeps the bump below. No description: the paper draws
  -- no row of its own for it (billFeeLines), since the bill is the trip charge.
  INSERT INTO public.jobs_ledger_invoices
    (job_id, amount, status, sequence_order, estimated_bill_date, is_primary_rtb_bundle, stripe_invoice_memo, fee_lines)
  VALUES
    (p_job_id, v_amount, 'ready_to_bill', v_seq, public.app_today(), false, v_memo,
     jsonb_build_array(jsonb_build_object('trip_charge', p_reason, 'amount', v_amount)))
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

COMMENT ON FUNCTION public.create_turnaway_trip_charge(uuid, numeric, text, uuid) IS
  'Creates a ready_to_bill jobs_ledger_invoices row (non-primary, memo "Trip charge — <reason>") for a Turnaway and bumps jobs_ledger.revenue by the same amount, keeping ensure_single_ready_to_bill_invoice_for_job''s unallocated balance invariant. The bill carries the trip charge as its rider (v2.5129: a fee_lines entry {trip_charge, amount}), so job_rider_fees counts it and every rewrite of the revenue from the line items keeps it; deleting the bill takes it out at the next rewrite. Office roles (dev/master_technician/assistant/controller) with master access. Closes the originating dispatch request in the same transaction; a closed request short-circuits as duplicate.';

-- 3 ---------------------------------------------------------------------------------------------------------

-- The trip charges made before this file: the entry, on a bill the function made and nothing else. The day is the
-- company's (app_today's zone). A second run finds every such bill already carrying its entry and changes nothing.
UPDATE public.jobs_ledger_invoices i
SET fee_lines = jsonb_build_array(jsonb_build_object(
      'trip_charge', CASE i.stripe_invoice_memo WHEN 'Trip charge — client not home' THEN 'client_not_home' ELSE 'site_not_ready' END,
      'amount', round(i.amount, 2)))
WHERE i.stripe_invoice_memo IN ('Trip charge — client not home', 'Trip charge — site not ready')
  AND i.is_primary_rtb_bundle IS NOT TRUE
  AND (i.fee_lines IS NULL OR (jsonb_typeof(i.fee_lines) = 'array' AND jsonb_array_length(i.fee_lines) = 0))
  AND NOT EXISTS (SELECT 1 FROM public.jobs_ledger_fixtures f WHERE f.invoice_id = i.id)
  AND EXISTS (
    SELECT 1
    FROM public.dispatch_requests d
    WHERE d.job_ledger_id = i.job_id
      AND d.status = 'closed'
      AND d.closed_note = 'Trip charge created — $' || to_char(i.amount, 'FM999,999,990.00') || ' ('
                          || CASE i.stripe_invoice_memo WHEN 'Trip charge — client not home' THEN 'client not home' ELSE 'site not ready' END
                          || ')'
      AND (d.closed_at AT TIME ZONE 'America/Chicago')::date = (i.created_at AT TIME ZONE 'America/Chicago')::date
  );
