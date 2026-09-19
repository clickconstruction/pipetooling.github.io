SET lock_timeout = '3s';

-- v2.3614 Supervision, PR 4 (to-dos/supervision): Rate my crew.
-- A supervisor — a master, or a helper / sub with needs_supervision off — rates the people they
-- supervised this month with the three sliders. The rows are ordinary team_member_reviews rows
-- with source = 'supervisor' (one per subject, reviewer, month, source), by name, readable by
-- the office beside its own rows on the Review stage. The write is gated on the schedule and
-- the clock: the reviewer must have shared at least one job-day with the subject that month
-- while able to run a job. Additive and idempotent.

-- 1. A third source ------------------------------------------------------------------------
ALTER TABLE public.team_member_reviews DROP CONSTRAINT IF EXISTS team_member_reviews_source_check;
ALTER TABLE public.team_member_reviews
  ADD CONSTRAINT team_member_reviews_source_check CHECK (source IN ('office', 'crew', 'supervisor'));

-- 2. The rule, in SQL: job-days the caller supervised the subject in a month -----------------
CREATE OR REPLACE FUNCTION public.supervised_days_with(p_subject uuid, p_month date)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT u.id FROM public.users u
     WHERE u.id = (SELECT auth.uid())
       AND (u.role::text = 'master_technician'
            OR (u.role::text IN ('helpers', 'subcontractor') AND NOT u.needs_supervision))
  ),
  bounds AS (
    SELECT date_trunc('month', p_month)::date AS d0,
           (date_trunc('month', p_month) + interval '1 month')::date AS d1
  ),
  mine AS (
    SELECT b.job_id AS job_id, b.work_date FROM public.job_schedule_blocks b, me, bounds
     WHERE b.assignee_user_id = me.id AND b.work_date >= bounds.d0 AND b.work_date < bounds.d1 AND b.job_id IS NOT NULL
    UNION
    SELECT s.job_ledger_id, s.work_date FROM public.clock_sessions s, me, bounds
     WHERE s.user_id = me.id AND s.work_date >= bounds.d0 AND s.work_date < bounds.d1
       AND s.job_ledger_id IS NOT NULL AND s.rejected_at IS NULL AND s.revoked_at IS NULL
  ),
  theirs AS (
    SELECT b.job_id AS job_id, b.work_date FROM public.job_schedule_blocks b, bounds
     WHERE b.assignee_user_id = p_subject AND b.work_date >= bounds.d0 AND b.work_date < bounds.d1 AND b.job_id IS NOT NULL
    UNION
    SELECT s.job_ledger_id, s.work_date FROM public.clock_sessions s, bounds
     WHERE s.user_id = p_subject AND s.work_date >= bounds.d0 AND s.work_date < bounds.d1
       AND s.job_ledger_id IS NOT NULL AND s.rejected_at IS NULL AND s.revoked_at IS NULL
  )
  SELECT count(DISTINCT m.work_date)::integer
    FROM mine m JOIN theirs t ON t.job_id = m.job_id AND t.work_date = m.work_date;
$$;
ALTER FUNCTION public.supervised_days_with(uuid, date) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.supervised_days_with(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supervised_days_with(uuid, date) TO authenticated;
COMMENT ON FUNCTION public.supervised_days_with(uuid, date) IS
  'v2.3614 Supervision: how many job-days in the month the caller (while able to run a job) shared with p_subject, from schedule blocks and clock sessions. 0 for anyone who cannot run a job. Gates the supervisor lane of team_member_reviews.';

-- 3. Row security: the supervisor lane -----------------------------------------------------
DROP POLICY IF EXISTS "Prospects staff can read team member reviews" ON public.team_member_reviews;
CREATE POLICY "Prospects staff can read team member reviews" ON public.team_member_reviews
  FOR SELECT USING (
    (source IN ('office', 'supervisor') AND public.user_has_prospects_staff_access())
    OR public.is_dev()
    OR reviewer_user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Reviewers insert their own team member reviews" ON public.team_member_reviews;
CREATE POLICY "Reviewers insert their own team member reviews" ON public.team_member_reviews
  FOR INSERT WITH CHECK (
    reviewer_user_id = (SELECT auth.uid())
    AND (
      (source = 'office' AND public.user_has_prospects_staff_access())
      OR (source = 'crew' AND subject_user_id <> reviewer_user_id)
      OR (source = 'supervisor' AND subject_user_id <> reviewer_user_id AND public.supervised_days_with(subject_user_id, review_month) >= 1)
    )
  );

DROP POLICY IF EXISTS "Reviewers update their own team member reviews" ON public.team_member_reviews;
CREATE POLICY "Reviewers update their own team member reviews" ON public.team_member_reviews
  FOR UPDATE USING (reviewer_user_id = (SELECT auth.uid()))
  WITH CHECK (
    reviewer_user_id = (SELECT auth.uid())
    AND (
      (source = 'office' AND public.user_has_prospects_staff_access())
      OR (source = 'crew' AND subject_user_id <> reviewer_user_id)
      OR (source = 'supervisor' AND subject_user_id <> reviewer_user_id AND public.supervised_days_with(subject_user_id, review_month) >= 1)
    )
  );

-- 4. The deck: who I supervised this month, two or more days, and whether I rated them -------
CREATE OR REPLACE FUNCTION public.get_supervisor_review_deck(p_month date)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT u.id FROM public.users u
     WHERE u.id = (SELECT auth.uid())
       AND (u.role::text = 'master_technician'
            OR (u.role::text IN ('helpers', 'subcontractor') AND NOT u.needs_supervision))
  ),
  bounds AS (
    SELECT date_trunc('month', p_month)::date AS d0,
           (date_trunc('month', p_month) + interval '1 month')::date AS d1
  ),
  mine AS (
    SELECT b.job_id AS job_id, b.work_date FROM public.job_schedule_blocks b, me, bounds
     WHERE b.assignee_user_id = me.id AND b.work_date >= bounds.d0 AND b.work_date < bounds.d1 AND b.job_id IS NOT NULL
    UNION
    SELECT s.job_ledger_id, s.work_date FROM public.clock_sessions s, me, bounds
     WHERE s.user_id = me.id AND s.work_date >= bounds.d0 AND s.work_date < bounds.d1
       AND s.job_ledger_id IS NOT NULL AND s.rejected_at IS NULL AND s.revoked_at IS NULL
  ),
  crew AS (
    SELECT b.assignee_user_id AS user_id, m.job_id, m.work_date FROM mine m
      JOIN public.job_schedule_blocks b ON b.job_id = m.job_id AND b.work_date = m.work_date
    UNION
    SELECT s.user_id, m.job_id, m.work_date FROM mine m
      JOIN public.clock_sessions s ON s.job_ledger_id = m.job_id AND s.work_date = m.work_date
     WHERE s.rejected_at IS NULL AND s.revoked_at IS NULL
  ),
  people AS (
    SELECT c.user_id, count(DISTINCT c.work_date)::integer AS days,
           array_agg(DISTINCT COALESCE(NULLIF(trim(j.hcp_number), ''), NULLIF(trim(j.click_number), ''), '?') || ' · ' || COALESCE(NULLIF(trim(j.job_name), ''), NULLIF(trim(j.customer_name), ''), '—')) AS jobs
      FROM crew c JOIN public.jobs_ledger j ON j.id = c.job_id
     WHERE c.user_id <> (SELECT auth.uid())
     GROUP BY c.user_id
    HAVING count(DISTINCT c.work_date) >= 2
  )
  SELECT jsonb_build_object(
    'supervisor', EXISTS (SELECT 1 FROM me),
    'month', (SELECT d0 FROM bounds),
    'people', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'user_id', p.user_id,
               'name', u.name,
               'role', u.role::text,
               'days', p.days,
               'jobs', to_jsonb(p.jobs),
               'reviewed', EXISTS (SELECT 1 FROM public.team_member_reviews r
                                    WHERE r.subject_user_id = p.user_id AND r.reviewer_user_id = (SELECT auth.uid())
                                      AND r.review_month = (SELECT d0 FROM bounds) AND r.source = 'supervisor')
             ) ORDER BY p.days DESC, u.name)
        FROM people p JOIN public.users u ON u.id = p.user_id
       WHERE u.archived_at IS NULL
    ), '[]'::jsonb)
  );
$$;
ALTER FUNCTION public.get_supervisor_review_deck(date) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.get_supervisor_review_deck(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_supervisor_review_deck(date) TO authenticated;
COMMENT ON FUNCTION public.get_supervisor_review_deck(date) IS
  'v2.3614 Supervision: the caller''s Rate my crew deck for a month — everyone they supervised on two or more job-days (schedule blocks + clock sessions), with days, the jobs, and whether a supervisor review for the month exists. {"supervisor": false} for anyone who cannot run a job.';
