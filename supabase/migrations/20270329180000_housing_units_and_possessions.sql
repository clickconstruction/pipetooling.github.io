-- Housing units and possessions for People page / pay reports
-- Same access pattern as vehicles (dev, pay-approved masters, assistants)

CREATE TABLE IF NOT EXISTS public.housing_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL DEFAULT '',
  rent_per_week NUMERIC(10, 2) NOT NULL DEFAULT 0,
  utilities_per_week NUMERIC(10, 2) NOT NULL DEFAULT 0,
  insurance_per_week NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_housing_units_created ON public.housing_units(created_at DESC);

COMMENT ON TABLE public.housing_units IS 'Company housing: address and weekly rent/utilities/insurance. Same RLS as vehicles.';

ALTER TABLE public.housing_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pay access users can manage housing_units"
ON public.housing_units FOR ALL
USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
)
WITH CHECK (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);

CREATE TABLE IF NOT EXISTS public.housing_possessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  housing_id UUID NOT NULL REFERENCES public.housing_units(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_housing_possessions_housing_id ON public.housing_possessions(housing_id);
CREATE INDEX IF NOT EXISTS idx_housing_possessions_user_id ON public.housing_possessions(user_id);
CREATE INDEX IF NOT EXISTS idx_housing_possessions_dates ON public.housing_possessions(start_date, end_date);

COMMENT ON TABLE public.housing_possessions IS 'User assigned to housing unit. end_date NULL = still in possession.';

ALTER TABLE public.housing_possessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pay access users can manage housing_possessions"
ON public.housing_possessions FOR ALL
USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
)
WITH CHECK (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);
