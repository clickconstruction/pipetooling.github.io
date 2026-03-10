-- Add primary to bids_count_rows RLS (Save and Add in Counts)
-- Primaries need INSERT/UPDATE/DELETE for count rows on bids they can access

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bids_count_rows'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.bids_count_rows', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Devs masters assistants estimators primaries can read bids count rows"
ON public.bids_count_rows FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_count_rows.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);

CREATE POLICY "Devs masters assistants estimators primaries can insert bids count rows"
ON public.bids_count_rows FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_count_rows.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);

CREATE POLICY "Devs masters assistants estimators primaries can update bids count rows"
ON public.bids_count_rows FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_count_rows.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

CREATE POLICY "Devs masters assistants estimators primaries can delete bids count rows"
ON public.bids_count_rows FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_count_rows.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);

COMMENT ON TABLE public.bids_count_rows IS 'Fixture and count rows per bid (Counts tab). RLS: dev, master, assistant, estimator, primary.';
