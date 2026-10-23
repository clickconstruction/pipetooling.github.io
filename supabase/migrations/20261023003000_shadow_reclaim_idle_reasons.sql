SET lock_timeout = '3s';

-- Robot rounds, one rule (v2.5753, punch list #142 follow-up). Seen live 2026-10-23: the Console
-- read Ready · 4 while the rounds reported "found nothing to do". Two things here:
--
-- 1. A voided shell no longer blocks a re-claim. twin_shadow_runs held UNIQUE (reference_bid_id),
--    so once a shell was voided (a *leave* order, a category error, a sent reference) the bid
--    could never get a robot again, even after the person let the robot back in. One LIVE run per
--    reference instead: a partial unique index over the rows whose status is not 'void'.
--    robot_run_signals() reads the live run first, so Read the run opens the current shell.
-- 2. robot_agents() carries the latest idle check-in's shape (`idle_at`, `idle_progress`): the
--    round's `ready` count and the bids it passed over with the reason, written by twin-mcp from
--    the same rule the dispatcher claims by. `idle_rounds_today` counts a stretch's `nothing` (the
--    rounds that saw no bid to claim) when the row carries it, else its `rounds` as before.
--    The return table changes, so the function is dropped and recreated in the one transaction.

BEGIN;

ALTER TABLE public.twin_shadow_runs DROP CONSTRAINT IF EXISTS twin_shadow_runs_reference_bid_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS twin_shadow_runs_live_reference_uidx
  ON public.twin_shadow_runs (reference_bid_id)
  WHERE status <> 'void';

COMMENT ON INDEX public.twin_shadow_runs_live_reference_uidx IS
  'One live (not void) shadow run per reference bid (v2.5753). A voided shell ends that shell, not the bid: the next round may claim it again.';

-- The dropped constraint's index served every read by reference; the partial one serves only reads
-- that say status <> 'void', so robot_progress()'s plain lookup keeps a plain index.
CREATE INDEX IF NOT EXISTS twin_shadow_runs_reference_idx ON public.twin_shadow_runs (reference_bid_id);

-- Read the run: the live run's shell first, then the newest, so a re-claimed bid opens its current shell.
CREATE OR REPLACE FUNCTION public.robot_run_signals(p_bid_id uuid)
RETURNS TABLE (
  at timestamptz,
  kind text,
  state text,
  stage text,
  progress jsonb,
  words text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])
  ),
  run AS (
    SELECT r.shadow_bid_id, r.scored_at
    FROM public.twin_shadow_runs r
    WHERE r.reference_bid_id = p_bid_id OR r.shadow_bid_id = p_bid_id
    ORDER BY (r.status <> 'void') DESC, r.created_at DESC
    LIMIT 1
  ),
  rows_ AS (
    SELECT t.started_at AS at, 'signal'::text AS kind, t.state, t.stage, t.progress,
      CASE WHEN (SELECT scored_at FROM run) IS NULL
        THEN regexp_replace(COALESCE(t.notes, ''), '\$\s?[0-9][0-9,.]*[kKmM]?', '[amount withheld]', 'g')
        ELSE COALESCE(t.notes, '') END AS words
    FROM public.twin_runs t
    WHERE t.mission = 'heartbeat' AND t.bid_id = (SELECT shadow_bid_id FROM run)
    UNION ALL
    SELECT e.occurred_at AS at, 'stamp'::text AS kind, NULL::text, NULL::text, NULL::jsonb,
      CASE WHEN (SELECT scored_at FROM run) IS NULL
        THEN regexp_replace(COALESCE(e.notes, ''), '\$\s?[0-9][0-9,.]*[kKmM]?', '[amount withheld]', 'g')
        ELSE COALESCE(e.notes, '') END AS words
    FROM public.bids_submission_entries e
    WHERE e.bid_id = (SELECT shadow_bid_id FROM run) AND e.notes LIKE '[%'
  )
  SELECT at, kind, state, stage, progress, words
  FROM rows_
  WHERE EXISTS (SELECT 1 FROM me)
  ORDER BY at ASC
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.robot_run_signals(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.robot_run_signals(uuid) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.robot_agents();

CREATE FUNCTION public.robot_agents()
RETURNS TABLE (
  credential_id uuid,
  key_label text,
  key_created_at timestamptz,
  twin_user_id uuid,
  twin_name text,
  twin_kind text,
  last_seen_at timestamptz,
  stopped_at timestamptz,
  stopped_by_name text,
  heartbeat_at timestamptz,
  heartbeat_state text,
  heartbeat_stage text,
  heartbeat_progress jsonb,
  heartbeat_is_round boolean,
  heartbeat_bid_number text,
  heartbeat_project text,
  heartbeat_source_bid_number text,
  heartbeat_source_bid_id uuid,
  holds_open_shell boolean,
  idle_rounds_today integer,
  idle_at timestamptz,
  idle_progress jsonb,
  recent jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role])
  ),
  keys AS (
    SELECT c.id, c.label, c.created_at, c.twin_user_id, c.last_seen_at, c.stopped_at, c.stopped_by
    FROM public.twin_credentials c
    WHERE c.revoked_at IS NULL
      AND (c.last_seen_at > now() - interval '7 days' OR c.last_used_at > now() - interval '7 days' OR c.created_at > now() - interval '7 days')
  ),
  hb AS (
    SELECT DISTINCT ON (t.credential_id) t.credential_id, t.started_at, t.state, t.stage, t.progress, t.is_round, t.bid_id
    FROM public.twin_runs t
    WHERE t.mission = 'heartbeat' AND t.credential_id IS NOT NULL AND t.state <> 'idle'
    ORDER BY t.credential_id, t.started_at DESC
  ),
  idle_last AS (
    SELECT DISTINCT ON (t.credential_id) t.credential_id, COALESCE(t.ended_at, t.started_at) AS at, t.progress
    FROM public.twin_runs t
    WHERE t.mission = 'heartbeat' AND t.state = 'idle' AND t.credential_id IS NOT NULL
    ORDER BY t.credential_id, COALESCE(t.ended_at, t.started_at) DESC
  ),
  idle AS (
    SELECT t.credential_id,
      COALESCE(sum(COALESCE((t.progress->>'nothing')::integer, (t.progress->>'rounds')::integer, 1)), 0)::integer AS rounds
    FROM public.twin_runs t
    WHERE t.mission = 'heartbeat' AND t.state = 'idle' AND t.credential_id IS NOT NULL
      AND COALESCE(t.ended_at, t.started_at) >= date_trunc('day', now() AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago'
    GROUP BY t.credential_id
  ),
  recent_items AS (
    -- shadows: sealed, scored, or parked (open with a plans ask answered by nobody)
    SELECT r.twin_user_id,
      CASE WHEN r.scored_at IS NOT NULL THEN 'scored' WHEN r.locked_at IS NOT NULL THEN 'sealed' ELSE 'parked' END AS kind,
      COALESCE(r.scored_at, r.locked_at, r.created_at) AS at,
      rb.id AS bid_id, rb.bid_number::text AS bid_number, rb.project_name AS project, sb.bid_number::text AS shell_number,
      (SELECT count(*) FROM public.twin_questions q WHERE q.about_bid_id = r.shadow_bid_id)::integer AS count,
      NULL::text AS label,
      CASE WHEN r.scored_at IS NOT NULL THEN r.delta_pct END AS delta_pct
    FROM public.twin_shadow_runs r
    JOIN public.bids sb ON sb.id = r.shadow_bid_id
    JOIN public.bids rb ON rb.id = r.reference_bid_id
    WHERE r.status <> 'void'
      AND (r.locked_at IS NOT NULL OR EXISTS (SELECT 1 FROM public.twin_questions q WHERE q.about_bid_id = r.shadow_bid_id AND q.kind = 'plans' AND q.status = 'open'))
    UNION ALL
    SELECT m.claimed_by, CASE WHEN m.status = 'blocked' THEN 'matrix_blocked' ELSE 'matrix' END, m.finished_at,
      b.id, b.bid_number::text, b.project_name, NULL, COALESCE((m.result->>'rows_asked')::integer, 0), m.status, NULL
    FROM public.bid_price_matrix_requests m
    JOIN public.bids b ON b.id = m.bid_id
    WHERE m.finished_at IS NOT NULL AND m.claimed_by IS NOT NULL AND m.status IN ('ready', 'blocked')
    UNION ALL
    SELECT s.claimed_by, 'submittal', s.finished_at, b.id, b.bid_number::text, b.project_name, NULL,
      COALESCE((s.result->>'written')::integer, (s.result->>'rows')::integer, 0), s.kind, NULL
    FROM public.bid_submittal_tasks s
    JOIN public.bids b ON b.id = s.bid_id
    WHERE s.finished_at IS NOT NULL AND s.claimed_by IS NOT NULL AND s.status IN ('ready', 'blocked')
    UNION ALL
    SELECT t.twin_user_id, 'report', t.started_at, NULL::uuid, NULL, NULL, NULL, NULL, substring(t.mission from 8), NULL
    FROM public.twin_runs t
    WHERE t.mission LIKE 'report:%'
  ),
  recent_by_twin AS (
    SELECT twin_user_id, jsonb_agg(jsonb_build_object(
        'kind', kind, 'at', at, 'bid_id', bid_id, 'bid_number', bid_number, 'project', project, 'shell_number', shell_number,
        'count', count, 'label', label, 'delta_pct', delta_pct) ORDER BY at DESC) AS items
    FROM (
      SELECT *, row_number() OVER (PARTITION BY twin_user_id ORDER BY at DESC) AS rn
      FROM recent_items
      WHERE at > now() - interval '7 days'
    ) x
    WHERE rn <= 5
    GROUP BY twin_user_id
  )
  SELECT
    k.id AS credential_id,
    k.label AS key_label,
    k.created_at AS key_created_at,
    k.twin_user_id,
    u.name AS twin_name,
    COALESCE(u.twin_kind, 'estimator') AS twin_kind,
    k.last_seen_at,
    k.stopped_at,
    sb_by.name AS stopped_by_name,
    hb.started_at AS heartbeat_at,
    hb.state AS heartbeat_state,
    hb.stage AS heartbeat_stage,
    hb.progress AS heartbeat_progress,
    COALESCE(hb.is_round, false) AS heartbeat_is_round,
    shell.bid_number::text AS heartbeat_bid_number,
    shell.project_name AS heartbeat_project,
    src.bid_number::text AS heartbeat_source_bid_number,
    src.id AS heartbeat_source_bid_id,
    COALESCE(run.status IN ('open'), false) AND COALESCE(hb.state, '') <> 'done' AS holds_open_shell,
    COALESCE(idle.rounds, 0) AS idle_rounds_today,
    idle_last.at AS idle_at,
    idle_last.progress AS idle_progress,
    COALESCE(rb.items, '[]'::jsonb) AS recent
  FROM keys k
  JOIN public.users u ON u.id = k.twin_user_id
  LEFT JOIN public.users sb_by ON sb_by.id = k.stopped_by
  LEFT JOIN hb ON hb.credential_id = k.id
  LEFT JOIN public.bids shell ON shell.id = hb.bid_id
  LEFT JOIN public.bids src ON src.id = shell.twin_source_bid_id
  LEFT JOIN LATERAL (
    SELECT r.status FROM public.twin_shadow_runs r WHERE r.shadow_bid_id = shell.id
    ORDER BY (r.status <> 'void') DESC, r.created_at DESC LIMIT 1
  ) run ON true
  LEFT JOIN idle ON idle.credential_id = k.id
  LEFT JOIN idle_last ON idle_last.credential_id = k.id
  LEFT JOIN recent_by_twin rb ON rb.twin_user_id = k.twin_user_id
  WHERE EXISTS (SELECT 1 FROM me)
  ORDER BY k.last_seen_at DESC NULLS LAST, k.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.robot_agents() FROM public;
GRANT EXECUTE ON FUNCTION public.robot_agents() TO authenticated, service_role;

COMMIT;
