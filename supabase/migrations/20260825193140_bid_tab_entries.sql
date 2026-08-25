SET lock_timeout = '3s';

-- Full bid tab (v2.NNNN, paste capture): one row per bidder amount on a GC's
-- tab, ours flagged — the richer layer under the four bids.bid_tab_* summary
-- columns (v2.2081), which stay derived + authoritative for analytics.
-- Parsing/derivation vocabulary lives in src/lib/bids/bidTabPaste.ts.
CREATE TABLE IF NOT EXISTS public.bid_tab_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  -- The bidder's alternate price when the tab shows one ("$42,977 (alternate $100,672)").
  alternate_amount numeric,
  -- Bidder name when the tab names one; most tabs are anonymous amounts.
  bidder_name text,
  is_ours boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS bid_tab_entries_bid_id_idx ON public.bid_tab_entries(bid_id);

ALTER TABLE public.bid_tab_entries ENABLE ROW LEVEL SECURITY;

-- RLS mirrors bid_version_sends: whoever can work the bid's pricing can read
-- and maintain its tab.
DROP POLICY IF EXISTS "bid_tab_entries_select" ON public.bid_tab_entries;
CREATE POLICY "bid_tab_entries_select" ON public.bid_tab_entries
  FOR SELECT USING (public.can_access_bid_for_pricing(bid_id));

DROP POLICY IF EXISTS "bid_tab_entries_insert" ON public.bid_tab_entries;
CREATE POLICY "bid_tab_entries_insert" ON public.bid_tab_entries
  FOR INSERT WITH CHECK (public.can_access_bid_for_pricing(bid_id));

DROP POLICY IF EXISTS "bid_tab_entries_update" ON public.bid_tab_entries;
CREATE POLICY "bid_tab_entries_update" ON public.bid_tab_entries
  FOR UPDATE USING (public.can_access_bid_for_pricing(bid_id))
  WITH CHECK (public.can_access_bid_for_pricing(bid_id));

DROP POLICY IF EXISTS "bid_tab_entries_delete" ON public.bid_tab_entries;
CREATE POLICY "bid_tab_entries_delete" ON public.bid_tab_entries
  FOR DELETE USING (public.can_access_bid_for_pricing(bid_id));

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
