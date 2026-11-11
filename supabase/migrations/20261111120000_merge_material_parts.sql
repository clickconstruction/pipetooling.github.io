SET lock_timeout = '3s';

-- v2.6921 — Two copies of one part merged into one (punch list #308 PR 8;
-- docs/migrations/20261111120000_merge_material_parts.md).
--
-- The parts book holds about forty parts twice, each copy named a little differently. The Duplicates page could only
-- delete a copy, and a delete is refused while a price, an assembly or a takeoff line points at it, which is exactly
-- when the copy matters. This migration adds the merge: everything that points at one copy is moved to the other, and
-- the copy goes.
--
--   * merge_material_parts(keep, drop) moves, in one transaction: the prices (where both copies carry one from the
--     same house, the newer dated one stays and the takeoff lines that named the other are pointed at it), the price
--     history, the assembly items (summed where an assembly held both), the takeoff lines, the stage splits, both
--     tallies, the purchase order lines, the submittal parts, the on-site movements, the paper lines and the house
--     numbers. The copy's name is kept in the surviving part's notes, so a search still finds it, and a maker, a
--     link or a part type the survivor lacks is taken from the copy. Then the copy is deleted.
--   * material_part_distinct_pairs remembers two parts a person said are not the same, so they are not offered again.
--
-- A takeoff line in a version somebody else locked refuses the merge with the lock's own words: a lock is a lock.
-- One table is new, so the four fence appliers run at the end.

CREATE TABLE IF NOT EXISTS public.material_part_distinct_pairs (
  low_part_id uuid NOT NULL REFERENCES public.material_parts(id) ON DELETE CASCADE,
  high_part_id uuid NOT NULL REFERENCES public.material_parts(id) ON DELETE CASCADE,
  said_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  said_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (low_part_id, high_part_id),
  CONSTRAINT material_part_distinct_pairs_ordered CHECK (low_part_id < high_part_id)
);

COMMENT ON TABLE public.material_part_distinct_pairs IS
  'Parts a person said are not the same (punch list #308 PR 8): two parts that share a model number or a name and differ, so the Duplicates page does not offer them again. The lower id first. The parts book roles read and write.';

ALTER TABLE public.material_part_distinct_pairs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS material_part_distinct_pairs_read ON public.material_part_distinct_pairs;
CREATE POLICY material_part_distinct_pairs_read ON public.material_part_distinct_pairs
  FOR SELECT TO authenticated USING ((SELECT public.may_edit_parts_book()));
DROP POLICY IF EXISTS material_part_distinct_pairs_insert ON public.material_part_distinct_pairs;
CREATE POLICY material_part_distinct_pairs_insert ON public.material_part_distinct_pairs
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.may_edit_parts_book()));
DROP POLICY IF EXISTS material_part_distinct_pairs_delete ON public.material_part_distinct_pairs;
CREATE POLICY material_part_distinct_pairs_delete ON public.material_part_distinct_pairs
  FOR DELETE TO authenticated USING ((SELECT public.may_edit_parts_book()));

REVOKE ALL ON TABLE public.material_part_distinct_pairs FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.material_part_distinct_pairs TO authenticated;
GRANT ALL ON TABLE public.material_part_distinct_pairs TO service_role;

CREATE OR REPLACE FUNCTION public.merge_material_parts(p_keep uuid, p_drop uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_keep public.material_parts%ROWTYPE;
  v_drop public.material_parts%ROWTYPE;
  v_p public.material_part_prices%ROWTYPE;
  v_k public.material_part_prices%ROWTYPE;
  v_i public.material_template_items%ROWTYPE;
  v_prices_moved integer := 0;
  v_prices_merged integer := 0;
  v_assemblies integer := 0;
  v_takeoff integer := 0;
  v_po integer := 0;
  v_numbers integer := 0;
  v_n integer;
BEGIN
  PERFORM public.price_sheet_gate('merge two parts');
  IF p_keep IS NULL OR p_drop IS NULL OR p_keep = p_drop THEN
    RAISE EXCEPTION 'Two different parts are needed.' USING ERRCODE = '22023';
  END IF;
  -- Both rows locked in id order, so two merges never wait on each other.
  PERFORM 1 FROM public.material_parts WHERE id IN (p_keep, p_drop) ORDER BY id FOR UPDATE;
  SELECT * INTO v_keep FROM public.material_parts WHERE id = p_keep;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The part that stays is not in the book.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_drop FROM public.material_parts WHERE id = p_drop;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The other part is not in the book any more.' USING ERRCODE = 'P0002';
  END IF;
  IF v_keep.service_type_id <> v_drop.service_type_id THEN
    RAISE EXCEPTION 'The two parts are in different service types, so they are not merged.' USING ERRCODE = 'P0001';
  END IF;
  IF v_keep.is_robot OR v_drop.is_robot THEN
    RAISE EXCEPTION 'A robot''s part is not merged.' USING ERRCODE = 'P0001';
  END IF;

  -- The prices. Where both copies carry one from the same house, the newer dated price stays.
  FOR v_p IN SELECT * FROM public.material_part_prices WHERE part_id = p_drop LOOP
    SELECT * INTO v_k FROM public.material_part_prices WHERE part_id = p_keep AND supply_house_id = v_p.supply_house_id;
    IF NOT FOUND THEN
      UPDATE public.material_part_prices SET part_id = p_keep WHERE id = v_p.id;
      v_prices_moved := v_prices_moved + 1;
    ELSE
      UPDATE public.bids_takeoff_rough_part_lines SET source_material_part_price_id = v_k.id WHERE source_material_part_price_id = v_p.id;
      IF v_p.effective_date IS NOT NULL AND (v_k.effective_date IS NULL OR v_p.effective_date > v_k.effective_date) THEN
        UPDATE public.material_part_prices
        SET price = v_p.price, effective_date = v_p.effective_date, source_line_id = v_p.source_line_id, updated_at = now()
        WHERE id = v_k.id;
      END IF;
      DELETE FROM public.material_part_prices WHERE id = v_p.id;
      v_prices_merged := v_prices_merged + 1;
    END IF;
  END LOOP;
  UPDATE public.material_part_price_history SET part_id = p_keep WHERE part_id = p_drop;

  -- The assemblies. One part appears once in an assembly: where it held both copies, their quantities are summed.
  FOR v_i IN SELECT * FROM public.material_template_items WHERE part_id = p_drop AND item_type = 'part' LOOP
    IF EXISTS (SELECT 1 FROM public.material_template_items WHERE template_id = v_i.template_id AND part_id = p_keep AND item_type = 'part') THEN
      UPDATE public.material_template_items SET quantity = quantity + v_i.quantity
      WHERE template_id = v_i.template_id AND part_id = p_keep AND item_type = 'part';
      DELETE FROM public.material_template_items WHERE id = v_i.id;
    ELSE
      UPDATE public.material_template_items SET part_id = p_keep WHERE id = v_i.id;
    END IF;
    v_assemblies := v_assemblies + 1;
  END LOOP;

  -- A stage split is one per scope: the copy's goes where the survivor already has one for the same line.
  DELETE FROM public.bid_takeoff_stage_splits d
  WHERE d.part_id = p_drop
    AND EXISTS (SELECT 1 FROM public.bid_takeoff_stage_splits k
                WHERE k.part_id = p_keep AND k.count_row_id = d.count_row_id AND k.line_id IS NOT DISTINCT FROM d.line_id);
  UPDATE public.bid_takeoff_stage_splits SET part_id = p_keep WHERE part_id = p_drop;

  UPDATE public.bids_takeoff_rough_part_lines SET part_id = p_keep WHERE part_id = p_drop;
  GET DIAGNOSTICS v_takeoff = ROW_COUNT;
  UPDATE public.purchase_order_items SET part_id = p_keep WHERE part_id = p_drop;
  GET DIAGNOSTICS v_po = ROW_COUNT;
  UPDATE public.jobs_tally_parts SET part_id = p_keep WHERE part_id = p_drop;
  UPDATE public.bids_tally_parts SET part_id = p_keep WHERE part_id = p_drop;
  UPDATE public.bid_submittal_item_parts SET part_id = p_keep WHERE part_id = p_drop;
  UPDATE public.job_material_movements SET part_id = p_keep WHERE part_id = p_drop;
  UPDATE public.supply_paper_lines SET part_id = p_keep WHERE part_id = p_drop;
  UPDATE public.supply_part_codes SET part_id = p_keep WHERE part_id = p_drop;
  GET DIAGNOSTICS v_numbers = ROW_COUNT;

  -- The copy's name stays findable, and what the survivor lacks is taken from the copy.
  UPDATE public.material_parts
  SET notes = CASE
        WHEN position(lower(v_drop.name) IN lower(COALESCE(notes, '') || ' ' || name)) > 0 THEN notes
        ELSE concat_ws(E'\n', NULLIF(btrim(COALESCE(notes, '')), ''), 'Also known as: ' || v_drop.name)
      END,
      manufacturer = COALESCE(NULLIF(btrim(COALESCE(manufacturer, '')), ''), v_drop.manufacturer),
      link = COALESCE(NULLIF(btrim(COALESCE(link, '')), ''), v_drop.link),
      part_type_id = COALESCE(part_type_id, v_drop.part_type_id),
      order_increment = COALESCE(order_increment, v_drop.order_increment),
      order_increment_unit = COALESCE(order_increment_unit, CASE WHEN order_increment IS NULL THEN v_drop.order_increment_unit END)
  WHERE id = p_keep;

  DELETE FROM public.material_parts WHERE id = p_drop;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'The other part could not be removed, so nothing was merged.' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object('prices_moved', v_prices_moved, 'prices_merged', v_prices_merged, 'assemblies', v_assemblies,
    'takeoff_lines', v_takeoff, 'purchase_order_lines', v_po, 'house_numbers', v_numbers, 'also_known_as', v_drop.name);
END;
$$;

COMMENT ON FUNCTION public.merge_material_parts(uuid, uuid) IS
  'Merge two copies of one part (punch list #308 PR 8): everything that points at p_drop is moved to p_keep in one transaction — prices (the newer dated one stays where both have one from a house), history, assembly items (summed), takeoff lines, stage splits, tallies, purchase order lines, submittal parts, on-site movements, paper lines and house numbers — the copy''s name is kept in the survivor''s notes, and the copy is deleted. Returns the counts.';

REVOKE ALL ON FUNCTION public.merge_material_parts(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_material_parts(uuid, uuid) TO authenticated, service_role;

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md → DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
