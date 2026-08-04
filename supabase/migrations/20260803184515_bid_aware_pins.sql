SET lock_timeout = '3s';

-- Bid-aware pins (v2.1335): user_pinned_tabs learns an optional bid scope so a
-- pin can point at ONE bid's tab (e.g. "BP352 · Pricing" → /bids?tab=pricing&
-- bidId=…), not just the page+tab. Column-additive: old clients ignore bid_id
-- and their inserts leave it NULL, so deploy order is safe in that direction
-- (a NEW client's bid-pin insert needs this migration — push promptly after
-- merge). ON DELETE CASCADE cleans a bid's pins when the bid is deleted.
--
-- The unique EXPRESSION index (user_id, path, COALESCE(tab,'')) must widen to
-- include the bid, or two bids pinned on the same tab would collide. Known
-- accepted edge: merge_user_accounts dedupes pinned tabs on path+tab only, so
-- a user merge could drop one of two same-tab bid pins (cosmetic; re-pin).

ALTER TABLE public.user_pinned_tabs
  ADD COLUMN IF NOT EXISTS bid_id uuid REFERENCES public.bids(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS public.user_pinned_tabs_user_path_tab_key;
CREATE UNIQUE INDEX IF NOT EXISTS user_pinned_tabs_user_path_tab_bid_key
  ON public.user_pinned_tabs (user_id, path, COALESCE(tab, ''::text), COALESCE(bid_id::text, ''::text));

CREATE INDEX IF NOT EXISTS idx_user_pinned_tabs_bid
  ON public.user_pinned_tabs (bid_id) WHERE bid_id IS NOT NULL;

COMMENT ON COLUMN public.user_pinned_tabs.bid_id IS
  'Optional bid scope (v2.1335): pin deep-links to this bid on the stored /bids tab. NULL = plain page/tab pin.';
