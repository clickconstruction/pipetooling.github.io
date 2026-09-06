SET lock_timeout = '3s';

-- v2.2927: stages get a window. A stage is a job line item read as a unit of
-- sub work; a window is the span the office (or, later, the GC) wants it done
-- in. One row per (job, line item). The Jobs → Subs tab reads these beside the
-- sub sheets and work orders; the work-order assembler prefills its dates from
-- the window and stamps the order with the stage it fulfils.
--
-- Additive + idempotent. Nothing reads it until the client that ships with it.

CREATE TABLE IF NOT EXISTS public.job_stage_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  fixture_id uuid NOT NULL REFERENCES public.jobs_ledger_fixtures(id) ON DELETE CASCADE,
  window_start date,
  window_end date,
  window_by text CHECK (window_by IS NULL OR window_by IN ('office', 'gc')),
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_stage_windows_job_fixture_key UNIQUE (job_id, fixture_id),
  CONSTRAINT job_stage_windows_span_check CHECK (window_end IS NULL OR window_start IS NULL OR window_end >= window_start)
);

COMMENT ON TABLE public.job_stage_windows IS
  'A job line item read as a stage of sub work, with the span the office wants it done in. Read by Jobs → Subs; the assembler prefills a work order''s dates from it.';
COMMENT ON COLUMN public.job_stage_windows.window_by IS 'office = set on the Subs tab · gc = accepted from a GC ask (later PR).';

CREATE INDEX IF NOT EXISTS job_stage_windows_job_idx ON public.job_stage_windows (job_id);

DROP TRIGGER IF EXISTS job_stage_windows_set_updated_at ON public.job_stage_windows;
CREATE TRIGGER job_stage_windows_set_updated_at
  BEFORE UPDATE ON public.job_stage_windows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- The order that fulfils a stage. NULL = an order written before stages, or one
-- anchored to a project step instead.
ALTER TABLE public.step_commitments
  ADD COLUMN IF NOT EXISTS stage_window_id uuid REFERENCES public.job_stage_windows(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS step_commitments_stage_window_idx ON public.step_commitments (stage_window_id) WHERE stage_window_id IS NOT NULL;

ALTER TABLE public.job_stage_windows ENABLE ROW LEVEL SECURITY;

-- Read: the office set plus superintendents (they read Jobs → Subs → Pay today).
DROP POLICY IF EXISTS jsw_select ON public.job_stage_windows;
CREATE POLICY jsw_select ON public.job_stage_windows FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev','master_technician','assistant','controller','estimator','superintendent')
  )
);

-- Write: the office set (mirrors jobs_ledger_fixtures and step_commitments).
DROP POLICY IF EXISTS jsw_insert ON public.job_stage_windows;
CREATE POLICY jsw_insert ON public.job_stage_windows FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev','master_technician','assistant','controller','estimator')
  )
);

DROP POLICY IF EXISTS jsw_update ON public.job_stage_windows;
CREATE POLICY jsw_update ON public.job_stage_windows FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev','master_technician','assistant','controller','estimator')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev','master_technician','assistant','controller','estimator')
  )
);

DROP POLICY IF EXISTS jsw_delete ON public.job_stage_windows;
CREATE POLICY jsw_delete ON public.job_stage_windows FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev','master_technician','assistant','controller','estimator')
  )
);

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
