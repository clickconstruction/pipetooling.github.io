SET lock_timeout = '3s';

-- Working hours, the database door: a week with a start and an end for each day, set for a person by a dev or the
-- controller, in 15-minute blocks.
--
-- Three things described a person's week and nothing held them to each other: the seven hour numbers on pay
-- (people_pay_config.salaried_week_hours), the workday template that makes a salaried person's clock sessions
-- (always 8 hours), and the week a person says they can work (person_available_hours, seven days of start and end
-- minutes from a Sunday on, append-only). Only the last has the shape of working hours, and pay and the clock do
-- not read it. This migration makes it able to hold them, and adds the one door that writes them. Nothing reads a
-- set week yet, so no screen, pay figure or session changes.
--
-- `kind` is `answer` for the week a person can work, as every row is today, or `set` for working hours. A set week
-- is seven days, Sunday first, each with no range, one range, or two with a break between: [start, end] in minutes
-- on the person's own clock, every time on a quarter hour, no more than 16 hours a day (`working_week_ok`). A set
-- row with no week takes working hours off again from its Sunday.
--
-- `set_working_hours` is the only way a set row is written. It refuses anyone who is not a dev or the controller.
-- For a salaried person it writes the seven hour numbers in the same transaction, each day's hours with the break
-- left out, so pay and cost keep reading the column they read and can never disagree with the hours. Pay carries
-- no date, so a change to a salaried day's length starts this week and asks for a reason, which goes on the pay
-- log. A change of times alone may start next week and needs no reason. `p_dry_run` answers what a save would do
-- and writes nothing.
--
-- The insert policy now takes an answer only, so nobody signed in can write a set row directly. Whoever could
-- answer for a person still can. `hours_per_week` widens from tenths to quarter hours.

-- A week of working hours: seven days, each with at most two ranges of whole minutes on a quarter hour, in order
-- with a break between them, inside the day, and no more than 16 hours in all. Never raises: a check passes on
-- null, so every way out is true or false.
CREATE OR REPLACE FUNCTION public.working_week_ok(p_days jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  v_day jsonb;
  v_seg jsonb;
  v_start numeric;
  v_end numeric;
  v_prev_end numeric;
  v_total numeric;
BEGIN
  IF p_days IS NULL OR jsonb_typeof(p_days) <> 'array' OR jsonb_array_length(p_days) <> 7 THEN
    RETURN false;
  END IF;
  FOR v_day IN SELECT value FROM jsonb_array_elements(p_days) LOOP
    IF jsonb_typeof(v_day) <> 'array' OR jsonb_array_length(v_day) > 2 THEN
      RETURN false;
    END IF;
    v_prev_end := NULL;
    v_total := 0;
    FOR v_seg IN SELECT value FROM jsonb_array_elements(v_day) LOOP
      IF jsonb_typeof(v_seg) <> 'array' OR jsonb_array_length(v_seg) <> 2
         OR jsonb_typeof(v_seg -> 0) <> 'number' OR jsonb_typeof(v_seg -> 1) <> 'number' THEN
        RETURN false;
      END IF;
      v_start := (v_seg ->> 0)::numeric;
      v_end := (v_seg ->> 1)::numeric;
      IF v_start < 0 OR v_end > 1440 OR v_start >= v_end OR v_start % 15 <> 0 OR v_end % 15 <> 0 THEN
        RETURN false;
      END IF;
      IF v_prev_end IS NOT NULL AND v_start <= v_prev_end THEN
        RETURN false;
      END IF;
      v_prev_end := v_end;
      v_total := v_total + (v_end - v_start);
    END LOOP;
    IF v_total > 960 THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.working_week_ok(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.working_week_ok(jsonb) TO authenticated, service_role;

ALTER TABLE public.person_available_hours
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'answer';

-- Named, so a second run finds them and adds nothing. The hours widen only while they still hold tenths.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.person_available_hours'::regclass AND conname = 'person_available_hours_kind_check'
  ) THEN
    ALTER TABLE public.person_available_hours
      ADD CONSTRAINT person_available_hours_kind_check CHECK (kind IN ('answer', 'set'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.person_available_hours'::regclass AND conname = 'person_available_hours_set_week_check'
  ) THEN
    ALTER TABLE public.person_available_hours
      ADD CONSTRAINT person_available_hours_set_week_check
      CHECK (kind <> 'set' OR days IS NULL OR public.working_week_ok(days));
  END IF;
  IF (
    SELECT numeric_scale FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'person_available_hours' AND column_name = 'hours_per_week'
  ) = 1 THEN
    ALTER TABLE public.person_available_hours ALTER COLUMN hours_per_week TYPE numeric(5,2);
  END IF;
END $$;

COMMENT ON COLUMN public.person_available_hours.kind IS
  'answer: the week a person can work, said by them or by the office. set: working hours, written only by set_working_hours for a dev or the controller; days is then seven days of at most two [start, end] minute ranges on a quarter hour (working_week_ok), or null to take working hours off again from effective_from. A set week wins over any answer.';

-- An answer only: a set row has one door.
DROP POLICY IF EXISTS person_available_hours_write ON public.person_available_hours;
CREATE POLICY person_available_hours_write ON public.person_available_hours
  FOR INSERT TO authenticated
  WITH CHECK (
    kind = 'answer'
    AND set_by = auth.uid()
    AND (user_id = auth.uid() OR public.is_dev() OR public.is_assistant() OR public.has_payroll_access())
  );

-- A person's working hours on a day: that weekday's ranges from the set week in force, an empty list for a day
-- off, and null when nobody has set hours or they were taken off. The week in force is the newest save among the
-- rows that have started, not the one with the latest Sunday: hours saved for next week and then changed for this
-- week hold as changed, next week too, so a salaried person's pay numbers and hours never part. Runs as the
-- caller, so it answers what the caller may read.
CREATE OR REPLACE FUNCTION public.working_hours_on(p_user_id uuid, p_day date)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT (
    SELECT h.days -> extract(dow FROM p_day)::int
    FROM public.person_available_hours h
    WHERE h.user_id = p_user_id AND h.kind = 'set' AND h.effective_from <= p_day
    ORDER BY h.created_at DESC
    LIMIT 1
  );
$$;

REVOKE ALL ON FUNCTION public.working_hours_on(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.working_hours_on(uuid, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.working_hours_on(uuid, date) IS
  'A person''s working hours on a day: the weekday''s [start, end] minute ranges from the set week in force (person_available_hours.kind = set, the newest save among the rows that started on or before the day), [] for a day off, null with no working hours. Security invoker.';

-- The one door. A dev or the controller sets a person's working hours from this week's Sunday or next week's.
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

  -- Pay moves when a salaried person's day changes its length. Pay carries no date, so that starts this week.
  v_moved := v_is_salary AND p_days IS NOT NULL AND v_new_week IS DISTINCT FROM v_old_week;
  IF v_moved AND p_effective_from <> v_this_sunday THEN
    RAISE EXCEPTION 'This changes what a salaried day pays, and pay carries no date. Start it this week.';
  END IF;
  IF v_moved AND v_reason IS NULL THEN
    RAISE EXCEPTION 'Say why. This changes what a salaried day pays, and the reason goes on the pay log.';
  END IF;

  SELECT h.days INTO v_before
  FROM public.person_available_hours h
  WHERE h.user_id = p_user_id AND h.kind = 'set' AND h.effective_from <= p_effective_from
  ORDER BY h.created_at DESC
  LIMIT 1;

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
      'after', CASE WHEN v_is_salary AND p_days IS NOT NULL THEN to_jsonb(v_new_week) WHEN v_is_salary THEN to_jsonb(v_old_week) END
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_working_hours(uuid, jsonb, date, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_working_hours(uuid, jsonb, date, text, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.set_working_hours(uuid, jsonb, date, text, boolean) IS
  'Sets a person''s working hours: one set row on person_available_hours from this week''s Sunday or next week''s, and for a salaried person the seven hour numbers on their pay row with a line on the pay log. A dev or the controller only. A change to a salaried day''s length starts this week and needs a reason. p_days null takes working hours off again. p_dry_run answers what a save would do and writes nothing.';
