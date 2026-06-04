-- Clearer merge auth errors for assistants; skip estimates count when table is absent (partial deploys).

CREATE OR REPLACE FUNCTION public.assert_caller_can_merge_customer_pair(
  p_survivor_master_user_id uuid,
  p_victim_master_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician')
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'assistant'
  ) THEN
    IF p_survivor_master_user_id IS NULL OR p_victim_master_user_id IS NULL THEN
      RAISE EXCEPTION 'Merge needs a Customer Master on both customers. Use Advanced in Edit customer to assign masters, then try again.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.master_assistants
      WHERE assistant_id = auth.uid()
        AND master_id = p_survivor_master_user_id
    ) THEN
      RAISE EXCEPTION 'You must be adopted by the master who owns the customer you opened (see Advanced → Customer Master).';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.master_assistants
      WHERE assistant_id = auth.uid()
        AND master_id = p_victim_master_user_id
    ) THEN
      RAISE EXCEPTION 'You must be adopted by the master who owns the other customer before merging.';
    END IF;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Not allowed to merge customers';
END;
$$;

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

  PERFORM public.assert_caller_can_merge_customer_pair(v_survivor.master_user_id, v_victim.master_user_id);

  v_survivor_stripe := v_survivor.stripe_customer_id IS NOT NULL AND trim(v_survivor.stripe_customer_id) <> '';
  v_victim_stripe := v_victim.stripe_customer_id IS NOT NULL AND trim(v_victim.stripe_customer_id) <> '';
  v_stripe_blocked := v_survivor_stripe AND v_victim_stripe
    AND trim(v_survivor.stripe_customer_id) IS DISTINCT FROM trim(v_victim.stripe_customer_id);

  SELECT count(*)::int INTO v_bites FROM public.bids WHERE customer_id = p_victim;
  SELECT count(*)::int INTO v_jobs FROM public.jobs_ledger WHERE customer_id = p_victim;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'estimates'
  ) THEN
    SELECT count(*)::int INTO v_est FROM public.estimates WHERE customer_id = p_victim;
  ELSE
    v_est := 0;
  END IF;

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
