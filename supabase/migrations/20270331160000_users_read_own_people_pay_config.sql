-- Allow any signed-in user to SELECT their own people_pay_config row when person_name matches users.name.
-- Fixes Settings → Salaried workday for roles that are not pay masters/assistants/cost-matrix shared (e.g. superintendent).

DROP POLICY IF EXISTS "Users can read own people pay config row" ON public.people_pay_config;

CREATE POLICY "Users can read own people pay config row"
ON public.people_pay_config
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND btrim(u.name) = btrim(people_pay_config.person_name)
  )
);

COMMENT ON POLICY "Users can read own people pay config row" ON public.people_pay_config IS
  'Self-service read for salary schedule Settings; matches SalaryWorkScheduleSettings client (users.name = person_name).';
