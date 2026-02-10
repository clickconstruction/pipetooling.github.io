-- Create part_types table for Materials system categorization
-- Separate from fixture_types which is for Bids/Books

-- ============================================================================
-- part_types table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.part_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type_id UUID NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_type_id, name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_part_types_service_type_id ON public.part_types(service_type_id);
CREATE INDEX IF NOT EXISTS idx_part_types_name ON public.part_types(name);
CREATE INDEX IF NOT EXISTS idx_part_types_sequence_order ON public.part_types(sequence_order);

-- Enable RLS
ALTER TABLE public.part_types ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read part types
CREATE POLICY "All authenticated users can read part types"
ON public.part_types
FOR SELECT
USING (
  auth.uid() IS NOT NULL
);

-- Policy: Devs, masters, assistants, and estimators can insert
CREATE POLICY "Devs, masters, assistants, and estimators can insert part types"
ON public.part_types
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

-- Policy: Devs, masters, assistants, and estimators can update
CREATE POLICY "Devs, masters, assistants, and estimators can update part types"
ON public.part_types
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

-- Policy: Devs, masters, assistants, and estimators can delete
CREATE POLICY "Devs, masters, assistants, and estimators can delete part types"
ON public.part_types
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

-- Add updated_at trigger
CREATE TRIGGER update_part_types_updated_at
  BEFORE UPDATE ON public.part_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.part_types IS 'Part types for categorizing material parts in Materials system (separate from fixture_types used in Bids)';

-- ============================================================================
-- Copy existing Plumbing fixture types to part types
-- ============================================================================

INSERT INTO public.part_types (service_type_id, name, category, sequence_order)
SELECT service_type_id, name, category, sequence_order
FROM public.fixture_types
WHERE service_type_id IN (SELECT id FROM public.service_types WHERE name = 'Plumbing')
ON CONFLICT (service_type_id, name) DO NOTHING;
