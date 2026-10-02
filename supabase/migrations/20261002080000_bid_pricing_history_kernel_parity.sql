SET lock_timeout = '3s';

-- bid_pricing_history's est_cost reads like the Workbench's total (v2.4372): the Pricing win/loss
-- strip set each past bid's margin from a cost the Workbench stopped computing, so every dot sat
-- a little below the margin its bid was priced at. Three rules now follow computeBidCostBreakdown
-- (src/lib/bids/bidTotalCostBreakdown.ts); materials stay as 20261002070000 counts them.
--
-- 1. Labor hours: the v2.3291 row rule (laborRowHours.ts; bid_estimate_breakdown reads it the
--    same way): kind 'sub' = 0, is_fixed or kind 'task' = ×1, unit 'per_100ft' = count ÷ 100,
--    else × count. The hours drive the driving cost too, so a footage row no longer counts its
--    feet as trips.
-- 2. Estimator time is out of the cost (v2.3294: the Workbench reports it but does not add it),
--    and with it the count_rows CTE, which counted every version's rows.
-- 3. Distance: the number the text starts with, as the Workbench's parseFloat reads it
--    ('96.4 mi' → 96.4, '1,200' → 1, 'about 12' → 0). The exponent is capped at three digits so
--    no text can overflow numeric. The old read gave 0 unless the whole text was a number;
--    bid_estimate_breakdown still strips non-digits ('1,200' → 1200).
--
-- Body otherwise identical to 20261002070000; same return type, so CREATE OR REPLACE keeps the
-- grants.

CREATE OR REPLACE FUNCTION public.bid_pricing_history(p_service_type_id uuid)
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
           b.selected_bid_version_id,
           COALESCE(substring(b.distance_from_office FROM '^\s*([+-]?(?:[0-9]+[.]?[0-9]*|[.][0-9]+)(?:[eE][+-]?[0-9]{1,3})?)')::numeric, 0) AS distance_mi
    FROM public.bids b
    WHERE b.service_type_id = p_service_type_id
      AND b.outcome IN ('won', 'lost')
      AND b.bid_value IS NOT NULL
      AND b.bid_value > 0
  ),
  ce AS (
    SELECT d.id AS b_id, d.project_name, d.outcome, d.loss_reason, d.loss_category, d.bid_value, d.bid_tab_low, d.customer_id AS bid_customer_id, d.selected_bid_version_id, d.distance_mi, c.*
    FROM decided d
    JOIN public.cost_estimates c ON c.bid_id = d.id
  ),
  labor AS (
    SELECT ce.b_id,
      COALESCE(SUM(
        CASE WHEN r.kind = 'sub' THEN 0
             WHEN r.is_fixed OR r.kind = 'task' THEN 1
             WHEN r.unit = 'per_100ft' THEN r.count / 100.0
             ELSE r.count
        END * (r.rough_in_hrs_per_unit + r.top_out_hrs_per_unit + r.trim_set_hrs_per_unit)), 0)::numeric AS hours
    FROM ce
    LEFT JOIN public.cost_estimate_labor_rows r ON r.cost_estimate_id = ce.id
    GROUP BY ce.b_id
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
  active_version AS (
    SELECT ce.b_id,
      COALESCE(
        (SELECT v.id FROM public.bid_versions v WHERE v.bid_id = ce.b_id AND v.id = ce.selected_bid_version_id),
        (SELECT v.id FROM public.bid_versions v WHERE v.bid_id = ce.b_id ORDER BY v.sort_order, v.created_at, v.id LIMIT 1)
      ) AS version_id
    FROM ce
  ),
  po AS (
    SELECT ce.b_id, COALESCE(SUM(i.price_at_time * i.quantity), 0)::numeric AS amt
    FROM ce
    LEFT JOIN public.purchase_order_items i
      ON i.purchase_order_id IN (ce.purchase_order_id_rough_in, ce.purchase_order_id_top_out, ce.purchase_order_id_trim_set)
    GROUP BY ce.b_id
  ),
  takeoff AS (
    SELECT av.b_id,
      COALESCE(SUM(l.quantity * l.unit_price * CASE WHEN cr.count > 0 THEN cr.count ELSE 1 END), 0)::numeric AS amt
    FROM active_version av
    JOIN public.bids_takeoff_rough_part_lines l
      ON l.bid_id = av.b_id AND l.bid_version_id IS NOT DISTINCT FROM av.version_id
    LEFT JOIN public.bids_count_rows cr
      ON cr.id = l.count_row_id AND cr.bid_version_id IS NOT DISTINCT FROM av.version_id
    GROUP BY av.b_id
  ),
  materials AS (
    SELECT po.b_id, CASE WHEN po.amt > 0 THEN po.amt ELSE COALESCE(t.amt, 0) END AS amt
    FROM po
    LEFT JOIN takeoff t ON t.b_id = po.b_id
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
      + COALESCE(dc.amt, 0)
    )::numeric AS est_cost,
    ce.bid_tab_low,
    ce.bid_customer_id AS customer_id
  FROM ce
  JOIN labor l ON l.b_id = ce.b_id
  LEFT JOIN direct dc ON dc.b_id = ce.b_id
  LEFT JOIN materials m ON m.b_id = ce.b_id
$$;
