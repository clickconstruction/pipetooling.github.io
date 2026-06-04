-- Add record_hours_but_salary to people_pay_config
-- When true (and is_salary is true): salaried employees can enter hours for record-keeping,
-- but payroll and job costing still use salary logic (8 hrs/day).

ALTER TABLE public.people_pay_config
ADD COLUMN IF NOT EXISTS record_hours_but_salary BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.people_pay_config.record_hours_but_salary IS 'When is_salary: allow entering hours in Hours tab for record-keeping; payroll and job cost still use salary (8 hrs/day).';
