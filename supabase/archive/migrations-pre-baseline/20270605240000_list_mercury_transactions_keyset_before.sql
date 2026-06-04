-- Reverse of list_mercury_transactions_keyset: returns the rows NEWER than a
-- (posted_at, id) cursor under the ledger's `posted_at desc nulls last, id desc`
-- ordering — i.e. the rows that sit ABOVE the cursor in the Ledger. Used by the
-- "Transactions around this date" modal to load the newer side of an anchor.
--
-- Ordered ascending (nearest-newer first) so a LIMIT returns the rows immediately
-- above the cursor; the client reverses them to desc for display.
--
-- "Newer than" in desc-nulls-last terms: a non-null posted_at that is greater, or
-- equal posted_at with a greater id. NULL posted_at rows sort last (oldest), so a
-- NULL-posted cursor's newer rows are every non-null row plus null rows with a
-- greater id. Mirrors 20270605180000_list_mercury_transactions_keyset.sql.

create or replace function public.list_mercury_transactions_keyset_before(
  p_before_posted_at timestamptz default null,
  p_before_id uuid default null,
  p_limit int default 20
)
returns setof public.mercury_transactions
language sql
stable
security invoker
set search_path = public
as $$
  select t.*
  from public.mercury_transactions t
  where
    p_before_id is null
    or (
      p_before_posted_at is not null and (
        t.posted_at > p_before_posted_at
        or (t.posted_at = p_before_posted_at and t.id > p_before_id)
      )
    )
    or (
      p_before_posted_at is null and (t.posted_at is not null or t.id > p_before_id)
    )
  order by t.posted_at asc nulls last, t.id asc
  limit p_limit;
$$;

grant execute on function public.list_mercury_transactions_keyset_before(timestamptz, uuid, int) to authenticated;
