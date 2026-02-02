-- Add optional stage to purchase_orders for Cost Estimate (Rough In, Top Out, Trim Set).
-- Set when PO is created from Bids Takeoff; null for existing POs and Materials-created POs.

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS stage TEXT CHECK (stage IS NULL OR stage IN ('rough_in', 'top_out', 'trim_set'));

COMMENT ON COLUMN public.purchase_orders.stage IS 'Optional stage for Cost Estimate: rough_in, top_out, trim_set. Set when PO is created from Takeoff.';
