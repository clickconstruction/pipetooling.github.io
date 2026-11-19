SET lock_timeout = '3s';

-- v2.7948: self_salary_clock_state hands the caller their own set week. The dashboard's salary probe
-- reads the caller's salary flags through it, so with the week on the same row My Time's Your hours
-- holds a salaried person to their own week instead of 40 hours. A helper cannot read their own pay
-- row, and this function is SECURITY DEFINER, so it is the one door. The week is hours, never pay, and
-- only ever the caller's own.
--
-- A function's returned columns cannot be changed in place, so it is dropped and made again inside
-- this migration's one transaction: the body of 20260817012837_self_salary_clock_state_rpc.sql, with
-- salaried_week_hours as a last column resolved the same way, id-first then the name match, and the
-- default week when the caller has no pay row. The quick-add functions read it by column name, so a
-- column more changes nothing for them. The grants are restated as they were.

DROP FUNCTION IF EXISTS public.self_salary_clock_state();

CREATE FUNCTION public.self_salary_clock_state()
RETURNS TABLE (is_salary boolean, record_hours_but_salary boolean, has_template boolean, salaried_week_hours numeric[])
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(
      (SELECT ppc.is_salary FROM public.people_pay_config ppc
       WHERE ppc.person_id IS NOT NULL
         AND ppc.person_id IN (SELECT p.id FROM public.people p WHERE p.account_user_id = auth.uid())
       LIMIT 1),
      (SELECT ppc.is_salary FROM public.people_pay_config ppc
       JOIN public.users u ON u.id = auth.uid() AND u.name IS NOT NULL
       WHERE btrim(ppc.person_name) = btrim(u.name)
       LIMIT 1),
      false) AS is_salary,
    COALESCE(
      (SELECT ppc.record_hours_but_salary FROM public.people_pay_config ppc
       WHERE ppc.person_id IS NOT NULL
         AND ppc.person_id IN (SELECT p.id FROM public.people p WHERE p.account_user_id = auth.uid())
       LIMIT 1),
      (SELECT ppc.record_hours_but_salary FROM public.people_pay_config ppc
       JOIN public.users u ON u.id = auth.uid() AND u.name IS NOT NULL
       WHERE btrim(ppc.person_name) = btrim(u.name)
       LIMIT 1),
      false) AS record_hours_but_salary,
    EXISTS (SELECT 1 FROM public.salary_work_schedule_templates t
            WHERE t.user_id = auth.uid()) AS has_template,
    COALESCE(
      (SELECT ppc.salaried_week_hours::numeric[] FROM public.people_pay_config ppc
       WHERE ppc.person_id IS NOT NULL
         AND ppc.person_id IN (SELECT p.id FROM public.people p WHERE p.account_user_id = auth.uid())
       LIMIT 1),
      (SELECT ppc.salaried_week_hours::numeric[] FROM public.people_pay_config ppc
       JOIN public.users u ON u.id = auth.uid() AND u.name IS NOT NULL
       WHERE btrim(ppc.person_name) = btrim(u.name)
       LIMIT 1),
      '{0,8,8,8,8,8,0}'::numeric[]) AS salaried_week_hours;
$$;

COMMENT ON FUNCTION public.self_salary_clock_state() IS
  'Self-probe for the salary clock UI: caller''s pay-config salary flags and own set week (person_id via people.account_user_id first, btrim-name fallback, the default week with no pay row) + whether they have a salary work-schedule template. One round trip; replaces the name-keyed client probes (identity Phase D). The week since v2.7948.';

REVOKE ALL ON FUNCTION public.self_salary_clock_state() FROM anon;
GRANT EXECUTE ON FUNCTION public.self_salary_clock_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.self_salary_clock_state() TO service_role;
