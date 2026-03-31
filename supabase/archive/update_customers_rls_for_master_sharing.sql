-- Update customers RLS policies to allow masters to access customers
-- from masters who have shared with them (via master_shares)

-- Drop existing SELECT policy (if it exists with a specific name)
DROP POLICY IF EXISTS "Users can see their own customers or customers from masters who adopted them" ON public.customers;

-- New SELECT policy: Users can see customers they own OR customers from masters who adopted them OR masters who shared with them
CREATE POLICY "Users can see their own customers or customers from masters who adopted them or shared with them"
ON public.customers
FOR SELECT
USING (
  -- User owns the customer
  master_user_id = auth.uid()
  -- OR user is a master/dev (can see all)
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
  -- OR a master who owns the customer has adopted this assistant
  OR EXISTS (
    SELECT 1 FROM public.master_assistants
    WHERE master_id = master_user_id
    AND assistant_id = auth.uid()
  )
  -- OR a master who owns the customer has shared with this master
  OR EXISTS (
    SELECT 1 FROM public.master_shares
    WHERE sharing_master_id = master_user_id
    AND viewing_master_id = auth.uid()
  )
);

-- Note: INSERT, UPDATE, DELETE policies remain unchanged
-- Only masters can create customers (existing behavior)
-- Only masters can update/delete their own customers (existing behavior)
