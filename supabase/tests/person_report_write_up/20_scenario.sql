-- Write someone up (20261121131500, punch list #410): the ground under the phone sheet. Here: the list the sheet opens
-- on (the roster without the caller, each person with the newest job-day they shared with the caller, a
-- superintendent's project crew, nobody for another role); the one door a send lands through (who may, never about
-- themselves, a press that arrives twice lands once, the facts worked out on the server, every refusal in words); an
-- addition; and the writer taking one back. Made-up people, a made-up job and made-up words. Fixtures made as postgres;
-- the functions run as signed-in users, inside one transaction that rolls back. Raises on the first failed assertion;
-- ends with "person_report_write_up PASSED". See scripts/pgtest-person-report-write-up.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA wup;
CREATE FUNCTION wup.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION wup.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION wup.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- What the bed reads past RLS: a person's reports as "kind status by role", oldest first.
-- The scenario is one transaction, so every row's created_at is the same now(). The press ids are fixed and rise
-- in the order they are pressed, so they break the tie; the row's own id is random and would toss a coin.
CREATE FUNCTION wup.rows(p_person uuid) RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(string_agg(COALESCE(r.kind, 'none') || ' ' || r.status || ' by ' || COALESCE(r.author_role, 'none')
           || CASE WHEN r.adds_to IS NOT NULL THEN ' adds' ELSE '' END, ' | ' ORDER BY r.created_at, r.press_id, r.id), 'none')
  FROM public.person_reports r WHERE r.subject_person_id = p_person $$;
CREATE FUNCTION wup.one(p_press uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT to_jsonb(r) FROM public.person_reports r WHERE r.press_id = p_press $$;
-- One person's line of the list, as "name with_date job_name".
CREATE FUNCTION wup.line(p_list jsonb, p_person uuid) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE((SELECT (x->>'name') || ' ' || COALESCE(x->>'with_date', 'never') || ' ' || COALESCE(x->>'job_name', 'no job')
                     FROM jsonb_array_elements(p_list->'people') x WHERE x->>'person_id' = p_person::text), 'absent') $$;
GRANT USAGE ON SCHEMA wup TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA wup TO authenticated;

-- Who: a leader, a superintendent, two helpers, an assistant, a leader in training mode, a dev and a sample account.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000410d1', 'leader@writeup.test'),
  ('00000000-0000-0000-0000-0000000410d2', 'super@writeup.test'),
  ('00000000-0000-0000-0000-0000000410d3', 'helper1@writeup.test'),
  ('00000000-0000-0000-0000-0000000410d4', 'helper2@writeup.test'),
  ('00000000-0000-0000-0000-0000000410d5', 'office@writeup.test'),
  ('00000000-0000-0000-0000-0000000410d6', 'training@writeup.test'),
  ('00000000-0000-0000-0000-0000000410d7', 'dev@writeup.test'),
  ('00000000-0000-0000-0000-0000000410d8', 'sample@writeup.test');
INSERT INTO public.users (id, email, name, role, read_only, is_sample) VALUES
  ('00000000-0000-0000-0000-0000000410d1', 'leader@writeup.test', 'Marcus Leader', 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000410d2', 'super@writeup.test', 'Sal Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-0000000410d3', 'helper1@writeup.test', 'Dana Helper', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000000410d4', 'helper2@writeup.test', 'Luis Helper', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000000410d5', 'office@writeup.test', 'Rosa Office', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000410d6', 'training@writeup.test', 'Tess Training', 'master_technician', true, false),
  ('00000000-0000-0000-0000-0000000410d7', 'dev@writeup.test', 'Write Up Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000410d8', 'sample@writeup.test', 'Sample helper', 'helpers', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_sample = EXCLUDED.is_sample;
INSERT INTO public.people (id, master_user_id, kind, name, account_user_id) VALUES
  ('00000000-0000-0000-0000-0000000410b1', '00000000-0000-0000-0000-0000000410d7', 'master_technician', 'Marcus Leader', '00000000-0000-0000-0000-0000000410d1'),
  ('00000000-0000-0000-0000-0000000410b2', '00000000-0000-0000-0000-0000000410d7', 'superintendent', 'Sal Super', '00000000-0000-0000-0000-0000000410d2'),
  ('00000000-0000-0000-0000-0000000410b3', '00000000-0000-0000-0000-0000000410d7', 'helper', 'Dana Helper', '00000000-0000-0000-0000-0000000410d3'),
  ('00000000-0000-0000-0000-0000000410b4', '00000000-0000-0000-0000-0000000410d7', 'helper', 'Luis Helper', '00000000-0000-0000-0000-0000000410d4'),
  ('00000000-0000-0000-0000-0000000410b8', '00000000-0000-0000-0000-0000000410d7', 'helper', 'Sample helper', '00000000-0000-0000-0000-0000000410d8'),
  ('00000000-0000-0000-0000-0000000410b9', '00000000-0000-0000-0000-0000000410d7', 'sub', 'Nate No Login', NULL);

-- A plain job the leader runs today with Dana, and a project job the superintendent is assigned to, where Luis clocked.
INSERT INTO public.customers (id, name, master_user_id, contact_info) VALUES
  ('00000000-0000-0000-0000-0000000410c1', 'Write Up Ridgeway Builders', '00000000-0000-0000-0000-0000000410d7', '{}');
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000410f9', 'Write Up Bed Work');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000410a1', 'Write Up Cedar Hollow', '00000000-0000-0000-0000-0000000410c1');
INSERT INTO public.project_superintendents (project_id, superintendent_id) VALUES
  ('00000000-0000-0000-0000-0000000410a1', '00000000-0000-0000-0000-0000000410d2');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, customer_id, project_id) VALUES
  ('00000000-0000-0000-0000-0000000410e1', '00000000-0000-0000-0000-0000000410d7', '00000000-0000-0000-0000-0000000410f9', 'Mill Road Duplex', '00000000-0000-0000-0000-0000000410c1', NULL),
  ('00000000-0000-0000-0000-0000000410e2', '00000000-0000-0000-0000-0000000410d7', '00000000-0000-0000-0000-0000000410f9', 'Cedar Hollow Lot 14', '00000000-0000-0000-0000-0000000410c1', '00000000-0000-0000-0000-0000000410a1');
INSERT INTO public.job_schedule_blocks (job_id, assignee_user_id, work_date, time_start, time_end) VALUES
  ('00000000-0000-0000-0000-0000000410e1', '00000000-0000-0000-0000-0000000410d1', (now() AT TIME ZONE 'America/Chicago')::date, '07:00', '15:00'),
  ('00000000-0000-0000-0000-0000000410e1', '00000000-0000-0000-0000-0000000410d3', (now() AT TIME ZONE 'America/Chicago')::date, '07:00', '15:00');
INSERT INTO public.clock_sessions (user_id, job_ledger_id, clocked_in_at, work_date, notes) VALUES
  ('00000000-0000-0000-0000-0000000410d1', '00000000-0000-0000-0000-0000000410e1', now() - interval '2 hours', (now() AT TIME ZONE 'America/Chicago')::date, ''),
  ('00000000-0000-0000-0000-0000000410d4', '00000000-0000-0000-0000-0000000410e2', now() - interval '3 hours', (now() AT TIME ZONE 'America/Chicago')::date, '');

SET LOCAL ROLE authenticated;

-- ── the list ────────────────────────────────────────────────────────────────────────────────
SELECT wup.as_user('00000000-0000-0000-0000-0000000410d1');
SELECT wup.same('a leader may open the list', (public.write_up_people()->>'allowed'), 'true');
SELECT wup.same('the helper listed with the leader today comes with the day and the job',
  wup.line(public.write_up_people(), '00000000-0000-0000-0000-0000000410b3'),
  'Dana Helper ' || (now() AT TIME ZONE 'America/Chicago')::date || ' Mill Road Duplex');
SELECT wup.same('a helper on another job is on the roster with no shared day',
  wup.line(public.write_up_people(), '00000000-0000-0000-0000-0000000410b4'), 'Luis Helper never no job');
SELECT wup.same('a person with no login is on the list',
  wup.line(public.write_up_people(), '00000000-0000-0000-0000-0000000410b9'), 'Nate No Login never no job');
SELECT wup.same('the caller is not on their own list',
  wup.line(public.write_up_people(), '00000000-0000-0000-0000-0000000410b1'), 'absent');
SELECT wup.same('a sample account is not on the list',
  wup.line(public.write_up_people(), '00000000-0000-0000-0000-0000000410b8'), 'absent');
SELECT wup.same('the leader''s own jobs of the week come with it',
  (SELECT string_agg(x->>'job_name', ',') FROM jsonb_array_elements(public.write_up_people()->'jobs') x), 'Mill Road Duplex');

SELECT wup.as_user('00000000-0000-0000-0000-0000000410d2');
SELECT wup.same('a superintendent sees who clocked on a job of their project',
  wup.line(public.write_up_people(), '00000000-0000-0000-0000-0000000410b4'),
  'Luis Helper ' || (now() AT TIME ZONE 'America/Chicago')::date || ' Cedar Hollow Lot 14');
SELECT wup.same('and not the crew of a job outside it',
  wup.line(public.write_up_people(), '00000000-0000-0000-0000-0000000410b3'), 'Dana Helper never no job');

SELECT wup.as_user('00000000-0000-0000-0000-0000000410d5');
SELECT wup.same('the office gets no list', (public.write_up_people()->>'allowed') || ' ' || jsonb_array_length(public.write_up_people()->'people'), 'false 0');

-- ── a send ──────────────────────────────────────────────────────────────────────────────────
SELECT wup.as_user('00000000-0000-0000-0000-0000000410d1');
SELECT wup.same('a leader''s write-up lands and waits',
  (public.land_person_report(jsonb_build_object(
    'press_id', '00000000-0000-0000-0000-00000041aaa1', 'subject_person_id', '00000000-0000-0000-0000-0000000410b3',
    'kind', 'safety', 'content', '  The trench by the east wall was open at lunch with no cones.  ',
    'occurred_date', (now() AT TIME ZONE 'America/Chicago')::date, 'occurred_time', '12:20',
    'job_ledger_id', '00000000-0000-0000-0000-0000000410e1', 'job_label', 'Mill Road Duplex',
    'author_saw_it', true, 'talked_to_person', true,
    'seen_by', jsonb_build_array(
      jsonb_build_object('person_id', '00000000-0000-0000-0000-0000000410b4', 'name', 'Luis Helper'),
      jsonb_build_object('name', '   '),
      jsonb_build_object('person_id', 'not-an-id', 'name', 'The framer on site')))) - 'id')::text,
  '{"status": "pending", "already": false}');
SELECT wup.same('the row keeps the writer, the role and the facts',
  (SELECT (r->>'author_name') || ' / ' || (r->>'author_role') || ' / ' || (r->>'kind') || ' / ' || (r->>'occurred_time') || ' / ' || (r->>'job_label')
          || ' / saw ' || (r->>'author_saw_it') || ' / talked ' || (r->>'talked_to_person') || ' / on job ' || (r->>'author_on_job')
     FROM wup.one('00000000-0000-0000-0000-00000041aaa1') r),
  'Marcus Leader / master_technician / safety / 12:20:00 / Mill Road Duplex / saw true / talked true / on job true');
SELECT wup.same('the words are trimmed',
  (wup.one('00000000-0000-0000-0000-00000041aaa1')->>'content'), 'The trench by the east wall was open at lunch with no cones.');
SELECT wup.same('who saw it is kept as names, a blank one dropped and a bad id left out',
  (wup.one('00000000-0000-0000-0000-00000041aaa1')->'seen_by')::text,
  '[{"name": "Luis Helper", "person_id": "00000000-0000-0000-0000-0000000410b4"}, {"name": "The framer on site"}]');
SELECT wup.same('the same press again answers already, with the same row',
  (public.land_person_report(jsonb_build_object(
    'press_id', '00000000-0000-0000-0000-00000041aaa1', 'subject_person_id', '00000000-0000-0000-0000-0000000410b3',
    'kind', 'safety', 'content', 'A second arrival of the same press.',
    'occurred_date', (now() AT TIME ZONE 'America/Chicago')::date))->>'already'), 'true');
SELECT wup.same('and one row stands', wup.rows('00000000-0000-0000-0000-0000000410b3'), 'safety pending by master_technician');
SELECT wup.same('the writer reads their own report through the table',
  (SELECT count(*)::text FROM public.person_reports WHERE press_id = '00000000-0000-0000-0000-00000041aaa1'), '1');

SELECT wup.refused('a write-up about yourself',
  $q$SELECT public.land_person_report(jsonb_build_object('press_id', '00000000-0000-0000-0000-00000041aaa2', 'subject_person_id', '00000000-0000-0000-0000-0000000410b1', 'kind', 'other', 'content', 'About me.', 'occurred_date', (now() AT TIME ZONE 'America/Chicago')::date))$q$,
  'You cannot write yourself up.');
SELECT wup.refused('a kind off the list',
  $q$SELECT public.land_person_report(jsonb_build_object('press_id', '00000000-0000-0000-0000-00000041aaa3', 'subject_person_id', '00000000-0000-0000-0000-0000000410b3', 'kind', 'lazy', 'content', 'Words.', 'occurred_date', (now() AT TIME ZONE 'America/Chicago')::date))$q$,
  'Pick what kind of thing it was.');
SELECT wup.refused('no words',
  $q$SELECT public.land_person_report(jsonb_build_object('press_id', '00000000-0000-0000-0000-00000041aaa3', 'subject_person_id', '00000000-0000-0000-0000-0000000410b3', 'kind', 'other', 'content', '   ', 'occurred_date', (now() AT TIME ZONE 'America/Chicago')::date))$q$,
  'Say what you saw.');
SELECT wup.refused('a day after today',
  $q$SELECT public.land_person_report(jsonb_build_object('press_id', '00000000-0000-0000-0000-00000041aaa3', 'subject_person_id', '00000000-0000-0000-0000-0000000410b3', 'kind', 'other', 'content', 'Words.', 'occurred_date', (now() AT TIME ZONE 'America/Chicago')::date + 2))$q$,
  'cannot be after today');
SELECT wup.refused('no press id',
  $q$SELECT public.land_person_report(jsonb_build_object('subject_person_id', '00000000-0000-0000-0000-0000000410b3', 'kind', 'other', 'content', 'Words.', 'occurred_date', (now() AT TIME ZONE 'America/Chicago')::date))$q$,
  'no press id');
SELECT wup.refused('a person off the roster',
  $q$SELECT public.land_person_report(jsonb_build_object('press_id', '00000000-0000-0000-0000-00000041aaa3', 'subject_person_id', '00000000-0000-0000-0000-00000041ffff', 'kind', 'other', 'content', 'Words.', 'occurred_date', (now() AT TIME ZONE 'America/Chicago')::date))$q$,
  'not on the roster');

-- A superintendent could not write a report before; the function is the door.
SELECT wup.as_user('00000000-0000-0000-0000-0000000410d2');
SELECT wup.same('a superintendent''s write-up lands, about a person with no login',
  (public.land_person_report(jsonb_build_object(
    'press_id', '00000000-0000-0000-0000-00000041bbb1', 'subject_person_id', '00000000-0000-0000-0000-0000000410b9',
    'kind', 'good_work', 'content', 'Stayed late to finish the trim so the inspection could happen Friday.',
    'occurred_date', (now() AT TIME ZONE 'America/Chicago')::date - 1))->>'status'), 'pending');
SELECT wup.same('with no job named, on the job reads false',
  (wup.one('00000000-0000-0000-0000-00000041bbb1')->>'author_on_job') || ' ' || (wup.one('00000000-0000-0000-0000-00000041bbb1')->>'author_role'), 'false superintendent');
SELECT wup.same('a superintendent reads only their own reports',
  (SELECT count(*)::text FROM public.person_reports), '1');
SELECT wup.refused('a superintendent taking back the leader''s write-up',
  $q$SELECT public.withdraw_person_report((SELECT (wup.one('00000000-0000-0000-0000-00000041aaa1')->>'id')::uuid), 'Not mine.')$q$,
  'only a write-up you wrote');
SELECT wup.refused('a superintendent adding to the leader''s write-up',
  $q$SELECT public.land_person_report(jsonb_build_object('press_id', '00000000-0000-0000-0000-00000041bbb2', 'subject_person_id', '00000000-0000-0000-0000-0000000410b3', 'kind', 'other', 'content', 'Words.', 'occurred_date', (now() AT TIME ZONE 'America/Chicago')::date, 'adds_to', wup.one('00000000-0000-0000-0000-00000041aaa1')->>'id'))$q$,
  'only to a write-up you wrote');
SELECT wup.refused('a superintendent using the leader''s press',
  $q$SELECT public.land_person_report(jsonb_build_object('press_id', '00000000-0000-0000-0000-00000041aaa1', 'subject_person_id', '00000000-0000-0000-0000-0000000410b3', 'kind', 'other', 'content', 'Words.', 'occurred_date', (now() AT TIME ZONE 'America/Chicago')::date))$q$,
  'belongs to another write-up');

-- Who may not.
SELECT wup.as_user('00000000-0000-0000-0000-0000000410d5');
SELECT wup.refused('the office through this door',
  $q$SELECT public.land_person_report(jsonb_build_object('press_id', '00000000-0000-0000-0000-00000041ccc1', 'subject_person_id', '00000000-0000-0000-0000-0000000410b3', 'kind', 'other', 'content', 'Words.', 'occurred_date', (now() AT TIME ZONE 'America/Chicago')::date))$q$,
  'Only a leader or a superintendent');
SELECT wup.as_user('00000000-0000-0000-0000-0000000410d3');
SELECT wup.refused('a helper through this door',
  $q$SELECT public.land_person_report(jsonb_build_object('press_id', '00000000-0000-0000-0000-00000041ccc2', 'subject_person_id', '00000000-0000-0000-0000-0000000410b4', 'kind', 'other', 'content', 'Words.', 'occurred_date', (now() AT TIME ZONE 'America/Chicago')::date))$q$,
  'Only a leader or a superintendent');
SELECT wup.same('and the person written up reads nothing',
  (SELECT count(*)::text FROM public.person_reports), '0');
SELECT wup.as_user('00000000-0000-0000-0000-0000000410d6');
SELECT wup.refused('a leader in training mode',
  $q$SELECT public.land_person_report(jsonb_build_object('press_id', '00000000-0000-0000-0000-00000041ccc3', 'subject_person_id', '00000000-0000-0000-0000-0000000410b3', 'kind', 'other', 'content', 'Words.', 'occurred_date', (now() AT TIME ZONE 'America/Chicago')::date))$q$,
  'Read-only (training) mode');

-- ── an addition, and taking one back ────────────────────────────────────────────────────────────
SELECT wup.as_user('00000000-0000-0000-0000-0000000410d1');
SELECT wup.same('the writer adds to their own write-up',
  (public.land_person_report(jsonb_build_object(
    'press_id', '00000000-0000-0000-0000-00000041aaa4', 'subject_person_id', '00000000-0000-0000-0000-0000000410b3',
    'kind', 'safety', 'content', 'The cones were back in the truck. Dana said nobody had asked for them.',
    'occurred_date', (now() AT TIME ZONE 'America/Chicago')::date,
    'adds_to', wup.one('00000000-0000-0000-0000-00000041aaa1')->>'id'))->>'status'), 'pending');
SELECT wup.refused('an addition about another person',
  $q$SELECT public.land_person_report(jsonb_build_object('press_id', '00000000-0000-0000-0000-00000041aaa5', 'subject_person_id', '00000000-0000-0000-0000-0000000410b4', 'kind', 'other', 'content', 'Words.', 'occurred_date', (now() AT TIME ZONE 'America/Chicago')::date, 'adds_to', wup.one('00000000-0000-0000-0000-00000041aaa1')->>'id'))$q$,
  'about the same person');
SELECT wup.refused('taking one back with no reason',
  $q$SELECT public.withdraw_person_report((SELECT (wup.one('00000000-0000-0000-0000-00000041aaa1')->>'id')::uuid), '  ')$q$,
  'Say why you are taking it back.');
SELECT wup.same('the writer takes one back',
  public.withdraw_person_report((wup.one('00000000-0000-0000-0000-00000041aaa1')->>'id')::uuid, 'I had the wrong person. It was dug by another crew.')::text,
  '{"status": "dismissed", "already": false}');
SELECT wup.same('it keeps its words and says why',
  (wup.one('00000000-0000-0000-0000-00000041aaa1')->>'content') || ' / ' || (wup.one('00000000-0000-0000-0000-00000041aaa1')->>'resolution_note'),
  'The trench by the east wall was open at lunch with no cones. / Taken back by the writer: I had the wrong person. It was dug by another crew.');
SELECT wup.same('taking it back twice changes nothing',
  public.withdraw_person_report((wup.one('00000000-0000-0000-0000-00000041aaa1')->>'id')::uuid, 'Again.')::text,
  '{"status": "dismissed", "already": true}');
SELECT wup.same('the two stand as rows, the first off the queue',
  wup.rows('00000000-0000-0000-0000-0000000410b3'), 'safety dismissed by master_technician | safety pending by master_technician adds');

-- A dev files what waits, as before: the door the office already has is untouched.
SELECT wup.as_user('00000000-0000-0000-0000-0000000410d7');
SELECT wup.same('a dev files the addition onto the file',
  (public.file_person_report((wup.one('00000000-0000-0000-0000-00000041aaa4')->>'id')::uuid)->>'status'), 'filed');
SELECT wup.as_user('00000000-0000-0000-0000-0000000410d1');
SELECT wup.same('a filed one cannot be taken back',
  public.withdraw_person_report((wup.one('00000000-0000-0000-0000-00000041aaa4')->>'id')::uuid, 'Too late.')::text,
  '{"status": "filed", "already": true}');

DO $$ BEGIN RAISE NOTICE 'person_report_write_up PASSED'; END $$;
ROLLBACK;
