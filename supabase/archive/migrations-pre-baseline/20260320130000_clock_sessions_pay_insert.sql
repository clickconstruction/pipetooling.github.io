-- Pay-access can insert clock sessions (for split operation in People Hours)
CREATE POLICY "Pay access can insert clock sessions"
ON public.clock_sessions
FOR INSERT
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);
