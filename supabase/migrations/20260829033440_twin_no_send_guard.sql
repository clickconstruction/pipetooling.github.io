SET lock_timeout = '3s';

-- Estimator-twin pipeline Wave 4.3: the no-send line becomes PHYSICS (it was mission-text
-- policy since M3). A twin drafts everything — counts, materials, labor, Workbench section
-- prices, the letter — but the commitment acts stay human:
--   * SENDING: bids.bid_date_sent / submitted_to (the letter's Mark-sent stamps) and any
--     bid_version_sends row (a send record IS a send);
--   * DECIDING: bids.outcome and per-GC bid_versions.outcome/outcome_at (won/lost is the
--     owner's call to record).
-- Enforced with triggers rather than RLS because these are COLUMN-level rules on tables
-- twins legitimately write (the fence already row-scopes them to own/assigned bids).

CREATE OR REPLACE FUNCTION public.twin_no_send_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_digital_twin() THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'bids' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.bid_date_sent IS NOT NULL OR NEW.outcome IS NOT NULL THEN
        RAISE EXCEPTION 'digital twins draft only: sending and outcomes are human acts (bids.bid_date_sent/outcome)';
      END IF;
    ELSE
      IF NEW.bid_date_sent IS DISTINCT FROM OLD.bid_date_sent
         OR NEW.submitted_to IS DISTINCT FROM OLD.submitted_to
         OR NEW.outcome IS DISTINCT FROM OLD.outcome THEN
        RAISE EXCEPTION 'digital twins draft only: sending and outcomes are human acts (bids.bid_date_sent/submitted_to/outcome)';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'bid_versions' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.outcome IS NOT NULL THEN
        RAISE EXCEPTION 'digital twins draft only: per-GC outcomes are human acts (bid_versions.outcome)';
      END IF;
    ELSIF NEW.outcome IS DISTINCT FROM OLD.outcome OR NEW.outcome_at IS DISTINCT FROM OLD.outcome_at THEN
      RAISE EXCEPTION 'digital twins draft only: per-GC outcomes are human acts (bid_versions.outcome)';
    END IF;
  ELSIF TG_TABLE_NAME = 'bid_version_sends' THEN
    RAISE EXCEPTION 'digital twins draft only: recording a send is a human act (bid_version_sends)';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS twin_no_send_guard ON public.bids;
CREATE TRIGGER twin_no_send_guard BEFORE INSERT OR UPDATE ON public.bids
  FOR EACH ROW EXECUTE FUNCTION public.twin_no_send_guard();

DROP TRIGGER IF EXISTS twin_no_send_guard ON public.bid_versions;
CREATE TRIGGER twin_no_send_guard BEFORE INSERT OR UPDATE ON public.bid_versions
  FOR EACH ROW EXECUTE FUNCTION public.twin_no_send_guard();

DROP TRIGGER IF EXISTS twin_no_send_guard ON public.bid_version_sends;
CREATE TRIGGER twin_no_send_guard BEFORE INSERT OR UPDATE ON public.bid_version_sends
  FOR EACH ROW EXECUTE FUNCTION public.twin_no_send_guard();
