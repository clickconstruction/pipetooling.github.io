SET lock_timeout = '3s';

-- v2.4301: one signed paper can cover several named jobs of the same customer or GC.
-- Each covered job keeps its own signed job_contracts row (coverage stays per job);
-- the rows filed together share covers_group_id, so the strip can say which jobs the
-- paper covers and the Customer page can change or remove them as one.
ALTER TABLE public.job_contracts
  ADD COLUMN IF NOT EXISTS covers_group_id uuid;

COMMENT ON COLUMN public.job_contracts.covers_group_id IS
  'Rows filed as one signed paper for several named jobs share this id (the first row''s id). Null = a contract for its own job only.';

CREATE INDEX IF NOT EXISTS job_contracts_covers_group_idx
  ON public.job_contracts (covers_group_id)
  WHERE covers_group_id IS NOT NULL;
