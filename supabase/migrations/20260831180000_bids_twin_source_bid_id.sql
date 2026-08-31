SET lock_timeout = '3s';

-- Robot readiness (v2.2530): pair a digital twin's copy of a bid with the human
-- source bid it duplicates. The Bid Board's robot icon uses this to show the
-- "robot bid exists" state and deep-link to the twin row; twin-mcp's
-- open_backtest (and the future shadow-bid verb) stamps it at open time.
-- Existing ZZ Twin pairs are backfilled by a data pass after this lands
-- (names don't match mechanically, so the backfill is explicit, not DDL).

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS twin_source_bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.bids.twin_source_bid_id IS
  'On a digital-twin copy: the human source bid this robot bid duplicates. Null on human bids. Set by twin-mcp open_backtest/shadow verbs; drives the Bid Board robot-readiness icon.';

CREATE INDEX IF NOT EXISTS bids_twin_source_bid_id_idx
  ON public.bids (twin_source_bid_id)
  WHERE twin_source_bid_id IS NOT NULL;
