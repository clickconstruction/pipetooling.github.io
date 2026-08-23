SET lock_timeout = '3s';

-- v2.2199 (Vehicle check-ins): the answers captured with an odometer reading
-- from Quickfill's Vehicle odometers section — "Any lights on the dash?" etc.
-- One row per capture, flagged or all-clear; `answers` stores the questions
-- AS ASKED (renaming a question later must not rewrite history). A flagged
-- answer also files a vehicle_problem_reports row client-side (tagged in its
-- description); this table is the check-in ledger itself.
-- Idempotent and additive.

CREATE TABLE IF NOT EXISTS public.vehicle_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  odometer_entry_id uuid REFERENCES public.vehicle_odometer_entries(id) ON DELETE SET NULL,
  checkin_date date NOT NULL,
  -- [{ "q": "Any lights on the dash?", "flagged": true, "comment": "ABS light" }, …]
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vehicle_checkins IS
  'Vehicle check-ins (v2.2199): question answers captured with an odometer reading (Quickfill Vehicle odometers). answers jsonb stores each question as asked with flagged + comment; all-clear captures are rows too — the history that proves the truck was looked at.';

CREATE INDEX IF NOT EXISTS idx_vehicle_checkins_vehicle
  ON public.vehicle_checkins (vehicle_id, checkin_date DESC);

ALTER TABLE public.vehicle_checkins ENABLE ROW LEVEL SECURITY;

-- Office pool matching the other vehicle tables (see vehicle_problem_reports).
DROP POLICY IF EXISTS "Pay access users can manage vehicle checkins" ON public.vehicle_checkins;
CREATE POLICY "Pay access users can manage vehicle checkins" ON public.vehicle_checkins
  USING (public.is_dev() OR public.is_pay_approved_master() OR public.is_assistant())
  WITH CHECK (public.is_dev() OR public.is_pay_approved_master() OR public.is_assistant());

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
