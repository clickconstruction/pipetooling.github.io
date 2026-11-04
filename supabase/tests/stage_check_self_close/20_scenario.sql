-- A stage check sent to Dispatch closes itself when the check is settled (v2.6494, punch list #245 PR 2a, migration
-- *_stage_check_self_close): a note saved alone settles nothing; the crew's answer closes the request in their name
-- with the pick, while their own update of dispatch_requests reaches no row; a second press after the close changes
-- nothing; a new send on the same check after the close is allowed and a skip on the job closes it with its reason; a
-- job item taken off closes its own stage's request and a company question retired closes the request on every stage;
-- a job item promoted to the company's list says so; Dispatch's own answer on the sheet closes the request in their
-- name; a pick already there before the send settles it when pressed again; a plain request and a request on another check stay open throughout, and a closed request's content is as it
-- was written. Fixtures are written as postgres; presses run as each user under RLS; everything rolls back. Raises on
-- the first failed assertion; ends with "stage_check_self_close PASSED". See scripts/pgtest-stage-check-self-close.sh.
-- Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Jo is an assistant in the Dispatch group; Dee is a dev; Sal is a superintendent on job A's team; Luis is a helper on
-- job A's team. Job A and job B each have a Trim Set stage.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000245a0a1', 'jo@selfclose.test'),
  ('00000000-0000-0000-0000-00000245a0a3', 'dee@selfclose.test'),
  ('00000000-0000-0000-0000-00000245a0a4', 'sal@selfclose.test'),
  ('00000000-0000-0000-0000-00000245a0a6', 'luis@selfclose.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000245a0a1', 'jo@selfclose.test', 'Jo Office', 'assistant', false, false),
  ('00000000-0000-0000-0000-00000245a0a3', 'dee@selfclose.test', 'Dee Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-00000245a0a4', 'sal@selfclose.test', 'Sal Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-00000245a0a6', 'luis@selfclose.test', 'Luis Ortega', 'helpers', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
INSERT INTO public.dispatch_group_members (user_id) VALUES ('00000000-0000-0000-0000-00000245a0a1');

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-00000245a0f9', 'Self Close Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, customer_id) VALUES
  ('00000000-0000-0000-0000-00000245a0b1', '00000000-0000-0000-0000-00000245a0a3', '00000000-0000-0000-0000-00000245a0f9', 'Self close job A', NULL),
  ('00000000-0000-0000-0000-00000245a0b2', '00000000-0000-0000-0000-00000245a0a3', '00000000-0000-0000-0000-00000245a0f9', 'Self close job B', NULL);
INSERT INTO public.jobs_ledger_fixtures (id, job_id, name) VALUES
  ('00000000-0000-0000-0000-00000245a0e1', '00000000-0000-0000-0000-00000245a0b1', 'Trim Set'),
  ('00000000-0000-0000-0000-00000245a0e2', '00000000-0000-0000-0000-00000245a0b2', 'Trim Set');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-00000245a0b1', '00000000-0000-0000-0000-00000245a0a4'),
  ('00000000-0000-0000-0000-00000245a0b1', '00000000-0000-0000-0000-00000245a0a6');

-- The company's questions c1, c2 and c3; Sal's job items d1 and d2 on job A's Trim Set.
INSERT INTO public.stage_checklist_templates (id, stage_kind, sort_order, words, created_by) VALUES
  ('00000000-0000-0000-0000-00000245a0c1', 'trim_set', 1, 'Is the pan drain run to the hub?', '00000000-0000-0000-0000-00000245a0a3'),
  ('00000000-0000-0000-0000-00000245a0c2', 'trim_set', 2, 'Are the cleanouts capped?', '00000000-0000-0000-0000-00000245a0a3'),
  ('00000000-0000-0000-0000-00000245a0c3', 'trim_set', 3, 'Is the water heater strapped?', '00000000-0000-0000-0000-00000245a0a3'),
  ('00000000-0000-0000-0000-00000245a0c4', 'trim_set', 4, 'Is the shutoff labeled?', '00000000-0000-0000-0000-00000245a0a3');
INSERT INTO public.stage_checklist_templates (id, stage_kind, sort_order, words, job_id, fixture_id, created_by, created_by_name) VALUES
  ('00000000-0000-0000-0000-00000245a0d1', 'trim_set', 1, 'Are the carriers in units 7 and 8 set?', '00000000-0000-0000-0000-00000245a0b1', '00000000-0000-0000-0000-00000245a0e1', '00000000-0000-0000-0000-00000245a0a4', 'Sal Super'),
  ('00000000-0000-0000-0000-00000245a0d2', 'trim_set', 2, 'Is the hose bib stubbed out?', '00000000-0000-0000-0000-00000245a0b1', '00000000-0000-0000-0000-00000245a0e1', '00000000-0000-0000-0000-00000245a0a4', 'Sal Super');

CREATE SCHEMA scc;
CREATE FUNCTION scc.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION scc.runs(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE stmt;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement run for its row count: a write RLS filters away reaches no row and raises nothing.
CREATE FUNCTION scc.touched(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  EXECUTE stmt;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n::text;
END $$;
CREATE FUNCTION scc.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- Behind the gates: a request's standing, its note and who closed it; its content; when it closed.
CREATE FUNCTION scc.request(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT status || ' / ' || coalesce(closed_note, '-') || ' / by ' || coalesce(right(closed_by_user_id::text, 2), '-')
  FROM public.dispatch_requests WHERE id = p_id
$$;
CREATE FUNCTION scc.content(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT title || ' / from ' || right(from_user_id::text, 2) || ' / ' || pending_action || ' / stage ' || right(fixture_id::text, 2) || ' / check ' || right(checklist_question_id::text, 2)
  FROM public.dispatch_requests WHERE id = p_id
$$;
CREATE FUNCTION scc.closed_at(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT closed_at::text FROM public.dispatch_requests WHERE id = p_id
$$;
-- A send as the sheet writes it (stageCheckRow), as the signed-in person.
CREATE FUNCTION scc.send(p_id uuid, p_from uuid, p_job uuid, p_fixture uuid, p_question uuid, p_title text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.dispatch_requests (id, from_user_id, title, links, job_ledger_id, reference_summary, pending_action, pending_payload, priority, fixture_id, checklist_question_id)
  VALUES (p_id, p_from, p_title, '{}', p_job, 'Self close job', 'stage_check',
          jsonb_build_object('stage_check', jsonb_build_object('fixture_id', p_fixture, 'question_id', p_question, 'reason', 'need_part', 'stage_name', 'Trim Set')),
          'normal', p_fixture, p_question);
END $$;
GRANT USAGE ON SCHEMA scc TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA scc TO authenticated;

-- 1 · Luis sends five checks: c1 on job A, Sal's d1, c1 on job B, c2 on job A, c3 on job A, and Sal's d2; and a
--     plain request on job A with no flavour.
SELECT scc.as_user('00000000-0000-0000-0000-00000245a0a6');
SET LOCAL ROLE authenticated;
SELECT scc.runs('Luis sends c1 on job A', $q$SELECT scc.send('00000000-0000-0000-0000-00000245a0f1', '00000000-0000-0000-0000-00000245a0a6', '00000000-0000-0000-0000-00000245a0b1', '00000000-0000-0000-0000-00000245a0e1', '00000000-0000-0000-0000-00000245a0c1', 'Trim Set · “Is the pan drain run to the hub?” · need a part: caps · Self close job A')$q$);
SELECT scc.runs('Luis sends d1 on job A', $q$SELECT scc.send('00000000-0000-0000-0000-00000245a0f2', '00000000-0000-0000-0000-00000245a0a6', '00000000-0000-0000-0000-00000245a0b1', '00000000-0000-0000-0000-00000245a0e1', '00000000-0000-0000-0000-00000245a0d1', 'Trim Set · “Are the carriers in units 7 and 8 set?” · need a decision · Self close job A')$q$);
SELECT scc.runs('Luis sends c1 on job B', $q$SELECT scc.send('00000000-0000-0000-0000-00000245a0f3', '00000000-0000-0000-0000-00000245a0a6', '00000000-0000-0000-0000-00000245a0b2', '00000000-0000-0000-0000-00000245a0e2', '00000000-0000-0000-0000-00000245a0c1', 'Trim Set · “Is the pan drain run to the hub?” · not on this job · Self close job B')$q$);
SELECT scc.runs('Luis sends c2 on job A', $q$SELECT scc.send('00000000-0000-0000-0000-00000245a0f4', '00000000-0000-0000-0000-00000245a0a6', '00000000-0000-0000-0000-00000245a0b1', '00000000-0000-0000-0000-00000245a0e1', '00000000-0000-0000-0000-00000245a0c2', 'Trim Set · “Are the cleanouts capped?” · can''t do it · Self close job A')$q$);
SELECT scc.runs('Luis sends c3 on job A', $q$SELECT scc.send('00000000-0000-0000-0000-00000245a0f9', '00000000-0000-0000-0000-00000245a0a6', '00000000-0000-0000-0000-00000245a0b1', '00000000-0000-0000-0000-00000245a0e1', '00000000-0000-0000-0000-00000245a0c3', 'Trim Set · “Is the water heater strapped?” · need a part · Self close job A')$q$);
SELECT scc.runs('Luis sends d2 on job A', $q$SELECT scc.send('00000000-0000-0000-0000-00000245a0f7', '00000000-0000-0000-0000-00000245a0a6', '00000000-0000-0000-0000-00000245a0b1', '00000000-0000-0000-0000-00000245a0e1', '00000000-0000-0000-0000-00000245a0d2', 'Trim Set · “Is the hose bib stubbed out?” · need a decision · Self close job A')$q$);
SELECT scc.runs('Luis sends a plain request', $q$INSERT INTO public.dispatch_requests (id, from_user_id, title, job_ledger_id) VALUES ('00000000-0000-0000-0000-00000245a0f5', '00000000-0000-0000-0000-00000245a0a6', 'Pick up the permit at the county', '00000000-0000-0000-0000-00000245a0b1')$q$);
SELECT scc.same('every request is open', (SELECT count(*)::text FROM public.dispatch_requests WHERE from_user_id = '00000000-0000-0000-0000-00000245a0a6' AND status = 'open'), '7');

-- 2 · A note alone settles nothing; the crew cannot close the request themselves; the answer closes it in their name.
SELECT scc.runs('Luis leaves a note on c1', $q$INSERT INTO public.stage_checklist_answers (id, job_id, fixture_id, question_id, note, answered_by, answered_by_name) VALUES ('00000000-0000-0000-0000-00000245a1a1', '00000000-0000-0000-0000-00000245a0b1', '00000000-0000-0000-0000-00000245a0e1', '00000000-0000-0000-0000-00000245a0c1', 'the hub is not poured', '00000000-0000-0000-0000-00000245a0a6', 'Luis Ortega')$q$);
SELECT scc.same('and the request stays open', scc.request('00000000-0000-0000-0000-00000245a0f1'), 'open / - / by -');
SELECT scc.same('Luis''s own close reaches no row', scc.touched($q$UPDATE public.dispatch_requests SET status = 'closed', closed_note = 'mine' WHERE id = '00000000-0000-0000-0000-00000245a0f1'$q$), '0');
SELECT scc.same('so it is still open', scc.request('00000000-0000-0000-0000-00000245a0f1'), 'open / - / by -');
SELECT scc.runs('Luis answers c1 Yes', $q$UPDATE public.stage_checklist_answers SET pick = 'yes', answered_by = '00000000-0000-0000-0000-00000245a0a6', answered_by_name = 'Luis Ortega', answered_at = now(), updated_at = now() WHERE id = '00000000-0000-0000-0000-00000245a1a1'$q$);
SELECT scc.same('the request closed itself in his name', scc.request('00000000-0000-0000-0000-00000245a0f1'), 'closed / Answered on the sheet by Luis Ortega · Yes / by a6');
SELECT scc.same('job B''s request on the same question stays open', scc.request('00000000-0000-0000-0000-00000245a0f3'), 'open / - / by -');
SELECT scc.same('the request on another check stays open', scc.request('00000000-0000-0000-0000-00000245a0f9'), 'open / - / by -');
SELECT scc.same('the plain request stays open', scc.request('00000000-0000-0000-0000-00000245a0f5'), 'open / - / by -');
CREATE TEMP TABLE first_close AS SELECT scc.closed_at('00000000-0000-0000-0000-00000245a0f1') AS at;
GRANT SELECT ON first_close TO authenticated;
SELECT scc.runs('Luis presses Yes again', $q$UPDATE public.stage_checklist_answers SET pick = 'yes', answered_at = now() + interval '1 second', updated_at = now() WHERE id = '00000000-0000-0000-0000-00000245a1a1'$q$);
SELECT scc.same('and the closed request is as it was', scc.closed_at('00000000-0000-0000-0000-00000245a0f1'), (SELECT at FROM first_close));
SELECT scc.same('its content is as written', scc.content('00000000-0000-0000-0000-00000245a0f1'), 'Trim Set · “Is the pan drain run to the hub?” · need a part: caps · Self close job A / from a6 / stage_check / stage e1 / check c1');

-- 3 · A new send on the settled check is allowed, and a skip on the job closes it with the reason.
SELECT scc.runs('Luis sends c1 on job A again', $q$SELECT scc.send('00000000-0000-0000-0000-00000245a0f6', '00000000-0000-0000-0000-00000245a0a6', '00000000-0000-0000-0000-00000245a0b1', '00000000-0000-0000-0000-00000245a0e1', '00000000-0000-0000-0000-00000245a0c1', 'Trim Set · “Is the pan drain run to the hub?” · need a decision · Self close job A')$q$);
RESET ROLE;
SELECT scc.as_user('00000000-0000-0000-0000-00000245a0a4');
SET LOCAL ROLE authenticated;
SELECT scc.runs('Sal skips c1 on job A', $q$INSERT INTO public.stage_checklist_skips (job_id, fixture_id, question_id, why, skipped_by, skipped_by_name) VALUES ('00000000-0000-0000-0000-00000245a0b1', '00000000-0000-0000-0000-00000245a0e1', '00000000-0000-0000-0000-00000245a0c1', 'the hub is not poured yet', '00000000-0000-0000-0000-00000245a0a4', 'Sal Super')$q$);
SELECT scc.same('the new request closed with the reason', scc.request('00000000-0000-0000-0000-00000245a0f6'), 'closed / Skipped on this job by Sal Super: the hub is not poured yet / by a4');
SELECT scc.same('job B''s request still stands', scc.request('00000000-0000-0000-0000-00000245a0f3'), 'open / - / by -');

-- 4 · A job item taken off closes its stage's request; a company question retired closes the request on every stage.
SELECT scc.runs('Sal takes d1 off', $q$UPDATE public.stage_checklist_templates SET retired_at = now(), retired_by = '00000000-0000-0000-0000-00000245a0a4', updated_at = now() WHERE id = '00000000-0000-0000-0000-00000245a0d1'$q$);
SELECT scc.same('d1''s request closed as taken off', scc.request('00000000-0000-0000-0000-00000245a0f2'), 'closed / Taken off by Sal Super / by a4');
RESET ROLE;
SELECT scc.as_user('00000000-0000-0000-0000-00000245a0a3');
SET LOCAL ROLE authenticated;
SELECT scc.runs('Dee retires c1 from the company''s list', $q$UPDATE public.stage_checklist_templates SET retired_at = now(), updated_at = now() WHERE id = '00000000-0000-0000-0000-00000245a0c1'$q$);
SELECT scc.same('job B''s request closed in her name', scc.request('00000000-0000-0000-0000-00000245a0f3'), 'closed / Taken off the company''s list by Dee Dev / by a3');
SELECT scc.same('the request on c3 is still open', scc.request('00000000-0000-0000-0000-00000245a0f9'), 'open / - / by -');

-- 5 · A job item promoted to the company's list says so, and a later take off in the same transaction reads no stale note.
SELECT scc.runs('Dee adds d2 to the company''s list', $q$SELECT public.promote_stage_checklist_item('00000000-0000-0000-0000-00000245a0d2')$q$);
SELECT scc.same('d2''s request closed as added, not taken off', scc.request('00000000-0000-0000-0000-00000245a0f7'), 'closed / Added to the company''s list by Dee Dev / by a3');
SELECT scc.runs('Dee adds d3 on job A', $q$INSERT INTO public.stage_checklist_templates (id, stage_kind, sort_order, words, job_id, fixture_id, created_by, created_by_name) VALUES ('00000000-0000-0000-0000-00000245a0d3', 'trim_set', 3, 'Is the dishwasher air gap set?', '00000000-0000-0000-0000-00000245a0b1', '00000000-0000-0000-0000-00000245a0e1', '00000000-0000-0000-0000-00000245a0a3', 'Dee Dev')$q$);
RESET ROLE;
SELECT scc.as_user('00000000-0000-0000-0000-00000245a0a6');
SET LOCAL ROLE authenticated;
SELECT scc.runs('Luis sends d3', $q$SELECT scc.send('00000000-0000-0000-0000-00000245a0f8', '00000000-0000-0000-0000-00000245a0a6', '00000000-0000-0000-0000-00000245a0b1', '00000000-0000-0000-0000-00000245a0e1', '00000000-0000-0000-0000-00000245a0d3', 'Trim Set · “Is the dishwasher air gap set?” · need a part · Self close job A')$q$);
RESET ROLE;
SELECT scc.as_user('00000000-0000-0000-0000-00000245a0a3');
SET LOCAL ROLE authenticated;
SELECT scc.runs('Dee takes d3 off', $q$UPDATE public.stage_checklist_templates SET retired_at = now(), retired_by = '00000000-0000-0000-0000-00000245a0a3', updated_at = now() WHERE id = '00000000-0000-0000-0000-00000245a0d3'$q$);
SELECT scc.same('d3''s request closed as taken off', scc.request('00000000-0000-0000-0000-00000245a0f8'), 'closed / Taken off by Dee Dev / by a3');
RESET ROLE;

-- 6 · A photo alone settles nothing; Dispatch's own answer on the sheet closes the request in their name.
SELECT scc.as_user('00000000-0000-0000-0000-00000245a0a6');
SET LOCAL ROLE authenticated;
SELECT scc.runs('Luis attaches a photo on c2', $q$INSERT INTO public.stage_checklist_answers (id, job_id, fixture_id, question_id, photo_file_name, photo_taken_at, photo_storage_path, answered_by, answered_by_name) VALUES ('00000000-0000-0000-0000-00000245a1a2', '00000000-0000-0000-0000-00000245a0b1', '00000000-0000-0000-0000-00000245a0e1', '00000000-0000-0000-0000-00000245a0c2', 'cleanouts.jpg', now(), '00000000-0000-0000-0000-00000245a0b1/x2.jpg', '00000000-0000-0000-0000-00000245a0a6', 'Luis Ortega')$q$);
SELECT scc.same('and c2''s request stays open', scc.request('00000000-0000-0000-0000-00000245a0f4'), 'open / - / by -');
RESET ROLE;
SELECT scc.as_user('00000000-0000-0000-0000-00000245a0a1');
SET LOCAL ROLE authenticated;
SELECT scc.runs('Jo answers c2 Not here', $q$UPDATE public.stage_checklist_answers SET pick = 'not_here', answered_by = '00000000-0000-0000-0000-00000245a0a1', answered_by_name = 'Jo Office', answered_at = now(), updated_at = now() WHERE id = '00000000-0000-0000-0000-00000245a1a2'$q$);
SELECT scc.same('c2''s request closed in her name', scc.request('00000000-0000-0000-0000-00000245a0f4'), 'closed / Answered on the sheet by Jo Office · Not here / by a1');
RESET ROLE;

-- 7 · A pick already there before the send counts again when it is pressed again: answered_at moves.
SELECT scc.as_user('00000000-0000-0000-0000-00000245a0a6');
SET LOCAL ROLE authenticated;
SELECT scc.runs('Luis answers c4 Yes before sending', $q$INSERT INTO public.stage_checklist_answers (id, job_id, fixture_id, question_id, pick, answered_by, answered_by_name, answered_at) VALUES ('00000000-0000-0000-0000-00000245a1a4', '00000000-0000-0000-0000-00000245a0b1', '00000000-0000-0000-0000-00000245a0e1', '00000000-0000-0000-0000-00000245a0c4', 'yes', '00000000-0000-0000-0000-00000245a0a6', 'Luis Ortega', now() - interval '1 hour')$q$);
SELECT scc.runs('then sends c4', $q$SELECT scc.send('00000000-0000-0000-0000-00000245a0fa', '00000000-0000-0000-0000-00000245a0a6', '00000000-0000-0000-0000-00000245a0b1', '00000000-0000-0000-0000-00000245a0e1', '00000000-0000-0000-0000-00000245a0c4', 'Trim Set · “Is the shutoff labeled?” · need a decision: is Yes right? · Self close job A')$q$);
SELECT scc.same('the request is open with the pick already there', scc.request('00000000-0000-0000-0000-00000245a0fa'), 'open / - / by -');
SELECT scc.runs('Luis saves a note on it', $q$UPDATE public.stage_checklist_answers SET note = 'labeled in marker', updated_at = now() WHERE id = '00000000-0000-0000-0000-00000245a1a4'$q$);
SELECT scc.same('and a note alone leaves it open', scc.request('00000000-0000-0000-0000-00000245a0fa'), 'open / - / by -');
SELECT scc.runs('Luis presses Yes again', $q$UPDATE public.stage_checklist_answers SET pick = 'yes', answered_by = '00000000-0000-0000-0000-00000245a0a6', answered_by_name = 'Luis Ortega', answered_at = now(), updated_at = now() WHERE id = '00000000-0000-0000-0000-00000245a1a4'$q$);
SELECT scc.same('the same pick pressed again settles it', scc.request('00000000-0000-0000-0000-00000245a0fa'), 'closed / Answered on the sheet by Luis Ortega · Yes / by a6');
RESET ROLE;

-- 8 · What stayed open stayed open.
SELECT scc.same('the request on c3 is open to the end', scc.request('00000000-0000-0000-0000-00000245a0f9'), 'open / - / by -');
SELECT scc.same('the plain request is open to the end', scc.request('00000000-0000-0000-0000-00000245a0f5'), 'open / - / by -');
SELECT scc.same('eight closed, two open', (SELECT count(*) FILTER (WHERE status = 'closed')::text || ' / ' || count(*) FILTER (WHERE status = 'open')::text FROM public.dispatch_requests WHERE from_user_id = '00000000-0000-0000-0000-00000245a0a6'), '8 / 2');

DO $$ BEGIN RAISE NOTICE 'stage_check_self_close PASSED'; END $$;
ROLLBACK;
