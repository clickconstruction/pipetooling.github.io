-- Punch list #128, PR 2: a count row's kind, tags and split.
--
-- The Pricing Workbench shows each row's price split into material, sales tax and labor, and
-- lets the estimator set the row's kind (fixture, pipe, fitting, equipment, allowance — the app
-- guesses it from the name until set), put words of their own on the row (tags, never on paper),
-- type the row's material as sold, give the row a markup of its own and mark it tax-free. The
-- spike kept these in the browser; they belong on the row, per bid version like the row itself,
-- and a copied version carries them (clone_count_rows_to_bid_version redefined below, its body
-- as 20261002130000 left it with the five columns added to the copy). Idempotent; no table is
-- created.
SET lock_timeout = '3s';

ALTER TABLE public.bids_count_rows
  ADD COLUMN IF NOT EXISTS kind text NULL,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS split_material_cents bigint NULL,
  ADD COLUMN IF NOT EXISTS split_markup_pct numeric(7,3) NULL,
  ADD COLUMN IF NOT EXISTS split_taxable boolean NULL;

ALTER TABLE public.bids_count_rows DROP CONSTRAINT IF EXISTS bids_count_rows_kind_known;
ALTER TABLE public.bids_count_rows
  ADD CONSTRAINT bids_count_rows_kind_known CHECK (kind IS NULL OR kind IN ('fixture', 'pipe', 'fitting', 'equipment', 'allowance'));
ALTER TABLE public.bids_count_rows DROP CONSTRAINT IF EXISTS bids_count_rows_split_material_cents_nonneg;
ALTER TABLE public.bids_count_rows
  ADD CONSTRAINT bids_count_rows_split_material_cents_nonneg CHECK (split_material_cents IS NULL OR split_material_cents >= 0);
ALTER TABLE public.bids_count_rows DROP CONSTRAINT IF EXISTS bids_count_rows_split_markup_pct_range;
ALTER TABLE public.bids_count_rows
  ADD CONSTRAINT bids_count_rows_split_markup_pct_range CHECK (split_markup_pct IS NULL OR (split_markup_pct >= 0 AND split_markup_pct <= 1000));

COMMENT ON COLUMN public.bids_count_rows.kind IS
  'The row''s kind on the Pricing Workbench: fixture, pipe, fitting, equipment or allowance. NULL = the app''s guess from the name (compositionKind).';
COMMENT ON COLUMN public.bids_count_rows.tags IS
  'The estimator''s own words on the row (lowercase, 40 letters each), added up on the Tag breakdown card; never on paper.';
COMMENT ON COLUMN public.bids_count_rows.split_material_cents IS
  'The row''s material as sold, typed for the whole row, cents. NULL = the takeoff material × (1 + the markup).';
COMMENT ON COLUMN public.bids_count_rows.split_markup_pct IS
  'The row''s own material markup, percent (60 = +60%). NULL = the bid''s number (bids.sov_material_factor, else the company factor).';
COMMENT ON COLUMN public.bids_count_rows.split_taxable IS
  'Whether the row''s material carries sales tax. NULL = taxed when the row has material.';

CREATE OR REPLACE FUNCTION public.clone_count_rows_to_bid_version(
  p_bid_id uuid,
  p_source_bid_version_id uuid,   -- NULL = the unsplit rows
  p_target_bid_version_id uuid
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_map jsonb := '{}'::jsonb;
  r record;
  v_new_id uuid;
  v_n integer := 0;
BEGIN
  IF p_bid_id IS NULL OR p_target_bid_version_id IS NULL THEN
    RAISE EXCEPTION 'clone_count_rows_to_bid_version: bid and target version required';
  END IF;

  FOR r IN
    SELECT * FROM public.bids_count_rows
     WHERE bid_id = p_bid_id AND bid_version_id IS NOT DISTINCT FROM p_source_bid_version_id
     ORDER BY sequence_order, id
  LOOP
    INSERT INTO public.bids_count_rows (bid_id, bid_version_id, fixture, count, group_tag, page, sequence_order, unit, kind, tags, split_material_cents, split_markup_pct, split_taxable)
    VALUES (p_bid_id, p_target_bid_version_id, r.fixture, r.count, r.group_tag, r.page, r.sequence_order, r.unit, r.kind, r.tags, r.split_material_cents, r.split_markup_pct, r.split_taxable)
    RETURNING id INTO v_new_id;
    v_map := v_map || jsonb_build_object(r.id::text, v_new_id::text);
    v_n := v_n + 1;
  END LOOP;

  IF v_n = 0 THEN RETURN 0; END IF;

  -- Version-scoped children: takeoff mappings + rough-in lines of the TARGET version.
  UPDATE public.bids_takeoff_template_mappings m
     SET count_row_id = (v_map->>m.count_row_id::text)::uuid
   WHERE m.bid_id = p_bid_id AND m.bid_version_id = p_target_bid_version_id
     AND v_map ? m.count_row_id::text;
  UPDATE public.bids_takeoff_rough_part_lines l
     SET count_row_id = (v_map->>l.count_row_id::text)::uuid
   WHERE l.bid_id = p_bid_id AND l.bid_version_id = p_target_bid_version_id
     AND v_map ? l.count_row_id::text;

  -- Pricing-scoped children: the TARGET version's price scenarios' custom prices / hides / assignments.
  UPDATE public.bid_count_row_custom_prices c
     SET count_row_id = (v_map->>c.count_row_id::text)::uuid
   WHERE c.bid_id = p_bid_id
     AND c.price_book_version_id IN (SELECT id FROM public.price_book_versions WHERE bid_id = p_bid_id AND bid_version_id = p_target_bid_version_id)
     AND v_map ? c.count_row_id::text;
  UPDATE public.bid_count_row_submission_hides h
     SET count_row_id = (v_map->>h.count_row_id::text)::uuid
   WHERE h.bid_id = p_bid_id
     AND h.price_book_version_id IN (SELECT id FROM public.price_book_versions WHERE bid_id = p_bid_id AND bid_version_id = p_target_bid_version_id)
     AND v_map ? h.count_row_id::text;
  UPDATE public.bid_pricing_assignments a
     SET count_row_id = (v_map->>a.count_row_id::text)::uuid
   WHERE a.bid_id = p_bid_id
     AND a.price_book_version_id IN (SELECT id FROM public.price_book_versions WHERE bid_id = p_bid_id AND bid_version_id = p_target_bid_version_id)
     AND v_map ? a.count_row_id::text;

  -- Stage boxes on a fixture (v2.4388): each clone carries its source row's box. A box on a line,
  -- or on a part inside a bundle line, follows its line in create_bid_version, which holds the
  -- line map.
  INSERT INTO public.bid_takeoff_stage_splits (bid_id, count_row_id, line_id, part_id, rough_in, top_out, trim_set, source)
  SELECT p_bid_id, m.value::uuid, NULL, NULL, s.rough_in, s.top_out, s.trim_set, s.source
    FROM jsonb_each_text(v_map) m
    JOIN public.bid_takeoff_stage_splits s ON s.count_row_id = m.key::uuid AND s.line_id IS NULL;

  -- Quoted fixture costs (v2.4413): each clone carries its source row's cost. A package (lot) gets
  -- an id of its own in the copy, because the app reverts a package by lot_group_id: with a shared
  -- id, reverting it in one version would take it from the other. The table's own policy lets
  -- fewer roles write than may make a version (no primary, no superintendent), so the copy is made
  -- only for a caller who may write a quoted cost; for the others the version is made without.
  IF public.can_write_bid_custom_costs() THEN
    WITH lots AS MATERIALIZED (
      SELECT d.lot_group_id AS old_id, gen_random_uuid() AS new_id
        FROM (SELECT DISTINCT c.lot_group_id
                FROM jsonb_each_text(v_map) m
                JOIN public.bid_count_row_custom_costs c ON c.count_row_id = m.key::uuid
               WHERE c.lot_group_id IS NOT NULL) d
    )
    INSERT INTO public.bid_count_row_custom_costs (bid_id, count_row_id, unit_materials_cents, source, quote_line_id, lot_group_id, house_name, applied_by, applied_at)
    SELECT p_bid_id, m.value::uuid, c.unit_materials_cents, c.source, c.quote_line_id, lots.new_id, c.house_name, c.applied_by, c.applied_at
      FROM jsonb_each_text(v_map) m
      JOIN public.bid_count_row_custom_costs c ON c.count_row_id = m.key::uuid
      LEFT JOIN lots ON lots.old_id = c.lot_group_id;
  END IF;

  RETURN v_n;
END;
$$;

