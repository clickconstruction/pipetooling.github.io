-- Create Purchase Order from Job Tally on save
-- SECURITY DEFINER so subcontractors (who cannot insert purchase_orders) can trigger PO creation
-- PO is assigned to the job's master

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

  -- 2. Get service_type_id from first part (fallback: first service_type)
  v_first_part_id := (p_entries->0->>'part_id')::uuid;
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

  -- 5. Merge entries by part_id (sum quantities)
  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    v_part_id := (v_entry->>'part_id')::uuid;
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

COMMENT ON FUNCTION public.create_po_from_job_tally(uuid, jsonb) IS
  'Creates a Purchase Order from Job Tally entries. Called when user saves on Job Tally. PO name: Job Parts [HCP#] [date]. SECURITY DEFINER so subs can trigger.';
