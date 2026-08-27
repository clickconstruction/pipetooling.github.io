SET lock_timeout = '3s';

-- v2.2407 (per-GC sent, Option A): bids.bid_date_sent becomes a DERIVED roll-up — the FIRST
-- send across the bid's per-GC send records (bid_version_sends) — instead of a second,
-- hand-writable source of truth that could contradict the packets.
--
--   • The bid-level date = min(sent_on) over the bid's send rows (the day it left the building);
--     NULL when the last send row is removed (un-send → the bid returns to Unsent/Working).
--   • Bids with NO send rows and no versions (version-less bids) keep their hand-set dates —
--     this trigger only fires on send-row activity, and the backfill only touches bids that
--     have send rows.
--   • The trigger runs with INVOKER rights: anyone who may write bid_version_sends
--     (can_access_bid_for_pricing) already updates bids from the same flows today.
--
-- The client (Cover Letter's Mark sent, Edit Bid's per-GC panel) writes the same derived value
-- itself, so the pre-push window behaves identically; the trigger makes it unconditional.

CREATE OR REPLACE FUNCTION public.sync_bid_date_sent_from_sends() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
  AS $$
DECLARE
  v_bid uuid := COALESCE(NEW.bid_id, OLD.bid_id);
BEGIN
  IF v_bid IS NULL THEN RETURN NULL; END IF;
  UPDATE public.bids b
     SET bid_date_sent = sub.min_sent
    FROM (SELECT min(s.sent_on) AS min_sent
            FROM public.bid_version_sends s
           WHERE s.bid_id = v_bid) sub
   WHERE b.id = v_bid
     AND b.bid_date_sent IS DISTINCT FROM sub.min_sent;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS bid_version_sends_sync_bid_date ON public.bid_version_sends;
CREATE TRIGGER bid_version_sends_sync_bid_date
  AFTER INSERT OR UPDATE OR DELETE ON public.bid_version_sends
  FOR EACH ROW EXECUTE FUNCTION public.sync_bid_date_sent_from_sends();

-- Backfill: bids that already have send rows converge to the first-send roll-up (multi-send
-- bids previously carried the LAST mark-sent date). Hand-set dates on bids with no send rows
-- are untouched.
UPDATE public.bids b
   SET bid_date_sent = s.min_sent
  FROM (SELECT bid_id, min(sent_on) AS min_sent
          FROM public.bid_version_sends
         GROUP BY bid_id) s
 WHERE b.id = s.bid_id
   AND b.bid_date_sent IS DISTINCT FROM s.min_sent;
