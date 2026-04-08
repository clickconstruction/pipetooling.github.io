-- Rough takeoff: remember which assembly a part line was expanded from (Add assembly).
ALTER TABLE public.bids_takeoff_rough_part_lines
  ADD COLUMN IF NOT EXISTS source_template_id UUID NULL REFERENCES public.material_templates(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.bids_takeoff_rough_part_lines.source_template_id IS
  'When set, this line was created by expanding this material template (assembly) on rough takeoff. Cleared when user picks a different part manually.';
