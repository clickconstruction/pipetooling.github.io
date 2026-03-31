-- Team leads (any role, including estimators) may SELECT jobs_ledger rows that members
-- clocked into. Aligns with clock_sessions policy "Team leads can read member clock sessions"
-- (20260330150000_team_leader_assignments.sql). Without this, PostgREST embed
-- jobs_ledger!clock_sessions_job_ledger_id_fkey is null on dashboard strips.

CREATE POLICY "Team leads can read jobs ledger for member clock sessions"
ON public.jobs_ledger
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.clock_sessions cs
    WHERE cs.job_ledger_id = jobs_ledger.id
      AND public.is_team_lead_for_member(auth.uid(), cs.user_id)
  )
);

COMMENT ON POLICY "Team leads can read jobs ledger for member clock sessions" ON public.jobs_ledger IS
  'Leader sees job label fields for jobs linked from assigned members clock sessions (dashboard clock strips).';
