-- v2.8220 — Bids and permits: `bid_site_permits` answers in one order (punch list #307, PR 5's leftover).
-- The function ordered by the day, the number and the type. The table's unique key also holds the
-- source, so one permit in both of a city's feeds on one day ties, and a tie may fall either way
-- from one call to the next. The client reads the answer a page at a time, and every page is a
-- call of its own: at the function's limit of 5,000 rows a tie on the last place could keep one
-- row for one page and its twin for the next. The id ends the order, so every call keeps the same
-- rows. The body is 20261110220345's, the live one, with `p.id` added to the ORDER BY and nothing
-- else: the same arguments, the same columns, the same rights.
SET lock_timeout = '3s';

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
  ORDER BY COALESCE(p.issued_on, p.submitted_on) DESC NULLS LAST, p.permit_number, p.permit_type, p.id
  LIMIT 5000;
$$;
COMMENT ON FUNCTION public.bid_site_permits(text, text[]) IS
  'Bids and permits (punch list #307): every permit in a city whose street starts with one of the house numbers asked for, newest first, then by number, type and id, so two calls keep the same 5,000 rows. The bid''s site is decided on the client (bidSite.ts), since neither a bid''s address nor the feed''s street is tidy.';
REVOKE ALL ON FUNCTION public.bid_site_permits(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bid_site_permits(text, text[]) TO authenticated;
