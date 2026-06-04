-- Optimize RLS for bid_pricing_assignments and bid_count_row_custom_prices
-- Addresses: 57014 canceling statement due to statement timeout
--
-- Strategy: Use SECURITY DEFINER helper to reduce per-row correlated subqueries

-- Helper: can current user access a bid for pricing (owner, dev, assistant, estimator)?
CREATE OR REPLACE FUNCTION public.can_access_bid_for_pricing(bid_id_param UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  bid_created_by UUID;
  user_role_val TEXT;
BEGIN
  SELECT b.created_by, u.role
  INTO bid_created_by, user_role_val
  FROM public.bids b
  LEFT JOIN public.users u ON u.id = auth.uid()
  WHERE b.id = bid_id_param;

  IF bid_created_by IS NULL THEN
    RETURN false;
  END IF;

  RETURN (
    bid_created_by = auth.uid()
    OR public.is_dev()
    OR user_role_val IN ('dev', 'assistant', 'estimator')
  );
END;
$$;

COMMENT ON FUNCTION public.can_access_bid_for_pricing(UUID) IS 'Checks if the current user can access a bid for pricing (owner, dev, assistant, estimator). Uses SECURITY DEFINER to optimize RLS.';

-- ---------------------------------------------------------------------------
-- bid_pricing_assignments: drop existing policies and recreate with helper
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bid_pricing_assignments'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.bid_pricing_assignments', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.bid_pricing_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs, masters, assistants, and estimators can read bid pricing assignments"
ON public.bid_pricing_assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND public.can_access_bid_for_pricing(bid_id)
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert bid pricing assignments"
ON public.bid_pricing_assignments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND public.can_access_bid_for_pricing(bid_id)
);

CREATE POLICY "Devs, masters, assistants, and estimators can update bid pricing assignments"
ON public.bid_pricing_assignments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND public.can_access_bid_for_pricing(bid_id)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete bid pricing assignments"
ON public.bid_pricing_assignments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND public.can_access_bid_for_pricing(bid_id)
);

-- ---------------------------------------------------------------------------
-- bid_count_row_custom_prices: drop existing policies and recreate with helper
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bid_count_row_custom_prices'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.bid_count_row_custom_prices', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.bid_count_row_custom_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bid pricing users can read custom prices"
ON public.bid_count_row_custom_prices
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND public.can_access_bid_for_pricing(bid_id)
);

CREATE POLICY "Bid pricing users can insert custom prices"
ON public.bid_count_row_custom_prices
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND public.can_access_bid_for_pricing(bid_id)
);

CREATE POLICY "Bid pricing users can update custom prices"
ON public.bid_count_row_custom_prices
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND public.can_access_bid_for_pricing(bid_id)
);

CREATE POLICY "Bid pricing users can delete custom prices"
ON public.bid_count_row_custom_prices
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND public.can_access_bid_for_pricing(bid_id)
);
