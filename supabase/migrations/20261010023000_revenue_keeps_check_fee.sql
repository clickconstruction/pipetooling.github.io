SET lock_timeout = '3s';

-- v2.5091: every rewrite of a job's revenue from its line items keeps a returned check's fee.
--
-- add_ar_return_case_fee (v2.5033, 20261010003000) puts the $30 a returned check costs on the bill the check paid
-- (jobs_ledger_invoices.amount and fee_lines) and raises jobs_ledger.revenue by the same $30, as
-- create_hazmat_fee_incident does for a hazmat fee. Four writers then set the revenue from the line items again,
-- and none of them knew the fee:
--   - Edit Job's billing save (the client): the line items plus the hazmat riders;
--   - apply_job_discount (Bill Customer, Add discount): the line items plus the un-voided hazmat fees;
--   - record_job_tip_from_deposit (Accounts Receivable, a deposit's leftover as a Tip): the same sum;
--   - add_collect_payment_fixture_from_job_book (the field's Collect Payment): the line items alone.
-- The first of them to run after the fee wrote its $30 away while the bill kept it, so the job's total no longer
-- covered its bills. The client is fixed beside this file (jobFormRiderFeesDollars); this file fixes the three
-- functions.
--
-- 1. job_rider_fees(job): the riders, the fees that ride on a job beyond its line items. They are its un-voided
--    hazmat fees and every returned check fee on its bills (a fee_lines entry that names its case). The client's
--    twin is jobFormRiderFeesDollars (src/lib/jobs/jobFormMoneyTotals.ts).
-- 2.-4. The three functions, each restated byte for byte from its latest definition but for its revenue sum, which
--    now adds job_rider_fees. add_collect_payment_fixture_from_job_book counted the line items alone, so it also
--    stops dropping a hazmat fee, the rewrite v2.1029 fixed in the client.
--
-- Left as it is: gc_owner_billing_revenue keeps a GC billing job at the contract plus the interest billed. Its SQL
-- is lifted byte for byte from spike/gc-mode, so a returned check fee on that job's bill is the GC crew's to add.
-- Each function keeps its signature, so CREATE OR REPLACE keeps its grants and its comment. No table is created or
-- altered.

-- 1 ---------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.job_rider_fees(p_job_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    coalesce((SELECT sum(h.fee_amount)
              FROM public.job_hazmat_incidents h
              WHERE h.job_id = p_job_id AND h.voided_at IS NULL), 0)
    + coalesce((SELECT sum(CASE
                             WHEN jsonb_typeof(l->'case_id') = 'string' AND btrim(l->>'case_id') <> ''
                              AND (jsonb_typeof(l->'amount') = 'number'
                                   OR (jsonb_typeof(l->'amount') = 'string' AND btrim(l->>'amount') ~ '^[0-9]+(\.[0-9]+)?$'))
                             THEN greatest(round(btrim(l->>'amount')::numeric, 2), 0)
                           END)
                FROM public.jobs_ledger_invoices i
                CROSS JOIN LATERAL jsonb_array_elements(
                  CASE WHEN jsonb_typeof(i.fee_lines) = 'array' THEN i.fee_lines ELSE '[]'::jsonb END
                ) AS l
                WHERE i.job_id = p_job_id), 0)
$function$;

COMMENT ON FUNCTION public.job_rider_fees(uuid) IS
  'v2.5091: the riders, the fees that ride on a job beyond its line items: its un-voided hazmat fees and every returned check fee on its bills (a jobs_ledger_invoices.fee_lines entry that names its case). Every rewrite of jobs_ledger.revenue from the line items adds it. The client twin is jobFormRiderFeesDollars.';

REVOKE ALL ON FUNCTION public.job_rider_fees(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_rider_fees(uuid) TO authenticated, service_role;

-- 2 ---------------------------------------------------------------------------------------------------------
-- apply_job_discount, restated byte for byte from 20260911000000 but for its revenue sum.

create or replace function public.apply_job_discount(
  p_job_id uuid,
  p_name text,
  p_pct numeric,
  p_dollars numeric,
  p_basis_positions integer[],
  p_reason text,
  p_draft_amounts jsonb default '[]'::jsonb,
  p_summary text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_seq integer;
  v_revenue numeric;
  v_dollars numeric := round(coalesce(p_dollars, 0)::numeric, 2);
  v_draft jsonb;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role = any (array['dev', 'master_technician', 'assistant', 'controller']::user_role[])
  ) then
    raise exception 'not allowed';
  end if;
  if not public.can_read_job_activity(p_job_id, false) then
    raise exception 'not allowed';
  end if;
  if v_dollars <= 0 then
    raise exception 'a discount needs an amount';
  end if;
  if p_pct is not null and (p_pct < 0 or p_pct > 100) then
    raise exception 'percent out of range';
  end if;

  select coalesce(max(sequence_order), -1) + 1 into v_seq
  from public.jobs_ledger_fixtures where job_id = p_job_id;

  insert into public.jobs_ledger_fixtures
    (job_id, name, count, sequence_order, line_unit_price, line_description, invoice_id,
     stage_kind, shared_with_gc, line_kind, discount_pct, discount_basis_positions, discount_reason)
  values
    (p_job_id, left(coalesce(nullif(btrim(p_name), ''), 'Discount'), 200), 1, v_seq, -v_dollars, null, null,
     null, false, 'discount', p_pct, p_basis_positions, nullif(btrim(coalesce(p_reason, '')), ''))
  returning id into v_id;

  -- Revenue = named rows' count × price (discount rows are negative) + the riders: un-voided
  -- hazmat fees and returned check fees (job_rider_fees, v2.5091).
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

  for v_draft in select * from jsonb_array_elements(coalesce(p_draft_amounts, '[]'::jsonb)) loop
    update public.jobs_ledger_invoices
      set amount = round((v_draft ->> 'amount')::numeric, 2)
      where id = (v_draft ->> 'invoice_id')::uuid
        and job_id = p_job_id
        and status = 'ready_to_bill';
  end loop;

  insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  values (
    p_job_id, 'discount_added', now(), auth.uid(),
    left(coalesce(nullif(btrim(p_summary), ''), 'Discount added: ' || coalesce(nullif(btrim(p_name), ''), 'Discount')), 500),
    jsonb_build_object('name', p_name, 'pct', p_pct, 'dollars', v_dollars, 'source', 'bill_customer', 'fixture_id', v_id),
    true
  );

  return jsonb_build_object('ok', true, 'fixture_id', v_id, 'revenue', v_revenue);
end;
$$;

-- 3 ---------------------------------------------------------------------------------------------------------
-- record_job_tip_from_deposit, restated byte for byte from 20260916060000 but for its revenue sum.

CREATE OR REPLACE FUNCTION public.record_job_tip_from_deposit(
  p_mercury_transaction_id uuid,
  p_job_id uuid,
  p_amount numeric,
  p_payment_type text DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS jsonb
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
      and u.role in ('dev', 'master_technician', 'assistant', 'primary')
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
        or exists (select 1 from public.users where id = auth.uid() and role = 'primary')
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

-- 4 ---------------------------------------------------------------------------------------------------------
-- add_collect_payment_fixture_from_job_book, restated byte for byte from 20260902152109 but for its revenue
-- sum, which counted the line items alone.

CREATE OR REPLACE FUNCTION "public"."add_collect_payment_fixture_from_job_book"("p_job_id" "uuid", "p_job_book_entry_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_entry record;
  v_job_st uuid;
  v_next_seq int;
  v_rev numeric;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = v_uid;
  IF v_role IS NULL OR v_role NOT IN ('subcontractor', 'helpers', 'superintendent') THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs_ledger_team_members jtm
    INNER JOIN public.jobs_ledger jl ON jl.id = jtm.job_id
    WHERE jtm.user_id = v_uid
      AND jl.id = p_job_id
      AND jl.status = 'ready_to_bill'
  ) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT b.service_type_id INTO v_job_st
  FROM public.jobs_ledger jl
  LEFT JOIN public.bids b ON b.id = jl.bid_id
  WHERE jl.id = p_job_id;

  SELECT jbe.id, jbe.work_label, jbe.unit_cost, jbe.service_type_id
  INTO v_entry
  FROM public.job_book_entries jbe
  WHERE jbe.id = p_job_book_entry_id;

  IF v_entry.id IS NULL THEN
    RETURN jsonb_build_object('error', 'job_book_entry_not_found');
  END IF;

  IF v_entry.service_type_id IS NOT NULL
     AND (v_job_st IS DISTINCT FROM v_entry.service_type_id) THEN
    RETURN jsonb_build_object('error', 'job_book_entry_service_type_mismatch');
  END IF;

  SELECT COALESCE(MAX(f.sequence_order), -1) + 1 INTO v_next_seq
  FROM public.jobs_ledger_fixtures f
  WHERE f.job_id = p_job_id;

  INSERT INTO public.jobs_ledger_fixtures (
    job_id,
    name,
    count,
    line_unit_price,
    line_description,
    sequence_order
  ) VALUES (
    p_job_id,
    trim(v_entry.work_label),
    1,
    ROUND(v_entry.unit_cost::numeric, 2),
    NULL,
    v_next_seq
  );

  -- The line items plus the riders: un-voided hazmat fees and returned check fees (job_rider_fees,
  -- v2.5091), as every other rewrite of the revenue from the line items counts them.
  SELECT ROUND(COALESCE(SUM(
    CASE
      WHEN trim(COALESCE(f.name, '')) = '' THEN 0::numeric
      ELSE
        (CASE WHEN f.count > 0 THEN f.count::numeric ELSE 1::numeric END)
        * COALESCE(f.line_unit_price, 0::numeric)
    END
  ), 0::numeric) + public.job_rider_fees(p_job_id), 2)
  INTO v_rev
  FROM public.jobs_ledger_fixtures f
  WHERE f.job_id = p_job_id;

  UPDATE public.jobs_ledger jl
  SET revenue = v_rev
  WHERE jl.id = p_job_id;

  RETURN jsonb_build_object('ok', true, 'revenue', v_rev);
END;
$$;
