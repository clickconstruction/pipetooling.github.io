-- Fetch job details for given IDs. SECURITY DEFINER bypasses jobs_ledger RLS.
-- Used when loading Common Jobs so assistants see same list as devs (jobs added
-- via search_jobs_ledger can be from any master; assistants can't read those directly).

CREATE OR REPLACE FUNCTION public.get_jobs_ledger_by_ids(p_job_ids uuid[])
RETURNS TABLE (
  id uuid,
  hcp_number text,
  job_name text,
  job_address text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jl.id, COALESCE(jl.hcp_number, '')::text, COALESCE(jl.job_name, '')::text, COALESCE(jl.job_address, '')::text
  FROM public.jobs_ledger jl
  WHERE jl.id = ANY(p_job_ids);
$$;

COMMENT ON FUNCTION public.get_jobs_ledger_by_ids(uuid[]) IS 'Fetch job details for Common Jobs display. Bypasses RLS so assistants see all common jobs.';;
