-- Allow estimators to insert reports (same pattern as subcontractors)
-- Estimators in report_enabled_users can create reports from Dashboard/Jobs

CREATE POLICY "Estimators can insert reports"
ON public.reports
FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'estimator')
  AND created_by_user_id = auth.uid()
);
