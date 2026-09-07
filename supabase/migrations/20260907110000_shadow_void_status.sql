SET lock_timeout = '3s';

-- v2.3037 — twin_shadow_runs.status admits 'void'.
--
-- void_shadow (twin-mcp v1.3.10) takes a shadow out of the scoring loop — a
-- category error (b480 shadowed an Electrical bid), a wrong reference, a
-- contaminated run — but the v2.2539 CHECK only knew open/locked/scored, so the
-- verb's first real use failed. score_shadows selects status = 'locked' only,
-- so 'void' is inert to scoring by construction. Idempotent: drop-if-exists +
-- re-add; the data is untouched.

ALTER TABLE public.twin_shadow_runs DROP CONSTRAINT IF EXISTS twin_shadow_runs_status_check;
ALTER TABLE public.twin_shadow_runs
  ADD CONSTRAINT twin_shadow_runs_status_check CHECK (status IN ('open', 'locked', 'scored', 'void'));

COMMENT ON COLUMN public.twin_shadow_runs.status IS
  'open (claimed, unlocked) → locked (sealed blind total) → scored (reference sent, delta on record); void = taken out of the loop by void_shadow (category error, wrong reference, contaminated run) — never scored.';
