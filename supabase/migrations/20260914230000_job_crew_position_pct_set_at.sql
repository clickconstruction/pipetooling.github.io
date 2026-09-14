SET lock_timeout = '3s';

-- Pipeline cell residuals, item 1 (to-dos/pipeline-cell-residuals.md, 2026-09-14):
-- a percent that arrived through a field report (job_pct_events source
-- 'service', via propagateReportPctToJob) or the 2026-08-07 back-fill
-- (source 'seed') had no date on the row — v2.3418's RPC only returned
-- `pct_manual_at`, the newest hand-set. The row read "40% typed" with no
-- date and the stale rule had to call it stale whenever a crew had clocked
-- in since: right for Heron's seed, blunt for a report that landed yesterday.
--
-- This version returns two more columns: `pct_set_at` — the `changed_at` of
-- the newest job_pct_events row of ANY source (the trigger logs every change
-- of jobs_ledger.pct_complete, so this is the event that set the number the
-- job carries now) — and `pct_source`, that row's source ('seed' / 'manual' /
-- 'service'). `pct_manual_at` is unchanged. The OUT list changes, so the
-- function is dropped and recreated (CREATE OR REPLACE cannot change a
-- RETURNS TABLE). Grants, SECURITY DEFINER, the office-only guard and the
-- read-only nature are identical to 20260914200000.

DROP FUNCTION IF EXISTS public.list_job_crew_position(uuid[], date);

CREATE FUNCTION public.list_job_crew_position(p_job_ids uuid[], p_today date)
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
  pct_manual_at timestamptz,
  pct_set_at timestamptz,
  pct_source text
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
  ),
  newest AS (
    -- The event that set the number the job carries now, whatever its source.
    SELECT DISTINCT ON (e.job_id) e.job_id, e.changed_at, e.source
    FROM public.job_pct_events e
    JOIN jobs j ON j.id = e.job_id
    ORDER BY e.job_id, e.changed_at DESC
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
    m.at AS pct_manual_at,
    n.changed_at AS pct_set_at,
    n.source AS pct_source
  FROM jobs j
  LEFT JOIN last_day ld ON ld.job_ledger_id = j.id
  LEFT JOIN last_people lp ON lp.job_ledger_id = j.id
  LEFT JOIN agg a ON a.job_ledger_id = j.id
  LEFT JOIN sheet sh ON sh.job_ledger_id = j.id
  LEFT JOIN rep ON rep.job_ledger_id = j.id
  LEFT JOIN manual m ON m.job_id = j.id
  LEFT JOIN newest n ON n.job_id = j.id;
$$;

REVOKE ALL ON FUNCTION public.list_job_crew_position(uuid[], date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_job_crew_position(uuid[], date) TO authenticated;

COMMENT ON FUNCTION public.list_job_crew_position(uuid[], date) IS
  'Where the crew is, per job, for the Jobs → Pipeline row (v2.3418; pct_set_at/pct_source added for the pipeline-cell residuals): last clock day and who was there, 60-day session/people counts, the newest sub sheet (stage, names, date, progress), the newest report percent and its time, the newest hand-set percent time, and the newest percent event of any source with its time and source. Office roles only; read-only; SECURITY DEFINER.';
