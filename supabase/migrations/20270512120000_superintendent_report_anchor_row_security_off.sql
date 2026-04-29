-- superintendent_report_job_anchor_allowed SELECTs jobs_ledger inside SECURITY DEFINER.
-- Without SET row_security = off, PostgreSQL still applies jobs_ledger RLS for that read
-- (same issue as tally Mercury assign helpers in 20260406170442_tally_assign_as_user_job_search_bypass_rls.sql).

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
      AND jl.project_id IS NOT NULL
      AND public.can_access_project_row(jl.project_id)
  );
$$;

COMMENT ON FUNCTION public.superintendent_report_job_anchor_allowed(uuid) IS
  'reports RLS: superintendent job-anchor branch; reads jobs_ledger with row_security off so policy check matches intent.';
