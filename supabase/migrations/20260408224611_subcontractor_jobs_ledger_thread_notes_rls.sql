-- Subcontractors on a job (team member or schedule assignee) could not INSERT/SELECT
-- jobs_ledger_thread_notes: policies required EXISTS (jobs_ledger j ...), but jobs_ledger
-- SELECT has no subcontractor path, so the inner query saw zero rows.
-- Allow subs when they have jobs_ledger_team_members or job_schedule_blocks for the same job_id,
-- without referencing jobs_ledger in that branch.

DROP POLICY IF EXISTS "jobs_ledger_thread_notes_select" ON public.jobs_ledger_thread_notes;
CREATE POLICY "jobs_ledger_thread_notes_select"
  ON public.jobs_ledger_thread_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs_ledger j
      WHERE j.id = jobs_ledger_thread_notes.job_id
        AND (
          j.master_user_id = auth.uid()
          OR public.is_dev()
          OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
          OR public.assistants_share_master(auth.uid(), j.master_user_id)
          OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = j.id AND user_id = auth.uid())
        )
    )
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'subcontractor')
      AND (
        EXISTS (
          SELECT 1 FROM public.jobs_ledger_team_members jtm
          WHERE jtm.job_id = jobs_ledger_thread_notes.job_id
            AND jtm.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.job_schedule_blocks jsb
          WHERE jsb.job_id = jobs_ledger_thread_notes.job_id
            AND jsb.assignee_user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "jobs_ledger_thread_notes_insert" ON public.jobs_ledger_thread_notes;
CREATE POLICY "jobs_ledger_thread_notes_insert"
  ON public.jobs_ledger_thread_notes FOR INSERT
  WITH CHECK (
    author_user_id = auth.uid()
    AND auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.jobs_ledger j
        WHERE j.id = jobs_ledger_thread_notes.job_id
          AND (
            j.master_user_id = auth.uid()
            OR public.is_dev()
            OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
            OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
            OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
            OR public.assistants_share_master(auth.uid(), j.master_user_id)
            OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = j.id AND user_id = auth.uid())
          )
      )
      OR (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'subcontractor')
        AND (
          EXISTS (
            SELECT 1 FROM public.jobs_ledger_team_members jtm
            WHERE jtm.job_id = jobs_ledger_thread_notes.job_id
              AND jtm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.job_schedule_blocks jsb
            WHERE jsb.job_id = jobs_ledger_thread_notes.job_id
              AND jsb.assignee_user_id = auth.uid()
          )
        )
      )
    )
  );

COMMENT ON POLICY "jobs_ledger_thread_notes_select" ON public.jobs_ledger_thread_notes IS
  'Staff paths via jobs_ledger visibility; subcontractors via team membership or job_schedule_blocks assignee (no jobs_ledger read required).';
COMMENT ON POLICY "jobs_ledger_thread_notes_insert" ON public.jobs_ledger_thread_notes IS
  'Same visibility as SELECT; author must be auth.uid().';
