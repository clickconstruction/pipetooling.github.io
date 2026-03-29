-- Less (deductions) per pay stub: manual lines or offset-linked. Net Pay = gross_pay - sum(deductions).
-- Installments (pay_stub_payments) cap at Net Pay.

CREATE TABLE IF NOT EXISTS public.pay_stub_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_stub_id UUID NOT NULL REFERENCES public.pay_stubs(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  source TEXT NOT NULL CHECK (source IN ('manual', 'offset')),
  person_offset_id UUID REFERENCES public.person_offsets(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pay_stub_deductions_pay_stub_id ON public.pay_stub_deductions(pay_stub_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pay_stub_deductions_person_offset_id_unique
ON public.pay_stub_deductions(person_offset_id)
WHERE person_offset_id IS NOT NULL;

COMMENT ON TABLE public.pay_stub_deductions IS 'Deductions (Less) against a pay stub: manual or linked to person_offsets. Sum must not exceed gross_pay; installments cap at gross minus this sum (Net Pay).';

-- Backfill before triggers so existing rows skip payment-vs-net validation (legacy totals may exceed net until adjusted).
INSERT INTO public.pay_stub_deductions (pay_stub_id, amount, source, person_offset_id, description, created_at)
SELECT
  po.pay_stub_id,
  po.amount,
  'offset',
  po.id,
  TRIM(
    CASE po.type
      WHEN 'backcharge' THEN 'Backcharge'
      ELSE 'Damage'
    END
    || CASE
      WHEN po.description IS NOT NULL AND TRIM(po.description) <> '' THEN ': ' || TRIM(po.description)
      ELSE ''
    END
  ),
  po.created_at
FROM public.person_offsets po
WHERE po.pay_stub_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.pay_stub_deductions d WHERE d.person_offset_id = po.id
  );

-- Deductions total must not exceed stub gross (Net Pay >= 0).
CREATE OR REPLACE FUNCTION public.pay_stub_deductions_enforce_gross_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_gross numeric;
  v_sum_excl numeric;
  v_new_total numeric;
  v_stub uuid;
BEGIN
  v_stub := COALESCE(NEW.pay_stub_id, OLD.pay_stub_id);

  SELECT gross_pay INTO v_gross FROM public.pay_stubs WHERE id = v_stub;
  IF v_gross IS NULL THEN
    RAISE EXCEPTION 'pay stub not found for pay_stub_id %', v_stub;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_sum_excl
    FROM public.pay_stub_deductions
    WHERE pay_stub_id = NEW.pay_stub_id;
    v_new_total := v_sum_excl + NEW.amount;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_sum_excl
    FROM public.pay_stub_deductions
    WHERE pay_stub_id = NEW.pay_stub_id
      AND id <> NEW.id;
    v_new_total := v_sum_excl + NEW.amount;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_sum_excl
    FROM public.pay_stub_deductions
    WHERE pay_stub_id = OLD.pay_stub_id
      AND id <> OLD.id;
    v_new_total := v_sum_excl;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_new_total > v_gross + 0.01 THEN
    RAISE EXCEPTION 'pay_stub_deductions total would exceed gross pay for stub %', v_stub;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS pay_stub_deductions_enforce_gross_tr ON public.pay_stub_deductions;
CREATE TRIGGER pay_stub_deductions_enforce_gross_tr
  BEFORE INSERT OR UPDATE OF amount, pay_stub_id OR DELETE
  ON public.pay_stub_deductions
  FOR EACH ROW
  EXECUTE FUNCTION public.pay_stub_deductions_enforce_gross_fn();

-- After deduction changes, ensure existing installments do not exceed Net Pay.
CREATE OR REPLACE FUNCTION public.validate_pay_stub_payments_vs_net(p_stub uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_gross numeric;
  v_ded numeric;
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
  SELECT COALESCE(SUM(amount), 0) INTO v_paid FROM public.pay_stub_payments WHERE pay_stub_id = p_stub;
  v_net := v_gross - v_ded;
  IF v_paid > v_net + 0.01 THEN
    RAISE EXCEPTION 'pay_stub_payments total (%) exceeds net pay (%) for stub %', v_paid, v_net, p_stub;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_stub_deductions_after_validate_payments_fn()
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

DROP TRIGGER IF EXISTS pay_stub_deductions_after_validate_payments_tr ON public.pay_stub_deductions;
CREATE TRIGGER pay_stub_deductions_after_validate_payments_tr
  AFTER INSERT OR UPDATE OF amount, pay_stub_id OR DELETE
  ON public.pay_stub_deductions
  FOR EACH ROW
  EXECUTE FUNCTION public.pay_stub_deductions_after_validate_payments_fn();

-- Cap installments at Net Pay (gross - deductions).
CREATE OR REPLACE FUNCTION public.pay_stub_payments_enforce_total_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_gross numeric;
  v_ded numeric;
  v_net numeric;
  v_sum_excl numeric;
BEGIN
  SELECT gross_pay INTO v_gross FROM public.pay_stubs WHERE id = NEW.pay_stub_id;
  IF v_gross IS NULL THEN
    RAISE EXCEPTION 'pay stub not found for pay_stub_id %', NEW.pay_stub_id;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_ded FROM public.pay_stub_deductions WHERE pay_stub_id = NEW.pay_stub_id;
  v_net := v_gross - v_ded;

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

COMMENT ON TABLE public.pay_stub_payments IS 'Installments physically paid against a pay stub. Sum of amounts must not exceed Net Pay (gross_pay minus pay_stub_deductions).';

ALTER TABLE public.pay_stub_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pay access users can read pay stub deductions"
ON public.pay_stub_deductions
FOR SELECT
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);

CREATE POLICY "Pay access users can insert pay stub deductions"
ON public.pay_stub_deductions
FOR INSERT
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);

CREATE POLICY "Pay access users can update pay stub deductions"
ON public.pay_stub_deductions
FOR UPDATE
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
)
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);

CREATE POLICY "Pay access users can delete pay stub deductions"
ON public.pay_stub_deductions
FOR DELETE
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);
