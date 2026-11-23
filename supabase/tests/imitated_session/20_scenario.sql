-- View as and Imitate (v2.8251, migration *_imitated_session_holds_app_activity): session_opened_by_imitation() and
-- the heartbeat that reads it. Fixtures are written as postgres; each try runs as the account under RLS with the amr
-- its sign-in would carry; everything rolls back. Raises on the first failed assertion; ends with
-- "imitated_session PASSED". See scripts/pgtest-imitated-session.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Pat and Quin are helpers a dev may look as; Dee is the dev.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000082510a1', 'pat@imit.test'),
  ('00000000-0000-0000-0000-0000082510a2', 'quin@imit.test'),
  ('00000000-0000-0000-0000-0000082510a3', 'dee@imit.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000082510a1', 'pat@imit.test', 'Pat Person', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-0000082510a2', 'quin@imit.test', 'Quin Other', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-0000082510a3', 'dee@imit.test', 'Dee Dev', 'dev', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, archived_at = EXCLUDED.archived_at;

CREATE SCHEMA imit;
GRANT USAGE ON SCHEMA imit TO authenticated;
CREATE FUNCTION imit.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- One amr entry as GoTrue writes it: the method and the second it was used, counted from now.
CREATE FUNCTION imit.entry(p_method text, p_from_now interval) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('method', p_method, 'timestamp', floor(extract(epoch FROM now() + p_from_now))::bigint)
$$;
-- Sign in as a person with the amr their token would carry (null: a token with no amr at all).
CREATE FUNCTION imit.sign_in(p_user uuid, p_amr jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_claims jsonb := jsonb_build_object('sub', p_user, 'role', 'authenticated');
BEGIN
  IF p_amr IS NOT NULL THEN v_claims := v_claims || jsonb_build_object('amr', p_amr); END IF;
  PERFORM set_config('request.jwt.claims', v_claims::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION imit.sign_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
-- login-as-user's hand: the only imitation on record is of this person, made this long from now. Null clears them all.
CREATE FUNCTION imit.imitated(p_target uuid, p_from_now interval) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM public.user_imitations WHERE target_id IN ('00000000-0000-0000-0000-0000082510a1', '00000000-0000-0000-0000-0000082510a2');
  IF p_target IS NOT NULL THEN
    INSERT INTO public.user_imitations (operator_id, target_id, created_at)
      VALUES ('00000000-0000-0000-0000-0000082510a3', p_target, now() + p_from_now);
  END IF;
END $$;
-- What the heartbeat left for a person: their seconds on the day and on the page, or 'none'. Then the slate is wiped.
CREATE FUNCTION imit.left_behind(p_user uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_day text;
  v_page text;
BEGIN
  SELECT string_agg(active_seconds::text || CASE WHEN last_seen_at IS NULL THEN ' unseen' ELSE ' seen' END, ', ') INTO v_day
    FROM public.user_app_activity_daily WHERE user_id = p_user;
  SELECT string_agg(page || ' ' || active_seconds::text, ', ' ORDER BY page) INTO v_page
    FROM public.user_app_activity_page_daily WHERE user_id = p_user;
  DELETE FROM public.user_app_activity_page_daily WHERE user_id = p_user;
  DELETE FROM public.user_app_activity_daily WHERE user_id = p_user;
  RETURN coalesce(v_day, 'none') || ' | ' || coalesce(v_page, 'none');
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA imit TO authenticated;

-- The structure.
SELECT imit.same('the question is open to a signed-in caller and closed to anon', (
  SELECT has_function_privilege('authenticated', 'public.session_opened_by_imitation()', 'EXECUTE')::text || ' ' || has_function_privilege('anon', 'public.session_opened_by_imitation()', 'EXECUTE')::text
), 'true false');
SELECT imit.same('both run as their owner with a fixed search path', (
  SELECT string_agg(proname || ' ' || prosecdef::text || ' ' || array_to_string(proconfig, ','), ', ' ORDER BY proname)
  FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('bump_user_app_activity', 'session_opened_by_imitation')
), 'bump_user_app_activity true search_path=public, session_opened_by_imitation true search_path=public');

SET ROLE authenticated;

-- Pat's own password sign-in, minutes after a dev looked as Pat: Pat's own use, and no table is read for it.
SELECT imit.imitated('00000000-0000-0000-0000-0000082510a1', interval '-3 seconds');
SELECT imit.sign_in('00000000-0000-0000-0000-0000082510a1', jsonb_build_array(imit.entry('password', interval '0')));
SELECT imit.same('a password session is never an imitation', public.session_opened_by_imitation()::text, 'false');
SELECT public.bump_user_app_activity(60, 'dashboard');
SELECT imit.same('Pat''s own minute is counted', imit.left_behind('00000000-0000-0000-0000-0000082510a1'), '60 seen | dashboard 60');

-- The dev's look: login-as-user wrote the row, and the page verified the link three seconds later.
SELECT imit.sign_in('00000000-0000-0000-0000-0000082510a1', jsonb_build_array(imit.entry('otp', interval '0')));
SELECT imit.same('a link verified right after an imitation is one', public.session_opened_by_imitation()::text, 'true');
SELECT public.bump_user_app_activity(0, NULL);
SELECT public.bump_user_app_activity(60, 'dashboard');
SELECT imit.same('the look leaves Pat no last seen time and no minute', imit.left_behind('00000000-0000-0000-0000-0000082510a1'), 'none | none');

-- GoTrue's own redirect may record magiclink where the page's verify records otp. Both count.
SELECT imit.sign_in('00000000-0000-0000-0000-0000082510a1', jsonb_build_array(imit.entry('magiclink', interval '0')));
SELECT imit.same('the redirect''s method counts too', public.session_opened_by_imitation()::text, 'true');

-- A slow page: the link is verified ninety seconds after the row.
SELECT imit.imitated('00000000-0000-0000-0000-0000082510a1', interval '-90 seconds');
SELECT imit.sign_in('00000000-0000-0000-0000-0000082510a1', jsonb_build_array(imit.entry('otp', interval '0')));
SELECT imit.same('ninety seconds after the row still counts', public.session_opened_by_imitation()::text, 'true');

-- The two clocks apart: the row reads half a minute after the sign-in.
SELECT imit.imitated('00000000-0000-0000-0000-0000082510a1', interval '30 seconds');
SELECT imit.same('a row half a minute after the sign-in counts', public.session_opened_by_imitation()::text, 'true');

-- Pat's own emailed link, ten minutes after a dev looked as Pat: Pat's own session, for as long as it lives.
SELECT imit.imitated('00000000-0000-0000-0000-0000082510a1', interval '-10 minutes');
SELECT imit.same('Pat''s own link ten minutes later is not an imitation', public.session_opened_by_imitation()::text, 'false');
SELECT public.bump_user_app_activity(0, NULL);
SELECT public.bump_user_app_activity(45, 'jobs:stages');
SELECT imit.same('Pat''s own link session is counted', imit.left_behind('00000000-0000-0000-0000-0000082510a1'), '45 seen | jobs:stages 45');

-- And Pat's own link five minutes before a dev looks as Pat.
SELECT imit.imitated('00000000-0000-0000-0000-0000082510a1', interval '5 minutes');
SELECT imit.same('a row five minutes after the sign-in does not count', public.session_opened_by_imitation()::text, 'false');

-- An imitation of someone else says nothing about Pat.
SELECT imit.imitated('00000000-0000-0000-0000-0000082510a2', interval '-3 seconds');
SELECT imit.same('an imitation of Quin is not one of Pat', public.session_opened_by_imitation()::text, 'false');
SELECT imit.sign_in('00000000-0000-0000-0000-0000082510a2', jsonb_build_array(imit.entry('otp', interval '0')));
SELECT imit.same('and it is one of Quin', public.session_opened_by_imitation()::text, 'true');

-- A token with more than one sign-in on it: the link's own time is the one read.
SELECT imit.imitated('00000000-0000-0000-0000-0000082510a1', interval '-3 seconds');
SELECT imit.sign_in('00000000-0000-0000-0000-0000082510a1', jsonb_build_array(imit.entry('password', interval '-1 hour'), imit.entry('otp', interval '0')));
SELECT imit.same('a link now beside an older password counts', public.session_opened_by_imitation()::text, 'true');
SELECT imit.sign_in('00000000-0000-0000-0000-0000082510a1', jsonb_build_array(imit.entry('otp', interval '-1 hour'), imit.entry('password', interval '0')));
SELECT imit.same('a link an hour old beside a password now does not', public.session_opened_by_imitation()::text, 'false');

-- A claim that cannot be read is not proof, and the heartbeat still counts. An imitation three seconds old stands by.
SELECT imit.sign_in('00000000-0000-0000-0000-0000082510a1', NULL);
SELECT imit.same('no amr at all', public.session_opened_by_imitation()::text, 'false');
SELECT imit.sign_in('00000000-0000-0000-0000-0000082510a1', '"otp"'::jsonb);
SELECT imit.same('an amr that is not a list', public.session_opened_by_imitation()::text, 'false');
SELECT imit.sign_in('00000000-0000-0000-0000-0000082510a1', '["otp"]'::jsonb);
SELECT imit.same('an amr of bare names, with no time', public.session_opened_by_imitation()::text, 'false');
SELECT imit.sign_in('00000000-0000-0000-0000-0000082510a1', '[{"method":"otp","timestamp":"soon"}]'::jsonb);
SELECT imit.same('a time that is not a number', public.session_opened_by_imitation()::text, 'false');
SELECT imit.sign_in('00000000-0000-0000-0000-0000082510a1', '[{"method":"otp","timestamp":1e400}, null, 7]'::jsonb);
SELECT imit.same('a time no date can hold answers false and does not raise', public.session_opened_by_imitation()::text, 'false');
SELECT public.bump_user_app_activity(60, 'dashboard');
SELECT imit.same('and the heartbeat still counts', imit.left_behind('00000000-0000-0000-0000-0000082510a1'), '60 seen | dashboard 60');

-- Dee, who did the looking, on a password session: Dee's own use is Dee's.
SELECT imit.sign_in('00000000-0000-0000-0000-0000082510a3', jsonb_build_array(imit.entry('password', interval '0')));
SELECT imit.same('the dev who looked is not imitated', public.session_opened_by_imitation()::text, 'false');
SELECT public.bump_user_app_activity(60, 'settings');
SELECT imit.same('the dev''s own minute is counted', imit.left_behind('00000000-0000-0000-0000-0000082510a3'), '60 seen | settings 60');

-- Nobody signed in.
SELECT imit.sign_out();
SELECT imit.same('no session is no imitation', public.session_opened_by_imitation()::text, 'false');
SELECT public.bump_user_app_activity(60, 'dashboard');
RESET ROLE;
SELECT imit.same('and the heartbeat writes nothing for nobody', (SELECT count(*)::text FROM public.user_app_activity_daily WHERE user_id IN ('00000000-0000-0000-0000-0000082510a1', '00000000-0000-0000-0000-0000082510a2', '00000000-0000-0000-0000-0000082510a3')), '0');

SELECT 'imitated_session PASSED';
ROLLBACK;
