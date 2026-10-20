SET lock_timeout = '3s';

-- GC mode, the schedule's PR 10 (v2.5114): the schedule opens to its team (G-133,
-- to-dos/gc-mode/mockups/schedule-pr10.md on branch spike/gc-mode).
--   1) public.gc_on_schedule_team(project) says who is on one job's schedule: the GC office
--      (gc_office_team(): dev, the leaders, the assistants, the controller and estimators) and the
--      job's project manager (gc_projects.project_manager_user_id). Building's door adds the job's
--      superintendent here and in the next function, and nowhere else.
--   2) public.gc_on_any_schedule_team() says who is on the team of any GC job, for the templates,
--      which belong to no job.
--   3) Two lookups give a child row its job: its activity's, or its move's.
--   4) The 23 tables swap their dev-only policy for the team, one policy each for every verb. A what-if
--      copy stays its own person's. The functions on them are SECURITY INVOKER, so this is their gate
--      too.
-- What stays: the append-only rows keep their missing UPDATE and DELETE privileges, which no policy
-- can open. anon has no grant on any of the 23. The trades and the customer read through their
-- portals' functions, never these tables. src/lib/gc/doors.ts lists each table's door; doors.test.ts
-- holds the migrations to it.

-- 1) Who is on one job's schedule.
CREATE OR REPLACE FUNCTION public.gc_on_schedule_team(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.gc_office_team()
    OR EXISTS (
      SELECT 1 FROM public.gc_projects g
      WHERE g.project_id = p_project_id AND g.project_manager_user_id = auth.uid()
    );
$$;

COMMENT ON FUNCTION public.gc_on_schedule_team(uuid) IS
  'GC mode (the schedule''s PR 10, v2.5114): who may read and write one GC job''s schedule (G-133): the GC office (gc_office_team()) and the job''s project manager. Building''s door adds the job''s superintendent here and in gc_on_any_schedule_team(). Change the audience here, never in a policy. The client''s copy is GC_SCHEDULE_TEAM in src/lib/gc/access.ts.';

-- 2) Who is on the team of any GC job: the templates.
CREATE OR REPLACE FUNCTION public.gc_on_any_schedule_team()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.gc_office_team()
    OR EXISTS (SELECT 1 FROM public.gc_projects g WHERE g.project_manager_user_id = auth.uid());
$$;

COMMENT ON FUNCTION public.gc_on_any_schedule_team() IS
  'GC mode (the schedule''s PR 10, v2.5114): who may read and write the schedule templates, which belong to no job: anyone gc_on_schedule_team() lets onto some GC job. Building''s door adds the superintendent here too.';

-- 3) A child row's job.
CREATE OR REPLACE FUNCTION public.gc_schedule_activity_project(p_activity_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT project_id FROM public.gc_schedule_activities WHERE id = p_activity_id;
$$;

COMMENT ON FUNCTION public.gc_schedule_activity_project(uuid) IS
  'GC mode (the schedule''s PR 10, v2.5114): the GC job a schedule activity is on, for the policies of the rows that hang from an activity (its parts, an inspection''s failures, a baseline''s dates, the look-ahead marks).';

CREATE OR REPLACE FUNCTION public.gc_schedule_move_project(p_move_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT project_id FROM public.gc_schedule_moves WHERE id = p_move_id;
$$;

COMMENT ON FUNCTION public.gc_schedule_move_project(uuid) IS
  'GC mode (the schedule''s PR 10, v2.5114): the GC job a schedule move is on, for the policies of the rows that hang from a move (its pushes, tells and answers).';

REVOKE EXECUTE ON FUNCTION public.gc_on_schedule_team(uuid), public.gc_on_any_schedule_team(),
  public.gc_schedule_activity_project(uuid), public.gc_schedule_move_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_on_schedule_team(uuid), public.gc_on_any_schedule_team(),
  public.gc_schedule_activity_project(uuid), public.gc_schedule_move_project(uuid) TO authenticated, service_role;

-- 4) The 23 tables: one policy each for every verb.
-- The fourteen that carry their job.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gc_schedules', 'gc_schedule_activities', 'gc_schedule_links', 'gc_schedule_milestones',
    'gc_schedule_baselines', 'gc_schedule_changes', 'gc_schedule_late_notices', 'gc_schedule_walks',
    'gc_schedule_moves', 'gc_schedule_waits', 'gc_schedule_wait_holds', 'gc_schedule_crew_counts',
    'gc_schedule_sends', 'gc_rough_schedules'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_dev', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_team', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.gc_on_schedule_team(project_id)) WITH CHECK (public.gc_on_schedule_team(project_id))',
      t || '_team', t);
  END LOOP;
END $$;

-- The four that reach their job through their activity.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gc_schedule_activity_parts', 'gc_schedule_inspection_failures', 'gc_schedule_baseline_dates',
    'gc_schedule_lookahead_marks'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_dev', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_team', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.gc_on_schedule_team(public.gc_schedule_activity_project(activity_id))) WITH CHECK (public.gc_on_schedule_team(public.gc_schedule_activity_project(activity_id)))',
      t || '_team', t);
  END LOOP;
END $$;

-- The three that reach it through their move.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gc_schedule_move_pushes', 'gc_schedule_move_tells', 'gc_schedule_move_answers'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_dev', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_team', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.gc_on_schedule_team(public.gc_schedule_move_project(move_id))) WITH CHECK (public.gc_on_schedule_team(public.gc_schedule_move_project(move_id)))',
      t || '_team', t);
  END LOOP;
END $$;

-- A what-if copy stays its own person's (decision 6).
DROP POLICY IF EXISTS gc_schedule_what_ifs_dev ON public.gc_schedule_what_ifs;
DROP POLICY IF EXISTS gc_schedule_what_ifs_team ON public.gc_schedule_what_ifs;
CREATE POLICY gc_schedule_what_ifs_team ON public.gc_schedule_what_ifs FOR ALL TO authenticated
  USING (public.gc_on_schedule_team(project_id) AND user_id = (SELECT auth.uid()))
  WITH CHECK (public.gc_on_schedule_team(project_id) AND user_id = (SELECT auth.uid()));

-- A template belongs to no job: anyone on the team of any GC job, asked once a statement.
DROP POLICY IF EXISTS gc_schedule_templates_dev ON public.gc_schedule_templates;
DROP POLICY IF EXISTS gc_schedule_templates_team ON public.gc_schedule_templates;
CREATE POLICY gc_schedule_templates_team ON public.gc_schedule_templates FOR ALL TO authenticated
  USING ((SELECT public.gc_on_any_schedule_team())) WITH CHECK ((SELECT public.gc_on_any_schedule_team()));
