-- Assistants creating jobs for their adopting master (job_owner_override / effectiveMasterId)
-- failed INSERT: policy only allowed master_user_id = auth.uid() or project-linked rows.
-- SELECT/UPDATE already allow master_assistants + assistants_share_master.
-- Version 20260625170000: avoids collision with remote 20260625120000 (different migration).

DROP POLICY IF EXISTS "Devs, masters, assistants can insert jobs ledger" ON public.jobs_ledger;

CREATE POLICY "Devs, masters, assistants can insert jobs ledger"
ON public.jobs_ledger
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND (
    master_user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND public.can_access_project_row(project_id)
      AND master_user_id = (SELECT master_user_id FROM public.projects WHERE id = project_id)
    )
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'assistant')
      AND (
        EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = master_user_id
          AND assistant_id = auth.uid()
        )
        OR public.assistants_share_master(auth.uid(), master_user_id)
      )
    )
  )
);

COMMENT ON POLICY "Devs, masters, assistants can insert jobs ledger" ON public.jobs_ledger IS
  'Insert: own job (master_user_id=self), project job with access, or assistant for adopting/shared master.';
