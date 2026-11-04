\set ON_ERROR_STOP on
\set QUIET on
-- After 20261104200000_add_worker.sql (PR 2). Made-up people: the dev (Dana Okafor), an assistant (Lee Park), a helper login
-- (Noor Haddad); the workers added: Tomas Reyes (a sub, no address), Ana Lind (a helper with an address).
DO $$
DECLARE
  v_dev uuid := '11111111-1111-4111-8111-111111111111';
  v_assistant uuid := '55555555-5555-4555-8555-555555555555';
  v_helper uuid := '66666666-6666-4666-8666-666666666666';
  v_json jsonb; v_user uuid; v_person uuid; v_n int; v_state text;
BEGIN
  PERFORM auth.t_gotrue_admin_create(v_assistant, 'lee@example.test', 'pw-lee-1', '{"name":"Lee Park","invited_role":"assistant"}');
  PERFORM auth.t_gotrue_admin_create(v_helper, 'noor@example.test', 'pw-noor-1', '{"name":"Noor Haddad","invited_role":"helpers"}');

  -- W1. Nobody signed in, and a helper, are refused.
  PERFORM t_as(NULL);
  BEGIN
    PERFORM public.add_worker('Tomas Reyes', 'sub');
    RAISE EXCEPTION 'FAILED: W1 — no caller should be refused';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM t_as(v_helper);
  BEGIN
    PERFORM public.add_worker('Tomas Reyes', 'sub');
    RAISE EXCEPTION 'FAILED: W1 — a helper should be refused';
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM t_assert(SQLERRM LIKE 'A dev, a master, an assistant%', 'W1 words ' || SQLERRM);
  END;
  RAISE NOTICE 'ok W1: add_worker refuses nobody and a helper with 42501 and plain words';

  -- W2. An assistant adds a sub with no address: a users row with no login, role subcontractor, and the People record linked.
  PERFORM t_as(v_assistant);
  v_json := public.add_worker('Tomas Reyes', 'sub', '', '555-0100', 'from the sub-sheet form', '2026-11-01');
  v_user := (v_json->>'user_id')::uuid; v_person := (v_json->>'person_id')::uuid;
  SELECT role::text INTO v_state FROM public.users WHERE id = v_user; PERFORM t_assert(v_state = 'subcontractor', 'W2 role ' || v_state);
  SELECT count(*) INTO v_n FROM public.users WHERE id = v_user AND email IS NULL AND login_attached_at IS NULL AND NOT is_sample AND needs_supervision AND phone = '555-0100'; PERFORM t_assert(v_n = 1, 'W2 users row');
  SELECT count(*) INTO v_n FROM public.people WHERE id = v_person AND account_user_id = v_user AND kind = 'sub' AND master_user_id = v_assistant AND start_date = '2026-11-01' AND notes = 'from the sub-sheet form'; PERFORM t_assert(v_n = 1, 'W2 people row');
  SELECT count(*) INTO v_n FROM public.roster_people WHERE user_id = v_user AND person_id = v_person AND has_login = false AND account_kind = 'person' AND is_active_roster; PERFORM t_assert(v_n = 1, 'W2 roster row');
  RAISE NOTICE 'ok W2: an assistant adds a sub with no address — one users row (subcontractor, no login, phone kept) and one People record linked to it; the roster reads one person with has_login false';

  -- W3. A helper with an address; the address is lower-cased; a second person on the same address is refused by name.
  PERFORM t_as(v_dev);
  v_json := public.add_worker('Ana Lind', 'helper', ' Ana.Lind@Example.test ', NULL, NULL, NULL);
  v_user := (v_json->>'user_id')::uuid;
  SELECT email INTO v_state FROM public.users WHERE id = v_user;
  PERFORM t_assert(v_state = 'ana.lind@example.test', 'W3 email ' || v_state);
  BEGIN
    PERFORM public.add_worker('Another Ana', 'helper', 'ANA.LIND@example.test');
    RAISE EXCEPTION 'FAILED: W3 — a held address should be refused';
  EXCEPTION WHEN unique_violation THEN
    PERFORM t_assert(SQLERRM LIKE 'Ana Lind already has that address%', 'W3 words ' || SQLERRM);
  END;
  RAISE NOTICE 'ok W3: the address is lower-cased and kept; a second person on it is refused naming who holds it';

  -- W4. A blank name and a kind that is not a roster kind are refused; dev is not a roster kind.
  BEGIN
    PERFORM public.add_worker('   ', 'sub');
    RAISE EXCEPTION 'FAILED: W4 — a blank name should be refused';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.add_worker('Some Dev', 'dev');
    RAISE EXCEPTION 'FAILED: W4 — dev should be refused';
  EXCEPTION WHEN invalid_parameter_value THEN
    PERFORM t_assert(SQLERRM LIKE 'Pick what they are%', 'W4 words ' || SQLERRM);
  END;
  RAISE NOTICE 'ok W4: a blank name and a kind outside the roster kinds (dev included) are refused with 22023';

  -- W5. The worker's days and a later attach work as in 20_scenarios: the same id throughout.
  SELECT (public.add_worker('Day Laborer', 'helper')->>'user_id')::uuid INTO v_user;
  v_json := public.import_clock_sessions(jsonb_build_array(jsonb_build_object('user_id', v_user, 'job_ledger_id', '44444444-4444-4444-8444-444444444444', 'work_date', '2026-10-08', 'clocked_in_at', '2026-10-08 13:00Z', 'clocked_out_at', '2026-10-08 21:00Z', 'notes', 'made-up day')));
  PERFORM t_assert((v_json->>'inserted')::int = 1, 'W5 import');
  PERFORM t_as(NULL);
  PERFORM auth.t_gotrue_admin_create(v_user, 'day.laborer@example.test', 'pw-day-1', '{}');
  SELECT count(*) INTO v_n FROM public.users WHERE id = v_user AND login_attached_at IS NOT NULL AND email = 'day.laborer@example.test' AND role = 'helpers'; PERFORM t_assert(v_n = 1, 'W5 attached');
  SELECT count(*) INTO v_n FROM public.clock_sessions WHERE user_id = v_user; PERFORM t_assert(v_n = 1, 'W5 day kept');
  SELECT count(*) INTO v_n FROM public.people WHERE account_user_id = v_user; PERFORM t_assert(v_n = 1, 'W5 link kept');
  RAISE NOTICE 'ok W5: a worker add_worker made holds an imported day and takes a login on the same id later';
END $$;
\echo users_without_login add_worker PASSED
