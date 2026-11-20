SET lock_timeout = '3s';

-- The money desks close to a primary: the two verbs and three tables the first pass left (punch list #400;
-- to-dos/primary-job-doors.md, the owner's call 1 of 2026-11-19 and his go of 2026-11-20). v2.7931
-- (20261119104000_primary_money_desks.sql) took the role out of 22 functions and two read policies behind the bank
-- payments desk, returned checks and disputes, and the GC review week. A read of prod on 2026-11-20 found what it
-- left: the desk's two paying verbs still named the role, and so did the policies of three of the desk's own tables,
-- where no job is asked about at all. No screen of a primary's calls either verb or reads any of the three tables:
-- the bank payments window is the only caller, every door to it is gated, and every function that reads the tables
-- runs as its owner. Read as the sample primary before this file, the returned-checks table gave 9 rows and the
-- closed-deposits table gave 1.
--
-- Each function below is its live definition (pg_get_functiondef on prod, read on 2026-11-20, the same text as
-- 20261019120000_primary_paid_verbs.sql) with ONE change: the role comes out of its office list. Both also carried
-- the role in the job's own check (v2.5655's `AND public.is_job_people(j.id)` clause), and that clause comes out
-- with it, since no caller who passes the list can meet it. The nine policies of mercury_transaction_ar_returned,
-- mercury_transaction_ar_closed and mercury_transaction_ar_close_labels are re-created without the role, leaving
-- public.is_office_staff() as each one had it.
--
-- What stays as it was, on purpose: a primary's paid verbs on their own jobs (mark_invoice_paid, mark_job_paid,
-- remove_jobs_ledger_payment_and_reconcile, the job form's payment lines), which the Bill tab of their own job
-- uses. record_job_tip_from_deposit still leaves the controller out, as it did: its comment says its cohort is the
-- apply verb's, and the apply verb has taken the controller since 20260927230000. That is a call for the owner and
-- not this file's one change. Dev, master and assistant are untouched on every line, and the controller where it
-- was named. No name, argument or returned shape changes. CREATE OR REPLACE keeps each function's grants and
-- owner. No CREATE TABLE. Idempotent: CREATE OR REPLACE and DROP POLICY IF EXISTS + CREATE, so a second run changes
-- nothing.

-- ---------- apply_mercury_bank_payment_allocations(uuid,date,text,text,jsonb,boolean): the office list and the job checks, without the role ----------

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
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
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

-- ---------- record_job_tip_from_deposit(uuid,uuid,numeric,text,text): the office list and the job check, without the role ----------

CREATE OR REPLACE FUNCTION public.record_job_tip_from_deposit(p_mercury_transaction_id uuid, p_job_id uuid, p_amount numeric, p_payment_type text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_mt public.mercury_transactions%rowtype;
  v_amt numeric := round(coalesce(p_amount, 0)::numeric, 2);
  v_consumed numeric;
  v_cap numeric;
  v_seq integer;
  v_fixture_id uuid;
  v_payment_id uuid;
  v_revenue numeric;
  v_paid_on date;
  v_note text;
  v_pt text;
begin
  if auth.uid() is null then
    return jsonb_build_object('error', 'Not signed in');
  end if;

  -- Same cohort as apply_mercury_bank_payment_allocations: whoever can apply a deposit
  -- can add a tip, and nobody else. Controller is excluded there too.
  if not exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role in ('dev', 'master_technician', 'assistant')
  ) then
    return jsonb_build_object('error', 'Not authorized');
  end if;

  if p_mercury_transaction_id is null or p_job_id is null then
    return jsonb_build_object('error', 'A tip needs a deposit and a job');
  end if;
  if v_amt <= 0 then
    return jsonb_build_object('error', 'A tip needs an amount');
  end if;

  -- Lock the deposit so two people adding a tip at once cannot both pass the cap check.
  select * into v_mt from public.mercury_transactions
  where id = p_mercury_transaction_id for update;
  if v_mt.id is null then
    return jsonb_build_object('error', 'Bank transaction not found');
  end if;

  -- A tip can never exceed what is still unapplied on the deposit.
  select coalesce(sum(p.amount), 0) into v_consumed
  from public.jobs_ledger_payments p
  where p.mercury_transaction_id = p_mercury_transaction_id;
  v_cap := round(abs(coalesce(v_mt.amount, 0)) - v_consumed, 2);
  if v_cap <= 0 then
    return jsonb_build_object('error', 'No remaining amount on this bank transaction');
  end if;
  if v_amt > v_cap + 0.0001 then
    return jsonb_build_object('error', 'Amount exceeds remaining on bank transaction');
  end if;

  -- The job must be one this caller could already allocate a deposit to.
  if not exists (
    select 1 from public.jobs_ledger j
    where j.id = p_job_id
      and (
        j.master_user_id = auth.uid()
        or public.is_dev()
        or exists (select 1 from public.master_assistants where master_id = auth.uid() and assistant_id = j.master_user_id)
        or exists (select 1 from public.master_assistants where master_id = j.master_user_id and assistant_id = auth.uid())
        or public.assistants_share_master(auth.uid(), j.master_user_id)
      )
  ) then
    return jsonb_build_object('error', 'Not authorized to update this job');
  end if;

  -- The tip line. line_kind stays at its 'work' default on purpose.
  select coalesce(max(sequence_order), -1) + 1 into v_seq
  from public.jobs_ledger_fixtures where job_id = p_job_id;

  insert into public.jobs_ledger_fixtures
    (job_id, name, count, sequence_order, line_unit_price, line_description, invoice_id, stage_kind, shared_with_gc)
  values
    (p_job_id, 'Tip', 1, v_seq, v_amt, null, null, null, false)
  returning id into v_fixture_id;

  -- Revenue is recomputed from the job's own lines, never incremented — same rule and same
  -- arithmetic as apply_job_discount (named rows x price, plus the riders: un-voided hazmat
  -- fees and returned check fees, job_rider_fees, v2.5091).
  select round(
           coalesce((
             select sum((case when coalesce(f.count, 0) > 0 then f.count else 1 end) * coalesce(f.line_unit_price, 0))
             from public.jobs_ledger_fixtures f
             where f.job_id = p_job_id and coalesce(btrim(f.name), '') <> ''
           ), 0)
           + public.job_rider_fees(p_job_id)
         , 2)
  into v_revenue;
  update public.jobs_ledger set revenue = v_revenue, updated_at = now() where id = p_job_id;

  -- The money, recorded against the deposit and against the job but against no bill, so no
  -- invoice reads overpaid.
  v_paid_on := coalesce((v_mt.posted_at at time zone 'America/Chicago')::date, (now() at time zone 'America/Chicago')::date);
  v_pt := nullif(btrim(coalesce(p_payment_type, '')), '');
  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is null then
    v_note := 'Tip — paid over the bills on this deposit';
  end if;

  select coalesce(max(sequence_order), -1) + 1 into v_seq
  from public.jobs_ledger_payments where job_id = p_job_id;

  insert into public.jobs_ledger_payments
    (job_id, amount, sequence_order, paid_on, note, invoice_id, payment_type, reference_number, mercury_transaction_id)
  values
    (p_job_id, v_amt, v_seq, v_paid_on, left(v_note, 500), null, v_pt,
     nullif(btrim(v_mt.mercury_id::text), ''), p_mercury_transaction_id)
  returning id into v_payment_id;

  return jsonb_build_object(
    'ok', true,
    'fixture_id', v_fixture_id,
    'payment_id', v_payment_id,
    'revenue', v_revenue,
    'remaining_after', round(v_cap - v_amt, 2)
  );
end;
$function$;

-- ---------- mercury_transaction_ar_returned, mercury_transaction_ar_closed and mercury_transaction_ar_close_labels: the policies, office staff without the role ----------

DROP POLICY IF EXISTS "mercury_transaction_ar_returned_select_ar_roles" ON public.mercury_transaction_ar_returned;
CREATE POLICY "mercury_transaction_ar_returned_select_ar_roles" ON public.mercury_transaction_ar_returned FOR SELECT TO authenticated USING (public.is_office_staff());
DROP POLICY IF EXISTS "mercury_transaction_ar_returned_insert_ar_roles" ON public.mercury_transaction_ar_returned;
CREATE POLICY "mercury_transaction_ar_returned_insert_ar_roles" ON public.mercury_transaction_ar_returned FOR INSERT TO authenticated WITH CHECK (public.is_office_staff());
DROP POLICY IF EXISTS "mercury_transaction_ar_returned_update_ar_roles" ON public.mercury_transaction_ar_returned;
CREATE POLICY "mercury_transaction_ar_returned_update_ar_roles" ON public.mercury_transaction_ar_returned FOR UPDATE TO authenticated USING (public.is_office_staff()) WITH CHECK (public.is_office_staff());
DROP POLICY IF EXISTS "mercury_transaction_ar_returned_delete_ar_roles" ON public.mercury_transaction_ar_returned;
CREATE POLICY "mercury_transaction_ar_returned_delete_ar_roles" ON public.mercury_transaction_ar_returned FOR DELETE TO authenticated USING (public.is_office_staff());

DROP POLICY IF EXISTS "mercury_transaction_ar_closed_select_ar_roles" ON public.mercury_transaction_ar_closed;
CREATE POLICY "mercury_transaction_ar_closed_select_ar_roles" ON public.mercury_transaction_ar_closed FOR SELECT TO authenticated USING (public.is_office_staff());
DROP POLICY IF EXISTS "mercury_transaction_ar_closed_insert_ar_roles" ON public.mercury_transaction_ar_closed;
CREATE POLICY "mercury_transaction_ar_closed_insert_ar_roles" ON public.mercury_transaction_ar_closed FOR INSERT TO authenticated WITH CHECK (public.is_office_staff());
DROP POLICY IF EXISTS "mercury_transaction_ar_closed_update_ar_roles" ON public.mercury_transaction_ar_closed;
CREATE POLICY "mercury_transaction_ar_closed_update_ar_roles" ON public.mercury_transaction_ar_closed FOR UPDATE TO authenticated USING (public.is_office_staff()) WITH CHECK (public.is_office_staff());
DROP POLICY IF EXISTS "mercury_transaction_ar_closed_delete_ar_roles" ON public.mercury_transaction_ar_closed;
CREATE POLICY "mercury_transaction_ar_closed_delete_ar_roles" ON public.mercury_transaction_ar_closed FOR DELETE TO authenticated USING (public.is_office_staff());

DROP POLICY IF EXISTS "mercury_transaction_ar_close_labels_select_ar_roles" ON public.mercury_transaction_ar_close_labels;
CREATE POLICY "mercury_transaction_ar_close_labels_select_ar_roles" ON public.mercury_transaction_ar_close_labels FOR SELECT TO authenticated USING (public.is_office_staff());
