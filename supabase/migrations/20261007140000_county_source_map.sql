SET lock_timeout = '3s';

-- Which court, follow-up (v2.4778): the first live classification (2026-10-07) placed 132
-- records in a precinct, and many of them had no county on file, so the firm's page would
-- read "? · JP Pct 3" — a precinct with no county. The area's county is the county's own
-- line (or what the office named a drawn area), so the nightly now fills a blank county from
-- the area the point fell in, with a county_source of its own. Additive, idempotent, no
-- CREATE TABLE: the check constraint is replaced to admit 'map'.

ALTER TABLE public.customer_addresses DROP CONSTRAINT IF EXISTS customer_addresses_county_source_check;
ALTER TABLE public.customer_addresses
  ADD CONSTRAINT customer_addresses_county_source_check
  CHECK (county_source IN ('', 'parcel', 'geocoder', 'city', 'manual', 'map'));

COMMENT ON COLUMN public.customer_addresses.county_source IS
  'Which rung of the county ladder filled county: parcel (statewide roll under the map pin), geocoder (map pin county), city (curated city table — a guess), manual (typed), map (the office''s court map, when the record had none). Empty = unknown.';
