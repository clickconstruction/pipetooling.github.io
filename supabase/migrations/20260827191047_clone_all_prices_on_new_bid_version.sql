SET lock_timeout = '3s';

-- v2.2395 (Wendi): "when creating new version of bid it keeps prices on the new one and the
-- alternate has no prices in it. should copy all prices."
--
-- Until now create_bid_version cloned exactly ONE price scenario — p_pricing_source_version_id
-- (the source version's ★) — and the client passed p_clone_pricing=false whenever the source
-- version had no ★, so a new version could silently start with no prices at all while its
-- siblings kept theirs. Prices are the work: a new version now starts with a copy of EVERY
-- price scenario its source version owns (names, offers, and order preserved), and the ★ maps
-- to the clone of the source's ★.
--
-- Body below is the 20260823034820 definition with the pricing block rewritten (clone-all loop
-- + ★ mapping + legacy fallback). Signature unchanged — old clients keep working (their
-- p_pricing_source_version_id becomes the ★ hint / legacy fallback source).

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

  -- counts: the new version gets its own copy; mappings / rough-in / the clones' price children re-key
  PERFORM public.clone_count_rows_to_bid_version(p_bid_id, p_source_bid_version_id, v_new_id);

  RETURN v_new_id;
END;
$$;
