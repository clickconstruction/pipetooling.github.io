SET lock_timeout = '3s';

-- v2.2132 (Send or Compare F6a, decision D7a): bid VERSIONS own their fixture counts.
--
-- Until now bids_count_rows had no version column: every version of a bid shared one count list
-- (what a version owned was takeoff mappings, rough-in lines, prices, GC). That made "adopt an
-- existing bid as a version" impossible (the Jakes project: eleven board bids, each with its own
-- counts) and contradicted "a version is a separate bid you can send".
--
-- Model after this migration (mirrors bids_takeoff_template_mappings.bid_version_id):
--   • bid_version_id NULL  = the unsplit bid's rows (a bid with no versions)
--   • bid_version_id = V   = version V's own rows
-- Backfill for bids that are ALREADY split: the shared rows become the FIRST version's rows (lowest
-- sort_order); every other version gets its own CLONE of those rows, and that version's children
-- that point at count rows (takeoff mappings, rough-in lines, and the version's price scenarios'
-- custom prices / submission hides / assignments) are re-keyed to the clones. Nothing is deleted.
-- materialize_bid_version / create_bid_version learn the same: stamp on first split, clone + re-key
-- on every new version. Idempotent (IF NOT EXISTS / CREATE OR REPLACE; backfill only touches NULLs).

ALTER TABLE public.bids_count_rows
  ADD COLUMN IF NOT EXISTS bid_version_id uuid NULL REFERENCES public.bid_versions(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS bids_count_rows_bid_version_idx ON public.bids_count_rows (bid_id, bid_version_id);
COMMENT ON COLUMN public.bids_count_rows.bid_version_id IS
  'Version that owns this count row (v2.2132). NULL = the unsplit bid''s rows. Each version of a split bid has its own rows.';

-- ---------------------------------------------------------------------------------------------
-- Helper: clone a bid's count rows from one version (or the unsplit NULL set) onto another version
-- and re-key that target version's children. Returns the number of rows cloned.
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

  RETURN v_n;
END;
$$;
ALTER FUNCTION public.clone_count_rows_to_bid_version(uuid, uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.clone_count_rows_to_bid_version(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clone_count_rows_to_bid_version(uuid, uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Backfill already-split bids (only rows that are still NULL-version on a bid that has versions).
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  b record;
  v record;
  v_base uuid;
BEGIN
  FOR b IN
    SELECT DISTINCT c.bid_id
      FROM public.bids_count_rows c
      JOIN public.bid_versions bv ON bv.bid_id = c.bid_id
     WHERE c.bid_version_id IS NULL
  LOOP
    SELECT id INTO v_base FROM public.bid_versions WHERE bid_id = b.bid_id ORDER BY sort_order, created_at LIMIT 1;
    -- every non-base version gets its own clone of the shared rows (+ re-keyed children)
    FOR v IN SELECT id FROM public.bid_versions WHERE bid_id = b.bid_id AND id <> v_base LOOP
      PERFORM public.clone_count_rows_to_bid_version(b.bid_id, NULL, v.id);
    END LOOP;
    -- the shared rows become the base version's rows (its children already point at them)
    UPDATE public.bids_count_rows SET bid_version_id = v_base WHERE bid_id = b.bid_id AND bid_version_id IS NULL;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------------------
-- First split: the unsplit rows become the new base version's rows (same as mappings/rough-in).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.materialize_bid_version(p_bid_id uuid, p_name text)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_bid_id IS NULL THEN RAISE EXCEPTION 'materialize_bid_version: bid required'; END IF;

  INSERT INTO public.bid_versions (bid_id, name, sort_order, include_in_submission)
  VALUES (p_bid_id, p_name,
          COALESCE((SELECT max(sort_order) FROM public.bid_versions WHERE bid_id = p_bid_id), -1) + 1,
          true)
  RETURNING id INTO v_new_id;

  UPDATE public.bids_count_rows
    SET bid_version_id = v_new_id
    WHERE bid_id = p_bid_id AND bid_version_id IS NULL;
  UPDATE public.bids_takeoff_rough_part_lines
    SET bid_version_id = v_new_id
    WHERE bid_id = p_bid_id AND bid_version_id IS NULL;
  UPDATE public.bids_takeoff_template_mappings
    SET bid_version_id = v_new_id
    WHERE bid_id = p_bid_id AND bid_version_id IS NULL;
  UPDATE public.price_book_versions
    SET bid_version_id = v_new_id
    WHERE bid_id = p_bid_id AND bid_version_id IS NULL;
  -- the materialized version's ★ is the bid's saved ★ when it is one of these scenarios
  UPDATE public.bid_versions bv
     SET starred_price_book_version_id = b.selected_price_book_version_id
    FROM public.bids b
   WHERE bv.id = v_new_id AND b.id = p_bid_id
     AND EXISTS (SELECT 1 FROM public.price_book_versions p WHERE p.id = b.selected_price_book_version_id AND p.bid_version_id = v_new_id);

  RETURN v_new_id;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- New version: clone the source version's takeoff (mappings + rough-in), its counts, optionally its
-- prices — and re-key everything onto the cloned count rows.
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
  v_clone_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_bid_id IS NULL THEN RAISE EXCEPTION 'create_bid_version: bid required'; END IF;

  INSERT INTO public.bid_versions (bid_id, name, sort_order, include_in_submission, source_bid_version_id)
  VALUES (p_bid_id, p_name,
          COALESCE((SELECT max(sort_order) FROM public.bid_versions WHERE bid_id = p_bid_id), -1) + 1,
          true, p_source_bid_version_id)
  RETURNING id INTO v_new_id;

  -- takeoff: same rows, new version (count_row_id re-keyed below once the counts are cloned)
  INSERT INTO public.bids_takeoff_rough_part_lines
    (bid_id, count_row_id, bid_version_id, part_id, quantity, unit_price, sequence_order,
     source_material_part_price_id, source_template_id)
  SELECT bid_id, count_row_id, v_new_id, part_id, quantity, unit_price, sequence_order,
         source_material_part_price_id, source_template_id
  FROM public.bids_takeoff_rough_part_lines
  WHERE bid_id = p_bid_id AND bid_version_id IS NOT DISTINCT FROM p_source_bid_version_id;

  INSERT INTO public.bids_takeoff_template_mappings
    (bid_id, count_row_id, bid_version_id, template_id, stage, quantity, sequence_order)
  SELECT bid_id, count_row_id, v_new_id, template_id, stage, quantity, sequence_order
  FROM public.bids_takeoff_template_mappings
  WHERE bid_id = p_bid_id AND bid_version_id IS NOT DISTINCT FROM p_source_bid_version_id;

  -- prices (clone keeps the source scenario's name, v2.2123; ★ = the clone, v2.2117)
  IF p_clone_pricing AND p_pricing_source_version_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(name, ''), p_name) INTO v_clone_name
      FROM public.price_book_versions WHERE id = p_pricing_source_version_id;
    v_new_pricing_id := public.clone_price_book_version_to_bid(p_pricing_source_version_id, p_bid_id, COALESCE(v_clone_name, p_name));
    UPDATE public.price_book_versions SET bid_version_id = v_new_id WHERE id = v_new_pricing_id;
    UPDATE public.bid_versions SET starred_price_book_version_id = v_new_pricing_id WHERE id = v_new_id;
  END IF;

  -- counts: the new version gets its own copy; mappings / rough-in / the clone's price children re-key
  PERFORM public.clone_count_rows_to_bid_version(p_bid_id, p_source_bid_version_id, v_new_id);

  RETURN v_new_id;
END;
$$;
