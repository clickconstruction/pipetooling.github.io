-- Ensure all assistants (not just pay-approved) can manage common_jobs
-- Fixes case where remote may have been created with is_assistant_of_pay_approved_master only

DROP POLICY IF EXISTS "Pay access users can insert common jobs" ON public.common_jobs;
CREATE POLICY "Pay access users can insert common jobs"
ON public.common_jobs FOR INSERT WITH CHECK (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);

DROP POLICY IF EXISTS "Pay access users can delete common jobs" ON public.common_jobs;
CREATE POLICY "Pay access users can delete common jobs"
ON public.common_jobs FOR DELETE USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);

DROP POLICY IF EXISTS "Pay access and shared can read common jobs" ON public.common_jobs;
CREATE POLICY "Pay access and shared can read common jobs"
ON public.common_jobs FOR SELECT USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
  OR public.is_cost_matrix_shared_with_current_user()
);
