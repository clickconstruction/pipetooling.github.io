-- Helper for reconciliation: given a set of Mercury transaction ids, return the
-- subset that exists in the books. Used by the `mercury-reconcile` edge function
-- so it can pass ids in the POST body (avoids the URL-length limit hit by a large
-- `mercury_id=in.(...)` GET filter).
create or replace function public.list_present_mercury_ids(p_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select mercury_id
  from public.mercury_transactions
  where mercury_id = any (p_ids)
$$;

revoke all on function public.list_present_mercury_ids(uuid[]) from public;
grant execute on function public.list_present_mercury_ids(uuid[]) to authenticated, service_role;
