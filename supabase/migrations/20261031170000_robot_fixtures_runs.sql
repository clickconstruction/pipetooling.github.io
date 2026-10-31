SET lock_timeout = '3s';

-- Robot fixtures, PR 4 (punch list #221, v2.6236): list_shadow_runs() carries what the Robot Board, the Scoreboard
-- and the dashboard's Needs You card need from the pull and the assisted stamp — the reference bid's id, assisted_at,
-- the fixtures counts and the fixtures score. No money moves: the counts are not a price, and the seal on the money
-- columns is unchanged. Dropped and recreated: the return shape changed; every reader reads columns by name.

DROP FUNCTION IF EXISTS public.list_shadow_runs();

CREATE FUNCTION public.list_shadow_runs()
RETURNS TABLE (
  id uuid,
  status text,
  axis text,
  created_at timestamptz,
  locked_at timestamptz,
  scored_at timestamptz,
  shadow_bid_number text,
  reference_bid_number text,
  project_name text,
  requested_by_name text,
  reference_sent_at timestamptz,
  locked_total numeric,
  reference_value numeric,
  delta_pct numeric,
  teacher_name text,
  teacher_standard boolean,
  reference_kind text,
  reference_bid_id uuid,
  assisted_at timestamptz,
  fixtures_found integer,
  fixtures_taken integer,
  fixtures_set_aside integer,
  fixtures_score jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.status,
    r.axis,
    r.created_at,
    r.locked_at,
    r.scored_at,
    sb.bid_number AS shadow_bid_number,
    rb.bid_number AS reference_bid_number,
    rb.project_name,
    ru.name AS requested_by_name,
    rb.bid_date_sent::timestamptz AS reference_sent_at,
    -- The seal: money columns stay NULL until the run is scored.
    CASE WHEN r.status = 'scored' THEN r.locked_total END AS locked_total,
    CASE WHEN r.status = 'scored' THEN r.reference_value END AS reference_value,
    CASE WHEN r.status = 'scored' THEN r.delta_pct END AS delta_pct,
    COALESCE(r.teacher_name, tu.name) AS teacher_name,
    tu.calibration_standard AS teacher_standard,
    CASE WHEN r.status = 'scored' THEN r.reference_kind END AS reference_kind,
    r.reference_bid_id,
    r.assisted_at,
    fx.found AS fixtures_found,
    fx.taken AS fixtures_taken,
    fx.set_aside AS fixtures_set_aside,
    r.fixtures_score
  FROM public.twin_shadow_runs r
  JOIN public.bids sb ON sb.id = r.shadow_bid_id
  JOIN public.bids rb ON rb.id = r.reference_bid_id
  LEFT JOIN public.users ru ON ru.id = rb.robot_requested_by
  LEFT JOIN public.users tu
    ON tu.id = COALESCE(r.teacher_user_id, rb.estimator_id, rb.bid_date_sent_attested_by, rb.created_by)
  LEFT JOIN LATERAL (
    SELECT
      (SELECT count(*) FROM public.bid_fixture_pull_rows x WHERE x.pull_id = p.id)::integer AS found,
      (SELECT count(*) FROM public.bid_fixture_pull_rows x WHERE x.pull_id = p.id AND x.taken_at IS NOT NULL AND x.count_row_id IS NOT NULL)::integer AS taken,
      (SELECT count(*) FROM public.bid_fixture_pull_rows x WHERE x.pull_id = p.id AND x.set_aside_at IS NOT NULL)::integer AS set_aside
    FROM public.bid_fixture_pulls p
    WHERE p.bid_id = r.reference_bid_id AND r.locked_at IS NOT NULL
    ORDER BY p.read_at DESC LIMIT 1
  ) fx ON true
  ORDER BY r.created_at DESC;
$$;

COMMENT ON FUNCTION public.list_shadow_runs() IS
  'v2.3234 — staff read of twin_shadow_runs by bid number; money NULL until scored (the seal); teacher attribution (v2.3080); reference_kind says whether a scored run measured against the recorded best effort or the sent value. v2.6236 (punch list #221): reference_bid_id, assisted_at, the fixtures counts of the newest pull once the run is sealed, and fixtures_score.';

GRANT EXECUTE ON FUNCTION public.list_shadow_runs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_shadow_runs() TO service_role;
REVOKE EXECUTE ON FUNCTION public.list_shadow_runs() FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_shadow_runs() FROM public;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
