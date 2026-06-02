-- Optional reference link (product / spec page) for a material part, shown and
-- editable in the Edit Part modal. Additive; existing parts get NULL.
ALTER TABLE public.material_parts
  ADD COLUMN IF NOT EXISTS link TEXT;

COMMENT ON COLUMN public.material_parts.link IS
  'Optional external URL (product/spec page) for the part; shown in the Edit Part modal.';
