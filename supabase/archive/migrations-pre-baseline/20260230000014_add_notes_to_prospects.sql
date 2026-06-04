-- Add notes to prospects for Prospect List notes panel
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS notes TEXT;
COMMENT ON COLUMN public.prospects.notes IS 'Free-form notes for the prospect, editable in Prospect List';
