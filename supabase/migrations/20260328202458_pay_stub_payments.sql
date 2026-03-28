-- Partial physical payments per pay stub (amount + paid_at + memo).
-- Same RLS pattern as pay_stub_days.

CREATE TABLE IF NOT EXISTS public.pay_stub_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_stub_id UUID NOT NULL REFERENCES public.pay_stubs(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  paid_at TIMESTAMPTZ NOT NULL,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pay_stub_payments_pay_stub_id ON public.pay_stub_payments(pay_stub_id);
CREATE INDEX IF NOT EXISTS idx_pay_stub_payments_stub_paid_at ON public.pay_stub_payments(pay_stub_id, paid_at);

COMMENT ON TABLE public.pay_stub_payments IS 'Installments physically paid against a pay stub. Sum of amounts must not exceed pay_stubs.gross_pay.';

CREATE OR REPLACE FUNCTION public.pay_stub_payments_enforce_total_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_gross numeric;
  v_sum_excl numeric;
BEGIN
  SELECT gross_pay INTO v_gross FROM public.pay_stubs WHERE id = NEW.pay_stub_id;
  IF v_gross IS NULL THEN
    RAISE EXCEPTION 'pay stub not found for pay_stub_id %', NEW.pay_stub_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_sum_excl
    FROM public.pay_stub_payments
    WHERE pay_stub_id = NEW.pay_stub_id;
  ELSE
    SELECT COALESCE(SUM(amount), 0) INTO v_sum_excl
    FROM public.pay_stub_payments
    WHERE pay_stub_id = NEW.pay_stub_id
      AND id <> OLD.id;
  END IF;

  IF v_sum_excl + NEW.amount > v_gross + 0.01 THEN
    RAISE EXCEPTION 'pay_stub_payments total would exceed gross pay for stub %', NEW.pay_stub_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pay_stub_payments_enforce_total_tr ON public.pay_stub_payments;
CREATE TRIGGER pay_stub_payments_enforce_total_tr
  BEFORE INSERT OR UPDATE OF amount, pay_stub_id ON public.pay_stub_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.pay_stub_payments_enforce_total_fn();

ALTER TABLE public.pay_stub_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pay access users can read pay stub payments"
ON public.pay_stub_payments
FOR SELECT
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);

CREATE POLICY "Pay access users can insert pay stub payments"
ON public.pay_stub_payments
FOR INSERT
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);

CREATE POLICY "Pay access users can update pay stub payments"
ON public.pay_stub_payments
FOR UPDATE
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
)
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);

CREATE POLICY "Pay access users can delete pay stub payments"
ON public.pay_stub_payments
FOR DELETE
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);

INSERT INTO public.pay_stub_payments (pay_stub_id, amount, paid_at, memo, created_by)
SELECT
  ps.id,
  ps.gross_pay,
  ps.paid_at,
  NULLIF(TRIM(ps.paid_note), ''),
  ps.paid_by
FROM public.pay_stubs ps
WHERE ps.paid_at IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM public.pay_stub_payments p WHERE p.pay_stub_id = ps.id);
