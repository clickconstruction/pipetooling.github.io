-- Replacement value entries: one value per vehicle per date (like odometer)
-- Same access as vehicles

CREATE TABLE IF NOT EXISTS public.vehicle_replacement_value_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  replacement_value NUMERIC(12, 2) NOT NULL,
  read_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vehicle_id, read_date)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_replacement_value_entries_vehicle_id ON public.vehicle_replacement_value_entries(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_replacement_value_entries_read_date ON public.vehicle_replacement_value_entries(read_date);

COMMENT ON TABLE public.vehicle_replacement_value_entries IS 'Replacement value per vehicle per date. Same access as vehicles.';

ALTER TABLE public.vehicle_replacement_value_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pay access users can manage vehicle replacement value entries"
ON public.vehicle_replacement_value_entries FOR ALL
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
);;
