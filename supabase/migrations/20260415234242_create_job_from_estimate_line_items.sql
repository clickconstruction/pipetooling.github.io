-- create_job_from_estimate: optional p_fixtures (Specific Work); revenue = sum(count * unit) when any row inserted.

DROP FUNCTION IF EXISTS public.create_job_from_estimate(uuid, text, text, text, numeric, uuid);

CREATE OR REPLACE FUNCTION public.create_job_from_estimate(
  p_estimate_id uuid,
  p_hcp_number text,
  p_job_name text DEFAULT NULL,
  p_job_address text DEFAULT NULL,
  p_revenue numeric DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_fixtures jsonb DEFAULT '[]'::jsonb
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
  fname text;
  fcount numeric;
  fprice numeric(12, 2);
  fdesc text;
  fseq int;
  v_fixture_inserts int := 0;
  v_fixture_rev numeric(12, 2) := 0;
  v_row_ext numeric(12, 2);
  fixture_el jsonb;
  idx int;
  v_len int;
BEGIN
  v_hcp := trim(COALESCE(p_hcp_number, ''));
  IF v_hcp = '' THEN
    RAISE EXCEPTION 'hcp_number is required';
  END IF;

  SELECT * INTO e FROM public.estimates WHERE id = p_estimate_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'estimate not found';
  END IF;

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
    ci := COALESCE(crec.contact_info::jsonb, '{}'::jsonb);
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

  IF p_fixtures IS NOT NULL AND jsonb_typeof(p_fixtures) = 'array' THEN
    v_len := jsonb_array_length(p_fixtures);
    IF v_len IS NOT NULL AND v_len > 0 THEN
      FOR idx IN 0 .. v_len - 1 LOOP
        fixture_el := p_fixtures->idx;
        BEGIN
          fname := NULLIF(trim(COALESCE(fixture_el->>'name', '')), '');
          IF fname IS NULL OR fname = '' THEN
            CONTINUE;
          END IF;

          fcount := 1;
          IF fixture_el ? 'count' AND fixture_el->>'count' IS NOT NULL AND btrim(fixture_el->>'count') != '' THEN
            fcount := (fixture_el->>'count')::numeric;
          END IF;
          IF fcount IS NULL OR fcount <= 0 THEN
            fcount := 1;
          END IF;

          fprice := NULL;
          IF fixture_el ? 'line_unit_price' AND fixture_el->>'line_unit_price' IS NOT NULL AND btrim(fixture_el->>'line_unit_price') != '' THEN
            fprice := round((fixture_el->>'line_unit_price')::numeric, 2);
          END IF;

          fdesc := NULLIF(trim(COALESCE(fixture_el->>'line_description', '')), '');

          fseq := 0;
          IF fixture_el ? 'sequence_order' AND fixture_el->>'sequence_order' IS NOT NULL AND btrim(fixture_el->>'sequence_order') != '' THEN
            fseq := (fixture_el->>'sequence_order')::int;
          END IF;

          INSERT INTO public.jobs_ledger_fixtures (
            job_id,
            name,
            count,
            line_unit_price,
            line_description,
            sequence_order
          ) VALUES (
            v_job_id,
            fname,
            fcount,
            fprice,
            fdesc,
            fseq
          );

          v_fixture_inserts := v_fixture_inserts + 1;
          v_row_ext := round(fcount * COALESCE(fprice, 0::numeric), 2);
          v_fixture_rev := round(v_fixture_rev + v_row_ext, 2);
        EXCEPTION
          WHEN OTHERS THEN
            CONTINUE;
        END;
      END LOOP;
    END IF;
  END IF;

  IF v_fixture_inserts > 0 THEN
    UPDATE public.jobs_ledger
    SET revenue = v_fixture_rev
    WHERE id = v_job_id;
  END IF;

  RETURN v_job_id;
END;
$$;

COMMENT ON FUNCTION public.create_job_from_estimate(uuid, text, text, text, numeric, uuid, jsonb) IS
  'Creates jobs_ledger from customer_accepted estimate, optional jobs_ledger_fixtures from p_fixtures, revenue from fixture totals when any inserted.';

REVOKE ALL ON FUNCTION public.create_job_from_estimate(uuid, text, text, text, numeric, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_job_from_estimate(uuid, text, text, text, numeric, uuid, jsonb) TO authenticated;
