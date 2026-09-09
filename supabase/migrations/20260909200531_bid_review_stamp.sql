SET lock_timeout = '3s';

-- v2.3201 — Mark reviewed: the Review step of the bid flow gets a record.
--
-- The office poster's step 8 ("review") had nothing in the app to read, so the
-- flow strip (v2.3200) drew it as "not tracked". These three columns are the
-- current review on the bid — who, when, and their notes — stamped by the
-- Mark reviewed button. The history lives where every other bid event lives:
-- the button also appends a method-less note to bids_submission_entries
-- (method-less, so it never moves the chase clock — v2.2413's rule).
--
-- Additive and idempotent. No new table (no fence appliers needed); the bids
-- UPDATE policies already cover the columns, and the read-only statement
-- trigger on bids already blocks training-mode users.

ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS review_note text;

COMMENT ON COLUMN public.bids.reviewed_at IS 'When the bid was last marked reviewed (the flow''s Review step). NULL = not yet.';
COMMENT ON COLUMN public.bids.reviewed_by IS 'Who marked it reviewed.';
COMMENT ON COLUMN public.bids.review_note IS 'The reviewer''s notes from that stamp (the full history is in bids_submission_entries).';

-- Reviewing is a human act. Same shape as twin_no_send_guard (20260829033440):
-- a column-level rule on a table twins legitimately write (the fence row-scopes
-- them to own/assigned bids), so a trigger rather than RLS.
CREATE OR REPLACE FUNCTION public.twin_no_review_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_digital_twin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.reviewed_at IS NOT NULL OR NEW.reviewed_by IS NOT NULL OR NEW.review_note IS NOT NULL THEN
      RAISE EXCEPTION 'digital twins draft only: reviewing a bid is a human act (bids.reviewed_at/reviewed_by/review_note)';
    END IF;
  ELSIF NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.review_note IS DISTINCT FROM OLD.review_note THEN
    RAISE EXCEPTION 'digital twins draft only: reviewing a bid is a human act (bids.reviewed_at/reviewed_by/review_note)';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS twin_no_review_guard ON public.bids;
CREATE TRIGGER twin_no_review_guard BEFORE INSERT OR UPDATE ON public.bids
  FOR EACH ROW EXECUTE FUNCTION public.twin_no_review_guard();
