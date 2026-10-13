SET lock_timeout = '3s';

-- The sub sheet's two days (v2.5429, residential Messages R8 · 12, PR 2 of 3): the first day a sub was on site and the
-- day their work was done, kept on the sheet (people_labor_jobs) so the sub's flow reads them as facts.
--
-- Until now the sheet kept only the newest of each: progress_at is the newest report from the sub's portal, and
-- stage_changed_at the newest stage move. The job's activity feed kept every report (sub_progress) and every move
-- (sub_stage_change), so both days can be filled for the sheets we already have.
--
--   1) on_site_at: the first report of a real percent while the work is under way. A 0% report or a note with no new
--      percent does not count. Their "my work is done" press does not count either, since it moves the sheet past
--      Working in the same write. Set once and never cleared.
--   2) done_at: the first move out of Working, to the walk-through or to the customer. A move back to Working clears
--      it, and the next move out sets it again. A move between the walk-through and the customer leaves it.
--   3) One BEFORE trigger on the sheet's existing writes fills both. The writers are the sub's portal (submit-sub-portal:
--      a progress report, and "my work is done") and the office's set_sub_sheet_stage. No writer changes.
--   4) The backfill, touching only the rows it fills: done_at from the newest move out of Working the feed kept, else
--      stage_changed_at, for sheets past Working only; on_site_at from the earliest progress report with a percent
--      above 0. Each row it touches also wakes people_labor_jobs_link_job_ledger_biu, which finds nothing to link,
--      since every sheet has had its job link since v2.3435.
-- No new table, no grant, no policy. See docs/migrations/20261014004000_sub_sheet_on_site_done.md.

-- 1) and 2) The two days.
ALTER TABLE public.people_labor_jobs ADD COLUMN IF NOT EXISTS on_site_at timestamptz;
ALTER TABLE public.people_labor_jobs ADD COLUMN IF NOT EXISTS done_at timestamptz;

COMMENT ON COLUMN public.people_labor_jobs.on_site_at IS
  'The first report of a percent above 0 from the sub while the sheet was Working (v2.5429). Set once by people_labor_jobs_flow_stamps, never cleared. A 0% report, a note with no new percent and the "my work is done" press do not set it.';
COMMENT ON COLUMN public.people_labor_jobs.done_at IS
  'When the sheet first moved out of Working (v2.5429). Cleared by a move back to Working and set again by the next move out, by people_labor_jobs_flow_stamps. A move between walkthrough and customer_pay leaves it.';

-- 3) The trigger.
CREATE OR REPLACE FUNCTION public.people_labor_jobs_flow_stamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- On site: a new report whose percent is above 0 and is not the one before it, while the work is under way. The
  -- portal's note keeps the percent it had, and "my work is done" moves the stage in the same write.
  IF NEW.on_site_at IS NULL
     AND NEW.progress_at IS NOT NULL
     AND coalesce(NEW.progress_pct, 0) > 0
     AND NEW.stage = 'working'
     AND (TG_OP = 'INSERT'
          OR (NEW.progress_at IS DISTINCT FROM OLD.progress_at
              AND NEW.progress_pct IS DISTINCT FROM OLD.progress_pct)) THEN
    NEW.on_site_at := NEW.progress_at;
  END IF;

  -- Done: the move out of Working stamps it, with the move's own time; Working again clears it.
  IF NEW.stage = 'working' THEN
    NEW.done_at := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.done_at := coalesce(NEW.done_at, NEW.stage_changed_at);
  ELSIF OLD.stage = 'working' THEN
    NEW.done_at := CASE
      WHEN NEW.stage_changed_at IS NOT NULL AND NEW.stage_changed_at IS DISTINCT FROM OLD.stage_changed_at
        THEN NEW.stage_changed_at
      ELSE now()
    END;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.people_labor_jobs_flow_stamps() IS
  'BEFORE INSERT OR UPDATE OF progress_at, progress_pct, stage on people_labor_jobs (v2.5429): stamps on_site_at on the first report of a percent above 0 while Working, and done_at on the first move out of Working, cleared by a move back.';

DROP TRIGGER IF EXISTS people_labor_jobs_flow_stamps_biu ON public.people_labor_jobs;
CREATE TRIGGER people_labor_jobs_flow_stamps_biu
  BEFORE INSERT OR UPDATE OF progress_at, progress_pct, stage ON public.people_labor_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.people_labor_jobs_flow_stamps();

-- 4) The backfill. Neither update names a column the trigger watches, so the trigger stays asleep, and a second run
-- leaves every day already set alone.
UPDATE public.people_labor_jobs s
SET done_at = d.done_at
FROM (
  SELECT s2.id,
         coalesce(
           (SELECT max(e.occurred_at)
              FROM public.job_activity_events e
             WHERE e.event_type = 'sub_stage_change'
               AND e.detail ->> 'source_id' = s2.id::text
               AND e.detail ->> 'from' = 'working'),
           s2.stage_changed_at
         ) AS done_at
    FROM public.people_labor_jobs s2
   WHERE s2.stage <> 'working'
     AND s2.done_at IS NULL
) d
WHERE s.id = d.id
  AND d.done_at IS NOT NULL;

UPDATE public.people_labor_jobs s
SET on_site_at = o.on_site_at
FROM (
  SELECT e.detail ->> 'laborJobId' AS sheet_id, min(e.occurred_at) AS on_site_at
    FROM public.job_activity_events e
   WHERE e.event_type = 'sub_progress'
     AND CASE WHEN jsonb_typeof(e.detail -> 'pct') = 'number' THEN (e.detail ->> 'pct')::numeric ELSE 0 END > 0
   GROUP BY e.detail ->> 'laborJobId'
) o
WHERE s.id::text = o.sheet_id
  AND s.on_site_at IS NULL;
