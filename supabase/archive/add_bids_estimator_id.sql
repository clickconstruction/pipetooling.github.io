-- Add optional Estimator user reference to each bid

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS estimator_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bids_estimator_id ON public.bids(estimator_id);

COMMENT ON COLUMN public.bids.estimator_id IS 'User (estimator) assigned to this bid.';
