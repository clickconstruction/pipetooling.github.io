-- Add primary to fixture_types RLS (INSERT, UPDATE, DELETE)
-- Primaries need to create new fixture types when adding items to price book, labor book, etc.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fixture_types'
      AND policyname NOT IN ('All authenticated users can read fixture types')
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.fixture_types', r.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert fixture types" ON public.fixture_types;
CREATE POLICY "Devs masters assistants estimators primaries can insert fixture types"
ON public.fixture_types FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update fixture types" ON public.fixture_types;
CREATE POLICY "Devs masters assistants estimators primaries can update fixture types"
ON public.fixture_types FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete fixture types" ON public.fixture_types;
CREATE POLICY "Devs masters assistants estimators primaries can delete fixture types"
ON public.fixture_types FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);
