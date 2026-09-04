SET lock_timeout = '3s';

-- Takeoffs refresh, PR 4 (v2.2774, docs/TAKEOFFS_REFRESH_PLAN.md decision 5):
-- "what this fixture usually gets" — for each fixture key on the bid being
-- costed, the last N bids of the same service type whose Combined takeoff
-- has lines on a count row with that key, with the lines themselves. Feeds
-- New 1's history cards ("Same as B383 · $151.00 · Use these lines") and
-- New 2's "Copy fixtures from a previous bid".
--
-- SECURITY INVOKER: RLS on bids / bids_count_rows / bids_takeoff_rough_part_lines
-- runs as the caller, so an estimator sees only bids she can already open.
-- Bounded by p_bids_per_key (capped at 10) per key; deterministic ORDER BY.
-- Additive and idempotent; no new table, so the read-only re-apply calls are
-- not needed.

-- The one fixture-name normalizer, mirrored from src/lib/bids/takeoffFixtureKey.ts
-- (keep the two in step — the client keys its rows with the TS version and
-- passes the keys in):
--   lowercase · trim · collapse whitespace · strip ONE trailing plan tag
--   ("-12", "_3a", or " 2" — the space form only when the rest holds no
--   digit) · never strip "ft of …" / "px of …" rows · a bare tag stays as is.
CREATE OR REPLACE FUNCTION public.takeoff_fixture_key(p_fixture text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  WITH n AS (
    SELECT lower(regexp_replace(btrim(p_fixture), '\s+', ' ', 'g')) AS s
  ),
  d AS (
    SELECT s,
           regexp_replace(s, '[-_][0-9]+[a-z]?$', '') AS dashed,
           regexp_replace(s, ' [0-9]+[a-z]?$', '') AS spaced
    FROM n
  )
  SELECT CASE
    WHEN s LIKE 'ft of %' OR s LIKE 'px of %' THEN s
    WHEN dashed <> s THEN COALESCE(NULLIF(btrim(dashed), ''), s)
    WHEN spaced <> s AND spaced !~ '[0-9]' THEN COALESCE(NULLIF(btrim(spaced), ''), s)
    ELSE s
  END
  FROM d
$$;

CREATE OR REPLACE FUNCTION public.takeoff_fixture_history(
  p_service_type_id uuid,
  p_keys text[],
  p_exclude_bid_id uuid DEFAULT NULL,
  p_bids_per_key integer DEFAULT 3
)
RETURNS TABLE (
  key text,
  bid_id uuid,
  bid_number text,
  project_name text,
  sent_on date,
  outcome text,
  count_row_id uuid,
  fixture text,
  line_count integer,
  per_unit_cost numeric,
  lines jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH candidate_rows AS (
    -- Count rows on other bids of this service type, on each bid's ACTIVE
    -- version (NULL = the unsplit base), whose key is one we were asked about.
    SELECT cr.id AS count_row_id,
           cr.bid_id,
           cr.fixture,
           public.takeoff_fixture_key(cr.fixture) AS key,
           b.bid_number,
           b.project_name,
           COALESCE(b.bid_date_sent::date, b.created_at::date) AS sent_on,
           b.outcome,
           b.created_at
    FROM public.bids_count_rows cr
    JOIN public.bids b ON b.id = cr.bid_id
    WHERE b.service_type_id = p_service_type_id
      AND b.adopted_into_bid_id IS NULL
      AND (p_exclude_bid_id IS NULL OR b.id <> p_exclude_bid_id)
      AND cr.bid_version_id IS NOT DISTINCT FROM b.selected_bid_version_id
      AND public.takeoff_fixture_key(cr.fixture) = ANY (p_keys)
  ),
  row_lines AS (
    SELECT l.count_row_id,
           count(*)::integer AS line_count,
           sum(l.quantity * l.unit_price)::numeric AS per_unit_cost,
           jsonb_agg(
             jsonb_build_object(
               'id', l.id,
               'part_id', l.part_id,
               'part_name', mp.name,
               'quantity', l.quantity,
               'unit_price', l.unit_price,
               'source_template_id', l.source_template_id,
               'template_name', mt.name,
               'source_material_part_price_id', l.source_material_part_price_id
             )
             ORDER BY l.sequence_order, l.id
           ) AS lines
    FROM public.bids_takeoff_rough_part_lines l
    LEFT JOIN public.material_parts mp ON mp.id = l.part_id
    LEFT JOIN public.material_templates mt ON mt.id = l.source_template_id
    WHERE l.count_row_id IN (SELECT c.count_row_id FROM candidate_rows c)
    GROUP BY l.count_row_id
  ),
  ranked AS (
    -- One example per (key, bid): the row with the most lines.
    SELECT c.*, rl.line_count, rl.per_unit_cost, rl.lines,
           row_number() OVER (PARTITION BY c.key, c.bid_id ORDER BY rl.line_count DESC, c.count_row_id) AS row_rank
    FROM candidate_rows c
    JOIN row_lines rl ON rl.count_row_id = c.count_row_id
  ),
  per_bid AS (
    SELECT r.*,
           dense_rank() OVER (PARTITION BY r.key ORDER BY r.sent_on DESC NULLS LAST, r.created_at DESC, r.bid_id) AS bid_rank
    FROM ranked r
    WHERE r.row_rank = 1
  )
  SELECT p.key, p.bid_id, p.bid_number, p.project_name, p.sent_on, p.outcome,
         p.count_row_id, p.fixture, p.line_count, p.per_unit_cost, p.lines
  FROM per_bid p
  WHERE p.bid_rank <= GREATEST(1, LEAST(COALESCE(p_bids_per_key, 3), 10))
  ORDER BY p.key, p.bid_rank
$$;

REVOKE ALL ON FUNCTION public.takeoff_fixture_key(text) FROM public;
GRANT EXECUTE ON FUNCTION public.takeoff_fixture_key(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.takeoff_fixture_history(uuid, text[], uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.takeoff_fixture_history(uuid, text[], uuid, integer) TO authenticated, service_role;
