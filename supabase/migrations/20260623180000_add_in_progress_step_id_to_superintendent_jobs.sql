-- Add in_progress_step_id to list_superintendent_jobs_for_dashboard
-- Enables linking from Dashboard "In Progress Stage" to Workflow page step (via #step-{id} hash)

DROP FUNCTION IF EXISTS public.list_superintendent_jobs_for_dashboard();

CREATE OR REPLACE FUNCTION public.list_superintendent_jobs_for_dashboard()
RETURNS TABLE (
  id UUID,
  hcp_number TEXT,
  job_name TEXT,
  job_address TEXT,
  google_drive_link TEXT,
  job_plans_link TEXT,
  revenue NUMERIC,
  created_at TIMESTAMPTZ,
  project_id UUID,
  in_progress_stage_name TEXT,
  in_progress_step_id UUID
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
    jl.created_at,
    jl.project_id,
    (SELECT s.name
     FROM public.project_workflows pw
     JOIN public.project_workflow_steps s ON s.workflow_id = pw.id AND s.status = 'in_progress'
     WHERE pw.project_id = p.id
     LIMIT 1) AS in_progress_stage_name,
    (SELECT s.id
     FROM public.project_workflows pw
     JOIN public.project_workflow_steps s ON s.workflow_id = pw.id AND s.status = 'in_progress'
     WHERE pw.project_id = p.id
     LIMIT 1) AS in_progress_step_id
  FROM public.jobs_ledger jl
  JOIN public.projects p ON p.id = jl.project_id
  WHERE jl.project_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
    AND (
      EXISTS (SELECT 1 FROM public.project_superintendents WHERE project_id = p.id AND superintendent_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.master_superintendents WHERE master_id = p.master_user_id AND superintendent_id = auth.uid())
    )
  ORDER BY jl.hcp_number DESC, jl.job_name;
$$;
COMMENT ON FUNCTION public.list_superintendent_jobs_for_dashboard() IS 'Jobs for superintendents (project-linked) with in-progress stage name and step ID. For Dashboard Assigned Jobs when role is superintendent.';
