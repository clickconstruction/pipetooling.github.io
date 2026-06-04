-- Add jobs_ledger.status to team dashboard list RPCs (subcontractor job pipeline label in UI).

DROP FUNCTION IF EXISTS public.list_assigned_jobs_for_dashboard();

CREATE FUNCTION public.list_assigned_jobs_for_dashboard()
RETURNS TABLE (
  id UUID,
  hcp_number TEXT,
  job_name TEXT,
  job_address TEXT,
  google_drive_link TEXT,
  job_plans_link TEXT,
  revenue NUMERIC,
  master_user_id UUID,
  created_at TIMESTAMPTZ,
  last_report_at TIMESTAMPTZ,
  project_id UUID,
  in_progress_stage_name TEXT,
  in_progress_step_id UUID,
  status TEXT
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
    (SELECT MAX(r.created_at)
     FROM public.reports r
     WHERE r.job_ledger_id = jl.id) AS last_report_at,
    jl.project_id,
    (SELECT s.name
     FROM public.project_workflows pw
     JOIN public.project_workflow_steps s ON s.workflow_id = pw.id AND s.status = 'in_progress'
     WHERE pw.project_id = jl.project_id
     LIMIT 1) AS in_progress_stage_name,
    (SELECT s.id
     FROM public.project_workflows pw
     JOIN public.project_workflow_steps s ON s.workflow_id = pw.id AND s.status = 'in_progress'
     WHERE pw.project_id = jl.project_id
     LIMIT 1) AS in_progress_step_id,
    jl.status::text
  FROM public.jobs_ledger jl
  INNER JOIN public.jobs_ledger_team_members jtm ON jtm.job_id = jl.id AND jtm.user_id = auth.uid()
  WHERE jl.status = 'working'
  ORDER BY jl.hcp_number DESC, jl.job_name;
$$;

COMMENT ON FUNCTION public.list_assigned_jobs_for_dashboard() IS 'Jobs assigned to current user (team) with status working. Includes last_report_at, project_id, in-progress workflow stage, and job status for Dashboard.';

GRANT EXECUTE ON FUNCTION public.list_assigned_jobs_for_dashboard() TO authenticated;

DROP FUNCTION IF EXISTS public.list_ready_to_bill_assigned_jobs_for_dashboard();

CREATE FUNCTION public.list_ready_to_bill_assigned_jobs_for_dashboard()
RETURNS TABLE (
  id UUID,
  hcp_number TEXT,
  job_name TEXT,
  job_address TEXT,
  google_drive_link TEXT,
  job_plans_link TEXT,
  revenue NUMERIC,
  master_user_id UUID,
  created_at TIMESTAMPTZ,
  last_report_at TIMESTAMPTZ,
  status TEXT
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
    (SELECT MAX(r.created_at)
     FROM public.reports r
     WHERE r.job_ledger_id = jl.id) AS last_report_at,
    jl.status::text
  FROM public.jobs_ledger jl
  INNER JOIN public.jobs_ledger_team_members jtm ON jtm.job_id = jl.id AND jtm.user_id = auth.uid()
  WHERE jl.status = 'ready_to_bill'
  ORDER BY jl.hcp_number DESC, jl.job_name;
$$;

COMMENT ON FUNCTION public.list_ready_to_bill_assigned_jobs_for_dashboard() IS 'Team-assigned jobs for current user with status ready_to_bill, including job status for Dashboard.';

GRANT EXECUTE ON FUNCTION public.list_ready_to_bill_assigned_jobs_for_dashboard() TO authenticated;
