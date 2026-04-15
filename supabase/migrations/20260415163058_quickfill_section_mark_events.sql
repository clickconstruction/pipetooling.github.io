-- Append-only log of each Quickfill "Mark up to date" action (history modal + snapshot counts).

CREATE TABLE IF NOT EXISTS public.quickfill_section_mark_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id TEXT NOT NULL,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  marked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  outstanding_count INTEGER NULL
);

COMMENT ON TABLE public.quickfill_section_mark_events IS 'Historical log when a Quickfill section was marked up to date; optional outstanding_count snapshot at click time.';

CREATE INDEX IF NOT EXISTS quickfill_section_mark_events_section_marked_at_desc_idx
  ON public.quickfill_section_mark_events (section_id, marked_at DESC);

ALTER TABLE public.quickfill_section_mark_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs masters assistants can select quickfill section mark events"
ON public.quickfill_section_mark_events
FOR SELECT
USING (public.is_dev_or_master_or_assistant());

CREATE POLICY "Devs masters assistants can insert quickfill section mark events"
ON public.quickfill_section_mark_events
FOR INSERT
WITH CHECK (public.is_dev_or_master_or_assistant());

-- Seed history from current marks so "all time" is not empty.
INSERT INTO public.quickfill_section_mark_events (section_id, marked_at, marked_by, outstanding_count)
SELECT section_id, marked_at, marked_by, NULL::integer
FROM public.quickfill_section_marks;
