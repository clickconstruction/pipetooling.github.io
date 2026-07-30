SET lock_timeout = '3s';

-- Stripe mode integrity, step A4 (FRAGILITY_REMEDIATION_PLAN.md).
--
-- customers.stripe_customer_id is a single column shared across Stripe modes,
-- and create-stripe-invoice's stale-customer recovery CLEARED and REPLACED it
-- on a cross-mode miss — a dev test-mode invoice destroyed the customer's
-- live Stripe link (and vice versa). Give test mode its own column; existing
-- values are live (plan decision 1). create-stripe-invoice / preview read and
-- write the mode-appropriate column and never touch the other (v2.1117).

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS stripe_customer_id_test text;

COMMENT ON COLUMN public.customers.stripe_customer_id_test IS
  'TEST-mode Stripe customer id (cus_…). Live id lives in stripe_customer_id. Written only by create-stripe-invoice when operating in test mode (A4).';

COMMENT ON COLUMN public.customers.stripe_customer_id IS
  'LIVE-mode Stripe customer id (cus_…). Test-mode id lives in stripe_customer_id_test since A4 (v2.1117); pre-A4 this column was shared across modes and could be swapped by cross-mode creates.';

-- Additive + idempotent; no CREATE TABLE so read-only sweep calls are not
-- required; existing customers RLS covers the new column.
