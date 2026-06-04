-- Add optional location columns to clock_sessions for clock-in and clock-out
ALTER TABLE public.clock_sessions
  ADD COLUMN IF NOT EXISTS clock_in_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS clock_in_lng NUMERIC,
  ADD COLUMN IF NOT EXISTS clock_out_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS clock_out_lng NUMERIC;

COMMENT ON COLUMN public.clock_sessions.clock_in_lat IS 'Latitude at clock-in (optional, from geolocation)';
COMMENT ON COLUMN public.clock_sessions.clock_in_lng IS 'Longitude at clock-in (optional, from geolocation)';
COMMENT ON COLUMN public.clock_sessions.clock_out_lat IS 'Latitude at clock-out (optional, from geolocation)';
COMMENT ON COLUMN public.clock_sessions.clock_out_lng IS 'Longitude at clock-out (optional, from geolocation)';
