-- Fix cost_estimate_labor_rows RLS: use SECURITY DEFINER helper to avoid recursion
CREATE OR REPLACE FUNCTION public.is_bid_pricing_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  );
$$;

COMMENT ON FUNCTION public.is_bid_pricing_user() IS 'Checks if current user can access Bids/Pricing (dev, master, assistant, estimator). Uses SECURITY DEFINER to bypass RLS and avoid recursion.';

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read cost estimate labor rows" ON public.cost_estimate_labor_rows;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert cost estimate labor rows" ON public.cost_estimate_labor_rows;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update cost estimate labor rows" ON public.cost_estimate_labor_rows;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete cost estimate labor rows" ON public.cost_estimate_labor_rows;

CREATE POLICY "Devs, masters, assistants, and estimators can read cost estimate labor rows"
ON public.cost_estimate_labor_rows
FOR SELECT
USING (public.is_bid_pricing_user());

CREATE POLICY "Devs, masters, assistants, and estimators can insert cost estimate labor rows"
ON public.cost_estimate_labor_rows
FOR INSERT
WITH CHECK (public.is_bid_pricing_user());

CREATE POLICY "Devs, masters, assistants, and estimators can update cost estimate labor rows"
ON public.cost_estimate_labor_rows
FOR UPDATE
USING (public.is_bid_pricing_user())
WITH CHECK (public.is_bid_pricing_user());

CREATE POLICY "Devs, masters, assistants, and estimators can delete cost estimate labor rows"
ON public.cost_estimate_labor_rows
FOR DELETE
USING (public.is_bid_pricing_user());;
