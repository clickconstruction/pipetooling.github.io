-- Remember an address the map cannot place (punch list #408, step 1): who reads and writes a miss, through RLS,
-- inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "address_geocode_misses misses PASSED". See scripts/pgtest-address-geocode-misses.sh. Never against prod.
-- Every person and address is made up.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000408a1', 'sub@miss.test'),
  ('00000000-0000-0000-0000-0000000408a2', 'helper@miss.test'),
  ('00000000-0000-0000-0000-0000000408a3', 'trainee@miss.test'),
  ('00000000-0000-0000-0000-0000000408a4', 'left@miss.test'),
  ('00000000-0000-0000-0000-0000000408a5', 'twin@miss.test'),
  ('00000000-0000-0000-0000-0000000408a6', 'dev@miss.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000000408a1', 'sub@miss.test', 'ZZ Miss Sub', 'subcontractor', false, false, NULL),
  ('00000000-0000-0000-0000-0000000408a2', 'helper@miss.test', 'ZZ Miss Helper', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-0000000408a3', 'trainee@miss.test', 'ZZ Miss Trainee', 'assistant', true, false, NULL),
  ('00000000-0000-0000-0000-0000000408a4', 'left@miss.test', 'ZZ Miss Left', 'assistant', false, false, now()),
  ('00000000-0000-0000-0000-0000000408a5', 'twin@miss.test', 'ZZ Miss Twin', 'estimator', false, true, NULL),
  ('00000000-0000-0000-0000-0000000408a6', 'dev@miss.test', 'ZZ Miss Dev', 'dev', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at;

CREATE SCHEMA bedm;
CREATE FUNCTION bedm.ok(label text, pass boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF pass IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION bedm.as_user(p_id text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', p_id), true);
  PERFORM set_config('request.jwt.claim.sub', p_id, true);
END $$;
-- The rows as the database holds them, past every policy, for the checks after a refused write.
CREATE FUNCTION bedm.misses() RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$ SELECT count(*) FROM public.address_geocode_misses $$;
CREATE FUNCTION bedm.miss_code(p_key text) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$ SELECT error_code FROM public.address_geocode_misses WHERE address_normalized = p_key $$;
GRANT USAGE ON SCHEMA bedm TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bedm TO authenticated, anon;

-- 1 · any signed-in role writes a miss: the subcontractor. The day is the server's, whatever the caller sent.
SELECT bedm.as_user('00000000-0000-0000-0000-0000000408a1');
SET LOCAL ROLE authenticated;
INSERT INTO public.address_geocode_misses (address_normalized, error_code, detail, checked_at)
VALUES ('zz the pasture behind the made up barn', '  not_found  ', 'No match from OpenStreetMap or Google; no match from US Census', '2001-01-01');
SELECT bedm.ok('the subcontractor reads the miss', (SELECT count(*) = 1 FROM public.address_geocode_misses));
SELECT bedm.ok('checked_at is the server''s clock, not the day sent', (SELECT checked_at > now() - interval '1 hour' FROM public.address_geocode_misses));
SELECT bedm.ok('the reason is trimmed', (SELECT error_code = 'not_found' FROM public.address_geocode_misses));
DO $$
BEGIN
  BEGIN
    INSERT INTO public.address_geocode_misses (address_normalized) VALUES ('zz');
    RAISE EXCEPTION 'FAILED: a key under three characters was kept';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: a key under three characters is refused';
  END;
END $$;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.address_geocode_misses (address_normalized, error_code) VALUES ('zz no reason lane', '   ');
    RAISE EXCEPTION 'FAILED: a miss with no reason was kept';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: a miss with no reason is refused';
  END;
END $$;
RESET ROLE;

-- 2 · another role reads it and checks it again: the write is an upsert on the key, and the day is stamped again.
SELECT bedm.as_user('00000000-0000-0000-0000-0000000408a2');
SET LOCAL ROLE authenticated;
SELECT bedm.ok('a helper reads the miss', (SELECT count(*) = 1 FROM public.address_geocode_misses));
INSERT INTO public.address_geocode_misses (address_normalized, error_code, detail, checked_at)
VALUES ('zz the pasture behind the made up barn', 'not_found', 'asked again', '2001-01-01')
ON CONFLICT (address_normalized) DO UPDATE SET error_code = EXCLUDED.error_code, detail = EXCLUDED.detail, checked_at = EXCLUDED.checked_at;
SELECT bedm.ok('the upsert keeps one row', (SELECT count(*) = 1 FROM public.address_geocode_misses));
SELECT bedm.ok('the upsert carries the new words', (SELECT detail = 'asked again' FROM public.address_geocode_misses));
SELECT bedm.ok('an update cannot backdate the day either', (SELECT checked_at > now() - interval '1 hour' FROM public.address_geocode_misses));
-- Nobody deletes a miss by hand: the role holds no DELETE on the table.
DO $$
BEGIN
  BEGIN
    DELETE FROM public.address_geocode_misses;
    RAISE EXCEPTION 'FAILED: a signed-in user deleted a miss by hand';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: a signed-in user cannot delete a miss by hand';
  END;
END $$;
RESET ROLE;

-- 3 · a dev deletes a miss by hand, and only the one named: since 20261126024719 (punch list #443, row 16) the table
--     has a delete policy for a dev alone. A second miss is made for the press, so the steps below keep theirs.
--     20_dev_delete.sql plays the rest of that policy.
INSERT INTO public.address_geocode_misses (address_normalized, error_code, detail) VALUES ('zz row sixteen lane, made up', 'not_found', 'a walk left it');
SELECT bedm.as_user('00000000-0000-0000-0000-0000000408a6');
SET LOCAL ROLE authenticated;
DO $$
DECLARE n integer;
BEGIN
  DELETE FROM public.address_geocode_misses WHERE address_normalized = 'zz row sixteen lane, made up';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAILED: a dev''s delete reached % rows, not one', n; END IF;
  RAISE NOTICE 'ok: a dev deletes a miss by hand, since punch list #443 row 16';
END $$;
RESET ROLE;
SELECT bedm.ok('the first miss still stands', bedm.miss_code('zz the pasture behind the made up barn') IS NOT NULL);

-- 4 · a training account reads a miss and writes none.
SELECT bedm.as_user('00000000-0000-0000-0000-0000000408a3');
SET LOCAL ROLE authenticated;
SELECT bedm.ok('a training account reads the miss', (SELECT count(*) = 1 FROM public.address_geocode_misses));
DO $$
BEGIN
  BEGIN
    INSERT INTO public.address_geocode_misses (address_normalized) VALUES ('zz a trainee typed this');
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN NULL;
  END;
  BEGIN
    UPDATE public.address_geocode_misses SET error_code = 'changed by a trainee';
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN NULL;
  END;
  BEGIN
    INSERT INTO public.address_geocodes (address_normalized, lat, lng) VALUES ('zz the pasture behind the made up barn', 29.5, -98.5);
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN NULL;
  END;
END $$;
SELECT bedm.ok('a training account added no miss', bedm.misses() = 1);
SELECT bedm.ok('a training account changed no miss', bedm.miss_code('zz the pasture behind the made up barn') = 'not_found');
RESET ROLE;

-- 5 · a digital twin writes none.
SELECT bedm.as_user('00000000-0000-0000-0000-0000000408a5');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.address_geocode_misses (address_normalized) VALUES ('zz a twin typed this');
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN NULL;
  END;
  BEGIN
    UPDATE public.address_geocode_misses SET error_code = 'changed by a twin';
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN NULL;
  END;
END $$;
SELECT bedm.ok('a digital twin added no miss', bedm.misses() = 1);
SELECT bedm.ok('a digital twin changed no miss', bedm.miss_code('zz the pasture behind the made up barn') = 'not_found');
RESET ROLE;

-- 6 · an archived account reads none and writes none.
SELECT bedm.as_user('00000000-0000-0000-0000-0000000408a4');
SET LOCAL ROLE authenticated;
SELECT bedm.ok('an archived account reads no miss', (SELECT count(*) = 0 FROM public.address_geocode_misses));
DO $$
BEGIN
  BEGIN
    INSERT INTO public.address_geocode_misses (address_normalized) VALUES ('zz someone who left typed this');
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN NULL;
  END;
END $$;
SELECT bedm.ok('an archived account added no miss', bedm.misses() = 1);
RESET ROLE;

-- 7 · nobody signed out reads or writes one.
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM public.address_geocode_misses;
    RAISE EXCEPTION 'FAILED: anon read the misses';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: anon cannot read the misses';
  END;
  BEGIN
    INSERT INTO public.address_geocode_misses (address_normalized) VALUES ('zz anon typed this');
    RAISE EXCEPTION 'FAILED: anon wrote a miss';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: anon cannot write a miss';
  END;
END $$;
RESET ROLE;

-- 8 · a saved point takes its miss away, and only its own: the subcontractor's own write to address_geocodes.
SELECT bedm.as_user('00000000-0000-0000-0000-0000000408a1');
SET LOCAL ROLE authenticated;
INSERT INTO public.address_geocode_misses (address_normalized) VALUES ('zz the other made up corner');
INSERT INTO public.address_geocodes (address_normalized, lat, lng) VALUES ('zz the pasture behind the made up barn', 29.5, -98.5);
SELECT bedm.ok('the placed address has no miss', (SELECT count(*) = 0 FROM public.address_geocode_misses WHERE address_normalized = 'zz the pasture behind the made up barn'));
SELECT bedm.ok('another address keeps its miss', (SELECT count(*) = 1 FROM public.address_geocode_misses WHERE address_normalized = 'zz the other made up corner'));
-- A miss written beside a saved point goes again when the point is saved again (an upsert that updates).
INSERT INTO public.address_geocode_misses (address_normalized) VALUES ('zz the pasture behind the made up barn');
UPDATE public.address_geocodes SET lat = 29.6 WHERE address_normalized = 'zz the pasture behind the made up barn';
SELECT bedm.ok('an update of the point takes the miss away too', (SELECT count(*) = 0 FROM public.address_geocode_misses WHERE address_normalized = 'zz the pasture behind the made up barn'));
RESET ROLE;

SELECT 'address_geocode_misses misses PASSED';
ROLLBACK;
