-- Add primary to cost_estimate_labor_rows RLS (Save and Add flow syncs labor rows)
-- Primaries need INSERT/UPDATE/DELETE when loadCostEstimateLaborRowsAndSync runs

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cost_estimate_labor_rows'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.cost_estimate_labor_rows', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Devs masters assistants estimators primaries can read cost estimate labor rows"
ON public.cost_estimate_labor_rows FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    JOIN public.bids b ON b.id = ce.bid_id
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);

CREATE POLICY "Devs masters assistants estimators primaries can insert cost estimate labor rows"
ON public.cost_estimate_labor_rows FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    JOIN public.bids b ON b.id = ce.bid_id
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);

CREATE POLICY "Devs masters assistants estimators primaries can update cost estimate labor rows"
ON public.cost_estimate_labor_rows FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    JOIN public.bids b ON b.id = ce.bid_id
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

CREATE POLICY "Devs masters assistants estimators primaries can delete cost estimate labor rows"
ON public.cost_estimate_labor_rows FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    JOIN public.bids b ON b.id = ce.bid_id
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);
