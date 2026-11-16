SET lock_timeout = '3s';

-- Lien desk: what was mailed, kept with the notice (v2.7460, the owner's ask of 2026-11-16: "after we print we
-- should have the user upload what they are going to mail for easier reference later of what actually went out").
-- After the packet prints and is signed, the office scans or photographs the papers that go in the envelope. The
-- file goes into the job's own Drive folder (Sent), as any file added from the Documents tab does, and the notice
-- remembers it here until its mailing is recorded, when the record takes the link. One file per notice was the
-- owner's pick; the column is a list so a notice can hold the owner's envelope and the GC's apart.
--
-- Each entry: { "url": the Drive link, "driveFileId": text, "name": the file's name, "at": timestamptz as text,
-- "by": users.id as text }. The client writes the list whole. Nothing reads it but the Lien desk.
--
-- Additive: one column with a constant default on an existing table, so no table rewrite, no new table and no
-- fences to re-apply. The guard job_lien_desk_items_guard() is untouched: it rules on approval and signature only.

ALTER TABLE public.job_lien_desk_items
  ADD COLUMN IF NOT EXISTS mailed_copies jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_lien_desk_items_mailed_copies_is_array') THEN
    ALTER TABLE public.job_lien_desk_items
      ADD CONSTRAINT job_lien_desk_items_mailed_copies_is_array CHECK (jsonb_typeof(mailed_copies) = 'array');
  END IF;
END $$;

COMMENT ON COLUMN public.job_lien_desk_items.mailed_copies IS
  'Lien desk (v2.7460): the scans or photos of what went in the envelope, each a file in the job''s Drive folder: [{ url, driveFileId, name, at, by }]. Written whole by the run''s checklist; the mailing''s record takes the first link.';
