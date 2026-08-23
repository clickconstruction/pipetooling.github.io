SET lock_timeout = '3s';

-- v2.2114 — bids_count_rows.unit (stage 2 of the counts-vs-line-feet split).
--
-- A count row's `count` is a tally (ea) or a length (ft); until now the unit
-- lived only in the fixture NAME by convention (CountTooling's "ft of …" /
-- "px of …" export prefixes, hand-entered "feet of …"). The client kernel
-- src/lib/bids/countRowUnit.ts reads that convention. This column lets a row
-- carry its unit explicitly:
--   * NULLABLE, NO DEFAULT — NULL means "infer from the name". A DEFAULT 'ea'
--     would turn every write path that forgets the column (old cached client
--     bundles, copy functions, restores) into a silent wrong answer on a feet
--     row; NULL degrades to the name convention instead. The client reads
--     through effectiveCountUnit(row) = row.unit ?? classify(fixture).
--   * CHECK keeps the vocabulary to ea / ft / px / sqft.
--   * Backfill stamps only the UNAMBIGUOUS exporter-form rows ("ft of …",
--     "px of …", optional "[Group] " prefix) so those survive a later rename.
--     Hand-entry variants stay NULL (the kernel still reads them) until a user
--     sets them explicitly.
--   * duplicate_bid_to_service_type enumerates columns when copying count
--     rows — re-created here with `unit` so a copied bid keeps explicit units.
--
-- Additive + idempotent; the old client ignores the column (apply before the
-- client that writes it).

ALTER TABLE public.bids_count_rows ADD COLUMN IF NOT EXISTS unit text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bids_count_rows_unit_check'
      AND conrelid = 'public.bids_count_rows'::regclass
  ) THEN
    ALTER TABLE public.bids_count_rows
      ADD CONSTRAINT bids_count_rows_unit_check
      CHECK (unit IS NULL OR unit IN ('ea', 'ft', 'px', 'sqft'));
  END IF;
END
$$;

COMMENT ON COLUMN public.bids_count_rows.unit IS
  'Unit the count is in: ea (tally), ft (line feet), px (unscaled CountTooling run — pixels, not feet), sqft. NULL = infer from the fixture name convention ("ft of …", "feet of …", "… per ft") via src/lib/bids/countRowUnit.ts; never add a DEFAULT.';

-- Backfill the unambiguous CountTooling-export forms only.
UPDATE public.bids_count_rows
   SET unit = 'ft'
 WHERE unit IS NULL
   AND fixture ~* '^\s*(\[[^\]]*\]\s*)?ft\s+of\s';

UPDATE public.bids_count_rows
   SET unit = 'px'
 WHERE unit IS NULL
   AND fixture ~* '^\s*(\[[^\]]*\]\s*)?px\s+of\s';

-- duplicate_bid_to_service_type: body reproduced from
-- 20260817160624_duplicate_bid_same_service_type.sql; the ONLY change is
-- `unit` in the count-row SELECT/INSERT.
CREATE OR REPLACE FUNCTION "public"."duplicate_bid_to_service_type"("p_source_bid_id" "uuid", "p_target_service_type_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_new_bid_id uuid;
  v_src public.bids%ROWTYPE;
  v_new_count_id uuid;
  v_old_ce_id uuid;
  v_new_ce_id uuid;
  r_count RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_src FROM public.bids WHERE id = p_source_bid_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source bid not found';
  END IF;

  -- Same-type duplicates allowed (v2.1765): the copy carries " (copy)" on the
  -- project name so the Bid Board and pickers can tell the two apart.

  DROP TABLE IF EXISTS _dup_bid_count_row_map;
  CREATE TEMP TABLE _dup_bid_count_row_map (
    old_id uuid PRIMARY KEY,
    new_id uuid NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO public.bids (
    created_by,
    service_type_id,
    customer_id,
    gc_builder_id,
    project_name,
    address,
    drive_link,
    plans_link,
    count_tooling_link,
    bid_submission_link,
    design_drawing_plan_date,
    plan_pages,
    gc_contact_name,
    gc_contact_phone,
    gc_contact_email,
    estimator_id,
    account_manager_id,
    bid_due_date,
    submitted_to,
    notes,
    distance_from_office,
    selected_takeoff_book_version_id,
    selected_labor_book_version_id,
    selected_price_book_version_id,
    materials_model
  )
  VALUES (
    v_uid,
    p_target_service_type_id,
    v_src.customer_id,
    v_src.gc_builder_id,
    CASE WHEN v_src.service_type_id = p_target_service_type_id THEN v_src.project_name || ' (copy)' ELSE v_src.project_name END,
    v_src.address,
    v_src.drive_link,
    v_src.plans_link,
    v_src.count_tooling_link,
    v_src.bid_submission_link,
    v_src.design_drawing_plan_date,
    v_src.plan_pages,
    v_src.gc_contact_name,
    v_src.gc_contact_phone,
    v_src.gc_contact_email,
    v_src.estimator_id,
    v_src.account_manager_id,
    v_src.bid_due_date,
    v_src.submitted_to,
    v_src.notes,
    v_src.distance_from_office,
    v_src.selected_takeoff_book_version_id,
    v_src.selected_labor_book_version_id,
    v_src.selected_price_book_version_id,
    v_src.materials_model
  )
  RETURNING id INTO v_new_bid_id;

  FOR r_count IN
    SELECT id, fixture, count, group_tag, page, sequence_order, unit
    FROM public.bids_count_rows
    WHERE bid_id = p_source_bid_id
    ORDER BY sequence_order, id
  LOOP
    INSERT INTO public.bids_count_rows (
      bid_id, fixture, count, group_tag, page, sequence_order, unit
    )
    VALUES (
      v_new_bid_id,
      r_count.fixture,
      r_count.count,
      r_count.group_tag,
      r_count.page,
      r_count.sequence_order,
      r_count.unit
    )
    RETURNING id INTO v_new_count_id;

    INSERT INTO _dup_bid_count_row_map (old_id, new_id)
    VALUES (r_count.id, v_new_count_id);
  END LOOP;

  INSERT INTO public.bid_count_row_custom_prices (
    bid_id, count_row_id, price_book_version_id, unit_price
  )
  SELECT
    v_new_bid_id,
    m.new_id,
    c.price_book_version_id,
    c.unit_price
  FROM public.bid_count_row_custom_prices c
  INNER JOIN _dup_bid_count_row_map m ON m.old_id = c.count_row_id
  WHERE c.bid_id = p_source_bid_id;

  INSERT INTO public.bid_count_row_submission_hides (
    bid_id,
    count_row_id,
    price_book_version_id
  )
  SELECT
    v_new_bid_id,
    m.new_id,
    h.price_book_version_id
  FROM public.bid_count_row_submission_hides h
  INNER JOIN _dup_bid_count_row_map m ON m.old_id = h.count_row_id
  WHERE h.bid_id = p_source_bid_id;

  INSERT INTO public.bid_pricing_assignments (
    bid_id,
    count_row_id,
    is_fixed_price,
    price_book_entry_id,
    price_book_version_id,
    unit_price_override
  )
  SELECT
    v_new_bid_id,
    m.new_id,
    p.is_fixed_price,
    p.price_book_entry_id,
    p.price_book_version_id,
    p.unit_price_override
  FROM public.bid_pricing_assignments p
  INNER JOIN _dup_bid_count_row_map m ON m.old_id = p.count_row_id
  WHERE p.bid_id = p_source_bid_id;

  INSERT INTO public.bids_takeoff_rough_part_lines (
    bid_id,
    count_row_id,
    part_id,
    quantity,
    sequence_order,
    source_material_part_price_id,
    source_template_id,
    unit_price
  )
  SELECT
    v_new_bid_id,
    m.new_id,
    t.part_id,
    t.quantity,
    t.sequence_order,
    t.source_material_part_price_id,
    t.source_template_id,
    t.unit_price
  FROM public.bids_takeoff_rough_part_lines t
  INNER JOIN _dup_bid_count_row_map m ON m.old_id = t.count_row_id
  WHERE t.bid_id = p_source_bid_id;

  INSERT INTO public.bids_takeoff_template_mappings (
    bid_id,
    count_row_id,
    quantity,
    sequence_order,
    stage,
    template_id
  )
  SELECT
    v_new_bid_id,
    m.new_id,
    tm.quantity,
    tm.sequence_order,
    tm.stage,
    tm.template_id
  FROM public.bids_takeoff_template_mappings tm
  INNER JOIN _dup_bid_count_row_map m ON m.old_id = tm.count_row_id
  WHERE tm.bid_id = p_source_bid_id;

  SELECT id INTO v_old_ce_id
  FROM public.cost_estimates
  WHERE bid_id = p_source_bid_id
  LIMIT 1;

  IF v_old_ce_id IS NOT NULL THEN
    INSERT INTO public.cost_estimates (
      bid_id,
      driving_cost_rate,
      estimator_cost_flat_amount,
      estimator_cost_per_count,
      hours_per_trip,
      labor_rate
    )
    SELECT
      v_new_bid_id,
      driving_cost_rate,
      estimator_cost_flat_amount,
      estimator_cost_per_count,
      hours_per_trip,
      labor_rate
    FROM public.cost_estimates
    WHERE id = v_old_ce_id
    RETURNING id INTO v_new_ce_id;

    INSERT INTO public.cost_estimate_labor_rows (
      cost_estimate_id,
      count,
      fixture,
      is_fixed,
      rough_in_hrs_per_unit,
      sequence_order,
      top_out_hrs_per_unit,
      trim_set_hrs_per_unit
    )
    SELECT
      v_new_ce_id,
      lr.count,
      lr.fixture,
      lr.is_fixed,
      lr.rough_in_hrs_per_unit,
      lr.sequence_order,
      lr.top_out_hrs_per_unit,
      lr.trim_set_hrs_per_unit
    FROM public.cost_estimate_labor_rows lr
    WHERE lr.cost_estimate_id = v_old_ce_id;
  END IF;

  RETURN v_new_bid_id;
END;
$$;
