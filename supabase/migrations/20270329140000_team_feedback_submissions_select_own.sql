-- Submissions were insertable by reviewer (WITH CHECK) but SELECT was dev-only.
-- Client uses insert().select('id') for peer rows; PostgREST must be allowed to return the new row.
CREATE POLICY "team_feedback_submissions_select_own"
ON public.team_feedback_submissions FOR SELECT
TO authenticated
USING (reviewer_user_id = auth.uid());
