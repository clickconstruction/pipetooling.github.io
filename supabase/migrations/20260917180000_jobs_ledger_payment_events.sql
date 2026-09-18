SET lock_timeout = '3s';

-- Customer payments: move one to the right job, with a trace (v2.3576, PR 3 of the payment
-- move/remove train — Taunya, 2026-09-17: "delete a payment that was applied to the wrong
-- job"; v2.3562 did the sub sheets, this does Edit Job → Payments received).
--
-- Until now a customer payment on the wrong job could only be removed and retyped. This adds a
-- ledger of what happened to a payment row — today only 'moved' (from_job_id → to_job_id) — and
-- one function that does the move in one statement. The live row keeps its id, amount, dates,
-- memo, type, reference and its bank-deposit link (mercury_transaction_id), so Accounts
-- Receivable still reads the deposit as applied — on the new job. The two cache triggers
-- already cover a job_id change: recompute_jobs_ledger_payments_made_tr recomputes both jobs
-- (B3), and the AR income label keys on mercury_transaction_id, which does not change.
--
-- The rule worth keeping: a payment a SENT bill already counted does not move. The customer was
-- told a number, so the unlink-from-bill path comes first. A payment applied to an UNSENT bill
-- moves and is unlinked from it (the bill belongs to the job it leaves), with that bill's status
-- reconciled the way remove_jobs_ledger_payment_and_reconcile does. Stripe-hosted bills never
-- move here (Stripe reversal flows own them).

CREATE TABLE IF NOT EXISTS public.jobs_ledger_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  -- The live row this event is about.
  payment_id uuid,
  -- moved: the job it left → the job it went to.
  from_job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  to_job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  -- Snapshot of the payment at the time.
  amount numeric(12,2) NOT NULL,
  paid_on date,
  sent_on date,
  note text,
  payment_type text,
  reference_number text,
  -- The unsent bill it was unlinked from on the way out, if any.
  invoice_id uuid,
  mercury_transaction_id text,
  sequence_order integer,
  reason text,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jobs_ledger_payment_events_kind_check CHECK (kind IN ('moved'))
);

CREATE INDEX IF NOT EXISTS jobs_ledger_payment_events_from_idx ON public.jobs_ledger_payment_events (from_job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_ledger_payment_events_to_idx ON public.jobs_ledger_payment_events (to_job_id, created_at DESC);

COMMENT ON TABLE public.jobs_ledger_payment_events IS
  'v2.3576: what happened to a customer payment row — moved (from_job_id → to_job_id) with a snapshot, who and why. Both jobs'' Payments received tables draw the grey trace line from it.';

ALTER TABLE public.jobs_ledger_payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Office staff can read job payment events" ON public.jobs_ledger_payment_events;
CREATE POLICY "Office staff can read job payment events" ON public.jobs_ledger_payment_events FOR SELECT
  USING (public.is_office_staff());
DROP POLICY IF EXISTS "Office staff can write job payment events" ON public.jobs_ledger_payment_events;
CREATE POLICY "Office staff can write job payment events" ON public.jobs_ledger_payment_events FOR INSERT
  WITH CHECK (public.is_office_staff());

-- Move a customer payment to another job in one statement. Returns jsonb like
-- remove_jobs_ledger_payment_and_reconcile: {error} on refusal, {ok, from_payments_made,
-- to_payments_made, warning?} on success. SECURITY DEFINER with the same job-access check as
-- that function, applied to BOTH jobs.
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
      IF coalesce(nullif(trim(v_inv.stripe_invoice_id), ''), '') <> '' OR coalesce(trim(v_inv.external_send_channel), '') = 'stripe' THEN
        RETURN jsonb_build_object('error', 'Stripe-hosted bill payments cannot be moved here; use Stripe reversal flows.');
      END IF;
      IF v_inv.sent_to_customer_at IS NOT NULL THEN
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

  -- The unsent bill it left: reconcile its status the way a removal does.
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

REVOKE ALL ON FUNCTION public.move_jobs_ledger_payment(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_jobs_ledger_payment(uuid, uuid, text) TO authenticated;

-- House rules: read-only training mode + the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
