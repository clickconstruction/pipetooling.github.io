-- Fix: bid_pricing_assignments RLS policies exclude primary (causing insert failures).
-- The 20260410130000 migration intended to add primary but policies were not updated.
-- This migration ensures primary is included in all four policies.

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read bid pricing assignments" ON public.bid_pricing_assignments;
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can read bid pricing assignments" ON public.bid_pricing_assignments;
CREATE POLICY "Devs masters assistants estimators primaries can read bid pricing assignments"
ON public.bid_pricing_assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND public.can_access_bid_for_pricing(bid_id)
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert bid pricing assignments" ON public.bid_pricing_assignments;
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can insert bid pricing assignments" ON public.bid_pricing_assignments;
CREATE POLICY "Devs masters assistants estimators primaries can insert bid pricing assignments"
ON public.bid_pricing_assignments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND public.can_access_bid_for_pricing(bid_id)
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update bid pricing assignments" ON public.bid_pricing_assignments;
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can update bid pricing assignments" ON public.bid_pricing_assignments;
CREATE POLICY "Devs masters assistants estimators primaries can update bid pricing assignments"
ON public.bid_pricing_assignments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND public.can_access_bid_for_pricing(bid_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete bid pricing assignments" ON public.bid_pricing_assignments;
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can delete bid pricing assignments" ON public.bid_pricing_assignments;
CREATE POLICY "Devs masters assistants estimators primaries can delete bid pricing assignments"
ON public.bid_pricing_assignments FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND public.can_access_bid_for_pricing(bid_id)
);
