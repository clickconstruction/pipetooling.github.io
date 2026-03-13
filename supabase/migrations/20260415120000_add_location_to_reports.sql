-- Add optional location columns to reports (captured at submit time)
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS reported_at_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS reported_at_lng NUMERIC;

COMMENT ON COLUMN public.reports.reported_at_lat IS 'Latitude when report was submitted (optional)';
COMMENT ON COLUMN public.reports.reported_at_lng IS 'Longitude when report was submitted (optional)';
