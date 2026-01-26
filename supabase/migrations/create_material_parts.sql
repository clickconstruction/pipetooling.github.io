-- Create material_parts table for the price book

CREATE TABLE IF NOT EXISTS public.material_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  manufacturer TEXT,
  fixture_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster searches
CREATE INDEX IF NOT EXISTS idx_material_parts_name ON public.material_parts(name);
CREATE INDEX IF NOT EXISTS idx_material_parts_manufacturer ON public.material_parts(manufacturer);
CREATE INDEX IF NOT EXISTS idx_material_parts_fixture_type ON public.material_parts(fixture_type);

-- Enable RLS
ALTER TABLE public.material_parts ENABLE ROW LEVEL SECURITY;

-- Policy: Devs and masters can read all parts
CREATE POLICY "Devs and masters can read material parts"
ON public.material_parts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Policy: Devs and masters can insert parts
CREATE POLICY "Devs and masters can insert material parts"
ON public.material_parts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Policy: Devs and masters can update parts
CREATE POLICY "Devs and masters can update material parts"
ON public.material_parts
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

-- Policy: Devs and masters can delete parts
CREATE POLICY "Devs and masters can delete material parts"
ON public.material_parts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Add comment
COMMENT ON TABLE public.material_parts IS 'Material parts in the price book. Each part has a name, manufacturer, fixture type, and notes (can include SKU numbers).';
