-- Add GC/Builder contact fields to bids (per-bid contact name, phone, email)

ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS gc_contact_name TEXT;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS gc_contact_phone TEXT;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS gc_contact_email TEXT;

COMMENT ON COLUMN public.bids.gc_contact_name IS 'GC/Builder contact person name for this bid.';
COMMENT ON COLUMN public.bids.gc_contact_phone IS 'GC/Builder contact phone for this bid.';
COMMENT ON COLUMN public.bids.gc_contact_email IS 'GC/Builder contact email for this bid.';
