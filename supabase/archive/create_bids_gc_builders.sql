-- Create bids_gc_builders table for GC/Builder entities (Bid Board)

CREATE TABLE IF NOT EXISTS public.bids_gc_builders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  contact_number TEXT,
  email TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bids_gc_builders_name ON public.bids_gc_builders(name);
CREATE INDEX IF NOT EXISTS idx_bids_gc_builders_created_by ON public.bids_gc_builders(created_by);

ALTER TABLE public.bids_gc_builders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs and masters can read bids gc builders"
ON public.bids_gc_builders
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

CREATE POLICY "Devs and masters can insert bids gc builders"
ON public.bids_gc_builders
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician')
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Devs and masters can update bids gc builders"
ON public.bids_gc_builders
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

CREATE POLICY "Devs and masters can delete bids gc builders"
ON public.bids_gc_builders
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

COMMENT ON TABLE public.bids_gc_builders IS 'GC/Builder entities for the Bids Bid Board. Address, contact number, and aggregated won/lost bids.';
