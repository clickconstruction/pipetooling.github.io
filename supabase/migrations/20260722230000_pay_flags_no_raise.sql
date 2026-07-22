-- Log-noise fix (v2.914): list_people_pay_flags() raised
--   'list_people_pay_flags: not allowed' / ': not authenticated'
-- for every caller outside dev/master/assistant/controller — ~2,000 Postgres
-- ERROR log lines/day, because labor-math code paths (teamLabor, CrewJobsBlock,
-- usePayConfig, HoursUnassignedModal) run for field roles too and swallow the
-- error client-side. Same access boundary, but disallowed/unauthenticated
-- callers now get ZERO ROWS instead of an exception (callers already treat an
-- empty map as "no flags"). CREATE OR REPLACE — idempotent.
CREATE OR REPLACE FUNCTION public.list_people_pay_flags()
RETURNS TABLE(
  person_name text,
  person_id uuid,
  is_salary boolean,
  record_hours_but_salary boolean,
  show_in_hours boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN; -- was RAISE: unauthenticated boot races get empty rows, not log spam
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev','master_technician','assistant','controller')
  ) THEN
    RETURN; -- was RAISE: field roles get empty rows (flags stay office-only)
  END IF;
  RETURN QUERY
    SELECT pc.person_name, pc.person_id, pc.is_salary, pc.record_hours_but_salary,
           pc.show_in_hours
    FROM public.people_pay_config pc;
END $$;
