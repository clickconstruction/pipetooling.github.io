-- Subcontractor Collect Payment workflow: certify → dispatch approval → Stripe Terminal.
-- Table + RLS + RPCs + extend list_ready_to_bill_assigned_jobs_for_dashboard.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE public.job_collect_payment_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  initiated_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  jobs_ledger_invoice_id uuid REFERENCES public.jobs_ledger_invoices(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'pending_dispatch',
    'approved_for_terminal',
    'terminal_completed',
    'failed',
    'cancelled'
  )),
  certify_mode text CHECK (certify_mode IS NULL OR certify_mode IN ('clean', 'correction_requested')),
  correction_notes text,
  per_line_notes jsonb,
  certified_at timestamptz,
  dispatch_reviewed_at timestamptz,
  dispatch_reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  dispatch_notes text,
  stripe_payment_intent_id text,
  stripe_invoice_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_collect_payment_flows_job_id_key UNIQUE (job_id)
);

CREATE INDEX idx_job_collect_payment_flows_status ON public.job_collect_payment_flows (status);
CREATE INDEX idx_job_collect_payment_flows_pending ON public.job_collect_payment_flows (status)
  WHERE status = 'pending_dispatch';

COMMENT ON TABLE public.job_collect_payment_flows IS
  'Field collect payment: subcontractor certification, dispatch approval, Stripe Terminal. One row per job.';

CREATE OR REPLACE FUNCTION public.job_collect_payment_flows_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER job_collect_payment_flows_set_updated_at
  BEFORE UPDATE ON public.job_collect_payment_flows
  FOR EACH ROW
  EXECUTE FUNCTION public.job_collect_payment_flows_set_updated_at();

ALTER TABLE public.job_collect_payment_flows ENABLE ROW LEVEL SECURITY;

-- Devs: full access (support).
CREATE POLICY job_collect_payment_flows_dev_all
ON public.job_collect_payment_flows
FOR ALL
USING (public.is_dev())
WITH CHECK (public.is_dev());

-- Team members on the job (any role): read their job collect payment row.
CREATE POLICY job_collect_payment_flows_select_team
ON public.job_collect_payment_flows
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.jobs_ledger_team_members jtm
    WHERE jtm.job_id = job_collect_payment_flows.job_id
      AND jtm.user_id = auth.uid()
  )
);

-- Office roles: read flows for jobs they can access (even if not on team).
CREATE POLICY job_collect_payment_flows_select_staff
ON public.job_collect_payment_flows
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'primary')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = job_collect_payment_flows.job_id
      AND (
        j.master_user_id = auth.uid()
        OR public.is_dev()
        OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = auth.uid() AND assistant_id = j.master_user_id
        )
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = j.master_user_id AND assistant_id = auth.uid()
        )
        OR public.assistants_share_master(auth.uid(), j.master_user_id)
      )
  )
);

-- Explicit no direct writes for non-dev (mutations via SECURITY DEFINER RPCs + service role).
CREATE POLICY job_collect_payment_flows_no_insert_authenticated
ON public.job_collect_payment_flows
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY job_collect_payment_flows_no_update_authenticated
ON public.job_collect_payment_flows
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY job_collect_payment_flows_no_delete_authenticated
ON public.job_collect_payment_flows
FOR DELETE
TO authenticated
USING (false);

GRANT SELECT ON public.job_collect_payment_flows TO authenticated;
GRANT ALL ON public.job_collect_payment_flows TO service_role;

-- Realtime (sub async approval UX).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'job_collect_payment_flows'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_collect_payment_flows;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RPC: certify payload (subcontractor + team + RTB only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_collect_payment_certify_payload(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_fixtures jsonb;
  v_invoice jsonb;
  v_flow jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = v_uid;
  IF v_role IS DISTINCT FROM 'subcontractor' THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs_ledger_team_members jtm
    INNER JOIN public.jobs_ledger jl ON jl.id = jtm.job_id
    WHERE jtm.user_id = v_uid
      AND jl.id = p_job_id
      AND jl.status = 'ready_to_bill'
  ) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', sf.id,
        'name', sf.name,
        'count', sf.count,
        'line_unit_price', sf.line_unit_price,
        'line_description', sf.line_description,
        'sequence_order', sf.sequence_order
      )
      ORDER BY sf.sequence_order
    ),
    '[]'::jsonb
  )
  INTO v_fixtures
  FROM public.jobs_ledger_fixtures sf
  WHERE sf.job_id = p_job_id;

  SELECT jsonb_build_object(
    'id', i.id,
    'amount', i.amount,
    'status', i.status,
    'sequence_order', i.sequence_order,
    'estimated_bill_date', i.estimated_bill_date
  )
  INTO v_invoice
  FROM public.jobs_ledger_invoices i
  WHERE i.job_id = p_job_id
    AND i.status = 'ready_to_bill'
  ORDER BY i.created_at DESC NULLS LAST
  LIMIT 1;

  SELECT to_jsonb(f.*)
  INTO v_flow
  FROM public.job_collect_payment_flows f
  WHERE f.job_id = p_job_id;

  RETURN jsonb_build_object(
    'fixtures', COALESCE(v_fixtures, '[]'::jsonb),
    'invoice', v_invoice,
    'flow', v_flow
  );
END;
$$;

COMMENT ON FUNCTION public.get_collect_payment_certify_payload(uuid) IS
  'Subcontractor: billable fixtures + latest RTB invoice summary for certify step.';

REVOKE ALL ON FUNCTION public.get_collect_payment_certify_payload(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_collect_payment_certify_payload(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: submit certification (subcontractor)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_collect_payment_certification(
  p_job_id uuid,
  p_mode text,
  p_correction_notes text DEFAULT NULL,
  p_per_line_notes jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_notes text;
  v_rtb_invoice_id uuid;
  v_row public.job_collect_payment_flows%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = v_uid;
  IF v_role IS DISTINCT FROM 'subcontractor' THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  IF p_mode IS NULL OR p_mode NOT IN ('clean', 'correction_requested') THEN
    RETURN jsonb_build_object('error', 'Invalid certify mode');
  END IF;

  v_notes := NULLIF(trim(COALESCE(p_correction_notes, '')), '');
  IF p_mode = 'correction_requested' AND (v_notes IS NULL OR length(v_notes) < 3) THEN
    RETURN jsonb_build_object('error', 'Describe the correction needed (at least 3 characters).');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs_ledger_team_members jtm
    INNER JOIN public.jobs_ledger jl ON jl.id = jtm.job_id
    WHERE jtm.user_id = v_uid
      AND jl.id = p_job_id
      AND jl.status = 'ready_to_bill'
  ) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT i.id INTO v_rtb_invoice_id
  FROM public.jobs_ledger_invoices i
  WHERE i.job_id = p_job_id
    AND i.status = 'ready_to_bill'
  ORDER BY i.created_at DESC NULLS LAST
  LIMIT 1;

  SELECT * INTO v_row FROM public.job_collect_payment_flows WHERE job_id = p_job_id FOR UPDATE;

  IF FOUND THEN
    IF v_row.status = 'approved_for_terminal' THEN
      RETURN jsonb_build_object('error', 'Payment is approved for terminal. Complete collection or ask office to reset.');
    END IF;
    IF v_row.status NOT IN (
      'draft',
      'pending_dispatch',
      'terminal_completed',
      'failed',
      'cancelled'
    ) THEN
      RETURN jsonb_build_object('error', 'Invalid flow state for submit');
    END IF;

    UPDATE public.job_collect_payment_flows
    SET
      initiated_by_user_id = v_uid,
      jobs_ledger_invoice_id = v_rtb_invoice_id,
      status = 'pending_dispatch',
      certify_mode = p_mode,
      correction_notes = CASE WHEN p_mode = 'correction_requested' THEN v_notes ELSE NULL END,
      per_line_notes = p_per_line_notes,
      certified_at = now(),
      dispatch_reviewed_at = NULL,
      dispatch_reviewed_by = NULL,
      dispatch_notes = NULL,
      stripe_payment_intent_id = NULL,
      stripe_invoice_id = NULL,
      last_error = NULL
    WHERE job_id = p_job_id;

    RETURN jsonb_build_object('ok', true, 'status', 'pending_dispatch');
  END IF;

  INSERT INTO public.job_collect_payment_flows (
    job_id,
    initiated_by_user_id,
    jobs_ledger_invoice_id,
    status,
    certify_mode,
    correction_notes,
    per_line_notes,
    certified_at
  ) VALUES (
    p_job_id,
    v_uid,
    v_rtb_invoice_id,
    'pending_dispatch',
    p_mode,
    CASE WHEN p_mode = 'correction_requested' THEN v_notes ELSE NULL END,
    p_per_line_notes,
    now()
  );

  RETURN jsonb_build_object('ok', true, 'status', 'pending_dispatch');
END;
$$;

COMMENT ON FUNCTION public.submit_collect_payment_certification(uuid, text, text, jsonb) IS
  'Subcontractor: certify or request correction; sets flow to pending_dispatch.';

REVOKE ALL ON FUNCTION public.submit_collect_payment_certification(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_collect_payment_certification(uuid, text, text, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: dispatch approve for Terminal (dev / master / assistant)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_collect_payment_for_terminal(
  p_job_id uuid,
  p_jobs_ledger_invoice_id uuid,
  p_dispatch_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_inv RECORD;
  v_flow RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = v_uid;
  IF v_role IS NULL OR v_role NOT IN ('dev', 'master_technician', 'assistant') THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT * INTO v_flow FROM public.job_collect_payment_flows WHERE job_id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_flow.status IS DISTINCT FROM 'pending_dispatch' THEN
    RETURN jsonb_build_object('error', 'No pending collect payment request for this job.');
  END IF;

  SELECT i.id, i.job_id, i.status, i.stripe_invoice_id
  INTO v_inv
  FROM public.jobs_ledger_invoices i
  INNER JOIN public.jobs_ledger j ON j.id = i.job_id
  WHERE i.id = p_jobs_ledger_invoice_id
    AND i.job_id = p_job_id
    AND i.status = 'billed'
    AND i.stripe_invoice_id IS NOT NULL
    AND trim(i.stripe_invoice_id) <> ''
    AND (
      j.master_user_id = v_uid
      OR public.is_dev()
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = v_uid AND assistant_id = j.master_user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = j.master_user_id AND assistant_id = v_uid
      )
      OR public.assistants_share_master(v_uid, j.master_user_id)
    );

  IF v_inv.id IS NULL THEN
    RETURN jsonb_build_object(
      'error',
      'Invoice must be Billed with a Stripe invoice id, and you must have job access.'
    );
  END IF;

  UPDATE public.job_collect_payment_flows
  SET
    status = 'approved_for_terminal',
    jobs_ledger_invoice_id = v_inv.id,
    stripe_invoice_id = trim(v_inv.stripe_invoice_id),
    dispatch_reviewed_at = now(),
    dispatch_reviewed_by = v_uid,
    dispatch_notes = NULLIF(trim(COALESCE(p_dispatch_notes, '')), ''),
    stripe_payment_intent_id = NULL,
    last_error = NULL
  WHERE job_id = p_job_id;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'approved_for_terminal',
    'stripe_invoice_id', trim(v_inv.stripe_invoice_id),
    'jobs_ledger_invoice_id', v_inv.id
  );
END;
$$;

COMMENT ON FUNCTION public.approve_collect_payment_for_terminal(uuid, uuid, text) IS
  'Office: approve field collect payment after Stripe invoice exists (billed + stripe_invoice_id).';

REVOKE ALL ON FUNCTION public.approve_collect_payment_for_terminal(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_collect_payment_for_terminal(uuid, uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: complete flow after Terminal (service_role + webhook)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_job_collect_payment_flow_terminal(
  p_stripe_payment_intent_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pi text := NULLIF(trim(COALESCE(p_stripe_payment_intent_id, '')), '');
  v_updated int;
BEGIN
  IF v_pi IS NULL THEN
    RETURN jsonb_build_object('error', 'missing payment intent id');
  END IF;

  UPDATE public.job_collect_payment_flows
  SET status = 'terminal_completed',
      last_error = NULL
  WHERE stripe_payment_intent_id = v_pi
    AND status = 'approved_for_terminal';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('error', 'no matching flow', 'applied', false);
  END IF;

  RETURN jsonb_build_object('ok', true, 'applied', true);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_job_collect_payment_flow_terminal(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_job_collect_payment_flow_terminal(text) TO service_role;

-- ---------------------------------------------------------------------------
-- Extend list_ready_to_bill_assigned_jobs_for_dashboard
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.list_ready_to_bill_assigned_jobs_for_dashboard();

CREATE FUNCTION public.list_ready_to_bill_assigned_jobs_for_dashboard()
RETURNS TABLE (
  id uuid,
  hcp_number text,
  job_name text,
  job_address text,
  google_drive_link text,
  job_plans_link text,
  revenue numeric,
  master_user_id uuid,
  created_at timestamptz,
  last_report_at timestamptz,
  collect_payment_button_variant text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    jl.id,
    jl.hcp_number,
    jl.job_name,
    jl.job_address,
    jl.google_drive_link,
    jl.job_plans_link,
    jl.revenue,
    jl.master_user_id,
    jl.created_at,
    (SELECT MAX(r.created_at)
     FROM public.reports r
     WHERE r.job_ledger_id = jl.id) AS last_report_at,
    CASE
      WHEN f.status = 'pending_dispatch' THEN 'pending_dispatch'
      WHEN f.status = 'approved_for_terminal' THEN 'ready_terminal'
      ELSE 'default'
    END AS collect_payment_button_variant
  FROM public.jobs_ledger jl
  INNER JOIN public.jobs_ledger_team_members jtm ON jtm.job_id = jl.id AND jtm.user_id = auth.uid()
  LEFT JOIN public.job_collect_payment_flows f ON f.job_id = jl.id
  WHERE jl.status = 'ready_to_bill'
  ORDER BY jl.hcp_number DESC, jl.job_name;
$$;

COMMENT ON FUNCTION public.list_ready_to_bill_assigned_jobs_for_dashboard() IS
  'Team-assigned jobs ready_to_bill; includes collect_payment_button_variant for subcontractor UX.';

GRANT EXECUTE ON FUNCTION public.list_ready_to_bill_assigned_jobs_for_dashboard() TO authenticated;
