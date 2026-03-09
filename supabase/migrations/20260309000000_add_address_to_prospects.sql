-- Add address to prospects
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS address TEXT;
COMMENT ON COLUMN public.prospects.address IS 'Street address for the prospect';
