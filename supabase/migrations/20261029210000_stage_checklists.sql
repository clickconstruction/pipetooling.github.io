SET lock_timeout = '3s';

-- A checklist per stage (punch list #164, PR 2; the owner's picks of 2026-10-24 and Taunya's of 2026-10-29). The office
-- writes a short list of questions once for each stage kind, Rough In, Top Out and Trim Set, and the crew answers them
-- on the phone for each job's stage: Yes, No or Not here, a note, and a photo where a question asks for one. A stage
-- reads not ready on the Pipeline until every question is answered (the strict rule); a kind with no questions written
-- has no checklist, so nothing changes until the office types the questions. Photos always live in Google Drive: a
-- checklist photo waits in a bucket and the photo-save sweep files it in the customer's folder, as a box photo does
-- (20261029010000_materials_on_site.sql). The rules are src/lib/jobs/stageChecklist.ts (v2.6072).
--
--   1. stage_checklist_templates — one question per row: its kind, its place, the words, whether it asks for a photo;
--      retired_at when the office takes it off, so an answer already given keeps its question.
--   2. stage_checklist_answers   — one row per job stage and question: the pick, the note, who and when, and the photo's
--      waiting-room path, its Drive id once filed, and the reason when the sweep could not file it.
--   3. The gates: everyone signed in reads the questions; the office (dev, master, assistant-like) writes them. A job's
--      answers are read and written by whoever may stamp the job's stages, can_report_stage_progress(job_id)
--      (20260909141454_stage_progress.sql): the office roles, or a field user on the job's team, clocked in on it, or
--      under the sub rule.
--   4. The bucket stage-checklist-photos, where a shot waits until the sweep moves it into Drive and deletes it here.
--   5. The photo-save cron calls while a checklist photo waits too (20261029160000 counted the ticks and the box photos).

-- 1. The questions.
CREATE TABLE IF NOT EXISTS public.stage_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_kind text NOT NULL CHECK (stage_kind IN ('rough_in', 'top_out', 'trim_set')),
  sort_order integer NOT NULL DEFAULT 0,
  words text NOT NULL CHECK (length(TRIM(words)) BETWEEN 1 AND 200),
  asks_photo boolean NOT NULL DEFAULT false,
  retired_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stage_checklist_templates_live_idx ON public.stage_checklist_templates (stage_kind, sort_order) WHERE retired_at IS NULL;
COMMENT ON TABLE public.stage_checklist_templates IS 'A checklist per stage (#164): the office''s questions for a stage kind (rough_in, top_out, trim_set), one per row in sort_order. A question taken off is retired, never deleted, so its answers keep their words. A kind with no live question has no checklist.';
COMMENT ON COLUMN public.stage_checklist_templates.asks_photo IS 'True when the crew must take a photo with Yes or No. Not here needs no photo.';

-- 2. The answers.
CREATE TABLE IF NOT EXISTS public.stage_checklist_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  fixture_id uuid NOT NULL REFERENCES public.jobs_ledger_fixtures(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.stage_checklist_templates(id) ON DELETE CASCADE,
  pick text CHECK (pick IS NULL OR pick IN ('yes', 'no', 'not_here')),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  answered_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  answered_by_name text NOT NULL DEFAULT '' CHECK (length(answered_by_name) <= 120),
  answered_at timestamptz,
  photo_file_name text CHECK (photo_file_name IS NULL OR length(photo_file_name) BETWEEN 1 AND 200),
  photo_taken_at timestamptz,
  photo_bytes integer NOT NULL DEFAULT 0 CHECK (photo_bytes >= 0),
  photo_storage_path text CHECK (photo_storage_path IS NULL OR length(photo_storage_path) <= 300),
  photo_drive_file_id text CHECK (photo_drive_file_id IS NULL OR length(photo_drive_file_id) <= 120),
  photo_filed_at timestamptz,
  photo_fail_why text CHECK (photo_fail_why IS NULL OR length(photo_fail_why) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fixture_id, question_id)
);
CREATE INDEX IF NOT EXISTS stage_checklist_answers_job_idx ON public.stage_checklist_answers (job_id, fixture_id);
CREATE INDEX IF NOT EXISTS stage_checklist_answers_unfiled_idx ON public.stage_checklist_answers (photo_taken_at) WHERE photo_storage_path IS NOT NULL AND photo_filed_at IS NULL;
COMMENT ON TABLE public.stage_checklist_answers IS 'A checklist per stage (#164): the crew''s answer on one question of one job stage (jobs_ledger_fixtures). pick is yes, no or not_here; a row with no pick holds a note or a photo left before the pick. The photo waits in the stage-checklist-photos bucket at photo_storage_path until the photo-save sweep files it in the customer''s Drive folder under photo_file_name, writes photo_drive_file_id and photo_filed_at, and deletes the bucket copy; a photo it could not file keeps the reason in photo_fail_why and is tried again. No lasting copy in the app.';

-- 3. The gates.
ALTER TABLE public.stage_checklist_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stage_checklist_templates_select ON public.stage_checklist_templates;
CREATE POLICY stage_checklist_templates_select ON public.stage_checklist_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS stage_checklist_templates_insert ON public.stage_checklist_templates;
CREATE POLICY stage_checklist_templates_insert ON public.stage_checklist_templates FOR INSERT TO authenticated
  WITH CHECK (public.is_master_or_dev() OR public.is_assistant());
DROP POLICY IF EXISTS stage_checklist_templates_update ON public.stage_checklist_templates;
CREATE POLICY stage_checklist_templates_update ON public.stage_checklist_templates FOR UPDATE TO authenticated
  USING (public.is_master_or_dev() OR public.is_assistant()) WITH CHECK (public.is_master_or_dev() OR public.is_assistant());
DROP POLICY IF EXISTS stage_checklist_templates_delete ON public.stage_checklist_templates;
CREATE POLICY stage_checklist_templates_delete ON public.stage_checklist_templates FOR DELETE TO authenticated
  USING (public.is_dev());

ALTER TABLE public.stage_checklist_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stage_checklist_answers_select ON public.stage_checklist_answers;
CREATE POLICY stage_checklist_answers_select ON public.stage_checklist_answers FOR SELECT TO authenticated USING (public.can_report_stage_progress(job_id));
DROP POLICY IF EXISTS stage_checklist_answers_insert ON public.stage_checklist_answers;
CREATE POLICY stage_checklist_answers_insert ON public.stage_checklist_answers FOR INSERT TO authenticated WITH CHECK (public.can_report_stage_progress(job_id));
DROP POLICY IF EXISTS stage_checklist_answers_update ON public.stage_checklist_answers;
CREATE POLICY stage_checklist_answers_update ON public.stage_checklist_answers FOR UPDATE TO authenticated
  USING (public.can_report_stage_progress(job_id)) WITH CHECK (public.can_report_stage_progress(job_id));
DROP POLICY IF EXISTS stage_checklist_answers_delete ON public.stage_checklist_answers;
CREATE POLICY stage_checklist_answers_delete ON public.stage_checklist_answers FOR DELETE TO authenticated
  USING (public.is_master_or_dev() OR public.is_assistant());

-- 4. The bucket: private, 2 MB a file, images only. Objects are named <job_id>/<answer_id>.jpg, so the same gate reads
--    the job from the path. The sweep deletes with the service role.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('stage-checklist-photos', 'stage-checklist-photos', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS stage_checklist_photos_files_insert ON storage.objects;
CREATE POLICY stage_checklist_photos_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stage-checklist-photos' AND public.can_report_stage_progress(((storage.foldername(name))[1])::uuid));
DROP POLICY IF EXISTS stage_checklist_photos_files_select ON storage.objects;
CREATE POLICY stage_checklist_photos_files_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'stage-checklist-photos' AND public.can_report_stage_progress(((storage.foldername(name))[1])::uuid));

-- 5. The cron: every five minutes while some job's tick is on, a box photo waits, or a checklist photo waits. Unscheduled
--    first, so a second run leaves one row.
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
     OR EXISTS (SELECT 1 FROM public.stage_checklist_answers WHERE photo_filed_at IS NULL AND photo_storage_path IS NOT NULL);
  $$
);

-- House rules for every CREATE TABLE: training-mode blocks and the digital-twin fence on the new tables.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
