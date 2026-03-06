-- Inspection types: editable lookup table for inspection_type (replaces hardcoded CHECK)
-- Access: dev, master_technician, assistant, primary (same as Inspections tab)

-- ============================================================================
-- Helper: can_manage_inspection_types (avoids RLS recursion)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_manage_inspection_types()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary')
  );
$$;

-- ============================================================================
-- inspection_types table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inspection_types (
  name TEXT PRIMARY KEY,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspection_types_sequence ON public.inspection_types(sequence_order);

ALTER TABLE public.inspection_types ENABLE ROW LEVEL SECURITY;

-- Trigger: update updated_at
CREATE TRIGGER set_inspection_types_updated_at
  BEFORE UPDATE ON public.inspection_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- SELECT: all authenticated
CREATE POLICY "All authenticated can read inspection types"
ON public.inspection_types
FOR SELECT
USING (auth.role() = 'authenticated');

-- INSERT/UPDATE/DELETE: dev, master, assistant, primary
CREATE POLICY "Inspections tab users can manage inspection types"
ON public.inspection_types
FOR ALL
USING (public.can_manage_inspection_types())
WITH CHECK (public.can_manage_inspection_types());

-- ============================================================================
-- Seed inspection types (8 current values)
-- ============================================================================

INSERT INTO public.inspection_types (name, sequence_order) VALUES
  ('Plumbing Rough-In', 0),
  ('Plumbing Pre Pour', 1),
  ('Gas Rough-In', 2),
  ('Gas Final', 3),
  ('Plumbing Top Out', 4),
  ('Shower Pan', 5),
  ('Sewer & Water Service (water line)', 6),
  ('Plumbing Final', 7)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Alter inspections: drop CHECK, add FK
-- ============================================================================

ALTER TABLE public.inspections DROP CONSTRAINT IF EXISTS inspections_type_check;

ALTER TABLE public.inspections
  ADD CONSTRAINT inspections_type_fk
  FOREIGN KEY (inspection_type)
  REFERENCES public.inspection_types(name)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

COMMENT ON TABLE public.inspection_types IS 'Editable lookup for inspection types. Managed by anyone who can see Jobs Inspections tab.';
