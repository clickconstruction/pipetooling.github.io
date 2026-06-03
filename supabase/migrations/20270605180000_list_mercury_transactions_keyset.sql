-- Keyset-paginated page reader for the Banking → Mercury → Accounting tab's
-- "show labeled" (Hide labeled = off) view. Returns mercury_transactions in the
-- same order the Banking page renders the master list, starting *after* a
-- (posted_at, id) cursor, so the client can infinite-scroll instead of pulling
-- the full ~15k master list at once.
--
-- SECURITY INVOKER so RLS runs as the caller — the existing
-- dev / master_technician / assistant gating on mercury_transactions carries
-- through, identical to list_unlabeled_mercury_transactions
-- (20260525204531_list_unlabeled_mercury_transactions.sql).
--
-- Cursor semantics for `order by posted_at desc nulls last, id desc`:
--   * first page  → p_after_id NULL, returns from the top.
--   * cursor in the non-null posted_at region (p_after_posted_at not null):
--       later rows are those with a smaller posted_at, the same posted_at with a
--       smaller id, or any null-posted_at row (the NULLS LAST tail).
--   * cursor already in the null-posted_at tail (p_after_posted_at null but
--       p_after_id set): later rows are null-posted_at rows with a smaller id.

create or replace function public.list_mercury_transactions_keyset(
  p_after_posted_at timestamptz default null,
  p_after_id uuid default null,
  p_limit int default 500
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
  order by t.posted_at desc nulls last, t.id desc
  limit p_limit;
$$;

grant execute on function public.list_mercury_transactions_keyset(timestamptz, uuid, int) to authenticated;
