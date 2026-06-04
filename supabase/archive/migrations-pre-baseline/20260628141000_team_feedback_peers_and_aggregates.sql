-- Phase 3–4: peer ratings, peer candidate RPC, aggregate read for pay-approved masters (no reviewer identity).

CREATE TABLE public.team_feedback_peer_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submission_id UUID NOT NULL REFERENCES public.team_feedback_submissions(id) ON DELETE CASCADE,
  peer_person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  peer_likert_1 SMALLINT CHECK (peer_likert_1 IS NULL OR (peer_likert_1 >= 1 AND peer_likert_1 <= 5)),
  peer_likert_2 SMALLINT CHECK (peer_likert_2 IS NULL OR (peer_likert_2 >= 1 AND peer_likert_2 <= 5)),
  peer_likert_3 SMALLINT CHECK (peer_likert_3 IS NULL OR (peer_likert_3 >= 1 AND peer_likert_3 <= 5)),
  peer_likert_4 SMALLINT CHECK (peer_likert_4 IS NULL OR (peer_likert_4 >= 1 AND peer_likert_4 <= 5)),
  peer_likert_5 SMALLINT CHECK (peer_likert_5 IS NULL OR (peer_likert_5 >= 1 AND peer_likert_5 <= 5)),
  peer_trust SMALLINT CHECK (peer_trust IS NULL OR (peer_trust >= 1 AND peer_trust <= 5)),
  UNIQUE (submission_id, peer_person_id)
);

CREATE INDEX idx_team_feedback_peer_ratings_submission ON public.team_feedback_peer_ratings(submission_id);
CREATE INDEX idx_team_feedback_peer_ratings_peer ON public.team_feedback_peer_ratings(peer_person_id);

COMMENT ON TABLE public.team_feedback_peer_ratings IS 'Per-peer scores linked to a team feedback submission.';

ALTER TABLE public.team_feedback_peer_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_feedback_peer_ratings_insert_own_submission"
ON public.team_feedback_peer_ratings FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_feedback_submissions s
    WHERE s.id = submission_id AND s.reviewer_user_id = auth.uid()
  )
);

CREATE POLICY "team_feedback_peer_ratings_select_dev"
ON public.team_feedback_peer_ratings FOR SELECT
TO authenticated
USING (public.is_dev());

CREATE POLICY "team_feedback_peer_ratings_delete_dev"
ON public.team_feedback_peer_ratings FOR DELETE
TO authenticated
USING (public.is_dev());

GRANT SELECT, INSERT, DELETE ON public.team_feedback_peer_ratings TO authenticated;

CREATE OR REPLACE FUNCTION public.list_feedback_peer_candidates()
RETURNS TABLE (person_id UUID, peer_name TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  r TEXT;
  mid UUID;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  SELECT u.role INTO r FROM public.users u WHERE u.id = uid;
  IF r IS NULL THEN RETURN; END IF;

  IF r IN ('master_technician', 'dev') THEN
    mid := uid;
  ELSIF r = 'assistant' THEN
    SELECT ma.master_id INTO mid FROM public.master_assistants ma WHERE ma.assistant_id = uid LIMIT 1;
  ELSIF r = 'superintendent' THEN
    SELECT ms.master_id INTO mid FROM public.master_superintendents ms WHERE ms.superintendent_id = uid LIMIT 1;
  ELSE
    SELECT p.master_user_id INTO mid
    FROM public.users u
    INNER JOIN public.people p ON p.archived_at IS NULL
      AND p.email IS NOT NULL AND trim(p.email) <> ''
      AND lower(trim(p.email)) = lower(trim(u.email))
    WHERE u.id = uid
    LIMIT 1;
  END IF;

  IF mid IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT p.id, p.name::text
  FROM public.people p
  WHERE p.master_user_id = mid
    AND p.archived_at IS NULL
  ORDER BY p.name
  LIMIT 200;
END;
$$;

COMMENT ON FUNCTION public.list_feedback_peer_candidates() IS 'People on the same master roster as the reviewer; for peer feedback selection.';

GRANT EXECUTE ON FUNCTION public.list_feedback_peer_candidates() TO authenticated;

CREATE OR REPLACE FUNCTION public.team_feedback_aggregates_by_manager()
RETURNS TABLE (
  cycle_period_start DATE,
  manager_user_id UUID,
  submission_count BIGINT,
  avg_likert_1 NUMERIC,
  avg_likert_2 NUMERIC,
  avg_likert_3 NUMERIC,
  avg_likert_4 NUMERIC,
  avg_likert_5 NUMERIC,
  avg_overall_1_10 NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_dev() THEN
    RETURN QUERY
    SELECT
      s.cycle_period_start,
      s.manager_user_id,
      COUNT(*)::bigint,
      ROUND(AVG(s.manager_likert_1)::numeric, 2),
      ROUND(AVG(s.manager_likert_2)::numeric, 2),
      ROUND(AVG(s.manager_likert_3)::numeric, 2),
      ROUND(AVG(s.manager_likert_4)::numeric, 2),
      ROUND(AVG(s.manager_likert_5)::numeric, 2),
      ROUND(AVG(s.manager_overall_1_10)::numeric, 2)
    FROM public.team_feedback_submissions s
    WHERE s.manager_likert_1 IS NOT NULL
      AND s.cycle_period_start IS NOT NULL
    GROUP BY s.cycle_period_start, s.manager_user_id;
    RETURN;
  END IF;

  IF NOT public.is_pay_approved_master() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.cycle_period_start,
    s.manager_user_id,
    COUNT(*)::bigint,
    ROUND(AVG(s.manager_likert_1)::numeric, 2),
    ROUND(AVG(s.manager_likert_2)::numeric, 2),
    ROUND(AVG(s.manager_likert_3)::numeric, 2),
    ROUND(AVG(s.manager_likert_4)::numeric, 2),
    ROUND(AVG(s.manager_likert_5)::numeric, 2),
    ROUND(AVG(s.manager_overall_1_10)::numeric, 2)
  FROM public.team_feedback_submissions s
  WHERE s.manager_likert_1 IS NOT NULL
    AND s.cycle_period_start IS NOT NULL
    AND s.manager_user_id = auth.uid()
  GROUP BY s.cycle_period_start, s.manager_user_id;
END;
$$;

COMMENT ON FUNCTION public.team_feedback_aggregates_by_manager() IS 'Aggregate manager feedback by cycle; no reviewer identity in result.';

GRANT EXECUTE ON FUNCTION public.team_feedback_aggregates_by_manager() TO authenticated;
