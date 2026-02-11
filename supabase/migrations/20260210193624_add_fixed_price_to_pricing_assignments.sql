-- Add is_fixed_price column to bid_pricing_assignments
-- When true, revenue uses price book entry total directly without multiplying by count

ALTER TABLE public.bid_pricing_assignments
ADD COLUMN IF NOT EXISTS is_fixed_price BOOLEAN NOT NULL DEFAULT false;

-- Add index for queries filtering by fixed price
CREATE INDEX IF NOT EXISTS idx_bid_pricing_assignments_fixed_price 
  ON public.bid_pricing_assignments(is_fixed_price);

COMMENT ON COLUMN public.bid_pricing_assignments.is_fixed_price IS 'When true, revenue uses price book entry total directly without multiplying by count';
