SET lock_timeout = '3s';

-- v2.3069 — a job opened from a bid decides the bid.
-- Per-GC bids Q1 (to-dos/per-gc-bid-retirement.md), answered by the owner 2026-09-07:
-- a jobs_ledger row that carries bid_id marks that bid outcome = 'started_or_complete'
-- (insert, or the link changing on update). Every writer is covered — the Job form,
-- Open the job from a won bid, auto_create_job_from_signed_estimate, imports — and the
-- client tells the person who linked it (a lingering toast) when the outcome moved.
--
-- Never moves a bid that already reads started_or_complete; never clears an outcome
-- when a link is removed (that is a human call). Skipped for digital-twin sessions:
-- outcomes are human acts there (twin_no_send_guard would raise and block the job).

CREATE OR REPLACE FUNCTION public.jobs_ledger_bid_outcome_from_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.bid_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.bid_id IS NOT DISTINCT FROM NEW.bid_id THEN
    RETURN NEW;
  END IF;
  IF public.is_digital_twin() THEN
    RETURN NEW;
  END IF;
  UPDATE public.bids
     SET outcome = 'started_or_complete'
   WHERE id = NEW.bid_id
     AND outcome IS DISTINCT FROM 'started_or_complete';
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.jobs_ledger_bid_outcome_from_job() IS
  'v2.3069: a jobs_ledger row that gains a bid_id marks that bid started_or_complete. SECURITY DEFINER so the link never depends on the job writer''s bids update access. Skips twin sessions.';

DROP TRIGGER IF EXISTS jobs_ledger_bid_outcome_from_job ON public.jobs_ledger;
CREATE TRIGGER jobs_ledger_bid_outcome_from_job
  AFTER INSERT OR UPDATE OF bid_id ON public.jobs_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.jobs_ledger_bid_outcome_from_job();

-- Back-fill: every bid that already has a job but does not read started_or_complete.
-- Reported so the push log shows the count (the fragment records the expectation).
DO $$
DECLARE n integer;
BEGIN
  WITH moved AS (
    UPDATE public.bids b
       SET outcome = 'started_or_complete'
     WHERE b.outcome IS DISTINCT FROM 'started_or_complete'
       AND EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.bid_id = b.id)
    RETURNING b.id
  )
  SELECT count(*) INTO n FROM moved;
  RAISE NOTICE 'bid_outcome_from_linked_job: % bid(s) back-filled to started_or_complete', n;
END $$;
