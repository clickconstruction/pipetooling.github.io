SET lock_timeout = '3s';

-- "Call again on …" for a bid (v2.4419). A GC says "next budget year, call us in January"; the
-- Call queue could only bring the bid back every seven days, and nothing held the date or who to
-- ask for.
--
--   • The date is said in the contact log. A bids_submission_entries row may now carry
--     next_followup_on (a calendar day), who to ask for (a customer_contact_persons row) and what
--     the bid waits on. An entry that removes the date carries next_followup_cleared instead.
--   • bids.next_followup_* is a DERIVED roll-up of that log, the same shape as bids.last_contact
--     (20260828040000): the newest entry that set or cleared a date wins, and
--     bids.next_followup_entry_id points at it, so "who set it, when, what was said" is the log
--     row itself and needs no history table.
--   • An entry that says nothing about a date leaves the bid's date alone: a call in November
--     does not erase "January 5".
--   • Additive only. No row changes: no entry carries a date yet, so every bid stays NULL.
--   • INVOKER rights, like sync_last_contact_from_entries: whoever may write the log already
--     updates the bid from the same screens.

ALTER TABLE public.bids_submission_entries
  ADD COLUMN IF NOT EXISTS next_followup_on date,
  ADD COLUMN IF NOT EXISTS next_followup_contact_person_id uuid,
  ADD COLUMN IF NOT EXISTS next_followup_reason text,
  ADD COLUMN IF NOT EXISTS next_followup_cleared boolean NOT NULL DEFAULT false;

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS next_followup_on date,
  ADD COLUMN IF NOT EXISTS next_followup_contact_person_id uuid,
  ADD COLUMN IF NOT EXISTS next_followup_reason text,
  ADD COLUMN IF NOT EXISTS next_followup_entry_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bids_submission_entries_next_followup_person_fkey') THEN
    ALTER TABLE public.bids_submission_entries
      ADD CONSTRAINT bids_submission_entries_next_followup_person_fkey
      FOREIGN KEY (next_followup_contact_person_id) REFERENCES public.customer_contact_persons(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bids_submission_entries_next_followup_reason_check') THEN
    ALTER TABLE public.bids_submission_entries
      ADD CONSTRAINT bids_submission_entries_next_followup_reason_check
      CHECK (next_followup_reason IS NULL OR next_followup_reason IN ('budget', 'owner_deciding', 'not_awarded', 'other'));
  END IF;
  -- A row either sets a date or removes it. Who to ask for and what it waits on belong to a date.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bids_submission_entries_next_followup_shape_check') THEN
    ALTER TABLE public.bids_submission_entries
      ADD CONSTRAINT bids_submission_entries_next_followup_shape_check
      CHECK (
        (next_followup_on IS NOT NULL AND NOT next_followup_cleared)
        OR (next_followup_on IS NULL AND next_followup_contact_person_id IS NULL AND next_followup_reason IS NULL)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bids_next_followup_person_fkey') THEN
    ALTER TABLE public.bids
      ADD CONSTRAINT bids_next_followup_person_fkey
      FOREIGN KEY (next_followup_contact_person_id) REFERENCES public.customer_contact_persons(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bids_next_followup_entry_fkey') THEN
    ALTER TABLE public.bids
      ADD CONSTRAINT bids_next_followup_entry_fkey
      FOREIGN KEY (next_followup_entry_id) REFERENCES public.bids_submission_entries(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.bids_submission_entries.next_followup_on IS
  'v2.4419: the day to call again, said when this contact was logged. NULL = this entry says nothing about a date.';
COMMENT ON COLUMN public.bids_submission_entries.next_followup_cleared IS
  'v2.4419: true = this entry removes the bid''s call-again date.';
COMMENT ON COLUMN public.bids.next_followup_on IS
  'v2.4419: DERIVED by sync_next_followup_from_entries from the newest log entry that set or cleared a date. Never written by a screen.';
COMMENT ON COLUMN public.bids.next_followup_entry_id IS
  'v2.4419: the log entry the date came from: who set it, when, and what was said.';

-- The roll-up, recomputed for the bid an entry belongs to (and the bid it left, when one moves).
CREATE OR REPLACE FUNCTION public.sync_next_followup_from_entries() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
  AS $$
DECLARE
  v_bid uuid;
  v_entry uuid;
  v_on date;
  v_person uuid;
  v_reason text;
BEGIN
  -- An insert that says nothing about a date cannot change the roll-up.
  IF TG_OP = 'INSERT' AND NEW.next_followup_on IS NULL AND NOT NEW.next_followup_cleared THEN
    RETURN NULL;
  END IF;
  FOREACH v_bid IN ARRAY ARRAY[
    CASE WHEN TG_OP <> 'INSERT' THEN OLD.bid_id END,
    CASE WHEN TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.bid_id IS DISTINCT FROM OLD.bid_id) THEN NEW.bid_id END
  ] LOOP
    CONTINUE WHEN v_bid IS NULL;
    v_entry := NULL; v_on := NULL; v_person := NULL; v_reason := NULL;
    SELECT e.id, e.next_followup_on, e.next_followup_contact_person_id, e.next_followup_reason
      INTO v_entry, v_on, v_person, v_reason
      FROM public.bids_submission_entries e
     WHERE e.bid_id = v_bid
       AND (e.next_followup_on IS NOT NULL OR e.next_followup_cleared)
     ORDER BY e.occurred_at DESC, e.created_at DESC NULLS LAST, e.id DESC
     LIMIT 1;
    IF v_on IS NULL THEN
      -- No entry ever set a date, or the newest one removed it.
      v_entry := NULL; v_person := NULL; v_reason := NULL;
    END IF;
    UPDATE public.bids b
       SET next_followup_on = v_on,
           next_followup_contact_person_id = v_person,
           next_followup_reason = v_reason,
           next_followup_entry_id = v_entry
     WHERE b.id = v_bid
       AND (b.next_followup_on, b.next_followup_contact_person_id, b.next_followup_reason, b.next_followup_entry_id)
           IS DISTINCT FROM (v_on, v_person, v_reason, v_entry);
  END LOOP;
  RETURN NULL;
END;
$$;

-- A new function gets EXECUTE for anon and authenticated by default; a trigger function is not an RPC.
REVOKE ALL ON FUNCTION public.sync_next_followup_from_entries() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bids_submission_entries_sync_next_followup ON public.bids_submission_entries;
CREATE TRIGGER bids_submission_entries_sync_next_followup
  AFTER INSERT OR UPDATE OR DELETE ON public.bids_submission_entries
  FOR EACH ROW EXECUTE FUNCTION public.sync_next_followup_from_entries();
