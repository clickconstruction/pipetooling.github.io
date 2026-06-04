-- Add optional location params to insert_report RPC
CREATE OR REPLACE FUNCTION public.insert_report(
  p_template_id uuid,
  p_field_values jsonb,
  p_job_ledger_id uuid,
  p_project_id uuid,
  p_reported_at_lat NUMERIC DEFAULT NULL,
  p_reported_at_lng NUMERIC DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_estimator() THEN
    RAISE EXCEPTION 'Only estimators can use insert_report';
  END IF;
  IF (p_job_ledger_id IS NOT NULL AND p_project_id IS NOT NULL)
     OR (p_job_ledger_id IS NULL AND p_project_id IS NULL) THEN
    RAISE EXCEPTION 'Exactly one of job_ledger_id or project_id must be set';
  END IF;

  INSERT INTO public.reports (template_id, created_by_user_id, field_values, job_ledger_id, project_id, reported_at_lat, reported_at_lng)
  VALUES (
    p_template_id,
    auth.uid(),
    COALESCE(p_field_values, '{}'::jsonb),
    p_job_ledger_id,
    p_project_id,
    p_reported_at_lat,
    p_reported_at_lng
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.insert_report(uuid, jsonb, uuid, uuid, numeric, numeric) IS
  'Inserts a report. SECURITY DEFINER bypasses RLS. Only estimators. Optional reported_at_lat/lng.';
