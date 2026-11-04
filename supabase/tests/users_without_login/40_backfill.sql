\set ON_ERROR_STOP on
\set QUIET on
-- After 20261104210000_people_without_users_backfill.sql (PR 3). Made-up records with no account: a sub with an address
-- (Jo Barros), a helper with none (Kit Moreno), an archived sub (Old Crew LLC), a sub whose name a login carries
-- (Noor Haddad, the helper login from 30_add_worker), a sub whose address a login holds (Sam Lee at noor's address).
DO $$
DECLARE
  v_dev uuid := '11111111-1111-4111-8111-111111111111';
  v_helper uuid := '66666666-6666-4666-8666-666666666666';
  v_jo uuid; v_kit uuid; v_old uuid; v_clash uuid; v_addr uuid;
  v_json jsonb; v_n int; v_user uuid; v_state text;
BEGIN
  -- The migration ran once on an empty bed (the runner's first apply) and linked nothing.
  INSERT INTO public.people (master_user_id, kind, name, email, phone) VALUES (v_dev, 'sub', 'Jo Barros', 'Jo.Barros@Example.test', '555-0200') RETURNING id INTO v_jo;
  INSERT INTO public.people (master_user_id, kind, name) VALUES (v_dev, 'helper', 'Kit Moreno') RETURNING id INTO v_kit;
  INSERT INTO public.people (master_user_id, kind, name, archived_at) VALUES (v_dev, 'sub', 'Old Crew LLC', '2026-06-01 12:00Z') RETURNING id INTO v_old;
  INSERT INTO public.people (master_user_id, kind, name) VALUES (v_dev, 'sub', ' noor haddad ') RETURNING id INTO v_clash;
  INSERT INTO public.people (master_user_id, kind, name, email) VALUES (v_dev, 'sub', 'Sam Lee', 'noor@example.test') RETURNING id INTO v_addr;

  -- X1. A helper cannot run it; a dev can.
  PERFORM t_as(v_helper);
  BEGIN
    PERFORM public.backfill_users_for_people();
    RAISE EXCEPTION 'FAILED: X1 — a helper should be refused';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM t_as(v_dev);
  v_json := public.backfill_users_for_people();
  PERFORM t_as(NULL);
  PERFORM t_assert((v_json->>'linked')::int = 4, 'X1 linked ' || v_json::text);
  PERFORM t_assert((v_json->>'skipped_name_held')::int = 1, 'X1 name held ' || v_json::text);
  RAISE NOTICE 'ok X1: a helper is refused; the dev''s run answers %', v_json::text;

  -- X2. Jo: a users row, subcontractor, the address lower-cased, the phone, no login, linked.
  SELECT account_user_id INTO v_user FROM public.people WHERE id = v_jo; PERFORM t_assert(v_user IS NOT NULL, 'X2 linked');
  SELECT count(*) INTO v_n FROM public.users WHERE id = v_user AND role = 'subcontractor' AND email = 'jo.barros@example.test' AND phone = '555-0200' AND login_attached_at IS NULL AND archived_at IS NULL; PERFORM t_assert(v_n = 1, 'X2 users row');
  RAISE NOTICE 'ok X2: the sub with an address gets a subcontractor row with the address and phone, no login';

  -- X3. Kit: a helper with no address.
  SELECT account_user_id INTO v_user FROM public.people WHERE id = v_kit;
  SELECT count(*) INTO v_n FROM public.users WHERE id = v_user AND role = 'helpers' AND email IS NULL AND login_attached_at IS NULL; PERFORM t_assert(v_n = 1, 'X3 helper row');
  RAISE NOTICE 'ok X3: the helper with no address gets a helpers row with email NULL';

  -- X4. Old Crew: archived_at carried, so the roster reads it as gone.
  SELECT account_user_id INTO v_user FROM public.people WHERE id = v_old;
  SELECT count(*) INTO v_n FROM public.users WHERE id = v_user AND archived_at = '2026-06-01 12:00Z'; PERFORM t_assert(v_n = 1, 'X4 archived carried');
  PERFORM t_as(v_dev);
  SELECT count(*) INTO v_n FROM public.roster_people WHERE person_id = v_old AND is_archived AND NOT is_active_roster; PERFORM t_assert(v_n = 1, 'X4 roster archived');
  PERFORM t_as(NULL);
  RAISE NOTICE 'ok X4: the archived record''s users row carries archived_at; the roster reads it as gone';

  -- X5. The name clash is skipped and named; the record stays unlinked for the desk.
  SELECT account_user_id INTO v_user FROM public.people WHERE id = v_clash; PERFORM t_assert(v_user IS NULL, 'X5 still unlinked');
  PERFORM t_assert(v_json->'skipped' @> jsonb_build_array(jsonb_build_object('person_id', v_clash)), 'X5 named ' || v_json::text);
  PERFORM t_as(v_dev);
  SELECT account_kind INTO v_state FROM public.roster_people WHERE person_id = v_clash; PERFORM t_assert(v_state = 'external', 'X5 roster external');
  PERFORM t_as(NULL);
  RAISE NOTICE 'ok X5: a record whose name a login carries is skipped and named; roster_people still shows it as external';

  -- X6. The held address is left off the new row; the People record keeps it.
  SELECT account_user_id INTO v_user FROM public.people WHERE id = v_addr;
  SELECT count(*) INTO v_n FROM public.users WHERE id = v_user AND email IS NULL AND role = 'subcontractor'; PERFORM t_assert(v_n = 1, 'X6 address left off');
  SELECT count(*) INTO v_n FROM public.people WHERE id = v_addr AND email = 'noor@example.test'; PERFORM t_assert(v_n = 1, 'X6 record keeps it');
  RAISE NOTICE 'ok X6: an address another login holds is left off the users row; the People record keeps it';

  -- X7. A rerun links nothing more.
  PERFORM t_as(v_dev);
  v_json := public.backfill_users_for_people();
  PERFORM t_as(NULL);
  PERFORM t_assert((v_json->>'linked')::int = 0 AND (v_json->>'skipped_name_held')::int = 1, 'X7 rerun ' || v_json::text);
  RAISE NOTICE 'ok X7: a rerun links nothing and names the same clash';

  -- X8. A backfilled worker holds an imported day and takes a login on the same id later, as any user.
  SELECT account_user_id INTO v_user FROM public.people WHERE id = v_kit;
  PERFORM t_as(v_dev);
  v_json := public.import_clock_sessions(jsonb_build_array(jsonb_build_object('user_id', v_user, 'job_ledger_id', '44444444-4444-4444-8444-444444444444', 'work_date', '2026-10-09', 'clocked_in_at', '2026-10-09 13:00Z', 'clocked_out_at', '2026-10-09 21:00Z', 'notes', 'made-up day')));
  PERFORM t_as(NULL);
  PERFORM t_assert((v_json->>'inserted')::int = 1, 'X8 import');
  PERFORM auth.t_gotrue_admin_create(v_user, 'kit.moreno@example.test', 'pw-kit-1', '{}');
  SELECT count(*) INTO v_n FROM public.users WHERE id = v_user AND login_attached_at IS NOT NULL AND role = 'helpers'; PERFORM t_assert(v_n = 1, 'X8 attached');
  SELECT count(*) INTO v_n FROM public.clock_sessions WHERE user_id = v_user; PERFORM t_assert(v_n = 1, 'X8 day kept');
  RAISE NOTICE 'ok X8: a backfilled worker holds an imported day and takes a login on the same id';
END $$;
\echo users_without_login backfill PASSED
