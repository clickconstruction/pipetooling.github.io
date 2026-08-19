SET lock_timeout = '3s';

-- ITB / submission web links for a bid (PlanHub, BuildingConnected, …).
-- JSON array of URL strings — a bid going to multiple GCs can carry one link
-- per portal. Additive column on an existing table: row RLS already covers it,
-- and old clients simply ignore it.
ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS itb_links jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.bids.itb_links IS
  'ITB / submission web links (PlanHub, BuildingConnected, …) — JSON array of URL strings.';
