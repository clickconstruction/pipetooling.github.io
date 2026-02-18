-- Allow all authenticated users to see estimator users
-- This enables assistants to see estimators in the Bids estimator dropdown

-- Drop policy if it exists (for idempotency)
DROP POLICY IF EXISTS "Users can see all estimators" ON public.users;

-- Add policy to allow authenticated users to see estimator records
CREATE POLICY "Users can see all estimators"
ON public.users
FOR SELECT
USING (
  role = 'estimator'
);

-- Add comment
COMMENT ON POLICY "Users can see all estimators" ON public.users IS 'Allows all authenticated users to see estimator user records. This enables assistants and masters to assign estimators to bids.';
