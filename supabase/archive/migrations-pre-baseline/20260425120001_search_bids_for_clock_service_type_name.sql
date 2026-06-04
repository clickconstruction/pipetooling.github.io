-- Add service_type_name to search_bids_for_clock for bid tag display (plum/elec/hvac).
-- Must DROP first because return type changes.
DROP FUNCTION IF EXISTS public.search_bids_for_clock(TEXT, UUID, UUID[]);

CREATE OR REPLACE FUNCTION public.search_bids_for_clock(
  p_search_text TEXT DEFAULT '',
  p_service_type_id UUID DEFAULT NULL,
  p_service_type_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (id UUID, bid_number TEXT, project_name TEXT, address TEXT, customer_name TEXT, service_type_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    COALESCE(b.bid_number, '')::TEXT,
    COALESCE(b.project_name, '')::TEXT,
    COALESCE(b.address, '')::TEXT,
    COALESCE(c.name, bgb.name, '')::TEXT,
    COALESCE(st.name, '')::TEXT
  FROM public.bids b
  LEFT JOIN public.customers c ON c.id = b.customer_id
  LEFT JOIN public.bids_gc_builders bgb ON bgb.id = b.gc_builder_id
  LEFT JOIN public.service_types st ON st.id = b.service_type_id
  WHERE (
    (p_service_type_ids IS NOT NULL AND coalesce(array_length(p_service_type_ids, 1), 0) > 0 AND b.service_type_id = ANY(p_service_type_ids))
    OR ((p_service_type_ids IS NULL OR coalesce(array_length(p_service_type_ids, 1), 0) = 0) AND (p_service_type_id IS NULL OR b.service_type_id = p_service_type_id))
  )
  AND (
    p_search_text IS NULL OR p_search_text = ''
    OR b.bid_number ILIKE '%' || p_search_text || '%'
    OR (length(p_search_text) >= 2 AND lower(left(p_search_text, 1)) = 'b' AND b.bid_number ILIKE '%' || substring(p_search_text from 2) || '%')
    OR b.project_name ILIKE '%' || p_search_text || '%'
    OR b.address ILIKE '%' || p_search_text || '%'
    OR c.name ILIKE '%' || p_search_text || '%'
    OR bgb.name ILIKE '%' || p_search_text || '%'
  )
  ORDER BY b.project_name
  LIMIT 50;
$$;
COMMENT ON FUNCTION public.search_bids_for_clock(TEXT, UUID, UUID[]) IS 'Search bids for Clock In/Dispatch. Returns service_type_name for tag display. SECURITY DEFINER bypasses RLS.';
