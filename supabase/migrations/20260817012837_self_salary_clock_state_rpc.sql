SET lock_timeout = '3s';

-- Person-identity Phase D (docs/PERSON_IDENTITY_PLAN.md): the salaryUiActive
-- self-probes (ClockInOutButton + two Dashboard effects) matched
-- people_pay_config by person_name = users.name — the C1-5 "deliberately
-- skipped" hot-path read. This RPC replaces each probe's TWO parallel queries
-- with ONE round trip that resolves the caller id-first:
--   people.account_user_id = auth.uid() -> people_pay_config.person_id,
-- falling back to the legacy btrim(users.name) match, so a renamed user's
-- salary clock UI no longer flips to hourly. SECURITY DEFINER also frees the
-- probe from the name-keyed self-read RLS policy on people_pay_config.

CREATE OR REPLACE FUNCTION public.self_salary_clock_state()
RETURNS TABLE (is_salary boolean, record_hours_but_salary boolean, has_template boolean)
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
            WHERE t.user_id = auth.uid()) AS has_template;
$$;

COMMENT ON FUNCTION public.self_salary_clock_state() IS
  'Self-probe for the salary clock UI: caller''s pay-config salary flags (person_id via people.account_user_id first, btrim-name fallback) + whether they have a salary work-schedule template. One round trip; replaces the name-keyed client probes (identity Phase D).';

REVOKE ALL ON FUNCTION public.self_salary_clock_state() FROM anon;
GRANT EXECUTE ON FUNCTION public.self_salary_clock_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.self_salary_clock_state() TO service_role;
