-- Unwind Stripe "paid out of band" for a single jobs_ledger_invoices row (full invoice allocation only).
-- Called from Edge after Stripe credit note; see reverse-stripe-invoice-out-of-band-payment.

CREATE TABLE IF NOT EXISTS public.stripe_oob_payment_reverts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.jobs_ledger_invoices(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  reason text NOT NULL,
  stripe_credit_note_id text,
  created_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stripe_oob_payment_reverts IS
  'Audit log when staff unwinds a PipeTooling-recorded Stripe out-of-band invoice payment (credit note + ledger revert).';

CREATE INDEX IF NOT EXISTS idx_stripe_oob_payment_reverts_job_id ON public.stripe_oob_payment_reverts(job_id);
CREATE INDEX IF NOT EXISTS idx_stripe_oob_payment_reverts_invoice_id ON public.stripe_oob_payment_reverts(invoice_id);

ALTER TABLE public.stripe_oob_payment_reverts ENABLE ROW LEVEL SECURITY;

CREATE POLICY stripe_oob_payment_reverts_dev_all
ON public.stripe_oob_payment_reverts
FOR ALL
USING (public.is_dev())
WITH CHECK (public.is_dev());

CREATE POLICY stripe_oob_payment_reverts_select
ON public.stripe_oob_payment_reverts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = stripe_oob_payment_reverts.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = j.id AND user_id = auth.uid())
    )
  )
);

CREATE POLICY stripe_oob_payment_reverts_no_insert_authenticated
ON public.stripe_oob_payment_reverts
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY stripe_oob_payment_reverts_no_update_authenticated
ON public.stripe_oob_payment_reverts
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY stripe_oob_payment_reverts_no_delete_authenticated
ON public.stripe_oob_payment_reverts
FOR DELETE
TO authenticated
USING (false);

-- Subcontractor / estimator / superintendent: read via team or project patterns would duplicate large policy sets;
-- team_member line above covers subcontractor on job; office roles covered. Estimators rarely need this audit row.

CREATE OR REPLACE FUNCTION public.revert_stripe_oob_invoice_payment(
  p_invoice_id uuid,
  p_reason text,
  p_stripe_invoice_status_after text DEFAULT NULL,
  p_stripe_credit_note_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_job_id uuid;
  v_applied_sum numeric;
  v_inv_amt numeric;
  v_new_pm numeric;
  v_job_status text;
  v_rev numeric;
  v_stripe_sid text;
  v_status_json jsonb;
  r_trim text := trim(COALESCE(p_reason, ''));
  v_stripe_after text := NULLIF(trim(COALESCE(p_stripe_invoice_status_after, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF length(r_trim) < 3 THEN
    RETURN jsonb_build_object('error', 'Reason is required (at least 3 characters)');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary')
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  SELECT
    i.id,
    i.job_id,
    i.amount,
    i.status,
    i.stripe_invoice_id
  INTO v_invoice
  FROM public.jobs_ledger_invoices i
  WHERE i.id = p_invoice_id;

  IF v_invoice.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;

  IF v_invoice.status IS DISTINCT FROM 'paid' THEN
    RETURN jsonb_build_object('error', 'Invoice must be Paid to unwind Stripe out-of-band payment');
  END IF;

  v_stripe_sid := NULLIF(trim(COALESCE(v_invoice.stripe_invoice_id, '')), '');
  IF v_stripe_sid IS NULL THEN
    RETURN jsonb_build_object('error', 'Invoice has no Stripe invoice id');
  END IF;

  v_job_id := v_invoice.job_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = v_job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized to update this job');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_applied_sum
  FROM public.jobs_ledger_payments
  WHERE invoice_id = p_invoice_id;

  v_inv_amt := COALESCE(v_invoice.amount, 0);

  IF v_applied_sum <= 0 THEN
    RETURN jsonb_build_object('error', 'No applied payments found for this invoice');
  END IF;

  -- v1: full invoice allocation only (same as record-OOB full balance)
  IF v_applied_sum + 0.01 < v_inv_amt THEN
    RETURN jsonb_build_object(
      'error',
      'Only full invoice out-of-band allocations can be unwound (applied sum does not match invoice amount)'
    );
  END IF;

  DELETE FROM public.jobs_ledger_payments
  WHERE invoice_id = p_invoice_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_new_pm
  FROM public.jobs_ledger_payments
  WHERE job_id = v_job_id;

  SELECT jl.status, COALESCE(jl.revenue, 0)
  INTO v_job_status, v_rev
  FROM public.jobs_ledger jl
  WHERE jl.id = v_job_id;

  UPDATE public.jobs_ledger
  SET
    payments_made = v_new_pm,
    updated_at = NOW()
  WHERE id = v_job_id;

  UPDATE public.jobs_ledger_invoices
  SET
    status = 'billed',
    stripe_invoice_status = COALESCE(v_stripe_after, stripe_invoice_status)
  WHERE id = p_invoice_id;

  IF v_job_status = 'paid' AND v_rev > COALESCE(v_new_pm, 0) + 0.01 THEN
    SELECT public.update_job_status(v_job_id, 'billed') INTO v_status_json;
    IF v_status_json IS NOT NULL AND v_status_json->>'error' IS NOT NULL THEN
      RETURN jsonb_build_object(
        'error',
        COALESCE(v_status_json->>'error', 'Failed to move job back to Billed'),
        'detail',
        'Ledger payments were removed; fix job status manually if needed'
      );
    END IF;
  END IF;

  INSERT INTO public.stripe_oob_payment_reverts (
    invoice_id,
    job_id,
    reason,
    stripe_credit_note_id,
    created_by_user_id
  )
  VALUES (
    p_invoice_id,
    v_job_id,
    r_trim,
    NULLIF(trim(COALESCE(p_stripe_credit_note_id, '')), ''),
    auth.uid()
  );

  UPDATE public.job_collect_payment_flows
  SET
    status = 'approved_for_terminal',
    last_error = NULL
  WHERE trim(stripe_invoice_id) = v_stripe_sid
    AND status = 'terminal_completed';

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.revert_stripe_oob_invoice_payment(uuid, text, text, text) IS
  'After Stripe credit note for OOB-paid invoice: remove invoice-linked payments, set invoice billed, sync payments_made, paid→billed when needed, audit row, reset collect flow.';

REVOKE ALL ON FUNCTION public.revert_stripe_oob_invoice_payment(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revert_stripe_oob_invoice_payment(uuid, text, text, text) TO authenticated;
