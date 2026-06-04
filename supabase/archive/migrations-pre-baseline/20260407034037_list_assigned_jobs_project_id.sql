-- Add project_id to list_assigned_jobs_for_dashboard for Calendar Preview (resolve jobs by project for subs).

DROP FUNCTION IF EXISTS public.list_assigned_jobs_for_dashboard();

CREATE FUNCTION public.list_assigned_jobs_for_dashboard()
RETURNS TABLE (
  id uuid,
  hcp_number text,
  job_name text,
  job_address text,
  google_drive_link text,
  job_plans_link text,
  revenue numeric,
  master_user_id uuid,
  created_at timestamptz,
  last_report_at timestamptz,
  project_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    jl.id,
    jl.hcp_number,
    jl.job_name,
    jl.job_address,
    jl.google_drive_link,
    jl.job_plans_link,
    jl.revenue,
    jl.master_user_id,
    jl.created_at,
    (SELECT max(r.created_at)
     FROM public.reports r
     WHERE r.job_ledger_id = jl.id) AS last_report_at,
    jl.project_id
  FROM public.jobs_ledger jl
  INNER JOIN public.jobs_ledger_team_members jtm ON jtm.job_id = jl.id AND jtm.user_id = auth.uid()
  WHERE jl.status = 'working'
  ORDER BY jl.hcp_number DESC, jl.job_name;
$$;

COMMENT ON FUNCTION public.list_assigned_jobs_for_dashboard() IS 'Jobs assigned to current user (team) with status working; includes project_id for Calendar job preview.';

GRANT EXECUTE ON FUNCTION public.list_assigned_jobs_for_dashboard() TO authenticated;
