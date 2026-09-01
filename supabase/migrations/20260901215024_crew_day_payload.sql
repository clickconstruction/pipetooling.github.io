SET lock_timeout = '3s';

-- Crew Day payload (v2.2602): one call returns everything the Dashboard
-- "Crew Day" section needs for one company-calendar day — who was scheduled
-- where (job_schedule_blocks), who actually clocked in on what
-- (clock_sessions), the field reports they left (reports), and the day's
-- "% complete" thread notes — plus name/label rows for the people and jobs
-- involved. The client kernel (src/lib/crewDay.ts) groups and flags.
--
-- Roles: dev / master_technician / assistant / controller see company-wide
-- rows; superintendent sees only rows anchored to jobs they can reach — the
-- same predicate as superintendent_report_job_anchor_allowed (job's project
-- passes can_access_project_row, or they are a jobs_ledger_team_members row) —
-- and job-less rows (bid-anchored blocks, unassociated sessions) are dropped
-- for them. Other roles get {'error':'forbidden'}.
--
-- Hours only, never wages: nothing in this payload touches pay config.

CREATE OR REPLACE FUNCTION public.get_crew_day_payload(p_day date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_company boolean;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;
  IF p_day IS NULL THEN
    RETURN jsonb_build_object('error', 'day_required');
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = v_uid;
  IF v_role IN ('dev', 'master_technician', 'assistant', 'controller') THEN
    v_company := true;
  ELSIF v_role = 'superintendent' THEN
    v_company := false;
  ELSE
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  WITH day_sessions AS (
    SELECT cs.user_id, cs.job_ledger_id AS job_id, cs.clocked_in_at, cs.clocked_out_at
    FROM public.clock_sessions cs
    WHERE cs.work_date = p_day
      AND cs.revoked_at IS NULL
      AND cs.rejected_at IS NULL
  ),
  day_blocks AS (
    SELECT b.assignee_user_id AS user_id, b.job_id, b.bid_id, b.time_start, b.time_end, b.note
    FROM public.job_schedule_blocks b
    WHERE b.work_date = p_day
  ),
  day_reports AS (
    SELECT r.id, r.created_by_user_id AS user_id, r.job_ledger_id AS job_id,
           r.created_at, rt.name AS template_name, r.field_values
    FROM public.reports r
    JOIN public.report_templates rt ON rt.id = r.template_id
    WHERE (r.created_at AT TIME ZONE 'America/Chicago')::date = p_day
      AND r.job_ledger_id IS NOT NULL
  ),
  involved_job_ids AS (
    SELECT DISTINCT x.job_id FROM (
      SELECT s.job_id FROM day_sessions s WHERE s.job_id IS NOT NULL
      UNION ALL
      SELECT b.job_id FROM day_blocks b WHERE b.job_id IS NOT NULL
      UNION ALL
      SELECT r.job_id FROM day_reports r
    ) x
  ),
  allowed_job_ids AS (
    SELECT j.job_id
    FROM involved_job_ids j
    JOIN public.jobs_ledger jl ON jl.id = j.job_id
    WHERE v_company
       OR (jl.project_id IS NOT NULL AND public.can_access_project_row(jl.project_id))
       OR EXISTS (
         SELECT 1 FROM public.jobs_ledger_team_members jtm
         WHERE jtm.job_id = jl.id AND jtm.user_id = v_uid
       )
  ),
  scoped_sessions AS (
    SELECT s.* FROM day_sessions s
    WHERE v_company
       OR (s.job_id IS NOT NULL AND s.job_id IN (SELECT a.job_id FROM allowed_job_ids a))
  ),
  scoped_blocks AS (
    SELECT b.* FROM day_blocks b
    WHERE v_company
       OR (b.job_id IS NOT NULL AND b.job_id IN (SELECT a.job_id FROM allowed_job_ids a))
  ),
  scoped_reports AS (
    SELECT r.* FROM day_reports r
    WHERE v_company
       OR r.job_id IN (SELECT a.job_id FROM allowed_job_ids a)
  ),
  day_pct_notes AS (
    SELECT n.job_id, n.body, n.created_at
    FROM public.jobs_ledger_thread_notes n
    WHERE n.job_id IN (SELECT a.job_id FROM allowed_job_ids a)
      AND (n.created_at AT TIME ZONE 'America/Chicago')::date = p_day
      AND n.body LIKE '%\% complete%'
  )
  SELECT jsonb_build_object(
    'day', to_char(p_day, 'YYYY-MM-DD'),
    'sessions', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'user_id', s.user_id,
        'job_id', s.job_id,
        'clocked_in_at', s.clocked_in_at,
        'clocked_out_at', s.clocked_out_at
      ) ORDER BY s.clocked_in_at) FROM scoped_sessions s),
      '[]'::jsonb),
    'blocks', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'user_id', b.user_id,
        'job_id', b.job_id,
        'bid_id', b.bid_id,
        'time_start', b.time_start,
        'time_end', b.time_end,
        'note', b.note
      ) ORDER BY b.time_start) FROM scoped_blocks b),
      '[]'::jsonb),
    'reports', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'user_id', r.user_id,
        'job_id', r.job_id,
        'created_at', r.created_at,
        'template_name', r.template_name,
        'field_values', r.field_values
      ) ORDER BY r.created_at) FROM scoped_reports r),
      '[]'::jsonb),
    'pct_notes', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'job_id', n.job_id,
        'body', n.body,
        'created_at', n.created_at
      ) ORDER BY n.created_at) FROM day_pct_notes n),
      '[]'::jsonb),
    'users', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name))
       FROM public.users u
       WHERE u.id IN (
         SELECT s.user_id FROM scoped_sessions s
         UNION SELECT b.user_id FROM scoped_blocks b
         UNION SELECT r.user_id FROM scoped_reports r
       )),
      '[]'::jsonb),
    'jobs', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', jl.id,
        'hcp_number', jl.hcp_number,
        'click_number', jl.click_number,
        'job_name', jl.job_name,
        'job_address', jl.job_address,
        'status', jl.status,
        'pct_complete', jl.pct_complete
      ))
       FROM public.jobs_ledger jl
       WHERE jl.id IN (SELECT a.job_id FROM allowed_job_ids a)),
      '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_crew_day_payload(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_crew_day_payload(date) TO anon;
GRANT EXECUTE ON FUNCTION public.get_crew_day_payload(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_crew_day_payload(date) TO service_role;

COMMENT ON FUNCTION public.get_crew_day_payload(date) IS
  'Dashboard Crew Day section payload (v2.2602): one company-calendar day of clock sessions, schedule blocks, field reports, and % complete thread notes, with name/label rows for the people and jobs involved. Office roles company-wide; superintendent scoped to jobs on their accessible projects or team-membership jobs (job-less rows dropped). Grouping/flags in src/lib/crewDay.ts.';
