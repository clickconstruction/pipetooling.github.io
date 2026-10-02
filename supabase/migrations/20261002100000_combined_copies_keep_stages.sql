SET lock_timeout = '3s';

-- v2.4388 (punch list #78): a copy of a Combined takeoff keeps its stage boxes and order rules.
--
-- Three functions copy or move a bid's Combined part lines (bids_takeoff_rough_part_lines):
--   create_bid_version            a new version of a bid
--   duplicate_bid_to_service_type a copy of the bid, in this trade or another
--   adopt_bid_as_version          another bid folded in as a version
-- The first two were last written before the stage boxes (bid_takeoff_stage_splits, v2.3671) and
-- the Sold in rule (order_increment / order_increment_unit, v2.3406) existed, so the copy lost
-- both. Adopt moved the lines and left the boxes filed under the retired bid, where
-- loadStageSplitsForBid (which reads by bid_id) never finds them.
--
-- A box has no version column: a version's boxes are the rows whose count row or line belongs to
-- it. So a copy re-keys them, a fixture box onto the cloned count row and a line or part box onto
-- the cloned line. INSERT … RETURNING does not promise the source order, so each copy mints the new
-- line ids first and inserts the lines with them.
--
-- The duplicate also catches up on four cost_estimate_labor_rows columns (kind, unit, source,
-- source_note: a sub line or a per 100 ft row copied without them is costed as a counted fixture)
-- and the four travel columns on cost_estimates.
--
-- Each body is the newest one on main with only these additions:
--   clone_count_rows_to_bid_version  20260823034820
--   create_bid_version               20260827191047
--   duplicate_bid_to_service_type    20260929230000
--   adopt_bid_as_version             20260823041240
-- CREATE OR REPLACE with the same signatures, so owners and grants stay as they are.

-- ---------------------------------------------------------------------------------------------
-- The count-row clone also carries each fixture's stage box onto its clone.
-- ---------------------------------------------------------------------------------------------
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
    INSERT INTO public.bids_count_rows (bid_id, bid_version_id, fixture, count, group_tag, page, sequence_order, unit)
    VALUES (p_bid_id, p_target_bid_version_id, r.fixture, r.count, r.group_tag, r.page, r.sequence_order, r.unit)
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

  RETURN v_n;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- New version: the cloned lines keep their order rule, and the line and part boxes follow them.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_bid_version(
  p_bid_id uuid,
  p_name text,
  p_source_bid_version_id uuid,
  p_clone_pricing boolean,
  p_pricing_source_version_id uuid
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_new_id uuid;
  v_new_pricing_id uuid;
  v_src record;
  v_source_star uuid;
  v_star_from_star uuid;
  v_star_from_hint uuid;
  v_first_clone uuid;
  v_star_clone_id uuid;
  v_cloned integer := 0;
  v_clone_name text;
  v_line_map jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_bid_id IS NULL THEN RAISE EXCEPTION 'create_bid_version: bid required'; END IF;

  INSERT INTO public.bid_versions (bid_id, name, sort_order, include_in_submission, source_bid_version_id)
  VALUES (p_bid_id, p_name,
          COALESCE((SELECT max(sort_order) FROM public.bid_versions WHERE bid_id = p_bid_id), -1) + 1,
          true, p_source_bid_version_id)
  RETURNING id INTO v_new_id;

  -- takeoff: same rows, new version (count_row_id re-keyed below once the counts are cloned).
  -- The new ids are minted first (source line id → new line id) so the stage boxes can follow
  -- their lines (v2.4388); the lines keep their Sold in rule.
  SELECT COALESCE(jsonb_object_agg(l.id::text, gen_random_uuid()::text), '{}'::jsonb) INTO v_line_map
    FROM public.bids_takeoff_rough_part_lines l
   WHERE l.bid_id = p_bid_id AND l.bid_version_id IS NOT DISTINCT FROM p_source_bid_version_id;

  INSERT INTO public.bids_takeoff_rough_part_lines
    (id, bid_id, count_row_id, bid_version_id, part_id, quantity, unit_price, sequence_order,
     source_material_part_price_id, source_template_id, order_increment, order_increment_unit)
  SELECT (v_line_map->>id::text)::uuid, bid_id, count_row_id, v_new_id, part_id, quantity, unit_price, sequence_order,
         source_material_part_price_id, source_template_id, order_increment, order_increment_unit
  FROM public.bids_takeoff_rough_part_lines
  WHERE bid_id = p_bid_id AND bid_version_id IS NOT DISTINCT FROM p_source_bid_version_id;

  INSERT INTO public.bids_takeoff_template_mappings
    (bid_id, count_row_id, bid_version_id, template_id, stage, quantity, sequence_order)
  SELECT bid_id, count_row_id, v_new_id, template_id, stage, quantity, sequence_order
  FROM public.bids_takeoff_template_mappings
  WHERE bid_id = p_bid_id AND bid_version_id IS NOT DISTINCT FROM p_source_bid_version_id;

  -- prices: clone EVERY scenario the source version owns (v2.2395) — clone keeps each
  -- scenario's name (v2.2123), its offer flag and its order; ★ = the clone of the source's ★.
  IF p_clone_pricing THEN
    SELECT starred_price_book_version_id INTO v_source_star
      FROM public.bid_versions WHERE id = p_source_bid_version_id;

    FOR v_src IN
      SELECT * FROM public.price_book_versions
       WHERE bid_id = p_bid_id AND bid_version_id IS NOT DISTINCT FROM p_source_bid_version_id
       ORDER BY sort_order, created_at
    LOOP
      v_new_pricing_id := public.clone_price_book_version_to_bid(
        v_src.id, p_bid_id, COALESCE(NULLIF(v_src.name, ''), p_name));
      UPDATE public.price_book_versions
         SET bid_version_id = v_new_id,
             include_in_submission = v_src.include_in_submission,
             sort_order = v_src.sort_order
       WHERE id = v_new_pricing_id;
      v_cloned := v_cloned + 1;
      IF v_first_clone IS NULL THEN v_first_clone := v_new_pricing_id; END IF;
      IF v_src.id = v_source_star THEN v_star_from_star := v_new_pricing_id; END IF;
      IF v_src.id = p_pricing_source_version_id THEN v_star_from_hint := v_new_pricing_id; END IF;
    END LOOP;
    -- ★ priority: the clone of the source version's ★, else of the passed hint, else the first clone.
    v_star_clone_id := COALESCE(v_star_from_star, v_star_from_hint, v_first_clone);

    -- Legacy fallback: the source version owns no scenarios (e.g. an unsplit bid whose active
    -- pricing is a shared template) — clone the passed source scenario as before (v2.2117/23).
    IF v_cloned = 0 AND p_pricing_source_version_id IS NOT NULL THEN
      SELECT COALESCE(NULLIF(name, ''), p_name) INTO v_clone_name
        FROM public.price_book_versions WHERE id = p_pricing_source_version_id;
      v_new_pricing_id := public.clone_price_book_version_to_bid(p_pricing_source_version_id, p_bid_id, COALESCE(v_clone_name, p_name));
      UPDATE public.price_book_versions SET bid_version_id = v_new_id WHERE id = v_new_pricing_id;
      v_star_clone_id := v_new_pricing_id;
    END IF;

    IF v_star_clone_id IS NOT NULL THEN
      UPDATE public.bid_versions SET starred_price_book_version_id = v_star_clone_id WHERE id = v_new_id;
    END IF;
  END IF;

  -- counts: the new version gets its own copy; mappings / rough-in / the clones' price children
  -- re-key, and each fixture's stage box is copied onto its clone
  PERFORM public.clone_count_rows_to_bid_version(p_bid_id, p_source_bid_version_id, v_new_id);

  -- stage boxes on a line, or on a part inside a bundle line (v2.4388): the box follows its
  -- line's clone, filed under the fixture that clone now sits under
  INSERT INTO public.bid_takeoff_stage_splits (bid_id, count_row_id, line_id, part_id, rough_in, top_out, trim_set, source)
  SELECT p_bid_id, nl.count_row_id, nl.id, s.part_id, s.rough_in, s.top_out, s.trim_set, s.source
    FROM jsonb_each_text(v_line_map) m
    JOIN public.bid_takeoff_stage_splits s ON s.line_id = m.key::uuid
    JOIN public.bids_takeoff_rough_part_lines nl ON nl.id = m.value::uuid;

  RETURN v_new_id;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- Duplicate: the lines keep their order rule, the stage boxes come along, and the cost estimate
-- and its labor rows keep the columns added since the function was written.
-- ---------------------------------------------------------------------------------------------
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

  -- source takeoff line → its copy (v2.4388), so a stage box on a line can follow it
  DROP TABLE IF EXISTS _dup_bid_line_map;
  CREATE TEMP TABLE _dup_bid_line_map (
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
    materials_model,
    alternate_group_tags
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
    v_src.materials_model,
    v_src.alternate_group_tags
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

  -- The copies' ids are minted first: INSERT … RETURNING does not promise the source order.
  INSERT INTO _dup_bid_line_map (old_id, new_id)
  SELECT t.id, gen_random_uuid()
  FROM public.bids_takeoff_rough_part_lines t
  INNER JOIN _dup_bid_count_row_map m ON m.old_id = t.count_row_id
  WHERE t.bid_id = p_source_bid_id;

  INSERT INTO public.bids_takeoff_rough_part_lines (
    id,
    bid_id,
    count_row_id,
    part_id,
    quantity,
    sequence_order,
    source_material_part_price_id,
    source_template_id,
    unit_price,
    order_increment,
    order_increment_unit
  )
  SELECT
    lm.new_id,
    v_new_bid_id,
    m.new_id,
    t.part_id,
    t.quantity,
    t.sequence_order,
    t.source_material_part_price_id,
    t.source_template_id,
    t.unit_price,
    t.order_increment,
    t.order_increment_unit
  FROM public.bids_takeoff_rough_part_lines t
  INNER JOIN _dup_bid_count_row_map m ON m.old_id = t.count_row_id
  INNER JOIN _dup_bid_line_map lm ON lm.old_id = t.id
  WHERE t.bid_id = p_source_bid_id;

  -- Stage boxes (v2.4388): a fixture's box onto its copy, a line's or a bundle part's onto the
  -- copied line. A box is found by the row it sits on, not by its own bid_id.
  INSERT INTO public.bid_takeoff_stage_splits (
    bid_id,
    count_row_id,
    line_id,
    part_id,
    rough_in,
    top_out,
    trim_set,
    source
  )
  SELECT
    v_new_bid_id,
    m.new_id,
    lm.new_id,
    s.part_id,
    s.rough_in,
    s.top_out,
    s.trim_set,
    s.source
  FROM public.bid_takeoff_stage_splits s
  INNER JOIN _dup_bid_count_row_map m ON m.old_id = s.count_row_id
  LEFT JOIN _dup_bid_line_map lm ON lm.old_id = s.line_id
  WHERE s.line_id IS NULL OR lm.new_id IS NOT NULL;

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
      labor_rate,
      travel_people,
      travel_nights,
      travel_meals_rate,
      travel_hotel_rate
    )
    SELECT
      v_new_bid_id,
      driving_cost_rate,
      estimator_cost_flat_amount,
      estimator_cost_per_count,
      hours_per_trip,
      labor_rate,
      travel_people,
      travel_nights,
      travel_meals_rate,
      travel_hotel_rate
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
      trim_set_hrs_per_unit,
      kind,
      unit,
      source,
      source_note
    )
    SELECT
      v_new_ce_id,
      lr.count,
      lr.fixture,
      lr.is_fixed,
      lr.rough_in_hrs_per_unit,
      lr.sequence_order,
      lr.top_out_hrs_per_unit,
      lr.trim_set_hrs_per_unit,
      lr.kind,
      lr.unit,
      lr.source,
      lr.source_note
    FROM public.cost_estimate_labor_rows lr
    WHERE lr.cost_estimate_id = v_old_ce_id;
  END IF;

  RETURN v_new_bid_id;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- Adopt: the stage boxes move to the package with the rows they sit on.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adopt_bid_as_version(
  p_target_bid_id uuid,
  p_source_bid_id uuid,
  p_name text,
  p_target_base_name text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_new_id uuid;
  v_source public.bids%ROWTYPE;
  v_target public.bids%ROWTYPE;
  v_sort integer;
  v_gc uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_target_bid_id IS NULL OR p_source_bid_id IS NULL THEN RAISE EXCEPTION 'adopt_bid_as_version: target and source required'; END IF;
  IF p_target_bid_id = p_source_bid_id THEN RAISE EXCEPTION 'adopt_bid_as_version: a bid cannot adopt itself'; END IF;
  IF NOT public.can_access_bid_for_pricing(p_target_bid_id) OR NOT public.can_access_bid_for_pricing(p_source_bid_id) THEN
    RAISE EXCEPTION 'adopt_bid_as_version: not allowed';
  END IF;

  SELECT * INTO v_source FROM public.bids WHERE id = p_source_bid_id FOR UPDATE;
  SELECT * INTO v_target FROM public.bids WHERE id = p_target_bid_id FOR UPDATE;
  IF v_source.id IS NULL OR v_target.id IS NULL THEN RAISE EXCEPTION 'adopt_bid_as_version: bid not found'; END IF;
  IF v_source.adopted_into_bid_id IS NOT NULL THEN RAISE EXCEPTION 'adopt_bid_as_version: source was already adopted'; END IF;
  IF v_target.adopted_into_bid_id IS NOT NULL THEN RAISE EXCEPTION 'adopt_bid_as_version: target was itself adopted into another bid'; END IF;
  IF EXISTS (SELECT 1 FROM public.bid_versions WHERE bid_id = p_source_bid_id) THEN
    RAISE EXCEPTION 'adopt_bid_as_version: the bid to adopt already has versions — adopt its pieces one at a time is not supported yet';
  END IF;

  -- An unsplit target first materializes its current setup as a named version (same as the first split).
  IF NOT EXISTS (SELECT 1 FROM public.bid_versions WHERE bid_id = p_target_bid_id) THEN
    PERFORM public.materialize_bid_version(p_target_bid_id, COALESCE(NULLIF(p_target_base_name, ''), 'To Plans'));
  END IF;

  SELECT COALESCE(max(sort_order), -1) + 1 INTO v_sort FROM public.bid_versions WHERE bid_id = p_target_bid_id;
  -- The adopted bid's GC rides along only when it differs from the package's GC.
  v_gc := CASE WHEN v_source.customer_id IS NOT NULL AND v_source.customer_id IS DISTINCT FROM v_target.customer_id THEN v_source.customer_id ELSE NULL END;

  INSERT INTO public.bid_versions (bid_id, name, sort_order, include_in_submission, is_alternate, customer_id, starred_price_book_version_id)
  VALUES (p_target_bid_id, COALESCE(NULLIF(p_name, ''), v_source.project_name, 'Adopted bid'), v_sort, true, false, v_gc, NULL)
  RETURNING id INTO v_new_id;

  -- Move the source's (unsplit = NULL-version) pieces under the new version of the target.
  UPDATE public.bids_count_rows SET bid_id = p_target_bid_id, bid_version_id = v_new_id
    WHERE bid_id = p_source_bid_id AND bid_version_id IS NULL;
  UPDATE public.bids_takeoff_template_mappings SET bid_id = p_target_bid_id, bid_version_id = v_new_id
    WHERE bid_id = p_source_bid_id AND bid_version_id IS NULL;
  UPDATE public.bids_takeoff_rough_part_lines SET bid_id = p_target_bid_id, bid_version_id = v_new_id
    WHERE bid_id = p_source_bid_id AND bid_version_id IS NULL;
  UPDATE public.price_book_versions SET bid_id = p_target_bid_id, bid_version_id = v_new_id
    WHERE bid_id = p_source_bid_id AND bid_version_id IS NULL;
  UPDATE public.bid_count_row_custom_prices SET bid_id = p_target_bid_id WHERE bid_id = p_source_bid_id;
  UPDATE public.bid_count_row_submission_hides SET bid_id = p_target_bid_id WHERE bid_id = p_source_bid_id;
  UPDATE public.bid_pricing_assignments SET bid_id = p_target_bid_id WHERE bid_id = p_source_bid_id;
  -- The stage boxes keep pointing at the moved rows and lines; they are read by bid (v2.4388).
  UPDATE public.bid_takeoff_stage_splits SET bid_id = p_target_bid_id WHERE bid_id = p_source_bid_id;

  -- ★ = what the source's customer saw, when it is one of the moved scenarios.
  UPDATE public.bid_versions bv SET starred_price_book_version_id = v_source.selected_price_book_version_id
   WHERE bv.id = v_new_id
     AND EXISTS (SELECT 1 FROM public.price_book_versions p WHERE p.id = v_source.selected_price_book_version_id AND p.bid_version_id = v_new_id);

  -- Its send history comes along (date + value), labelled with where it came from.
  IF v_source.bid_date_sent IS NOT NULL THEN
    INSERT INTO public.bid_version_sends (bid_id, bid_version_id, sent_on, value, is_alternate, round_label, note, created_by)
    VALUES (p_target_bid_id, v_new_id, v_source.bid_date_sent, v_source.bid_value, false,
            'adopted from B' || COALESCE(v_source.bid_number::text, '?'),
            'Sent as its own bid before it joined this package.', auth.uid());
  END IF;

  -- Retire the source row from the board (never deleted; number stays searchable).
  UPDATE public.bids SET adopted_into_bid_id = p_target_bid_id,
                         working_board_archived_at = COALESCE(working_board_archived_at, now())
   WHERE id = p_source_bid_id;

  RETURN v_new_id;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- Boxes an earlier adopt left under the retired bid go to the bid their fixture now belongs to.
-- Idempotent: a second run finds none.
-- ---------------------------------------------------------------------------------------------
UPDATE public.bid_takeoff_stage_splits s
   SET bid_id = c.bid_id
  FROM public.bids_count_rows c
 WHERE c.id = s.count_row_id
   AND s.bid_id IS DISTINCT FROM c.bid_id;
