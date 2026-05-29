-- Travel (Meals + Hotels) cost on the Bids Labor tab.
--
-- 1. Per-bid travel parameters on cost_estimates (mirrors the existing
--    driving_cost_* / estimator_cost_* columns). travel_meals_rate /
--    travel_hotel_rate are editable overrides; they can be pre-filled from
--    the federal GSA per-diem API but the estimator can always type over them.
-- 2. A cache of GSA per-diem rates keyed by (zip, year) so we hit the GSA
--    API at most once per locality per year (rates change annually).

ALTER TABLE public.cost_estimates
  ADD COLUMN IF NOT EXISTS travel_people INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS travel_nights INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS travel_meals_rate NUMERIC(10, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS travel_hotel_rate NUMERIC(10, 2) DEFAULT NULL;

COMMENT ON COLUMN public.cost_estimates.travel_people IS 'Number of travelers for the Travel cost section (default 1).';
COMMENT ON COLUMN public.cost_estimates.travel_nights IS 'Number of overnight stays; travel cost is 0 when nights = 0.';
COMMENT ON COLUMN public.cost_estimates.travel_meals_rate IS 'Per person / per day M&IE rate (editable override; may be pre-filled from GSA).';
COMMENT ON COLUMN public.cost_estimates.travel_hotel_rate IS 'Per person / per night lodging rate (editable override; may be pre-filled from GSA).';

-- GSA per-diem rate cache (federal CONUS rates). Non-sensitive public data;
-- readable/writable by the same roles allowed to use the cost estimate UI.
CREATE TABLE IF NOT EXISTS public.gsa_per_diem_cache (
  zip text NOT NULL,
  year integer NOT NULL,
  meals_rate numeric(10, 2),
  hotel_rate_max numeric(10, 2),
  city text,
  county text,
  state text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (zip, year)
);

COMMENT ON TABLE public.gsa_per_diem_cache IS 'Cached federal GSA per-diem rates by ZIP + year. Populated by the gsa-per-diem Edge Function.';

ALTER TABLE public.gsa_per_diem_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Estimating roles can read gsa per diem cache"
ON public.gsa_per_diem_cache
FOR SELECT
USING (public.is_dev_or_master_or_assistant() OR public.is_estimator());

CREATE POLICY "Estimating roles can insert gsa per diem cache"
ON public.gsa_per_diem_cache
FOR INSERT
WITH CHECK (public.is_dev_or_master_or_assistant() OR public.is_estimator());

CREATE POLICY "Estimating roles can update gsa per diem cache"
ON public.gsa_per_diem_cache
FOR UPDATE
USING (public.is_dev_or_master_or_assistant() OR public.is_estimator())
WITH CHECK (public.is_dev_or_master_or_assistant() OR public.is_estimator());

GRANT SELECT, INSERT, UPDATE ON public.gsa_per_diem_cache TO authenticated;
