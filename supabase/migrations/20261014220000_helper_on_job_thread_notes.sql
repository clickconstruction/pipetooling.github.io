SET lock_timeout = '3s';

-- Messages, residential R5 follow-up (v2.5526): a helper on the job's crew leaves Job Mode's Something else note.
--
-- The prod field walk (2026-10-14) found the Sample helper, on the ZZ job's crew and clocked in, refused with "You don't
-- have permission to leave the note for the office", and blind to the primary's note in Job updates. The thread notes'
-- field branch (helpers and subs, auth_uid_is_helpers_or_subcontractor()) asks EXISTS on jobs_ledger_team_members under
-- the CALLER's RLS, and that table's SELECT policy (20260907050000) leaves helpers out: a helper never sees their own
-- crew row, so only a dispatch schedule block let them through. The same trap superintendent_can_touch_job_thread
-- (20260902165836) closed for superintendents.
--
--   * helper_on_job(p_job_id): SECURITY DEFINER, row_security off, so the answer does not hang on the caller's
--     visibility. True when the signed-in user is on the job's crew (jobs_ledger_team_members), or has a schedule block
--     on it this week or last, Monday to Sunday in Chicago (the span of messages_tech_on_job, 20261014180000).
--   * jobs_ledger_thread_notes_insert and _select are recreated from their newest definition (20260907050000) with the
--     field branch's crew EXISTS replaced by helper_on_job. The branch's own schedule-block EXISTS stays as it was, so a
--     helper dispatched to the job on any day keeps what they had. The office branch is untouched, and the restrictive
--     fences (training mode, the twin fence, primary scope) still apply on top.
--
-- No CREATE TABLE. Idempotent: CREATE OR REPLACE and DROP POLICY IF EXISTS.

CREATE OR REPLACE FUNCTION public.helper_on_job(p_job_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  WITH span AS (
    SELECT date_trunc('week', now() AT TIME ZONE 'America/Chicago')::date - 7 AS first_day,
           date_trunc('week', now() AT TIME ZONE 'America/Chicago')::date + 6 AS last_day
  )
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.jobs_ledger_team_members m
      WHERE m.job_id = p_job_id AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.job_schedule_blocks b, span s
      WHERE b.job_id = p_job_id AND b.assignee_user_id = auth.uid() AND b.work_date BETWEEN s.first_day AND s.last_day
    )
  );
$$;

COMMENT ON FUNCTION public.helper_on_job(uuid) IS
  'Whether the signed-in user is on this Pipeline job''s crew (jobs_ledger_team_members) or has a schedule block on it this week or last, Monday to Sunday in Chicago. SECURITY DEFINER + row_security off, so the jobs_ledger_thread_notes field branch (helpers, subs) does not hang on the caller''s team-members visibility (v2.5526).';

REVOKE EXECUTE ON FUNCTION public.helper_on_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helper_on_job(uuid) TO authenticated, service_role;

-- jobs_ledger_thread_notes_insert, from 20260907050000: the field branch asks helper_on_job for the crew.
DROP POLICY IF EXISTS "jobs_ledger_thread_notes_insert" ON public."jobs_ledger_thread_notes";
CREATE POLICY "jobs_ledger_thread_notes_insert" ON public."jobs_ledger_thread_notes"
  FOR INSERT
  WITH CHECK (public.is_office_staff() OR (author_user_id = (SELECT auth.uid() AS uid) AND (SELECT auth.uid() AS uid) IS NOT NULL AND (EXISTS (SELECT 1 FROM public.jobs_ledger AS j WHERE j.id = jobs_ledger_thread_notes.job_id AND (j.master_user_id = (SELECT auth.uid() AS uid) OR public.is_dev() OR EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid() AS uid) AND users.role = CAST('primary' AS public.user_role)) OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_assistants.master_id = (SELECT auth.uid() AS uid) AND master_assistants.assistant_id = j.master_user_id) OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_assistants.master_id = j.master_user_id AND master_assistants.assistant_id = (SELECT auth.uid() AS uid)) OR public.assistants_share_master((SELECT auth.uid() AS uid), j.master_user_id) OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE jobs_ledger_team_members.job_id = j.id AND jobs_ledger_team_members.user_id = (SELECT auth.uid() AS uid)))) OR (public.auth_uid_is_helpers_or_subcontractor() AND (public.helper_on_job(jobs_ledger_thread_notes.job_id) OR EXISTS (SELECT 1 FROM public.job_schedule_blocks AS jsb WHERE jsb.job_id = jobs_ledger_thread_notes.job_id AND jsb.assignee_user_id = (SELECT auth.uid() AS uid)))))));

-- jobs_ledger_thread_notes_select, from 20260907050000: the field branch asks helper_on_job for the crew.
DROP POLICY IF EXISTS "jobs_ledger_thread_notes_select" ON public."jobs_ledger_thread_notes";
CREATE POLICY "jobs_ledger_thread_notes_select" ON public."jobs_ledger_thread_notes"
  FOR SELECT
  USING (public.is_office_staff() OR (EXISTS (SELECT 1 FROM public.jobs_ledger AS j WHERE j.id = jobs_ledger_thread_notes.job_id AND (j.master_user_id = (SELECT auth.uid() AS uid) OR public.is_dev() OR EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid() AS uid) AND users.role = CAST('primary' AS public.user_role)) OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_assistants.master_id = (SELECT auth.uid() AS uid) AND master_assistants.assistant_id = j.master_user_id) OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_assistants.master_id = j.master_user_id AND master_assistants.assistant_id = (SELECT auth.uid() AS uid)) OR public.assistants_share_master((SELECT auth.uid() AS uid), j.master_user_id) OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE jobs_ledger_team_members.job_id = j.id AND jobs_ledger_team_members.user_id = (SELECT auth.uid() AS uid)))) OR (public.auth_uid_is_helpers_or_subcontractor() AND (public.helper_on_job(jobs_ledger_thread_notes.job_id) OR EXISTS (SELECT 1 FROM public.job_schedule_blocks AS jsb WHERE jsb.job_id = jobs_ledger_thread_notes.job_id AND jsb.assignee_user_id = (SELECT auth.uid() AS uid))))));
