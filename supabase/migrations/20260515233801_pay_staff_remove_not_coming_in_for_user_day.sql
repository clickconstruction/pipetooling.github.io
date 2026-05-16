-- Pay staff: undo the "Not coming in" mark for one user/day from Schedule Dispatch.
-- Symmetric to `pay_staff_bulk_insert_user_time_off`: SECURITY DEFINER, same authz
-- gate, same per-target check, scoped to the *exact* row our action creates
-- (single-day, kind='unpaid', note='Not coming in'), then resyncs salary
-- sessions for that day so anything hidden by the time-off entry comes back.

CREATE OR REPLACE FUNCTION public.pay_staff_remove_not_coming_in_for_user_day(
  p_user_id uuid,
  p_work_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
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
    OR public.is_assistant_of_pay_approved_master()
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

  -- Tight scope: only the exact "Not coming in" rows we created from the
  -- dispatch flow (single-day, unpaid, exact note). PTO and other ranges
  -- are intentionally not touched here.
  WITH d AS (
    DELETE FROM public.user_time_off
    WHERE user_id = p_user_id
      AND start_date = p_work_date
      AND end_date = p_work_date
      AND kind = 'unpaid'
      AND note = 'Not coming in'
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
$body$;

COMMENT ON FUNCTION public.pay_staff_remove_not_coming_in_for_user_day(uuid, date) IS
'Pay staff: delete the single-day unpaid "Not coming in" user_time_off entry created from Schedule Dispatch, then resync salary sessions for the day.';

REVOKE ALL ON FUNCTION public.pay_staff_remove_not_coming_in_for_user_day(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_staff_remove_not_coming_in_for_user_day(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_staff_remove_not_coming_in_for_user_day(uuid, date) TO service_role;
