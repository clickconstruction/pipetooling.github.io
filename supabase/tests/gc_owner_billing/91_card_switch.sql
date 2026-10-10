-- Pay by card's switch (GC mode, Owner Billing's O8c): one app_settings row, `gc_card_bill_on_v1`, inserted 'false'.
-- The owner (master_technician) and dev flip it; nobody else does, the owner touches no other key with it, and no one
-- inserts or deletes it through it. Everyone signed in reads it; no one signed out does. Run through RLS as the owner,
-- a dev, the controller, an estimator and an owner in training mode; the fixture is made as postgres; everything runs
-- inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "gc_owner_billing_card_switch PASSED". See scripts/pgtest-gc-owner-billing.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000ce1', 'owner@switch.test'),
  ('00000000-0000-0000-0000-000000000ce2', 'dev@switch.test'),
  ('00000000-0000-0000-0000-000000000ce3', 'controller@switch.test'),
  ('00000000-0000-0000-0000-000000000ce4', 'estimator@switch.test'),
  ('00000000-0000-0000-0000-000000000ce5', 'trainee@switch.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-000000000ce1', 'owner@switch.test', 'Switch Owner', 'master_technician'),
  ('00000000-0000-0000-0000-000000000ce2', 'dev@switch.test', 'Switch Dev', 'dev'),
  ('00000000-0000-0000-0000-000000000ce3', 'controller@switch.test', 'Switch Controller', 'controller'),
  ('00000000-0000-0000-0000-000000000ce4', 'estimator@switch.test', 'Switch Estimator', 'estimator'),
  ('00000000-0000-0000-0000-000000000ce5', 'trainee@switch.test', 'Switch Trainee', 'master_technician')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-000000000ce5';
-- Another key, for the owner's reach: no policy of its own lets the owner write it.
INSERT INTO public.app_settings (key, value_text) VALUES ('gc_switch_bed_other_v1', 'kept') ON CONFLICT (key) DO UPDATE SET value_text = 'kept';

CREATE SCHEMA gsw;
CREATE FUNCTION gsw.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- app_settings' read policy asks auth.role(), which reads the role claim on its own (PostgREST sets both).
CREATE FUNCTION gsw.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What the row holds, whoever is asking. VOLATILE, so it reads a flip made earlier in the same statement.
CREATE FUNCTION gsw.value(p_key text) RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT value_text FROM public.app_settings WHERE key = p_key), 'no row') $$;
-- An update as the caller, and how many rows it reached (0: refused by RLS, quietly).
CREATE FUNCTION gsw.flip(p_key text, p_value text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  BEGIN
    UPDATE public.app_settings SET value_text = p_value WHERE key = p_key;
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'refused';
  END;
END $$;
CREATE FUNCTION gsw.gone(p_key text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  BEGIN
    DELETE FROM public.app_settings WHERE key = p_key;
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'refused';
  END;
END $$;
CREATE FUNCTION gsw.anon_reads() RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  BEGIN
    SELECT count(*) INTO n FROM public.app_settings WHERE key = 'gc_card_bill_on_v1';
    RETURN CASE WHEN n = 0 THEN 'nothing' ELSE 'read it' END;
  EXCEPTION WHEN insufficient_privilege THEN
    RETURN 'nothing';
  END;
END $$;
GRANT USAGE ON SCHEMA gsw TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gsw TO authenticated, anon;

-- 0 · The migration: the row is there, off, with its one key-scoped UPDATE policy.
SELECT gsw.same('the switch starts off', gsw.value('gc_card_bill_on_v1'), 'false');
SELECT gsw.same('its policy: UPDATE only, for the signed in, on its own key',
  (SELECT string_agg(concat_ws(' ', cmd, array_to_string(roles, ','), (qual LIKE '%gc_card_bill_on_v1%')::text, (with_check LIKE '%gc_card_bill_on_v1%')::text), '; ')
   FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_settings' AND policyname = 'master_or_dev_update_gc_card_bill_on'),
  'UPDATE authenticated true true');

-- 1 · The owner turns it on, then off again.
SELECT gsw.as_user('00000000-0000-0000-0000-000000000ce1');
SET LOCAL ROLE authenticated;
SELECT gsw.same('the owner turns it on', gsw.flip('gc_card_bill_on_v1', 'true') || ' ' || gsw.value('gc_card_bill_on_v1'), '1 true');
SELECT gsw.same('and off', gsw.flip('gc_card_bill_on_v1', 'false') || ' ' || gsw.value('gc_card_bill_on_v1'), '1 false');
-- 2 · Its reach: no other key, and no delete.
SELECT gsw.same('the owner writes no other key with it', gsw.flip('gc_switch_bed_other_v1', 'changed') || ' ' || gsw.value('gc_switch_bed_other_v1'), '0 kept');
SELECT gsw.same('nor deletes the switch', gsw.gone('gc_card_bill_on_v1') || ' ' || gsw.value('gc_card_bill_on_v1'), '0 false');
RESET ROLE;

-- 3 · A dev manages every row, this one too.
SELECT gsw.as_user('00000000-0000-0000-0000-000000000ce2');
SET LOCAL ROLE authenticated;
SELECT gsw.same('a dev turns it on and off', gsw.flip('gc_card_bill_on_v1', 'true') || ' ' || gsw.flip('gc_card_bill_on_v1', 'false') || ' ' || gsw.value('gc_card_bill_on_v1'), '1 1 false');
RESET ROLE;

-- 4 · Nobody else flips it: the controller, an estimator, the owner in training mode.
SELECT gsw.as_user('00000000-0000-0000-0000-000000000ce3');
SET LOCAL ROLE authenticated;
SELECT gsw.same('the controller does not', gsw.flip('gc_card_bill_on_v1', 'true') || ' ' || gsw.value('gc_card_bill_on_v1'), '0 false');
RESET ROLE;
SELECT gsw.as_user('00000000-0000-0000-0000-000000000ce4');
SET LOCAL ROLE authenticated;
SELECT gsw.same('an estimator does not, but reads it', gsw.flip('gc_card_bill_on_v1', 'true') || ' ' || (SELECT value_text FROM public.app_settings WHERE key = 'gc_card_bill_on_v1'), '0 false');
RESET ROLE;
SELECT gsw.as_user('00000000-0000-0000-0000-000000000ce5');
SET LOCAL ROLE authenticated;
SELECT gsw.same('the owner in training mode does not', CASE WHEN gsw.flip('gc_card_bill_on_v1', 'true') IN ('0', 'refused') THEN 'stopped' ELSE 'flipped' END || ' ' || gsw.value('gc_card_bill_on_v1'), 'stopped false');
RESET ROLE;

-- 5 · No one signed out reads it.
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', 'anon', true);
SET LOCAL ROLE anon;
-- Since 20261010027000 anon runs no helper, so the read is refused outright rather than empty: nothing either way.
SELECT gsw.same('signed out reads nothing', gsw.anon_reads(), 'nothing');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'gc_owner_billing_card_switch PASSED'; END $$;
ROLLBACK;
