SET lock_timeout = '3s';

-- Controller access, batch 4 of the audit (to-dos/controller-access.md): the money actions.
--
-- Each function is its live definition (pg_get_functiondef, read 2026-09-27) with 'controller'
-- named beside 'assistant' in its role check, and nothing else changed. CREATE OR REPLACE keeps
-- each function's grants, owner and comment.

-- apply_agreed_write_down_to_billed_invoice(p_invoice_id uuid, p_new_amount numeric, p_note text)
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
        OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
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

-- apply_mercury_bank_payment_allocations(p_mercury_transaction_id uuid, p_paid_on date, p_payment_type text, p_note text, p_allocations jsonb, p_allow_stripe_hosted boolean)
CREATE OR REPLACE FUNCTION public.apply_mercury_bank_payment_allocations(p_mercury_transaction_id uuid, p_paid_on date, p_payment_type text, p_note text, p_allocations jsonb, p_allow_stripe_hosted boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
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
      IF v_pay.invoice_id IS NOT NULL AND NOT coalesce(p_allow_stripe_hosted, false) AND EXISTS (
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
          OR public.is_office_or_estimator()
          OR public.is_office_or_estimator()
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
      IF coalesce(trim(v_inv.stripe_invoice_id), '') <> '' AND NOT coalesce(p_allow_stripe_hosted, false) THEN
        RETURN jsonb_build_object('error', 'Stripe-hosted invoices cannot use Bank Payments');
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.jobs_ledger j
        WHERE j.id = v_inv.job_id
        AND (
          j.master_user_id = auth.uid()
          OR public.is_dev()
          OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
          OR public.is_office_or_estimator()
          OR public.is_office_or_estimator()
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
          OR public.is_office_or_estimator()
          OR public.is_office_or_estimator()
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
$function$;

-- approve_collect_payment_for_terminal(p_job_id uuid, p_jobs_ledger_invoice_id uuid, p_dispatch_notes text)
CREATE OR REPLACE FUNCTION public.approve_collect_payment_for_terminal(p_job_id uuid, p_jobs_ledger_invoice_id uuid, p_dispatch_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_inv RECORD;
  v_flow RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = v_uid;
  IF v_role IS NULL OR v_role NOT IN ('dev', 'master_technician', 'assistant', 'controller') THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT * INTO v_flow FROM public.job_collect_payment_flows WHERE job_id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_flow.status IS DISTINCT FROM 'pending_dispatch' THEN
    RETURN jsonb_build_object('error', 'No pending collect payment request for this job.');
  END IF;

  SELECT i.id, i.job_id, i.status, i.stripe_invoice_id
  INTO v_inv
  FROM public.jobs_ledger_invoices i
  INNER JOIN public.jobs_ledger j ON j.id = i.job_id
  WHERE i.id = p_jobs_ledger_invoice_id
    AND i.job_id = p_job_id
    AND i.status = 'billed'
    AND i.stripe_invoice_id IS NOT NULL
    AND trim(i.stripe_invoice_id) <> ''
    AND (
      j.master_user_id = v_uid
      OR public.is_dev()
      OR v_role IN ('assistant', 'controller', 'master_technician')
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = v_uid AND assistant_id = j.master_user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = j.master_user_id AND assistant_id = v_uid
      )
      OR public.assistants_share_master(v_uid, j.master_user_id)
    );

  IF v_inv.id IS NULL THEN
    RETURN jsonb_build_object(
      'error',
      'Invoice must be Billed with a Stripe invoice id, and you must have job access.'
    );
  END IF;

  UPDATE public.job_collect_payment_flows
  SET
    status = 'approved_for_terminal',
    jobs_ledger_invoice_id = v_inv.id,
    stripe_invoice_id = trim(v_inv.stripe_invoice_id),
    dispatch_reviewed_at = now(),
    dispatch_reviewed_by = v_uid,
    dispatch_notes = NULLIF(trim(COALESCE(p_dispatch_notes, '')), ''),
    stripe_payment_intent_id = NULL,
    last_error = NULL
  WHERE job_id = p_job_id;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'approved_for_terminal',
    'stripe_invoice_id', trim(v_inv.stripe_invoice_id),
    'jobs_ledger_invoice_id', v_inv.id
  );
END;
$function$;

-- clear_mercury_transaction_duplicate(p_id uuid)
CREATE OR REPLACE FUNCTION public.clear_mercury_transaction_duplicate(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'clear_mercury_transaction_duplicate: not authenticated';
  end if;
  if not exists (
    select 1 from public.users u
    where u.id = uid and u.role in ('dev', 'master_technician', 'assistant', 'controller')
  ) then
    raise exception 'clear_mercury_transaction_duplicate: not authorized';
  end if;
  update public.mercury_transactions
    set duplicate_of_transaction_id = null
    where id = p_id;
end;
$function$;

-- count_mercury_transactions_for_bank_payments(p_filter jsonb)
CREATE OR REPLACE FUNCTION public.count_mercury_transactions_for_bank_payments(p_filter jsonb DEFAULT NULL::jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_kinds text[] := array[]::text[];
  v_account_ids text[] := array[]::text[];
  v_debit_ids text[] := array[]::text[];
  v_start_ymd text;
  v_exclude_cp text[] := array[]::text[];
  v_exclude_note text[] := array[]::text[];
  v_include_hidden boolean := false;
  o jsonb;
  v_count bigint;
begin
  if auth.uid() is null then
    raise exception 'count_mercury_transactions_for_bank_payments: not authenticated';
  end if;

  if not exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role in ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  ) then
    raise exception 'count_mercury_transactions_for_bank_payments: not authorized';
  end if;

  if p_filter is not null and jsonb_typeof(p_filter) = 'object' then
    o := p_filter;
    if o ? 'kinds' and jsonb_typeof(o->'kinds') = 'array' then
      select coalesce(array_agg(value::text), array[]::text[])
      into v_kinds
      from jsonb_array_elements_text(o->'kinds');
    end if;
    if o ? 'accountIds' and jsonb_typeof(o->'accountIds') = 'array' then
      select coalesce(array_agg(value::text), array[]::text[])
      into v_account_ids
      from jsonb_array_elements_text(o->'accountIds');
    end if;
    if o ? 'debitCardIds' and jsonb_typeof(o->'debitCardIds') = 'array' then
      select coalesce(array_agg(lower(trim(value::text))), array[]::text[])
      into v_debit_ids
      from jsonb_array_elements_text(o->'debitCardIds');
    end if;
    if o ? 'startDateYmd' and jsonb_typeof(o->'startDateYmd') = 'string' then
      v_start_ymd := trim(o->>'startDateYmd');
    end if;
    if o ? 'excludeCounterpartyContains' and jsonb_typeof(o->'excludeCounterpartyContains') = 'array' then
      with elements as (
        select left(btrim(value), 120) as p
        from jsonb_array_elements_text(o->'excludeCounterpartyContains')
        where length(btrim(value)) > 0
        limit 50
      )
      select coalesce(array_agg(p order by p), array[]::text[])
      into v_exclude_cp
      from elements;
    end if;
    if o ? 'excludeNoteContains' and jsonb_typeof(o->'excludeNoteContains') = 'array' then
      with elements as (
        select left(btrim(value), 120) as p
        from jsonb_array_elements_text(o->'excludeNoteContains')
        where length(btrim(value)) > 0
        limit 50
      )
      select coalesce(array_agg(p order by p), array[]::text[])
      into v_exclude_note
      from elements;
    end if;
    if o ? 'includeHiddenArDeposits' and jsonb_typeof(o->'includeHiddenArDeposits') = 'boolean' then
      v_include_hidden := (o->>'includeHiddenArDeposits')::boolean;
    elsif o ? 'includeFullyApplied' and jsonb_typeof(o->'includeFullyApplied') = 'boolean' then
      v_include_hidden := (o->>'includeFullyApplied')::boolean;
    end if;
  end if;

  if v_start_ymd is null or v_start_ymd !~ '^\d{4}-\d{2}-\d{2}$' then
    v_start_ymd := to_char((current_timestamp at time zone 'America/Chicago')::date - 90, 'YYYY-MM-DD');
  end if;

  select count(*)::bigint
  into v_count
  from public.mercury_transactions t
  where t.posted_at is not null
    and t.duplicate_of_transaction_id is null
    and to_char((t.posted_at at time zone 'America/Chicago')::date, 'YYYY-MM-DD') >= v_start_ymd
    and (cardinality(v_kinds) = 0 or t.kind = any (v_kinds))
    and (cardinality(v_account_ids) = 0 or t.mercury_account_id::text = any (v_account_ids))
    and (
      cardinality(v_debit_ids) = 0
      or public._mercury_raw_debit_card_id_lower(t.raw) = any (v_debit_ids)
    )
    and abs(t.amount) > 0
    and (
      v_include_hidden
      or (
        abs(t.amount) - coalesce((
          select sum(p.amount)
          from public.jobs_ledger_payments p
          where p.mercury_transaction_id = t.id
        ), 0)
      ) > 0.0005
    )
    and (
      v_include_hidden
      or not exists (
        select 1
        from public.mercury_transaction_ar_returned r2
        where r2.mercury_transaction_id = t.id
          and r2.returned
      )
    )
    and (
      v_include_hidden
      or not exists (
        select 1
        from public.mercury_transaction_ar_closed c2
        where c2.mercury_transaction_id = t.id
      )
    )
    and not (
      cardinality(v_exclude_cp) > 0
      and exists (
        select 1
        from unnest(v_exclude_cp) as x(pat)
        where position(lower(x.pat) in lower(coalesce(t.counterparty_name, ''))) > 0
      )
    )
    and not (
      cardinality(v_exclude_note) > 0
      and exists (
        select 1
        from unnest(v_exclude_note) as x(pat)
        where position(lower(x.pat) in lower(coalesce(t.note, ''))) > 0
      )
    );

  return coalesce(v_count, 0);
end;
$function$;

-- create_hazmat_fee_incident(p_job_id uuid, p_amount numeric, p_incident jsonb)
CREATE OR REPLACE FUNCTION public.create_hazmat_fee_incident(p_job_id uuid, p_amount numeric, p_incident jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
  v_master_id UUID;
  v_can_update BOOLEAN := false;
  v_amount NUMERIC;
  v_description TEXT;
  v_tos TEXT;
  v_incident_at TIMESTAMPTZ;
  v_inv_id UUID;
  v_incident_id UUID;
  v_mode TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  v_amount := round(p_amount, 2);
  IF v_amount IS NULL OR v_amount <= 0 OR v_amount > 100000 THEN
    RETURN jsonb_build_object('error', 'Amount must be between $0.01 and $100,000');
  END IF;

  v_description := btrim(coalesce(p_incident->>'description', ''));
  IF v_description = '' THEN
    RETURN jsonb_build_object('error', 'Describe the incident');
  END IF;
  v_tos := btrim(coalesce(p_incident->>'tos_clause_snapshot', ''));
  IF v_tos = '' THEN
    RETURN jsonb_build_object('error', 'Missing terms-of-service clause snapshot');
  END IF;
  IF jsonb_typeof(coalesce(p_incident->'photo_links', 'null'::jsonb)) <> 'array'
     OR jsonb_array_length(p_incident->'photo_links') < 1 THEN
    RETURN jsonb_build_object('error', 'At least one photo link is required');
  END IF;
  IF jsonb_typeof(coalesce(p_incident->'testimonials', 'null'::jsonb)) <> 'array'
     OR jsonb_array_length(p_incident->'testimonials') < 1 THEN
    RETURN jsonb_build_object('error', 'At least one technician testimonial is required');
  END IF;
  v_incident_at := coalesce((p_incident->>'incident_at')::timestamptz, now());

  SELECT jl.status, jl.master_user_id
    INTO v_status, v_master_id
  FROM public.jobs_ledger jl
  WHERE jl.id = p_job_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  -- Same office gate as create_turnaway_trip_charge; no job-status restriction —
  -- the fee bills with (or independently of) the main job.
  v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller'))
    AND (v_master_id = auth.uid()
      OR public.is_dev()
      OR public.is_office_or_estimator()
      OR public.is_office_or_estimator()
      OR public.assistants_share_master(auth.uid(), v_master_id));

  IF NOT v_can_update THEN
    RETURN jsonb_build_object('error', 'Not authorized to create a hazmat fee');
  END IF;

  -- Fold into the job's open, never-sent primary bill when one exists. FOR
  -- UPDATE serializes against concurrent billing of the same row.
  SELECT id INTO v_inv_id
  FROM public.jobs_ledger_invoices
  WHERE job_id = p_job_id
    AND is_primary_rtb_bundle = true
    AND status IN ('draft', 'ready_to_bill')
    AND COALESCE(btrim(stripe_invoice_id), '') = ''
    AND sent_to_customer_at IS NULL
  ORDER BY sequence_order
  LIMIT 1
  FOR UPDATE;

  IF v_inv_id IS NOT NULL THEN
    UPDATE public.jobs_ledger_invoices
    SET amount = COALESCE(amount, 0) + v_amount
    WHERE id = v_inv_id;
    v_mode := 'folded_into_primary';
  ELSE
    -- No open primary: create NO invoice (v2.1031). The revenue bump below
    -- carries the fee in the job's billable remainder; the incident stays
    -- unlinked until the next primary bill goes out (client repoints it then).
    v_inv_id := NULL;
    v_mode := 'job_total';
  END IF;

  -- Bump revenue so ensure_single_ready_to_bill_invoice_for_job's unallocated
  -- math stays invariant (same rationale as the trip charge).
  UPDATE public.jobs_ledger
  SET revenue = COALESCE(revenue, 0) + v_amount,
      updated_at = NOW()
  WHERE id = p_job_id;

  INSERT INTO public.job_hazmat_incidents
    (job_id, created_by, incident_at, description, exposed_people, stage_label,
     photo_links, testimonials, tos_clause_snapshot, fee_amount, invoice_id)
  VALUES
    (p_job_id, auth.uid(), v_incident_at, v_description,
     coalesce(p_incident->>'exposed_people', ''),
     nullif(btrim(coalesce(p_incident->>'stage_label', '')), ''),
     coalesce(p_incident->'photo_links', '[]'::jsonb),
     coalesce(p_incident->'testimonials', '[]'::jsonb),
     v_tos, v_amount, v_inv_id)
  RETURNING id INTO v_incident_id;

  RETURN jsonb_build_object(
    'ok', true,
    'incident_id', v_incident_id,
    'invoice_id', v_inv_id,
    'amount', v_amount,
    'mode', v_mode
  );
END;
$function$;

-- create_turnaway_trip_charge(p_job_id uuid, p_amount numeric, p_reason text, p_dispatch_request_id uuid)
CREATE OR REPLACE FUNCTION public.create_turnaway_trip_charge(p_job_id uuid, p_amount numeric, p_reason text, p_dispatch_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
  v_master_id UUID;
  v_can_update BOOLEAN := false;
  v_amount NUMERIC;
  v_reason_label TEXT;
  v_memo TEXT;
  v_dispatch_status TEXT;
  v_seq INT;
  v_inv_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- 'other' turnaways have no billable category; the modal requires picking one.
  IF p_reason = 'client_not_home' THEN
    v_reason_label := 'client not home';
  ELSIF p_reason = 'site_not_ready' THEN
    v_reason_label := 'site not ready';
  ELSE
    RETURN jsonb_build_object('error', 'Invalid reason');
  END IF;

  v_amount := round(p_amount, 2);
  IF v_amount IS NULL OR v_amount <= 0 OR v_amount > 100000 THEN
    RETURN jsonb_build_object('error', 'Amount must be between $0.01 and $100,000');
  END IF;

  -- FOR UPDATE serializes concurrent callers on the job row (revenue bump below).
  SELECT jl.status, jl.master_user_id
    INTO v_status, v_master_id
  FROM public.jobs_ledger jl
  WHERE jl.id = p_job_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  -- Office gating, same shape as set_job_collections_flag (dev/master_technician/assistant
  -- with master access). No job-status restriction: turnaways happen on scheduled and
  -- in-progress jobs, and the ready_to_bill invoice row bills independently of job status.
  v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller'))
    AND (v_master_id = auth.uid()
      OR public.is_dev()
      OR public.is_office_or_estimator()
      OR public.is_office_or_estimator()
      OR public.assistants_share_master(auth.uid(), v_master_id));

  IF NOT v_can_update THEN
    RETURN jsonb_build_object('error', 'Not authorized to create a trip charge');
  END IF;

  -- Idempotency rides on the dispatch request: the first success closes it, so a
  -- double-click or a second office user gets the duplicate early-return.
  IF p_dispatch_request_id IS NOT NULL THEN
    SELECT dr.status INTO v_dispatch_status
    FROM public.dispatch_requests dr
    WHERE dr.id = p_dispatch_request_id
    FOR UPDATE;
    IF v_dispatch_status IS NULL THEN
      RETURN jsonb_build_object('error', 'Dispatch request not found');
    END IF;
    IF v_dispatch_status = 'closed' THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true);
    END IF;
  END IF;

  -- Must match buildTripChargeMemo in src/lib/turnawayTripCharge.ts.
  v_memo := 'Trip charge — ' || v_reason_label;

  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_seq
  FROM public.jobs_ledger_invoices
  WHERE job_id = p_job_id;

  INSERT INTO public.jobs_ledger_invoices
    (job_id, amount, status, sequence_order, estimated_bill_date, is_primary_rtb_bundle, stripe_invoice_memo)
  VALUES
    (p_job_id, v_amount, 'ready_to_bill', v_seq, public.app_today(), false, v_memo)
  RETURNING id INTO v_inv_id;

  -- Bump revenue by the same amount so ensure_single_ready_to_bill_invoice_for_job's
  -- unallocated math (revenue - payments - RTB/billed invoices) is invariant: the job's
  -- eventual final bill is unchanged by the trip charge.
  UPDATE public.jobs_ledger
  SET revenue = COALESCE(revenue, 0) + v_amount,
      updated_at = NOW()
  WHERE id = p_job_id;

  IF p_dispatch_request_id IS NOT NULL THEN
    UPDATE public.dispatch_requests
    SET status = 'closed',
        closed_at = NOW(),
        closed_by_user_id = auth.uid(),
        closed_note = 'Trip charge created — $' || to_char(v_amount, 'FM999,999,990.00') || ' (' || v_reason_label || ')'
    WHERE id = p_dispatch_request_id
      AND status = 'open';
  END IF;

  RETURN jsonb_build_object('ok', true, 'invoice_id', v_inv_id, 'amount', v_amount);
END;
$function$;

-- delete_billed_invoice_on_send_back(p_invoice_id uuid)
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
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'primary')
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

-- delete_ready_to_bill_invoice(p_invoice_id uuid)
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
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'primary')
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

-- dismiss_mercury_duplicate_pair(p_id_a uuid, p_id_b uuid)
CREATE OR REPLACE FUNCTION public.dismiss_mercury_duplicate_pair(p_id_a uuid, p_id_b uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  v_lo uuid;
  v_hi uuid;
begin
  if uid is null then
    raise exception 'dismiss_mercury_duplicate_pair: not authenticated';
  end if;
  if not exists (
    select 1 from public.users u
    where u.id = uid and u.role in ('dev', 'master_technician', 'assistant', 'controller')
  ) then
    raise exception 'dismiss_mercury_duplicate_pair: not authorized';
  end if;
  if p_id_a = p_id_b then
    raise exception 'dismiss_mercury_duplicate_pair: need two distinct transactions';
  end if;
  v_lo := least(p_id_a, p_id_b);
  v_hi := greatest(p_id_a, p_id_b);
  insert into public.mercury_transaction_duplicate_dismissals (id_lo, id_hi, dismissed_by)
  values (v_lo, v_hi, uid)
  on conflict (id_lo, id_hi) do nothing;
end;
$function$;

-- ensure_single_ready_to_bill_invoice_for_job(p_job_id uuid)
CREATE OR REPLACE FUNCTION public.ensure_single_ready_to_bill_invoice_for_job(p_job_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  j RECORD;
  v_allocated numeric(12, 2);
  v_unalloc numeric(12, 2);
  v_primary_count integer;
  v_rtb_count integer;
  v_max_seq integer;
  v_inv_id uuid;
  v_inv_amount numeric(12, 2);
  v_stripe_id text;
  v_hosted text;
  v_est date;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT jl.id,
         jl.status,
         jl.revenue,
         jl.payments_made,
         jl.last_bill_date,
         jl.master_user_id
  INTO j
  FROM public.jobs_ledger jl
  WHERE jl.id = p_job_id;

  IF j.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  IF j.status IS DISTINCT FROM 'ready_to_bill' THEN
    RETURN jsonb_build_object('error', 'Job must be in Ready to Bill');
  END IF;

  IF NOT (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
    )
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'primary')
      OR EXISTS (
        SELECT 1 FROM public.master_assistants ma
        WHERE ma.master_id = auth.uid() AND ma.assistant_id = j.master_user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants ma
        WHERE ma.master_id = j.master_user_id AND ma.assistant_id = auth.uid()
      )
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  -- v2.1134: the never-sent primary remainder bundle is the row this function
  -- RESIZES — it must not count against the remainder it is being resized to.
  -- v2.3775: each open line counts for what is still UNPAID on it. payments_made
  -- already holds every payment on the job, the ones applied to a still-open
  -- billed line included, so a line's face amount would subtract the paid part
  -- twice (job 978: $1,072.50 billed, $1,018.87 applied → read "Nothing left").
  SELECT COALESCE(
           SUM(
             GREATEST(
               0::numeric(12, 2),
               COALESCE(i.amount, 0)::numeric(12, 2)
                 - COALESCE((
                     SELECT SUM(p.amount)
                     FROM public.jobs_ledger_payments p
                     WHERE p.invoice_id = i.id
                       AND p.job_id = i.job_id
                   ), 0)::numeric(12, 2)
             )
           ),
           0
         )::numeric(12, 2)
  INTO v_allocated
  FROM public.jobs_ledger_invoices i
  WHERE i.job_id = p_job_id
    AND i.status IN ('ready_to_bill', 'billed')
    AND NOT (i.status = 'ready_to_bill' AND i.is_primary_rtb_bundle IS TRUE);

  v_unalloc := GREATEST(
    0::numeric(12, 2),
    COALESCE(j.revenue, 0)::numeric(12, 2)
      - COALESCE(j.payments_made, 0)::numeric(12, 2)
      - v_allocated
  );

  SELECT COUNT(*)::integer
  INTO v_primary_count
  FROM public.jobs_ledger_invoices i
  WHERE i.job_id = p_job_id
    AND i.status = 'ready_to_bill'
    AND i.is_primary_rtb_bundle IS TRUE;

  IF v_primary_count > 1 THEN
    RETURN jsonb_build_object(
      'error',
      'Multiple primary remainder Ready-to-Bill rows exist for this job; fix is_primary_rtb_bundle so only one is true.'
    );
  END IF;

  IF v_primary_count = 0 THEN
    IF v_unalloc > 0::numeric(12, 2) THEN
      SELECT COUNT(*)::integer
      INTO v_rtb_count
      FROM public.jobs_ledger_invoices i
      WHERE i.job_id = p_job_id
        AND i.status = 'ready_to_bill';

      IF v_rtb_count = 1 THEN
        SELECT i.id, i.amount, i.stripe_invoice_id, i.hosted_invoice_url
        INTO v_inv_id, v_inv_amount, v_stripe_id, v_hosted
        FROM public.jobs_ledger_invoices i
        WHERE i.job_id = p_job_id
          AND i.status = 'ready_to_bill'
        LIMIT 1;

        IF v_inv_amount = v_unalloc THEN
          IF v_stripe_id IS NOT NULL AND trim(v_stripe_id) <> '' AND v_hosted IS NOT NULL AND trim(v_hosted) <> '' THEN
            UPDATE public.jobs_ledger_invoices
            SET is_primary_rtb_bundle = true
            WHERE id = v_inv_id;

            RETURN jsonb_build_object(
              'ok', true,
              'invoice_id', v_inv_id,
              'amount', v_inv_amount,
              'created', false
            );
          END IF;

          UPDATE public.jobs_ledger_invoices
          SET amount = v_unalloc,
              is_primary_rtb_bundle = true
          WHERE id = v_inv_id;

          RETURN jsonb_build_object(
            'ok', true,
            'invoice_id', v_inv_id,
            'amount', v_unalloc,
            'created', false
          );
        END IF;
      END IF;

      SELECT COALESCE(MAX(i.sequence_order), -1) + 1
      INTO v_max_seq
      FROM public.jobs_ledger_invoices i
      WHERE i.job_id = p_job_id;

      v_est := NULL;
      IF j.last_bill_date IS NOT NULL AND trim(j.last_bill_date::text) <> '' THEN
        BEGIN
          v_est := j.last_bill_date::date;
        EXCEPTION WHEN OTHERS THEN
          v_est := NULL;
        END;
      END IF;

      INSERT INTO public.jobs_ledger_invoices (
        job_id,
        amount,
        status,
        sequence_order,
        estimated_bill_date,
        is_primary_rtb_bundle
      )
      VALUES (
        p_job_id,
        v_unalloc,
        'ready_to_bill',
        v_max_seq,
        v_est,
        true
      )
      RETURNING id INTO v_inv_id;

      RETURN jsonb_build_object(
        'ok', true,
        'invoice_id', v_inv_id,
        'amount', v_unalloc,
        'created', true
      );
    END IF;

    SELECT COUNT(*)::integer
    INTO v_rtb_count
    FROM public.jobs_ledger_invoices i
    WHERE i.job_id = p_job_id
      AND i.status = 'ready_to_bill';

    IF v_rtb_count > 0 THEN
      RETURN jsonb_build_object(
        'error',
        'No remainder to bill on the job bundle; use Bill Customer from a partial invoice row or adjust amounts.'
      );
    END IF;

    RETURN jsonb_build_object('error', 'Nothing left to bill for this job');
  END IF;

  SELECT i.id, i.amount, i.stripe_invoice_id, i.hosted_invoice_url
  INTO v_inv_id, v_inv_amount, v_stripe_id, v_hosted
  FROM public.jobs_ledger_invoices i
  WHERE i.job_id = p_job_id
    AND i.status = 'ready_to_bill'
    AND i.is_primary_rtb_bundle IS TRUE
  LIMIT 1;

  IF v_stripe_id IS NOT NULL AND trim(v_stripe_id) <> '' AND v_hosted IS NOT NULL AND trim(v_hosted) <> '' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'invoice_id', v_inv_id,
      'amount', v_inv_amount,
      'created', false
    );
  END IF;

  IF v_unalloc > 0::numeric(12, 2) THEN
    UPDATE public.jobs_ledger_invoices
    SET amount = v_unalloc,
        is_primary_rtb_bundle = true
    WHERE id = v_inv_id;

    RETURN jsonb_build_object(
      'ok', true,
      'invoice_id', v_inv_id,
      'amount', v_unalloc,
      'created', false
    );
  END IF;

  -- Remainder fully allocated to real invoices: the never-sent elastic
  -- primary has nothing left to carry. Delete it instead of parking a $0.00
  -- draft and calling the caller's successful invoice write an error.
  DELETE FROM public.jobs_ledger_invoices
  WHERE id = v_inv_id
    AND status = 'ready_to_bill';

  RETURN jsonb_build_object(
    'ok', true,
    'fully_allocated', true,
    'amount', 0,
    'primary_deleted', true
  );
END;
$function$;

-- get_invoice_allocation_lines_for_jobs(p_job_ids uuid[])
CREATE OR REPLACE FUNCTION public.get_invoice_allocation_lines_for_jobs(p_job_ids uuid[])
 RETURNS TABLE(job_id uuid, invoice_id uuid, allocated_amount numeric, invoice_number text, invoice_date date, invoice_total_amount numeric, supply_house_name text, website_url text, invoice_link text, pct numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH visible_jobs AS (
    SELECT jl.id
    FROM public.jobs_ledger jl
    WHERE jl.id = ANY(p_job_ids)
    AND (
      EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller')
        AND (
          jl.master_user_id = auth.uid()
          OR public.is_dev()
          OR public.is_office_or_estimator()
          OR public.is_office_or_estimator()
          OR public.assistants_share_master(auth.uid(), jl.master_user_id)
        )
      )
      OR (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
        AND EXISTS (SELECT 1 FROM public.master_primaries WHERE master_id = jl.master_user_id AND primary_id = auth.uid())
      )
      OR (
        public.auth_uid_is_helpers_or_subcontractor()
        AND EXISTS (SELECT 1 FROM public.jobs_ledger_team_members jtm WHERE jtm.job_id = jl.id AND jtm.user_id = auth.uid())
      )
    )
  )
  SELECT
    a.job_id,
    a.invoice_id,
    (i.amount * a.pct / 100)::numeric AS allocated_amount,
    i.invoice_number::text,
    i.invoice_date::date AS invoice_date,
    i.amount::numeric AS invoice_total_amount,
    COALESCE(sh.name, '')::text AS supply_house_name,
    sh.website_url::text AS website_url,
    i.link::text AS invoice_link,
    a.pct
  FROM public.supply_house_invoice_job_allocations a
  INNER JOIN public.supply_house_invoices i ON i.id = a.invoice_id
  INNER JOIN public.supply_houses sh ON sh.id = i.supply_house_id
  INNER JOIN visible_jobs v ON v.id = a.job_id
  ORDER BY a.job_id, i.invoice_date DESC NULLS LAST, i.invoice_number;
$function$;

-- get_invoice_amounts_for_jobs(p_job_ids uuid[])
CREATE OR REPLACE FUNCTION public.get_invoice_amounts_for_jobs(p_job_ids uuid[])
 RETURNS TABLE(job_id uuid, invoice_amount numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH visible_jobs AS (
    SELECT jl.id
    FROM public.jobs_ledger jl
    WHERE jl.id = ANY(p_job_ids)
    AND (
      EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller')
        AND (
          jl.master_user_id = auth.uid()
          OR public.is_dev()
          OR public.is_office_or_estimator()
          OR public.is_office_or_estimator()
          OR public.assistants_share_master(auth.uid(), jl.master_user_id)
        )
      )
      OR (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
        AND EXISTS (SELECT 1 FROM public.master_primaries WHERE master_id = jl.master_user_id AND primary_id = auth.uid())
      )
      OR (
        public.auth_uid_is_helpers_or_subcontractor()
        AND EXISTS (SELECT 1 FROM public.jobs_ledger_team_members jtm WHERE jtm.job_id = jl.id AND jtm.user_id = auth.uid())
      )
    )
  )
  SELECT
    a.job_id,
    COALESCE(SUM(i.amount * a.pct / 100), 0)::numeric AS invoice_amount
  FROM public.supply_house_invoice_job_allocations a
  INNER JOIN public.supply_house_invoices i ON i.id = a.invoice_id
  INNER JOIN visible_jobs v ON v.id = a.job_id
  GROUP BY a.job_id;
$function$;

-- list_ar_allocations_for_mercury_transaction(p_mercury_transaction_id uuid)
CREATE OR REPLACE FUNCTION public.list_ar_allocations_for_mercury_transaction(p_mercury_transaction_id uuid)
 RETURNS TABLE(payment_id uuid, job_id uuid, amount numeric, paid_on date, invoice_id uuid, note text, hcp_number text, job_name text, invoice_sequence_order integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_ar_allocations_for_mercury_transaction: not authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')) THEN
    RAISE EXCEPTION 'list_ar_allocations_for_mercury_transaction: not authorized';
  END IF;
  IF p_mercury_transaction_id IS NULL THEN
    RAISE EXCEPTION 'list_ar_allocations_for_mercury_transaction: mercury transaction required';
  END IF;
  RETURN QUERY
  SELECT
    p.id AS payment_id, p.job_id, p.amount::numeric, p.paid_on, p.invoice_id,
    nullif(trim(coalesce(p.note, '')), '') AS note,
    COALESCE(NULLIF(j.hcp_number, ''), NULLIF(j.click_number, ''), ''),
    j.job_name, inv.sequence_order AS invoice_sequence_order
  FROM public.jobs_ledger_payments p
  INNER JOIN public.jobs_ledger j ON j.id = p.job_id
  LEFT JOIN public.jobs_ledger_invoices inv ON inv.id = p.invoice_id
  WHERE p.mercury_transaction_id = p_mercury_transaction_id
    AND (j.master_user_id = auth.uid() OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR public.is_office_or_estimator()
      OR public.is_office_or_estimator()
      OR public.assistants_share_master(auth.uid(), j.master_user_id))
  ORDER BY p.paid_on DESC NULLS LAST, p.id;
END;
$function$;

-- list_mercury_transactions_for_bank_payments(p_filter jsonb)
CREATE OR REPLACE FUNCTION public.list_mercury_transactions_for_bank_payments(p_filter jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(mercury_transaction_id uuid, amount numeric, posted_at timestamp with time zone, counterparty_name text, note text, external_memo text, kind text, mercury_account_id uuid, raw jsonb, mercury_id uuid, consumed numeric, remaining_available numeric, returned boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_kinds text[] := ARRAY[]::text[];
  v_account_ids text[] := ARRAY[]::text[];
  v_debit_ids text[] := ARRAY[]::text[];
  v_start_ymd text;
  v_exclude_cp text[] := ARRAY[]::text[];
  v_exclude_note text[] := ARRAY[]::text[];
  v_include_hidden boolean := false;
  o jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_mercury_transactions_for_bank_payments: not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  ) THEN
    RAISE EXCEPTION 'list_mercury_transactions_for_bank_payments: not authorized';
  END IF;

  IF p_filter IS NOT NULL AND jsonb_typeof(p_filter) = 'object' THEN
    o := p_filter;
    IF o ? 'kinds' AND jsonb_typeof(o->'kinds') = 'array' THEN
      SELECT coalesce(array_agg(value::text), ARRAY[]::text[])
      INTO v_kinds
      FROM jsonb_array_elements_text(o->'kinds');
    END IF;
    IF o ? 'accountIds' AND jsonb_typeof(o->'accountIds') = 'array' THEN
      SELECT coalesce(array_agg(value::text), ARRAY[]::text[])
      INTO v_account_ids
      FROM jsonb_array_elements_text(o->'accountIds');
    END IF;
    IF o ? 'debitCardIds' AND jsonb_typeof(o->'debitCardIds') = 'array' THEN
      SELECT coalesce(array_agg(lower(trim(value::text))), ARRAY[]::text[])
      INTO v_debit_ids
      FROM jsonb_array_elements_text(o->'debitCardIds');
    END IF;
    IF o ? 'startDateYmd' AND jsonb_typeof(o->'startDateYmd') = 'string' THEN
      v_start_ymd := trim(o->>'startDateYmd');
    END IF;
    IF o ? 'excludeCounterpartyContains' AND jsonb_typeof(o->'excludeCounterpartyContains') = 'array' THEN
      WITH elements AS (
        SELECT left(btrim(value), 120) AS p
        FROM jsonb_array_elements_text(o->'excludeCounterpartyContains')
        WHERE length(btrim(value)) > 0
        LIMIT 50
      )
      SELECT coalesce(array_agg(p ORDER BY p), ARRAY[]::text[])
      INTO v_exclude_cp
      FROM elements;
    END IF;
    IF o ? 'excludeNoteContains' AND jsonb_typeof(o->'excludeNoteContains') = 'array' THEN
      WITH elements AS (
        SELECT left(btrim(value), 120) AS p
        FROM jsonb_array_elements_text(o->'excludeNoteContains')
        WHERE length(btrim(value)) > 0
        LIMIT 50
      )
      SELECT coalesce(array_agg(p ORDER BY p), ARRAY[]::text[])
      INTO v_exclude_note
      FROM elements;
    END IF;
    IF o ? 'includeHiddenArDeposits' AND jsonb_typeof(o->'includeHiddenArDeposits') = 'boolean' THEN
      v_include_hidden := (o->>'includeHiddenArDeposits')::boolean;
    ELSIF o ? 'includeFullyApplied' AND jsonb_typeof(o->'includeFullyApplied') = 'boolean' THEN
      v_include_hidden := (o->>'includeFullyApplied')::boolean;
    END IF;
  END IF;

  IF v_start_ymd IS NULL OR v_start_ymd !~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_start_ymd := to_char((CURRENT_TIMESTAMP AT TIME ZONE 'America/Chicago')::date - 90, 'YYYY-MM-DD');
  END IF;

  RETURN QUERY
  SELECT
    t.id AS mercury_transaction_id,
    t.amount::numeric,
    t.posted_at,
    t.counterparty_name,
    t.note,
    t.external_memo,
    t.kind,
    t.mercury_account_id,
    t.raw,
    t.mercury_id,
    coalesce((
      SELECT sum(p.amount)
      FROM public.jobs_ledger_payments p
      WHERE p.mercury_transaction_id = t.id
    ), 0)::numeric AS consumed,
    (abs(t.amount) - coalesce((
      SELECT sum(p.amount)
      FROM public.jobs_ledger_payments p
      WHERE p.mercury_transaction_id = t.id
    ), 0))::numeric AS remaining_available,
    coalesce(r.returned, false) AS returned
  FROM public.mercury_transactions t
  LEFT JOIN public.mercury_transaction_ar_returned r ON r.mercury_transaction_id = t.id
  WHERE t.posted_at IS NOT NULL
    AND to_char((t.posted_at AT TIME ZONE 'America/Chicago')::date, 'YYYY-MM-DD') >= v_start_ymd
    AND (cardinality(v_kinds) = 0 OR t.kind = ANY (v_kinds))
    AND (cardinality(v_account_ids) = 0 OR t.mercury_account_id::text = ANY (v_account_ids))
    AND (
      cardinality(v_debit_ids) = 0
      OR public._mercury_raw_debit_card_id_lower(t.raw) = ANY (v_debit_ids)
    )
    AND abs(t.amount) > 0
    AND (
      v_include_hidden
      OR (
        abs(t.amount) - coalesce((
          SELECT sum(p.amount)
          FROM public.jobs_ledger_payments p
          WHERE p.mercury_transaction_id = t.id
        ), 0)
      ) > 0.0005
    )
    AND (
      v_include_hidden
      OR NOT EXISTS (
        SELECT 1
        FROM public.mercury_transaction_ar_returned r2
        WHERE r2.mercury_transaction_id = t.id
          AND r2.returned
      )
    )
    AND (
      v_include_hidden
      OR NOT EXISTS (
        SELECT 1
        FROM public.mercury_transaction_ar_closed c2
        WHERE c2.mercury_transaction_id = t.id
      )
    )
    AND NOT (
      cardinality(v_exclude_cp) > 0
      AND EXISTS (
        SELECT 1
        FROM unnest(v_exclude_cp) AS x(pat)
        WHERE position(lower(x.pat) IN lower(coalesce(t.counterparty_name, ''))) > 0
      )
    )
    AND NOT (
      cardinality(v_exclude_note) > 0
      AND EXISTS (
        SELECT 1
        FROM unnest(v_exclude_note) AS x(pat)
        WHERE position(lower(x.pat) IN lower(coalesce(t.note, ''))) > 0
      )
    )
  ORDER BY t.posted_at DESC NULLS LAST, t.id DESC;
END;
$function$;

-- list_stale_unlinked_mercury_transactions_for_tally_staff(min_age_days integer, include_all_unlinked boolean)
CREATE OR REPLACE FUNCTION public.list_stale_unlinked_mercury_transactions_for_tally_staff(min_age_days integer DEFAULT 2, include_all_unlinked boolean DEFAULT false)
 RETURNS TABLE(target_user_id uuid, target_name text, target_email text, target_phone text, mercury_transaction_id uuid, posted_at timestamp with time zone, amount numeric, counterparty_name text, note text, mercury_account_id uuid, currency text, mercury_id uuid, raw jsonb, job_splits jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  floor_ymd text;
  use_floor boolean;
  age_int integer;
  hide_dev boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_stale_unlinked_mercury_transactions_for_tally_staff: not authenticated';
  END IF;

  IF NOT (
    public.is_dev()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
    )
  ) THEN
    RETURN;
  END IF;

  age_int := GREATEST(0, min_age_days);

  SELECT NULLIF(trim(both FROM value_text), '') INTO floor_ymd
  FROM public.app_settings
  WHERE key = 'job_tally_min_posted_ymd';

  use_floor := floor_ymd IS NOT NULL AND floor_ymd ~ '^\d{4}-\d{2}-\d{2}$';

  SELECT (NULLIF(trim(both FROM value_text), '') = 'true') INTO hide_dev
  FROM public.app_settings
  WHERE key = 'hide_dev_tally_transactions';
  hide_dev := COALESCE(hide_dev, false);

  RETURN QUERY
  SELECT
    u.id AS target_user_id,
    u.name::text AS target_name,
    COALESCE(NULLIF(trim(both FROM u.email), ''), pp.p_email)::text AS target_email,
    COALESCE(NULLIF(trim(both FROM u.phone), ''), pp.p_phone)::text AS target_phone,
    t.id AS mercury_transaction_id,
    t.posted_at,
    t.amount,
    t.counterparty_name,
    t.note,
    t.mercury_account_id,
    t.currency,
    t.mercury_id,
    t.raw,
    '[]'::jsonb AS job_splits
  FROM public.mercury_transactions t
  INNER JOIN public.mercury_debit_card_user_links l
    ON l.mercury_debit_card_id = public.mercury_debit_card_id_from_raw(t.raw)
  INNER JOIN public.users u ON u.id = l.user_id
  LEFT JOIN LATERAL (
    SELECT
      p.email::text AS p_email,
      p.phone::text AS p_phone
    FROM public.people p
    WHERE p.archived_at IS NULL
      AND lower(trim(both FROM p.name)) = lower(trim(both FROM u.name))
    ORDER BY p.id
    LIMIT 1
  ) pp ON true
  WHERE public.staff_can_view_user_for_tally_followup(auth.uid(), l.user_id)
    AND (NOT hide_dev OR u.role <> 'dev')
    AND NOT EXISTS (
      SELECT 1
      FROM public.mercury_transaction_job_allocations m
      WHERE m.mercury_transaction_id = t.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.mercury_transaction_supply_house_invoice_links il
      WHERE il.mercury_transaction_id = t.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.mercury_tally_payroll_flags pf
      WHERE pf.mercury_transaction_id = t.id
      AND pf.is_payroll
    )
    AND (
      NOT use_floor
      OR (
        t.posted_at IS NOT NULL
        AND to_char(t.posted_at AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') >= floor_ymd
      )
    )
    AND t.posted_at IS NOT NULL
    AND (
      include_all_unlinked
      OR (
        (now() AT TIME ZONE 'America/Chicago')::date
        - (t.posted_at AT TIME ZONE 'America/Chicago')::date
      ) > age_int
    )
  ORDER BY u.name ASC, t.posted_at DESC NULLS LAST, t.id ASC
  LIMIT 500;
END;
$function$;

-- list_unlinked_payments_for_bank_payments()
CREATE OR REPLACE FUNCTION public.list_unlinked_payments_for_bank_payments()
 RETURNS TABLE(payment_id uuid, job_id uuid, amount numeric, paid_on date, note text, payment_type text, reference_number text, invoice_id uuid, hcp_number text, click_number text, job_name text, stripe_hosted boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    j.job_name,
    (coalesce(trim(i.stripe_invoice_id), '') <> '') AS stripe_hosted
  FROM public.jobs_ledger_payments p
  JOIN public.jobs_ledger j ON j.id = p.job_id
  LEFT JOIN public.jobs_ledger_invoices i ON i.id = p.invoice_id
  WHERE EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
    )
    AND p.mercury_transaction_id IS NULL
    AND lower(coalesce(trim(p.note), '')) <> 'stripe'
    AND coalesce(p.amount, 0) > 0
    AND (
      p.paid_on IS NULL
      OR p.paid_on >= ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Chicago')::date - 180)
    )
  ORDER BY p.paid_on DESC NULLS LAST, p.id DESC
  LIMIT 500;
$function$;

-- mark_invoice_paid(p_invoice_id uuid, p_amount numeric, p_paid_on date, p_note text, p_payment_type text, p_reference_number text)
CREATE OR REPLACE FUNCTION public.mark_invoice_paid(p_invoice_id uuid, p_amount numeric DEFAULT NULL::numeric, p_paid_on date DEFAULT NULL::date, p_note text DEFAULT NULL::text, p_payment_type text DEFAULT NULL::text, p_reference_number text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
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
      OR public.is_office_or_estimator()
      OR public.is_office_or_estimator()
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
$function$;

-- mark_job_paid(p_job_id uuid, p_amount numeric, p_paid_on date, p_note text, p_payment_type text, p_reference_number text)
CREATE OR REPLACE FUNCTION public.mark_job_paid(p_job_id uuid, p_amount numeric DEFAULT NULL::numeric, p_paid_on date DEFAULT NULL::date, p_note text DEFAULT NULL::text, p_payment_type text DEFAULT NULL::text, p_reference_number text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
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
      OR public.is_office_or_estimator()
      OR public.is_office_or_estimator()
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
$function$;

-- mark_job_paid(p_job_id uuid, p_paid_on date, p_note text)
CREATE OR REPLACE FUNCTION public.mark_job_paid(p_job_id uuid, p_paid_on date DEFAULT NULL::date, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
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
      OR public.is_office_or_estimator()
      OR public.is_office_or_estimator()
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
    COALESCE(p_paid_on, public.app_today()),
    NULLIF(TRIM(COALESCE(p_note, '')), '')
  );

  -- B3: payments_made is trigger-maintained.
  UPDATE public.jobs_ledger
  SET status = 'paid',
      updated_at = NOW()
  WHERE id = p_job_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- remove_jobs_ledger_payment_and_reconcile(p_payment_id uuid)
CREATE OR REPLACE FUNCTION public.remove_jobs_ledger_payment_and_reconcile(p_payment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
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
$function$;

-- revert_stripe_oob_invoice_payment(p_invoice_id uuid, p_reason text, p_stripe_invoice_status_after text, p_stripe_credit_note_id text)
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
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
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

-- set_job_collections_flag(p_job_id uuid, p_flagged boolean, p_note text)
CREATE OR REPLACE FUNCTION public.set_job_collections_flag(p_job_id uuid, p_flagged boolean, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
  v_master_id UUID;
  v_collections_at TIMESTAMPTZ;
  v_note TEXT;
  v_can_update BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT jl.status, jl.master_user_id, jl.collections_at
    INTO v_status, v_master_id, v_collections_at
  FROM public.jobs_ledger jl
  WHERE jl.id = p_job_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  IF v_status <> 'billed' THEN
    RETURN jsonb_build_object('error', 'Job must be in Billed Awaiting Payment to change Collections');
  END IF;

  -- Office gating, same shape as update_job_status transitions (dev/master_technician/assistant
  -- with master access). Widening Collections to another role pool happens here and only here.
  v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller'))
    AND (v_master_id = auth.uid()
      OR public.is_dev()
      OR public.is_office_or_estimator()
      OR public.is_office_or_estimator()
      OR public.assistants_share_master(auth.uid(), v_master_id));

  IF NOT v_can_update THEN
    RETURN jsonb_build_object('error', 'Not authorized to change Collections');
  END IF;

  -- Idempotent: no state change -> no write and no duplicate activity event.
  IF p_flagged = (v_collections_at IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', true, 'flagged', p_flagged);
  END IF;

  v_note := NULLIF(TRIM(COALESCE(p_note, '')), '');

  IF p_flagged THEN
    UPDATE public.jobs_ledger
    SET collections_at = NOW(), collections_by = auth.uid(), collections_note = v_note, updated_at = NOW()
    WHERE id = p_job_id;
  ELSE
    UPDATE public.jobs_ledger
    SET collections_at = NULL, collections_by = NULL, collections_note = NULL, updated_at = NOW()
    WHERE id = p_job_id;
  END IF;

  INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  VALUES (
    p_job_id,
    'collections_change',
    NOW(),
    auth.uid(),
    CASE WHEN p_flagged
      THEN 'Moved to Collections' || COALESCE(' — ' || v_note, '')
      ELSE 'Returned to Billed Awaiting Payment'
    END,
    jsonb_build_object('flagged', p_flagged, 'note', v_note),
    true
  );

  RETURN jsonb_build_object('ok', true, 'flagged', p_flagged);
END;
$function$;

-- set_mercury_transaction_ar_returned(p_mercury_transaction_id uuid, p_returned boolean)
CREATE OR REPLACE FUNCTION public.set_mercury_transaction_ar_returned(p_mercury_transaction_id uuid, p_returned boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'set_mercury_transaction_ar_returned: not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  ) THEN
    RAISE EXCEPTION 'set_mercury_transaction_ar_returned: not authorized';
  END IF;

  IF p_mercury_transaction_id IS NULL THEN
    RAISE EXCEPTION 'set_mercury_transaction_ar_returned: mercury transaction required';
  END IF;

  IF p_returned THEN
    INSERT INTO public.mercury_transaction_ar_returned (mercury_transaction_id, returned, updated_by)
    VALUES (p_mercury_transaction_id, true, auth.uid())
    ON CONFLICT (mercury_transaction_id) DO UPDATE SET
      returned = excluded.returned,
      updated_at = now(),
      updated_by = excluded.updated_by;
  ELSE
    DELETE FROM public.mercury_transaction_ar_returned
    WHERE mercury_transaction_id = p_mercury_transaction_id;
  END IF;
END;
$function$;

-- set_mercury_transaction_duplicate(p_duplicate_id uuid, p_keeper_id uuid)
CREATE OR REPLACE FUNCTION public.set_mercury_transaction_duplicate(p_duplicate_id uuid, p_keeper_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'set_mercury_transaction_duplicate: not authenticated';
  end if;
  if not exists (
    select 1 from public.users u
    where u.id = uid and u.role in ('dev', 'master_technician', 'assistant', 'controller')
  ) then
    raise exception 'set_mercury_transaction_duplicate: not authorized';
  end if;
  if p_duplicate_id = p_keeper_id then
    raise exception 'set_mercury_transaction_duplicate: a transaction cannot be a duplicate of itself';
  end if;
  if not exists (select 1 from public.mercury_transactions where id = p_keeper_id) then
    raise exception 'set_mercury_transaction_duplicate: keeper transaction not found';
  end if;
  if exists (
    select 1 from public.mercury_transactions
    where id = p_keeper_id and duplicate_of_transaction_id is not null
  ) then
    raise exception 'set_mercury_transaction_duplicate: keeper is itself marked a duplicate';
  end if;
  update public.mercury_transactions
    set duplicate_of_transaction_id = p_keeper_id
    where id = p_duplicate_id;
  if not found then
    raise exception 'set_mercury_transaction_duplicate: duplicate transaction not found';
  end if;
end;
$function$;
