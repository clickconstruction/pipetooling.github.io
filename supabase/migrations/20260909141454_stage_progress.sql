SET lock_timeout = '3s';

-- Stage-weighted field reports (v2.3192, owner idea 2026-09-09, mock-up
-- "Burn, Budget and Stages" part C).
--
-- Today a tech guesses a whole-job percent. The Bill tab already splits a job
-- into stages (jobs_ledger_fixtures.stage_kind, v2.3083) and each stage has a
-- price, so a stage's WEIGHT is its share of the stage lines' value and the
-- job's percent is Σ weight × stage percent: 60% of a 35% stage moves the job
-- 21 points. The report form asks "which stage did you work on and how far
-- along is it"; the app does the weighting and still writes the job percent
-- into the report's "How complete is the job?" field, so every existing
-- reader (list_latest_report_completion_pct, the thread stats, the Ready to
-- bill prompt, Job Summary, Burn) keeps working unchanged.
--
-- This migration adds the per-line-item progress and two SECURITY DEFINER
-- doors, because field roles (helpers, subs, superintendents) cannot read or
-- write jobs_ledger_fixtures under RLS — and must not see prices:
--   * list_job_stage_progress(job)  — the stage rows with their WEIGHT (not
--     their amount), current progress, and whether the draw is paid.
--   * record_stage_progress(job, fixture, pct, report) — stamps the stage.
-- Both admit office roles outright and field roles only when they can see the
-- job (team member · their own clock session · the sub/schedule rule the
-- jobs_ledger SELECT policy already uses).

ALTER TABLE public.jobs_ledger_fixtures
  ADD COLUMN IF NOT EXISTS progress_pct integer,
  ADD COLUMN IF NOT EXISTS progress_at timestamptz,
  ADD COLUMN IF NOT EXISTS progress_by uuid,
  ADD COLUMN IF NOT EXISTS progress_report_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_ledger_fixtures_progress_pct_range'
  ) THEN
    ALTER TABLE public.jobs_ledger_fixtures
      ADD CONSTRAINT jobs_ledger_fixtures_progress_pct_range CHECK (progress_pct IS NULL OR (progress_pct >= 0 AND progress_pct <= 100));
  END IF;
END $$;

COMMENT ON COLUMN public.jobs_ledger_fixtures.progress_pct IS
  'Crew-reported percent complete for this stage (v2.3192 stage-weighted reports); null = never reported. Sub-sheet progress (people_labor_jobs.progress_pct) wins in the stage plan when an order exists.';

-- ---------------------------------------------------------------------------
-- Who may see / stamp a job's stages: office roles, or a field user the job is
-- visible to (the same three doors the jobs_ledger SELECT policies open).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_report_stage_progress(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent', 'estimator')
      )
      OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members m WHERE m.job_id = p_job_id AND m.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.clock_sessions cs WHERE cs.job_ledger_id = p_job_id AND cs.user_id = auth.uid())
      OR public.subcontractor_can_read_jobs_ledger_row(p_job_id)
    );
$$;
REVOKE ALL ON FUNCTION public.can_report_stage_progress(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_report_stage_progress(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- The stage rows a report can move: weight (share of the stage lines' value),
-- current progress, paid-draw flag. No amounts leave this function.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_job_stage_progress(p_job_id uuid)
RETURNS TABLE (
  fixture_id uuid,
  name text,
  stage_kind text,
  sequence_order integer,
  weight_pct numeric,
  progress_pct integer,
  progress_at timestamptz,
  draw_paid boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_report_stage_progress(p_job_id) THEN
    RAISE EXCEPTION 'list_job_stage_progress: not allowed';
  END IF;
  RETURN QUERY
  WITH stage_rows AS (
    SELECT
      f.id,
      f.name,
      f.stage_kind,
      f.sequence_order,
      ROUND((COALESCE(f.count, 0) * COALESCE(f.line_unit_price, 0))::numeric, 2) AS amount,
      f.progress_pct,
      f.progress_at,
      f.invoice_id
    FROM public.jobs_ledger_fixtures f
    WHERE f.job_id = p_job_id
      AND f.stage_kind IN ('order', 'any')
  ),
  total AS (
    SELECT COALESCE(SUM(amount), 0) AS total_amount FROM stage_rows WHERE amount > 0
  )
  SELECT
    s.id AS fixture_id,
    s.name,
    s.stage_kind,
    s.sequence_order,
    CASE WHEN t.total_amount > 0 THEN ROUND(s.amount / t.total_amount * 100, 2) ELSE 0 END AS weight_pct,
    s.progress_pct,
    s.progress_at,
    EXISTS (
      SELECT 1 FROM public.jobs_ledger_invoices i
      WHERE i.id = s.invoice_id AND i.status = 'paid'
    ) AS draw_paid
  FROM stage_rows s CROSS JOIN total t
  WHERE s.amount > 0
  ORDER BY (s.stage_kind = 'order') DESC, s.sequence_order, s.name;
END $$;
REVOKE ALL ON FUNCTION public.list_job_stage_progress(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_job_stage_progress(uuid) TO authenticated;
COMMENT ON FUNCTION public.list_job_stage_progress(uuid) IS
  'Stage rows (Order / Any line items with a price) for the field report''s stage picker: weight = share of the stage lines'' value, crew progress, paid-draw flag. No amounts. Office roles, or field users who can see the job (v2.3192).';

-- ---------------------------------------------------------------------------
-- Stamp one stage's progress from a filed report.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_stage_progress(p_job_id uuid, p_fixture_id uuid, p_pct integer, p_report_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_report_stage_progress(p_job_id) THEN
    RAISE EXCEPTION 'record_stage_progress: not allowed';
  END IF;
  IF p_pct IS NULL OR p_pct < 0 OR p_pct > 100 THEN
    RAISE EXCEPTION 'record_stage_progress: pct must be 0..100';
  END IF;
  UPDATE public.jobs_ledger_fixtures
  SET progress_pct = p_pct,
      progress_at = now(),
      progress_by = auth.uid(),
      progress_report_id = p_report_id
  WHERE id = p_fixture_id
    AND job_id = p_job_id
    AND stage_kind IN ('order', 'any');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_stage_progress: no such stage on this job';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.record_stage_progress(uuid, uuid, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_stage_progress(uuid, uuid, integer, uuid) TO authenticated;
COMMENT ON FUNCTION public.record_stage_progress(uuid, uuid, integer, uuid) IS
  'Stamp a stage line item''s crew-reported progress (v2.3192). Same access rule as list_job_stage_progress; the read-only training-mode statement trigger on jobs_ledger_fixtures still applies.';
