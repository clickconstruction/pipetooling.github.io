SET lock_timeout = '3s';

-- Journey-map Tier-2 #23 (J18-F2 / N2): the superintendent's Schedule board is RLS-scoped to
-- assigned projects (`job_schedule_blocks_select`, baseline) — booked people looked free and
-- Expected Manpower understated with no hint. This RPC pair tells the client HOW MANY blocks
-- RLS hid per person/day (and their summed hours) — never which job, never the times — so the
-- board can draw anonymous grey "busy" placeholders and count them in the manpower math.
--
-- Shape: the caller-facing `schedule_hidden_block_counts` is SECURITY INVOKER so its own
-- SELECT over `job_schedule_blocks` runs under the caller's RLS (visible set); it subtracts
-- that from the totals returned by the SECURITY DEFINER helper `_schedule_total_block_counts`
-- (RLS bypassed). RLS stays the single source of truth for what is visible — nothing here
-- re-implements the policy predicate. Both functions carry the same role gate.

-- 1) Role helper: mirrors is_controller()/is_primary() (STABLE SECURITY DEFINER, no recursion).
CREATE OR REPLACE FUNCTION public.is_superintendent()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent');
$$;

COMMENT ON FUNCTION public.is_superintendent() IS
  'True when the current user''s role is superintendent. SECURITY DEFINER to read users without RLS recursion.';

REVOKE ALL ON FUNCTION public.is_superintendent() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_superintendent() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superintendent() TO service_role;

-- 2) Internal: per (assignee, day) totals over ALL blocks in range, RLS bypassed. Aggregates only.
CREATE OR REPLACE FUNCTION public._schedule_total_block_counts(p_start date, p_end date)
RETURNS TABLE (user_id uuid, day date, total_count integer, total_hours numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT (
    public.is_superintendent()
    OR public.is_master_or_dev()
    OR public.is_assistant()
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_end < p_start OR (p_end - p_start) > 62 THEN
    RAISE EXCEPTION 'invalid date range' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
    SELECT
      b.assignee_user_id,
      b.work_date,
      count(*)::integer,
      round(sum(GREATEST(0, EXTRACT(EPOCH FROM (b.time_end - b.time_start)) / 3600.0))::numeric, 2)
    FROM public.job_schedule_blocks b
    WHERE b.work_date BETWEEN p_start AND p_end
    GROUP BY b.assignee_user_id, b.work_date;
END;
$$;

COMMENT ON FUNCTION public._schedule_total_block_counts(date, date) IS
  'Internal for schedule_hidden_block_counts: per assignee/day block count + summed hours over ALL rows (RLS bypassed). Gated superintendent / master-or-dev / assistant-like. Aggregates only — no job identity.';

REVOKE ALL ON FUNCTION public._schedule_total_block_counts(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._schedule_total_block_counts(date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public._schedule_total_block_counts(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public._schedule_total_block_counts(date, date) TO service_role;

-- 3) Caller-facing: hidden = total − visible, computed server-side; rows only where hidden > 0.
CREATE OR REPLACE FUNCTION public.schedule_hidden_block_counts(p_start date, p_end date)
RETURNS TABLE (user_id uuid, day date, hidden_count integer, hidden_hours numeric)
LANGUAGE plpgsql
STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT (
    public.is_superintendent()
    OR public.is_master_or_dev()
    OR public.is_assistant()
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    WITH totals AS (
      SELECT t.user_id, t.day, t.total_count, t.total_hours
      FROM public._schedule_total_block_counts(p_start, p_end) t
    ),
    visible AS (
      -- Runs as the caller: `job_schedule_blocks_select` (+ the bid SELECT policy) filters here.
      SELECT
        b.assignee_user_id AS user_id,
        b.work_date AS day,
        count(*)::integer AS visible_count,
        round(sum(GREATEST(0, EXTRACT(EPOCH FROM (b.time_end - b.time_start)) / 3600.0))::numeric, 2) AS visible_hours
      FROM public.job_schedule_blocks b
      WHERE b.work_date BETWEEN p_start AND p_end
      GROUP BY b.assignee_user_id, b.work_date
    )
    SELECT
      t.user_id,
      t.day,
      (t.total_count - COALESCE(v.visible_count, 0))::integer AS hidden_count,
      GREATEST(0, t.total_hours - COALESCE(v.visible_hours, 0))::numeric AS hidden_hours
    FROM totals t
    LEFT JOIN visible v ON v.user_id = t.user_id AND v.day = t.day
    WHERE (t.total_count - COALESCE(v.visible_count, 0)) > 0
    ORDER BY t.user_id, t.day;
END;
$$;

COMMENT ON FUNCTION public.schedule_hidden_block_counts(date, date) IS
  'Schedule board grey "busy" placeholders: per assignee/day count + hours of job_schedule_blocks the caller''s RLS hides (total − visible, server-side). Gated superintendent / master-or-dev / assistant-like. Returns no job identity or times.';

REVOKE ALL ON FUNCTION public.schedule_hidden_block_counts(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_hidden_block_counts(date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.schedule_hidden_block_counts(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_hidden_block_counts(date, date) TO service_role;
