-- Backfill: legacy template-keyed bids → bid-owned price copies (v2.2720 companion).
--
-- APPLIED to prod 2026-09-03 ~20:00 UTC (owner-approved) via psql through the session pooler:
--   188 bids · 202 copies · 20,802 entries · 1,899 assignments + 2,768 custom prices carried
--   (0 mismatches) · 160 bids newly pointed (28 re-pointed from a template to their copy) ·
--   14 secondary copies un-offered on 13 two-/three-template bids.
-- Idempotent: a bid that already owns a copy is not a candidate, so a re-run is a no-op.
-- Skips robot templates on purpose (the twin write fence keys on the robot-flagged parent
-- version; a bid copy would lose it) — those bids rely on the v2.2720 display fallback.
-- Data-only DML: NOT a migration, never goes through `supabase db push`.
--
-- Run:  psql -v ON_ERROR_STOP=1 -v final=ROLLBACK -f scripts/backfill-legacy-template-pricing.sql   (dry run, prints counts)
--       psql -v ON_ERROR_STOP=1 -v final=COMMIT   -f scripts/backfill-legacy-template-pricing.sql   (for real)
-- Connection: see docs/recent-features/v2.2720.md → Applied.
\pset pager off
\timing off
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
-- clone_price_book_version_to_bid() requires auth.uid(); act as Robert (dev).
SELECT set_config('request.jwt.claims', '{"sub":"ad5f7f76-153a-4a19-8da8-db028b3bf4d7","role":"authenticated"}', true) AS jwt_set;
SELECT auth.uid() AS acting_as;

-- 1. Candidates: unsplit bids with NO pricing copy whose assignment / custom-price rows are keyed to a shared template.
CREATE TEMP TABLE legacy_pairs ON COMMIT DROP AS
WITH refs AS (
  SELECT bid_id, price_book_version_id, count(*) AS n
  FROM (
    SELECT bid_id, price_book_version_id FROM public.bid_pricing_assignments
    UNION ALL
    SELECT bid_id, price_book_version_id FROM public.bid_count_row_custom_prices
  ) r
  GROUP BY 1, 2
)
SELECT r.bid_id, r.price_book_version_id AS template_id, v.name AS template_name, r.n
FROM refs r
JOIN public.price_book_versions v ON v.id = r.price_book_version_id AND v.bid_id IS NULL AND v.is_robot = false  -- twin bids keep the robot book (fence)
JOIN public.bids b ON b.id = r.bid_id
WHERE NOT EXISTS (SELECT 1 FROM public.price_book_versions o WHERE o.bid_id = r.bid_id)
  AND NOT EXISTS (SELECT 1 FROM public.bid_versions bv WHERE bv.bid_id = r.bid_id);

\echo === candidates
SELECT count(DISTINCT bid_id) AS bids, count(*) AS bid_template_pairs, sum(n) AS rows_to_carry FROM legacy_pairs;
SELECT template_name, count(*) AS bids, sum(n) AS rows FROM legacy_pairs GROUP BY 1 ORDER BY 2 DESC;
SELECT bid_id, count(*) AS templates FROM legacy_pairs GROUP BY 1 HAVING count(*) > 1;

CREATE TEMP TABLE legacy_before ON COMMIT DROP AS
SELECT (SELECT count(*) FROM public.price_book_versions) AS pbv,
       (SELECT count(*) FROM public.price_book_entries) AS pbe,
       (SELECT count(*) FROM public.bid_pricing_assignments) AS asg,
       (SELECT count(*) FROM public.bid_count_row_custom_prices) AS cus,
       (SELECT count(*) FROM public.bids WHERE selected_price_book_version_id IS NOT NULL) AS bids_with_pointer;

-- 2. Clone each referenced template into the bid (the RPC copies the entries and carries the
--    (bid, template)-keyed assignments + custom prices onto the copy).
CREATE TEMP TABLE legacy_clones (bid_id uuid, template_id uuid, template_name text, n bigint, copy_id uuid) ON COMMIT DROP;
DO $do$
DECLARE p record; v uuid;
BEGIN
  FOR p IN SELECT * FROM legacy_pairs ORDER BY bid_id, n DESC LOOP
    v := public.clone_price_book_version_to_bid(p.template_id, p.bid_id, p.template_name);
    INSERT INTO legacy_clones VALUES (p.bid_id, p.template_id, p.template_name, p.n, v);
  END LOOP;
END
$do$;

-- 3. Point each bid at the copy of the template that held most of its rows.
UPDATE public.bids b
SET selected_price_book_version_id = c.copy_id
FROM (SELECT DISTINCT ON (bid_id) bid_id, copy_id FROM legacy_clones ORDER BY bid_id, n DESC) c
WHERE b.id = c.bid_id;

-- 3b. A bid keyed to two templates gets two copies; only the majority copy is the bid's price.
--     Un-offer the others so an unsplit letter doesn't list them as alternates (v2.2392 rule).
UPDATE public.price_book_versions v
SET include_in_submission = false
FROM legacy_clones c
WHERE v.id = c.copy_id
  AND c.copy_id <> (SELECT copy_id FROM legacy_clones c2 WHERE c2.bid_id = c.bid_id ORDER BY n DESC LIMIT 1);

-- 4. Verification
\echo === secondary copies un-offered
SELECT count(*) AS secondary_copies_unoffered FROM legacy_clones c JOIN public.price_book_versions v ON v.id = c.copy_id WHERE v.include_in_submission = false;
SELECT count(*) AS primary_copies_offered FROM public.bids b JOIN legacy_clones c ON c.copy_id = b.selected_price_book_version_id JOIN public.price_book_versions v ON v.id = c.copy_id WHERE v.include_in_submission = true;
\echo === what changed
SELECT (SELECT count(*) FROM legacy_clones) AS copies_made,
       (SELECT count(*) FROM public.price_book_versions) - pbv AS new_versions,
       (SELECT count(*) FROM public.price_book_entries) - pbe AS new_entries,
       (SELECT count(*) FROM public.bid_pricing_assignments) - asg AS new_assignments,
       (SELECT count(*) FROM public.bid_count_row_custom_prices) - cus AS new_custom_prices,
       (SELECT count(*) FROM public.bids WHERE selected_price_book_version_id IS NOT NULL) - bids_with_pointer AS bids_newly_pointed
FROM legacy_before;

\echo === carried rows per copy vs expected (mismatch = an assignment whose entry the template no longer has)
WITH t AS (
  SELECT c.bid_id, c.template_name, c.n,
         (SELECT count(*) FROM public.bid_pricing_assignments a WHERE a.bid_id = c.bid_id AND a.price_book_version_id = c.copy_id)
       + (SELECT count(*) FROM public.bid_count_row_custom_prices x WHERE x.bid_id = c.bid_id AND x.price_book_version_id = c.copy_id) AS carried
  FROM legacy_clones c
)
SELECT count(*) FILTER (WHERE carried = n) AS exact_matches, count(*) FILTER (WHERE carried <> n) AS mismatches FROM t;
WITH t AS (
  SELECT c.bid_id, c.template_name, c.n,
         (SELECT count(*) FROM public.bid_pricing_assignments a WHERE a.bid_id = c.bid_id AND a.price_book_version_id = c.copy_id)
       + (SELECT count(*) FROM public.bid_count_row_custom_prices x WHERE x.bid_id = c.bid_id AND x.price_book_version_id = c.copy_id) AS carried
  FROM legacy_clones c
)
SELECT b.project_name, t.template_name, t.n AS expected, t.carried FROM t JOIN public.bids b ON b.id = t.bid_id WHERE carried <> n ORDER BY n - carried DESC LIMIT 20;

\echo === every candidate bid now owns a copy and points at it
SELECT count(*) AS bids_still_without_copy FROM (SELECT DISTINCT bid_id FROM legacy_pairs) p
WHERE NOT EXISTS (SELECT 1 FROM public.price_book_versions o WHERE o.bid_id = p.bid_id);
SELECT count(*) AS bids_pointer_not_own_copy FROM (SELECT DISTINCT bid_id FROM legacy_pairs) p
JOIN public.bids b ON b.id = p.bid_id
LEFT JOIN public.price_book_versions v ON v.id = b.selected_price_book_version_id
WHERE v.id IS NULL OR v.bid_id <> p.bid_id;

\echo === BP190
SELECT b.project_name, v.name AS pricing, v.source_version_id = '92b0c353-662b-42b4-8d0e-e9352e84ad1d' AS from_default,
       (SELECT count(*) FROM public.price_book_entries e WHERE e.version_id = v.id) AS entries,
       (SELECT count(*) FROM public.bid_pricing_assignments a WHERE a.price_book_version_id = v.id) AS assignments,
       (SELECT count(*) FROM public.bid_count_row_custom_prices x WHERE x.price_book_version_id = v.id) AS custom_prices
FROM public.bids b JOIN public.price_book_versions v ON v.id = b.selected_price_book_version_id
WHERE b.id = 'c566c5dd-dea1-439b-b83d-d5780623fc92';

\echo === template rows untouched (originals stay; copies are additive)
SELECT (SELECT count(*) FROM public.bid_pricing_assignments a JOIN public.price_book_versions v ON v.id = a.price_book_version_id WHERE v.bid_id IS NULL) AS template_keyed_assignments_remaining;

:final;
