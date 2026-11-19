-- v2.7922 — Permits: a plumbing permit counts for a job only when it is that job's.
-- `research_permits`, `research_permits_v2` and `research_builders` paired a building permit with
-- every plumbing permit on its number or at its street address. The address carries no suite, so in
-- a shopping centre or a tower another tenant's plumbing permit closed the job on the Skim and its
-- name was shown as the builder's plumber (read on prod 2026-11-19: a San Antonio application filed
-- Nov 11 read as taken by the contractor of a nail salon in another unit).
--
-- San Antonio issues a project's plumbing permit on the project's own number, under the applicant's
-- name: of 2,094 commercial permits issued there from June 2025 to mid July 2026, 1,377 carry a
-- general plumbing permit on their number and 33 have only a plumber's own permit at the address.
-- So in San Antonio a plumbing permit at the address counts only when the same applicant filed it,
-- which is what ties an application to the permit later issued on another number. Austin, New
-- Braunfels, San Marcos and Seguin never put a plumbing permit on a building permit's number: there
-- the address is the only tie, and it stands as it was.
--
-- The rule has one home, `permit_address_plumbing_counts`, and the three reads call it. Two more
-- changes in the same bodies: `research_permits_v2`'s count of a builder's open permits and
-- `research_builders` now hold a plumbing permit to the 30 days `research_permits` always held it
-- to, and a name is the plumber's only when it is neither the applicant's nor the applicant's
-- company's. The bodies are copied from 20261111003750 with those fragments replaced. Same shapes,
-- so the grants stand and no caller changes.
SET lock_timeout = '3s';

-- 0. The rule: does a plumbing permit at a building permit's address belong to that permit's job?
-- IMMUTABLE and with no SET clause, so the planner writes it into the joins that call it.
CREATE OR REPLACE FUNCTION public.permit_address_plumbing_counts(
  p_city text,
  p_building_builder_key text,
  p_plumbing_builder_key text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    -- The cities that issue a project's plumbing permit on the project's own number. In them a
    -- plumbing permit on a number of its own is somebody's separate job.
    p_city NOT IN ('San Antonio')
    -- The same applicant: the key the pull gives a contact, its company or else its person. Two
    -- plain columns, so the test costs nothing on an address that holds hundreds of permits.
    OR p_plumbing_builder_key = p_building_builder_key,
    false);
$$;
COMMENT ON FUNCTION public.permit_address_plumbing_counts(text, text, text) IS
  'Permits: whether a plumbing permit at a building permit''s street address is that permit''s own job. Always in a city where plumbers pull their own permits; in San Antonio, where a project''s plumbing permit rides the project''s number, only when both carry the same builder key, the applicant''s. research_permits, research_permits_v2 and research_builders call it.';
REVOKE ALL ON FUNCTION public.permit_address_plumbing_counts(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.permit_address_plumbing_counts(text, text, text) TO authenticated, service_role;

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
  -- The plumbing permits of a building permit's own job: on its number, or at its address when
  -- permit_address_plumbing_counts says the two are one job. Two joins, each on an index
  -- (permits_number_idx, permits_address_key_idx); UNION keeps a permit found both ways once.
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
     AND public.permit_address_plumbing_counts(b.city, b.builder_key, q.builder_key)
  ),
  plumbing AS (
    SELECT b.id AS building_id,
           q.contact,
           q.permit_number <> b.permit_number AS own_number,
           COALESCE(q.issued_on, q.submitted_on) AS on_day,
           -- A name counts only when it is not the building permit's own applicant, by the name or by the company.
           (q.contact IS NOT NULL
            AND public.research_name_key(q.contact) IS DISTINCT FROM public.research_name_key(b.contact)
            AND (q.builder_key IS NULL OR q.builder_key IS DISTINCT FROM b.builder_key)) AS names_someone_else
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
           -- A plumbing permit of the permit's own job, as research_permits pairs them: on the number, or at
           -- the address when the two are one job, and no older than 30 days before it. One indexed lookup each.
           (
             EXISTS (SELECT 1 FROM public.permits pl
                     WHERE pl.city = q.city AND pl.permit_number = q.permit_number AND pl.kind = 'plumbing'
                       AND COALESCE(pl.issued_on, pl.submitted_on) >= COALESCE(q.submitted_on, q.issued_on) - 30)
             OR EXISTS (SELECT 1 FROM public.permits pl
                        WHERE pl.city = q.city AND pl.address_key = q.address_key AND pl.kind = 'plumbing'
                          AND COALESCE(pl.issued_on, pl.submitted_on) >= COALESCE(q.submitted_on, q.issued_on) - 30
                          AND public.permit_address_plumbing_counts(q.city, q.builder_key, pl.builder_key))
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
