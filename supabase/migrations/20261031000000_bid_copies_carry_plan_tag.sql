SET lock_timeout = '3s';

-- A copied bid keeps each row's plan tag (v2.6194). 20261030230000_robot_fixtures (v2.6180, punch list #221) added
-- bids_count_rows.plan_tag — the robot's tag (WC-1) on a row its fixtures landed, drawn as the chip beside the name —
-- and the tables bid_fixture_pulls / bid_fixture_pull_rows, without touching the functions that copy a bid's takeoff,
-- which name their columns one by one. So from that push until this one a new version (create_bid_version →
-- clone_count_rows_to_bid_version) and a duplicate (duplicate_bid_to_service_type) dropped every row's plan tag; an
-- adopt (adopt_bid_as_version) moves rows whole and dropped nothing. The copy guard, src/lib/bids/bidCopySql.test.ts
-- (v2.4388), reads the generated types, so it went red with the types chore that followed the push (#6593).
--
-- The two copies are redefined below with plan_tag added to the copy's SELECT and INSERT and nothing else changed:
-- clone_count_rows_to_bid_version and duplicate_bid_to_service_type, both as 20261020020000_bid_count_row_marks left
-- them. CREATE OR REPLACE keeps ownership and grants. No table is created, so the three fences are not called.
--
-- The robot's pull rows are not copied, re-keyed or moved by any copy, on purpose. A pull is the robot's record of one
-- read of one bid's plans on one run (the bid, the shell, the run, the set it read), and a pull row's count_row_id only
-- remembers which row of hers the take landed as. A new version clones her rows with their plan_tag and the robot's
-- share, so the shade and the chip survive on the new version, while the take stays recorded once, on the version she
-- took it on (taken_version_id), the way the fixtures score reads it. A duplicate is a new bid with no run, and already
-- leaves the count sources behind (v2.5517): a pull there would describe another bid's read. An adopt leaves the pull
-- on the adopted bid with its run, where robot_progress() reads it. See docs/migrations/20261031000000_bid_copies_carry_plan_tag.md.

-- ---------------------------------------------------------------- a new version: the count-row clone carries plan_tag

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
    INSERT INTO public.bids_count_rows (bid_id, bid_version_id, fixture, count, group_tag, page, sequence_order, unit, source_shares, kind, tags, split_material_cents, split_markup_pct, split_taxable, plan_tag)
    VALUES (p_bid_id, p_target_bid_version_id, r.fixture, r.count, r.group_tag, r.page, r.sequence_order, r.unit, r.source_shares, r.kind, r.tags, r.split_material_cents, r.split_markup_pct, r.split_taxable, r.plan_tag)
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

-- ---------------------------------------------------------------- a duplicate carries plan_tag; the robot's pull stays with the first bid

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
  r_price RECORD;
  r_entry RECORD;
  v_version uuid;
  v_new_price_id uuid;
  v_new_entry_id uuid;
  v_star uuid;
  v_saved uuid;
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

  -- A bid with versions (v2.4413): the copy is one plain bid, made from the version the bid is on
  -- (the saved one, else the first by order: pickActiveVersion's rule). Before, every version's
  -- rows were stacked into the copy, so its counts doubled. NULL = the bid has no versions.
  SELECT bv.id INTO v_version
    FROM public.bid_versions bv
   WHERE bv.bid_id = p_source_bid_id
   ORDER BY (bv.id = v_src.selected_bid_version_id) DESC NULLS LAST, bv.sort_order, bv.created_at
   LIMIT 1;

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

  -- the source's own price → its copy, and each of its book entries → its copy (v2.4413)
  DROP TABLE IF EXISTS _dup_bid_price_map;
  CREATE TEMP TABLE _dup_bid_price_map (
    old_id uuid PRIMARY KEY,
    new_id uuid NOT NULL
  ) ON COMMIT DROP;
  DROP TABLE IF EXISTS _dup_bid_entry_map;
  CREATE TEMP TABLE _dup_bid_entry_map (
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
    SELECT id, fixture, count, group_tag, page, sequence_order, unit, kind, tags, split_material_cents, split_markup_pct, split_taxable, plan_tag
    FROM public.bids_count_rows
    WHERE bid_id = p_source_bid_id
      AND bid_version_id IS NOT DISTINCT FROM v_version
    ORDER BY sequence_order, id
  LOOP
    INSERT INTO public.bids_count_rows (
      bid_id, fixture, count, group_tag, page, sequence_order, unit, kind, tags, split_material_cents, split_markup_pct, split_taxable, plan_tag
    )
    VALUES (
      v_new_bid_id,
      r_count.fixture,
      r_count.count,
      r_count.group_tag,
      r_count.page,
      r_count.sequence_order,
      r_count.unit,
      r_count.kind,
      r_count.tags,
      r_count.split_material_cents,
      r_count.split_markup_pct,
      r_count.split_taxable,
      r_count.plan_tag
    )
    RETURNING id INTO v_new_count_id;

    INSERT INTO _dup_bid_count_row_map (old_id, new_id)
    VALUES (r_count.id, v_new_count_id);
  END LOOP;

  -- The bid's own prices (v2.4413): each price the copied version owns is cloned for the copy,
  -- with its book entries, keeping its name, order and offer flag. Before, the copy's custom
  -- prices, hidden rows and assignments kept pointing at the first bid's prices, which the copy's
  -- Pricing tab (it reads prices by its own bid) never found. A shared book (no bid) is not
  -- cloned: the copy keeps pointing at it.
  FOR r_price IN
    SELECT * FROM public.price_book_versions
     WHERE bid_id = p_source_bid_id
       AND bid_version_id IS NOT DISTINCT FROM v_version
     ORDER BY sort_order, created_at
  LOOP
    INSERT INTO public.price_book_versions (
      name, service_type_id, bid_id, source_version_id, include_in_submission, sort_order
    )
    VALUES (
      r_price.name, r_price.service_type_id, v_new_bid_id, r_price.id, r_price.include_in_submission, r_price.sort_order
    )
    RETURNING id INTO v_new_price_id;
    INSERT INTO _dup_bid_price_map (old_id, new_id) VALUES (r_price.id, v_new_price_id);

    FOR r_entry IN
      SELECT * FROM public.price_book_entries WHERE version_id = r_price.id ORDER BY sequence_order, id
    LOOP
      INSERT INTO public.price_book_entries (
        version_id, fixture_type_id, rough_in_price, top_out_price, trim_set_price, total_price, sequence_order
      )
      VALUES (
        v_new_price_id, r_entry.fixture_type_id, r_entry.rough_in_price, r_entry.top_out_price, r_entry.trim_set_price, r_entry.total_price, r_entry.sequence_order
      )
      RETURNING id INTO v_new_entry_id;
      INSERT INTO _dup_bid_entry_map (old_id, new_id) VALUES (r_entry.id, v_new_entry_id);
    END LOOP;
  END LOOP;

  -- The copy's saved price, picked as the Pricing tab picks it (deriveActivePricingId): the
  -- version's ★ when it was cloned, else the bid's saved price when it was cloned, else the first
  -- clone; with no clone, the saved price stays when it is a shared book and is cleared when it is
  -- a price of the first bid that did not come along.
  SELECT bv.starred_price_book_version_id INTO v_star FROM public.bid_versions bv WHERE bv.id = v_version;
  SELECT COALESCE(
           (SELECT pm.new_id FROM _dup_bid_price_map pm WHERE pm.old_id = v_star),
           (SELECT pm.new_id FROM _dup_bid_price_map pm WHERE pm.old_id = v_src.selected_price_book_version_id),
           (SELECT pm.new_id FROM _dup_bid_price_map pm JOIN public.price_book_versions p ON p.id = pm.new_id ORDER BY p.sort_order, p.created_at, p.id LIMIT 1),
           (SELECT p.id FROM public.price_book_versions p WHERE p.id = v_src.selected_price_book_version_id AND p.bid_id IS NULL)
         )
    INTO v_saved;
  IF v_saved IS DISTINCT FROM v_src.selected_price_book_version_id THEN
    UPDATE public.bids SET selected_price_book_version_id = v_saved WHERE id = v_new_bid_id;
  END IF;

  -- Custom prices, hidden rows and assignments follow their price onto its clone. A row on a
  -- price of the first bid that was not cloned (another version's) is left behind.
  INSERT INTO public.bid_count_row_custom_prices (
    bid_id, count_row_id, price_book_version_id, unit_price
  )
  SELECT
    v_new_bid_id,
    m.new_id,
    COALESCE(pm.new_id, c.price_book_version_id),
    c.unit_price
  FROM public.bid_count_row_custom_prices c
  INNER JOIN _dup_bid_count_row_map m ON m.old_id = c.count_row_id
  INNER JOIN public.price_book_versions pv ON pv.id = c.price_book_version_id
  LEFT JOIN _dup_bid_price_map pm ON pm.old_id = c.price_book_version_id
  WHERE c.bid_id = p_source_bid_id
    AND (pv.bid_id IS NULL OR pm.new_id IS NOT NULL);

  INSERT INTO public.bid_count_row_submission_hides (
    bid_id,
    count_row_id,
    price_book_version_id
  )
  SELECT
    v_new_bid_id,
    m.new_id,
    COALESCE(pm.new_id, h.price_book_version_id)
  FROM public.bid_count_row_submission_hides h
  INNER JOIN _dup_bid_count_row_map m ON m.old_id = h.count_row_id
  INNER JOIN public.price_book_versions pv ON pv.id = h.price_book_version_id
  LEFT JOIN _dup_bid_price_map pm ON pm.old_id = h.price_book_version_id
  WHERE h.bid_id = p_source_bid_id
    AND (pv.bid_id IS NULL OR pm.new_id IS NOT NULL);

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
    COALESCE(em.new_id, p.price_book_entry_id),
    COALESCE(pm.new_id, p.price_book_version_id),
    p.unit_price_override
  FROM public.bid_pricing_assignments p
  INNER JOIN _dup_bid_count_row_map m ON m.old_id = p.count_row_id
  INNER JOIN public.price_book_versions pv ON pv.id = p.price_book_version_id
  LEFT JOIN _dup_bid_price_map pm ON pm.old_id = p.price_book_version_id
  LEFT JOIN _dup_bid_entry_map em ON em.old_id = p.price_book_entry_id
  WHERE p.bid_id = p_source_bid_id
    AND (pv.bid_id IS NULL OR pm.new_id IS NOT NULL);

  -- Quoted fixture costs (v2.4413): a copy in the same trade keeps them, each package under an id
  -- of its own; the quote line they came from stays with the first bid. A copy into another trade
  -- does not: the quote is the other trade's. Only for a caller who may write a quoted cost.
  IF v_src.service_type_id = p_target_service_type_id AND public.can_write_bid_custom_costs() THEN
    WITH lots AS MATERIALIZED (
      SELECT d.lot_group_id AS old_id, gen_random_uuid() AS new_id
        FROM (SELECT DISTINCT c.lot_group_id
                FROM public.bid_count_row_custom_costs c
                INNER JOIN _dup_bid_count_row_map m ON m.old_id = c.count_row_id
               WHERE c.lot_group_id IS NOT NULL) d
    )
    INSERT INTO public.bid_count_row_custom_costs (
      bid_id, count_row_id, unit_materials_cents, source, quote_line_id, lot_group_id, house_name, applied_by, applied_at
    )
    SELECT
      v_new_bid_id,
      m.new_id,
      c.unit_materials_cents,
      c.source,
      NULL,
      lots.new_id,
      c.house_name,
      c.applied_by,
      c.applied_at
    FROM public.bid_count_row_custom_costs c
    INNER JOIN _dup_bid_count_row_map m ON m.old_id = c.count_row_id
    LEFT JOIN lots ON lots.old_id = c.lot_group_id;
  END IF;

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
