-- Header nav search: typeahead for estimates. SECURITY INVOKER so estimates RLS applies.

CREATE OR REPLACE FUNCTION public.search_estimates_for_nav(search_text TEXT DEFAULT '')
RETURNS TABLE (
  id UUID,
  estimate_number INTEGER,
  title TEXT,
  customer_name TEXT,
  subtitle TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH q AS (
    SELECT btrim(COALESCE(search_text, '')) AS t
  )
  SELECT
    e.id,
    e.estimate_number,
    COALESCE(e.title, '')::TEXT,
    COALESCE(c.name, '')::TEXT,
    NULLIF(
      btrim(
        concat_ws(
          ' — ',
          NULLIF(btrim(COALESCE(c.address, '')), ''),
          NULLIF(btrim(COALESCE(e.for_address, '')), ''),
          NULLIF(btrim(COALESCE(e.customer_email, '')), '')
        )
      ),
      ''
    )::TEXT
  FROM public.estimates e
  LEFT JOIN public.customers c ON c.id = e.customer_id
  CROSS JOIN q
  WHERE length(q.t) >= 1
  AND (
    e.estimate_number::text ILIKE '%' || q.t || '%'
    OR (
      length(q.t) >= 2
      AND lower(left(q.t, 1)) = 'e'
      AND e.estimate_number::text ILIKE '%' || substring(q.t from 2) || '%'
    )
    OR e.title ILIKE '%' || q.t || '%'
    OR e.customer_email ILIKE '%' || q.t || '%'
    OR e.for_address ILIKE '%' || q.t || '%'
    OR c.name ILIKE '%' || q.t || '%'
    OR c.address ILIKE '%' || q.t || '%'
  )
  ORDER BY e.updated_at DESC NULLS LAST
  LIMIT 50;
$$;

COMMENT ON FUNCTION public.search_estimates_for_nav(TEXT) IS
  'Search estimates by quote #, title, customer, address, email. E prefix matches estimate_number. RLS enforced (SECURITY INVOKER).';

GRANT EXECUTE ON FUNCTION public.search_estimates_for_nav(TEXT) TO authenticated;
