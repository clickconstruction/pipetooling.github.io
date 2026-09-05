SET lock_timeout = '3s';

-- Crew reviews on the three bars (v2.2824). The ten-question Team Feedback wizard retires;
-- at clock-out a crew member rates the teammates they shared jobs with (and their lead) on the
-- same Ability / Drive / Integrity 0-100 sliders the office uses in Prospects → Team → Review,
-- plus one free-text "open words" card. Crew ratings are rows in team_member_reviews tagged
-- source = 'crew'. They are ANONYMOUS to everyone but dev: the office reads only averages
-- (crew_review_aggregates); the rater's own rows stay readable to the rater for the
-- one-per-month rule.

-- 1. team_member_reviews.source ------------------------------------------------------------
ALTER TABLE public.team_member_reviews
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'office';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.team_member_reviews'::regclass AND conname = 'team_member_reviews_source_check'
  ) THEN
    ALTER TABLE public.team_member_reviews
      ADD CONSTRAINT team_member_reviews_source_check CHECK (source IN ('office', 'crew'));
  END IF;
END $$;

COMMENT ON COLUMN public.team_member_reviews.source IS 'office = Prospects → Team → Review deck (attributed to staff); crew = the clock-out deck (anonymous to everyone but dev). v2.2824.';

-- One row per (subject, reviewer, month, SOURCE): a master who rates Grace from the office deck
-- and is later dealt Grace at clock-out keeps two distinct rows.
DO $$
DECLARE
  old_name text;
BEGIN
  SELECT conname INTO old_name
  FROM pg_constraint
  WHERE conrelid = 'public.team_member_reviews'::regclass
    AND contype = 'u'
    AND array_length(conkey, 1) = 3;
  IF old_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.team_member_reviews DROP CONSTRAINT %I', old_name);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.team_member_reviews'::regclass
      AND conname = 'team_member_reviews_subject_reviewer_month_source_key'
  ) THEN
    ALTER TABLE public.team_member_reviews
      ADD CONSTRAINT team_member_reviews_subject_reviewer_month_source_key
      UNIQUE (subject_user_id, reviewer_user_id, review_month, source);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_team_member_reviews_source_month
  ON public.team_member_reviews (source, review_month DESC);

-- 2. Row security: office rows as before; crew rows written by any signed-in account about
--    someone else, read back only by the writer and dev. ----------------------------------
DROP POLICY IF EXISTS "Prospects staff can read team member reviews" ON public.team_member_reviews;
CREATE POLICY "Prospects staff can read team member reviews" ON public.team_member_reviews
  FOR SELECT USING (
    (source = 'office' AND public.user_has_prospects_staff_access())
    OR public.is_dev()
    OR reviewer_user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Reviewers insert their own team member reviews" ON public.team_member_reviews;
CREATE POLICY "Reviewers insert their own team member reviews" ON public.team_member_reviews
  FOR INSERT WITH CHECK (
    reviewer_user_id = (SELECT auth.uid())
    AND (
      (source = 'office' AND public.user_has_prospects_staff_access())
      OR (source = 'crew' AND subject_user_id <> reviewer_user_id)
    )
  );

DROP POLICY IF EXISTS "Reviewers update their own team member reviews" ON public.team_member_reviews;
CREATE POLICY "Reviewers update their own team member reviews" ON public.team_member_reviews
  FOR UPDATE USING (reviewer_user_id = (SELECT auth.uid()))
  WITH CHECK (
    reviewer_user_id = (SELECT auth.uid())
    AND (
      (source = 'office' AND public.user_has_prospects_staff_access())
      OR (source = 'crew' AND subject_user_id <> reviewer_user_id)
    )
  );

DROP POLICY IF EXISTS "Reviewers delete their own team member reviews" ON public.team_member_reviews;
CREATE POLICY "Reviewers delete their own team member reviews" ON public.team_member_reviews
  FOR DELETE USING (reviewer_user_id = (SELECT auth.uid()) OR public.is_dev());

-- 3. Who did I work with? Other active accounts with APPROVED clock sessions on the same job on
--    the same day as the caller inside the lookback, most days together first. p_extra_user_ids
--    (the caller's lead) are always returned, with whatever overlap they have. ----------------
CREATE OR REPLACE FUNCTION public.crew_review_teammates(p_lookback_days integer DEFAULT 14, p_extra_user_ids uuid[] DEFAULT '{}')
RETURNS TABLE (user_id uuid, name text, role text, days_together integer, jobs text[])
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH me AS (
    SELECT DISTINCT cs.job_ledger_id, cs.work_date
    FROM public.clock_sessions cs
    WHERE cs.user_id = (SELECT auth.uid())
      AND cs.job_ledger_id IS NOT NULL
      AND cs.approved_at IS NOT NULL
      AND cs.work_date >= (CURRENT_DATE - GREATEST(COALESCE(p_lookback_days, 14), 1))
  ),
  shared AS (
    SELECT cs.user_id, cs.job_ledger_id, cs.work_date
    FROM public.clock_sessions cs
    JOIN me ON me.job_ledger_id = cs.job_ledger_id AND me.work_date = cs.work_date
    WHERE cs.user_id <> (SELECT auth.uid())
      AND cs.approved_at IS NOT NULL
    GROUP BY cs.user_id, cs.job_ledger_id, cs.work_date
  ),
  per_user AS (
    SELECT s.user_id, COUNT(DISTINCT s.work_date)::integer AS days_together
    FROM shared s
    GROUP BY s.user_id
  ),
  job_labels AS (
    SELECT s.user_id, s.job_ledger_id, MAX(s.work_date) AS last_day
    FROM shared s
    GROUP BY s.user_id, s.job_ledger_id
  ),
  job_lists AS (
    SELECT jl.user_id,
      (ARRAY_AGG(
        trim(BOTH ' — ' FROM concat_ws(' — ', NULLIF(trim(j.hcp_number), ''), COALESCE(NULLIF(trim(j.job_name), ''), NULLIF(trim(j.customer_name), ''))))
        ORDER BY jl.last_day DESC
      ))[1:3] AS jobs
    FROM job_labels jl
    JOIN public.jobs_ledger j ON j.id = jl.job_ledger_id
    GROUP BY jl.user_id
  ),
  candidates AS (
    SELECT pu.user_id FROM per_user pu
    UNION
    SELECT x FROM unnest(COALESCE(p_extra_user_ids, '{}'::uuid[])) AS x WHERE x <> (SELECT auth.uid())
  )
  SELECT
    u.id AS user_id,
    u.name,
    u.role::text AS role,
    COALESCE(pu.days_together, 0) AS days_together,
    COALESCE(jl.jobs, '{}'::text[]) AS jobs
  FROM candidates c
  JOIN public.users u ON u.id = c.user_id AND u.archived_at IS NULL
  LEFT JOIN per_user pu ON pu.user_id = c.user_id
  LEFT JOIN job_lists jl ON jl.user_id = c.user_id
  WHERE (SELECT auth.uid()) IS NOT NULL
  ORDER BY COALESCE(pu.days_together, 0) DESC, u.name
$$;

COMMENT ON FUNCTION public.crew_review_teammates(integer, uuid[]) IS 'Clock-out deck (v2.2824): who the caller shared approved clock sessions with in the lookback (same job, same day), plus any extra ids (their lead). Names come from users; nothing about other people''s hours leaves the function.';

REVOKE ALL ON FUNCTION public.crew_review_teammates(integer, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.crew_review_teammates(integer, uuid[]) TO authenticated;

-- 4. What the office may see of crew ratings: per subject per month, the average of each
--    dimension and the rater count. Never a name, never a note. Fewer than two raters is
--    hidden from the office (a lone rating is not anonymous); dev sees every month. ---------
CREATE OR REPLACE FUNCTION public.crew_review_aggregates()
RETURNS TABLE (subject_user_id uuid, review_month date, rating_ability numeric, rating_drive numeric, rating_integrity numeric, rater_count integer)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    r.subject_user_id,
    r.review_month,
    ROUND(AVG(r.rating_ability), 1) AS rating_ability,
    ROUND(AVG(r.rating_drive), 1) AS rating_drive,
    ROUND(AVG(r.rating_integrity), 1) AS rating_integrity,
    COUNT(DISTINCT r.reviewer_user_id)::integer AS rater_count
  FROM public.team_member_reviews r
  WHERE r.source = 'crew'
    AND (public.user_has_prospects_staff_access() OR public.is_dev())
  GROUP BY r.subject_user_id, r.review_month
  HAVING COUNT(DISTINCT r.reviewer_user_id) >= 2 OR public.is_dev()
  ORDER BY r.subject_user_id, r.review_month DESC
$$;

COMMENT ON FUNCTION public.crew_review_aggregates() IS 'Anonymous crew lane (v2.2824): per subject per month averages + rater count of source=crew reviews. Office sees months with 2+ raters; dev sees all. Empty for callers without prospects staff access.';

REVOKE ALL ON FUNCTION public.crew_review_aggregates() FROM anon;
GRANT EXECUTE ON FUNCTION public.crew_review_aggregates() TO authenticated;

-- 5. Open words: one free box beside the three prompts that already exist. ------------------
ALTER TABLE public.team_feedback_submissions ADD COLUMN IF NOT EXISTS open_anything text;
COMMENT ON COLUMN public.team_feedback_submissions.open_anything IS 'The free "Anything at all" box on the clock-out deck''s last card (v2.2824).';

-- 6. Settings: the deck's lookback window, editable open-card headings, and the date the
--    scripted questions were retired (their columns stay as the saved copy). ---------------
ALTER TABLE public.team_feedback_settings ADD COLUMN IF NOT EXISTS crew_lookback_days integer NOT NULL DEFAULT 14;
ALTER TABLE public.team_feedback_settings ADD COLUMN IF NOT EXISTS open_prompts jsonb;
ALTER TABLE public.team_feedback_settings ADD COLUMN IF NOT EXISTS questions_retired_at timestamptz;

COMMENT ON COLUMN public.team_feedback_settings.crew_lookback_days IS 'Days of approved clock sessions the clock-out deck looks back to find teammates (v2.2824).';
COMMENT ON COLUMN public.team_feedback_settings.open_prompts IS 'JSON array of exactly 4 headings for the open-words card; null = defaults (v2.2824).';
COMMENT ON COLUMN public.team_feedback_settings.questions_retired_at IS 'When the ten agree/disagree prompts stopped being asked. The *_likert_prompts / *_step_heading / manager_overall_prompt columns are kept as the saved copy (v2.2824).';

UPDATE public.team_feedback_settings SET questions_retired_at = now() WHERE id = 1 AND questions_retired_at IS NULL;
