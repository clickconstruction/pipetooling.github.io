-- Single scoped data source for the Banking → Mercury → User Review tab.
-- Returns one slim row per transaction in the given app-tz (America/Chicago)
-- calendar-day window, pre-joined with its attribution (user/person + names) and
-- its drag-sort / accounting label. The tab builds its users×labels pivot from
-- this instead of loading the ~15k master list + the full attributions and
-- assignments tables separately and joining them client-side.
--
-- SECURITY INVOKER so RLS on every joined table runs as the caller — the same
-- dev / master_technician / assistant gating used by
-- list_unlabeled_mercury_transactions (20260525204531) carries through.
--
-- Attributions and drag-sort assignments are both 1 row per transaction, so the
-- left joins cannot multiply rows. Columns mirror MERCURY_TRANSACTIONS_BANKING_LIST_COLUMNS
-- (omit `raw`, hydrated on demand) plus the joined attribution/label fields.
--
-- p_start_ymd NULL = 'All time' (no date filter; includes null posted_at),
-- matching filterMercuryTxByUserReviewTimeWindow's 'all' branch. Otherwise the
-- inclusive [p_start_ymd, p_end_ymd] range is compared against posted_at's
-- America/Chicago calendar date, matching the client's calendarYmdInAppTzFromIso.

create or replace function public.user_review_rows(
  p_start_ymd date default null,
  p_end_ymd   date default null
)
returns table (
  id uuid,
  amount numeric,
  counterparty_id uuid,
  counterparty_name text,
  created_at timestamptz,
  currency text,
  dashboard_link text,
  external_memo text,
  kind text,
  mercury_account_id uuid,
  mercury_category jsonb,
  mercury_id uuid,
  note text,
  posted_at timestamptz,
  status text,
  synced_at timestamptz,
  user_id uuid,
  user_name text,
  person_id uuid,
  person_name text,
  label_id uuid
)
language sql
stable
security invoker
set search_path = public
as $$
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
  where p_start_ymd is null
     or (
       t.posted_at is not null
       and (t.posted_at at time zone 'America/Chicago')::date between p_start_ymd and p_end_ymd
     )
  order by t.posted_at desc nulls last, t.id desc;
$$;

grant execute on function public.user_review_rows(date, date) to authenticated;
