-- Extend the connection-usage monitor with health/checkpoint/latency signals.
--
-- Why: the 2026-06-30 20:34 UTC outage DISPROVED the connection-pool-exhaustion
-- theory — the DB froze while idle at 49/90 connections, 1-2 active queries, fully
-- cached. The real signature was a STALLED CHECKPOINT (`total=129.9s`, `write=13.5s`
-- in the Postgres log) = a storage/host-level I/O freeze, not pool/CPU/memory.
-- connection_samples alone can't see that. This adds a per-minute health row so the
-- next freeze is characterized from inside the DB:
--   * checkpoint counters (delta of write_time with ~flat buffers_written => stall)
--   * backends stuck in IO wait
--   * sample_duration_ms — a latency canary: the sampler timing its OWN work, so a
--     storage slowdown shows up as this climbing even before a full freeze.
-- (An internal sampler still can't run DURING a hard freeze — the sampling GAP is
-- itself the freeze signal; see runbook Phase B2. An external heartbeat is future
-- work.)
--
-- Idempotent (CREATE ... IF NOT EXISTS / OR REPLACE). Folded into the existing
-- sample_connections() so the one `connection-usage-sample` cron covers both.

create table if not exists monitoring.health_checks (
  sampled_at           timestamptz primary key default now(),
  total_conns          int,
  active_conns         int,
  io_wait_backends     int,
  ckpt_num_timed       bigint,
  ckpt_num_requested   bigint,
  ckpt_write_time_ms   double precision,
  ckpt_sync_time_ms    double precision,
  ckpt_buffers_written bigint,
  sample_duration_ms   double precision
);

create or replace function monitoring.sample_connections()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_start timestamptz := clock_timestamp();
begin
  -- (1) connection breakdown
  insert into monitoring.connection_samples (sampled_at, usename, application_name, state, wait_event_type, cnt)
  select now(), usename, application_name, state, wait_event_type, count(*)
  from pg_stat_activity
  group by usename, application_name, state, wait_event_type;

  -- (2) health / checkpoint / latency snapshot
  insert into monitoring.health_checks (
    sampled_at, total_conns, active_conns, io_wait_backends,
    ckpt_num_timed, ckpt_num_requested, ckpt_write_time_ms, ckpt_sync_time_ms,
    ckpt_buffers_written, sample_duration_ms)
  select
    now(),
    (select count(*) from pg_stat_activity),
    (select count(*) from pg_stat_activity where state = 'active'),
    (select count(*) from pg_stat_activity where wait_event_type = 'IO'),
    c.num_timed, c.num_requested, c.write_time, c.sync_time, c.buffers_written,
    extract(epoch from (clock_timestamp() - v_start)) * 1000
  from pg_stat_checkpointer c;

  -- (3) retention (14 days, both tables)
  delete from monitoring.connection_samples where sampled_at < now() - interval '14 days';
  delete from monitoring.health_checks     where sampled_at < now() - interval '14 days';
end;
$$;

-- Per-minute deltas: a checkpoint STALL shows as a large write_time jump with ~flat
-- buffers_written, and/or sample_duration_ms spiking, and/or io_wait_backends > 0.
create or replace view monitoring.checkpoint_activity as
select
  sampled_at,
  round((ckpt_write_time_ms - lag(ckpt_write_time_ms) over w)::numeric, 0) as write_time_delta_ms,
  (ckpt_buffers_written - lag(ckpt_buffers_written) over w)                 as buffers_delta,
  (ckpt_num_timed   - lag(ckpt_num_timed)   over w)                        as checkpoints_timed,
  (ckpt_num_requested - lag(ckpt_num_requested) over w)                    as checkpoints_requested,
  round(sample_duration_ms::numeric, 1)                                    as sample_ms,
  io_wait_backends,
  total_conns,
  active_conns
from monitoring.health_checks
window w as (order by sampled_at);
