-- Tagging a teammate in a job note (migration *_jobs_ledger_note_tags, punch list #363): who the list offers, a note
-- posted with its tags in one transaction, what clears a tag and what does not, the count for both people, the
-- question back, the note sent late from the job window, and that no client writes a tag row. Fixtures are written as postgres; presses run as each user;
-- everything rolls back. Raises on the first failed assertion; ends with "job_note_tags PASSED".
-- See scripts/pgtest-job-note-tags.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dana is the office. Marcus is the job's master. Luis (superintendent) and Hector (helpers) are on its crew.
-- Hana (helpers) is on no job. Sam is a sub on the crew. Priya estimates. Gwen left and is archived. Tess is a
-- digital twin. Sal is a sample helper on the crew. Devon is a dev.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000003630a1', 'dana@jobnotetags.test'),
  ('00000000-0000-0000-0000-0000003630a2', 'marcus@jobnotetags.test'),
  ('00000000-0000-0000-0000-0000003630a3', 'luis@jobnotetags.test'),
  ('00000000-0000-0000-0000-0000003630a4', 'hector@jobnotetags.test'),
  ('00000000-0000-0000-0000-0000003630a5', 'hana@jobnotetags.test'),
  ('00000000-0000-0000-0000-0000003630a6', 'sam@jobnotetags.test'),
  ('00000000-0000-0000-0000-0000003630a7', 'priya@jobnotetags.test'),
  ('00000000-0000-0000-0000-0000003630a8', 'gwen@jobnotetags.test'),
  ('00000000-0000-0000-0000-0000003630a9', 'tess@jobnotetags.test'),
  ('00000000-0000-0000-0000-0000003630aa', 'sal@jobnotetags.test'),
  ('00000000-0000-0000-0000-0000003630ab', 'devon@jobnotetags.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at) VALUES
  ('00000000-0000-0000-0000-0000003630a1', 'dana@jobnotetags.test', 'Dana Office', 'assistant', false, false, false, NULL),
  ('00000000-0000-0000-0000-0000003630a2', 'marcus@jobnotetags.test', 'Marcus Master', 'master_technician', false, false, false, NULL),
  ('00000000-0000-0000-0000-0000003630a3', 'luis@jobnotetags.test', 'Luis Lead', 'superintendent', false, false, false, NULL),
  ('00000000-0000-0000-0000-0000003630a4', 'hector@jobnotetags.test', 'Hector Helper', 'helpers', false, false, false, NULL),
  ('00000000-0000-0000-0000-0000003630a5', 'hana@jobnotetags.test', 'Hana Helper', 'helpers', false, false, false, NULL),
  ('00000000-0000-0000-0000-0000003630a6', 'sam@jobnotetags.test', 'Sam Sub', 'subcontractor', false, false, false, NULL),
  ('00000000-0000-0000-0000-0000003630a7', 'priya@jobnotetags.test', 'Priya Estimator', 'estimator', false, false, false, NULL),
  ('00000000-0000-0000-0000-0000003630a8', 'gwen@jobnotetags.test', 'Gwen Gone', 'assistant', false, false, false, now()),
  ('00000000-0000-0000-0000-0000003630a9', 'tess@jobnotetags.test', 'Tess Twin', 'assistant', false, true, false, NULL),
  ('00000000-0000-0000-0000-0000003630aa', 'sal@jobnotetags.test', 'Sal Sample', 'helpers', false, false, true, NULL),
  ('00000000-0000-0000-0000-0000003630ab', 'devon@jobnotetags.test', 'Devon Dev', 'dev', false, false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000003630f9', 'Job Note Tags Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name) VALUES
  ('00000000-0000-0000-0000-0000003630b1', '00000000-0000-0000-0000-0000003630a2', '00000000-0000-0000-0000-0000003630f9', 'Cedar Bluff Lofts');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000003630b1', '00000000-0000-0000-0000-0000003630a3'),
  ('00000000-0000-0000-0000-0000003630b1', '00000000-0000-0000-0000-0000003630a4'),
  ('00000000-0000-0000-0000-0000003630b1', '00000000-0000-0000-0000-0000003630a6'),
  ('00000000-0000-0000-0000-0000003630b1', '00000000-0000-0000-0000-0000003630aa')
  ON CONFLICT DO NOTHING;
-- A note Dana posted ten minutes ago, for the "not afterwards" refusal.
INSERT INTO public.jobs_ledger_thread_notes (id, job_id, author_user_id, body, created_at) VALUES
  ('00000000-0000-0000-0000-0000003630c1', '00000000-0000-0000-0000-0000003630b1', '00000000-0000-0000-0000-0000003630a1', 'on going', now() - interval '10 minutes');

CREATE SCHEMA jnt;
CREATE FUNCTION jnt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION jnt.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION jnt.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The list as one line, in the order the function hands it back.
CREATE FUNCTION jnt.list() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(t.name || ':' || t.on_job, ', ' ORDER BY t.ord), '')
  FROM public.job_note_taggable('00000000-0000-0000-0000-0000003630b1') WITH ORDINALITY AS t(user_id, name, role, on_job, ord)
$$;
-- The caller's section as one line: kind, who is tagged, how it cleared.
CREATE FUNCTION jnt.mine() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(m.kind || ' ' || m.tagged_name || ' ' || coalesce(m.cleared_how, 'open'), ', ' ORDER BY m.created_at, m.tagged_name), '')
  FROM public.job_note_tags_mine() m
$$;
GRANT USAGE ON SCHEMA jnt TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA jnt TO authenticated, anon;

-- 0 · The new table carries its fences, and a second run of the migration left one policy of each.
SELECT jnt.same('the table has its archived fence', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'jobs_ledger_note_tags' AND policyname = 'archived_fence')::text, '1');
SELECT jnt.same('the table has one read policy of its own', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'jobs_ledger_note_tags' AND policyname = 'jobs_ledger_note_tags_select')::text, '1');
SELECT jnt.same('the table has its training-mode trigger', (SELECT (count(*) > 0)::text FROM pg_trigger WHERE tgrelid = 'public.jobs_ledger_note_tags'::regclass AND NOT tgisinternal), 'true');

-- 1 · The list Dana is offered: the crew first, then the office. No sub, estimator, archived person, twin or sample.
SELECT jnt.as_user('00000000-0000-0000-0000-0000003630a1');
SET LOCAL ROLE authenticated;
SELECT jnt.same('Dana''s list', jnt.list(), 'Hector Helper:true, Luis Lead:true, Marcus Master:true, Devon Dev:false');
RESET ROLE;

-- 2 · A dev is offered the sample login too, so a walk is whole.
SELECT jnt.as_user('00000000-0000-0000-0000-0000003630ab');
SET LOCAL ROLE authenticated;
SELECT jnt.same('Devon''s list', jnt.list(), 'Hector Helper:true, Luis Lead:true, Marcus Master:true, Sal Sample:true, Dana Office:false');
RESET ROLE;

-- 3 · A sub on the crew and a helper on no job are refused the list. Nobody signed out may ask.
SELECT jnt.as_user('00000000-0000-0000-0000-0000003630a6');
SET LOCAL ROLE authenticated;
SELECT jnt.refused('Sam''s list', $q$SELECT jnt.list()$q$, 'Only the office and this job');
RESET ROLE;
SELECT jnt.as_user('00000000-0000-0000-0000-0000003630a5');
SET LOCAL ROLE authenticated;
SELECT jnt.refused('Hana''s list', $q$SELECT jnt.list()$q$, 'Only the office and this job');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT jnt.refused('the list, signed out', $q$SELECT * FROM public.job_note_taggable('00000000-0000-0000-0000-0000003630b1')$q$, 'permission denied');
RESET ROLE;

-- 4 · Dana posts a note that tags Luis and Hector. Tagging herself adds nothing.
SELECT jnt.as_user('00000000-0000-0000-0000-0000003630a1');
SET LOCAL ROLE authenticated;
SELECT public.job_note_post_tagged('00000000-0000-0000-0000-0000003630b1', '  Is the meter set Tuesday? @Luis Lead @Hector Helper  ',
  ARRAY['00000000-0000-0000-0000-0000003630a3', '00000000-0000-0000-0000-0000003630a4', '00000000-0000-0000-0000-0000003630a1', '00000000-0000-0000-0000-0000003630a3']::uuid[]);
SELECT jnt.same('the note is on the job, trimmed', (SELECT count(*) FROM public.jobs_ledger_thread_notes WHERE job_id = '00000000-0000-0000-0000-0000003630b1' AND body = 'Is the meter set Tuesday? @Luis Lead @Hector Helper')::text, '1');
SELECT jnt.same('two tags, each with the name as written', (SELECT string_agg(tagged_name, ', ' ORDER BY tagged_name) FROM public.jobs_ledger_note_tags), 'Hector Helper, Luis Lead');
SELECT jnt.same('nothing counts for Dana yet', public.job_note_tags_count()::text, '0');
SELECT jnt.same('Dana''s section', jnt.mine(), 'asked Hector Helper open, asked Luis Lead open');

-- 5 · A person the list does not offer is refused, and that note is not posted.
SELECT jnt.refused('tagging a sub', $q$SELECT public.job_note_post_tagged('00000000-0000-0000-0000-0000003630b1', 'Sam, a question @Sam Sub', ARRAY['00000000-0000-0000-0000-0000003630a6']::uuid[])$q$, 'Sam Sub cannot be tagged on this job');
SELECT jnt.refused('tagging an estimator', $q$SELECT public.job_note_post_tagged('00000000-0000-0000-0000-0000003630b1', 'Priya, a question', ARRAY['00000000-0000-0000-0000-0000003630a7']::uuid[])$q$, 'Priya Estimator cannot be tagged');
SELECT jnt.refused('tagging a sample login as the office', $q$SELECT public.job_note_post_tagged('00000000-0000-0000-0000-0000003630b1', 'Sal, a question', ARRAY['00000000-0000-0000-0000-0000003630aa']::uuid[])$q$, 'Sal Sample cannot be tagged');
SELECT jnt.refused('tagging a helper on no job', $q$SELECT public.job_note_post_tagged('00000000-0000-0000-0000-0000003630b1', 'Hana, a question', ARRAY['00000000-0000-0000-0000-0000003630a5']::uuid[])$q$, 'Hana Helper cannot be tagged');
SELECT jnt.same('no refused note was posted', (SELECT count(*) FROM public.jobs_ledger_thread_notes WHERE job_id = '00000000-0000-0000-0000-0000003630b1' AND body LIKE '%a question%')::text, '0');
SELECT jnt.refused('an empty note', $q$SELECT public.job_note_post_tagged('00000000-0000-0000-0000-0000003630b1', '   ', '{}'::uuid[])$q$, 'Write the note first');

-- 6 · No client writes a tag row, and a tag is not added to a note afterwards or to someone else's note.
SELECT jnt.refused('a tag row by hand', $q$INSERT INTO public.jobs_ledger_note_tags (note_id, job_id, tagged_user_id, tagged_name, tagger_user_id) VALUES ('00000000-0000-0000-0000-0000003630c1', '00000000-0000-0000-0000-0000003630b1', '00000000-0000-0000-0000-0000003630a3', 'Luis Lead', '00000000-0000-0000-0000-0000003630a1')$q$, 'permission denied');
SELECT jnt.refused('clearing a tag by hand', $q$UPDATE public.jobs_ledger_note_tags SET cleared_at = now(), cleared_how = 'done'$q$, 'permission denied');
SELECT jnt.refused('a tag on a note ten minutes old', $q$SELECT public.job_note_tags_write('00000000-0000-0000-0000-0000003630c1', ARRAY['00000000-0000-0000-0000-0000003630a3']::uuid[])$q$, 'not afterwards');
SELECT jnt.refused('the list function behind it', $q$SELECT * FROM public.job_note_people('00000000-0000-0000-0000-0000003630b1', true)$q$, 'permission denied');
RESET ROLE;

-- 7 · Luis sees it waiting. Reading it, and a plain note such as a stamp, clear nothing.
SELECT jnt.as_user('00000000-0000-0000-0000-0000003630a3');
SET LOCAL ROLE authenticated;
SELECT jnt.same('one waits on Luis', public.job_note_tags_count()::text, '1');
SELECT jnt.same('Luis''s section', jnt.mine(), 'waiting Luis Lead open');
SELECT jnt.same('it carries the note and who asked', (SELECT note_body || ' / ' || tagger_name || ' / ' || job_name FROM public.job_note_tags_mine()), 'Is the meter set Tuesday? @Luis Lead @Hector Helper / Dana Office / Cedar Bluff Lofts');
SELECT jnt.refused('Luis tagging in Dana''s note', $q$SELECT public.job_note_tags_write((SELECT note_id FROM public.job_note_tags_mine() LIMIT 1), '{}'::uuid[])$q$, 'Only the note');
INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body) VALUES
  ('00000000-0000-0000-0000-0000003630b1', '00000000-0000-0000-0000-0000003630a3', 'Arrived');
SELECT jnt.same('a plain insert clears nothing', public.job_note_tags_count()::text, '1');

-- 8 · Luis answers on the job: his tag clears, Hector's does not.
SELECT public.job_note_post_tagged('00000000-0000-0000-0000-0000003630b1', 'Yes, Tuesday at 8.');
SELECT jnt.same('nothing waits on Luis', public.job_note_tags_count()::text, '0');
SELECT jnt.same('Luis''s section is empty', jnt.mine(), '');
RESET ROLE;

-- 9 · The answer counts for Dana until she has seen it. Seeing it twice changes nothing.
SELECT jnt.as_user('00000000-0000-0000-0000-0000003630a1');
SET LOCAL ROLE authenticated;
SELECT jnt.same('the answer counts for Dana', public.job_note_tags_count()::text, '1');
SELECT jnt.same('Dana''s section after the answer', jnt.mine(), 'asked Hector Helper open, asked Luis Lead answered');
SELECT jnt.same('it carries the answer', (SELECT answer_body FROM public.job_note_tags_mine() WHERE cleared_how = 'answered'), 'Yes, Tuesday at 8.');
SELECT jnt.same('Dana sees one answer', public.job_note_tags_seen()::text, '1');
SELECT jnt.same('seen, it stops counting', public.job_note_tags_count()::text, '0');
SELECT jnt.same('a second look marks none', public.job_note_tags_seen()::text, '0');
SELECT jnt.same('the answered line stays for the week', jnt.mine(), 'asked Hector Helper open, asked Luis Lead answered');
RESET ROLE;

-- 10 · Hector presses No reply needed, once. He cannot clear a tag that is not his.
SELECT jnt.as_user('00000000-0000-0000-0000-0000003630a4');
SET LOCAL ROLE authenticated;
SELECT jnt.same('one waits on Hector', public.job_note_tags_count()::text, '1');
SELECT jnt.same('No reply needed clears it', public.job_note_tag_done((SELECT tag_id FROM public.job_note_tags_mine() WHERE kind = 'waiting'))::text, 'true');
SELECT jnt.same('nothing waits on Hector', public.job_note_tags_count()::text, '0');
SELECT jnt.same('a tag that is not his', public.job_note_tag_done((SELECT id FROM public.jobs_ledger_note_tags WHERE tagged_name = 'Luis Lead' LIMIT 1))::text, 'false');
SELECT jnt.same('Hector reads the job''s tags, his and Luis''s', (SELECT count(*) FROM public.jobs_ledger_note_tags)::text, '2');
RESET ROLE;

-- 11 · Dana sees who pressed it. A helper on no job reads no tag.
SELECT jnt.as_user('00000000-0000-0000-0000-0000003630a1');
SET LOCAL ROLE authenticated;
SELECT jnt.same('Dana''s section after No reply needed', jnt.mine(), 'asked Hector Helper done, asked Luis Lead answered');
SELECT jnt.same('it counts until seen', public.job_note_tags_count()::text, '1');
SELECT jnt.same('Dana sees it', public.job_note_tags_seen()::text, '1');
RESET ROLE;
SELECT jnt.as_user('00000000-0000-0000-0000-0000003630a5');
SET LOCAL ROLE authenticated;
SELECT jnt.same('Hana reads no tag', (SELECT count(*) FROM public.jobs_ledger_note_tags)::text, '0');
SELECT jnt.same('Hana''s section is empty', jnt.mine(), '');
RESET ROLE;

-- 12 · A question back: Hector answers a new tag and tags Dana in the same note.
SELECT jnt.as_user('00000000-0000-0000-0000-0000003630a1');
SET LOCAL ROLE authenticated;
SELECT public.job_note_post_tagged('00000000-0000-0000-0000-0000003630b1', '@Hector Helper is the valve in?', ARRAY['00000000-0000-0000-0000-0000003630a4']::uuid[]);
RESET ROLE;
SELECT jnt.as_user('00000000-0000-0000-0000-0000003630a4');
SET LOCAL ROLE authenticated;
SELECT public.job_note_post_tagged('00000000-0000-0000-0000-0000003630b1', '@Dana Office which valve?', ARRAY['00000000-0000-0000-0000-0000003630a1']::uuid[]);
SELECT jnt.same('Hector''s own tag is answered', public.job_note_tags_count()::text, '0');
SELECT jnt.same('and he waits on Dana', jnt.mine(), 'asked Dana Office open');
RESET ROLE;
SELECT jnt.as_user('00000000-0000-0000-0000-0000003630a1');
SET LOCAL ROLE authenticated;
SELECT jnt.same('Dana: one answer unseen and one tag waiting', public.job_note_tags_count()::text, '2');
RESET ROLE;

-- 12b · The job window's path (migration *_job_note_tags_from_the_job_window): a note the phone kept for three hours
-- lands with its pressed time and still carries its tag. A press that is not a typed note answers nothing. A typed
-- one answers. A person who cannot be tagged refuses the whole press.
SELECT jnt.as_user('00000000-0000-0000-0000-0000003630a3');
SET LOCAL ROLE authenticated;
SELECT public.land_field_press('00000000-0000-0000-0000-0000003630e1', 'job_note', now() - interval '3 hours',
  jsonb_build_object('job_id', '00000000-0000-0000-0000-0000003630b1', 'body', '@Dana Office from the phone', 'typed', true, 'tagged', jsonb_build_array('00000000-0000-0000-0000-0000003630a1')));
SELECT jnt.same('the late note carries its tag', (SELECT count(*) FROM public.jobs_ledger_note_tags t JOIN public.jobs_ledger_thread_notes n ON n.id = t.note_id WHERE n.body = '@Dana Office from the phone' AND t.tagged_name = 'Dana Office' AND n.created_at < now() - interval '2 hours')::text, '1');
SELECT jnt.refused('a press that tags a sub', $q$SELECT public.land_field_press('00000000-0000-0000-0000-0000003630e2', 'job_note', now(), jsonb_build_object('job_id', '00000000-0000-0000-0000-0000003630b1', 'body', 'Sam, from the phone', 'typed', true, 'tagged', jsonb_build_array('00000000-0000-0000-0000-0000003630a6')))$q$, 'Sam Sub cannot be tagged');
SELECT jnt.same('the refused press left no note', (SELECT count(*) FROM public.jobs_ledger_thread_notes WHERE body = 'Sam, from the phone')::text, '0');
RESET ROLE;
SELECT jnt.as_user('00000000-0000-0000-0000-0000003630a1');
SET LOCAL ROLE authenticated;
SELECT jnt.same('Dana: one answer unseen and two tags waiting', public.job_note_tags_count()::text, '3');
SELECT public.land_field_press('00000000-0000-0000-0000-0000003630e3', 'job_note', now(), jsonb_build_object('job_id', '00000000-0000-0000-0000-0000003630b1', 'body', 'Arrived'));
SELECT jnt.same('a press with no typed mark answers nothing', public.job_note_tags_count()::text, '3');
SELECT public.land_field_press('00000000-0000-0000-0000-0000003630e4', 'job_note', now(), jsonb_build_object('job_id', '00000000-0000-0000-0000-0000003630b1', 'body', 'The upstairs valve, and yes.', 'typed', true));
SELECT jnt.same('a typed note from the job window answers both', public.job_note_tags_count()::text, '1');
SELECT jnt.same('the same press again answers once', (public.land_field_press('00000000-0000-0000-0000-0000003630e4', 'job_note', now(), jsonb_build_object('job_id', '00000000-0000-0000-0000-0000003630b1', 'body', 'The upstairs valve, and yes.', 'typed', true)) ->> 'repeat'), 'true');
RESET ROLE;

-- 13 · Hector is taken off the crew while a tag waits on him. He reads no note on the job, and still reads that one.
SELECT jnt.as_user('00000000-0000-0000-0000-0000003630ab');
SET LOCAL ROLE authenticated;
SELECT public.job_note_post_tagged('00000000-0000-0000-0000-0000003630b1', '@Hector Helper @Sal Sample bring the press tool', ARRAY['00000000-0000-0000-0000-0000003630a4', '00000000-0000-0000-0000-0000003630aa']::uuid[]);
RESET ROLE;
DELETE FROM public.jobs_ledger_team_members WHERE job_id = '00000000-0000-0000-0000-0000003630b1' AND user_id = '00000000-0000-0000-0000-0000003630a4';
SELECT jnt.as_user('00000000-0000-0000-0000-0000003630a4');
SET LOCAL ROLE authenticated;
SELECT jnt.same('off the crew, Hector reads none of the job''s notes', (SELECT count(*) FROM public.jobs_ledger_thread_notes WHERE job_id = '00000000-0000-0000-0000-0000003630b1')::text, '0');
SELECT jnt.same('the tag still waits on him, with its note', (SELECT string_agg(note_body, ' | ') FROM public.job_note_tags_mine() WHERE kind = 'waiting'), '@Hector Helper @Sal Sample bring the press tool');
SELECT jnt.refused('off the crew, Hector''s list', $q$SELECT jnt.list()$q$, 'Only the office and this job');
RESET ROLE;

-- 14 · The sample login, tagged by the dev, is offered the dev back.
SELECT jnt.as_user('00000000-0000-0000-0000-0000003630aa');
SET LOCAL ROLE authenticated;
SELECT jnt.same('one waits on Sal', public.job_note_tags_count()::text, '1');
SELECT jnt.same('Sal''s list', jnt.list(), 'Luis Lead:true, Marcus Master:true, Dana Office:false, Devon Dev:false');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'job_note_tags PASSED'; END $$;
ROLLBACK;
