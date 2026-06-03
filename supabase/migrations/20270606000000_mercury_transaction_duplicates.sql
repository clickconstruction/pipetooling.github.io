-- Possible-duplicate Mercury transactions: detection + non-destructive exclusion.
--
-- Ingest already dedupes the *same* Mercury transaction (UNIQUE mercury_id). This
-- adds business-level detection of two *distinct* rows that represent the same
-- real-world charge (most often a source='manual' row mirroring a synced one),
-- plus a reversible "mark as duplicate" that excludes the row from the books.

-- 1. Exclusion pointer: non-null => this row is an excluded duplicate of the keeper.
alter table public.mercury_transactions
  add column if not exists duplicate_of_transaction_id uuid null
    references public.mercury_transactions (id) on delete set null;

create index if not exists mercury_transactions_duplicate_of_idx
  on public.mercury_transactions (duplicate_of_transaction_id)
  where duplicate_of_transaction_id is not null;

-- Speeds up the detection self-join (amount + normalized counterparty).
create index if not exists mercury_transactions_amount_cp_norm_idx
  on public.mercury_transactions (amount, lower(btrim(coalesce(counterparty_name, ''))));

-- 2. "Not a duplicate" decisions, keyed by canonical-ordered pair so a dismissed
--    pair never re-surfaces from the detector.
create table if not exists public.mercury_transaction_duplicate_dismissals (
  id_lo uuid not null references public.mercury_transactions (id) on delete cascade,
  id_hi uuid not null references public.mercury_transactions (id) on delete cascade,
  dismissed_by uuid references auth.users (id),
  dismissed_at timestamptz not null default now(),
  primary key (id_lo, id_hi),
  constraint mercury_dup_dismissals_order check (id_lo < id_hi)
);

alter table public.mercury_transaction_duplicate_dismissals enable row level security;

create policy "mercury_dup_dismissals_select_banking"
  on public.mercury_transaction_duplicate_dismissals
  for select
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.role in ('dev', 'master_technician', 'assistant')
    )
  );

grant select on public.mercury_transaction_duplicate_dismissals to authenticated;
grant all on public.mercury_transaction_duplicate_dismissals to service_role;

-- 3. Detector: conservative candidate pairs. Exact same-sign amount (sign is
--    implicit in amount equality), equal non-empty normalized counterparty, within
--    p_window_days (the window is what stops legit recurring monthly charges from
--    matching), excluding internal transfers, already-resolved rows, and dismissed
--    pairs. security invoker => RLS on mercury_transactions gates to banking roles.
--
--    p_manual_only (default true): restrict to pairs where one side is a manual
--    entry — the real duplicate vector (a hand-keyed row colliding with a synced
--    one). Same amount + same counterparty within a few days between two *synced*
--    rows is overwhelmingly legitimate repeat spend (e.g. two same-price fuel
--    fills), so those are opt-in. p_limit caps the payload (manual-first ordering).
create or replace function public.find_possible_duplicate_mercury_transactions(
  p_window_days int default 3,
  p_manual_only boolean default true,
  p_limit int default 500
)
returns table (
  a_id uuid, a_amount numeric, a_counterparty_name text, a_posted_at timestamptz,
  a_created_at timestamptz, a_kind text, a_mercury_account_id uuid, a_source text, a_raw jsonb,
  b_id uuid, b_amount numeric, b_counterparty_name text, b_posted_at timestamptz,
  b_created_at timestamptz, b_kind text, b_mercury_account_id uuid, b_source text, b_raw jsonb,
  manual_involved boolean, days_apart int
)
language sql
stable
security invoker
set search_path = public
as $$
  -- Eligible rows once, with the normalized counterparty + effective timestamp.
  with base as (
    select
      t.id, t.amount, t.source,
      lower(btrim(coalesce(t.counterparty_name, ''))) as cpn,
      coalesce(t.posted_at, t.created_at) as ts
    from public.mercury_transactions t
    where t.kind <> 'internalTransfer'
      and t.duplicate_of_transaction_id is null
      and lower(btrim(coalesce(t.counterparty_name, ''))) <> ''
  ),
  -- Seed from the small side (manual rows by default) and join to matching rows,
  -- with the date window IN the join so the planner prunes instead of
  -- enumerating every same-amount/counterparty pair. Canonical-ordered + distinct.
  seeds as (
    select * from base where (not p_manual_only or source = 'manual')
  ),
  cand as (
    select distinct least(s.id, t.id) as lo, greatest(s.id, t.id) as hi
    from seeds s
    join base t
      on t.amount = s.amount
     and t.cpn = s.cpn
     and t.id <> s.id
     and abs(extract(epoch from (s.ts - t.ts))) <= (greatest(p_window_days, 0) * 86400)
  )
  select
    a.id, a.amount, a.counterparty_name, a.posted_at, a.created_at, a.kind, a.mercury_account_id, a.source, a.raw,
    b.id, b.amount, b.counterparty_name, b.posted_at, b.created_at, b.kind, b.mercury_account_id, b.source, b.raw,
    (a.source = 'manual' or b.source = 'manual') as manual_involved,
    (abs(extract(epoch from (coalesce(a.posted_at, a.created_at) - coalesce(b.posted_at, b.created_at)))) / 86400)::int as days_apart
  from cand c
  join public.mercury_transactions a on a.id = c.lo
  join public.mercury_transactions b on b.id = c.hi
  where not exists (
      select 1 from public.mercury_transaction_duplicate_dismissals d
      where d.id_lo = c.lo and d.id_hi = c.hi
    )
  order by manual_involved desc, coalesce(a.posted_at, a.created_at) desc, a.id
  limit greatest(p_limit, 0);
$$;

revoke all on function public.find_possible_duplicate_mercury_transactions(int, boolean, int) from public;
grant execute on function public.find_possible_duplicate_mercury_transactions(int, boolean, int) to authenticated;

-- 4. Mutations (security definer, banking-role gated).
create or replace function public.set_mercury_transaction_duplicate(p_duplicate_id uuid, p_keeper_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'set_mercury_transaction_duplicate: not authenticated';
  end if;
  if not exists (
    select 1 from public.users u
    where u.id = uid and u.role in ('dev', 'master_technician', 'assistant')
  ) then
    raise exception 'set_mercury_transaction_duplicate: not authorized';
  end if;
  if p_duplicate_id = p_keeper_id then
    raise exception 'set_mercury_transaction_duplicate: a transaction cannot be a duplicate of itself';
  end if;
  if not exists (select 1 from public.mercury_transactions where id = p_keeper_id) then
    raise exception 'set_mercury_transaction_duplicate: keeper transaction not found';
  end if;
  -- No chains: the keeper must not itself be marked a duplicate.
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
$$;

revoke all on function public.set_mercury_transaction_duplicate(uuid, uuid) from public;
grant execute on function public.set_mercury_transaction_duplicate(uuid, uuid) to authenticated;

create or replace function public.clear_mercury_transaction_duplicate(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'clear_mercury_transaction_duplicate: not authenticated';
  end if;
  if not exists (
    select 1 from public.users u
    where u.id = uid and u.role in ('dev', 'master_technician', 'assistant')
  ) then
    raise exception 'clear_mercury_transaction_duplicate: not authorized';
  end if;
  update public.mercury_transactions
    set duplicate_of_transaction_id = null
    where id = p_id;
end;
$$;

revoke all on function public.clear_mercury_transaction_duplicate(uuid) from public;
grant execute on function public.clear_mercury_transaction_duplicate(uuid) to authenticated;

create or replace function public.dismiss_mercury_duplicate_pair(p_id_a uuid, p_id_b uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
    where u.id = uid and u.role in ('dev', 'master_technician', 'assistant')
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
$$;

revoke all on function public.dismiss_mercury_duplicate_pair(uuid, uuid) from public;
grant execute on function public.dismiss_mercury_duplicate_pair(uuid, uuid) to authenticated;
