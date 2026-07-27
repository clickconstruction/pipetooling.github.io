-- Hazmat fee folds into the open primary bill (v2.1028).
--
-- Before: create_hazmat_fee_incident always inserted a separate non-primary
-- "rider" ready_to_bill invoice. On the Stages card that read as
-- "Billing line: $1,380" + a floating "$500" chip — i.e. as if $500 of the
-- total were already handled — and the Physical Invoice tab had no roll-in,
-- so the fee could silently stay behind.
--
-- Now: when the job has an OPEN, NEVER-SENT primary bill (is_primary_rtb_bundle,
-- status draft/ready_to_bill, no stripe_invoice_id, never sent), the fee is
-- added to that bill's amount and the incident links to it — the billing line
-- itself becomes $1,880. The client renders linked incidents on a primary bill
-- as their own labeled line items at billing time (Stripe extra_line_items /
-- physical PDF fee rows). When no such bill exists, the legacy rider path is
-- kept so the fee is never lost. Revenue bump unchanged in both modes (keeps
-- ensure_single_ready_to_bill_invoice_for_job's unallocated math invariant).
--
-- Returns jsonb gains a "mode" field: 'folded_into_primary' | 'rider'.

CREATE OR REPLACE FUNCTION public.create_hazmat_fee_incident(
  p_job_id uuid,
  p_amount numeric,
  p_incident jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_master_id UUID;
  v_can_update BOOLEAN := false;
  v_amount NUMERIC;
  v_description TEXT;
  v_tos TEXT;
  v_incident_at TIMESTAMPTZ;
  v_memo TEXT;
  v_seq INT;
  v_inv_id UUID;
  v_incident_id UUID;
  v_mode TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  v_amount := round(p_amount, 2);
  IF v_amount IS NULL OR v_amount <= 0 OR v_amount > 100000 THEN
    RETURN jsonb_build_object('error', 'Amount must be between $0.01 and $100,000');
  END IF;

  v_description := btrim(coalesce(p_incident->>'description', ''));
  IF v_description = '' THEN
    RETURN jsonb_build_object('error', 'Describe the incident');
  END IF;
  v_tos := btrim(coalesce(p_incident->>'tos_clause_snapshot', ''));
  IF v_tos = '' THEN
    RETURN jsonb_build_object('error', 'Missing terms-of-service clause snapshot');
  END IF;
  IF jsonb_typeof(coalesce(p_incident->'photo_links', 'null'::jsonb)) <> 'array'
     OR jsonb_array_length(p_incident->'photo_links') < 1 THEN
    RETURN jsonb_build_object('error', 'At least one photo link is required');
  END IF;
  IF jsonb_typeof(coalesce(p_incident->'testimonials', 'null'::jsonb)) <> 'array'
     OR jsonb_array_length(p_incident->'testimonials') < 1 THEN
    RETURN jsonb_build_object('error', 'At least one technician testimonial is required');
  END IF;
  v_incident_at := coalesce((p_incident->>'incident_at')::timestamptz, now());

  SELECT jl.status, jl.master_user_id
    INTO v_status, v_master_id
  FROM public.jobs_ledger jl
  WHERE jl.id = p_job_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  -- Same office gate as create_turnaway_trip_charge; no job-status restriction —
  -- the fee bills with (or independently of) the main job.
  v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
    AND (v_master_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = v_master_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = v_master_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), v_master_id));

  IF NOT v_can_update THEN
    RETURN jsonb_build_object('error', 'Not authorized to create a hazmat fee');
  END IF;

  -- Must match buildHazmatFeeMemo in src/lib/hazmatFee.ts.
  v_memo := 'Hazmat remediation fee — incident ' || to_char(v_incident_at AT TIME ZONE 'America/Chicago', 'MM/DD/YYYY');

  -- Fold into the job's open, never-sent primary bill when one exists. FOR
  -- UPDATE serializes against concurrent billing of the same row.
  SELECT id INTO v_inv_id
  FROM public.jobs_ledger_invoices
  WHERE job_id = p_job_id
    AND is_primary_rtb_bundle = true
    AND status IN ('draft', 'ready_to_bill')
    AND COALESCE(btrim(stripe_invoice_id), '') = ''
    AND sent_to_customer_at IS NULL
  ORDER BY sequence_order
  LIMIT 1
  FOR UPDATE;

  IF v_inv_id IS NOT NULL THEN
    UPDATE public.jobs_ledger_invoices
    SET amount = COALESCE(amount, 0) + v_amount
    WHERE id = v_inv_id;
    v_mode := 'folded_into_primary';
  ELSE
    -- Legacy rider: separate non-primary ready_to_bill line (never lose a fee).
    SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_seq
    FROM public.jobs_ledger_invoices
    WHERE job_id = p_job_id;

    INSERT INTO public.jobs_ledger_invoices
      (job_id, amount, status, sequence_order, estimated_bill_date, is_primary_rtb_bundle, stripe_invoice_memo)
    VALUES
      (p_job_id, v_amount, 'ready_to_bill', v_seq, CURRENT_DATE, false, v_memo)
    RETURNING id INTO v_inv_id;
    v_mode := 'rider';
  END IF;

  -- Bump revenue so ensure_single_ready_to_bill_invoice_for_job's unallocated
  -- math stays invariant (same rationale as the trip charge).
  UPDATE public.jobs_ledger
  SET revenue = COALESCE(revenue, 0) + v_amount,
      updated_at = NOW()
  WHERE id = p_job_id;

  INSERT INTO public.job_hazmat_incidents
    (job_id, created_by, incident_at, description, exposed_people, stage_label,
     photo_links, testimonials, tos_clause_snapshot, fee_amount, invoice_id)
  VALUES
    (p_job_id, auth.uid(), v_incident_at, v_description,
     coalesce(p_incident->>'exposed_people', ''),
     nullif(btrim(coalesce(p_incident->>'stage_label', '')), ''),
     coalesce(p_incident->'photo_links', '[]'::jsonb),
     coalesce(p_incident->'testimonials', '[]'::jsonb),
     v_tos, v_amount, v_inv_id)
  RETURNING id INTO v_incident_id;

  RETURN jsonb_build_object(
    'ok', true,
    'incident_id', v_incident_id,
    'invoice_id', v_inv_id,
    'amount', v_amount,
    'mode', v_mode
  );
END;
$$;

COMMENT ON FUNCTION public.create_hazmat_fee_incident(uuid, numeric, jsonb) IS
  'Creates a job_hazmat_incidents row for a biohazard exposure fee. v2.1028: when the job has an open never-sent primary bill (is_primary_rtb_bundle, draft/ready_to_bill, no Stripe id, never sent) the fee is ADDED to that bill''s amount and the incident links to it (mode folded_into_primary) — the client splits linked fees out as labeled line items at billing time. Otherwise falls back to a separate non-primary ready_to_bill rider (mode rider). Both modes bump jobs_ledger.revenue by the fee, keeping ensure_single_ready_to_bill_invoice_for_job''s unallocated math invariant. Office roles (dev/master_technician/assistant) with master access. Caveats unchanged from the rider era: deleting the linked invoice does not unwind the revenue bump (the amount folds into the job''s billable remainder), and fixture-driven revenue recomputes can absorb the bump.';
