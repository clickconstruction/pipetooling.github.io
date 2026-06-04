-- Pay Stub Days: per-day allocation when a pay stub is generated
-- Enables mismatch detection when hours change after payment
-- Same RLS as pay_stubs

CREATE TABLE IF NOT EXISTS public.pay_stub_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_stub_id UUID NOT NULL REFERENCES public.pay_stubs(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  work_date DATE NOT NULL,
  hours_at_time NUMERIC(6, 2) NOT NULL,
  rate_at_time NUMERIC(10, 2) NOT NULL,
  paid_amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pay_stub_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_pay_stub_days_person_date ON public.pay_stub_days(person_name, work_date);
CREATE INDEX IF NOT EXISTS idx_pay_stub_days_pay_stub_id ON public.pay_stub_days(pay_stub_id);

COMMENT ON TABLE public.pay_stub_days IS 'Per-day paid amounts when pay stub generated. Immutable for mismatch detection.';

ALTER TABLE public.pay_stub_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pay access users can read pay stub days"
ON public.pay_stub_days
FOR SELECT
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);

CREATE POLICY "Pay access users can insert pay stub days"
ON public.pay_stub_days
FOR INSERT
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);

-- Backfill existing pay_stubs with daily allocations
-- Uses current people_hours and pay_config; historical mismatches may appear if data changed
INSERT INTO public.pay_stub_days (pay_stub_id, person_name, work_date, hours_at_time, rate_at_time, paid_amount)
SELECT
  ps.id,
  ps.person_name,
  d::date,
  CASE
    WHEN COALESCE(ppc.is_salary, false) THEN
      CASE WHEN EXTRACT(DOW FROM d) IN (1, 2, 3, 4, 5) THEN 8 ELSE 0 END
    ELSE COALESCE(ph.hours, 0)
  END AS hours_at_time,
  COALESCE(ppc.hourly_wage, 0) AS rate_at_time,
  (CASE
    WHEN COALESCE(ppc.is_salary, false) THEN
      CASE WHEN EXTRACT(DOW FROM d) IN (1, 2, 3, 4, 5) THEN 8 ELSE 0 END
    ELSE COALESCE(ph.hours, 0)
  END) * COALESCE(ppc.hourly_wage, 0) AS paid_amount
FROM public.pay_stubs ps
CROSS JOIN LATERAL generate_series(ps.period_start::timestamp, ps.period_end::timestamp, '1 day'::interval) AS d
LEFT JOIN public.people_hours ph ON ph.person_name = ps.person_name AND ph.work_date = d::date
LEFT JOIN public.people_pay_config ppc ON ppc.person_name = ps.person_name
ON CONFLICT (pay_stub_id, work_date) DO NOTHING;
