SET lock_timeout = '3s';

-- Making a bid version works again (v2.6235). 20261031010000_robot_fixtures_copies (v2.6188, punch list #221) taught
-- clone_count_rows_to_bid_version to re-key the robot's take onto the cloned rows and adopt_bid_as_version to move the
-- robot's pull with the rows, each with a plain UPDATE of bid_fixture_pull_rows / bid_fixture_pulls. Both functions
-- are SECURITY INVOKER, and 20261030230000_robot_fixtures closed the two pull tables to INSERT, UPDATE and DELETE from
-- authenticated on purpose (the verb writes as the service role, the robot-fixture RPCs as the owner). Postgres checks
-- that privilege when the statement starts, whether or not a row matches, so from the 20261031010000 push every new
-- version (create_bid_version → the clone) and every adopt failed for every signed-in user with "permission denied
-- for table bid_fixture_pull_rows". Found by the live test of v2.6188's copies on 2026-10-31.
--
-- The two updates move into two SECURITY DEFINER helpers, the shape robot_fixture_land_row and the other
-- robot-fixture RPCs already have, and the two functions call them; their bodies are otherwise verbatim from
-- 20261031010000. The tables stay closed to authenticated. Each helper writes only what a caller who can price the
-- bid could have reached through RLS:
--  - robot_fixtures_follow_clone re-keys only that bid's pull rows, only onto rows of that bid on the target version,
--    and nothing at all for a signed-in caller who cannot price the bid (the rows RLS would hide from them), so a
--    caller who may make a version but not price the bid still gets the version, and the take stays where it was.
--  - robot_fixtures_follow_adopt moves the pull only into a version of the package, only once the adopted bid has no
--    count row left, and refuses a signed-in caller who cannot price both bids (adopt_bid_as_version refuses them
--    first). No table is created, so the three fences are not called. See
--    docs/migrations/20261031015000_bid_copies_pull_rows_definer.md.

-- ---------------------------------------------------------------- the helpers

CREATE OR REPLACE FUNCTION public.robot_fixtures_follow_clone(p_bid_id uuid, p_target_bid_version_id uuid, p_map jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  IF p_bid_id IS NULL OR p_target_bid_version_id IS NULL OR p_map IS NULL OR p_map = '{}'::jsonb THEN RETURN 0; END IF;
  -- The service role and the owner have no auth.uid() and are trusted; a signed-in caller re-keys only what RLS
  -- would let them see.
  IF auth.uid() IS NOT NULL AND NOT public.can_access_bid_for_pricing(p_bid_id) THEN RETURN 0; END IF;
  UPDATE public.bid_fixture_pull_rows x
     SET count_row_id = c.id,
         taken_version_id = p_target_bid_version_id
    FROM jsonb_each_text(p_map) m
    JOIN public.bids_count_rows c
      ON c.id = m.value::uuid AND c.bid_id = p_bid_id AND c.bid_version_id = p_target_bid_version_id
   WHERE x.bid_id = p_bid_id AND x.count_row_id = m.key::uuid;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.robot_fixtures_follow_clone(uuid, uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.robot_fixtures_follow_clone(uuid, uuid, jsonb) TO authenticated, service_role;
COMMENT ON FUNCTION public.robot_fixtures_follow_clone(uuid, uuid, jsonb) IS
  'v2.6235: the robot''s take follows a new version''s clones (v2.6188''s rule), as the owner, since the pull tables take no write from authenticated. Called by clone_count_rows_to_bid_version with its source row → clone map; re-keys only the bid''s pull rows onto that bid''s rows on the target version, and nothing for a signed-in caller who cannot price the bid.';

CREATE OR REPLACE FUNCTION public.robot_fixtures_follow_adopt(p_source_bid_id uuid, p_target_bid_id uuid, p_new_version_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  IF p_source_bid_id IS NULL OR p_target_bid_id IS NULL OR p_new_version_id IS NULL OR p_source_bid_id = p_target_bid_id THEN
    RETURN 0;
  END IF;
  IF auth.uid() IS NOT NULL
     AND NOT (public.can_access_bid_for_pricing(p_source_bid_id) AND public.can_access_bid_for_pricing(p_target_bid_id)) THEN
    RAISE EXCEPTION 'robot_fixtures_follow_adopt: not allowed';
  END IF;
  -- Only into a version of the package, and only once the adopt has moved every count row off the adopted bid.
  IF NOT EXISTS (SELECT 1 FROM public.bid_versions v WHERE v.id = p_new_version_id AND v.bid_id = p_target_bid_id) THEN
    RAISE EXCEPTION 'robot_fixtures_follow_adopt: that version is not the package''s';
  END IF;
  IF EXISTS (SELECT 1 FROM public.bids_count_rows c WHERE c.bid_id = p_source_bid_id) THEN
    RAISE EXCEPTION 'robot_fixtures_follow_adopt: the adopted bid still has count rows';
  END IF;
  UPDATE public.bid_fixture_pulls SET bid_id = p_target_bid_id WHERE bid_id = p_source_bid_id;
  UPDATE public.bid_fixture_pull_rows SET bid_id = p_target_bid_id, taken_version_id = p_new_version_id WHERE bid_id = p_source_bid_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.robot_fixtures_follow_adopt(uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.robot_fixtures_follow_adopt(uuid, uuid, uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.robot_fixtures_follow_adopt(uuid, uuid, uuid) IS
  'v2.6235: an adopt moves the robot''s pull and its rows to the package (v2.6188''s rule), as the owner, since the pull tables take no write from authenticated. Called by adopt_bid_as_version after the count rows move; only into a version of the package, only when the adopted bid has no count row left, and refused for a signed-in caller who cannot price both bids.';

-- ---------------------------------------------------------------- a new version: the clone calls the helper

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

  -- Robot fixtures (v2.6188, punch list #221): the robot's take follows the rows it landed on into the new version —
  -- the pull row points at the clone, and the version it was taken on becomes the target. The source version's rows
  -- keep their shade (the share is on the row); the window reads the take on the newest version made from it.
  -- v2.6235: through the owner's helper, since the pull tables take no write from authenticated.
  PERFORM public.robot_fixtures_follow_clone(p_bid_id, p_target_bid_version_id, v_map);

  RETURN v_n;
END;
$$;

-- ---------------------------------------------------------------- an adopt: the move calls the helper

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
  -- The quoted fixture costs move with their rows too (v2.4413).
  UPDATE public.bid_count_row_custom_costs SET bid_id = p_target_bid_id WHERE bid_id = p_source_bid_id;
  -- Robot fixtures (v2.6188, punch list #221): the robot's pull and its rows move with the count rows they landed on.
  -- v2.6235: through the owner's helper, since the pull tables take no write from authenticated.
  PERFORM public.robot_fixtures_follow_adopt(p_source_bid_id, p_target_bid_id, v_new_id);

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
