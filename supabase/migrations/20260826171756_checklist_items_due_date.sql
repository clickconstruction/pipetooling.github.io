SET lock_timeout = '3s';

-- Optional due date for one-off checklist tasks (Tier 2 of the start/due
-- design; Tier 1 was the Manage "Scheduled" section, v2.2346).
--
-- "Do on" (start_date) says when the task APPEARS; due_date says when it
-- starts being LATE. NULL keeps today's exact behavior — the whole feature
-- is the null-safe case, so no backfill. One-offs only in v1: the UI hides
-- the field for repeating tasks; no DB constraint on repeat_type so that
-- door stays open. Additive column on an existing table — row RLS already
-- covers it and old clients simply ignore it. Occurrences still materialize
-- on start_date; due_date is item metadata, never a second occurrence.
ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS due_date date;

COMMENT ON COLUMN public.checklist_items.due_date IS
  'Optional deadline for one-off tasks: on the list from start_date, late after due_date. NULL = no deadline (legacy behavior). Never moves occurrences.';

-- A deadline can't precede the start.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'checklist_items_due_after_start'
      AND conrelid = 'public.checklist_items'::regclass
  ) THEN
    ALTER TABLE public.checklist_items
      ADD CONSTRAINT checklist_items_due_after_start
      CHECK (due_date IS NULL OR due_date >= start_date);
  END IF;
END $$;
