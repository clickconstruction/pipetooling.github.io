SET lock_timeout = '3s';

-- v2.3144 — the Dashboard's Superintendent Jobs list shows only assigned projects.
--
-- v2.2836 (20260905100000_project_access_assigned_superintendents.sql) removed the
-- master_superintendents (adoption) branch from every project-access helper —
-- adoption has been company-wide since v2.921's sync_company_access_grants(), so
-- that branch meant "every superintendent". It did not touch this RPC, so the
-- Dashboard's Superintendent Jobs section (useDashboardAssignedJobs →
-- DashboardSuperintendentJobsSection) and the v2.3131 "Your jobs on a map" card
-- still listed every project-linked job in the company for a superintendent.
--
-- Changes (body otherwise verbatim from 20260722258000_click_number_dashboard_rpcs.sql):
--   * WHERE keeps only the project_superintendents branch — the same predicate the
--     v2.2836 helpers use for superintendents (user_assigned_to_project_as_superintendent).
--   * Filters jl.status IN ('waiting', 'working') like list_assigned_jobs_for_dashboard,
--     so billed / paid jobs stop crowding the field list and the map.
--   * Appends jl.status::text AS status to RETURNS TABLE (last column, so the client
--     row type DashboardTeamAssignedJobRow — optional `status` — keeps working and
--     the map card colors pins from the real status instead of assuming waiting).
--
-- DROP + CREATE because the return type changes (CREATE OR REPLACE refuses that);
-- the grants are re-issued below. No table or policy changes.

DROP FUNCTION IF EXISTS public.list_superintendent_jobs_for_dashboard();

CREATE OR REPLACE FUNCTION public.list_superintendent_jobs_for_dashboard()
 RETURNS TABLE(id uuid, hcp_number text, job_name text, job_address text, google_drive_link text, job_plans_link text, job_pictures_link text, revenue numeric, created_at timestamp with time zone, my_last_report_at timestamp with time zone, project_id uuid, in_progress_stage_name text, in_progress_step_id uuid, click_number text, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    jl.id,
    COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), ''),
    jl.job_name,
    jl.job_address,
    jl.google_drive_link,
    jl.job_plans_link,
    jl.job_pictures_link,
    jl.revenue,
    jl.created_at,
    (SELECT MAX(r.created_at)
     FROM public.reports r
     WHERE r.job_ledger_id = jl.id AND r.created_by_user_id = auth.uid()) AS my_last_report_at,
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
     LIMIT 1) AS in_progress_step_id,
    jl.click_number,
    jl.status::text AS status
  FROM public.jobs_ledger jl
  JOIN public.projects p ON p.id = jl.project_id
  WHERE jl.project_id IS NOT NULL
    AND jl.status IN ('waiting', 'working')
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
    -- Assigned projects only (project_superintendents). Adoption via
    -- master_superintendents is company-wide (v2.921) and grants no project
    -- access (v2.2836), so it is no longer consulted here.
    AND EXISTS (SELECT 1 FROM public.project_superintendents ps WHERE ps.project_id = p.id AND ps.superintendent_id = auth.uid())
  ORDER BY COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '') DESC, jl.job_name;
$function$;

COMMENT ON FUNCTION public.list_superintendent_jobs_for_dashboard() IS
  'Superintendent Dashboard jobs: waiting/working jobs on projects the caller is assigned to via project_superintendents only (v2.3144; adoption grants nothing since v2.2836). Includes job_pictures_link, my_last_report_at, click_number and status.';

GRANT ALL ON FUNCTION public.list_superintendent_jobs_for_dashboard() TO anon;
GRANT ALL ON FUNCTION public.list_superintendent_jobs_for_dashboard() TO authenticated;
GRANT ALL ON FUNCTION public.list_superintendent_jobs_for_dashboard() TO service_role;
