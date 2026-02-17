-- Allow all assistants to access Hours tab and edit people_hours
-- (previously only assistants of pay-approved masters could)

CREATE OR REPLACE FUNCTION public.is_assistant()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'assistant');
$$;

-- Update people_hours: add is_assistant() to all policies
DROP POLICY IF EXISTS "Pay access users can read people hours" ON public.people_hours;
CREATE POLICY "Pay access users can read people hours"
ON public.people_hours
FOR SELECT
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);

DROP POLICY IF EXISTS "Pay access users can insert people hours" ON public.people_hours;
CREATE POLICY "Pay access users can insert people hours"
ON public.people_hours
FOR INSERT
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);

DROP POLICY IF EXISTS "Pay access users can update people hours" ON public.people_hours;
CREATE POLICY "Pay access users can update people hours"
ON public.people_hours
FOR UPDATE
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
)
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);

-- Assistants need to read people_pay_config for Hours tab (show_in_hours, is_salary)
CREATE POLICY "Assistants can read people pay config for Hours tab"
ON public.people_pay_config
FOR SELECT
USING (public.is_assistant());
