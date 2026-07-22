-- Team prospect ratings (v2.926): three 0-100 dimensions rated in the Edit
-- candidate modal and shown as narrow bars on every board card. Nullable —
-- NULL means "not yet rated", distinct from a deliberate 0. Additive only;
-- existing team_prospects RLS covers the new columns.
ALTER TABLE public.team_prospects
  ADD COLUMN IF NOT EXISTS rating_ability integer CHECK (rating_ability BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS rating_drive integer CHECK (rating_drive BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS rating_integrity integer CHECK (rating_integrity BETWEEN 0 AND 100);

COMMENT ON COLUMN public.team_prospects.rating_ability IS 'Evidence of Exceptional Ability (Talent / Problem-Solving), 0-100; NULL = unrated.';
COMMENT ON COLUMN public.team_prospects.rating_drive IS 'Drive / Work Ethic / Intrinsic Motivation, 0-100; NULL = unrated.';
COMMENT ON COLUMN public.team_prospects.rating_integrity IS 'Trustworthiness / Goodness of Heart / Integrity, 0-100; NULL = unrated.';
