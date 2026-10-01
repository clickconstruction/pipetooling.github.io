SET lock_timeout = '3s';

-- v2.4313 — punch list #76 PR 1: a check that came back can pay no bill.
--
-- 1. A guard on jobs_ledger_payments. Linking a payment to a deposit the bank
--    failed (mercury_transactions.status = 'failed'), or to one a person marked
--    returned (mercury_transaction_ar_returned.returned), raises. Every path that
--    puts a deposit on a bill writes this column — the Accounts Receivable apply
--    (apply_mercury_bank_payment_allocations, its sweep and its Link that payment
--    instead), the tip (record_job_tip_from_deposit) — so one trigger covers them
--    all without rewriting the 350-line apply. Before, a returned deposit left To
--    match but could still be applied from All or the search: Loberg's stopped
--    $5,622.49 offered #650's bills on 2026-10-01.
--    An UPDATE that keeps the same deposit passes, so a payment already on a check
--    that bounced later can still be edited and taken off.
-- 2. count_mercury_transactions_for_bank_payments (the Pipeline's "Allocate N bank
--    deposits") leaves out a deposit the bank failed — the list already did, so the
--    count said 1 while To match was empty. Body from 20260927230000, one clause added.

CREATE OR REPLACE FUNCTION public.jobs_ledger_payments_refuse_returned_deposit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.mercury_transaction_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.mercury_transaction_id IS NOT DISTINCT FROM OLD.mercury_transaction_id THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
       SELECT 1 FROM public.mercury_transactions t
       WHERE t.id = NEW.mercury_transaction_id AND t.status = 'failed'
     )
     OR EXISTS (
       SELECT 1 FROM public.mercury_transaction_ar_returned r
       WHERE r.mercury_transaction_id = NEW.mercury_transaction_id AND r.returned
     ) THEN
    RAISE EXCEPTION 'This check came back, so it cannot pay a bill.'
      USING ERRCODE = 'P0001', HINT = 'returned_deposit';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.jobs_ledger_payments_refuse_returned_deposit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS jobs_ledger_payments_refuse_returned_deposit ON public.jobs_ledger_payments;
CREATE TRIGGER jobs_ledger_payments_refuse_returned_deposit
  BEFORE INSERT OR UPDATE OF mercury_transaction_id ON public.jobs_ledger_payments
  FOR EACH ROW EXECUTE FUNCTION public.jobs_ledger_payments_refuse_returned_deposit();

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
    -- v2.4313: a check the bank sent back is not money to match (it already leaves the list).
    and (v_include_hidden or t.status is distinct from 'failed')
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

