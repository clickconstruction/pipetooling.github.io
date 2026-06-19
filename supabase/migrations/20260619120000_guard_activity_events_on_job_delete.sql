-- Guard the two AFTER DELETE activity-event triggers so they don't try to log a
-- "removed" event when the parent job is already gone (i.e. during a full-job
-- cascade delete).
--
-- Bug: deleting a row from jobs_ledger cascade-deletes its jobs_ledger_payments
-- and jobs_ledger_team_members rows. Those tables have AFTER DELETE triggers
-- (jobs_ledger_payments_to_activity_del / jobs_ledger_team_members_to_activity_del)
-- that INSERT a payment_removed / crew_removed row into job_activity_events. By the
-- time they fire, the parent jobs_ledger row is gone, so the new row violates
-- job_activity_events_job_id_fkey (FK 23503).
--
-- Fix: add an "EXISTS (job still in jobs_ledger)" guard to each insert. It is a
-- no-op on the INSERT path (a payment/crew row can't exist without its parent job)
-- and correctly suppresses the spurious event during a full-job delete — we don't
-- want removal events when the whole activity ledger for that job is cascade-deleted
-- anyway. Both functions are shared by their INSERT and DELETE triggers (they branch
-- on tg_op); replacing the function updates it in place, so no trigger DDL is needed.

-- Payments: added (INSERT) / removed (DELETE). Financial.
create or replace function public.jobs_ledger_payments_to_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.jobs_ledger_payments%rowtype;
  v_type text;
  v_qual text;
  v_summary text;
begin
  if tg_op = 'DELETE' then r := old; v_type := 'payment_removed'; else r := new; v_type := 'payment_added'; end if;
  v_qual := nullif(
    concat_ws(' · ', nullif(trim(coalesce(r.payment_type, '')), ''), nullif(trim(coalesce(r.reference_number, '')), '')),
    ''
  );
  v_summary := (case when v_type = 'payment_removed' then 'Payment removed ' else 'Payment ' end)
    || '$' || to_char(coalesce(r.amount, 0), 'FM999,999,990.00')
    || coalesce(' (' || v_qual || ')', '');
  insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  select r.job_id, v_type, coalesce(r.created_at, now()), auth.uid(), v_summary,
         jsonb_build_object('amount', r.amount, 'payment_type', r.payment_type, 'source_id', r.id::text),
         true
  where not exists (
    select 1 from public.job_activity_events e
    where e.event_type = v_type and e.detail ->> 'source_id' = r.id::text
  )
    and exists (select 1 from public.jobs_ledger jl where jl.id = r.job_id);
  return r;
end;
$$;

-- Crew: added (INSERT) / removed (DELETE). Operational.
create or replace function public.jobs_ledger_team_members_to_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.jobs_ledger_team_members%rowtype;
  v_type text;
  v_name text;
begin
  if tg_op = 'DELETE' then r := old; v_type := 'crew_removed'; else r := new; v_type := 'crew_added'; end if;
  select u.name into v_name from public.users u where u.id = r.user_id;
  v_name := coalesce(nullif(trim(coalesce(v_name, '')), ''), 'Someone');
  insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  select r.job_id, v_type, coalesce(r.created_at, now()), auth.uid(),
         v_name || (case when v_type = 'crew_removed' then ' removed from crew' else ' added to crew' end),
         jsonb_build_object('user_id', r.user_id, 'source_id', r.id::text), false
  where not exists (
    select 1 from public.job_activity_events e
    where e.event_type = v_type and e.detail ->> 'source_id' = r.id::text
  )
    and exists (select 1 from public.jobs_ledger jl where jl.id = r.job_id);
  return r;
end;
$$;
