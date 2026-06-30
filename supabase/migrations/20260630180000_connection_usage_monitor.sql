-- Connection-usage monitor — captures WHO holds DB connections at peak, so the
-- recurring connection-pool-exhaustion outages (2026-06-05 / 06-24 / 06-30) can be
-- sized with data instead of guesses.
--
-- Why: `max_connections` is 90 (Small compute). When the pool exhausts, Realtime's
-- CDC poller is starved and the platform restarts Postgres. Post-restart snapshots
-- of pg_stat_activity are useless (the storm is over). This samples the breakdown
-- once a minute into a private table so the NEXT peak is on the record: e.g.
-- "peaked at 88/90 — postgrest 60, auth 10, realtime 8". That decides whether the
-- free `max_connections` bump is enough or a compute upgrade is genuinely required.
--
-- Surface: everything lives in the `monitoring` schema, which is NOT exposed by
-- PostgREST (the app/client only sees `public`), so there is no API/RLS surface and
-- no security-advisor impact. See docs/runbooks/SUPABASE_INCIDENT_RUNBOOK.md
-- ("Connection-usage monitor") for the analysis queries.
--
-- Idempotent / re-runnable (CREATE ... IF NOT EXISTS, CREATE OR REPLACE,
-- unschedule-before-schedule), and the cron scheduling is guarded on pg_cron so a
-- local `db reset` without the extension does not fail.

create schema if not exists monitoring;
revoke all on schema monitoring from public;

create table if not exists monitoring.connection_samples (
  id               bigint generated always as identity primary key,
  sampled_at       timestamptz not null default now(),
  usename          text,
  application_name text,
  state            text,
  wait_event_type  text,
  cnt              integer not null
);

create index if not exists connection_samples_sampled_at_idx
  on monitoring.connection_samples (sampled_at);

-- Samples the live connection breakdown + trims to a 14-day rolling window.
-- SECURITY DEFINER (owned by the superuser that applies this) so it always sees
-- every backend in pg_stat_activity regardless of who/what invokes it.
create or replace function monitoring.sample_connections()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into monitoring.connection_samples (sampled_at, usename, application_name, state, wait_event_type, cnt)
  select now(), usename, application_name, state, wait_event_type, count(*)
  from pg_stat_activity
  group by usename, application_name, state, wait_event_type;

  delete from monitoring.connection_samples
  where sampled_at < now() - interval '14 days';
end;
$$;

-- Per-sample raw rows classified by Supabase service (the breakdown we care about).
create or replace view monitoring.connection_breakdown as
select
  sampled_at,
  case
    when usename = 'supabase_auth_admin'                                  then 'auth'
    when usename = 'authenticator'                                       then 'postgrest'
    when usename = 'supabase_storage_admin'                              then 'storage'
    when usename = 'pgbouncer'                                           then 'pooler'
    when usename = 'supabase_admin' and application_name ilike 'realtime%' then 'realtime'
    when usename = 'supabase_admin' and application_name ilike 'pg_cron%'  then 'cron'
    when usename = 'supabase_admin'                                       then 'supabase_admin'
    when usename = 'postgres'                                            then 'mgmt/admin'
    when usename = 'supabase_replication_admin'                          then 'replication'
    else coalesce(usename, '(internal)')
  end as service,
  state,
  wait_event_type,
  cnt
from monitoring.connection_samples;

-- Total connections held at each sample instant, with the ceiling for context.
create or replace view monitoring.connection_totals as
select
  sampled_at,
  sum(cnt)::int                                  as total_conns,
  current_setting('max_connections')::int        as max_connections,
  round(100.0 * sum(cnt) / current_setting('max_connections')::int, 1) as pct_of_max
from monitoring.connection_samples
group by sampled_at;

-- Schedule the 1-minute sampler (guarded on pg_cron; idempotent).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'connection-usage-sample') then
      perform cron.unschedule('connection-usage-sample');
    end if;
    perform cron.schedule('connection-usage-sample', '* * * * *', $cmd$select monitoring.sample_connections();$cmd$);
  end if;
end $$;
