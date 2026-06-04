-- Job completeness percentage (0-100) for Working section Value Created display
ALTER TABLE public.jobs_ledger
ADD COLUMN pct_complete INTEGER CHECK (pct_complete >= 0 AND pct_complete <= 100);
