-- Cost Estimate tab: one estimate per bid, optional POs per stage, labor matrix

-- ============================================================================
-- cost_estimates
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cost_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  purchase_order_id_rough_in UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  purchase_order_id_top_out UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  purchase_order_id_trim_set UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  labor_rate NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bid_id)
);

CREATE INDEX IF NOT EXISTS idx_cost_estimates_bid_id ON public.cost_estimates(bid_id);
CREATE INDEX IF NOT EXISTS idx_cost_estimates_po_rough_in ON public.cost_estimates(purchase_order_id_rough_in);
CREATE INDEX IF NOT EXISTS idx_cost_estimates_po_top_out ON public.cost_estimates(purchase_order_id_top_out);
CREATE INDEX IF NOT EXISTS idx_cost_estimates_po_trim_set ON public.cost_estimates(purchase_order_id_trim_set);

ALTER TABLE public.cost_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs, masters, assistants, and estimators can read cost estimates"
ON public.cost_estimates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = cost_estimates.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator')
      )
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert cost estimates"
ON public.cost_estimates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = cost_estimates.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator')
      )
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update cost estimates"
ON public.cost_estimates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = cost_estimates.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator')
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete cost estimates"
ON public.cost_estimates
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = cost_estimates.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator')
      )
    )
  )
);

COMMENT ON TABLE public.cost_estimates IS 'One per bid; links to up to three POs (Rough In, Top Out, Trim Set) and labor rate for Cost Estimate tab.';

-- ============================================================================
-- cost_estimate_labor_rows
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cost_estimate_labor_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_estimate_id UUID NOT NULL REFERENCES public.cost_estimates(id) ON DELETE CASCADE,
  fixture TEXT NOT NULL,
  count NUMERIC(12, 2) NOT NULL DEFAULT 0,
  rough_in_hrs_per_unit NUMERIC(8, 2) NOT NULL DEFAULT 0,
  top_out_hrs_per_unit NUMERIC(8, 2) NOT NULL DEFAULT 0,
  trim_set_hrs_per_unit NUMERIC(8, 2) NOT NULL DEFAULT 0,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cost_estimate_id, fixture)
);

CREATE INDEX IF NOT EXISTS idx_cost_estimate_labor_rows_estimate_id ON public.cost_estimate_labor_rows(cost_estimate_id);

ALTER TABLE public.cost_estimate_labor_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs, masters, assistants, and estimators can read cost estimate labor rows"
ON public.cost_estimate_labor_rows
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    JOIN public.bids b ON b.id = ce.bid_id
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator')
      )
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert cost estimate labor rows"
ON public.cost_estimate_labor_rows
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    JOIN public.bids b ON b.id = ce.bid_id
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator')
      )
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update cost estimate labor rows"
ON public.cost_estimate_labor_rows
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    JOIN public.bids b ON b.id = ce.bid_id
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator')
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete cost estimate labor rows"
ON public.cost_estimate_labor_rows
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    JOIN public.bids b ON b.id = ce.bid_id
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator')
      )
    )
  )
);

COMMENT ON TABLE public.cost_estimate_labor_rows IS 'Fixture x stage hours per cost estimate; one row per fixture, synced from bid count rows.';

-- ============================================================================
-- fixture_labor_defaults (default hrs per fixture for Rough In, Top Out, Trim Set)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fixture_labor_defaults (
  fixture TEXT PRIMARY KEY,
  rough_in_hrs NUMERIC(8, 2) NOT NULL DEFAULT 0,
  top_out_hrs NUMERIC(8, 2) NOT NULL DEFAULT 0,
  trim_set_hrs NUMERIC(8, 2) NOT NULL DEFAULT 0
);

ALTER TABLE public.fixture_labor_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs, masters, assistants, and estimators can read fixture labor defaults"
ON public.fixture_labor_defaults
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs and masters can insert fixture labor defaults"
ON public.fixture_labor_defaults
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician')
  )
);

CREATE POLICY "Devs and masters can update fixture labor defaults"
ON public.fixture_labor_defaults
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician')
  )
);

CREATE POLICY "Devs and masters can delete fixture labor defaults"
ON public.fixture_labor_defaults
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician')
  )
);

COMMENT ON TABLE public.fixture_labor_defaults IS 'Default labor hours per fixture (Rough In, Top Out, Trim Set) for cost estimate prefill.';

-- Seed a few defaults
INSERT INTO public.fixture_labor_defaults (fixture, rough_in_hrs, top_out_hrs, trim_set_hrs)
VALUES
  ('Toilet', 1, 1, 1),
  ('Sink', 0.5, 0.5, 0.5),
  ('Shower', 1.5, 1, 1),
  ('Bathtub', 1.5, 1, 1),
  ('Lavatory', 0.5, 0.5, 0.5)
ON CONFLICT (fixture) DO NOTHING;
