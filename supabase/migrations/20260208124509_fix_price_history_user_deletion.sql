-- Fix foreign key constraint on material_part_price_history.changed_by
-- Changes from NO ACTION to ON DELETE SET NULL
-- This allows user deletion while preserving price history audit trails

-- Drop existing constraint
ALTER TABLE public.material_part_price_history
DROP CONSTRAINT IF EXISTS material_part_price_history_changed_by_fkey;

-- Recreate with ON DELETE SET NULL
ALTER TABLE public.material_part_price_history
ADD CONSTRAINT material_part_price_history_changed_by_fkey
FOREIGN KEY (changed_by) REFERENCES public.users(id)
ON DELETE SET NULL;

COMMENT ON CONSTRAINT material_part_price_history_changed_by_fkey 
ON public.material_part_price_history IS 
'Foreign key to users table. ON DELETE SET NULL preserves price history while allowing user deletion.';
