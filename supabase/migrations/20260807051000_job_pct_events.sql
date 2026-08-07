SET lock_timeout = '3s';

-- job_pct_events (v2.1441) — Phase 0 of the Weekly Money Movement plan
-- (docs/WEEKLY_MONEY_PLAN.md). jobs_ledger.pct_complete is a single mutable
-- column with no history, so "this job moved 42% -> 55% this week" is
-- underivable after the fact. This table records every change, written by ONE
-- writer: an AFTER UPDATE trigger on jobs_ledger (same single-writer pattern
-- as job_status_events, v2.1435). RULE: no function may INSERT INTO
-- job_pct_events directly — the trigger is the single writer.
--
-- Seeded once with each job's current pct_complete (source 'seed') so the
-- first report week has a start-of-history anchor.

CREATE TABLE IF NOT EXISTS public.job_pct_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  pct INTEGER CHECK (pct IS NULL OR (pct >= 0 AND pct <= 100)),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('seed', 'manual', 'service')),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_job_pct_events_job_changed ON public.job_pct_events(job_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_job_pct_events_changed_at ON public.job_pct_events(changed_at);

ALTER TABLE public.job_pct_events ENABLE ROW LEVEL SECURITY;

-- Read visibility mirrors job_status_events: job-scoped for staff/adoption/
-- sharing, team members see their own jobs' events. No client INSERT/UPDATE/
-- DELETE policies — the SECURITY DEFINER trigger below is the only writer.
DROP POLICY IF EXISTS "job_pct_events_select" ON public.job_pct_events;
CREATE POLICY "job_pct_events_select"
ON public.job_pct_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = job_pct_events.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = j.id AND user_id = auth.uid())
    )
  )
);

CREATE OR REPLACE FUNCTION public.log_job_pct_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.job_pct_events (job_id, pct, source, changed_by_user_id)
  VALUES (
    NEW.id,
    NEW.pct_complete,
    CASE WHEN auth.uid() IS NULL THEN 'service' ELSE 'manual' END,
    auth.uid()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_ledger_log_pct_change ON public.jobs_ledger;
CREATE TRIGGER jobs_ledger_log_pct_change
  AFTER UPDATE OF pct_complete ON public.jobs_ledger
  FOR EACH ROW
  WHEN (OLD.pct_complete IS DISTINCT FROM NEW.pct_complete)
  EXECUTE FUNCTION public.log_job_pct_change();

-- One-time idempotent baseline: anchor every job that already has a pct value
-- and no history row yet.
INSERT INTO public.job_pct_events (job_id, pct, source, changed_by_user_id)
SELECT jl.id, jl.pct_complete, 'seed', NULL
FROM public.jobs_ledger jl
WHERE jl.pct_complete IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.job_pct_events e WHERE e.job_id = jl.id);

-- New table => re-apply the read-only training-mode guards (CLAUDE.md rule).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
