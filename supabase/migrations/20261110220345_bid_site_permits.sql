-- v2.6866 — Bids and permits: what the city holds on a bid's address (punch list #307, PR 2 and 3).
-- One read and one index, no table. A bid's address is one typed line and the feed's street is
-- not tidy either (a street type spelled out or left off, Loop 1604 as "n 1604 w"), so the join
-- is not made here: the client asks for every permit in a city whose street starts with one of
-- the bids' house numbers, and `src/lib/research/bidSite.ts` decides which sit on the bid's site.
-- Invoker rights: `permits` is read by the people who research permits (the office and every
-- estimator), and this read sees no more than they do.
SET lock_timeout = '3s';

CREATE INDEX IF NOT EXISTS permits_city_house_number_idx ON public.permits (city, (split_part(address_key, ' ', 1))) WHERE address_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.bid_site_permits(p_city text, p_numbers text[])
RETURNS TABLE (
  id uuid,
  permit_number text,
  permit_type text,
  kind text,
  stage text,
  work_type text,
  project_name text,
  address text,
  submitted_on date,
  issued_on date,
  declared_value numeric,
  area_sf numeric,
  contact text,
  builder_key text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH asked AS (
    SELECT DISTINCT lower(btrim(n)) AS house_number
    FROM unnest(COALESCE(p_numbers, ARRAY[]::text[])) AS n
    WHERE btrim(n) <> ''
  )
  SELECT p.id, p.permit_number, p.permit_type, p.kind, p.stage, p.work_type, p.project_name, p.address,
         p.submitted_on, p.issued_on, p.declared_value, p.area_sf, p.contact, p.builder_key
  FROM public.permits p
  JOIN asked a ON a.house_number = split_part(p.address_key, ' ', 1)
  WHERE p.city = p_city
    AND p.address_key IS NOT NULL
  ORDER BY COALESCE(p.issued_on, p.submitted_on) DESC NULLS LAST, p.permit_number, p.permit_type
  LIMIT 5000;
$$;
COMMENT ON FUNCTION public.bid_site_permits(text, text[]) IS
  'Bids and permits (punch list #307): every permit in a city whose street starts with one of the house numbers asked for, newest first. The bid''s site is decided on the client (bidSite.ts), since neither a bid''s address nor the feed''s street is tidy.';
REVOKE ALL ON FUNCTION public.bid_site_permits(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bid_site_permits(text, text[]) TO authenticated;
