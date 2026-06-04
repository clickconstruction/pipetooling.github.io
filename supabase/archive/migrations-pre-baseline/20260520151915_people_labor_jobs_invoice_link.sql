-- Optional subcontractor invoice URL on Sub Labor jobs (Jobs → Sub Labor tab)
ALTER TABLE public.people_labor_jobs
  ADD COLUMN IF NOT EXISTS invoice_link TEXT;

COMMENT ON COLUMN public.people_labor_jobs.invoice_link IS
  'Optional URL to subcontractor invoice document.';
