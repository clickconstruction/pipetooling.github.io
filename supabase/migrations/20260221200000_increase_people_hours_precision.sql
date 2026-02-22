-- Fix seconds changing randomly when entering HH:MM:SS and tabbing away.
-- Root cause: NUMERIC(6,2) rounded to 2 decimals (e.g. 8.5125 → 8.51), losing seconds.
-- Realtime refetch returned rounded value; decimalToHms(8.51) produced wrong seconds (8:30:36 vs 8:30:45).
-- NUMERIC(8,4) preserves second precision: 1 sec = 1/3600 ≈ 0.00028 hrs.

ALTER TABLE public.people_hours
  ALTER COLUMN hours TYPE NUMERIC(8, 4) USING hours::numeric(8, 4);

COMMENT ON COLUMN public.people_hours.hours IS 'Hours worked (decimal). NUMERIC(8,4) preserves HH:MM:SS second precision.';
