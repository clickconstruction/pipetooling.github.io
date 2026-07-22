-- Team prospect screening (v2.927): office reviewers (master/dev) call candidates
-- and leave their OWN ratings + remarks, and candidates can be pulled up onto a
-- "Call list" (new 'calling' status) between the sourcing board and hired/passed.
--
-- team_prospect_reviews: one editable row per (candidate, reviewer) — the same
-- three 0-100 dimensions as the candidate's sourcing sliders (NULL = unrated)
-- plus free-text remarks. Visible to everyone with prospects access (no blind
-- reviewing); writable only by the reviewer themself.

CREATE TABLE IF NOT EXISTS public.team_prospect_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_prospect_id uuid NOT NULL REFERENCES public.team_prospects(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating_ability integer CHECK (rating_ability BETWEEN 0 AND 100),
  rating_drive integer CHECK (rating_drive BETWEEN 0 AND 100),
  rating_integrity integer CHECK (rating_integrity BETWEEN 0 AND 100),
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (team_prospect_id, reviewer_user_id)
);

COMMENT ON TABLE public.team_prospect_reviews IS 'Per-reviewer screening-call ratings/remarks for team prospects (Prospects → Team → Call list). One row per (candidate, reviewer).';

CREATE INDEX IF NOT EXISTS idx_team_prospect_reviews_prospect ON public.team_prospect_reviews (team_prospect_id);

DROP TRIGGER IF EXISTS update_team_prospect_reviews_updated_at ON public.team_prospect_reviews;
CREATE TRIGGER update_team_prospect_reviews_updated_at BEFORE UPDATE ON public.team_prospect_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.team_prospect_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Prospects staff can read reviews" ON public.team_prospect_reviews;
CREATE POLICY "Prospects staff can read reviews" ON public.team_prospect_reviews
  FOR SELECT USING (public.user_has_prospects_staff_access());

DROP POLICY IF EXISTS "Reviewers insert their own review" ON public.team_prospect_reviews;
CREATE POLICY "Reviewers insert their own review" ON public.team_prospect_reviews
  FOR INSERT WITH CHECK (
    public.user_has_prospects_staff_access() AND reviewer_user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Reviewers update their own review" ON public.team_prospect_reviews;
CREATE POLICY "Reviewers update their own review" ON public.team_prospect_reviews
  FOR UPDATE USING (reviewer_user_id = (SELECT auth.uid()))
  WITH CHECK (public.user_has_prospects_staff_access() AND reviewer_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Reviewers delete their own review" ON public.team_prospect_reviews;
CREATE POLICY "Reviewers delete their own review" ON public.team_prospect_reviews
  FOR DELETE USING (reviewer_user_id = (SELECT auth.uid()));

-- 'calling' joins the candidate lifecycle: active (on the board) → calling
-- (pulled up for screening calls) → hired / passed.
ALTER TABLE public.team_prospects DROP CONSTRAINT IF EXISTS team_prospects_status_check;
ALTER TABLE public.team_prospects ADD CONSTRAINT team_prospects_status_check
  CHECK (status IN ('active', 'calling', 'hired', 'passed'));

-- Training-mode write blocks (required for every CREATE TABLE — see CLAUDE.md).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
