-- Fix infinite RLS recursion from 20260421201823: the jobs_ledger policy used EXISTS
-- (jobs_ledger_team_members), but staff SELECT on jobs_ledger_team_members references
-- jobs_ledger, re-entering jobs_ledger policies. Use SECURITY DEFINER to evaluate team
-- and schedule membership without RLS on those reads.

DROP POLICY IF EXISTS "Subcontractors can read jobs ledger for team or schedule" ON public.jobs_ledger;

CREATE OR REPLACE FUNCTION public.subcontractor_can_read_jobs_ledger_row(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'subcontractor')
    AND (
      EXISTS (
        SELECT 1 FROM public.jobs_ledger_team_members jtm
        WHERE jtm.job_id = p_job_id AND jtm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.job_schedule_blocks jsb
        WHERE jsb.job_id = p_job_id AND jsb.assignee_user_id = auth.uid()
      )
    );
$$;

REVOKE ALL ON FUNCTION public.subcontractor_can_read_jobs_ledger_row(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subcontractor_can_read_jobs_ledger_row(uuid) TO authenticated;

COMMENT ON FUNCTION public.subcontractor_can_read_jobs_ledger_row(uuid) IS
  'True when caller is subcontractor and on job team or is Dispatch assignee for p_job_id. SECURITY DEFINER avoids jobs_ledger/jobs_ledger_team_members RLS recursion.';

CREATE POLICY "Subcontractors can read jobs ledger for team or schedule"
ON public.jobs_ledger
FOR SELECT
USING (public.subcontractor_can_read_jobs_ledger_row(id));

COMMENT ON POLICY "Subcontractors can read jobs ledger for team or schedule" ON public.jobs_ledger IS
  'Subcontractor jobs_ledger SELECT via subcontractor_can_read_jobs_ledger_row (team or schedule).';
