ALTER TABLE public.jobs_ledger
ADD COLUMN stage_notes TEXT;

COMMENT ON COLUMN public.jobs_ledger.stage_notes IS 'Short note for Stages tab; editable by any user with job access.';
