-- Recreate cost_estimate_labor_rows policies with short names (avoid truncation collisions)
-- Same fix as cost_estimates: drop all and recreate with short names.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cost_estimate_labor_rows'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.cost_estimate_labor_rows', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "celr_select"
ON public.cost_estimate_labor_rows FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND public.can_access_bid_for_pricing(ce.bid_id)
  )
);

CREATE POLICY "celr_insert"
ON public.cost_estimate_labor_rows FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND public.can_access_bid_for_pricing(ce.bid_id)
  )
);

CREATE POLICY "celr_update"
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

CREATE POLICY "celr_delete"
ON public.cost_estimate_labor_rows FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND public.can_access_bid_for_pricing(ce.bid_id)
  )
);
