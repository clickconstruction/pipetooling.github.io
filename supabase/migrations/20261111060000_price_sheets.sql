SET lock_timeout = '3s';

-- v2.6908 — A supply house's price sheet kept as rows under its fixtures (punch list #308 PR 4;
-- docs/migrations/20261111060000_price_sheets.md).
--
-- A quote prices a job fixture by fixture: a heading for the fixture, the rows that make it up, then a Subtotal EACH.
-- PR 3 filed one row at a time and kept nothing of a sheet. This migration keeps a whole sheet as soon as it is read,
-- so it can be left and opened again, by anyone who may file, on the card that was left.
--
--   * supply_paper_groups — one row per fixture on a sheet: its tag and words as printed, the EACH subtotal, the
--     bid's fixture row it goes with, the assembly it uses and the takeoff line it placed (those three are PR 6's),
--     and why it is held.
--   * supply_paper_lines.group_no ties a row to its fixture on the same paper; page_no says which page it is on.
--   * price_sheet_save(paper, groups, lines) keeps a sheet that was just read: a quote, came by sheet, with its
--     house when known, its bid, number, day, good-until day and the file's hash. Nothing is filed.
--   * price_sheet_set(paper_id, p) settles the house, number, day or bid. The house cannot change once a row is filed.
--   * price_sheet_line_hold(line_id, why) leaves a row out, or brings it back.
--   * price_sheet_line_part(line_id, part_id) keeps a person's pick of the part for a row, so the pick outlives the window.
--   * price_sheet_discard(paper_id) removes a sheet with nothing filed.
--   * The parts book roles read a quote's groups, as they read its lines.
--
-- Additive and idempotent. One table is new, so the four fence appliers run at the end.

CREATE TABLE IF NOT EXISTS public.supply_paper_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  paper_id uuid NOT NULL REFERENCES public.supply_papers(id) ON DELETE CASCADE,
  group_no integer NOT NULL,
  -- The fixture's tag and its words, as printed: SK-2 · DUMP SINK (BAR) (OFCI).
  tag text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  -- The printed Subtotal EACH, in dollars to four places; null when the paper prints none.
  each_price numeric(14, 4),
  -- Where the fixture landed on the bid (PR 6): the bid's row, the assembly used and the takeoff line placed.
  -- The bid's row is a record, not a reference: a foreign key here would let a count row that History's Undo
  -- removes empty this column unseen (supabase/tests/bid_changes case 21 refuses one).
  count_row_id uuid,
  template_id uuid REFERENCES public.material_templates(id) ON DELETE SET NULL,
  placed_line_id uuid REFERENCES public.bids_takeoff_rough_part_lines(id) ON DELETE SET NULL,
  placed_at timestamptz,
  placed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  held_why text NOT NULL DEFAULT '',
  UNIQUE (paper_id, group_no)
);

COMMENT ON TABLE public.supply_paper_groups IS
  'A price sheet''s fixtures (punch list #308 PR 4): one row per fixture heading on a supply house quote — the tag and words as printed, the EACH subtotal, the bid''s fixture row it goes with, the assembly used and the takeoff line it placed, and why it is held. The parts book roles read; price_sheet_save writes.';

ALTER TABLE public.supply_paper_lines
  ADD COLUMN IF NOT EXISTS group_no integer,
  -- The page of the file the row is printed on, so the window can say where to look.
  ADD COLUMN IF NOT EXISTS page_no integer;

ALTER TABLE public.supply_paper_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supply_paper_groups_read ON public.supply_paper_groups;
CREATE POLICY supply_paper_groups_read ON public.supply_paper_groups
  FOR SELECT TO authenticated USING (
    (SELECT public.may_edit_parts_book())
    AND EXISTS (SELECT 1 FROM public.supply_papers p WHERE p.id = supply_paper_groups.paper_id AND p.kind IN ('quote', 'bid'))
  );

REVOKE ALL ON TABLE public.supply_paper_groups FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.supply_paper_groups TO authenticated;
GRANT ALL ON TABLE public.supply_paper_groups TO service_role;

-- The gates every price sheet function passes, said once: signed in, a parts book role, and none of the three a
-- definer would slip past (a training account, a digital twin, an archived account).
CREATE OR REPLACE FUNCTION public.price_sheet_gate(p_act text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to %.', p_act USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.may_edit_parts_book() THEN
    RAISE EXCEPTION 'Only the people who edit the parts book %.', p_act USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot %.', p_act USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot %.', p_act USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'An archived account cannot %.', p_act USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.price_sheet_gate(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.price_sheet_gate(text) TO authenticated, service_role;

-- ---------- Keep a sheet that was just read ----------

CREATE OR REPLACE FUNCTION public.price_sheet_save(p_paper jsonb, p_groups jsonb, p_lines jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_paper_id uuid;
  v_house uuid := NULLIF(p_paper->>'supply_house_id', '')::uuid;
  v_bid uuid := NULLIF(p_paper->>'bid_id', '')::uuid;
  v_g jsonb;
  v_l jsonb;
  v_n integer := 0;
  v_kind text;
  v_unit text;
BEGIN
  PERFORM public.price_sheet_gate('keep a price sheet');
  IF p_paper IS NULL OR jsonb_typeof(p_paper) <> 'object' OR p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
    RAISE EXCEPTION 'The sheet and its rows are needed.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'That sheet has no rows to keep.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_lines) > 800 THEN
    RAISE EXCEPTION 'A sheet keeps 800 rows at most. Read it in two parts.' USING ERRCODE = '22023';
  END IF;
  IF v_house IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.supply_houses WHERE id = v_house) THEN
    RAISE EXCEPTION 'That supply house is not on file.' USING ERRCODE = 'P0002';
  END IF;
  IF v_bid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.bids WHERE id = v_bid) THEN
    RAISE EXCEPTION 'That bid is not on file.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.supply_papers (supply_house_id, kind, number, dated_on, valid_until, came_by, bid_id, file_sha256, created_by, read_by, read_at, page_from, page_to)
  VALUES (
    v_house, 'quote', btrim(COALESCE(p_paper->>'number', '')), NULLIF(p_paper->>'dated_on', '')::date, NULLIF(p_paper->>'valid_until', '')::date,
    'sheet', v_bid, NULLIF(p_paper->>'file_sha256', ''), auth.uid(), COALESCE(NULLIF(p_paper->>'read_by', ''), 'text'), clock_timestamp(),
    NULLIF(p_paper->>'page_from', '')::integer, NULLIF(p_paper->>'page_to', '')::integer
  )
  RETURNING id INTO v_paper_id;

  IF p_groups IS NOT NULL AND jsonb_typeof(p_groups) = 'array' THEN
    FOR v_g IN SELECT * FROM jsonb_array_elements(p_groups) LOOP
      INSERT INTO public.supply_paper_groups (paper_id, group_no, tag, label, each_price)
      VALUES (v_paper_id, (v_g->>'group_no')::integer, btrim(COALESCE(v_g->>'tag', '')), btrim(COALESCE(v_g->>'label', '')), NULLIF(v_g->>'each_price', '')::numeric);
    END LOOP;
  END IF;

  FOR v_l IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_n := v_n + 1;
    v_kind := COALESCE(NULLIF(v_l->>'line_kind', ''), 'part');
    v_unit := COALESCE(NULLIF(v_l->>'pricing_unit', ''), 'each');
    IF v_kind NOT IN ('part', 'charge', 'component') OR v_unit NOT IN ('each', 'per_hundred', 'per_thousand') THEN
      RAISE EXCEPTION 'Row % has a kind or a unit the sheet does not keep.', v_n USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.supply_paper_lines (paper_id, line_no, line_kind, house_code, mfr_number, description, unit, qty_ordered, unit_price, pricing_unit, group_no, group_tag, group_label, page_no)
    VALUES (
      v_paper_id, v_n, v_kind, btrim(COALESCE(v_l->>'house_code', '')), btrim(COALESCE(v_l->>'mfr_number', '')), btrim(COALESCE(v_l->>'description', '')),
      'each', NULLIF(v_l->>'qty', '')::numeric, NULLIF(v_l->>'unit_price', '')::numeric, v_unit,
      NULLIF(v_l->>'group_no', '')::integer, btrim(COALESCE(v_l->>'group_tag', '')), btrim(COALESCE(v_l->>'group_label', '')), NULLIF(v_l->>'page_no', '')::integer
    );
  END LOOP;

  RETURN v_paper_id;
END;
$$;

COMMENT ON FUNCTION public.price_sheet_save(jsonb, jsonb, jsonb) IS
  'Keep a price sheet that was just read (punch list #308 PR 4): one supply_papers row of kind quote, came by sheet, its fixtures as supply_paper_groups and its rows as supply_paper_lines in the order read. Nothing is filed. Returns the paper id.';

REVOKE ALL ON FUNCTION public.price_sheet_save(jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.price_sheet_save(jsonb, jsonb, jsonb) TO authenticated, service_role;

-- ---------- Settle a sheet's house, number, day or bid ----------

CREATE OR REPLACE FUNCTION public.price_sheet_set(p_paper_id uuid, p jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_paper public.supply_papers%ROWTYPE;
  v_house uuid;
BEGIN
  PERFORM public.price_sheet_gate('change a price sheet');
  SELECT * INTO v_paper FROM public.supply_papers WHERE id = p_paper_id AND came_by = 'sheet' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That price sheet is not on file.' USING ERRCODE = 'P0002';
  END IF;
  IF p ? 'supply_house_id' THEN
    v_house := NULLIF(p->>'supply_house_id', '')::uuid;
    IF v_house IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.supply_houses WHERE id = v_house) THEN
      RAISE EXCEPTION 'That supply house is not on file.' USING ERRCODE = 'P0002';
    END IF;
    IF v_house IS DISTINCT FROM v_paper.supply_house_id AND EXISTS (SELECT 1 FROM public.supply_paper_lines WHERE paper_id = p_paper_id AND filed_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Rows of this sheet are filed under its house. Take them back before the house changes.' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.supply_papers SET supply_house_id = v_house WHERE id = p_paper_id;
  END IF;
  UPDATE public.supply_papers
  SET number = CASE WHEN p ? 'number' THEN btrim(COALESCE(p->>'number', '')) ELSE number END,
      dated_on = CASE WHEN p ? 'dated_on' THEN NULLIF(p->>'dated_on', '')::date ELSE dated_on END,
      valid_until = CASE WHEN p ? 'valid_until' THEN NULLIF(p->>'valid_until', '')::date ELSE valid_until END,
      bid_id = CASE WHEN p ? 'bid_id' THEN NULLIF(p->>'bid_id', '')::uuid ELSE bid_id END
  WHERE id = p_paper_id;
END;
$$;

REVOKE ALL ON FUNCTION public.price_sheet_set(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.price_sheet_set(uuid, jsonb) TO authenticated, service_role;

-- ---------- Leave a row out, or bring it back ----------

CREATE OR REPLACE FUNCTION public.price_sheet_line_hold(p_line_id uuid, p_why text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.price_sheet_gate('change a price sheet');
  UPDATE public.supply_paper_lines l
  SET held_why = btrim(COALESCE(p_why, ''))
  WHERE l.id = p_line_id
    AND l.filed_at IS NULL
    AND EXISTS (SELECT 1 FROM public.supply_papers p WHERE p.id = l.paper_id AND p.came_by = 'sheet');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That row is filed, or is not on a price sheet.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.price_sheet_line_hold(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.price_sheet_line_hold(uuid, text) TO authenticated, service_role;

-- ---------- Say which part a row is, before it is filed ----------

CREATE OR REPLACE FUNCTION public.price_sheet_line_part(p_line_id uuid, p_part_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.price_sheet_gate('change a price sheet');
  IF p_part_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.material_parts WHERE id = p_part_id) THEN
    RAISE EXCEPTION 'That part is not in the book.' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.supply_paper_lines l
  SET part_id = p_part_id, matched_how = CASE WHEN p_part_id IS NULL THEN '' ELSE 'person' END
  WHERE l.id = p_line_id
    AND l.filed_at IS NULL
    AND EXISTS (SELECT 1 FROM public.supply_papers p WHERE p.id = l.paper_id AND p.came_by = 'sheet');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That row is filed, or is not on a price sheet.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.price_sheet_line_part(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.price_sheet_line_part(uuid, uuid) TO authenticated, service_role;

-- ---------- Remove a sheet with nothing filed ----------

CREATE OR REPLACE FUNCTION public.price_sheet_discard(p_paper_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.price_sheet_gate('remove a price sheet');
  IF NOT EXISTS (SELECT 1 FROM public.supply_papers WHERE id = p_paper_id AND came_by = 'sheet') THEN
    RAISE EXCEPTION 'That price sheet is not on file.' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM public.supply_paper_lines WHERE paper_id = p_paper_id AND filed_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.supply_paper_groups WHERE paper_id = p_paper_id AND placed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Rows of this sheet are filed. Take them back first.' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.supply_papers WHERE id = p_paper_id;
END;
$$;

REVOKE ALL ON FUNCTION public.price_sheet_discard(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.price_sheet_discard(uuid) TO authenticated, service_role;

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md → DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
