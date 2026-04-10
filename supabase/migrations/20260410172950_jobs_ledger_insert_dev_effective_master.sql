-- New-job form sets master_user_id from resolveEffectiveJobMasterUserId: project owner,
-- app_settings job_owner_override_{auth.uid()}, or auth user. Devs often create jobs for
-- another master (override / project) while auth.uid() stays the dev — the INSERT policy
-- only allowed master_user_id = auth.uid() or assistant/project branches, so dev + foreign
-- master failed RLS. Allow public.is_dev() on INSERT (same pattern as many other tables).

DROP POLICY IF EXISTS "Devs, masters, assistants can insert jobs ledger" ON public.jobs_ledger;

CREATE POLICY "Devs, masters, assistants can insert jobs ledger"
ON public.jobs_ledger
FOR INSERT
WITH CHECK (
  public.is_dev()
  OR (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('master_technician', 'assistant')
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
  )
);

COMMENT ON POLICY "Devs, masters, assistants can insert jobs ledger" ON public.jobs_ledger IS
  'Insert: dev any row; master own or project-linked; assistant for adopting/shared master.';
