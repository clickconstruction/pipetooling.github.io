-- Add submitted_to (name, phone, email) to bids
ALTER TABLE public.bids
ADD COLUMN IF NOT EXISTS submitted_to TEXT;

COMMENT ON COLUMN public.bids.submitted_to IS 'Submitted to: name, phone, email (architect/engineer or via GC)';
