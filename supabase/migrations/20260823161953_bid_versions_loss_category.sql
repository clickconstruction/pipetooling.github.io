SET lock_timeout = '3s';

-- Bids by GC (v2.2164): per-GC loss reason. A bid won with one GC and lost with another needs the
-- loss reason on the losing packet; single-GC bids keep writing bids.loss_category.
-- Same vocabulary as bids.loss_category (gc_lost, price, other_sub, project_died, no_bid, no_answer).
ALTER TABLE public.bid_versions
  ADD COLUMN IF NOT EXISTS loss_category text;

COMMENT ON COLUMN public.bid_versions.loss_category IS
  'Per-GC loss reason (Bids by GC v2.2164): same keys as bids.loss_category. NULL = not recorded / not lost. The free-text note lives in outcome_note.';
