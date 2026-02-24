-- Consolidate 12 permissive SELECT policies on public.users into a single policy.
-- Multiple permissive policies hurt performance as each must be evaluated.
-- See: https://supabase.com/docs/guides/database/database-linter (permissive policies)

-- Drop all existing SELECT policies
DROP POLICY IF EXISTS "Devs can see other devs" ON public.users;
DROP POLICY IF EXISTS "Estimators can see masters and devs" ON public.users;
DROP POLICY IF EXISTS "Masters and devs can see all assistants" ON public.users;
DROP POLICY IF EXISTS "Masters and devs can see other masters" ON public.users;
DROP POLICY IF EXISTS "Owners can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can see all estimators" ON public.users;
DROP POLICY IF EXISTS "Users can see all primaries" ON public.users;
DROP POLICY IF EXISTS "Users can see all subcontractors" ON public.users;
DROP POLICY IF EXISTS "Users can see masters who adopted them" ON public.users;
DROP POLICY IF EXISTS "Users can see sharing masters who shared with them or their mas" ON public.users;
DROP POLICY IF EXISTS "Users can select own row" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;

-- Single consolidated policy: OR of all previous conditions
CREATE POLICY "Users can select users"
ON public.users
FOR SELECT
USING (
  id = auth.uid()
  OR public.is_dev()
  OR (role = 'master_technician' AND public.is_master_or_dev())
  OR (role = 'assistant')
  OR (role IN ('master_technician', 'dev') AND public.is_estimator())
  OR (role = 'estimator')
  OR (role = 'primary')
  OR (role = 'subcontractor')
  OR public.master_adopted_current_user(id)
  OR public.can_see_sharing_master(id)
);
