-- Add page column to bids_count_rows (Counts tab)

ALTER TABLE public.bids_count_rows
ADD COLUMN IF NOT EXISTS page TEXT;

COMMENT ON COLUMN public.bids_count_rows.page IS 'Page reference for this fixture/count row (plain text).';
