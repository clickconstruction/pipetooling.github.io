-- Allow users to check if they are in report_enabled_users (to hide Reports tab)
CREATE POLICY "Users can read own report enabled status"
ON public.report_enabled_users
FOR SELECT
USING (user_id = auth.uid());
