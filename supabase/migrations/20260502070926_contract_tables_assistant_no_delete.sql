-- People → Contracts: assistants (is_assistant() true, not covered by stricter delete) cannot DELETE
-- rows on contract tables. SELECT/INSERT/UPDATE unchanged from 20260322140000_contracts_rls_all_masters.sql.

DROP POLICY IF EXISTS "Pay access users can manage contract templates" ON public.contract_templates;
CREATE POLICY "Pay access users can select contract templates"
ON public.contract_templates FOR SELECT
USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);
CREATE POLICY "Pay access users can insert contract templates"
ON public.contract_templates FOR INSERT
WITH CHECK (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);
CREATE POLICY "Pay access users can update contract templates"
ON public.contract_templates FOR UPDATE
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
CREATE POLICY "Pay access users can delete contract templates"
ON public.contract_templates FOR DELETE
USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
);

DROP POLICY IF EXISTS "Pay access users can manage contract template documents" ON public.contract_template_documents;
CREATE POLICY "Pay access users can select contract template documents"
ON public.contract_template_documents FOR SELECT
USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);
CREATE POLICY "Pay access users can insert contract template documents"
ON public.contract_template_documents FOR INSERT
WITH CHECK (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);
CREATE POLICY "Pay access users can update contract template documents"
ON public.contract_template_documents FOR UPDATE
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
CREATE POLICY "Pay access users can delete contract template documents"
ON public.contract_template_documents FOR DELETE
USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
);

DROP POLICY IF EXISTS "Pay access users can manage person contract assignments" ON public.person_contract_assignments;
CREATE POLICY "Pay access users can select person contract assignments"
ON public.person_contract_assignments FOR SELECT
USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);
CREATE POLICY "Pay access users can insert person contract assignments"
ON public.person_contract_assignments FOR INSERT
WITH CHECK (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);
CREATE POLICY "Pay access users can update person contract assignments"
ON public.person_contract_assignments FOR UPDATE
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
CREATE POLICY "Pay access users can delete person contract assignments"
ON public.person_contract_assignments FOR DELETE
USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
);

DROP POLICY IF EXISTS "Pay access users can manage person contract documents" ON public.person_contract_documents;
CREATE POLICY "Pay access users can select person contract documents"
ON public.person_contract_documents FOR SELECT
USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);
CREATE POLICY "Pay access users can insert person contract documents"
ON public.person_contract_documents FOR INSERT
WITH CHECK (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);
CREATE POLICY "Pay access users can update person contract documents"
ON public.person_contract_documents FOR UPDATE
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
CREATE POLICY "Pay access users can delete person contract documents"
ON public.person_contract_documents FOR DELETE
USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
);
