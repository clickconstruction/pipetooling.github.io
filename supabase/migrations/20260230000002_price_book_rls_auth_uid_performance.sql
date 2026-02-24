-- Fix RLS performance: wrap auth.uid() in (select auth.uid()) so it's evaluated once per statement
-- instead of per row. See: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv

-- price_book_versions
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read price book versions" ON public.price_book_versions;
CREATE POLICY "Devs, masters, assistants, and estimators can read price book versions"
ON public.price_book_versions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (select auth.uid())
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert price book versions" ON public.price_book_versions;
CREATE POLICY "Devs, masters, assistants, and estimators can insert price book versions"
ON public.price_book_versions FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (select auth.uid())
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update price book versions" ON public.price_book_versions;
CREATE POLICY "Devs, masters, assistants, and estimators can update price book versions"
ON public.price_book_versions FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (select auth.uid())
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (select auth.uid())
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete price book versions" ON public.price_book_versions;
CREATE POLICY "Devs, masters, assistants, and estimators can delete price book versions"
ON public.price_book_versions FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (select auth.uid())
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

-- price_book_entries (same pattern for consistency)
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read price book entries" ON public.price_book_entries;
CREATE POLICY "Devs, masters, assistants, and estimators can read price book entries"
ON public.price_book_entries FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (select auth.uid())
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert price book entries" ON public.price_book_entries;
CREATE POLICY "Devs, masters, assistants, and estimators can insert price book entries"
ON public.price_book_entries FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (select auth.uid())
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update price book entries" ON public.price_book_entries;
CREATE POLICY "Devs, masters, assistants, and estimators can update price book entries"
ON public.price_book_entries FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (select auth.uid())
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (select auth.uid())
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete price book entries" ON public.price_book_entries;
CREATE POLICY "Devs, masters, assistants, and estimators can delete price book entries"
ON public.price_book_entries FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (select auth.uid())
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);
