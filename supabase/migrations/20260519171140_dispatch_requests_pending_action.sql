ALTER TABLE public.dispatch_requests
  ADD COLUMN IF NOT EXISTS pending_action text NULL;

COMMENT ON COLUMN public.dispatch_requests.pending_action IS
  'Stable token for in-app action affordances on the dispatch inbox row (NULL for plain text tasks). Known values: ''link_job_pictures'' (open Edit Job and focus the Customer Pictures input).';

CREATE INDEX IF NOT EXISTS dispatch_requests_pending_action_open_job_idx
  ON public.dispatch_requests (job_ledger_id, pending_action)
  WHERE pending_action IS NOT NULL AND status = 'open';
