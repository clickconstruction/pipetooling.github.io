-- Hours Days Correct: marks a day as verified/locked so Hours tab cannot edit it
-- Anyone with pay/hours access can mark days correct; prevents accidental edits before payroll
-- Same RLS as people_hours

CREATE TABLE IF NOT EXISTS public.hours_days_correct (
  work_date DATE PRIMARY KEY,
  marked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  marked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hours_days_correct_work_date ON public.hours_days_correct(work_date);

COMMENT ON TABLE public.hours_days_correct IS 'Days marked as correct in Hours tab; locks that day from further edits. Used for payroll clarity.';

ALTER TABLE public.hours_days_correct ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pay access users can read hours days correct"
ON public.hours_days_correct
FOR SELECT
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);

CREATE POLICY "Pay access users can insert hours days correct"
ON public.hours_days_correct
FOR INSERT
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);

CREATE POLICY "Pay access users can delete hours days correct"
ON public.hours_days_correct
FOR DELETE
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);
