-- Fetch job details by HCP numbers. SECURITY DEFINER bypasses jobs_ledger RLS.
-- Used for Review/Team Summary labor job lookups (people_labor_jobs has job_number/HCP, not job_id).

CREATE OR REPLACE FUNCTION public.get_jobs_ledger_by_hcp_numbers(p_hcp_numbers text[])
RETURNS TABLE (
  id uuid,
  hcp_number text,
  job_name text,
  job_address text,
  revenue numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jl.id, COALESCE(jl.hcp_number, '')::text, COALESCE(jl.job_name, '')::text, COALESCE(jl.job_address, '')::text, jl.revenue
  FROM public.jobs_ledger jl
  WHERE LOWER(TRIM(COALESCE(jl.hcp_number, ''))) = ANY(
    SELECT LOWER(TRIM(COALESCE(x, ''))) FROM unnest(p_hcp_numbers) AS x
  );
$$;
COMMENT ON FUNCTION public.get_jobs_ledger_by_hcp_numbers(text[]) IS 'Fetch job details by HCP numbers. Bypasses RLS for Review/Team Summary.';
