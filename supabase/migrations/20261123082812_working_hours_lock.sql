SET lock_timeout = '3s';

-- Working hours, the lock (punch list #429, PR 3): the two old doors onto a week's days and hours close with the
-- screen that replaces them, so the screen and the database never say different rules.
--
-- 1. The seven hour numbers on pay (people_pay_config.salaried_week_hours) were open to whoever may write a pay
--    row, an owner with pay approval among them. The days and hours of a week are now a dev's and the controller's
--    to set, on the person's sheet. A trigger refuses anyone else a change to the column. A save that leaves the
--    week as it was passes, so the owner still changes a wage, and so does a new pay row on the default week, which
--    the Hire form makes. A write with no sign-in is the database's own work and passes. set_working_hours passes,
--    since only a dev or the controller reaches its write.
--
-- 2. A person, or the office for them, could answer the hours they can work whatever the office had set. Once a
--    person has working hours in force, an answer is refused: the set week wins, and an answer under it would only
--    be a second week nobody reads. Hours taken off again open the answer again.

-- The days and hours of a week on pay: a dev, the controller, or the database's own work.
CREATE OR REPLACE FUNCTION public.check_salaried_week_set_by_dev_or_controller()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.salaried_week_hours IS NOT DISTINCT FROM OLD.salaried_week_hours THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.salaried_week_hours IS NOT DISTINCT FROM '{0,8,8,8,8,8,0}'::numeric(4,2)[] THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR public.is_dev() OR public.is_controller() THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'A dev or the controller sets the days and hours of a week.' USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.check_salaried_week_set_by_dev_or_controller() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS people_pay_config_week_dev_or_controller ON public.people_pay_config;
CREATE TRIGGER people_pay_config_week_dev_or_controller
  BEFORE INSERT OR UPDATE OF salaried_week_hours ON public.people_pay_config
  FOR EACH ROW EXECUTE FUNCTION public.check_salaried_week_set_by_dev_or_controller();

COMMENT ON FUNCTION public.check_salaried_week_set_by_dev_or_controller() IS
  'Trigger on people_pay_config: a change to salaried_week_hours is a dev''s or the controller''s, or the database''s own work with no sign-in. A write that leaves the week as it was passes, and so does a new row on the default week.';

-- Whether a person has working hours in force today: the newest save among the set rows that have started holds
-- a week. A definer, so the insert policy can ask it for any row a caller may write.
CREATE OR REPLACE FUNCTION public.has_working_hours(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT h.days IS NOT NULL
    FROM public.person_available_hours h
    WHERE h.user_id = p_user_id AND h.kind = 'set' AND h.effective_from <= public.app_today()
    ORDER BY h.created_at DESC
    LIMIT 1
  ), false);
$$;

REVOKE ALL ON FUNCTION public.has_working_hours(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_working_hours(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.has_working_hours(uuid) IS
  'True when a person has working hours in force today: the newest set row on person_available_hours that has started holds a week. Security definer; it answers yes or no and nothing of the week.';

-- An answer only, and only for a person nobody has set working hours for.
DROP POLICY IF EXISTS person_available_hours_write ON public.person_available_hours;
CREATE POLICY person_available_hours_write ON public.person_available_hours
  FOR INSERT TO authenticated
  WITH CHECK (
    kind = 'answer'
    AND set_by = auth.uid()
    AND (user_id = auth.uid() OR public.is_dev() OR public.is_assistant() OR public.has_payroll_access())
    AND NOT public.has_working_hours(user_id)
  );
