SET lock_timeout = '3s';

-- v2.4801 — A check on a Stripe bill holds the Stripe close.
--
-- Mark Paid · Check used to tell Stripe "paid" the moment the office typed it, and Stripe
-- never takes that back. Now the check is a ledger row only (mark_invoice_paid, the same RPC
-- a non-Stripe bill uses): the bill reads Paid here, the Stripe invoice stays open, and the
-- row moves or comes off like any hand-typed payment. The close-held-stripe-marks edge
-- function closes the Stripe invoice out of band CHECK_CLEAR_DAYS (7) after the check's
-- date; pg_cron calls it daily. Two things here:
--
--   1. move_jobs_ledger_payment learns the same rule remove_jobs_ledger_payment_and_reconcile
--      already follows: a Stripe-hosted bill's payment is refused only while Stripe holds a
--      record of it (a credit note on the row, or the bill marked paid in Stripe). A held
--      check, or a deposit matched in Accounts Receivable that Stripe never learned of, moves;
--      the bill it leaves reads Billed again when it is no longer covered (the existing
--      reconcile), and the pay link was open all along.
--   2. The daily sweep schedule.

CREATE OR REPLACE FUNCTION public.move_jobs_ledger_payment(p_payment_id uuid, p_to_job_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay public.jobs_ledger_payments%ROWTYPE;
  v_inv public.jobs_ledger_invoices%ROWTYPE;
  v_next integer;
  v_from_sum numeric;
  v_to_sum numeric;
  v_applied numeric;
  v_rev numeric;
  v_pm numeric;
  v_job_status text;
  v_status_rpc jsonb;
  v_actor_name text;
  v_warning text;
  v_stripe_hosted boolean;
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
  SELECT * INTO v_pay FROM public.jobs_ledger_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Payment not found');
  END IF;
  IF v_pay.job_id = p_to_job_id THEN
    RETURN jsonb_build_object('error', 'That payment is already on this job');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = p_to_job_id) THEN
    RETURN jsonb_build_object('error', 'Destination job not found');
  END IF;
  -- The same access rule as remove_jobs_ledger_payment_and_reconcile, on both jobs.
  IF EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id IN (v_pay.job_id, p_to_job_id)
      AND NOT (
        j.master_user_id = auth.uid()
        OR public.is_dev()
        OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
        OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
        OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
        OR public.assistants_share_master(auth.uid(), j.master_user_id)
      )
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized to update one of these jobs');
  END IF;
  IF v_pay.invoice_id IS NOT NULL THEN
    SELECT * INTO v_inv FROM public.jobs_ledger_invoices WHERE id = v_pay.invoice_id;
    IF FOUND THEN
      v_stripe_hosted := coalesce(nullif(trim(v_inv.stripe_invoice_id), ''), '') <> ''
        OR coalesce(trim(v_inv.external_send_channel), '') = 'stripe';
      IF v_stripe_hosted THEN
        -- v2.4801: refuse only while Stripe holds a record of this payment — the same two
        -- sentences remove_jobs_ledger_payment_and_reconcile answers with.
        IF coalesce(nullif(trim(v_pay.stripe_credit_note_id), ''), '') <> '' THEN
          RETURN jsonb_build_object('error', 'This part payment sits on the Stripe bill as a credit note — press Undo part payment on the row instead.');
        END IF;
        IF coalesce(nullif(trim(v_inv.stripe_invoice_status), ''), '') = 'paid' THEN
          RETURN jsonb_build_object('error', 'This bill is marked paid in Stripe — unwind the out-of-band payment on the bill first.');
        END IF;
      ELSIF v_inv.sent_to_customer_at IS NOT NULL THEN
        RETURN jsonb_build_object('error', 'A sent bill counted this payment — unlink it from the bill first.');
      END IF;
    END IF;
  END IF;

  SELECT name INTO v_actor_name FROM public.users WHERE id = auth.uid();
  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next FROM public.jobs_ledger_payments WHERE job_id = p_to_job_id;

  UPDATE public.jobs_ledger_payments
     SET job_id = p_to_job_id, sequence_order = v_next, invoice_id = NULL
   WHERE id = p_payment_id;

  INSERT INTO public.jobs_ledger_payment_events
    (kind, payment_id, from_job_id, to_job_id, amount, paid_on, sent_on, note, payment_type, reference_number, invoice_id, mercury_transaction_id, sequence_order, reason, actor_user_id, actor_name)
  VALUES
    ('moved', p_payment_id, v_pay.job_id, p_to_job_id, v_pay.amount, v_pay.paid_on, v_pay.sent_on, v_pay.note, v_pay.payment_type, v_pay.reference_number, v_pay.invoice_id, v_pay.mercury_transaction_id, v_pay.sequence_order, NULLIF(BTRIM(p_reason), ''), auth.uid(), v_actor_name);

  -- The bill it left (unsent, or a Stripe bill Stripe never closed): reconcile its status the
  -- way a removal does.
  IF v_pay.invoice_id IS NOT NULL AND v_inv.id IS NOT NULL THEN
    SELECT coalesce(sum(amount), 0) INTO v_applied FROM public.jobs_ledger_payments WHERE invoice_id = v_pay.invoice_id;
    IF v_applied + 0.0001 < coalesce(v_inv.amount, 0) THEN
      UPDATE public.jobs_ledger_invoices SET status = 'billed' WHERE id = v_pay.invoice_id AND status = 'paid';
    END IF;
  END IF;

  -- The cache trigger has recomputed both jobs; read them back for the caller.
  SELECT payments_made, revenue, status INTO v_pm, v_rev, v_job_status FROM public.jobs_ledger WHERE id = v_pay.job_id;
  v_from_sum := coalesce(v_pm, 0);
  IF coalesce(v_job_status, '') = 'paid' AND coalesce(v_rev, 0) > v_from_sum + 0.01 THEN
    v_status_rpc := public.update_job_status(v_pay.job_id, 'billed');
    IF v_status_rpc ? 'error' THEN
      v_warning := coalesce(v_status_rpc ->> 'error', 'Could not move the job it left back to Billed');
    END IF;
  END IF;
  SELECT payments_made INTO v_to_sum FROM public.jobs_ledger WHERE id = p_to_job_id;

  RETURN jsonb_strip_nulls(jsonb_build_object('ok', true, 'from_payments_made', v_from_sum, 'to_payments_made', coalesce(v_to_sum, 0), 'warning', v_warning));
END;
$$;

-- The daily sweep: pg_cron → close-held-stripe-marks with the cron secret (the
-- remind-job-contracts precedent: PROJECT_URL + CRON_SECRET from vault). 11:17 UTC is early
-- morning in the company's time zone, so a check that cleared overnight closes before the
-- office opens. Kill switch without unscheduling: app_settings key
-- held_stripe_marks_sweep_disabled_v1 = '1'. Idempotent.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'held-stripe-marks-sweep';

SELECT cron.schedule(
  'held-stripe-marks-sweep',
  '17 11 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/close-held-stripe-marks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
