SET lock_timeout = '3s';

-- v2.2647 — superintendents can read + post job thread notes (Abraham's report).
--
-- The baseline jobs_ledger_thread_notes policies have two branches:
--   1. an office branch whose every check (including the role-agnostic
--      team-member check) sits INSIDE `EXISTS (SELECT 1 FROM jobs_ledger j …)`,
--      which evaluates under the CALLER's RLS — and superintendents have no
--      jobs_ledger SELECT policy of their own, so that EXISTS is empty for
--      them even when they are on the job's team;
--   2. a field branch that checks jobs_ledger_team_members / job_schedule_blocks
--      directly (dodging the jobs_ledger RLS trap) but is role-gated by
--      auth_uid_is_helpers_or_subcontractor(), which excludes superintendent.
--
-- Result: a team-member superintendent saw the activity feed (events arrive via
-- the SECURITY DEFINER list_job_activity_events RPC) but every note insert —
-- Post note, Arrived, Leaving — failed with an RLS violation, and plain NOTE
-- rows were silently invisible.
--
-- Fix: additive permissive policies for superintendents only, mirroring the
-- field branch (team member OR dispatch schedule assignee) plus the sanctioned
-- superintendent job anchor (project access OR team member — the same helper
-- the reports RLS uses, v2.2599). Existing policies untouched; the restrictive
-- fences (read-only training mode, digital-twin write fence, primary scope)
-- still apply on top.

CREATE OR REPLACE FUNCTION public.superintendent_can_touch_job_thread(p_job_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'superintendent'::public.user_role
  )
  AND (
    -- project access OR team-assigned job (reports-RLS superintendent branch)
    public.superintendent_report_job_anchor_allowed(p_job_id)
    OR EXISTS (
      SELECT 1 FROM public.job_schedule_blocks jsb
      WHERE jsb.job_id = p_job_id AND jsb.assignee_user_id = auth.uid()
    )
  );
$$;

COMMENT ON FUNCTION public.superintendent_can_touch_job_thread(uuid) IS
  'jobs_ledger_thread_notes superintendent branch: project access OR team member OR dispatch schedule assignee. SECURITY DEFINER + row_security off so the check does not depend on the caller''s jobs_ledger visibility.';

DROP POLICY IF EXISTS jobs_ledger_thread_notes_superintendent_select ON public.jobs_ledger_thread_notes;
CREATE POLICY jobs_ledger_thread_notes_superintendent_select
  ON public.jobs_ledger_thread_notes
  FOR SELECT
  USING (public.superintendent_can_touch_job_thread(job_id));

DROP POLICY IF EXISTS jobs_ledger_thread_notes_superintendent_insert ON public.jobs_ledger_thread_notes;
CREATE POLICY jobs_ledger_thread_notes_superintendent_insert
  ON public.jobs_ledger_thread_notes
  FOR INSERT
  WITH CHECK (
    author_user_id = (SELECT auth.uid())
    AND public.superintendent_can_touch_job_thread(job_id)
  );
