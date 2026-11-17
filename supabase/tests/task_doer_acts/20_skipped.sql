-- Task Mode tools, a skipped day (punch list #369 step D3, migration *_task_skipped_line): a repeating task that was
-- not ticked can say it was skipped. One more kind of line in a task's thread, written like a note by whoever can
-- read the day row, and by nobody for someone else.
-- Fixtures are written as postgres; the tries run as each account under RLS; everything rolls back. Raises on the
-- first failed assertion; ends with "task_skipped_line PASSED". See scripts/pgtest-task-doer-acts.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dee is a dev and gave the task. Hank is a helper and does it. Zed is a helper on no task.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000036db001', 'dee@taskskip.test'),
  ('00000000-0000-0000-0000-0000036db002', 'hank@taskskip.test'),
  ('00000000-0000-0000-0000-0000036db003', 'zed@taskskip.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at, login_attached_at) VALUES
  ('00000000-0000-0000-0000-0000036db001', 'dee@taskskip.test', 'Dee Dev', 'dev', false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000036db002', 'hank@taskskip.test', 'Hank Helper', 'helpers', false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000036db003', 'zed@taskskip.test', 'Zed Helper', 'helpers', false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at, login_attached_at = EXCLUDED.login_attached_at;

CREATE SCHEMA tsk;
GRANT USAGE ON SCHEMA tsk TO authenticated;
CREATE FUNCTION tsk.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION tsk.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION tsk.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
CREATE FUNCTION tsk.past(q text) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text; BEGIN EXECUTE q INTO v; RETURN v; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tsk TO authenticated;

-- A task that repeats, with yesterday's row not ticked.
INSERT INTO public.checklist_items (id, title, created_by_user_id, repeat_type, start_date) VALUES
  ('00000000-0000-0000-0000-0000036dd001', 'Feed the chickens', '00000000-0000-0000-0000-0000036db001', 'day_of_week', (now() AT TIME ZONE 'America/Chicago')::date - 30);
INSERT INTO public.checklist_item_assignees (checklist_item_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000036dd001', '00000000-0000-0000-0000-0000036db002');
INSERT INTO public.checklist_instances (id, checklist_item_id, scheduled_date) VALUES
  ('00000000-0000-0000-0000-0000036de001', '00000000-0000-0000-0000-0000036dd001', (now() AT TIME ZONE 'America/Chicago')::date - 1);
INSERT INTO public.checklist_instance_assignees (checklist_instance_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000036de001', '00000000-0000-0000-0000-0000036db002');

-- The structure.
SELECT tsk.same('the thread holds skipped beside the twelve', (
  SELECT (pg_get_constraintdef(oid) LIKE '%''skipped''%')::text || ' ' || (pg_get_constraintdef(oid) LIKE '%''dropped''%')::text || ' ' || (pg_get_constraintdef(oid) LIKE '%''comment''%')::text
  FROM pg_constraint WHERE conname = 'checklist_instance_events_event_type_check'
), 'true true true');
SELECT tsk.same('one check holds the kinds', (
  SELECT count(*)::text FROM pg_constraint
  WHERE conrelid = 'public.checklist_instance_events'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%event_type%'
), '1');
SELECT tsk.same('one insert policy stands on the thread', (
  SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'checklist_instance_events' AND cmd = 'INSERT' AND permissive = 'PERMISSIVE'
), '1');

SET LOCAL ROLE authenticated;

SELECT tsk.sign_in('00000000-0000-0000-0000-0000036db002');
SELECT tsk.same('Hank says he skipped yesterday', tsk.try($q$
  INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body) VALUES ('00000000-0000-0000-0000-0000036de001', 'skipped', '00000000-0000-0000-0000-0000036db002', '')
$q$), 'ok');
SELECT tsk.same('the day row is still not done', tsk.past($q$ SELECT (completed_at IS NULL)::text FROM public.checklist_instances WHERE id = '00000000-0000-0000-0000-0000036de001' $q$), 'true');
SELECT tsk.same('he cannot say it as Dee', tsk.try($q$
  INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body) VALUES ('00000000-0000-0000-0000-0000036de001', 'skipped', '00000000-0000-0000-0000-0000036db001', '')
$q$), '42501');
SELECT tsk.same('a dropped line is still not his to write by hand', tsk.try($q$
  INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body) VALUES ('00000000-0000-0000-0000-0000036de001', 'dropped', '00000000-0000-0000-0000-0000036db002', 'x')
$q$), '42501');
SELECT tsk.same('a note still lands', tsk.try($q$
  INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body) VALUES ('00000000-0000-0000-0000-0000036de001', 'comment', '00000000-0000-0000-0000-0000036db002', 'Rained out')
$q$), 'ok');
SELECT tsk.same('a kind nobody knows is refused', tsk.try($q$
  INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body) VALUES ('00000000-0000-0000-0000-0000036de001', 'snoozed', '00000000-0000-0000-0000-0000036db002', '')
$q$), '42501');

SELECT tsk.sign_in('00000000-0000-0000-0000-0000036db003');
SELECT tsk.same('Zed, who cannot read the row, writes nothing on it', tsk.try($q$
  INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body) VALUES ('00000000-0000-0000-0000-0000036de001', 'skipped', '00000000-0000-0000-0000-0000036db003', '')
$q$), '42501');

RESET ROLE;
SELECT tsk.same('the thread holds Hank''s two lines and no others', tsk.past($q$
  SELECT string_agg(event_type, ', ' ORDER BY created_at, event_type) FROM public.checklist_instance_events WHERE instance_id = '00000000-0000-0000-0000-0000036de001'
$q$), 'comment, skipped');

SELECT 'task_skipped_line PASSED';
ROLLBACK;
