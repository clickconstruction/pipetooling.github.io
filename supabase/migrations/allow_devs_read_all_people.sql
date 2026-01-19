-- Allow devs to read all people entries
-- This adds a policy so devs can see all people, not just their own

-- Check if a policy already exists for devs reading all people
-- If it does, drop it first
DROP POLICY IF EXISTS "Devs can read all people" ON public.people;

-- Create policy allowing devs to read all people entries
CREATE POLICY "Devs can read all people"
ON public.people
FOR SELECT
USING (public.is_dev());

-- Note: This policy is additive - it works alongside existing policies
-- Users can still see their own people entries via existing policies
-- Devs can see all people entries via this new policy
