-- Search jobs_ledger for Team Costs job picker (HCP, name, address)
-- Same visibility as jobs_ledger RLS

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
  WHERE (search_text IS NULL OR search_text = '' OR jl.hcp_number ILIKE '%' || search_text || '%' OR jl.job_name ILIKE '%' || search_text || '%' OR jl.job_address ILIKE '%' || search_text || '%')
  ORDER BY (CASE WHEN jl.hcp_number = '' OR jl.hcp_number IS NULL THEN 1 ELSE 0 END), jl.hcp_number DESC
  LIMIT 50;
$$;
COMMENT ON FUNCTION public.search_jobs_ledger(TEXT) IS 'Search jobs_ledger by HCP, job name, or address. Used by Team Costs Crew Jobs job picker.';
