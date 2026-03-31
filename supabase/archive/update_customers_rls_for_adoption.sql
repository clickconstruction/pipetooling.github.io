-- Update customers RLS policies to allow assistants to access customers
-- from masters who have adopted them

-- Drop existing SELECT policy (if it exists with a specific name)
-- We'll recreate it with the new logic
DROP POLICY IF EXISTS "Users can see their own customers or customers from masters who adopted them" ON public.customers;

-- New SELECT policy: Users can see customers they own OR customers from masters who adopted them
CREATE POLICY "Users can see their own customers or customers from masters who adopted them"
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
);

-- Note: INSERT, UPDATE, DELETE policies remain unchanged
-- Only masters can create customers (existing behavior)
-- Only masters can update/delete their own customers (existing behavior)
