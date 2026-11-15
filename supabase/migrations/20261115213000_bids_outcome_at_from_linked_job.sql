SET lock_timeout = '3s';

-- v2.7347 (punch list #360, PR 2): an award day for the old awards.
--
-- `bids.outcome_at` (v2.3354) is stamped by a trigger when the outcome is set, so every bid won
-- before 2026-09-11 has none: on 2026-11-15, 41 of the 47 awarded bids. The team scorecard, the
-- forecast and the day book all read the award day, and a bid with none falls out of every window.
--
-- A data change, on prod, counted before it was written: 16 of the 41 have a linked job
-- (`jobs_ledger.bid_id`), and the job's creation is the nearest thing on record to the day the
-- work was awarded. Each of those gets the earliest linked job's creation, and never a day before
-- the bid was sent (3 of the 16 were linked to a job that is older than the bid's send). The other
-- 25 have no job and stay empty: nothing on record says when they were won. A lost bid is not
-- touched. The trigger keeps a day a client writes itself, so the UPDATE lands as written.
--
-- Safe to run twice: it only fills a NULL. Each row's bid history gains one line (outcome_at),
-- with no person on it. No row is archived on the working board, so nothing reappears there.

DO $$
DECLARE n integer;
BEGIN
  WITH filled AS (
    UPDATE public.bids b
       SET outcome_at = GREATEST(
             j.first_at,
             COALESCE((b.bid_date_sent::timestamp AT TIME ZONE 'America/Chicago'), j.first_at)
           )
      FROM (
        SELECT bid_id, min(created_at) AS first_at
          FROM public.jobs_ledger
         WHERE bid_id IS NOT NULL
         GROUP BY bid_id
      ) j
     WHERE j.bid_id = b.id
       AND b.outcome_at IS NULL
       AND b.outcome IN ('won', 'started_or_complete')
    RETURNING b.id
  )
  SELECT count(*) INTO n FROM filled;
  RAISE NOTICE 'bids_outcome_at_from_linked_job: % awarded bid(s) given an award day from their linked job', n;
END $$;
