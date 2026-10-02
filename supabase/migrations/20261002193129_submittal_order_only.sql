SET lock_timeout = '3s';

-- Submittals: a fixture the office buys and the GC never sees ("order only"), and the picks
-- remembered on the bid (2026-10-02). Additive: three columns, no row changes.

-- The row is bought and tracked on the procurement log; the GC's room, the package and the
-- cut sheet count leave it out. Its parts keep their own on_submittal underneath, so setting
-- the row back restores them.
ALTER TABLE public.bid_submittal_items
  ADD COLUMN IF NOT EXISTS order_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bid_submittal_items.order_only IS
  'true = the office buys the fixture and the GC never sees the row: off the room, the package and the cut sheet count; on the procurement log.';

-- What the estimator chose for a takeoff fixture, kept for the next build or refresh:
-- order_only beside ticked (ticked false = left out), and the parts left off the fixture.
ALTER TABLE public.bid_submittal_takeoff_choices
  ADD COLUMN IF NOT EXISTS order_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS left_out_line_ids uuid[] NULL;

COMMENT ON COLUMN public.bid_submittal_takeoff_choices.order_only IS
  'true = the fixture comes onto a revision as an order-only row (bid_submittal_items.order_only).';
COMMENT ON COLUMN public.bid_submittal_takeoff_choices.left_out_line_ids IS
  'The takeoff lines left off the fixture: not submitted and not ordered. NULL = none. Same ids as product_line_ids.';
