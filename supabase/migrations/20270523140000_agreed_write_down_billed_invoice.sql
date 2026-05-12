-- Agreed write-down / discount on billed invoices (Edit Job Outstanding billing).
-- Non-Stripe: apply_agreed_write_down_to_billed_invoice (JWT).
-- Stripe: Edge creates Credit Note, then service_apply_agreed_write_down_from_stripe (service_role only).

ALTER TABLE public.jobs_ledger_invoices
  ADD COLUMN IF NOT EXISTS agreed_write_down_note text NULL,
  ADD COLUMN IF NOT EXISTS agreed_write_down_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS agreed_write_down_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agreed_write_down_previous_amount numeric NULL,
  ADD COLUMN IF NOT EXISTS agreed_write_down_stripe_credit_note_id text NULL;

COMMENT ON COLUMN public.jobs_ledger_invoices.agreed_write_down_note IS
  'Internal note for agreed discount / write-down on a billed invoice.';
COMMENT ON COLUMN public.jobs_ledger_invoices.agreed_write_down_at IS
  'When the write-down was applied.';
COMMENT ON COLUMN public.jobs_ledger_invoices.agreed_write_down_by IS
  'auth user who applied the write-down (JWT path) or actor recorded by Edge (Stripe path).';
COMMENT ON COLUMN public.jobs_ledger_invoices.agreed_write_down_previous_amount IS
  'Invoice amount (USD) immediately before the write-down.';
COMMENT ON COLUMN public.jobs_ledger_invoices.agreed_write_down_stripe_credit_note_id IS
  'Stripe Credit Note id when the write-down was applied via Edge (cn_…).';

-- Half-cent tolerance (same spirit as promoteJobToBilledIfFullyInvoiced).

CREATE OR REPLACE FUNCTION public.apply_agreed_write_down_to_billed_invoice(
  p_invoice_id uuid,
  p_new_amount numeric,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_applied numeric;
  v_old numeric;
  v_note_trim text;
  v_eps constant numeric := 0.005;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant', 'primary')
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  v_note_trim := NULLIF(trim(COALESCE(p_note, '')), '');
  IF v_note_trim IS NULL OR length(v_note_trim) < 3 THEN
    RETURN jsonb_build_object('error', 'Note is required (at least 3 characters)');
  END IF;

  IF p_new_amount IS NULL OR p_new_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'New amount must be positive');
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

  IF v_invoice.status <> 'billed' THEN
    RETURN jsonb_build_object('error', 'Invoice must be in Billed status');
  END IF;

  IF COALESCE(trim(v_invoice.stripe_invoice_id), '') <> '' THEN
    RETURN jsonb_build_object(
      'error',
      'Stripe-hosted invoices must use the write-down flow (credit note).'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs_ledger j
    WHERE j.id = v_invoice.job_id
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

  v_old := round(coalesce(v_invoice.amount, 0), 2);
  IF p_new_amount > v_old + v_eps THEN
    RETURN jsonb_build_object('error', 'New amount cannot exceed the current billed amount');
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_applied
  FROM public.jobs_ledger_payments
  WHERE invoice_id = p_invoice_id;

  IF p_new_amount + v_eps < round(v_applied, 2) THEN
    RETURN jsonb_build_object(
      'error',
      'New amount cannot be less than payments already applied to this invoice'
    );
  END IF;

  UPDATE public.jobs_ledger_invoices
  SET
    amount = round(p_new_amount, 2),
    agreed_write_down_previous_amount = v_old,
    agreed_write_down_note = v_note_trim,
    agreed_write_down_at = now(),
    agreed_write_down_by = auth.uid(),
    agreed_write_down_stripe_credit_note_id = NULL,
    status = CASE
      WHEN round(v_applied, 2) >= round(p_new_amount, 2) - v_eps THEN 'paid'::text
      ELSE status
    END
  WHERE id = p_invoice_id;

  IF round(v_applied, 2) >= round(p_new_amount, 2) - v_eps THEN
    UPDATE public.jobs_ledger j
    SET
      status = CASE
        WHEN coalesce(j.revenue, 0) <= coalesce(j.payments_made, 0) + v_eps THEN 'paid'::text
        ELSE j.status
      END,
      updated_at = now()
    WHERE j.id = v_invoice.job_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.apply_agreed_write_down_to_billed_invoice(uuid, numeric, text) IS
  'Lowers a non–Stripe-hosted billed invoice amount (agreed discount). Same job access as mark_invoice_paid.';

REVOKE ALL ON FUNCTION public.apply_agreed_write_down_to_billed_invoice(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_agreed_write_down_to_billed_invoice(uuid, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.service_apply_agreed_write_down_from_stripe(
  p_invoice_id uuid,
  p_new_amount numeric,
  p_note text,
  p_stripe_credit_note_id text,
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_applied numeric;
  v_old numeric;
  v_note_trim text;
  v_cn_trim text;
  v_eps constant numeric := 0.005;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Missing actor user id');
  END IF;

  v_note_trim := NULLIF(trim(COALESCE(p_note, '')), '');
  IF v_note_trim IS NULL OR length(v_note_trim) < 3 THEN
    RETURN jsonb_build_object('error', 'Note is required (at least 3 characters)');
  END IF;

  v_cn_trim := NULLIF(trim(COALESCE(p_stripe_credit_note_id, '')), '');
  IF v_cn_trim IS NULL OR v_cn_trim !~ '^cn_' THEN
    RETURN jsonb_build_object('error', 'Valid Stripe credit note id (cn_…) is required');
  END IF;

  IF p_new_amount IS NULL OR p_new_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'New amount must be positive');
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

  IF v_invoice.status <> 'billed' THEN
    RETURN jsonb_build_object('error', 'Invoice must be in Billed status');
  END IF;

  IF COALESCE(trim(v_invoice.stripe_invoice_id), '') = '' THEN
    RETURN jsonb_build_object('error', 'Invoice has no Stripe invoice');
  END IF;

  v_old := round(coalesce(v_invoice.amount, 0), 2);
  IF p_new_amount > v_old + v_eps THEN
    RETURN jsonb_build_object('error', 'New amount cannot exceed the current billed amount');
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_applied
  FROM public.jobs_ledger_payments
  WHERE invoice_id = p_invoice_id;

  IF p_new_amount + v_eps < round(v_applied, 2) THEN
    RETURN jsonb_build_object(
      'error',
      'New amount cannot be less than payments already applied to this invoice'
    );
  END IF;

  UPDATE public.jobs_ledger_invoices
  SET
    amount = round(p_new_amount, 2),
    agreed_write_down_previous_amount = v_old,
    agreed_write_down_note = v_note_trim,
    agreed_write_down_at = now(),
    agreed_write_down_by = p_actor_user_id,
    agreed_write_down_stripe_credit_note_id = v_cn_trim,
    status = CASE
      WHEN round(v_applied, 2) >= round(p_new_amount, 2) - v_eps THEN 'paid'::text
      ELSE status
    END
  WHERE id = p_invoice_id;

  IF round(v_applied, 2) >= round(p_new_amount, 2) - v_eps THEN
    UPDATE public.jobs_ledger j
    SET
      status = CASE
        WHEN coalesce(j.revenue, 0) <= coalesce(j.payments_made, 0) + v_eps THEN 'paid'::text
        ELSE j.status
      END,
      updated_at = now()
    WHERE j.id = v_invoice.job_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.service_apply_agreed_write_down_from_stripe(uuid, numeric, text, text, uuid) IS
  'Called from Edge after Stripe Credit Note; service_role only. Syncs jobs_ledger_invoices.amount and audit fields.';

REVOKE ALL ON FUNCTION public.service_apply_agreed_write_down_from_stripe(uuid, numeric, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_apply_agreed_write_down_from_stripe(uuid, numeric, text, text, uuid) TO service_role;
