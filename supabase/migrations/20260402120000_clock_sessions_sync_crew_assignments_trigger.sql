-- When job_ledger_id or bid_id changes on an approved clock session, recompute
-- people_crew_jobs / people_crew_bids from approved clock hours (same as approve RPC).
-- Covers AssignSessionJobPopover updates without a second approve.

CREATE OR REPLACE FUNCTION public.clock_sessions_sync_crew_assignments_after_job_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_person_name text;
BEGIN
  IF NEW.approved_at IS NULL OR NEW.rejected_at IS NOT NULL OR NEW.revoked_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.job_ledger_id IS NOT DISTINCT FROM NEW.job_ledger_id
     AND OLD.bid_id IS NOT DISTINCT FROM NEW.bid_id THEN
    RETURN NEW;
  END IF;

  SELECT trim(u.name) INTO v_person_name
  FROM public.users u
  WHERE u.id = NEW.user_id;

  IF v_person_name IS NULL OR v_person_name = '' THEN
    RETURN NEW;
  END IF;

  PERFORM public.sync_crew_jobs_from_clock(v_person_name, NEW.work_date);
  PERFORM public.sync_crew_bids_from_clock(v_person_name, NEW.work_date);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.clock_sessions_sync_crew_assignments_after_job_bid() IS
  'After job/bid link changes on an approved session, resync crew assignment rows from clock hours.';

DROP TRIGGER IF EXISTS clock_sessions_sync_crew_assignments_tr
  ON public.clock_sessions;

CREATE TRIGGER clock_sessions_sync_crew_assignments_tr
  AFTER UPDATE OF job_ledger_id, bid_id ON public.clock_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.clock_sessions_sync_crew_assignments_after_job_bid();

-- Realtime: CrewJobsBlock postgres_changes on crew assignment tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'people_crew_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.people_crew_jobs;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'people_crew_bids'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.people_crew_bids;
  END IF;
END
$$;
