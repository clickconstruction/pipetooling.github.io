-- Add customer_id to bids so GC/Builder can use the Customers table

ALTER TABLE public.bids
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bids_customer_id ON public.bids(customer_id);

COMMENT ON COLUMN public.bids.customer_id IS 'Customer (GC/Builder) for this bid; same list as Customers page. Legacy gc_builder_id kept for backward compatibility.';
