SET lock_timeout = '3s';

-- v2.1648 (Vehicles fleet phase 4): field self-service. The person currently
-- holding a vehicle (open vehicle_possessions row) can SEE their vehicle and
-- its readings/oil/problem state, INSERT odometer readings, and REPORT
-- problems — powering the Dashboard "My vehicle" card. Office management
-- policies are untouched; these are additional permissive policies, and the
-- restrictive read-only training-mode blocks still apply on top.

-- SECURITY DEFINER so the vehicles policy can consult possessions without
-- recursing through the possessions policies (same pattern as is_dev()).
CREATE OR REPLACE FUNCTION public.holds_vehicle(p_vehicle_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vehicle_possessions vp
    WHERE vp.vehicle_id = p_vehicle_id
      AND vp.user_id = auth.uid()
      AND vp.start_date <= (now() AT TIME ZONE 'America/Chicago')::date
      AND (vp.end_date IS NULL OR vp.end_date >= (now() AT TIME ZONE 'America/Chicago')::date)
  )
$$;

COMMENT ON FUNCTION public.holds_vehicle(uuid) IS
  'True when auth.uid() has an open possession of the vehicle today (company calendar day). Powers the holder self-service policies (v2.1648).';

GRANT EXECUTE ON FUNCTION public.holds_vehicle(uuid) TO authenticated;

DROP POLICY IF EXISTS "Holders can view their vehicle" ON public.vehicles;
CREATE POLICY "Holders can view their vehicle" ON public.vehicles
  FOR SELECT USING (public.holds_vehicle(id));

DROP POLICY IF EXISTS "Users can view their own possessions" ON public.vehicle_possessions;
CREATE POLICY "Users can view their own possessions" ON public.vehicle_possessions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Holders can view their vehicle odometer entries" ON public.vehicle_odometer_entries;
CREATE POLICY "Holders can view their vehicle odometer entries" ON public.vehicle_odometer_entries
  FOR SELECT USING (public.holds_vehicle(vehicle_id));

DROP POLICY IF EXISTS "Holders can add odometer readings" ON public.vehicle_odometer_entries;
CREATE POLICY "Holders can add odometer readings" ON public.vehicle_odometer_entries
  FOR INSERT WITH CHECK (public.holds_vehicle(vehicle_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Holders can view their vehicle service events" ON public.vehicle_service_events;
CREATE POLICY "Holders can view their vehicle service events" ON public.vehicle_service_events
  FOR SELECT USING (public.holds_vehicle(vehicle_id));

DROP POLICY IF EXISTS "Holders can view their vehicle problem reports" ON public.vehicle_problem_reports;
CREATE POLICY "Holders can view their vehicle problem reports" ON public.vehicle_problem_reports
  FOR SELECT USING (public.holds_vehicle(vehicle_id));

DROP POLICY IF EXISTS "Holders can report vehicle problems" ON public.vehicle_problem_reports;
CREATE POLICY "Holders can report vehicle problems" ON public.vehicle_problem_reports
  FOR INSERT WITH CHECK (public.holds_vehicle(vehicle_id) AND reported_by = auth.uid());
