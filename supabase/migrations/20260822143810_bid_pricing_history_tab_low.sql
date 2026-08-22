SET lock_timeout = '3s';

-- bid_pricing_history gains bid_tab_low + customer_id (v2.2085): the Workbench
-- calibration strip learns from recorded bid tabs (v2.2081) — each tab's low,
-- against the bid's estimated cost, becomes "the margin that would have matched
-- the low", drawn as a marker and counted into a win-odds verdict; customer_id
-- lets the verdict go GC-specific when the bid being priced has recorded tabs
-- from the same GC. Both are pass-through columns from bids.
-- Return type changes, so DROP + CREATE (CREATE OR REPLACE rejects it).
DROP FUNCTION IF EXISTS public.bid_pricing_history(uuid);

CREATE FUNCTION public.bid_pricing_history(p_service_type_id uuid)
RETURNS TABLE (
  bid_id uuid,
  project_name text,
  outcome text,
  loss_reason text,
  loss_category text,
  bid_value numeric,
  est_cost numeric,
  bid_tab_low numeric,
  customer_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH decided AS (
    SELECT b.id, b.project_name, b.outcome, b.loss_reason, b.loss_category,
           b.bid_value::numeric AS bid_value,
           b.bid_tab_low::numeric AS bid_tab_low,
           b.customer_id,
           CASE WHEN trim(COALESCE(b.distance_from_office, '')) ~ '^[0-9]+(\.[0-9]+)?$'
                THEN trim(b.distance_from_office)::numeric ELSE 0 END AS distance_mi
    FROM public.bids b
    WHERE b.service_type_id = p_service_type_id
      AND b.outcome IN ('won', 'lost')
      AND b.bid_value IS NOT NULL
      AND b.bid_value > 0
  ),
  ce AS (
    SELECT d.id AS b_id, d.project_name, d.outcome, d.loss_reason, d.loss_category, d.bid_value, d.bid_tab_low, d.customer_id AS bid_customer_id, d.distance_mi, c.*
    FROM decided d
    JOIN public.cost_estimates c ON c.bid_id = d.id
  ),
  labor AS (
    SELECT ce.b_id,
      COALESCE(SUM(
        CASE WHEN r.is_fixed
             THEN (r.rough_in_hrs_per_unit + r.top_out_hrs_per_unit + r.trim_set_hrs_per_unit)
             ELSE r.count * (r.rough_in_hrs_per_unit + r.top_out_hrs_per_unit + r.trim_set_hrs_per_unit)
        END), 0)::numeric AS hours
    FROM ce
    LEFT JOIN public.cost_estimate_labor_rows r ON r.cost_estimate_id = ce.id
    GROUP BY ce.b_id
  ),
  count_rows AS (
    SELECT d.id AS b_id, COUNT(cr.id)::numeric AS n
    FROM decided d
    LEFT JOIN public.bids_count_rows cr ON cr.bid_id = d.id
    GROUP BY d.id
  ),
  direct AS (
    SELECT ce.b_id, COALESCE(SUM(seg.amt), 0)::numeric AS amt
    FROM ce
    LEFT JOIN LATERAL (
      SELECT GREATEST(e.rough_in, 0) + GREATEST(e.top_out, 0) + GREATEST(e.trim_set, 0) AS amt
        FROM public.cost_estimate_equipment_rows e WHERE e.cost_estimate_id = ce.id
      UNION ALL
      SELECT GREATEST(p.rough_in, 0) + GREATEST(p.top_out, 0) + GREATEST(p.trim_set, 0)
        FROM public.cost_estimate_permit_rows p WHERE p.cost_estimate_id = ce.id
      UNION ALL
      SELECT GREATEST(s.rough_in, 0) + GREATEST(s.top_out, 0) + GREATEST(s.trim_set, 0)
        FROM public.cost_estimate_subcontractor_rows s WHERE s.cost_estimate_id = ce.id
      UNION ALL
      SELECT GREATEST(w.rough_in, 0) + GREATEST(w.top_out, 0) + GREATEST(w.trim_set, 0)
        FROM public.cost_estimate_waste_rows w WHERE w.cost_estimate_id = ce.id
      UNION ALL
      SELECT GREATEST(o.rough_in, 0) + GREATEST(o.top_out, 0) + GREATEST(o.trim_set, 0)
        FROM public.cost_estimate_other_rows o WHERE o.cost_estimate_id = ce.id
    ) seg ON true
    GROUP BY ce.b_id
  ),
  materials AS (
    SELECT ce.b_id, COALESCE(SUM(i.price_at_time * i.quantity), 0)::numeric AS amt
    FROM ce
    LEFT JOIN public.purchase_order_items i
      ON i.purchase_order_id IN (ce.purchase_order_id_rough_in, ce.purchase_order_id_top_out, ce.purchase_order_id_trim_set)
    GROUP BY ce.b_id
  )
  SELECT
    ce.b_id AS bid_id,
    ce.project_name,
    ce.outcome,
    ce.loss_reason,
    ce.loss_category,
    ce.bid_value,
    (
      COALESCE(m.amt, 0)
      + l.hours * COALESCE(ce.labor_rate, 0)
      + CASE WHEN COALESCE(ce.hours_per_trip, 2.0) > 0
             THEN (l.hours / COALESCE(NULLIF(ce.hours_per_trip, 0), 2.0)) * COALESCE(ce.driving_cost_rate, 0.70) * ce.distance_mi
             ELSE 0 END
      + COALESCE(ce.travel_people, 1) * COALESCE(ce.travel_nights, 1) * (COALESCE(ce.travel_meals_rate, 0) + COALESCE(ce.travel_hotel_rate, 0))
      + CASE WHEN ce.estimator_cost_flat_amount IS NOT NULL THEN ce.estimator_cost_flat_amount
             ELSE cr.n * (CASE WHEN COALESCE(ce.estimator_cost_per_count, 0) = 0 THEN 10 ELSE ce.estimator_cost_per_count END) END
      + COALESCE(dc.amt, 0)
    )::numeric AS est_cost,
    ce.bid_tab_low,
    ce.bid_customer_id AS customer_id
  FROM ce
  JOIN labor l ON l.b_id = ce.b_id
  JOIN count_rows cr ON cr.b_id = ce.b_id
  LEFT JOIN direct dc ON dc.b_id = ce.b_id
  LEFT JOIN materials m ON m.b_id = ce.b_id
$$;
