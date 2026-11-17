-- Tagging a teammate in a task note (migration *_task_note_tags, punch list #375): who the list offers on a day row,
-- a note posted with its tags in one transaction, what answers a tag and what does not, the count for both people,
-- a task that repeats, a done task, a task handed on, the one read for job tags and task tags, and that no client
-- writes a tag row. Fixtures are written as postgres; presses run as each user; everything rolls back. Raises on the
-- first failed assertion; ends with "task_note_tags PASSED". See scripts/pgtest-task-note-tags.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dana is the office and gave every task here. Marcus is a master and Devon a dev: the office. Luis (superintendent)
-- has the tasks. Hector (helpers) has none of them and can sign in, so he can take one. Pat is a primary with no
-- task: he can open every task and is on no list. Sam is a sub, Tara is in training, Gwen left and Sal is a sample
-- helper: each has the first task's day row. Priya estimates. Tess is a digital twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000003750a1', 'dana@tasknotetags.test'),
  ('00000000-0000-0000-0000-0000003750a2', 'marcus@tasknotetags.test'),
  ('00000000-0000-0000-0000-0000003750a3', 'luis@tasknotetags.test'),
  ('00000000-0000-0000-0000-0000003750a4', 'hector@tasknotetags.test'),
  ('00000000-0000-0000-0000-0000003750a5', 'pat@tasknotetags.test'),
  ('00000000-0000-0000-0000-0000003750a6', 'sam@tasknotetags.test'),
  ('00000000-0000-0000-0000-0000003750a7', 'priya@tasknotetags.test'),
  ('00000000-0000-0000-0000-0000003750a8', 'gwen@tasknotetags.test'),
  ('00000000-0000-0000-0000-0000003750a9', 'tess@tasknotetags.test'),
  ('00000000-0000-0000-0000-0000003750aa', 'sal@tasknotetags.test'),
  ('00000000-0000-0000-0000-0000003750ab', 'devon@tasknotetags.test'),
  ('00000000-0000-0000-0000-0000003750ac', 'tara@tasknotetags.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  ('00000000-0000-0000-0000-0000003750a1', 'dana@tasknotetags.test', 'Dana Office', 'assistant', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003750a2', 'marcus@tasknotetags.test', 'Marcus Master', 'master_technician', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003750a3', 'luis@tasknotetags.test', 'Luis Lead', 'superintendent', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003750a4', 'hector@tasknotetags.test', 'Hector Helper', 'helpers', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003750a5', 'pat@tasknotetags.test', 'Pat Primary', 'primary', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003750a6', 'sam@tasknotetags.test', 'Sam Sub', 'subcontractor', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003750a7', 'priya@tasknotetags.test', 'Priya Estimator', 'estimator', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003750a8', 'gwen@tasknotetags.test', 'Gwen Gone', 'helpers', false, false, false, now(), now()),
  ('00000000-0000-0000-0000-0000003750a9', 'tess@tasknotetags.test', 'Tess Twin', 'assistant', false, true, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003750aa', 'sal@tasknotetags.test', 'Sal Sample', 'helpers', false, false, true, NULL, now()),
  ('00000000-0000-0000-0000-0000003750ab', 'devon@tasknotetags.test', 'Devon Dev', 'dev', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003750ac', 'tara@tasknotetags.test', 'Tara Training', 'helpers', true, false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;

CREATE SCHEMA tnt;
CREATE FUNCTION tnt.day(n integer) RETURNS date LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'America/Chicago')::date + n $$;
CREATE FUNCTION tnt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION tnt.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n%\n--- want it to hold ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION tnt.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- No claims at all, as the service role has none: the guard on users lets the archive flow's own write through.
CREATE FUNCTION tnt.signed_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
-- The list for a day row as one line, in the order the function hands it back.
CREATE FUNCTION tnt.list(p_instance uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(t.name || ':' || t.on_task || CASE WHEN t.gave THEN ':gave' ELSE '' END, ', ' ORDER BY t.ord), '')
  FROM public.task_note_taggable(p_instance) WITH ORDINALITY AS t(user_id, name, role, on_task, gave, ord)
$$;
-- The caller's task tags as one line: kind, who is tagged, how it cleared.
CREATE FUNCTION tnt.mine() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(m.kind || ' ' || m.tagged_name || ' ' || coalesce(m.cleared_how, 'open'), ', ' ORDER BY m.created_at, m.tagged_name), '')
  FROM public.task_note_tags_mine() m
$$;
GRANT USAGE ON SCHEMA tnt TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tnt TO authenticated, anon;

-- The tasks, all Dana's.
--   d1 a one-time task for Luis, its day row e11 a month old, with Sam, Tara, Gwen and Sal on the row too.
--   d2 a task that repeats, for Luis: yesterday's row e21 and today's e22.
--   d3 a one-time task for Luis to hand on, its day row e31.
INSERT INTO public.checklist_items (id, title, created_by_user_id, repeat_type, start_date) VALUES
  ('00000000-0000-0000-0000-0000003750d1', 'Sweep the shop bays', '00000000-0000-0000-0000-0000003750a1', 'once', tnt.day(-30)),
  ('00000000-0000-0000-0000-0000003750d2', 'Lock the yard gate', '00000000-0000-0000-0000-0000003750a1', 'day_of_week', tnt.day(-30)),
  ('00000000-0000-0000-0000-0000003750d3', 'Sort the fittings wall', '00000000-0000-0000-0000-0000003750a1', 'once', tnt.day(-30));
INSERT INTO public.checklist_item_assignees (checklist_item_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000003750d1', '00000000-0000-0000-0000-0000003750a3'),
  ('00000000-0000-0000-0000-0000003750d2', '00000000-0000-0000-0000-0000003750a3'),
  ('00000000-0000-0000-0000-0000003750d3', '00000000-0000-0000-0000-0000003750a3');
INSERT INTO public.checklist_instances (id, checklist_item_id, scheduled_date) VALUES
  ('00000000-0000-0000-0000-0000003750e1', '00000000-0000-0000-0000-0000003750d1', tnt.day(-30)),
  ('00000000-0000-0000-0000-0000003750e2', '00000000-0000-0000-0000-0000003750d2', tnt.day(-1)),
  ('00000000-0000-0000-0000-0000003750e3', '00000000-0000-0000-0000-0000003750d2', tnt.day(0)),
  ('00000000-0000-0000-0000-0000003750e4', '00000000-0000-0000-0000-0000003750d3', tnt.day(-30));
INSERT INTO public.checklist_instance_assignees (checklist_instance_id, user_id)
  SELECT i.id, '00000000-0000-0000-0000-0000003750a3'::uuid FROM public.checklist_instances i
  WHERE i.id::text LIKE '00000000-0000-0000-0000-0000003750e%';
INSERT INTO public.checklist_instance_assignees (checklist_instance_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000003750e1', '00000000-0000-0000-0000-0000003750a6'),
  ('00000000-0000-0000-0000-0000003750e1', '00000000-0000-0000-0000-0000003750ac'),
  ('00000000-0000-0000-0000-0000003750e1', '00000000-0000-0000-0000-0000003750a8'),
  ('00000000-0000-0000-0000-0000003750e1', '00000000-0000-0000-0000-0000003750aa');
-- A note Luis wrote ten minutes ago, for the "not afterwards" refusal.
INSERT INTO public.checklist_instance_events (id, instance_id, event_type, actor_user_id, body, created_at) VALUES
  ('00000000-0000-0000-0000-0000003750c1', '00000000-0000-0000-0000-0000003750e1', 'comment', '00000000-0000-0000-0000-0000003750a3', 'on it', now() - interval '10 minutes');

-- A job, for the one read of both kinds: Marcus is its master and Luis is on its crew.
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000003750f9', 'Task Note Tags Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name) VALUES
  ('00000000-0000-0000-0000-0000003750b1', '00000000-0000-0000-0000-0000003750a2', '00000000-0000-0000-0000-0000003750f9', 'Cedar Bluff Lofts');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000003750b1', '00000000-0000-0000-0000-0000003750a3')
  ON CONFLICT DO NOTHING;

-- 0 · The new table carries its fences, and a second run of the migration left one policy and one trigger.
SELECT tnt.same('the table has its archived fence', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'task_note_tags' AND policyname = 'archived_fence')::text, '1');
SELECT tnt.same('the table has one read policy of its own', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'task_note_tags' AND policyname = 'task_note_tags_select')::text, '1');
SELECT tnt.same('the table has no write policy of its own', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'task_note_tags' AND permissive = 'PERMISSIVE' AND cmd <> 'SELECT')::text, '0');
SELECT tnt.same('the table has its training-mode trigger', (SELECT (count(*) > 0)::text FROM pg_trigger WHERE tgrelid = 'public.task_note_tags'::regclass AND NOT tgisinternal), 'true');
SELECT tnt.same('the thread has one answering trigger', (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.checklist_instance_events'::regclass AND tgname = 'task_note_answers_tags_trigger')::text, '1');

-- 1 · The list Luis is offered on his task: whoever gave it first, then the office. No sub, no training account, no
-- one who left and no sample login, though each has the day row. No primary and no helper who do not have the task.
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a3');
SET LOCAL ROLE authenticated;
SELECT tnt.same('Luis''s list', tnt.list('00000000-0000-0000-0000-0000003750e1'), 'Dana Office:true:gave, Devon Dev:false, Marcus Master:false');
RESET ROLE;

-- 2 · Dana gave it: the person who has it is first for her. A dev is offered the sample login too.
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a1');
SET LOCAL ROLE authenticated;
SELECT tnt.same('Dana''s list', tnt.list('00000000-0000-0000-0000-0000003750e1'), 'Luis Lead:true, Devon Dev:false, Marcus Master:false');
RESET ROLE;
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750ab');
SET LOCAL ROLE authenticated;
SELECT tnt.same('Devon''s list', tnt.list('00000000-0000-0000-0000-0000003750e1'), 'Dana Office:true:gave, Luis Lead:true, Sal Sample:true, Marcus Master:false');
RESET ROLE;

-- 3 · A helper who does not have the task, a primary who can open it but does not have it, and a sub who has the day
-- row are refused the list. Nobody signed out may ask.
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a4');
SET LOCAL ROLE authenticated;
SELECT tnt.refused('Hector''s list', $q$SELECT tnt.list('00000000-0000-0000-0000-0000003750e1')$q$, 'Only the office and this task');
RESET ROLE;
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a5');
SET LOCAL ROLE authenticated;
SELECT tnt.refused('Pat''s list', $q$SELECT tnt.list('00000000-0000-0000-0000-0000003750e1')$q$, 'Only the office and this task');
RESET ROLE;
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a6');
SET LOCAL ROLE authenticated;
SELECT tnt.refused('Sam''s list', $q$SELECT tnt.list('00000000-0000-0000-0000-0000003750e1')$q$, 'Only the office and this task');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT tnt.refused('the list, signed out', $q$SELECT * FROM public.task_note_taggable('00000000-0000-0000-0000-0000003750e1')$q$, 'permission denied');
RESET ROLE;

-- 4 · Luis posts a note that tags Dana and Marcus. Tagging himself, and Dana twice, adds nothing.
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a3');
SET LOCAL ROLE authenticated;
SELECT public.task_note_post_tagged('00000000-0000-0000-0000-0000003750e1', '  Which bay first? @Dana Office @Marcus Master  ',
  ARRAY['00000000-0000-0000-0000-0000003750a1', '00000000-0000-0000-0000-0000003750a2', '00000000-0000-0000-0000-0000003750a3', '00000000-0000-0000-0000-0000003750a1']::uuid[]);
SELECT tnt.same('the note is in the thread as a note, trimmed', (SELECT count(*) FROM public.checklist_instance_events WHERE instance_id = '00000000-0000-0000-0000-0000003750e1' AND event_type = 'comment' AND body = 'Which bay first? @Dana Office @Marcus Master')::text, '1');
SELECT tnt.same('two tags, each with the name as written', (SELECT string_agg(tagged_name, ', ' ORDER BY tagged_name) FROM public.task_note_tags), 'Dana Office, Marcus Master');
SELECT tnt.same('each tag names the day row and the task', (SELECT count(*) FROM public.task_note_tags WHERE instance_id = '00000000-0000-0000-0000-0000003750e1' AND item_id = '00000000-0000-0000-0000-0000003750d1')::text, '2');
SELECT tnt.same('nothing counts for Luis yet', public.task_note_tags_count()::text, '0');
SELECT tnt.same('Luis''s section', tnt.mine(), 'asked Dana Office open, asked Marcus Master open');

-- 5 · A person the list does not offer is refused by name, and that note is not posted.
SELECT tnt.refused('tagging a sub who has the row', $q$SELECT public.task_note_post_tagged('00000000-0000-0000-0000-0000003750e1', 'Sam, a question', ARRAY['00000000-0000-0000-0000-0000003750a6']::uuid[])$q$, 'Sam Sub cannot be tagged on this task');
SELECT tnt.refused('tagging an estimator', $q$SELECT public.task_note_post_tagged('00000000-0000-0000-0000-0000003750e1', 'Priya, a question', ARRAY['00000000-0000-0000-0000-0000003750a7']::uuid[])$q$, 'Priya Estimator cannot be tagged');
SELECT tnt.refused('tagging a sample login as a superintendent', $q$SELECT public.task_note_post_tagged('00000000-0000-0000-0000-0000003750e1', 'Sal, a question', ARRAY['00000000-0000-0000-0000-0000003750aa']::uuid[])$q$, 'Sal Sample cannot be tagged');
SELECT tnt.refused('tagging a helper who does not have the task', $q$SELECT public.task_note_post_tagged('00000000-0000-0000-0000-0000003750e1', 'Hector, a question', ARRAY['00000000-0000-0000-0000-0000003750a4']::uuid[])$q$, 'Hector Helper cannot be tagged');
SELECT tnt.refused('tagging a primary who does not have the task', $q$SELECT public.task_note_post_tagged('00000000-0000-0000-0000-0000003750e1', 'Pat, a question', ARRAY['00000000-0000-0000-0000-0000003750a5']::uuid[])$q$, 'Pat Primary cannot be tagged');
SELECT tnt.refused('tagging a training account', $q$SELECT public.task_note_post_tagged('00000000-0000-0000-0000-0000003750e1', 'Tara, a question', ARRAY['00000000-0000-0000-0000-0000003750ac']::uuid[])$q$, 'Tara Training cannot be tagged');
SELECT tnt.refused('tagging someone who left', $q$SELECT public.task_note_post_tagged('00000000-0000-0000-0000-0000003750e1', 'Gwen, a question', ARRAY['00000000-0000-0000-0000-0000003750a8']::uuid[])$q$, 'Gwen Gone cannot be tagged');
SELECT tnt.refused('tagging a twin', $q$SELECT public.task_note_post_tagged('00000000-0000-0000-0000-0000003750e1', 'Tess, a question', ARRAY['00000000-0000-0000-0000-0000003750a9']::uuid[])$q$, 'Tess Twin cannot be tagged');
SELECT tnt.same('no refused note was posted', (SELECT count(*) FROM public.checklist_instance_events WHERE instance_id = '00000000-0000-0000-0000-0000003750e1' AND body LIKE '%a question%')::text, '0');
SELECT tnt.refused('an empty note', $q$SELECT public.task_note_post_tagged('00000000-0000-0000-0000-0000003750e1', '   ', '{}'::uuid[])$q$, 'Write the note first');

-- 6 · No client writes a tag row, and a tag is not added to a note afterwards.
SELECT tnt.refused('a tag row by hand', $q$INSERT INTO public.task_note_tags (event_id, instance_id, item_id, tagged_user_id, tagged_name, tagger_user_id) VALUES ('00000000-0000-0000-0000-0000003750c1', '00000000-0000-0000-0000-0000003750e1', '00000000-0000-0000-0000-0000003750d1', '00000000-0000-0000-0000-0000003750a1', 'Dana Office', '00000000-0000-0000-0000-0000003750a3')$q$, 'permission denied');
SELECT tnt.refused('clearing a tag by hand', $q$UPDATE public.task_note_tags SET cleared_at = now(), cleared_how = 'done'$q$, 'permission denied');
SELECT tnt.refused('deleting a tag by hand', $q$DELETE FROM public.task_note_tags$q$, 'permission denied');
SELECT tnt.refused('a tag on a note ten minutes old', $q$SELECT public.task_note_tags_write('00000000-0000-0000-0000-0000003750c1', ARRAY['00000000-0000-0000-0000-0000003750a1']::uuid[])$q$, 'not afterwards');
SELECT tnt.refused('the list function behind it', $q$SELECT * FROM public.task_note_people('00000000-0000-0000-0000-0000003750e1', true)$q$, 'permission denied');
RESET ROLE;

-- 7 · Dana sees it waiting, with the note, who asked and the task. A tag in someone else's note is not hers to write.
-- A stuck line carries words and answers nothing.
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a1');
SET LOCAL ROLE authenticated;
SELECT tnt.same('one waits on Dana', public.task_note_tags_count()::text, '1');
SELECT tnt.same('Dana''s section', tnt.mine(), 'waiting Dana Office open');
SELECT tnt.same('it carries the note, who asked, the task and its day', (SELECT note_body || ' / ' || tagger_name || ' / ' || task_title || ' / ' || (task_date = tnt.day(-30))::text FROM public.task_note_tags_mine()), 'Which bay first? @Dana Office @Marcus Master / Luis Lead / Sweep the shop bays / true');
SELECT tnt.refused('Dana tagging in Luis''s note', $q$SELECT public.task_note_tags_write((SELECT event_id FROM public.task_note_tags_mine() LIMIT 1), '{}'::uuid[])$q$, 'Only the note');
INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body) VALUES
  ('00000000-0000-0000-0000-0000003750e1', 'stuck', '00000000-0000-0000-0000-0000003750a1', 'waiting on the key');
SELECT tnt.same('a stuck line answers nothing', public.task_note_tags_count()::text, '1');

-- 8 · Dana writes a note the way the note box does today, with a plain insert. Her tag clears. Marcus's does not.
INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body) VALUES
  ('00000000-0000-0000-0000-0000003750e1', 'comment', '00000000-0000-0000-0000-0000003750a1', 'Bay 2 first.');
SELECT tnt.same('nothing waits on Dana', public.task_note_tags_count()::text, '0');
SELECT tnt.same('Dana''s section is empty', tnt.mine(), '');
SELECT tnt.same('Dana reads both tags on the thread she can open', (SELECT count(*) FROM public.task_note_tags)::text, '2');
RESET ROLE;
SELECT tnt.same('Marcus''s tag still waits', (SELECT count(*) FROM public.task_note_tags WHERE tagged_name = 'Marcus Master' AND cleared_at IS NULL)::text, '1');

-- 9 · The answer counts for Luis until he has seen it. Seeing it twice changes nothing.
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a3');
SET LOCAL ROLE authenticated;
SELECT tnt.same('the answer counts for Luis', public.task_note_tags_count()::text, '1');
SELECT tnt.same('Luis''s section after the answer', tnt.mine(), 'asked Dana Office answered, asked Marcus Master open');
SELECT tnt.same('it carries the answer', (SELECT answer_body FROM public.task_note_tags_mine() WHERE cleared_how = 'answered'), 'Bay 2 first.');
SELECT tnt.same('Luis sees one answer', public.task_note_tags_seen()::text, '1');
SELECT tnt.same('seen, it stops counting', public.task_note_tags_count()::text, '0');
SELECT tnt.same('a second look marks none', public.task_note_tags_seen()::text, '0');
SELECT tnt.same('the answered line stays for the week', tnt.mine(), 'asked Dana Office answered, asked Marcus Master open');
RESET ROLE;

-- 10 · Marcus presses No reply needed, once. He cannot clear a tag that is not his.
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a2');
SET LOCAL ROLE authenticated;
SELECT tnt.same('one waits on Marcus', public.task_note_tags_count()::text, '1');
SELECT tnt.same('No reply needed clears it', public.task_note_tag_done((SELECT tag_id FROM public.task_note_tags_mine() WHERE kind = 'waiting'))::text, 'true');
SELECT tnt.same('nothing waits on Marcus', public.task_note_tags_count()::text, '0');
SELECT tnt.same('a tag that is not his', public.task_note_tag_done((SELECT id FROM public.task_note_tags WHERE tagged_name = 'Dana Office' LIMIT 1))::text, 'false');
RESET ROLE;

-- 11 · A helper who has none of the tasks reads no tag and has an empty section.
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a4');
SET LOCAL ROLE authenticated;
SELECT tnt.same('Hector reads no tag', (SELECT count(*) FROM public.task_note_tags)::text, '0');
SELECT tnt.same('Hector''s section is empty', tnt.mine(), '');
RESET ROLE;

-- 12 · A task that repeats. Dana tags Luis on yesterday's row. His note on another task answers nothing. His note on
-- today's row of the same task answers it: the tag stays with the task, not the day.
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a1');
SET LOCAL ROLE authenticated;
SELECT public.task_note_post_tagged('00000000-0000-0000-0000-0000003750e2', '@Luis Lead was the gate locked last night?', ARRAY['00000000-0000-0000-0000-0000003750a3']::uuid[]);
RESET ROLE;
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a3');
SET LOCAL ROLE authenticated;
SELECT tnt.same('Marcus''s press counts for Luis until seen', public.task_note_tags_count()::text, '2');
SELECT tnt.same('Luis sees Marcus''s press', public.task_note_tags_seen()::text, '1');
SELECT tnt.same('one waits on Luis', public.task_note_tags_count()::text, '1');
INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body) VALUES
  ('00000000-0000-0000-0000-0000003750e1', 'comment', '00000000-0000-0000-0000-0000003750a3', 'Bay 2 is done.');
SELECT tnt.same('a note on another task answers nothing', public.task_note_tags_count()::text, '1');
INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body) VALUES
  ('00000000-0000-0000-0000-0000003750e3', 'comment', '00000000-0000-0000-0000-0000003750a3', 'Yes, at six.');
SELECT tnt.same('a note on the next day of the same task answers it', public.task_note_tags_count()::text, '0');
RESET ROLE;
SELECT tnt.same('the tag names the answering note', (SELECT e.body FROM public.task_note_tags t JOIN public.checklist_instance_events e ON e.id = t.answer_event_id WHERE t.instance_id = '00000000-0000-0000-0000-0000003750e2'), 'Yes, at six.');

-- 13 · A tick clears nothing, and a tag on a done task works and reopens nothing.
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a1');
SET LOCAL ROLE authenticated;
SELECT public.task_note_post_tagged('00000000-0000-0000-0000-0000003750e1', '@Luis Lead and bay 3?', ARRAY['00000000-0000-0000-0000-0000003750a3']::uuid[]);
RESET ROLE;
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a3');
SET LOCAL ROLE authenticated;
UPDATE public.checklist_instances SET completed_at = now(), completed_by_user_id = '00000000-0000-0000-0000-0000003750a3' WHERE id = '00000000-0000-0000-0000-0000003750e1';
SELECT tnt.same('the tick wrote its line in the thread', (SELECT count(*) FROM public.checklist_instance_events WHERE instance_id = '00000000-0000-0000-0000-0000003750e1' AND event_type = 'completed')::text, '1');
SELECT tnt.same('the tick clears nothing', public.task_note_tags_count()::text, '1');
SELECT public.task_note_post_tagged('00000000-0000-0000-0000-0000003750e1', '@Dana Office bay 3 is done too', ARRAY['00000000-0000-0000-0000-0000003750a1']::uuid[]);
SELECT tnt.same('his tagged note answered his own tag', public.task_note_tags_count()::text, '0');
SELECT tnt.same('the task is still done', (SELECT (completed_at IS NOT NULL)::text FROM public.checklist_instances WHERE id = '00000000-0000-0000-0000-0000003750e1'), 'true');
RESET ROLE;

-- 14 · A task handed on. Dana tags Luis on it, and Luis hands it to Hector. The tag goes with the task and still
-- waits on Luis, who reads its note though he can no longer open the task. Hector is offered whoever gave it and the
-- office, and not Luis.
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a1');
SET LOCAL ROLE authenticated;
SELECT public.task_note_post_tagged('00000000-0000-0000-0000-0000003750e4', '@Luis Lead start with the copper', ARRAY['00000000-0000-0000-0000-0000003750a3']::uuid[]);
RESET ROLE;
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a3');
SET LOCAL ROLE authenticated;
SELECT tnt.same('Luis hands it on', (public.task_hand_on('00000000-0000-0000-0000-0000003750e4', '00000000-0000-0000-0000-0000003750a4', 'he has the wall') ->> 'ok'), 'true');
SELECT tnt.same('the handed line answers nothing', public.task_note_tags_count()::text, '1');
SELECT tnt.same('Luis can no longer open the task', (SELECT count(*) FROM public.checklist_instances WHERE id = '00000000-0000-0000-0000-0000003750e4')::text, '0');
SELECT tnt.same('the tag still waits on him, with its note', (SELECT string_agg(note_body, ' | ') FROM public.task_note_tags_mine() WHERE kind = 'waiting'), '@Luis Lead start with the copper');
SELECT tnt.refused('off the task, Luis''s list', $q$SELECT tnt.list('00000000-0000-0000-0000-0000003750e4')$q$, 'Only the office and this task');
SELECT tnt.same('No reply needed still clears it', public.task_note_tag_done((SELECT tag_id FROM public.task_note_tags_mine() WHERE kind = 'waiting'))::text, 'true');
RESET ROLE;
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a4');
SET LOCAL ROLE authenticated;
SELECT tnt.same('Hector''s list on the task he took', tnt.list('00000000-0000-0000-0000-0000003750e4'), 'Dana Office:true:gave, Devon Dev:false, Marcus Master:false');
RESET ROLE;

-- 15 · One day of the repeating task handed on. Luis still has the task and no longer has today's row, so today's
-- list does not offer him, and yesterday's still does.
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a3');
SET LOCAL ROLE authenticated;
SELECT tnt.same('Luis hands today on', (public.task_hand_on('00000000-0000-0000-0000-0000003750e3', '00000000-0000-0000-0000-0000003750a4') ->> 'whole'), 'false');
RESET ROLE;
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a1');
SET LOCAL ROLE authenticated;
SELECT tnt.same('Dana''s list on today''s row', tnt.list('00000000-0000-0000-0000-0000003750e3'), 'Hector Helper:true, Devon Dev:false, Marcus Master:false');
SELECT tnt.same('Dana''s list on yesterday''s row', tnt.list('00000000-0000-0000-0000-0000003750e2'), 'Luis Lead:true, Devon Dev:false, Marcus Master:false');
SELECT tnt.refused('tagging Luis on a day he gave away', $q$SELECT public.task_note_post_tagged('00000000-0000-0000-0000-0000003750e3', '@Luis Lead today?', ARRAY['00000000-0000-0000-0000-0000003750a3']::uuid[])$q$, 'Luis Lead cannot be tagged on this task');
RESET ROLE;

-- 16 · Both kinds in one read. Luis tags Dana in a job note, and step 13's task note already waits on her. The whole
-- scenario is one transaction and so one moment, so the task tag is dated a day back to give the two an order.
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a3');
SET LOCAL ROLE authenticated;
SELECT public.job_note_post_tagged('00000000-0000-0000-0000-0000003750b1', '@Dana Office is the meter set?', ARRAY['00000000-0000-0000-0000-0000003750a1']::uuid[]);
RESET ROLE;
UPDATE public.task_note_tags SET created_at = now() - interval '1 day'
  WHERE tagged_user_id = '00000000-0000-0000-0000-0000003750a1' AND cleared_at IS NULL;
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a1');
SET LOCAL ROLE authenticated;
SELECT tnt.same('Dana''s waiting tags, both kinds, oldest first', (SELECT string_agg(m.source || ':' || coalesce(m.job_name, m.task_title), ', ' ORDER BY m.created_at, m.tag_id) FROM public.note_tags_mine() m WHERE m.kind = 'waiting'), 'task:Sweep the shop bays, job:Cedar Bluff Lofts');
SELECT tnt.same('a task row carries its day row and no job', (SELECT (m.instance_id = '00000000-0000-0000-0000-0000003750e1')::text || ' ' || (m.job_id IS NULL)::text FROM public.note_tags_mine() m WHERE m.kind = 'waiting' AND m.source = 'task'), 'true true');
SELECT tnt.same('a job row carries its job and no task', (SELECT (m.job_id = '00000000-0000-0000-0000-0000003750b1')::text || ' ' || (m.instance_id IS NULL)::text FROM public.note_tags_mine() m WHERE m.kind = 'waiting' AND m.source = 'job'), 'true true');
-- Her task count: one tag waits on her, and three she asked have cleared unseen (two answered, one No reply needed).
SELECT tnt.same('the two counts', public.job_note_tags_count()::text || ' + ' || public.task_note_tags_count()::text, '1 + 4');
SELECT tnt.same('one count for both', public.note_tags_count()::text, '5');
RESET ROLE;

-- 17 · Marcus leaves. The tag Luis made on him reads has left, on the task's own read and on the one for both.
SELECT tnt.signed_out();
UPDATE public.users SET archived_at = now() WHERE id = '00000000-0000-0000-0000-0000003750a2';
SELECT tnt.as_user('00000000-0000-0000-0000-0000003750a3');
SET LOCAL ROLE authenticated;
SELECT tnt.same('who has left, on the task read', (SELECT string_agg(m.tagged_name || ':' || m.tagged_left, ', ' ORDER BY m.tagged_name) FROM public.task_note_tags_mine() m WHERE m.kind = 'asked'), 'Dana Office:false, Dana Office:false, Marcus Master:true');
SELECT tnt.same('who has left, on the read of both', (SELECT string_agg(DISTINCT m.tagged_name || ':' || m.tagged_left, ', ') FROM public.note_tags_mine() m WHERE m.kind = 'asked' AND m.tagged_left), 'Marcus Master:true');
RESET ROLE;

-- 18 · Deleting the task takes its day rows, its notes and its tags.
SELECT tnt.same('tags on the first task before it goes', (SELECT (count(*) > 0)::text FROM public.task_note_tags WHERE item_id = '00000000-0000-0000-0000-0000003750d1'), 'true');
DELETE FROM public.checklist_items WHERE id = '00000000-0000-0000-0000-0000003750d1';
SELECT tnt.same('the tags went with the task', (SELECT count(*) FROM public.task_note_tags WHERE item_id = '00000000-0000-0000-0000-0000003750d1')::text, '0');
SELECT tnt.same('the other tasks keep theirs', (SELECT (count(*) > 0)::text FROM public.task_note_tags), 'true');

DO $$ BEGIN RAISE NOTICE 'task_note_tags PASSED'; END $$;
ROLLBACK;
