-- Job activity ledger (Phase 2): append-only event table + helpers + RLS + reader RPC + triggers.
--
-- Captures important job actions that Phase 1's live-merge could not: deletions
-- (payment/crew removed), field edits, and combine/separate. The client reads a
-- single role-aware RPC (list_job_activity_events) and subscribes to one realtime
-- table, replacing the per-source fetches/subscriptions added in Phase 1.

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────────────────────

-- Human label for a jobs_ledger.status value (mirrors src/lib humanizeJobStatus).
create or replace function public.humanize_job_status(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p
    when 'waiting' then 'Waiting'
    when 'working' then 'Working'
    when 'ready_to_bill' then 'Ready to Bill'
    when 'billed' then 'Billed'
    when 'paid' then 'Paid'
    when null then '—'
    else initcap(replace(coalesce(p, ''), '_', ' '))
  end;
$$;

-- Single source of truth for job-activity visibility, used by BOTH the table RLS
-- policy and the reader RPC so they can never diverge.
--   * operational rows (financial = false): mirrors job_status_events_select
--     (master / dev / primary / adopted+shared assistants / team members)
--   * financial rows  (financial = true) : mirrors jobs_ledger_payments SELECT
--     (role in dev/master_technician/assistant/primary AND job access; NOT team-only)
create or replace function public.can_read_job_activity(p_job_id uuid, p_financial boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_financial then (
      exists (
        select 1 from public.users u
        where u.id = auth.uid()
          and u.role = any (array['dev','master_technician','assistant','primary']::user_role[])
      )
      and exists (
        select 1 from public.jobs_ledger j
        where j.id = p_job_id
          and (
            j.master_user_id = auth.uid()
            or public.is_dev()
            or exists (select 1 from public.users u2 where u2.id = auth.uid() and u2.role = 'primary'::user_role)
            or exists (select 1 from public.master_assistants ma where ma.master_id = auth.uid() and ma.assistant_id = j.master_user_id)
            or exists (select 1 from public.master_assistants ma where ma.master_id = j.master_user_id and ma.assistant_id = auth.uid())
            or public.assistants_share_master(auth.uid(), j.master_user_id)
          )
      )
    )
    else exists (
      select 1 from public.jobs_ledger j
      where j.id = p_job_id
        and (
          j.master_user_id = auth.uid()
          or public.is_dev()
          or exists (select 1 from public.users u2 where u2.id = auth.uid() and u2.role = 'primary'::user_role)
          or exists (select 1 from public.master_assistants ma where ma.master_id = auth.uid() and ma.assistant_id = j.master_user_id)
          or exists (select 1 from public.master_assistants ma where ma.master_id = j.master_user_id and ma.assistant_id = auth.uid())
          or public.assistants_share_master(auth.uid(), j.master_user_id)
          or exists (select 1 from public.jobs_ledger_team_members t where t.job_id = j.id and t.user_id = auth.uid())
        )
    )
  end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Table + index + RLS
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.job_activity_events (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs_ledger(id) on delete cascade,
  event_type    text not null,
  occurred_at   timestamptz not null default now(),
  actor_user_id uuid references public.users(id),
  summary       text not null default '',
  detail        jsonb not null default '{}'::jsonb,
  financial     boolean not null default false
);

create index if not exists job_activity_events_job_occurred_idx
  on public.job_activity_events (job_id, occurred_at desc);

-- Dedup guard for triggers/backfill (event_type + detail->>'source_id').
create index if not exists job_activity_events_source_idx
  on public.job_activity_events (event_type, (detail ->> 'source_id'));

alter table public.job_activity_events enable row level security;

drop policy if exists job_activity_events_select on public.job_activity_events;
create policy job_activity_events_select on public.job_activity_events
  for select using (public.can_read_job_activity(job_id, financial));
-- No INSERT/UPDATE/DELETE policy: rows are written only by SECURITY DEFINER
-- triggers/RPCs (definer bypasses RLS); clients can never write directly.

-- Single realtime subscription source for the ledger.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'job_activity_events'
  ) then
    alter publication supabase_realtime add table public.job_activity_events;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Reader RPC (role-aware, resolves actor names) — oldest-first to match the feed.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.list_job_activity_events(p_job_id uuid)
returns table (
  id uuid,
  event_type text,
  occurred_at timestamptz,
  actor_user_id uuid,
  actor_name text,
  summary text,
  detail jsonb,
  financial boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.event_type, e.occurred_at, e.actor_user_id, u.name, e.summary, e.detail, e.financial
  from public.job_activity_events e
  left join public.users u on u.id = e.actor_user_id
  where e.job_id = p_job_id
    and public.can_read_job_activity(e.job_id, e.financial)
  order by e.occurred_at asc
  limit 200;
$$;

grant execute on function public.list_job_activity_events(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Triggers: one writer per source. All AFTER, SECURITY DEFINER, search_path set,
-- idempotency-guarded on (event_type, detail->>'source_id').
-- ─────────────────────────────────────────────────────────────────────────────

-- Status changes: single writer over job_status_events (captures both the
-- update_job_status RPC path and the clock-out auto-promote trigger path).
create or replace function public.job_status_events_to_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  select NEW.job_id, 'status_change', coalesce(NEW.changed_at, now()), NEW.changed_by_user_id,
         public.humanize_job_status(NEW.from_status) || ' → ' || public.humanize_job_status(NEW.to_status),
         jsonb_build_object('from', NEW.from_status, 'to', NEW.to_status, 'source_id', NEW.id::text),
         false
  where not exists (
    select 1 from public.job_activity_events e
    where e.event_type = 'status_change' and e.detail ->> 'source_id' = NEW.id::text
  );
  return NEW;
end;
$$;
drop trigger if exists job_status_events_to_activity_ins on public.job_status_events;
create trigger job_status_events_to_activity_ins
  after insert on public.job_status_events
  for each row execute function public.job_status_events_to_activity();

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
  );
  return r;
end;
$$;
drop trigger if exists jobs_ledger_payments_to_activity_ins on public.jobs_ledger_payments;
create trigger jobs_ledger_payments_to_activity_ins
  after insert on public.jobs_ledger_payments
  for each row execute function public.jobs_ledger_payments_to_activity();
drop trigger if exists jobs_ledger_payments_to_activity_del on public.jobs_ledger_payments;
create trigger jobs_ledger_payments_to_activity_del
  after delete on public.jobs_ledger_payments
  for each row execute function public.jobs_ledger_payments_to_activity();

-- Invoices: created (INSERT) + each dated milestone on NULL→set transition. Financial.
create or replace function public.jobs_ledger_invoices_to_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amt text := '$' || to_char(coalesce(new.amount, 0), 'FM999,999,990.00');
  v_channel text := nullif(trim(coalesce(new.external_send_channel, '')), '');
  v_prev numeric := new.agreed_write_down_previous_amount;
begin
  if tg_op = 'INSERT' then
    insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    select new.job_id, 'invoice_created', coalesce(new.created_at, now()), auth.uid(),
           'Invoice created ' || v_amt,
           jsonb_build_object('invoice_id', new.id, 'source_id', new.id::text), true
    where not exists (select 1 from public.job_activity_events e where e.event_type = 'invoice_created' and e.detail ->> 'source_id' = new.id::text);
  end if;

  if new.billed_at is not null and (tg_op = 'INSERT' or old.billed_at is null) then
    insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    select new.job_id, 'invoice_billed', new.billed_at, auth.uid(), 'Marked billed ' || v_amt,
           jsonb_build_object('invoice_id', new.id, 'source_id', new.id::text), true
    where not exists (select 1 from public.job_activity_events e where e.event_type = 'invoice_billed' and e.detail ->> 'source_id' = new.id::text);
  end if;

  if new.sent_to_customer_at is not null and (tg_op = 'INSERT' or old.sent_to_customer_at is null) then
    insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    select new.job_id, 'invoice_sent', new.sent_to_customer_at, auth.uid(),
           'Invoice sent to customer' || coalesce(' (' || v_channel || ')', ''),
           jsonb_build_object('invoice_id', new.id, 'source_id', new.id::text, 'channel', new.external_send_channel), true
    where not exists (select 1 from public.job_activity_events e where e.event_type = 'invoice_sent' and e.detail ->> 'source_id' = new.id::text);
  end if;

  if new.agreed_write_down_at is not null and (tg_op = 'INSERT' or old.agreed_write_down_at is null) then
    insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    select new.job_id, 'invoice_write_down', new.agreed_write_down_at, auth.uid(),
           'Agreed write-down: '
             || coalesce('$' || to_char(v_prev, 'FM999,999,990.00') || ' → ', '') || v_amt
             || coalesce(' — ' || nullif(trim(coalesce(new.agreed_write_down_note, '')), ''), ''),
           jsonb_build_object('invoice_id', new.id, 'source_id', new.id::text, 'previous_amount', v_prev), true
    where not exists (select 1 from public.job_activity_events e where e.event_type = 'invoice_write_down' and e.detail ->> 'source_id' = new.id::text);
  end if;

  return new;
end;
$$;
drop trigger if exists jobs_ledger_invoices_to_activity_ins on public.jobs_ledger_invoices;
create trigger jobs_ledger_invoices_to_activity_ins
  after insert on public.jobs_ledger_invoices
  for each row execute function public.jobs_ledger_invoices_to_activity();
drop trigger if exists jobs_ledger_invoices_to_activity_upd on public.jobs_ledger_invoices;
create trigger jobs_ledger_invoices_to_activity_upd
  after update of billed_at, sent_to_customer_at, agreed_write_down_at on public.jobs_ledger_invoices
  for each row execute function public.jobs_ledger_invoices_to_activity();

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
  );
  return r;
end;
$$;
drop trigger if exists jobs_ledger_team_members_to_activity_ins on public.jobs_ledger_team_members;
create trigger jobs_ledger_team_members_to_activity_ins
  after insert on public.jobs_ledger_team_members
  for each row execute function public.jobs_ledger_team_members_to_activity();
drop trigger if exists jobs_ledger_team_members_to_activity_del on public.jobs_ledger_team_members;
create trigger jobs_ledger_team_members_to_activity_del
  after delete on public.jobs_ledger_team_members
  for each row execute function public.jobs_ledger_team_members_to_activity();

-- Field edits: whitelist of jobs_ledger columns. One event per changed field.
create or replace function public.jobs_ledger_fields_to_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is distinct from old.customer_id then
    insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    values (new.id, 'field_edited', now(), auth.uid(),
            'Customer set to ' || coalesce(nullif(trim(coalesce(new.customer_name, '')), ''), '—'),
            jsonb_build_object('field', 'customer', 'old', old.customer_name, 'new', new.customer_name), false);
  elsif new.customer_name is distinct from old.customer_name then
    insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    values (new.id, 'field_edited', now(), auth.uid(),
            'Customer name changed to ' || coalesce(nullif(trim(coalesce(new.customer_name, '')), ''), '—'),
            jsonb_build_object('field', 'customer_name', 'old', old.customer_name, 'new', new.customer_name), false);
  end if;

  if new.job_address is distinct from old.job_address then
    insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    values (new.id, 'field_edited', now(), auth.uid(),
            'Address changed to ' || coalesce(nullif(trim(coalesce(new.job_address, '')), ''), '—'),
            jsonb_build_object('field', 'job_address', 'old', old.job_address, 'new', new.job_address), false);
  end if;

  if coalesce(new.revenue, 0) is distinct from coalesce(old.revenue, 0) then
    insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    values (new.id, 'field_edited', now(), auth.uid(),
            'Job total changed to $' || to_char(coalesce(new.revenue, 0), 'FM999,999,990.00'),
            jsonb_build_object('field', 'revenue', 'old', old.revenue, 'new', new.revenue), true);
  end if;

  return new;
end;
$$;
drop trigger if exists jobs_ledger_fields_to_activity_upd on public.jobs_ledger;
create trigger jobs_ledger_fields_to_activity_upd
  after update of customer_id, customer_name, job_address, revenue on public.jobs_ledger
  for each row execute function public.jobs_ledger_fields_to_activity();

-- Materials / specific-work lines added.
create or replace function public.jobs_ledger_materials_to_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  select new.job_id, 'material_added', coalesce(new.created_at, now()), auth.uid(),
         'Materials line added' || coalesce(': ' || nullif(trim(coalesce(new.description, '')), ''), '')
           || coalesce(' ($' || to_char(new.amount, 'FM999,999,990.00') || ')', ''),
         jsonb_build_object('source_id', new.id::text), true
  where not exists (select 1 from public.job_activity_events e where e.event_type = 'material_added' and e.detail ->> 'source_id' = new.id::text);
  return new;
end;
$$;
drop trigger if exists jobs_ledger_materials_to_activity_ins on public.jobs_ledger_materials;
create trigger jobs_ledger_materials_to_activity_ins
  after insert on public.jobs_ledger_materials
  for each row execute function public.jobs_ledger_materials_to_activity();

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
  where not exists (select 1 from public.job_activity_events e where e.event_type = 'fixture_added' and e.detail ->> 'source_id' = new.id::text);
  return new;
end;
$$;
drop trigger if exists jobs_ledger_fixtures_to_activity_ins on public.jobs_ledger_fixtures;
create trigger jobs_ledger_fixtures_to_activity_ins
  after insert on public.jobs_ledger_fixtures
  for each row execute function public.jobs_ledger_fixtures_to_activity();
