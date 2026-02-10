-- Create fixture_types table for service-type-specific fixture categorization
-- Fixtures are now managed per service type (Plumbing, Electrical, HVAC)

-- ============================================================================
-- fixture_types table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fixture_types (
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
CREATE INDEX IF NOT EXISTS idx_fixture_types_service_type_id ON public.fixture_types(service_type_id);
CREATE INDEX IF NOT EXISTS idx_fixture_types_name ON public.fixture_types(name);
CREATE INDEX IF NOT EXISTS idx_fixture_types_sequence_order ON public.fixture_types(sequence_order);

-- Enable RLS
ALTER TABLE public.fixture_types ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read fixture types
CREATE POLICY "All authenticated users can read fixture types"
ON public.fixture_types
FOR SELECT
USING (
  auth.uid() IS NOT NULL
);

-- Policy: Devs, masters, assistants, and estimators can insert fixture types
CREATE POLICY "Devs, masters, assistants, and estimators can insert fixture types"
ON public.fixture_types
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

-- Policy: Devs, masters, assistants, and estimators can update fixture types
CREATE POLICY "Devs, masters, assistants, and estimators can update fixture types"
ON public.fixture_types
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

-- Policy: Devs, masters, assistants, and estimators can delete fixture types
CREATE POLICY "Devs, masters, assistants, and estimators can delete fixture types"
ON public.fixture_types
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

-- Add updated_at trigger
CREATE TRIGGER update_fixture_types_updated_at
  BEFORE UPDATE ON public.fixture_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.fixture_types IS 'Fixture types categorized by service type (Plumbing, Electrical, HVAC, etc.)';

-- ============================================================================
-- Seed Plumbing fixture types
-- ============================================================================

-- Get Plumbing service type ID and insert fixture types
DO $$
DECLARE
  plumbing_id UUID;
  seq_order INTEGER := 0;
BEGIN
  SELECT id INTO plumbing_id FROM public.service_types WHERE name = 'Plumbing' LIMIT 1;
  
  -- Material Parts Fixture Types (from Materials.tsx hardcoded list)
  INSERT INTO public.fixture_types (service_type_id, name, category, sequence_order)
  VALUES
    (plumbing_id, 'Fitting', 'Parts', seq_order := seq_order + 1),
    (plumbing_id, 'Pipe', 'Parts', seq_order := seq_order + 1),
    (plumbing_id, 'Drain', 'Parts', seq_order := seq_order + 1),
    (plumbing_id, 'Sink', 'Fixtures', seq_order := seq_order + 1),
    (plumbing_id, 'Faucet', 'Fixtures', seq_order := seq_order + 1),
    (plumbing_id, 'Toilet', 'Fixtures', seq_order := seq_order + 1),
    (plumbing_id, 'Shower', 'Fixtures', seq_order := seq_order + 1),
    (plumbing_id, 'Bathtub', 'Fixtures', seq_order := seq_order + 1),
    (plumbing_id, 'Valve', 'Parts', seq_order := seq_order + 1),
    (plumbing_id, 'Water Heater', 'Appliances', seq_order := seq_order + 1),
    (plumbing_id, 'Vent', 'Parts', seq_order := seq_order + 1),
    (plumbing_id, 'Trap', 'Parts', seq_order := seq_order + 1),
    (plumbing_id, 'Elbow', 'Parts', seq_order := seq_order + 1),
    (plumbing_id, 'Tee', 'Parts', seq_order := seq_order + 1),
    (plumbing_id, 'Coupling', 'Parts', seq_order := seq_order + 1),
    (plumbing_id, 'Other', 'Parts', seq_order := seq_order + 1),
    
    -- Bids Count Row Fixtures (from Bids.tsx fixtureGroups)
    (plumbing_id, 'Toilets', 'Bathrooms', seq_order := seq_order + 1),
    (plumbing_id, 'Bathroom sinks', 'Bathrooms', seq_order := seq_order + 1),
    (plumbing_id, 'Shower/tub combos', 'Bathrooms', seq_order := seq_order + 1),
    (plumbing_id, 'Showers no tub', 'Bathrooms', seq_order := seq_order + 1),
    (plumbing_id, 'Bathtubs', 'Bathrooms', seq_order := seq_order + 1),
    (plumbing_id, 'Urinals', 'Bathrooms', seq_order := seq_order + 1),
    (plumbing_id, 'Water closets', 'Bathrooms', seq_order := seq_order + 1),
    (plumbing_id, 'Kitchen sinks', 'Kitchen', seq_order := seq_order + 1),
    (plumbing_id, 'Garbage disposals', 'Kitchen', seq_order := seq_order + 1),
    (plumbing_id, 'Ice makers', 'Kitchen', seq_order := seq_order + 1),
    (plumbing_id, 'Pot filler', 'Kitchen', seq_order := seq_order + 1),
    (plumbing_id, 'Laundry sinks', 'Laundry', seq_order := seq_order + 1),
    (plumbing_id, 'Washing machine', 'Laundry', seq_order := seq_order + 1),
    (plumbing_id, 'Hose bibs', 'Plumbing Fixtures', seq_order := seq_order + 1),
    (plumbing_id, 'Water fountain', 'Plumbing Fixtures', seq_order := seq_order + 1),
    (plumbing_id, 'Gas drops', 'Plumbing Fixtures', seq_order := seq_order + 1),
    (plumbing_id, 'Floor drains', 'Plumbing Fixtures', seq_order := seq_order + 1),
    (plumbing_id, 'Dog wash', 'Plumbing Fixtures', seq_order := seq_order + 1),
    (plumbing_id, 'Water heaters (gas)', 'Appliances', seq_order := seq_order + 1),
    (plumbing_id, 'Water heaters (electric)', 'Appliances', seq_order := seq_order + 1),
    (plumbing_id, 'Water heaters (tankless)', 'Appliances', seq_order := seq_order + 1),
    (plumbing_id, 'Water softener', 'Appliances', seq_order := seq_order + 1),
    
    -- Additional common plumbing fixtures
    (plumbing_id, 'Lavatory', 'Bathrooms', seq_order := seq_order + 1)
  ON CONFLICT (service_type_id, name) DO NOTHING;
END $$;
