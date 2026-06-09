-- Dual hourly rate (office vs. field-job) pay.
--
-- A worker may opt into a second hourly rate: an "office rate" for time on office work
-- (the configured office job + any bid + unassigned time) and the normal hourly_wage for
-- time on real field jobs. NULL office_hourly_wage = single-rate (legacy behavior).
-- Ignored for salaried people.
alter table public.people_pay_config
  add column if not exists office_hourly_wage numeric;

comment on column public.people_pay_config.office_hourly_wage is
  'Hourly rate for office/bid/unassigned time. NULL = single rate (hourly_wage everywhere). Ignored when is_salary.';

-- Persisted office/field breakdown for itemized pay-stub days. NULL on single-rate stubs.
-- The day total stays in hours_at_time / rate_at_time (blended) / paid_amount.
alter table public.pay_stub_days
  add column if not exists office_hours numeric(6,2),
  add column if not exists office_rate numeric(10,2),
  add column if not exists job_hours numeric(6,2),
  add column if not exists job_rate numeric(10,2);

comment on column public.pay_stub_days.office_hours is
  'Office-bucket hours for this day (office job + bids + unassigned). NULL = single-rate stub day.';
comment on column public.pay_stub_days.job_hours is
  'Field-job-bucket hours for this day. NULL = single-rate stub day.';
