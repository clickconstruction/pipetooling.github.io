-- House numbers and price sheets (punch list #308) through RLS, inside one transaction that rolls back. Raises on the
-- first failed assertion; ends with "price_sheets PASSED". See scripts/pgtest-price-sheets.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'estimator@bed.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'helper@bed.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'trainee@bed.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'estimator@bed.test', 'Bed Estimator', 'estimator'),
  ('00000000-0000-0000-0000-0000000000a2', 'helper@bed.test', 'Bed Helper', 'helpers'),
  ('00000000-0000-0000-0000-0000000000a3', 'trainee@bed.test', 'Bed Trainee', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000000a3';
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-00000000a001', 'Bed Plumbing');
INSERT INTO public.supply_houses (id, name) VALUES
  ('00000000-0000-0000-0000-00000000d001', 'Bed Hillcrest'),
  ('00000000-0000-0000-0000-00000000d002', 'Bed Borden');
INSERT INTO public.material_parts (id, name, service_type_id) VALUES
  ('00000000-0000-0000-0000-00000000e001', 'AX8802XL-LR-PC ARLO SUPPLY KIT', '00000000-0000-0000-0000-00000000a001'),
  ('00000000-0000-0000-0000-00000000e002', 'AX87029-BPC ARLO P-TRAP', '00000000-0000-0000-0000-00000000a001');

CREATE SCHEMA bedt;
CREATE FUNCTION bedt.ok(label text, pass boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF pass IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION bedt.as_user(p_id text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', p_id), true);
  PERFORM set_config('request.jwt.claim.sub', p_id, true);
END $$;
GRANT USAGE ON SCHEMA bedt TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bedt TO authenticated, anon;

-- 0 · the table carries the fences every new table closes with.
SELECT bedt.ok('the table has row level security', (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.supply_part_codes'::regclass));
SELECT bedt.ok('the table carries a restrictive policy for read-only, twin and archived callers',
  (SELECT count(*) >= 3 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'supply_part_codes' AND permissive = 'RESTRICTIVE'));
SELECT bedt.ok('anon cannot call may_edit_parts_book', NOT has_function_privilege('anon', 'public.may_edit_parts_book()', 'EXECUTE'));
SELECT bedt.ok('anon has nothing on the table', NOT has_table_privilege('anon', 'public.supply_part_codes', 'SELECT'));

-- 1 · an estimator keeps a number on a part and reads it; who taught it is the caller.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a1');
SET LOCAL ROLE authenticated;
INSERT INTO public.supply_part_codes (supply_house_id, code, part_id)
VALUES ('00000000-0000-0000-0000-00000000d001', '512-207', '00000000-0000-0000-0000-00000000e001');
SELECT bedt.ok('the estimator reads the number', (SELECT count(*) = 1 FROM public.supply_part_codes));
SELECT bedt.ok('the key is the number folded', (SELECT code_key = '512207' FROM public.supply_part_codes));
SELECT bedt.ok('taught by the caller, one book unit a price', (SELECT taught_by = '00000000-0000-0000-0000-0000000000a1' AND unit_factor = 1 AND taught_from = 'typed' FROM public.supply_part_codes));

-- 2 · one number means one thing at a house, however it is dashed.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.supply_part_codes (supply_house_id, code, part_id)
    VALUES ('00000000-0000-0000-0000-00000000d001', '512 207', '00000000-0000-0000-0000-00000000e002');
    RAISE EXCEPTION 'FAILED: one number was kept for two parts at one house';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'ok: one number means one part at a house';
  END;
END $$;

-- 3 · the same number is free at another house, and a part may carry two numbers.
INSERT INTO public.supply_part_codes (supply_house_id, code, part_id)
VALUES ('00000000-0000-0000-0000-00000000d002', '512207', '00000000-0000-0000-0000-00000000e002'),
       ('00000000-0000-0000-0000-00000000d001', '512208', '00000000-0000-0000-0000-00000000e001');
SELECT bedt.ok('three numbers on file', (SELECT count(*) = 3 FROM public.supply_part_codes));

-- 4 · a number is a part or not a part, never both and never neither; a number of punctuation is no number.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.supply_part_codes (supply_house_id, code, part_id, not_a_part)
    VALUES ('00000000-0000-0000-0000-00000000d001', '440118', '00000000-0000-0000-0000-00000000e001', true);
    RAISE EXCEPTION 'FAILED: a number was kept as a part and as not a part';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: a part and not a part at once is refused';
  END;
  BEGIN
    INSERT INTO public.supply_part_codes (supply_house_id, code) VALUES ('00000000-0000-0000-0000-00000000d001', '440118');
    RAISE EXCEPTION 'FAILED: a number was kept with no part and no mark';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: neither a part nor not a part is refused';
  END;
  BEGIN
    INSERT INTO public.supply_part_codes (supply_house_id, code, not_a_part) VALUES ('00000000-0000-0000-0000-00000000d001', ' -- ', true);
    RAISE EXCEPTION 'FAILED: a number with no letter or digit was kept';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: a number with no letter or digit is refused';
  END;
  BEGIN
    INSERT INTO public.supply_part_codes (supply_house_id, code, part_id, unit_factor)
    VALUES ('00000000-0000-0000-0000-00000000d001', '190442', '00000000-0000-0000-0000-00000000e001', 0);
    RAISE EXCEPTION 'FAILED: a unit factor of nothing was kept';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: a unit factor of nothing is refused';
  END;
END $$;
INSERT INTO public.supply_part_codes (supply_house_id, code, not_a_part) VALUES ('00000000-0000-0000-0000-00000000d001', '440118', true);
INSERT INTO public.supply_part_codes (supply_house_id, code, part_id, unit_factor)
VALUES ('00000000-0000-0000-0000-00000000d001', '190442', '00000000-0000-0000-0000-00000000e002', 100);
SELECT bedt.ok('a catch-all number and a per-hundred number are kept', (SELECT count(*) = 5 FROM public.supply_part_codes));
RESET ROLE;

-- 5 · a helper reads none and writes none.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a2');
SET LOCAL ROLE authenticated;
SELECT bedt.ok('a helper reads no number', (SELECT count(*) = 0 FROM public.supply_part_codes));
DO $$
BEGIN
  BEGIN
    INSERT INTO public.supply_part_codes (supply_house_id, code, part_id)
    VALUES ('00000000-0000-0000-0000-00000000d002', '900001', '00000000-0000-0000-0000-00000000e001');
    RAISE EXCEPTION 'FAILED: a helper kept a number';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: a helper keeps no number';
  END;
END $$;
RESET ROLE;

-- 6 · a trainee (read-only) reads and writes none.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a3');
SET LOCAL ROLE authenticated;
SELECT bedt.ok('a trainee reads the numbers', (SELECT count(*) = 5 FROM public.supply_part_codes));
DO $$
BEGIN
  BEGIN
    INSERT INTO public.supply_part_codes (supply_house_id, code, part_id)
    VALUES ('00000000-0000-0000-0000-00000000d002', '900002', '00000000-0000-0000-0000-00000000e001');
    RAISE EXCEPTION 'FAILED: a trainee kept a number';
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN
    IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
    RAISE NOTICE 'ok: a trainee keeps no number';
  END;
END $$;
RESET ROLE;

-- 7 · a number goes with its part.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a1');
DELETE FROM public.material_parts WHERE id = '00000000-0000-0000-0000-00000000e002';
SELECT bedt.ok('a deleted part takes its numbers with it', (SELECT count(*) = 3 FROM public.supply_part_codes));

DO $$ BEGIN RAISE NOTICE 'price_sheets PASSED'; END $$;
ROLLBACK;
