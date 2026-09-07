SET lock_timeout = '3s';

-- Customer properties train, PR 1 (v2.3004): provenance for the property
-- record. The property-lookup edge function proposes county / legal
-- description / owner of record from the Texas statewide parcel roll (TxGIO,
-- fed by the appraisal districts); when a person keeps those values, the row
-- remembers where they came from so the sheet can print "Comal Appraisal
-- District · 2025 · Prop ID 178402" beside them and the county's rung on the
-- ladder (parcel / geocoder / city / manual). Additive, idempotent, no CREATE
-- TABLE (customer_addresses already carries the read-only training-mode
-- blocks).

ALTER TABLE public.customer_addresses
  -- '' = never looked up; otherwise which rung answered.
  ADD COLUMN IF NOT EXISTS county_source text NOT NULL DEFAULT ''
    CONSTRAINT customer_addresses_county_source_check
    CHECK (county_source IN ('', 'parcel', 'geocoder', 'city', 'manual')),
  ADD COLUMN IF NOT EXISTS parcel_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS parcel_source text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS parcel_tax_year text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS parcel_looked_up_at timestamp with time zone;

COMMENT ON COLUMN public.customer_addresses.county_source IS
  'Which rung of the county ladder filled county: parcel (statewide roll under the map pin), geocoder (map pin county), city (curated city table — a guess), manual (typed). Empty = unknown.';
COMMENT ON COLUMN public.customer_addresses.parcel_id IS
  'Appraisal-district property ID (PROP_ID) of the parcel the legal description / owner were taken from.';
COMMENT ON COLUMN public.customer_addresses.parcel_source IS
  'Source district as the statewide roll names it, e.g. "Comal Appraisal District".';
COMMENT ON COLUMN public.customer_addresses.parcel_tax_year IS
  'Tax year of the roll the record came from — the roll lags sales, so the affidavit is still checked against the district on the day it files.';
COMMENT ON COLUMN public.customer_addresses.parcel_looked_up_at IS
  'When the property-lookup last ran for this row.';
