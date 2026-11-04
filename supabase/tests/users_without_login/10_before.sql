\set ON_ERROR_STOP on
\set QUIET on
-- Before the migration: what the baseline schema does. Made-up people: a dev (Dana Okafor) and a login (Sam Field).
DO $$
DECLARE
  v_dev uuid := '11111111-1111-4111-8111-111111111111';
  v_worker uuid := '22222222-2222-4222-8222-222222222222';
  v_second uuid := '33333333-3333-4333-8333-333333333333';
  v_job uuid := '44444444-4444-4444-8444-444444444444';
  v_n int;
BEGIN
  PERFORM auth.t_gotrue_admin_create(v_dev, 'dana@example.test', 'pw-dana-1', '{"name":"Dana Okafor","invited_role":"dev"}');
  INSERT INTO public.jobs_ledger (id) VALUES (v_job);

  -- A. A users row with no auth row behind it is refused.
  BEGIN
    INSERT INTO public.users (id, email, name, role) VALUES (v_worker, 'rio@example.test', 'Rio Vance', 'helpers');
    RAISE EXCEPTION 'FAILED: A — the insert should have hit users_id_fkey';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'ok A: before — a users row with no auth row is refused by users_id_fkey (%)', SQLSTATE;
  END;

  -- A2. Deleting the auth account deletes the users row and every clock session under it.
  PERFORM auth.t_gotrue_admin_create(v_second, 'sam@example.test', 'pw-sam-1', '{"name":"Sam Field","invited_role":"helpers"}');
  INSERT INTO public.clock_sessions (user_id, job_ledger_id, clocked_in_at, clocked_out_at, work_date) VALUES (v_second, v_job, '2026-10-01 13:00Z', '2026-10-01 21:00Z', '2026-10-01');
  DELETE FROM auth.users WHERE id = v_second;
  SELECT count(*) INTO v_n FROM public.users WHERE id = v_second; PERFORM t_assert(v_n = 0, 'A2 users row gone');
  SELECT count(*) INTO v_n FROM public.clock_sessions WHERE user_id = v_second; PERFORM t_assert(v_n = 0, 'A2 clock sessions gone');
  RAISE NOTICE 'ok A2: before — deleting the auth account cascades through users into clock_sessions';
END $$;
\echo users_without_login before PASSED
