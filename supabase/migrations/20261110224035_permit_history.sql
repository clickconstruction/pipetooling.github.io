-- v2.6873 — Permits: history read further back (punch list #307, the rest of PR 4).
-- A builder's year needs a year of rows, and the pull holds ten weeks. Reading further back must
-- not put two years of old permits on the skim, which holds every unanswered permit however old.
--   * `permits.backfilled`: true on a row `permit-pull` read back as history. False on every row
--     the nightly pull brings, so nothing already held changes.
--   * `research_permits`, same shape, replaced in place from 20261110090000 with one condition:
--     a backfilled building permit is not on the skim, the ledger, Kept or Closed. It still
--     counts for a builder (`research_builders`, `research_permits_v2`'s stats), pairs as a
--     plumbing permit, and shows on a bid's site (`bid_site_permits`).
SET lock_timeout = '3s';

ALTER TABLE public.permits ADD COLUMN IF NOT EXISTS backfilled boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.permits.backfilled IS
  'Permits (punch list #307): true on a row permit-pull read back as history, past the day the records started. Such a row counts for a builder and shows on a bid''s site, and is never on the skim or the ledger.';

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
