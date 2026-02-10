-- Add part_type_id column to material_parts
-- Backfill from fixture_type_id by matching names

-- ============================================================================
-- Add part_type_id column (NULLABLE initially for migration)
-- ============================================================================

ALTER TABLE public.material_parts
ADD COLUMN IF NOT EXISTS part_type_id UUID REFERENCES public.part_types(id);

-- ============================================================================
-- Backfill part_type_id from fixture_type_id
-- ============================================================================

-- Match by name since we copied fixture_types to part_types
UPDATE public.material_parts mp
SET part_type_id = pt.id
FROM public.fixture_types ft
JOIN public.part_types pt ON pt.name = ft.name AND pt.service_type_id = ft.service_type_id
WHERE mp.fixture_type_id = ft.id
  AND mp.part_type_id IS NULL;

-- ============================================================================
-- Make part_type_id NOT NULL
-- ============================================================================

ALTER TABLE public.material_parts
ALTER COLUMN part_type_id SET NOT NULL;

-- ============================================================================
-- Add index and comment
-- ============================================================================

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_material_parts_part_type_id 
  ON public.material_parts(part_type_id);

-- Add comment
COMMENT ON COLUMN public.material_parts.part_type_id IS 'Foreign key to part_types table - categorizes material parts';
