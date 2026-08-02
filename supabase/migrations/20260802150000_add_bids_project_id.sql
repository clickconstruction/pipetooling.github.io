SET lock_timeout = '3s';

-- Link bids to projects, mirroring jobs_ledger.project_id (v2.1275).
-- estimates.project_id already exists in the baseline (FK -> projects, ON DELETE SET NULL);
-- this adds the bids side plus partial indexes for both project-rail lookups.
-- No owner-match trigger: bids carry no master_user_id (company-scoped via bids RLS),
-- unlike jobs_ledger where the owner must match the project's owner.

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.bids.project_id IS
  'Optional link to the project this bid belongs to (Projects card Bids rail). Free-text bids.project_name predates this and is unrelated.';

CREATE INDEX IF NOT EXISTS idx_bids_project_id
  ON public.bids (project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_estimates_project_id
  ON public.estimates (project_id)
  WHERE project_id IS NOT NULL;
