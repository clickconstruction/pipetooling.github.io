-- Add primary to price_book_versions and price_book_entries RLS
-- Primaries need SELECT on price books for the Bids Pricing tab

-- price_book_versions
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read price book versions" ON public.price_book_versions;
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can read price book versions" ON public.price_book_versions;
CREATE POLICY "Devs masters assistants estimators primaries can read price book versions"
ON public.price_book_versions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = (select auth.uid()) AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert price book versions" ON public.price_book_versions;
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can insert price book versions" ON public.price_book_versions;
CREATE POLICY "Devs masters assistants estimators primaries can insert price book versions"
ON public.price_book_versions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = (select auth.uid()) AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update price book versions" ON public.price_book_versions;
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can update price book versions" ON public.price_book_versions;
CREATE POLICY "Devs masters assistants estimators primaries can update price book versions"
ON public.price_book_versions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = (select auth.uid()) AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = (select auth.uid()) AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete price book versions" ON public.price_book_versions;
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can delete price book versions" ON public.price_book_versions;
CREATE POLICY "Devs masters assistants estimators primaries can delete price book versions"
ON public.price_book_versions FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = (select auth.uid()) AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

-- price_book_entries
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read price book entries" ON public.price_book_entries;
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can read price book entries" ON public.price_book_entries;
CREATE POLICY "Devs masters assistants estimators primaries can read price book entries"
ON public.price_book_entries FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = (select auth.uid()) AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert price book entries" ON public.price_book_entries;
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can insert price book entries" ON public.price_book_entries;
CREATE POLICY "Devs masters assistants estimators primaries can insert price book entries"
ON public.price_book_entries FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = (select auth.uid()) AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update price book entries" ON public.price_book_entries;
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can update price book entries" ON public.price_book_entries;
CREATE POLICY "Devs masters assistants estimators primaries can update price book entries"
ON public.price_book_entries FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = (select auth.uid()) AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = (select auth.uid()) AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete price book entries" ON public.price_book_entries;
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can delete price book entries" ON public.price_book_entries;
CREATE POLICY "Devs masters assistants estimators primaries can delete price book entries"
ON public.price_book_entries FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = (select auth.uid()) AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);
