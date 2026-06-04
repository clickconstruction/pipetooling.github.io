-- search_bids_for_clock: Change to SECURITY DEFINER so it bypasses bids RLS.
-- Bids RLS only allows dev, master_technician, assistant, estimator, primary.
-- Subcontractors need to search bids for Clock In and Dispatch association;
-- the function already filters by p_service_type_ids for subcontractors.
-- Without this, subcontractors (and any role with restricted bids access) get 0 results.

CREATE OR REPLACE FUNCTION public.search_bids_for_clock(
  p_search_text TEXT DEFAULT '',
  p_service_type_id UUID DEFAULT NULL,
  p_service_type_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (id UUID, bid_number TEXT, project_name TEXT, address TEXT, customer_name TEXT)
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
    COALESCE(c.name, bgb.name, '')::TEXT
  FROM public.bids b
  LEFT JOIN public.customers c ON c.id = b.customer_id
  LEFT JOIN public.bids_gc_builders bgb ON bgb.id = b.gc_builder_id
  WHERE (
    (p_service_type_ids IS NOT NULL AND coalesce(array_length(p_service_type_ids, 1), 0) > 0 AND b.service_type_id = ANY(p_service_type_ids))
    OR ((p_service_type_ids IS NULL OR coalesce(array_length(p_service_type_ids, 1), 0) = 0) AND (p_service_type_id IS NULL OR b.service_type_id = p_service_type_id))
  )
  AND (
    p_search_text IS NULL OR p_search_text = ''
    OR b.bid_number ILIKE '%' || p_search_text || '%'
    OR b.project_name ILIKE '%' || p_search_text || '%'
    OR b.address ILIKE '%' || p_search_text || '%'
    OR c.name ILIKE '%' || p_search_text || '%'
    OR bgb.name ILIKE '%' || p_search_text || '%'
  )
  ORDER BY b.project_name
  LIMIT 50;
$$;

COMMENT ON FUNCTION public.search_bids_for_clock(TEXT, UUID, UUID[]) IS 'Search bids for Clock In/Dispatch. SECURITY DEFINER bypasses RLS so subcontractors can search. Filters by p_service_type_id or p_service_type_ids.';
