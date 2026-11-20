-- Before we start (migration *_start_checks, punch list #382): the eight tables carry their fences; the desk writes
-- a stage's bullets, a yes, an ask and a day they gave; what each table refuses; Go and Hold through their one door,
-- with the name kept and a Hold moving our window; who reads what (the office, a primary and an estimator with and
-- without a claim, a superintendent on and off the job, the crew, a primary on the crew); the settings; a stage line
-- carrying its list to another job; and what goes with a line and a job. Fixtures are written as postgres; presses
-- run as each user; everything rolls back. Raises on the first failed assertion; ends with "start_checks PASSED".
-- See scripts/pgtest-start-checks.sh. Never against prod. Every name here is made up.
\set ON_ERROR_STOP 1
BEGIN;

-- Dana is the office (assistant). Marcus is a master and owns the site, Devon a dev, Cole the controller.
-- Pat is a primary and the account man on job 1; Paul is a primary with no claim. Priya estimates and has no claim.
-- Sam is a superintendent on job 1's team; Sid is a superintendent on no job. Hector is a helper on job 1's team;
-- Hank is a helper on no job. Tara is an assistant in training, Tess an assistant twin, Gwen an assistant who left.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000003820a1', 'dana@startchecks.test'),
  ('00000000-0000-0000-0000-0000003820a2', 'marcus@startchecks.test'),
  ('00000000-0000-0000-0000-0000003820a3', 'devon@startchecks.test'),
  ('00000000-0000-0000-0000-0000003820a4', 'cole@startchecks.test'),
  ('00000000-0000-0000-0000-0000003820a5', 'pat@startchecks.test'),
  ('00000000-0000-0000-0000-0000003820a6', 'paul@startchecks.test'),
  ('00000000-0000-0000-0000-0000003820a7', 'priya@startchecks.test'),
  ('00000000-0000-0000-0000-0000003820a8', 'sam@startchecks.test'),
  ('00000000-0000-0000-0000-0000003820a9', 'sid@startchecks.test'),
  ('00000000-0000-0000-0000-0000003820aa', 'hector@startchecks.test'),
  ('00000000-0000-0000-0000-0000003820ab', 'hank@startchecks.test'),
  ('00000000-0000-0000-0000-0000003820ac', 'tara@startchecks.test'),
  ('00000000-0000-0000-0000-0000003820ad', 'tess@startchecks.test'),
  ('00000000-0000-0000-0000-0000003820ae', 'gwen@startchecks.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  ('00000000-0000-0000-0000-0000003820a1', 'dana@startchecks.test', 'Dana Office', 'assistant', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003820a2', 'marcus@startchecks.test', 'Marcus Master', 'master_technician', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003820a3', 'devon@startchecks.test', 'Devon Dev', 'dev', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003820a4', 'cole@startchecks.test', 'Cole Controller', 'controller', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003820a5', 'pat@startchecks.test', 'Pat Primary', 'primary', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003820a6', 'paul@startchecks.test', 'Paul Primary', 'primary', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003820a7', 'priya@startchecks.test', 'Priya Estimator', 'estimator', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003820a8', 'sam@startchecks.test', 'Sam Super', 'superintendent', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003820a9', 'sid@startchecks.test', 'Sid Super', 'superintendent', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003820aa', 'hector@startchecks.test', 'Hector Helper', 'helpers', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003820ab', 'hank@startchecks.test', 'Hank Helper', 'helpers', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003820ac', 'tara@startchecks.test', 'Tara Training', 'assistant', true, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003820ad', 'tess@startchecks.test', 'Tess Twin', 'assistant', false, true, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003820ae', 'gwen@startchecks.test', 'Gwen Gone', 'assistant', false, false, false, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;

CREATE SCHEMA scb;
CREATE FUNCTION scb.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- Refused with these words; an empty want takes any refusal (a fence's own words are the fence's to choose).
CREATE FUNCTION scb.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF want <> '' AND position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n%\n--- want it to hold ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION scb.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What the caller reads: bullets, yeses, asks, days they gave, decisions, arrivals, as six counts.
CREATE FUNCTION scb.reads() RETURNS text LANGUAGE sql AS $$
  SELECT (SELECT count(*) FROM public.start_check_bullets)::text || ' bullets, ' || (SELECT count(*) FROM public.start_check_marks)::text || ' yeses, '
      || (SELECT count(*) FROM public.start_check_asks)::text || ' asks, ' || (SELECT count(*) FROM public.start_check_their_days)::text || ' days, '
      || (SELECT count(*) FROM public.start_check_decisions)::text || ' decisions, ' || (SELECT count(*) FROM public.start_check_arrivals)::text || ' arrivals'
$$;
GRANT USAGE ON SCHEMA scb TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA scb TO authenticated, anon;
SELECT (to_regprocedure('stub.marker()') IS NOT NULL) AS is_stub \gset

-- A site with one job on it, and a job on no site. Job 1 has two stage lines, job 2 one.
INSERT INTO public.developments (id, master_user_id, name) VALUES
  ('00000000-0000-0000-0000-0000003820d1', '00000000-0000-0000-0000-0000003820a2', 'Heron Point');
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000003820f9', 'Start Checks Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, development_id, account_manager_user_id) VALUES
  ('00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820a2', '00000000-0000-0000-0000-0000003820f9', 'Lodge plumbing', '00000000-0000-0000-0000-0000003820d1', '00000000-0000-0000-0000-0000003820a5'),
  ('00000000-0000-0000-0000-0000003820b2', '00000000-0000-0000-0000-0000003820a2', '00000000-0000-0000-0000-0000003820f9', 'A job on no site', NULL, NULL);
INSERT INTO public.jobs_ledger_fixtures (id, job_id, name) VALUES
  ('00000000-0000-0000-0000-0000003820c1', '00000000-0000-0000-0000-0000003820b1', 'Rough In'),
  ('00000000-0000-0000-0000-0000003820c2', '00000000-0000-0000-0000-0000003820b1', 'Top Out'),
  ('00000000-0000-0000-0000-0000003820c3', '00000000-0000-0000-0000-0000003820b2', 'Trim Set');
INSERT INTO public.job_stage_windows (id, job_id, fixture_id, window_start, window_end) VALUES
  ('00000000-0000-0000-0000-0000003820e1', '00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820c1', '2026-12-08', '2026-12-12');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820a8'),
  ('00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820aa');

-- 0 · The tables carry their fences, and the grants are the ones written.
\if :is_stub
\else
SELECT scb.same('every table has its archived fence', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename LIKE 'start\_check\_%' AND policyname = 'archived_fence')::text, '8');
SELECT scb.same('every table has a training-mode trigger', (SELECT count(DISTINCT tgrelid) FROM pg_trigger WHERE tgrelid IN ('public.start_check_templates'::regclass, 'public.start_check_bullets'::regclass, 'public.start_check_marks'::regclass, 'public.start_check_asks'::regclass, 'public.start_check_their_days'::regclass, 'public.start_check_decisions'::regclass, 'public.start_check_arrivals'::regclass, 'public.start_check_settings'::regclass) AND tgname = 'read_only_block_stmt')::text, '8');
\endif
-- The gates ask job_shut_to_me themselves, so no table here carries the short job_papers_fence.
SELECT scb.same('no table carries the short papers fence', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename LIKE 'start\_check\_%' AND policyname = 'job_papers_fence')::text, '0');
SELECT scb.same('bullets has one of each policy of its own', (SELECT string_agg(policyname, ', ' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'start_check_bullets' AND policyname LIKE 'start\_check\_bullets\_%'), 'start_check_bullets_delete, start_check_bullets_insert, start_check_bullets_select, start_check_bullets_update');
SELECT scb.same('anon holds nothing on the tables', (SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name LIKE 'start\_check\_%' AND grantee = 'anon')::text, '0');
SELECT scb.same('a signed-in person reads a decision and writes none', (SELECT string_agg(privilege_type, ', ' ORDER BY privilege_type) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'start_check_decisions' AND grantee = 'authenticated'), 'DELETE, SELECT');
SELECT scb.same('a day they gave can only be marked removed', (SELECT string_agg(column_name, ', ' ORDER BY column_name) FROM information_schema.column_privileges WHERE table_schema = 'public' AND table_name = 'start_check_their_days' AND grantee = 'authenticated' AND privilege_type = 'UPDATE'), 'removed_at, removed_by');
SELECT scb.same('anon runs neither door', (SELECT count(*) FROM information_schema.role_routine_grants WHERE routine_schema = 'public' AND routine_name IN ('start_check_decide', 'start_check_take_back', 'start_check_windows', 'start_checks_desk', 'start_checks_may_decide', 'start_checks_crew') AND grantee IN ('anon', 'PUBLIC'))::text, '0');

-- 1 · Dana, the office, writes the list on Rough In: one on them that asks for a photo, one on them, one of ours
-- read from the order log, one of ours ticked by hand.
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a1');
SET LOCAL ROLE authenticated;
INSERT INTO public.start_check_bullets (id, job_id, fixture_id, sort_order, words, waits_on, wants_photo, shown_to_gc, created_by, created_by_name) VALUES
  ('00000000-0000-0000-0000-000000382101', '00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820c1', 1, 'Framing is done and the roof is dried in.', 'them', true, true, '00000000-0000-0000-0000-0000003820a1', 'Dana Office'),
  ('00000000-0000-0000-0000-000000382102', '00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820c1', 2, 'Power is on for our tools.', 'them', false, true, '00000000-0000-0000-0000-0000003820a1', 'Dana Office');
INSERT INTO public.start_check_bullets (id, job_id, fixture_id, sort_order, words, waits_on, reads, created_by, created_by_name) VALUES
  ('00000000-0000-0000-0000-000000382103', '00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820c1', 3, 'Our material lands before day one.', 'us', 'order_log', '00000000-0000-0000-0000-0000003820a1', 'Dana Office'),
  ('00000000-0000-0000-0000-000000382104', '00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820c1', 4, 'The lift is booked.', 'us', 'hand', '00000000-0000-0000-0000-0000003820a1', 'Dana Office');
-- A bullet named for the wrong job lands on its stage line's job.
INSERT INTO public.start_check_bullets (id, job_id, fixture_id, words, waits_on, created_by) VALUES
  ('00000000-0000-0000-0000-000000382105', '00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820c3', 'The rooms we work in are finished and clear.', 'them', '00000000-0000-0000-0000-0000003820a1');
SELECT scb.same('a bullet takes its stage line''s job', (SELECT job_id::text FROM public.start_check_bullets WHERE id = '00000000-0000-0000-0000-000000382105'), '00000000-0000-0000-0000-0000003820b2');
SELECT scb.refused('a bullet of ours that asks for a photo', $q$INSERT INTO public.start_check_bullets (fixture_id, job_id, words, waits_on, reads, wants_photo, created_by) VALUES ('00000000-0000-0000-0000-0000003820c1', '00000000-0000-0000-0000-0000003820b1', 'x', 'us', 'trip', true, '00000000-0000-0000-0000-0000003820a1')$q$, 'start_check_bullets_ours_is_ours');
SELECT scb.refused('a bullet of ours shown to the GC', $q$INSERT INTO public.start_check_bullets (fixture_id, job_id, words, waits_on, reads, shown_to_gc, created_by) VALUES ('00000000-0000-0000-0000-0000003820c1', '00000000-0000-0000-0000-0000003820b1', 'x', 'us', 'trip', true, '00000000-0000-0000-0000-0000003820a1')$q$, 'start_check_bullets_ours_is_ours');
SELECT scb.refused('a bullet of ours that reads nothing', $q$INSERT INTO public.start_check_bullets (fixture_id, job_id, words, waits_on, created_by) VALUES ('00000000-0000-0000-0000-0000003820c1', '00000000-0000-0000-0000-0000003820b1', 'x', 'us', '00000000-0000-0000-0000-0000003820a1')$q$, 'start_check_bullets_ours_reads');
SELECT scb.refused('a bullet on them that reads the app', $q$INSERT INTO public.start_check_bullets (fixture_id, job_id, words, waits_on, reads, created_by) VALUES ('00000000-0000-0000-0000-0000003820c1', '00000000-0000-0000-0000-0000003820b1', 'x', 'them', 'permit', '00000000-0000-0000-0000-0000003820a1')$q$, 'start_check_bullets_ours_reads');
SELECT scb.refused('a hand tick on a bullet the app reads', $q$UPDATE public.start_check_bullets SET hand_ok = true WHERE id = '00000000-0000-0000-0000-000000382103'$q$, 'start_check_bullets_hand_tick');
SELECT scb.refused('a bullet with no words', $q$INSERT INTO public.start_check_bullets (fixture_id, job_id, words, waits_on, created_by) VALUES ('00000000-0000-0000-0000-0000003820c1', '00000000-0000-0000-0000-0000003820b1', '   ', 'them', '00000000-0000-0000-0000-0000003820a1')$q$, 'words');
SELECT scb.refused('a bullet written in another person''s name', $q$INSERT INTO public.start_check_bullets (fixture_id, job_id, words, waits_on, created_by) VALUES ('00000000-0000-0000-0000-0000003820c1', '00000000-0000-0000-0000-0000003820b1', 'x', 'them', '00000000-0000-0000-0000-0000003820a2')$q$, 'row-level security');
UPDATE public.start_check_bullets SET hand_ok = true, hand_ok_at = now(), hand_ok_by = '00000000-0000-0000-0000-0000003820a1', hand_ok_by_name = 'Dana Office' WHERE id = '00000000-0000-0000-0000-000000382104';
SELECT scb.same('a bullet ticked by hand is ticked', (SELECT hand_ok::text FROM public.start_check_bullets WHERE id = '00000000-0000-0000-0000-000000382104'), 'true');

-- 2 · A yes. One live yes a bullet; a yes on a bullet of ours is refused; a yes taken back stays as a row.
INSERT INTO public.start_check_marks (id, bullet_id, job_id, know, who_name, how, said_on, by_user, by_name) VALUES
  ('00000000-0000-0000-0000-000000382201', '00000000-0000-0000-0000-000000382102', '00000000-0000-0000-0000-0000003820b2', 'word', 'Ray', 'by phone', '2026-11-14', '00000000-0000-0000-0000-0000003820a1', 'Dana Office');
SELECT scb.same('a yes takes its bullet''s job', (SELECT job_id::text || ' ' || source FROM public.start_check_marks WHERE id = '00000000-0000-0000-0000-000000382201'), '00000000-0000-0000-0000-0000003820b1 office');
SELECT scb.refused('a second live yes on one bullet', $q$INSERT INTO public.start_check_marks (bullet_id, job_id, know, who_name, said_on, by_user) VALUES ('00000000-0000-0000-0000-000000382102', '00000000-0000-0000-0000-0000003820b1', 'saw', 'Luis', '2026-11-15', '00000000-0000-0000-0000-0000003820a1')$q$, 'start_check_marks_live_idx');
SELECT scb.refused('a yes on a bullet of ours', $q$INSERT INTO public.start_check_marks (bullet_id, job_id, know, who_name, said_on, by_user) VALUES ('00000000-0000-0000-0000-000000382103', '00000000-0000-0000-0000-0000003820b1', 'word', 'Dana', '2026-11-15', '00000000-0000-0000-0000-0000003820a1')$q$, 'Nobody ticks it');
SELECT scb.refused('the office writing a yes as their own press', $q$INSERT INTO public.start_check_marks (bullet_id, job_id, know, who_name, said_on, source, by_user) VALUES ('00000000-0000-0000-0000-000000382101', '00000000-0000-0000-0000-0000003820b1', 'word', 'Ray', '2026-11-15', 'portal', '00000000-0000-0000-0000-0000003820a1')$q$, 'row-level security');
SELECT scb.refused('a yes with a way of knowing that is not one of the three', $q$INSERT INTO public.start_check_marks (bullet_id, job_id, know, who_name, said_on, by_user) VALUES ('00000000-0000-0000-0000-000000382101', '00000000-0000-0000-0000-0000003820b1', 'guess', 'Ray', '2026-11-15', '00000000-0000-0000-0000-0000003820a1')$q$, 'know');
UPDATE public.start_check_marks SET who_name = 'Ray Ortiz', how = 'by text', said_on = '2026-11-15' WHERE id = '00000000-0000-0000-0000-000000382201';
UPDATE public.start_check_marks SET taken_back_at = now(), taken_back_by = '00000000-0000-0000-0000-0000003820a1', taken_back_by_name = 'Dana Office' WHERE id = '00000000-0000-0000-0000-000000382201';
INSERT INTO public.start_check_marks (id, bullet_id, job_id, know, who_name, how, said_on, by_user, by_name) VALUES
  ('00000000-0000-0000-0000-000000382202', '00000000-0000-0000-0000-000000382102', '00000000-0000-0000-0000-0000003820b1', 'saw', 'Luis', 'on site', '2026-11-16', '00000000-0000-0000-0000-0000003820a1', 'Dana Office');
SELECT scb.same('a yes taken back stays, and a new one stands beside it', (SELECT count(*)::text || ' rows, ' || count(*) FILTER (WHERE taken_back_at IS NULL)::text || ' live, the old one by ' || max(who_name) FILTER (WHERE taken_back_at IS NOT NULL) FROM public.start_check_marks WHERE bullet_id = '00000000-0000-0000-0000-000000382102'), '2 rows, 1 live, the old one by Ray Ortiz');

-- 3 · Every ask is kept: one press is one batch, a row a bullet. A hold note names no bullet. Nobody changes one.
INSERT INTO public.start_check_asks (batch_id, job_id, fixture_id, bullet_id, how, to_name, asked_on, by_user, by_name) VALUES
  ('00000000-0000-0000-0000-000000382301', '00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820c1', '00000000-0000-0000-0000-000000382101', 'text', 'Ray', '2026-11-16', '00000000-0000-0000-0000-0000003820a1', 'Dana Office'),
  ('00000000-0000-0000-0000-000000382301', '00000000-0000-0000-0000-0000003820b2', '00000000-0000-0000-0000-0000003820c3', '00000000-0000-0000-0000-000000382105', 'text', 'Ray', '2026-11-16', '00000000-0000-0000-0000-0000003820a1', 'Dana Office');
INSERT INTO public.start_check_asks (batch_id, job_id, fixture_id, kind, how, to_name, asked_on, by_user) VALUES
  ('00000000-0000-0000-0000-000000382302', '00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820c1', 'hold_note', 'email', 'Ray', '2026-11-17', '00000000-0000-0000-0000-0000003820a1');
SELECT scb.same('one ask across two stages is one batch', (SELECT count(*)::text || ' rows on ' || count(DISTINCT fixture_id)::text || ' stages' FROM public.start_check_asks WHERE batch_id = '00000000-0000-0000-0000-000000382301'), '2 rows on 2 stages');
SELECT scb.refused('an ask that names no bullet', $q$INSERT INTO public.start_check_asks (batch_id, job_id, fixture_id, how, to_name, asked_on, by_user) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820c1', 'text', 'Ray', '2026-11-16', '00000000-0000-0000-0000-0000003820a1')$q$, 'start_check_asks_names_a_bullet');
SELECT scb.refused('an ask sent a way that is not on the list', $q$INSERT INTO public.start_check_asks (batch_id, job_id, fixture_id, bullet_id, how, to_name, asked_on, by_user) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820c1', '00000000-0000-0000-0000-000000382101', 'pigeon', 'Ray', '2026-11-16', '00000000-0000-0000-0000-0000003820a1')$q$, 'how');
SELECT scb.refused('changing an ask', $q$UPDATE public.start_check_asks SET how = 'phone'$q$, 'permission denied');

-- 4 · Every day they gave is kept. One typed by mistake is marked removed, and nothing else about it changes.
INSERT INTO public.start_check_their_days (id, job_id, fixture_id, ready_day, said_on, who_name, how, by_user, by_name) VALUES
  ('00000000-0000-0000-0000-000000382401', '00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820c1', '2026-12-01', '2026-10-28', 'Ray', 'phone', '00000000-0000-0000-0000-0000003820a1', 'Dana Office'),
  ('00000000-0000-0000-0000-000000382402', '00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820c1', '2026-12-12', '2026-11-16', 'Ray', 'phone', '00000000-0000-0000-0000-0000003820a1', 'Dana Office');
SELECT scb.refused('changing a day they gave', $q$UPDATE public.start_check_their_days SET ready_day = '2026-12-02' WHERE id = '00000000-0000-0000-0000-000000382401'$q$, 'permission denied');
SELECT scb.refused('the office writing a day as their own press', $q$INSERT INTO public.start_check_their_days (job_id, fixture_id, ready_day, said_on, who_name, source, by_user) VALUES ('00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820c1', '2026-12-20', '2026-11-17', 'Ray', 'portal', '00000000-0000-0000-0000-0000003820a1')$q$, 'row-level security');
INSERT INTO public.start_check_their_days (id, job_id, fixture_id, ready_day, said_on, who_name, by_user) VALUES
  ('00000000-0000-0000-0000-000000382403', '00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820c1', '2027-12-12', '2026-11-17', 'Ray', '00000000-0000-0000-0000-0000003820a1');
UPDATE public.start_check_their_days SET removed_at = now(), removed_by = '00000000-0000-0000-0000-0000003820a1' WHERE id = '00000000-0000-0000-0000-000000382403';
SELECT scb.same('a day typed by mistake is marked, and kept', (SELECT count(*)::text || ' days, ' || count(*) FILTER (WHERE removed_at IS NULL)::text || ' standing' FROM public.start_check_their_days), '3 days, 2 standing');

-- 5 · Go and Hold. Nobody writes a decision by hand.
SELECT scb.refused('a decision written by hand', $q$INSERT INTO public.start_check_decisions (job_id, fixture_id, kind, decided_on, by_user) VALUES ('00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820c1', 'go', '2026-11-17', '00000000-0000-0000-0000-0000003820a1')$q$, 'permission denied');
SELECT scb.refused('a decision that is neither', $q$SELECT public.start_check_decide('00000000-0000-0000-0000-0000003820c1', 'maybe')$q$, 'A decision is Go or Hold.');
SELECT scb.refused('a Go that moves a day', $q$SELECT public.start_check_decide('00000000-0000-0000-0000-0000003820c1', 'go', '[]'::jsonb, '2026-12-15')$q$, 'A Go moves no day.');
SELECT scb.refused('what was open that is not a list', $q$SELECT public.start_check_decide('00000000-0000-0000-0000-0000003820c1', 'go', '{"a":1}'::jsonb)$q$, 'What was open is a list of bullets.');
SELECT scb.refused('a stage that is gone', $q$SELECT public.start_check_decide('00000000-0000-0000-0000-0000003820ff', 'go')$q$, 'That stage is gone.');
SELECT scb.refused('a hold with no day', $q$SELECT public.start_check_decide('00000000-0000-0000-0000-0000003820c1', 'hold')$q$, 'A hold needs the day our start moves to.');
SELECT scb.refused('a hold on a stage with no days of ours', $q$SELECT public.start_check_decide('00000000-0000-0000-0000-0000003820c2', 'hold', '[]'::jsonb, '2026-12-15')$q$, 'Plan our days for this stage first.');
RESET ROLE;

-- Sam, the job's superintendent, presses Go on their promise. The name and what was open are kept.
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a8'); SET LOCAL ROLE authenticated;
SELECT scb.same('the job''s superintendent presses Go, and the name is kept', (SELECT d.kind || ' by ' || d.by_name || ', ' || (d.decided_on = public.app_today())::text || ', open then ' || d.open_then::text || ', start then ' || d.start_then::text || ', ' || (d.by_user = '00000000-0000-0000-0000-0000003820a8')::text FROM public.start_check_decide('00000000-0000-0000-0000-0000003820c1', 'go', '["Framing is done and the roof is dried in."]'::jsonb) AS d), 'go by Sam Super, true, open then ["Framing is done and the roof is dried in."], start then 2026-12-08, true');
SELECT scb.same('a Go on a stage with no days is not blocked', (SELECT d.kind || ' ' || (d.start_then IS NULL)::text FROM public.start_check_decide('00000000-0000-0000-0000-0000003820c2', 'go') AS d), 'go true');
SELECT scb.refused('a superintendent deciding on a job that is not theirs', $q$SELECT public.start_check_decide('00000000-0000-0000-0000-0000003820c3', 'go')$q$, 'Go and Hold are for the office and the job''s superintendent.');
-- Take the Go back: the row stays, and a second call changes nothing.
SELECT scb.same('the Go is taken back, by name', (SELECT (t.taken_back_at IS NOT NULL)::text || ' ' || t.taken_back_by_name FROM public.start_check_take_back((SELECT id FROM public.start_check_decisions WHERE fixture_id = '00000000-0000-0000-0000-0000003820c1' AND kind = 'go')) AS t), 'true Sam Super');
RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a2'); SET LOCAL ROLE authenticated;
SELECT scb.same('taking it back again changes nothing', (SELECT t.taken_back_by_name FROM public.start_check_take_back((SELECT id FROM public.start_check_decisions WHERE fixture_id = '00000000-0000-0000-0000-0000003820c1' AND kind = 'go')) AS t), 'Sam Super');
SELECT scb.refused('taking back a decision that is gone', $q$SELECT public.start_check_take_back('00000000-0000-0000-0000-0000003820ff')$q$, 'That decision is gone.');
-- Marcus holds Rough In until Dec 15: the window moves and keeps its five days.
SELECT scb.same('a Hold keeps the day it moves to', (SELECT d.kind || ' until ' || d.hold_until::text || ', start then ' || d.start_then::text || ', by ' || d.by_name FROM public.start_check_decide('00000000-0000-0000-0000-0000003820c1', 'hold', '["Framing is done and the roof is dried in."]'::jsonb, '2026-12-15') AS d), 'hold until 2026-12-15, start then 2026-12-08, by Marcus Master');
RESET ROLE;
SELECT scb.same('the Hold moved our window and kept its length', (SELECT window_start::text || ' to ' || window_end::text || ' by ' || window_by FROM public.job_stage_windows WHERE id = '00000000-0000-0000-0000-0000003820e1'), '2026-12-15 to 2026-12-19 by office');
SELECT scb.same('three decisions are kept, one taken back', (SELECT count(*)::text || ' ' || count(*) FILTER (WHERE taken_back_at IS NOT NULL)::text FROM public.start_check_decisions), '3 1');

-- Who may not decide: a primary with a claim, an estimator, the crew, and the three accounts a definer must refuse.
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a5'); SET LOCAL ROLE authenticated;
SELECT scb.refused('a primary deciding, even on their own job', $q$SELECT public.start_check_decide('00000000-0000-0000-0000-0000003820c1', 'go')$q$, 'Go and Hold are for the office and the job''s superintendent.');
SELECT scb.refused('a primary taking a decision back', $q$SELECT public.start_check_take_back((SELECT id FROM public.start_check_decisions WHERE kind = 'hold'))$q$, 'Go and Hold are for the office and the job''s superintendent.'); RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a7'); SET LOCAL ROLE authenticated;
SELECT scb.refused('an estimator deciding', $q$SELECT public.start_check_decide('00000000-0000-0000-0000-0000003820c1', 'go')$q$, 'Go and Hold are for the office and the job''s superintendent.'); RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820aa'); SET LOCAL ROLE authenticated;
SELECT scb.refused('the crew deciding', $q$SELECT public.start_check_decide('00000000-0000-0000-0000-0000003820c1', 'go')$q$, 'Go and Hold are for the office and the job''s superintendent.'); RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820ac'); SET LOCAL ROLE authenticated;
SELECT scb.refused('a training account deciding', $q$SELECT public.start_check_decide('00000000-0000-0000-0000-0000003820c1', 'go')$q$, 'Training mode is read-only.');
SELECT scb.refused('a training account taking a decision back', $q$SELECT public.start_check_take_back('00000000-0000-0000-0000-0000003820ff')$q$, 'Training mode is read-only.'); RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820ad'); SET LOCAL ROLE authenticated;
SELECT scb.refused('a twin deciding', $q$SELECT public.start_check_decide('00000000-0000-0000-0000-0000003820c1', 'go')$q$, 'A digital twin decides no stage.');
SELECT scb.refused('a twin taking a decision back', $q$SELECT public.start_check_take_back('00000000-0000-0000-0000-0000003820ff')$q$, 'A digital twin decides no stage.'); RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820ae'); SET LOCAL ROLE authenticated;
SELECT scb.refused('someone who left deciding', $q$SELECT public.start_check_decide('00000000-0000-0000-0000-0000003820c1', 'go')$q$, 'This account is archived.');
SELECT scb.refused('someone who left taking a decision back', $q$SELECT public.start_check_take_back('00000000-0000-0000-0000-0000003820ff')$q$, 'This account is archived.'); RESET ROLE;
\if :is_stub
\else
SELECT scb.as_user('00000000-0000-0000-0000-0000003820ac'); SET LOCAL ROLE authenticated;
SELECT scb.refused('a training account writing a bullet', $q$INSERT INTO public.start_check_bullets (fixture_id, job_id, words, waits_on, created_by) VALUES ('00000000-0000-0000-0000-0000003820c1', '00000000-0000-0000-0000-0000003820b1', 'x', 'them', '00000000-0000-0000-0000-0000003820ac')$q$, ''); RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820ad'); SET LOCAL ROLE authenticated;
SELECT scb.refused('a twin writing a bullet', $q$INSERT INTO public.start_check_bullets (fixture_id, job_id, words, waits_on, created_by) VALUES ('00000000-0000-0000-0000-0000003820c1', '00000000-0000-0000-0000-0000003820b1', 'x', 'them', '00000000-0000-0000-0000-0000003820ad')$q$, ''); RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820ae'); SET LOCAL ROLE authenticated;
SELECT scb.same('someone who left reads nothing', scb.reads(), '0 bullets, 0 yeses, 0 asks, 0 days, 0 decisions, 0 arrivals'); RESET ROLE;
\endif

-- Our days, read for the desk: the office and the job's own people read the two days, and nobody else reads any.
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a5'); SET LOCAL ROLE authenticated;
SELECT scb.same('a primary with a claim reads our days on that job', (SELECT string_agg(window_start::text || ' to ' || window_end::text, ',') FROM public.start_check_windows(ARRAY['00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820b2']::uuid[])), '2026-12-15 to 2026-12-19'); RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a6'); SET LOCAL ROLE authenticated;
SELECT scb.same('a primary with no claim reads no day', (SELECT count(*)::text FROM public.start_check_windows(ARRAY['00000000-0000-0000-0000-0000003820b1']::uuid[])), '0'); RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820aa'); SET LOCAL ROLE authenticated;
SELECT scb.same('the crew reads no day', (SELECT count(*)::text FROM public.start_check_windows(ARRAY['00000000-0000-0000-0000-0000003820b1']::uuid[])), '0'); RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820ae'); SET LOCAL ROLE authenticated;
SELECT scb.same('someone who left reads no day', (SELECT count(*)::text FROM public.start_check_windows(ARRAY['00000000-0000-0000-0000-0000003820b1']::uuid[])), '0'); RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a8'); SET LOCAL ROLE authenticated;
SELECT scb.same('a superintendent reads our days on their job, and a null list reads nothing', (SELECT count(*)::text FROM public.start_check_windows(ARRAY['00000000-0000-0000-0000-0000003820b1']::uuid[])) || ' ' || (SELECT count(*)::text FROM public.start_check_windows(NULL)), '1 0'); RESET ROLE;

-- An arrival, as the service role writes it for now: Hector found one bullet not as told.
INSERT INTO public.start_check_arrivals (id, job_id, fixture_id, arrived_on, not_as_told, by_user, by_name) VALUES
  ('00000000-0000-0000-0000-000000382501', '00000000-0000-0000-0000-0000003820b2', '00000000-0000-0000-0000-0000003820c1', '2026-12-15', ARRAY['00000000-0000-0000-0000-000000382101']::uuid[], '00000000-0000-0000-0000-0000003820aa', 'Hector Helper');
SELECT scb.same('an arrival takes its stage line''s job', (SELECT job_id::text FROM public.start_check_arrivals), '00000000-0000-0000-0000-0000003820b1');
-- One bullet on them is taken off the list.
UPDATE public.start_check_bullets SET removed_at = now() WHERE id = '00000000-0000-0000-0000-000000382102';

-- 6 · Who reads. The whole is 5 bullets, 2 yeses, 3 asks, 3 days, 3 decisions, 1 arrival. Job 2 holds 1 bullet and 1 ask.
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a1'); SET LOCAL ROLE authenticated;
SELECT scb.same('the office reads every row', scb.reads(), '5 bullets, 2 yeses, 3 asks, 3 days, 3 decisions, 1 arrivals'); RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a2'); SET LOCAL ROLE authenticated;
SELECT scb.same('a master reads every row', scb.reads(), '5 bullets, 2 yeses, 3 asks, 3 days, 3 decisions, 1 arrivals'); RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a3'); SET LOCAL ROLE authenticated;
SELECT scb.same('a dev reads every row', scb.reads(), '5 bullets, 2 yeses, 3 asks, 3 days, 3 decisions, 1 arrivals'); RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a4'); SET LOCAL ROLE authenticated;
SELECT scb.same('the controller reads every row', scb.reads(), '5 bullets, 2 yeses, 3 asks, 3 days, 3 decisions, 1 arrivals'); RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a5'); SET LOCAL ROLE authenticated;
SELECT scb.same('a primary reads the job they have a claim on, and no other', scb.reads(), '4 bullets, 2 yeses, 2 asks, 3 days, 3 decisions, 1 arrivals');
INSERT INTO public.start_check_marks (id, bullet_id, job_id, know, who_name, said_on, by_user) VALUES ('00000000-0000-0000-0000-000000382203', '00000000-0000-0000-0000-000000382101', '00000000-0000-0000-0000-0000003820b1', 'word', 'Ray', '2026-11-18', '00000000-0000-0000-0000-0000003820a5');
SELECT scb.refused('that primary writing on a job that is not theirs', $q$INSERT INTO public.start_check_bullets (fixture_id, job_id, words, waits_on, created_by) VALUES ('00000000-0000-0000-0000-0000003820c3', '00000000-0000-0000-0000-0000003820b2', 'x', 'them', '00000000-0000-0000-0000-0000003820a5')$q$, 'row-level security'); RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a6'); SET LOCAL ROLE authenticated;
SELECT scb.same('a primary with no claim reads nothing', scb.reads(), '0 bullets, 0 yeses, 0 asks, 0 days, 0 decisions, 0 arrivals'); RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a7'); SET LOCAL ROLE authenticated;
SELECT scb.same('an estimator with no claim reads nothing', scb.reads(), '0 bullets, 0 yeses, 0 asks, 0 days, 0 decisions, 0 arrivals'); RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a8'); SET LOCAL ROLE authenticated;
SELECT scb.same('a superintendent reads their own job whole', scb.reads(), '4 bullets, 3 yeses, 2 asks, 3 days, 3 decisions, 1 arrivals');
INSERT INTO public.start_check_their_days (job_id, fixture_id, ready_day, said_on, who_name, by_user) VALUES ('00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820c2', '2026-12-20', '2026-11-18', 'Ray', '00000000-0000-0000-0000-0000003820a8'); RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a9'); SET LOCAL ROLE authenticated;
SELECT scb.same('a superintendent on no job reads nothing', scb.reads(), '0 bullets, 0 yeses, 0 asks, 0 days, 0 decisions, 0 arrivals'); RESET ROLE;
-- The crew reads the bullets on them still on the list, and their live yeses: bullet 1 with Pat's yes. Nothing else,
-- but the arrival they made themselves.
SELECT scb.as_user('00000000-0000-0000-0000-0000003820aa'); SET LOCAL ROLE authenticated;
SELECT scb.same('the crew reads what it looks at on arrival', scb.reads(), '1 bullets, 1 yeses, 0 asks, 0 days, 0 decisions, 1 arrivals');
SELECT scb.same('and it is the bullet on them that is still on the list', (SELECT string_agg(words, ' | ') FROM public.start_check_bullets), 'Framing is done and the roof is dried in.');
SELECT scb.refused('the crew writing a bullet', $q$INSERT INTO public.start_check_bullets (fixture_id, job_id, words, waits_on, created_by) VALUES ('00000000-0000-0000-0000-0000003820c1', '00000000-0000-0000-0000-0000003820b1', 'x', 'them', '00000000-0000-0000-0000-0000003820aa')$q$, 'row-level security');
SELECT scb.refused('the crew writing a yes', $q$INSERT INTO public.start_check_marks (bullet_id, job_id, know, who_name, said_on, by_user) VALUES ('00000000-0000-0000-0000-000000382105', '00000000-0000-0000-0000-0000003820b2', 'saw', 'Hector', '2026-12-15', '00000000-0000-0000-0000-0000003820aa')$q$, 'row-level security');
SELECT scb.refused('the crew writing an arrival by hand', $q$INSERT INTO public.start_check_arrivals (job_id, fixture_id, arrived_on, by_user) VALUES ('00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820c1', '2026-12-15', '00000000-0000-0000-0000-0000003820aa')$q$, 'permission denied');
UPDATE public.start_check_bullets SET words = 'changed by the crew';
UPDATE public.start_check_marks SET who_name = 'changed by the crew'; RESET ROLE;
SELECT scb.same('the crew''s updates changed nothing', (SELECT count(*) FILTER (WHERE words = 'changed by the crew')::text FROM public.start_check_bullets) || ' ' || (SELECT count(*) FILTER (WHERE who_name = 'changed by the crew')::text FROM public.start_check_marks), '0 0');
SELECT scb.as_user('00000000-0000-0000-0000-0000003820ab'); SET LOCAL ROLE authenticated;
SELECT scb.same('a helper on no job reads nothing', scb.reads(), '0 bullets, 0 yeses, 0 asks, 0 days, 0 decisions, 0 arrivals'); RESET ROLE;
-- A primary put on the job's team is still held to their claim: never crew.
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES ('00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820a6');
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a6'); SET LOCAL ROLE authenticated;
SELECT scb.same('a primary on the crew with no claim still reads nothing', scb.reads(), '0 bullets, 0 yeses, 0 asks, 0 days, 0 decisions, 0 arrivals'); RESET ROLE;

-- 7 · The company's lists and the settings.
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a1'); SET LOCAL ROLE authenticated;
INSERT INTO public.start_check_templates (id, stage_kind, sort_order, words, waits_on, wants_photo, created_by, created_by_name) VALUES
  ('00000000-0000-0000-0000-000000382601', 'rough_in', 1, 'The slab is poured and cured enough to walk.', 'them', true, '00000000-0000-0000-0000-0000003820a1', 'Dana Office');
INSERT INTO public.start_check_templates (id, stage_kind, sort_order, words, waits_on, reads, created_by) VALUES
  ('00000000-0000-0000-0000-000000382602', 'rough_in', 2, 'Our material lands before day one.', 'us', 'order_log', '00000000-0000-0000-0000-0000003820a1');
SELECT scb.refused('a company list for a stage kind that has none', $q$INSERT INTO public.start_check_templates (stage_kind, words, waits_on, created_by) VALUES ('underground', 'x', 'them', '00000000-0000-0000-0000-0000003820a1')$q$, 'stage_kind');
SELECT scb.refused('a company bullet of ours that asks for a photo', $q$INSERT INTO public.start_check_templates (stage_kind, words, waits_on, reads, wants_photo, created_by) VALUES ('rough_in', 'x', 'us', 'trip', true, '00000000-0000-0000-0000-0000003820a1')$q$, 'start_check_templates_photo_is_theirs');
INSERT INTO public.start_check_settings (job_id, shows_on_gc_page, notice_days, updated_by, updated_by_name) VALUES ('00000000-0000-0000-0000-0000003820b2', true, 2, '00000000-0000-0000-0000-0000003820a1', 'Dana Office');
SELECT scb.refused('a second row for one job', $q$INSERT INTO public.start_check_settings (job_id) VALUES ('00000000-0000-0000-0000-0000003820b2')$q$, 'start_check_settings_job_id_key');
SELECT scb.refused('a row with two homes', $q$INSERT INTO public.start_check_settings (job_id, development_id) VALUES ('00000000-0000-0000-0000-0000003820b1', '00000000-0000-0000-0000-0000003820d1')$q$, 'start_check_settings_one_home');
SELECT scb.refused('a row with no home', $q$INSERT INTO public.start_check_settings (notice_days) VALUES (5)$q$, '');
SELECT scb.refused('sixty-one days of notice', $q$INSERT INTO public.start_check_settings (job_id, notice_days) VALUES ('00000000-0000-0000-0000-0000003820b1', 61)$q$, 'notice_days'); RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a2'); SET LOCAL ROLE authenticated;
INSERT INTO public.start_check_settings (development_id, notice_days, updated_by, updated_by_name) VALUES ('00000000-0000-0000-0000-0000003820d1', 7, '00000000-0000-0000-0000-0000003820a2', 'Marcus Master');
SELECT scb.refused('the GC''s page switch on a site''s row', $q$UPDATE public.start_check_settings SET shows_on_gc_page = true WHERE development_id = '00000000-0000-0000-0000-0000003820d1'$q$, 'start_check_settings_page_is_a_jobs'); RESET ROLE;
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a8'); SET LOCAL ROLE authenticated;
SELECT scb.same('a superintendent reads the site''s notice and no other job''s switch', (SELECT string_agg(COALESCE(notice_days::text, '-'), ',' ORDER BY notice_days) FROM public.start_check_settings), '7');
UPDATE public.start_check_settings SET notice_days = 30 WHERE development_id = '00000000-0000-0000-0000-0000003820d1';
INSERT INTO public.start_check_settings (job_id, shows_on_gc_page) VALUES ('00000000-0000-0000-0000-0000003820b1', true);
SELECT scb.refused('a superintendent writing a company list', $q$INSERT INTO public.start_check_templates (stage_kind, words, waits_on, created_by) VALUES ('top_out', 'x', 'them', '00000000-0000-0000-0000-0000003820a8')$q$, 'row-level security');
SELECT scb.same('everyone signed in reads the company''s lists', (SELECT count(*)::text FROM public.start_check_templates), '2'); RESET ROLE;
SELECT scb.same('the site''s notice is the office''s to change', (SELECT notice_days::text FROM public.start_check_settings WHERE development_id = '00000000-0000-0000-0000-0000003820d1'), '7');
SELECT scb.as_user('00000000-0000-0000-0000-0000003820aa'); SET LOCAL ROLE authenticated;
SELECT scb.same('the crew reads no setting', (SELECT count(*)::text FROM public.start_check_settings), '0'); RESET ROLE;

-- 8 · A stage line that moves to another job carries its list.
UPDATE public.jobs_ledger_fixtures SET job_id = '00000000-0000-0000-0000-0000003820b2' WHERE id = '00000000-0000-0000-0000-0000003820c1';
SELECT scb.same('the line''s bullets, yeses, asks, days, decisions and arrival took its new job', (
  SELECT (SELECT count(*) FROM public.start_check_bullets WHERE fixture_id = '00000000-0000-0000-0000-0000003820c1' AND job_id = '00000000-0000-0000-0000-0000003820b2')::text || ' '
      || (SELECT count(*) FROM public.start_check_marks WHERE job_id = '00000000-0000-0000-0000-0000003820b2')::text || ' '
      || (SELECT count(*) FROM public.start_check_asks WHERE fixture_id = '00000000-0000-0000-0000-0000003820c1' AND job_id = '00000000-0000-0000-0000-0000003820b2')::text || ' '
      || (SELECT count(*) FROM public.start_check_their_days WHERE fixture_id = '00000000-0000-0000-0000-0000003820c1' AND job_id = '00000000-0000-0000-0000-0000003820b2')::text || ' '
      || (SELECT count(*) FROM public.start_check_decisions WHERE fixture_id = '00000000-0000-0000-0000-0000003820c1' AND job_id = '00000000-0000-0000-0000-0000003820b2')::text || ' '
      || (SELECT count(*) FROM public.start_check_arrivals WHERE job_id = '00000000-0000-0000-0000-0000003820b2')::text), '4 3 2 3 2 1');
SELECT scb.same('the other line''s rows stayed on their job', (SELECT count(*)::text FROM public.start_check_decisions WHERE fixture_id = '00000000-0000-0000-0000-0000003820c2' AND job_id = '00000000-0000-0000-0000-0000003820b1') || ' ' || (SELECT count(*)::text FROM public.start_check_their_days WHERE fixture_id = '00000000-0000-0000-0000-0000003820c2' AND job_id = '00000000-0000-0000-0000-0000003820b1'), '1 1');
SELECT scb.as_user('00000000-0000-0000-0000-0000003820a5'); SET LOCAL ROLE authenticated;
SELECT scb.same('the primary''s claim did not follow the line', scb.reads(), '0 bullets, 0 yeses, 0 asks, 1 days, 1 decisions, 0 arrivals'); RESET ROLE;

-- 9 · What goes with what. A line takes its list, and a job takes its lines and its setting. A site takes its setting.
DELETE FROM public.jobs_ledger_fixtures WHERE id = '00000000-0000-0000-0000-0000003820c1';
SELECT scb.same('a line that goes takes its list', (SELECT scb.reads()), '1 bullets, 0 yeses, 1 asks, 1 days, 1 decisions, 0 arrivals');
DELETE FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-0000003820b2';
DELETE FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-0000003820b1';
SELECT scb.same('a job that goes takes its lines'' lists and its setting', (SELECT scb.reads()) || ', ' || (SELECT count(*)::text FROM public.start_check_settings WHERE job_id IS NOT NULL) || ' job settings', '0 bullets, 0 yeses, 0 asks, 0 days, 0 decisions, 0 arrivals, 0 job settings');
DELETE FROM public.developments WHERE id = '00000000-0000-0000-0000-0000003820d1';
SELECT scb.same('a site that goes takes its notice', (SELECT count(*)::text FROM public.start_check_settings), '0');
SELECT scb.same('the company''s lists stand', (SELECT count(*)::text FROM public.start_check_templates), '2');

DO $$ BEGIN RAISE NOTICE 'start_checks PASSED'; END $$;
ROLLBACK;
