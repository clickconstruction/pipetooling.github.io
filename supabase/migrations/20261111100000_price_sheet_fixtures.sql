SET lock_timeout = '3s';

-- v2.6916 — A price sheet's fixtures placed on the takeoff (punch list #308 PR 6;
-- docs/migrations/20261111100000_price_sheet_fixtures.md).
--
-- A quote prices a fixture as a lot: its parts, then one Subtotal EACH. The estimator kept that by hand as an assembly
-- with a bundle price, and one bundle line on the bid's fixture. PR 6 does the same from the sheet. The assembly, its
-- bundle price and the takeoff line are written by the client under the caller's own row level security, as the Add
-- Assembly window writes them today; this migration only lets the sheet remember what it placed, so it can be taken
-- off again.
--
--   * supply_paper_groups gains the bid's fixture rows the fixture went onto, the takeoff lines it placed, the bundle
--     price it set, the bundle price and day it replaced, and whether it made the assembly. Arrays, since one heading
--     may name two tags (WC-1 & WC-2).
--   * price_sheet_group_place(group_id, p) records a placement; price_sheet_group_unplace(group_id) clears it.
--   * price_sheet_take_back(paper_id) now refuses while a fixture of the sheet is still placed.
--
-- Additive and idempotent. No table is new, so no fence applier runs.

ALTER TABLE public.supply_paper_groups
  ADD COLUMN IF NOT EXISTS count_row_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS placed_line_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bundle_price numeric(10, 2),
  ADD COLUMN IF NOT EXISTS replaced_bundle_price numeric(10, 2),
  ADD COLUMN IF NOT EXISTS replaced_bundle_effective_date date,
  ADD COLUMN IF NOT EXISTS made_template boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.price_sheet_group_place(p_group_id uuid, p jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows uuid[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'count_row_ids', '[]'::jsonb))::uuid);
  v_lines uuid[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'placed_line_ids', '[]'::jsonb))::uuid);
  v_template uuid := NULLIF(p->>'template_id', '')::uuid;
BEGIN
  PERFORM public.price_sheet_gate('place a fixture');
  IF v_template IS NULL OR NOT EXISTS (SELECT 1 FROM public.material_templates WHERE id = v_template) THEN
    RAISE EXCEPTION 'The assembly the fixture uses is needed.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(array_length(v_lines, 1), 0) = 0 THEN
    RAISE EXCEPTION 'The takeoff line the fixture placed is needed.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.supply_paper_groups g
  SET template_id = v_template,
      count_row_ids = v_rows,
      placed_line_ids = v_lines,
      count_row_id = v_rows[1],
      placed_line_id = v_lines[1],
      bundle_price = NULLIF(p->>'bundle_price', '')::numeric,
      replaced_bundle_price = NULLIF(p->>'replaced_bundle_price', '')::numeric,
      replaced_bundle_effective_date = NULLIF(p->>'replaced_bundle_effective_date', '')::date,
      made_template = COALESCE((p->>'made_template')::boolean, false),
      placed_at = clock_timestamp(),
      placed_by = auth.uid(),
      held_why = ''
  WHERE g.id = p_group_id
    AND g.placed_at IS NULL
    AND EXISTS (SELECT 1 FROM public.supply_papers s WHERE s.id = g.paper_id AND s.came_by = 'sheet');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That fixture is already placed, or is not on a price sheet.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.price_sheet_group_place(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.price_sheet_group_place(uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.price_sheet_group_unplace(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.price_sheet_gate('take a fixture off');
  UPDATE public.supply_paper_groups
  SET count_row_ids = '{}', placed_line_ids = '{}', count_row_id = NULL, placed_line_id = NULL, bundle_price = NULL,
      replaced_bundle_price = NULL, replaced_bundle_effective_date = NULL, made_template = false, placed_at = NULL, placed_by = NULL
  WHERE id = p_group_id AND placed_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That fixture is not placed.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.price_sheet_group_unplace(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.price_sheet_group_unplace(uuid) TO authenticated, service_role;

-- The body 20261111080000_price_sheet_filing.sql holds, plus the refusal while a fixture is placed.
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
  -- A fixture still on a takeoff rests on these rows: it comes off first, so no bundle line is left with no source.
  IF EXISTS (SELECT 1 FROM public.supply_paper_groups WHERE paper_id = p_paper_id AND placed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Fixtures of this sheet are on a takeoff. Take them off first.' USING ERRCODE = 'P0001';
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


REVOKE ALL ON FUNCTION public.price_sheet_take_back(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.price_sheet_take_back(uuid) TO authenticated, service_role;
