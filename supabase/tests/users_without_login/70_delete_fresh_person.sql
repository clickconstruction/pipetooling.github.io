\set ON_ERROR_STOP on
\set QUIET on
-- After 20261109110000_delete_fresh_person.sql (v2.6789). The dev (Dana Okafor), the assistant (Lee Park) and the helper
-- login (Noor Haddad) from 30_add_worker; the people made here are made up. The bed grows the pay-config table here, the
-- one setup row the Hire form writes that the scan must let go with the person (its key is RESTRICT).
CREATE TABLE IF NOT EXISTS public.people_pay_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_name text NOT NULL UNIQUE,
  person_id uuid REFERENCES public.people(id) ON DELETE RESTRICT,
  hourly_wage numeric
);
-- The stint table the people row's dates mirror into (20261103203000), keyed CASCADE: the record, not history (v2.6798).
CREATE TABLE IF NOT EXISTS public.employment_stints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  start_date date,
  end_date date
);
DO $$
DECLARE
  v_dev uuid := '11111111-1111-4111-8111-111111111111';
  v_assistant uuid := '55555555-5555-4555-8555-555555555555';
  v_helper uuid := '66666666-6666-4666-8666-666666666666';
  v_json jsonb; v_user uuid; v_person uuid; v_n int;
BEGIN
  -- D1. A fresh hire: the users row with no login and its record. Nobody signed in, a helper and an assistant are refused.
  PERFORM t_as(v_dev);
  v_json := public.add_worker('Dobert Rouglas', 'assistant', 'dobert@example.test');
  v_user := (v_json->>'user_id')::uuid; v_person := (v_json->>'person_id')::uuid;
  PERFORM t_as(NULL);
  BEGIN
    PERFORM public.delete_fresh_person(v_user);
    RAISE EXCEPTION 'FAILED: D1 — no caller should be refused';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM t_as(v_helper);
  BEGIN
    PERFORM public.delete_fresh_person(v_user);
    RAISE EXCEPTION 'FAILED: D1 — a helper should be refused';
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM t_assert(SQLERRM LIKE 'A dev, the controller or a pay-approved leader%', 'D1 words ' || SQLERRM);
  END;
  PERFORM t_as(v_assistant);
  BEGIN
    PERFORM public.delete_fresh_person(v_user);
    RAISE EXCEPTION 'FAILED: D1 — an assistant should be refused';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  SELECT count(*) INTO v_n FROM public.users WHERE id = v_user; PERFORM t_assert(v_n = 1, 'D1 row still there');
  RAISE NOTICE 'ok D1: delete_fresh_person refuses nobody, a helper and an assistant with 42501, and the row stays';

  -- D2. The dev's dry run on a fresh row: no holds, nothing deleted.
  PERFORM t_as(v_dev);
  v_json := public.delete_fresh_person(v_user, true);
  PERFORM t_assert((v_json->>'deleted')::boolean = false AND (v_json->>'dry_run')::boolean = true, 'D2 dry run flags');
  PERFORM t_assert(jsonb_array_length(v_json->'holds') = 0, 'D2 holds ' || (v_json->'holds')::text);
  PERFORM t_assert(v_json->>'name' = 'Dobert Rouglas' AND (v_json->>'person_id')::uuid = v_person, 'D2 names the person');
  SELECT count(*) INTO v_n FROM public.users WHERE id = v_user; PERFORM t_assert(v_n = 1, 'D2 nothing deleted');
  RAISE NOTICE 'ok D2: a dry run on a fresh row answers no holds and deletes nothing';

  -- D3. A clock session on the person is a hold: the call answers it and deletes nothing.
  PERFORM t_as(NULL);
  INSERT INTO public.clock_sessions (user_id, clocked_in_at, clocked_out_at, work_date, origin)
  VALUES (v_user, '2026-11-09 13:00+00', '2026-11-09 17:00+00', '2026-11-09', 'user_punch');
  PERFORM t_as(v_dev);
  v_json := public.delete_fresh_person(v_user);
  PERFORM t_assert((v_json->>'deleted')::boolean = false, 'D3 not deleted');
  PERFORM t_assert(jsonb_array_length(v_json->'holds') = 1, 'D3 one hold ' || (v_json->'holds')::text);
  PERFORM t_assert(v_json->'holds'->0->>'table' = 'clock_sessions' AND (v_json->'holds'->0->>'count')::int = 1, 'D3 hold names clock_sessions ' || (v_json->'holds')::text);
  SELECT count(*) INTO v_n FROM public.users WHERE id = v_user; PERFORM t_assert(v_n = 1, 'D3 row stays');
  SELECT count(*) INTO v_n FROM public.people WHERE id = v_person; PERFORM t_assert(v_n = 1, 'D3 record stays');
  RAISE NOTICE 'ok D3: a clock session holds the delete; the answer names the table and its count, nothing goes';

  -- D4. A session approved by the person (a key from clock_sessions.approved_by) counts too; cleared, the delete goes through.
  PERFORM t_as(NULL);
  DELETE FROM public.clock_sessions WHERE user_id = v_user;
  UPDATE public.clock_sessions SET approved_by = v_user WHERE user_id = v_helper;
  PERFORM t_as(v_dev);
  v_json := public.delete_fresh_person(v_user, true);
  SELECT count(*) INTO v_n FROM public.clock_sessions WHERE approved_by = v_user;
  PERFORM t_assert(jsonb_array_length(v_json->'holds') = CASE WHEN v_n > 0 THEN 1 ELSE 0 END, 'D4 approved_by hold ' || (v_json->'holds')::text);
  PERFORM t_as(NULL);
  UPDATE public.clock_sessions SET approved_by = NULL WHERE approved_by = v_user;
  PERFORM t_as(v_dev);
  v_json := public.delete_fresh_person(v_user);
  PERFORM t_assert((v_json->>'deleted')::boolean = true, 'D4 deleted ' || v_json::text);
  SELECT count(*) INTO v_n FROM public.users WHERE id = v_user; PERFORM t_assert(v_n = 0, 'D4 users row gone');
  SELECT count(*) INTO v_n FROM public.people WHERE id = v_person; PERFORM t_assert(v_n = 0, 'D4 record gone');
  RAISE NOTICE 'ok D4: every key into users(id) counts; with nothing pointing at them, the row and the record go together';

  -- D5. A person with a login is refused with plain words; so is a second call on a row that is gone.
  PERFORM t_as(v_dev);
  BEGIN
    PERFORM public.delete_fresh_person(v_helper);
    RAISE EXCEPTION 'FAILED: D5 — a login should be refused';
  EXCEPTION WHEN check_violation THEN
    PERFORM t_assert(SQLERRM LIKE 'Noor Haddad has a login%', 'D5 words ' || SQLERRM);
  END;
  BEGIN
    PERFORM public.delete_fresh_person(v_user);
    RAISE EXCEPTION 'FAILED: D5 — a gone row should be refused';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  BEGIN
    PERFORM public.delete_fresh_person(v_dev);
    RAISE EXCEPTION 'FAILED: D5 — your own row should be refused';
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM t_assert(SQLERRM LIKE 'You cannot delete your own row%', 'D5 own words ' || SQLERRM);
  END;
  RAISE NOTICE 'ok D5: a login, a gone row and your own row are each refused with their reason';

  -- D6. A pay-approved master may; a training-mode caller may not.
  PERFORM t_as(v_dev);
  v_json := public.add_worker('Second Mistake', 'helper');
  v_user := (v_json->>'user_id')::uuid;
  PERFORM t_as(NULL);
  INSERT INTO public.users (id, email, name, role, login_attached_at) VALUES ('77777777-7777-4777-8777-777777777777', 'pam@example.test', 'Pam Lead', 'master_technician', now());
  INSERT INTO public.pay_approved_masters (master_id) VALUES ('77777777-7777-4777-8777-777777777777');
  UPDATE public.users SET read_only = true WHERE id = v_assistant;
  PERFORM t_as(v_assistant);
  BEGIN
    PERFORM public.delete_fresh_person(v_user);
    RAISE EXCEPTION 'FAILED: D6 — training mode should be refused';
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM t_assert(SQLERRM LIKE 'Training mode%', 'D6 words ' || SQLERRM);
  END;
  PERFORM t_as('77777777-7777-4777-8777-777777777777');
  v_json := public.delete_fresh_person(v_user);
  PERFORM t_assert((v_json->>'deleted')::boolean = true, 'D6 the master deleted ' || v_json::text);
  RAISE NOTICE 'ok D6: a pay-approved master deletes a fresh row; a caller in training mode is refused';

  -- D7. A hire with a pay row: the row is not a hold, it is named as going with the person, and it goes.
  PERFORM t_as(v_dev);
  v_json := public.add_worker('Typo Hire', 'helper');
  v_user := (v_json->>'user_id')::uuid; v_person := (v_json->>'person_id')::uuid;
  PERFORM t_as(NULL);
  INSERT INTO public.people_pay_config (person_name, person_id, hourly_wage) VALUES ('Typo Hire', v_person, 22);
  PERFORM t_as(v_dev);
  v_json := public.delete_fresh_person(v_user, true);
  PERFORM t_assert(jsonb_array_length(v_json->'holds') = 0, 'D7 no holds ' || (v_json->'holds')::text);
  PERFORM t_assert(v_json->'removed' = '["pay row"]'::jsonb, 'D7 removed ' || (v_json->'removed')::text);
  SELECT count(*) INTO v_n FROM public.people_pay_config WHERE person_id = v_person; PERFORM t_assert(v_n = 1, 'D7 dry run kept the pay row');
  v_json := public.delete_fresh_person(v_user);
  PERFORM t_assert((v_json->>'deleted')::boolean = true, 'D7 deleted ' || v_json::text);
  SELECT count(*) INTO v_n FROM public.people_pay_config WHERE person_name = 'Typo Hire'; PERFORM t_assert(v_n = 0, 'D7 pay row gone');
  SELECT count(*) INTO v_n FROM public.people WHERE id = v_person; PERFORM t_assert(v_n = 0, 'D7 record gone');
  SELECT count(*) INTO v_n FROM public.users WHERE id = v_user; PERFORM t_assert(v_n = 0, 'D7 row gone');
  RAISE NOTICE 'ok D7: the pay row the Hire form wrote goes with the person, named in the answer, never a hold';

  -- D8 (v2.6798). The employment stint the record's dates mirror into is the record, not a hold; it goes with the record.
  PERFORM t_as(v_dev);
  v_json := public.add_worker('Dated Hire', 'helper', NULL, NULL, NULL, '2026-11-09');
  v_user := (v_json->>'user_id')::uuid; v_person := (v_json->>'person_id')::uuid;
  PERFORM t_as(NULL);
  INSERT INTO public.employment_stints (person_id, start_date) VALUES (v_person, '2026-11-09');
  PERFORM t_as(v_dev);
  v_json := public.delete_fresh_person(v_user, true);
  PERFORM t_assert(jsonb_array_length(v_json->'holds') = 0, 'D8 no holds ' || (v_json->'holds')::text);
  PERFORM t_assert(v_json->'removed' = '[]'::jsonb, 'D8 nothing named ' || (v_json->'removed')::text);
  v_json := public.delete_fresh_person(v_user);
  PERFORM t_assert((v_json->>'deleted')::boolean = true, 'D8 deleted ' || v_json::text);
  SELECT count(*) INTO v_n FROM public.employment_stints WHERE person_id = v_person; PERFORM t_assert(v_n = 0, 'D8 stint gone with the record');
  RAISE NOTICE 'ok D8: the record''s own employment stint is not a hold and goes with the record';
END $$;
SELECT '70_delete_fresh_person PASSED' AS result;
