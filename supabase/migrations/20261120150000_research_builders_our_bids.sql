-- v2.8138 — Permits: Builders and the call list count our bids as Market's table of companies does.
-- `research_builders` counted every bid ever made under a name, a digital twin's practice bids
-- among them. Market's table of companies (`bidCompanies`, src/lib/research/permitMarket.ts) leaves
-- a practice bid out and looks back two years, so on one page one name read two counts: the call
-- list's "We bid" tag from this function and the table's Our bids column from the client's count
-- (the audit of punch list #405, 2026-11-20).
--
-- The rule now has one home on the database, two small functions, and `research_builders` calls
-- them. They mirror the client's one home, src/lib/research/ourBids.ts, which the table and the
-- count of a tied customer's bids both read:
--   * a bid counts when it is no practice bid (the ZZ convention on its project name) and was made
--     within two years, by the company calendar's day;
--   * it counts under its customer's name and under the old builders list's name on it, never
--     under a ZZ name or a name that is a bid platform's bucket.
--
-- `research_builders` is copied from 20261119063000 with `named_bids` alone changed. Same shape, so
-- the grants stand and no caller changes. No table, column, index or policy changes.
SET lock_timeout = '3s';

-- 0a. Does one of our bids count? No SET clause, so the planner writes it into the read that calls it.
CREATE OR REPLACE FUNCTION public.research_bid_counts(p_project_name text, p_created_at timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    -- No practice bid: a project name that starts with the word ZZ, whatever its case
    -- ("ZZ Shadow …", "zz test"; not "ZZZ Corp"). isZzBidName in _shared/zzTestJob.ts.
    COALESCE(p_project_name, '') !~* '^\s*zz\M'
    -- Made within two years (730 days, MARKET_BID_DAYS), by the company calendar's day.
    AND (p_created_at IS NULL
         OR (p_created_at AT TIME ZONE 'America/Chicago')::date
            BETWEEN public.app_today() - 730 AND public.app_today());
$$;
COMMENT ON FUNCTION public.research_bid_counts(text, timestamptz) IS
  'Permits (punch list #405): whether one of our bids counts beside a name on the permits. Not a practice bid (a project name that starts with the word ZZ) and made within two years, by the company calendar''s day. research_builders calls it. Mirrors bidCounts in src/lib/research/ourBids.ts, which Market''s table of companies reads.';
REVOKE ALL ON FUNCTION public.research_bid_counts(text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.research_bid_counts(text, timestamptz) TO authenticated, service_role;

-- 0b. The key a bid counts under for one of its names: the permits' key, or none for a name that
-- is no company.
CREATE OR REPLACE FUNCTION public.research_bid_party_key(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    -- A ZZ name: a test customer (isZzTestName).
    WHEN COALESCE(p_name, '') ~* '^\s*zz' THEN NULL
    -- A customer named for a bid platform: the bucket its bids sit under until a GC is chosen
    -- (BID_PLATFORM_KEYS in ourBids.ts).
    WHEN public.research_name_key(p_name) ~ '^(planhub|buildingconnected|constructconnect|isqft|smartbid|bidnet|buildingblok|civcast|demandstar)' THEN NULL
    ELSE public.research_name_key(p_name)
  END;
$$;
COMMENT ON FUNCTION public.research_bid_party_key(text) IS
  'Permits (punch list #405): the key one of our bids counts under for a name on it, as permits are keyed (research_name_key). Null for a ZZ name and for a customer named for a bid platform, which is a bucket and no company. research_builders calls it. Mirrors bidPartyKey in src/lib/research/ourBids.ts.';
REVOKE ALL ON FUNCTION public.research_bid_party_key(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.research_bid_party_key(text) TO authenticated, service_role;

-- 1. Builders. The body of 20261119063000 with named_bids held to the rule.
CREATE OR REPLACE FUNCTION public.research_builders(p_city text)
RETURNS TABLE (
  key text,
  name text,
  sample_contact text,
  kind text,
  customer_id uuid,
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
  SELECT p.builder_key, bd.name, p.sample_contact, bd.kind, bd.customer_id,
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
  'Permits, Builders and the call list: every name on a city''s commercial building permits of twelve months, with its permits, the ones with no plumbing permit yet, the plumber it uses most, the office''s mark and our bids with it. A bid counts by research_bid_counts (no practice bid, two years) under research_bid_party_key, the rule Market''s table of companies counts by.';
