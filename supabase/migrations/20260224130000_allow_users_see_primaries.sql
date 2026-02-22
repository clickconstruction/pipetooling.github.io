-- Allow all authenticated users to see primary users
-- This enables primaries to appear in the "Assign to" dropdown when sending tasks
-- (Dashboard Send task, ChecklistAddModal, Checklist forward, etc.)

CREATE POLICY "Users can see all primaries"
ON public.users
FOR SELECT
USING (role = 'primary');

COMMENT ON POLICY "Users can see all primaries" ON public.users IS
  'Allows all authenticated users to see primary user records. This enables tasks to be assigned to primaries when sending tasks from the Dashboard or Checklist.';
