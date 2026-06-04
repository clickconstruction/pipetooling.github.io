-- Superintendent Leave Report opens from Assigned Jobs (team membership via jobs_ledger_team_members),
-- which includes jobs with project_id NULL. superintendent_report_job_anchor_allowed previously required
-- a project-linked job + can_access_project_row only, so inserts failed while the UI allowed opening the modal.

CREATE OR REPLACE FUNCTION public.superintendent_report_job_anchor_allowed(p_job_ledger_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs_ledger jl
    WHERE jl.id = p_job_ledger_id
      AND (
        (
          jl.project_id IS NOT NULL
          AND public.can_access_project_row(jl.project_id)
        )
        OR EXISTS (
          SELECT 1
          FROM public.jobs_ledger_team_members jtm
          WHERE jtm.job_id = jl.id
            AND jtm.user_id = auth.uid()
        )
      )
  );
$$;

COMMENT ON FUNCTION public.superintendent_report_job_anchor_allowed(uuid) IS
  'reports RLS superintendent job branch: project access OR team-assigned job (parity with list_assigned_jobs_for_dashboard); row_security off for jobs_ledger read.';
