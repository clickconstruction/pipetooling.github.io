-- Add Estimated Job Start Date to bids (for won bids)

ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS estimated_job_start_date DATE;

COMMENT ON COLUMN public.bids.estimated_job_start_date IS 'Estimated job start date when bid is won.';
