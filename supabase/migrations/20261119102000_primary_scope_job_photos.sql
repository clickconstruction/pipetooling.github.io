SET lock_timeout = '3s';

-- A primary reads the photo notes, the first looks and the crew's position of the jobs they have a claim on (punch
-- list #400, PR 3 of 5; to-dos/primary-job-doors.md, the owner's call 2 of 2026-11-19). It stands on
-- 20261119040000_primary_scope_reports.sql (primary_can_read_job_reports) and must be pushed after it.
--
-- can_report_stage_progress(job) says yes to a primary on any job, and it must: it is the write gate of a field
-- report, and a primary writes a report on any job. It is also the read gate of everything below, so a primary on
-- no job read every job's photo notes and their files, the first look tied to a job, and the crew's position.
-- This file leaves the gate alone and holds the reads, the way 20261119040000 held report_photos:
--
--   NOT is_primary() OR <their own row> OR primary_can_read_job_reports(job) OR helper_on_job(job)
--
-- primary_can_read_job_reports is the account manager or the listed superintendent, the rule a report follows.
-- helper_on_job is the crew claim the owner asked for: on the job's team, or on its schedule this week or last. It
-- is not tied to a role despite its name, so no new predicate is written.
--
--   1. job_photo_notes: primary_scope_job_photo_notes, RESTRICTIVE FOR ALL. Their own shot always passes, so the
--      Add photo press and its read-back work on any job.
--   2. The job-photo-notes bucket's read policy (20261102171500, dropped and made again as that file does), with
--      the same clause. The owner of the object is their own upload.
--   3. first_looks_select_job_team (20261112130000), with the clause. The office's and the asked tech's policies
--      beside it are untouched, and first_look_files and the first-look-files bucket read first_looks under the
--      caller's own policies, so they follow.
--   4. list_job_crew_position: its live definition with one clause on the job rows.
--
-- What it does not hold, on purpose: stage_checklist_answers, stage_checklist_skips, stage_checklist_records,
-- stage_checklist_templates and the stage-checklist-photos bucket. The photo checklist of a field report reads the
-- job's answers and skips and then writes them (ensureAnswerRow reads the live row before it saves), so a read
-- fence there breaks the report form on a job that is not theirs. list_job_stage_progress and
-- record_stage_progress stay open for the same reason.
-- No CREATE TABLE. Idempotent: CREATE OR REPLACE and DROP POLICY IF EXISTS + CREATE, so a second run changes nothing.

-- ---------- 1 · job_photo_notes ----------

DROP POLICY IF EXISTS primary_scope_job_photo_notes ON public.job_photo_notes;
CREATE POLICY primary_scope_job_photo_notes ON public.job_photo_notes AS RESTRICTIVE FOR ALL
  USING ( NOT (SELECT public.is_primary()) OR by_user_id = (SELECT auth.uid()) OR public.primary_can_read_job_reports(job_id) OR public.helper_on_job(job_id) )
  WITH CHECK ( NOT (SELECT public.is_primary()) OR by_user_id = (SELECT auth.uid()) OR public.primary_can_read_job_reports(job_id) OR public.helper_on_job(job_id) );

-- ---------- 2 · the job-photo-notes bucket ----------

-- Objects are named <job_id>/<file>. The insert and delete policies stay as they are.
DROP POLICY IF EXISTS job_photo_notes_files_select ON storage.objects;
CREATE POLICY job_photo_notes_files_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'job-photo-notes'
    AND public.can_report_stage_progress(((storage.foldername(name))[1])::uuid)
    AND (
      NOT (SELECT public.is_primary())
      OR owner = (SELECT auth.uid())
      OR public.primary_can_read_job_reports(((storage.foldername(name))[1])::uuid)
      OR public.helper_on_job(((storage.foldername(name))[1])::uuid)
    )
  );

-- ---------- 3 · the first look tied to a job ----------

DROP POLICY IF EXISTS first_looks_select_job_team ON public.first_looks;
CREATE POLICY first_looks_select_job_team ON public.first_looks FOR SELECT TO authenticated
  USING (
    job_id IS NOT NULL
    AND public.can_report_stage_progress(job_id)
    AND (
      NOT (SELECT public.is_primary())
      OR public.primary_can_read_job_reports(job_id)
      OR public.helper_on_job(job_id)
    )
  );

-- ---------- list_job_crew_position(uuid[],date): the job rows, a primary held to the jobs whose reports they read ----------

CREATE OR REPLACE FUNCTION public.list_job_crew_position(p_job_ids uuid[], p_today date)
 RETURNS TABLE(job_ledger_id uuid, last_work_date date, last_day_people text[], sessions_60d integer, people_60d integer, sheet_stage text, sheet_names text, sheet_date date, sheet_progress_pct integer, sheet_stage_changed_at timestamp with time zone, report_pct integer, report_at timestamp with time zone, pct_manual_at timestamp with time zone, pct_set_at timestamp with time zone, pct_source text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      -- Primary scoping, the whole row (2026-11-19): the rule v2.7906 put on the newest-report percent below.
      AND (NOT (SELECT public.is_primary()) OR public.primary_can_read_job_reports(x.id))
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
      -- Primary scoping, reports (2026-11-19): the percent is a report's own line.
      AND (NOT (SELECT public.is_primary()) OR public.primary_can_read_report(r.job_ledger_id, r.project_id, r.bid_id, r.created_by_user_id))
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
$function$;

