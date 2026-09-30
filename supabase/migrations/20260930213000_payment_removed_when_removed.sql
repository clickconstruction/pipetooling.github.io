SET lock_timeout = '3s';

-- "Payment removed" in a job's history is stamped when the payment was removed,
-- not when it was added (docs/migrations/20260930213000_payment_removed_when_removed.md).
--
-- Rewritten from the live body (pg_get_functiondef, read 2026-09-30). Changes:
--   * DELETE stamps occurred_at = now() (was coalesce(old.created_at, now()), so a
--     removal sat on the same instant as its add and read as an instant undo).
--   * DELETE is no longer deduped on (event_type, source_id): a row is deleted once
--     per life, and the old guard hid a second removal after a dev restore.
--   * INSERT keeps created_at and its idempotency guard, but a payment that comes back
--     with the same id after a logged removal (restore_deleted_records) logs a fresh
--     "Payment" at now().
-- Everything else (summary text, detail, actor, the jobs_ledger existence check) is as live.

create or replace function public.jobs_ledger_payments_to_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r public.jobs_ledger_payments%rowtype;
  v_type text;
  v_qual text;
  v_summary text;
  v_at timestamptz;
  v_adds int;
  v_removals int;
begin
  if tg_op = 'DELETE' then r := old; v_type := 'payment_removed'; else r := new; v_type := 'payment_added'; end if;
  v_qual := nullif(
    concat_ws(' · ', nullif(trim(coalesce(r.payment_type, '')), ''), nullif(trim(coalesce(r.reference_number, '')), '')),
    ''
  );
  v_summary := (case when v_type = 'payment_removed' then 'Payment removed ' else 'Payment ' end)
    || '$' || to_char(coalesce(r.amount, 0), 'FM999,999,990.00')
    || coalesce(' (' || v_qual || ')', '');

  if v_type = 'payment_removed' then
    v_at := now();
  else
    -- One add and one removal per life of the row; counted, not ordered, because a delete
    -- and a re-insert in one transaction share the same now().
    select count(*) filter (where e.event_type = 'payment_added'),
           count(*) filter (where e.event_type = 'payment_removed')
      into v_adds, v_removals
    from public.job_activity_events e
    where e.event_type in ('payment_added', 'payment_removed')
      and e.detail ->> 'source_id' = r.id::text;
    if v_adds > v_removals then
      return r;  -- already logged for this life of the row
    end if;
    v_at := case when v_removals > 0 then now() else coalesce(r.created_at, now()) end;
  end if;

  insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  select r.job_id, v_type, v_at, auth.uid(), v_summary,
         jsonb_build_object('amount', r.amount, 'payment_type', r.payment_type, 'source_id', r.id::text),
         true
  where exists (select 1 from public.jobs_ledger jl where jl.id = r.job_id);
  return r;
end;
$function$;

-- One-time correction: re-date existing removals to the moment the payment was
-- deleted, from its deleted_records_archive row. Only events still carrying the bug's
-- stamp (occurred_at = the archived row's created_at) with exactly one archived
-- deletion are touched, so a re-run is a no-op. Removals from before the archive
-- existed (2026-07-18) have no deletion time on record and keep their stamp.
update public.job_activity_events e
set occurred_at = d.deleted_at
from public.deleted_records_archive d
where e.event_type = 'payment_removed'
  and d.table_name = 'jobs_ledger_payments'
  and d.record_id = e.detail ->> 'source_id'
  and e.occurred_at = (d.row_data ->> 'created_at')::timestamptz
  and d.deleted_at > e.occurred_at
  and (select count(*) from public.deleted_records_archive d2
       where d2.table_name = 'jobs_ledger_payments' and d2.record_id = d.record_id) = 1;
