-- Add primary to bid_count_row_custom_prices RLS
-- Primaries need INSERT/UPDATE/DELETE for custom unit prices in Bids Pricing tab

-- Ensure can_access_bid_for_pricing includes primary (in case primaries migration not applied)
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
    OR user_role_val IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary')
  );
END;
$$;

-- Drop all existing policies on bid_count_row_custom_prices
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

-- Recreate with primary included
CREATE POLICY "Bid pricing users can read custom prices"
ON public.bid_count_row_custom_prices FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND public.can_access_bid_for_pricing(bid_id)
);

CREATE POLICY "Bid pricing users can insert custom prices"
ON public.bid_count_row_custom_prices FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND public.can_access_bid_for_pricing(bid_id)
);

CREATE POLICY "Bid pricing users can update custom prices"
ON public.bid_count_row_custom_prices FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND public.can_access_bid_for_pricing(bid_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

CREATE POLICY "Bid pricing users can delete custom prices"
ON public.bid_count_row_custom_prices FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND public.can_access_bid_for_pricing(bid_id)
);
