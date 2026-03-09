-- Fetch Office job (hcp_number='000' or job_name ILIKE '%Office%'). SECURITY DEFINER bypasses jobs_ledger RLS.
-- Used for HoursUnassignedModal Office job lookup.

CREATE OR REPLACE FUNCTION public.get_jobs_ledger_office()
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
  SELECT sub.id, sub.hcp_number, sub.job_name, sub.job_address
  FROM (
    (SELECT jl.id, COALESCE(jl.hcp_number, '')::text AS hcp_number, COALESCE(jl.job_name, '')::text AS job_name, COALESCE(jl.job_address, '')::text AS job_address
     FROM public.jobs_ledger jl
     WHERE TRIM(COALESCE(jl.hcp_number, '')) = '000'
     LIMIT 1)
    UNION ALL
    (SELECT jl.id, COALESCE(jl.hcp_number, '')::text, COALESCE(jl.job_name, '')::text, COALESCE(jl.job_address, '')::text
     FROM public.jobs_ledger jl
     WHERE jl.job_name ILIKE '%Office%'
       AND NOT EXISTS (SELECT 1 FROM public.jobs_ledger j2 WHERE TRIM(COALESCE(j2.hcp_number, '')) = '000')
     LIMIT 1)
  ) sub
  LIMIT 1;
$$;
COMMENT ON FUNCTION public.get_jobs_ledger_office() IS 'Fetch Office job (hcp 000 or name like Office). Bypasses RLS for HoursUnassignedModal.';
