-- The Dashboard Tally badge count ignored the global sorting start date
-- (app_settings.job_tally_min_posted_ymd), so it counted the caller's entire
-- unlinked history (99+) while the Tally page — which hides rows posted before
-- the floor — showed only the actionable few. The stale-count sibling already
-- applies the floor; this brings count_unlinked_mercury_transactions_for_tally
-- in line. Body is the 20260709160000 version verbatim plus the floor clause
-- (copied from the stale variant, same America/Chicago day semantics).

CREATE OR REPLACE FUNCTION public.count_unlinked_mercury_transactions_for_tally() RETURNS bigint
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  floor_ymd text;
  use_floor boolean;
begin
  if auth.uid() is null then
    raise exception 'count_unlinked_mercury_transactions_for_tally: not authenticated';
  end if;

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
    and not exists (
      select 1
      from public.mercury_tally_payroll_flags pf
      where pf.mercury_transaction_id = t.id
      and pf.is_payroll
    )
    and (
      not use_floor
      or (
        t.posted_at is not null
        and to_char(t.posted_at at time zone 'America/Chicago', 'YYYY-MM-DD') >= floor_ymd
      )
    )
  );
end;
$_$;

COMMENT ON FUNCTION public.count_unlinked_mercury_transactions_for_tally() IS
  'Count of Mercury transactions on the caller''s linked debit card(s) with no job allocations, no supply-house invoice links, no payroll mark, posted on/after the global sorting start date when set (matches Job Tally Show unlinked).';
