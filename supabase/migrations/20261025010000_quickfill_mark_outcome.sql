SET lock_timeout = '3s';

-- Quickfill: the Mark says what happened (punch list #176, change 1). Until now every press on a station wrote the
-- same row: when, who, how many were open. Eight weeks of those rows read as one press every nine seconds, so the
-- history could not tell a station worked from a station stamped, and a station nobody understood from one nobody
-- needed. A mark event now carries its outcome:
--   done     — the count was zero, every box was ticked, or every row was handled this visit
--   worked   — rows were left; the count says how many
--   question — the person did not know what to do; the press also files a Dispatch inbox request to the owner
-- Null is a mark from before this column, or a plain look on a station with no count. Additive and idempotent.

ALTER TABLE public.quickfill_section_mark_events
  ADD COLUMN IF NOT EXISTS outcome text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quickfill_section_mark_events_outcome_known'
  ) THEN
    ALTER TABLE public.quickfill_section_mark_events
      ADD CONSTRAINT quickfill_section_mark_events_outcome_known
      CHECK (outcome IS NULL OR outcome IN ('done', 'worked', 'question'));
  END IF;
END
$$;

COMMENT ON COLUMN public.quickfill_section_mark_events.outcome IS
  'Quickfill (punch list #176): what the press meant. done = nothing left; worked = rows left, outstanding_count says how many; question = not sure what to do, a Dispatch inbox request was filed. Null = a mark from before the column, or a look on a station with no count.';
