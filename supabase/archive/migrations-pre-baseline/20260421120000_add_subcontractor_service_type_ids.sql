-- Add subcontractor_service_type_ids to users (like estimator_service_type_ids)
-- Restricts subcontractors to specific service types when associating Clock In and Dispatch with jobs/bids; NULL/empty = all types

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS subcontractor_service_type_ids UUID[] DEFAULT NULL;
COMMENT ON COLUMN public.users.subcontractor_service_type_ids IS 'Service types a subcontractor can associate with (Clock In, Dispatch). NULL or empty = all types.';
