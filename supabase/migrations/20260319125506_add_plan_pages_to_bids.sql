ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS plan_pages TEXT;
COMMENT ON COLUMN public.bids.plan_pages IS 'Plan page references (e.g. 1-5, 6, 8 or A-1, A-2).';
