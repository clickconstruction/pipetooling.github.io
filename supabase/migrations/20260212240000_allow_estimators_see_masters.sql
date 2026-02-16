-- Allow estimators to see master_technician and dev users.
-- Required for the customer creation flow: estimators must select a master
-- when adding a new customer (Add Customer modal from Bids, or CustomerForm).

CREATE OR REPLACE FUNCTION public.is_estimator()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'estimator'
  );
$$;

CREATE POLICY "Estimators can see masters and devs"
ON public.users
FOR SELECT
USING (
  role IN ('master_technician', 'dev')
  AND public.is_estimator()
);
