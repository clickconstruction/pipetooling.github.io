SET lock_timeout = '3s';

-- v2.2741 — when a signed bid-room proposal (estimates.bid_id) is linked to a job through ANY
-- door (Create job from the ledger, Link existing job, apply_estimate_to_job, a hand edit), the
-- job inherits the bid. That is what lets the Jobs → Stages contract chip find the GC's
-- signature (it looks up bid_proposal estimates by jobs_ledger.bid_id) and lets the Bid Board
-- show the job. Never overwrites a bid someone set by hand on the job.

CREATE OR REPLACE FUNCTION public.estimates_link_job_stamps_bid()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.job_ledger_id IS NOT NULL AND NEW.bid_id IS NOT NULL THEN
    UPDATE public.jobs_ledger
       SET bid_id = NEW.bid_id
     WHERE id = NEW.job_ledger_id
       AND bid_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS estimates_link_job_stamps_bid ON public.estimates;
CREATE TRIGGER estimates_link_job_stamps_bid
  AFTER INSERT OR UPDATE OF job_ledger_id, bid_id ON public.estimates
  FOR EACH ROW
  EXECUTE FUNCTION public.estimates_link_job_stamps_bid();

COMMENT ON FUNCTION public.estimates_link_job_stamps_bid() IS
  'v2.2741: a signed bid-room proposal linked to a job stamps jobs_ledger.bid_id (only when unset), so the Stages contract chip and the Bid Board can see the job ↔ bid link.';
