-- Cache MAX(work_date) of qualifying clock sessions on jobs_ledger.last_work_date.
-- Qualifying sessions match crew sync: approved, not rejected, not revoked.

ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS last_work_date date NULL;

COMMENT ON COLUMN public.jobs_ledger.last_work_date IS
  'Cache: latest work_date among approved clock_sessions for this job (job_ledger_id); maintained by trigger.';

CREATE OR REPLACE FUNCTION public.refresh_jobs_ledger_last_work_date(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max date;
BEGIN
  IF p_job_id IS NULL THEN
    RETURN;
  END IF;

  SELECT MAX(cs.work_date) INTO v_max
  FROM public.clock_sessions cs
  WHERE cs.job_ledger_id = p_job_id
    AND cs.approved_at IS NOT NULL
    AND cs.rejected_at IS NULL
    AND cs.revoked_at IS NULL;

  UPDATE public.jobs_ledger jl
  SET last_work_date = v_max
  WHERE jl.id = p_job_id;
END;
$$;

COMMENT ON FUNCTION public.refresh_jobs_ledger_last_work_date(uuid) IS
  'Definer: recompute jobs_ledger.last_work_date from qualifying clock_sessions for one job.';

REVOKE ALL ON FUNCTION public.refresh_jobs_ledger_last_work_date(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.touch_jobs_ledger_last_work_date_from_clock_sessions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.job_ledger_id IS NOT NULL THEN
      PERFORM public.refresh_jobs_ledger_last_work_date(OLD.job_ledger_id);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.job_ledger_id IS NOT NULL THEN
      PERFORM public.refresh_jobs_ledger_last_work_date(NEW.job_ledger_id);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF OLD.job_ledger_id IS DISTINCT FROM NEW.job_ledger_id
     OR OLD.work_date IS DISTINCT FROM NEW.work_date
     OR OLD.approved_at IS DISTINCT FROM NEW.approved_at
     OR OLD.rejected_at IS DISTINCT FROM NEW.rejected_at
     OR OLD.revoked_at IS DISTINCT FROM NEW.revoked_at
  THEN
    IF OLD.job_ledger_id IS NOT NULL THEN
      PERFORM public.refresh_jobs_ledger_last_work_date(OLD.job_ledger_id);
    END IF;
    IF NEW.job_ledger_id IS NOT NULL THEN
      PERFORM public.refresh_jobs_ledger_last_work_date(NEW.job_ledger_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.touch_jobs_ledger_last_work_date_from_clock_sessions() IS
  'After clock_sessions change, refresh jobs_ledger.last_work_date for affected job(s).';

REVOKE ALL ON FUNCTION public.touch_jobs_ledger_last_work_date_from_clock_sessions() FROM PUBLIC;

DROP TRIGGER IF EXISTS clock_sessions_touch_jobs_ledger_last_work_date_ins
  ON public.clock_sessions;
CREATE TRIGGER clock_sessions_touch_jobs_ledger_last_work_date_ins
  AFTER INSERT ON public.clock_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_jobs_ledger_last_work_date_from_clock_sessions();

DROP TRIGGER IF EXISTS clock_sessions_touch_jobs_ledger_last_work_date_del
  ON public.clock_sessions;
CREATE TRIGGER clock_sessions_touch_jobs_ledger_last_work_date_del
  AFTER DELETE ON public.clock_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_jobs_ledger_last_work_date_from_clock_sessions();

DROP TRIGGER IF EXISTS clock_sessions_touch_jobs_ledger_last_work_date_upd
  ON public.clock_sessions;
CREATE TRIGGER clock_sessions_touch_jobs_ledger_last_work_date_upd
  AFTER UPDATE OF job_ledger_id, work_date, approved_at, rejected_at, revoked_at
  ON public.clock_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_jobs_ledger_last_work_date_from_clock_sessions();

-- Backfill from existing sessions
UPDATE public.jobs_ledger jl
SET last_work_date = agg.max_wd
FROM (
  SELECT job_ledger_id, MAX(work_date) AS max_wd
  FROM public.clock_sessions
  WHERE job_ledger_id IS NOT NULL
    AND approved_at IS NOT NULL
    AND rejected_at IS NULL
    AND revoked_at IS NULL
  GROUP BY job_ledger_id
) agg
WHERE jl.id = agg.job_ledger_id;

CREATE INDEX IF NOT EXISTS idx_jobs_ledger_last_work_date
  ON public.jobs_ledger (last_work_date);
