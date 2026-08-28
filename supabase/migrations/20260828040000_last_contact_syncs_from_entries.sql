SET lock_timeout = '3s';

-- Per-GC bids Phase 1 (docs/PER_GC_BID_PLAN.md): bids.last_contact becomes a DERIVED roll-up
-- of the communications ledger (bids_submission_entries) instead of a hand-maintained cache
-- with seven independent writers — one of which (Edit Bid's raw datetime field) wrote contact
-- "state" with no ledger row at all.
--
--   • OWNER DECISION (2026-08-27): only entries WITH a contact_method (call / email / text…)
--     count as contacts. Method-less notes are notes — they no longer move last_contact or
--     silence the quiet-bid nag in Waiting-to-hear.
--   • bids.last_contact = max(occurred_at) over the bid's method entries; NULL when none.
--   • Backfill applies the same rule. Bids whose last_contact was bumped by method-less notes
--     move BACKWARD (and may honestly reappear as stale in follow-up lenses) — intended.
--   • Bids with NO entries at all keep their hand-set last_contact (backfill skips them; the
--     trigger only fires on ledger activity).
--   • INVOKER rights: anyone who can write bids_submission_entries already updates bids from
--     the same client flows today (same posture as sync_bid_date_sent_from_sends).

CREATE OR REPLACE FUNCTION public.sync_last_contact_from_entries() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
  AS $$
DECLARE
  v_bid uuid := COALESCE(NEW.bid_id, OLD.bid_id);
BEGIN
  IF v_bid IS NULL THEN RETURN NULL; END IF;
  UPDATE public.bids b
     SET last_contact = sub.max_at
    FROM (SELECT max(e.occurred_at) AS max_at
            FROM public.bids_submission_entries e
           WHERE e.bid_id = v_bid
             AND e.contact_method IS NOT NULL
             AND btrim(e.contact_method) <> '') sub
   WHERE b.id = v_bid
     AND b.last_contact IS DISTINCT FROM sub.max_at;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS bids_submission_entries_sync_last_contact ON public.bids_submission_entries;
CREATE TRIGGER bids_submission_entries_sync_last_contact
  AFTER INSERT OR UPDATE OR DELETE ON public.bids_submission_entries
  FOR EACH ROW EXECUTE FUNCTION public.sync_last_contact_from_entries();

-- Backfill: only bids that HAVE ledger entries converge to the method-entry rule.
UPDATE public.bids b
   SET last_contact = s.max_at
  FROM (SELECT bid_id,
               max(occurred_at) FILTER (WHERE contact_method IS NOT NULL AND btrim(contact_method) <> '') AS max_at
          FROM public.bids_submission_entries
         GROUP BY bid_id) s
 WHERE b.id = s.bid_id
   AND b.last_contact IS DISTINCT FROM s.max_at;
