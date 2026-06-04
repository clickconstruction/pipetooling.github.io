-- Idempotent delete for jobs_ledger_invoices in ready_to_bill only.
-- Mirrors DELETE policy on jobs_ledger_invoices. Safe under double-submit / concurrent calls.

CREATE OR REPLACE FUNCTION public.delete_ready_to_bill_invoice(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_status text;
  v_deleted uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  SELECT i.job_id, i.status INTO v_job_id, v_status
  FROM public.jobs_ledger_invoices i
  WHERE i.id = p_invoice_id;

  IF v_job_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'deleted', false);
  END IF;

  IF v_status IS DISTINCT FROM 'ready_to_bill' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invoice is not a Ready to Bill draft');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs_ledger j
    WHERE j.id = v_job_id
      AND (
        j.master_user_id = auth.uid()
        OR public.is_dev()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'primary')
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
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  DELETE FROM public.jobs_ledger_invoices
  WHERE id = p_invoice_id
    AND status = 'ready_to_bill'
  RETURNING id INTO v_deleted;

  IF v_deleted IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'deleted', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger_invoices WHERE id = p_invoice_id) THEN
    RETURN jsonb_build_object('ok', true, 'deleted', false);
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'Could not delete invoice');
END;
$$;

COMMENT ON FUNCTION public.delete_ready_to_bill_invoice(uuid) IS
'Deletes a jobs_ledger_invoices row only when status is ready_to_bill and caller has job access. Idempotent: missing row returns ok=true deleted=false.';

GRANT EXECUTE ON FUNCTION public.delete_ready_to_bill_invoice(uuid) TO authenticated;
