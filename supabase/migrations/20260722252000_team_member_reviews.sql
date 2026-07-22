-- Team member reviews (v2.948): the Prospects → Team board gains a fourth
-- stage tab "Review" (Rate + Reflect) where prospects staff rate CURRENT team
-- members on the same three dimensions as candidate reviews (Ability / Drive /
-- Integrity, 0-100 + per-dimension comment). Unlike team_prospect_reviews
-- (one editable row per candidate+reviewer), these are a MONTHLY time series:
-- one row per (subject, reviewer, month) — re-saving within a month updates
-- that month's row; a new month starts a new row.

CREATE TABLE IF NOT EXISTS public.team_member_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  review_month date NOT NULL,
  rating_ability integer CHECK (rating_ability BETWEEN 0 AND 100),
  rating_drive integer CHECK (rating_drive BETWEEN 0 AND 100),
  rating_integrity integer CHECK (rating_integrity BETWEEN 0 AND 100),
  comment_ability text,
  comment_drive text,
  comment_integrity text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT team_member_reviews_month_is_first_of_month CHECK (review_month = date_trunc('month', review_month)::date),
  UNIQUE (subject_user_id, reviewer_user_id, review_month)
);

COMMENT ON TABLE public.team_member_reviews IS 'Monthly per-reviewer ratings of current team members (Prospects → Team → Review). One row per (subject, reviewer, month); review_month is the first of the month in company time.';

CREATE INDEX IF NOT EXISTS idx_team_member_reviews_subject ON public.team_member_reviews (subject_user_id, review_month DESC);
CREATE INDEX IF NOT EXISTS idx_team_member_reviews_reviewer ON public.team_member_reviews (reviewer_user_id, review_month DESC);

DROP TRIGGER IF EXISTS update_team_member_reviews_updated_at ON public.team_member_reviews;
CREATE TRIGGER update_team_member_reviews_updated_at BEFORE UPDATE ON public.team_member_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.team_member_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Prospects staff can read team member reviews" ON public.team_member_reviews;
CREATE POLICY "Prospects staff can read team member reviews" ON public.team_member_reviews
  FOR SELECT USING (public.user_has_prospects_staff_access());

DROP POLICY IF EXISTS "Reviewers insert their own team member reviews" ON public.team_member_reviews;
CREATE POLICY "Reviewers insert their own team member reviews" ON public.team_member_reviews
  FOR INSERT WITH CHECK (
    public.user_has_prospects_staff_access() AND reviewer_user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Reviewers update their own team member reviews" ON public.team_member_reviews;
CREATE POLICY "Reviewers update their own team member reviews" ON public.team_member_reviews
  FOR UPDATE USING (reviewer_user_id = (SELECT auth.uid()))
  WITH CHECK (public.user_has_prospects_staff_access() AND reviewer_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Reviewers delete their own team member reviews" ON public.team_member_reviews;
CREATE POLICY "Reviewers delete their own team member reviews" ON public.team_member_reviews
  FOR DELETE USING (reviewer_user_id = (SELECT auth.uid()));

-- Last-5-jobs context for the Rate cards: each active user's most recent
-- distinct jobs from APPROVED clock sessions, joined by user_id (no name
-- joins). Zero rows (not an error) for callers without prospects access,
-- per the v2.914 no-raise pattern.
CREATE OR REPLACE FUNCTION public.list_team_member_recent_jobs()
RETURNS TABLE (user_id uuid, job_ledger_id uuid, job_display text, last_worked_date date)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      cs.user_id,
      cs.job_ledger_id,
      MAX(cs.work_date) AS last_worked_date,
      ROW_NUMBER() OVER (PARTITION BY cs.user_id ORDER BY MAX(cs.work_date) DESC) AS rn
    FROM public.clock_sessions cs
    WHERE cs.job_ledger_id IS NOT NULL
      AND cs.approved_at IS NOT NULL
    GROUP BY cs.user_id, cs.job_ledger_id
  )
  SELECT
    r.user_id,
    r.job_ledger_id,
    trim(BOTH ' — ' FROM concat_ws(' — ', NULLIF(trim(j.hcp_number), ''), COALESCE(NULLIF(trim(j.job_name), ''), NULLIF(trim(j.customer_name), '')))) AS job_display,
    r.last_worked_date
  FROM ranked r
  JOIN public.jobs_ledger j ON j.id = r.job_ledger_id
  WHERE r.rn <= 5
    AND public.user_has_prospects_staff_access()
  ORDER BY r.user_id, r.last_worked_date DESC
$$;

COMMENT ON FUNCTION public.list_team_member_recent_jobs() IS 'Rate-card context (v2.948): last 5 distinct approved-clock-session jobs per user. Empty for callers without prospects staff access.';

REVOKE ALL ON FUNCTION public.list_team_member_recent_jobs() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_team_member_recent_jobs() TO authenticated;

-- Training-mode write blocks (required for every CREATE TABLE — see CLAUDE.md).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
