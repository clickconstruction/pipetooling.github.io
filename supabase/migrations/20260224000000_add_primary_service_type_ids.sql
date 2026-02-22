-- Add primary_service_type_ids to users (like estimator_service_type_ids)
-- Restricts primaries to specific service types in Materials; NULL/empty = all types

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS primary_service_type_ids UUID[] DEFAULT NULL;

COMMENT ON COLUMN public.users.primary_service_type_ids IS 'Service types a primary can access in Materials. NULL or empty = all types.';
