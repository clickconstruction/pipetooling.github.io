SET lock_timeout = '3s';

-- v2.6911 — A price sheet's ready rows filed in one press, and a whole sheet taken back (punch list #308 PR 5;
-- docs/migrations/20261111080000_price_sheet_filing.md).
--
-- PR 3 filed a row that carries a price, and PR 4 kept a whole sheet. Two things were left:
--
--   * A row under a fixture often has no price of its own, because the fixture's subtotal covers it. price_row_file
--     now files such a row of a sheet: it says which part the row is and keeps the house's number on the part, and
--     writes no price. price_row_take_back unfiles it and removes the number it taught. Both bodies are the ones
--     20261111040000_price_rows.sql holds, with that branch added.
--   * price_sheet_take_back(paper_id) takes back every filed row of a sheet, newest first. A price somebody changed
--     since is left alone and counted, so the sheet can still be taken back around it.
--
-- No table changes. Idempotent: three CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.price_row_file(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_house uuid := NULLIF(p->>'supply_house_id', '')::uuid;
  v_part uuid := NULLIF(p->>'part_id', '')::uuid;
  v_line_id uuid := NULLIF(p->>'line_id', '')::uuid;
  v_printed numeric := NULLIF(p->>'unit_price', '')::numeric;
  v_pricing_unit text := COALESCE(NULLIF(p->>'pricing_unit', ''), 'each');
  v_factor numeric := NULLIF(p->>'unit_factor', '')::numeric;
  v_dated date := NULLIF(p->>'dated_on', '')::date;
  v_code text := btrim(COALESCE(p->>'house_code', ''));
  v_code_key text;
  v_came_by text := COALESCE(NULLIF(p->>'came_by', ''), 'pasted');
  v_bid uuid := NULLIF(p->>'bid_id', '')::uuid;
  v_allow_big boolean := COALESCE((p->>'allow_big_move')::boolean, false);
  v_allow_older boolean := COALESCE((p->>'allow_older')::boolean, false);
  v_price numeric(10, 2);
  v_old public.material_part_prices%ROWTYPE;
  v_had_old boolean := false;
  v_paper_id uuid;
  v_line public.supply_paper_lines%ROWTYPE;
  v_taken public.supply_part_codes%ROWTYPE;
  v_taken_name text;
  v_house_name text;
  v_no_price boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to file a price.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.may_edit_parts_book() THEN
    RAISE EXCEPTION 'Only the people who edit the parts book file a price.' USING ERRCODE = '42501';
  END IF;
  -- A definer passes the read-only blocks, the twin fence and the archived seal, so each is said here before the write.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot file a price.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot file a price.' USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'An archived account cannot file a price.' USING ERRCODE = '42501';
  END IF;

  -- A row of a sheet already read carries its own house, number and price; a one-off carries them in p.
  IF v_line_id IS NOT NULL THEN
    SELECT * INTO v_line FROM public.supply_paper_lines WHERE id = v_line_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That row is not on the sheet any more.' USING ERRCODE = 'P0002';
    END IF;
    IF v_line.filed_at IS NOT NULL THEN
      RAISE EXCEPTION 'That row is already filed.' USING ERRCODE = 'P0001';
    END IF;
    SELECT id, supply_house_id, COALESCE(v_dated, dated_on) INTO v_paper_id, v_house, v_dated FROM public.supply_papers WHERE id = v_line.paper_id;
    v_printed := COALESCE(v_printed, v_line.unit_price);
    v_pricing_unit := COALESCE(NULLIF(p->>'pricing_unit', ''), v_line.pricing_unit);
    IF v_code = '' THEN v_code := btrim(v_line.house_code); END IF;
  END IF;

  IF v_house IS NULL OR NOT EXISTS (SELECT 1 FROM public.supply_houses WHERE id = v_house) THEN
    RAISE EXCEPTION 'Say which supply house the price is from.' USING ERRCODE = '22023';
  END IF;
  IF v_part IS NULL OR NOT EXISTS (SELECT 1 FROM public.material_parts WHERE id = v_part) THEN
    RAISE EXCEPTION 'That part is not in the book.' USING ERRCODE = 'P0002';
  END IF;
  -- A row under a fixture often carries no price of its own: the fixture's subtotal covers it. Such a row of a sheet
  -- is still filed, to say which part it is and to keep the house's number; it writes no price.
  v_no_price := v_line_id IS NOT NULL AND v_printed IS NULL;
  IF NOT v_no_price AND (v_printed IS NULL OR v_printed <= 0) THEN
    RAISE EXCEPTION 'A price above zero is needed.' USING ERRCODE = '22023';
  END IF;
  IF v_pricing_unit NOT IN ('each', 'per_hundred', 'per_thousand') THEN
    RAISE EXCEPTION 'The price is each, by the hundred or by the thousand.' USING ERRCODE = '22023';
  END IF;
  IF v_came_by NOT IN ('sheet', 'pasted', 'phone', 'counter', 'mail', 'website') THEN
    RAISE EXCEPTION 'Say how the price came: a sheet, a pasted row, a call, the counter, a mail or a website.' USING ERRCODE = '22023';
  END IF;
  v_factor := COALESCE(v_factor, CASE v_pricing_unit WHEN 'per_hundred' THEN 100 WHEN 'per_thousand' THEN 1000 ELSE 1 END);
  IF v_factor <= 0 THEN
    RAISE EXCEPTION 'The unit factor must be above zero.' USING ERRCODE = '22023';
  END IF;
  IF NOT v_no_price THEN
    v_price := round(v_printed / v_factor, 2);
    IF v_price <= 0 THEN
      RAISE EXCEPTION 'That price comes to less than a cent each.' USING ERRCODE = '22023';
    END IF;
  END IF;
  v_dated := COALESCE(v_dated, (now() AT TIME ZONE 'America/Chicago')::date);

  -- One number means one part at a house. The number is checked before anything is written.
  v_code_key := upper(regexp_replace(v_code, '[^A-Za-z0-9]', '', 'g'));
  IF v_code_key <> '' THEN
    SELECT * INTO v_taken FROM public.supply_part_codes WHERE supply_house_id = v_house AND code_key = v_code_key;
    IF FOUND AND (v_taken.not_a_part OR v_taken.part_id <> v_part) THEN
      SELECT name INTO v_house_name FROM public.supply_houses WHERE id = v_house;
      IF v_taken.not_a_part THEN
        RAISE EXCEPTION '% uses % for anything it does not stock, so it is not kept on a part.', v_house_name, v_taken.code USING ERRCODE = 'P0001';
      END IF;
      SELECT name INTO v_taken_name FROM public.material_parts WHERE id = v_taken.part_id;
      RAISE EXCEPTION '% already uses % for %.', v_house_name, v_taken.code, COALESCE(v_taken_name, 'another part') USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF v_no_price THEN
    UPDATE public.supply_paper_lines
    SET part_id = v_part,
        matched_how = COALESCE(NULLIF(p->>'matched_how', ''), NULLIF(matched_how, ''), 'person'),
        filed_at = clock_timestamp(),
        filed_by = auth.uid(),
        filed_price = NULL,
        replaced_price = NULL,
        replaced_effective_date = NULL,
        replaced_source_line_id = NULL,
        held_why = ''
    WHERE id = v_line_id;
    IF v_code_key <> '' THEN
      INSERT INTO public.supply_part_codes (supply_house_id, code, part_id, taught_from, taught_line_id)
      VALUES (v_house, v_code, v_part, 'sheet', v_line_id)
      ON CONFLICT (supply_house_id, code_key) DO NOTHING;
    END IF;
    RETURN jsonb_build_object('filed', true, 'line_id', v_line_id, 'paper_id', v_paper_id, 'price', NULL, 'dated_on', v_dated, 'was', NULL);
  END IF;

  SELECT * INTO v_old FROM public.material_part_prices WHERE part_id = v_part AND supply_house_id = v_house FOR UPDATE;
  v_had_old := FOUND;
  IF v_had_old THEN
    -- The newest dated paper wins: an older paper does not overwrite a newer price unless a person says so.
    IF v_old.effective_date IS NOT NULL AND v_old.effective_date > v_dated AND NOT v_allow_older THEN
      RETURN jsonb_build_object('filed', false, 'why', 'newer_on_file', 'price', v_price, 'dated_on', v_dated,
        'on_file', jsonb_build_object('price', v_old.price, 'effective_date', v_old.effective_date));
    END IF;
    -- A move past a quarter waits for a person: a tenfold move is usually a unit.
    IF v_old.price > 0 AND abs(v_price - v_old.price) / v_old.price > 0.25 AND NOT v_allow_big THEN
      RETURN jsonb_build_object('filed', false, 'why', 'moved', 'price', v_price, 'dated_on', v_dated,
        'on_file', jsonb_build_object('price', v_old.price, 'effective_date', v_old.effective_date));
    END IF;
  END IF;

  IF v_line_id IS NULL THEN
    INSERT INTO public.supply_papers (supply_house_id, kind, number, dated_on, came_by, bid_id, created_by, read_by, read_at)
    VALUES (v_house, 'quote', btrim(COALESCE(p->>'number', '')), v_dated, v_came_by, v_bid, auth.uid(), 'person', clock_timestamp())
    RETURNING id INTO v_paper_id;
    INSERT INTO public.supply_paper_lines (paper_id, line_no, line_kind, house_code, mfr_number, description, unit, unit_price, pricing_unit, part_id, matched_how, unit_factor)
    VALUES (v_paper_id, 1, 'part', v_code, btrim(COALESCE(p->>'mfr_number', '')), btrim(COALESCE(p->>'description', '')), 'each', v_printed, v_pricing_unit, v_part,
      COALESCE(NULLIF(p->>'matched_how', ''), 'person'), v_factor)
    RETURNING id INTO v_line_id;
  END IF;

  IF v_had_old THEN
    UPDATE public.material_part_prices
    SET price = v_price, effective_date = v_dated, source_line_id = v_line_id, updated_at = now()
    WHERE id = v_old.id;
  ELSE
    INSERT INTO public.material_part_prices (part_id, supply_house_id, price, effective_date, source_line_id)
    VALUES (v_part, v_house, v_price, v_dated, v_line_id);
  END IF;

  UPDATE public.supply_paper_lines
  SET part_id = v_part,
      matched_how = COALESCE(NULLIF(p->>'matched_how', ''), NULLIF(matched_how, ''), 'person'),
      unit_factor = v_factor,
      pricing_unit = v_pricing_unit,
      filed_at = clock_timestamp(),
      filed_by = auth.uid(),
      filed_price = v_price,
      replaced_price = CASE WHEN v_had_old THEN v_old.price END,
      replaced_effective_date = CASE WHEN v_had_old THEN v_old.effective_date END,
      replaced_source_line_id = CASE WHEN v_had_old THEN v_old.source_line_id END,
      held_why = ''
  WHERE id = v_line_id;

  -- The house's own number is kept on the part, so the next paper finds it with no press.
  IF v_code_key <> '' THEN
    INSERT INTO public.supply_part_codes AS c (supply_house_id, code, part_id, unit_factor, taught_from, taught_line_id)
    VALUES (v_house, v_code, v_part, v_factor, CASE WHEN v_came_by = 'sheet' THEN 'sheet' ELSE 'typed' END, v_line_id)
    ON CONFLICT (supply_house_id, code_key) DO UPDATE SET unit_factor = EXCLUDED.unit_factor
    WHERE c.part_id = EXCLUDED.part_id;
  END IF;

  RETURN jsonb_build_object('filed', true, 'line_id', v_line_id, 'paper_id', v_paper_id, 'price', v_price, 'dated_on', v_dated,
    'was', CASE WHEN v_had_old THEN jsonb_build_object('price', v_old.price, 'effective_date', v_old.effective_date) END);
END;
$$;


REVOKE ALL ON FUNCTION public.price_row_file(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.price_row_file(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.price_row_take_back(p_line_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_line public.supply_paper_lines%ROWTYPE;
  v_paper public.supply_papers%ROWTYPE;
  v_price public.material_part_prices%ROWTYPE;
  v_prior_line uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to take a price back.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.may_edit_parts_book() THEN
    RAISE EXCEPTION 'Only the people who edit the parts book take a price back.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot take a price back.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot take a price back.' USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'An archived account cannot take a price back.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_line FROM public.supply_paper_lines WHERE id = p_line_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That row is not on file.' USING ERRCODE = 'P0002';
  END IF;
  IF v_line.filed_at IS NULL THEN
    RETURN jsonb_build_object('restored', false, 'why', 'not_filed');
  END IF;
  SELECT * INTO v_paper FROM public.supply_papers WHERE id = v_line.paper_id;

  -- A row that filed no price (a kit row): only the number it taught goes, and the row is unfiled.
  IF v_line.filed_price IS NULL THEN
    DELETE FROM public.supply_part_codes WHERE taught_line_id = p_line_id;
    UPDATE public.supply_paper_lines SET filed_at = NULL, filed_by = NULL WHERE id = p_line_id;
    RETURN jsonb_build_object('restored', true, 'price', NULL, 'effective_date', NULL);
  END IF;

  -- The price is put back only while it is still this row's: a price somebody changed since is left alone.
  SELECT * INTO v_price FROM public.material_part_prices WHERE source_line_id = p_line_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('restored', false, 'why', 'changed_since');
  END IF;

  IF v_line.replaced_price IS NULL THEN
    DELETE FROM public.material_part_prices WHERE id = v_price.id;
  ELSE
    SELECT id INTO v_prior_line FROM public.supply_paper_lines WHERE id = v_line.replaced_source_line_id;
    UPDATE public.material_part_prices
    SET price = v_line.replaced_price, effective_date = v_line.replaced_effective_date, source_line_id = v_prior_line, updated_at = now()
    WHERE id = v_price.id;
  END IF;

  -- The number this row taught goes with it.
  DELETE FROM public.supply_part_codes WHERE taught_line_id = p_line_id;

  IF v_paper.came_by IN ('pasted', 'phone', 'counter', 'mail', 'website') THEN
    -- A one-off paper is its one row: it goes whole.
    DELETE FROM public.supply_papers WHERE id = v_paper.id;
  ELSE
    UPDATE public.supply_paper_lines
    SET filed_at = NULL, filed_by = NULL, filed_price = NULL, replaced_price = NULL, replaced_effective_date = NULL, replaced_source_line_id = NULL
    WHERE id = p_line_id;
  END IF;

  RETURN jsonb_build_object('restored', true, 'price', v_line.replaced_price, 'effective_date', v_line.replaced_effective_date);
END;
$$;


REVOKE ALL ON FUNCTION public.price_row_take_back(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.price_row_take_back(uuid) TO authenticated, service_role;

-- ---------- Take a whole sheet back ----------

CREATE OR REPLACE FUNCTION public.price_sheet_take_back(p_paper_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_line record;
  v_res jsonb;
  v_restored integer := 0;
  v_left integer := 0;
BEGIN
  PERFORM public.price_sheet_gate('take a price sheet back');
  IF NOT EXISTS (SELECT 1 FROM public.supply_papers WHERE id = p_paper_id AND came_by = 'sheet') THEN
    RAISE EXCEPTION 'That price sheet is not on file.' USING ERRCODE = 'P0002';
  END IF;
  -- Newest first, so a price two rows of the sheet touched unwinds in order.
  FOR v_line IN
    SELECT id FROM public.supply_paper_lines WHERE paper_id = p_paper_id AND filed_at IS NOT NULL ORDER BY filed_at DESC, line_no DESC
  LOOP
    v_res := public.price_row_take_back(v_line.id);
    IF (v_res->>'restored')::boolean THEN
      v_restored := v_restored + 1;
    ELSE
      v_left := v_left + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('restored', v_restored, 'left', v_left);
END;
$$;

COMMENT ON FUNCTION public.price_sheet_take_back(uuid) IS
  'Take back every filed row of a price sheet (punch list #308 PR 5), newest first, through price_row_take_back. Returns {restored, left}: left counts the rows whose price somebody changed since, which stay as they are.';

REVOKE ALL ON FUNCTION public.price_sheet_take_back(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.price_sheet_take_back(uuid) TO authenticated, service_role;
