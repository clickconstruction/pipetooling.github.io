-- Add DELETE policy for customers
-- Masters can delete their own customers, devs can delete any customer

DROP POLICY IF EXISTS "Masters can delete their own customers, devs can delete any" ON public.customers;

CREATE POLICY "Masters can delete their own customers, devs can delete any"
ON public.customers
FOR DELETE
USING (
  -- Master owns the customer
  master_user_id = auth.uid()
  -- OR user is a dev (can delete any customer)
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'dev'
  )
);
