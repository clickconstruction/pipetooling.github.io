-- Hazmat Fee (Jobs → Stages): incident record + rider invoice in one RPC.
-- A biohazard exposure incident is documented (photos, technician
-- testimonials, ToS §11 snapshot) and bills the customer a fixed fee as an
-- independent ready_to_bill invoice row — same mechanics as
-- create_turnaway_trip_charge (20260709130000). Idempotent; additive.

CREATE TABLE IF NOT EXISTS public.job_hazmat_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  incident_at timestamptz NOT NULL DEFAULT now(),
  description text NOT NULL CHECK (length(btrim(description)) > 0),
  exposed_people text NOT NULL DEFAULT '',
  stage_label text,
  -- JSON array of photo/document URLs (customer-pictures folder, Drive, etc.).
  photo_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- JSON array of { name, user_id?, statement, given_at }.
  testimonials jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Verbatim copy of the terms clause the fee rests on, captured at generation
  -- time so later edits to the live terms cannot weaken the evidence.
  tos_clause_snapshot text NOT NULL CHECK (length(btrim(tos_clause_snapshot)) > 0),
  fee_amount numeric(10,2) NOT NULL CHECK (fee_amount > 0),
  invoice_id uuid REFERENCES public.jobs_ledger_invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.job_hazmat_incidents IS
  'Biohazard exposure incidents billed as rider invoices (Jobs → Stages Hazmat Fee). Written only via create_hazmat_fee_incident (SECURITY DEFINER); ToS clause snapshotted at generation.';

CREATE INDEX IF NOT EXISTS job_hazmat_incidents_job_id_idx ON public.job_hazmat_incidents (job_id);

ALTER TABLE public.job_hazmat_incidents ENABLE ROW LEVEL SECURITY;

-- Office/billing visibility mirrors the RPC's creation gate; no client write
-- policies — all writes go through the RPC.
DROP POLICY IF EXISTS job_hazmat_incidents_select_office ON public.job_hazmat_incidents;
CREATE POLICY job_hazmat_incidents_select_office
  ON public.job_hazmat_incidents FOR SELECT TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (
      SELECT 1 FROM public.jobs_ledger jl
      WHERE jl.id = job_id AND jl.master_user_id = auth.uid()
    )
  );

INSERT INTO public.app_settings (key, value_num)
VALUES ('hazmat_fee_default', 500)
ON CONFLICT (key) DO NOTHING;

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
  -- the rider invoice bills independently of the main job.
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

  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_seq
  FROM public.jobs_ledger_invoices
  WHERE job_id = p_job_id;

  INSERT INTO public.jobs_ledger_invoices
    (job_id, amount, status, sequence_order, estimated_bill_date, is_primary_rtb_bundle, stripe_invoice_memo)
  VALUES
    (p_job_id, v_amount, 'ready_to_bill', v_seq, CURRENT_DATE, false, v_memo)
  RETURNING id INTO v_inv_id;

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

  RETURN jsonb_build_object('ok', true, 'incident_id', v_incident_id, 'invoice_id', v_inv_id, 'amount', v_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_hazmat_fee_incident(uuid, numeric, jsonb) TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
