SET lock_timeout = '3s';

-- v2.3496 — Accounts Receivable: record a deposit's leftover as a Tip on the job.
--
-- Why this exists: a customer who pays more than their bills leaves a remainder on the
-- Mercury deposit, and `apply_mercury_bank_payment_allocations` cannot take it — its job
-- branch requires `status = 'billed'` with `revenue - payments_made` headroom, and a fully
-- paid job has neither. The office's workaround request was to file the money on the Office
-- job (J000), which is refused by those same guards and would pollute the overhead anchor.
--
-- A tip is not a payment against a bill, so it does not go through the allocation RPC. It is
-- revenue on the job that earned it, exactly how the HouseCall Pro tips sweep already records
-- one: an ordinary `work` line named "Tip" plus a job-level payment. This function does both
-- in one transaction so a half-failure cannot leave a line with no payment, or the reverse.
--
-- Body modelled on `public.apply_job_discount` (same operation, opposite sign); role and job
-- access gates modelled on `public.apply_mercury_bank_payment_allocations` so nobody gains a
-- capability they do not already have in Accounts Receivable.
--
-- Deliberately NOT done here:
--   * no new `line_kind` — the CHECK admits only work/discount and 36 files branch on it;
--   * no custom activity event — the fixture and payment triggers already write
--     `fixture_added` ("Specific work added: Tip") and `payment_added`;
--   * `jobs_ledger.payments_made` is never written, the B3 trigger owns it;
--   * `jobs_ledger.status` is left alone — a tip raises revenue and payments by the same
--     amount, so a job's coverage cannot change.

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
  -- arithmetic as apply_job_discount (named rows x price, plus un-voided hazmat fees).
  select round(
           coalesce((
             select sum((case when coalesce(f.count, 0) > 0 then f.count else 1 end) * coalesce(f.line_unit_price, 0))
             from public.jobs_ledger_fixtures f
             where f.job_id = p_job_id and coalesce(btrim(f.name), '') <> ''
           ), 0)
           + coalesce((select sum(h.fee_amount) from public.job_hazmat_incidents h
                       where h.job_id = p_job_id and h.voided_at is null), 0)
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

COMMENT ON FUNCTION public.record_job_tip_from_deposit(uuid, uuid, numeric, text, text) IS
  'Accounts Receivable (v2.3496): record a bank deposit''s unapplied remainder as a Tip work line on a job plus a job-level payment, in one transaction. Capped at the deposit remainder. Revenue is recomputed, never incremented; payments_made and status are left to their triggers.';

REVOKE ALL ON FUNCTION public.record_job_tip_from_deposit(uuid, uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_job_tip_from_deposit(uuid, uuid, numeric, text, text) TO authenticated, service_role;
