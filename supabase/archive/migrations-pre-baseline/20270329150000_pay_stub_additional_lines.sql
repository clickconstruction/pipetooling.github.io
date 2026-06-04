-- Additional pay lines (qty × rate) per pay stub.
-- Net Pay = gross_pay - sum(pay_stub_deductions.amount) + sum(pay_stub_additional_lines.line_total).
-- Installments (pay_stub_payments) cap at Net Pay.

CREATE TABLE IF NOT EXISTS public.pay_stub_additional_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_stub_id UUID NOT NULL REFERENCES public.pay_stubs(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  quantity NUMERIC(14, 4) NOT NULL CHECK (quantity >= 0),
  rate NUMERIC(14, 4) NOT NULL CHECK (rate >= 0),
  line_total NUMERIC(12, 2) GENERATED ALWAYS AS (round(quantity * rate, 2)) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pay_stub_additional_lines_pay_stub_id
  ON public.pay_stub_additional_lines(pay_stub_id);

COMMENT ON TABLE public.pay_stub_additional_lines IS
  'Additional compensation lines on a pay stub (quantity × rate). line_total is generated. Net Pay includes sum(line_total).';

CREATE OR REPLACE FUNCTION public.validate_pay_stub_payments_vs_net(p_stub uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_gross numeric;
  v_ded numeric;
  v_add numeric;
  v_paid numeric;
  v_net numeric;
BEGIN
  IF p_stub IS NULL THEN
    RETURN;
  END IF;
  SELECT gross_pay INTO v_gross FROM public.pay_stubs WHERE id = p_stub;
  IF v_gross IS NULL THEN
    RETURN;
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO v_ded FROM public.pay_stub_deductions WHERE pay_stub_id = p_stub;
  SELECT COALESCE(SUM(line_total), 0) INTO v_add FROM public.pay_stub_additional_lines WHERE pay_stub_id = p_stub;
  SELECT COALESCE(SUM(amount), 0) INTO v_paid FROM public.pay_stub_payments WHERE pay_stub_id = p_stub;
  v_net := v_gross - v_ded + v_add;
  IF v_paid > v_net + 0.01 THEN
    RAISE EXCEPTION 'pay_stub_payments total (%) exceeds net pay (%) for stub %', v_paid, v_net, p_stub;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_stub_payments_enforce_total_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_gross numeric;
  v_ded numeric;
  v_add numeric;
  v_net numeric;
  v_sum_excl numeric;
BEGIN
  SELECT gross_pay INTO v_gross FROM public.pay_stubs WHERE id = NEW.pay_stub_id;
  IF v_gross IS NULL THEN
    RAISE EXCEPTION 'pay stub not found for pay_stub_id %', NEW.pay_stub_id;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_ded FROM public.pay_stub_deductions WHERE pay_stub_id = NEW.pay_stub_id;
  SELECT COALESCE(SUM(line_total), 0) INTO v_add FROM public.pay_stub_additional_lines WHERE pay_stub_id = NEW.pay_stub_id;
  v_net := v_gross - v_ded + v_add;

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

  IF v_sum_excl + NEW.amount > v_net + 0.01 THEN
    RAISE EXCEPTION 'pay_stub_payments total would exceed net pay for stub %', NEW.pay_stub_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON TABLE public.pay_stub_payments IS
  'Installments physically paid against a pay stub. Sum of amounts must not exceed Net Pay (gross_pay minus pay_stub_deductions plus pay_stub_additional_lines).';

CREATE OR REPLACE FUNCTION public.pay_stub_additional_lines_after_validate_payments_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.validate_pay_stub_payments_vs_net(OLD.pay_stub_id);
  ELSIF TG_OP = 'UPDATE' AND NEW.pay_stub_id IS DISTINCT FROM OLD.pay_stub_id THEN
    PERFORM public.validate_pay_stub_payments_vs_net(OLD.pay_stub_id);
    PERFORM public.validate_pay_stub_payments_vs_net(NEW.pay_stub_id);
  ELSE
    PERFORM public.validate_pay_stub_payments_vs_net(NEW.pay_stub_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS pay_stub_additional_lines_after_validate_payments_tr ON public.pay_stub_additional_lines;
CREATE TRIGGER pay_stub_additional_lines_after_validate_payments_tr
  AFTER INSERT OR UPDATE OF quantity, rate, pay_stub_id OR DELETE
  ON public.pay_stub_additional_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.pay_stub_additional_lines_after_validate_payments_fn();

ALTER TABLE public.pay_stub_additional_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pay access users can read pay stub additional lines"
ON public.pay_stub_additional_lines
FOR SELECT
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);

CREATE POLICY "Pay access users can insert pay stub additional lines"
ON public.pay_stub_additional_lines
FOR INSERT
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);

CREATE POLICY "Pay access users can update pay stub additional lines"
ON public.pay_stub_additional_lines
FOR UPDATE
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
)
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);

CREATE POLICY "Pay access users can delete pay stub additional lines"
ON public.pay_stub_additional_lines
FOR DELETE
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);
