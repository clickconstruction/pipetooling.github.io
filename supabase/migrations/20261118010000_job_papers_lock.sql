SET lock_timeout = '3s';

-- Papers before a job opens, step 4 of seven: the lock in the database. Steps 1 to 3 made the papers a job requires,
-- the office's section and the prompt. Until this file the prompt was the only lock: a direct request still read a
-- job's rows. From here the database refuses a job to the crew and subs who still owe it a paper.
--
-- Who is locked. The owner's call 8 of 2026-11-17: for the office "Prompt is enough". So the lock here is for
-- everyone EXCEPT the roles whose job window is the full one: dev, master technician, assistant, controller and
-- primary. Closing the job's row to one of them would take the job out of their Pipeline and their money totals
-- until they sign. They meet the prompt at the job and the Needs you line, as before. Everyone else (helpers,
-- subcontractors, superintendents, estimators) is locked here as well.
--
-- What closes, for a locked person who owes a paper on the job:
--   * the job's own row: one restrictive policy on jobs_ledger. That closes direct reads, the schedule's and the
--     calendar's job embed, the clock-session grant and the first branch of on_site_can_touch_job.
--   * what the crew reaches through its helper functions (notes, photos, checklists, plans, materials on site, and
--     the job-photos edge function, which asks can_report_stage_progress): the six job-keyed helpers answer false.
--   * seven tables that grant access by themselves, with no helper: one restrictive policy each.
--
-- What it leaves alone, on purpose:
--   * can_access_project_row (both overloads): it is keyed on a project, not a job, so there is no job to ask about.
--   * job_schedule_blocks and jobs_ledger_team_members: a locked person still sees that they have a block, by its
--     time. The job behind it is closed, and their list shows its number and a lock.
--   * every other table that carries a job: the office's money and paper tables, which no locked role reads.
--
-- Safety. Nothing changes for anyone until a job requires a paper: the predicate looks at job_required_papers' live
-- rows first and answers before it asks who the caller is. The policies are TO authenticated, so the database agent
-- roles, the service role and cron never meet them. Every function keeps its newest definition (each has exactly
-- one, named beside it) with one condition added. No CREATE TABLE. Idempotent: CREATE OR REPLACE, DROP POLICY IF
-- EXISTS. Each CREATE POLICY takes a brief lock on a table in use: push in a quiet moment.

-- 1) Who meets the prompt alone.
CREATE OR REPLACE FUNCTION public.job_papers_prompt_only()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public.is_office_staff() OR public.is_primary();
$$;

COMMENT ON FUNCTION public.job_papers_prompt_only() IS
  'Papers before a job opens: true for the roles the database lock leaves alone (dev, master technician, assistant, controller, primary). For them the prompt at the job is the lock (the owner''s call 8): hiding the job''s row would take it out of their Pipeline and money totals.';
REVOKE EXECUTE ON FUNCTION public.job_papers_prompt_only() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_papers_prompt_only() TO authenticated, service_role;

-- 2) The lock's own question. The CASE keeps the order: no login, then the cheap look at the live required papers,
-- then the role, and only then the caller's own papers. A job that requires nothing ends at the second line.
CREATE OR REPLACE FUNCTION public.job_shut_to_me(p_job_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR p_job_id IS NULL THEN false
    WHEN NOT EXISTS (SELECT 1 FROM public.job_required_papers r WHERE r.job_id = p_job_id AND r.removed_at IS NULL) THEN false
    WHEN public.job_papers_prompt_only() THEN false
    ELSE public.job_closed_to_me(p_job_id)
  END;
$$;

COMMENT ON FUNCTION public.job_shut_to_me(uuid) IS
  'Papers before a job opens, the database lock: true when the signed-in user still owes a paper on this job AND is not one of the prompt-only roles. job_closed_to_me says who owes; this says whose rows the database refuses. It looks at the live required papers first and reads nothing else for a job that requires none.';
REVOKE EXECUTE ON FUNCTION public.job_shut_to_me(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_shut_to_me(uuid) TO authenticated, service_role;

-- The same answer as a set, asked once a statement by the policies below.
CREATE OR REPLACE FUNCTION public.jobs_shut_to_me()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN '{}'::uuid[]
    WHEN NOT EXISTS (SELECT 1 FROM public.job_required_papers r WHERE r.removed_at IS NULL) THEN '{}'::uuid[]
    WHEN public.job_papers_prompt_only() THEN '{}'::uuid[]
    ELSE public.jobs_closed_to_me()
  END;
$$;

COMMENT ON FUNCTION public.jobs_shut_to_me() IS
  'Papers before a job opens, the database lock: the ids of the jobs the database refuses to the signed-in user, the same rule as job_shut_to_me(job). Empty for a caller with no login, while no job requires a paper, and for the prompt-only roles. The job_papers_fence policies ask it once a statement.';
REVOKE EXECUTE ON FUNCTION public.jobs_shut_to_me() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.jobs_shut_to_me() TO authenticated, service_role;

-- 3) The job's own row.
DROP POLICY IF EXISTS job_papers_fence ON public.jobs_ledger;
CREATE POLICY job_papers_fence ON public.jobs_ledger AS RESTRICTIVE FOR ALL TO authenticated
  USING (id <> ALL ((SELECT public.jobs_shut_to_me())::uuid[]));

-- 4) The helpers the crew's access runs through, each from its newest definition with one condition added. The
-- condition comes last, so the lock's question is asked only about a job the caller could otherwise reach.

-- helper_on_job, from 20261014220000 (its only definition).
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
  )
  AND NOT public.job_shut_to_me(p_job_id);
$$;

-- subcontractor_can_read_jobs_ledger_row, from the baseline (its only definition).
CREATE OR REPLACE FUNCTION public.subcontractor_can_read_jobs_ledger_row(p_job_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('helpers', 'subcontractor')
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.jobs_ledger_team_members jtm
        WHERE jtm.job_id = p_job_id AND jtm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.job_schedule_blocks jsb
        WHERE jsb.job_id = p_job_id AND jsb.assignee_user_id = auth.uid()
      )
    )
    AND NOT public.job_shut_to_me(p_job_id);
$$;

-- can_report_stage_progress, from 20260909141454 (its only definition). It answers true for every superintendent
-- and estimator on every job, so the condition here is what closes a job to them.
CREATE OR REPLACE FUNCTION public.can_report_stage_progress(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent', 'estimator')
      )
      OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members m WHERE m.job_id = p_job_id AND m.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.clock_sessions cs WHERE cs.job_ledger_id = p_job_id AND cs.user_id = auth.uid())
      OR public.subcontractor_can_read_jobs_ledger_row(p_job_id)
    )
    AND NOT public.job_shut_to_me(p_job_id);
$$;

-- on_site_can_touch_job, from 20261029010000 (its only definition). SECURITY INVOKER as before: its first branch
-- reads jobs_ledger under the caller's policies and so meets the fence above. The condition closes its second
-- branch, the team list.
CREATE OR REPLACE FUNCTION public.on_site_can_touch_job(p_job_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = p_job_id)
    OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members m WHERE m.job_id = p_job_id AND m.user_id = auth.uid())
  ) AND NOT public.job_shut_to_me(p_job_id)
$$;

-- superintendent_report_job_anchor_allowed, from the baseline (its only definition). Its argument keeps its name.
CREATE OR REPLACE FUNCTION public.superintendent_report_job_anchor_allowed(p_job_ledger_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs_ledger jl
    WHERE jl.id = p_job_ledger_id
      AND (
        (
          jl.project_id IS NOT NULL
          AND public.can_access_project_row(jl.project_id)
        )
        OR EXISTS (
          SELECT 1
          FROM public.jobs_ledger_team_members jtm
          WHERE jtm.job_id = jl.id
            AND jtm.user_id = auth.uid()
        )
      )
  )
  AND NOT public.job_shut_to_me(p_job_ledger_id);
$$;

-- superintendent_can_touch_job_thread, from 20260902165836 (its only definition).
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
  )
  AND NOT public.job_shut_to_me(p_job_id);
$$;

-- 5) The short fence: the tables that grant a job's rows by themselves, with no helper. One restrictive policy
-- each, on the table's own job column. A row tied to no job passes.
DROP POLICY IF EXISTS job_papers_fence ON public.jobs_ledger_thread_notes;
CREATE POLICY job_papers_fence ON public.jobs_ledger_thread_notes AS RESTRICTIVE FOR ALL TO authenticated
  USING (job_id <> ALL ((SELECT public.jobs_shut_to_me())::uuid[]));

DROP POLICY IF EXISTS job_papers_fence ON public.jobs_tally_parts;
CREATE POLICY job_papers_fence ON public.jobs_tally_parts AS RESTRICTIVE FOR ALL TO authenticated
  USING (job_id <> ALL ((SELECT public.jobs_shut_to_me())::uuid[]));

DROP POLICY IF EXISTS job_papers_fence ON public.job_stage_windows;
CREATE POLICY job_papers_fence ON public.job_stage_windows AS RESTRICTIVE FOR ALL TO authenticated
  USING (job_id <> ALL ((SELECT public.jobs_shut_to_me())::uuid[]));

DROP POLICY IF EXISTS job_papers_fence ON public.file_index;
CREATE POLICY job_papers_fence ON public.file_index AS RESTRICTIVE FOR ALL TO authenticated
  USING (jobs_ledger_id IS NULL OR jobs_ledger_id <> ALL ((SELECT public.jobs_shut_to_me())::uuid[]));

DROP POLICY IF EXISTS job_papers_fence ON public.messages;
CREATE POLICY job_papers_fence ON public.messages AS RESTRICTIVE FOR ALL TO authenticated
  USING (jobs_ledger_id IS NULL OR jobs_ledger_id <> ALL ((SELECT public.jobs_shut_to_me())::uuid[]));

DROP POLICY IF EXISTS job_papers_fence ON public.painted_maps;
CREATE POLICY job_papers_fence ON public.painted_maps AS RESTRICTIVE FOR ALL TO authenticated
  USING (job_id IS NULL OR job_id <> ALL ((SELECT public.jobs_shut_to_me())::uuid[]));

DROP POLICY IF EXISTS job_papers_fence ON public.step_commitments;
CREATE POLICY job_papers_fence ON public.step_commitments AS RESTRICTIVE FOR ALL TO authenticated
  USING (job_id IS NULL OR job_id <> ALL ((SELECT public.jobs_shut_to_me())::uuid[]));
