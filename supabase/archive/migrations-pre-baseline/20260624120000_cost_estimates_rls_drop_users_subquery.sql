-- cost_estimates RLS: drop redundant users subquery
-- The policy used EXISTS (SELECT 1 FROM users WHERE ...) which runs as invoker
-- and can fail due to users RLS. can_access_bid_for_pricing is SECURITY DEFINER
-- and already validates role internally. Use only the helper.

-- ============================================================================
-- cost_estimates: use only can_access_bid_for_pricing (no users subquery)
-- ============================================================================
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries superintendents can read cost estimates" ON public.cost_estimates;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can read cost estimates"
ON public.cost_estimates FOR SELECT USING (
  public.can_access_bid_for_pricing(cost_estimates.bid_id)
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries superintendents can insert cost estimates" ON public.cost_estimates;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can insert cost estimates"
ON public.cost_estimates FOR INSERT WITH CHECK (
  public.can_access_bid_for_pricing(cost_estimates.bid_id)
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries superintendents can update cost estimates" ON public.cost_estimates;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can update cost estimates"
ON public.cost_estimates FOR UPDATE USING (
  public.can_access_bid_for_pricing(cost_estimates.bid_id)
) WITH CHECK (
  public.can_access_bid_for_pricing(cost_estimates.bid_id)
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries superintendents can delete cost estimates" ON public.cost_estimates;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can delete cost estimates"
ON public.cost_estimates FOR DELETE USING (
  public.can_access_bid_for_pricing(cost_estimates.bid_id)
);

-- ============================================================================
-- cost_estimate_labor_rows: same simplification (no users subquery)
-- ============================================================================
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries superintendents can read cost estimate labor rows" ON public.cost_estimate_labor_rows;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can read cost estimate labor rows"
ON public.cost_estimate_labor_rows FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND public.can_access_bid_for_pricing(ce.bid_id)
  )
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries superintendents can insert cost estimate labor rows" ON public.cost_estimate_labor_rows;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can insert cost estimate labor rows"
ON public.cost_estimate_labor_rows FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND public.can_access_bid_for_pricing(ce.bid_id)
  )
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries superintendents can update cost estimate labor rows" ON public.cost_estimate_labor_rows;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can update cost estimate labor rows"
ON public.cost_estimate_labor_rows FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND public.can_access_bid_for_pricing(ce.bid_id)
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND public.can_access_bid_for_pricing(ce.bid_id)
  )
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries superintendents can delete cost estimate labor rows" ON public.cost_estimate_labor_rows;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can delete cost estimate labor rows"
ON public.cost_estimate_labor_rows FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND public.can_access_bid_for_pricing(ce.bid_id)
  )
);
