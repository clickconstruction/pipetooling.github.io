-- View as and Imitate (v2.8459, migration *_imitated_session_holds_seen_marks): the four "seen" marks refuse a session
-- someone else opened as the person, and a press is not held. Fixtures are written as postgres; each try runs as the
-- account under RLS with the amr its sign-in would carry; everything rolls back. Raises on the first failed
-- assertion; ends with "imitated_seen_marks PASSED". See scripts/pgtest-imitated-session.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Ana is the office, the one a dev looks as. Ben estimates. Mo is the job's master. Dee is the dev.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000084590a1', 'ana@seenmarks.test'),
  ('00000000-0000-0000-0000-0000084590a2', 'ben@seenmarks.test'),
  ('00000000-0000-0000-0000-0000084590a3', 'dee@seenmarks.test'),
  ('00000000-0000-0000-0000-0000084590a4', 'mo@seenmarks.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000084590a1', 'ana@seenmarks.test', 'Ana Office', 'assistant', false, false, NULL),
  ('00000000-0000-0000-0000-0000084590a2', 'ben@seenmarks.test', 'Ben Bids', 'estimator', false, false, NULL),
  ('00000000-0000-0000-0000-0000084590a3', 'dee@seenmarks.test', 'Dee Dev', 'dev', false, false, NULL),
  ('00000000-0000-0000-0000-0000084590a4', 'mo@seenmarks.test', 'Mo Master', 'master_technician', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, archived_at = EXCLUDED.archived_at;

-- One thing of each kind that is new for Ana: an answer to a job note she tagged Ben in, an answer to a task note she
-- tagged him in, a bid Ben marked for her, and a law firm's answers nobody in the office has opened.
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000084590f9', 'Seen Marks Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name) VALUES
  ('00000000-0000-0000-0000-0000084590b1', '00000000-0000-0000-0000-0000084590a4', '00000000-0000-0000-0000-0000084590f9', 'Cedar Bluff Lofts');
INSERT INTO public.jobs_ledger_thread_notes (id, job_id, author_user_id, body, created_at) VALUES
  ('00000000-0000-0000-0000-0000084590c1', '00000000-0000-0000-0000-0000084590b1', '00000000-0000-0000-0000-0000084590a1', 'which riser', now() - interval '10 minutes');
INSERT INTO public.jobs_ledger_note_tags (id, note_id, job_id, tagged_user_id, tagged_name, tagger_user_id, cleared_at, cleared_how) VALUES
  ('00000000-0000-0000-0000-0000084590c2', '00000000-0000-0000-0000-0000084590c1', '00000000-0000-0000-0000-0000084590b1',
   '00000000-0000-0000-0000-0000084590a2', 'Ben Bids', '00000000-0000-0000-0000-0000084590a1', now(), 'done');

INSERT INTO public.checklist_items (id, title, created_by_user_id, repeat_type, start_date) VALUES
  ('00000000-0000-0000-0000-0000084590d1', 'Sweep the shop bays', '00000000-0000-0000-0000-0000084590a1', 'once', current_date - 30);
INSERT INTO public.checklist_instances (id, checklist_item_id, scheduled_date) VALUES
  ('00000000-0000-0000-0000-0000084590e1', '00000000-0000-0000-0000-0000084590d1', current_date - 30);
INSERT INTO public.checklist_instance_events (id, instance_id, event_type, actor_user_id, body, created_at) VALUES
  ('00000000-0000-0000-0000-0000084590c3', '00000000-0000-0000-0000-0000084590e1', 'comment', '00000000-0000-0000-0000-0000084590a1', 'which bay', now() - interval '10 minutes');
INSERT INTO public.task_note_tags (id, event_id, instance_id, item_id, tagged_user_id, tagged_name, tagger_user_id, cleared_at, cleared_how) VALUES
  ('00000000-0000-0000-0000-0000084590c4', '00000000-0000-0000-0000-0000084590c3', '00000000-0000-0000-0000-0000084590e1', '00000000-0000-0000-0000-0000084590d1',
   '00000000-0000-0000-0000-0000084590a2', 'Ben Bids', '00000000-0000-0000-0000-0000084590a1', now(), 'done');

INSERT INTO public.bids (id, created_by, account_manager_id, service_type_id, project_name) VALUES
  ('00000000-0000-0000-0000-0000084590d2', '00000000-0000-0000-0000-0000084590a2', '00000000-0000-0000-0000-0000084590a1',
   '00000000-0000-0000-0000-0000084590f9', 'Seen marks: the restrooms');
INSERT INTO public.bid_mark_requests (id, bid_id, for_user_id, from_user_id, note) VALUES
  ('00000000-0000-0000-0000-0000084590c5', '00000000-0000-0000-0000-0000084590d2', '00000000-0000-0000-0000-0000084590a1', '00000000-0000-0000-0000-0000084590a2', 'Reprice the trim.');

INSERT INTO public.legal_firms (id, name, active) VALUES ('00000000-0000-0000-0000-0000084590f1', 'ZZ Seen Marks Firm', true);
UPDATE public.legal_firms SET intake_sent_at = now() - interval '1 hour', intake_seen_at = NULL WHERE id = '00000000-0000-0000-0000-0000084590f1';

CREATE SCHEMA imit;
GRANT USAGE ON SCHEMA imit TO authenticated;
CREATE FUNCTION imit.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION imit.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- One amr entry as GoTrue writes it: the method and the second it was used, counted from now.
CREATE FUNCTION imit.entry(p_method text, p_from_now interval) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('method', p_method, 'timestamp', floor(extract(epoch FROM now() + p_from_now))::bigint)
$$;
-- Sign in as a person with the amr their token would carry.
CREATE FUNCTION imit.sign_in(p_user uuid, p_amr jsonb) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated', 'amr', p_amr)::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- login-as-user's hand: the only imitation on record is of this person, made this long from now.
CREATE FUNCTION imit.imitated(p_target uuid, p_from_now interval) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM public.user_imitations WHERE target_id IN ('00000000-0000-0000-0000-0000084590a1', '00000000-0000-0000-0000-0000084590a2');
  INSERT INTO public.user_imitations (operator_id, target_id, created_at)
    VALUES ('00000000-0000-0000-0000-0000084590a3', p_target, now() + p_from_now);
END $$;
-- The four things as one line: new, or seen.
CREATE FUNCTION imit.marks() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT 'job ' || (SELECT CASE WHEN asker_seen_at IS NULL THEN 'new' ELSE 'seen' END FROM public.jobs_ledger_note_tags WHERE id = '00000000-0000-0000-0000-0000084590c2')
      || ', task ' || (SELECT CASE WHEN asker_seen_at IS NULL THEN 'new' ELSE 'seen' END FROM public.task_note_tags WHERE id = '00000000-0000-0000-0000-0000084590c4')
      || ', bid ' || (SELECT CASE WHEN seen_at IS NULL THEN 'new' ELSE 'seen' END FROM public.bid_mark_requests WHERE id = '00000000-0000-0000-0000-0000084590c5')
      || ', firm ' || (SELECT CASE WHEN intake_seen_at IS NULL THEN 'new' ELSE 'seen' END FROM public.legal_firms WHERE id = '00000000-0000-0000-0000-0000084590f1')
$$;
-- All four new again.
CREATE FUNCTION imit.fresh() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.jobs_ledger_note_tags SET asker_seen_at = NULL WHERE id = '00000000-0000-0000-0000-0000084590c2';
  UPDATE public.task_note_tags SET asker_seen_at = NULL WHERE id = '00000000-0000-0000-0000-0000084590c4';
  UPDATE public.bid_mark_requests SET seen_at = NULL, closed_at = NULL, outcome = NULL WHERE id = '00000000-0000-0000-0000-0000084590c5';
  UPDATE public.legal_firms SET intake_seen_at = NULL WHERE id = '00000000-0000-0000-0000-0000084590f1';
END $$;
-- The four calls the app makes with no press, as one line of their answers.
CREATE FUNCTION imit.look() RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v text;
BEGIN
  v := public.job_note_tags_seen()::text || ' ' || public.task_note_tags_seen()::text || ' '
    || public.bid_mark_requests_seen('00000000-0000-0000-0000-0000084590d2')::text;
  PERFORM public.legal_firm_intake_seen('00000000-0000-0000-0000-0000084590f1');
  RETURN v;
END $$;
CREATE FUNCTION imit.request() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(outcome, 'open') FROM public.bid_mark_requests WHERE id = '00000000-0000-0000-0000-0000084590c5'
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA imit TO authenticated;

-- The structure: each function is as its first file left it, but for the one early return.
SELECT imit.same('the four run as their owner with the settings they had', (
  SELECT string_agg(proname || ' ' || prosecdef::text || ' ' || array_to_string(proconfig, ','), ', ' ORDER BY proname)
  FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('job_note_tags_seen', 'task_note_tags_seen', 'bid_mark_requests_seen', 'legal_firm_intake_seen')
), 'bid_mark_requests_seen true search_path=public, job_note_tags_seen true search_path=public,row_security=off, legal_firm_intake_seen true search_path=public, task_note_tags_seen true search_path=public,row_security=off');
SELECT imit.same('each is open to a signed-in caller and closed to anon', (
  SELECT string_agg(has_function_privilege('authenticated', f, 'EXECUTE')::text || ' ' || has_function_privilege('anon', f, 'EXECUTE')::text, ', ' ORDER BY f)
  FROM unnest(ARRAY['public.bid_mark_requests_seen(uuid)', 'public.job_note_tags_seen()', 'public.legal_firm_intake_seen(uuid)', 'public.task_note_tags_seen()']) AS f
), 'true false, true false, true false, true false');
SELECT imit.same('all four start new', imit.marks(), 'job new, task new, bid new, firm new');

SET ROLE authenticated;

-- Ana's own password sign-in, seconds after a dev looked as her: her own look, and it marks all four.
SELECT imit.imitated('00000000-0000-0000-0000-0000084590a1', interval '-3 seconds');
SELECT imit.sign_in('00000000-0000-0000-0000-0000084590a1', jsonb_build_array(imit.entry('password', interval '0')));
SELECT imit.same('a password session is Ana''s own', public.session_opened_by_imitation()::text, 'false');
SELECT imit.same('her own look answers one of each', imit.look(), '1 1 1');
SELECT imit.same('and marks all four seen', imit.marks(), 'job seen, task seen, bid seen, firm seen');
SELECT imit.fresh();

-- The dev's look: login-as-user wrote the row, and the page verified the link three seconds later.
SELECT imit.sign_in('00000000-0000-0000-0000-0000084590a1', jsonb_build_array(imit.entry('otp', interval '0')));
SELECT imit.same('the dev''s look is an imitation', public.session_opened_by_imitation()::text, 'true');
SELECT imit.same('the look answers as if nothing were there', imit.look(), '0 0 0');
SELECT imit.same('and all four stay new for Ana', imit.marks(), 'job new, task new, bid new, firm new');

-- The redirect's method counts too.
SELECT imit.sign_in('00000000-0000-0000-0000-0000084590a1', jsonb_build_array(imit.entry('magiclink', interval '0')));
SELECT imit.same('a look by the redirect answers the same', imit.look(), '0 0 0');
SELECT imit.same('and still marks nothing', imit.marks(), 'job new, task new, bid new, firm new');

-- A press in View as is not held: Done on the bid request saves as Ana.
SELECT public.bid_mark_requests_close('00000000-0000-0000-0000-0000084590d2', 'done');
SELECT imit.same('Done pressed in the look closes the request', imit.request(), 'done');
SELECT imit.fresh();

-- The office check still speaks first: Ben, who is not the office, is refused in words, looked as or not.
SELECT imit.imitated('00000000-0000-0000-0000-0000084590a2', interval '-3 seconds');
SELECT imit.sign_in('00000000-0000-0000-0000-0000084590a2', jsonb_build_array(imit.entry('otp', interval '0')));
SELECT imit.same('a look as Ben is an imitation', public.session_opened_by_imitation()::text, 'true');
SELECT imit.refused('a look as Ben at the firm''s answers', $q$SELECT public.legal_firm_intake_seen('00000000-0000-0000-0000-0000084590f1')$q$, 'Only the office reads');
SELECT imit.sign_in('00000000-0000-0000-0000-0000084590a2', jsonb_build_array(imit.entry('password', interval '0')));
SELECT imit.refused('Ben himself at the firm''s answers', $q$SELECT public.legal_firm_intake_seen('00000000-0000-0000-0000-0000084590f1')$q$, 'Only the office reads');
SELECT imit.same('and nothing of Ana''s moved', imit.marks(), 'job new, task new, bid new, firm new');

-- Ana's own emailed link, ten minutes after a dev looked as her: her own session, and it marks all four.
SELECT imit.imitated('00000000-0000-0000-0000-0000084590a1', interval '-10 minutes');
SELECT imit.sign_in('00000000-0000-0000-0000-0000084590a1', jsonb_build_array(imit.entry('otp', interval '0')));
SELECT imit.same('Ana''s own link ten minutes later is not an imitation', public.session_opened_by_imitation()::text, 'false');
SELECT imit.same('her own link session answers one of each', imit.look(), '1 1 1');
SELECT imit.same('and marks all four seen', imit.marks(), 'job seen, task seen, bid seen, firm seen');

RESET ROLE;
SELECT 'imitated_seen_marks PASSED';
ROLLBACK;
