-- Canonical omit-from-submission is bid_count_row_submission_hides (prior migration).

ALTER TABLE public.bid_pricing_assignments
  DROP COLUMN IF EXISTS omit_from_submission_documents;

-- Copy submission hides when duplicating bid across service types.
CREATE OR REPLACE FUNCTION public.duplicate_bid_to_service_type(
  p_source_bid_id uuid,
  p_target_service_type_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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

  IF v_src.service_type_id = p_target_service_type_id THEN
    RAISE EXCEPTION 'Target service type must differ from source bid';
  END IF;

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
    v_src.project_name,
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
    SELECT id, fixture, count, group_tag, page, sequence_order
    FROM public.bids_count_rows
    WHERE bid_id = p_source_bid_id
    ORDER BY sequence_order, id
  LOOP
    INSERT INTO public.bids_count_rows (
      bid_id, fixture, count, group_tag, page, sequence_order
    )
    VALUES (
      v_new_bid_id,
      r_count.fixture,
      r_count.count,
      r_count.group_tag,
      r_count.page,
      r_count.sequence_order
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

COMMENT ON FUNCTION public.duplicate_bid_to_service_type(uuid, uuid) IS
  'Creates a new bid copying counts, pricing (incl. submission hides), takeoff, and cost estimate from the source with a new service_type_id; resets status/financial/sent fields.';
