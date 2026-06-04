-- Subcontractor Fees direct cost: a list of rows (note + per-stage amounts),
-- mirroring cost_estimate_equipment_rows / cost_estimate_permit_rows.

CREATE TABLE IF NOT EXISTS public.cost_estimate_subcontractor_rows (
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

CREATE INDEX IF NOT EXISTS cost_estimate_subcontractor_rows_cost_estimate_id_idx
  ON public.cost_estimate_subcontractor_rows (cost_estimate_id);

ALTER TABLE public.cost_estimate_subcontractor_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY cesub_select ON public.cost_estimate_subcontractor_rows FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_subcontractor_rows.cost_estimate_id AND can_access_bid_for_pricing(ce.bid_id)));

CREATE POLICY cesub_insert ON public.cost_estimate_subcontractor_rows FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_subcontractor_rows.cost_estimate_id AND can_access_bid_for_pricing(ce.bid_id)));

CREATE POLICY cesub_update ON public.cost_estimate_subcontractor_rows FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_subcontractor_rows.cost_estimate_id AND can_access_bid_for_pricing(ce.bid_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_subcontractor_rows.cost_estimate_id AND can_access_bid_for_pricing(ce.bid_id)));

CREATE POLICY cesub_delete ON public.cost_estimate_subcontractor_rows FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_subcontractor_rows.cost_estimate_id AND can_access_bid_for_pricing(ce.bid_id)));
