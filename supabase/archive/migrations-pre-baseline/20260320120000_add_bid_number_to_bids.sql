ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS bid_number TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_bids_bid_number ON public.bids(bid_number);
COMMENT ON COLUMN public.bids.bid_number IS 'Short identifier for bids (e.g. 456). Displayed as B456 in search.';
