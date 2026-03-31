-- Update people table kind check constraint to include dev and estimator roles
-- This allows the People page to add entries for all user roles

-- Drop the existing check constraint
ALTER TABLE public.people 
DROP CONSTRAINT IF EXISTS people_kind_check;

-- Add updated check constraint with all 5 roles
ALTER TABLE public.people 
ADD CONSTRAINT people_kind_check 
CHECK (kind IN ('assistant', 'master_technician', 'sub', 'dev', 'estimator'));
