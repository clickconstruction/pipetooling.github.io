-- Allow estimators to SELECT all customers (for Bids GC/Builder dropdown)
-- and to INSERT customers when a master is assigned (Add Customer modal from Bids).

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can see their own customers or customers from masters who adopted them or shared with them" ON public.customers;

-- New SELECT policy: existing conditions + estimators can see all customers
CREATE POLICY "Users can see their own customers or customers from masters who adopted them or shared with them"
ON public.customers
FOR SELECT
USING (
  master_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician')
  )
  OR EXISTS (
    SELECT 1 FROM public.master_assistants
    WHERE master_id = master_user_id
    AND assistant_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.master_shares
    WHERE sharing_master_id = master_user_id
    AND viewing_master_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'estimator'
  )
);

-- Estimators can INSERT customers only when master_user_id is set to a valid master
CREATE POLICY "Estimators can insert customers when master is assigned"
ON public.customers
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'estimator'
  )
  AND master_user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = master_user_id
    AND u.role IN ('master_technician', 'dev')
  )
);
