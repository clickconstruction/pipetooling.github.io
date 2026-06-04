-- Update list_tally_parts_with_po to return fixture_cost
-- Update create_po_from_job_tally to skip fixture-only entries (part_id null)

DROP FUNCTION IF EXISTS public.list_tally_parts_with_po();
CREATE FUNCTION public.list_tally_parts_with_po()
RETURNS TABLE (
  id UUID,
  job_id UUID,
  fixture_name TEXT,
  part_id UUID,
  quantity NUMERIC,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ,
  price_at_time NUMERIC,
  fixture_cost NUMERIC,
  purchase_order_id UUID,
  purchase_order_name TEXT,
  purchase_order_status TEXT,
  hcp_number TEXT,
  job_name TEXT,
  job_address TEXT,
  part_name TEXT,
  part_manufacturer TEXT,
  created_by_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    jtp.id,
    jtp.job_id,
    jtp.fixture_name,
    jtp.part_id,
    jtp.quantity,
    jtp.created_by_user_id,
    jtp.created_at,
    poi.price_at_time,
    jtp.fixture_cost,
    jtp.purchase_order_id,
    po.name AS purchase_order_name,
    po.status::TEXT AS purchase_order_status,
    jl.hcp_number,
    jl.job_name,
    jl.job_address,
    mp.name AS part_name,
    mp.manufacturer AS part_manufacturer,
    u.name AS created_by_name
  FROM public.jobs_tally_parts jtp
  INNER JOIN public.jobs_ledger jl ON jl.id = jtp.job_id
  LEFT JOIN public.material_parts mp ON mp.id = jtp.part_id
  LEFT JOIN public.users u ON u.id = jtp.created_by_user_id
  LEFT JOIN public.purchase_orders po ON po.id = jtp.purchase_order_id
  LEFT JOIN public.purchase_order_items poi
    ON poi.purchase_order_id = jtp.purchase_order_id
    AND poi.part_id = jtp.part_id
  WHERE EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant')
    AND (
      jl.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = jl.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = jl.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), jl.master_user_id)
    )
  )
  OR (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
    AND EXISTS (SELECT 1 FROM public.master_primaries WHERE master_id = jl.master_user_id AND primary_id = auth.uid())
  )
  OR (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'subcontractor')
    AND EXISTS (SELECT 1 FROM public.jobs_ledger_team_members jtm WHERE jtm.job_id = jtp.job_id AND jtm.user_id = auth.uid())
  )
  ORDER BY jtp.created_at DESC;
$$;
-- create_po_from_job_tally: skip entries where part_id is null (fixture-only)
CREATE OR REPLACE FUNCTION public.create_po_from_job_tally(p_job_id uuid, p_entries jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hcp text;
  v_master_id uuid;
  v_service_type_id uuid;
  v_po_name text;
  v_po_id uuid;
  v_entry jsonb;
  v_part_id uuid;
  v_qty numeric;
  v_merged jsonb := '{}'::jsonb;
  v_part_key text;
  v_total_qty numeric;
  v_price numeric;
  v_supply_house_id uuid;
  v_seq int := 0;
  v_first_part_id uuid;
BEGIN
  IF p_entries IS NULL OR jsonb_array_length(p_entries) = 0 THEN
    RETURN jsonb_build_object('error', 'No entries provided');
  END IF;

  -- 1. Get job hcp_number and master_user_id
  SELECT COALESCE(hcp_number, 'NoHCP'), master_user_id
  INTO v_hcp, v_master_id
  FROM public.jobs_ledger
  WHERE id = p_job_id;

  IF v_master_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  -- 2. Get service_type_id from first part with part_id (fallback: first service_type)
  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    v_first_part_id := (v_entry->>'part_id')::uuid;
    IF v_first_part_id IS NOT NULL THEN
      EXIT;
    END IF;
  END LOOP;
  IF v_first_part_id IS NOT NULL THEN
    SELECT service_type_id INTO v_service_type_id
    FROM public.material_parts
    WHERE id = v_first_part_id;
  END IF;
  IF v_service_type_id IS NULL THEN
    SELECT id INTO v_service_type_id
    FROM public.service_types
    ORDER BY sequence_order ASC
    LIMIT 1;
  END IF;
  IF v_service_type_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No service type available');
  END IF;

  -- 3. Build PO name: "Job Parts [HCP#] [YYYY-MM-DD]"
  v_po_name := 'Job Parts ' || v_hcp || ' ' || to_char(now(), 'YYYY-MM-DD');

  -- 4. Insert purchase_orders
  INSERT INTO public.purchase_orders (name, created_by, service_type_id, status, supply_house_id)
  VALUES (v_po_name, v_master_id, v_service_type_id, 'draft', null)
  RETURNING id INTO v_po_id;

  -- 5. Merge entries by part_id (sum quantities), skip entries where part_id is null (fixture-only)
  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    v_part_id := (v_entry->>'part_id')::uuid;
    IF v_part_id IS NULL THEN
      CONTINUE;
    END IF;
    v_qty := (v_entry->>'quantity')::numeric;
    v_part_key := v_part_id::text;
    v_total_qty := COALESCE((v_merged->v_part_key->>'quantity')::numeric, 0) + v_qty;
    v_merged := v_merged || jsonb_build_object(v_part_key, jsonb_build_object('part_id', v_part_id, 'quantity', v_total_qty));
  END LOOP;

  -- 6. Insert purchase_order_items for each merged part
  FOR v_part_key, v_entry IN SELECT * FROM jsonb_each(v_merged)
  LOOP
    v_part_id := (v_entry->>'part_id')::uuid;
    v_total_qty := (v_entry->>'quantity')::numeric;

    -- Get best price (lowest) for this part
    SELECT price, supply_house_id INTO v_price, v_supply_house_id
    FROM public.material_part_prices
    WHERE part_id = v_part_id
    ORDER BY price ASC
    LIMIT 1;

    v_price := COALESCE(v_price, 0);
    v_seq := v_seq + 1;

    INSERT INTO public.purchase_order_items (
      purchase_order_id, part_id, quantity, price_at_time,
      sequence_order, selected_supply_house_id
    )
    VALUES (v_po_id, v_part_id, v_total_qty, v_price, v_seq, v_supply_house_id);
  END LOOP;

  RETURN jsonb_build_object('po_id', v_po_id);
END;
$$;
