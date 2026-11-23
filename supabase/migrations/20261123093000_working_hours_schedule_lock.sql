SET lock_timeout = '3s';

-- Working hours, the usual day (punch list #429): a person's standing hours are a dev's or the controller's to set.
-- Working hours already have one door (set_working_hours). The usual day of the workday schedule is the other
-- standing week a clock reads, and until now the person themself and anyone with payroll access could write it
-- (salary_schedule_staff_or_self_target). This narrows its insert and its update to a dev and the controller.
--
-- What stays as it was:
--   * reading the row, for the person, pay staff and a team lead;
--   * deleting it, which sets no hours: a person who is no longer salaried removes their own leftover row, and
--     turning Salaried off clears it through pay_staff_clear_salary_schedule_by_person_name;
--   * a custom schedule for one date (salary_work_schedule_day_overrides), still the person's own for today and
--     pay staff's for any day;
--   * every definer function that moves a row's job or bid (the job combine and migrate functions), which RLS
--     does not reach.
--
-- ALTER POLICY swaps the predicate in place, so the policy is never absent and a second run changes nothing.
-- Deploy the client first: an older client's Save in the Workday schedule window writes the usual day before the
-- one date, and would be refused here for anyone but a dev or the controller.

ALTER POLICY salary_template_insert ON public.salary_work_schedule_templates
  WITH CHECK (public.is_dev() OR public.is_controller());

ALTER POLICY salary_template_update ON public.salary_work_schedule_templates
  USING (public.is_dev() OR public.is_controller())
  WITH CHECK (public.is_dev() OR public.is_controller());

COMMENT ON TABLE public.salary_work_schedule_templates IS
  'A salaried person''s usual workday: the switch that says the schedule clocks them in and out, the job or bid the sessions land on, and the start and length read while they have no working hours. Written by a dev or the controller only (insert and update); the person and pay staff read it and may delete it. One date''s move is salary_work_schedule_day_overrides.';
