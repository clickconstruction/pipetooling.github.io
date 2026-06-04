-- Extend get_jobs_ledger_by_ids to include revenue for People Review.
-- Must DROP first because return type is changing.
-- Existing callers (Team Costs, CrewJobsSection, Jobs, HoursUnassignedModal) ignore revenue.

DROP FUNCTION IF EXISTS public.get_jobs_ledger_by_ids(uuid[]);

CREATE OR REPLACE FUNCTION public.get_jobs_ledger_by_ids(p_job_ids uuid[])
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
  WHERE jl.id = ANY(p_job_ids);
$$;
