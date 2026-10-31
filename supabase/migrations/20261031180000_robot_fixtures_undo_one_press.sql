SET lock_timeout = '3s';

-- Robot fixtures, Undo takes back one press (punch list #221, v2.6237). untake_robot_fixtures(p_pull_id) took back every
-- robot row of the pull that the estimator had not edited, so Undo on the toast after a second Add ("1 fixture added from
-- the robot.") also took back the four fixtures of the first Add. Found by the owner-approved walk-through on ZZ b569,
-- 2026-10-31. untake_robot_fixture_rows(p_pull_id, p_row_ids) takes back only the rows a press took (NULL = every taken
-- row, the old behaviour), and untake_robot_fixtures(p_pull_id) is now that call with NULL, so the rule lives in one
-- place and the deployed client keeps working until the new one ships. The toast's Undo passes the press's rows.
-- No table is created, so the three fences are not called.

CREATE OR REPLACE FUNCTION public.untake_robot_fixture_rows(p_pull_id uuid, p_row_ids uuid[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_bid_id uuid;
  v_source_id uuid;
  v_row public.bid_fixture_pull_rows;
  v_cnt numeric;
  v_removed integer := 0;
  v_restored integer := 0;
  v_kept integer := 0;
BEGIN
  SELECT p.bid_id INTO v_bid_id FROM public.bid_fixture_pulls p WHERE p.id = p_pull_id;
  PERFORM public.robot_fixture_gate(v_bid_id, 'untake_robot_fixture_rows');
  SELECT s.id INTO v_source_id FROM public.bid_count_sources s WHERE s.bid_id = v_bid_id AND s.source_kind = 'robot' LIMIT 1;
  FOR v_row IN
    SELECT pr.* FROM public.bid_fixture_pull_rows pr
     WHERE pr.pull_id = p_pull_id AND pr.taken_at IS NOT NULL AND (p_row_ids IS NULL OR pr.id = ANY (p_row_ids))
     ORDER BY pr.sequence_order
  LOOP
    SELECT c.count INTO v_cnt FROM public.bids_count_rows c WHERE c.id = v_row.count_row_id;
    IF v_row.taken_as = 'added' AND v_cnt IS NOT NULL AND v_cnt <> v_row.count THEN
      v_kept := v_kept + 1;
      CONTINUE; -- she changed it: it is hers now, share and all
    END IF;
    IF v_row.taken_as = 'updated' AND v_cnt IS NOT NULL THEN
      UPDATE public.bids_count_rows c
         SET count = COALESCE(v_row.prior_count, c.count),
             source_shares = CASE WHEN v_source_id IS NULL THEN c.source_shares
                                  ELSE NULLIF(COALESCE(c.source_shares, '{}'::jsonb) - v_source_id::text, '{}'::jsonb) END
       WHERE c.id = v_row.count_row_id;
      v_restored := v_restored + 1;
    END IF;
    UPDATE public.bid_fixture_pull_rows
       SET taken_at = NULL, taken_by = NULL, taken_as = NULL, taken_version_id = NULL, prior_count = NULL, taken_count = NULL,
           count_row_id = NULL, priced_as = NULL, custom_price_id = NULL
     WHERE id = v_row.id;
    -- The pull row let go first (see set_aside_robot_fixtures); the untouched row it added goes now.
    IF v_row.taken_as = 'added' AND v_cnt IS NOT NULL THEN
      DELETE FROM public.bids_count_rows WHERE id = v_row.count_row_id;
      v_removed := v_removed + 1;
    END IF;
  END LOOP;
  IF v_source_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.bids_count_rows c WHERE c.bid_id = v_bid_id AND c.source_shares ? v_source_id::text) THEN
    DELETE FROM public.bid_count_sources WHERE id = v_source_id;
  END IF;
  INSERT INTO public.bids_submission_entries (bid_id, notes, created_by)
  VALUES (v_bid_id, '[robot fixtures] undo: ' || v_removed || ' rows removed, ' || v_restored || ' put back to her number, ' || v_kept
                    || ' kept (edited since) via untake_robot_fixture_rows. The run stays assisted: she saw them.', v_user);
  RETURN jsonb_build_object('removed', v_removed, 'restored', v_restored, 'kept', v_kept);
END;
$$;
REVOKE ALL ON FUNCTION public.untake_robot_fixture_rows(uuid, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.untake_robot_fixture_rows(uuid, uuid[]) TO authenticated, service_role;

-- The old door: every taken row of the pull, through the new one.
CREATE OR REPLACE FUNCTION public.untake_robot_fixtures(p_pull_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.untake_robot_fixture_rows(p_pull_id, NULL);
$$;
REVOKE ALL ON FUNCTION public.untake_robot_fixtures(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.untake_robot_fixtures(uuid) TO authenticated, service_role;
