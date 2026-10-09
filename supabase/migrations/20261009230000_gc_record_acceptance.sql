SET lock_timeout = '3s';

-- The customer accepts the work (decision 5): the office records it here, their portal's Accept the work
-- calls it as the service role with how = 'portal' (O7c). Only once every line is billed: the last progress
-- pay application's work so far covers the contract today (the kernel's ownerAllBilled, checked in the
-- client too). Our final pay application waits for it (gc_send_owner_pay_app already refuses before).
CREATE OR REPLACE FUNCTION public.gc_record_acceptance(p_project_id uuid, p_on date, p_by_name text, p_how text DEFAULT 'office', p_note text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_gc public.gc_projects%ROWTYPE;
  v_on date;
  v_work numeric;
BEGIN
  IF p_how = 'portal' AND current_user <> 'service_role' THEN
    RAISE EXCEPTION 'Only the customer''s portal records an acceptance as theirs.';
  END IF;
  IF p_how = 'office' AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to record that they accepted the work.';
  END IF;
  IF p_how IS NULL OR p_how NOT IN ('office', 'portal') THEN
    RAISE EXCEPTION 'They accept the work at the office or in their portal.';
  END IF;
  SELECT * INTO v_gc FROM public.gc_projects WHERE project_id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That GC project is not there.';
  END IF;
  IF v_gc.stage = 'bidding' OR v_gc.lost_on IS NOT NULL THEN
    RAISE EXCEPTION 'Only a job we won is accepted.';
  END IF;
  SELECT accepted_on INTO v_on FROM public.gc_owner_acceptances WHERE project_id = p_project_id;
  IF FOUND THEN
    RAISE EXCEPTION 'They accepted the work on %.', to_char(v_on, 'Mon FMDD');
  END IF;
  IF p_on IS NULL OR p_on > public.app_today() THEN
    RAISE EXCEPTION 'Pick the day they accepted it. It cannot be still to come.';
  END IF;
  IF btrim(COALESCE(p_by_name, '')) = '' THEN
    RAISE EXCEPTION 'Say who walked it and accepted it.';
  END IF;
  SELECT work_to_date INTO v_work FROM public.gc_owner_pay_apps
  WHERE project_id = p_project_id AND NOT final ORDER BY number DESC LIMIT 1;
  IF v_work IS NULL OR v_work < public.gc_owner_contract_now(p_project_id) - 0.5 THEN
    RAISE EXCEPTION 'Bill every line first. They accept the work once our pay applications have billed all of it.';
  END IF;
  INSERT INTO public.gc_owner_acceptances (project_id, accepted_on, accepted_by_name, how, note)
  VALUES (p_project_id, p_on, btrim(p_by_name), p_how, btrim(COALESCE(p_note, '')));
END;
$$;

COMMENT ON FUNCTION public.gc_record_acceptance(uuid, date, text, text, text) IS
  'GC mode (O7a): the customer accepts the work on a GC project, as the office records it (how = office) or their portal presses it (how = portal, the service role only). Once, and only when every line is billed. Our final pay application waits for it. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_record_acceptance(uuid, date, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_record_acceptance(uuid, date, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_record_acceptance(uuid, date, text, text, text) TO authenticated, service_role;

-- An acceptance stays once our final pay application went on it; before that the money team may fix a
-- mistake (the Owner Billing door's policy). The project's cascade passes.
CREATE OR REPLACE FUNCTION public.gc_owner_acceptances_keep()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() <= 1 AND EXISTS (SELECT 1 FROM public.gc_owner_pay_apps WHERE project_id = OLD.project_id AND final) THEN
    RAISE EXCEPTION 'Our final pay application went on this acceptance, so it stays.';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS gc_owner_acceptances_keep ON public.gc_owner_acceptances;
CREATE TRIGGER gc_owner_acceptances_keep
  BEFORE UPDATE OR DELETE ON public.gc_owner_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.gc_owner_acceptances_keep();
