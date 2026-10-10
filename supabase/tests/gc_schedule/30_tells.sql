-- Tell the trades and their answers (v2.5173, the schedule's PR 13a): the office records the companies it told, once
-- per move and company, on the company's day and with no version; a move undone or on another job is refused whole;
-- and a company answers from its portal through the service role only, for a move it was told of, while it stands,
-- and once, each refusal the portal's key with its words. A job of its own, made as postgres and drawn and moved as a
-- dev through RLS, inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "gc_schedule tells PASSED". See scripts/pgtest-gc-schedule.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000007d1', 'dev@tells.test');
INSERT INTO public.users (id, email, name, role) VALUES ('00000000-0000-0000-0000-0000000007d1', 'dev@tells.test', 'Tells Dev', 'dev')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000007c1', 'Tells Test Owner', '00000000-0000-0000-0000-0000000007d1');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000007a1', 'Tells test P', '00000000-0000-0000-0000-0000000007c1'),
  ('00000000-0000-0000-0000-0000000007a2', 'Tells test Q', '00000000-0000-0000-0000-0000000007c1');
INSERT INTO public.gc_projects (project_id, stage) VALUES ('00000000-0000-0000-0000-0000000007a1', 'buyout'), ('00000000-0000-0000-0000-0000000007a2', 'buyout');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position) VALUES
  ('00000000-0000-0000-0000-0000000007b1', '00000000-0000-0000-0000-0000000007a1', 'Electrical', 0),
  ('00000000-0000-0000-0000-0000000007b2', '00000000-0000-0000-0000-0000000007a1', 'Plumbing', 1),
  ('00000000-0000-0000-0000-0000000007b3', '00000000-0000-0000-0000-0000000007a2', 'Electrical', 0);
INSERT INTO public.gc_scope_items (id, package_id, position, label) VALUES
  ('00000000-0000-0000-0000-0000000007e1', '00000000-0000-0000-0000-0000000007b1', 0, 'Rough-in'),
  ('00000000-0000-0000-0000-0000000007e3', '00000000-0000-0000-0000-0000000007b2', 0, 'Rough-in'),
  ('00000000-0000-0000-0000-0000000007e4', '00000000-0000-0000-0000-0000000007b3', 0, 'Service');
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-000000000771', 'Tells Test Electric', ARRAY['Electrical']),
  ('00000000-0000-0000-0000-000000000772', 'Tells Test Plumbing', ARRAY['Plumbing']);

CREATE SCHEMA gtt;
CREATE FUNCTION gtt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`; with `detail_has`, a DETAIL that holds it too.
CREATE FUNCTION gtt.refused(label text, stmt text, want text, detail_has text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_detail text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    IF detail_has IS NOT NULL AND position(detail_has IN coalesce(v_detail, '')) = 0 THEN
      RAISE EXCEPTION '% was refused without % in its detail: %', label, detail_has, v_detail;
    END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION gtt.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION gtt.version(p_project uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT version::text FROM public.gc_schedules WHERE project_id = p_project $$;
-- The move saved at a version on a job.
CREATE FUNCTION gtt.move(p_project uuid, p_version integer) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.gc_schedule_moves WHERE project_id = p_project AND schedule_version = p_version $$;
CREATE FUNCTION gtt.tells(p_move uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(c.name || ' ' || (t.told_on = public.app_today()) || ' ' || t.shown::text, ' | ' ORDER BY c.name), 'none')
  FROM public.gc_schedule_move_tells t JOIN public.gc_companies c ON c.id = t.company_id WHERE t.move_id = p_move $$;
GRANT USAGE ON SCHEMA gtt TO authenticated, service_role, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gtt TO authenticated, service_role, anon;

SELECT gtt.as_user('00000000-0000-0000-0000-0000000007d1');
SET LOCAL ROLE authenticated;

-- P drawn with two lines, move A on Electrical and move B on Plumbing, then B undone; Q drawn and moved once.
SELECT gtt.same('P drawn, as version 1', public.gc_schedule_draft('00000000-0000-0000-0000-0000000007a1', NULL, 'Drew a first draft.',
  $j${"bars": [
    {"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000007e1", "packageId": "00000000-0000-0000-0000-0000000007b1", "start": "2026-11-02", "finish": "2026-11-13", "after": []},
    {"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000007e3", "packageId": "00000000-0000-0000-0000-0000000007b2", "start": "2026-11-02", "finish": "2026-11-13", "after": []}]}$j$::jsonb)::text, '1');
SELECT gtt.same('move A, as version 2', public.gc_schedule_move('00000000-0000-0000-0000-0000000007a1', 1, 'Electrical · Rough-in now runs Wed Nov 4 to Tue Nov 17.',
  '{"activityId": "00000000-0000-0000-0000-0000000007e1", "activityName": "Electrical · Rough-in", "reason": "materials", "note": "The switchgear ships two days late.", "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "to": {"start": "2026-11-04", "finish": "2026-11-17"}, "finishFrom": "2026-11-13", "finishTo": "2026-11-17", "pushed": []}',
  '[{"id": "00000000-0000-0000-0000-0000000007e1", "start": "2026-11-04", "finish": "2026-11-17"}]')::text, '2');
SELECT gtt.same('move B, as version 3', public.gc_schedule_move('00000000-0000-0000-0000-0000000007a1', 2, 'Plumbing · Rough-in now runs Tue Nov 3 to Fri Nov 13.',
  '{"activityId": "00000000-0000-0000-0000-0000000007e3", "activityName": "Plumbing · Rough-in", "reason": "crew", "note": "The crew starts a day late.", "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "to": {"start": "2026-11-03", "finish": "2026-11-13"}, "finishFrom": "2026-11-17", "finishTo": "2026-11-17", "pushed": []}',
  '[{"id": "00000000-0000-0000-0000-0000000007e3", "start": "2026-11-03", "finish": "2026-11-13"}]')::text, '3');
SELECT gtt.same('move B undone, as version 4', public.gc_schedule_undo('00000000-0000-0000-0000-0000000007a1', 3,
  gtt.move('00000000-0000-0000-0000-0000000007a1', 3), 'Undid move B.')::text, '4');
SELECT gtt.same('Q drawn, as version 1', public.gc_schedule_draft('00000000-0000-0000-0000-0000000007a2', NULL, 'Drew a first draft.',
  '{"bars": [{"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000007e4", "packageId": "00000000-0000-0000-0000-0000000007b3", "start": "2026-11-09", "finish": "2026-11-13", "after": []}]}')::text, '1');
SELECT gtt.same('a move on Q, as version 2', public.gc_schedule_move('00000000-0000-0000-0000-0000000007a2', 1, 'Electrical · Service now runs Tue Nov 10 to Mon Nov 16.',
  '{"activityId": "00000000-0000-0000-0000-0000000007e4", "activityName": "Electrical · Service", "reason": "customer", "note": "The utility moved the cutover.", "from": {"start": "2026-11-09", "finish": "2026-11-13"}, "to": {"start": "2026-11-10", "finish": "2026-11-16"}, "finishFrom": "2026-11-13", "finishTo": "2026-11-16", "pushed": []}',
  '[{"id": "00000000-0000-0000-0000-0000000007e4", "start": "2026-11-10", "finish": "2026-11-16"}]')::text, '2');

-- 1 · The office records who it told (gc_schedule_record_tells): once per move and company, today, with what it showed.
SELECT gtt.refused('a tell of nothing', $q$SELECT public.gc_schedule_record_tells('00000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-000000000771', NULL, '[]')$q$,
  'Nothing was told.');
SELECT gtt.refused('a tell naming another job''s move', format($q$SELECT public.gc_schedule_record_tells('00000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-000000000771', NULL, '[{"moveId": "%s"}]')$q$,
    gtt.move('00000000-0000-0000-0000-0000000007a2', 2)),
  'A move in this tell is not on this schedule.');
SELECT gtt.refused('a tell of an undone move, refused whole', format($q$SELECT public.gc_schedule_record_tells('00000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-000000000772', NULL, '[{"moveId": "%s"}, {"moveId": "%s"}]')$q$,
    gtt.move('00000000-0000-0000-0000-0000000007a1', 2), gtt.move('00000000-0000-0000-0000-0000000007a1', 3)),
  'A move in this tell was undone.');
SELECT gtt.same('nothing of the refused tell was written', gtt.tells(gtt.move('00000000-0000-0000-0000-0000000007a1', 2)), 'none');
SELECT gtt.same('Electric told of move A: one row added', public.gc_schedule_record_tells('00000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-000000000771', NULL,
  format('[{"moveId": "%s", "shown": [{"lineId": "00000000-0000-0000-0000-0000000007e1", "work": "Rough-in", "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "to": {"start": "2026-11-04", "finish": "2026-11-17"}}]}]',
    gtt.move('00000000-0000-0000-0000-0000000007a1', 2))::jsonb)::text, '1');
SELECT gtt.same('the tell: the company, today, and the dates it was shown',
  gtt.tells(gtt.move('00000000-0000-0000-0000-0000000007a1', 2)),
  'Tells Test Electric true [{"to": {"start": "2026-11-04", "finish": "2026-11-17"}, "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "work": "Rough-in", "lineId": "00000000-0000-0000-0000-0000000007e1"}]');
SELECT gtt.same('the same tell again adds nothing, and the first stays', public.gc_schedule_record_tells('00000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-000000000771', NULL,
  format('[{"moveId": "%s", "shown": []}]', gtt.move('00000000-0000-0000-0000-0000000007a1', 2))::jsonb)::text || ' / ' ||
  (SELECT count(*)::text FROM public.gc_schedule_move_tells WHERE move_id = gtt.move('00000000-0000-0000-0000-0000000007a1', 2)), '0 / 1');
SELECT gtt.same('a tell is a record: the version stays', gtt.version('00000000-0000-0000-0000-0000000007a1'), '4');

-- 2 · A company answers from its portal (gc_trade_answer_dates): never as a signed-in user. Days are the company's,
-- read from today, so the bed reads the same on any day it runs.
SELECT gtt.refused('an answer from a signed-in user', format($q$SELECT public.gc_trade_answer_dates('00000000-0000-0000-0000-000000000771', '%s', true, NULL, NULL)$q$,
    gtt.move('00000000-0000-0000-0000-0000000007a1', 2)),
  'permission denied for function gc_trade_answer_dates');
RESET ROLE;
-- A tell of B made before B was undone, as postgres: the answer finds the dates taken back.
INSERT INTO public.gc_schedule_move_tells (move_id, company_id, told_on)
  VALUES (gtt.move('00000000-0000-0000-0000-0000000007a1', 3), '00000000-0000-0000-0000-000000000772', public.app_today());
SET LOCAL ROLE service_role;
SELECT gtt.refused('an answer on a move that is not there', $q$SELECT public.gc_trade_answer_dates('00000000-0000-0000-0000-000000000771', '00000000-0000-0000-0000-0000000007ff', true, NULL, NULL)$q$,
  'notFound', 'No move with that id.');
SELECT gtt.refused('an answer from a company not told of the move', format($q$SELECT public.gc_trade_answer_dates('00000000-0000-0000-0000-000000000772', '%s', true, NULL, NULL)$q$,
    gtt.move('00000000-0000-0000-0000-0000000007a1', 2)),
  'notYours', 'That company was not told of that move.');
SELECT gtt.refused('an answer on a move undone since', format($q$SELECT public.gc_trade_answer_dates('00000000-0000-0000-0000-000000000772', '%s', true, NULL, NULL)$q$,
    gtt.move('00000000-0000-0000-0000-0000000007a1', 3)),
  'datesTakenBack', 'The office took those dates back.');
SELECT gtt.refused('the dates work, with a day', format($q$SELECT public.gc_trade_answer_dates('00000000-0000-0000-0000-000000000771', '%s', true, public.app_today() + 7, NULL)$q$,
    gtt.move('00000000-0000-0000-0000-0000000007a1', 2)),
  'badRequest', 'Say the dates work, or ask for another day.');
SELECT gtt.refused('neither yes nor no', format($q$SELECT public.gc_trade_answer_dates('00000000-0000-0000-0000-000000000771', '%s', NULL, NULL, NULL)$q$,
    gtt.move('00000000-0000-0000-0000-0000000007a1', 2)),
  'badRequest');
SELECT gtt.refused('another day asked, with no day', format($q$SELECT public.gc_trade_answer_dates('00000000-0000-0000-0000-000000000771', '%s', false, NULL, 'Not that week.')$q$,
    gtt.move('00000000-0000-0000-0000-0000000007a1', 2)),
  'dayNeeded', 'Say which day works.');
SELECT gtt.refused('another day asked, before today', format($q$SELECT public.gc_trade_answer_dates('00000000-0000-0000-0000-000000000771', '%s', false, public.app_today() - 1, NULL)$q$,
    gtt.move('00000000-0000-0000-0000-0000000007a1', 2)),
  'dayPassed', 'Pick today or a day after it.');
SELECT gtt.refused('a note over 2,000 characters', format($q$SELECT public.gc_trade_answer_dates('00000000-0000-0000-0000-000000000771', '%s', false, public.app_today() + 7, repeat('x', 2001))$q$,
    gtt.move('00000000-0000-0000-0000-0000000007a1', 2)),
  'tooLong');
SELECT gtt.same('another day asked, with a note', public.gc_trade_answer_dates('00000000-0000-0000-0000-000000000771', gtt.move('00000000-0000-0000-0000-0000000007a1', 2),
  false, public.app_today() + 7, '  Our crew is on another job that week.  ')::text, '');
SELECT gtt.same('the answer: today, another day, the note trimmed',
  (SELECT (a.answered_on = public.app_today()) || ' ' || a.ok || ' ' || (a.day = public.app_today() + 7) || ' ' || a.note FROM public.gc_schedule_move_answers a
   WHERE a.move_id = gtt.move('00000000-0000-0000-0000-0000000007a1', 2) AND a.company_id = '00000000-0000-0000-0000-000000000771'),
  'true false true Our crew is on another job that week.');
SELECT gtt.refused('a second answer', format($q$SELECT public.gc_trade_answer_dates('00000000-0000-0000-0000-000000000771', '%s', true, NULL, NULL)$q$,
    gtt.move('00000000-0000-0000-0000-0000000007a1', 2)),
  'alreadyAnswered', 'Those dates have their answer already.');
SELECT gtt.same('an answer is a record: the version stays', gtt.version('00000000-0000-0000-0000-0000000007a1'), '4');

-- 3 · Who may call them.
RESET ROLE;
SET LOCAL ROLE anon;
SELECT gtt.refused('a tell recorded by anon', $q$SELECT public.gc_schedule_record_tells('00000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-000000000771', NULL, '[{"moveId": "00000000-0000-0000-0000-0000000007ff"}]')$q$,
  'permission denied for function gc_schedule_record_tells');
RESET ROLE;
SELECT gtt.same('the grants: the tell to signed-in users, the answer to the service role alone',
  has_function_privilege('authenticated', 'public.gc_schedule_record_tells(uuid, uuid, uuid, jsonb)', 'EXECUTE') || ' ' ||
  has_function_privilege('anon', 'public.gc_schedule_record_tells(uuid, uuid, uuid, jsonb)', 'EXECUTE') || ' ' ||
  has_function_privilege('authenticated', 'public.gc_trade_answer_dates(uuid, uuid, boolean, date, text)', 'EXECUTE') || ' ' ||
  has_function_privilege('anon', 'public.gc_trade_answer_dates(uuid, uuid, boolean, date, text)', 'EXECUTE') || ' ' ||
  has_function_privilege('service_role', 'public.gc_trade_answer_dates(uuid, uuid, boolean, date, text)', 'EXECUTE'),
  'true false false false true');

DO $$ BEGIN RAISE NOTICE 'gc_schedule tells PASSED'; END $$;
ROLLBACK;
