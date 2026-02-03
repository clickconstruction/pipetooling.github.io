-- Add Bid Submission link to bids (e.g. Google Drive URL)

ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS bid_submission_link TEXT;

COMMENT ON COLUMN public.bids.bid_submission_link IS 'Bid submission link (e.g. Google Drive).';
