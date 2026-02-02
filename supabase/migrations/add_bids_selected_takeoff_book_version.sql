-- Persist selected takeoff book version per bid on Takeoffs tab.
-- Run after create_takeoff_book_versions_and_entries.sql.

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS selected_takeoff_book_version_id UUID REFERENCES public.takeoff_book_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bids_selected_takeoff_book_version_id ON public.bids(selected_takeoff_book_version_id);

COMMENT ON COLUMN public.bids.selected_takeoff_book_version_id IS 'Takeoff book version used for this bid on Takeoffs tab (Apply matching Fixture Templates).';
