SET lock_timeout = '3s';

-- Delete a person made by mistake: the start date is the record, not history (v2.6798, the fix found on the first prod
-- walk of v2.6789's Delete press).
--
-- people_stints_follow_dates (20261103203000) writes an employment_stints row from the People record's own start and
-- end dates, so every hire with a start date has one from the moment it is made, and delete_fresh_person named it as a
-- hold ("a row in employment stints") on a row made a minute earlier. The stint is the record's own mirror — the key
-- is ON DELETE CASCADE and nothing else writes the table — so the scan now passes over employment_stints.person_id as
-- it passes over the record's own people.account_user_id. Every other key into users(id) or people(id) is counted
-- as before. The function is replaced in place; same signature, same grants, same answer shape.

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
    RETURN jsonb_build_object('deleted', false, 'dry_run', p_dry_run, 'name', v_name, 'user_id', p_user_id, 'person_id', v_person_id, 'holds', v_holds, 'removed', v_removed);
  END IF;

  -- The setup rows found above (the pay row's key is RESTRICT, so it goes first), then the record, then the row.
  FOR r IN SELECT unnest(v_setup_deletes) AS stmt LOOP
    EXECUTE r.stmt;
  END LOOP;
  IF v_person_id IS NOT NULL THEN
    DELETE FROM public.people WHERE id = v_person_id;
  END IF;
  DELETE FROM public.users WHERE id = p_user_id;

  RETURN jsonb_build_object('deleted', true, 'dry_run', false, 'name', v_name, 'user_id', p_user_id, 'person_id', v_person_id, 'holds', v_holds, 'removed', v_removed);
END $$;

COMMENT ON FUNCTION public.delete_fresh_person(uuid, boolean) IS
  'Deletes a person made by mistake — the users row with no login and its People record, with the pay row and workday template the Hire form wrote — in one transaction, for a dev, the controller or a pay-approved master. Every foreign key into users(id) or people(id) is counted first; a row that points at the person is a hold, answered instead of deleting; the record''s own employment stint is not one (v2.6798). p_dry_run answers the holds alone. v2.6789.';

REVOKE ALL ON FUNCTION public.delete_fresh_person(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_fresh_person(uuid, boolean) TO authenticated;
