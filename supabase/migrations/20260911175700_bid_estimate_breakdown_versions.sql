SET lock_timeout = '3s';

-- v2.3297 follow-up: bid_estimate_breakdown reads the ACTIVE version's takeoff lines and
-- counts. A bid with versions keeps its count rows and rough part lines under
-- bid_version_id (the unsplit base uses NULL); the first cut read NULL only, so a
-- versioned bid's materials came back 0 while the Labor tab showed the takeoff total.
-- The active version = the newest bid_versions row (the same pick snapshot_job_budget_from_bid
-- stamps); no versions = the base.

CREATE OR REPLACE FUNCTION public.bid_estimate_breakdown(p_bid_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  ce record;
  v_bid record;
  v_version_id uuid;
  v_hours_rough numeric := 0;
  v_hours_top numeric := 0;
  v_hours_trim numeric := 0;
  v_hours numeric := 0;
  v_rows_total integer := 0;
  v_rows_with_hours integer := 0;
  v_rate numeric;
  v_labor numeric := 0;
  v_po_materials numeric := 0;
  v_takeoff_materials numeric := 0;
  v_materials numeric := 0;
  v_materials_source text := 'none';
  v_subs numeric := 0;
  v_equipment numeric := 0;
  v_permits numeric := 0;
  v_waste numeric := 0;
  v_other_rows numeric := 0;
  v_distance numeric := 0;
  v_hours_per_trip numeric;
  v_rate_per_mile numeric;
  v_driving numeric := 0;
  v_travel numeric := 0;
  v_other numeric := 0;
  v_total numeric := 0;
  v_count_rows integer := 0;
  v_usable boolean := false;
  v_has_ce boolean := false;
BEGIN
  SELECT b.id, b.bid_value, b.agreed_value, b.distance_from_office, b.project_name, b.bid_number
    INTO v_bid FROM public.bids b WHERE b.id = p_bid_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  SELECT v.id INTO v_version_id FROM public.bid_versions v WHERE v.bid_id = p_bid_id ORDER BY v.created_at DESC NULLS LAST LIMIT 1;
  SELECT c.* INTO ce FROM public.cost_estimates c WHERE c.bid_id = p_bid_id;
  v_has_ce := FOUND;
  SELECT COUNT(*) INTO v_count_rows FROM public.bids_count_rows cr WHERE cr.bid_id = p_bid_id AND cr.bid_version_id IS NOT DISTINCT FROM v_version_id;

  IF v_has_ce THEN
    SELECT
      COALESCE(SUM(m.mult * r.rough_in_hrs_per_unit), 0),
      COALESCE(SUM(m.mult * r.top_out_hrs_per_unit), 0),
      COALESCE(SUM(m.mult * r.trim_set_hrs_per_unit), 0),
      COUNT(*) FILTER (WHERE COALESCE(r.kind, 'fixture') <> 'sub'),
      COUNT(*) FILTER (WHERE COALESCE(r.kind, 'fixture') <> 'sub' AND (r.rough_in_hrs_per_unit > 0 OR r.top_out_hrs_per_unit > 0 OR r.trim_set_hrs_per_unit > 0))
      INTO v_hours_rough, v_hours_top, v_hours_trim, v_rows_total, v_rows_with_hours
    FROM public.cost_estimate_labor_rows r
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN COALESCE(r.kind, 'fixture') = 'sub' THEN 0
        WHEN r.is_fixed OR COALESCE(r.kind, 'fixture') = 'task' THEN 1
        WHEN COALESCE(r.unit, 'each') = 'per_100ft' THEN COALESCE(r.count, 0) / 100.0
        ELSE COALESCE(r.count, 0)
      END AS mult
    ) m
    WHERE r.cost_estimate_id = ce.id;
    v_hours := v_hours_rough + v_hours_top + v_hours_trim;
    v_rate := ce.labor_rate;
    v_labor := v_hours * COALESCE(v_rate, 0);

    SELECT COALESCE(SUM(i.price_at_time * i.quantity), 0) INTO v_po_materials
      FROM public.purchase_order_items i
     WHERE i.purchase_order_id IN (ce.purchase_order_id_rough_in, ce.purchase_order_id_top_out, ce.purchase_order_id_trim_set);
    SELECT COALESCE(SUM(l.quantity * l.unit_price * COALESCE(cr.count, 0)), 0) INTO v_takeoff_materials
      FROM public.bids_takeoff_rough_part_lines l
      JOIN public.bids_count_rows cr ON cr.id = l.count_row_id
     WHERE l.bid_id = p_bid_id AND l.bid_version_id IS NOT DISTINCT FROM v_version_id;
    IF v_po_materials > 0 THEN
      v_materials := v_po_materials; v_materials_source := 'po';
    ELSIF v_takeoff_materials > 0 THEN
      v_materials := v_takeoff_materials; v_materials_source := 'takeoff';
    END IF;

    SELECT COALESCE(SUM(GREATEST(s.rough_in, 0) + GREATEST(s.top_out, 0) + GREATEST(s.trim_set, 0)), 0) INTO v_subs FROM public.cost_estimate_subcontractor_rows s WHERE s.cost_estimate_id = ce.id;
    SELECT COALESCE(SUM(GREATEST(e.rough_in, 0) + GREATEST(e.top_out, 0) + GREATEST(e.trim_set, 0)), 0) INTO v_equipment FROM public.cost_estimate_equipment_rows e WHERE e.cost_estimate_id = ce.id;
    SELECT COALESCE(SUM(GREATEST(p.rough_in, 0) + GREATEST(p.top_out, 0) + GREATEST(p.trim_set, 0)), 0) INTO v_permits FROM public.cost_estimate_permit_rows p WHERE p.cost_estimate_id = ce.id;
    SELECT COALESCE(SUM(GREATEST(w.rough_in, 0) + GREATEST(w.top_out, 0) + GREATEST(w.trim_set, 0)), 0) INTO v_waste FROM public.cost_estimate_waste_rows w WHERE w.cost_estimate_id = ce.id;
    SELECT COALESCE(SUM(GREATEST(o.rough_in, 0) + GREATEST(o.top_out, 0) + GREATEST(o.trim_set, 0)), 0) INTO v_other_rows FROM public.cost_estimate_other_rows o WHERE o.cost_estimate_id = ce.id;

    v_distance := COALESCE(NULLIF(regexp_replace(COALESCE(v_bid.distance_from_office, ''), '[^0-9.]', '', 'g'), '')::numeric, 0);
    v_hours_per_trip := COALESCE(NULLIF(ce.hours_per_trip, 0), 2.0);
    v_rate_per_mile := COALESCE(ce.driving_cost_rate, 0.70);
    v_driving := CASE WHEN v_hours_per_trip > 0 THEN (v_hours / v_hours_per_trip) * v_rate_per_mile * v_distance ELSE 0 END;
    v_travel := COALESCE(ce.travel_people, 1) * COALESCE(ce.travel_nights, 1) * (COALESCE(ce.travel_meals_rate, 0) + COALESCE(ce.travel_hotel_rate, 0));
  END IF;

  v_other := v_equipment + v_permits + v_waste + v_other_rows + v_driving + v_travel;
  v_total := v_labor + v_materials + v_subs + v_other;
  v_usable := v_has_ce AND v_rows_total > 0 AND v_rows_with_hours::numeric / v_rows_total >= 0.9 AND COALESCE(v_rate, 0) > 0;

  RETURN jsonb_build_object(
    'bid_id', p_bid_id,
    'bid_number', v_bid.bid_number,
    'project_name', v_bid.project_name,
    'bid_value', v_bid.bid_value,
    'agreed_value', v_bid.agreed_value,
    'bid_version_id', v_version_id,
    'has_estimate', v_has_ce,
    'labor_hours', v_hours,
    'labor_hours_by_stage', jsonb_build_object('rough', v_hours_rough, 'top', v_hours_top, 'trim', v_hours_trim),
    'labor_rate', v_rate,
    'labor_usd', v_labor,
    'materials_usd', v_materials,
    'subs_usd', v_subs,
    'equipment_usd', v_equipment,
    'permits_usd', v_permits,
    'waste_usd', v_waste,
    'other_rows_usd', v_other_rows,
    'driving_usd', v_driving,
    'travel_usd', v_travel,
    'other_usd', v_other,
    'total_direct_usd', v_total,
    'count_rows', v_count_rows,
    'completeness', jsonb_build_object(
      'rows_total', v_rows_total,
      'rows_with_hours', v_rows_with_hours,
      'rate_set', COALESCE(v_rate, 0) > 0,
      'materials_source', v_materials_source,
      'usable', v_usable
    )
  );
END;
$$;
