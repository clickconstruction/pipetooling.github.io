SET lock_timeout = '3s';

-- dev-mcp health checks (to-dos/mcp-servers.md, PR 5). The freeze monitor (monitoring.*,
-- docs/DB_FREEZE_RUNBOOK.md), pg_stat_activity and the migration ledger are outside the public
-- schema, so PostgREST cannot read them and an edge function cannot run ad-hoc SQL. Four small
-- read-only doors, each gated is_dev() inside and granted to authenticated only: dev-mcp reads
-- them over GET as the dev (check_sampler / check_connections / check_locks /
-- check_migration_ledger), and no service role is involved.
--
-- plpgsql throughout: a body is not checked against its relations at CREATE time, so this file
-- applies even where a monitored relation is missing; the call says so instead.
-- No CREATE TABLE, so no read-only fence appliers.

-- (a) Gaps in the per-minute sampler + the leading indicator (runbook Step 2a, Leading indicator).
CREATE OR REPLACE FUNCTION public.dev_health_sampler_gaps(p_hours integer DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_hours integer := LEAST(GREATEST(COALESCE(p_hours, 24), 1), 336);  -- the monitor keeps 14 days
  v_out jsonb;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_health_sampler_gaps: devs only' USING ERRCODE = '42501';
  END IF;

  WITH s AS (
    SELECT sampled_at, total_conns, active_conns, io_wait_backends, sample_duration_ms,
           lag(sampled_at) OVER (ORDER BY sampled_at) AS prev_at
      FROM monitoring.health_checks
     WHERE sampled_at > now() - make_interval(hours => v_hours)
  ),
  gaps AS (
    SELECT prev_at AS gap_start, sampled_at AS gap_end,
           round(extract(epoch FROM (sampled_at - prev_at))::numeric, 1) AS gap_seconds,
           total_conns, active_conns, io_wait_backends,
           round(sample_duration_ms::numeric, 1) AS sample_duration_ms
      FROM s
     WHERE prev_at IS NOT NULL AND extract(epoch FROM (sampled_at - prev_at)) > 90
  ),
  slowest AS (
    SELECT sampled_at, round(sample_duration_ms::numeric, 1) AS sample_duration_ms
      FROM s ORDER BY s.sample_duration_ms DESC NULLS LAST LIMIT 1
  )
  SELECT jsonb_build_object(
    'hours', v_hours,
    'samples', (SELECT count(*) FROM s),
    'newest_sample_at', (SELECT max(sampled_at) FROM s),
    'gaps_over_90s', COALESCE((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.gap_start) FROM gaps g), '[]'::jsonb),
    'slowest_sample', (SELECT to_jsonb(x) FROM slowest x),
    'samples_over_250ms', (SELECT count(*) FROM s WHERE s.sample_duration_ms > 250)
  ) INTO v_out;
  RETURN v_out;
END;
$$;

-- (b) The newest connection sample: the total against max_connections, and the breakdown.
CREATE OR REPLACE FUNCTION public.dev_health_connections()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_at timestamptz;
  v_out jsonb;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_health_connections: devs only' USING ERRCODE = '42501';
  END IF;

  SELECT max(sampled_at) INTO v_at FROM monitoring.connection_samples;

  WITH latest AS (
    SELECT usename, application_name, state, wait_event_type, cnt
      FROM monitoring.connection_samples WHERE sampled_at = v_at
  )
  SELECT jsonb_build_object(
    'sampled_at', v_at,
    'sample_age_seconds', round(extract(epoch FROM (now() - v_at))::numeric, 0),
    'total_conns', (SELECT COALESCE(sum(cnt), 0)::int FROM latest),
    'max_connections', current_setting('max_connections')::int,
    'pct_of_max', (SELECT round(100.0 * COALESCE(sum(cnt), 0) / current_setting('max_connections')::int, 1) FROM latest),
    'by_state', COALESCE((
      SELECT jsonb_agg(to_jsonb(b) ORDER BY b.conns DESC)
        FROM (SELECT state, wait_event_type, sum(cnt)::int AS conns FROM latest GROUP BY 1, 2) b), '[]'::jsonb),
    'by_role', COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.conns DESC)
        FROM (SELECT usename, sum(cnt)::int AS conns FROM latest GROUP BY 1) r), '[]'::jsonb),
    'health', (
      SELECT jsonb_build_object('sampled_at', h.sampled_at, 'active_conns', h.active_conns,
                                'io_wait_backends', h.io_wait_backends,
                                'sample_duration_ms', round(h.sample_duration_ms::numeric, 1))
        FROM monitoring.health_checks h ORDER BY h.sampled_at DESC LIMIT 1)
  ) INTO v_out;
  RETURN v_out;
END;
$$;

-- (c) Live: who waits on a lock, who blocks them, and transactions left open (Mode A's answer —
-- what `supabase inspect db blocking` shows). The owner's membership in pg_read_all_stats is what
-- lets a definer read every backend's row in full. Statement text is cut at 300 characters.
CREATE OR REPLACE FUNCTION public.dev_health_locks()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_out jsonb;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_health_locks: devs only' USING ERRCODE = '42501';
  END IF;

  WITH act AS (
    SELECT a.pid, a.usename, a.application_name, a.state, a.wait_event_type, a.wait_event,
           a.xact_start, a.query_start, a.state_change, left(a.query, 300) AS query,
           pg_blocking_pids(a.pid) AS blocked_by
      FROM pg_stat_activity a
     WHERE a.pid <> pg_backend_pid() AND a.backend_type = 'client backend'
  ),
  waiters AS (
    SELECT pid, usename, application_name, state, wait_event_type, wait_event, blocked_by,
           round(extract(epoch FROM (now() - query_start))::numeric, 1) AS waiting_seconds, query
      FROM act WHERE cardinality(blocked_by) > 0
  ),
  blockers AS (
    SELECT act.pid, act.usename, act.application_name, act.state,
           round(extract(epoch FROM (now() - act.xact_start))::numeric, 1) AS xact_seconds,
           (SELECT count(*) FROM waiters w WHERE act.pid = ANY (w.blocked_by)) AS blocking, act.query
      FROM act WHERE act.pid IN (SELECT unnest(w.blocked_by) FROM waiters w)
  ),
  idle_in_xact AS (
    SELECT pid, usename, application_name,
           round(extract(epoch FROM (now() - state_change))::numeric, 1) AS idle_seconds, query
      FROM act WHERE state LIKE 'idle in transaction%' AND now() - state_change > interval '60 seconds'
  )
  SELECT jsonb_build_object(
    'checked_at', now(),
    'client_backends', (SELECT count(*) FROM act),
    'waiters', COALESCE((SELECT jsonb_agg(to_jsonb(w) ORDER BY w.waiting_seconds DESC) FROM waiters w), '[]'::jsonb),
    'blockers', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.blocking DESC, b.xact_seconds DESC) FROM blockers b), '[]'::jsonb),
    'idle_in_transaction_over_60s', COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.idle_seconds DESC) FROM idle_in_xact i), '[]'::jsonb)
  ) INTO v_out;
  RETURN v_out;
END;
$$;

-- (d) The newest rows of the migration ledger, to hold against `git ls-tree origin/main
-- supabase/migrations/`. `npm run check:migration-drift` stays the authority.
CREATE OR REPLACE FUNCTION public.dev_migration_ledger_tail(p_n integer DEFAULT 15)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_n integer := LEAST(GREATEST(COALESCE(p_n, 15), 1), 100);
  v_out jsonb;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_migration_ledger_tail: devs only' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'applied', (SELECT count(*) FROM supabase_migrations.schema_migrations),
    'newest_first', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('version', t.version, 'name', t.name) ORDER BY t.version DESC)
        FROM (SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT v_n) t), '[]'::jsonb)
  ) INTO v_out;
  RETURN v_out;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dev_health_sampler_gaps(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dev_health_connections() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dev_health_locks() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dev_migration_ledger_tail(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_health_sampler_gaps(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dev_health_connections() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dev_health_locks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dev_migration_ledger_tail(integer) TO authenticated;
