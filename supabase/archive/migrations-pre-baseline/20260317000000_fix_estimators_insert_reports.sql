-- Ensure estimators can insert reports (fixes "new row violates row-level security policy")
-- Recreates policy in case 20260313000000 was not applied or policy was dropped

DROP POLICY IF EXISTS "Estimators can insert reports" ON public.reports;

CREATE POLICY "Estimators can insert reports"
ON public.reports
FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'estimator')
  AND created_by_user_id = auth.uid()
);
