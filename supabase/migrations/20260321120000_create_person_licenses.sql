-- Person licenses: license type, note, date of expiry per person
-- Same RLS as pay_stubs / person_offsets

CREATE TABLE IF NOT EXISTS public.person_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_name TEXT NOT NULL,
  license_type TEXT NOT NULL,
  note TEXT,
  date_of_expiry DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_person_licenses_person_name ON public.person_licenses(person_name);
CREATE INDEX IF NOT EXISTS idx_person_licenses_date_of_expiry ON public.person_licenses(date_of_expiry);

COMMENT ON TABLE public.person_licenses IS 'Licenses per person (plumber, journeyman, etc.). Same access as pay_stubs.';

ALTER TABLE public.person_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pay access users can manage person licenses"
ON public.person_licenses FOR ALL
USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
)
WITH CHECK (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);
