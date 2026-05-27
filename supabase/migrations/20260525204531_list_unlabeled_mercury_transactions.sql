-- Server-side anti-join RPC for the Banking → Mercury → Accounting tab.
-- Returns mercury_transactions rows that have NO matching
-- mercury_transaction_drag_sort_assignments row, ordered the same way the
-- Banking page renders the master list.
--
-- SECURITY INVOKER so RLS on both tables runs as the caller — existing
-- dev / master_technician / assistant gating on mercury_transactions
-- carries through. p_limit defaults to NULL which Postgres treats as
-- "no limit" so the function can return all unlabeled rows.
--
-- The anti-join hits the primary key index on
-- mercury_transaction_drag_sort_assignments(mercury_transaction_id) (PK
-- declared in 20260502224616_mercury_drag_sort_org_wide_labels.sql), so no
-- new index is needed.

create or replace function public.list_unlabeled_mercury_transactions(p_limit int default null)
returns setof public.mercury_transactions
language sql
stable
security invoker
set search_path = public
as $$
  select t.*
  from public.mercury_transactions t
  left join public.mercury_transaction_drag_sort_assignments a
    on a.mercury_transaction_id = t.id
  where a.mercury_transaction_id is null
  order by t.posted_at desc nulls last, t.id desc
  limit p_limit;
$$;

grant execute on function public.list_unlabeled_mercury_transactions(int) to authenticated;
