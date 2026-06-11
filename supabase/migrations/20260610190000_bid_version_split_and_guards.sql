-- Bug fixes for Bid Versions:
--  (1) Atomic first-split: one RPC so materialize + create_variant can't half-apply.
--  (2) clone_price_book_version_to_bid: refuse a source pricing that belongs to a DIFFERENT bid
--      (defends against a stale selectedPricingVersionId cloning bid A's prices into bid B).

-- (2) Re-create the clone with a cross-bid guard (rest of the body unchanged).
CREATE OR REPLACE FUNCTION public.clone_price_book_version_to_bid(
  p_source_version_id uuid,
  p_bid_id uuid,
  p_name text
) RETURNS uuid
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_new_id uuid;
  v_entry_map jsonb := '{}'::jsonb;
  r record;
  v_new_entry_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_source_version_id IS NULL OR p_bid_id IS NULL THEN
    RAISE EXCEPTION 'clone_price_book_version_to_bid: source version and bid are required';
  END IF;
  -- A bid-scoped source must belong to THIS bid; templates (bid_id IS NULL) are always allowed.
  IF EXISTS (
    SELECT 1 FROM public.price_book_versions
    WHERE id = p_source_version_id AND bid_id IS NOT NULL AND bid_id <> p_bid_id
  ) THEN
    RAISE EXCEPTION 'clone_price_book_version_to_bid: source pricing belongs to a different bid';
  END IF;

  INSERT INTO public.price_book_versions
    (name, service_type_id, bid_id, source_version_id, include_in_submission, sort_order)
  SELECT p_name, src.service_type_id, p_bid_id, p_source_version_id, true,
         COALESCE((SELECT max(sort_order) FROM public.price_book_versions WHERE bid_id = p_bid_id), -1) + 1
  FROM public.price_book_versions src
  WHERE src.id = p_source_version_id
  RETURNING id INTO v_new_id;

  IF v_new_id IS NULL THEN
    RAISE EXCEPTION 'clone_price_book_version_to_bid: source version % not found', p_source_version_id;
  END IF;

  FOR r IN
    SELECT * FROM public.price_book_entries WHERE version_id = p_source_version_id
  LOOP
    INSERT INTO public.price_book_entries
      (version_id, fixture_type_id, rough_in_price, top_out_price, trim_set_price, total_price, sequence_order)
    VALUES
      (v_new_id, r.fixture_type_id, r.rough_in_price, r.top_out_price, r.trim_set_price, r.total_price, r.sequence_order)
    RETURNING id INTO v_new_entry_id;
    v_entry_map := v_entry_map || jsonb_build_object(r.id::text, v_new_entry_id::text);
  END LOOP;

  INSERT INTO public.bid_count_row_custom_prices (bid_id, count_row_id, price_book_version_id, unit_price)
  SELECT bid_id, count_row_id, v_new_id, unit_price
  FROM public.bid_count_row_custom_prices
  WHERE bid_id = p_bid_id AND price_book_version_id = p_source_version_id;

  INSERT INTO public.bid_count_row_submission_hides (bid_id, count_row_id, price_book_version_id)
  SELECT bid_id, count_row_id, v_new_id
  FROM public.bid_count_row_submission_hides
  WHERE bid_id = p_bid_id AND price_book_version_id = p_source_version_id;

  INSERT INTO public.bid_pricing_assignments
    (bid_id, count_row_id, price_book_entry_id, price_book_version_id, is_fixed_price, unit_price_override)
  SELECT bid_id, count_row_id, (v_entry_map->>price_book_entry_id::text)::uuid, v_new_id, is_fixed_price, unit_price_override
  FROM public.bid_pricing_assignments
  WHERE bid_id = p_bid_id
    AND price_book_version_id = p_source_version_id
    AND v_entry_map ? price_book_entry_id::text;

  RETURN v_new_id;
END;
$$;

-- (1) Atomic first split: materialize the current setup as a named version AND create the new
-- variant in one transaction. Returns the NEW variant's id (the one to activate).
CREATE OR REPLACE FUNCTION public.split_bid_into_versions(
  p_bid_id uuid,
  p_current_name text,
  p_new_name text,
  p_clone_pricing boolean,
  p_pricing_source_version_id uuid
) RETURNS uuid
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_base uuid;
  v_new uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  v_base := public.materialize_bid_version(p_bid_id, p_current_name);
  v_new := public.create_bid_version(p_bid_id, p_new_name, v_base, p_clone_pricing, p_pricing_source_version_id);
  RETURN v_new;
END;
$$;

ALTER FUNCTION public.split_bid_into_versions(uuid, text, text, boolean, uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.split_bid_into_versions(uuid, text, text, boolean, uuid) IS
  'Atomic first-split: materialize current setup as a named version + create a new variant, one transaction. Returns the new variant id.';
GRANT ALL ON FUNCTION public.split_bid_into_versions(uuid, text, text, boolean, uuid) TO anon;
GRANT ALL ON FUNCTION public.split_bid_into_versions(uuid, text, text, boolean, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.split_bid_into_versions(uuid, text, text, boolean, uuid) TO service_role;
