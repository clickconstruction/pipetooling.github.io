SET lock_timeout = '3s';

-- v2.4385: a version's ★ (bid_versions.starred_price_book_version_id, v2.2117) is one of that
-- version's own prices. Deleting the price open on the Pricing Workbench used to re-pick the lowest
-- sort_order price on the WHOLE bid and save it as the active version's ★ and the bid-level ★, so
-- two versions on prod came to star another version's price (2026-10-01): BP385 Written to Plan
-- (Value Engineered's price) and BP384 NORTHSTAR CONSTRUCTION SERVICES (PlanHub's WENDI). The write
-- is guarded since v2.4377; this repairs the rows it left.
--
-- Each stray ★ moves to the price the version's letter already reads (`starredPricingIdForVersion`:
-- the version's first price by sort_order, then oldest; none when it owns no price), so nothing a
-- GC sees changes. The bid-level ★ moves with it only where it named that same stray price while
-- the stray version is the bid's active one — the save wrote both columns together. Idempotent: a
-- second run finds no stray ★.

WITH stray AS (
  SELECT v.id AS version_id,
         v.bid_id,
         v.starred_price_book_version_id AS old_star,
         (SELECT p.id
            FROM public.price_book_versions p
           WHERE p.bid_version_id = v.id
           ORDER BY p.sort_order, p.created_at NULLS FIRST, p.id
           LIMIT 1) AS new_star
    FROM public.bid_versions v
   WHERE v.starred_price_book_version_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.price_book_versions p
        WHERE p.id = v.starred_price_book_version_id
          AND p.bid_version_id = v.id
     )
),
bid_level AS (
  UPDATE public.bids b
     SET selected_price_book_version_id = s.new_star
    FROM stray s
   WHERE b.id = s.bid_id
     AND b.selected_bid_version_id = s.version_id
     AND b.selected_price_book_version_id = s.old_star
  RETURNING b.id
)
UPDATE public.bid_versions v
   SET starred_price_book_version_id = s.new_star
  FROM stray s
 WHERE v.id = s.version_id;
