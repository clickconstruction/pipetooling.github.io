SET lock_timeout = '3s';

-- Vehicle insurance plans (Vehicles fleet phase 5): the company may carry
-- several policies; each vehicle sits on at most ONE plan at a time, with a
-- dated on/off history as vehicles come on and off coverage (mirrors the
-- vehicle_possessions start/end pattern — end_date NULL = currently covered).
-- Idempotent and additive.

CREATE TABLE IF NOT EXISTS public.vehicle_insurance_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  carrier text,
  policy_number text,
  renewal_date date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vehicle_insurance_plans IS
  'Company vehicle insurance plans/policies. A plan covers many vehicles; a vehicle is on at most one plan at a time (see vehicle_insurance_periods).';

CREATE TABLE IF NOT EXISTS public.vehicle_insurance_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.vehicle_insurance_plans(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vehicle_insurance_periods IS
  'Dated coverage periods linking vehicles to insurance plans. end_date NULL = currently covered; taking a vehicle off insurance sets end_date (history is kept, mirroring vehicle_possessions).';

CREATE INDEX IF NOT EXISTS idx_vehicle_insurance_periods_vehicle
  ON public.vehicle_insurance_periods (vehicle_id, start_date DESC);

CREATE INDEX IF NOT EXISTS idx_vehicle_insurance_periods_plan
  ON public.vehicle_insurance_periods (plan_id, start_date DESC);

ALTER TABLE public.vehicle_insurance_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_insurance_periods ENABLE ROW LEVEL SECURITY;

-- Same office pool as the other vehicle tables post-20260714200000 (never copy
-- the baseline's policy bodies — is_assistant_of_pay_approved_master is gone).
DROP POLICY IF EXISTS "Pay access users can manage vehicle insurance plans" ON public.vehicle_insurance_plans;
CREATE POLICY "Pay access users can manage vehicle insurance plans" ON public.vehicle_insurance_plans
  USING (public.is_dev() OR public.is_pay_approved_master() OR public.is_assistant())
  WITH CHECK (public.is_dev() OR public.is_pay_approved_master() OR public.is_assistant());

DROP POLICY IF EXISTS "Pay access users can manage vehicle insurance periods" ON public.vehicle_insurance_periods;
CREATE POLICY "Pay access users can manage vehicle insurance periods" ON public.vehicle_insurance_periods
  USING (public.is_dev() OR public.is_pay_approved_master() OR public.is_assistant())
  WITH CHECK (public.is_dev() OR public.is_pay_approved_master() OR public.is_assistant());

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
