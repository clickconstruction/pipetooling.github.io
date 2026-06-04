-- Recurring job report emails — optional wage-derived cost column per recipient
ALTER TABLE public.recurring_job_report_schedule_recipients
  ADD COLUMN include_costs boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.recurring_job_report_schedule_recipients.include_costs IS
  'When true, the digest Clock time table includes Cost (hours × people_pay_config.hourly_wage matched on trim(users.name) = person_name); missing wage shows em dash.';
