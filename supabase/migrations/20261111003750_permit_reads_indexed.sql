-- v2.6893 — Permits: the skim's and Builders' reads use their indexes (punch list #307).
-- `research_permits`, `research_permits_v2` and `research_builders` paired every building permit
-- with every plumbing permit in a city through `number = number OR address = address`, a join no
-- index serves. On prod each took 2 to 3.5 seconds alone, and a read back as history would have
-- put them past the 8-second statement timeout (found 2026-11-10, before the first read back).
-- The same pairs are now found by two joins, one on the permit number and one on the address,
-- each on an index the table already has (`permits_number_idx`, `permits_address_key_idx`), and
-- joined with UNION so a permit found both ways still counts once. One more change, in
-- `research_permits`: when two plumbing permits tie on a building permit (the same day, both on
-- another number), the name now breaks the tie, where before either could be drawn as the plumber.
-- `research_builders` had a second join of the same kind, every builder against every bid by the
-- customer's name or the legacy builder's; it is two equal joins now. Nothing else in the three
-- bodies changes: they are copied from 20261110224035 (`research_permits`) and 20261110090000
-- (`research_permits_v2`, `research_builders`) with those fragments replaced. Same shapes, same
-- rows, so the grants stand and no caller changes.
SET lock_timeout = '3s';

-- 1. The ledger's and the skim's read.
CREATE OR REPLACE FUNCTION public.research_permits(p_city text, p_since date, p_residential boolean DEFAULT false)
RETURNS TABLE (
  id uuid,
  city text,
  source text,
  permit_number text,
  permit_type text,
  stage text,
  residential boolean,
  work_type text,
  project_name text,
  address text,
  zip text,
  lat double precision,
  lng double precision,
  submitted_on date,
  issued_on date,
  filed_on date,
  declared_value numeric,
  area_sf numeric,
  contact text,
  plumber text,
  plumber_permit_on date,
  verdict text,
  verdict_reason text,
  verdict_look_again_on date,
  verdict_prospect_id uuid,
  verdict_by uuid,
  verdict_by_name text,
  verdict_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH building AS (
    SELECT p.*, COALESCE(p.issued_on, p.submitted_on) AS filed_on
    FROM public.permits p
    WHERE p.city = p_city
      AND p.kind = 'building'
      -- A permit read back as history was never waiting on anyone: it is not on the skim or the ledger.
      AND NOT p.backfilled
      AND (p_residential OR NOT p.residential)
      AND COALESCE(p.issued_on, p.submitted_on) >= p_since
  ),
  -- The plumbing permits on a building permit's number or on its address. Two joins, each on an
  -- index (permits_number_idx, permits_address_key_idx), in place of one join on an OR that no index
  -- serves; UNION keeps a permit found both ways once, as the OR did.
  plumbing_pairs AS (
    SELECT b.id AS building_id, q.id AS plumbing_id
    FROM building b
    JOIN public.permits q
      ON q.city = b.city
     AND q.permit_number = b.permit_number
     AND q.kind = 'plumbing'
     AND COALESCE(q.issued_on, q.submitted_on) >= COALESCE(b.submitted_on, b.issued_on) - 30
    UNION
    SELECT b.id, q.id
    FROM building b
    JOIN public.permits q
      ON q.city = b.city
     AND q.address_key = b.address_key
     AND q.kind = 'plumbing'
     AND COALESCE(q.issued_on, q.submitted_on) >= COALESCE(b.submitted_on, b.issued_on) - 30
  ),
  plumbing AS (
    SELECT b.id AS building_id,
           q.contact,
           q.permit_number <> b.permit_number AS own_number,
           COALESCE(q.issued_on, q.submitted_on) AS on_day,
           -- A name counts only when it is not the building permit's own applicant.
           (q.contact IS NOT NULL AND public.research_name_key(q.contact) IS DISTINCT FROM public.research_name_key(b.contact)) AS names_someone_else
    FROM plumbing_pairs pp
    JOIN building b ON b.id = pp.building_id
    JOIN public.permits q ON q.id = pp.plumbing_id
  ),
  paired AS (
    SELECT building_id,
           -- The name breaks a tie, so two plumbing permits on one day always name the same plumber.
           (array_agg(contact ORDER BY own_number DESC, on_day DESC NULLS LAST, contact) FILTER (WHERE names_someone_else))[1] AS plumber,
           max(on_day) AS plumber_permit_on
    FROM plumbing
    GROUP BY building_id
  ),
  latest AS (
    SELECT DISTINCT ON (v.permit_id) v.permit_id, v.verdict, v.reason, v.look_again_on, v.prospect_id, v.decided_by, v.decided_at
    FROM public.permit_verdicts v
    JOIN building b ON b.id = v.permit_id
    ORDER BY v.permit_id, v.decided_at DESC
  ),
  -- Put back: the newest word on the permit is that it waits again.
  newest AS (
    SELECT * FROM latest WHERE verdict <> 'back'
  )
  SELECT b.id, b.city, b.source, b.permit_number, b.permit_type, b.stage, b.residential, b.work_type, b.project_name,
         b.address, b.zip, b.lat, b.lng, b.submitted_on, b.issued_on, b.filed_on, b.declared_value, b.area_sf, b.contact,
         pr.plumber, pr.plumber_permit_on,
         n.verdict, n.reason, n.look_again_on, n.prospect_id, n.decided_by, u.name, n.decided_at
  FROM building b
  LEFT JOIN paired pr ON pr.building_id = b.id
  LEFT JOIN newest n ON n.permit_id = b.id
  LEFT JOIN public.users u ON u.id = n.decided_by
  ORDER BY b.filed_on DESC, b.permit_number DESC;
$$;

-- 2. The same rows with the builder beside them.
CREATE OR REPLACE FUNCTION public.research_permits_v2(p_city text, p_since date, p_residential boolean DEFAULT false)
RETURNS TABLE (
  id uuid,
  city text,
  source text,
  permit_number text,
  permit_type text,
  stage text,
  residential boolean,
  work_type text,
  project_name text,
  address text,
  zip text,
  lat double precision,
  lng double precision,
  submitted_on date,
  issued_on date,
  filed_on date,
  declared_value numeric,
  area_sf numeric,
  contact text,
  plumber text,
  plumber_permit_on date,
  verdict text,
  verdict_reason text,
  verdict_look_again_on date,
  verdict_prospect_id uuid,
  verdict_by uuid,
  verdict_by_name text,
  verdict_at timestamptz,
  verdict_reason_code text,
  verdict_for_user uuid,
  verdict_for_name text,
  verdict_pursue_for text,
  builder_key text,
  builder_name text,
  builder_kind text,
  builder_mark text,
  builder_mark_reason text,
  builder_mark_by_name text,
  builder_mark_at timestamptz,
  builder_permits integer,
  builder_open integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT r.*, p.builder_key AS bkey
    FROM public.research_permits(p_city, p_since, p_residential) r
    JOIN public.permits p ON p.id = r.id
  ),
  latest AS (
    SELECT DISTINCT ON (v.permit_id) v.permit_id, v.verdict, v.reason_code, v.for_user_id, v.pursue_for
    FROM public.permit_verdicts v
    JOIN base r ON r.id = v.permit_id
    ORDER BY v.permit_id, v.decided_at DESC
  ),
  -- A builder's building permits in the last year, and whether a plumbing permit sits on each.
  theirs AS (
    SELECT q.builder_key,
           -- A plumbing permit on the number, or on the address: one indexed lookup each.
           (
             EXISTS (SELECT 1 FROM public.permits pl WHERE pl.city = q.city AND pl.permit_number = q.permit_number AND pl.kind = 'plumbing')
             OR EXISTS (SELECT 1 FROM public.permits pl WHERE pl.city = q.city AND pl.address_key = q.address_key AND pl.kind = 'plumbing')
           ) AS has_plumbing
    FROM public.permits q
    WHERE q.city = p_city AND q.kind = 'building' AND NOT q.residential AND q.builder_key IS NOT NULL
      AND COALESCE(q.issued_on, q.submitted_on) >= public.app_today() - 365
  ),
  stats AS (
    SELECT builder_key, count(*)::integer AS permits, count(*) FILTER (WHERE NOT has_plumbing)::integer AS open
    FROM theirs
    GROUP BY builder_key
  ),
  marks AS (
    SELECT DISTINCT ON (m.builder_key) m.builder_key, m.mark, m.reason, m.marked_by, m.marked_at
    FROM public.builder_marks m
    ORDER BY m.builder_key, m.marked_at DESC
  )
  SELECT r.id, r.city, r.source, r.permit_number, r.permit_type, r.stage, r.residential, r.work_type, r.project_name,
         r.address, r.zip, r.lat, r.lng, r.submitted_on, r.issued_on, r.filed_on, r.declared_value, r.area_sf, r.contact,
         r.plumber, r.plumber_permit_on,
         r.verdict, r.verdict_reason, r.verdict_look_again_on, r.verdict_prospect_id, r.verdict_by, r.verdict_by_name, r.verdict_at,
         CASE WHEN r.verdict IS NULL THEN NULL ELSE l.reason_code END,
         CASE WHEN r.verdict IS NULL THEN NULL ELSE l.for_user_id END,
         CASE WHEN r.verdict IS NULL THEN NULL ELSE fu.name END,
         CASE WHEN r.verdict IS NULL THEN NULL ELSE l.pursue_for END,
         r.bkey, bd.name, bd.kind,
         NULLIF(mk.mark, 'none'),
         CASE WHEN mk.mark IS NULL OR mk.mark = 'none' THEN NULL ELSE mk.reason END,
         CASE WHEN mk.mark IS NULL OR mk.mark = 'none' THEN NULL ELSE mu.name END,
         CASE WHEN mk.mark IS NULL OR mk.mark = 'none' THEN NULL ELSE mk.marked_at END,
         COALESCE(st.permits, 0), COALESCE(st.open, 0)
  FROM base r
  LEFT JOIN latest l ON l.permit_id = r.id
  LEFT JOIN public.users fu ON fu.id = l.for_user_id
  LEFT JOIN public.builders bd ON bd.key = r.bkey
  LEFT JOIN marks mk ON mk.builder_key = r.bkey
  LEFT JOIN public.users mu ON mu.id = mk.marked_by
  LEFT JOIN stats st ON st.builder_key = r.bkey
  ORDER BY r.filed_on DESC, r.permit_number DESC;
$$;

-- 3. Builders.
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
    SELECT q.id, q.builder_key, q.contact, q.permit_number, q.address_key, q.city, COALESCE(q.issued_on, q.submitted_on) AS filed_on
    FROM public.permits q
    WHERE q.city = p_city AND q.kind = 'building' AND NOT q.residential AND q.builder_key IS NOT NULL
      AND COALESCE(q.issued_on, q.submitted_on) >= public.app_today() - 365
  ),
  -- The plumbing permits on each of those building permits' numbers or addresses: two joins, each on
  -- an index, in place of one join on an OR; UNION keeps a permit found both ways once.
  plumb_pairs AS (
    SELECT m.id AS building_id, pl.id AS plumbing_id
    FROM mine m
    JOIN public.permits pl ON pl.city = m.city AND pl.permit_number = m.permit_number AND pl.kind = 'plumbing'
    UNION
    SELECT m.id, pl.id
    FROM mine m
    JOIN public.permits pl ON pl.city = m.city AND pl.address_key = m.address_key AND pl.kind = 'plumbing'
  ),
  plumb AS (
    SELECT m.id, m.builder_key, pl.contact AS plumber,
           (pl.contact IS NOT NULL AND public.research_name_key(pl.contact) IS DISTINCT FROM public.research_name_key(m.contact)) AS named
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
  named_bids AS (
    SELECT b.id, b.outcome, b.created_at::date AS bid_on,
           public.research_name_key(c.name) AS customer_key,
           public.research_name_key(g.name) AS gc_key
    FROM public.bids b
    LEFT JOIN public.customers c ON c.id = b.customer_id
    LEFT JOIN public.bids_gc_builders g ON g.id = b.gc_builder_id
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
