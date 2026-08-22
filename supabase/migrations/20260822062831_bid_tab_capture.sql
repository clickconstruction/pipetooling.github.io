SET lock_timeout = '3s';

-- Bid tab capture (v2.2081): the numbers the GC reads off the bid tab, kept
-- structured so losses become comparable ("when we lose on price, we lose by
-- X% over the low"). All nullable — capture is optional and often partial.
-- Vocabulary + validation live in src/lib/bidTabCapture.ts.
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS bid_tab_low numeric;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS bid_tab_high numeric;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS bid_tab_rank_from_low integer;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS bid_tab_bidder_count integer;

COMMENT ON COLUMN public.bids.bid_tab_low IS 'Lowest bid on the GC''s bid tab, as shared. See src/lib/bidTabCapture.ts.';
COMMENT ON COLUMN public.bids.bid_tab_high IS 'Highest bid on the GC''s bid tab, as shared.';
COMMENT ON COLUMN public.bids.bid_tab_rank_from_low IS 'Our position counting from the lowest bid (1 = we were the low bid).';
COMMENT ON COLUMN public.bids.bid_tab_bidder_count IS 'How many bids were on the tab (optional).';
