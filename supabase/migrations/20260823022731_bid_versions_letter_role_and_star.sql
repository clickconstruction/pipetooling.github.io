SET lock_timeout = '3s';

-- v2.2117 (Send or Compare F1): the Cover Letter's New view bundles BID VERSIONS (each at its
-- customer-facing ★ price scenario), not price scenarios. Two additive columns on bid_versions:
--   is_alternate                   — in the letter, an alternate is offered "in lieu of" the base
--                                    bids; base bids add up to the letter total.
--   starred_price_book_version_id  — this version's ★ (customer-facing) price scenario. Until now
--                                    the ★ lived only on bids.selected_price_book_version_id, i.e.
--                                    per bid: switching versions silently lost the other version's ★.
-- Idempotent; old clients ignore both columns.

ALTER TABLE public.bid_versions
  ADD COLUMN IF NOT EXISTS is_alternate boolean NOT NULL DEFAULT false;

ALTER TABLE public.bid_versions
  ADD COLUMN IF NOT EXISTS starred_price_book_version_id uuid NULL
    REFERENCES public.price_book_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bid_versions_starred_pbv_idx
  ON public.bid_versions (starred_price_book_version_id);

COMMENT ON COLUMN public.bid_versions.is_alternate IS
  'Cover Letter (New): true = offered in lieu of the base bids; false = base (adds to the letter total).';
COMMENT ON COLUMN public.bid_versions.starred_price_book_version_id IS
  'This version''s customer-facing (★) price scenario. Mirrors bids.selected_price_book_version_id for the active version.';

-- Backfill: each version's ★ = the bid's saved ★ when that scenario belongs to the version,
-- else the version's first scenario (lowest sort_order, then oldest). Only fills NULLs.
UPDATE public.bid_versions v
SET starred_price_book_version_id = COALESCE(
  (SELECT b.selected_price_book_version_id
     FROM public.bids b
     JOIN public.price_book_versions p ON p.id = b.selected_price_book_version_id
    WHERE b.id = v.bid_id AND p.bid_version_id = v.id),
  (SELECT p.id
     FROM public.price_book_versions p
    WHERE p.bid_id = v.bid_id AND p.bid_version_id = v.id
    ORDER BY p.sort_order ASC, p.created_at ASC
    LIMIT 1)
)
WHERE v.starred_price_book_version_id IS NULL;
