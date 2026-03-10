-- Add purchase_order_id to supply_house_invoices for linking invoices to POs
ALTER TABLE public.supply_house_invoices
  ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_supply_house_invoices_purchase_order_id ON public.supply_house_invoices(purchase_order_id);
COMMENT ON COLUMN public.supply_house_invoices.purchase_order_id IS 'Optional link to the purchase order this invoice covers.';
