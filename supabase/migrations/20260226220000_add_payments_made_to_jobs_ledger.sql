-- Add payments_made to jobs_ledger for tracking amount paid; Remaining = revenue - payments_made

ALTER TABLE public.jobs_ledger
ADD COLUMN IF NOT EXISTS payments_made NUMERIC(12, 2) DEFAULT 0;

COMMENT ON COLUMN public.jobs_ledger.payments_made IS 'Amount paid to date on this job. Remaining = revenue - payments_made.';
