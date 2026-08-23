SET lock_timeout = '3s';

-- v2.2123 (Send or Compare F4, decision D4): when a new bid version clones its prices from a
-- source scenario, the clone keeps the SOURCE scenario's name ("WENDI" stays "WENDI") instead of
-- being named after the version ("Value Engineered"). A version is a bid; a scenario is a price
-- point — they should not share a name (8 bids in prod had a version and a scenario both called
-- "Value Engineered"). Same signature; only the clone's name changes. Idempotent (CREATE OR REPLACE).

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

  IF p_clone_pricing AND p_pricing_source_version_id IS NOT NULL THEN
    -- The clone keeps the source scenario's name (v2.2123); falls back to the version name only
    -- when the source has none.
    SELECT COALESCE(NULLIF(name, ''), p_name) INTO v_clone_name
      FROM public.price_book_versions WHERE id = p_pricing_source_version_id;
    v_new_pricing_id := public.clone_price_book_version_to_bid(p_pricing_source_version_id, p_bid_id, COALESCE(v_clone_name, p_name));
    UPDATE public.price_book_versions SET bid_version_id = v_new_id WHERE id = v_new_pricing_id;
    -- This version's ★ is the clone it started from (v2.2117 column).
    UPDATE public.bid_versions SET starred_price_book_version_id = v_new_pricing_id WHERE id = v_new_id;
  END IF;

  RETURN v_new_id;
END;
$$;
