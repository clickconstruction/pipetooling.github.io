SET lock_timeout = '3s';

-- Robot rounds, PR 3 (punch list #142, decision 8): the Console's status rows and the stop.
-- robot_agents(): one row per unrevoked key seen in the last seven days (a key is a seat on a Mac):
-- the robot and its seat kind, the key's last call, the stop columns, the latest heartbeat with
-- its shape and the bid it names, whether that shell is still open, today's idle rounds, and the
-- last five things the robot finished (shadows sealed, scored or parked; matrices ready or blocked;
-- submittal tasks; reports) from the rows the robots already write. Devs and the owner (the master)
-- only, because it names keys. No money column: a scored run's delta is public once scored.
-- robot_rounds_stop(): Stop the rounds / Start again, the two columns on the key, by a dev or the
-- master; the round reads them in the reply to its next heartbeat (v2.5730's orders).

BEGIN;

CREATE OR REPLACE FUNCTION public.robot_agents()
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
  idle AS (
    SELECT t.credential_id, COALESCE(sum(COALESCE((t.progress->>'rounds')::integer, 1)), 0)::integer AS rounds
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
    COALESCE(rb.items, '[]'::jsonb) AS recent
  FROM keys k
  JOIN public.users u ON u.id = k.twin_user_id
  LEFT JOIN public.users sb_by ON sb_by.id = k.stopped_by
  LEFT JOIN hb ON hb.credential_id = k.id
  LEFT JOIN public.bids shell ON shell.id = hb.bid_id
  LEFT JOIN public.bids src ON src.id = shell.twin_source_bid_id
  LEFT JOIN public.twin_shadow_runs run ON run.shadow_bid_id = shell.id
  LEFT JOIN idle ON idle.credential_id = k.id
  LEFT JOIN recent_by_twin rb ON rb.twin_user_id = k.twin_user_id
  WHERE EXISTS (SELECT 1 FROM me)
  ORDER BY k.last_seen_at DESC NULLS LAST, k.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.robot_agents() FROM public;
GRANT EXECUTE ON FUNCTION public.robot_agents() TO authenticated, service_role;

-- Stop the rounds / Start again on one key. A dev or the master; the row's own word comes from the
-- round's next heartbeat, so the Console shows Stopping after bNNN until the robot says Stopped.
CREATE OR REPLACE FUNCTION public.robot_rounds_stop(p_credential_id uuid, p_stop boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_ok boolean;
  v_row public.twin_credentials%ROWTYPE;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_me AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role])) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Only a dev or the master may stop the rounds' USING ERRCODE = '42501';
  END IF;
  UPDATE public.twin_credentials
     SET stopped_at = CASE WHEN p_stop THEN now() ELSE NULL END,
         stopped_by = CASE WHEN p_stop THEN v_me ELSE NULL END
   WHERE id = p_credential_id AND revoked_at IS NULL
   RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'No live key with that id' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('credential_id', v_row.id, 'stopped_at', v_row.stopped_at, 'stopped_by', v_row.stopped_by);
END;
$$;

REVOKE ALL ON FUNCTION public.robot_rounds_stop(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.robot_rounds_stop(uuid, boolean) TO authenticated, service_role;

COMMIT;
