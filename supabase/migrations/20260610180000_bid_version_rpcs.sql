-- Bid Versions RPCs. SECURITY INVOKER (match clone_price_book_version_to_bid) — gated by
-- existing RLS on bid_versions / takeoff tables / price_book_versions.

-- First-split helper: adopt the bid's unsplit (NULL-versioned) takeoff + pricing into a
-- new NAMED version, so the original becomes a real version alongside any new variant.
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

  UPDATE public.bids_takeoff_rough_part_lines
    SET bid_version_id = v_new_id
    WHERE bid_id = p_bid_id AND bid_version_id IS NULL;
  UPDATE public.bids_takeoff_template_mappings
    SET bid_version_id = v_new_id
    WHERE bid_id = p_bid_id AND bid_version_id IS NULL;
  -- a bid's existing bid-scoped pricing (if any) gets adopted too; legacy global-pricing
  -- bids simply have no pricing facet here (the version is takeoff-only until one is cloned).
  UPDATE public.price_book_versions
    SET bid_version_id = v_new_id
    WHERE bid_id = p_bid_id AND bid_version_id IS NULL;

  RETURN v_new_id;
END;
$$;

ALTER FUNCTION public.materialize_bid_version(uuid, text) OWNER TO postgres;
COMMENT ON FUNCTION public.materialize_bid_version(uuid, text) IS
  'First-split: turn a bid''s unsplit (NULL-versioned) takeoff + pricing into a named bid_versions row. SECURITY INVOKER.';
GRANT ALL ON FUNCTION public.materialize_bid_version(uuid, text) TO anon;
GRANT ALL ON FUNCTION public.materialize_bid_version(uuid, text) TO authenticated;
GRANT ALL ON FUNCTION public.materialize_bid_version(uuid, text) TO service_role;

-- Create a new version by copying a source version's takeoff (both tables; count_row_id is
-- shared bid-wide so NO id remap is needed) and optionally cloning a pricing into it.
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
    v_new_pricing_id := public.clone_price_book_version_to_bid(p_pricing_source_version_id, p_bid_id, p_name);
    UPDATE public.price_book_versions SET bid_version_id = v_new_id WHERE id = v_new_pricing_id;
  END IF;

  RETURN v_new_id;
END;
$$;

ALTER FUNCTION public.create_bid_version(uuid, text, uuid, boolean, uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.create_bid_version(uuid, text, uuid, boolean, uuid) IS
  'Create a bid version by copying a source version''s takeoff + optionally cloning a pricing facet. SECURITY INVOKER.';
GRANT ALL ON FUNCTION public.create_bid_version(uuid, text, uuid, boolean, uuid) TO anon;
GRANT ALL ON FUNCTION public.create_bid_version(uuid, text, uuid, boolean, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_bid_version(uuid, text, uuid, boolean, uuid) TO service_role;
