-- Common jobs: org-wide quick-add jobs for Assign User to Jobs modal
-- Editable by anyone with crew jobs access (dev, pay-approved master, assistant)

CREATE TABLE IF NOT EXISTS public.common_jobs (
  job_id UUID NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  sequence_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (job_id)
);

COMMENT ON TABLE public.common_jobs IS 'Org-wide quick-add jobs for Assign User to Jobs modal. Editable by anyone with crew jobs access.';

ALTER TABLE public.common_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pay access and shared can read common jobs"
ON public.common_jobs FOR SELECT USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
  OR public.is_cost_matrix_shared_with_current_user()
);

CREATE POLICY "Pay access users can insert common jobs"
ON public.common_jobs FOR INSERT WITH CHECK (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);

CREATE POLICY "Pay access users can delete common jobs"
ON public.common_jobs FOR DELETE USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);
