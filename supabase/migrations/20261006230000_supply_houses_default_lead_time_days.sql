SET lock_timeout = '3s';

-- Submittals: a lead time is a fact about a house, not about one bid (punch list #89, item 2).
-- A part with no lead time of its own takes its house's usual one on the procurement log, so
-- order-by dates and the calendar appear without typing a number on every part of every bid.
ALTER TABLE public.supply_houses ADD COLUMN IF NOT EXISTS default_lead_time_days integer CHECK (default_lead_time_days IS NULL OR (default_lead_time_days >= 0 AND default_lead_time_days <= 730));
COMMENT ON COLUMN public.supply_houses.default_lead_time_days IS 'The house''s usual lead time in days; a submittal part with none of its own reads it on the procurement log.';
