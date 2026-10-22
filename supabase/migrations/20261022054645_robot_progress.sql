SET lock_timeout = '3s';

-- Robot rounds, PR 2 (punch list #142): the reader the bid roles call for the bar on the bid and
-- the ring on the icon. One row per human bid that has a shadow run: the facts each step leaves
-- (the shell, its plans link, its substrate, its audit row from the takeoff, its count rows, the
-- lock, the questions), the latest heartbeat with its plain-words shape, the key that said it and
-- when that key last called, and the median minutes a run takes once ten have locked. No money
-- column is selected, so nothing here can anchor a number. robot_run_signals is Read the run: the
-- shell's heartbeats and ledger stamps in time order, dollar figures withheld until the run is
-- scored. submittal_robot_liveness gains the newest last_seen_at, for the one sentence the Robots
-- lenses' caption says.

BEGIN;

CREATE OR REPLACE FUNCTION public.robot_progress(p_bid_ids uuid[])
RETURNS TABLE (
  bid_id uuid,
  shell_bid_id uuid,
  shell_bid_number text,
  run_status text,
  claimed_at timestamptz,
  plans_filed boolean,
  read_at timestamptz,
  counted_at timestamptz,
  priced_at timestamptz,
  locked_at timestamptz,
  scored_at timestamptz,
  questions_at timestamptz,
  heartbeat_at timestamptz,
  heartbeat_state text,
  heartbeat_stage text,
  heartbeat_progress jsonb,
  heartbeat_is_round boolean,
  key_label text,
  key_last_seen_at timestamptz,
  median_minutes numeric
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
  med AS (
    SELECT CASE WHEN count(*) >= 10
      THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (r.locked_at - r.created_at)) / 60.0)
      END AS minutes
    FROM public.twin_shadow_runs r
    WHERE r.locked_at IS NOT NULL AND r.locked_at > r.created_at AND r.locked_at - r.created_at < interval '12 hours'
  )
  SELECT
    r.reference_bid_id AS bid_id,
    r.shadow_bid_id AS shell_bid_id,
    sb.bid_number::text AS shell_bid_number,
    r.status AS run_status,
    r.created_at AS claimed_at,
    (sb.plans_link IS NOT NULL AND sb.plans_link <> '') AS plans_filed,
    sub.created_at AS read_at,
    au.created_at AS counted_at,
    cr.created_at AS priced_at,
    r.locked_at,
    r.scored_at,
    tq.created_at AS questions_at,
    hb.started_at AS heartbeat_at,
    hb.state AS heartbeat_state,
    hb.stage AS heartbeat_stage,
    hb.progress AS heartbeat_progress,
    COALESCE(hb.is_round, false) AS heartbeat_is_round,
    cred.label AS key_label,
    cred.last_seen_at AS key_last_seen_at,
    (SELECT minutes FROM med) AS median_minutes
  FROM public.twin_shadow_runs r
  JOIN public.bids sb ON sb.id = r.shadow_bid_id
  LEFT JOIN LATERAL (SELECT s.created_at FROM public.bids_plan_substrates s WHERE s.bid_id = sb.id ORDER BY s.created_at DESC LIMIT 1) sub ON true
  LEFT JOIN LATERAL (SELECT a.created_at FROM public.bid_audits a WHERE a.bid_id = sb.id ORDER BY a.created_at ASC LIMIT 1) au ON true
  LEFT JOIN LATERAL (SELECT min(c.created_at) AS created_at FROM public.bids_count_rows c WHERE c.bid_id = sb.id) cr ON true
  LEFT JOIN LATERAL (SELECT min(q.created_at) AS created_at FROM public.twin_questions q WHERE q.about_bid_id = sb.id) tq ON true
  LEFT JOIN LATERAL (
    SELECT t.started_at, t.state, t.stage, t.progress, t.is_round, t.credential_id
    FROM public.twin_runs t
    WHERE t.mission = 'heartbeat' AND t.bid_id = sb.id
    ORDER BY t.started_at DESC LIMIT 1
  ) hb ON true
  LEFT JOIN public.twin_credentials cred ON cred.id = hb.credential_id
  WHERE r.reference_bid_id = ANY (p_bid_ids)
    AND EXISTS (SELECT 1 FROM me)
  ORDER BY r.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.robot_progress(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.robot_progress(uuid[]) TO authenticated, service_role;

-- Read the run: the shell's signals and stamps, oldest first. Money is withheld until the run is
-- scored (the heartbeat scrubs on write since v2.5730; older notes and the LOCK stamp carry a figure).
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

-- The caption's sentence: when any live key last called (v2.5730's stamp), beside the sign-in time.
CREATE OR REPLACE FUNCTION public.submittal_robot_liveness()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'unrevoked_seats', (SELECT count(*) FROM public.twin_credentials WHERE revoked_at IS NULL),
    'last_used_at', (SELECT max(last_used_at) FROM public.twin_credentials WHERE revoked_at IS NULL),
    'last_seen_at', (SELECT max(last_seen_at) FROM public.twin_credentials WHERE revoked_at IS NULL)
  );
$function$;

COMMIT;
