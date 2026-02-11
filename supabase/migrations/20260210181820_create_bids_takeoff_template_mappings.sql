-- Table to persist template assignments for bid takeoff count rows
CREATE TABLE IF NOT EXISTS public.bids_takeoff_template_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  count_row_id UUID NOT NULL REFERENCES public.bids_count_rows(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.material_templates(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('rough_in', 'top_out', 'trim_set')),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure one mapping per count_row + template + stage combination
  UNIQUE(count_row_id, template_id, stage)
);

-- Index for fast lookups by bid
CREATE INDEX idx_bids_takeoff_template_mappings_bid_id 
  ON public.bids_takeoff_template_mappings(bid_id);

-- Index for fast lookups by count row
CREATE INDEX idx_bids_takeoff_template_mappings_count_row_id 
  ON public.bids_takeoff_template_mappings(count_row_id);

COMMENT ON TABLE public.bids_takeoff_template_mappings IS 
  'Persisted template assignments for bid takeoff count rows. Syncs with count rows automatically via CASCADE.';

-- RLS Policies (same access pattern as bids_count_rows)
ALTER TABLE public.bids_takeoff_template_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs, masters, assistants, and estimators can read mappings"
ON public.bids_takeoff_template_mappings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_takeoff_template_mappings.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
      )
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert mappings"
ON public.bids_takeoff_template_mappings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_takeoff_template_mappings.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
      )
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update mappings"
ON public.bids_takeoff_template_mappings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_takeoff_template_mappings.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
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

CREATE POLICY "Devs, masters, assistants, and estimators can delete mappings"
ON public.bids_takeoff_template_mappings
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_takeoff_template_mappings.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
      )
    )
  )
);
