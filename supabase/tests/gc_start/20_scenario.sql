-- Start and Start anyway (v2.5045, the Board's B6-c-i, migration 20261010061000): gc_start_project refuses in words
-- who may not start a job and a job that cannot start yet; Start moves a won job to building on the company's day;
-- Start anyway keeps who pressed it, why, and what was missing; and the schedule takes its baseline on that day.
-- Presses run as each user through RLS; the fixture is made as postgres; everything rolls back. Raises on the first
-- failed assertion; ends with "gc_start PASSED". See scripts/pgtest-gc-start.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- A dev, an estimator, a dev in training mode and a digital twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000008d1', 'dev@start.test'),
  ('00000000-0000-0000-0000-0000000008d2', 'estimator@start.test'),
  ('00000000-0000-0000-0000-0000000008d3', 'training@start.test'),
  ('00000000-0000-0000-0000-0000000008d4', 'twin@start.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000008d1', 'dev@start.test', 'Start Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000008d2', 'estimator@start.test', 'Start Estimator', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000008d3', 'training@start.test', 'Start Training', 'dev', true, false),
  ('00000000-0000-0000-0000-0000000008d4', 'twin@start.test', 'Start Twin', 'estimator', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- Three won jobs (one for Start, one for Start anyway, one for Start anyway with nothing missing), one still bidding,
-- one lost and one already started.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000008c1', 'Start Owner', '00000000-0000-0000-0000-0000000008d1');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000008a1', 'Start Won Clinic', '00000000-0000-0000-0000-0000000008c1'),
  ('00000000-0000-0000-0000-0000000008a2', 'Start Anyway Clinic', '00000000-0000-0000-0000-0000000008c1'),
  ('00000000-0000-0000-0000-0000000008a3', 'Start Quiet Clinic', '00000000-0000-0000-0000-0000000008c1'),
  ('00000000-0000-0000-0000-0000000008a4', 'Start Bidding Clinic', '00000000-0000-0000-0000-0000000008c1'),
  ('00000000-0000-0000-0000-0000000008a5', 'Start Lost Clinic', '00000000-0000-0000-0000-0000000008c1'),
  ('00000000-0000-0000-0000-0000000008a6', 'Start Building Clinic', '00000000-0000-0000-0000-0000000008c1');
INSERT INTO public.gc_projects (project_id, stage, lost_on, started_on) VALUES
  ('00000000-0000-0000-0000-0000000008a1', 'buyout', NULL, NULL),
  ('00000000-0000-0000-0000-0000000008a2', 'buyout', NULL, NULL),
  ('00000000-0000-0000-0000-0000000008a3', 'buyout', NULL, NULL),
  ('00000000-0000-0000-0000-0000000008a4', 'bidding', NULL, NULL),
  ('00000000-0000-0000-0000-0000000008a5', 'bidding', DATE '2026-10-01', NULL),
  ('00000000-0000-0000-0000-0000000008a6', 'building', NULL, DATE '2026-10-01');

CREATE SCHEMA gst;
CREATE FUNCTION gst.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with exactly these words; its writes go with the refusal (a subtransaction).
CREATE FUNCTION gst.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM IS DISTINCT FROM want THEN RAISE EXCEPTION E'% was refused with other words.\n--- got ---\n%\n--- want ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION gst.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
GRANT USAGE ON SCHEMA gst TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gst TO authenticated;

-- 0 · Who may start: no sign-in, a training account, a digital twin and an estimator are refused in words, before any write.
SET LOCAL ROLE authenticated;
SELECT gst.refused('no sign-in starts nothing', $q$SELECT public.gc_start_project('00000000-0000-0000-0000-0000000008a1')$q$, 'Sign in first.');
RESET ROLE;
SELECT gst.as_user('00000000-0000-0000-0000-0000000008d3');
SET LOCAL ROLE authenticated;
SELECT gst.refused('a training account starts nothing', $q$SELECT public.gc_start_project('00000000-0000-0000-0000-0000000008a1')$q$, 'A training account cannot start a job.');
RESET ROLE;
SELECT gst.as_user('00000000-0000-0000-0000-0000000008d4');
SET LOCAL ROLE authenticated;
SELECT gst.refused('a digital twin starts nothing', $q$SELECT public.gc_start_project('00000000-0000-0000-0000-0000000008a1')$q$, 'A digital twin cannot start a job.');
RESET ROLE;
SELECT gst.as_user('00000000-0000-0000-0000-0000000008d2');
SET LOCAL ROLE authenticated;
SELECT gst.refused('an estimator starts nothing', $q$SELECT public.gc_start_project('00000000-0000-0000-0000-0000000008a1')$q$, 'Only a dev starts a job while GC mode is built.');
RESET ROLE;
SELECT gst.same('no won job is started yet', (
  SELECT count(*)::text FROM public.gc_projects
  WHERE project_id IN ('00000000-0000-0000-0000-0000000008a1', '00000000-0000-0000-0000-0000000008a2', '00000000-0000-0000-0000-0000000008a3')
    AND (started_on IS NOT NULL OR stage <> 'buyout')), '0');

-- 1 · As a dev: a job that is not there, a lost one, one still bidding and one already started, each in words.
SELECT gst.as_user('00000000-0000-0000-0000-0000000008d1');
SET LOCAL ROLE authenticated;
SELECT gst.refused('a job that is not there', $q$SELECT public.gc_start_project('00000000-0000-0000-0000-0000000008a9')$q$, 'That GC project is not there.');
SELECT gst.refused('a lost job', $q$SELECT public.gc_start_project('00000000-0000-0000-0000-0000000008a5')$q$, 'Start Lost Clinic is lost. Bring it back before you start it.');
SELECT gst.refused('a job still bidding', $q$SELECT public.gc_start_project('00000000-0000-0000-0000-0000000008a4')$q$, 'Start Bidding Clinic is still bidding. Press We won this first.');
SELECT gst.refused('a job already started', $q$SELECT public.gc_start_project('00000000-0000-0000-0000-0000000008a6')$q$, 'Start Building Clinic is already started.');

-- 2 · Start: the company's day back, the job building, no Start anyway kept; a second Start is refused.
SELECT gst.same('Start gives back the company''s day', (SELECT (public.gc_start_project('00000000-0000-0000-0000-0000000008a1') = public.app_today())::text), 'true');
SELECT gst.refused('a second Start', $q$SELECT public.gc_start_project('00000000-0000-0000-0000-0000000008a1')$q$, 'Start Won Clinic is already started.');
RESET ROLE;
SELECT gst.same('the job is building from today, with no Start anyway', (
  SELECT stage || ' ' || (started_on = public.app_today()) || ' ' || coalesce(started_anyway_by::text, 'nobody') || ' '
      || coalesce(started_anyway_reason, 'no reason') || ' ' || coalesce(array_to_string(started_anyway_missing, ','), 'nothing owed')
  FROM public.gc_projects WHERE project_id = '00000000-0000-0000-0000-0000000008a1'),
  'building true nobody no reason nothing owed');

-- 3 · Start anyway: its refusals in words; then who pressed it, the reason trimmed, and the lines in order with blanks dropped.
SET LOCAL ROLE authenticated;
SELECT gst.refused('Start anyway with no reason', $q$SELECT public.gc_start_project('00000000-0000-0000-0000-0000000008a2', '{"reason": "  ", "missing": ["Concrete: Send the master agreement."]}')$q$,
  'Say why it starts before everything is in.');
SELECT gst.refused('a reason over 500 characters', $q$SELECT public.gc_start_project('00000000-0000-0000-0000-0000000008a2', jsonb_build_object('reason', repeat('x', 501), 'missing', jsonb_build_array('Concrete: Send the master agreement.')))$q$,
  'Say why in 500 characters or fewer.');
SELECT gst.refused('a list over 60 lines', $q$SELECT public.gc_start_project('00000000-0000-0000-0000-0000000008a2', jsonb_build_object('reason', 'The slab before the rain.', 'missing', (SELECT jsonb_agg('Line ' || n) FROM generate_series(1, 61) AS n)))$q$,
  'That list of what is missing is too long.');
SELECT gst.refused('a line over 300 characters', $q$SELECT public.gc_start_project('00000000-0000-0000-0000-0000000008a2', jsonb_build_object('reason', 'The slab before the rain.', 'missing', jsonb_build_array(repeat('x', 301))))$q$,
  'That list of what is missing is too long.');
SELECT gst.refused('a list that is not a list', $q$SELECT public.gc_start_project('00000000-0000-0000-0000-0000000008a2', '{"reason": "The slab before the rain.", "missing": "Concrete"}')$q$,
  'Start anyway needs why and what is missing.');
SELECT gst.refused('an anyway that is not an object', $q$SELECT public.gc_start_project('00000000-0000-0000-0000-0000000008a2', '["The slab before the rain."]')$q$,
  'Start anyway needs why and what is missing.');
SELECT public.gc_start_project('00000000-0000-0000-0000-0000000008a2',
  '{"reason": "  The slab before the rain.  ", "missing": ["Concrete: Send the master agreement.", "  ", "The permit is in hand: not yet."]}') = public.app_today() AS started_anyway;
RESET ROLE;
SELECT gst.same('Start anyway keeps who, why and what was missing', (
  SELECT stage || ' | ' || (started_on = public.app_today()) || ' | ' || (started_anyway_by = '00000000-0000-0000-0000-0000000008d1') || ' | '
      || started_anyway_reason || ' | ' || array_to_string(started_anyway_missing, ' / ')
  FROM public.gc_projects WHERE project_id = '00000000-0000-0000-0000-0000000008a2'),
  'building | true | true | The slab before the rain. | Concrete: Send the master agreement. / The permit is in hand: not yet.');

-- 4 · Start anyway with nothing missing is a plain Start, as the prototype's reducer has it.
SET LOCAL ROLE authenticated;
SELECT public.gc_start_project('00000000-0000-0000-0000-0000000008a3', '{"reason": "Nothing is missing.", "missing": ["  "]}') = public.app_today() AS started_plain;
RESET ROLE;
SELECT gst.same('nothing missing keeps no Start anyway', (
  SELECT stage || ' ' || coalesce(started_anyway_by::text, 'nobody') || ' ' || coalesce(started_anyway_reason, 'no reason') || ' ' || coalesce(array_to_string(started_anyway_missing, ','), 'nothing owed')
  FROM public.gc_projects WHERE project_id = '00000000-0000-0000-0000-0000000008a3'),
  'building nobody no reason nothing owed');

-- 5 · The seam with the schedule: its first plan write after Start keeps the baseline, dated the day Start kept. The
-- write opens as every press opens one (gc_schedule_bump, then gc_schedule_keep_start, then the flag cleared).
SET LOCAL ROLE authenticated;
SELECT public.gc_schedule_bump('00000000-0000-0000-0000-0000000008a1', NULL, 'The first bars after Start.') AS version;
SELECT public.gc_schedule_keep_start('00000000-0000-0000-0000-0000000008a1');
SELECT set_config('gc.schedule_plan_write', '', true);
RESET ROLE;
SELECT gst.same('the baseline is dated the day of Start', (
  SELECT count(*) || ' ' || bool_and(locked_on = public.app_today()) FROM public.gc_schedule_baselines WHERE project_id = '00000000-0000-0000-0000-0000000008a1'), '1 true');

-- 6 · Who may run it: anon may not; a signed-in user may ask, and the function decides.
SELECT gst.same('anon may not run it, a signed-in user may ask', (
  SELECT has_function_privilege('anon', 'public.gc_start_project(uuid, jsonb)', 'EXECUTE') || ' '
      || has_function_privilege('authenticated', 'public.gc_start_project(uuid, jsonb)', 'EXECUTE')), 'false true');

DO $$ BEGIN RAISE NOTICE 'gc_start PASSED'; END $$;
ROLLBACK;
