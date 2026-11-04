SET lock_timeout = '3s';

-- Every People record has a users row (punch list #260, v2.6517, PR 3 of 5).
--
-- PR 1 (20261104190000) let a users row stand with no login behind it; PR 2 (20261104200000) made every new
-- person one. This file brings the records already on the roster over: each People record with account_user_id
-- NULL gets a users row — the name, the address where no login holds it, the phone, the role from the kind,
-- archived_at carried, login_attached_at NULL — and is linked to it. From then on every person on the roster can
-- hold a clock session and a Charged as, and the Charges window prices the days of the crew paid outside payroll
-- once a dev imports them through import_clock_sessions (a later step, on the owner's word).
--
--   backfill_users_for_people() → { linked, skipped_name_held, skipped_dev, skipped: [{ person_id, reason }] }
--     * runs as the migration (no caller) and for a dev afterwards (is_dev()); refused otherwise.
--     * a record whose trimmed name another users row already carries (any case) is skipped and named: the pay
--       tables key on the name (people_hours, people_pay_config, …) and resolve_pay_person_id reads
--       users.name → people.account_user_id first, so a second users row on one name would re-point someone's pay.
--       The desk's Link account or Combine folds such a record by hand.
--     * a record of kind dev is skipped: a dev is a login, never a worker with none.
--     * an address another users row holds is left off the new row (NULL), never a clash on users_email_key.
--     * idempotent: a rerun finds no record with account_user_id NULL and links nothing.
--
-- people.account_user_id stays nullable: people_account_user_id_fkey is ON DELETE SET NULL (invite-user's replace of
-- a pending invite deletes its users row) and combinePeople nulls a source's account before moving it, so a NOT NULL
-- would refuse both. roster_people keeps account_kind 'external' as the guard that shows a straggler. No table is
-- created, so no fence calls.

CREATE OR REPLACE FUNCTION public.backfill_users_for_people()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_role public.user_role;
  v_email text;
  v_user uuid;
  v_linked int := 0;
  v_name_held int := 0;
  v_dev int := 0;
  v_skipped jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_dev() THEN
    RAISE EXCEPTION 'backfill_users_for_people: a dev runs the backfill' USING ERRCODE = '42501';
  END IF;

  FOR r IN
    SELECT p.id, p.kind, btrim(p.name) AS name, NULLIF(lower(btrim(COALESCE(p.email, ''))), '') AS email,
           NULLIF(btrim(COALESCE(p.phone, '')), '') AS phone, p.archived_at, p.created_at
      FROM public.people p
     WHERE p.account_user_id IS NULL
     ORDER BY p.created_at, p.id
  LOOP
    IF r.kind = 'dev' THEN
      v_dev := v_dev + 1;
      v_skipped := v_skipped || jsonb_build_object('person_id', r.id, 'reason', 'a dev is a login, never a worker with none');
      CONTINUE;
    END IF;
    IF r.name = '' THEN
      v_skipped := v_skipped || jsonb_build_object('person_id', r.id, 'reason', 'a blank name');
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.users u WHERE lower(btrim(u.name)) = lower(r.name)) THEN
      v_name_held := v_name_held + 1;
      v_skipped := v_skipped || jsonb_build_object('person_id', r.id, 'reason', 'another users row carries this name; link or combine it by hand on the desk');
      CONTINUE;
    END IF;
    v_role := CASE r.kind
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
      v_skipped := v_skipped || jsonb_build_object('person_id', r.id, 'reason', 'kind ' || COALESCE(r.kind, '?') || ' has no login role');
      CONTINUE;
    END IF;
    v_email := r.email;
    IF v_email IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE lower(u.email) = v_email) THEN
      v_email := NULL;  -- another row signs in with it; the People record keeps the address
    END IF;

    v_user := gen_random_uuid();
    INSERT INTO public.users (id, email, name, role, phone, archived_at, created_at, login_attached_at)
    VALUES (v_user, v_email, r.name, v_role, r.phone, r.archived_at, COALESCE(r.created_at, now()), NULL);
    UPDATE public.people SET account_user_id = v_user WHERE id = r.id;
    v_linked := v_linked + 1;
  END LOOP;

  RETURN jsonb_build_object('linked', v_linked, 'skipped_name_held', v_name_held, 'skipped_dev', v_dev, 'skipped', v_skipped);
END;
$$;

COMMENT ON FUNCTION public.backfill_users_for_people() IS
  'Gives every People record with no account a users row with no login (role from the kind, archived_at carried) and links it; skips a record whose name another users row carries (the pay tables key on the name) and a dev. Runs as the migration and for a dev afterwards. Answers { linked, skipped_name_held, skipped_dev, skipped }. Punch list #260, v2.6517.';

REVOKE ALL ON FUNCTION public.backfill_users_for_people() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.backfill_users_for_people() TO authenticated;

-- The roster as it stands, once. The answer is in the push's output.
DO $$
DECLARE v jsonb;
BEGIN
  v := public.backfill_users_for_people();
  RAISE NOTICE 'backfill_users_for_people: %', v::text;
END $$;
