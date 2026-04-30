-- Unified job/bid search: expose service_types.name for jobs (parity with search_bids_for_clock).
-- list_assigned_jobs_for_dashboard: see 20270518120000_list_assigned_jobs_service_type_name.sql (must apply after 20270507120000).

DROP FUNCTION IF EXISTS public.search_jobs_ledger(text);

CREATE OR REPLACE FUNCTION public.search_jobs_ledger(search_text TEXT DEFAULT '')
RETURNS TABLE (
  id UUID,
  service_type_id UUID,
  service_type_name TEXT,
  hcp_number TEXT,
  job_name TEXT,
  job_address TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    jl.id,
    jl.service_type_id,
    COALESCE(stj.name, '')::TEXT AS service_type_name,
    COALESCE(jl.hcp_number, '')::TEXT,
    COALESCE(jl.job_name, '')::TEXT,
    COALESCE(jl.job_address, '')::TEXT
  FROM public.jobs_ledger jl
  LEFT JOIN public.service_types stj ON stj.id = jl.service_type_id
  WHERE (
    search_text IS NULL OR search_text = ''
    OR jl.hcp_number ILIKE '%' || search_text || '%'
    OR (
      length(search_text) >= 2
      AND lower(left(search_text, 1)) = 'j'
      AND jl.hcp_number ILIKE '%' || substring(search_text from 2) || '%'
    )
    OR jl.job_name ILIKE '%' || search_text || '%'
    OR jl.job_address ILIKE '%' || search_text || '%'
    OR EXISTS (
      SELECT 1
      FROM public.service_types st
      WHERE st.ledger_job_prefix IS NOT NULL
        AND btrim(st.ledger_job_prefix) <> ''
        AND coalesce(search_text, '') <> ''
        AND length(search_text) > length(btrim(st.ledger_job_prefix))
        AND lower(search_text) LIKE lower(btrim(st.ledger_job_prefix)) || '%'
        AND jl.hcp_number ILIKE '%' || substring(search_text from length(btrim(st.ledger_job_prefix)) + 1) || '%'
    )
  )
  ORDER BY (CASE WHEN jl.hcp_number = '' OR jl.hcp_number IS NULL THEN 1 ELSE 0 END), jl.hcp_number DESC
  LIMIT 50;
$$;

COMMENT ON FUNCTION public.search_jobs_ledger(TEXT) IS 'Search jobs_ledger by HCP, job name, or address. J prefix and ledger_job_prefix normalized; returns service_type_id and service_type_name.';
