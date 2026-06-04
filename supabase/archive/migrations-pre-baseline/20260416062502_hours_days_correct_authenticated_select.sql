-- Allow any authenticated user to read which work_dates are marked correct (company-wide lock).
-- INSERT/DELETE remain restricted to pay-approved master / assistant (existing policies).
-- Enables Dashboard (and similar) to hide My Time entry points without exposing sensitive data.

CREATE POLICY "Authenticated users can read hours days correct"
ON public.hours_days_correct
FOR SELECT
TO authenticated
USING (true);
