SET lock_timeout = '3s';

-- Wheels PR 3 (v2.5039, the owner's call of 2026-10-09): what the company's trucks cost per field
-- hour, for the Bids crew-rate card. The card shows it beside the company rate and never adds it:
-- the burden factor and the driving line already carry the truck. Estimators price bids but cannot
-- read the fleet tables, so this returns the one rate and its totals, never a vehicle's own figures.
--
-- The same arithmetic as `fleetTruckRate` in src/lib/people/wheels.ts, per vehicle and rounded the
-- same way (`truckRunningCost`, fuel left on the jobs):
--   insurance    = weekly premium × 90/7 while the vehicle is on an insurance plan today, else 0
--   registration = weekly registration × 90/7
--   service      = costed service events in the 90 days ending today
--   wear         = the latest replacement value on or before today ÷ (5 × 365) × 90 ($0 ends it)
-- divided by the crew's field hours in the same 90 days: approved, clocked-out sessions on a job
-- (not a bid), as `fieldHoursByUser` counts them. A new function: no table is locked.

CREATE OR REPLACE FUNCTION public.fleet_truck_rate_per_field_hour(p_today date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_days constant integer := 90;        -- WHEELS_WINDOW_DAYS
  v_life_years constant integer := 5;   -- WHEELS_WEAR_LIFE_YEARS
  v_start date;
  v_weeks numeric;
  v_fixed numeric := 0;
  v_trucks integer := 0;
  v_hours numeric := 0;
BEGIN
  IF NOT public.is_office_or_estimator() THEN
    RAISE EXCEPTION 'Only the office and estimators read the trucks'' rate.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_today IS NULL THEN
    RAISE EXCEPTION 'Which day is today?' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  v_start := p_today - (v_days - 1);
  v_weeks := v_days::numeric / 7;

  SELECT
    coalesce(sum(
      round((CASE WHEN EXISTS (
               SELECT 1 FROM public.vehicle_insurance_periods p
               WHERE p.vehicle_id = v.id AND p.start_date <= p_today AND (p.end_date IS NULL OR p.end_date >= p_today)
             ) THEN greatest(0, coalesce(v.weekly_insurance_cost, 0)) ELSE 0 END) * v_weeks, 2)
      + round(greatest(0, coalesce(v.weekly_registration_cost, 0)) * v_weeks, 2)
      + round(greatest(0, coalesce((
          SELECT sum(coalesce(e.cost, 0)) FROM public.vehicle_service_events e
          WHERE e.vehicle_id = v.id AND e.service_date BETWEEN v_start AND p_today
        ), 0)), 2)
      + coalesce((
          SELECT round(greatest(0, r.replacement_value) / (v_life_years * 365) * v_days, 2)
          FROM public.vehicle_replacement_value_entries r
          WHERE r.vehicle_id = v.id AND r.read_date <= p_today
          ORDER BY r.read_date DESC   -- one reading per vehicle per day (UNIQUE vehicle_id, read_date)
          LIMIT 1
        ), 0)
    ), 0),
    count(*)
  INTO v_fixed, v_trucks
  FROM public.vehicles v;

  SELECT coalesce(sum(extract(epoch FROM (s.clocked_out_at - s.clocked_in_at)) / 3600), 0)
  INTO v_hours
  FROM public.clock_sessions s
  WHERE s.work_date BETWEEN v_start AND p_today
    AND s.job_ledger_id IS NOT NULL
    AND s.bid_id IS NULL
    AND s.approved_at IS NOT NULL
    AND s.rejected_at IS NULL
    AND s.revoked_at IS NULL
    AND s.clocked_out_at IS NOT NULL
    AND s.clocked_out_at > s.clocked_in_at;

  RETURN jsonb_build_object(
    'rate', CASE WHEN v_hours > 0 THEN round(round(v_fixed, 2) / v_hours, 2) END,
    'fixed_usd', round(v_fixed, 2),
    'field_hours', round(v_hours, 1),
    'trucks', v_trucks,
    'days', v_days
  );
END;
$$;

COMMENT ON FUNCTION public.fleet_truck_rate_per_field_hour(date) IS
  'Wheels PR 3 (v2.5039): the company trucks'' insurance, registration, service and wear over the 90 days ending p_today, divided by the crew''s field hours in those days. For the Bids crew-rate card, shown and never added. Office and estimators only.';

REVOKE EXECUTE ON FUNCTION public.fleet_truck_rate_per_field_hour(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fleet_truck_rate_per_field_hour(date) TO authenticated;
