-- Add unit_price_override to bid_pricing_assignments for per-bid price overrides in Price Model
ALTER TABLE public.bid_pricing_assignments
ADD COLUMN IF NOT EXISTS unit_price_override NUMERIC(10,2) NULL;

COMMENT ON COLUMN public.bid_pricing_assignments.unit_price_override IS 'When set, overrides price_book_entry total_price for this bid. Used in Pricing tab Price Model.';
