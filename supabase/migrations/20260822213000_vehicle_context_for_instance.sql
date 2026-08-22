SET lock_timeout = '3s';

-- Vehicle context for a checklist task (v2.2094): tapping the 🚗 chip on a
-- vehicle maintenance task opens a vitals card. Vehicle tables are office-pool
-- + current-holder RLS, and the assignee may be neither — this SECURITY
-- DEFINER read returns one curated bundle, scoped to callers who are assigned
-- to the instance (office vehicle-pool roles may read any). Read-only,
-- idempotent.

CREATE OR REPLACE FUNCTION public.vehicle_context_for_instance(p_instance_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task vehicle_maintenance_tasks%ROWTYPE;
  v_vehicle vehicles%ROWTYPE;
  v_allowed boolean;
  v_result jsonb;
BEGIN
  SELECT vmt.* INTO v_task
  FROM vehicle_maintenance_tasks vmt
  WHERE vmt.checklist_instance_id = p_instance_id
  LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_allowed := public.is_dev() OR public.is_pay_approved_master() OR public.is_assistant()
    OR EXISTS (
      SELECT 1 FROM checklist_instance_assignees cia
      WHERE cia.checklist_instance_id = p_instance_id AND cia.user_id = auth.uid()
    );
  IF NOT v_allowed THEN RETURN NULL; END IF;

  SELECT v.* INTO v_vehicle FROM vehicles v WHERE v.id = v_task.vehicle_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'vehicle', jsonb_build_object(
      'id', v_vehicle.id,
      'year', v_vehicle.year,
      'make', v_vehicle.make,
      'model', v_vehicle.model,
      'vin', v_vehicle.vin,
      'oil_change_interval_miles', v_vehicle.oil_change_interval_miles,
      'oil_suggest_window_miles', v_vehicle.oil_suggest_window_miles,
      'oil_require_past_due_miles', v_vehicle.oil_require_past_due_miles
    ),
    'task', jsonb_build_object(
      'title', v_task.title,
      'note', v_task.note,
      'due_date', v_task.due_date,
      'created_by_name', (SELECT u.name FROM users u WHERE u.id = v_task.created_by)
    ),
    'holder', (
      SELECT jsonb_build_object(
        'name', CASE WHEN p.user_id IS NULL THEN NULL ELSE (SELECT u.name FROM users u WHERE u.id = p.user_id) END,
        'is_motor_pool', p.user_id IS NULL,
        'since', p.start_date
      )
      FROM vehicle_possessions p
      WHERE p.vehicle_id = v_vehicle.id AND p.end_date IS NULL
      ORDER BY p.start_date DESC LIMIT 1
    ),
    'odometer', (
      SELECT jsonb_build_object(
        'value', o.odometer_value,
        'read_date', o.read_date,
        'by_name', (SELECT u.name FROM users u WHERE u.id = o.created_by)
      )
      FROM vehicle_odometer_entries o
      WHERE o.vehicle_id = v_vehicle.id
      ORDER BY o.read_date DESC, o.created_at DESC LIMIT 1
    ),
    'last_oil_change', (
      SELECT jsonb_build_object('service_date', s.service_date, 'odometer_value', s.odometer_value)
      FROM vehicle_service_events s
      WHERE s.vehicle_id = v_vehicle.id AND s.service_type = 'oil_change' AND s.odometer_value IS NOT NULL
      ORDER BY s.service_date DESC LIMIT 1
    ),
    'insurance', (
      SELECT jsonb_build_object('plan_name', pl.name, 'end_date', ip.end_date)
      FROM vehicle_insurance_periods ip
      JOIN vehicle_insurance_plans pl ON pl.id = ip.plan_id
      WHERE ip.vehicle_id = v_vehicle.id
        AND ip.start_date <= CURRENT_DATE
        AND (ip.end_date IS NULL OR ip.end_date >= CURRENT_DATE)
      ORDER BY ip.start_date DESC LIMIT 1
    ),
    'open_problems', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('description', pr.description, 'severity', pr.severity, 'report_date', pr.report_date))
      FROM (
        SELECT x.description, x.severity, x.report_date
        FROM vehicle_problem_reports x
        WHERE x.vehicle_id = v_vehicle.id AND x.resolved_at IS NULL
        ORDER BY x.report_date DESC LIMIT 5
      ) pr
    ), '[]'::jsonb),
    'recent_service', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('service_type', s.service_type, 'service_date', s.service_date, 'odometer_value', s.odometer_value))
      FROM (
        SELECT y.service_type, y.service_date, y.odometer_value
        FROM vehicle_service_events y
        WHERE y.vehicle_id = v_vehicle.id
        ORDER BY y.service_date DESC LIMIT 3
      ) s
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.vehicle_context_for_instance(uuid) IS
  'Curated vehicle vitals for the checklist 🚗 chip modal (v2.2094). Caller must be assigned to the instance (or an office vehicle-pool role); returns NULL otherwise or when the instance has no vehicle task.';

REVOKE ALL ON FUNCTION public.vehicle_context_for_instance(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.vehicle_context_for_instance(uuid) TO authenticated;
