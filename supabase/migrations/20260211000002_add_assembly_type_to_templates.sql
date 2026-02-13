-- Add assembly_type_id to material_templates table
-- This allows assemblies to be categorized by assembly type

-- Add the column (nullable to allow assemblies without types)
ALTER TABLE public.material_templates
ADD COLUMN IF NOT EXISTS assembly_type_id UUID;

-- Add foreign key constraint with SET NULL on delete
-- (if an assembly type is deleted, the template's assembly_type_id becomes NULL)
ALTER TABLE public.material_templates
ADD CONSTRAINT material_templates_assembly_type_id_fkey
FOREIGN KEY (assembly_type_id)
REFERENCES public.assembly_types(id)
ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_material_templates_assembly_type_id
ON public.material_templates(assembly_type_id);

-- Add comment
COMMENT ON COLUMN public.material_templates.assembly_type_id IS 'Optional assembly type categorization for this template';
