SET lock_timeout = '3s';

-- Hotfix (v2.3812): 20260831194854 re-created pay_staff_remove_not_coming_in_for_user_day
-- from the BASELINE body, which still gates on is_assistant_of_pay_approved_master() — a
-- helper dissolved and DROPPED by 20260714200000_dissolve_assistant_pay_linkage.sql (every
-- reference rewritten to plain is_assistant()). Since 2026-08-31 clearing a "Not coming in"
-- or "No call, no show" mark from Schedule Dispatch has raised "function ... does not exist"
-- for every caller (Taunya, 2026-09-24). Same signature, same delete predicate, same salary
-- re-sync and return shape; only the role gate changes to the post-sweep form — the exact
-- substitution the dissolve migration made (precedents: 20260805110000, 20260903030000).
-- scripts/check-migrations.sh now refuses any later migration that names the dropped helper.
CREATE OR REPLACE FUNCTION "public"."pay_staff_remove_not_coming_in_for_user_day"("p_user_id" "uuid", "p_work_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_deleted integer := 0;
  v_today date;
  v_should_sync boolean;
  v_sync_err text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.is_dev()
    OR public.is_pay_approved_master()
    OR public.is_assistant()
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL OR p_work_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'invalid arguments', 'deleted', 0);
  END IF;

  IF NOT public.salary_schedule_staff_or_self_target(p_user_id) THEN
    RAISE EXCEPTION 'not authorized for this user' USING ERRCODE = '42501';
  END IF;

  WITH d AS (
    DELETE FROM public.user_time_off
    WHERE user_id = p_user_id
      AND start_date = p_work_date
      AND end_date = p_work_date
      AND kind = 'unpaid'
      AND note IN ('Not coming in', 'No call, no show')
    RETURNING 1
  )
  SELECT count(*)::int INTO v_deleted FROM d;

  IF v_deleted = 0 THEN
    RETURN jsonb_build_object('ok', true, 'deleted', 0);
  END IF;

  v_today := (timezone('America/Denver', now()))::date;
  v_should_sync := v_today = p_work_date;

  IF v_should_sync THEN
    BEGIN
      PERFORM public.sync_salary_clock_sessions_for_user_day(p_user_id, p_work_date);
    EXCEPTION
      WHEN OTHERS THEN
        v_sync_err := SQLERRM;
    END;
  END IF;

  IF v_sync_err IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'deleted', v_deleted, 'sync_warning', v_sync_err);
  END IF;
  RETURN jsonb_build_object('ok', true, 'deleted', v_deleted);
END;
$$;

COMMENT ON FUNCTION "public"."pay_staff_remove_not_coming_in_for_user_day"("p_user_id" "uuid", "p_work_date" "date") IS 'Pay staff: delete the single-day unpaid "Not coming in" / "No call, no show" user_time_off entry created from Schedule Dispatch, then resync salary sessions for the day.';
