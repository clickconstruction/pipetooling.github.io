-- Allow bid outcome 'started_or_complete' in addition to 'won' and 'lost'.
ALTER TABLE public.bids DROP CONSTRAINT IF EXISTS bids_outcome_check;
ALTER TABLE public.bids ADD CONSTRAINT bids_outcome_check CHECK (outcome IN ('won', 'lost', 'started_or_complete'));
