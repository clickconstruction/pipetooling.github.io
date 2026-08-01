SET lock_timeout = '3s';

-- Jobs -> Stages -> Accounts Receivable: allocation lines can now target an
-- EXISTING recorded payment (Edit Job -> Payments received) instead of a billed
-- line (v2.1191). Linking stamps jobs_ledger_payments.mercury_transaction_id on
-- the chosen row -- no new payment is created, totals do not change, and the
-- deposit's consumed/remaining math picks the row up automatically (consumed is
-- already SUM(payments WHERE mercury_transaction_id = tx)).

-- 1) Candidate list: recorded payments not yet linked to any Mercury
-- transaction and with no Stripe provenance (Stripe-hosted invoice payments
-- must reconcile through Stripe flows). LANGUAGE sql with a role-gate WHERE
-- (zero rows for unauthorized/anon) so the client can fail soft before this
-- migration is pushed. 180-day paid_on window (Chicago), capped at 500 rows.
CREATE OR REPLACE FUNCTION "public"."list_unlinked_payments_for_bank_payments"()
RETURNS TABLE(
  "payment_id" "uuid",
  "job_id" "uuid",
  "amount" numeric,
  "paid_on" "date",
  "note" "text",
  "payment_type" "text",
  "reference_number" "text",
  "invoice_id" "uuid",
  "hcp_number" "text",
  "click_number" "text",
  "job_name" "text"
)
LANGUAGE "sql" STABLE SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
  SELECT
    p.id,
    p.job_id,
    p.amount::numeric,
    p.paid_on,
    p.note,
    p.payment_type,
    p.reference_number,
    p.invoice_id,
    j.hcp_number,
    j.click_number,
    j.job_name
  FROM public.jobs_ledger_payments p
  JOIN public.jobs_ledger j ON j.id = p.job_id
  LEFT JOIN public.jobs_ledger_invoices i ON i.id = p.invoice_id
  WHERE EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant', 'primary')
    )
    AND p.mercury_transaction_id IS NULL
    AND coalesce(trim(i.stripe_invoice_id), '') = ''
    AND lower(coalesce(trim(p.note), '')) <> 'stripe'
    AND coalesce(p.amount, 0) > 0
    AND (
      p.paid_on IS NULL
      OR p.paid_on >= ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Chicago')::date - 180)
    )
  ORDER BY p.paid_on DESC NULLS LAST, p.id DESC
  LIMIT 500;
$$;

COMMENT ON FUNCTION "public"."list_unlinked_payments_for_bank_payments"() IS
  'AR modal (v2.1191): recorded jobs_ledger_payments rows eligible to be linked to a Mercury deposit — unlinked, non-Stripe (no stripe invoice, note <> Stripe), positive amount, paid_on within 180 Chicago days. Zero rows for roles outside dev/master/assistant/primary.';

GRANT ALL ON FUNCTION "public"."list_unlinked_payments_for_bank_payments"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_unlinked_payments_for_bank_payments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_unlinked_payments_for_bank_payments"() TO "service_role";

-- 2) apply_mercury_bank_payment_allocations: allocations may now carry
-- { payment_id } entries alongside { invoice_id | job_id, amount }. Payment
-- entries use the ROW's amount (client amount ignored), require the row to be
-- unlinked + non-Stripe + on an accessible job, count toward the deposit cap,
-- and are applied as an UPDATE stamping mercury_transaction_id (+ the Mercury
-- id as reference when the row has none). No status or payments_made changes —
-- the payment already existed. Invoice/job branches are byte-faithful to
-- 20260730174929 (B3: payments_made is trigger-maintained).
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
  WHERE id = p_mercury_transaction_id;

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
      WHERE i.id = v_invoice_id;

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
      FROM public.jobs_ledger WHERE id = v_job_id;

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
      FROM public.jobs_ledger WHERE id = v_job_id;

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

COMMENT ON FUNCTION "public"."apply_mercury_bank_payment_allocations"("uuid", "date", "text", "text", "jsonb") IS
  'AR modal apply. Allocations: {invoice_id|job_id, amount} create payment rows against billed non-Stripe targets (baseline behavior); {payment_id} entries (v2.1191) LINK an existing unlinked non-Stripe payment row by stamping mercury_transaction_id (row amount counts toward the deposit cap; no totals/status change). Dev/master/assistant/primary + job access.';
