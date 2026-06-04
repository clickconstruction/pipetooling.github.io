-- Optional per-line quote fields on bid count rows (Counts tab). Separate from Pricing-tab revenue (price book assignments).
ALTER TABLE public.bids_count_rows
  ADD COLUMN IF NOT EXISTS line_unit_price numeric(12, 2) NULL,
  ADD COLUMN IF NOT EXISTS line_description text NULL;

COMMENT ON COLUMN public.bids_count_rows.line_unit_price IS 'Optional unit dollar amount for proposal/scope; not synced to bid_pricing_assignments unless product integrates.';
COMMENT ON COLUMN public.bids_count_rows.line_description IS 'Optional free-text scope or notes for this fixture line.';
