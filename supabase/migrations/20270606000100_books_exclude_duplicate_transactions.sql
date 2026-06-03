-- Exclude rows marked as duplicates (duplicate_of_transaction_id is not null) from
-- the "books": the Accounting working set, the User Review pivot, and the dashboard
-- counts. The Ledger keeps showing them (struck-through) via the client, so this is
-- the full set of *server-side* reads/aggregates that must drop excluded duplicates.

create or replace function public.list_unlabeled_mercury_transactions(p_limit integer default null::integer)
returns setof mercury_transactions
language sql
stable
set search_path to 'public'
as $function$
  select t.*
  from public.mercury_transactions t
  left join public.mercury_transaction_drag_sort_assignments a
    on a.mercury_transaction_id = t.id
  where a.mercury_transaction_id is null
    and t.duplicate_of_transaction_id is null
  order by t.posted_at desc nulls last, t.id desc
  limit p_limit;
$function$;

create or replace function public.list_mercury_transactions_keyset(
  p_after_posted_at timestamp with time zone default null::timestamp with time zone,
  p_after_id uuid default null::uuid,
  p_limit integer default 500
)
returns setof mercury_transactions
language sql
stable
set search_path to 'public'
as $function$
  select t.*
  from public.mercury_transactions t
  where t.duplicate_of_transaction_id is null
    and (
      p_after_id is null
      or (
        p_after_posted_at is not null and (
          t.posted_at < p_after_posted_at
          or (t.posted_at = p_after_posted_at and t.id < p_after_id)
          or t.posted_at is null
        )
      )
      or (
        p_after_posted_at is null and t.posted_at is null and t.id < p_after_id
      )
    )
  order by t.posted_at desc nulls last, t.id desc
  limit p_limit;
$function$;

create or replace function public.user_review_rows(p_start_ymd date default null::date, p_end_ymd date default null::date)
returns table(id uuid, amount numeric, counterparty_id uuid, counterparty_name text, created_at timestamp with time zone, currency text, dashboard_link text, external_memo text, kind text, mercury_account_id uuid, mercury_category jsonb, mercury_id uuid, note text, posted_at timestamp with time zone, status text, synced_at timestamp with time zone, user_id uuid, user_name text, person_id uuid, person_name text, label_id uuid)
language sql
stable
set search_path to 'public'
as $function$
  select
    t.id, t.amount, t.counterparty_id, t.counterparty_name, t.created_at, t.currency,
    t.dashboard_link, t.external_memo, t.kind, t.mercury_account_id, t.mercury_category,
    t.mercury_id, t.note, t.posted_at, t.status, t.synced_at,
    att.user_id, u.name as user_name, att.person_id, p.name as person_name,
    a.label_id
  from public.mercury_transactions t
  left join public.mercury_transaction_attributions att on att.mercury_transaction_id = t.id
  left join public.users  u on u.id = att.user_id
  left join public.people p on p.id = att.person_id
  left join public.mercury_transaction_drag_sort_assignments a on a.mercury_transaction_id = t.id
  where t.duplicate_of_transaction_id is null
    and (
      p_start_ymd is null
      or (
        t.posted_at is not null
        and (t.posted_at at time zone 'America/Chicago')::date between p_start_ymd and p_end_ymd
      )
    )
  order by t.posted_at desc nulls last, t.id desc;
$function$;

create or replace function public.count_unlinked_mercury_transactions_for_tally()
returns bigint
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'count_unlinked_mercury_transactions_for_tally: not authenticated';
  end if;

  return (
    select count(*)::bigint
    from public.mercury_transactions t
    inner join public.mercury_debit_card_user_links l
      on l.user_id = auth.uid()
      and l.mercury_debit_card_id = public.mercury_debit_card_id_from_raw(t.raw)
    where t.duplicate_of_transaction_id is null
    and not exists (
      select 1
      from public.mercury_transaction_job_allocations m
      where m.mercury_transaction_id = t.id
    )
    and not exists (
      select 1
      from public.mercury_transaction_supply_house_invoice_links il
      where il.mercury_transaction_id = t.id
    )
  );
end;
$function$;

create or replace function public.count_unlinked_mercury_transactions_for_tally_stale(min_age_days integer default 2)
returns bigint
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  floor_ymd text;
  use_floor boolean;
  age_int integer;
begin
  if auth.uid() is null then
    raise exception 'count_unlinked_mercury_transactions_for_tally_stale: not authenticated';
  end if;

  age_int := greatest(0, min_age_days);

  select nullif(trim(both from value_text), '') into floor_ymd
  from public.app_settings
  where key = 'job_tally_min_posted_ymd';

  use_floor := floor_ymd is not null and floor_ymd ~ '^\d{4}-\d{2}-\d{2}$';

  return (
    select count(*)::bigint
    from public.mercury_transactions t
    inner join public.mercury_debit_card_user_links l
      on l.user_id = auth.uid()
      and l.mercury_debit_card_id = public.mercury_debit_card_id_from_raw(t.raw)
    where t.duplicate_of_transaction_id is null
    and not exists (
      select 1
      from public.mercury_transaction_job_allocations m
      where m.mercury_transaction_id = t.id
    )
    and not exists (
      select 1
      from public.mercury_transaction_supply_house_invoice_links il
      where il.mercury_transaction_id = t.id
    )
    and (
      not use_floor
      or (
        t.posted_at is not null
        and to_char(t.posted_at at time zone 'America/Chicago', 'YYYY-MM-DD') >= floor_ymd
      )
    )
    and t.posted_at is not null
    and (
      (now() at time zone 'America/Chicago')::date
      - (t.posted_at at time zone 'America/Chicago')::date
    ) > age_int
  );
end;
$function$;

create or replace function public.count_mercury_transactions_for_bank_payments(p_filter jsonb default null::jsonb)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
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
      and u.role in ('dev', 'master_technician', 'assistant', 'primary')
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
