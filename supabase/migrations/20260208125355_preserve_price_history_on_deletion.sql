-- Preserve price history even when parts or supply houses are deleted
-- Changes foreign key constraints from CASCADE to SET NULL

-- Step 1: Drop existing foreign key constraints
ALTER TABLE public.material_part_price_history
DROP CONSTRAINT IF EXISTS material_part_price_history_part_id_fkey;

ALTER TABLE public.material_part_price_history
DROP CONSTRAINT IF EXISTS material_part_price_history_supply_house_id_fkey;

-- Step 2: Make columns nullable (required for SET NULL to work)
ALTER TABLE public.material_part_price_history
ALTER COLUMN part_id DROP NOT NULL;

ALTER TABLE public.material_part_price_history
ALTER COLUMN supply_house_id DROP NOT NULL;

-- Step 3: Recreate foreign key constraints with ON DELETE SET NULL
ALTER TABLE public.material_part_price_history
ADD CONSTRAINT material_part_price_history_part_id_fkey
FOREIGN KEY (part_id) REFERENCES public.material_parts(id)
ON DELETE SET NULL;

ALTER TABLE public.material_part_price_history
ADD CONSTRAINT material_part_price_history_supply_house_id_fkey
FOREIGN KEY (supply_house_id) REFERENCES public.supply_houses(id)
ON DELETE SET NULL;

-- Add comments
COMMENT ON CONSTRAINT material_part_price_history_part_id_fkey 
ON public.material_part_price_history IS 
'Foreign key to material_parts. ON DELETE SET NULL preserves price history even if part is deleted.';

COMMENT ON CONSTRAINT material_part_price_history_supply_house_id_fkey 
ON public.material_part_price_history IS 
'Foreign key to supply_houses. ON DELETE SET NULL preserves price history even if supply house is deleted.';
