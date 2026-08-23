SET lock_timeout = '3s';

-- v2.2133 (Send or Compare F6b, decisions D7b/D7c/D8): "Adopt an existing bid" — fold a bid that
-- already sits on the board into another bid as one of its VERSIONS. The reverse of split. Its
-- counts, takeoff, price scenarios and GC move under the new version; its sent date/value become
-- that version's send history; the source bid retires from the board (adopted_into_bid_id) but is
-- never deleted and its number stays searchable. Labor/cost: the package keeps the target's; the
-- source's cost estimate stays on the source row for reference (D8).

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS adopted_into_bid_id uuid NULL REFERENCES public.bids(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS bids_adopted_into_idx ON public.bids (adopted_into_bid_id) WHERE adopted_into_bid_id IS NOT NULL;
COMMENT ON COLUMN public.bids.adopted_into_bid_id IS
  'Set when this bid was adopted as a version of another bid (v2.2133). Lists hide adopted bids; the row stays for history and number lookup.';

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
ALTER FUNCTION public.adopt_bid_as_version(uuid, uuid, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.adopt_bid_as_version(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adopt_bid_as_version(uuid, uuid, text, text) TO authenticated, service_role;
