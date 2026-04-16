-- Revert optional proposal fields on bid count rows (Counts tab).
ALTER TABLE public.bids_count_rows
  DROP COLUMN IF EXISTS line_unit_price,
  DROP COLUMN IF EXISTS line_description;
