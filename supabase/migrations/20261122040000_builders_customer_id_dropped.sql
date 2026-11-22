-- v2.8261 — Permits: `builders.customer_id` is dropped (punch list #307, PR 6's leftover).
-- The column came with the table (20261110090000) to say which of our customers a name on the
-- permits is. Nothing ever wrote it. The answer on a name went to a table of its own the same day,
-- `builder_customer_answers` (20261110223054), which keeps every answer with who gave it and when,
-- and one name can be tied to more than one customer there. The column stayed, null on every row.
--
-- Read on prod before writing (2026-11-21, read only): `builders` holds no row, so no value is
-- lost. The column's one dependent is its own foreign key, which goes with it. No view, policy,
-- index or trigger names it. `research_builders` is the one function whose body reads it.
--
-- `research_builders` returned the column, so it goes first. Its return loses `customer_id`,
-- which CREATE OR REPLACE cannot do, so the function is dropped and made again here with its
-- comment and its grants. The body is 20261120150000's with that one column gone and nothing
-- else moved. The client read the field into `BuilderRow` and no screen used it, so a client
-- from either side of the merge reads the same list.
--
-- The older files that wrote `research_builders` (20261110090000, 20261111003750,
-- 20261119063000, 20261120150000) read the column in their bodies, so none of them runs a second
-- time after this one. The bed `permit-skim` runs this file twice in their place.
SET lock_timeout = '3s';

-- 1. Builders, without the column. Dropped first: a return cannot lose a column in place.
DROP FUNCTION IF EXISTS public.research_builders(text);
CREATE OR REPLACE FUNCTION public.research_builders(p_city text)
RETURNS TABLE (
  key text,
  name text,
  sample_contact text,
  kind text,
  mark text,
  mark_reason text,
  mark_by_name text,
  mark_at timestamptz,
  permits integer,
  open integer,
  last_permit_on date,
  plumber text,
  plumber_jobs integer,
  bids integer,
  won integer,
  last_bid_on date
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH mine AS (
    SELECT q.id, q.builder_key, q.contact, q.permit_number, q.address_key, q.city, COALESCE(q.issued_on, q.submitted_on) AS filed_on,
           COALESCE(q.submitted_on, q.issued_on) - 30 AS plumbing_from
    FROM public.permits q
    WHERE q.city = p_city AND q.kind = 'building' AND NOT q.residential AND q.builder_key IS NOT NULL
      AND COALESCE(q.issued_on, q.submitted_on) >= public.app_today() - 365
  ),
  -- The plumbing permits of each of those building permits' own jobs, as research_permits pairs them:
  -- on the number, or at the address when the two are one job, and no older than 30 days before it.
  -- Two joins, each on an index; UNION keeps a permit found both ways once.
  plumb_pairs AS (
    SELECT m.id AS building_id, pl.id AS plumbing_id
    FROM mine m
    JOIN public.permits pl
      ON pl.city = m.city AND pl.permit_number = m.permit_number AND pl.kind = 'plumbing'
     AND COALESCE(pl.issued_on, pl.submitted_on) >= m.plumbing_from
    UNION
    SELECT m.id, pl.id
    FROM mine m
    JOIN public.permits pl
      ON pl.city = m.city AND pl.address_key = m.address_key AND pl.kind = 'plumbing'
     AND COALESCE(pl.issued_on, pl.submitted_on) >= m.plumbing_from
     AND public.permit_address_plumbing_counts(m.city, m.builder_key, pl.builder_key)
  ),
  plumb AS (
    SELECT m.id, m.builder_key, pl.contact AS plumber,
           (pl.contact IS NOT NULL
            AND public.research_name_key(pl.contact) IS DISTINCT FROM public.research_name_key(m.contact)
            AND (pl.builder_key IS NULL OR pl.builder_key IS DISTINCT FROM m.builder_key)) AS named
    FROM plumb_pairs pp
    JOIN mine m ON m.id = pp.building_id
    JOIN public.permits pl ON pl.id = pp.plumbing_id
  ),
  taken AS (
    SELECT DISTINCT id FROM plumb
  ),
  per AS (
    SELECT m.builder_key,
           count(*)::integer AS permits,
           count(*) FILTER (WHERE t.id IS NULL)::integer AS open,
           max(m.filed_on) AS last_permit_on,
           (array_agg(m.contact ORDER BY m.filed_on DESC NULLS LAST))[1] AS sample_contact
    FROM mine m
    LEFT JOIN taken t ON t.id = m.id
    GROUP BY m.builder_key
  ),
  used AS (
    SELECT builder_key, plumber, count(DISTINCT id)::integer AS jobs,
           row_number() OVER (PARTITION BY builder_key ORDER BY count(DISTINCT id) DESC, plumber) AS rn
    FROM plumb
    WHERE named
    GROUP BY builder_key, plumber
  ),
  -- Our bids that count (public.research_bid_counts), each under the names it counts under
  -- (public.research_bid_party_key). The day is the company calendar's, as the window's is.
  named_bids AS (
    SELECT b.id, b.outcome, (b.created_at AT TIME ZONE 'America/Chicago')::date AS bid_on,
           public.research_bid_party_key(c.name) AS customer_key,
           public.research_bid_party_key(g.name) AS gc_key
    FROM public.bids b
    LEFT JOIN public.customers c ON c.id = b.customer_id
    LEFT JOIN public.bids_gc_builders g ON g.id = b.gc_builder_id
    WHERE public.research_bid_counts(b.project_name, b.created_at)
  ),
  -- Our bids with each name, by the customer's name or the legacy builder's: two equal joins the
  -- planner can hash, in place of one on an OR that compared every builder with every bid.
  our_bids AS (
    SELECT p.builder_key, nb.id, nb.outcome, nb.bid_on
    FROM per p
    JOIN named_bids nb ON nb.customer_key = p.builder_key
    UNION
    SELECT p.builder_key, nb.id, nb.outcome, nb.bid_on
    FROM per p
    JOIN named_bids nb ON nb.gc_key = p.builder_key
  ),
  ours AS (
    SELECT ob.builder_key,
           count(DISTINCT ob.id)::integer AS bids,
           count(DISTINCT ob.id) FILTER (WHERE ob.outcome IN ('won', 'started_or_complete'))::integer AS won,
           max(ob.bid_on) AS last_bid_on
    FROM our_bids ob
    GROUP BY ob.builder_key
  ),
  marks AS (
    SELECT DISTINCT ON (m.builder_key) m.builder_key, m.mark, m.reason, m.marked_by, m.marked_at
    FROM public.builder_marks m
    ORDER BY m.builder_key, m.marked_at DESC
  )
  SELECT p.builder_key, bd.name, p.sample_contact, bd.kind,
         NULLIF(mk.mark, 'none'),
         CASE WHEN mk.mark IS NULL OR mk.mark = 'none' THEN NULL ELSE mk.reason END,
         CASE WHEN mk.mark IS NULL OR mk.mark = 'none' THEN NULL ELSE mu.name END,
         CASE WHEN mk.mark IS NULL OR mk.mark = 'none' THEN NULL ELSE mk.marked_at END,
         p.permits, p.open, p.last_permit_on,
         u.plumber, COALESCE(u.jobs, 0),
         COALESCE(o.bids, 0), COALESCE(o.won, 0), o.last_bid_on
  FROM per p
  LEFT JOIN public.builders bd ON bd.key = p.builder_key
  LEFT JOIN marks mk ON mk.builder_key = p.builder_key
  LEFT JOIN public.users mu ON mu.id = mk.marked_by
  LEFT JOIN used u ON u.builder_key = p.builder_key AND u.rn = 1
  LEFT JOIN ours o ON o.builder_key = p.builder_key
  ORDER BY p.permits DESC, p.last_permit_on DESC NULLS LAST, p.builder_key;
$$;
COMMENT ON FUNCTION public.research_builders(text) IS
  'Permits, Builders and the call list: every name on a city''s commercial building permits of twelve months, with its permits, the ones with no plumbing permit yet, the plumber it uses most, the office''s mark and our bids with it. A bid counts by research_bid_counts (no practice bid, two years) under research_bid_party_key, the rule Market''s table of companies counts by. The customer a name is tied to is not here: it is in builder_customer_answers.';
-- A function made new takes the default grants again, anon's among them.
REVOKE ALL ON FUNCTION public.research_builders(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.research_builders(text) TO authenticated, service_role;

-- 2. The column, and its foreign key with it.
ALTER TABLE public.builders DROP COLUMN IF EXISTS customer_id;
COMMENT ON TABLE public.builders IS 'Permits (punch list #302): what the office says about a name that pulls permits, its name and its kind, one row per builder key, made the first time someone says something. Its permits are permits.builder_key; its marks are builder_marks; the customers it is tied to are builder_customer_answers.';
