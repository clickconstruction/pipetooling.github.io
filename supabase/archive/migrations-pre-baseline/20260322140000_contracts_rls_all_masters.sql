-- Allow all masters (not just Pay Approved) to access contract tables.
-- Expands RLS to include is_master_or_dev() so non-pay-approved masters can manage contracts.

DROP POLICY IF EXISTS "Pay access users can manage contract templates" ON public.contract_templates;
CREATE POLICY "Pay access users can manage contract templates"
ON public.contract_templates FOR ALL
USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
)
WITH CHECK (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);

DROP POLICY IF EXISTS "Pay access users can manage contract template documents" ON public.contract_template_documents;
CREATE POLICY "Pay access users can manage contract template documents"
ON public.contract_template_documents FOR ALL
USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
)
WITH CHECK (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);

DROP POLICY IF EXISTS "Pay access users can manage person contract assignments" ON public.person_contract_assignments;
CREATE POLICY "Pay access users can manage person contract assignments"
ON public.person_contract_assignments FOR ALL
USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
)
WITH CHECK (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);

DROP POLICY IF EXISTS "Pay access users can manage person contract documents" ON public.person_contract_documents;
CREATE POLICY "Pay access users can manage person contract documents"
ON public.person_contract_documents FOR ALL
USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
)
WITH CHECK (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);
