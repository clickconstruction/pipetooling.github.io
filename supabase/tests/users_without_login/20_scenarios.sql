\set ON_ERROR_STOP on
\set QUIET on
-- After 20261104190000_users_login_attached_at.sql. Made-up people: the dev (Dana Okafor, from 10_before), a worker
-- with no login (Rio Vance), a second no-login worker.
DO $$
DECLARE
  v_dev uuid := '11111111-1111-4111-8111-111111111111';
  v_worker uuid := '22222222-2222-4222-8222-222222222222';
  v_job uuid := '44444444-4444-4444-8444-444444444444';
  v_n int; v_state text; v_id uuid; v_json jsonb; v_t timestamptz; v_bool boolean;
BEGIN
  -- B. The migration landed: every existing login is backfilled; the key is gone; the address may be NULL.
  SELECT count(*) INTO v_n FROM public.users WHERE login_attached_at IS NULL; PERFORM t_assert(v_n = 0, 'B backfill');
  SELECT count(*) INTO v_n FROM pg_constraint WHERE conname = 'users_id_fkey'; PERFORM t_assert(v_n = 0, 'B key dropped');
  SELECT count(*) INTO v_n FROM pg_constraint WHERE conname = 'users_login_has_email' AND convalidated; PERFORM t_assert(v_n = 1, 'B check validated');
  RAISE NOTICE 'ok B: users_id_fkey dropped, login_attached_at backfilled for every login, users_login_has_email validated';

  -- B2. A worker with no login is an ordinary users row; two NULL addresses sit under users_email_key.
  INSERT INTO public.users (id, email, name, role, charge_standing) VALUES (v_worker, NULL, 'Rio Vance', 'helpers', 'helper');
  INSERT INTO public.users (id, email, name, role) VALUES (gen_random_uuid(), NULL, 'Second No-Login', 'helpers');
  INSERT INTO public.people (master_user_id, kind, name, account_user_id) VALUES (v_dev, 'helper', 'Rio Vance', v_worker);
  SELECT count(*) INTO v_n FROM public.users WHERE login_attached_at IS NULL; PERFORM t_assert(v_n = 2, 'B2 two no-login users');
  BEGIN
    UPDATE public.users SET login_attached_at = now() WHERE id = v_worker;  -- no login, so the CHECK wants an address
    RAISE EXCEPTION 'FAILED: B2 — a login with no address should be refused';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'ok B2: a no-login worker is a users row (email NULL, charge_standing set), its People record linked at birth; a login with no address is refused';

  -- B3. The roster view: has_login reads the column.
  PERFORM t_as(v_dev);
  SELECT has_login, account_kind INTO v_bool, v_state FROM public.roster_people WHERE user_id = v_worker;
  PERFORM t_assert(v_bool = false AND v_state = 'person', 'B3 roster ' || v_state);
  SELECT has_login INTO v_bool FROM public.roster_people WHERE user_id = v_dev; PERFORM t_assert(v_bool = true, 'B3 dev has_login');
  SELECT is_active_roster INTO v_bool FROM public.roster_people WHERE user_id = v_worker; PERFORM t_assert(v_bool = true, 'B3 on the active roster');
  PERFORM t_as(NULL);
  RAISE NOTICE 'ok B3: roster_people reads the worker as a person with has_login false, on the active roster';

  -- B4. Their days are ordinary clock sessions through the shipped import door, as the dev.
  PERFORM t_as(v_dev);
  v_json := public.import_clock_sessions(jsonb_build_array(
    jsonb_build_object('user_id', v_worker, 'job_ledger_id', v_job, 'work_date', '2026-10-06', 'clocked_in_at', '2026-10-06 13:00Z', 'clocked_out_at', '2026-10-06 21:00Z', 'notes', 'made-up bank row of 2026-10-10'),
    jsonb_build_object('user_id', v_worker, 'job_ledger_id', v_job, 'work_date', '2026-10-07', 'clocked_in_at', '2026-10-07 13:00Z', 'clocked_out_at', '2026-10-07 21:00Z', 'notes', 'made-up bank row of 2026-10-10')));
  PERFORM t_assert((v_json->>'inserted')::int = 2 AND jsonb_array_length(v_json->'refused') = 0, 'B4 import ' || v_json::text);
  RAISE NOTICE 'ok B4: import_clock_sessions (v2.6425, unchanged) takes the no-login worker''s days: %', v_json::text;

  -- B5. RLS: the dev reads the worker's days; the worker is never auth.uid(), so an own-rows policy never matches.
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM public.clock_sessions WHERE user_id = v_worker; PERFORM t_assert(v_n = 2, 'B5 dev reads the days');
  RESET ROLE;
  PERFORM t_as(NULL);
  RAISE NOTICE 'ok B5: the dev''s policy reads the worker''s 2 days; auth.uid() checks compare the caller to a row and the worker is only ever the row';

  -- B6. The guard: a signed-in dev cannot set login_attached_at from the client; the service role (no JWT) can.
  PERFORM t_as(v_dev);
  BEGIN
    UPDATE public.users SET login_attached_at = now(), email = 'rio@example.test' WHERE id = v_worker;
    RAISE EXCEPTION 'FAILED: B6 — the guard should refuse a client write to login_attached_at';
  EXCEPTION WHEN raise_exception THEN
    PERFORM t_assert(SQLERRM LIKE 'A login is attached%', 'B6 reason ' || SQLERRM);
  END;
  PERFORM t_as(NULL);
  RAISE NOTICE 'ok B6: users_guard_privileged_columns refuses a signed-in write to login_attached_at';

  -- F. The one FK to auth.users that named a receiver (notification_history.recipient_user_id) refused a no-login worker
  -- with 23503 until PR 5 (20261104220000) pointed it at public.users; the runner applies that file too, so the notice lands.
  INSERT INTO public.notification_history (recipient_user_id, body) VALUES (v_worker, 'your hours were approved');
  SELECT count(*) INTO v_n FROM public.notification_history WHERE recipient_user_id = v_worker; PERFORM t_assert(v_n = 1, 'F landed');
  DELETE FROM public.notification_history WHERE recipient_user_id = v_worker;
  RAISE NOTICE 'ok F: notification_history.recipient_user_id points at public.users, so a notice to the no-login worker lands (it was refused with 23503 before PR 5)';

  -- C. Attach a login: the auth row created on the worker's id (POST /admin/users with id, GoTrue ≥ v2.155.0).
  v_id := auth.t_gotrue_admin_create(v_worker, 'rio@example.test', 'pw-rio-1', '{"name":"Rio Vance","invited_role":"helpers"}');
  PERFORM t_assert(v_id = v_worker, 'C same id');
  SELECT count(*) INTO v_n FROM public.users WHERE id = v_worker; PERFORM t_assert(v_n = 1, 'C one users row');
  SELECT login_attached_at INTO v_t FROM public.users WHERE id = v_worker; PERFORM t_assert(v_t IS NOT NULL, 'C attached');
  SELECT email INTO v_state FROM public.users WHERE id = v_worker; PERFORM t_assert(v_state = 'rio@example.test', 'C email filled');
  SELECT name INTO v_state FROM public.users WHERE id = v_worker; PERFORM t_assert(v_state = 'Rio Vance', 'C name kept');
  SELECT charge_standing INTO v_state FROM public.users WHERE id = v_worker; PERFORM t_assert(v_state = 'helper', 'C standing kept');
  SELECT role::text INTO v_state FROM public.users WHERE id = v_worker; PERFORM t_assert(v_state = 'helpers', 'C role kept');
  SELECT count(*) INTO v_n FROM public.clock_sessions WHERE user_id = v_worker; PERFORM t_assert(v_n = 2, 'C days kept');
  SELECT count(*) INTO v_n FROM public.people WHERE account_user_id = v_worker; PERFORM t_assert(v_n = 1, 'C people link kept');
  PERFORM t_as(v_dev);
  SELECT has_login INTO v_bool FROM public.roster_people WHERE user_id = v_worker; PERFORM t_assert(v_bool = true, 'C roster has_login');
  PERFORM t_as(NULL);
  RAISE NOTICE 'ok C: the auth row lands on the worker''s id; handle_new_user attaches the existing row (login_attached_at set, address taken, name, role and standing kept); 2 days and the People link unchanged';

  -- C2. A fresh id still inserts a new users row as before.
  v_id := auth.t_gotrue_admin_create(NULL, 'new.hire@example.test', 'pw-new-1', '{"name":"New Hire","invited_role":"controller"}');
  SELECT role::text, login_attached_at INTO v_state, v_t FROM public.users WHERE id = v_id;
  PERFORM t_assert(v_state = 'controller' AND v_t IS NOT NULL, 'C2 fresh insert');
  RAISE NOTICE 'ok C2: a fresh auth id still inserts a users row with its invited role and login_attached_at set';

  -- D. Signing in syncs last_sign_in_at through the existing trigger.
  UPDATE auth.users SET last_sign_in_at = now() WHERE id = v_worker;
  SELECT last_sign_in_at INTO v_t FROM public.users WHERE id = v_worker; PERFORM t_assert(v_t IS NOT NULL, 'D synced');
  RAISE NOTICE 'ok D: on_auth_user_signed_in syncs last_sign_in_at onto the attached row';

  -- E. Taking the login away detaches; the worker and the days stay (10_before's A2 shows what happened before).
  DELETE FROM auth.users WHERE id = v_worker;
  SELECT count(*) INTO v_n FROM public.users WHERE id = v_worker; PERFORM t_assert(v_n = 1, 'E users row stays');
  SELECT login_attached_at INTO v_t FROM public.users WHERE id = v_worker; PERFORM t_assert(v_t IS NULL, 'E detached');
  SELECT count(*) INTO v_n FROM public.clock_sessions WHERE user_id = v_worker; PERFORM t_assert(v_n = 2, 'E days stay');
  RAISE NOTICE 'ok E: deleting the auth account detaches (login_attached_at NULL); the worker and both days stay';

  -- E2. A second attach with a new address lands on the same id and takes the new address.
  PERFORM auth.t_gotrue_admin_create(v_worker, 'rio.vance@example.test', 'pw-rio-2', '{}');
  SELECT count(*) INTO v_n FROM public.users WHERE id = v_worker; PERFORM t_assert(v_n = 1, 'E2 one row');
  SELECT email INTO v_state FROM public.users WHERE id = v_worker; PERFORM t_assert(v_state = 'rio.vance@example.test', 'E2 new address');
  RAISE NOTICE 'ok E2: re-attach lands on the same id and the login''s new address wins';

  -- G. The migration applied a second time changes nothing (the runner applies it twice).
END $$;
\echo users_without_login PASSED
