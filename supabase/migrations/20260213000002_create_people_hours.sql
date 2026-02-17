-- People Hours: hours worked per person per day
-- Dev, approved masters, and assistants of approved masters can read/write

CREATE TABLE IF NOT EXISTS public.people_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_name TEXT NOT NULL,
  work_date DATE NOT NULL,
  hours NUMERIC(6, 2) NOT NULL DEFAULT 0,
  entered_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(person_name, work_date)
);

CREATE INDEX IF NOT EXISTS idx_people_hours_person_date ON public.people_hours(person_name, work_date);
CREATE INDEX IF NOT EXISTS idx_people_hours_work_date ON public.people_hours(work_date);

COMMENT ON TABLE public.people_hours IS 'Hours worked per person per day. Entered by assistants of approved masters or dev/master.';

ALTER TABLE public.people_hours ENABLE ROW LEVEL SECURITY;

-- SELECT: dev, approved master, or assistant of approved master
CREATE POLICY "Pay access users can read people hours"
ON public.people_hours
FOR SELECT
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);

-- INSERT/UPDATE: same
CREATE POLICY "Pay access users can insert people hours"
ON public.people_hours
FOR INSERT
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);

CREATE POLICY "Pay access users can update people hours"
ON public.people_hours
FOR UPDATE
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
)
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);
