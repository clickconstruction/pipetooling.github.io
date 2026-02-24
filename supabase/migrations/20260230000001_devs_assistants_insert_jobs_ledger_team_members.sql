-- Allow devs and assistants to insert jobs_ledger_team_members (same scope as DELETE)
-- Fixes: Ham mode "edit Assigned" - devs/assistants could not add team members to jobs they don't own

DROP POLICY IF EXISTS "Devs, masters, assistants can insert jobs ledger team members" ON public.jobs_ledger_team_members;

CREATE POLICY "Devs, masters, assistants can insert jobs ledger team members"
ON public.jobs_ledger_team_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_team_members.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

COMMENT ON POLICY "Devs, masters, assistants can insert jobs ledger team members" ON public.jobs_ledger_team_members IS 'Devs: any job. Masters: own jobs. Assistants: master''s jobs (adopted) or shared master.';
