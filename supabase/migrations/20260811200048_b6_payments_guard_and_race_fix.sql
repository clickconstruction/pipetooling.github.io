SET lock_timeout = '3s';

-- B6 (FRAGILITY_REMEDIATION_PLAN.md): payments_made hard guard + the race
-- fix its gate audit surfaced, + repair of the two affected jobs.
--
-- INCIDENT (2026-08-11 audit; events 2026-08-04 and 2026-08-08): jobs #921
-- and #925 each carried TWO identical Stripe payment rows (same invoice,
-- amount, paid_on, sequence_order 0) created milliseconds apart, with
-- payments_made at exactly HALF the row sum. Vector, two races stacked:
--   1. Stripe delivers BOTH invoice.paid and invoice.payment_succeeded for
--      one payment (distinct event ids — the webhook dedupe passes both);
--      two concurrent mark_invoice_paid_from_stripe calls each computed
--      "remaining" before the other's insert committed → duplicate rows.
--   2. The B3 recompute trigger summed with a pre-insert statement snapshot:
--      each transaction's sum saw only its OWN row, and the loser's stale sum
--      overwrote the winner's — payments_made = half the doubled rows.
-- The stored payments_made values were coincidentally the TRUE amounts (the
-- single real payments); the ROW sums were doubled, so row-derived surfaces
-- (invoice remaining, Edit Job payment lists) showed doubles.
--
-- Fixes, in order:
--   1. recompute trigger: lock the jobs_ledger row BEFORE summing (post-lock
--      SELECT gets a fresh READ COMMITTED snapshot that sees the concurrent
--      committed row), and mark its UPDATE with a transaction-local GUC.
--   2. guard trigger: any other UPDATE that changes payments_made is
--      rejected — the column is derived (B3); write payment rows instead.
--   3. row locks (SELECT ... FOR UPDATE) in all five payment RPCs so
--      concurrent recorders serialize per target row: the second dual-event
--      webhook call now waits, then sees status 'paid' / remaining 0 and
--      exits without a second row.
--   4. repair: delete the later duplicate row of each pair (ids below).
--      The fixed trigger recomputes; payments_made value is unchanged
--      (it was already the true amount).

-- ---------------------------------------------------------------------------
-- 1) Race-fixed recompute (replaces 20260730174929's body)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.recompute_jobs_ledger_payments_made_tr()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job_id uuid;
  v_sum numeric;
BEGIN
  v_job_id := COALESCE(NEW.job_id, OLD.job_id);
  IF v_job_id IS NOT NULL THEN
    -- B6: serialize concurrent recomputes for the same job. Locking first
    -- means the sum below is computed AFTER any concurrent writer commits.
    PERFORM 1 FROM public.jobs_ledger WHERE id = v_job_id FOR UPDATE;
    SELECT COALESCE(SUM(amount), 0) INTO v_sum
    FROM public.jobs_ledger_payments WHERE job_id = v_job_id;
    PERFORM set_config('pipetooling.payments_recompute', '1', true);
    UPDATE public.jobs_ledger
       SET payments_made = v_sum
     WHERE id = v_job_id
       AND payments_made IS DISTINCT FROM v_sum;
    PERFORM set_config('pipetooling.payments_recompute', '', true);
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.job_id IS DISTINCT FROM OLD.job_id AND OLD.job_id IS NOT NULL THEN
    PERFORM 1 FROM public.jobs_ledger WHERE id = OLD.job_id FOR UPDATE;
    SELECT COALESCE(SUM(amount), 0) INTO v_sum
    FROM public.jobs_ledger_payments WHERE job_id = OLD.job_id;
    PERFORM set_config('pipetooling.payments_recompute', '1', true);
    UPDATE public.jobs_ledger
       SET payments_made = v_sum
     WHERE id = OLD.job_id
       AND payments_made IS DISTINCT FROM v_sum;
    PERFORM set_config('pipetooling.payments_recompute', '', true);
  END IF;
  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) The hard guard: payments_made is derived; nothing else may change it.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.jobs_ledger_guard_payments_made()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.payments_made IS DISTINCT FROM OLD.payments_made
     AND COALESCE(current_setting('pipetooling.payments_recompute', true), '') <> '1' THEN
    RAISE EXCEPTION 'jobs_ledger.payments_made is derived from jobs_ledger_payments (B3/B6, docs/FRAGILITY_REMEDIATION_PLAN.md) — insert/update/delete payment rows instead of writing this column';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_ledger_payments_made_guard ON public.jobs_ledger;
CREATE TRIGGER jobs_ledger_payments_made_guard
  BEFORE UPDATE OF payments_made ON public.jobs_ledger
  FOR EACH ROW EXECUTE FUNCTION public.jobs_ledger_guard_payments_made();

-- ---------------------------------------------------------------------------
-- 3) Row locks in the four B3-current RPCs (bodies byte-identical to
--    20260730174929 except the added FOR UPDATE). apply_mercury_bank_
--    payment_allocations (redefined by 20260801020903) follows below.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."mark_invoice_paid"("p_invoice_id" "uuid", "p_amount" numeric DEFAULT NULL::numeric, "p_paid_on" "date" DEFAULT NULL::"date", "p_note" "text" DEFAULT NULL::"text", "p_payment_type" "text" DEFAULT NULL::"text", "p_reference_number" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invoice RECORD;
  v_next_order INTEGER;
  v_applied NUMERIC;
  v_remaining NUMERIC;
  v_apply NUMERIC;
  v_pt TEXT;
  v_ref TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT id, job_id, amount, status INTO v_invoice
  FROM public.jobs_ledger_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;

  IF v_invoice.status <> 'billed' THEN
    RETURN jsonb_build_object('error', 'Invoice must be in Billed status to mark as paid');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary')
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = v_invoice.job_id
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

  SELECT COALESCE(SUM(amount), 0) INTO v_applied
  FROM public.jobs_ledger_payments
  WHERE invoice_id = p_invoice_id;

  v_remaining := COALESCE(v_invoice.amount, 0) - v_applied;

  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object('error', 'Invoice already fully paid');
  END IF;

  v_apply := COALESCE(p_amount, v_remaining);

  IF v_apply <= 0 THEN
    RETURN jsonb_build_object('error', 'Amount must be positive');
  END IF;

  IF v_apply > v_remaining THEN
    RETURN jsonb_build_object('error', 'Amount exceeds remaining balance on invoice');
  END IF;

  v_pt := NULLIF(trim(COALESCE(p_payment_type, '')), '');
  v_ref := NULLIF(trim(COALESCE(p_reference_number, '')), '');

  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next_order
  FROM public.jobs_ledger_payments
  WHERE job_id = v_invoice.job_id;

  INSERT INTO public.jobs_ledger_payments (
    job_id,
    amount,
    sequence_order,
    paid_on,
    note,
    invoice_id,
    payment_type,
    reference_number
  )
  VALUES (
    v_invoice.job_id,
    v_apply,
    v_next_order,
    COALESCE(p_paid_on, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date),
    NULLIF(trim(COALESCE(p_note, '')), ''),
    p_invoice_id,
    v_pt,
    v_ref
  );

  -- B3: payments_made is trigger-maintained (already includes this payment).
  UPDATE public.jobs_ledger
  SET status = CASE
        WHEN COALESCE(revenue, 0) <= COALESCE(payments_made, 0) THEN 'paid'
        ELSE status
      END,
      updated_at = NOW()
  WHERE id = v_invoice.job_id;

  IF (v_applied + v_apply) >= COALESCE(v_invoice.amount, 0) THEN
    UPDATE public.jobs_ledger_invoices
    SET status = 'paid'
    WHERE id = p_invoice_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION "public"."mark_invoice_paid_from_stripe"("p_invoice_id" "uuid", "p_payment_type" "text" DEFAULT NULL::"text", "p_reference_number" "text" DEFAULT NULL::"text", "p_paid_on" "date" DEFAULT NULL::"date", "p_internal_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invoice RECORD;
  v_next_order INTEGER;
  v_applied NUMERIC;
  v_remaining NUMERIC;
  v_paid_on DATE;
  v_pt TEXT;
  v_ref TEXT;
  v_note TEXT;
  v_row_note TEXT;
BEGIN
  -- B6: FOR UPDATE serializes the dual-event webhook race (invoice.paid +
  -- invoice.payment_succeeded) — the second call waits, then exits on the
  -- 'paid' / remaining<=0 checks instead of inserting a duplicate row.
  SELECT id, job_id, amount, status INTO v_invoice
  FROM public.jobs_ledger_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;

  IF v_invoice.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF v_invoice.status <> 'billed' THEN
    RETURN jsonb_build_object('error', 'Invoice must be in Billed status to mark as paid');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_applied
  FROM public.jobs_ledger_payments
  WHERE invoice_id = p_invoice_id;

  v_remaining := COALESCE(v_invoice.amount, 0) - v_applied;

  IF v_remaining <= 0 THEN
    UPDATE public.jobs_ledger_invoices SET status = 'paid' WHERE id = p_invoice_id;
    RETURN jsonb_build_object('ok', true);
  END IF;

  v_paid_on := COALESCE(p_paid_on, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date);
  v_pt := NULLIF(trim(COALESCE(p_payment_type, '')), '');
  v_ref := NULLIF(trim(COALESCE(p_reference_number, '')), '');
  v_note := NULLIF(trim(COALESCE(p_internal_note, '')), '');

  IF v_pt IS NULL AND v_ref IS NULL AND v_note IS NULL THEN
    v_row_note := 'Stripe';
  ELSE
    v_row_note := v_note;
  END IF;

  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next_order
  FROM public.jobs_ledger_payments
  WHERE job_id = v_invoice.job_id;

  INSERT INTO public.jobs_ledger_payments (
    job_id,
    amount,
    sequence_order,
    paid_on,
    note,
    invoice_id,
    payment_type,
    reference_number
  )
  VALUES (
    v_invoice.job_id,
    v_remaining,
    v_next_order,
    v_paid_on,
    v_row_note,
    p_invoice_id,
    v_pt,
    v_ref
  );

  -- B3: payments_made is trigger-maintained (already includes this payment).
  UPDATE public.jobs_ledger
  SET status = CASE
        WHEN COALESCE(revenue, 0) <= COALESCE(payments_made, 0) THEN 'paid'
        ELSE status
      END,
      updated_at = NOW()
  WHERE id = v_invoice.job_id;

  UPDATE public.jobs_ledger_invoices
  SET status = 'paid'
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION "public"."mark_job_paid"("p_job_id" "uuid", "p_paid_on" "date" DEFAULT NULL::"date", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_job RECORD;
  v_remaining NUMERIC;
  v_next_order INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT id, revenue, payments_made, status INTO v_job
  FROM public.jobs_ledger WHERE id = p_job_id FOR UPDATE;

  IF v_job.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  IF v_job.status <> 'billed' THEN
    RETURN jsonb_build_object('error', 'Job must be in Billed status to mark as paid');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary')
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = p_job_id
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

  v_remaining := COALESCE(v_job.revenue, 0) - COALESCE(v_job.payments_made, 0);

  IF v_remaining <= 0 THEN
    UPDATE public.jobs_ledger SET status = 'paid', updated_at = NOW() WHERE id = p_job_id;
    RETURN jsonb_build_object('ok', true);
  END IF;

  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next_order
  FROM public.jobs_ledger_payments WHERE job_id = p_job_id;

  INSERT INTO public.jobs_ledger_payments (job_id, amount, sequence_order, paid_on, note)
  VALUES (
    p_job_id,
    v_remaining,
    v_next_order,
    COALESCE(p_paid_on, CURRENT_DATE),
    NULLIF(TRIM(COALESCE(p_note, '')), '')
  );

  -- B3: payments_made is trigger-maintained.
  UPDATE public.jobs_ledger
  SET status = 'paid',
      updated_at = NOW()
  WHERE id = p_job_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION "public"."mark_job_paid"("p_job_id" "uuid", "p_amount" numeric DEFAULT NULL::numeric, "p_paid_on" "date" DEFAULT NULL::"date", "p_note" "text" DEFAULT NULL::"text", "p_payment_type" "text" DEFAULT NULL::"text", "p_reference_number" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_job RECORD;
  v_remaining NUMERIC;
  v_next_order INTEGER;
  v_apply NUMERIC;
  v_pt TEXT;
  v_ref TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT id, revenue, payments_made, status INTO v_job
  FROM public.jobs_ledger WHERE id = p_job_id FOR UPDATE;

  IF v_job.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  IF v_job.status <> 'billed' THEN
    RETURN jsonb_build_object('error', 'Job must be in Billed status to mark as paid');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary')
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = p_job_id
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

  v_remaining := COALESCE(v_job.revenue, 0) - COALESCE(v_job.payments_made, 0);

  IF v_remaining <= 0 THEN
    UPDATE public.jobs_ledger SET status = 'paid', updated_at = NOW() WHERE id = p_job_id;
    RETURN jsonb_build_object('ok', true);
  END IF;

  v_apply := COALESCE(p_amount, v_remaining);

  IF v_apply <= 0 THEN
    RETURN jsonb_build_object('error', 'Amount must be positive');
  END IF;

  IF v_apply > v_remaining THEN
    RETURN jsonb_build_object('error', 'Amount exceeds remaining balance on job');
  END IF;

  v_pt := NULLIF(trim(COALESCE(p_payment_type, '')), '');
  v_ref := NULLIF(trim(COALESCE(p_reference_number, '')), '');

  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next_order
  FROM public.jobs_ledger_payments WHERE job_id = p_job_id;

  INSERT INTO public.jobs_ledger_payments (
    job_id,
    amount,
    sequence_order,
    paid_on,
    note,
    invoice_id,
    payment_type,
    reference_number
  )
  VALUES (
    p_job_id,
    v_apply,
    v_next_order,
    COALESCE(p_paid_on, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date),
    NULLIF(trim(COALESCE(p_note, '')), ''),
    NULL,
    v_pt,
    v_ref
  );

  -- B3: payments_made is trigger-maintained (already includes this payment).
  UPDATE public.jobs_ledger
  SET status = CASE
        WHEN COALESCE(revenue, 0) <= COALESCE(payments_made, 0) THEN 'paid'
        ELSE status
      END,
      updated_at = NOW()
  WHERE id = p_job_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- apply_mercury_bank_payment_allocations — body from 20260801020903 (the
-- current definition, AR-link aware) with three added locks: the Mercury
-- transaction row (serializes per-deposit), and the validation-loop
-- invoice/job rows.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."apply_mercury_bank_payment_allocations"("p_mercury_transaction_id" "uuid", "p_paid_on" "date", "p_payment_type" "text", "p_note" "text", "p_allocations" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_mt RECORD;
  v_consumed numeric;
  v_cap numeric;
  v_new_total numeric;
  v_elem jsonb;
  v_invoice_id uuid;
  v_job_id uuid;
  v_payment_id uuid;
  v_amt numeric;
  v_inv RECORD;
  v_job RECORD;
  v_pay RECORD;
  v_applied numeric;
  v_rem numeric;
  v_next_order integer;
  v_pt text;
  v_note text;
  v_ref text;
  v_inv_rem jsonb := '{}'::jsonb;
  v_job_rem jsonb := '{}'::jsonb;
  v_seen_payments jsonb := '{}'::jsonb;
  v_rows integer;
  rem_key text;
  rem_val numeric;
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

  IF p_mercury_transaction_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Mercury transaction required');
  END IF;

  IF p_allocations IS NULL OR jsonb_typeof(p_allocations) <> 'array' OR jsonb_array_length(p_allocations) = 0 THEN
    RETURN jsonb_build_object('error', 'At least one allocation is required');
  END IF;

  SELECT id, amount, mercury_id INTO v_mt
  FROM public.mercury_transactions
  WHERE id = p_mercury_transaction_id
  FOR UPDATE;

  IF v_mt.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Mercury transaction not found');
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_consumed
  FROM public.jobs_ledger_payments
  WHERE mercury_transaction_id = p_mercury_transaction_id;

  v_cap := abs(coalesce(v_mt.amount, 0)) - v_consumed;
  IF v_cap <= 0 THEN
    RETURN jsonb_build_object('error', 'No remaining amount on this bank transaction');
  END IF;

  v_new_total := 0;
  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_allocations)
  LOOP
    IF v_elem ? 'payment_id' AND nullif(trim(v_elem->>'payment_id'), '') IS NOT NULL THEN
      v_payment_id := (v_elem->>'payment_id')::uuid;
      IF v_seen_payments ? v_payment_id::text THEN
        RETURN jsonb_build_object('error', 'The same recorded payment is listed twice');
      END IF;
      v_seen_payments := v_seen_payments || jsonb_build_object(v_payment_id::text, true);

      SELECT p.id, p.job_id, p.amount, p.mercury_transaction_id, p.note, p.invoice_id
      INTO v_pay
      FROM public.jobs_ledger_payments p
      WHERE p.id = v_payment_id;

      IF v_pay.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Recorded payment not found');
      END IF;
      IF v_pay.mercury_transaction_id IS NOT NULL THEN
        RETURN jsonb_build_object('error', 'Recorded payment is already linked to a bank transaction');
      END IF;
      IF lower(coalesce(trim(v_pay.note), '')) = 'stripe' THEN
        RETURN jsonb_build_object('error', 'Stripe payments cannot be linked through Bank Payments');
      END IF;
      IF v_pay.invoice_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.jobs_ledger_invoices i
        WHERE i.id = v_pay.invoice_id
          AND coalesce(trim(i.stripe_invoice_id), '') <> ''
      ) THEN
        RETURN jsonb_build_object('error', 'Stripe-hosted invoice payments cannot be linked through Bank Payments');
      END IF;
      IF coalesce(v_pay.amount, 0) <= 0 THEN
        RETURN jsonb_build_object('error', 'Recorded payment must have a positive amount');
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.jobs_ledger j
        WHERE j.id = v_pay.job_id
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

      v_new_total := v_new_total + v_pay.amount;
    ELSE
      v_amt := (v_elem->>'amount')::numeric;
      IF v_amt IS NULL OR v_amt <= 0 THEN
        RETURN jsonb_build_object('error', 'Each allocation needs a positive amount');
      END IF;
      v_new_total := v_new_total + v_amt;
    END IF;
  END LOOP;

  IF v_new_total > v_cap + 0.01 THEN
    RETURN jsonb_build_object('error', 'Allocations exceed remaining on bank transaction');
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_allocations)
  LOOP
    IF v_elem ? 'payment_id' AND nullif(trim(v_elem->>'payment_id'), '') IS NOT NULL THEN
      CONTINUE;
    END IF;
    v_amt := (v_elem->>'amount')::numeric;
    IF v_elem ? 'invoice_id' AND nullif(trim(v_elem->>'invoice_id'), '') IS NOT NULL THEN
      v_invoice_id := (v_elem->>'invoice_id')::uuid;
      v_job_id := NULL;
    ELSIF v_elem ? 'job_id' AND nullif(trim(v_elem->>'job_id'), '') IS NOT NULL THEN
      v_job_id := (v_elem->>'job_id')::uuid;
      v_invoice_id := NULL;
    ELSE
      RETURN jsonb_build_object('error', 'Each allocation needs invoice_id, job_id, or payment_id');
    END IF;

    IF v_invoice_id IS NOT NULL THEN
      SELECT i.id, i.job_id, i.amount, i.status, i.stripe_invoice_id
      INTO v_inv
      FROM public.jobs_ledger_invoices i
      WHERE i.id = v_invoice_id
      FOR UPDATE;

      IF v_inv.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Invoice not found');
      END IF;
      IF v_inv.status <> 'billed' THEN
        RETURN jsonb_build_object('error', 'Invoice must be billed');
      END IF;
      IF coalesce(trim(v_inv.stripe_invoice_id), '') <> '' THEN
        RETURN jsonb_build_object('error', 'Stripe-hosted invoices cannot use Bank Payments');
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.jobs_ledger j
        WHERE j.id = v_inv.job_id
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

      rem_key := v_invoice_id::text;
      IF NOT (v_inv_rem ? rem_key) THEN
        SELECT coalesce(sum(amount), 0) INTO v_applied
        FROM public.jobs_ledger_payments
        WHERE invoice_id = v_invoice_id;
        v_rem := coalesce(v_inv.amount, 0) - v_applied;
        v_inv_rem := v_inv_rem || jsonb_build_object(rem_key, v_rem);
      END IF;
      rem_val := (v_inv_rem->>rem_key)::numeric;
      IF v_amt > rem_val + 0.0001 THEN
        RETURN jsonb_build_object('error', 'Amount exceeds remaining on invoice');
      END IF;
      v_inv_rem := jsonb_set(v_inv_rem, ARRAY[rem_key], to_jsonb(rem_val - v_amt));

    ELSE
      SELECT id, revenue, payments_made, status INTO v_job
      FROM public.jobs_ledger WHERE id = v_job_id FOR UPDATE;

      IF v_job.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Job not found');
      END IF;
      IF v_job.status <> 'billed' THEN
        RETURN jsonb_build_object('error', 'Job must be in Billed status');
      END IF;

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

      rem_key := v_job_id::text;
      IF NOT (v_job_rem ? rem_key) THEN
        v_rem := coalesce(v_job.revenue, 0) - coalesce(v_job.payments_made, 0);
        v_job_rem := v_job_rem || jsonb_build_object(rem_key, v_rem);
      END IF;
      rem_val := (v_job_rem->>rem_key)::numeric;
      IF v_amt > rem_val + 0.0001 THEN
        RETURN jsonb_build_object('error', 'Amount exceeds remaining on job');
      END IF;
      v_job_rem := jsonb_set(v_job_rem, ARRAY[rem_key], to_jsonb(rem_val - v_amt));
    END IF;
  END LOOP;

  v_pt := nullif(trim(coalesce(p_payment_type, '')), '');
  v_note := nullif(trim(coalesce(p_note, '')), '');
  v_ref := nullif(trim(v_mt.mercury_id::text), '');

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_allocations)
  LOOP
    IF v_elem ? 'payment_id' AND nullif(trim(v_elem->>'payment_id'), '') IS NOT NULL THEN
      v_payment_id := (v_elem->>'payment_id')::uuid;

      UPDATE public.jobs_ledger_payments
      SET mercury_transaction_id = p_mercury_transaction_id,
          reference_number = coalesce(nullif(trim(reference_number), ''), v_ref)
      WHERE id = v_payment_id
        AND mercury_transaction_id IS NULL;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      IF v_rows = 0 THEN
        RAISE EXCEPTION 'Recorded payment was linked by someone else — refresh and try again';
      END IF;
      CONTINUE;
    END IF;

    v_amt := (v_elem->>'amount')::numeric;
    IF v_elem ? 'invoice_id' AND nullif(trim(v_elem->>'invoice_id'), '') IS NOT NULL THEN
      v_invoice_id := (v_elem->>'invoice_id')::uuid;
      SELECT id, job_id, amount, status INTO v_inv
      FROM public.jobs_ledger_invoices
      WHERE id = v_invoice_id;

      SELECT coalesce(max(sequence_order), -1) + 1 INTO v_next_order
      FROM public.jobs_ledger_payments
      WHERE job_id = v_inv.job_id;

      INSERT INTO public.jobs_ledger_payments (
        job_id,
        amount,
        sequence_order,
        paid_on,
        note,
        invoice_id,
        payment_type,
        reference_number,
        mercury_transaction_id
      ) VALUES (
        v_inv.job_id,
        v_amt,
        v_next_order,
        coalesce(p_paid_on, (current_timestamp at time zone 'utc')::date),
        v_note,
        v_invoice_id,
        v_pt,
        v_ref,
        p_mercury_transaction_id
      );

      SELECT coalesce(sum(amount), 0) INTO v_applied
      FROM public.jobs_ledger_payments
      WHERE invoice_id = v_invoice_id;

      -- B3: payments_made is trigger-maintained (already includes this
      -- allocation); the CASE reads it directly.
      UPDATE public.jobs_ledger
      SET status = CASE
            WHEN coalesce(revenue, 0) <= coalesce(payments_made, 0) THEN 'paid'
            ELSE status
          END,
          updated_at = now()
      WHERE id = v_inv.job_id;

      IF v_applied >= coalesce(v_inv.amount, 0) - 0.0001 THEN
        UPDATE public.jobs_ledger_invoices
        SET status = 'paid'
        WHERE id = v_invoice_id;
      END IF;

    ELSE
      v_job_id := (v_elem->>'job_id')::uuid;
      SELECT id, revenue, payments_made, status INTO v_job
      FROM public.jobs_ledger WHERE id = v_job_id FOR UPDATE;

      SELECT coalesce(max(sequence_order), -1) + 1 INTO v_next_order
      FROM public.jobs_ledger_payments
      WHERE job_id = v_job_id;

      INSERT INTO public.jobs_ledger_payments (
        job_id,
        amount,
        sequence_order,
        paid_on,
        note,
        invoice_id,
        payment_type,
        reference_number,
        mercury_transaction_id
      ) VALUES (
        v_job_id,
        v_amt,
        v_next_order,
        coalesce(p_paid_on, (current_timestamp at time zone 'utc')::date),
        v_note,
        NULL,
        v_pt,
        v_ref,
        p_mercury_transaction_id
      );

      -- B3: payments_made is trigger-maintained.
      UPDATE public.jobs_ledger
      SET status = CASE
            WHEN coalesce(revenue, 0) <= coalesce(payments_made, 0) THEN 'paid'
            ELSE status
          END,
          updated_at = now()
      WHERE id = v_job_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Repair: remove the later duplicate row of each 2026-08 webhook-race pair.
--    Idempotent (WHERE id IN). The fixed trigger recomputes payments_made;
--    both values are unchanged (they already equal the true single payments).
--    Job #925 keeps f3a3da6c…; job #921 keeps e7925640….
-- ---------------------------------------------------------------------------

DELETE FROM public.jobs_ledger_payments
 WHERE id IN (
   '8cbc2a24-b6f3-4579-a1ae-173de899be71',  -- job #925 duplicate ($1,175.00)
   'a7c5368b-7e7b-4201-96bf-d67ab805d856'   -- job #921 duplicate ($355.80)
 );

-- No CREATE TABLE in this migration, so the read-only sweep calls are not
-- required. CREATE OR REPLACE preserves existing ACLs (incl. the A0 revokes).
