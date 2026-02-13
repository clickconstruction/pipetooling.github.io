-- Create assembly_types table for categorizing material assemblies/templates
-- Similar structure to part_types

CREATE TABLE IF NOT EXISTS public.assembly_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type_id UUID NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT assembly_types_service_type_name_unique UNIQUE (service_type_id, name)
);

-- Indexes
CREATE INDEX idx_assembly_types_service_type_id ON public.assembly_types(service_type_id);
CREATE INDEX idx_assembly_types_name ON public.assembly_types(name);
CREATE INDEX idx_assembly_types_sequence_order ON public.assembly_types(sequence_order);

-- RLS policies
ALTER TABLE public.assembly_types ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view assembly types
CREATE POLICY "Authenticated users can view assembly types"
ON public.assembly_types
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow dev, master, assistant, and estimator to manage assembly types
CREATE POLICY "Authorized users can insert assembly types"
ON public.assembly_types
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Authorized users can update assembly types"
ON public.assembly_types
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Authorized users can delete assembly types"
ON public.assembly_types
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

-- Add comments
COMMENT ON TABLE public.assembly_types IS 'Categories/types for material assemblies (templates), scoped by service type';
COMMENT ON COLUMN public.assembly_types.service_type_id IS 'Service type (Plumbing, Electrical, HVAC, etc.) that this assembly type belongs to';
COMMENT ON COLUMN public.assembly_types.name IS 'Name of the assembly type (e.g., Bathroom, Kitchen, Utility)';
COMMENT ON COLUMN public.assembly_types.category IS 'Optional category grouping for assembly types';
COMMENT ON COLUMN public.assembly_types.sequence_order IS 'Display order for assembly types within a service type';

-- Seed initial assembly types for Plumbing
INSERT INTO public.assembly_types (service_type_id, name, sequence_order)
SELECT 
  st.id,
  types.name,
  row_number() OVER () - 1 as sequence_order
FROM public.service_types st
CROSS JOIN (
  VALUES 
    ('Bathroom'),
    ('Kitchen'),
    ('Utility'),
    ('Commercial'),
    ('Residential'),
    ('Other')
) AS types(name)
WHERE st.name = 'Plumbing';
