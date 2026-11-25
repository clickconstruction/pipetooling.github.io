SET lock_timeout = '3s';

-- Working hours, the take-off (punch list #429): taking working hours off a salaried person puts their week on pay
-- back on the standard week, 8 hours Monday to Friday.
--
-- set_working_hours writes a salaried person's seven hour numbers (people_pay_config.salaried_week_hours) with the
-- week it sets, so pay and the hours never part. Taking the hours off again wrote its row and left the seven
-- numbers where the last set put them: a person with no working hours was still paid the week of hours nobody
-- held them to any more. The live test of 2026-11-24 set 6 hours a day, took the hours off, and pay still read 6.
--
-- The owner's two answers of 2026-11-25: taking the hours off clears the week's own hours too, and what that
-- leaves is the standard week, never zero paid hours. The standard week is the column's own default,
-- {0,8,8,8,8,8,0}, the week every reader already takes for a pay row that names none (salaried_hours_on in the
-- database, salariedWeekOf in the app). The column is NOT NULL, so the default is written, not a null.
--
-- This replaces the function, with the same arguments and the same answer. One rule is new: a take-off (p_days
-- null) for a salaried person who has a set week in force on that Sunday, and whose seven numbers are not the
-- standard week, writes the standard week on their pay row. That is a change to what a salaried day pays, so it
-- keeps the two rules a set already has: it starts this week, since pay carries no date, and it needs a reason,
-- which goes on the pay log with the row before and after. A take-off with no set week in force takes nothing off
-- and leaves pay alone, so a week typed on pay for a person nobody set hours for still stands. A person who is not
-- salaried has no pay side, as before. A dry run answers pay.moved and pay.after for a take-off too.
--
-- No table is made or changed and no row is corrected. CREATE OR REPLACE takes no lock on any table.

CREATE OR REPLACE FUNCTION public.set_working_hours(
  p_user_id uuid,
  p_days jsonb,
  p_effective_from date,
  p_reason text DEFAULT NULL,
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- The week a pay row holds when nobody named one: the column's own default.
  v_standard_week CONSTANT numeric(4,2)[] := '{0,8,8,8,8,8,0}';
  v_this_sunday date := public.app_today() - extract(dow FROM public.app_today())::int;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_hours numeric := 0;
  v_new_week numeric(4,2)[];
  v_old_week numeric(4,2)[];
  v_pay_name text;
  v_is_salary boolean := false;
  v_moved boolean := false;
  v_before jsonb;
  v_before_row jsonb;
  v_after_row jsonb;
BEGIN
  IF NOT (public.is_dev() OR public.is_controller()) THEN
    RAISE EXCEPTION 'A dev or the controller sets working hours.' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user_id AND u.archived_at IS NULL) THEN
    RAISE EXCEPTION 'That person has no account to set hours for.';
  END IF;
  IF p_effective_from IS NULL OR p_effective_from NOT IN (v_this_sunday, v_this_sunday + 7) THEN
    RAISE EXCEPTION 'Working hours start on the Sunday of this week (%) or of next week (%).', v_this_sunday, v_this_sunday + 7;
  END IF;
  IF p_days IS NOT NULL AND NOT public.working_week_ok(p_days) THEN
    RAISE EXCEPTION 'A week is seven days, each with at most two ranges on a quarter hour, in order, and no more than 16 hours.';
  END IF;

  IF p_days IS NOT NULL THEN
    SELECT
      array_agg(d.minutes / 60.0 ORDER BY d.ord)::numeric(4,2)[],
      sum(d.minutes) / 60.0
    INTO v_new_week, v_hours
    FROM (
      SELECT e.ord, COALESCE((SELECT sum((seg.r ->> 1)::numeric - (seg.r ->> 0)::numeric) FROM jsonb_array_elements(e.value) AS seg(r)), 0) AS minutes
      FROM jsonb_array_elements(p_days) WITH ORDINALITY AS e(value, ord)
    ) d;
    IF v_hours > 80 THEN
      RAISE EXCEPTION 'A week holds no more than 80 hours. This one is %.', trim(to_char(v_hours, 'FM990.00'));
    END IF;
  END IF;

  -- The person's pay row, by their roster person first and by name after, as the salary probe finds it.
  SELECT c.person_name, c.is_salary, c.salaried_week_hours::numeric(4,2)[]
  INTO v_pay_name, v_is_salary, v_old_week
  FROM public.people_pay_config c
  WHERE c.person_id IS NOT NULL
    AND c.person_id IN (SELECT p.id FROM public.people p WHERE p.account_user_id = p_user_id)
  LIMIT 1;
  IF v_pay_name IS NULL THEN
    SELECT c.person_name, c.is_salary, c.salaried_week_hours::numeric(4,2)[]
    INTO v_pay_name, v_is_salary, v_old_week
    FROM public.people_pay_config c
    JOIN public.users u ON u.id = p_user_id AND u.name IS NOT NULL
    WHERE btrim(c.person_name) = btrim(u.name)
    LIMIT 1;
  END IF;
  v_is_salary := COALESCE(v_is_salary, false);

  -- The set week that holds on the Sunday asked for: the newest save among the rows that have started by then.
  SELECT h.days INTO v_before
  FROM public.person_available_hours h
  WHERE h.user_id = p_user_id AND h.kind = 'set' AND h.effective_from <= p_effective_from
  ORDER BY h.created_at DESC
  LIMIT 1;

  -- A take-off that takes a set week off a salaried person leaves the standard week on pay. With no set week in
  -- force it takes nothing off, and the week on pay stands.
  IF p_days IS NULL AND v_is_salary AND v_before IS NOT NULL THEN
    v_new_week := v_standard_week;
  END IF;

  -- Pay moves when a salaried person's day changes its length. Pay carries no date, so that starts this week.
  v_moved := v_is_salary AND v_new_week IS NOT NULL AND v_new_week IS DISTINCT FROM v_old_week;
  IF v_moved AND p_effective_from <> v_this_sunday THEN
    RAISE EXCEPTION 'This changes what a salaried day pays, and pay carries no date. Start it this week.';
  END IF;
  IF v_moved AND v_reason IS NULL THEN
    RAISE EXCEPTION 'Say why. This changes what a salaried day pays, and the reason goes on the pay log.';
  END IF;

  IF NOT p_dry_run THEN
    -- The clock's own time, not the transaction's, so two saves in one transaction still read newest last.
    INSERT INTO public.person_available_hours (user_id, hours_per_week, days, effective_from, note, set_by, kind, created_at)
    VALUES (p_user_id, v_hours, p_days, p_effective_from, v_reason, auth.uid(), 'set', clock_timestamp());

    IF v_moved THEN
      SELECT to_jsonb(c) - 'person_id' INTO v_before_row FROM public.people_pay_config c WHERE c.person_name = v_pay_name;
      UPDATE public.people_pay_config SET salaried_week_hours = v_new_week WHERE person_name = v_pay_name;
      SELECT to_jsonb(c) - 'person_id' INTO v_after_row FROM public.people_pay_config c WHERE c.person_name = v_pay_name;
      INSERT INTO public.pay_admin_events (person_name, action, payload, reason, actor)
      VALUES (
        v_pay_name,
        'set_pay_config',
        jsonb_build_object('changes', jsonb_build_object('salaried_week_hours', to_jsonb(v_new_week)), 'before', v_before_row, 'after', v_after_row, 'by', 'set_working_hours'),
        v_reason,
        auth.uid()
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'status', CASE WHEN p_dry_run THEN 'planned' ELSE 'set' END,
    'user_id', p_user_id,
    'effective_from', p_effective_from,
    'cleared', p_days IS NULL,
    'hours_per_week', v_hours,
    'days', p_days,
    'before', v_before,
    'pay', jsonb_build_object(
      'salaried', v_is_salary,
      'moved', v_moved,
      'before', CASE WHEN v_is_salary THEN to_jsonb(v_old_week) END,
      'after', CASE WHEN v_is_salary THEN to_jsonb(COALESCE(v_new_week, v_old_week)) END
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_working_hours(uuid, jsonb, date, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_working_hours(uuid, jsonb, date, text, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.set_working_hours(uuid, jsonb, date, text, boolean) IS
  'Sets a person''s working hours: one set row on person_available_hours from this week''s Sunday or next week''s, and for a salaried person the seven hour numbers on their pay row with a line on the pay log. A dev or the controller only. A change to a salaried day''s length starts this week and needs a reason. p_days null takes working hours off again: for a salaried person with a set week in force that puts the standard week, 8 hours Monday to Friday, back on their pay row, which is a change to pay like any other. p_dry_run answers what a save would do and writes nothing.';
