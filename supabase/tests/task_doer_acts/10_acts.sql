-- Task Mode tools, the ground (punch list #369 step C1, migration *_task_doer_acts): what the person doing a task may
-- do with it. Six new kinds of line in a task's thread, a stuck line anyone who reads the task may write, and four
-- narrow functions: task_move_day, task_no_longer_applies, task_hand_on, task_add_map.
-- Fixtures are written as postgres; the tries run as each account under RLS; everything rolls back. Raises on the
-- first failed assertion; ends with "task_doer_acts PASSED". See scripts/pgtest-task-doer-acts.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dee is a dev, and gave every task here. Hank is a helper and the person doing them. Hal is a helper who can take
-- one. Tess is in training, Twyla is a twin and Ava has left: each is on the first task and may do nothing with it.
-- Zed is a helper on no task. Nora is a worker with no login, who cannot take a task in the app.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000369a001', 'dee@taskacts.test'),
  ('00000000-0000-0000-0000-00000369a002', 'hank@taskacts.test'),
  ('00000000-0000-0000-0000-00000369a003', 'hal@taskacts.test'),
  ('00000000-0000-0000-0000-00000369a004', 'tess@taskacts.test'),
  ('00000000-0000-0000-0000-00000369a005', 'twyla@taskacts.test'),
  ('00000000-0000-0000-0000-00000369a006', 'ava@taskacts.test'),
  ('00000000-0000-0000-0000-00000369a007', 'zed@taskacts.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at, login_attached_at) VALUES
  ('00000000-0000-0000-0000-00000369a001', 'dee@taskacts.test', 'Dee Dev', 'dev', false, false, NULL, now()),
  ('00000000-0000-0000-0000-00000369a002', 'hank@taskacts.test', 'Hank Helper', 'helpers', false, false, NULL, now()),
  ('00000000-0000-0000-0000-00000369a003', 'hal@taskacts.test', 'Hal Helper', 'helpers', false, false, NULL, now()),
  ('00000000-0000-0000-0000-00000369a004', 'tess@taskacts.test', 'Tess Training', 'helpers', true, false, NULL, now()),
  ('00000000-0000-0000-0000-00000369a005', 'twyla@taskacts.test', 'Twyla Twin', 'helpers', false, true, NULL, now()),
  ('00000000-0000-0000-0000-00000369a006', 'ava@taskacts.test', 'Ava Away', 'helpers', false, false, '2026-11-04 15:00+00', now()),
  ('00000000-0000-0000-0000-00000369a007', 'zed@taskacts.test', 'Zed Helper', 'helpers', false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at, login_attached_at = EXCLUDED.login_attached_at;
INSERT INTO public.users (id, name, role) VALUES ('00000000-0000-0000-0000-00000369a008', 'Nora Nologin', 'helpers');

CREATE SCHEMA tda;
GRANT USAGE ON SCHEMA tda TO authenticated;
-- A day counted from today in the company's calendar, the calendar the functions read.
CREATE FUNCTION tda.day(n integer) RETURNS date LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'America/Chicago')::date + n $$;
CREATE FUNCTION tda.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- The claims PostgREST would set for a signed-in account, for the rest of the transaction.
CREATE FUNCTION tda.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What a statement does as the caller: 'ok', or the sqlstate it raised.
CREATE FUNCTION tda.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
-- The words a refusal says, for the screen shows them.
CREATE FUNCTION tda.says(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
-- A value read past RLS, to see what a write left behind whoever is signed in.
CREATE FUNCTION tda.past(q text) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text; BEGIN EXECUTE q INTO v; RETURN v; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tda TO authenticated;

-- The tasks, all Dee's, each with one day row a month old.
--   d001 a one-time task for Hank, with Tess, Twyla and Ava on it too.   d002 a task that repeats.
--   d003 a roadmap task.   d004 a vehicle task.   d005 a one-time task already done.
--   d006 a one-time task to hand on.   d007 a one-time task to close.   d008 a one-time task for a map.
INSERT INTO public.checklist_tech_tree_roadmaps (id, title, created_by_user_id) VALUES
  ('00000000-0000-0000-0000-000003690001', 'Task acts bed roadmap', '00000000-0000-0000-0000-00000369a001');
INSERT INTO public.checklist_tech_tree_groups (id, title, created_by_user_id, roadmap_id) VALUES
  ('00000000-0000-0000-0000-000003690002', 'Task acts bed stage', '00000000-0000-0000-0000-00000369a001', '00000000-0000-0000-0000-000003690001');
INSERT INTO public.checklist_tech_tree_group_tasks (id, group_id, title) VALUES
  ('00000000-0000-0000-0000-000003690003', '00000000-0000-0000-0000-000003690002', 'Trench to the meter');
INSERT INTO public.checklist_items (id, title, created_by_user_id, repeat_type, start_date, roadmap_group_task_id) VALUES
  ('00000000-0000-0000-0000-00000369d001', 'Give every tool a home', '00000000-0000-0000-0000-00000369a001', 'once', tda.day(-30), NULL),
  ('00000000-0000-0000-0000-00000369d002', 'Feed the chickens', '00000000-0000-0000-0000-00000369a001', 'day_of_week', tda.day(-30), NULL),
  ('00000000-0000-0000-0000-00000369d003', 'Trench to the meter', '00000000-0000-0000-0000-00000369a001', 'once', tda.day(-30), '00000000-0000-0000-0000-000003690003'),
  ('00000000-0000-0000-0000-00000369d004', 'Change the truck oil', '00000000-0000-0000-0000-00000369a001', 'once', tda.day(-30), NULL),
  ('00000000-0000-0000-0000-00000369d005', 'Sweep the bays', '00000000-0000-0000-0000-00000369a001', 'once', tda.day(-30), NULL),
  ('00000000-0000-0000-0000-00000369d006', 'Sort the fittings wall', '00000000-0000-0000-0000-00000369a001', 'once', tda.day(-30), NULL),
  ('00000000-0000-0000-0000-00000369d007', 'Set a marker at every mile', '00000000-0000-0000-0000-00000369a001', 'once', tda.day(-30), NULL),
  ('00000000-0000-0000-0000-00000369d008', 'Find the shut-off valve', '00000000-0000-0000-0000-00000369a001', 'once', tda.day(-30), NULL);
INSERT INTO public.checklist_item_assignees (checklist_item_id, user_id)
  SELECT i.id, '00000000-0000-0000-0000-00000369a002'::uuid FROM public.checklist_items i WHERE i.created_by_user_id = '00000000-0000-0000-0000-00000369a001' AND i.title <> 'Trench to the meter';
INSERT INTO public.checklist_instances (id, checklist_item_id, scheduled_date) VALUES
  ('00000000-0000-0000-0000-00000369e001', '00000000-0000-0000-0000-00000369d001', tda.day(-30)),
  ('00000000-0000-0000-0000-00000369e002', '00000000-0000-0000-0000-00000369d002', tda.day(-1)),
  ('00000000-0000-0000-0000-00000369e003', '00000000-0000-0000-0000-00000369d003', tda.day(-30)),
  ('00000000-0000-0000-0000-00000369e004', '00000000-0000-0000-0000-00000369d004', tda.day(-30)),
  ('00000000-0000-0000-0000-00000369e005', '00000000-0000-0000-0000-00000369d005', tda.day(-30)),
  ('00000000-0000-0000-0000-00000369e006', '00000000-0000-0000-0000-00000369d006', tda.day(-30)),
  ('00000000-0000-0000-0000-00000369e007', '00000000-0000-0000-0000-00000369d007', tda.day(-30)),
  ('00000000-0000-0000-0000-00000369e008', '00000000-0000-0000-0000-00000369d008', tda.day(-30));
INSERT INTO public.checklist_instance_assignees (checklist_instance_id, user_id)
  SELECT i.id, '00000000-0000-0000-0000-00000369a002'::uuid FROM public.checklist_instances i
  WHERE i.id::text LIKE '00000000-0000-0000-0000-00000369e%';
INSERT INTO public.checklist_instance_assignees (checklist_instance_id, user_id) VALUES
  ('00000000-0000-0000-0000-00000369e001', '00000000-0000-0000-0000-00000369a004'),
  ('00000000-0000-0000-0000-00000369e001', '00000000-0000-0000-0000-00000369a005'),
  ('00000000-0000-0000-0000-00000369e001', '00000000-0000-0000-0000-00000369a006');
UPDATE public.checklist_instances SET completed_at = now(), completed_by_user_id = '00000000-0000-0000-0000-00000369a002'
  WHERE id = '00000000-0000-0000-0000-00000369e005';
INSERT INTO public.vehicles (id, make, model) VALUES ('00000000-0000-0000-0000-00000369f001', 'Bed', 'Truck');
INSERT INTO public.vehicle_maintenance_tasks (vehicle_id, title, checklist_item_id, checklist_instance_id) VALUES
  ('00000000-0000-0000-0000-00000369f001', 'Change the truck oil', '00000000-0000-0000-0000-00000369d004', '00000000-0000-0000-0000-00000369e004');
-- Three maps on nothing: Hank's with a line, Hank's with nothing on it, and Dee's with a line.
INSERT INTO public.painted_maps (id, name, job_id, created_by) VALUES
  ('00000000-0000-0000-0000-00000369c001', 'Shut-off run', NULL, '00000000-0000-0000-0000-00000369a002'),
  ('00000000-0000-0000-0000-00000369c002', 'Hank empty', NULL, '00000000-0000-0000-0000-00000369a002'),
  ('00000000-0000-0000-0000-00000369c003', 'Dee own', NULL, '00000000-0000-0000-0000-00000369a001');
INSERT INTO public.painted_map_lines (map_id, how, points, length_m, made_by) VALUES
  ('00000000-0000-0000-0000-00000369c001', 'drawn', '[[29.5,-98.2],[29.501,-98.201]]', 147.5, '00000000-0000-0000-0000-00000369a002'),
  ('00000000-0000-0000-0000-00000369c003', 'drawn', '[[29.5,-98.2],[29.501,-98.201]]', 147.5, '00000000-0000-0000-0000-00000369a001');

-- The structure.
SELECT tda.same('the thread holds its twelve kinds', (
  SELECT string_agg(k, ' ' ORDER BY k) FROM unnest(ARRAY['accepted', 'comment', 'completed', 'criterion', 'dropped', 'handed', 'map', 'moved', 'progress', 'reopened', 'stuck', 'unstuck']) k
  WHERE pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = 'checklist_instance_events_event_type_check')) LIKE '%''' || k || '''%'
), 'accepted comment completed criterion dropped handed map moved progress reopened stuck unstuck');
SELECT tda.same('one check holds the kinds', (
  SELECT count(*)::text FROM pg_constraint
  WHERE conrelid = 'public.checklist_instance_events'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%event_type%'
), '1');
SELECT tda.same('the four acts are for a signed-in account and closed to anon', (
  SELECT string_agg(p.proname || ' ' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || ' ' || has_function_privilege('anon', p.oid, 'EXECUTE')::text, ', ' ORDER BY p.proname)
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('task_move_day', 'task_no_longer_applies', 'task_hand_on', 'task_add_map')
), 'task_add_map true false, task_hand_on true false, task_move_day true false, task_no_longer_applies true false');
SELECT tda.same('the gate is called only from inside them', (
  has_function_privilege('authenticated', 'public.task_doer_may(uuid, text)', 'EXECUTE')::text || ' ' || has_function_privilege('anon', 'public.task_doer_may(uuid, text)', 'EXECUTE')::text
), 'false false');
SELECT tda.same('all five run as their owner', (
  SELECT string_agg(proname || ' ' || prosecdef::text, ', ' ORDER BY proname) FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace AND proname IN ('task_doer_may', 'task_move_day', 'task_no_longer_applies', 'task_hand_on', 'task_add_map')
), 'task_add_map true, task_doer_may true, task_hand_on true, task_move_day true, task_no_longer_applies true');

SET LOCAL ROLE authenticated;

-- A stuck line is a person's own words, like a note. The lines the functions write are not theirs to write by hand.
SELECT tda.sign_in('00000000-0000-0000-0000-00000369a002');
SELECT tda.same('Hank says he is stuck on his task', tda.try($q$
  INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body) VALUES ('00000000-0000-0000-0000-00000369e001', 'stuck', '00000000-0000-0000-0000-00000369a002', 'Waiting on a part')
$q$), 'ok');
SELECT tda.same('and that he is not, later', tda.try($q$
  INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body) VALUES ('00000000-0000-0000-0000-00000369e001', 'unstuck', '00000000-0000-0000-0000-00000369a002', '')
$q$), 'ok');
SELECT tda.same('he cannot say it as Dee', tda.try($q$
  INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body) VALUES ('00000000-0000-0000-0000-00000369e001', 'stuck', '00000000-0000-0000-0000-00000369a001', 'x')
$q$), '42501');
SELECT tda.same('or write a dropped line by hand', tda.try($q$
  INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body) VALUES ('00000000-0000-0000-0000-00000369e001', 'dropped', '00000000-0000-0000-0000-00000369a002', 'x')
$q$), '42501');
SELECT tda.same('or a moved one', tda.try($q$
  INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body) VALUES ('00000000-0000-0000-0000-00000369e001', 'moved', '00000000-0000-0000-0000-00000369a002', '2026-12-01')
$q$), '42501');
SELECT tda.same('a kind nobody knows is refused by the check', tda.past($q$
  SELECT (SELECT count(*) FROM pg_constraint WHERE conname = 'checklist_instance_events_event_type_check' AND pg_get_constraintdef(oid) LIKE '%snoozed%')::text
$q$), '0');

-- Not today: Hank moves his one-time task's due day.
SELECT tda.same('Hank moves his task three days on', tda.try($q$ SELECT public.task_move_day('00000000-0000-0000-0000-00000369e001', tda.day(3)) $q$), 'ok');
SELECT tda.same('the task is due that day', tda.past($q$ SELECT (due_date = tda.day(3))::text FROM public.checklist_items WHERE id = '00000000-0000-0000-0000-00000369d001' $q$), 'true');
SELECT tda.same('the day row did not move', tda.past($q$ SELECT (scheduled_date = tda.day(-30))::text FROM public.checklist_instances WHERE id = '00000000-0000-0000-0000-00000369e001' $q$), 'true');
SELECT tda.same('the change is logged with who', tda.past($q$
  SELECT count(*)::text || ' ' || bool_and(changed_by = '00000000-0000-0000-0000-00000369a002' AND from_due IS NULL AND to_due = tda.day(3))::text
  FROM public.checklist_item_due_changes WHERE checklist_item_id = '00000000-0000-0000-0000-00000369d001'
$q$), '1 true');
SELECT tda.same('and the thread has a moved line with the day', tda.past($q$
  SELECT (body = to_char(tda.day(3), 'YYYY-MM-DD'))::text || ' ' || (actor_user_id = '00000000-0000-0000-0000-00000369a002')::text
  FROM public.checklist_instance_events WHERE instance_id = '00000000-0000-0000-0000-00000369e001' AND event_type = 'moved'
$q$), 'true true');
SELECT tda.same('the same day again is refused', tda.try($q$ SELECT public.task_move_day('00000000-0000-0000-0000-00000369e001', tda.day(3)) $q$), '23505');
SELECT tda.same('a day gone by is refused', tda.says($q$ SELECT public.task_move_day('00000000-0000-0000-0000-00000369e001', tda.day(-1)) $q$), 'Pick today or a later day.');
SELECT tda.same('today is allowed', tda.try($q$ SELECT public.task_move_day('00000000-0000-0000-0000-00000369e001', tda.day(0)) $q$), 'ok');
SELECT tda.same('a day past a year is refused', tda.says($q$ SELECT public.task_move_day('00000000-0000-0000-0000-00000369e001', tda.day(400)) $q$), 'Pick a day within a year.');
SELECT tda.same('no day is refused', tda.says($q$ SELECT public.task_move_day('00000000-0000-0000-0000-00000369e001', NULL) $q$), 'Pick a day.');
SELECT tda.same('a task that repeats is not moved', tda.says($q$ SELECT public.task_move_day('00000000-0000-0000-0000-00000369e002', tda.day(3)) $q$), 'Only a one-time task can be moved to another day.');
SELECT tda.same('a task already done is not moved', tda.try($q$ SELECT public.task_move_day('00000000-0000-0000-0000-00000369e005', tda.day(3)) $q$), '23505');
SELECT tda.same('a roadmap task may be moved, since only its due day changes', tda.try($q$ SELECT public.task_move_day('00000000-0000-0000-0000-00000369e003', tda.day(5)) $q$), 'ok');
SELECT tda.same('a task that is gone says so', tda.try($q$ SELECT public.task_move_day('00000000-0000-0000-0000-00000369eeee', tda.day(3)) $q$), '42501');

-- Who may not: training, a twin, someone who left, and someone the task is not given to.
SELECT tda.sign_in('00000000-0000-0000-0000-00000369a004');
SELECT tda.same('Tess, in training, moves nothing', tda.says($q$ SELECT public.task_move_day('00000000-0000-0000-0000-00000369e001', tda.day(4)) $q$), 'A training account cannot move this task.');
SELECT tda.sign_in('00000000-0000-0000-0000-00000369a005');
SELECT tda.same('Twyla, a twin, moves nothing', tda.says($q$ SELECT public.task_move_day('00000000-0000-0000-0000-00000369e001', tda.day(4)) $q$), 'A digital twin cannot move this task.');
SELECT tda.sign_in('00000000-0000-0000-0000-00000369a006');
SELECT tda.same('Ava, who left, moves nothing', tda.says($q$ SELECT public.task_move_day('00000000-0000-0000-0000-00000369e001', tda.day(4)) $q$), 'An archived account cannot move this task.');
SELECT tda.sign_in('00000000-0000-0000-0000-00000369a007');
SELECT tda.same('Zed, not on the task, moves nothing', tda.says($q$ SELECT public.task_move_day('00000000-0000-0000-0000-00000369e001', tda.day(4)) $q$), 'Only the office or a person the task is given to can move this task.');
SELECT tda.same('nor closes it', tda.try($q$ SELECT public.task_no_longer_applies('00000000-0000-0000-0000-00000369e007', 'Not needed') $q$), '42501');
SELECT tda.same('nor hands it on', tda.try($q$ SELECT public.task_hand_on('00000000-0000-0000-0000-00000369e006', '00000000-0000-0000-0000-00000369a003') $q$), '42501');
SELECT tda.same('nor puts a map on it', tda.try($q$ SELECT public.task_add_map('00000000-0000-0000-0000-00000369e008', '00000000-0000-0000-0000-00000369c001') $q$), '42501');

-- No longer applies: Hank closes a one-time task without doing it.
SELECT tda.sign_in('00000000-0000-0000-0000-00000369a002');
SELECT tda.same('with no reason it is refused', tda.says($q$ SELECT public.task_no_longer_applies('00000000-0000-0000-0000-00000369e007', '  ') $q$), 'Say why in a few words.');
SELECT tda.same('a task that repeats is not closed this way', tda.try($q$ SELECT public.task_no_longer_applies('00000000-0000-0000-0000-00000369e002', 'Not needed') $q$), '22023');
SELECT tda.same('nor a roadmap task, whose completion would mark the roadmap done', tda.says($q$ SELECT public.task_no_longer_applies('00000000-0000-0000-0000-00000369e003', 'Not needed') $q$), 'This task belongs to a roadmap, and its lead takes it off there. Say why in a note.');
SELECT tda.same('nor a vehicle task, whose completion would mark the service done', tda.says($q$ SELECT public.task_no_longer_applies('00000000-0000-0000-0000-00000369e004', 'Not needed') $q$), 'This is a vehicle task, and the office closes it. Say why in a note.');
SELECT tda.same('nor a task already done', tda.try($q$ SELECT public.task_no_longer_applies('00000000-0000-0000-0000-00000369e005', 'Not needed') $q$), '23505');
SELECT tda.same('the roadmap task is still open', tda.past($q$ SELECT (completed_at IS NULL)::text FROM public.checklist_tech_tree_group_tasks WHERE id = '00000000-0000-0000-0000-000003690003' $q$), 'true');
SELECT tda.same('the vehicle task is still open', tda.past($q$ SELECT (completed_at IS NULL)::text FROM public.vehicle_maintenance_tasks WHERE checklist_instance_id = '00000000-0000-0000-0000-00000369e004' $q$), 'true');
SELECT tda.same('Hank closes the mile markers, with why', tda.try($q$ SELECT public.task_no_longer_applies('00000000-0000-0000-0000-00000369e007', '  Plans   changed  ') $q$), 'ok');
SELECT tda.same('the day row is closed, by Hank, at 100', tda.past($q$
  SELECT (completed_at IS NOT NULL)::text || ' ' || (completed_by_user_id = '00000000-0000-0000-0000-00000369a002')::text || ' ' || percent_complete::text
  FROM public.checklist_instances WHERE id = '00000000-0000-0000-0000-00000369e007'
$q$), 'true true 100');
SELECT tda.same('the thread reads completed, then dropped with the reason tidied', tda.past($q$
  SELECT string_agg(event_type || CASE WHEN event_type = 'dropped' THEN ':' || body ELSE '' END, ' > ' ORDER BY created_at, (event_type = 'dropped'))
  FROM public.checklist_instance_events WHERE instance_id = '00000000-0000-0000-0000-00000369e007'
$q$), 'completed > dropped:Plans changed');
SELECT tda.same('a second close is refused', tda.try($q$ SELECT public.task_no_longer_applies('00000000-0000-0000-0000-00000369e007', 'Again') $q$), '23505');

-- Hand it on: one person for another on the same task.
SELECT tda.same('to himself is refused', tda.says($q$ SELECT public.task_hand_on('00000000-0000-0000-0000-00000369e006', '00000000-0000-0000-0000-00000369a002') $q$), 'Pick someone else to take it.');
SELECT tda.same('to a worker with no login is refused', tda.says($q$ SELECT public.task_hand_on('00000000-0000-0000-0000-00000369e006', '00000000-0000-0000-0000-00000369a008') $q$), 'That person cannot take a task in the app.');
SELECT tda.same('to someone who left is refused', tda.try($q$ SELECT public.task_hand_on('00000000-0000-0000-0000-00000369e006', '00000000-0000-0000-0000-00000369a006') $q$), '22023');
SELECT tda.same('to a twin is refused', tda.try($q$ SELECT public.task_hand_on('00000000-0000-0000-0000-00000369e006', '00000000-0000-0000-0000-00000369a005') $q$), '22023');
SELECT tda.same('Hank cannot hand on a task for Hal', tda.says($q$ SELECT public.task_hand_on('00000000-0000-0000-0000-00000369e006', '00000000-0000-0000-0000-00000369a007', NULL, '00000000-0000-0000-0000-00000369a003') $q$), 'Only the office hands on a task for someone else.');
SELECT tda.same('a roadmap task is handed on from the Roadmap', tda.try($q$ SELECT public.task_hand_on('00000000-0000-0000-0000-00000369e003', '00000000-0000-0000-0000-00000369a003') $q$), '22023');
SELECT tda.same('a task already done is not handed on', tda.try($q$ SELECT public.task_hand_on('00000000-0000-0000-0000-00000369e005', '00000000-0000-0000-0000-00000369a003') $q$), '23505');
SELECT tda.same('Hank hands the fittings wall to Hal, with why', tda.try($q$ SELECT public.task_hand_on('00000000-0000-0000-0000-00000369e006', '00000000-0000-0000-0000-00000369a003', 'Wrong crew') $q$), 'ok');
SELECT tda.same('the day row is Hal''s alone', tda.past($q$
  SELECT string_agg(u.name, ', ' ORDER BY u.name) FROM public.checklist_instance_assignees a JOIN public.users u ON u.id = a.user_id WHERE a.checklist_instance_id = '00000000-0000-0000-0000-00000369e006'
$q$), 'Hal Helper');
SELECT tda.same('and so is the task, since it is a one-time task', tda.past($q$
  SELECT string_agg(u.name, ', ' ORDER BY u.name) FROM public.checklist_item_assignees a JOIN public.users u ON u.id = a.user_id WHERE a.checklist_item_id = '00000000-0000-0000-0000-00000369d006'
$q$), 'Hal Helper');
SELECT tda.same('the thread says who to and why', tda.past($q$
  SELECT body FROM public.checklist_instance_events WHERE instance_id = '00000000-0000-0000-0000-00000369e006' AND event_type = 'handed'
$q$), 'Hal Helper: Wrong crew');
SELECT tda.same('Hank no longer has it to move', tda.try($q$ SELECT public.task_move_day('00000000-0000-0000-0000-00000369e006', tda.day(2)) $q$), '42501');
SELECT tda.same('Hank hands today''s chickens to Hal', tda.try($q$ SELECT public.task_hand_on('00000000-0000-0000-0000-00000369e002', '00000000-0000-0000-0000-00000369a003') $q$), 'ok');
SELECT tda.same('that day row is Hal''s', tda.past($q$
  SELECT string_agg(u.name, ', ' ORDER BY u.name) FROM public.checklist_instance_assignees a JOIN public.users u ON u.id = a.user_id WHERE a.checklist_instance_id = '00000000-0000-0000-0000-00000369e002'
$q$), 'Hal Helper');
SELECT tda.same('and the repeating task is still Hank''s', tda.past($q$
  SELECT string_agg(u.name, ', ' ORDER BY u.name) FROM public.checklist_item_assignees a JOIN public.users u ON u.id = a.user_id WHERE a.checklist_item_id = '00000000-0000-0000-0000-00000369d002'
$q$), 'Hank Helper');
-- The office hands on for someone else, which is what FWD becomes.
SELECT tda.sign_in('00000000-0000-0000-0000-00000369a001');
SELECT tda.same('Dee hands Hal''s task back to Hank', tda.try($q$ SELECT public.task_hand_on('00000000-0000-0000-0000-00000369e006', '00000000-0000-0000-0000-00000369a002', NULL, '00000000-0000-0000-0000-00000369a003') $q$), 'ok');
SELECT tda.same('it is Hank''s again, whole', tda.past($q$
  SELECT (SELECT string_agg(u.name, ', ' ORDER BY u.name) FROM public.checklist_instance_assignees a JOIN public.users u ON u.id = a.user_id WHERE a.checklist_instance_id = '00000000-0000-0000-0000-00000369e006')
    || ' / ' || (SELECT string_agg(u.name, ', ' ORDER BY u.name) FROM public.checklist_item_assignees a JOIN public.users u ON u.id = a.user_id WHERE a.checklist_item_id = '00000000-0000-0000-0000-00000369d006')
$q$), 'Hank Helper / Hank Helper');
SELECT tda.same('Dee cannot hand on for someone who does not have it', tda.says($q$ SELECT public.task_hand_on('00000000-0000-0000-0000-00000369e006', '00000000-0000-0000-0000-00000369a003', NULL, '00000000-0000-0000-0000-00000369a007') $q$), 'That person does not have this task.');

-- A map from the person doing the task, on a task that has none.
SELECT tda.sign_in('00000000-0000-0000-0000-00000369a002');
SELECT tda.same('a map Hank did not paint is refused', tda.says($q$ SELECT public.task_add_map('00000000-0000-0000-0000-00000369e008', '00000000-0000-0000-0000-00000369c003') $q$), 'That map is not one you painted.');
SELECT tda.same('a map that is not there is refused', tda.try($q$ SELECT public.task_add_map('00000000-0000-0000-0000-00000369e008', '00000000-0000-0000-0000-00000369cccc') $q$), '42501');
SELECT tda.same('a map with nothing on it is refused', tda.says($q$ SELECT public.task_add_map('00000000-0000-0000-0000-00000369e008', '00000000-0000-0000-0000-00000369c002') $q$), 'Draw a line or leave a place on the map first.');
SELECT tda.same('Hank puts his map on the valve task', tda.try($q$ SELECT public.task_add_map('00000000-0000-0000-0000-00000369e008', '00000000-0000-0000-0000-00000369c001') $q$), 'ok');
SELECT tda.same('the task carries it', tda.past($q$ SELECT painted_map_id::text FROM public.checklist_items WHERE id = '00000000-0000-0000-0000-00000369d008' $q$), '00000000-0000-0000-0000-00000369c001');
SELECT tda.same('the thread names the map', tda.past($q$
  SELECT body FROM public.checklist_instance_events WHERE instance_id = '00000000-0000-0000-0000-00000369e008' AND event_type = 'map'
$q$), 'Shut-off run');
SELECT tda.same('a task that has a map takes no second one', tda.says($q$ SELECT public.task_add_map('00000000-0000-0000-0000-00000369e008', '00000000-0000-0000-0000-00000369c001') $q$), 'This task already has a map. Open it and add to it.');
SELECT tda.same('on a roadmap task the map lands on the roadmap task', tda.try($q$ SELECT public.task_add_map('00000000-0000-0000-0000-00000369e003', '00000000-0000-0000-0000-00000369c001') $q$), 'ok');
SELECT tda.same('the roadmap task carries it and the row''s task does not', tda.past($q$
  SELECT (SELECT painted_map_id::text FROM public.checklist_tech_tree_group_tasks WHERE id = '00000000-0000-0000-0000-000003690003')
    || ' / ' || coalesce((SELECT painted_map_id::text FROM public.checklist_items WHERE id = '00000000-0000-0000-0000-00000369d003'), 'none')
$q$), '00000000-0000-0000-0000-00000369c001 / none');
-- The office may put a map it did not paint on a task.
SELECT tda.sign_in('00000000-0000-0000-0000-00000369a001');
SELECT tda.same('Dee puts her own map on a task of Hank''s', tda.try($q$ SELECT public.task_add_map('00000000-0000-0000-0000-00000369e001', '00000000-0000-0000-0000-00000369c003') $q$), 'ok');

RESET ROLE;
SELECT 'task_doer_acts PASSED';
ROLLBACK;
