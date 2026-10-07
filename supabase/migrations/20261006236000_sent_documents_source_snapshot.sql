SET lock_timeout = '3s';

-- What the source record said when the copy went (v2.4714).
-- A pay application's workbook is kept as bytes, so when the saved application was changed
-- after it went out nothing could say what moved: the window could only compare timestamps,
-- and a Save that changed nothing would have been flagged. The sender now files the figures
-- the paper was drawn from beside the copy — for a pay application its lines and the G702's
-- totals — and the history names the difference. Any kind of paper may fill it; most leave
-- it null. The row stays append-only: the snapshot is written with the row and never changed.
ALTER TABLE public.sent_documents
  ADD COLUMN IF NOT EXISTS source_snapshot jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sent_documents_source_snapshot_object') THEN
    ALTER TABLE public.sent_documents
      ADD CONSTRAINT sent_documents_source_snapshot_object CHECK (source_snapshot IS NULL OR jsonb_typeof(source_snapshot) = 'object');
  END IF;
END $$;

COMMENT ON COLUMN public.sent_documents.source_snapshot IS
  'The source record''s figures as they were when this copy went (v2.4714), or null. A pay application files its lines and the G702 totals, so a later change to the saved application can be named against what the GC was given.';
