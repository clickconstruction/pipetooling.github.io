-- v2.6785 — Research: the plumber is named only when the plumbing permit names someone else
-- (punch list #292, PR 3). On a commercial job the trade permits share the building permit's
-- number and, in San Antonio's feed, its primary contact: the GC or the expediter who pulled
-- the building permit. The first live look drew that applicant in the Plumber column and
-- counted them under Who wins what. The read now names a plumber only from a plumbing permit
-- whose contact differs from the building permit's (a trade-pulled MEP number first), and
-- still marks the row taken when any plumbing permit sits on the number or the address.
SET lock_timeout = '3s';

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
      AND (p_residential OR NOT p.residential)
      AND COALESCE(p.issued_on, p.submitted_on) >= p_since
  ),
  plumbing AS (
    SELECT b.id AS building_id,
           q.contact,
           q.permit_number <> b.permit_number AS own_number,
           COALESCE(q.issued_on, q.submitted_on) AS on_day,
           -- A name counts only when it is not the building permit's own applicant.
           (q.contact IS NOT NULL AND public.research_name_key(q.contact) IS DISTINCT FROM public.research_name_key(b.contact)) AS names_someone_else
    FROM building b
    JOIN public.permits q
      ON q.city = b.city
     AND q.kind = 'plumbing'
     AND (q.permit_number = b.permit_number OR (b.address_key IS NOT NULL AND q.address_key = b.address_key))
     AND COALESCE(q.issued_on, q.submitted_on) >= COALESCE(b.submitted_on, b.issued_on) - 30
  ),
  paired AS (
    SELECT building_id,
           (array_agg(contact ORDER BY own_number DESC, on_day DESC NULLS LAST) FILTER (WHERE names_someone_else))[1] AS plumber,
           max(on_day) AS plumber_permit_on
    FROM plumbing
    GROUP BY building_id
  ),
  newest AS (
    SELECT DISTINCT ON (v.permit_id) v.permit_id, v.verdict, v.reason, v.look_again_on, v.prospect_id, v.decided_by, v.decided_at
    FROM public.permit_verdicts v
    JOIN building b ON b.id = v.permit_id
    ORDER BY v.permit_id, v.decided_at DESC
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
COMMENT ON FUNCTION public.research_permits(text, date, boolean) IS
  'Research (punch list #292): the ledger''s rows — a city''s building permits filed since a day, each with the day a plumbing permit landed on the same number or address, the plumber when that permit names someone other than the building permit''s own applicant, and the newest verdict.';
