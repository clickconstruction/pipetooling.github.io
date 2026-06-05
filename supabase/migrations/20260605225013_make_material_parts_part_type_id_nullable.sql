-- Make part type optional when adding a material part.
-- The part_type_id column was NOT NULL; dropping that constraint lets parts be
-- created without a part type. The FK to part_types and its index both tolerate
-- NULLs and are left unchanged.
ALTER TABLE public.material_parts ALTER COLUMN part_type_id DROP NOT NULL;
