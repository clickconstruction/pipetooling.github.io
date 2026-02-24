-- Add email to prospects
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN public.prospects.email IS 'Contact email address';
