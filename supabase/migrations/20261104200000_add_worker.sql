SET lock_timeout = '3s';

-- Adding a person makes a users row (punch list #260, v2.6514, PR 2 of 5).
--
-- Since 20261104190000 a users row need not have a login behind it. Until now every "add a person" in the app —
-- People → Users → Add to roster, Hire with no email, the Hiring board's Add to roster, the workflow step form, the
-- sub-sheet form, the work-order assembler, Banking's attribute-to-a-new-person — inserted a People record alone,
-- with account_user_id NULL: a person who could hold no clock session and no Charged as. From this PR each of them
-- calls add_worker, which makes the users row (role from the kind, login_attached_at NULL) and the People record
-- linked to it in one transaction, so every person is a user from the day they are added and a login attaches to
-- the same id later (PR 4).
--
--   add_worker(p_name, p_kind, p_email, p_phone, p_notes, p_start_date) → { user_id, person_id }
--     * gate: the roles the People insert policy admits — is_office_staff() (dev, master, assistant, controller);
--       refused with 42501 and plain words outside it. A signed-in caller only.
--     * p_kind: a roster kind other than dev (assistant, master_technician, sub, helper, estimator, primary,
--       superintendent, controller); the users row's role is the kind's login role (sub → subcontractor,
--       helper → helpers, the rest their own name).
--     * p_email, lower-cased: refused with 23505's words when another users row signs in with it or holds it;
--       NULL when blank — a worker with no login needs no address.
--     * the People record: master_user_id = the caller (as the forms wrote it), kind, name, email, phone, notes,
--       start_date, account_user_id = the new users row. The phone-from-account trigger (20261015030000) runs as
--       for any linked record.
--     * the users row: id gen_random_uuid(), name, email, phone, role, login_attached_at NULL; every flag its
--       default (is_sample false, is_digital_twin false, is_walk_tester false, read_only false, needs_supervision
--       true — a helper or sub who cannot yet be left to run a job, as the Hire flow leaves it).
--
-- SECURITY DEFINER, search_path pinned: the users insert policy admits a dev alone, and the point is that a master
-- or an assistant adding a sub from a job form makes the whole person. No table is created, so no fence calls.
-- A caller in training mode (users.read_only) is stopped by the statement trigger on the two inserts as today.

CREATE OR REPLACE FUNCTION public.add_worker(
  p_name text,
  p_kind text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_start_date date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_name text := btrim(COALESCE(p_name, ''));
  v_email text := NULLIF(lower(btrim(COALESCE(p_email, ''))), '');
  v_phone text := NULLIF(btrim(COALESCE(p_phone, '')), '');
  v_notes text := NULLIF(btrim(COALESCE(p_notes, '')), '');
  v_role public.user_role;
  v_holder text;
  v_user_id uuid;
  v_person_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'A dev, a master, an assistant or the controller adds a person.' USING ERRCODE = '42501';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'A name is required.' USING ERRCODE = '22023';
  END IF;
  v_role := CASE p_kind
    WHEN 'sub' THEN 'subcontractor'::public.user_role
    WHEN 'helper' THEN 'helpers'::public.user_role
    WHEN 'assistant' THEN 'assistant'::public.user_role
    WHEN 'master_technician' THEN 'master_technician'::public.user_role
    WHEN 'estimator' THEN 'estimator'::public.user_role
    WHEN 'primary' THEN 'primary'::public.user_role
    WHEN 'superintendent' THEN 'superintendent'::public.user_role
    WHEN 'controller' THEN 'controller'::public.user_role
    ELSE NULL
  END;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Pick what they are: a sub, a helper, an assistant, a master, an estimator, a primary, a superintendent or the controller.' USING ERRCODE = '22023';
  END IF;
  IF v_email IS NOT NULL THEN
    SELECT u.name INTO v_holder FROM public.users u WHERE lower(u.email) = v_email LIMIT 1;
    IF v_holder IS NOT NULL THEN
      RAISE EXCEPTION '% already has that address. Open their desk instead.', v_holder USING ERRCODE = '23505';
    END IF;
  END IF;

  v_user_id := gen_random_uuid();
  INSERT INTO public.users (id, email, name, role, phone, login_attached_at)
  VALUES (v_user_id, v_email, v_name, v_role, v_phone, NULL);

  INSERT INTO public.people (master_user_id, kind, name, email, phone, notes, account_user_id, start_date)
  VALUES (v_caller, p_kind, v_name, v_email, v_phone, v_notes, v_user_id, p_start_date)
  RETURNING id INTO v_person_id;

  RETURN jsonb_build_object('user_id', v_user_id, 'person_id', v_person_id);
END;
$$;

COMMENT ON FUNCTION public.add_worker(text, text, text, text, text, date) IS
  'Adds a person as a users row with no login (login_attached_at NULL, role from the kind) and the People record linked to it, in one transaction, for the office roles (is_office_staff). Answers { user_id, person_id }. Refuses a blank name, a kind that is not a roster kind, and an address another users row holds. Punch list #260, v2.6514.';

REVOKE ALL ON FUNCTION public.add_worker(text, text, text, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_worker(text, text, text, text, text, date) TO authenticated;
