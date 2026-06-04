-- Fix cost_estimates and cost_estimate_labor_rows RLS: use can_access_bid_for_pricing helper
-- Instead of inline subqueries (subject to bids/users RLS), use SECURITY DEFINER helper
-- Fixes: "Failed to create cost estimate: new row violates row-level security policy" for assistants

-- ============================================================================
-- cost_estimates: replace inline bid subquery with can_access_bid_for_pricing
-- ============================================================================
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries superintendents can read cost estimates" ON public.cost_estimates;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can read cost estimates"
ON public.cost_estimates FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND public.can_access_bid_for_pricing(cost_estimates.bid_id)
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries superintendents can insert cost estimates" ON public.cost_estimates;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can insert cost estimates"
ON public.cost_estimates FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND public.can_access_bid_for_pricing(cost_estimates.bid_id)
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries superintendents can update cost estimates" ON public.cost_estimates;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can update cost estimates"
ON public.cost_estimates FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND public.can_access_bid_for_pricing(cost_estimates.bid_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries superintendents can delete cost estimates" ON public.cost_estimates;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can delete cost estimates"
ON public.cost_estimates FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND public.can_access_bid_for_pricing(cost_estimates.bid_id)
);

-- ============================================================================
-- cost_estimate_labor_rows: replace inline subquery with can_access_bid_for_pricing
-- ============================================================================
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries superintendents can read cost estimate labor rows" ON public.cost_estimate_labor_rows;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can read cost estimate labor rows"
ON public.cost_estimate_labor_rows FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND public.can_access_bid_for_pricing(ce.bid_id)
  )
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries superintendents can insert cost estimate labor rows" ON public.cost_estimate_labor_rows;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can insert cost estimate labor rows"
ON public.cost_estimate_labor_rows FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND public.can_access_bid_for_pricing(ce.bid_id)
  )
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries superintendents can update cost estimate labor rows" ON public.cost_estimate_labor_rows;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can update cost estimate labor rows"
ON public.cost_estimate_labor_rows FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND public.can_access_bid_for_pricing(ce.bid_id)
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries superintendents can delete cost estimate labor rows" ON public.cost_estimate_labor_rows;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can delete cost estimate labor rows"
ON public.cost_estimate_labor_rows FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND public.can_access_bid_for_pricing(ce.bid_id)
  )
);
