-- An adopted bid's CountTooling projects and plan sets come along as the new version's own (2026-10-31,
-- v2.6230). The owner, on estimators who bid the same job as separate bids before versions existed: *the
-- William version has its own count tooling and his own pricing. He also bid an older version of the plans.*
-- `adopt_bid_as_version` already moves the counts, takeoff and pricing per version; `bid_count_sources` and
-- `bid_plan_sets` keyed on the bid alone and stayed behind on the retired row. Both gain a nullable version
-- key, and the adopt carries them, naming the source bid in each plan set's memo. Additive, idempotent.
SET lock_timeout = '3s';

ALTER TABLE public.bid_count_sources
  ADD COLUMN IF NOT EXISTS bid_version_id uuid NULL REFERENCES public.bid_versions(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.bid_count_sources.bid_version_id IS
  'The bid version this CountTooling project counts for (2026-10-31): set when an adopted bid brought it; NULL = the bid as a whole.';
CREATE INDEX IF NOT EXISTS bid_count_sources_version ON public.bid_count_sources (bid_version_id) WHERE bid_version_id IS NOT NULL;

ALTER TABLE public.bid_plan_sets
  ADD COLUMN IF NOT EXISTS bid_version_id uuid NULL REFERENCES public.bid_versions(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.bid_plan_sets.bid_version_id IS
  'The bid version this set of plans was bid from (2026-10-31): set when an adopted bid brought it; NULL = the bid as a whole.';
CREATE INDEX IF NOT EXISTS bid_plan_sets_version ON public.bid_plan_sets (bid_version_id) WHERE bid_version_id IS NOT NULL;

-- adopt_bid_as_version: 20261031015000's body (the pull tables move through robot_fixtures_follow_adopt, a SECURITY DEFINER
-- helper, since 20261030230000 closed them to authenticated) with the two carries before the source retires.
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

  -- The CountTooling projects behind the source's counts and the plan sets it bid from come along as the
  -- new version's own (2026-10-31, the owner: an estimator's separate bid has *its own count tooling and
  -- its own pricing, and he bid an older version of the plans*). A project or set the target already holds
  -- by the same link stays the target's; the source's own link on the bid itself becomes a row when no row
  -- carries it. Each plan set's memo names where it came from.
  UPDATE public.bid_count_sources
     SET bid_id = p_target_bid_id, bid_version_id = v_new_id
   WHERE bid_id = p_source_bid_id
     AND NOT EXISTS (SELECT 1 FROM public.bid_count_sources t WHERE t.bid_id = p_target_bid_id AND t.token IS NOT NULL AND t.token = bid_count_sources.token);
  DELETE FROM public.bid_count_sources WHERE bid_id = p_source_bid_id;
  IF NULLIF(trim(v_source.count_tooling_link), '') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.bid_count_sources t WHERE t.bid_id = p_target_bid_id AND t.link = trim(v_source.count_tooling_link)) THEN
    INSERT INTO public.bid_count_sources (bid_id, bid_version_id, link, token, project_name, scope, imported_by)
    VALUES (p_target_bid_id, v_new_id, trim(v_source.count_tooling_link),
            substring(v_source.count_tooling_link from 't=([0-9a-fA-F-]{36})'),
            NULL, 'unknown', auth.uid());
  END IF;
  UPDATE public.bid_plan_sets
     SET bid_id = p_target_bid_id, bid_version_id = v_new_id,
         memo = left(trim(both ' ' from concat_ws(' · ', 'From B' || COALESCE(v_source.bid_number::text, '?') || ', adopted as the version ' || COALESCE(NULLIF(p_name, ''), v_source.project_name, 'Adopted bid'), NULLIF(memo, ''))), 2000)
   WHERE bid_id = p_source_bid_id;
  IF NULLIF(trim(v_source.plans_link), '') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.bid_plan_sets s WHERE s.bid_id = p_target_bid_id AND s.link = trim(v_source.plans_link)) THEN
    INSERT INTO public.bid_plan_sets (bid_id, bid_version_id, name, memo, link, created_by)
    VALUES (p_target_bid_id, v_new_id, 'Plans',
            left('From B' || COALESCE(v_source.bid_number::text, '?') || ', adopted as the version ' || COALESCE(NULLIF(p_name, ''), v_source.project_name, 'Adopted bid') || ' · the set it bid from', 2000),
            trim(v_source.plans_link), auth.uid());
  END IF;

  -- Retire the source row from the board (never deleted; number stays searchable).
  UPDATE public.bids SET adopted_into_bid_id = p_target_bid_id,
                         working_board_archived_at = COALESCE(working_board_archived_at, now())
   WHERE id = p_source_bid_id;

  RETURN v_new_id;
END;
$$;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
