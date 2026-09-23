SET lock_timeout = '3s';

-- A bounced check on a Stripe bill can be unlinked (v2.3784).
--
-- Take 5 – Seguin (JP878), 2026-09-23: a $13,680 check deposit from the GC was
-- matched to the job's first Stripe bill in Accounts Receivable on Sep 21; on
-- Sep 23 the bank returned it ("Insufficient funds"). The office needed the
-- payment off the job so the lien notice claims the whole balance, and every
-- door refused: "Unlink and remove" (this RPC) rejects any payment on a
-- Stripe-hosted bill, "Undo part payment" needs a credit note the row does not
-- carry, and "Unwind" needs a bill marked paid in Stripe. Stripe had never
-- heard of the money — the bill was still open for its full amount — so there
-- was nothing there to reverse, only the ledger row to delete.
--
-- Rule now: a payment on a Stripe-hosted bill is refused only while Stripe
-- holds a record of it — the row carries a credit note (Undo part payment
-- voids it), or the bill is marked paid in Stripe (Unwind reverses that).
-- Otherwise the row deletes as on any other bill. Every removal writes a
-- `removed` event to jobs_ledger_payment_events (the table only knew `moved`),
-- and when the bank itself says the deposit failed, the deposit is marked
-- returned in Accounts Receivable in the same call so it never re-enters
-- To match.

ALTER TABLE public.jobs_ledger_payment_events
  DROP CONSTRAINT IF EXISTS jobs_ledger_payment_events_kind_check;
ALTER TABLE public.jobs_ledger_payment_events
  ADD CONSTRAINT jobs_ledger_payment_events_kind_check CHECK (kind IN ('moved', 'removed'));

CREATE OR REPLACE FUNCTION "public"."remove_jobs_ledger_payment_and_reconcile"("p_payment_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_pay public.jobs_ledger_payments%ROWTYPE;
  v_job_id uuid;
  v_invoice_id uuid;
  v_inv_amount numeric;
  v_stripe_trim text;
  v_stripe_status text;
  v_credit_note text;
  v_bank_status text;
  v_bank_reason text;
  v_bank_failed boolean := false;
  v_marked_returned boolean := false;
  v_sum numeric;
  v_applied numeric;
  v_rev numeric;
  v_pm numeric;
  v_job_status text;
  v_status_rpc jsonb;
  v_actor_name text;
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

  SELECT p.* INTO v_pay
  FROM public.jobs_ledger_payments p
  WHERE p.id = p_payment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Payment not found');
  END IF;
  v_job_id := v_pay.job_id;
  v_invoice_id := v_pay.invoice_id;
  v_credit_note := coalesce(nullif(trim(v_pay.stripe_credit_note_id), ''), '');

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
      coalesce(nullif(trim(i.stripe_invoice_id), ''), ''),
      coalesce(nullif(trim(i.stripe_invoice_status), ''), '')
    INTO v_inv_amount, v_stripe_trim, v_stripe_status
    FROM public.jobs_ledger_invoices i
    WHERE i.id = v_invoice_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Invoice not found');
    END IF;

    -- A Stripe-hosted bill: refuse only while Stripe holds a record of this
    -- payment. Its own door reverses that record and deletes the row.
    IF length(v_stripe_trim) > 0 THEN
      IF length(v_credit_note) > 0 THEN
        RETURN jsonb_build_object(
          'error',
          'This part payment sits on the Stripe bill as a credit note — press Undo part payment on the row instead.'
        );
      END IF;
      IF v_stripe_status = 'paid' THEN
        RETURN jsonb_build_object(
          'error',
          'This bill is marked paid in Stripe — unwind the out-of-band payment on the bill first.'
        );
      END IF;
    END IF;
  END IF;

  -- What the bank says about the deposit behind this row (a returned check
  -- syncs from Mercury as status = failed with the reason in the raw payload).
  IF v_pay.mercury_transaction_id IS NOT NULL THEN
    SELECT coalesce(nullif(trim(mt.status), ''), ''), coalesce(nullif(trim(mt.raw ->> 'reasonForFailure'), ''), '')
    INTO v_bank_status, v_bank_reason
    FROM public.mercury_transactions mt
    WHERE mt.id = v_pay.mercury_transaction_id;
    v_bank_failed := coalesce(v_bank_status, '') = 'failed';
  END IF;

  DELETE FROM public.jobs_ledger_payments
  WHERE id = p_payment_id AND job_id = v_job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Payment could not be deleted');
  END IF;

  SELECT coalesce(nullif(trim(u.name), ''), nullif(trim(u.email), '')) INTO v_actor_name
  FROM public.users u WHERE u.id = auth.uid();

  INSERT INTO public.jobs_ledger_payment_events (
    kind, payment_id, from_job_id, to_job_id, invoice_id, amount, paid_on, sent_on,
    payment_type, reference_number, note, mercury_transaction_id, sequence_order,
    reason, actor_user_id, actor_name
  ) VALUES (
    'removed', v_pay.id, v_job_id, NULL, v_invoice_id, v_pay.amount, v_pay.paid_on, v_pay.sent_on,
    v_pay.payment_type, v_pay.reference_number, v_pay.note, v_pay.mercury_transaction_id, v_pay.sequence_order,
    CASE
      WHEN v_bank_failed THEN 'bank_failed' || CASE WHEN length(v_bank_reason) > 0 THEN ': ' || v_bank_reason ELSE '' END
      WHEN length(v_stripe_trim) > 0 THEN 'unlinked_stripe_bill_unrecorded'
      ELSE 'unlinked'
    END,
    auth.uid(), v_actor_name
  );

  -- The bank returned the deposit: mark it returned in Accounts Receivable so
  -- the freed money never lands in To match again.
  IF v_bank_failed THEN
    INSERT INTO public.mercury_transaction_ar_returned (mercury_transaction_id, returned, updated_at, updated_by)
    VALUES (v_pay.mercury_transaction_id, true, now(), auth.uid())
    ON CONFLICT (mercury_transaction_id) DO UPDATE
      SET returned = true, updated_at = now(), updated_by = auth.uid();
    v_marked_returned := true;
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
        'payments_made', v_sum,
        'bank_failed', v_bank_failed,
        'bank_reason', v_bank_reason,
        'marked_returned', v_marked_returned
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'payments_made', v_sum,
    'bank_failed', v_bank_failed,
    'bank_reason', v_bank_reason,
    'marked_returned', v_marked_returned
  );
END;
$$;

ALTER FUNCTION "public"."remove_jobs_ledger_payment_and_reconcile"("p_payment_id" "uuid") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."remove_jobs_ledger_payment_and_reconcile"("p_payment_id" "uuid") IS
  'Deletes one jobs_ledger_payments row and reconciles: recomputes jobs_ledger.payments_made; syncs the invoice paid/billed from its remaining payments; may move the job paid→billed via update_job_status; frees Mercury allocation capacity when mercury_transaction_id was set. A payment on a Stripe-hosted bill is refused only while Stripe holds a record of it (a credit note on the row → Undo part payment; the bill marked paid in Stripe → Unwind); otherwise it deletes like any other (v2.3784). Writes a removed event to jobs_ledger_payment_events; when the Mercury deposit behind the row has status failed (a returned check) it is marked returned in Accounts Receivable in the same call. Roles: dev/master_technician/assistant/primary with job access.';
