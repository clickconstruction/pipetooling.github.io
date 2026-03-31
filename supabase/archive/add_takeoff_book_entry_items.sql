-- Multiple (template, stage) pairs per takeoff book entry.
-- One entry = one fixture + aliases; items table holds the template/stage pairs.

-- ============================================================================
-- takeoff_book_entry_items
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.takeoff_book_entry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.takeoff_book_entries(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.material_templates(id) ON DELETE RESTRICT,
  stage TEXT NOT NULL CHECK (stage IN ('rough_in', 'top_out', 'trim_set')),
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_takeoff_book_entry_items_entry_id ON public.takeoff_book_entry_items(entry_id);

ALTER TABLE public.takeoff_book_entry_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs, masters, assistants, and estimators can read takeoff book entry items"
ON public.takeoff_book_entry_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert takeoff book entry items"
ON public.takeoff_book_entry_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update takeoff book entry items"
ON public.takeoff_book_entry_items
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

CREATE POLICY "Devs, masters, assistants, and estimators can delete takeoff book entry items"
ON public.takeoff_book_entry_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

COMMENT ON TABLE public.takeoff_book_entry_items IS 'Template/stage pairs per takeoff book entry; one entry can have multiple.';

-- Migrate existing data: one item per current entry
INSERT INTO public.takeoff_book_entry_items (entry_id, template_id, stage, sequence_order)
SELECT id, template_id, stage, 0
FROM public.takeoff_book_entries;

-- Drop unique constraint that includes template_id and stage (so we can drop columns)
ALTER TABLE public.takeoff_book_entries
  DROP CONSTRAINT IF EXISTS takeoff_book_entries_version_id_fixture_name_template_id_stage_key;

-- Drop columns from entries; items table now holds template/stage
ALTER TABLE public.takeoff_book_entries
  DROP COLUMN IF EXISTS template_id,
  DROP COLUMN IF EXISTS stage;
