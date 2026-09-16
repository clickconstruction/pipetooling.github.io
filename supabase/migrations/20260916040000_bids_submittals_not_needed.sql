SET lock_timeout = '3s';

-- Submittals stage 4c (the won question): "Not needed on this job" is an answer the
-- office gives once, on the bid — the Dashboard's "won, no submittal started" card and
-- the Submittals tab both read it. Two nullable columns; no table, no policy change.

ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS submittals_not_needed_at timestamptz;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS submittals_not_needed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.bids.submittals_not_needed_at IS
  'Submittals 4c: when the office answered "Not needed on this job" to the won question; NULL means the question stands. Cleared by "undo" on the Submittals tab.';
COMMENT ON COLUMN public.bids.submittals_not_needed_by IS
  'Submittals 4c: who answered "Not needed on this job".';
