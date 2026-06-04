-- Assigns contract templates to people (many-to-many)

CREATE TABLE IF NOT EXISTS public.person_contract_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_name TEXT NOT NULL,
  template_id UUID NOT NULL REFERENCES public.contract_templates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(person_name, template_id)
);

CREATE INDEX IF NOT EXISTS idx_person_contract_assignments_person ON public.person_contract_assignments(person_name);
CREATE INDEX IF NOT EXISTS idx_person_contract_assignments_template ON public.person_contract_assignments(template_id);

COMMENT ON TABLE public.person_contract_assignments IS 'Template assignments per person. Same access as person_licenses.';

ALTER TABLE public.person_contract_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pay access users can manage person contract assignments"
ON public.person_contract_assignments FOR ALL
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
