-- PostgREST embed jobs_ledger!clock_sessions_job_ledger_id_fkey requires SELECT on jobs_ledger.
-- Team-lead policy (20270329220000_jobs_ledger_select_team_lead_member_sessions.sql) covers members only:
-- is_team_lead_for_member(leader, member) is false when member is self (leader≠member constraint).
-- Broad superintendent jobs_ledger SELECT was revoked (20260623190000_revoke_superintendent_jobs_billing.sql).
-- Allow minimal read for rows linked from the viewer's own clock_sessions so strips show HCP/name labels.

CREATE POLICY "Users can read jobs ledger linked from own clock sessions"
ON public.jobs_ledger
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.clock_sessions cs
    WHERE cs.job_ledger_id = jobs_ledger.id
      AND cs.job_ledger_id IS NOT NULL
      AND cs.user_id = auth.uid()
  )
);

COMMENT ON POLICY "Users can read jobs ledger linked from own clock sessions" ON public.jobs_ledger IS
  'Own clock_sessions FK embed on dashboard strips (HCP/job name); complements team-lead policy for member sessions.';
