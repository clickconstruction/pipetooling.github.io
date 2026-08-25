SET lock_timeout = '3s';

-- Cost estimates open to the controller (v2.2250 shipped them dev-only): the
-- controller already reads people_pay_config wages, which is all a cost chip
-- reveals. Deliberately NOT has_payroll_access() — that also includes
-- pay-approved masters, who don't get the cost lens yet.
DROP POLICY IF EXISTS checklist_item_costs_dev_all ON public.checklist_item_costs;
CREATE POLICY checklist_item_costs_dev_all ON public.checklist_item_costs
  FOR ALL
  USING (public.is_dev() OR public.is_controller())
  WITH CHECK (public.is_dev() OR public.is_controller());
