-- Vehicles: fleet tracking for People page
-- Same access as pay_stubs: dev, pay-approved masters, assistants

CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT,
  make TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  vin TEXT,
  weekly_insurance_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  weekly_registration_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_year ON public.vehicles(year DESC);

COMMENT ON TABLE public.vehicles IS 'Fleet vehicles. Year, make, model, VIN, weekly costs. Same access as pay_stubs.';

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pay access users can manage vehicles"
ON public.vehicles FOR ALL
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

-- Odometer entries: one reading per vehicle per date
CREATE TABLE IF NOT EXISTS public.vehicle_odometer_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  odometer_value NUMERIC(10, 2) NOT NULL,
  read_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vehicle_id, read_date)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_odometer_entries_vehicle_id ON public.vehicle_odometer_entries(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_odometer_entries_read_date ON public.vehicle_odometer_entries(read_date);

COMMENT ON TABLE public.vehicle_odometer_entries IS 'Odometer readings per vehicle per date.';

ALTER TABLE public.vehicle_odometer_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pay access users can manage vehicle odometer entries"
ON public.vehicle_odometer_entries FOR ALL
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

-- Possession assignments: user assigned to vehicle with start/end date
CREATE TABLE IF NOT EXISTS public.vehicle_possessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_possessions_vehicle_id ON public.vehicle_possessions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_possessions_user_id ON public.vehicle_possessions(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_possessions_dates ON public.vehicle_possessions(start_date, end_date);

COMMENT ON TABLE public.vehicle_possessions IS 'User assigned to vehicle. end_date NULL = still in possession.';

ALTER TABLE public.vehicle_possessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pay access users can manage vehicle possessions"
ON public.vehicle_possessions FOR ALL
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
