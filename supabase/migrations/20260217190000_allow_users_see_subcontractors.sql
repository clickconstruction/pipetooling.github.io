-- Allow all authenticated users to see subcontractor users
-- Enables assistants (and viewing masters) to see subcontractors in People roster
-- when shared via master_shares, matching the pattern for estimators

CREATE POLICY "Users can see all subcontractors"
ON public.users
FOR SELECT
USING (role = 'subcontractor');

COMMENT ON POLICY "Users can see all subcontractors" ON public.users IS
  'Allows all authenticated users to see subcontractor user records. Enables assistants and shared masters to see subcontractors in the People page.';
