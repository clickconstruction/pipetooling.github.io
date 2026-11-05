\set ON_ERROR_STOP on
\set QUIET on
-- After 20261104230000_people_have_a_users_row.sql (punch list #265, PR 2). The dev from 10_before; the straggler from 40_backfill (X5).
DO $$
DECLARE
  v_dev uuid := '11111111-1111-4111-8111-111111111111';
  v_user uuid; v_person uuid; v_n int;
BEGIN
  -- S1. A signed-in write may not make a record with no users row; add_worker's record goes in; a bed's fixture (no caller) may.
  PERFORM t_as(v_dev);
  BEGIN
    INSERT INTO public.people (master_user_id, kind, name) VALUES (v_dev, 'sub', 'No Row Sub');
    RAISE EXCEPTION 'FAILED: S1 — a signed-in insert with no users row should be refused';
  EXCEPTION WHEN not_null_violation THEN
    PERFORM t_assert(SQLERRM LIKE 'A person is a users row%', 'S1 words ' || SQLERRM);
  END;
  SELECT (public.add_worker('Row Sub', 'sub')->>'person_id')::uuid INTO v_person;
  SELECT account_user_id INTO v_user FROM public.people WHERE id = v_person; PERFORM t_assert(v_user IS NOT NULL, 'S1 linked');
  BEGIN
    UPDATE public.people SET account_user_id = NULL WHERE id = v_person;
    RAISE EXCEPTION 'FAILED: S1 — a signed-in unlink should be refused';
  EXCEPTION WHEN not_null_violation THEN NULL;
  END;
  PERFORM t_as(NULL);
  INSERT INTO public.people (master_user_id, kind, name) VALUES (v_dev, 'sub', 'Fixture Sub');
  RAISE NOTICE 'ok S1: a signed-in insert or unlink with no users row is refused with add_worker''s words; add_worker''s record goes in linked; a fixture with no caller still may';

  -- S2. The straggler the backfill skipped stands.
  SELECT count(*) INTO v_n FROM public.people WHERE account_user_id IS NULL; PERFORM t_assert(v_n >= 1, 'S2 a straggler stands');
  RAISE NOTICE 'ok S2: the record the backfill skipped stands until the desk links it';

  -- S3. A users row with a People record cannot be deleted (RESTRICT); archiving is the way.
  BEGIN
    DELETE FROM public.users WHERE id = v_user;
    RAISE EXCEPTION 'FAILED: S3 — the delete should be refused';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  DELETE FROM public.people WHERE id = v_person;
  DELETE FROM public.users WHERE id = v_user;
  RAISE NOTICE 'ok S3: deleting a users row with a People record is refused (ON DELETE RESTRICT); a pending invite is re-invited on its own id instead';
END $$;
\echo users_without_login people_have_a_users_row PASSED
