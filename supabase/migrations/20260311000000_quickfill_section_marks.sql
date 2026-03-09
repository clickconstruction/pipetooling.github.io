-- Quickfill section marks: track when each section was last marked "up to date"
-- Devs, masters, assistants can SELECT and UPSERT

CREATE TABLE IF NOT EXISTS public.quickfill_section_marks (
  section_id TEXT NOT NULL PRIMARY KEY,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  marked_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);
COMMENT ON TABLE public.quickfill_section_marks IS 'Tracks when each Quickfill section was last marked up to date. Used for feedback loop (green/yellow/red nav buttons, section collapse).';
ALTER TABLE public.quickfill_section_marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Devs masters assistants can select quickfill section marks"
ON public.quickfill_section_marks
FOR SELECT
USING (public.is_dev_or_master_or_assistant());
CREATE POLICY "Devs masters assistants can insert quickfill section marks"
ON public.quickfill_section_marks
FOR INSERT
WITH CHECK (public.is_dev_or_master_or_assistant());
CREATE POLICY "Devs masters assistants can update quickfill section marks"
ON public.quickfill_section_marks
FOR UPDATE
USING (public.is_dev_or_master_or_assistant())
WITH CHECK (public.is_dev_or_master_or_assistant());
