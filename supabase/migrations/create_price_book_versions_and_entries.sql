-- Pricing tab: named price book versions and fixture/tie-in entries per stage (rough in, top out, trim set, total)

-- ============================================================================
-- price_book_versions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.price_book_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_book_versions_name ON public.price_book_versions(name);

ALTER TABLE public.price_book_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs, masters, assistants, and estimators can read price book versions"
ON public.price_book_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert price book versions"
ON public.price_book_versions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update price book versions"
ON public.price_book_versions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete price book versions"
ON public.price_book_versions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

COMMENT ON TABLE public.price_book_versions IS 'Named price book versions for Bids Pricing tab.';

-- ============================================================================
-- price_book_entries
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.price_book_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.price_book_versions(id) ON DELETE CASCADE,
  fixture_name TEXT NOT NULL,
  rough_in_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  top_out_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  trim_set_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(version_id, fixture_name)
);

CREATE INDEX IF NOT EXISTS idx_price_book_entries_version_id ON public.price_book_entries(version_id);
CREATE INDEX IF NOT EXISTS idx_price_book_entries_fixture_name ON public.price_book_entries(fixture_name);

ALTER TABLE public.price_book_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs, masters, assistants, and estimators can read price book entries"
ON public.price_book_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert price book entries"
ON public.price_book_entries
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update price book entries"
ON public.price_book_entries
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete price book entries"
ON public.price_book_entries
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

COMMENT ON TABLE public.price_book_entries IS 'Fixture/tie-in prices per stage (rough in, top out, trim set, total) per price book version.';
