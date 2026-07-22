-- Team prospect links (v2.937): candidates carry multiple typed links
-- (Indeed profile, resume, LinkedIn, portfolio, ...) edited in the
-- Add/Edit candidate modal and shown as chips on board cards.
-- jsonb array of {type, url}; additive, existing RLS covers it.
ALTER TABLE public.team_prospects
  ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.team_prospects.links IS 'Array of {type, url} links for the candidate (resume, Indeed, LinkedIn, ...).';
