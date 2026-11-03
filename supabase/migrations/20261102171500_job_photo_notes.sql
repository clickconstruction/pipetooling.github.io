SET lock_timeout = '3s';

-- Job photos (punch list #244, PR 1, v2.6359). The owner's ask of 2026-11-02: a photos icon beside the Pipeline row's
-- Job folder icon and a window where anyone adds a photo to a job with a description that can be found later. A photo
-- reached a job only on a report, a Tally box, a checklist answer or a text; none of them is "just a photo with words".
--
-- 1. The table: a report photo's shape (20261029220000_report_photos.sql) plus the description. The phone shrinks the
--    shot and puts it in the job-photo-notes bucket with a row; the press Add N photos to the job writes the words, the
--    stage and added_at; the photo-save sweep (PR 2) files a row with added_at into the job's Customer Pictures folder
--    named by day, sender and caption, writes drive_file_id and filed_at and deletes the bucket copy. A row with no
--    added_at is a window closed without the press; the client discards it, and the sweep never files it.
CREATE TABLE IF NOT EXISTS public.job_photo_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  fixture_id uuid REFERENCES public.jobs_ledger_fixtures(id) ON DELETE SET NULL,
  stage_name text NOT NULL DEFAULT '' CHECK (length(stage_name) <= 160),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  caption text NOT NULL DEFAULT '' CHECK (length(caption) <= 200),
  by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '' CHECK (length(by_name) <= 120),
  taken_at timestamptz NOT NULL DEFAULT now(),
  added_at timestamptz,
  bytes integer NOT NULL DEFAULT 0 CHECK (bytes >= 0),
  original_bytes integer NOT NULL DEFAULT 0 CHECK (original_bytes >= 0),
  width integer NOT NULL DEFAULT 0 CHECK (width >= 0),
  height integer NOT NULL DEFAULT 0 CHECK (height >= 0),
  storage_path text CHECK (length(storage_path) <= 300),
  drive_file_id text CHECK (length(drive_file_id) <= 120),
  filed_at timestamptz,
  fail_why text CHECK (length(fail_why) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_photo_notes_job_idx ON public.job_photo_notes (job_id, taken_at);
CREATE INDEX IF NOT EXISTS job_photo_notes_unfiled_idx ON public.job_photo_notes (taken_at) WHERE filed_at IS NULL AND storage_path IS NOT NULL AND added_at IS NOT NULL;
COMMENT ON TABLE public.job_photo_notes IS 'Job photos (punch list #244): a photo added to a job with a description, from the Job photos window. The phone shrinks the shot and puts it in the job-photo-notes bucket; Add writes description, stage and added_at; the photo-save sweep files a row with added_at into the job''s Drive photo folder named by day, sender and caption, writes drive_file_id and filed_at, and deletes the bucket copy. A row with no added_at is a window closed without the press; the client discards it.';
COMMENT ON COLUMN public.job_photo_notes.description IS 'What the photo shows, in the person''s words (up to 500 characters); the search on Documents → Photos and in the Job photos window reads it. May be edited later by the taker or the office.';
COMMENT ON COLUMN public.job_photo_notes.caption IS 'What the Drive file is named by: the description''s first words, else the stage, else Job photo.';
COMMENT ON COLUMN public.job_photo_notes.added_at IS 'When the person pressed Add; null while the shot waits on an open window. The sweep files only rows with it.';
COMMENT ON COLUMN public.job_photo_notes.fail_why IS 'Why the sweep could not file it yet (the job has no Drive folder, Drive refused); the window reads it as not in Drive yet.';

-- 2. The gate: the job's own (can_report_stage_progress: the office, or a field user on the job's team, clocked in on
--    it, or under the sub rule), as report_photos has it. The taker and the office may edit the words later; the taker
--    may discard their own shot while the window has not added it; an added photo stays, since Drive is its home.
ALTER TABLE public.job_photo_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_photo_notes_select ON public.job_photo_notes;
CREATE POLICY job_photo_notes_select ON public.job_photo_notes FOR SELECT TO authenticated USING (public.can_report_stage_progress(job_id));
DROP POLICY IF EXISTS job_photo_notes_insert_own ON public.job_photo_notes;
CREATE POLICY job_photo_notes_insert_own ON public.job_photo_notes FOR INSERT TO authenticated
  WITH CHECK (public.can_report_stage_progress(job_id) AND by_user_id = auth.uid());
DROP POLICY IF EXISTS job_photo_notes_update_own_or_office ON public.job_photo_notes;
CREATE POLICY job_photo_notes_update_own_or_office ON public.job_photo_notes FOR UPDATE TO authenticated
  USING (public.can_report_stage_progress(job_id) AND (by_user_id = auth.uid() OR public.is_office_or_estimator()))
  WITH CHECK (public.can_report_stage_progress(job_id) AND (by_user_id = auth.uid() OR public.is_office_or_estimator()));
DROP POLICY IF EXISTS job_photo_notes_delete_unadded_own ON public.job_photo_notes;
CREATE POLICY job_photo_notes_delete_unadded_own ON public.job_photo_notes FOR DELETE TO authenticated
  USING (by_user_id = auth.uid() AND added_at IS NULL);

-- 3. The bucket: private, 2 MB a file, images only. Objects are named <job_id>/<photo_id>.jpg, so the same gate reads
--    the job from the path. The sweep deletes with the service role; the taker may delete their own object.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('job-photo-notes', 'job-photo-notes', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS job_photo_notes_files_insert ON storage.objects;
CREATE POLICY job_photo_notes_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'job-photo-notes' AND public.can_report_stage_progress(((storage.foldername(name))[1])::uuid));
DROP POLICY IF EXISTS job_photo_notes_files_select ON storage.objects;
CREATE POLICY job_photo_notes_files_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'job-photo-notes' AND public.can_report_stage_progress(((storage.foldername(name))[1])::uuid));
DROP POLICY IF EXISTS job_photo_notes_files_delete_own ON storage.objects;
CREATE POLICY job_photo_notes_files_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'job-photo-notes' AND owner = auth.uid());

-- 4. The view uploaded_photos (20261101084330) gains a fifth branch, 'job': an added job photo, its description as the
--    caption (so the server-side search reads every word of it), its stage, who and when, where it waits and where it
--    landed. The other four branches are as 20261101084330 wrote them. A view: CREATE OR REPLACE with the same columns.
CREATE OR REPLACE VIEW public.uploaded_photos
WITH (security_invoker = true)
AS
SELECT
  'report'::text AS source,
  p.id,
  p.job_id,
  NULL::uuid AS bid_id,
  NULL::uuid AS project_id,
  p.report_id,
  NULL::uuid AS container_id,
  NULL::uuid AS question_id,
  NULL::uuid AS message_id,
  NULL::uuid AS contact_id,
  p.caption,
  p.stage_name,
  p.by_user_id,
  p.by_name,
  NULL::text AS direction,
  NULL::text AS channel,
  p.taken_at,
  p.bytes::bigint AS bytes,
  p.original_bytes::bigint AS original_bytes,
  'report-photos'::text AS bucket,
  p.storage_path,
  p.drive_file_id,
  p.filed_at,
  p.fail_why,
  NULL::text AS status,
  j.hcp_number AS job_hcp_number,
  j.click_number AS job_click_number,
  j.job_name,
  c.name AS customer_name,
  NULL::text AS bid_number
FROM public.report_photos p
JOIN public.jobs_ledger j ON j.id = p.job_id
LEFT JOIN public.customers c ON c.id = j.customer_id
WHERE p.report_id IS NOT NULL

UNION ALL

SELECT
  'box'::text,
  b.id,
  b.job_id,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  b.container_id,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  b.words,
  COALESCE(k.label, ''),
  b.by_user_id,
  b.by_name,
  NULL::text,
  NULL::text,
  b.taken_at,
  b.bytes::bigint,
  0::bigint,
  'box-photos'::text,
  b.storage_path,
  b.drive_file_id,
  b.filed_at,
  b.fail_why,
  b.status,
  j.hcp_number,
  j.click_number,
  j.job_name,
  c.name,
  NULL::text
FROM public.job_box_photos b
JOIN public.jobs_ledger j ON j.id = b.job_id
LEFT JOIN public.customers c ON c.id = j.customer_id
LEFT JOIN public.job_containers k ON k.id = b.container_id

UNION ALL

SELECT
  'checklist'::text,
  a.id,
  a.job_id,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  a.question_id,
  NULL::uuid,
  NULL::uuid,
  COALESCE(t.words, ''),
  COALESCE(f.name, ''),
  a.answered_by,
  a.answered_by_name,
  NULL::text,
  NULL::text,
  COALESCE(a.photo_taken_at, a.answered_at, a.created_at),
  a.photo_bytes::bigint,
  0::bigint,
  'stage-checklist-photos'::text,
  a.photo_storage_path,
  a.photo_drive_file_id,
  a.photo_filed_at,
  a.photo_fail_why,
  NULL::text,
  j.hcp_number,
  j.click_number,
  j.job_name,
  c.name,
  NULL::text
FROM public.stage_checklist_answers a
JOIN public.jobs_ledger j ON j.id = a.job_id
LEFT JOIN public.customers c ON c.id = j.customer_id
LEFT JOIN public.stage_checklist_templates t ON t.id = a.question_id
LEFT JOIN public.jobs_ledger_fixtures f ON f.id = a.fixture_id
WHERE a.report_photo_id IS NULL
  AND (a.photo_storage_path IS NOT NULL OR a.photo_drive_file_id IS NOT NULL)

UNION ALL

SELECT
  'job'::text,
  n.id,
  n.job_id,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  CASE WHEN length(n.description) > 0 THEN n.description ELSE n.caption END,
  n.stage_name,
  n.by_user_id,
  n.by_name,
  NULL::text,
  NULL::text,
  n.taken_at,
  n.bytes::bigint,
  n.original_bytes::bigint,
  'job-photo-notes'::text,
  n.storage_path,
  n.drive_file_id,
  n.filed_at,
  n.fail_why,
  NULL::text,
  j.hcp_number,
  j.click_number,
  j.job_name,
  c.name,
  NULL::text
FROM public.job_photo_notes n
JOIN public.jobs_ledger j ON j.id = n.job_id
LEFT JOIN public.customers c ON c.id = j.customer_id
WHERE n.added_at IS NOT NULL

UNION ALL

SELECT
  'message'::text,
  att.id,
  COALESCE(m.jobs_ledger_id, gp.billing_job_id),
  m.bid_id,
  m.project_id,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  m.id,
  m.contact_id,
  att.name,
  ''::text,
  m.who_user_id,
  m.who_text,
  m.direction,
  m.channel,
  COALESCE(m.at, m.created_at),
  COALESCE(att.size_bytes, 0)::bigint,
  0::bigint,
  'message-attachments'::text,
  att.bucket_path,
  att.drive_file_id,
  NULL::timestamptz,
  NULL::text,
  att.left_in_gmail,
  j.hcp_number,
  j.click_number,
  COALESCE(j.job_name, bd.project_name),
  COALESCE(c.name, cb.name),
  bd.bid_number::text
FROM public.message_attachments att
JOIN public.messages m ON m.id = att.message_id
LEFT JOIN public.gc_projects gp ON gp.project_id = m.project_id
LEFT JOIN public.jobs_ledger j ON j.id = COALESCE(m.jobs_ledger_id, gp.billing_job_id)
LEFT JOIN public.customers c ON c.id = j.customer_id
LEFT JOIN public.bids bd ON bd.id = m.bid_id
LEFT JOIN public.customers cb ON cb.id = bd.customer_id
WHERE att.kind = 'file'
  AND att.mime ILIKE 'image/%';

COMMENT ON VIEW public.uploaded_photos IS
  'Every photo uploaded, one list (punch list #232, v2.6264; the job branch #244, v2.6359): report_photos (saved reports), job_box_photos, stage_checklist_answers (the sheet''s own photo, never one that names a report photo), job_photo_notes (added job photos, the description as the caption) and message_attachments (pictures, with their line) as one shape, with the job''s number, name and customer. security_invoker: each table''s own policy and the ledger''s scope decide what the caller sees. Documents → Photos reads it newest first.';

REVOKE ALL ON public.uploaded_photos FROM anon;
GRANT SELECT ON public.uploaded_photos TO authenticated;

-- 5. The cron: photo-save calls while any source waits; a fifth clause for an added job photo. Every earlier clause is
--    written again (20261030070000's rule). Unscheduled first, so a second run leaves one row.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'photo-save';

SELECT cron.schedule(
  'photo-save',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/photo-save',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id
  WHERE EXISTS (SELECT 1 FROM public.photo_saves WHERE on_since IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.job_box_photos WHERE filed_at IS NULL AND storage_path IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.report_photos WHERE filed_at IS NULL AND storage_path IS NOT NULL AND report_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.stage_checklist_answers WHERE photo_filed_at IS NULL AND photo_storage_path IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.job_photo_notes WHERE filed_at IS NULL AND storage_path IS NOT NULL AND added_at IS NOT NULL);
  $$
);

-- House rules for every CREATE TABLE: training-mode blocks and the digital-twin fence on the new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
