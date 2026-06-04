-- Subcontractors need jobs_ledger SELECT for DetailJobModal fetchLimitedLedgerRow when they
-- open job detail from Dashboard schedule (job_schedule_blocks assignee) or are on the team.
-- Staff policy does not include subcontractor; list_assigned_jobs_for_dashboard is SECURITY DEFINER
-- and masked the gap. Aligns with jobs_ledger_thread_notes subcontractor branch (20260408224611).

CREATE POLICY "Subcontractors can read jobs ledger for team or schedule"
ON public.jobs_ledger
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'subcontractor')
  AND (
    EXISTS (
      SELECT 1 FROM public.jobs_ledger_team_members jtm
      WHERE jtm.job_id = jobs_ledger.id
        AND jtm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.job_schedule_blocks jsb
      WHERE jsb.job_id = jobs_ledger.id
        AND jsb.assignee_user_id = auth.uid()
    )
  )
);

COMMENT ON POLICY "Subcontractors can read jobs ledger for team or schedule" ON public.jobs_ledger IS
  'Subcontractor limited ledger reads when on jobs_ledger_team_members or Dispatch assignee on job_schedule_blocks for this job.';
