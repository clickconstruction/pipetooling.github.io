SET lock_timeout = '3s';

-- Presses nothing takes back (punch list #443, row 12): a deleted test person can be put back.
--
-- delete_fresh_person (20261109110000, replaced by 20261109140000) deletes a person made by mistake: the pay row and
-- the workday template the Hire form wrote, the People record, and the users row. Deleted records keeps a copy of
-- the People record (people, 20260717210000) and of the pay row (people_pay_config, 20260716230000). It keeps none
-- of the users row and none of the template, because neither table carries the archive trigger. A People record
-- cannot go back without its users row (people_needs_users_row, 20261104230000), so the copy that was kept could
-- never be restored: Recently deleted answered with the trigger's own refusal. The owner's answer of 2026-11-25:
-- build the take-backs that need a migration, each on its own yes.
--
-- Two functions, and no table, column, policy, grant or trigger. No table is locked.
--
--   delete_fresh_person(p_user_id, p_dry_run)        the same function, the same gates, the same scan. One thing is
--                                                     new: when the person is a test person by the ZZ convention
--                                                     (the name on the account, or the name set for the card,
--                                                     starts with ZZ: isZzTestPerson, src/lib/brandKit/team.ts), it
--                                                     writes a copy of the users row and of the workday template
--                                                     into deleted_records_archive before it deletes, under the
--                                                     People record's id, so the person's bundle holds them. The
--                                                     answer gains one key, copy_kept, on a dry run too. A person
--                                                     whose name does not start with ZZ is deleted exactly as
--                                                     before, with no copy of the users row anywhere.
--   restore_deleted_test_person(p_group_key, p_dry_run)   a developer alone, a test person alone. It reads the
--                                                     bundle's copy of the users row, and with it the copies of the
--                                                     People record, the pay row and the workday template, and
--                                                     puts the four back in one transaction, the users row first.
--                                                     It answers in the shape restore_deleted_records answers
--                                                     ({ ok, code, error, dry_run, group_key, inserted, total,
--                                                     warnings, blockers }), so Recently deleted draws it as it
--                                                     draws every other restore. p_dry_run does the whole thing and
--                                                     rolls it back.
--
-- Why the copy is written by the function and not by a trigger on users: a trigger would copy every users row any
-- path deletes, would take a lock on the table every signed-in read touches, and could not put the copy under the
-- People record's id, which is the handle Recently deleted lists a person by.
--
-- What the put-back does not restore: the person's employment stint is not copied, and it does not need to be. The
-- trigger people_stints_follow_dates (20261103203000) writes it again from the record's own dates on the insert.
--
-- Every statement is safe to run twice.

CREATE OR REPLACE FUNCTION public.delete_fresh_person(p_user_id uuid, p_dry_run boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_caller_read_only boolean;
  v_allowed boolean := false;
  v_user public.users%ROWTYPE;
  v_person_id uuid;
  v_name text;
  v_holds jsonb := '[]'::jsonb;
  v_removed jsonb := '[]'::jsonb;
  v_setup_deletes text[] := '{}';
  v_n bigint;
  v_target uuid;
  v_is_test boolean := false;
  v_group text;
  r record;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT u.role::text, u.read_only INTO v_caller_role, v_caller_read_only FROM public.users u WHERE u.id = v_caller;
  IF v_caller_read_only THEN
    RAISE EXCEPTION 'Training mode: you can look, but nothing you do is saved.' USING ERRCODE = '42501';
  END IF;
  v_allowed := v_caller_role = 'dev'
    OR v_caller_role = 'controller'
    OR (v_caller_role = 'master_technician' AND EXISTS (SELECT 1 FROM public.pay_approved_masters pam WHERE pam.master_id = v_caller));
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'A dev, the controller or a pay-approved leader deletes a person made by mistake.' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Say which person.' USING ERRCODE = '22023';
  END IF;
  IF p_user_id = v_caller THEN
    RAISE EXCEPTION 'You cannot delete your own row.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_user FROM public.users u WHERE u.id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No person with that id.' USING ERRCODE = 'P0002';
  END IF;
  v_name := COALESCE(NULLIF(btrim(v_user.name), ''), 'This person');
  IF v_user.is_sample OR v_user.is_digital_twin THEN
    RAISE EXCEPTION '% is a sample account, not a mistake. Archive it instead.', v_name USING ERRCODE = '23514';
  END IF;
  IF v_user.login_attached_at IS NOT NULL OR EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p_user_id) THEN
    RAISE EXCEPTION '% has a login. Remove the login first from their desk, or archive them.', v_name USING ERRCODE = '23514';
  END IF;

  -- The ZZ convention, as isZzTestPerson says it: the account's name or the card's name starts with ZZ, in any case
  -- and after trimming (punch list #443, row 12).
  v_is_test := btrim(coalesce(v_user.name, ''), E' \t\n\r') ~* '^zz' OR btrim(coalesce(v_user.card_name, ''), E' \t\n\r') ~* '^zz';

  SELECT p.id INTO v_person_id FROM public.people p WHERE p.account_user_id = p_user_id ORDER BY p.created_at LIMIT 1;

  -- Every key into users(id) or people(id), counted against the person's ids.
  FOR r IN
    SELECT c.conrelid, c.conrelid::regclass::text AS rel, c.confrelid, a.attname::text AS col,
           n.nspname AS schema_name, cl.relname AS table_name
    FROM pg_constraint c
    JOIN LATERAL unnest(c.conkey, c.confkey) WITH ORDINALITY AS k(attnum, refattnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = k.refattnum
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE c.contype = 'f'
      AND c.confrelid IN ('public.users'::regclass, 'public.people'::regclass)
      AND ra.attname = 'id'
    ORDER BY cl.relname, a.attname
  LOOP
    IF r.confrelid = 'public.users'::regclass THEN
      v_target := p_user_id;
    ELSE
      v_target := v_person_id;
    END IF;
    IF v_target IS NULL THEN
      CONTINUE;
    END IF;

    IF r.schema_name = 'public' AND r.table_name = 'employment_stints' AND r.col = 'person_id' THEN
      -- The record's own mirror (v2.6798): people_stints_follow_dates writes a stint from the record's own dates, so a
      -- hire with a start date always has one. It is the record, not history, and the key cascades with the record.
      CONTINUE;
    ELSIF r.schema_name = 'public' AND r.table_name = 'people' AND r.col = 'account_user_id' THEN
      -- The person's own record is theirs; another record on the same users row is a hold.
      SELECT count(*) INTO v_n FROM public.people p WHERE p.account_user_id = p_user_id AND p.id IS DISTINCT FROM v_person_id;
    ELSIF r.schema_name = 'public' AND ((r.table_name = 'people_pay_config' AND r.col = 'person_id') OR (r.table_name = 'salary_work_schedule_templates' AND r.col = 'user_id')) THEN
      -- Setup rows the Hire form writes in the same run: they go with the person.
      EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', r.rel, r.col) INTO v_n USING v_target;
      IF v_n > 0 THEN
        v_removed := v_removed || to_jsonb(CASE WHEN r.table_name = 'people_pay_config' THEN 'pay row' ELSE 'workday template' END);
        v_setup_deletes := v_setup_deletes || format('DELETE FROM %s WHERE %I = %L', r.rel, r.col, v_target);
      END IF;
      CONTINUE;
    ELSIF r.schema_name = 'public' AND r.table_name = 'users' THEN
      EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1 AND id IS DISTINCT FROM $2', r.rel, r.col) INTO v_n USING v_target, p_user_id;
    ELSIF r.schema_name = 'public' AND r.table_name = 'people' THEN
      EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1 AND id IS DISTINCT FROM $2', r.rel, r.col) INTO v_n USING v_target, v_person_id;
    ELSE
      EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', r.rel, r.col) INTO v_n USING v_target;
    END IF;

    IF v_n > 0 THEN
      v_holds := v_holds || jsonb_build_object('table', r.table_name, 'column', r.col, 'count', v_n);
    END IF;
  END LOOP;

  IF p_dry_run OR jsonb_array_length(v_holds) > 0 THEN
    RETURN jsonb_build_object('deleted', false, 'dry_run', p_dry_run, 'name', v_name, 'user_id', p_user_id, 'person_id', v_person_id, 'holds', v_holds, 'removed', v_removed, 'copy_kept', v_is_test);
  END IF;

  -- A test person's users row and workday template are copied first, under the People record's id, so the bundle
  -- Recently deleted lists the person by holds everything a put-back needs (punch list #443, row 12). The triggers on
  -- people and people_pay_config copy those two rows as they always have. Not guarded: for a test person the copy is
  -- the point, so a copy that cannot be written stops the delete and says why.
  IF v_is_test THEN
    v_group := COALESCE(v_person_id, p_user_id)::text;
    INSERT INTO public.deleted_records_archive (table_name, record_id, group_key, row_data, deleted_by)
    VALUES ('users', p_user_id::text, v_group, to_jsonb(v_user), v_caller);
    INSERT INTO public.deleted_records_archive (table_name, record_id, group_key, row_data, deleted_by)
    SELECT 'salary_work_schedule_templates', NULL, v_group, to_jsonb(t), v_caller
    FROM public.salary_work_schedule_templates t
    WHERE t.user_id = p_user_id;
  END IF;

  -- The setup rows found above (the pay row's key is RESTRICT, so it goes first), then the record, then the row.
  FOR r IN SELECT unnest(v_setup_deletes) AS stmt LOOP
    EXECUTE r.stmt;
  END LOOP;
  IF v_person_id IS NOT NULL THEN
    DELETE FROM public.people WHERE id = v_person_id;
  END IF;
  DELETE FROM public.users WHERE id = p_user_id;

  RETURN jsonb_build_object('deleted', true, 'dry_run', false, 'name', v_name, 'user_id', p_user_id, 'person_id', v_person_id, 'holds', v_holds, 'removed', v_removed, 'copy_kept', v_is_test);
END $$;

COMMENT ON FUNCTION public.delete_fresh_person(uuid, boolean) IS
  'Deletes a person made by mistake — the users row with no login and its People record, with the pay row and workday template the Hire form wrote — in one transaction, for a dev, the controller or a pay-approved master. Every foreign key into users(id) or people(id) is counted first; a row that points at the person is a hold, answered instead of deleting; the record''s own employment stint is not one (v2.6798). p_dry_run answers the holds alone. v2.6789. For a test person (the name or the card''s name starts with ZZ) it first copies the users row and the workday template into deleted_records_archive under the People record''s id, and answers copy_kept (punch list #443, row 12).';

REVOKE ALL ON FUNCTION public.delete_fresh_person(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_fresh_person(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_deleted_test_person(p_group_key text, p_dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $fn$
DECLARE
  v_caller uuid := auth.uid();
  v_users public.deleted_records_archive%ROWTYPE;
  v_person public.deleted_records_archive%ROWTYPE;
  v_pay public.deleted_records_archive%ROWTYPE;
  v_template public.deleted_records_archive%ROWTYPE;
  v_has_person boolean := false;
  v_has_pay boolean := false;
  v_has_template boolean := false;
  v_user_id uuid;
  v_person_id uuid;
  v_name text;
  v_email text;
  v_pay_name text;
  v_template_row jsonb;
  v_warnings text[] := ARRAY[]::text[];
  v_inserted jsonb := '{}'::jsonb;
  v_total bigint := 0;
  v_cols text;
  v_rc int;
  v_ptr record;
  v_exists boolean;
  t record;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated', 'error', 'Not authenticated.');
  END IF;
  IF NOT public.is_dev() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden', 'error', 'Only devs can restore deleted records.');
  END IF;
  IF NULLIF(btrim(coalesce(p_group_key, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'Say which person.');
  END IF;

  -- The copy of the users row: the newest one this bundle holds that has not gone back. It is held until this
  -- transaction ends, so a second press at the same moment waits and then finds it restored.
  SELECT * INTO v_users
  FROM public.deleted_records_archive a
  WHERE a.group_key = p_group_key AND a.table_name = 'users' AND a.restored_at IS NULL
  ORDER BY a.deleted_at DESC, a.id
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found',
      'error', 'No copy of this person’s account row was kept, so the person cannot be put back.');
  END IF;

  v_name := COALESCE(NULLIF(btrim(v_users.row_data ->> 'name'), ''), 'This person');
  IF NOT (btrim(coalesce(v_users.row_data ->> 'name', ''), E' \t\n\r') ~* '^zz'
          OR btrim(coalesce(v_users.row_data ->> 'card_name', ''), E' \t\n\r') ~* '^zz') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_test',
      'error', 'Only a test person can be put back. This person’s name does not start with ZZ.');
  END IF;

  v_user_id := NULLIF(v_users.row_data ->> 'id', '')::uuid;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'blocked', 'error', 'The copy of the account row has no id. Nothing was put back.',
      'blockers', jsonb_build_array('The copy of the account row has no id.'), 'warnings', '[]'::jsonb);
  END IF;
  IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'blocked', 'error', format('%s is on the roster already. Nothing was put back.', v_name),
      'blockers', jsonb_build_array(format('%s is on the roster already.', v_name)), 'warnings', '[]'::jsonb);
  END IF;
  v_email := NULLIF(v_users.row_data ->> 'email', '');
  IF v_email IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE u.email = v_email) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'blocked', 'error', 'Another person has this person’s email now. Change that email first.',
      'blockers', jsonb_build_array('Another person has this person’s email now.'), 'warnings', '[]'::jsonb);
  END IF;

  -- The People record that named this users row, under the same handle.
  SELECT * INTO v_person
  FROM public.deleted_records_archive a
  WHERE a.group_key = p_group_key AND a.table_name = 'people' AND a.restored_at IS NULL
    AND a.row_data ->> 'account_user_id' = v_user_id::text
  ORDER BY a.deleted_at DESC, a.id
  LIMIT 1
  FOR UPDATE;
  v_has_person := FOUND;
  IF v_has_person THEN
    v_person_id := NULLIF(v_person.row_data ->> 'id', '')::uuid;
    IF v_person_id IS NULL OR EXISTS (SELECT 1 FROM public.people p WHERE p.id = v_person_id) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'blocked', 'error', format('%s has a People record already. Nothing was put back.', v_name),
        'blockers', jsonb_build_array(format('%s has a People record already.', v_name)), 'warnings', '[]'::jsonb);
    END IF;

    -- The pay row is kept under the person's name (its archive trigger groups by person_name), so it is found by the
    -- People record's id inside the copy.
    SELECT * INTO v_pay
    FROM public.deleted_records_archive a
    WHERE a.table_name = 'people_pay_config' AND a.restored_at IS NULL
      AND a.row_data ->> 'person_id' = v_person_id::text
    ORDER BY a.deleted_at DESC, a.id
    LIMIT 1
    FOR UPDATE;
    v_has_pay := FOUND;
    IF v_has_pay THEN
      v_pay_name := v_pay.row_data ->> 'person_name';
      IF EXISTS (SELECT 1 FROM public.people_pay_config c WHERE c.person_name = v_pay_name) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'blocked', 'error', 'A pay row stands under this person’s name now. Rename or delete that person first.',
          'blockers', jsonb_build_array('A pay row stands under this person’s name now.'), 'warnings', '[]'::jsonb);
      END IF;
    END IF;
  END IF;

  SELECT * INTO v_template
  FROM public.deleted_records_archive a
  WHERE a.group_key = p_group_key AND a.table_name = 'salary_work_schedule_templates' AND a.restored_at IS NULL
    AND a.row_data ->> 'user_id' = v_user_id::text
  ORDER BY a.deleted_at DESC, a.id
  LIMIT 1
  FOR UPDATE;
  v_has_template := FOUND;
  IF v_has_template THEN
    -- A workday that named a job or a bid which is gone since keeps its hours and loses that name.
    v_template_row := v_template.row_data;
    FOR v_ptr IN
      SELECT * FROM (VALUES
        ('job_ledger_id', 'jobs_ledger'), ('segment_b_job_ledger_id', 'jobs_ledger'),
        ('bid_id', 'bids'), ('segment_b_bid_id', 'bids')
      ) AS x(col, ref_tbl)
    LOOP
      CONTINUE WHEN NULLIF(v_template_row ->> v_ptr.col, '') IS NULL;
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id::text = $1)', v_ptr.ref_tbl)
        INTO v_exists USING v_template_row ->> v_ptr.col;
      IF NOT v_exists THEN
        v_template_row := jsonb_set(v_template_row, ARRAY[v_ptr.col], 'null'::jsonb, true);
        v_warnings := v_warnings || format('workday template: %s cleared, because that %s is gone', v_ptr.col,
          CASE WHEN v_ptr.ref_tbl = 'bids' THEN 'bid' ELSE 'job' END)::text;
      END IF;
    END LOOP;
  END IF;

  BEGIN
    -- The users row first: the People record may not stand without it. Each insert names the table's own columns
    -- that are not generated and that the copy holds. So a generated column added later cannot refuse the row, and a
    -- column added after the delete takes its default, where a NULL would break a NOT NULL added with one.
    FOR t IN
      SELECT * FROM (VALUES
        (1, 'users', v_users.row_data, true),
        (2, 'people', v_person.row_data, v_has_person),
        (3, 'people_pay_config', v_pay.row_data, v_has_pay),
        (4, 'salary_work_schedule_templates', v_template_row, v_has_template)
      ) AS x(ord, tbl, row_data, present)
      WHERE x.present
      ORDER BY x.ord
    LOOP
      SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum) INTO v_cols
      FROM pg_attribute a
      WHERE a.attrelid = format('public.%I', t.tbl)::regclass AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
        AND t.row_data ? a.attname::text;
      EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I, $1)', t.tbl, v_cols, v_cols, t.tbl)
        USING t.row_data;
      GET DIAGNOSTICS v_rc = ROW_COUNT;
      v_total := v_total + v_rc;
      v_inserted := v_inserted || jsonb_build_object(t.tbl, v_rc);
    END LOOP;

    UPDATE public.deleted_records_archive a
       SET restored_at = now(), restored_by = v_caller
     WHERE a.id = v_users.id
        OR (v_has_person AND a.id = v_person.id)
        OR (v_has_pay AND a.id = v_pay.id)
        OR (v_has_template AND a.id = v_template.id);

    IF p_dry_run THEN
      RAISE EXCEPTION USING errcode = 'P0R01', message = 'dry run rollback';
    END IF;
  EXCEPTION
    WHEN sqlstate 'P0R01' THEN
      RETURN jsonb_build_object('ok', true, 'dry_run', true, 'group_key', p_group_key, 'name', v_name,
                                'inserted', v_inserted, 'total', v_total,
                                'warnings', to_jsonb(v_warnings), 'blockers', '[]'::jsonb);
  END;

  RETURN jsonb_build_object('ok', true, 'dry_run', false, 'group_key', p_group_key, 'name', v_name,
                            'inserted', v_inserted, 'total', v_total,
                            'warnings', to_jsonb(v_warnings), 'blockers', '[]'::jsonb);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'code', SQLSTATE, 'error', SQLERRM);
END $fn$;

REVOKE ALL ON FUNCTION public.restore_deleted_test_person(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_deleted_test_person(text, boolean) TO authenticated;

COMMENT ON FUNCTION public.restore_deleted_test_person(text, boolean) IS
  'Punch list #443, row 12: a developer puts a deleted test person back from the bundle Recently deleted lists them by. Reads the copy of the users row delete_fresh_person kept (a person whose name or card name starts with ZZ alone), and the copies of the People record, the pay row and the workday template, and inserts the four in one transaction, the users row first. Refuses in words when no copy of the users row was kept, when the name does not start with ZZ, when the person, their email or their pay row''s name stands again. Answers in restore_deleted_records'' shape; p_dry_run does it all and rolls it back.';
