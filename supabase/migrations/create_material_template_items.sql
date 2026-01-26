-- Create material_template_items table for hierarchical template structure

CREATE TABLE IF NOT EXISTS public.material_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.material_templates(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('part', 'template')),
  part_id UUID REFERENCES public.material_parts(id) ON DELETE CASCADE,
  nested_template_id UUID REFERENCES public.material_templates(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (item_type = 'part' AND part_id IS NOT NULL AND nested_template_id IS NULL) OR
    (item_type = 'template' AND nested_template_id IS NOT NULL AND part_id IS NULL)
  )
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_material_template_items_template_id ON public.material_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_material_template_items_part_id ON public.material_template_items(part_id);
CREATE INDEX IF NOT EXISTS idx_material_template_items_nested_template_id ON public.material_template_items(nested_template_id);
CREATE INDEX IF NOT EXISTS idx_material_template_items_sequence_order ON public.material_template_items(template_id, sequence_order);

-- Enable RLS
ALTER TABLE public.material_template_items ENABLE ROW LEVEL SECURITY;

-- Policy: Devs and masters can read all template items
CREATE POLICY "Devs and masters can read material template items"
ON public.material_template_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Policy: Devs and masters can insert template items
CREATE POLICY "Devs and masters can insert material template items"
ON public.material_template_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Policy: Devs and masters can update template items
CREATE POLICY "Devs and masters can update material template items"
ON public.material_template_items
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

-- Policy: Devs and masters can delete template items
CREATE POLICY "Devs and masters can delete material template items"
ON public.material_template_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Add comment
COMMENT ON TABLE public.material_template_items IS 'Items within material templates. Can be parts or nested templates. Prevents circular references via application logic.';
