SET lock_timeout = '3s';

-- v2.6061: the first day of approved work on a job, kept beside last_work_date by the same trigger.
-- The § 53.054 affidavit's paragraph 5 swears the period the claimant furnished labor and materials;
-- the draft swore one day (the 28th of the last month worked) as both ends because the job carried
-- a last day and no first day. The refresh function reads MIN and MAX in one pass; the triggers on
-- clock_sessions (ins / upd / del, baseline) call it unchanged. Additive and idempotent.

ALTER TABLE public.jobs_ledger ADD COLUMN IF NOT EXISTS first_work_date date;

COMMENT ON COLUMN public.jobs_ledger.first_work_date IS 'Cache: earliest work_date among approved clock_sessions for this job (job_ledger_id); maintained by trigger beside last_work_date.';

-- Last defined in the baseline (refresh_jobs_ledger_last_work_date): the same predicate, MIN beside MAX.
CREATE OR REPLACE FUNCTION public.refresh_jobs_ledger_last_work_date(p_job_id uuid) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min date;
  v_max date;
BEGIN
  IF p_job_id IS NULL THEN
    RETURN;
  END IF;

  SELECT MIN(cs.work_date), MAX(cs.work_date) INTO v_min, v_max
  FROM public.clock_sessions cs
  WHERE cs.job_ledger_id = p_job_id
    AND cs.approved_at IS NOT NULL
    AND cs.rejected_at IS NULL
    AND cs.revoked_at IS NULL;

  UPDATE public.jobs_ledger jl
  SET first_work_date = v_min,
      last_work_date = v_max
  WHERE jl.id = p_job_id;
END;
$$;

COMMENT ON FUNCTION public.refresh_jobs_ledger_last_work_date(uuid) IS 'Definer: recompute jobs_ledger.first_work_date and last_work_date from qualifying clock_sessions for one job.';

-- Backfill: every job with an approved session gets its first day; a job with none stays null.
UPDATE public.jobs_ledger jl
SET first_work_date = s.first_day
FROM (
  SELECT cs.job_ledger_id, MIN(cs.work_date) AS first_day
  FROM public.clock_sessions cs
  WHERE cs.job_ledger_id IS NOT NULL
    AND cs.approved_at IS NOT NULL
    AND cs.rejected_at IS NULL
    AND cs.revoked_at IS NULL
  GROUP BY cs.job_ledger_id
) s
WHERE s.job_ledger_id = jl.id
  AND jl.first_work_date IS DISTINCT FROM s.first_day;
