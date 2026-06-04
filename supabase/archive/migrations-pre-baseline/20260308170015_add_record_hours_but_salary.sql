ALTER TABLE public.people_pay_config
ADD COLUMN IF NOT EXISTS record_hours_but_salary BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.people_pay_config.record_hours_but_salary IS 'When is_salary: allow entering hours in Hours tab for record-keeping; payroll and job cost still use salary (8 hrs/day).';;
