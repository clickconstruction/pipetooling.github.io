-- Presses nothing takes back (punch list #443, row 16, migration *_geocode_miss_delete_dev): a developer deletes a
-- kept miss by hand, through RLS, and nobody else does. Inside one transaction that rolls back. Raises on the first
-- failed assertion; ends with "address_geocode_misses delete PASSED". See scripts/pgtest-address-geocode-misses.sh.
-- Never against prod. Every person and address is made up.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000443a1', 'office@missdel.test'),
  ('00000000-0000-0000-0000-0000000443a3', 'trainee@missdel.test'),
  ('00000000-0000-0000-0000-0000000443a6', 'dev@missdel.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000000443a1', 'office@missdel.test', 'ZZ Missdel Office', 'assistant', false, false, NULL),
  ('00000000-0000-0000-0000-0000000443a3', 'trainee@missdel.test', 'ZZ Missdel Trainee', 'dev', true, false, NULL),
  ('00000000-0000-0000-0000-0000000443a6', 'dev@missdel.test', 'ZZ Missdel Dev', 'dev', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at;

CREATE SCHEMA bedd;
CREATE FUNCTION bedd.ok(label text, pass boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF pass IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION bedd.as_user(p_id text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', p_id), true);
  PERFORM set_config('request.jwt.claim.sub', p_id, true);
END $$;
-- The misses as the database holds them, past every policy.
CREATE FUNCTION bedd.misses() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$ SELECT string_agg(address_normalized, ' · ' ORDER BY address_normalized) FROM public.address_geocode_misses WHERE address_normalized LIKE '% missdel %' $$;
-- A delete tried as the signed-in person: how many rows it reached, or the refusal's words.
CREATE FUNCTION bedd.try_delete(p_key text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.address_geocode_misses WHERE address_normalized = p_key;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n::text || ' row';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
GRANT USAGE ON SCHEMA bedd TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bedd TO authenticated, anon;

-- Three misses, made as postgres: two a walk left, one a real screen kept.
INSERT INTO public.address_geocode_misses (address_normalized, error_code, detail) VALUES
  ('1 missdel way, austin, tx', 'not_found', 'made up by a walk'),
  ('2 missdel way, austin, tx', 'not_found', 'made up by a walk'),
  ('9 missdel bend, alder, tx', 'not_found', 'a real screen kept it');
SELECT bedd.ok('three misses stand', bedd.misses() = '1 missdel way, austin, tx · 2 missdel way, austin, tx · 9 missdel bend, alder, tx');

-- 1 · the office cannot delete a miss: the policy is a dev's. The row stands.
SELECT bedd.as_user('00000000-0000-0000-0000-0000000443a1');
SET LOCAL ROLE authenticated;
SELECT bedd.ok('an assistant''s delete reaches no row', bedd.try_delete('1 missdel way, austin, tx') = '0 row');
SELECT bedd.ok('the row stands', bedd.misses() LIKE '1 missdel way%');
RESET ROLE;

-- 2 · a dev in training mode is held by the read-only fence.
SELECT bedd.as_user('00000000-0000-0000-0000-0000000443a3');
SET LOCAL ROLE authenticated;
SELECT bedd.ok('a read-only dev is held', bedd.try_delete('1 missdel way, austin, tx') <> '1 row');
SELECT bedd.ok('the row still stands', bedd.misses() LIKE '1 missdel way%');
RESET ROLE;

-- 3 · the dev deletes one miss by its key, and only that one.
SELECT bedd.as_user('00000000-0000-0000-0000-0000000443a6');
SET LOCAL ROLE authenticated;
SELECT bedd.ok('the dev deletes the one miss', bedd.try_delete('1 missdel way, austin, tx') = '1 row');
SELECT bedd.ok('the other two stand', bedd.misses() = '2 missdel way, austin, tx · 9 missdel bend, alder, tx');
SELECT bedd.ok('a second delete of the same key reaches no row', bedd.try_delete('1 missdel way, austin, tx') = '0 row');
RESET ROLE;

-- 4 · signed out, nothing.
SELECT set_config('request.jwt.claims', '', true);
SET LOCAL ROLE anon;
SELECT bedd.ok('anon is refused', bedd.try_delete('2 missdel way, austin, tx') LIKE '%permission denied%');
RESET ROLE;
SELECT bedd.ok('the two stand after anon', bedd.misses() = '2 missdel way, austin, tx · 9 missdel bend, alder, tx');

SELECT 'address_geocode_misses delete PASSED';
ROLLBACK;
