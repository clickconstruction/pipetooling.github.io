SET lock_timeout = '3s';

-- Search every file deeply (punch list #240, PR 3, v2.6336): our own OCR for scans. A PDF with no text layer and a
-- picture of paper sit in file_index as text_why = 'scan'; once the secret GOOGLE_DOCAI_PROCESSOR names a Document AI
-- OCR processor, the index pass sends the scan's bytes there and keeps the text with text_source = 'ocr'. Three
-- columns carry the pass: when a scan was last tried (so a provider's refusal costs a day, never a loop), how many
-- pages the OCR read (the cost), and the provider's own reason when it refused (for the report).
-- See docs/migrations/20261102050700_file_index_ocr.md.

ALTER TABLE public.file_index ADD COLUMN IF NOT EXISTS ocr_tried_at timestamptz;
ALTER TABLE public.file_index ADD COLUMN IF NOT EXISTS ocr_pages integer;
ALTER TABLE public.file_index ADD COLUMN IF NOT EXISTS ocr_note text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'file_index_ocr_pages_nonneg') THEN
    ALTER TABLE public.file_index ADD CONSTRAINT file_index_ocr_pages_nonneg CHECK (ocr_pages IS NULL OR ocr_pages >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'file_index_ocr_note_length') THEN
    ALTER TABLE public.file_index ADD CONSTRAINT file_index_ocr_note_length CHECK (ocr_note IS NULL OR length(ocr_note) <= 1000);
  END IF;
END $$;

COMMENT ON COLUMN public.file_index.ocr_tried_at IS 'When OCR last tried this scan (#240, PR 3); a scan is tried again a day after a refusal, never sooner.';
COMMENT ON COLUMN public.file_index.ocr_pages IS 'How many pages Document AI read for this row''s text (the cost); null when the text did not come from OCR.';
COMMENT ON COLUMN public.file_index.ocr_note IS 'Document AI''s own reason the last time it refused this scan, for the report; null once it read.';

-- The OCR pass's queue: the scans due, oldest try first.
CREATE INDEX IF NOT EXISTS file_index_ocr_due_idx ON public.file_index (ocr_tried_at NULLS FIRST) WHERE text_why = 'scan';
