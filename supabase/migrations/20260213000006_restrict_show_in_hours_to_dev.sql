-- Restrict show_in_hours changes to dev only (defense in depth)
-- Approved masters can still edit wage, salary, show_in_cost_matrix

CREATE OR REPLACE FUNCTION public.check_show_in_hours_dev_only()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.show_in_hours IS DISTINCT FROM NEW.show_in_hours AND NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only dev can change Show in Hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER people_pay_config_show_in_hours_dev_only
  BEFORE UPDATE ON public.people_pay_config
  FOR EACH ROW EXECUTE FUNCTION public.check_show_in_hours_dev_only();
