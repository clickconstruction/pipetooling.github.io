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

-- 17 · a sheet just read is kept whole, with its fixtures, and nothing is filed.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a1');
SET LOCAL ROLE authenticated;
INSERT INTO bed_out VALUES ('sheet', to_jsonb(public.price_sheet_save(
  jsonb_build_object('number', 'Q-88213', 'dated_on', '2026-11-12', 'valid_until', '2026-12-12', 'file_sha256', 'abc123', 'page_from', 1, 'page_to', 6),
  jsonb_build_array(
    jsonb_build_object('group_no', 1, 'tag', 'SK-2', 'label', 'DUMP SINK (BAR) (OFCI)', 'each_price', 52.72),
    jsonb_build_object('group_no', 2, 'tag', 'MS-1', 'label', 'MOP SINK', 'each_price', 313.27)),
  jsonb_build_array(
    jsonb_build_object('group_no', 1, 'group_tag', 'SK-2', 'group_label', 'DUMP SINK (BAR) (OFCI)', 'line_kind', 'charge', 'house_code', '440118', 'description', 'MISC CHARGE', 'qty', 1),
    jsonb_build_object('group_no', 1, 'group_tag', 'SK-2', 'group_label', 'DUMP SINK (BAR) (OFCI)', 'line_kind', 'component', 'house_code', '512207', 'description', 'AX8802XL-LR-PC ARLO SUPPLY KIT', 'qty', 1),
    jsonb_build_object('group_no', 2, 'group_tag', 'MS-1', 'group_label', 'MOP SINK', 'house_code', '277310', 'description', 'B0133-ADF12 TANNER PRE RINSE', 'qty', 1, 'unit_price', 312.50),
    jsonb_build_object('group_no', 2, 'group_tag', 'MS-1', 'group_label', 'MOP SINK', 'house_code', '190443', 'description', '3/8 X 1-1/2 CLOSET BOLT BRASS', 'qty', 2, 'unit_price', 38.40, 'pricing_unit', 'per_hundred', 'page_no', 4)))));
SELECT bedt.ok('the sheet is a quote, came by sheet, with no house yet, kept by the caller',
  (SELECT kind = 'quote' AND came_by = 'sheet' AND supply_house_id IS NULL AND number = 'Q-88213' AND valid_until = '2026-12-12' AND file_sha256 = 'abc123'
     AND created_by = '00000000-0000-0000-0000-0000000000a1' FROM public.supply_papers WHERE id = (SELECT (v #>> '{}')::uuid FROM bed_out WHERE k = 'sheet')));
SELECT bedt.ok('its two fixtures and four rows are read back in order',
  (SELECT count(*) = 2 FROM public.supply_paper_groups WHERE paper_id = (SELECT (v #>> '{}')::uuid FROM bed_out WHERE k = 'sheet'))
  AND (SELECT array_agg(line_no ORDER BY line_no) = ARRAY[1, 2, 3, 4] AND bool_and(filed_at IS NULL) FROM public.supply_paper_lines WHERE paper_id = (SELECT (v #>> '{}')::uuid FROM bed_out WHERE k = 'sheet')));
SELECT bedt.ok('a row keeps its fixture, its kind and its unit',
  (SELECT group_no = 2 AND group_tag = 'MS-1' AND pricing_unit = 'per_hundred' AND qty_ordered = 2 AND page_no = 4 FROM public.supply_paper_lines
   WHERE paper_id = (SELECT (v #>> '{}')::uuid FROM bed_out WHERE k = 'sheet') AND line_no = 4));
SELECT bedt.ok('nothing was filed by keeping the sheet', (SELECT count(*) = 0 FROM public.material_part_prices WHERE part_id = '00000000-0000-0000-0000-00000000e002'));

-- 18 · a row cannot be filed until the sheet has its house; then it files as that house, dated by the sheet.
DO $$
BEGIN
  BEGIN
    PERFORM public.price_row_file(jsonb_build_object('line_id', (SELECT id FROM public.supply_paper_lines WHERE description = 'B0133-ADF12 TANNER PRE RINSE'), 'part_id', '00000000-0000-0000-0000-00000000e002'));
    RAISE EXCEPTION 'FAILED: a row was filed with no house';
  EXCEPTION WHEN invalid_parameter_value THEN RAISE NOTICE 'ok: a row of a sheet with no house is not filed';
  END;
END $$;
SELECT public.price_sheet_set((SELECT (v #>> '{}')::uuid FROM bed_out WHERE k = 'sheet'), jsonb_build_object('supply_house_id', '00000000-0000-0000-0000-00000000d002'));
INSERT INTO bed_out VALUES ('sheet_row', public.price_row_file(jsonb_build_object(
  'line_id', (SELECT id FROM public.supply_paper_lines WHERE description = 'B0133-ADF12 TANNER PRE RINSE'), 'part_id', '00000000-0000-0000-0000-00000000e002', 'came_by', 'sheet', 'matched_how', 'mfr_number')));
SELECT bedt.ok('the row files under the sheet''s house, at its price, on its day',
  (SELECT price = 312.50 AND effective_date = '2026-11-12' FROM public.material_part_prices WHERE part_id = '00000000-0000-0000-0000-00000000e002' AND supply_house_id = '00000000-0000-0000-0000-00000000d002'));
SELECT bedt.ok('the row''s own number is kept on the part, taught by the sheet',
  (SELECT part_id = '00000000-0000-0000-0000-00000000e002' AND taught_from = 'sheet' FROM public.supply_part_codes WHERE supply_house_id = '00000000-0000-0000-0000-00000000d002' AND code_key = '277310'));
SELECT bedt.ok('the history names the quote', (SELECT notes = 'From quote Q-88213' FROM public.material_part_price_history WHERE part_id = '00000000-0000-0000-0000-00000000e002' AND new_price = 312.50));

-- 19 · the house cannot change under a filed row; a filed row cannot be left out; the sheet cannot be removed.
DO $$
DECLARE v_sheet uuid := (SELECT (v #>> '{}')::uuid FROM bed_out WHERE k = 'sheet');
BEGIN
  BEGIN
    PERFORM public.price_sheet_set(v_sheet, jsonb_build_object('supply_house_id', '00000000-0000-0000-0000-00000000d001'));
    RAISE EXCEPTION 'FAILED: the house changed under a filed row';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
    RAISE NOTICE 'ok: the house does not change under a filed row';
  END;
  BEGIN
    PERFORM public.price_sheet_line_hold((SELECT (v->>'line_id')::uuid FROM bed_out WHERE k = 'sheet_row'), 'left_out');
    RAISE EXCEPTION 'FAILED: a filed row was left out';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
    RAISE NOTICE 'ok: a filed row is not left out';
  END;
  BEGIN
    PERFORM public.price_sheet_discard(v_sheet);
    RAISE EXCEPTION 'FAILED: a sheet with a filed row was removed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
    RAISE NOTICE 'ok: a sheet with a filed row is not removed';
  END;
END $$;
SELECT public.price_sheet_line_part((SELECT id FROM public.supply_paper_lines WHERE description = 'AX8802XL-LR-PC ARLO SUPPLY KIT' AND group_tag = 'SK-2'), '00000000-0000-0000-0000-00000000e001');
SELECT bedt.ok('a person''s pick of the part is kept on the row',
  (SELECT part_id = '00000000-0000-0000-0000-00000000e001' AND matched_how = 'person' AND filed_at IS NULL FROM public.supply_paper_lines WHERE description = 'AX8802XL-LR-PC ARLO SUPPLY KIT' AND group_tag = 'SK-2'));
SELECT public.price_sheet_line_part((SELECT id FROM public.supply_paper_lines WHERE description = 'AX8802XL-LR-PC ARLO SUPPLY KIT' AND group_tag = 'SK-2'), NULL);
SELECT bedt.ok('and the pick is undone', (SELECT part_id IS NULL AND matched_how = '' FROM public.supply_paper_lines WHERE description = 'AX8802XL-LR-PC ARLO SUPPLY KIT' AND group_tag = 'SK-2'));
SELECT public.price_sheet_line_hold((SELECT id FROM public.supply_paper_lines WHERE description = 'MISC CHARGE' AND group_tag = 'SK-2'), 'left_out');
SELECT bedt.ok('a row that is not filed is left out', (SELECT held_why = 'left_out' FROM public.supply_paper_lines WHERE description = 'MISC CHARGE' AND group_tag = 'SK-2'));
SELECT public.price_sheet_set((SELECT (v #>> '{}')::uuid FROM bed_out WHERE k = 'sheet'), jsonb_build_object('number', 'Q-88213-R1'));
SELECT bedt.ok('the number changes and the house stays', (SELECT number = 'Q-88213-R1' AND supply_house_id = '00000000-0000-0000-0000-00000000d002' FROM public.supply_papers WHERE id = (SELECT (v #>> '{}')::uuid FROM bed_out WHERE k = 'sheet')));

-- 20 · a sheet's row taken back stays on the sheet, unfiled; then the sheet can be removed.
SELECT bedt.ok('the sheet''s row comes back', (SELECT (public.price_row_take_back((SELECT (v->>'line_id')::uuid FROM bed_out WHERE k = 'sheet_row'))->>'restored')::boolean));
SELECT bedt.ok('the row is still on the sheet, not filed',
  (SELECT filed_at IS NULL AND filed_price IS NULL FROM public.supply_paper_lines WHERE id = (SELECT (v->>'line_id')::uuid FROM bed_out WHERE k = 'sheet_row')));
SELECT bedt.ok('the price it filed is gone, and the number it taught', (SELECT count(*) = 0 FROM public.material_part_prices WHERE part_id = '00000000-0000-0000-0000-00000000e002' AND supply_house_id = '00000000-0000-0000-0000-00000000d002')
  AND NOT EXISTS (SELECT 1 FROM public.supply_part_codes WHERE code_key = '277310'));
SELECT public.price_sheet_discard((SELECT (v #>> '{}')::uuid FROM bed_out WHERE k = 'sheet'));
SELECT bedt.ok('the sheet, its fixtures and its rows are gone',
  (SELECT count(*) = 0 FROM public.supply_papers WHERE number = 'Q-88213-R1') AND (SELECT count(*) = 0 FROM public.supply_paper_groups) AND (SELECT count(*) = 0 FROM public.supply_paper_lines WHERE group_tag <> ''));
RESET ROLE;

-- 21 · a helper keeps no sheet; the groups table carries the fences.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a2');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.price_sheet_save(jsonb_build_object('number', 'X'), '[]'::jsonb, jsonb_build_array(jsonb_build_object('description', 'A ROW')));
    RAISE EXCEPTION 'FAILED: a helper kept a sheet';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: a helper keeps no sheet';
  END;
END $$;
RESET ROLE;
SELECT bedt.ok('the fixtures table has row level security and its restrictive policies',
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.supply_paper_groups'::regclass)
  AND (SELECT count(*) >= 3 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'supply_paper_groups' AND permissive = 'RESTRICTIVE'));
SELECT bedt.ok('anon cannot call the sheet functions',
  NOT has_function_privilege('anon', 'public.price_sheet_save(jsonb, jsonb, jsonb)', 'EXECUTE') AND NOT has_function_privilege('anon', 'public.price_sheet_discard(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.price_sheet_set(uuid, jsonb)', 'EXECUTE') AND NOT has_function_privilege('anon', 'public.price_sheet_line_hold(uuid, text)', 'EXECUTE'));

-- 7 · a number goes with its part.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a1');
DELETE FROM public.material_parts WHERE id = '00000000-0000-0000-0000-00000000e002';
SELECT bedt.ok('a deleted part takes its numbers with it', (SELECT count(*) = 0 FROM public.supply_part_codes WHERE part_id = '00000000-0000-0000-0000-00000000e002'));

DO $$ BEGIN RAISE NOTICE 'price_sheets PASSED'; END $$;
ROLLBACK;
