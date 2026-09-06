SET lock_timeout = '3s';

-- v2.2928: subs pick their start inside the window. The order keeps the span
-- the office offered (proposed_start/end, or the stage's window); the sub's
-- answer lands in picked_* — the dates dispatch and the GC read. work_days is
-- how long the office expects the stage to take, so a start pick implies its
-- end. Additive + idempotent.

ALTER TABLE public.step_commitments ADD COLUMN IF NOT EXISTS work_days integer;
ALTER TABLE public.step_commitments ADD COLUMN IF NOT EXISTS picked_start date;
ALTER TABLE public.step_commitments ADD COLUMN IF NOT EXISTS picked_end date;
ALTER TABLE public.step_commitments ADD COLUMN IF NOT EXISTS picked_at timestamptz;
ALTER TABLE public.step_commitments ADD COLUMN IF NOT EXISTS picked_by text;

ALTER TABLE public.step_commitments DROP CONSTRAINT IF EXISTS step_commitments_work_days_check;
ALTER TABLE public.step_commitments
  ADD CONSTRAINT step_commitments_work_days_check CHECK (work_days IS NULL OR (work_days >= 1 AND work_days <= 120));
ALTER TABLE public.step_commitments DROP CONSTRAINT IF EXISTS step_commitments_picked_by_check;
ALTER TABLE public.step_commitments
  ADD CONSTRAINT step_commitments_picked_by_check CHECK (picked_by IS NULL OR picked_by IN ('sub', 'office'));
ALTER TABLE public.step_commitments DROP CONSTRAINT IF EXISTS step_commitments_picked_span_check;
ALTER TABLE public.step_commitments
  ADD CONSTRAINT step_commitments_picked_span_check CHECK (picked_end IS NULL OR picked_start IS NULL OR picked_end >= picked_start);

COMMENT ON COLUMN public.step_commitments.work_days IS 'Working days the office expects the stage to take; a picked start implies the end.';
COMMENT ON COLUMN public.step_commitments.picked_start IS 'The sub''s (or the office''s) chosen start inside the offered window. The date dispatch reads.';
COMMENT ON COLUMN public.step_commitments.picked_by IS 'sub = picked on the portal · office = set on the Subs tab.';

CREATE INDEX IF NOT EXISTS step_commitments_picked_start_idx ON public.step_commitments (picked_start) WHERE picked_start IS NOT NULL;
