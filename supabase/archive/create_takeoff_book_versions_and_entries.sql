-- Takeoffs tab: named takeoff book versions and fixture/template/stage entries.
-- Run before add_bids_selected_takeoff_book_version.sql.

-- ============================================================================
-- takeoff_book_versions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.takeoff_book_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_takeoff_book_versions_name ON public.takeoff_book_versions(name);

ALTER TABLE public.takeoff_book_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs, masters, assistants, and estimators can read takeoff book versions"
ON public.takeoff_book_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert takeoff book versions"
ON public.takeoff_book_versions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update takeoff book versions"
ON public.takeoff_book_versions
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

CREATE POLICY "Devs, masters, assistants, and estimators can delete takeoff book versions"
ON public.takeoff_book_versions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

COMMENT ON TABLE public.takeoff_book_versions IS 'Named takeoff book versions for Bids Takeoffs tab.';

-- ============================================================================
-- takeoff_book_entries
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.takeoff_book_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.takeoff_book_versions(id) ON DELETE CASCADE,
  fixture_name TEXT NOT NULL,
  template_id UUID NOT NULL REFERENCES public.material_templates(id) ON DELETE RESTRICT,
  stage TEXT NOT NULL CHECK (stage IN ('rough_in', 'top_out', 'trim_set')),
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(version_id, fixture_name, template_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_takeoff_book_entries_version_id ON public.takeoff_book_entries(version_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_book_entries_fixture_name ON public.takeoff_book_entries(fixture_name);
CREATE INDEX IF NOT EXISTS idx_takeoff_book_entries_template_id ON public.takeoff_book_entries(template_id);

ALTER TABLE public.takeoff_book_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs, masters, assistants, and estimators can read takeoff book entries"
ON public.takeoff_book_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert takeoff book entries"
ON public.takeoff_book_entries
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update takeoff book entries"
ON public.takeoff_book_entries
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

CREATE POLICY "Devs, masters, assistants, and estimators can delete takeoff book entries"
ON public.takeoff_book_entries
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

COMMENT ON TABLE public.takeoff_book_entries IS 'Fixture/template/stage mappings per takeoff book version for Apply matching Fixture Templates.';

-- Seed one version (no entries) when no versions exist
INSERT INTO public.takeoff_book_versions (name)
SELECT 'Default'
WHERE NOT EXISTS (SELECT 1 FROM public.takeoff_book_versions LIMIT 1);
