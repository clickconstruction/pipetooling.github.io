-- Permits, Market (punch list #405): a job's first plumbing permit day, beside its newest.
-- `research_permits` keeps one plumbing day per building permit, the newest (`plumber_permit_on`).
-- Market's clock measures from the building permit to the plumber's permit, so a job with two
-- plumbing permits was measured to its later one, and the clock read long. The clock is there to
-- say how soon a job is taken, which is the day the first plumbing permit lands.
--
-- `research_permits_v4` is `research_permits_v3` with one column more, `plumber_first_permit_on`.
-- It reads v3 and joins the day on, so no body is copied and v3 keeps its shape for a client that
-- has not updated. The plumbing permits it reads are a job's own, paired as `research_permits`
-- pairs them: on the building permit's number, or at its address when
-- `permit_address_plumbing_counts` says the two are one job, and no older than 30 days before it.
-- So the column is set on exactly the rows that carry `plumber_permit_on`, and is never later.
--
-- Read on prod before writing (2026-11-21, a year of commercial permits): of 300 Austin jobs with a
-- plumbing permit, 54 have more than one and 26 have a first day earlier than the newest. The clock's
-- quarter marks move from 1, 7 and 16 days to 1, 6 and 15. The join added 4 ms to a 144 ms read.
SET lock_timeout = '3s';

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
       AND q.kind = 'plumbing'
       AND COALESCE(q.issued_on, q.submitted_on) >= COALESCE(b.submitted_on, b.issued_on) - 30
      WHERE r.plumber_permit_on IS NOT NULL
      UNION ALL
      SELECT r.id, COALESCE(q.issued_on, q.submitted_on)
      FROM base r
      JOIN public.permits b ON b.id = r.id
      JOIN public.permits q
        ON q.city = b.city
       AND q.address_key = b.address_key
       AND q.kind = 'plumbing'
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
COMMENT ON FUNCTION public.research_permits_v4(text, date, boolean) IS
  'Permits: research_permits_v3 with plumber_first_permit_on, the day of the earliest plumbing permit that counts for the row''s job (the pairing research_permits uses). Set on exactly the rows that carry plumber_permit_on, the newest such day, and never later than it. Market''s clock runs to it.';
REVOKE ALL ON FUNCTION public.research_permits_v4(text, date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.research_permits_v4(text, date, boolean) TO authenticated, service_role;
