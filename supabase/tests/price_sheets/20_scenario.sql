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

-- 8 · a pasted row files a price, keeps its source, and says so in the history.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a1');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE bed_out (k text PRIMARY KEY, v jsonb) ON COMMIT DROP;
INSERT INTO bed_out VALUES ('first', public.price_row_file(jsonb_build_object(
  'supply_house_id', '00000000-0000-0000-0000-00000000d001', 'part_id', '00000000-0000-0000-0000-00000000e001',
  'unit_price', 18.40, 'house_code', '512-207', 'description', 'AX8802XL-LR-PC ARLO SUPPLY KIT', 'came_by', 'pasted', 'dated_on', '2026-11-06')));
SELECT bedt.ok('the row is filed', (SELECT (v->>'filed')::boolean AND v->'was' = 'null'::jsonb FROM bed_out WHERE k = 'first'));
SELECT bedt.ok('the book holds the price, dated by the paper, with its source',
  (SELECT price = 18.40 AND effective_date = '2026-11-06' AND source_line_id = (SELECT (v->>'line_id')::uuid FROM bed_out WHERE k = 'first')
   FROM public.material_part_prices WHERE part_id = '00000000-0000-0000-0000-00000000e001' AND supply_house_id = '00000000-0000-0000-0000-00000000d001'));
SELECT bedt.ok('the estimator reads the paper: a quote, pasted, made by the caller',
  (SELECT kind = 'quote' AND came_by = 'pasted' AND created_by = '00000000-0000-0000-0000-0000000000a1' FROM public.supply_papers WHERE id = (SELECT (v->>'paper_id')::uuid FROM bed_out WHERE k = 'first')));
SELECT bedt.ok('the row remembers it was filed, by whom, at what price, and that nothing was replaced',
  (SELECT filed_at IS NOT NULL AND filed_by = '00000000-0000-0000-0000-0000000000a1' AND filed_price = 18.40 AND replaced_price IS NULL AND matched_how = 'person'
   FROM public.supply_paper_lines WHERE id = (SELECT (v->>'line_id')::uuid FROM bed_out WHERE k = 'first')));
SELECT bedt.ok('the history says where the price came from',
  (SELECT notes = 'Pasted from a quote' AND new_price = 18.40 AND changed_by = '00000000-0000-0000-0000-0000000000a1'
   FROM public.material_part_price_history WHERE part_id = '00000000-0000-0000-0000-00000000e001' AND new_price = 18.40));
SELECT bedt.ok('a number already kept for the same part is not kept twice', (SELECT count(*) = 1 FROM public.supply_part_codes WHERE supply_house_id = '00000000-0000-0000-0000-00000000d001' AND code_key = '512207'));

-- 9 · a move past a quarter waits for a person, then files on their word and remembers what it replaced.
INSERT INTO bed_out VALUES ('moved', public.price_row_file(jsonb_build_object(
  'supply_house_id', '00000000-0000-0000-0000-00000000d001', 'part_id', '00000000-0000-0000-0000-00000000e001',
  'unit_price', 30.00, 'came_by', 'phone', 'dated_on', '2026-11-08')));
SELECT bedt.ok('a move past a quarter is not filed, and says what is on file',
  (SELECT NOT (v->>'filed')::boolean AND v->>'why' = 'moved' AND (v->'on_file'->>'price')::numeric = 18.40 FROM bed_out WHERE k = 'moved'));
SELECT bedt.ok('the book is unchanged', (SELECT price = 18.40 FROM public.material_part_prices WHERE part_id = '00000000-0000-0000-0000-00000000e001'));
INSERT INTO bed_out VALUES ('moved_ok', public.price_row_file(jsonb_build_object(
  'supply_house_id', '00000000-0000-0000-0000-00000000d001', 'part_id', '00000000-0000-0000-0000-00000000e001',
  'unit_price', 30.00, 'came_by', 'phone', 'dated_on', '2026-11-08', 'allow_big_move', true)));
SELECT bedt.ok('on a person''s word it files, and returns the price it replaced',
  (SELECT (v->>'filed')::boolean AND (v->'was'->>'price')::numeric = 18.40 FROM bed_out WHERE k = 'moved_ok'));
SELECT bedt.ok('the row keeps the price, the day and the source it replaced',
  (SELECT replaced_price = 18.40 AND replaced_effective_date = '2026-11-06' AND replaced_source_line_id = (SELECT (v->>'line_id')::uuid FROM bed_out WHERE k = 'first')
   FROM public.supply_paper_lines WHERE id = (SELECT (v->>'line_id')::uuid FROM bed_out WHERE k = 'moved_ok')));
SELECT bedt.ok('a price by phone says so in the history',
  (SELECT notes = 'By phone' AND old_price = 18.40 FROM public.material_part_price_history WHERE part_id = '00000000-0000-0000-0000-00000000e001' AND new_price = 30.00));

-- 10 · an older paper does not overwrite a newer price.
INSERT INTO bed_out VALUES ('older', public.price_row_file(jsonb_build_object(
  'supply_house_id', '00000000-0000-0000-0000-00000000d001', 'part_id', '00000000-0000-0000-0000-00000000e001',
  'unit_price', 29.00, 'came_by', 'pasted', 'dated_on', '2026-10-20')));
SELECT bedt.ok('an older paper is not filed over a newer price',
  (SELECT NOT (v->>'filed')::boolean AND v->>'why' = 'newer_on_file' FROM bed_out WHERE k = 'older'));

-- 11 · a price by the hundred is filed each, and the number keeps the answer.
INSERT INTO bed_out VALUES ('hundred', public.price_row_file(jsonb_build_object(
  'supply_house_id', '00000000-0000-0000-0000-00000000d002', 'part_id', '00000000-0000-0000-0000-00000000e002',
  'unit_price', 38.40, 'pricing_unit', 'per_hundred', 'house_code', 'B-190442', 'came_by', 'pasted')));
SELECT bedt.ok('38.40 a hundred is 0.38 each', (SELECT price = 0.38 FROM public.material_part_prices WHERE part_id = '00000000-0000-0000-0000-00000000e002' AND supply_house_id = '00000000-0000-0000-0000-00000000d002'));
SELECT bedt.ok('the new number is kept on the part with its unit factor, taught on this row',
  (SELECT part_id = '00000000-0000-0000-0000-00000000e002' AND unit_factor = 100 AND taught_line_id = (SELECT (v->>'line_id')::uuid FROM bed_out WHERE k = 'hundred')
   FROM public.supply_part_codes WHERE supply_house_id = '00000000-0000-0000-0000-00000000d002' AND code_key = 'B190442'));

-- 12 · a number the house uses for another part stops the row before anything is written, and names the part.
DO $$
DECLARE v_before integer := (SELECT count(*) FROM public.supply_papers);
BEGIN
  BEGIN
    PERFORM public.price_row_file(jsonb_build_object(
      'supply_house_id', '00000000-0000-0000-0000-00000000d001', 'part_id', '00000000-0000-0000-0000-00000000e002',
      'unit_price', 12.00, 'house_code', '512207', 'came_by', 'pasted'));
    RAISE EXCEPTION 'FAILED: a number was filed onto a second part';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
    IF SQLERRM <> 'Bed Hillcrest already uses 512-207 for AX8802XL-LR-PC ARLO SUPPLY KIT.' THEN RAISE EXCEPTION 'FAILED: the refusal reads [%]', SQLERRM; END IF;
    RAISE NOTICE 'ok: a number another part has is refused, naming the part';
  END;
  IF (SELECT count(*) FROM public.supply_papers) <> v_before THEN RAISE EXCEPTION 'FAILED: a refused row left a paper'; END IF;
  BEGIN
    PERFORM public.price_row_file(jsonb_build_object(
      'supply_house_id', '00000000-0000-0000-0000-00000000d001', 'part_id', '00000000-0000-0000-0000-00000000e002',
      'unit_price', 12.00, 'house_code', '440118', 'came_by', 'pasted'));
    RAISE EXCEPTION 'FAILED: a catch-all number was filed onto a part';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
    RAISE NOTICE 'ok: a catch-all number is refused';
  END;
  BEGIN
    PERFORM public.price_row_file(jsonb_build_object('supply_house_id', '00000000-0000-0000-0000-00000000d001', 'part_id', '00000000-0000-0000-0000-00000000e002', 'unit_price', 0.004, 'came_by', 'pasted'));
    RAISE EXCEPTION 'FAILED: a price under a cent was filed';
  EXCEPTION WHEN invalid_parameter_value THEN RAISE NOTICE 'ok: a price under a cent is refused';
  END;
END $$;

-- 13 · taking a row back returns the price it replaced; taking the first back leaves no price and no paper.
SELECT bedt.ok('the second row comes back', (SELECT (public.price_row_take_back((SELECT (v->>'line_id')::uuid FROM bed_out WHERE k = 'moved_ok'))->>'restored')::boolean));
SELECT bedt.ok('the price, its day and its source are the first row''s again',
  (SELECT price = 18.40 AND effective_date = '2026-11-06' AND source_line_id = (SELECT (v->>'line_id')::uuid FROM bed_out WHERE k = 'first')
   FROM public.material_part_prices WHERE part_id = '00000000-0000-0000-0000-00000000e001'));
SELECT bedt.ok('a one-off paper goes with its row', (SELECT count(*) = 0 FROM public.supply_papers WHERE id = (SELECT (v->>'paper_id')::uuid FROM bed_out WHERE k = 'moved_ok')));
SELECT bedt.ok('the first row comes back', (SELECT (public.price_row_take_back((SELECT (v->>'line_id')::uuid FROM bed_out WHERE k = 'first'))->>'restored')::boolean));
SELECT bedt.ok('no price is left where there was none', (SELECT count(*) = 0 FROM public.material_part_prices WHERE part_id = '00000000-0000-0000-0000-00000000e001'));
SELECT bedt.ok('the number typed by hand before the row stays', (SELECT count(*) = 1 FROM public.supply_part_codes WHERE supply_house_id = '00000000-0000-0000-0000-00000000d001' AND code_key = '512207'));
SELECT bedt.ok('the per-hundred row comes back', (SELECT (public.price_row_take_back((SELECT (v->>'line_id')::uuid FROM bed_out WHERE k = 'hundred'))->>'restored')::boolean));
SELECT bedt.ok('the number that row taught goes with it',
  NOT EXISTS (SELECT 1 FROM public.supply_part_codes WHERE supply_house_id = '00000000-0000-0000-0000-00000000d002' AND code_key = 'B190442'));

-- 14 · a price changed by hand is no longer the paper's: it loses its source, and the row cannot take it back.
INSERT INTO bed_out VALUES ('hand', public.price_row_file(jsonb_build_object(
  'supply_house_id', '00000000-0000-0000-0000-00000000d001', 'part_id', '00000000-0000-0000-0000-00000000e001', 'unit_price', 20.00, 'came_by', 'counter')));
UPDATE public.material_part_prices SET price = 21.00 WHERE part_id = '00000000-0000-0000-0000-00000000e001' AND supply_house_id = '00000000-0000-0000-0000-00000000d001';
SELECT bedt.ok('a hand edit clears the source', (SELECT source_line_id IS NULL AND price = 21.00 FROM public.material_part_prices WHERE part_id = '00000000-0000-0000-0000-00000000e001'));
SELECT bedt.ok('the row says the price changed since',
  (SELECT public.price_row_take_back((SELECT (v->>'line_id')::uuid FROM bed_out WHERE k = 'hand')) = jsonb_build_object('restored', false, 'why', 'changed_since')));
SELECT bedt.ok('and leaves the typed price', (SELECT price = 21.00 FROM public.material_part_prices WHERE part_id = '00000000-0000-0000-0000-00000000e001'));
RESET ROLE;

-- 15 · a bill's paper stays with the office: the estimator reads quotes only.
INSERT INTO public.supply_papers (id, supply_house_id, kind, number) VALUES ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000d001', 'invoice', 'INV-1');
INSERT INTO public.supply_paper_lines (paper_id, line_no, description) VALUES ('00000000-0000-0000-0000-00000000f001', 1, 'A BILL LINE');
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a1');
SET LOCAL ROLE authenticated;
SELECT bedt.ok('the estimator reads no bill', (SELECT count(*) = 0 FROM public.supply_papers WHERE kind = 'invoice'));
SELECT bedt.ok('the estimator reads no bill line', (SELECT count(*) = 0 FROM public.supply_paper_lines WHERE description = 'A BILL LINE'));
SELECT bedt.ok('the estimator reads the quote lines', (SELECT count(*) >= 1 FROM public.supply_paper_lines));
RESET ROLE;

-- 16 · a helper and a trainee file nothing and take nothing back.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a2');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.price_row_file(jsonb_build_object('supply_house_id', '00000000-0000-0000-0000-00000000d001', 'part_id', '00000000-0000-0000-0000-00000000e001', 'unit_price', 5, 'came_by', 'phone'));
    RAISE EXCEPTION 'FAILED: a helper filed a price';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: a helper files no price';
  END;
  BEGIN
    PERFORM public.price_row_take_back('00000000-0000-0000-0000-00000000f0ff');
    RAISE EXCEPTION 'FAILED: a helper took a price back';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: a helper takes no price back';
  END;
END $$;
SELECT bedt.ok('a helper reads no paper', (SELECT count(*) = 0 FROM public.supply_papers));
RESET ROLE;
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a3');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.price_row_file(jsonb_build_object('supply_house_id', '00000000-0000-0000-0000-00000000d001', 'part_id', '00000000-0000-0000-0000-00000000e001', 'unit_price', 5, 'came_by', 'phone'));
    RAISE EXCEPTION 'FAILED: a trainee filed a price';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: a trainee files no price';
  END;
END $$;
RESET ROLE;
SELECT bedt.ok('anon cannot call either function',
  NOT has_function_privilege('anon', 'public.price_row_file(jsonb)', 'EXECUTE') AND NOT has_function_privilege('anon', 'public.price_row_take_back(uuid)', 'EXECUTE'));

-- 7 · a number goes with its part.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a1');
DELETE FROM public.material_parts WHERE id = '00000000-0000-0000-0000-00000000e002';
SELECT bedt.ok('a deleted part takes its numbers with it', (SELECT count(*) = 0 FROM public.supply_part_codes WHERE part_id = '00000000-0000-0000-0000-00000000e002'));

DO $$ BEGIN RAISE NOTICE 'price_sheets PASSED'; END $$;
ROLLBACK;
