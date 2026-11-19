SET lock_timeout = '3s';

-- A primary's money verbs held to the job's people (punch list #400, PR 1 of 5; to-dos/primary-job-doors.md).
-- A primary is scoped to their own jobs everywhere a policy reads (primary_scope_*, 20260823172141), and v2.5655
-- (20261019120000_primary_paid_verbs.sql) narrowed the five paid verbs. The audit of 2026-11-19 found the same hole
-- in the verbs that pass missed: each is SECURITY DEFINER with its own check, and its job check let a primary
-- through on the role alone. On a whole-schema bed a primary on no job wrote down another job's bill, moved its
-- payment to a different job and deleted the bill.
--
-- Each function below is its live definition (pg_get_functiondef on a bed that holds every migration on main at
-- aa0e5ff7f) with ONE change, named in its header line:
--   * the seven job verbs: in the job's own check, the primary clause takes `AND public.is_job_people(<the job>)`
--     (20261019060000, widened 20261108100000), the same clause v2.5655 wrote. A primary acts on the jobs they
--     account-manage, sold, or wrote the signed estimate for, and on no other.
--   * the three estimate verbs: `user_can_access_estimate(e)` says yes to any primary, and at the table the
--     restrictive primary_scope_estimates policy narrows it. These verbs run as the owner, so the same narrowing is
--     written in: a primary passes only when `primary_can_access_estimate(e.id)` does too.
-- The role gate at the top of each stays as it was. Dev, master, assistant, controller, estimator and
-- superintendent are untouched. No name, argument or returned shape changes, so the client needs nothing.
-- CREATE OR REPLACE keeps each function's grants and owner. Idempotent.

-- ---------- apply_agreed_write_down_to_billed_invoice(uuid,numeric,text): the job's check, the primary clause ----------

CREATE OR REPLACE FUNCTION public.apply_agreed_write_down_to_billed_invoice(p_invoice_id uuid, p_new_amount numeric, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
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
        OR (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary') AND public.is_job_people(j.id))
        OR public.is_office_or_estimator()
        OR public.is_office_or_estimator()
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
$function$;

-- ---------- delete_billed_invoice_on_send_back(uuid): the job's check, the primary clause ----------

CREATE OR REPLACE FUNCTION public.delete_billed_invoice_on_send_back(p_invoice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job_id uuid;
  v_status text;
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

  SELECT i.job_id, i.status INTO v_job_id, v_status
  FROM public.jobs_ledger_invoices i
  WHERE i.id = p_invoice_id;

  IF v_job_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'deleted', false);
  END IF;

  IF v_status IS DISTINCT FROM 'billed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invoice is not Billed Awaiting Payment');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.jobs_ledger_payments p WHERE p.invoice_id = p_invoice_id
  ) THEN
    RETURN jsonb_build_object(
      'ok',
      false,
      'error',
      'This invoice has recorded payments. Adjust or unlink those payments before sending back.'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs_ledger j
    WHERE j.id = v_job_id
      AND (
        j.master_user_id = auth.uid()
        OR public.is_dev()
        OR (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'primary') AND public.is_job_people(j.id))
        OR public.is_office_or_estimator()
        OR public.is_office_or_estimator()
        OR public.assistants_share_master(auth.uid(), j.master_user_id)
      )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  DELETE FROM public.jobs_ledger_invoices
  WHERE id = p_invoice_id
    AND status = 'billed'
  RETURNING id INTO v_deleted;

  IF v_deleted IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'deleted', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger_invoices WHERE id = p_invoice_id) THEN
    RETURN jsonb_build_object('ok', true, 'deleted', false);
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'Could not delete invoice');
END;
$function$;

-- ---------- delete_marked_paid_invoice_without_payment(uuid): the job's check, the primary clause ----------

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
        OR (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'primary') AND public.is_job_people(j.id))
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

-- ---------- delete_ready_to_bill_invoice(uuid): the job's check, the primary clause ----------

CREATE OR REPLACE FUNCTION public.delete_ready_to_bill_invoice(p_invoice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job_id uuid;
  v_status text;
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
        OR (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'primary') AND public.is_job_people(j.id))
        OR public.is_office_or_estimator()
        OR public.is_office_or_estimator()
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
$function$;

-- ---------- move_jobs_ledger_payment(uuid,uuid,text): the check on both jobs, the primary clause ----------

CREATE OR REPLACE FUNCTION public.move_jobs_ledger_payment(p_payment_id uuid, p_to_job_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        OR (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary') AND public.is_job_people(j.id))
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
$function$;

-- ---------- revert_stripe_oob_invoice_payment(uuid,text,text,text): the job's check, the primary clause ----------

CREATE OR REPLACE FUNCTION public.revert_stripe_oob_invoice_payment(p_invoice_id uuid, p_reason text, p_stripe_invoice_status_after text DEFAULT NULL::text, p_stripe_credit_note_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
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
      OR (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary') AND public.is_job_people(j.id))
      OR public.is_office_or_estimator()
      OR public.is_office_or_estimator()
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
$function$;

-- ---------- update_job_status(uuid,text): the paid to billed leg, the primary clause ----------

CREATE OR REPLACE FUNCTION public.update_job_status(p_job_id uuid, p_to_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_status TEXT;
  v_master_id UUID;
  v_can_update BOOLEAN := false;
  v_deleted_rtb INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT jl.status, jl.master_user_id INTO v_current_status, v_master_id
  FROM public.jobs_ledger jl
  WHERE jl.id = p_job_id;

  IF v_current_status IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  IF p_to_status = 'ready_to_bill' THEN
    IF v_current_status = 'working' THEN
      v_can_update :=
        -- Team-member path: any team member, including helpers.
        EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = p_job_id AND user_id = auth.uid())
        OR (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller'))
          AND (v_master_id = auth.uid()
            OR public.is_dev()
            OR public.is_office_or_estimator()
            OR public.is_office_or_estimator()
            OR public.assistants_share_master(auth.uid(), v_master_id)))
        OR (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
          AND EXISTS (
            SELECT 1 FROM public.jobs_ledger jl2
            JOIN public.projects p ON p.id = jl2.project_id
            WHERE jl2.id = p_job_id
              AND (EXISTS (SELECT 1 FROM public.project_superintendents WHERE project_id = p.id AND superintendent_id = auth.uid())
                OR EXISTS (SELECT 1 FROM public.master_superintendents WHERE master_id = p.master_user_id AND superintendent_id = auth.uid()))
          ));
    ELSIF v_current_status = 'billed' THEN
      v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller'))
        AND (v_master_id = auth.uid()
          OR public.is_dev()
          OR public.is_office_or_estimator()
          OR public.is_office_or_estimator()
          OR public.assistants_share_master(auth.uid(), v_master_id));
    ELSE
      RETURN jsonb_build_object('error', 'Job must be in Working or Billed to mark Ready for Billing');
    END IF;
  ELSIF p_to_status = 'billed' THEN
    IF v_current_status = 'ready_to_bill' THEN
      v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller'))
        AND (v_master_id = auth.uid()
          OR public.is_dev()
          OR public.is_office_or_estimator()
          OR public.is_office_or_estimator()
          OR public.assistants_share_master(auth.uid(), v_master_id));
    ELSIF v_current_status = 'paid' THEN
      -- Revert: paid -> billed (dev/master/assistant/primary with job access)
      v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary'))
        AND (v_master_id = auth.uid()
          OR public.is_dev()
          OR (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary') AND public.is_job_people(p_job_id))
          OR public.is_office_or_estimator()
          OR public.is_office_or_estimator()
          OR public.assistants_share_master(auth.uid(), v_master_id));
    ELSE
      RETURN jsonb_build_object('error', 'Job must be in Ready to Bill or Paid to mark as Billed');
    END IF;
  ELSIF p_to_status = 'paid' THEN
    IF v_current_status <> 'billed' THEN
      RETURN jsonb_build_object('error', 'Job must be in Billed to mark as Paid');
    END IF;
    v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller'))
      AND (v_master_id = auth.uid()
        OR public.is_dev()
        OR public.is_office_or_estimator()
        OR public.is_office_or_estimator()
        OR public.assistants_share_master(auth.uid(), v_master_id));
  ELSIF p_to_status = 'working' THEN
    IF v_current_status = 'ready_to_bill' THEN
      -- Revert: ready_to_bill -> working (office only; deletes RTB drafts below)
      v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller'))
        AND (v_master_id = auth.uid()
          OR public.is_dev()
          OR public.is_office_or_estimator()
          OR public.is_office_or_estimator()
          OR public.assistants_share_master(auth.uid(), v_master_id));
    ELSIF v_current_status = 'waiting' THEN
      -- Manual promote: waiting -> working (office only; no side effects)
      v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller'))
        AND (v_master_id = auth.uid()
          OR public.is_dev()
          OR public.is_office_or_estimator()
          OR public.is_office_or_estimator()
          OR public.assistants_share_master(auth.uid(), v_master_id));
    ELSE
      RETURN jsonb_build_object('error', 'Job must be in Ready to Bill or Waiting to move to Working');
    END IF;
  ELSIF p_to_status = 'waiting' THEN
    -- Send back: working -> waiting (office only; no side effects)
    IF v_current_status <> 'working' THEN
      RETURN jsonb_build_object('error', 'Job must be in Working to send back to Waiting');
    END IF;
    v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller'))
      AND (v_master_id = auth.uid()
        OR public.is_dev()
        OR public.is_office_or_estimator()
        OR public.is_office_or_estimator()
        OR public.assistants_share_master(auth.uid(), v_master_id));
  ELSE
    RETURN jsonb_build_object('error', 'Invalid status');
  END IF;

  IF NOT v_can_update THEN
    RETURN jsonb_build_object('error', 'Not authorized to update job status');
  END IF;

  IF p_to_status = 'working' AND v_current_status = 'ready_to_bill' THEN
    DELETE FROM public.jobs_ledger_invoices
    WHERE job_id = p_job_id
      AND status = 'ready_to_bill';
    GET DIAGNOSTICS v_deleted_rtb = ROW_COUNT;
  END IF;

  UPDATE public.jobs_ledger SET status = p_to_status, updated_at = NOW() WHERE id = p_job_id;

  -- Event logging moved to the jobs_ledger_log_status_transition trigger
  -- (v2.1435 single-writer rule) — do NOT reintroduce an INSERT here.

  RETURN jsonb_build_object('ok', true, 'deleted_ready_to_bill_invoices', v_deleted_rtb);
END;
$function$;

-- ---------- apply_estimate_to_job(uuid,uuid,jsonb): the estimate's check, a primary held to their own estimates ----------

CREATE OR REPLACE FUNCTION public.apply_estimate_to_job(p_estimate_id uuid, p_job_ledger_id uuid, p_fixtures jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  e public.estimates%ROWTYPE;
  j public.jobs_ledger%ROWTYPE;
  fixture_el jsonb;
  fname text;
  fcount numeric;
  fprice numeric(12, 2);
  fdesc text;
  fseq int;
  v_seq_base int := 0;
  v_fixture_inserts int := 0;
  v_net numeric(12, 2) := 0;
  v_row_ext numeric(12, 2);
  v_len int;
  idx int;
  v_doc_label text;
  v_amount_label text;
  v_body text;
BEGIN
  SELECT * INTO e FROM public.estimates WHERE id = p_estimate_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'estimate not found';
  END IF;

  -- Idempotent: already applied/linked → return the existing link.
  IF e.job_ledger_id IS NOT NULL THEN
    RETURN e.job_ledger_id;
  END IF;

  IF e.status IS DISTINCT FROM 'customer_accepted' THEN
    RAISE EXCEPTION 'estimate must be customer_accepted';
  END IF;

  IF NOT (
    (public.user_can_access_estimate(e) AND (NOT public.is_primary() OR public.primary_can_access_estimate(e.id)))
    OR public.superintendent_can_access_estimate(e)
  ) THEN
    RAISE EXCEPTION 'not authorized to apply this estimate';
  END IF;

  SELECT * INTO j FROM public.jobs_ledger WHERE id = p_job_ledger_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job not found';
  END IF;

  -- one company (v2.2967): a change order applies to any job the caller can reach; no owner guard.

  SELECT COALESCE(MAX(f.sequence_order) + 1, 0)
  INTO v_seq_base
  FROM public.jobs_ledger_fixtures f
  WHERE f.job_id = p_job_ledger_id;

  IF p_fixtures IS NOT NULL AND jsonb_typeof(p_fixtures) = 'array' THEN
    v_len := jsonb_array_length(p_fixtures);
    idx := 0;
    WHILE idx < v_len LOOP
      BEGIN
        fixture_el := p_fixtures->idx;
        idx := idx + 1;

        fname := NULLIF(trim(COALESCE(fixture_el->>'name', '')), '');
        IF fname IS NULL THEN
          CONTINUE;
        END IF;

        fcount := NULL;
        IF fixture_el ? 'count' AND fixture_el->>'count' IS NOT NULL AND btrim(fixture_el->>'count') != '' THEN
          fcount := (fixture_el->>'count')::numeric;
        END IF;
        IF fcount IS NULL OR fcount <= 0 THEN
          fcount := 1;
        END IF;

        fprice := NULL;
        IF fixture_el ? 'line_unit_price' AND fixture_el->>'line_unit_price' IS NOT NULL AND btrim(fixture_el->>'line_unit_price') != '' THEN
          fprice := round((fixture_el->>'line_unit_price')::numeric, 2);
        END IF;

        fdesc := NULLIF(trim(COALESCE(fixture_el->>'line_description', '')), '');

        fseq := 0;
        IF fixture_el ? 'sequence_order' AND fixture_el->>'sequence_order' IS NOT NULL AND btrim(fixture_el->>'sequence_order') != '' THEN
          fseq := (fixture_el->>'sequence_order')::int;
        END IF;

        INSERT INTO public.jobs_ledger_fixtures (
          job_id,
          name,
          count,
          line_unit_price,
          line_description,
          sequence_order
        ) VALUES (
          p_job_ledger_id,
          fname,
          fcount,
          fprice,
          fdesc,
          v_seq_base + fseq
        );

        v_fixture_inserts := v_fixture_inserts + 1;
        v_row_ext := round(fcount * COALESCE(fprice, 0::numeric), 2);
        v_net := round(v_net + v_row_ext, 2);
      EXCEPTION
        WHEN OTHERS THEN
          CONTINUE;
      END;
    END LOOP;
  END IF;

  -- No usable line items → the accepted total IS the net.
  IF v_fixture_inserts = 0 THEN
    v_net := round(COALESCE(e.total_cents, 0)::numeric / 100.0, 2);
  END IF;

  UPDATE public.jobs_ledger
  SET revenue = round(COALESCE(revenue, 0::numeric) + v_net, 2)
  WHERE id = p_job_ledger_id;

  UPDATE public.estimates
  SET job_ledger_id = p_job_ledger_id
  WHERE id = p_estimate_id
    AND job_ledger_id IS NULL;

  -- Best-effort activity note; never fails the apply.
  BEGIN
    v_doc_label := CASE WHEN e.doc_kind = 'change_order' THEN 'Change order' ELSE 'Estimate' END;
    v_amount_label := CASE WHEN v_net < 0 THEN '-$' ELSE '+$' END
      || to_char(abs(v_net), 'FM999,999,990.00');
    v_body := v_doc_label || ' #' || e.estimate_number::text || ' applied: ' || v_amount_label
      || CASE
           WHEN NULLIF(trim(COALESCE(e.change_order_fields->>'description_of_change', '')), '') IS NOT NULL
             THEN ' — ' || trim(e.change_order_fields->>'description_of_change')
           WHEN NULLIF(trim(COALESCE(e.title, '')), '') IS NOT NULL
             THEN ' — ' || trim(e.title)
           ELSE ''
         END;
    v_body := left(v_body, 2000);
    INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body)
    VALUES (p_job_ledger_id, auth.uid(), v_body);
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  RETURN p_job_ledger_id;
END;
$function$;

-- ---------- create_job_from_estimate(uuid,text,text,text,numeric,uuid): the estimate's check, a primary held to their own estimates ----------

CREATE OR REPLACE FUNCTION public.create_job_from_estimate(p_estimate_id uuid, p_hcp_number text, p_job_name text DEFAULT NULL::text, p_job_address text DEFAULT NULL::text, p_revenue numeric DEFAULT NULL::numeric, p_customer_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  e public.estimates%ROWTYPE;
  v_master uuid;
  v_override text;
  v_job_id uuid;
  v_link_rows int;
  v_existing_link uuid;
  v_hcp text;
  v_cust_id uuid;
  v_cust_name text;
  v_cust_email text;
  v_cust_phone text;
  j_name text;
  j_addr text;
  rev numeric(12, 2);
  crec RECORD;
  ci jsonb;
  v_service_type_id uuid;
BEGIN
  SELECT st.id INTO v_service_type_id
  FROM public.service_types st
  WHERE st.name = 'Plumbing'
  LIMIT 1;
  IF v_service_type_id IS NULL THEN
    RAISE EXCEPTION 'service_types missing Plumbing row';
  END IF;

  v_hcp := trim(COALESCE(p_hcp_number, ''));
  IF v_hcp = '' THEN
    RAISE EXCEPTION 'hcp_number is required';
  END IF;

  SELECT * INTO e FROM public.estimates WHERE id = p_estimate_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'estimate not found';
  END IF;

  IF e.job_ledger_id IS NOT NULL THEN
    RETURN e.job_ledger_id;
  END IF;

  IF e.status IS DISTINCT FROM 'customer_accepted' THEN
    RAISE EXCEPTION 'estimate must be customer_accepted';
  END IF;

  IF NOT (
    (public.user_can_access_estimate(e) AND (NOT public.is_primary() OR public.primary_can_access_estimate(e.id)))
    OR public.superintendent_can_access_estimate(e)
  ) THEN
    RAISE EXCEPTION 'not authorized to create job for this estimate';
  END IF;

  IF e.project_id IS NOT NULL THEN
    SELECT p.master_user_id INTO v_master FROM public.projects p WHERE p.id = e.project_id;
    IF v_master IS NULL THEN
      RAISE EXCEPTION 'project not found';
    END IF;
  ELSE
    -- one company (v2.2967): every new job is stamped with the company owner account
    -- (app_settings.company_owner_user_id, seeded by 20260906190000). The personal
    -- job_owner_override_<uid> chain only runs while that row is unset.
    v_master := public.company_owner_user_id();
    IF v_master IS NULL THEN
      SELECT s.value_text INTO v_override
      FROM public.app_settings s
      WHERE s.key = 'job_owner_override_' || auth.uid()::text;
      IF v_override IS NULL OR trim(v_override) = '' THEN
        SELECT s.value_text INTO v_override
        FROM public.app_settings s
        WHERE s.key = 'job_owner_override_default';
      END IF;
      IF v_override IS NOT NULL AND trim(v_override) != '' THEN
        v_master := trim(v_override)::uuid;
      ELSE
        v_master := auth.uid();
      END IF;
    END IF;
  END IF;

  v_cust_id := COALESCE(p_customer_id, e.customer_id);

  IF v_cust_id IS NOT NULL THEN
    SELECT c.name, c.contact_info, c.master_user_id
    INTO crec
    FROM public.customers c
    WHERE c.id = v_cust_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'customer not found';
    END IF;
    -- one company (v2.2967): the customer may sit under any office account; no owner guard.
    v_cust_name := crec.name;
    ci := COALESCE(crec.contact_info::jsonb, '{}'::jsonb);
    v_cust_email := NULLIF(trim(ci->>'email'), '');
    v_cust_phone := NULLIF(trim(ci->>'phone'), '');
  ELSE
    v_cust_name := NULL;
    v_cust_email := NULLIF(trim(COALESCE(e.customer_email, '')), '');
    v_cust_phone := NULL;
  END IF;

  j_name := COALESCE(NULLIF(trim(p_job_name), ''), NULLIF(trim(e.title), ''), '');
  j_addr := COALESCE(
    NULLIF(trim(p_job_address), ''),
    NULLIF(trim(e.for_address), ''),
    ''
  );
  rev := COALESCE(p_revenue, (e.total_cents::numeric / 100.0));

  INSERT INTO public.jobs_ledger (
    master_user_id,
    hcp_number,
    job_name,
    job_address,
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    project_id,
    revenue,
    payments_made,
    service_type_id
  ) VALUES (
    v_master,
    v_hcp,
    j_name,
    j_addr,
    v_cust_id,
    v_cust_name,
    v_cust_email,
    v_cust_phone,
    e.project_id,
    rev,
    0,
    v_service_type_id
  )
  RETURNING id INTO v_job_id;

  UPDATE public.estimates
  SET job_ledger_id = v_job_id
  WHERE id = e.id AND job_ledger_id IS NULL;
  GET DIAGNOSTICS v_link_rows = ROW_COUNT;
  IF v_link_rows = 0 THEN
    SELECT el.job_ledger_id INTO v_existing_link FROM public.estimates el WHERE el.id = e.id;
    IF v_existing_link IS NOT NULL THEN
      DELETE FROM public.jobs_ledger WHERE id = v_job_id;
      RETURN v_existing_link;
    END IF;
    RAISE EXCEPTION 'could not link estimate to job';
  END IF;

  RETURN v_job_id;
END;
$function$;

-- ---------- create_job_from_estimate(uuid,text,text,text,numeric,uuid,jsonb): the estimate's check, a primary held to their own estimates ----------

CREATE OR REPLACE FUNCTION public.create_job_from_estimate(p_estimate_id uuid, p_hcp_number text, p_job_name text DEFAULT NULL::text, p_job_address text DEFAULT NULL::text, p_revenue numeric DEFAULT NULL::numeric, p_customer_id uuid DEFAULT NULL::uuid, p_fixtures jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  e public.estimates%ROWTYPE;
  v_master uuid;
  v_override text;
  v_job_id uuid;
  v_link_rows int;
  v_existing_link uuid;
  v_hcp text;
  v_cust_id uuid;
  v_cust_name text;
  v_cust_email text;
  v_cust_phone text;
  j_name text;
  j_addr text;
  rev numeric(12, 2);
  crec RECORD;
  ci jsonb;
  fname text;
  fcount numeric;
  fprice numeric(12, 2);
  fdesc text;
  fseq int;
  v_fixture_inserts int := 0;
  v_fixture_rev numeric(12, 2) := 0;
  v_row_ext numeric(12, 2);
  fixture_el jsonb;
  idx int;
  v_len int;
  v_service_type_id uuid;
BEGIN
  SELECT st.id INTO v_service_type_id
  FROM public.service_types st
  WHERE st.name = 'Plumbing'
  LIMIT 1;
  IF v_service_type_id IS NULL THEN
    RAISE EXCEPTION 'service_types missing Plumbing row';
  END IF;

  v_hcp := trim(COALESCE(p_hcp_number, ''));
  IF v_hcp = '' THEN
    RAISE EXCEPTION 'hcp_number is required';
  END IF;

  SELECT * INTO e FROM public.estimates WHERE id = p_estimate_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'estimate not found';
  END IF;

  IF e.job_ledger_id IS NOT NULL THEN
    RETURN e.job_ledger_id;
  END IF;

  IF e.status IS DISTINCT FROM 'customer_accepted' THEN
    RAISE EXCEPTION 'estimate must be customer_accepted';
  END IF;

  IF NOT (
    (public.user_can_access_estimate(e) AND (NOT public.is_primary() OR public.primary_can_access_estimate(e.id)))
    OR public.superintendent_can_access_estimate(e)
  ) THEN
    RAISE EXCEPTION 'not authorized to create job for this estimate';
  END IF;

  IF e.project_id IS NOT NULL THEN
    SELECT p.master_user_id INTO v_master FROM public.projects p WHERE p.id = e.project_id;
    IF v_master IS NULL THEN
      RAISE EXCEPTION 'project not found';
    END IF;
  ELSE
    -- one company (v2.2967): every new job is stamped with the company owner account
    -- (app_settings.company_owner_user_id, seeded by 20260906190000). The personal
    -- job_owner_override_<uid> chain only runs while that row is unset.
    v_master := public.company_owner_user_id();
    IF v_master IS NULL THEN
      SELECT s.value_text INTO v_override
      FROM public.app_settings s
      WHERE s.key = 'job_owner_override_' || auth.uid()::text;
      IF v_override IS NULL OR trim(v_override) = '' THEN
        SELECT s.value_text INTO v_override
        FROM public.app_settings s
        WHERE s.key = 'job_owner_override_default';
      END IF;
      IF v_override IS NOT NULL AND trim(v_override) != '' THEN
        v_master := trim(v_override)::uuid;
      ELSE
        v_master := auth.uid();
      END IF;
    END IF;
  END IF;

  v_cust_id := COALESCE(p_customer_id, e.customer_id);

  IF v_cust_id IS NOT NULL THEN
    SELECT c.name, c.contact_info, c.master_user_id
    INTO crec
    FROM public.customers c
    WHERE c.id = v_cust_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'customer not found';
    END IF;
    -- one company (v2.2967): the customer may sit under any office account; no owner guard.
    v_cust_name := crec.name;
    ci := COALESCE(crec.contact_info::jsonb, '{}'::jsonb);
    v_cust_email := NULLIF(trim(ci->>'email'), '');
    v_cust_phone := NULLIF(trim(ci->>'phone'), '');
  ELSE
    v_cust_name := NULL;
    v_cust_email := NULLIF(trim(COALESCE(e.customer_email, '')), '');
    v_cust_phone := NULL;
  END IF;

  j_name := COALESCE(NULLIF(trim(p_job_name), ''), NULLIF(trim(e.title), ''), '');
  j_addr := COALESCE(
    NULLIF(trim(p_job_address), ''),
    NULLIF(trim(e.for_address), ''),
    ''
  );
  rev := COALESCE(p_revenue, (e.total_cents::numeric / 100.0));

  INSERT INTO public.jobs_ledger (
    master_user_id,
    hcp_number,
    job_name,
    job_address,
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    project_id,
    revenue,
    payments_made,
    service_type_id
  ) VALUES (
    v_master,
    v_hcp,
    j_name,
    j_addr,
    v_cust_id,
    v_cust_name,
    v_cust_email,
    v_cust_phone,
    e.project_id,
    rev,
    0,
    v_service_type_id
  )
  RETURNING id INTO v_job_id;

  UPDATE public.estimates
  SET job_ledger_id = v_job_id
  WHERE id = e.id AND job_ledger_id IS NULL;
  GET DIAGNOSTICS v_link_rows = ROW_COUNT;
  IF v_link_rows = 0 THEN
    SELECT el.job_ledger_id INTO v_existing_link FROM public.estimates el WHERE el.id = e.id;
    IF v_existing_link IS NOT NULL THEN
      DELETE FROM public.jobs_ledger WHERE id = v_job_id;
      RETURN v_existing_link;
    END IF;
    RAISE EXCEPTION 'could not link estimate to job';
  END IF;

  IF p_fixtures IS NOT NULL AND jsonb_typeof(p_fixtures) = 'array' THEN
    v_len := jsonb_array_length(p_fixtures);
    IF v_len IS NOT NULL AND v_len > 0 THEN
      FOR idx IN 0 .. v_len - 1 LOOP
        fixture_el := p_fixtures->idx;
        BEGIN
          fname := NULLIF(trim(COALESCE(fixture_el->>'name', '')), '');
          IF fname IS NULL OR fname = '' THEN
            CONTINUE;
          END IF;

          fcount := 1;
          IF fixture_el ? 'count' AND fixture_el->>'count' IS NOT NULL AND btrim(fixture_el->>'count') != '' THEN
            fcount := (fixture_el->>'count')::numeric;
          END IF;
          IF fcount IS NULL OR fcount <= 0 THEN
            fcount := 1;
          END IF;

          fprice := NULL;
          IF fixture_el ? 'line_unit_price' AND fixture_el->>'line_unit_price' IS NOT NULL AND btrim(fixture_el->>'line_unit_price') != '' THEN
            fprice := round((fixture_el->>'line_unit_price')::numeric, 2);
          END IF;

          fdesc := NULLIF(trim(COALESCE(fixture_el->>'line_description', '')), '');

          fseq := 0;
          IF fixture_el ? 'sequence_order' AND fixture_el->>'sequence_order' IS NOT NULL AND btrim(fixture_el->>'sequence_order') != '' THEN
            fseq := (fixture_el->>'sequence_order')::int;
          END IF;

          INSERT INTO public.jobs_ledger_fixtures (
            job_id,
            name,
            count,
            line_unit_price,
            line_description,
            sequence_order
          ) VALUES (
            v_job_id,
            fname,
            fcount,
            fprice,
            fdesc,
            fseq
          );

          v_fixture_inserts := v_fixture_inserts + 1;
          v_row_ext := round(fcount * COALESCE(fprice, 0::numeric), 2);
          v_fixture_rev := round(v_fixture_rev + v_row_ext, 2);
        EXCEPTION
          WHEN OTHERS THEN
            CONTINUE;
        END;
      END LOOP;
    END IF;
  END IF;

  IF v_fixture_inserts > 0 THEN
    UPDATE public.jobs_ledger
    SET revenue = v_fixture_rev
    WHERE id = v_job_id;
  END IF;

  RETURN v_job_id;
END;
$function$;

