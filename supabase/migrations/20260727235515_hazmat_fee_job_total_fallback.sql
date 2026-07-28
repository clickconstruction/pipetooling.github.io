-- Hazmat fee: no instant rider invoices (v2.1031).
--
-- v2.1028 folded the fee into the open never-sent primary bill, but when no
-- such bill existed it still minted a standalone non-primary "rider"
-- ready_to_bill invoice — a surprise extra card. Per user direction the fee
-- now ALWAYS just joins the job's total:
--   - open never-sent primary exists → fee added to that bill's amount,
--     incident linked (mode 'folded_into_primary', unchanged);
--   - otherwise → NO invoice is created; only the revenue bump lands and the
--     incident stays unlinked (invoice_id NULL, mode 'job_total'). The fee
--     rides in the job's billable remainder, and the client links + labels it
--     when the next primary bill goes out.

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
    -- No open primary: create NO invoice (v2.1031). The revenue bump below
    -- carries the fee in the job's billable remainder; the incident stays
    -- unlinked until the next primary bill goes out (client repoints it then).
    v_inv_id := NULL;
    v_mode := 'job_total';
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
  'Creates a job_hazmat_incidents row for a biohazard exposure fee. v2.1031: when the job has an open never-sent primary bill (is_primary_rtb_bundle, draft/ready_to_bill, no Stripe id, never sent) the fee is ADDED to that bill''s amount and the incident links to it (mode folded_into_primary). Otherwise NO invoice is created — only the revenue bump lands and the incident stays unlinked (mode job_total); the fee rides in the job''s billable remainder and the client links + labels it as its own line when the next primary bill is sent. Both modes bump jobs_ledger.revenue by the fee (keeps ensure_single_ready_to_bill_invoice_for_job''s unallocated math invariant). Office roles (dev/master_technician/assistant) with master access. Caveats: deleting a linked invoice does not unwind the revenue bump; fixture-driven revenue recomputes can absorb the bump (the Edit Job save includes rider fees since v2.1029).';
