SET lock_timeout = '3s';

-- v2.6903 — One price filed from a supply house's paper, and taken back (punch list #308 PR 3;
-- docs/migrations/20261111040000_price_rows.md).
--
-- A price in the parts book said nothing of where it came from, and a paper's row could not put its price in the
-- book. This migration joins the two. A row of a paper (a quote, a pasted line, a price by phone) is filed onto a part
-- under a supply house by one function, which keeps what the price replaced so the same row can be taken back.
--
--   * supply_papers gains the bid the paper is for, the day a quote is good until, the file's hash (a sheet read
--     twice is known by it), how the paper came (a sheet, a pasted row, a call, the counter, a mail, a website; empty
--     for a bill on file) and who made it.
--   * supply_paper_lines gains the fixture the row sits under on a quote, how many book units its price covers, when
--     it was filed, by whom and at what book price, the price and day it replaced, and why it is held.
--   * material_part_prices gains source_line_id: the paper row the price came from. The history trigger writes that
--     source into its note, so a change says where it came from.
--   * A price changed by hand loses its source (a trigger), so a typed number never names a paper.
--   * price_row_file(p jsonb) files one row: it refuses an older paper over a newer price, and a move past a quarter,
--     unless the caller says a person looked; it keeps the house's own number on the part; it returns what it did.
--   * price_row_take_back(line_id) puts the price back as it was, unless someone changed it since.
--   * The parts book roles read quote papers and their lines; bills stay with the office.
--
-- Additive and idempotent. No table is new, so no fence applier runs; both functions say the definer gates themselves.

-- ---------- Where a paper came from ----------

ALTER TABLE public.supply_papers
  ADD COLUMN IF NOT EXISTS bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valid_until date,
  ADD COLUMN IF NOT EXISTS file_sha256 text,
  ADD COLUMN IF NOT EXISTS came_by text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supply_papers_came_by' AND conrelid = 'public.supply_papers'::regclass) THEN
    ALTER TABLE public.supply_papers
      ADD CONSTRAINT supply_papers_came_by CHECK (came_by IN ('', 'sheet', 'pasted', 'phone', 'counter', 'mail', 'website'));
  END IF;
END $$;

COMMENT ON COLUMN public.supply_papers.came_by IS
  'How a price paper came (punch list #308): sheet (a quote read whole), pasted (a row pasted from a quote or a mail), phone, counter, mail, website. Empty for a bill on file.';

CREATE INDEX IF NOT EXISTS supply_papers_bid_idx ON public.supply_papers (bid_id) WHERE bid_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS supply_papers_sha_idx ON public.supply_papers (file_sha256) WHERE file_sha256 IS NOT NULL;

-- ---------- What a row did to the book ----------

ALTER TABLE public.supply_paper_lines
  ADD COLUMN IF NOT EXISTS group_tag text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS group_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS unit_factor numeric(14, 6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS filed_at timestamptz,
  ADD COLUMN IF NOT EXISTS filed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS filed_price numeric(10, 2),
  ADD COLUMN IF NOT EXISTS replaced_price numeric(10, 2),
  ADD COLUMN IF NOT EXISTS replaced_effective_date date,
  ADD COLUMN IF NOT EXISTS replaced_source_line_id uuid,
  ADD COLUMN IF NOT EXISTS held_why text NOT NULL DEFAULT '';

ALTER TABLE public.material_part_prices
  ADD COLUMN IF NOT EXISTS source_line_id uuid REFERENCES public.supply_paper_lines(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.material_part_prices.source_line_id IS
  'The supply paper row this price came from (punch list #308): a quote''s row, a pasted row, a price by phone. Null for a price typed with no source.';

CREATE INDEX IF NOT EXISTS material_part_prices_source_line_idx ON public.material_part_prices (source_line_id) WHERE source_line_id IS NOT NULL;

-- A price changed by hand is no longer the paper's price: its source is cleared, so the Prices window does not name
-- a paper for a number a person typed, and taking the paper back leaves the typed price alone.
CREATE OR REPLACE FUNCTION public.material_part_prices_hand_edit_clears_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.price IS DISTINCT FROM OLD.price OR NEW.effective_date IS DISTINCT FROM OLD.effective_date)
     AND NEW.source_line_id IS NOT DISTINCT FROM OLD.source_line_id THEN
    NEW.source_line_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS material_part_prices_hand_edit_clears_source ON public.material_part_prices;
CREATE TRIGGER material_part_prices_hand_edit_clears_source
  BEFORE UPDATE ON public.material_part_prices
  FOR EACH ROW EXECUTE FUNCTION public.material_part_prices_hand_edit_clears_source();

-- ---------- The parts book roles read price papers ----------

DROP POLICY IF EXISTS supply_papers_price_sheet_read ON public.supply_papers;
CREATE POLICY supply_papers_price_sheet_read ON public.supply_papers
  FOR SELECT TO authenticated USING (kind IN ('quote', 'bid') AND (SELECT public.may_edit_parts_book()));

DROP POLICY IF EXISTS supply_paper_lines_price_sheet_read ON public.supply_paper_lines;
CREATE POLICY supply_paper_lines_price_sheet_read ON public.supply_paper_lines
  FOR SELECT TO authenticated USING (
    (SELECT public.may_edit_parts_book())
    AND EXISTS (SELECT 1 FROM public.supply_papers p WHERE p.id = supply_paper_lines.paper_id AND p.kind IN ('quote', 'bid'))
  );

-- ---------- Where a price came from, in words ----------

CREATE OR REPLACE FUNCTION public.price_source_words(p_line_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE p.came_by
    WHEN 'phone' THEN 'By phone'
    WHEN 'counter' THEN 'At the counter'
    WHEN 'mail' THEN 'From a mail'
    WHEN 'website' THEN 'From its website'
    WHEN 'pasted' THEN 'Pasted from a quote' || CASE WHEN p.number <> '' THEN ' ' || p.number ELSE '' END
    WHEN 'sheet' THEN 'From quote' || CASE WHEN p.number <> '' THEN ' ' || p.number ELSE '' END
    ELSE 'From ' || CASE p.kind WHEN 'invoice' THEN 'bill' WHEN 'credit' THEN 'credit' ELSE p.kind END || CASE WHEN p.number <> '' THEN ' ' || p.number ELSE '' END
  END
  FROM public.supply_paper_lines l
  JOIN public.supply_papers p ON p.id = l.paper_id
  WHERE l.id = p_line_id;
$$;

REVOKE ALL ON FUNCTION public.price_source_words(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.price_source_words(uuid) TO service_role;

-- The trigger's body as the baseline holds it, plus the note. The trigger itself is untouched.
CREATE OR REPLACE FUNCTION public.track_price_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  change_percent NUMERIC(10, 2);
  old_price_val NUMERIC(10, 2);
  v_note text;
BEGIN
  -- Determine old price based on trigger type
  IF TG_OP = 'INSERT' THEN
    old_price_val := NULL;
    change_percent := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    old_price_val := OLD.price;
    -- Calculate percentage change if old price exists and is greater than 0
    IF old_price_val IS NOT NULL AND old_price_val > 0 THEN
      change_percent := ((NEW.price - old_price_val) / old_price_val) * 100;
    ELSE
      change_percent := NULL;
    END IF;
  END IF;

  -- Where the price came from, when a paper row filed it (punch list #308).
  IF NEW.source_line_id IS NOT NULL THEN
    v_note := public.price_source_words(NEW.source_line_id);
  END IF;

  -- Insert history record
  INSERT INTO public.material_part_price_history (
    part_id,
    supply_house_id,
    old_price,
    new_price,
    price_change_percent,
    effective_date,
    changed_by,
    notes
  ) VALUES (
    NEW.part_id,
    NEW.supply_house_id,
    old_price_val,
    NEW.price,
    change_percent,
    NEW.effective_date,
    auth.uid(),
    v_note
  );

  RETURN NEW;
END;
$$;

-- ---------- File one row ----------

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
  IF v_printed IS NULL OR v_printed <= 0 THEN
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
  v_price := round(v_printed / v_factor, 2);
  IF v_price <= 0 THEN
    RAISE EXCEPTION 'That price comes to less than a cent each.' USING ERRCODE = '22023';
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

COMMENT ON FUNCTION public.price_row_file(jsonb) IS
  'File one supply paper row onto a part under a supply house (punch list #308): a quote''s row, a pasted row or a price by phone. Refuses an older paper over a newer price and a move past a quarter unless allow_older / allow_big_move say a person looked; keeps the house''s number on the part; remembers what the price replaced. Returns {filed, why, line_id, paper_id, price, was}.';

REVOKE ALL ON FUNCTION public.price_row_file(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.price_row_file(jsonb) TO authenticated, service_role;

-- ---------- Take one row back ----------

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

COMMENT ON FUNCTION public.price_row_take_back(uuid) IS
  'Take back one filed supply paper row (punch list #308): the part''s price at that house returns to what it was, or goes if there was none, and the number the row taught goes with it. A price changed since is left alone ({restored:false, why:changed_since}).';

REVOKE ALL ON FUNCTION public.price_row_take_back(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.price_row_take_back(uuid) TO authenticated, service_role;
