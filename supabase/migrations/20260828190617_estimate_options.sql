SET lock_timeout = '3s';

-- Estimate Options (v2.2457): one estimate can offer the customer several priced options;
-- the customer picks one on the acceptance page before signing.
--
--   options_snapshot     [{ key, name, description, recommended, line_items }] — null/absent
--                        means a normal single-option estimate (zero behavior change).
--   accepted_option_key  stamped by accept-estimate when the customer accepts an option;
--                        acceptance also freezes the chosen option's lines into
--                        line_items_snapshot + total_cents, so every downstream reader
--                        (accepted document, job creation, notify emails, Pipeline) keeps
--                        reading the fields it always read. Pre-accept, those legacy fields
--                        mirror the RECOMMENDED option.
--
-- Additive + idempotent; no new table, so no read-only RLS re-appliers are needed.

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS options_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS accepted_option_key text;

COMMENT ON COLUMN public.estimates.options_snapshot IS
  'Estimate Options (v2.2457): array of { key, name, description, recommended, line_items }. Null = single-option estimate.';
COMMENT ON COLUMN public.estimates.accepted_option_key IS
  'Key of the option the customer accepted; acceptance freezes that option into line_items_snapshot/total_cents.';
