-- Presses nothing takes back (punch list #443, row 13, migration *_test_note_delete_dev): a developer deletes a comment
-- on a day of a ZZ test task, and nobody deletes any other event. Fixtures made as postgres; presses run as each user
-- through RLS; everything rolls back. Raises on the first failed assertion; ends with "task_note_tags PASSED". See
-- scripts/pgtest-task-note-tags.sh. Never against prod. Every person and task is made up.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA tdd;
CREATE FUNCTION tdd.id(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000004414' || p)::uuid $$;
CREATE FUNCTION tdd.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION tdd.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION tdd.try_delete(p_event uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.checklist_instance_events WHERE id = p_event;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n::text || ' row';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
CREATE FUNCTION tdd.events() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(right(id::text, 2) || ':' || event_type, ' ' ORDER BY id), '-') FROM public.checklist_instance_events WHERE instance_id IN (tdd.id('e1'), tdd.id('e2'))
$$;
CREATE FUNCTION tdd.tags() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(right(event_id::text, 2) || '>' || coalesce(right(answer_event_id::text, 2), '-'), ' ' ORDER BY id), '-') FROM public.task_note_tags WHERE instance_id IN (tdd.id('e1'), tdd.id('e2'))
$$;
GRANT USAGE ON SCHEMA tdd TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tdd TO authenticated, service_role;

-- Who: Devon the dev, Dana the office, Luis a superintendent who has the task.
INSERT INTO auth.users (id, email) VALUES (tdd.id('a1'), 'devon@commentdelete.test'), (tdd.id('a2'), 'dana@commentdelete.test'), (tdd.id('a3'), 'luis@commentdelete.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  (tdd.id('a1'), 'devon@commentdelete.test', 'Devon Dev Tdd', 'dev', false, false, false, NULL, now()),
  (tdd.id('a2'), 'dana@commentdelete.test', 'Dana Office Tdd', 'assistant', false, false, false, NULL, now()),
  (tdd.id('a3'), 'luis@commentdelete.test', 'Luis Lead Tdd', 'superintendent', false, false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at, login_attached_at = EXCLUDED.login_attached_at;
-- Two tasks: a ZZ test task and a real-named one, each with one day.
INSERT INTO public.checklist_items (id, title, created_by_user_id, repeat_type, start_date) VALUES
  (tdd.id('c1'), 'ZZ Test comment delete task', tdd.id('a2'), 'once', current_date),
  (tdd.id('c2'), 'Walk the lofts', tdd.id('a2'), 'once', current_date);
INSERT INTO public.checklist_item_assignees (checklist_item_id, user_id) VALUES (tdd.id('c1'), tdd.id('a3')), (tdd.id('c2'), tdd.id('a3')) ON CONFLICT DO NOTHING;
INSERT INTO public.checklist_instances (id, checklist_item_id, scheduled_date) VALUES (tdd.id('e1'), tdd.id('c1'), current_date), (tdd.id('e2'), tdd.id('c2'), current_date);
INSERT INTO public.checklist_instance_assignees (checklist_instance_id, user_id) VALUES (tdd.id('e1'), tdd.id('a3')), (tdd.id('e2'), tdd.id('a3')) ON CONFLICT DO NOTHING;
-- Events. f1 a plain comment on the test task; f2 a tagged question answered by f3; f4 a completed line, the app's own;
-- f5 a comment on the real task.
INSERT INTO public.checklist_instance_events (id, instance_id, event_type, actor_user_id, body, created_at) VALUES
  (tdd.id('f1'), tdd.id('e1'), 'comment', tdd.id('a2'), 'ZZ walk comment one', now() - interval '3 hours'),
  (tdd.id('f2'), tdd.id('e1'), 'comment', tdd.id('a2'), 'Luis, which bay first? @Luis Lead Tdd', now() - interval '2 hours'),
  (tdd.id('f3'), tdd.id('e1'), 'comment', tdd.id('a3'), 'Bay two.', now() - interval '1 hour'),
  (tdd.id('f4'), tdd.id('e1'), 'completed', tdd.id('a3'), '', now() - interval '30 minutes'),
  (tdd.id('f5'), tdd.id('e2'), 'comment', tdd.id('a2'), 'A comment on a real task', now() - interval '1 hour');
INSERT INTO public.task_note_tags (id, event_id, instance_id, item_id, tagged_user_id, tagged_name, tagger_user_id, created_at, cleared_at, cleared_how, answer_event_id) VALUES
  (tdd.id('d1'), tdd.id('f2'), tdd.id('e1'), tdd.id('c1'), tdd.id('a3'), 'Luis Lead Tdd', tdd.id('a2'), now() - interval '2 hours', now() - interval '1 hour', 'answered', tdd.id('f3'));
SELECT tdd.same('five events and one answered tag stand', tdd.events() || ' · ' || tdd.tags(), 'f1:comment f2:comment f3:comment f4:completed f5:comment · f2>f3');

-- ---------------------------------------------------------------------------------------------------------------
-- 1. The office cannot delete a comment, test task or not.
SELECT tdd.as_user(tdd.id('a2'));
SET LOCAL ROLE authenticated;
SELECT tdd.same('an assistant''s delete reaches no row', tdd.try_delete(tdd.id('f1')), '0 row');
RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. The dev: a real task's comment stays, the app's own line stays, an answer another tag names stays, a test task's
--    comment goes with its tag.
SELECT tdd.as_user(tdd.id('a1'));
SET LOCAL ROLE authenticated;
SELECT tdd.same('a comment on a real task reaches no row', tdd.try_delete(tdd.id('f5')), '0 row');
SELECT tdd.same('the app''s own completed line reaches no row', tdd.try_delete(tdd.id('f4')), '0 row');
SELECT tdd.same('a comment a tag names as its answer reaches no row', tdd.try_delete(tdd.id('f3')), '0 row');
SELECT tdd.same('a plain comment on the test task goes', tdd.try_delete(tdd.id('f1')), '1 row');
SELECT tdd.same('the tagged question goes, and its tag with it', tdd.try_delete(tdd.id('f2')), '1 row');
SELECT tdd.same('what stands', tdd.events() || ' · ' || tdd.tags(), 'f3:comment f4:completed f5:comment · -');
RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Signed out, nothing.
SELECT set_config('request.jwt.claims', '', true);
SET LOCAL ROLE anon;
SELECT tdd.same('anon is refused', (tdd.try_delete(tdd.id('f3')) LIKE '%permission denied%')::text, 'true');
RESET ROLE;

SELECT 'task_note_tags PASSED';
ROLLBACK;
