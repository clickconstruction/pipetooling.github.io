-- Cost Estimate tab: named labor book versions and fixture/tie-in entries (hours per Rough In, Top Out, Trim Set).
-- Run before add_bids_selected_labor_book_version.sql.

-- ============================================================================
-- labor_book_versions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.labor_book_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_labor_book_versions_name ON public.labor_book_versions(name);

ALTER TABLE public.labor_book_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs, masters, assistants, and estimators can read labor book versions"
ON public.labor_book_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert labor book versions"
ON public.labor_book_versions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update labor book versions"
ON public.labor_book_versions
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

CREATE POLICY "Devs, masters, assistants, and estimators can delete labor book versions"
ON public.labor_book_versions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

COMMENT ON TABLE public.labor_book_versions IS 'Named labor book versions for Bids Cost Estimate tab.';

-- ============================================================================
-- labor_book_entries
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.labor_book_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.labor_book_versions(id) ON DELETE CASCADE,
  fixture_name TEXT NOT NULL,
  rough_in_hrs NUMERIC(8, 2) NOT NULL DEFAULT 0,
  top_out_hrs NUMERIC(8, 2) NOT NULL DEFAULT 0,
  trim_set_hrs NUMERIC(8, 2) NOT NULL DEFAULT 0,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(version_id, fixture_name)
);

CREATE INDEX IF NOT EXISTS idx_labor_book_entries_version_id ON public.labor_book_entries(version_id);
CREATE INDEX IF NOT EXISTS idx_labor_book_entries_fixture_name ON public.labor_book_entries(fixture_name);

ALTER TABLE public.labor_book_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs, masters, assistants, and estimators can read labor book entries"
ON public.labor_book_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert labor book entries"
ON public.labor_book_entries
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update labor book entries"
ON public.labor_book_entries
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

CREATE POLICY "Devs, masters, assistants, and estimators can delete labor book entries"
ON public.labor_book_entries
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

COMMENT ON TABLE public.labor_book_entries IS 'Fixture/tie-in hours per stage (rough in, top out, trim set) per labor book version.';

-- Seed one version and a few entries for dev (only when no versions exist)
INSERT INTO public.labor_book_versions (name)
SELECT 'Default'
WHERE NOT EXISTS (SELECT 1 FROM public.labor_book_versions LIMIT 1);

INSERT INTO public.labor_book_entries (version_id, fixture_name, rough_in_hrs, top_out_hrs, trim_set_hrs, sequence_order)
SELECT v.id, e.fixture_name, e.rough_in_hrs, e.top_out_hrs, e.trim_set_hrs, e.sequence_order
FROM public.labor_book_versions v
CROSS JOIN (VALUES
  ('Toilet', 1::numeric, 1::numeric, 1::numeric, 1),
  ('Sink', 0.5, 0.5, 0.5, 2),
  ('Shower', 1.5, 1, 1, 3),
  ('Bathtub', 1.5, 1, 1, 4),
  ('Lavatory', 0.5, 0.5, 0.5, 5)
) AS e(fixture_name, rough_in_hrs, top_out_hrs, trim_set_hrs, sequence_order)
WHERE v.name = 'Default'
ON CONFLICT (version_id, fixture_name) DO NOTHING;
