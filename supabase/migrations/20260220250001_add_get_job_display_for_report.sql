-- RPC: get job display for report (by id) - for "last report job" display
CREATE OR REPLACE FUNCTION public.get_job_display_for_report(p_source TEXT, p_id UUID)
RETURNS TABLE (id UUID, source TEXT, display_name TEXT, hcp_number TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  (SELECT jl.id, 'job_ledger'::TEXT, jl.job_name, jl.hcp_number
   FROM public.jobs_ledger jl
   WHERE p_source = 'job_ledger' AND jl.id = p_id
   LIMIT 1)
  UNION ALL
  (SELECT p.id, 'project'::TEXT, p.name, COALESCE(p.housecallpro_number, '')::TEXT
   FROM public.projects p
   WHERE p_source = 'project' AND p.id = p_id
   LIMIT 1);
$$;
