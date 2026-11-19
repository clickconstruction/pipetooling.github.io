-- v2.7935 — Permits: a row says when a plumbing permit sits at its address and does not count.
-- Since 20261119063000 a San Antonio plumbing permit at a job's street address counts for the job
-- only when the same applicant filed it. The ones that do not count were dropped from the read, so
-- a skimmer could not see that a plumber, or another tenant's builder, was at work at the address.
-- `research_permits_v3` is `research_permits_v2` with four columns more: how many such permits sit
-- at the row's address, and the newest one's day, name and work. It reads v2 and joins them on, so
-- no body is copied and v2 keeps its shape for a client that has not updated. Rows with a plumbing
-- permit of their own carry none: the note is for a row that reads as open.
-- The same 30 days and the same rule (`permit_address_plumbing_counts`) decide what does not count,
-- so in a city where the address always ties, nothing is ever left to say.
SET lock_timeout = '3s';

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
     AND q.kind = 'plumbing'
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
COMMENT ON FUNCTION public.research_permits_v3(text, date, boolean) IS
  'Permits: research_permits_v2 with, for a row that has no plumbing permit of its own, the plumbing permits at its street address that do not count for it (permit_address_plumbing_counts): how many, and the newest one''s day, name and work. The skim and the ledger say it under the row.';
REVOKE ALL ON FUNCTION public.research_permits_v3(text, date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.research_permits_v3(text, date, boolean) TO authenticated, service_role;
