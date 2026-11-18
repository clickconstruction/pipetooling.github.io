SET lock_timeout = '3s';

-- A salaried day of the person's own length (v2.7826): one column on the pay row.
--
-- A salaried person was paid, costed and scheduled as a flat 8 hours on each weekday, and the 8 was written into
-- the payroll kernel, the cost readers, five functions and the workday template's checks. A person on salary for a
-- 30-hour week (6 hours a day, five days) could only be entered as 8 hours at a lower wage, which paid the right
-- money and showed the wrong wage, the wrong hours on a job and a shift two hours too long.
--
-- `salaried_day_hours` is the length of this person's salaried day. It defaults to 8, so every row reads as it did.
-- This is the database half. Nothing reads or writes the column yet: the payroll kernel and the Pay & schedule card
-- come next, then the cost readers and functions, then the workday template.
--
-- The check holds a day to quarter hours, above 0 and at most 16. Quarter hours match the template's 15-minute step.
--
-- Nothing else changes. The policies on people_pay_config are by row, so whoever may change a wage may change the
-- day's length, and nobody else gains anything. It has no meaning on a row that is not salaried.

ALTER TABLE public.people_pay_config
  ADD COLUMN IF NOT EXISTS salaried_day_hours numeric(4,2) NOT NULL DEFAULT 8;

-- Named, so a second run finds it and adds nothing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.people_pay_config'::regclass AND conname = 'people_pay_config_salaried_day_hours_check'
  ) THEN
    ALTER TABLE public.people_pay_config
      ADD CONSTRAINT people_pay_config_salaried_day_hours_check
      CHECK (salaried_day_hours > 0 AND salaried_day_hours <= 16 AND salaried_day_hours * 4 = trunc(salaried_day_hours * 4));
  END IF;
END $$;

COMMENT ON COLUMN public.people_pay_config.salaried_day_hours IS 'The length of this person''s salaried day in hours, in quarter hours, 8 by default. A salaried person is paid and costed this many hours on each weekday at hourly_wage. No meaning on a row that is not salaried.';
