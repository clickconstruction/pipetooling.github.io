SET lock_timeout = '3s';

-- The trail behind a deposit in Accounts Receivable (docs/migrations/20260930230000_list_ar_deposit_trails.md):
-- every payment a deposit ever carried — the live ones from jobs_ledger_payments, the removed ones
-- from deleted_records_archive — with who applied it (the job history's actor on "Payment") and who
-- took it off (the archive's deleted_by). The client turns the rows into one line per row:
-- "→ #650 ATI Schertz today 4:02 PM by Taunya · was #878 Take 5- Seguin 9/29".
-- Read-only; gated like list_mercury_transactions_for_bank_payments, with the job-access clause of
-- list_ar_allocations_for_mercury_transaction on every job.

-- The archive is read by the deposit id inside row_data; nothing indexed that until now.
create index if not exists idx_deleted_records_archive_payment_tx
  on public.deleted_records_archive ((row_data->>'mercury_transaction_id'))
  where table_name = 'jobs_ledger_payments';

create or replace function public.list_ar_deposit_trails(p_tx_ids uuid[])
returns table(
  mercury_transaction_id uuid,
  payment_id uuid,
  live boolean,
  job_id uuid,
  job_number text,
  job_name text,
  invoice_id uuid,
  amount numeric,
  applied_at timestamptz,
  applied_by text,
  removed_at timestamptz,
  removed_by text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'list_ar_deposit_trails: not authenticated';
  end if;
  if not exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role in ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  ) then
    raise exception 'list_ar_deposit_trails: not authorized';
  end if;
  if p_tx_ids is null or cardinality(p_tx_ids) = 0 then
    return;
  end if;
  if cardinality(p_tx_ids) > 1000 then
    raise exception 'list_ar_deposit_trails: at most 1000 deposits per call';
  end if;

  return query
  with live as (
    select p.mercury_transaction_id, p.id as payment_id, true as live, p.job_id, p.invoice_id,
           p.amount::numeric as amount, p.created_at as applied_at,
           null::timestamptz as removed_at, null::uuid as removed_by
    from public.jobs_ledger_payments p
    where p.mercury_transaction_id = any(p_tx_ids)
  ), gone as (
    select (a.row_data->>'mercury_transaction_id')::uuid, (a.row_data->>'id')::uuid, false,
           (a.row_data->>'job_id')::uuid, (a.row_data->>'invoice_id')::uuid,
           (a.row_data->>'amount')::numeric, (a.row_data->>'created_at')::timestamptz,
           a.deleted_at, a.deleted_by
    from public.deleted_records_archive a
    where a.table_name = 'jobs_ledger_payments'
      and a.restored_at is null
      and (a.row_data->>'mercury_transaction_id') = any(p_tx_ids::text[])
  ), allp as (
    select * from live union all select * from gone
  )
  select r.mercury_transaction_id, r.payment_id, r.live, r.job_id,
         coalesce(nullif(j.hcp_number, ''), nullif(j.click_number, ''), '') as job_number,
         j.job_name, r.invoice_id, r.amount, r.applied_at,
         (select coalesce(nullif(u.name, ''), u.email)
            from public.job_activity_events e
            join public.users u on u.id = e.actor_user_id
           where e.event_type = 'payment_added'
             and (e.detail->>'source_id') = r.payment_id::text
           order by e.occurred_at
           limit 1) as applied_by,
         r.removed_at,
         (select coalesce(nullif(u.name, ''), u.email) from public.users u where u.id = r.removed_by) as removed_by
  from allp r
  left join public.jobs_ledger j on j.id = r.job_id
  where j.id is null
     or (j.master_user_id = auth.uid() or public.is_dev()
         or exists (select 1 from public.users where id = auth.uid() and role = 'primary')
         or public.is_office_or_estimator()
         or public.assistants_share_master(auth.uid(), j.master_user_id))
  order by r.applied_at, r.payment_id;
end;
$function$;

revoke all on function public.list_ar_deposit_trails(uuid[]) from public;
grant execute on function public.list_ar_deposit_trails(uuid[]) to authenticated;

comment on function public.list_ar_deposit_trails(uuid[]) is
  'Accounts Receivable: every payment each deposit ever carried (live, and removed from deleted_records_archive) with who applied it and who took it off — the trail line on the deposit row (v2.4277). Dev/master/assistant/controller/primary; at most 1000 ids per call.';
