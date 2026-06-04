-- Add group_tag column to bids_count_rows (Counts tab)
ALTER TABLE public.bids_count_rows
ADD COLUMN IF NOT EXISTS group_tag TEXT;

COMMENT ON COLUMN public.bids_count_rows.group_tag IS 'Optional group or tag for this fixture/count row (plain text).';
