-- Add Google Drive link field to jobs_ledger

ALTER TABLE public.jobs_ledger
ADD COLUMN IF NOT EXISTS google_drive_link TEXT;
COMMENT ON COLUMN public.jobs_ledger.google_drive_link IS 'Google Drive folder or file link for the job.';
