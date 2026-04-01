-- Salary sync: process prior calendar day + anchor day so open salary_schedule rows
-- from "yesterday" close after midnight when cron runs for Chicago "today".

CREATE OR REPLACE FUNCTION public.sync_salary_clock_sessions_for_day(p_work_date date DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date;
  r_user record;
BEGIN
  d := COALESCE(p_work_date, (timezone('America/Chicago', now()))::date);
  FOR r_user IN SELECT user_id FROM public.salary_work_schedule_templates
  LOOP
    PERFORM public.salary_sync_one_user_clock_sessions(r_user.user_id, d - 1, now());
    PERFORM public.salary_sync_one_user_clock_sessions(r_user.user_id, d, now());
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.sync_salary_clock_sessions_for_day(date) IS 'Service role: sync all salary templates for d-1 and d (Chicago calendar anchor; default Chicago today).';

REVOKE ALL ON FUNCTION public.sync_salary_clock_sessions_for_day(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_salary_clock_sessions_for_day(date) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_salary_clock_sessions_for_user_day(p_user_id uuid, p_work_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    auth.uid() = p_user_id
    OR public.is_dev()
    OR public.is_pay_approved_master()
    OR public.is_assistant_of_pay_approved_master()
    OR public.is_assistant()
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  PERFORM public.salary_sync_one_user_clock_sessions(p_user_id, p_work_date - 1, now());
  PERFORM public.salary_sync_one_user_clock_sessions(p_user_id, p_work_date, now());
END;
$$;

COMMENT ON FUNCTION public.sync_salary_clock_sessions_for_user_day(uuid, date) IS 'Authenticated user (self or pay staff): refresh salary sessions for p_work_date-1 and p_work_date.';

REVOKE ALL ON FUNCTION public.sync_salary_clock_sessions_for_user_day(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_salary_clock_sessions_for_user_day(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_salary_clock_sessions_for_user_day(uuid, date) TO service_role;
