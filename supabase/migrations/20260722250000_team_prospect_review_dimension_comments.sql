-- Per-dimension review comments (v2.946): each reviewer's team_prospect_reviews
-- row gains an optional free-text comment beside each of the three 0-100
-- ratings (Ability / Drive / Integrity), so "why I scored it that way" lives
-- next to the score instead of being crammed into the overall remarks field.
-- remarks stays as the overall-impression note. Additive + idempotent; RLS is
-- row-scoped (reviewer-owned writes, staff reads) so no policy changes needed.

ALTER TABLE public.team_prospect_reviews ADD COLUMN IF NOT EXISTS comment_ability text;
ALTER TABLE public.team_prospect_reviews ADD COLUMN IF NOT EXISTS comment_drive text;
ALTER TABLE public.team_prospect_reviews ADD COLUMN IF NOT EXISTS comment_integrity text;

COMMENT ON COLUMN public.team_prospect_reviews.comment_ability IS 'Reviewer''s optional note for the Ability rating (v2.946).';
COMMENT ON COLUMN public.team_prospect_reviews.comment_drive IS 'Reviewer''s optional note for the Drive rating (v2.946).';
COMMENT ON COLUMN public.team_prospect_reviews.comment_integrity IS 'Reviewer''s optional note for the Integrity rating (v2.946).';
