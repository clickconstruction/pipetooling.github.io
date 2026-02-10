-- Create service_types table for categorizing materials and bids by trade type
-- This table allows filtering parts, templates, POs, and bids by Plumbing, Electrical, HVAC, etc.

-- ============================================================================
-- service_types table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_service_types_sequence_order ON public.service_types(sequence_order);
CREATE INDEX IF NOT EXISTS idx_service_types_name ON public.service_types(name);

-- Enable RLS
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read service types
CREATE POLICY "All authenticated users can read service types"
ON public.service_types
FOR SELECT
USING (
  auth.uid() IS NOT NULL
);

-- Policy: Only devs can insert service types
CREATE POLICY "Only devs can insert service types"
ON public.service_types
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'dev'
  )
);

-- Policy: Only devs can update service types
CREATE POLICY "Only devs can update service types"
ON public.service_types
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'dev'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'dev'
  )
);

-- Policy: Only devs can delete service types
CREATE POLICY "Only devs can delete service types"
ON public.service_types
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'dev'
  )
);

-- Add updated_at trigger
CREATE TRIGGER update_service_types_updated_at
  BEFORE UPDATE ON public.service_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.service_types IS 'Service types for categorizing materials and bids by trade (Plumbing, Electrical, HVAC, etc.)';

-- ============================================================================
-- Seed initial service types
-- ============================================================================

-- Insert initial service types (only if table is empty)
INSERT INTO public.service_types (name, description, color, sequence_order)
VALUES
  ('Plumbing', 'Plumbing fixtures, pipes, and fittings', '#3b82f6', 1),
  ('Electrical', 'Electrical fixtures, wiring, and components', '#f59e0b', 2),
  ('HVAC', 'Heating, ventilation, and air conditioning', '#10b981', 3)
ON CONFLICT DO NOTHING;
