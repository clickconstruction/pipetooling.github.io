SET lock_timeout = '3s';

-- Discount line items PR 4 (v2.3256): the trail.
--
-- 1. log_job_discount_event — the office's client logs discount_added /
--    discount_changed / discount_removed into job_activity_events when a
--    save actually changes a discount (the client diffs the persisted
--    snapshot; the delete+reinsert save engine makes a row trigger useless
--    for "changed"). Financial events; the same audience the write-down
--    events have. Gate: signed in, an office role, and able to read the job.
-- 2. jobs_ledger_fixtures_to_activity — skip discount rows: every autosave
--    reinserts the job's rows with fresh ids, so the existing "Specific work
--    added: <name>" dedupe (by source_id) would re-log the discount on every
--    save. Work rows keep the trigger exactly as before (body reproduced
--    from the live definition, 20260608010000, with the one added guard).

create or replace function public.log_job_discount_event(
  p_job_id uuid,
  p_event_type text,
  p_summary text,
  p_detail jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_event_type not in ('discount_added', 'discount_changed', 'discount_removed') then
    raise exception 'unknown discount event: %', p_event_type;
  end if;
  if not exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role = any (array['dev', 'master_technician', 'assistant', 'controller']::user_role[])
  ) then
    raise exception 'not allowed';
  end if;
  if not public.can_read_job_activity(p_job_id, false) then
    raise exception 'not allowed';
  end if;
  insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  values (p_job_id, p_event_type, now(), auth.uid(), left(coalesce(p_summary, ''), 500), coalesce(p_detail, '{}'::jsonb), true)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.log_job_discount_event(uuid, text, text, jsonb) from public, anon;
grant execute on function public.log_job_discount_event(uuid, text, text, jsonb) to authenticated;

comment on function public.log_job_discount_event(uuid, text, text, jsonb) is
  'Discount line items (v2.3256): the client logs discount_added / discount_changed / discount_removed after a save that changed a discount row. Office roles only; financial event.';

create or replace function public.jobs_ledger_fixtures_to_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  select new.job_id, 'fixture_added', coalesce(new.created_at, now()), auth.uid(),
         'Specific work added' || coalesce(': ' || nullif(trim(coalesce(new.name, '')), ''), ''),
         jsonb_build_object('source_id', new.id::text), false
  where new.line_kind is distinct from 'discount'
    and not exists (select 1 from public.job_activity_events e where e.event_type = 'fixture_added' and e.detail ->> 'source_id' = new.id::text);
  return new;
end;
$$;
