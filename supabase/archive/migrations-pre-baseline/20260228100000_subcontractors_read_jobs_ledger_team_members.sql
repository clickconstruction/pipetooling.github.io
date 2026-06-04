-- Allow subcontractors to read their own rows in jobs_ledger_team_members
-- Required for jobs_tally_parts INSERT policy: subcontractors must verify they are
-- on the job's team via EXISTS (SELECT 1 FROM jobs_ledger_team_members WHERE ...)
-- Without this, the subquery returns no rows (RLS blocks read), so INSERT fails.

CREATE POLICY "Subcontractors can read own jobs ledger team member rows"
ON public.jobs_ledger_team_members
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'subcontractor')
  AND user_id = auth.uid()
);
