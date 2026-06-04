-- Dashboard Leave Report nag: max(reports.created_at) for auth.uid() on each job ("my_last_report_at").

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
  my_last_report_at TIMESTAMPTZ,
  last_thread_note_at TIMESTAMPTZ,
  last_clock_activity_at TIMESTAMPTZ,
  last_schedule_activity_at TIMESTAMPTZ,
  last_job_activity_at TIMESTAMPTZ,
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
    (SELECT MAX(r.created_at)
     FROM public.reports r
     WHERE r.job_ledger_id = jl.id AND r.created_by_user_id = auth.uid()) AS my_last_report_at,
    (SELECT max(n.created_at) FROM public.jobs_ledger_thread_notes n WHERE n.job_id = jl.id) AS last_thread_note_at,
    (SELECT max(coalesce(cs.clocked_out_at, cs.clocked_in_at))
     FROM public.clock_sessions cs
     WHERE cs.job_ledger_id = jl.id
       AND cs.approved_at IS NOT NULL
       AND cs.rejected_at IS NULL
       AND cs.revoked_at IS NULL) AS last_clock_activity_at,
    (SELECT max(greatest(jb.created_at, jb.updated_at))
     FROM public.job_schedule_blocks jb
     WHERE jb.job_id = jl.id) AS last_schedule_activity_at,
    (SELECT max(x.v) FROM (
      SELECT (SELECT max(n2.created_at) FROM public.jobs_ledger_thread_notes n2 WHERE n2.job_id = jl.id) AS v
      UNION ALL
      SELECT (SELECT max(r2.created_at) FROM public.reports r2 WHERE r2.job_ledger_id = jl.id) AS v
      UNION ALL
      SELECT (SELECT max(coalesce(cs2.clocked_out_at, cs2.clocked_in_at))
              FROM public.clock_sessions cs2
              WHERE cs2.job_ledger_id = jl.id
                AND cs2.approved_at IS NOT NULL
                AND cs2.rejected_at IS NULL
                AND cs2.revoked_at IS NULL) AS v
      UNION ALL
      SELECT (SELECT max(greatest(jb2.created_at, jb2.updated_at))
              FROM public.job_schedule_blocks jb2
              WHERE jb2.job_id = jl.id) AS v
    ) x) AS last_job_activity_at,
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

COMMENT ON FUNCTION public.list_assigned_jobs_for_dashboard() IS
  'Team working jobs for dashboard. last_report_at = any author; my_last_report_at = current user Leave Report nag. Activity times unchanged.';

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
  my_last_report_at TIMESTAMPTZ,
  last_thread_note_at TIMESTAMPTZ,
  last_clock_activity_at TIMESTAMPTZ,
  last_schedule_activity_at TIMESTAMPTZ,
  last_job_activity_at TIMESTAMPTZ,
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
    (SELECT MAX(r.created_at)
     FROM public.reports r
     WHERE r.job_ledger_id = jl.id AND r.created_by_user_id = auth.uid()) AS my_last_report_at,
    (SELECT max(n.created_at) FROM public.jobs_ledger_thread_notes n WHERE n.job_id = jl.id) AS last_thread_note_at,
    (SELECT max(coalesce(cs.clocked_out_at, cs.clocked_in_at))
     FROM public.clock_sessions cs
     WHERE cs.job_ledger_id = jl.id
       AND cs.approved_at IS NOT NULL
       AND cs.rejected_at IS NULL
       AND cs.revoked_at IS NULL) AS last_clock_activity_at,
    (SELECT max(greatest(jb.created_at, jb.updated_at))
     FROM public.job_schedule_blocks jb
     WHERE jb.job_id = jl.id) AS last_schedule_activity_at,
    (SELECT max(x.v) FROM (
      SELECT (SELECT max(n2.created_at) FROM public.jobs_ledger_thread_notes n2 WHERE n2.job_id = jl.id) AS v
      UNION ALL
      SELECT (SELECT max(r2.created_at) FROM public.reports r2 WHERE r2.job_ledger_id = jl.id) AS v
      UNION ALL
      SELECT (SELECT max(coalesce(cs2.clocked_out_at, cs2.clocked_in_at))
              FROM public.clock_sessions cs2
              WHERE cs2.job_ledger_id = jl.id
                AND cs2.approved_at IS NOT NULL
                AND cs2.rejected_at IS NULL
                AND cs2.revoked_at IS NULL) AS v
      UNION ALL
      SELECT (SELECT max(greatest(jb2.created_at, jb2.updated_at))
              FROM public.job_schedule_blocks jb2
              WHERE jb2.job_id = jl.id) AS v
    ) x) AS last_job_activity_at,
    jl.status::text
  FROM public.jobs_ledger jl
  INNER JOIN public.jobs_ledger_team_members jtm ON jtm.job_id = jl.id AND jtm.user_id = auth.uid()
  WHERE jl.status = 'ready_to_bill'
  ORDER BY jl.hcp_number DESC, jl.job_name;
$$;

COMMENT ON FUNCTION public.list_ready_to_bill_assigned_jobs_for_dashboard() IS
  'Ready-to-bill team jobs for dashboard. last_report_at = any author; my_last_report_at = current user Leave Report nag.';

GRANT EXECUTE ON FUNCTION public.list_ready_to_bill_assigned_jobs_for_dashboard() TO authenticated;

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
  my_last_report_at TIMESTAMPTZ,
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

COMMENT ON FUNCTION public.list_superintendent_jobs_for_dashboard() IS
  'Superintendent project-linked jobs for dashboard. Includes my_last_report_at for Leave Report nag parity.';
