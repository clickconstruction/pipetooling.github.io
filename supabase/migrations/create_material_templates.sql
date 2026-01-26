-- Create material_templates table for reusable material templates

CREATE TABLE IF NOT EXISTS public.material_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_material_templates_name ON public.material_templates(name);

-- Enable RLS
ALTER TABLE public.material_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Devs and masters can read all templates
CREATE POLICY "Devs and masters can read material templates"
ON public.material_templates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Policy: Devs and masters can insert templates
CREATE POLICY "Devs and masters can insert material templates"
ON public.material_templates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Policy: Devs and masters can update templates
CREATE POLICY "Devs and masters can update material templates"
ON public.material_templates
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

-- Policy: Devs and masters can delete templates
CREATE POLICY "Devs and masters can delete material templates"
ON public.material_templates
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Add comment
COMMENT ON TABLE public.material_templates IS 'Reusable material templates that can contain parts and nested templates.';
