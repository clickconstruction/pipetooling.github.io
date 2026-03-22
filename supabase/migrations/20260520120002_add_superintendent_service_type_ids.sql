-- Add superintendent_service_type_ids to users (like primary_service_type_ids)
-- Restricts superintendents to specific service types in Materials/Bids; NULL/empty = all types

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS superintendent_service_type_ids UUID[] DEFAULT NULL;
COMMENT ON COLUMN public.users.superintendent_service_type_ids IS 'Service types a superintendent can access in Materials and Bids. NULL or empty = all types.';
