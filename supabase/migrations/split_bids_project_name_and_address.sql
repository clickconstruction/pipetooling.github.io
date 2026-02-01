-- Split project_name_and_address into project_name and address

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS project_name TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;

UPDATE public.bids
SET project_name = project_name_and_address, address = NULL
WHERE project_name_and_address IS NOT NULL;

ALTER TABLE public.bids
  DROP COLUMN IF EXISTS project_name_and_address;

COMMENT ON COLUMN public.bids.project_name IS 'Project name for the bid.';
COMMENT ON COLUMN public.bids.address IS 'Address for the bid.';
