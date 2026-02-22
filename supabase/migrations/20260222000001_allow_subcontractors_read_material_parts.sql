-- Subcontractors: SELECT-only on material_parts and material_part_prices
-- For Job Tally part search; subs cannot modify the price book

-- material_parts: add subcontractor to read policy
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can read material parts" ON public.material_parts;

CREATE POLICY "Devs masters assistants estimators primaries subs can read material parts"
ON public.material_parts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'subcontractor'))
);

-- material_part_prices: add subcontractor to read policy (for part search display)
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can read material part prices" ON public.material_part_prices;

CREATE POLICY "Devs masters assistants estimators primaries subs can read material part prices"
ON public.material_part_prices FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'subcontractor'))
);
