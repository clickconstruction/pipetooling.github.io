-- Use explicit public.is_estimator() in policy to ensure correct resolution
-- Some connection contexts may not have public in search_path when evaluating policy

DROP POLICY IF EXISTS "Estimators can insert reports" ON public.reports;

CREATE POLICY "Estimators can insert reports"
ON public.reports
FOR INSERT
WITH CHECK (
  public.is_estimator()
  AND created_by_user_id = auth.uid()
);;
