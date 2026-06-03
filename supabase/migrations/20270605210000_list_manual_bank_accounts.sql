-- Summary of manually-imported (CSV) bank accounts for the Banking "Manual
-- accounts" manager. One row per synthetic account that holds source='manual'
-- transactions: its current name (nickname), transaction count, net total, and
-- date range. SECURITY INVOKER so the caller's RLS on both tables applies (the
-- same dev / master_technician / assistant gating used elsewhere).

create or replace function public.list_manual_bank_accounts()
returns table (
  mercury_account_id uuid,
  name text,
  tx_count bigint,
  net_total numeric,
  oldest_posted timestamptz,
  newest_posted timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    t.mercury_account_id,
    n.nickname as name,
    count(*) as tx_count,
    coalesce(sum(t.amount), 0) as net_total,
    min(t.posted_at) as oldest_posted,
    max(t.posted_at) as newest_posted
  from public.mercury_transactions t
  left join public.mercury_account_nicknames n on n.mercury_account_id = t.mercury_account_id
  where t.source = 'manual'
  group by t.mercury_account_id, n.nickname
  order by max(t.posted_at) desc nulls last;
$$;

grant execute on function public.list_manual_bank_accounts() to authenticated;
