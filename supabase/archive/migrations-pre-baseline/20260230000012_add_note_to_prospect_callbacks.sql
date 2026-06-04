-- Add note column to prospect_callbacks for optional callback notes
ALTER TABLE public.prospect_callbacks ADD COLUMN IF NOT EXISTS note TEXT;
