-- Team-assigned jobs in ready_to_bill status for Dashboard (non-staff roles).
-- Mirrors list_assigned_jobs_for_dashboard but filters jl.status = ready_to_bill.

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
  last_report_at TIMESTAMPTZ
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
     WHERE r.job_ledger_id = jl.id) AS last_report_at
  FROM public.jobs_ledger jl
  INNER JOIN public.jobs_ledger_team_members jtm ON jtm.job_id = jl.id AND jtm.user_id = auth.uid()
  WHERE jl.status = 'ready_to_bill'
  ORDER BY jl.hcp_number DESC, jl.job_name;
$$;

COMMENT ON FUNCTION public.list_ready_to_bill_assigned_jobs_for_dashboard() IS 'Team-assigned jobs for current user with status ready_to_bill. Dashboard non-staff Ready to Bill section.';

GRANT EXECUTE ON FUNCTION public.list_ready_to_bill_assigned_jobs_for_dashboard() TO authenticated;
