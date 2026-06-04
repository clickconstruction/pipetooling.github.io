-- Pay staff: remove salary_work_schedule_templates + day_overrides by people_pay_config.person_name
-- (matches users.name after trim), then refresh salary sync for Denver today.
-- Returns jsonb so missing login user is a normal response (not only silent client failure).

CREATE OR REPLACE FUNCTION public.pay_staff_clear_salary_schedule_by_person_name(p_person_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_uid uuid;
  v_today date;
  v_caller_is_superintendent boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'not_authenticated',
      'message', 'Not signed in.'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'superintendent'
  ) INTO v_caller_is_superintendent;

  IF NOT (
    public.is_dev()
    OR public.is_pay_approved_master()
    OR public.is_assistant_of_pay_approved_master()
    OR public.is_assistant()
    OR v_caller_is_superintendent
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'not_authorized',
      'message', 'Not authorized.'
    );
  END IF;

  IF p_person_name IS NULL OR btrim(p_person_name) = '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'invalid_name',
      'message', 'Person name is required.'
    );
  END IF;

  SELECT u.id INTO v_uid
  FROM public.users u
  WHERE btrim(u.name) = btrim(p_person_name)
  ORDER BY u.id
  LIMIT 1;

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'no_login_user',
      'message',
      'No user account matches this pay name. Align users.name with people_pay_config.person_name, or remove the salaried workday in Settings.'
    );
  END IF;

  IF NOT (
    public.salary_schedule_staff_or_self_target(v_uid)
    OR (
      v_caller_is_superintendent
      AND public.is_team_lead_for_member(auth.uid(), v_uid)
    )
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'not_authorized_target',
      'message', 'Not authorized to clear schedule for this person.'
    );
  END IF;

  DELETE FROM public.salary_work_schedule_templates WHERE user_id = v_uid;
  DELETE FROM public.salary_work_schedule_day_overrides WHERE user_id = v_uid;

  v_today := (timezone('America/Denver', now()))::date;
  PERFORM public.sync_salary_clock_sessions_for_user_day(v_uid, v_today);

  RETURN jsonb_build_object('ok', true, 'user_id', v_uid::text);
END;
$body$;

COMMENT ON FUNCTION public.pay_staff_clear_salary_schedule_by_person_name(text) IS
'Pay staff / team-lead superintendent: delete salary_work_schedule_templates and salary_work_schedule_day_overrides for the user whose users.name matches p_person_name (trim), then sync_salary_clock_sessions_for_user_day for Denver today.';

REVOKE ALL ON FUNCTION public.pay_staff_clear_salary_schedule_by_person_name(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_staff_clear_salary_schedule_by_person_name(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_staff_clear_salary_schedule_by_person_name(text) TO service_role;
