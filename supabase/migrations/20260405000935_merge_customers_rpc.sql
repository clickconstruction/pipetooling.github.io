-- Customer merge: preview + atomic merge (dev and master_technician only).
-- Repoints FKs from victim to survivor, applies chosen scalar fields on survivor, deletes victim.
-- Stripe: block when both have distinct non-null stripe_customer_id; move victim's to survivor if survivor's is null.

CREATE OR REPLACE FUNCTION public.auth_user_can_merge_customers()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician')
  );
$$;

REVOKE ALL ON FUNCTION public.auth_user_can_merge_customers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_user_can_merge_customers() TO authenticated;

CREATE OR REPLACE FUNCTION public.preview_merge_customers(p_survivor uuid, p_victim uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survivor public.customers%ROWTYPE;
  v_victim public.customers%ROWTYPE;
  v_bites int;
  v_jobs int;
  v_est int;
  v_proj int;
  v_cont int;
  v_persons int;
  v_victim_stripe boolean;
  v_survivor_stripe boolean;
  v_stripe_blocked boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.auth_user_can_merge_customers() THEN
    RAISE EXCEPTION 'Not allowed to merge customers';
  END IF;
  IF p_survivor IS NULL OR p_victim IS NULL OR p_survivor = p_victim THEN
    RAISE EXCEPTION 'Invalid customer pair';
  END IF;

  SELECT * INTO v_survivor FROM public.customers WHERE id = p_survivor FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Survivor customer not found';
  END IF;
  SELECT * INTO v_victim FROM public.customers WHERE id = p_victim FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Victim customer not found';
  END IF;

  v_survivor_stripe := v_survivor.stripe_customer_id IS NOT NULL AND trim(v_survivor.stripe_customer_id) <> '';
  v_victim_stripe := v_victim.stripe_customer_id IS NOT NULL AND trim(v_victim.stripe_customer_id) <> '';
  v_stripe_blocked := v_survivor_stripe AND v_victim_stripe
    AND trim(v_survivor.stripe_customer_id) IS DISTINCT FROM trim(v_victim.stripe_customer_id);

  SELECT count(*)::int INTO v_bites FROM public.bids WHERE customer_id = p_victim;
  SELECT count(*)::int INTO v_jobs FROM public.jobs_ledger WHERE customer_id = p_victim;
  SELECT count(*)::int INTO v_est FROM public.estimates WHERE customer_id = p_victim;
  SELECT count(*)::int INTO v_proj FROM public.projects WHERE customer_id = p_victim;
  SELECT count(*)::int INTO v_cont FROM public.customer_contacts WHERE customer_id = p_victim;
  SELECT count(*)::int INTO v_persons FROM public.customer_contact_persons WHERE customer_id = p_victim;

  RETURN jsonb_build_object(
    'victim_counts', jsonb_build_object(
      'bids', v_bites,
      'jobs_ledger', v_jobs,
      'estimates', v_est,
      'projects', v_proj,
      'customer_contacts', v_cont,
      'customer_contact_persons', v_persons
    ),
    'victim_has_stripe', v_victim_stripe,
    'survivor_has_stripe', v_survivor_stripe,
    'stripe_blocked', v_stripe_blocked
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_merge_customers(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_merge_customers(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.merge_customers(p_survivor uuid, p_victim uuid, p_field_choices jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survivor public.customers%ROWTYPE;
  v_victim public.customers%ROWTYPE;
  v_src_name text;
  v_src_address text;
  v_src_contact jsonb;
  v_src_type text;
  v_src_date_met date;
  v_src_master uuid;
  v_survivor_stripe boolean;
  v_victim_stripe boolean;
  v_choice text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.auth_user_can_merge_customers() THEN
    RAISE EXCEPTION 'Not allowed to merge customers';
  END IF;
  IF p_survivor IS NULL OR p_victim IS NULL OR p_survivor = p_victim THEN
    RAISE EXCEPTION 'Invalid customer pair';
  END IF;

  SELECT * INTO v_survivor FROM public.customers WHERE id = p_survivor FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Survivor customer not found';
  END IF;
  SELECT * INTO v_victim FROM public.customers WHERE id = p_victim FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Victim customer not found';
  END IF;

  v_survivor_stripe := v_survivor.stripe_customer_id IS NOT NULL AND trim(v_survivor.stripe_customer_id) <> '';
  v_victim_stripe := v_victim.stripe_customer_id IS NOT NULL AND trim(v_victim.stripe_customer_id) <> '';
  IF v_survivor_stripe AND v_victim_stripe
     AND trim(v_survivor.stripe_customer_id) IS DISTINCT FROM trim(v_victim.stripe_customer_id) THEN
    RAISE EXCEPTION 'Both customers have different Stripe customer ids; resolve in Stripe before merging';
  END IF;

  -- Per-field source: 'survivor' | 'victim' (default survivor)
  v_choice := lower(coalesce(p_field_choices->>'name', 'survivor'));
  IF v_choice = 'victim' THEN v_src_name := v_victim.name; ELSE v_src_name := v_survivor.name; END IF;

  v_choice := lower(coalesce(p_field_choices->>'address', 'survivor'));
  IF v_choice = 'victim' THEN v_src_address := v_victim.address; ELSE v_src_address := v_survivor.address; END IF;

  v_choice := lower(coalesce(p_field_choices->>'contact_info', 'survivor'));
  IF v_choice = 'victim' THEN
    v_src_contact := to_jsonb(v_victim.contact_info);
  ELSE
    v_src_contact := to_jsonb(v_survivor.contact_info);
  END IF;

  v_choice := lower(coalesce(p_field_choices->>'customer_type', 'survivor'));
  IF v_choice = 'victim' THEN v_src_type := v_victim.customer_type; ELSE v_src_type := v_survivor.customer_type; END IF;

  v_choice := lower(coalesce(p_field_choices->>'date_met', 'survivor'));
  IF v_choice = 'victim' THEN v_src_date_met := v_victim.date_met; ELSE v_src_date_met := v_survivor.date_met; END IF;

  v_choice := lower(coalesce(p_field_choices->>'master_user_id', 'survivor'));
  IF v_choice = 'victim' THEN v_src_master := v_victim.master_user_id; ELSE v_src_master := v_survivor.master_user_id; END IF;

  -- Repoint foreign keys (victim -> survivor)
  UPDATE public.bids SET customer_id = p_survivor WHERE customer_id = p_victim;
  UPDATE public.jobs_ledger SET customer_id = p_survivor WHERE customer_id = p_victim;
  UPDATE public.estimates SET customer_id = p_survivor WHERE customer_id = p_victim;
  UPDATE public.projects SET customer_id = p_survivor WHERE customer_id = p_victim;
  UPDATE public.customer_contacts SET customer_id = p_survivor WHERE customer_id = p_victim;
  UPDATE public.customer_contact_persons SET customer_id = p_survivor WHERE customer_id = p_victim;

  -- Apply merged scalar row on survivor
  UPDATE public.customers
  SET
    name = v_src_name,
    address = v_src_address,
    contact_info = v_src_contact,
    customer_type = v_src_type,
    date_met = v_src_date_met,
    master_user_id = v_src_master,
    stripe_customer_id = CASE
      WHEN v_survivor_stripe THEN v_survivor.stripe_customer_id
      WHEN v_victim_stripe AND NOT v_survivor_stripe THEN v_victim.stripe_customer_id
      ELSE v_survivor.stripe_customer_id
    END,
    updated_at = now()
  WHERE id = p_survivor;

  DELETE FROM public.customers WHERE id = p_victim;

  RETURN jsonb_build_object(
    'survivor_id', p_survivor,
    'removed_id', p_victim
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_customers(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_customers(uuid, uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.preview_merge_customers(uuid, uuid) IS 'Preview counts and Stripe merge eligibility (dev/master only).';
COMMENT ON FUNCTION public.merge_customers(uuid, uuid, jsonb) IS 'Atomically merge victim into survivor; p_field_choices keys name, address, contact_info, customer_type, date_met, master_user_id with values survivor|victim.';
