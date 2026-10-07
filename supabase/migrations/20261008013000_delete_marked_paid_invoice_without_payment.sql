SET lock_timeout = '3s';

-- A bill stamped paid with no payment behind it (v2.4839). Job 258 carried an $8,900 bill in
-- status 'paid' that was never sent and never paid: the Bill tab read it "marked paid · no
-- payment on record", the row's ⋯ menu had no door off the job, and the stamp still counted in
-- lifetime billed and read as settled to the lien-waiver kernel. The two delete RPCs refuse it:
-- delete_ready_to_bill_invoice wants a draft, delete_billed_invoice_on_send_back wants 'billed'.
-- This one takes exactly that row — status 'paid', no jobs_ledger_payments row referencing it,
-- no Stripe invoice behind it (a Stripe mark is undone under the bill first, v2.4082) — for the
-- same people the send-back lets in. Additive, idempotent; no CREATE TABLE.

CREATE OR REPLACE FUNCTION public.delete_marked_paid_invoice_without_payment(p_invoice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job_id uuid;
  v_status text;
  v_stripe_invoice_id text;
  v_deleted uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  SELECT i.job_id, i.status, i.stripe_invoice_id INTO v_job_id, v_status, v_stripe_invoice_id
  FROM public.jobs_ledger_invoices i
  WHERE i.id = p_invoice_id;

  IF v_job_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'deleted', false);
  END IF;

  IF v_status IS DISTINCT FROM 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This bill is not marked paid. Use Delete draft or Send back.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.jobs_ledger_payments p WHERE p.invoice_id = p_invoice_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A payment is recorded on this bill. Unlink it under the bill first.');
  END IF;

  IF COALESCE(btrim(v_stripe_invoice_id), '') <> '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stripe holds a paid mark on this bill. Undo it under the bill first.');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs_ledger j
    WHERE j.id = v_job_id
      AND (
        j.master_user_id = auth.uid()
        OR public.is_dev()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'primary')
        OR public.is_office_or_estimator()
        OR public.assistants_share_master(auth.uid(), j.master_user_id)
      )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  DELETE FROM public.jobs_ledger_invoices
  WHERE id = p_invoice_id
    AND status = 'paid'
    AND NOT EXISTS (SELECT 1 FROM public.jobs_ledger_payments p WHERE p.invoice_id = jobs_ledger_invoices.id)
  RETURNING id INTO v_deleted;

  IF v_deleted IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'deleted', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger_invoices WHERE id = p_invoice_id) THEN
    RETURN jsonb_build_object('ok', true, 'deleted', false);
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'Could not remove the bill');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.delete_marked_paid_invoice_without_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_marked_paid_invoice_without_payment(uuid) TO authenticated;

COMMENT ON FUNCTION public.delete_marked_paid_invoice_without_payment(uuid) IS
  'Removes a jobs_ledger_invoices row in status paid that no payment references and no Stripe invoice backs (v2.4839). The Bill tab''s Remove bill door for a row that reads "marked paid · no payment on record". Same roles and job gate as delete_billed_invoice_on_send_back.';
