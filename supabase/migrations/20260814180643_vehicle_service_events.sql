SET lock_timeout = '3s';

-- v2.1645 (Vehicles fleet phase 2): the service log + oil-change tracking.
-- One open-ended event table (oil changes, tires, repairs, inspections,
-- registration, other) feeding the per-vehicle ledger; oil due/overdue chips
-- are pure client math from the last oil_change event's odometer + the
-- per-vehicle interval + the latest reading. Idempotent and additive.

CREATE TABLE IF NOT EXISTS public.vehicle_service_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  service_type text NOT NULL CHECK (service_type IN ('oil_change', 'tires', 'repair', 'inspection', 'registration', 'other')),
  service_date date NOT NULL,
  odometer_value numeric,
  cost numeric,
  note text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vehicle_service_events IS
  'Vehicle service log (v2.1645): oil changes, tires, repairs, inspections. Oil due/overdue is derived client-side from the last oil_change row + vehicles.oil_change_interval_miles + the latest odometer reading.';

CREATE INDEX IF NOT EXISTS idx_vehicle_service_events_vehicle
  ON public.vehicle_service_events (vehicle_id, service_date DESC);

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS oil_change_interval_miles integer NOT NULL DEFAULT 5000;

COMMENT ON COLUMN public.vehicles.oil_change_interval_miles IS
  'Miles between oil changes for the due/overdue chips (v2.1645). Default 5000; per-vehicle override in Edit vehicle.';

ALTER TABLE public.vehicle_service_events ENABLE ROW LEVEL SECURITY;

-- Same office pool as the other vehicle tables post-20260714200000 (the
-- assistant/pay-linkage dissolution rewrote is_assistant_of_pay_approved_master
-- to is_assistant everywhere and DROPPED it — never copy the baseline's policy
-- bodies). Field-holder access arrives in phase 4.
DROP POLICY IF EXISTS "Pay access users can manage vehicle service events" ON public.vehicle_service_events;
CREATE POLICY "Pay access users can manage vehicle service events" ON public.vehicle_service_events
  USING (public.is_dev() OR public.is_pay_approved_master() OR public.is_assistant())
  WITH CHECK (public.is_dev() OR public.is_pay_approved_master() OR public.is_assistant());

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
