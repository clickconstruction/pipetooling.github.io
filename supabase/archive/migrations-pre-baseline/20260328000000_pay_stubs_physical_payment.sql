-- Physical payment tracking: when a pay stub was actually paid (cash, check, direct deposit)
-- Separate from stub creation; paid_at/paid_by mark when payment was made

ALTER TABLE public.pay_stubs
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pay_stubs.paid_at IS 'When the person was physically paid. NULL = stub created but not yet paid.';
COMMENT ON COLUMN public.pay_stubs.paid_by IS 'User who marked the stub as paid.';

CREATE POLICY "Pay access users can update pay stubs"
ON public.pay_stubs
FOR UPDATE
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
)
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);
