-- Add optional part_id to jobs_ledger_materials for linking Billed Materials to material_parts
-- Keeps description and amount for custom/free-form rows (backward compatible)

ALTER TABLE public.jobs_ledger_materials
  ADD COLUMN IF NOT EXISTS part_id UUID NULL REFERENCES public.material_parts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_ledger_materials_part_id ON public.jobs_ledger_materials(part_id);

COMMENT ON COLUMN public.jobs_ledger_materials.part_id IS 'Optional link to material_parts for structured part selection. When set, description can be synced from part name.';
