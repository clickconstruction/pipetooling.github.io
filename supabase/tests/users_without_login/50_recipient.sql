\set ON_ERROR_STOP on
\set QUIET on
-- After 20261104220000_notification_recipient_is_a_user.sql (PR 5): a notice to a person with no login lands.
DO $$
DECLARE
  v_dev uuid := '11111111-1111-4111-8111-111111111111';
  v_user uuid; v_n int;
BEGIN
  PERFORM t_as(v_dev);
  SELECT (public.add_worker('Notice Taker', 'helper')->>'user_id')::uuid INTO v_user;
  PERFORM t_as(NULL);
  -- R1. The key points at public.users: the worker with no login takes a notice; a stranger does not.
  INSERT INTO public.notification_history (recipient_user_id, body) VALUES (v_user, 'your hours were approved');
  SELECT count(*) INTO v_n FROM public.notification_history WHERE recipient_user_id = v_user; PERFORM t_assert(v_n = 1, 'R1 landed');
  BEGIN
    INSERT INTO public.notification_history (recipient_user_id, body) VALUES (gen_random_uuid(), 'to nobody');
    RAISE EXCEPTION 'FAILED: R1 — a stranger should be refused';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  -- R2. The cascade stands: deleting the row takes its notices.
  DELETE FROM public.people WHERE account_user_id = v_user;
  DELETE FROM public.users WHERE id = v_user;
  SELECT count(*) INTO v_n FROM public.notification_history WHERE recipient_user_id = v_user; PERFORM t_assert(v_n = 0, 'R2 cascade');
  RAISE NOTICE 'ok R1–R2: notification_history.recipient_user_id points at public.users — a person with no login takes a notice, a stranger is refused, the cascade stands';
END $$;
\echo users_without_login recipient PASSED
