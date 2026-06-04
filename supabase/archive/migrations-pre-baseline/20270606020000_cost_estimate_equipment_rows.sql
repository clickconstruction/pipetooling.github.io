-- Equipment & Tool Rental becomes a list of rows (note + per-stage amounts),
-- like the labor rows table. Replaces the fixed equipment_rental_* columns.

ALTER TABLE public.cost_estimates
  DROP COLUMN IF EXISTS equipment_rental_rough_in,
  DROP COLUMN IF EXISTS equipment_rental_top_out,
  DROP COLUMN IF EXISTS equipment_rental_trim_set;

CREATE TABLE IF NOT EXISTS public.cost_estimate_equipment_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_estimate_id uuid NOT NULL REFERENCES public.cost_estimates(id) ON DELETE CASCADE,
  note text,
  rough_in numeric NOT NULL DEFAULT 0,
  top_out numeric NOT NULL DEFAULT 0,
  trim_set numeric NOT NULL DEFAULT 0,
  sequence_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cost_estimate_equipment_rows_cost_estimate_id_idx
  ON public.cost_estimate_equipment_rows (cost_estimate_id);

ALTER TABLE public.cost_estimate_equipment_rows ENABLE ROW LEVEL SECURITY;

-- Access mirrors cost_estimate_labor_rows: gated by the parent cost estimate's bid.
CREATE POLICY ceer_select ON public.cost_estimate_equipment_rows FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_equipment_rows.cost_estimate_id AND can_access_bid_for_pricing(ce.bid_id)));

CREATE POLICY ceer_insert ON public.cost_estimate_equipment_rows FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_equipment_rows.cost_estimate_id AND can_access_bid_for_pricing(ce.bid_id)));

CREATE POLICY ceer_update ON public.cost_estimate_equipment_rows FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_equipment_rows.cost_estimate_id AND can_access_bid_for_pricing(ce.bid_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_equipment_rows.cost_estimate_id AND can_access_bid_for_pricing(ce.bid_id)));

CREATE POLICY ceer_delete ON public.cost_estimate_equipment_rows FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_equipment_rows.cost_estimate_id AND can_access_bid_for_pricing(ce.bid_id)));
