-- Working board soft-archive: hide from kanban / lists while keeping placements.
ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS working_board_archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS working_board_archived_by uuid REFERENCES public.users (id);

COMMENT ON COLUMN public.bids.working_board_archived_at IS 'When set, bid is hidden from Unsent/Working UI and clock quick picks; placements row may remain.';
COMMENT ON COLUMN public.bids.working_board_archived_by IS 'User who archived the bid on the working board.';

CREATE INDEX IF NOT EXISTS bids_working_board_archived_at_partial
  ON public.bids (working_board_archived_at)
  WHERE working_board_archived_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.bids_clear_working_board_archive_on_progress()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.bid_date_sent IS NOT NULL THEN
    NEW.working_board_archived_at := NULL;
    NEW.working_board_archived_by := NULL;
  ELSIF NEW.outcome IS NOT NULL AND NEW.outcome IN ('won', 'lost', 'started_or_complete') THEN
    NEW.working_board_archived_at := NULL;
    NEW.working_board_archived_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bids_clear_working_board_archive_on_progress ON public.bids;
CREATE TRIGGER bids_clear_working_board_archive_on_progress
  BEFORE INSERT OR UPDATE ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.bids_clear_working_board_archive_on_progress();
