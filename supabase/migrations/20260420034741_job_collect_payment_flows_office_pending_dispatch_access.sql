-- Org-wide visibility for Field: Waiting for Approval (pending_dispatch) for office staff.
-- Existing job_collect_payment_flows_select_staff is job-scoped; assistants without a
-- master_assistants link to the job's master saw zero rows while dev sees all.

CREATE POLICY job_collect_payment_flows_select_pending_dispatch_office
ON public.job_collect_payment_flows
FOR SELECT
USING (
  job_collect_payment_flows.status = 'pending_dispatch'
  AND EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('assistant', 'master_technician', 'primary')
  )
);

COMMENT ON POLICY job_collect_payment_flows_select_pending_dispatch_office ON public.job_collect_payment_flows IS
  'Office roles: read all pending_dispatch flows for the Field collect payment approval queue (dashboard).';

-- Allow assistant and master_technician to approve any pending flow when invoice is valid
-- (same desk as dispatch; dev already passes via is_dev()).
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
      OR v_role IN ('assistant', 'master_technician')
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
