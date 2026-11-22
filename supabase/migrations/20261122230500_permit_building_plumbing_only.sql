-- v2.8295 — Permits: only the building's own plumbing permit says it has a plumber (punch list #307's
-- last line found in passing, and #302's read).
-- A feed files irrigation, gas, sewer and backflow under plumbing. The reads paired ANY permit of kind
-- 'plumbing' with a building permit, so a lawn sprinkler permit on a building's number, or from its
-- applicant at its address, read as *Has a plumber* and took the building off the skim. Counted on prod
-- 2026-11-22, read only: of 842 commercial building permits in San Antonio's last 180 days, 319 read as
-- having a plumber, 311 of them by a general plumbing permit, 7 by an irrigation permit alone and 1 by a
-- gas, sewer or repair permit alone. San Antonio holds 12,741 irrigation permits filed as plumbing.
--
-- The rule is the one a bid's window already reads by (`plumbingTypeOf` in src/lib/research/bidSite.ts):
-- a general plumbing permit, or a plumbing type with no qualifier, is the building's plumbing. Austin, New
-- Braunfels, San Marcos and Seguin have one plumbing type with no qualifier, and their pulls already leave
-- irrigation out, so nothing moves there. In San Antonio the eight buildings above read as waiting again.
--
-- One helper holds the rule, and each read that pairs a plumbing permit asks it: research_permits (the
-- plumber and his day), research_permits_v2 (a builder's open count), research_permits_v3 (what sits at the
-- address uncounted), research_permits_v4 (the first plumbing day) and research_builders (a builder's
-- plumber). permit_skim_wait reads research_permits and follows. Every body below is its newest one with
-- that one predicate added beside each `kind = 'plumbing'`, nine places, and nothing else moved: built by
-- script from 20261119063000, 20261119073000, 20261122032000, 20261122040000, each body held against
-- prod's own by its md5 first. The shapes are the same, so the grants and comments stand.
--
-- The older files that wrote these reads pair any plumbing permit, so none of them runs a second time after
-- this one. The bed `permit-skim` runs this file twice in their place.
SET lock_timeout = '3s';

-- 0. The rule. IMMUTABLE, one expression and no SET clause, so the planner writes it into the joins.
CREATE OR REPLACE FUNCTION public.permit_is_building_plumbing(p_permit_type text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    CASE
      WHEN lower(p_permit_type) ~ 'irrigation|gas|sewer' THEN false
      WHEN lower(p_permit_type) ~ 'general' THEN true
      -- No qualifier left once the type's own words are gone: "Plumbing Permit", "Commercial - Plumbing".
      ELSE btrim(regexp_replace(regexp_replace(lower(p_permit_type), '[^a-z]+', ' ', 'g'), '\m(plumbing|permit|commercial|residential)\M', '', 'g')) = ''
    END,
    -- A permit with no type is counted, as it always was.
    true);
$$;
COMMENT ON FUNCTION public.permit_is_building_plumbing(text) IS
  'Permits: whether a permit of kind plumbing is the building''s own plumbing, by its type. A general plumbing permit or a plumbing type with no qualifier is; irrigation, gas, sewer, backflow, a repair and the rest are not. The same rule as plumbingTypeOf in src/lib/research/bidSite.ts.';
REVOKE ALL ON FUNCTION public.permit_is_building_plumbing(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.permit_is_building_plumbing(text) TO authenticated, service_role;

-- 1. The ledger's and the skim's read: the plumber and his day. From 20261119063000.
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
     AND q.kind = 'plumbing' AND public.permit_is_building_plumbing(q.permit_type)
     AND COALESCE(q.issued_on, q.submitted_on) >= COALESCE(b.submitted_on, b.issued_on) - 30
    UNION
    SELECT b.id, q.id
    FROM building b
    JOIN public.permits q
      ON q.city = b.city
     AND q.address_key = b.address_key
     AND q.kind = 'plumbing' AND public.permit_is_building_plumbing(q.permit_type)
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

-- 2. The same rows with the builder beside them: a builder's open count. From 20261119063000.
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
                     WHERE pl.city = q.city AND pl.permit_number = q.permit_number AND pl.kind = 'plumbing' AND public.permit_is_building_plumbing(pl.permit_type)
                       AND COALESCE(pl.issued_on, pl.submitted_on) >= COALESCE(q.submitted_on, q.issued_on) - 30)
             OR EXISTS (SELECT 1 FROM public.permits pl
                        WHERE pl.city = q.city AND pl.address_key = q.address_key AND pl.kind = 'plumbing' AND public.permit_is_building_plumbing(pl.permit_type)
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

-- 3. What sits at an open row's address uncounted. From 20261119073000.
CREATE OR REPLACE FUNCTION public.research_permits_v3(p_city text, p_since date, p_residential boolean DEFAULT false)
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
  builder_open integer,
  plumbing_nearby integer,
  plumbing_nearby_on date,
  plumbing_nearby_by text,
  plumbing_nearby_what text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT v.* FROM public.research_permits_v2(p_city, p_since, p_residential) v
  ),
  -- The plumbing permits at an open row's address that research_permits left out: on another
  -- number, inside the same 30 days, and not the row's own job by permit_address_plumbing_counts.
  -- The newest comes first; the count rides on it.
  nearby AS (
    SELECT DISTINCT ON (r.id) r.id,
           count(*) OVER (PARTITION BY r.id)::integer AS n,
           COALESCE(q.issued_on, q.submitted_on) AS on_day,
           q.contact,
           COALESCE(NULLIF(btrim(q.project_name), ''), q.permit_type) AS what
    FROM base r
    JOIN public.permits b ON b.id = r.id
    JOIN public.permits q
      ON q.city = b.city
     AND q.address_key = b.address_key
     AND q.kind = 'plumbing' AND public.permit_is_building_plumbing(q.permit_type)
     AND q.permit_number <> b.permit_number
     AND COALESCE(q.issued_on, q.submitted_on) >= COALESCE(b.submitted_on, b.issued_on) - 30
     AND NOT public.permit_address_plumbing_counts(b.city, b.builder_key, q.builder_key)
    WHERE r.plumber IS NULL AND r.plumber_permit_on IS NULL
    ORDER BY r.id, COALESCE(q.issued_on, q.submitted_on) DESC, q.permit_number, q.id
  )
  SELECT r.*, COALESCE(n.n, 0), n.on_day, n.contact, n.what
  FROM base r
  LEFT JOIN nearby n ON n.id = r.id
  ORDER BY r.filed_on DESC, r.permit_number DESC;
$$;

-- 4. A job's first plumbing day. From 20261122032000.
CREATE OR REPLACE FUNCTION public.research_permits_v4(p_city text, p_since date, p_residential boolean DEFAULT false)
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
  builder_open integer,
  plumbing_nearby integer,
  plumbing_nearby_on date,
  plumbing_nearby_by text,
  plumbing_nearby_what text,
  plumber_first_permit_on date
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT v.* FROM public.research_permits_v3(p_city, p_since, p_residential) v
  ),
  -- The plumbing permits of each taken row's own job, as research_permits pairs them: on the
  -- number, or at the address when the two are one job, and no older than 30 days before it. Two
  -- joins, each on an index (permits_number_idx, permits_address_key_idx). A permit found both
  -- ways is read twice, which the earliest day does not mind.
  first_day AS (
    SELECT x.id, min(x.on_day) AS on_day
    FROM (
      SELECT r.id, COALESCE(q.issued_on, q.submitted_on) AS on_day
      FROM base r
      JOIN public.permits b ON b.id = r.id
      JOIN public.permits q
        ON q.city = b.city
       AND q.permit_number = b.permit_number
       AND q.kind = 'plumbing' AND public.permit_is_building_plumbing(q.permit_type)
       AND COALESCE(q.issued_on, q.submitted_on) >= COALESCE(b.submitted_on, b.issued_on) - 30
      WHERE r.plumber_permit_on IS NOT NULL
      UNION ALL
      SELECT r.id, COALESCE(q.issued_on, q.submitted_on)
      FROM base r
      JOIN public.permits b ON b.id = r.id
      JOIN public.permits q
        ON q.city = b.city
       AND q.address_key = b.address_key
       AND q.kind = 'plumbing' AND public.permit_is_building_plumbing(q.permit_type)
       AND COALESCE(q.issued_on, q.submitted_on) >= COALESCE(b.submitted_on, b.issued_on) - 30
       AND public.permit_address_plumbing_counts(b.city, b.builder_key, q.builder_key)
      WHERE r.plumber_permit_on IS NOT NULL
    ) x
    GROUP BY x.id
  )
  SELECT r.*, f.on_day
  FROM base r
  LEFT JOIN first_day f ON f.id = r.id
  ORDER BY r.filed_on DESC, r.permit_number DESC;
$$;

-- 5. Builders: a builder's plumber. From 20261122040000.
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
      ON pl.city = m.city AND pl.permit_number = m.permit_number AND pl.kind = 'plumbing' AND public.permit_is_building_plumbing(pl.permit_type)
     AND COALESCE(pl.issued_on, pl.submitted_on) >= m.plumbing_from
    UNION
    SELECT m.id, pl.id
    FROM mine m
    JOIN public.permits pl
      ON pl.city = m.city AND pl.address_key = m.address_key AND pl.kind = 'plumbing' AND public.permit_is_building_plumbing(pl.permit_type)
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
