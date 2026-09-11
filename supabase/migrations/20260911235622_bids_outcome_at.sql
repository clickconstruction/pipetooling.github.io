SET lock_timeout = '3s';

-- v2.3354 — bids.outcome_at: the day a bid was decided.
-- Bids → Bid Costs → History & forecast (owner ask 2026-09-11: "the average time
-- from submission to win or lose") needs the day someone marked the bid won or
-- lost. Until now only the fact was stored, not the date; bid_versions.outcome_at
-- exists per GC send but is filled on 2 of 43 rows. This column is stamped by a
-- BEFORE trigger whenever bids.outcome moves into a decided state, cleared when
-- it moves back out, and never touched when a client writes outcome_at itself.
--
-- won → started_or_complete keeps the original decision day (the job link
-- trigger jobs_ledger_bid_outcome_from_job flips won bids to started; that is not
-- a new decision). Back-fill: the few bid_versions rows that carry outcome_at.

ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS outcome_at timestamptz;

COMMENT ON COLUMN public.bids.outcome_at IS
  'v2.3354: when the outcome was set to won / lost / started_or_complete (trigger-stamped; a client may write it explicitly). NULL while pending or unsent.';

CREATE OR REPLACE FUNCTION public.bids_stamp_outcome_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_decided boolean := NEW.outcome IN ('won', 'lost', 'started_or_complete');
  old_decided boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF new_decided AND NEW.outcome_at IS NULL THEN
      NEW.outcome_at := now();
    ELSIF NOT new_decided THEN
      NEW.outcome_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- A client that writes outcome_at itself wins (a back-dated decision, say).
  IF NEW.outcome_at IS DISTINCT FROM OLD.outcome_at THEN
    RETURN NEW;
  END IF;
  IF NEW.outcome IS NOT DISTINCT FROM OLD.outcome THEN
    RETURN NEW;
  END IF;

  old_decided := OLD.outcome IN ('won', 'lost', 'started_or_complete');
  IF new_decided THEN
    -- decided → decided (won → started_or_complete) keeps the first decision day
    IF old_decided AND OLD.outcome_at IS NOT NULL THEN
      NEW.outcome_at := OLD.outcome_at;
    ELSE
      NEW.outcome_at := now();
    END IF;
  ELSE
    NEW.outcome_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.bids_stamp_outcome_at() IS
  'v2.3354: stamps bids.outcome_at when outcome enters won / lost / started_or_complete, clears it on the way out, keeps the first day across won → started_or_complete, and defers to an explicit client write.';

DROP TRIGGER IF EXISTS bids_stamp_outcome_at ON public.bids;
CREATE TRIGGER bids_stamp_outcome_at
  BEFORE INSERT OR UPDATE OF outcome, outcome_at ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.bids_stamp_outcome_at();

-- Back-fill from the per-GC decision dates that exist (earliest per bid).
DO $$
DECLARE n integer;
BEGIN
  WITH filled AS (
    UPDATE public.bids b
       SET outcome_at = v.first_at
      FROM (
        SELECT bid_id, min(outcome_at) AS first_at
          FROM public.bid_versions
         WHERE outcome_at IS NOT NULL
         GROUP BY bid_id
      ) v
     WHERE v.bid_id = b.id
       AND b.outcome_at IS NULL
       AND b.outcome IN ('won', 'lost', 'started_or_complete')
    RETURNING b.id
  )
  SELECT count(*) INTO n FROM filled;
  RAISE NOTICE 'bids_outcome_at: % bid(s) back-filled from bid_versions.outcome_at', n;
END $$;
