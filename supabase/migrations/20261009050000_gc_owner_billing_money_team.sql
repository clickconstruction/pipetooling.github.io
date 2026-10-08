SET lock_timeout = '3s';

-- GC mode, the Owner Billing door (v2.4943): change orders, Bill the customer and Money open to the money team,
-- dev, the leaders and the controller (to-dos/gc-mode/mockups/door-owner-billing.md on branch spike/gc-mode).
-- O1's seven tables swap their dev-only policy for public.gc_money_team(), the audience B5-a named once. Every
-- Owner Billing function is SECURITY INVOKER, so this is their gate too. anon has no grant on these tables (O1),
-- and the sent records keep their missing UPDATE and DELETE privileges, which no policy can open.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gc_owner_contract_lines', 'gc_change_orders', 'gc_owner_pay_apps', 'gc_owner_pay_app_lines',
    'gc_owner_pay_reminders', 'gc_owner_interest_bills', 'gc_owner_acceptances'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_dev', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_money', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((SELECT public.gc_money_team())) WITH CHECK ((SELECT public.gc_money_team()))',
      t || '_money', t);
  END LOOP;
END $$;

-- Our terms with the customer, O1's nine columns, are the money team's to change; the rest of the row stays door 1's.
-- The service role passes (auth.uid() IS NULL): gc-drive-access writes drive_folder_url as the service role.
CREATE OR REPLACE FUNCTION public.gc_projects_owner_terms_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.gc_money_team() AND (
    NEW.owner_contract_signed_on IS DISTINCT FROM OLD.owner_contract_signed_on
    OR NEW.owner_retainage_pct IS DISTINCT FROM OLD.owner_retainage_pct
    OR NEW.owner_retainage_step_at_pct IS DISTINCT FROM OLD.owner_retainage_step_at_pct
    OR NEW.owner_retainage_step_to_pct IS DISTINCT FROM OLD.owner_retainage_step_to_pct
    OR NEW.owner_retainage_step_way IS DISTINCT FROM OLD.owner_retainage_step_way
    OR NEW.owner_late_interest_pct_per_month IS DISTINCT FROM OLD.owner_late_interest_pct_per_month
    OR NEW.owner_late_finish_per_day IS DISTINCT FROM OLD.owner_late_finish_per_day
    OR NEW.owner_pay_days IS DISTINCT FROM OLD.owner_pay_days
    OR NEW.billing_job_id IS DISTINCT FROM OLD.billing_job_id) THEN
    RAISE EXCEPTION 'Our terms with the customer are for the owner, the leaders and the controller to change.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS gc_projects_owner_terms_guard ON public.gc_projects;
CREATE TRIGGER gc_projects_owner_terms_guard BEFORE UPDATE ON public.gc_projects FOR EACH ROW EXECUTE FUNCTION public.gc_projects_owner_terms_guard();
