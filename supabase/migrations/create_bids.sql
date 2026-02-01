-- Create bids table (Bid Board)

CREATE TABLE IF NOT EXISTS public.bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_link TEXT,
  plans_link TEXT,
  gc_builder_id UUID REFERENCES public.bids_gc_builders(id) ON DELETE SET NULL,
  project_name_and_address TEXT,
  bid_due_date DATE,
  bid_date_sent DATE,
  outcome TEXT CHECK (outcome IN ('won', 'lost')),
  bid_value NUMERIC(14, 2),
  agreed_value NUMERIC(14, 2),
  profit NUMERIC(14, 2),
  distance_from_office TEXT,
  last_contact TIMESTAMPTZ,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bids_created_by ON public.bids(created_by);
CREATE INDEX IF NOT EXISTS idx_bids_gc_builder_id ON public.bids(gc_builder_id);
CREATE INDEX IF NOT EXISTS idx_bids_bid_due_date ON public.bids(bid_due_date);

ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs and masters can read bids"
ON public.bids
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'dev'
    )
  )
);

CREATE POLICY "Devs and masters can insert bids"
ON public.bids
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician')
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Devs and masters can update bids"
ON public.bids
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'dev'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician')
  )
);

CREATE POLICY "Devs and masters can delete bids"
ON public.bids
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'dev'
    )
  )
);

COMMENT ON TABLE public.bids IS 'Bids (Bid Board). Drive link, plans link, GC/Builder, project, dates, outcome, values, profit, distance, last contact, notes.';
