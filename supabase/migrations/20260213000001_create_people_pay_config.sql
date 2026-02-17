-- People Pay Config: global wage/salary/show per person (person_name matches roster)
-- Only dev and approved masters can read/write

CREATE TABLE IF NOT EXISTS public.people_pay_config (
  person_name TEXT NOT NULL PRIMARY KEY,
  hourly_wage NUMERIC(10, 2) DEFAULT NULL,
  is_salary BOOLEAN NOT NULL DEFAULT false,
  show_in_hours BOOLEAN NOT NULL DEFAULT false
);

COMMENT ON TABLE public.people_pay_config IS 'Pay config per person: wage, salary flag, show in Hours tab. Global; dev and approved masters only.';

ALTER TABLE public.people_pay_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs and approved masters can manage people pay config"
ON public.people_pay_config
FOR ALL
USING (public.is_pay_approved_master())
WITH CHECK (public.is_pay_approved_master());
