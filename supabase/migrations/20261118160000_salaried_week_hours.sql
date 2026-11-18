SET lock_timeout = '3s';

-- A salaried week of the person's own shape (v2.7826): one column on the pay row, and the rule that reads it.
--
-- A salaried person was paid, costed and scheduled as a flat 8 hours on each weekday and nothing on a weekend. The 8
-- and the weekend were written into the payroll kernel, the cost readers, five functions and the workday template's
-- checks. A person on salary for a 30-hour week could only be entered as 8 hours at a lower wage, which paid the right
-- money and showed the wrong wage, the wrong hours on a job and a shift two hours too long. A short Friday, four
-- ten-hour days or a Saturday could not be entered at all.
--
-- `salaried_week_hours` is the paid hours of each day of this person's week, seven numbers, Sunday first. A day off
-- is 0. It defaults to 0, 8, 8, 8, 8, 8, 0, so every row reads as it did. Nothing reads or writes the column yet: the
-- payroll kernel and the Pay & schedule card come next, then the cost readers and functions, then the workday
-- template.
--
-- The check holds a week to seven numbers, none missing, each from 0 to 16 in quarter hours. Quarter hours match the
-- template's 15-minute step. A week of all zeros is allowed here. The card asks for at least one day.
--
-- `salaried_hours_on(week, day)` is the one place SQL asks how many hours a salaried person is paid on a day. The
-- functions that carry the 8 will call it. A week that is missing reads as the old rule, 8 on a weekday.
--
-- Nothing else changes. The policies on people_pay_config are by row, so whoever may change a wage may change the
-- week, and nobody else gains anything. It has no meaning on a row that is not salaried.

-- A week is seven numbers, Sunday first, none missing, each from 0 to 16 in quarter hours. The coalesce matters: a
-- check passes on null, and an empty array's dimensions are null.
CREATE OR REPLACE FUNCTION public.salaried_week_hours_ok(p_week numeric[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT coalesce(
    p_week IS NOT NULL
    AND array_ndims(p_week) = 1
    AND array_lower(p_week, 1) = 1
    AND array_length(p_week, 1) = 7
    AND NOT EXISTS (
      SELECT 1 FROM unnest(p_week) AS h
      WHERE h IS NULL OR h < 0 OR h > 16 OR h * 4 <> trunc(h * 4)
    ),
    false
  );
$$;

-- The paid hours of a day: that weekday's number, Sunday being the first. A missing week is 8 on a weekday.
CREATE OR REPLACE FUNCTION public.salaried_hours_on(p_week numeric[], p_day date)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT coalesce(
    p_week[extract(dow FROM p_day)::int + 1],
    CASE WHEN extract(dow FROM p_day) BETWEEN 1 AND 5 THEN 8 ELSE 0 END
  )::numeric;
$$;

REVOKE ALL ON FUNCTION public.salaried_week_hours_ok(numeric[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.salaried_hours_on(numeric[], date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salaried_week_hours_ok(numeric[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.salaried_hours_on(numeric[], date) TO authenticated, service_role;

ALTER TABLE public.people_pay_config
  ADD COLUMN IF NOT EXISTS salaried_week_hours numeric(4,2)[] NOT NULL DEFAULT '{0,8,8,8,8,8,0}';

-- Named, so a second run finds it and adds nothing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.people_pay_config'::regclass AND conname = 'people_pay_config_salaried_week_hours_check'
  ) THEN
    ALTER TABLE public.people_pay_config
      ADD CONSTRAINT people_pay_config_salaried_week_hours_check
      CHECK (public.salaried_week_hours_ok(salaried_week_hours));
  END IF;
END $$;

COMMENT ON COLUMN public.people_pay_config.salaried_week_hours IS 'The paid hours of each day of this person''s salaried week: seven numbers, Sunday first, in quarter hours, 0 for a day off. 0, 8, 8, 8, 8, 8, 0 by default. A salaried person is paid and costed that day''s hours at hourly_wage. No meaning on a row that is not salaried. Read in SQL with salaried_hours_on.';
