-- 1. Drop 2-arg search_bids_for_clock overload (SECURITY INVOKER).
--    Frontend calls with { p_search_text: q } were matching this overload instead of the 3-arg SECURITY DEFINER version.
--    After drop, only the 3-arg version exists and will be used.
DROP FUNCTION IF EXISTS public.search_bids_for_clock(TEXT, UUID);

-- 2. search_jobs_ledger: normalize "J" prefix so "J651" matches hcp_number "651".
--    Jobs store hcp_number as "651"; users often type "J651".
CREATE OR REPLACE FUNCTION public.search_jobs_ledger(search_text TEXT DEFAULT '')
RETURNS TABLE (
  id UUID,
  hcp_number TEXT,
  job_name TEXT,
  job_address TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jl.id, COALESCE(jl.hcp_number, '')::TEXT, COALESCE(jl.job_name, '')::TEXT, COALESCE(jl.job_address, '')::TEXT
  FROM public.jobs_ledger jl
  WHERE (
    search_text IS NULL OR search_text = ''
    OR jl.hcp_number ILIKE '%' || search_text || '%'
    OR (length(search_text) >= 2 AND lower(left(search_text, 1)) = 'j' AND jl.hcp_number ILIKE '%' || substring(search_text from 2) || '%')
    OR jl.job_name ILIKE '%' || search_text || '%'
    OR jl.job_address ILIKE '%' || search_text || '%'
  )
  ORDER BY (CASE WHEN jl.hcp_number = '' OR jl.hcp_number IS NULL THEN 1 ELSE 0 END), jl.hcp_number DESC
  LIMIT 50;
$$;
COMMENT ON FUNCTION public.search_jobs_ledger(TEXT) IS 'Search jobs_ledger by HCP, job name, or address. J prefix normalized: J651 matches 651.';

-- 3. search_bids_for_clock: normalize "B" prefix so "B88" matches bid_number "88".
-- Drop all overloads first (return type or params may differ on existing installs).
DROP FUNCTION IF EXISTS public.search_bids_for_clock(TEXT, UUID, UUID[]);
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
    OR (length(p_search_text) >= 2 AND lower(left(p_search_text, 1)) = 'b' AND b.bid_number ILIKE '%' || substring(p_search_text from 2) || '%')
    OR b.project_name ILIKE '%' || p_search_text || '%'
    OR b.address ILIKE '%' || p_search_text || '%'
    OR c.name ILIKE '%' || p_search_text || '%'
    OR bgb.name ILIKE '%' || p_search_text || '%'
  )
  ORDER BY b.project_name
  LIMIT 50;
$$;
COMMENT ON FUNCTION public.search_bids_for_clock(TEXT, UUID, UUID[]) IS 'Search bids for Clock In/Dispatch. B prefix normalized: B88 matches 88. SECURITY DEFINER bypasses RLS.';
