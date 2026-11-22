-- Before we start, on arrival (migration *_start_check_arrive, punch list #382 PR 10): the crew is asked about the
-- one stage whose days have come, shown only what nobody of ours has seen; Yes, all as told turns each into a yes we
-- saw in the arriving person's name; a No opens its bullet again and sends Dispatch one stage check; a second yes
-- cannot replace a No (migration *_start_check_arrive_once); a later No is kept, and a bullet with a No is asked about
-- again once it has a new yes (migration *_start_check_arrive_again); and who the two functions refuse.
-- Fixtures are written as postgres; presses run as each user; everything
-- rolls back. Raises on the first failed assertion; ends with "start_check_arrive PASSED".
-- See scripts/pgtest-start-checks.sh. Never against prod. Every name here is made up.
\set ON_ERROR_STOP 1
BEGIN;

-- Dana is the office. Hector is a helper on the job's team, Hank a helper on no job. Tara is in training, Tess a
-- twin, Gwen left: each put on the job's team, so only the refusal itself holds them out.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000003821a1', 'dana@arrive.test'), ('00000000-0000-0000-0000-0000003821a2', 'marcus@arrive.test'),
  ('00000000-0000-0000-0000-0000003821aa', 'hector@arrive.test'), ('00000000-0000-0000-0000-0000003821ab', 'hank@arrive.test'),
  ('00000000-0000-0000-0000-0000003821ac', 'tara@arrive.test'), ('00000000-0000-0000-0000-0000003821ad', 'tess@arrive.test'),
  ('00000000-0000-0000-0000-0000003821ae', 'gwen@arrive.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  ('00000000-0000-0000-0000-0000003821a1', 'dana@arrive.test', 'Dana Office', 'assistant', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003821a2', 'marcus@arrive.test', 'Marcus Master', 'master_technician', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003821aa', 'hector@arrive.test', 'Hector Helper', 'helpers', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003821ab', 'hank@arrive.test', 'Hank Helper', 'helpers', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003821ac', 'tara@arrive.test', 'Tara Training', 'helpers', true, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003821ad', 'tess@arrive.test', 'Tess Twin', 'helpers', false, true, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003821ae', 'gwen@arrive.test', 'Gwen Gone', 'helpers', false, false, false, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;

CREATE SCHEMA sca;
CREATE FUNCTION sca.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION sca.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION sca.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
GRANT USAGE ON SCHEMA sca TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sca TO authenticated, anon;

-- One job on no site, with four stage lines. Rough In's days hold today, Top Out's start next month, Trim Set and
-- Final have none.
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000003821f9', 'Arrive Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name) VALUES
  ('00000000-0000-0000-0000-0000003821b1', '00000000-0000-0000-0000-0000003821a2', '00000000-0000-0000-0000-0000003821f9', 'Lodge plumbing');
INSERT INTO public.jobs_ledger_fixtures (id, job_id, name, stage_kind, sequence_order) VALUES
  ('00000000-0000-0000-0000-0000003821c1', '00000000-0000-0000-0000-0000003821b1', 'Rough In', 'order', 1),
  ('00000000-0000-0000-0000-0000003821c2', '00000000-0000-0000-0000-0000003821b1', 'Top Out', 'order', 2),
  ('00000000-0000-0000-0000-0000003821c3', '00000000-0000-0000-0000-0000003821b1', 'Trim Set', 'order', 3),
  ('00000000-0000-0000-0000-0000003821c4', '00000000-0000-0000-0000-0000003821b1', 'Final', 'order', 4);
INSERT INTO public.job_stage_windows (id, job_id, fixture_id, window_start, window_end) VALUES
  ('00000000-0000-0000-0000-0000003821e1', '00000000-0000-0000-0000-0000003821b1', '00000000-0000-0000-0000-0000003821c1', public.app_today() - 1, public.app_today() + 3),
  ('00000000-0000-0000-0000-0000003821e2', '00000000-0000-0000-0000-0000003821b1', '00000000-0000-0000-0000-0000003821c2', public.app_today() + 30, public.app_today() + 34);
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000003821b1', '00000000-0000-0000-0000-0000003821aa'), ('00000000-0000-0000-0000-0000003821b1', '00000000-0000-0000-0000-0000003821ac'),
  ('00000000-0000-0000-0000-0000003821b1', '00000000-0000-0000-0000-0000003821ad'), ('00000000-0000-0000-0000-0000003821b1', '00000000-0000-0000-0000-0000003821ae');
-- Rough In: three on them (one Ray told us, one we saw, one open) and one of ours. Top Out and Trim Set: one each.
-- Final: one the office has already seen, so nobody has arrived there and there is nothing to look at.
INSERT INTO public.start_check_bullets (id, job_id, fixture_id, sort_order, words, waits_on, reads) VALUES
  ('00000000-0000-0000-0000-000000382101', '00000000-0000-0000-0000-0000003821b1', '00000000-0000-0000-0000-0000003821c1', 1, 'The slab is poured.', 'them', NULL),
  ('00000000-0000-0000-0000-000000382102', '00000000-0000-0000-0000-0000003821b1', '00000000-0000-0000-0000-0000003821c1', 2, 'Power is on.', 'them', NULL),
  ('00000000-0000-0000-0000-000000382103', '00000000-0000-0000-0000-0000003821b1', '00000000-0000-0000-0000-0000003821c1', 3, 'The trench is open.', 'them', NULL),
  ('00000000-0000-0000-0000-000000382104', '00000000-0000-0000-0000-0000003821b1', '00000000-0000-0000-0000-0000003821c1', 4, 'Our material lands.', 'us', 'hand'),
  ('00000000-0000-0000-0000-000000382105', '00000000-0000-0000-0000-0000003821b1', '00000000-0000-0000-0000-0000003821c2', 1, 'Framing is done.', 'them', NULL),
  ('00000000-0000-0000-0000-000000382106', '00000000-0000-0000-0000-0000003821b1', '00000000-0000-0000-0000-0000003821c3', 1, 'The walls are painted.', 'them', NULL),
  ('00000000-0000-0000-0000-000000382107', '00000000-0000-0000-0000-0000003821b1', '00000000-0000-0000-0000-0000003821c4', 1, 'The water is on.', 'them', NULL);
INSERT INTO public.start_check_marks (bullet_id, job_id, know, who_name, how, said_on, source) VALUES
  ('00000000-0000-0000-0000-000000382101', '00000000-0000-0000-0000-0000003821b1', 'word', 'Ray Ortiz', 'by phone', public.app_today() - 3, 'office'),
  ('00000000-0000-0000-0000-000000382102', '00000000-0000-0000-0000-0000003821b1', 'saw', 'Dana Office', 'on site', public.app_today() - 2, 'office'),
  ('00000000-0000-0000-0000-000000382107', '00000000-0000-0000-0000-0000003821b1', 'saw', 'Dana Office', 'on site', public.app_today() - 2, 'office');

-- 1 · What is asked: the stage whose days hold today, and only what nobody of ours has seen.
SET LOCAL ROLE authenticated;
SELECT sca.as_user('00000000-0000-0000-0000-0000003821aa');
SELECT sca.same('the crew is asked about the stage whose days hold today', public.start_check_arrival_state('00000000-0000-0000-0000-0000003821b1') #>> '{stage,name}', 'Rough In');
SELECT sca.same('with only what nobody of ours has seen', (SELECT string_agg(b ->> 'words', ' | ') FROM jsonb_array_elements(public.start_check_arrival_state('00000000-0000-0000-0000-0000003821b1') #> '{stage,bullets}') b), 'The slab is poured. | The trench is open.');
SELECT sca.as_user('00000000-0000-0000-0000-0000003821ab');
SELECT sca.same('a helper on no job is told nothing', public.start_check_arrival_state('00000000-0000-0000-0000-0000003821b1')::text, '{"ok": false}');
SELECT sca.as_user('00000000-0000-0000-0000-0000003821ae');
SELECT sca.same('nor a person who left', public.start_check_arrival_state('00000000-0000-0000-0000-0000003821b1')::text, '{"ok": false}');
SELECT sca.as_user('00000000-0000-0000-0000-0000003821ad');
SELECT sca.same('nor a twin', public.start_check_arrival_state('00000000-0000-0000-0000-0000003821b1')::text, '{"ok": false}');

-- 2 · Who the door refuses.
SELECT sca.as_user('00000000-0000-0000-0000-0000003821ab');
SELECT sca.refused('a helper on no job keeps no arrival', $$SELECT public.start_check_arrive('00000000-0000-0000-0000-0000003821c1')$$, 'crew on the job');
SELECT sca.as_user('00000000-0000-0000-0000-0000003821ac');
SELECT sca.refused('training mode keeps none', $$SELECT public.start_check_arrive('00000000-0000-0000-0000-0000003821c1')$$, 'Training mode');
SELECT sca.as_user('00000000-0000-0000-0000-0000003821ad');
SELECT sca.refused('a twin keeps none', $$SELECT public.start_check_arrive('00000000-0000-0000-0000-0000003821c1')$$, 'digital twin');
SELECT sca.as_user('00000000-0000-0000-0000-0000003821ae');
SELECT sca.refused('a person who left keeps none', $$SELECT public.start_check_arrive('00000000-0000-0000-0000-0000003821c1')$$, 'archived');
SELECT sca.as_user('00000000-0000-0000-0000-0000003821aa');
SELECT sca.refused('a No on a bullet that is not on the list is refused', $$SELECT public.start_check_arrive('00000000-0000-0000-0000-0000003821c1', ARRAY['00000000-0000-0000-0000-000000382102']::uuid[])$$, 'The list has changed');
SELECT sca.refused('and on a bullet of ours', $$SELECT public.start_check_arrive('00000000-0000-0000-0000-0000003821c1', ARRAY['00000000-0000-0000-0000-000000382104']::uuid[])$$, 'The list has changed');

-- 3 · A No on one and the rest as told.
CREATE TEMP TABLE sca_out ON COMMIT DROP AS SELECT public.start_check_arrive('00000000-0000-0000-0000-0000003821c1', ARRAY['00000000-0000-0000-0000-000000382101']::uuid[]) AS r;
SELECT sca.same('it says what it kept', (SELECT (r ->> 'as_told') || ' as told, ' || (r ->> 'not_as_told') || ' not, a line to Dispatch: ' || ((r ->> 'dispatch_request_id') IS NOT NULL)::text FROM sca_out), '1 as told, 1 not, a line to Dispatch: true');
RESET ROLE;
SELECT sca.same('the arrival is kept in the name of the person who got there', (SELECT by_name || ', ' || cardinality(not_as_told) || ' not as told, today: ' || (arrived_on = public.app_today())::text FROM public.start_check_arrivals WHERE fixture_id = '00000000-0000-0000-0000-0000003821c1'), 'Hector Helper, 1 not as told, today: true');
SELECT sca.same('the one as told is a yes we saw, by the crew, on arrival', (SELECT know || ', ' || who_name || ', ' || how || ', ' || source FROM public.start_check_marks WHERE bullet_id = '00000000-0000-0000-0000-000000382103' AND taken_back_at IS NULL), 'saw, Hector Helper, on arrival, crew');
SELECT sca.same('the No opened its bullet again: Ray''s word is taken back, by Hector', (SELECT count(*) FILTER (WHERE taken_back_at IS NULL) || ' standing, taken back by ' || max(taken_back_by_name) FROM public.start_check_marks WHERE bullet_id = '00000000-0000-0000-0000-000000382101'), '0 standing, taken back by Hector Helper');
SELECT sca.same('what the office saw before is left alone', (SELECT who_name FROM public.start_check_marks WHERE bullet_id = '00000000-0000-0000-0000-000000382102' AND taken_back_at IS NULL), 'Dana Office');
SELECT sca.same('Dispatch gets one stage check, high, on the stage, that names who told us', (SELECT pending_action || ' · ' || priority || ' · ' || title FROM public.dispatch_requests WHERE id = (SELECT (r ->> 'dispatch_request_id')::uuid FROM sca_out)), 'stage_check · high · Rough In · “The slab is poured.” · something else: not as told on arrival. Ray Ortiz told us it was ready');
SELECT sca.same('and carries the stage and the bullet', (SELECT (fixture_id = '00000000-0000-0000-0000-0000003821c1')::text || ', ' || (pending_payload #>> '{stage_check,not_as_told,0}') FROM public.dispatch_requests WHERE id = (SELECT (r ->> 'dispatch_request_id')::uuid FROM sca_out)), 'true, 00000000-0000-0000-0000-000000382101');

-- 3b · A stage is answered once. A second answer, from a card that was read before the first, is refused by name and
-- keeps nothing: Yes, all as told from that card must not turn Hector's No into a yes we saw.
SET LOCAL ROLE authenticated;
SELECT sca.as_user('00000000-0000-0000-0000-0000003821a1');
SELECT sca.refused('a second answer at the stage is refused, in words that name who answered', $$SELECT public.start_check_arrive('00000000-0000-0000-0000-0000003821c1')$$, 'Hector Helper already answered for this stage.');
RESET ROLE;
SELECT sca.same('and it kept nothing: one arrival, and the No stands with no yes on its bullet', (SELECT count(*) FROM public.start_check_arrivals WHERE fixture_id = '00000000-0000-0000-0000-0000003821c1') || ' arrival, ' || (SELECT count(*) FROM public.start_check_marks WHERE bullet_id = '00000000-0000-0000-0000-000000382101' AND taken_back_at IS NULL) || ' yes on the slab', '1 arrival, 0 yes on the slab');

-- 3c · A later No is kept (migration *_start_check_arrive_again). Hector saw the trench open. Dana gets there after
-- him and says No to it: a No is the dearer answer, so it is its own arrival, with its line to Dispatch. A No that
-- already stands and a later Yes, all as told are still refused by name.
SET LOCAL ROLE authenticated;
SELECT sca.as_user('00000000-0000-0000-0000-0000003821a1');
CREATE TEMP TABLE sca_later ON COMMIT DROP AS SELECT public.start_check_arrive('00000000-0000-0000-0000-0000003821c1', ARRAY['00000000-0000-0000-0000-000000382103']::uuid[]) AS r;
SELECT sca.same('a later No on a bullet we saw as a yes is kept, with its line to Dispatch', (SELECT (r ->> 'as_told') || ' as told, ' || (r ->> 'not_as_told') || ' not, a line to Dispatch: ' || ((r ->> 'dispatch_request_id') IS NOT NULL)::text FROM sca_later), '0 as told, 1 not, a line to Dispatch: true');
SELECT sca.refused('a No that already stands is refused by name', $$SELECT public.start_check_arrive('00000000-0000-0000-0000-0000003821c1', ARRAY['00000000-0000-0000-0000-000000382101']::uuid[])$$, 'Hector Helper already answered for this stage.');
SELECT sca.refused('and so is a later Yes, all as told', $$SELECT public.start_check_arrive('00000000-0000-0000-0000-0000003821c1')$$, 'Hector Helper already answered for this stage.');
RESET ROLE;
SELECT sca.same('the later No took Hector''s yes back and wrote no other', (SELECT count(*) FROM public.start_check_arrivals WHERE fixture_id = '00000000-0000-0000-0000-0000003821c1') || ' arrivals, ' || (SELECT count(*) FROM public.start_check_marks WHERE bullet_id = '00000000-0000-0000-0000-000000382103' AND taken_back_at IS NULL) || ' yes on the trench, ' || (SELECT count(*) FROM public.start_check_marks WHERE bullet_id = '00000000-0000-0000-0000-000000382101' AND taken_back_at IS NULL) || ' on the slab', '2 arrivals, 0 yes on the trench, 0 on the slab');
SELECT sca.same('its line names the trench and nobody who told us, since the yes was ours', (SELECT title FROM public.dispatch_requests WHERE id = (SELECT (r ->> 'dispatch_request_id')::uuid FROM sca_later)), 'Rough In · “The trench is open.” · something else: not as told on arrival');

-- 3d · Asked again (the same migration). Nothing new was told us, so nobody is asked. Then Ray says the slab is poured
-- now: that yes is the one that needs one of ours to see it, so the stage is asked about again, and about the slab
-- alone. The trench had a No too and has no new yes, so it is not on the list.
SET LOCAL ROLE authenticated;
SELECT sca.as_user('00000000-0000-0000-0000-0000003821aa');
SELECT sca.same('a No with no new yes asks nobody again', (public.start_check_arrival_state('00000000-0000-0000-0000-0000003821b1') -> 'stage')::text, 'null');
RESET ROLE;
INSERT INTO public.start_check_marks (bullet_id, job_id, know, who_name, how, said_on, source) VALUES
  ('00000000-0000-0000-0000-000000382101', '00000000-0000-0000-0000-0000003821b1', 'word', 'Ray Ortiz', 'by phone', public.app_today(), 'office');
SET LOCAL ROLE authenticated;
SELECT sca.as_user('00000000-0000-0000-0000-0000003821aa');
SELECT sca.same('a new yes on a bullet that had a No asks about the stage again', public.start_check_arrival_state('00000000-0000-0000-0000-0000003821b1') #>> '{stage,name}', 'Rough In');
SELECT sca.same('and about that bullet alone', (SELECT string_agg(b ->> 'words', ' | ') FROM jsonb_array_elements(public.start_check_arrival_state('00000000-0000-0000-0000-0000003821b1') #> '{stage,bullets}') AS b), 'The slab is poured.');
SELECT sca.refused('a No from an old card, on a bullet that is not asked about, is sent back to read the list', $$SELECT public.start_check_arrive('00000000-0000-0000-0000-0000003821c1', ARRAY['00000000-0000-0000-0000-000000382103']::uuid[])$$, 'The list has changed');
SELECT sca.same('Yes, all as told on what is asked again is kept', (SELECT (r ->> 'as_told') || ' as told, ' || (r ->> 'not_as_told') || ' not, a line to Dispatch: ' || ((r ->> 'dispatch_request_id') IS NOT NULL)::text FROM (SELECT public.start_check_arrive('00000000-0000-0000-0000-0000003821c1') AS r) AS x), '1 as told, 0 not, a line to Dispatch: false');
RESET ROLE;
SELECT sca.same('the slab is a yes we saw now, in Hector''s name, and Ray''s word is behind it', (SELECT string_agg(know || ' by ' || who_name, ', ' ORDER BY know) FROM public.start_check_marks WHERE bullet_id = '00000000-0000-0000-0000-000000382101' AND taken_back_at IS NULL) || ', ' || (SELECT count(*) FROM public.start_check_arrivals WHERE fixture_id = '00000000-0000-0000-0000-0000003821c1') || ' arrivals', 'saw by Hector Helper, 3 arrivals');
SELECT sca.same('nobody signed in may call the rule itself', has_function_privilege('authenticated', 'public.start_check_to_look(uuid)', 'execute')::text || ', ' || has_function_privilege('anon', 'public.start_check_to_look(uuid)', 'execute')::text, 'false, false');

-- 4 · A stage with nothing new to look at is not asked about. The next one waits for its days, and one with no days of
-- ours is never asked about.
SET LOCAL ROLE authenticated;
SELECT sca.as_user('00000000-0000-0000-0000-0000003821aa');
SELECT sca.same('the stage that was arrived at is not asked again, nor one whose days have not come, nor one with no days', (public.start_check_arrival_state('00000000-0000-0000-0000-0000003821b1') -> 'stage')::text, 'null');
SELECT sca.same('Yes, all as told keeps no line to Dispatch', ((public.start_check_arrive('00000000-0000-0000-0000-0000003821c3') ->> 'dispatch_request_id') IS NULL)::text, 'true');
-- Top Out's days come: it is the one asked about, and a stage whose days have passed unfinished still is.
RESET ROLE;
UPDATE public.job_stage_windows SET window_start = public.app_today() - 9, window_end = public.app_today() - 5 WHERE id = '00000000-0000-0000-0000-0000003821e2';
SET LOCAL ROLE authenticated;
SELECT sca.as_user('00000000-0000-0000-0000-0000003821aa');
SELECT sca.same('a stage whose days have passed unfinished is still asked about', public.start_check_arrival_state('00000000-0000-0000-0000-0000003821b1') #>> '{stage,name}', 'Top Out');
-- The office may answer for a stage too (the desk), and a stage with nothing left to look at keeps no arrival.
SELECT sca.as_user('00000000-0000-0000-0000-0000003821a1');
SELECT sca.refused('nothing left to look at keeps no arrival', $$SELECT public.start_check_arrive('00000000-0000-0000-0000-0000003821c4')$$, 'nothing left to look at');
SELECT sca.same('the desk may answer for a stage', (public.start_check_arrive('00000000-0000-0000-0000-0000003821c2') ->> 'as_told'), '1');
RESET ROLE;
SELECT sca.same('anon may call neither', (SELECT count(*) FROM information_schema.role_routine_grants WHERE routine_schema = 'public' AND routine_name IN ('start_check_arrive', 'start_check_arrival_state') AND grantee IN ('anon', 'PUBLIC'))::text, '0');

SELECT 'start_check_arrive PASSED' AS result;
ROLLBACK;
