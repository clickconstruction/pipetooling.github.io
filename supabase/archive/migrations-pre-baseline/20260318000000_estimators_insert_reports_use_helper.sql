-- Fix estimators insert reports: use public.is_estimator() (SECURITY DEFINER)
-- Avoids RLS recursion when policy reads users table

DROP POLICY IF EXISTS "Estimators can insert reports" ON public.reports;

CREATE POLICY "Estimators can insert reports"
ON public.reports
FOR INSERT
WITH CHECK (
  public.is_estimator()
  AND created_by_user_id = auth.uid()
);
