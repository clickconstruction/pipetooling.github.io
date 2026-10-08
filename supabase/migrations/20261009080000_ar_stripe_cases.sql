SET lock_timeout = '3s';

-- v2.4950 — punch list #76, piece 1: a card chargeback or a failed bank debit on a Stripe bill.
--
-- A bill paid through Stripe reads paid the moment Stripe says so. When the customer then
-- disputes the card charge, Stripe takes the money back while the dispute runs, and keeps it
-- if the customer wins; the bill still reads paid. A bank debit (ACH) is slower: it can fail
-- days after the customer pressed Pay, and nothing told the office. stripe-webhook read none
-- of it. Each now opens a case beside the checks that came back, the same pane and words.
--
-- 1. ar_stripe_cases: one case per Stripe dispute (dp_…) or failed bank payment (pi_…). No
--    foreign keys, so a case outlives a payment or a bill that changes; the bill, the job, the
--    payment and the amount are kept on it.
-- 2. record_ar_stripe_case(): the webhook's one write. It opens the case on the bill Stripe
--    names, or brings an open one up to date: a dispute won (or an inquiry closed with no
--    chargeback) closes as won; a dispute lost is stamped lost_at and stays open, because
--    the bill still reads paid until a person puts it back (5). A failed debit on a bill
--    already paid opens nothing. Service role only.
-- 3. Triggers close a case on its own: a dispute whose payment comes off its job
--    (taken_off); a failed debit whose bill is paid after all (paid), or voided or sent back
--    (voided).
-- 4. close_ar_stripe_case() and reopen_ar_stripe_case(): the pane's More.
-- 5. put_back_lost_dispute_bill(): the one press on a lost dispute. Stripe keeps its invoice
--    paid and cannot collect it again, and the existing reversals refuse a bill Stripe
--    charged (reverse-stripe-invoice-out-of-band-payment needs our out-of-band mark;
--    void-stripe-invoice-for-revert answers 409). So the press, in one transaction: the
--    payment comes off the job with a removed line in its history; the bill loses its Stripe
--    link and goes back to Ready to Bill (Billed, if another payment still sits on it), so
--    it is billed again with a fresh Stripe invoice; a paid job goes back to Billed; the
--    case closes as put_back. The client then moves the job to Ready to Bill when no billed
--    line remains, as every send-back does.
-- 6. list_ar_return_cases() gains a third RETURN QUERY for these cases (source stripe_dispute
--    or stripe_debit) and one column, stripe_case, with what Stripe said. The return type
--    changes, so the function is dropped and made again in this transaction.

-- 1 ---------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ar_stripe_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  stripe_object_id text NOT NULL,
  stripe_mode text,
  stripe_charge_id text,
  stripe_invoice_id text,
  invoice_id uuid,
  job_id uuid,
  payment_id uuid,
  amount numeric NOT NULL,
  reason text,
  stripe_status text,
  due_by timestamptz,
  occurred_at timestamptz,
  opened_at timestamptz NOT NULL DEFAULT now(),
  lost_at timestamptz,
  closed_at timestamptz,
  closed_reason text,
  closed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  closed_note text,
  notified_at timestamptz,
  lost_notified_at timestamptz,
  CONSTRAINT ar_stripe_cases_object_uniq UNIQUE (stripe_object_id),
  CONSTRAINT ar_stripe_cases_kind_chk CHECK (kind IN ('dispute', 'debit_failed')),
  CONSTRAINT ar_stripe_cases_mode_chk CHECK (stripe_mode IS NULL OR stripe_mode IN ('live', 'test')),
  CONSTRAINT ar_stripe_cases_reason_chk CHECK (closed_reason IS NULL OR closed_reason IN ('won', 'paid', 'voided', 'taken_off', 'put_back', 'settled_other_way', 'not_coming'))
);

CREATE INDEX IF NOT EXISTS ar_stripe_cases_open_idx ON public.ar_stripe_cases (opened_at DESC) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS ar_stripe_cases_payment_idx ON public.ar_stripe_cases (payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ar_stripe_cases_invoice_idx ON public.ar_stripe_cases (invoice_id) WHERE invoice_id IS NOT NULL;

COMMENT ON TABLE public.ar_stripe_cases IS
  'A card chargeback or a failed bank debit on a Stripe bill (v2.4950, punch list #76 piece 1): one case per Stripe dispute (dp_…) or failed payment intent (pi_…), opened by stripe-webhook through record_ar_stripe_case. A dispute closes as won (Stripe), taken_off (its payment came off the job) or put_back (put_back_lost_dispute_bill after a lost dispute); a failed debit as paid or voided (its bill); either by the office (settled_other_way, not_coming). No foreign keys: the case outlives a payment or a bill that changes.';

ALTER TABLE public.ar_stripe_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ar_stripe_cases_select_office ON public.ar_stripe_cases;
CREATE POLICY ar_stripe_cases_select_office ON public.ar_stripe_cases FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  ));

GRANT SELECT ON public.ar_stripe_cases TO authenticated;
GRANT ALL ON public.ar_stripe_cases TO service_role;

-- 2 ---------------------------------------------------------------------------------

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
    IF v_case.kind = 'dispute' AND v_case.closed_at IS NULL AND v_status IN ('won', 'warning_closed') THEN
      UPDATE public.ar_stripe_cases SET closed_at = now(), closed_reason = 'won' WHERE id = v_case.id;
      v_closed := true;
    END IF;
    IF v_case.kind = 'dispute' AND v_case.lost_at IS NULL AND v_status = 'lost' THEN
      UPDATE public.ar_stripe_cases SET lost_at = now() WHERE id = v_case.id;
      v_lost_now := v_case.closed_at IS NULL;
    END IF;
    RETURN jsonb_build_object('case_id', v_case.id, 'opened', false, 'lost_now', v_lost_now, 'closed', v_closed);
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

  RETURN jsonb_build_object('case_id', v_id, 'opened', true, 'lost_now', coalesce(v_status = 'lost', false), 'closed', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.record_ar_stripe_case(text, text, text, text, text, numeric, text, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ar_stripe_case(text, text, text, text, text, numeric, text, text, timestamptz, timestamptz) TO service_role;

COMMENT ON FUNCTION public.record_ar_stripe_case(text, text, text, text, text, numeric, text, text, timestamptz, timestamptz) IS
  'stripe-webhook''s one write for a dispute or a failed bank debit (v2.4950): opens a case on the bill whose stripe_invoice_id Stripe names (a dispute keeps the bill''s payment of that amount), or brings an open one up to date — won or warning_closed closes it as won, lost stamps lost_at and leaves it open for put_back_lost_dispute_bill. Skips an unknown invoice, a mode mismatch, a failed debit on a bill already paid and a dispute already won. Returns case_id, opened, lost_now, closed. Service role only.';

-- 3 ---------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.jobs_ledger_payments_close_stripe_case()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.ar_stripe_cases
  SET closed_at = now(), closed_reason = 'taken_off'
  WHERE payment_id = OLD.id AND closed_at IS NULL;
  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.jobs_ledger_payments_close_stripe_case() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS jobs_ledger_payments_close_stripe_case_gone ON public.jobs_ledger_payments;
CREATE TRIGGER jobs_ledger_payments_close_stripe_case_gone
  AFTER DELETE ON public.jobs_ledger_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.jobs_ledger_payments_close_stripe_case();

CREATE OR REPLACE FUNCTION public.jobs_ledger_invoices_close_stripe_debit_case()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.ar_stripe_cases
    SET closed_at = now(), closed_reason = 'voided'
    WHERE invoice_id = OLD.id AND kind = 'debit_failed' AND closed_at IS NULL;
    RETURN OLD;
  END IF;
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    UPDATE public.ar_stripe_cases
    SET closed_at = now(), closed_reason = 'paid'
    WHERE invoice_id = NEW.id AND kind = 'debit_failed' AND closed_at IS NULL;
  ELSIF coalesce(NEW.stripe_invoice_status, '') = 'void' AND OLD.stripe_invoice_status IS DISTINCT FROM 'void' THEN
    UPDATE public.ar_stripe_cases
    SET closed_at = now(), closed_reason = 'voided'
    WHERE invoice_id = NEW.id AND kind = 'debit_failed' AND closed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.jobs_ledger_invoices_close_stripe_debit_case() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS jobs_ledger_invoices_close_stripe_debit_case_upd ON public.jobs_ledger_invoices;
CREATE TRIGGER jobs_ledger_invoices_close_stripe_debit_case_upd
  AFTER UPDATE OF status, stripe_invoice_status ON public.jobs_ledger_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.jobs_ledger_invoices_close_stripe_debit_case();

DROP TRIGGER IF EXISTS jobs_ledger_invoices_close_stripe_debit_case_del ON public.jobs_ledger_invoices;
CREATE TRIGGER jobs_ledger_invoices_close_stripe_debit_case_del
  AFTER DELETE ON public.jobs_ledger_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.jobs_ledger_invoices_close_stripe_debit_case();

-- 4 ---------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.close_ar_stripe_case(
  p_case_id uuid,
  p_reason text,
  p_note text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'close_ar_stripe_case: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  ) THEN
    RAISE EXCEPTION 'close_ar_stripe_case: not authorized';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('settled_other_way', 'not_coming') THEN
    RAISE EXCEPTION 'close_ar_stripe_case: reason must be settled_other_way or not_coming';
  END IF;
  IF v_note IS NOT NULL AND length(v_note) > 500 THEN
    RAISE EXCEPTION 'close_ar_stripe_case: the note is at most 500 characters';
  END IF;
  UPDATE public.ar_stripe_cases
  SET closed_at = now(), closed_by = auth.uid(), closed_reason = p_reason, closed_note = v_note
  WHERE id = p_case_id AND closed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This payment has no open case to close.' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.close_ar_stripe_case(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_ar_stripe_case(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reopen_ar_stripe_case(p_case_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'reopen_ar_stripe_case: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  ) THEN
    RAISE EXCEPTION 'reopen_ar_stripe_case: not authorized';
  END IF;
  -- Only a case the office closed reopens: Stripe's own answers and a bill put back stand.
  UPDATE public.ar_stripe_cases
  SET closed_at = NULL, closed_by = NULL, closed_reason = NULL, closed_note = NULL
  WHERE id = p_case_id AND closed_reason IN ('settled_other_way', 'not_coming');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This case cannot be opened again.' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.reopen_ar_stripe_case(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_ar_stripe_case(uuid) TO authenticated;

-- 5 ---------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.put_back_lost_dispute_bill(p_case_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_case public.ar_stripe_cases%ROWTYPE;
  v_pay public.jobs_ledger_payments%ROWTYPE;
  v_actor_name text;
  v_sum numeric;
  v_rev numeric;
  v_job_status text;
  v_bill_status text := NULL;
  v_status_rpc jsonb;
  v_warning text := NULL;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  SELECT * INTO v_case FROM public.ar_stripe_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'This case is not there any more.');
  END IF;
  IF v_case.kind <> 'dispute' OR v_case.closed_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Only an open dispute puts its bill back.');
  END IF;
  IF v_case.lost_at IS NULL THEN
    RETURN jsonb_build_object('error', 'Stripe has not decided the dispute yet. Put the bill back once the customer wins it.');
  END IF;

  SELECT * INTO v_pay FROM public.jobs_ledger_payments WHERE id = v_case.payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'The payment is already off the job.');
  END IF;

  -- Closed first, so the payment's delete trigger leaves the case as put_back.
  UPDATE public.ar_stripe_cases
  SET closed_at = now(), closed_by = auth.uid(), closed_reason = 'put_back'
  WHERE id = v_case.id;

  SELECT coalesce(nullif(trim(u.name), ''), nullif(trim(u.email), '')) INTO v_actor_name
  FROM public.users u WHERE u.id = auth.uid();

  DELETE FROM public.jobs_ledger_payments WHERE id = v_pay.id;

  INSERT INTO public.jobs_ledger_payment_events (
    kind, payment_id, from_job_id, to_job_id, invoice_id, amount, paid_on, sent_on,
    payment_type, reference_number, note, mercury_transaction_id, sequence_order,
    reason, actor_user_id, actor_name
  ) VALUES (
    'removed', v_pay.id, v_pay.job_id, NULL, v_pay.invoice_id, v_pay.amount, v_pay.paid_on, v_pay.sent_on,
    v_pay.payment_type, v_pay.reference_number, v_pay.note, v_pay.mercury_transaction_id, v_pay.sequence_order,
    'stripe_dispute_lost: ' || v_case.stripe_object_id || coalesce(' · ' || v_case.reason, ''),
    auth.uid(), v_actor_name
  );

  SELECT coalesce(sum(amount), 0) INTO v_sum FROM public.jobs_ledger_payments WHERE job_id = v_pay.job_id;
  UPDATE public.jobs_ledger SET payments_made = v_sum, updated_at = now() WHERE id = v_pay.job_id;

  -- Stripe keeps its invoice paid and cannot collect it again: the bill drops the link and is
  -- billed again with a fresh Stripe invoice. A bill that still holds another payment stays Billed.
  IF v_pay.invoice_id IS NOT NULL THEN
    v_bill_status := CASE WHEN EXISTS (SELECT 1 FROM public.jobs_ledger_payments p WHERE p.invoice_id = v_pay.invoice_id) THEN 'billed' ELSE 'ready_to_bill' END;
    UPDATE public.jobs_ledger_invoices
    SET status = v_bill_status,
        stripe_invoice_id = NULL,
        hosted_invoice_url = NULL,
        stripe_invoice_status = NULL,
        stripe_invoice_memo = NULL,
        external_send_channel = NULL,
        external_send_note = NULL,
        sent_to_customer_at = NULL
    WHERE id = v_pay.invoice_id;
  END IF;

  SELECT jl.revenue, jl.status INTO v_rev, v_job_status FROM public.jobs_ledger jl WHERE jl.id = v_pay.job_id;
  IF coalesce(v_job_status, '') = 'paid' AND coalesce(v_rev, 0) > v_sum + 0.01 THEN
    v_status_rpc := public.update_job_status(v_pay.job_id, 'billed');
    IF v_status_rpc ? 'error' THEN
      v_warning := coalesce(v_status_rpc ->> 'error', 'Could not move the job back to Billed');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'job_id', v_pay.job_id,
    'invoice_id', v_pay.invoice_id,
    'bill_status', v_bill_status,
    'amount', v_pay.amount,
    'payments_made', v_sum,
    'warning', v_warning
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.put_back_lost_dispute_bill(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.put_back_lost_dispute_bill(uuid) TO authenticated;

COMMENT ON FUNCTION public.put_back_lost_dispute_bill(uuid) IS
  'A lost card dispute''s one press (v2.4950): the payment Stripe recorded comes off the job (a removed line, reason stripe_dispute_lost), the bill drops its Stripe link and goes back to Ready to Bill (Billed while another payment sits on it) to be billed again, a paid job goes back to Billed, and the case closes as put_back. Office roles; only an open dispute Stripe has decided against us.';

-- 6 ---------------------------------------------------------------------------------
-- The first two RETURN QUERY blocks are 20261008100000's, unchanged but for the new column (NULL);
-- the Stripe cases follow as a third.

DROP FUNCTION IF EXISTS public.list_ar_return_cases(boolean);

CREATE FUNCTION public.list_ar_return_cases(p_include_closed boolean DEFAULT false)
 RETURNS TABLE(
   mercury_transaction_id uuid,
   counterparty_name text,
   amount numeric,
   kind text,
   posted_at timestamptz,
   failed_at timestamptz,
   bank_reason text,
   source text,
   opened_at timestamptz,
   closed_at timestamptz,
   closed_reason text,
   closed_note text,
   closed_by text,
   replaced_by_mercury_transaction_id uuid,
   notified_at timestamptz,
   live_payments jsonb,
   last_job jsonb,
   recorded_payment jsonb,
   promise jsonb,
   stripe_case jsonb
 )
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'list_ar_return_cases: not authenticated';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
    ) THEN
      RAISE EXCEPTION 'list_ar_return_cases: not authorized';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.counterparty_name,
    abs(t.amount)::numeric,
    t.kind,
    t.posted_at,
    public._ar_try_timestamptz(t.raw->>'failedAt'),
    coalesce(r.bank_reason, nullif(btrim(t.raw->>'reasonForFailure'), '')),
    coalesce(r.source, CASE WHEN t.status = 'failed' THEN 'bank' ELSE 'hand' END),
    coalesce(r.opened_at, r.updated_at),
    r.closed_at,
    r.closed_reason,
    r.closed_note,
    (SELECT coalesce(nullif(u.name, ''), u.email) FROM public.users u WHERE u.id = r.closed_by),
    r.replaced_by_mercury_transaction_id,
    (SELECT n.notified_at FROM public.mercury_bank_return_notices n WHERE n.mercury_transaction_id = t.id),
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'payment_id', p.id,
               'job_id', p.job_id,
               'job_number', coalesce(nullif(j.hcp_number, ''), nullif(j.click_number, ''), ''),
               'job_name', j.job_name,
               'amount', p.amount,
               'invoice_id', p.invoice_id,
               'invoice_sequence_order', i.sequence_order,
               'invoice_status', i.status,
               'invoice_amount', i.amount,
               'stripe_bill', (nullif(btrim(coalesce(i.stripe_invoice_id, '')), '') IS NOT NULL),
               'stripe_credit_note', (nullif(btrim(coalesce(p.stripe_credit_note_id, '')), '') IS NOT NULL),
               'job_status', j.status,
               'job_revenue', j.revenue,
               'job_payments_made', j.payments_made
             ) ORDER BY p.amount DESC, p.id)
      FROM public.jobs_ledger_payments p
      LEFT JOIN public.jobs_ledger j ON j.id = p.job_id
      LEFT JOIN public.jobs_ledger_invoices i ON i.id = p.invoice_id
      WHERE p.mercury_transaction_id = t.id
    ), '[]'::jsonb),
    (
      SELECT jsonb_build_object(
               'job_id', j.id,
               'job_number', coalesce(nullif(j.hcp_number, ''), nullif(j.click_number, ''), ''),
               'job_name', j.job_name,
               'removed_at', a.deleted_at,
               'removed_by', (SELECT coalesce(nullif(u.name, ''), u.email) FROM public.users u WHERE u.id = a.deleted_by),
               'job_revenue', j.revenue,
               'job_payments_made', j.payments_made
             )
      FROM public.deleted_records_archive a
      JOIN public.jobs_ledger j ON j.id = (a.row_data->>'job_id')::uuid
      WHERE a.table_name = 'jobs_ledger_payments'
        AND a.restored_at IS NULL
        AND (a.row_data->>'mercury_transaction_id') = t.id::text
      ORDER BY a.deleted_at DESC
      LIMIT 1
    ),
    -- A payment recorded by hand that matches a check no job carries: a rejected check, or a
    -- bank return nobody linked (Peter Garza's $2,700 on #120, Jul 2025).
    CASE WHEN NOT EXISTS (SELECT 1 FROM public.jobs_ledger_payments lp WHERE lp.mercury_transaction_id = t.id) THEN (
      SELECT jsonb_build_object(
               'payment_id', p.id,
               'job_id', p.job_id,
               'job_number', coalesce(nullif(j.hcp_number, ''), nullif(j.click_number, ''), ''),
               'job_name', j.job_name,
               'amount', p.amount,
               'paid_on', p.paid_on,
               'job_revenue', j.revenue,
               'job_payments_made', j.payments_made
             )
      FROM public.jobs_ledger_payments p
      LEFT JOIN public.jobs_ledger j ON j.id = p.job_id
      WHERE p.mercury_transaction_id IS NULL
        AND p.amount > 0
        AND abs(p.amount - t.amount) < 0.005
        AND p.paid_on BETWEEN (coalesce(public._ar_try_timestamptz(t.raw->>'failedAt'), t.created_at) AT TIME ZONE 'America/Chicago')::date - CASE WHEN r.source = 'rejected' THEN 3 ELSE 14 END
                          AND (coalesce(public._ar_try_timestamptz(t.raw->>'failedAt'), t.created_at) AT TIME ZONE 'America/Chicago')::date + 10
        AND NOT EXISTS (
          SELECT 1 FROM public.deleted_records_archive a2
          WHERE a2.table_name = 'jobs_ledger_payments' AND a2.restored_at IS NULL
            AND (a2.row_data->>'mercury_transaction_id') = t.id::text
        )
      ORDER BY p.paid_on, p.id
      LIMIT 1
    ) END,
    -- The newest promise the customer made after the check came back, on any job it touched.
    (
      SELECT jsonb_build_object(
               'job_id', pp.job_id,
               'promised_date', pp.promised_date,
               'said_by', pp.said_by,
               'created_at', pp.created_at
             )
      FROM public.job_payment_promises pp
      WHERE pp.voided_at IS NULL
        AND pp.created_at > coalesce(r.opened_at, r.updated_at)
        AND pp.job_id IN (
          SELECT p.job_id FROM public.jobs_ledger_payments p WHERE p.mercury_transaction_id = t.id
          UNION
          SELECT (a.row_data->>'job_id')::uuid FROM public.deleted_records_archive a
          WHERE a.table_name = 'jobs_ledger_payments' AND a.restored_at IS NULL
            AND (a.row_data->>'mercury_transaction_id') = t.id::text
        )
      ORDER BY pp.created_at DESC
      LIMIT 1
    ),
    NULL::jsonb
  FROM public.mercury_transaction_ar_returned r
  JOIN public.mercury_transactions t ON t.id = r.mercury_transaction_id
  WHERE r.returned
    AND (p_include_closed OR r.closed_at IS NULL)
  ORDER BY coalesce(r.opened_at, r.updated_at) DESC, t.id;

  -- v2.4902: a check typed in by hand that never reached the bank. The case's id stands in for the
  -- deposit; the payment, live or as the case kept it, is the recorded payment.
  RETURN QUERY
  SELECT
    c.id,
    coalesce(
      CASE WHEN j.bill_to_party = 'gc' THEN nullif(btrim(coalesce(gcc.name, '')), '') END,
      nullif(btrim(coalesce(j.customer_name, '')), ''),
      nullif(btrim(coalesce(cc.name, '')), '')
    ),
    abs(c.amount)::numeric,
    coalesce(c.payment_type, 'check'),
    NULL::timestamptz,
    NULL::timestamptz,
    NULL::text,
    'unbanked'::text,
    c.opened_at,
    c.closed_at,
    c.closed_reason,
    c.closed_note,
    (SELECT coalesce(nullif(u.name, ''), u.email) FROM public.users u WHERE u.id = c.closed_by),
    NULL::uuid,
    c.notified_at,
    '[]'::jsonb,
    NULL::jsonb,
    jsonb_build_object(
      'payment_id', c.payment_id,
      'job_id', coalesce(p.job_id, c.job_id),
      'job_number', coalesce(nullif(j.hcp_number, ''), nullif(j.click_number, ''), ''),
      'job_name', j.job_name,
      'amount', coalesce(p.amount, c.amount),
      'paid_on', coalesce(p.paid_on, c.paid_on),
      'reference_number', c.reference_number,
      'job_revenue', j.revenue,
      'job_payments_made', j.payments_made
    ),
    NULL::jsonb,
    NULL::jsonb
  FROM public.ar_unbanked_check_cases c
  LEFT JOIN public.jobs_ledger_payments p ON p.id = c.payment_id
  LEFT JOIN public.jobs_ledger j ON j.id = coalesce(p.job_id, c.job_id)
  LEFT JOIN public.customers cc ON cc.id = j.customer_id
  LEFT JOIN public.customers gcc ON gcc.id = j.gc_customer_id
  WHERE p_include_closed OR c.closed_at IS NULL
  ORDER BY c.opened_at DESC, c.id;

  -- v2.4950: a card dispute or a failed bank debit on a Stripe bill. The case's id stands in for
  -- the deposit; what Stripe said rides in stripe_case, the payment (a dispute's) in recorded_payment.
  RETURN QUERY
  SELECT
    c.id,
    coalesce(
      CASE WHEN j.bill_to_party = 'gc' THEN nullif(btrim(coalesce(gcc.name, '')), '') END,
      nullif(btrim(coalesce(j.customer_name, '')), ''),
      nullif(btrim(coalesce(cc.name, '')), '')
    ),
    abs(c.amount)::numeric,
    CASE WHEN c.kind = 'dispute' THEN 'card' ELSE 'bank debit' END,
    NULL::timestamptz,
    c.occurred_at,
    c.reason,
    CASE WHEN c.kind = 'dispute' THEN 'stripe_dispute' ELSE 'stripe_debit' END,
    c.opened_at,
    c.closed_at,
    c.closed_reason,
    c.closed_note,
    (SELECT coalesce(nullif(u.name, ''), u.email) FROM public.users u WHERE u.id = c.closed_by),
    NULL::uuid,
    c.notified_at,
    '[]'::jsonb,
    NULL::jsonb,
    CASE WHEN p.id IS NOT NULL THEN jsonb_build_object(
      'payment_id', p.id,
      'job_id', p.job_id,
      'job_number', coalesce(nullif(j.hcp_number, ''), nullif(j.click_number, ''), ''),
      'job_name', j.job_name,
      'amount', p.amount,
      'paid_on', p.paid_on,
      'job_revenue', j.revenue,
      'job_payments_made', j.payments_made
    ) END,
    (
      SELECT jsonb_build_object(
               'job_id', pp.job_id,
               'promised_date', pp.promised_date,
               'said_by', pp.said_by,
               'created_at', pp.created_at
             )
      FROM public.job_payment_promises pp
      WHERE pp.voided_at IS NULL
        AND pp.created_at > c.opened_at
        AND pp.job_id = c.job_id
      ORDER BY pp.created_at DESC
      LIMIT 1
    ),
    jsonb_build_object(
      'kind', c.kind,
      'object_id', c.stripe_object_id,
      'mode', c.stripe_mode,
      'status', c.stripe_status,
      'due_by', c.due_by,
      'lost_at', c.lost_at,
      'lost_notified_at', c.lost_notified_at,
      'amount', c.amount,
      'invoice_id', c.invoice_id,
      'invoice_sequence_order', i.sequence_order,
      'invoice_status', i.status,
      'job_id', c.job_id,
      'job_number', coalesce(nullif(j.hcp_number, ''), nullif(j.click_number, ''), ''),
      'job_name', j.job_name,
      'job_revenue', j.revenue,
      'job_payments_made', j.payments_made,
      'payment_live', p.id IS NOT NULL
    )
  FROM public.ar_stripe_cases c
  LEFT JOIN public.jobs_ledger_payments p ON p.id = c.payment_id
  LEFT JOIN public.jobs_ledger_invoices i ON i.id = c.invoice_id
  LEFT JOIN public.jobs_ledger j ON j.id = c.job_id
  LEFT JOIN public.customers cc ON cc.id = j.customer_id
  LEFT JOIN public.customers gcc ON gcc.id = j.gc_customer_id
  WHERE p_include_closed OR c.closed_at IS NULL
  ORDER BY c.opened_at DESC, c.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_ar_return_cases(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_ar_return_cases(boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.list_ar_return_cases(boolean) IS
  'Accounts Receivable (v2.4320; unbanked cases v2.4902; Stripe cases v2.4950): every open case of a check that came back (all of them with p_include_closed) — the deposit, the bank''s reason, the case''s source and close, whether the office was told, the payments still carrying it (live_payments), the job it was on last (last_job, from deleted_records_archive) and, when no job ever carried it, the payment recorded by hand it matches (recorded_payment); promise = the newest They said… on those jobs since the check came back. Then the checks typed in by hand that never reached the bank (source unbanked, ar_unbanked_check_cases), and the card disputes and failed bank debits on Stripe bills (source stripe_dispute / stripe_debit, ar_stripe_cases; what Stripe said in stripe_case): the case''s own id in mercury_transaction_id. Dev/master/assistant/controller/primary, and the service role (the notifier).';

-- House rules: read-only training mode + the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
