-- Optional free-text note per mark (e.g. Quickfill Email inbox list).

ALTER TABLE public.quickfill_section_mark_events
  ADD COLUMN IF NOT EXISTS note_text TEXT NULL;

COMMENT ON COLUMN public.quickfill_section_mark_events.note_text IS 'Optional note at mark time (e.g. self-reported inbox items for Quickfill Email section).';
