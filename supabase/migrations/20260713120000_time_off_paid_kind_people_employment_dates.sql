-- Employment tab groundwork (schema only; UI + payroll wiring land in follow-up PRs).
--
-- 1) user_time_off.kind gains 'paid' (previously CHECK-limited to 'unpaid').
--    Salary sync intentionally treats paid and unpaid alike — any time-off row deletes the
--    day's non-final salary_schedule sessions (its EXISTS check has never filtered on kind).
--    The paid/unpaid distinction is a payroll concept: client payroll math will subtract only
--    UNPAID weekdays from the salaried flat 8h credit; paid days keep pay. Salaried-only.
--
-- 2) people.start_date / people.end_date — employment window (nullable, inclusive dates).
--    Client payroll math will clamp the salaried flat 8/0 credit to this window so people
--    added mid-period or ended are not credited outside employment.

ALTER TABLE public.user_time_off
  DROP CONSTRAINT IF EXISTS user_time_off_kind_check;
ALTER TABLE public.user_time_off
  ADD CONSTRAINT user_time_off_kind_check CHECK (kind IN ('unpaid', 'paid'));

COMMENT ON COLUMN public.user_time_off.kind IS
  'unpaid | paid. Both clear salary_schedule sessions for the day (sync ignores kind); payroll subtracts only unpaid weekdays from the salaried flat 8h credit. Paid is salaried-only by product decision (hourly pay already follows logged hours).';

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS end_date date;

ALTER TABLE public.people
  DROP CONSTRAINT IF EXISTS people_employment_dates_order;
ALTER TABLE public.people
  ADD CONSTRAINT people_employment_dates_order
  CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date);

COMMENT ON COLUMN public.people.start_date IS
  'Employment start (inclusive, company calendar date). NULL = unknown/legacy: no clamping. Salaried payroll credit is clamped to [start_date, end_date].';
COMMENT ON COLUMN public.people.end_date IS
  'Employment end (inclusive, company calendar date). NULL = currently employed. Salaried payroll credit is clamped to [start_date, end_date].';
