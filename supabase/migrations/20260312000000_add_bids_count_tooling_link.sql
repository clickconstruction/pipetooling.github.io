-- Add Count Tooling link to bids (counttooling.com URLs)

ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS count_tooling_link TEXT;

COMMENT ON COLUMN public.bids.count_tooling_link IS 'Count Tooling link (counttooling.com).';
