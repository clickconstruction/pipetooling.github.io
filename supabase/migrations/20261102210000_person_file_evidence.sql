SET lock_timeout = '3s';

-- Person file evidence (the People → Paperwork spike, 2026-11-02; the owner's call: each piece of evidence has at least
-- the day it is about, a title, a memo and its files, and it is found in Drive).
--   person_file_evidence — one record per piece of evidence on a person's file: dated_on (the day it is ABOUT), title,
--     memo, who wrote it, and where it landed in Drive (People › <person> › <day · title>, made by hr-evidence-drive).
--     Append-only like an entry: no UPDATE or DELETE policy; the Drive stamps are the service role's.
--   person_file_attachments gains evidence_id (the record a file belongs to) and the Drive stamps per file
--     (drive_file_id, drive_url, filed_at, fail_why). A file written before this migration keeps entry_id or stands
--     alone; the panel lists those under "files from before records".
-- Keyed on people.id (PERSON_IDENTITY invariant #1). Dev-only like the rest of the HR tables (docs/HR_FILES.md).
-- The People folder itself is an app_settings row (drive_people_folder_id), set on Documents → Where files go; no DDL.
-- Idempotent and additive.

CREATE TABLE IF NOT EXISTS public.person_file_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  entry_id uuid NULL REFERENCES public.person_file_entries(id) ON DELETE SET NULL,
  dated_on date NOT NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  memo text NOT NULL DEFAULT '' CHECK (char_length(memo) <= 4000),
  created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  author_label text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  drive_folder_id text NULL,
  drive_folder_url text NULL,
  filed_at timestamptz NULL,
  fail_why text NULL
);

COMMENT ON TABLE public.person_file_evidence IS
  'Evidence on a person''s HR file: the day it is about, a title, a memo and its files (person_file_attachments.evidence_id), filed in Drive under People › <person> › <day · title>. Append-only; dev-only.';

CREATE INDEX IF NOT EXISTS idx_person_file_evidence_person_day
  ON public.person_file_evidence (person_id, dated_on DESC);

ALTER TABLE public.person_file_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS person_file_evidence_dev_select ON public.person_file_evidence;
CREATE POLICY person_file_evidence_dev_select ON public.person_file_evidence
  FOR SELECT TO authenticated USING (public.is_dev());

DROP POLICY IF EXISTS person_file_evidence_dev_insert ON public.person_file_evidence;
CREATE POLICY person_file_evidence_dev_insert ON public.person_file_evidence
  FOR INSERT TO authenticated WITH CHECK (public.is_dev());

GRANT SELECT, INSERT ON public.person_file_evidence TO authenticated;

ALTER TABLE public.person_file_attachments
  ADD COLUMN IF NOT EXISTS evidence_id uuid NULL REFERENCES public.person_file_evidence(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS drive_file_id text NULL,
  ADD COLUMN IF NOT EXISTS drive_url text NULL,
  ADD COLUMN IF NOT EXISTS filed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS fail_why text NULL;

CREATE INDEX IF NOT EXISTS idx_person_file_attachments_evidence
  ON public.person_file_attachments (evidence_id);

-- The dev seat's catalog and src/types/database.ts are regenerated after the push.

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
