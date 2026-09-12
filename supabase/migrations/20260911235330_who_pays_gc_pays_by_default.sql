SET lock_timeout = '3s';

-- Who pays the bill, PR 5 (v2.3353): a standing rule on the GC. "Done Right
-- pays for pretests" (owner, 2026-09-11) is a fact about Done Right, not
-- about each job — so the customer row says it once, and every new job that
-- names this customer as its GC starts with Bills go to = GC (the office can
-- still flip a job back). Set on Edit customer; read by the job form when the
-- GC is picked or imported from a won bid.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS gc_pays_by_default boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.customers.gc_pays_by_default IS
  'Who pays (v2.3353): when this customer is the GC on a job, new jobs default to bill_to_party = gc. Existing jobs are not touched.';
