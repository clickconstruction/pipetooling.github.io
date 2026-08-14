SET lock_timeout = '3s';

-- v2.1647 (Vehicles fleet phase 3): reported problems. A report stays open
-- until resolved; resolution can point at the service event that fixed it.
-- Open = resolved_at IS NULL. Idempotent and additive.

CREATE TABLE IF NOT EXISTS public.vehicle_problem_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'needs_service' CHECK (severity IN ('monitor', 'needs_service', 'urgent')),
  report_date date NOT NULL,
  reported_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolution_note text,
  resolved_service_event_id uuid REFERENCES public.vehicle_service_events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vehicle_problem_reports IS
  'Vehicle problem reports (v2.1647): open until resolved_at is stamped; resolution optionally links the vehicle_service_events row that fixed it. Severity monitor/needs_service/urgent.';

CREATE INDEX IF NOT EXISTS idx_vehicle_problem_reports_vehicle
  ON public.vehicle_problem_reports (vehicle_id, report_date DESC);

ALTER TABLE public.vehicle_problem_reports ENABLE ROW LEVEL SECURITY;

-- Office pool matching the other vehicle tables post-20260714200000 (the
-- dissolved is_assistant_of_pay_approved_master helper must NOT be referenced).
-- Field-holder reporting arrives in phase 4 with its own insert policy.
DROP POLICY IF EXISTS "Pay access users can manage vehicle problem reports" ON public.vehicle_problem_reports;
CREATE POLICY "Pay access users can manage vehicle problem reports" ON public.vehicle_problem_reports
  USING (public.is_dev() OR public.is_pay_approved_master() OR public.is_assistant())
  WITH CHECK (public.is_dev() OR public.is_pay_approved_master() OR public.is_assistant());

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
