SET lock_timeout = '3s';

-- v2.6775 — punch list #76: a dispute case whose payment arrived after the case gets its payment later.
--
-- Stripe's dispute test card disputes the charge the instant it is paid, so charge.dispute.created
-- reached stripe-webhook about 13 ms before invoice.paid wrote the jobs_ledger_payments row
-- (2026-11-09, the ZZ TEST walk on prod). record_ar_stripe_case opened the case with payment_id
-- NULL, and the later charge.dispute.updated / charge.dispute.closed events only brought the status
-- up to date, so the lost case's pane drew the words of Put the bill back with no press
-- (arReturnCase draws it only with payment_live). A live card dispute can land the same way when
-- the two events arrive on parallel workers.
--
-- Now, when the case already exists, is a dispute and holds no payment, the same lookup the open
-- branch runs (the bill's payment of this amount, else the newest) runs again and fills payment_id.
-- Every other branch is unchanged. The result gains payment_filled, which the webhook ignores.

CREATE OR REPLACE FUNCTION public.record_ar_stripe_case(
  p_kind text,
  p_object_id text,
  p_mode text,
  p_charge_id text,
  p_stripe_invoice_id text,
  p_amount numeric,
  p_reason text,
  p_status text,
  p_due_by timestamptz,
  p_occurred_at timestamptz
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_case public.ar_stripe_cases%ROWTYPE;
  v_inv record;
  v_payment uuid;
  v_id uuid;
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_lost_now boolean := false;
  v_closed boolean := false;
  v_filled boolean := false;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('dispute', 'debit_failed') THEN
    RAISE EXCEPTION 'record_ar_stripe_case: kind must be dispute or debit_failed';
  END IF;
  IF nullif(btrim(coalesce(p_object_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'record_ar_stripe_case: the Stripe object id is required';
  END IF;

  SELECT * INTO v_case FROM public.ar_stripe_cases WHERE stripe_object_id = p_object_id FOR UPDATE;

  IF FOUND THEN
    UPDATE public.ar_stripe_cases
    SET stripe_status = coalesce(v_status, stripe_status),
        due_by = coalesce(p_due_by, due_by),
        reason = coalesce(v_reason, reason)
    WHERE id = v_case.id;
    -- The payment Stripe recorded on the bill arrived after the case opened: find it now, the
    -- open branch's way (the bill's payment of this amount, else the newest).
    IF v_case.kind = 'dispute' AND v_case.payment_id IS NULL AND v_case.invoice_id IS NOT NULL THEN
      SELECT p.id INTO v_payment
      FROM public.jobs_ledger_payments p
      WHERE p.invoice_id = v_case.invoice_id
        AND p.amount > 0
      ORDER BY (abs(p.amount - coalesce(p_amount, v_case.amount, 0)) < 0.005) DESC, p.created_at DESC NULLS LAST, p.id
      LIMIT 1;
      IF v_payment IS NOT NULL THEN
        UPDATE public.ar_stripe_cases SET payment_id = v_payment WHERE id = v_case.id;
        v_filled := true;
      END IF;
    END IF;
    IF v_case.kind = 'dispute' AND v_case.closed_at IS NULL AND v_status IN ('won', 'warning_closed') THEN
      UPDATE public.ar_stripe_cases SET closed_at = now(), closed_reason = 'won' WHERE id = v_case.id;
      v_closed := true;
    END IF;
    IF v_case.kind = 'dispute' AND v_case.lost_at IS NULL AND v_status = 'lost' THEN
      UPDATE public.ar_stripe_cases SET lost_at = now() WHERE id = v_case.id;
      v_lost_now := v_case.closed_at IS NULL;
    END IF;
    RETURN jsonb_build_object('case_id', v_case.id, 'opened', false, 'lost_now', v_lost_now, 'closed', v_closed, 'payment_filled', v_filled);
  END IF;

  SELECT i.id, i.job_id, i.status, i.stripe_mode INTO v_inv
  FROM public.jobs_ledger_invoices i
  WHERE i.stripe_invoice_id = p_stripe_invoice_id
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('skipped', 'unknown_invoice');
  END IF;
  IF v_inv.stripe_mode IS NOT NULL AND p_mode IS NOT NULL AND v_inv.stripe_mode <> p_mode THEN
    RETURN jsonb_build_object('skipped', 'mode_mismatch');
  END IF;
  -- A later try paid the bill after all: nothing to chase.
  IF p_kind = 'debit_failed' AND v_inv.status = 'paid' THEN
    RETURN jsonb_build_object('skipped', 'already_paid');
  END IF;
  -- An inquiry closed before we heard of it: nothing was taken.
  IF p_kind = 'dispute' AND v_status IN ('won', 'warning_closed') THEN
    RETURN jsonb_build_object('skipped', 'already_won');
  END IF;

  -- The payment Stripe recorded on the bill: the one of this amount, else the newest.
  IF p_kind = 'dispute' THEN
    SELECT p.id INTO v_payment
    FROM public.jobs_ledger_payments p
    WHERE p.invoice_id = v_inv.id
      AND p.amount > 0
    ORDER BY (abs(p.amount - coalesce(p_amount, 0)) < 0.005) DESC, p.created_at DESC NULLS LAST, p.id
    LIMIT 1;
  END IF;

  INSERT INTO public.ar_stripe_cases (
    kind, stripe_object_id, stripe_mode, stripe_charge_id, stripe_invoice_id, invoice_id, job_id, payment_id,
    amount, reason, stripe_status, due_by, occurred_at, lost_at
  ) VALUES (
    p_kind, p_object_id, p_mode, nullif(btrim(coalesce(p_charge_id, '')), ''), p_stripe_invoice_id, v_inv.id, v_inv.job_id, v_payment,
    abs(coalesce(p_amount, 0)), v_reason, v_status, p_due_by, coalesce(p_occurred_at, now()),
    CASE WHEN v_status = 'lost' THEN now() END
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('case_id', v_id, 'opened', true, 'lost_now', coalesce(v_status = 'lost', false), 'closed', false, 'payment_filled', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.record_ar_stripe_case(text, text, text, text, text, numeric, text, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ar_stripe_case(text, text, text, text, text, numeric, text, text, timestamptz, timestamptz) TO service_role;

COMMENT ON FUNCTION public.record_ar_stripe_case(text, text, text, text, text, numeric, text, text, timestamptz, timestamptz) IS
  'stripe-webhook''s one write for a dispute or a failed bank debit (v2.4950): opens a case on the bill whose stripe_invoice_id Stripe names (a dispute keeps the bill''s payment of that amount), or brings an open one up to date — won or warning_closed closes it as won, lost stamps lost_at and leaves it open for put_back_lost_dispute_bill; a dispute case still holding no payment gets the bill''s payment of that amount, else the newest, on any later event (v2.6775, the payment that arrived after the case). Skips an unknown invoice, a mode mismatch, a failed debit on a bill already paid and a dispute already won. Returns case_id, opened, lost_now, closed, payment_filled. Service role only.';
