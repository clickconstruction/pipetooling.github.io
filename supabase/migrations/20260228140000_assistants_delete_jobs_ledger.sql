-- Allow assistants to delete jobs they have access to (same as update: master_assistants, assistants_share_master)
-- Fixes: assistants could not delete jobs in Billing when hitting the delete icon

DROP POLICY IF EXISTS "Devs, masters, assistants can delete jobs ledger" ON public.jobs_ledger;
CREATE POLICY "Devs, masters, assistants can delete jobs ledger"
ON public.jobs_ledger
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND (
    master_user_id = auth.uid()
    OR public.is_dev()
    OR EXISTS (
      SELECT 1 FROM public.master_assistants
      WHERE master_id = auth.uid()
      AND assistant_id = master_user_id
    )
    OR EXISTS (
      SELECT 1 FROM public.master_assistants
      WHERE master_id = master_user_id
      AND assistant_id = auth.uid()
    )
    OR public.assistants_share_master(auth.uid(), master_user_id)
  )
);
COMMENT ON POLICY "Devs, masters, assistants can delete jobs ledger" ON public.jobs_ledger IS 'Devs: any job. Masters: own jobs. Assistants: master''s jobs (adopted) or shared master.';
