-- Estimators: allow UPDATE on customers for basic fields; block owner and Stripe changes via trigger.

CREATE OR REPLACE FUNCTION public.enforce_customers_estimator_update_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'estimator'
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.master_user_id IS DISTINCT FROM OLD.master_user_id THEN
    RAISE EXCEPTION 'Estimators cannot change customer owner (master).';
  END IF;

  IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN
    RAISE EXCEPTION 'Estimators cannot change Stripe customer link.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_customers_estimator_update_immutable_fields() IS
  'Before UPDATE on customers: if caller is estimator, forbid changing master_user_id or stripe_customer_id.';

DROP TRIGGER IF EXISTS customers_estimator_update_immutable_fields ON public.customers;
CREATE TRIGGER customers_estimator_update_immutable_fields
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_customers_estimator_update_immutable_fields();

CREATE POLICY "Estimators can update customers"
ON public.customers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'estimator'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'estimator'
  )
);

COMMENT ON POLICY "Estimators can update customers" ON public.customers IS
  'Estimators may edit customer rows; trigger blocks changing master_user_id and stripe_customer_id.';
