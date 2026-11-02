SET lock_timeout = '3s';

-- Robot fixtures: fold a second robot source when a bid is adopted (punch list #226, v2.6326, 2026-11-02). Since v2.6230
-- an adopt moves every bid_count_sources row of the adopted bid onto the package under the new version, the robot's own
-- row too (source_kind = 'robot', written by robot_fixture_source when the estimator first takes robot fixtures). That
-- row carries no token, so the same-token guard never holds it back, and when both bids took robot fixtures the package
-- ended with two robot rows. Nothing failed — every robot lookup (robot_fixture_source, set_aside_robot_fixtures,
-- untake_robot_fixture_rows, untake_robot_fixtures) is LIMIT 1 — but Set aside or Undo could strip the wrong share and
-- leave a row shaded by a source that no longer exists, and the Counts tab's From tile drew two Robot chips. Found on
-- 2026-10-31 by the session that built #221, while #6637 and #6649 met in the merge queue.
--
-- The fix is robot_fixtures_fold_adopt, a SECURITY DEFINER helper in the shape of robot_fixtures_follow_adopt
-- (20261031015000) and adopt_logs_both_bids (20261031203414): once the adopt has moved the count sources, it finds the
-- package's own robot row (the one not on the new version — the bid-wide row first, else the oldest), re-keys
-- source_shares on every count row of the package that names any other robot row (the moved rows) to the package's
-- row, keeping the package's own value where a row already carried one, and deletes the duplicates. With no robot row
-- of the package's own, the moved row is the package's now and nothing changes. It refuses a signed-in caller who
-- cannot price both bids, keeps the digital-twin fence's rule (a definer skips the fence: a twin writes only on its own
-- bids), and writes only once the version is the package's; the read-only statement trigger still fires inside it.
-- adopt_bid_as_version is 20261031203414's body verbatim plus the call after the count-source move, with the folded
-- rows taken off the log line's CountTooling count (a folded row is not a project that arrived). No table, no column
-- changes; one new function, EXECUTE for authenticated and service_role, none for anon; no CREATE TABLE, so the three
-- fence calls are not made. Idempotent: CREATE OR REPLACE. Both SQL beds (bid_copies, robot_fixtures) carry the case.
-- See docs/migrations/20261102041932_robot_fixtures_adopt_fold.md.

-- ---------------------------------------------------------------- the helper: one robot source per package, as the owner

CREATE OR REPLACE FUNCTION public.robot_fixtures_fold_adopt(p_source_bid_id uuid, p_target_bid_id uuid, p_new_version_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keep uuid;
  v_dup uuid;
  v_n integer := 0;
BEGIN
  IF p_source_bid_id IS NULL OR p_target_bid_id IS NULL OR p_new_version_id IS NULL OR p_source_bid_id = p_target_bid_id THEN
    RETURN 0;
  END IF;
  -- The service role and the owner have no auth.uid() and are trusted; a signed-in caller must be able to price both
  -- bids (adopt_bid_as_version refuses them first).
  IF auth.uid() IS NOT NULL
     AND NOT (public.can_access_bid_for_pricing(p_source_bid_id) AND public.can_access_bid_for_pricing(p_target_bid_id)) THEN
    RAISE EXCEPTION 'robot_fixtures_fold_adopt: not allowed';
  END IF;
  -- A definer skips the digital-twin fence, so its rule is kept here: a twin writes only on its own bids (the bids it
  -- made or is the estimator of), the predicate the fence puts on every table that carries a bid_id.
  IF public.is_digital_twin() AND NOT (
       EXISTS (SELECT 1 FROM public.bids b WHERE b.id = p_source_bid_id AND (b.created_by = auth.uid() OR b.estimator_id = auth.uid()))
   AND EXISTS (SELECT 1 FROM public.bids b WHERE b.id = p_target_bid_id AND (b.created_by = auth.uid() OR b.estimator_id = auth.uid()))) THEN
    RAISE EXCEPTION 'robot_fixtures_fold_adopt: a twin writes only on its own bids';
  END IF;
  -- Only once the adopt has made the version on the package.
  IF NOT EXISTS (SELECT 1 FROM public.bid_versions v WHERE v.id = p_new_version_id AND v.bid_id = p_target_bid_id) THEN
    RAISE EXCEPTION 'robot_fixtures_fold_adopt: that version is not the package''s';
  END IF;
  -- The package's own robot row: the one that was there before the adopt, so not on the new version — the bid-wide
  -- row first, else the oldest. None means the moved row is the package's robot row now.
  SELECT s.id INTO v_keep
    FROM public.bid_count_sources s
   WHERE s.bid_id = p_target_bid_id AND s.source_kind = 'robot' AND s.bid_version_id IS DISTINCT FROM p_new_version_id
   ORDER BY (s.bid_version_id IS NULL) DESC, s.first_imported_at, s.id
   LIMIT 1;
  IF v_keep IS NULL THEN RETURN 0; END IF;
  -- Every other robot row on the package folds into it: the rows it shades are re-keyed (a row that already carries
  -- the package's share keeps that value), then the duplicate goes.
  FOR v_dup IN
    SELECT s.id FROM public.bid_count_sources s
     WHERE s.bid_id = p_target_bid_id AND s.source_kind = 'robot' AND s.id <> v_keep
     ORDER BY s.first_imported_at, s.id
  LOOP
    UPDATE public.bids_count_rows c
       SET source_shares = (c.source_shares - v_dup::text)
                           || jsonb_build_object(v_keep::text, COALESCE(c.source_shares -> v_keep::text, c.source_shares -> v_dup::text))
     WHERE c.bid_id = p_target_bid_id AND c.source_shares ? v_dup::text;
    DELETE FROM public.bid_count_sources WHERE id = v_dup;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.robot_fixtures_fold_adopt(uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.robot_fixtures_fold_adopt(uuid, uuid, uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.robot_fixtures_fold_adopt(uuid, uuid, uuid) IS
  'v2.6326 (punch list #226): an adopt that brings a second robot count source folds it into the package''s — the moved rows'' source_shares are re-keyed to the package''s robot row and the duplicate is deleted, so one package never carries two robot sources. Called by adopt_bid_as_version after the count sources move; as the owner, refused for a signed-in caller who cannot price both bids, held to a twin''s own bids, and only once the version is the package''s. Returns how many rows folded.';

-- ---------------------------------------------------------------- the adopt: the fold after the count sources move

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
  v_rows integer := 0;
  v_scen integer := 0;
  v_sets integer := 0;
  v_cts integer := 0;
  v_folded integer := 0;
  v_moved text;
  v_version_name text;
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
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  UPDATE public.bids_takeoff_template_mappings SET bid_id = p_target_bid_id, bid_version_id = v_new_id
    WHERE bid_id = p_source_bid_id AND bid_version_id IS NULL;
  UPDATE public.bids_takeoff_rough_part_lines SET bid_id = p_target_bid_id, bid_version_id = v_new_id
    WHERE bid_id = p_source_bid_id AND bid_version_id IS NULL;
  UPDATE public.price_book_versions SET bid_id = p_target_bid_id, bid_version_id = v_new_id
    WHERE bid_id = p_source_bid_id AND bid_version_id IS NULL;
  GET DIAGNOSTICS v_scen = ROW_COUNT;
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
  GET DIAGNOSTICS v_cts = ROW_COUNT;
  DELETE FROM public.bid_count_sources WHERE bid_id = p_source_bid_id;
  -- The robot's own row (punch list #226, v2.6326): it carries no token, so the same-token guard above never holds
  -- it back, and when the package already took robot fixtures the package ended with two robot rows — every robot
  -- lookup is LIMIT 1, so Set aside and Undo could strip the wrong share and the From tile read two Robot chips. The
  -- owner's helper re-keys the moved rows' shares to the package's robot row and deletes the duplicate, so one package
  -- never carries two robot sources; a folded row is not a project that arrived, so the log line leaves it out.
  v_folded := public.robot_fixtures_fold_adopt(p_source_bid_id, p_target_bid_id, v_new_id);
  v_cts := GREATEST(v_cts - v_folded, 0);
  IF NULLIF(trim(v_source.count_tooling_link), '') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.bid_count_sources t WHERE t.bid_id = p_target_bid_id AND t.link = trim(v_source.count_tooling_link)) THEN
    INSERT INTO public.bid_count_sources (bid_id, bid_version_id, link, token, project_name, scope, imported_by)
    VALUES (p_target_bid_id, v_new_id, trim(v_source.count_tooling_link),
            substring(v_source.count_tooling_link from 't=([0-9a-fA-F-]{36})'),
            NULL, 'unknown', auth.uid());
    v_cts := v_cts + 1;
  END IF;
  UPDATE public.bid_plan_sets
     SET bid_id = p_target_bid_id, bid_version_id = v_new_id,
         memo = left(trim(both ' ' from concat_ws(' · ', 'From B' || COALESCE(v_source.bid_number::text, '?') || ', adopted as the version ' || COALESCE(NULLIF(p_name, ''), v_source.project_name, 'Adopted bid'), NULLIF(memo, ''))), 2000)
   WHERE bid_id = p_source_bid_id;
  GET DIAGNOSTICS v_sets = ROW_COUNT;
  IF NULLIF(trim(v_source.plans_link), '') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.bid_plan_sets s WHERE s.bid_id = p_target_bid_id AND s.link = trim(v_source.plans_link)) THEN
    INSERT INTO public.bid_plan_sets (bid_id, bid_version_id, name, memo, link, created_by)
    VALUES (p_target_bid_id, v_new_id, 'Plans',
            left('From B' || COALESCE(v_source.bid_number::text, '?') || ', adopted as the version ' || COALESCE(NULLIF(p_name, ''), v_source.project_name, 'Adopted bid') || ' · the set it bid from', 2000),
            trim(v_source.plans_link), auth.uid());
    v_sets := v_sets + 1;
  END IF;

  -- A line on both bids' logs (v2.6250): the adopt itself left no trace before — the change ledger
  -- attributed every moved row to the target, and the source's retirement is not a column it records —
  -- so an investigator reading the source saw nothing. The words name who, which bid, the version and
  -- what moved; the counts are the moves above. Written through the owner's helper: the insert policy on
  -- bids_submission_entries admits fewer roles than may adopt (no primary, no superintendent), so written
  -- as the caller their adopt failed on RLS here and rolled back whole.
  v_version_name := COALESCE(NULLIF(p_name, ''), v_source.project_name, 'Adopted bid');
  v_moved := format('%s count row%s, %s price scenario%s, %s plan set%s, %s CountTooling project%s',
                    v_rows, CASE WHEN v_rows = 1 THEN '' ELSE 's' END,
                    v_scen, CASE WHEN v_scen = 1 THEN '' ELSE 's' END,
                    v_sets, CASE WHEN v_sets = 1 THEN '' ELSE 's' END,
                    v_cts,  CASE WHEN v_cts = 1 THEN '' ELSE 's' END);
  PERFORM public.adopt_logs_both_bids(p_source_bid_id, p_target_bid_id, v_new_id, v_version_name, v_moved);

  -- Retire the source row from the board (never deleted; number stays searchable). Its remembered price
  -- scenario moved above and is the new version's ★ when it was one of the moved ones, so the pointer on the
  -- retired row is cleared (v2.6250): left in place it named a scenario of another bid's version, and the
  -- readers that treat a version-less bid's pointer as its ★ (the package map, the share bundle, the priced
  -- rows loader) drew it. This column is one the change ledger records, so the source's own history now
  -- carries a row for the day it was adopted.
  UPDATE public.bids SET adopted_into_bid_id = p_target_bid_id,
                         working_board_archived_at = COALESCE(working_board_archived_at, now()),
                         selected_price_book_version_id = NULL
   WHERE id = p_source_bid_id;

  RETURN v_new_id;
END;
$$;
