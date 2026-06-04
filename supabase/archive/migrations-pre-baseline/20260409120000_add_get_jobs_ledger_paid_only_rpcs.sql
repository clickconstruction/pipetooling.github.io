-- Paid-only variants for People Review "Only Count Jobs Marked Paid in Full" checkbox.
-- Same return types as get_jobs_ledger_by_ids and get_jobs_ledger_by_hcp_numbers,
-- but filter to jobs_ledger.status = 'paid' only.

CREATE OR REPLACE FUNCTION public.get_jobs_ledger_by_ids_paid_only(p_job_ids uuid[])
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
  WHERE jl.id = ANY(p_job_ids)
    AND jl.status = 'paid';
$$;
COMMENT ON FUNCTION public.get_jobs_ledger_by_ids_paid_only(uuid[]) IS 'Fetch job details by IDs, only jobs with status paid. For People Review paid-only filter.';

CREATE OR REPLACE FUNCTION public.get_jobs_ledger_by_hcp_numbers_paid_only(p_hcp_numbers text[])
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
  WHERE jl.status = 'paid'
    AND LOWER(TRIM(COALESCE(jl.hcp_number, ''))) = ANY(
      SELECT LOWER(TRIM(COALESCE(x, ''))) FROM unnest(p_hcp_numbers) AS x
    );
$$;
COMMENT ON FUNCTION public.get_jobs_ledger_by_hcp_numbers_paid_only(text[]) IS 'Fetch job details by HCP numbers, only jobs with status paid. For People Review paid-only filter.';
