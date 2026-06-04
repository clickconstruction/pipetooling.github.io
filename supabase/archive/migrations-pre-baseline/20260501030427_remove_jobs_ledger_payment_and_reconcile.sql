-- Remove one jobs_ledger_payments row and reconcile payments_made, invoice billed/paid, and job paid→billed.
-- Rejects Stripe-hosted invoices (use Stripe/OOB flows). Auth: dev/master_technician/assistant/primary + job access.

CREATE OR REPLACE FUNCTION public.remove_jobs_ledger_payment_and_reconcile(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_invoice_id uuid;
  v_inv_amount numeric;
  v_stripe_trim text;
  v_sum numeric;
  v_applied numeric;
  v_rev numeric;
  v_pm numeric;
  v_job_status text;
  v_status_rpc jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'primary')
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  SELECT p.job_id, p.invoice_id
  INTO v_job_id, v_invoice_id
  FROM public.jobs_ledger_payments p
  WHERE p.id = p_payment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Payment not found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = v_job_id
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
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized to update this job');
  END IF;

  IF v_invoice_id IS NOT NULL THEN
    SELECT
      i.amount,
      coalesce(nullif(trim(i.stripe_invoice_id), ''), '')
    INTO v_inv_amount, v_stripe_trim
    FROM public.jobs_ledger_invoices i
    WHERE i.id = v_invoice_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Invoice not found');
    END IF;

    IF length(v_stripe_trim) > 0 THEN
      RETURN jsonb_build_object(
        'error',
        'Stripe-hosted invoice payments cannot be removed here; use Stripe reversal flows.'
      );
    END IF;
  END IF;

  DELETE FROM public.jobs_ledger_payments
  WHERE id = p_payment_id AND job_id = v_job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Payment could not be deleted');
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_sum
  FROM public.jobs_ledger_payments
  WHERE job_id = v_job_id;

  UPDATE public.jobs_ledger
  SET payments_made = v_sum, updated_at = now()
  WHERE id = v_job_id;

  IF v_invoice_id IS NOT NULL THEN
    SELECT coalesce(sum(amount), 0) INTO v_applied
    FROM public.jobs_ledger_payments
    WHERE invoice_id = v_invoice_id;

    IF v_applied + 0.0001 >= coalesce(v_inv_amount, 0) THEN
      UPDATE public.jobs_ledger_invoices
      SET status = 'paid'
      WHERE id = v_invoice_id AND status = 'billed';
    ELSIF v_applied + 0.0001 < coalesce(v_inv_amount, 0) THEN
      UPDATE public.jobs_ledger_invoices
      SET status = 'billed'
      WHERE id = v_invoice_id AND status = 'paid';
    END IF;
  END IF;

  SELECT jl.revenue, jl.payments_made, jl.status
  INTO v_rev, v_pm, v_job_status
  FROM public.jobs_ledger jl
  WHERE jl.id = v_job_id;

  IF coalesce(v_job_status, '') = 'paid' AND coalesce(v_rev, 0) > coalesce(v_pm, 0) + 0.01 THEN
    v_status_rpc := public.update_job_status(v_job_id, 'billed');
    IF v_status_rpc ? 'error' THEN
      RETURN jsonb_build_object(
        'ok', true,
        'warning', coalesce(v_status_rpc ->> 'error', 'Could not move job back to Billed'),
        'payments_made', v_sum
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'payments_made', v_sum);
END;
$$;

COMMENT ON FUNCTION public.remove_jobs_ledger_payment_and_reconcile(uuid) IS
  'Deletes one jobs_ledger_payments row for non-Stripe-hosted invoices only; recomputes jobs_ledger.payments_made; '
  'syncs jobs_ledger_invoices paid/billed from remaining invoice-linked payments; may move job paid→billed via update_job_status. '
  'Frees Mercury allocation capacity when mercury_transaction_id was set. Roles: dev/master_technician/assistant/primary with job access.';

REVOKE ALL ON FUNCTION public.remove_jobs_ledger_payment_and_reconcile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_jobs_ledger_payment_and_reconcile(uuid) TO authenticated;
