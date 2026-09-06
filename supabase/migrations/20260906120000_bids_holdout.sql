SET lock_timeout = '3s';

-- Holdout set (LEARNING_PLAN.md lever 3, item 6, v2.2942): a reserved slice of
-- clean A/B references (~20-25, spread across axes, owner-designated) that the
-- robots NEVER practice on, so gates can measure generalization instead of
-- memorization. Additive and idempotent; the operator flips flags later from
-- the Queue lens.

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS holdout boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bids.holdout IS
  'Holdout reference (LEARNING_PLAN lever 3): never run as practice, never quoted in doctrine, never named in audits — reserved for gate measurement only, so gates measure generalization, not memorization. Owner-designated from the dev Queue lens; target ~20-25 clean A/B references spread across axes.';

-- The holdout set stays small (~20-25 rows), so a partial index keeps
-- "which references are held out" lookups cheap without taxing bid writes.
CREATE INDEX IF NOT EXISTS idx_bids_holdout ON public.bids (id) WHERE holdout;
