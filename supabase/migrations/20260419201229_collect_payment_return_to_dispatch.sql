-- Subcontractor: return collect payment from approved_for_terminal to pending_dispatch with a note (dispatch queue).

ALTER TABLE public.job_collect_payment_flows
  DROP CONSTRAINT IF EXISTS job_collect_payment_flows_certify_mode_check;

ALTER TABLE public.job_collect_payment_flows
  ADD CONSTRAINT job_collect_payment_flows_certify_mode_check
  CHECK (
    certify_mode IS NULL
    OR certify_mode IN ('clean', 'correction_requested', 'returned_from_terminal')
  );

CREATE OR REPLACE FUNCTION public.return_collect_payment_to_dispatch(
  p_job_id uuid,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_note text;
  v_row public.job_collect_payment_flows%ROWTYPE;
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

  v_note := NULLIF(trim(COALESCE(p_note, '')), '');
  IF v_note IS NULL OR length(v_note) < 3 THEN
    RETURN jsonb_build_object('error', 'Describe the issue (at least 3 characters).');
  END IF;

  SELECT * INTO v_row
  FROM public.job_collect_payment_flows
  WHERE job_id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'No collect payment flow for this job.');
  END IF;

  IF v_row.status IS DISTINCT FROM 'approved_for_terminal' THEN
    RETURN jsonb_build_object(
      'error',
      'Payment is not at the collect step. Refresh and try again.'
    );
  END IF;

  UPDATE public.job_collect_payment_flows
  SET
    status = 'pending_dispatch',
    certify_mode = 'returned_from_terminal',
    correction_notes = v_note,
    certified_at = now(),
    dispatch_reviewed_at = NULL,
    dispatch_reviewed_by = NULL,
    dispatch_notes = NULL,
    jobs_ledger_invoice_id = NULL,
    stripe_invoice_id = NULL,
    stripe_payment_intent_id = NULL,
    last_error = NULL
  WHERE job_id = p_job_id;

  RETURN jsonb_build_object('ok', true, 'status', 'pending_dispatch');
END;
$$;

COMMENT ON FUNCTION public.return_collect_payment_to_dispatch(uuid, text) IS
  'Subcontractor: send collect payment back to dispatch from approved_for_terminal with a note.';

REVOKE ALL ON FUNCTION public.return_collect_payment_to_dispatch(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.return_collect_payment_to_dispatch(uuid, text) TO authenticated;
