-- Add primary to cost_estimates RLS (Save and Add flow creates cost estimate)
-- Primaries need INSERT on cost_estimates when adding count rows

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cost_estimates'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.cost_estimates', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Devs masters assistants estimators primaries can read cost estimates"
ON public.cost_estimates FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = cost_estimates.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);

CREATE POLICY "Devs masters assistants estimators primaries can insert cost estimates"
ON public.cost_estimates FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = cost_estimates.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);

CREATE POLICY "Devs masters assistants estimators primaries can update cost estimates"
ON public.cost_estimates FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = cost_estimates.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

CREATE POLICY "Devs masters assistants estimators primaries can delete cost estimates"
ON public.cost_estimates FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = cost_estimates.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);

COMMENT ON TABLE public.cost_estimates IS 'Cost estimates for bids; accessible to dev, master, assistant, estimator, primary.';
