-- Source of clock punch coordinates: device GPS vs geo-IP fallback (see ClockInOutButton + resolve-ip-geolocation).

ALTER TABLE public.clock_sessions
  ADD COLUMN IF NOT EXISTS clock_in_location_source text,
  ADD COLUMN IF NOT EXISTS clock_out_location_source text;

ALTER TABLE public.clock_sessions
  DROP CONSTRAINT IF EXISTS clock_sessions_clock_in_location_source_check;

ALTER TABLE public.clock_sessions
  ADD CONSTRAINT clock_sessions_clock_in_location_source_check CHECK (clock_in_location_source IS NULL OR clock_in_location_source IN ('gps', 'ip'));

ALTER TABLE public.clock_sessions
  DROP CONSTRAINT IF EXISTS clock_sessions_clock_out_location_source_check;

ALTER TABLE public.clock_sessions
  ADD CONSTRAINT clock_sessions_clock_out_location_source_check
  CHECK (clock_out_location_source IS NULL OR clock_out_location_source IN ('gps', 'ip'));

COMMENT ON COLUMN public.clock_sessions.clock_in_location_source IS 'gps = device geolocation; ip = approximate geo-IP when GPS unavailable.';
COMMENT ON COLUMN public.clock_sessions.clock_out_location_source IS 'gps = device geolocation; ip = approximate geo-IP when GPS unavailable.';
