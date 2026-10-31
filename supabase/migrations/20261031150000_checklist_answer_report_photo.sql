SET lock_timeout = '3s';

-- A photo answers a checklist question (punch list #189, PR 6, v2.6219; the plan's item b.3). On the camera-first
-- field report (v2.6083) a shot is a report_photos row waiting in the report-photos bucket until the photo-save sweep
-- files it in the customer's Drive folder. Where the job's stage checklist (#164, 20261029210000_stage_checklists.sql)
-- has a question that asks for a photo, that question is a chip under the new tile, and Save makes the shot the
-- question's answer. The answer row had no way to name a report photo: its photo columns are bound to the
-- stage-checklist-photos bucket, which the checklist sweep reads by photo_storage_path. So:
--
--   1. report_photo_id on stage_checklist_answers: the report_photos row that is the answer's photo. The row's
--      photo_file_name, photo_taken_at and photo_bytes are written by the client as for a sheet photo;
--      photo_storage_path stays NULL, so the checklist sweep leaves it alone (the report sweep files the one copy).
--   2. Two triggers keep the answer's photo columns true without a second copier or a client read:
--      - stage_checklist_answers_reads_report_photo (BEFORE INSERT OR UPDATE OF report_photo_id, photo_storage_path):
--        an answer that takes a report photo reads its Drive id, filed time and reason as they stand, so a shot the
--        sweep already filed reads filed at once; a shot of the sheet's own (photo_storage_path set) takes the
--        question back from the report photo.
--      - report_photos_mirror_checklist_answers (AFTER UPDATE OF drive_file_id, filed_at, fail_why; BEFORE DELETE):
--        when the sweep files the report photo, or writes why it could not, every answer that names it reads the
--        same; a report photo deleted (a dev's hand) leaves the question unanswered again.
--
-- Additive and idempotent; no table is created, so no fence call is needed. The client is harmless ahead of the push:
-- the answer write fails with the column's name and the report still saves with its photos.

ALTER TABLE public.stage_checklist_answers
  ADD COLUMN IF NOT EXISTS report_photo_id uuid REFERENCES public.report_photos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS stage_checklist_answers_report_photo_idx ON public.stage_checklist_answers (report_photo_id) WHERE report_photo_id IS NOT NULL;
COMMENT ON COLUMN public.stage_checklist_answers.report_photo_id IS 'A photo answers a checklist question (#189 PR 6): the report_photos row that is this answer''s photo, taken on a field report. Its Drive id, filed time and reason are mirrored onto photo_drive_file_id, photo_filed_at and photo_fail_why by trigger; photo_storage_path stays NULL, so the checklist sweep leaves the row to the report sweep.';

-- 2a. An answer that takes a report photo reads the photo's standing; a sheet photo takes the question back.
CREATE OR REPLACE FUNCTION public.stage_checklist_answer_reads_report_photo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.photo_storage_path IS NOT NULL THEN
    NEW.report_photo_id := NULL;
  ELSIF NEW.report_photo_id IS NOT NULL THEN
    SELECT p.drive_file_id, p.filed_at, p.fail_why
      INTO NEW.photo_drive_file_id, NEW.photo_filed_at, NEW.photo_fail_why
      FROM public.report_photos p
     WHERE p.id = NEW.report_photo_id;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS stage_checklist_answers_reads_report_photo ON public.stage_checklist_answers;
CREATE TRIGGER stage_checklist_answers_reads_report_photo
  BEFORE INSERT OR UPDATE OF report_photo_id, photo_storage_path ON public.stage_checklist_answers
  FOR EACH ROW EXECUTE FUNCTION public.stage_checklist_answer_reads_report_photo();

-- 2b. The report photo's standing onto every answer that names it; a deleted photo leaves the question unanswered.
CREATE OR REPLACE FUNCTION public.report_photo_mirror_checklist_answers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.stage_checklist_answers
       SET report_photo_id = NULL,
           photo_file_name = NULL,
           photo_taken_at = NULL,
           photo_bytes = 0,
           photo_drive_file_id = NULL,
           photo_filed_at = NULL,
           photo_fail_why = NULL,
           updated_at = now()
     WHERE report_photo_id = OLD.id;
    RETURN OLD;
  END IF;
  UPDATE public.stage_checklist_answers
     SET photo_drive_file_id = NEW.drive_file_id,
         photo_filed_at = NEW.filed_at,
         photo_fail_why = NEW.fail_why,
         updated_at = now()
   WHERE report_photo_id = NEW.id
     AND (photo_drive_file_id IS DISTINCT FROM NEW.drive_file_id
          OR photo_filed_at IS DISTINCT FROM NEW.filed_at
          OR photo_fail_why IS DISTINCT FROM NEW.fail_why);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS report_photos_mirror_checklist_answers ON public.report_photos;
CREATE TRIGGER report_photos_mirror_checklist_answers
  AFTER UPDATE OF drive_file_id, filed_at, fail_why ON public.report_photos
  FOR EACH ROW EXECUTE FUNCTION public.report_photo_mirror_checklist_answers();

DROP TRIGGER IF EXISTS report_photos_mirror_checklist_answers_delete ON public.report_photos;
CREATE TRIGGER report_photos_mirror_checklist_answers_delete
  BEFORE DELETE ON public.report_photos
  FOR EACH ROW EXECUTE FUNCTION public.report_photo_mirror_checklist_answers();
