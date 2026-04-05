-- Atomic: insert jobs_ledger from an accepted estimate and set estimates.job_ledger_id.
-- SECURITY DEFINER so estimators (and others who can link accepted estimates but not INSERT jobs_ledger) can run it.
-- Permission: user_can_access_estimate OR superintendent_can_access_estimate for the estimate row.

CREATE UNIQUE INDEX IF NOT EXISTS estimates_job_ledger_id_unique
  ON public.estimates (job_ledger_id)
  WHERE job_ledger_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_job_from_estimate(
  p_estimate_id uuid,
  p_hcp_number text,
  p_job_name text DEFAULT NULL,
  p_job_address text DEFAULT NULL,
  p_revenue numeric DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.estimates%ROWTYPE;
  v_master uuid;
  v_override text;
  v_job_id uuid;
  v_link_rows int;
  v_existing_link uuid;
  v_hcp text;
  v_cust_id uuid;
  v_cust_name text;
  v_cust_email text;
  v_cust_phone text;
  j_name text;
  j_addr text;
  rev numeric(12, 2);
  crec RECORD;
  ci jsonb;
BEGIN
  v_hcp := trim(COALESCE(p_hcp_number, ''));
  IF v_hcp = '' THEN
    RAISE EXCEPTION 'hcp_number is required';
  END IF;

  SELECT * INTO e FROM public.estimates WHERE id = p_estimate_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'estimate not found';
  END IF;

  -- Idempotent: already linked
  IF e.job_ledger_id IS NOT NULL THEN
    RETURN e.job_ledger_id;
  END IF;

  IF e.status IS DISTINCT FROM 'customer_accepted' THEN
    RAISE EXCEPTION 'estimate must be customer_accepted';
  END IF;

  IF NOT (
    public.user_can_access_estimate(e) OR public.superintendent_can_access_estimate(e)
  ) THEN
    RAISE EXCEPTION 'not authorized to create job for this estimate';
  END IF;

  IF e.project_id IS NOT NULL THEN
    SELECT p.master_user_id INTO v_master FROM public.projects p WHERE p.id = e.project_id;
    IF v_master IS NULL THEN
      RAISE EXCEPTION 'project not found';
    END IF;
  ELSE
    SELECT s.value_text INTO v_override
    FROM public.app_settings s
    WHERE s.key = 'job_owner_override_' || auth.uid()::text;
    IF v_override IS NOT NULL AND trim(v_override) != '' THEN
      v_master := trim(v_override)::uuid;
    ELSE
      v_master := auth.uid();
    END IF;
  END IF;

  v_cust_id := COALESCE(p_customer_id, e.customer_id);

  IF v_cust_id IS NOT NULL THEN
    SELECT c.name, c.contact_info, c.master_user_id
    INTO crec
    FROM public.customers c
    WHERE c.id = v_cust_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'customer not found';
    END IF;
    IF crec.master_user_id IS DISTINCT FROM v_master THEN
      RAISE EXCEPTION 'customer does not belong to job owner';
    END IF;
    v_cust_name := crec.name;
    ci := COALESCE(crec.contact_info, '{}'::json)::jsonb;
    v_cust_email := NULLIF(trim(ci->>'email'), '');
    v_cust_phone := NULLIF(trim(ci->>'phone'), '');
  ELSE
    v_cust_name := NULL;
    v_cust_email := NULLIF(trim(COALESCE(e.customer_email, '')), '');
    v_cust_phone := NULL;
  END IF;

  j_name := COALESCE(NULLIF(trim(p_job_name), ''), NULLIF(trim(e.title), ''), '');
  j_addr := COALESCE(
    NULLIF(trim(p_job_address), ''),
    NULLIF(trim(e.for_address), ''),
    ''
  );
  rev := COALESCE(p_revenue, (e.total_cents::numeric / 100.0));

  INSERT INTO public.jobs_ledger (
    master_user_id,
    hcp_number,
    job_name,
    job_address,
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    project_id,
    revenue,
    payments_made
  ) VALUES (
    v_master,
    v_hcp,
    j_name,
    j_addr,
    v_cust_id,
    v_cust_name,
    v_cust_email,
    v_cust_phone,
    e.project_id,
    rev,
    0
  )
  RETURNING id INTO v_job_id;

  UPDATE public.estimates
  SET job_ledger_id = v_job_id
  WHERE id = e.id AND job_ledger_id IS NULL;
  GET DIAGNOSTICS v_link_rows = ROW_COUNT;
  IF v_link_rows = 0 THEN
    SELECT el.job_ledger_id INTO v_existing_link FROM public.estimates el WHERE el.id = e.id;
    IF v_existing_link IS NOT NULL THEN
      DELETE FROM public.jobs_ledger WHERE id = v_job_id;
      RETURN v_existing_link;
    END IF;
    RAISE EXCEPTION 'could not link estimate to job';
  END IF;

  RETURN v_job_id;
END;
$$;

COMMENT ON FUNCTION public.create_job_from_estimate(uuid, text, text, text, numeric, uuid) IS
  'Creates jobs_ledger from customer_accepted estimate and sets estimates.job_ledger_id (idempotent if already linked).';

REVOKE ALL ON FUNCTION public.create_job_from_estimate(uuid, text, text, text, numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_job_from_estimate(uuid, text, text, text, numeric, uuid) TO authenticated;
