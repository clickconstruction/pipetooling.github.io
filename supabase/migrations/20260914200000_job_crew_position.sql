SET lock_timeout = '3s';

-- Where the Job Is, PR 3 (owner-approved brief, 2026-09-14): the crew feed.
-- The Pipeline row's Progress & payment cell reads two hand-typed numbers and
-- ignores everything the crews produce. This RPC hands the board, per job and
-- in one round trip, what the app already records about where the crew is:
--   * clock sessions — the last day anyone clocked in, who was there, and
--     the 60-day session / people counts (revoked and rejected sessions
--     excluded);
--   * the newest sub sheet — its stage (working / walkthrough / customer_pay),
--     who it names, its date and its reported progress;
--   * the newest field report that answered "How complete is the job?" — the
--     percent and when (the same parse list_latest_report_completion_pct uses);
--   * the newest hand-set percent's timestamp (job_pct_events, source manual),
--     so a typed % older than the last clock-in can be shown with its date.
-- Office roles only (dev / master / assistant / controller / primary): the
-- board is theirs, and the names of employees and subs ride in the answer
-- (owner decision 2026-09-14: "both, office only"). Anyone else gets no rows.
-- SECURITY DEFINER because clock_sessions, reports and job_pct_events are
-- read under per-role policies that do not all admit the office roles the
-- board serves; the guard above is the whole access rule. Read-only.
-- `p_today` is the company calendar day, passed by the client
-- (todayYmdInAppTz) so no zone literal lives here.

CREATE OR REPLACE FUNCTION public.list_job_crew_position(p_job_ids uuid[], p_today date)
RETURNS TABLE (
  job_ledger_id uuid,
  last_work_date date,
  last_day_people text[],
  sessions_60d integer,
  people_60d integer,
  sheet_stage text,
  sheet_names text,
  sheet_date date,
  sheet_progress_pct integer,
  sheet_stage_changed_at timestamptz,
  report_pct integer,
  report_at timestamptz,
  pct_manual_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH office AS (
    SELECT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
    ) AS ok
  ),
  jobs AS (
    SELECT DISTINCT x.id
    FROM unnest(COALESCE(p_job_ids, ARRAY[]::uuid[])) AS x(id)
    WHERE (SELECT ok FROM office)
  ),
  cs AS (
    SELECT c.job_ledger_id, c.work_date, c.user_id
    FROM public.clock_sessions c
    JOIN jobs j ON j.id = c.job_ledger_id
    WHERE c.revoked_at IS NULL
      AND c.rejected_at IS NULL
      AND c.work_date IS NOT NULL
      AND c.work_date >= p_today - 60
      AND c.work_date <= p_today
  ),
  last_day AS (
    SELECT cs.job_ledger_id, max(cs.work_date) AS d FROM cs GROUP BY cs.job_ledger_id
  ),
  last_people AS (
    SELECT cs.job_ledger_id, array_agg(DISTINCT btrim(u.name) ORDER BY btrim(u.name)) AS names
    FROM cs
    JOIN last_day ld ON ld.job_ledger_id = cs.job_ledger_id AND ld.d = cs.work_date
    JOIN public.users u ON u.id = cs.user_id
    WHERE btrim(COALESCE(u.name, '')) <> ''
    GROUP BY cs.job_ledger_id
  ),
  agg AS (
    SELECT cs.job_ledger_id, count(*)::integer AS sessions_60d, count(DISTINCT cs.user_id)::integer AS people_60d
    FROM cs GROUP BY cs.job_ledger_id
  ),
  sheet AS (
    SELECT DISTINCT ON (s.job_ledger_id)
      s.job_ledger_id, s.stage, s.assigned_to_name, s.job_date, s.progress_pct, s.stage_changed_at
    FROM public.people_labor_jobs s
    JOIN jobs j ON j.id = s.job_ledger_id
    ORDER BY s.job_ledger_id, s.job_date DESC NULLS LAST, s.created_at DESC
  ),
  rep AS (
    SELECT DISTINCT ON (r.job_ledger_id)
      r.job_ledger_id,
      ((regexp_match(btrim(r.field_values ->> 'How complete is the job?'), '^[+-]?\d+'))[1])::bigint AS n,
      r.created_at
    FROM public.reports r
    JOIN jobs j ON j.id = r.job_ledger_id
    WHERE btrim(COALESCE(r.field_values ->> 'How complete is the job?', '')) ~ '^[+-]?\d+'
    ORDER BY r.job_ledger_id, r.created_at DESC
  ),
  manual AS (
    SELECT e.job_id, max(e.changed_at) AS at
    FROM public.job_pct_events e
    JOIN jobs j ON j.id = e.job_id
    WHERE e.source = 'manual'
    GROUP BY e.job_id
  )
  SELECT
    j.id AS job_ledger_id,
    ld.d AS last_work_date,
    lp.names AS last_day_people,
    COALESCE(a.sessions_60d, 0) AS sessions_60d,
    COALESCE(a.people_60d, 0) AS people_60d,
    sh.stage AS sheet_stage,
    sh.assigned_to_name AS sheet_names,
    sh.job_date AS sheet_date,
    sh.progress_pct AS sheet_progress_pct,
    sh.stage_changed_at AS sheet_stage_changed_at,
    CASE WHEN rep.n BETWEEN 0 AND 100 THEN rep.n::integer END AS report_pct,
    rep.created_at AS report_at,
    m.at AS pct_manual_at
  FROM jobs j
  LEFT JOIN last_day ld ON ld.job_ledger_id = j.id
  LEFT JOIN last_people lp ON lp.job_ledger_id = j.id
  LEFT JOIN agg a ON a.job_ledger_id = j.id
  LEFT JOIN sheet sh ON sh.job_ledger_id = j.id
  LEFT JOIN rep ON rep.job_ledger_id = j.id
  LEFT JOIN manual m ON m.job_id = j.id;
$$;

REVOKE ALL ON FUNCTION public.list_job_crew_position(uuid[], date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_job_crew_position(uuid[], date) TO authenticated;

COMMENT ON FUNCTION public.list_job_crew_position(uuid[], date) IS
  'Where the crew is, per job, for the Jobs → Pipeline row (v2.3418): last clock day and who was there, 60-day session/people counts, the newest sub sheet (stage, names, date, progress), the newest report percent and its time, the newest hand-set percent time. Office roles only; read-only; SECURITY DEFINER.';
