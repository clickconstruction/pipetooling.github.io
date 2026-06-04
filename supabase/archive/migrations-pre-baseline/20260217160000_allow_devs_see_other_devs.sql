-- Allow devs to see other dev users (for People page Users tab)
CREATE POLICY "Devs can see other devs" ON public.users
FOR SELECT
USING (
  role = 'dev'
  AND public.is_master_or_dev()
);
