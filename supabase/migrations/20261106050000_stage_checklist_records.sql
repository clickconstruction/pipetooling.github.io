SET lock_timeout = '3s';

-- The record (punch list #237, PR 3, v2.6571). A stage's checklist is a document on the job, in the signed hours
-- statement's shape (20261030030000_hours_statements.sql): one row per job stage and version, a snapshot of the
-- questions and the answers as they stood (the words never change under an answer), a record id CL-<job number>-<n>
-- counted per job, a state (filed · amended), the filing time, and the PDF's Drive id once the photo-save sweep has
-- drawn and filed it in the job's Drive folder, each version its own file (the owner's call).
--
-- It files itself at the last answer (the owner's call 1: a press is a step no one will take, and the last answer's
-- stamp is the filing time). The rule that says when a list is complete lives in src/lib/jobs/stageChecklist.ts
-- (questionWaitsOn: the pick, the signature where the author asked for one, the photo where asked and the pick is not
-- Not here, a skipped company question left off, a voided answer no answer) and is written here a second time in SQL,
-- stage_checklist_record_settle, so every road that answers a question files the record: the sheet, the Pipeline's
-- door, a report photo, a signature that waited on the phone. Filed means immutable: adding a check, skipping a question
-- or taking an answer back marks the filed record amended, and the next completion files version n+1 with the next
-- record number; version n stays readable and printable. The office's Amend press does the same on purpose, with its
-- reason.
--
--   1. stage_checklist_records — the table.
--   2. stage_checklist_kind_of(name) — the kind a stage's name reads as, the Pipeline's own stage words
--      (src/lib/jobs/stageRecognition.ts: rough → rough_in; top out, stack out → top_out; trim, finish → trim_set).
--   3. stage_checklist_record_settle(fixture) — the one function: complete and no filed record → file; incomplete and
--      the latest is filed → amend. SECURITY DEFINER, the table has no insert or update policy for anyone.
--   4. The triggers that call it: every write on the answers, a job item's add or retire, a company question's add or
--      retire (every filed record of that kind), a skip or a put back.
--   5. amend_stage_checklist_record(record, why) — the office's Amend, by whoever authors on the job.
--   6. The photo-save cron runs while a record's PDF waits too.
--
-- Additive and idempotent. One table is created, so the file ends with the three fence calls. The client reads the
-- table and calls the RPC, so check:calls-ahead labels the PR push right after the merge.

-- 1. The table.
CREATE TABLE IF NOT EXISTS public.stage_checklist_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  fixture_id uuid NOT NULL REFERENCES public.jobs_ledger_fixtures(id) ON DELETE CASCADE,
  record_no integer NOT NULL CHECK (record_no >= 1),
  version integer NOT NULL CHECK (version >= 1),
  record_id text NOT NULL CHECK (record_id ~ '^CL-' AND length(record_id) <= 60),
  stage_name text NOT NULL CHECK (length(stage_name) <= 200),
  stage_kind text NOT NULL CHECK (stage_kind IN ('rough_in', 'top_out', 'trim_set')),
  state text NOT NULL DEFAULT 'filed' CHECK (state IN ('filed', 'amended')),
  filed_at timestamptz NOT NULL,
  filed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  filed_by_name text NOT NULL DEFAULT '' CHECK (length(filed_by_name) <= 120),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  answer_count integer NOT NULL DEFAULT 0 CHECK (answer_count >= 0),
  signed_count integer NOT NULL DEFAULT 0 CHECK (signed_count >= 0),
  no_count integer NOT NULL DEFAULT 0 CHECK (no_count >= 0),
  amended_at timestamptz,
  amended_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  amended_by_name text NOT NULL DEFAULT '' CHECK (length(amended_by_name) <= 120),
  amend_why text CHECK (amend_why IS NULL OR length(amend_why) <= 200),
  pdf_file_name text CHECK (pdf_file_name IS NULL OR length(pdf_file_name) <= 200),
  pdf_drive_file_id text CHECK (pdf_drive_file_id IS NULL OR length(pdf_drive_file_id) <= 120),
  pdf_filed_at timestamptz,
  pdf_fail_why text CHECK (pdf_fail_why IS NULL OR length(pdf_fail_why) <= 300),
  pdf_tries integer NOT NULL DEFAULT 0 CHECK (pdf_tries >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, record_no),
  UNIQUE (fixture_id, version)
);
CREATE INDEX IF NOT EXISTS stage_checklist_records_job_idx ON public.stage_checklist_records (job_id, fixture_id, version DESC);
CREATE INDEX IF NOT EXISTS stage_checklist_records_pdf_waiting_idx ON public.stage_checklist_records (filed_at) WHERE pdf_filed_at IS NULL AND pdf_tries < 5;
COMMENT ON TABLE public.stage_checklist_records IS 'A stage checklist filed as a record (#237 PR 3): one row per job stage and version, the questions and answers as they stood in snapshot, record_id CL-<job number>-<n> counted per job, state filed or amended (a later version is open), filed_at the last answer''s stamp, and the PDF the photo-save sweep draws into the job''s Drive folder, each version its own file. Written by stage_checklist_record_settle alone.';
COMMENT ON COLUMN public.stage_checklist_records.snapshot IS '{ rows: [{ questionId, scope, words, sheet, why, addedBy, pick, note, by, at, signature: { mode, printedName, signedAt, storagePath } | null, photo: { fileName, driveFileId, filedAt } | null }], skipped: [{ words, by, why }] }, in the sheet''s order; the paper prints again from it.';
COMMENT ON COLUMN public.stage_checklist_records.state IS 'filed: the stage reads as paper. amended: a check was added, a question skipped, an answer taken back or the office pressed Amend, so the stage is open again and the next completion files the next version; this row stays as it was.';
COMMENT ON COLUMN public.stage_checklist_records.pdf_drive_file_id IS 'The PDF in the job''s Drive folder once the photo-save sweep has drawn and filed it; pdf_fail_why and pdf_tries while it could not, five tries at most.';

-- 2. The kind a stage's name reads as, the Pipeline's own stage words (stageRank in src/lib/jobs/stageRecognition.ts).
CREATE OR REPLACE FUNCTION public.stage_checklist_kind_of(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(btrim(COALESCE(p_name, ''))) ~ '^rough' THEN 'rough_in'
    WHEN lower(btrim(COALESCE(p_name, ''))) ~ '^(top|stack)[[:space:]-]?out' THEN 'top_out'
    WHEN lower(btrim(COALESCE(p_name, ''))) ~ '^(trim|finish(es|ing)?)(\M|$)' THEN 'trim_set'
    ELSE NULL
  END;
$$;
COMMENT ON FUNCTION public.stage_checklist_kind_of(text) IS 'The checklist kind a stage line''s name reads as (#237 PR 3): rough_in, top_out, trim_set, or null for a line with no checklist. The same words as the app''s stageRank.';

-- 3. The one function: file when complete, amend when a filed stage comes open.
CREATE OR REPLACE FUNCTION public.stage_checklist_record_settle(p_fixture_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_stage_name text;
  v_kind text;
  v_job_number text;
  v_asked integer;
  v_answered integer;
  v_latest public.stage_checklist_records;
  v_rows jsonb;
  v_skipped jsonb;
  v_filed_at timestamptz;
  v_filed_by uuid;
  v_filed_by_name text;
  v_signed integer;
  v_nos integer;
  v_record_no integer;
BEGIN
  SELECT f.job_id, f.name INTO v_job_id, v_stage_name FROM public.jobs_ledger_fixtures f WHERE f.id = p_fixture_id;
  IF v_job_id IS NULL THEN RETURN; END IF;
  v_kind := public.stage_checklist_kind_of(v_stage_name);
  IF v_kind IS NULL THEN RETURN; END IF;

  -- The stage's list as the sheet draws it: the company's live questions less the ones skipped here, then the items
  -- added for this stage; each answered when its live row has a pick, the signature where asked, the photo where asked
  -- and the pick is not Not here.
  WITH q AS (
    SELECT t.id, t.job_id, t.sort_order, t.created_at, t.words, t.plan_sheet, t.why, t.created_by_name, t.asks_photo, t.needs_signature
    FROM public.stage_checklist_templates t
    WHERE t.retired_at IS NULL AND t.stage_kind = v_kind
      AND (
        (t.job_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.stage_checklist_skips s WHERE s.question_id = t.id AND s.fixture_id = p_fixture_id AND s.put_back_at IS NULL))
        OR t.fixture_id = p_fixture_id
      )
  ),
  qa AS (
    SELECT q.*, a.pick, a.note, a.answered_by, a.answered_by_name, a.answered_at,
           a.signed_at, a.signer_signature_mode, a.signer_printed_name, a.signer_signature_storage_path,
           a.photo_file_name, a.photo_drive_file_id, a.photo_filed_at,
           (a.pick IS NOT NULL
             AND (NOT q.needs_signature OR a.signed_at IS NOT NULL)
             AND (NOT q.asks_photo OR a.pick = 'not_here' OR a.photo_file_name IS NOT NULL)) AS done
    FROM q
    LEFT JOIN public.stage_checklist_answers a ON a.question_id = q.id AND a.fixture_id = p_fixture_id AND a.voided_at IS NULL
  )
  SELECT count(*), count(*) FILTER (WHERE done),
         count(*) FILTER (WHERE done AND signed_at IS NOT NULL), count(*) FILTER (WHERE done AND pick = 'no'),
         max(answered_at),
         COALESCE(jsonb_agg(jsonb_build_object(
           'questionId', id,
           'scope', CASE WHEN job_id IS NULL THEN 'company' ELSE 'job' END,
           'words', words, 'sheet', plan_sheet, 'why', why, 'addedBy', created_by_name,
           'pick', pick, 'note', COALESCE(note, ''), 'by', COALESCE(answered_by_name, ''), 'at', answered_at,
           'signature', CASE WHEN signed_at IS NULL THEN NULL ELSE jsonb_build_object('mode', signer_signature_mode, 'printedName', signer_printed_name, 'signedAt', signed_at, 'storagePath', signer_signature_storage_path) END,
           'photo', CASE WHEN photo_file_name IS NULL THEN NULL ELSE jsonb_build_object('fileName', photo_file_name, 'driveFileId', photo_drive_file_id, 'filedAt', photo_filed_at) END
         ) ORDER BY (job_id IS NOT NULL), sort_order, created_at, words), '[]'::jsonb)
    INTO v_asked, v_answered, v_signed, v_nos, v_filed_at, v_rows
  FROM qa;

  SELECT r.* INTO v_latest FROM public.stage_checklist_records r WHERE r.fixture_id = p_fixture_id ORDER BY r.version DESC LIMIT 1;

  IF v_asked > 0 AND v_answered = v_asked THEN
    IF v_latest.id IS NOT NULL AND v_latest.state = 'filed' THEN RETURN; END IF;
    SELECT a.answered_by, a.answered_by_name INTO v_filed_by, v_filed_by_name
      FROM public.stage_checklist_answers a
     WHERE a.fixture_id = p_fixture_id AND a.voided_at IS NULL AND a.pick IS NOT NULL
     ORDER BY a.answered_at DESC NULLS LAST LIMIT 1;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('words', t.words, 'by', s.skipped_by_name, 'why', s.why) ORDER BY t.sort_order), '[]'::jsonb) INTO v_skipped
      FROM public.stage_checklist_skips s JOIN public.stage_checklist_templates t ON t.id = s.question_id
     WHERE s.fixture_id = p_fixture_id AND s.put_back_at IS NULL;
    SELECT COALESCE(NULLIF(btrim(j.hcp_number), ''), NULLIF(btrim(j.click_number), ''), left(j.id::text, 8)) INTO v_job_number FROM public.jobs_ledger j WHERE j.id = v_job_id;
    -- The next number on the job, under the job's lock so two stages filed in the same breath never share one.
    PERFORM pg_advisory_xact_lock(hashtext('stage_checklist_records:' || v_job_id::text));
    SELECT COALESCE(MAX(r.record_no), 0) + 1 INTO v_record_no FROM public.stage_checklist_records r WHERE r.job_id = v_job_id;
    INSERT INTO public.stage_checklist_records (job_id, fixture_id, record_no, version, record_id, stage_name, stage_kind, state, filed_at, filed_by, filed_by_name, snapshot, answer_count, signed_count, no_count, pdf_file_name)
    VALUES (
      v_job_id, p_fixture_id, v_record_no, COALESCE(v_latest.version, 0) + 1,
      'CL-' || v_job_number || '-' || v_record_no::text,
      v_stage_name, v_kind, 'filed', COALESCE(v_filed_at, now()), v_filed_by, COALESCE(v_filed_by_name, ''),
      jsonb_build_object('rows', v_rows, 'skipped', v_skipped),
      v_answered, v_signed, v_nos,
      'CL-' || v_job_number || '-' || v_record_no::text || ' ' || v_stage_name || ' checklist.pdf'
    );
  ELSIF v_latest.id IS NOT NULL AND v_latest.state = 'filed' THEN
    -- A check added, a question skipped or an answer taken back: the filed version stays, the stage is open again.
    UPDATE public.stage_checklist_records
       SET state = 'amended', amended_at = now(), amended_by = auth.uid(),
           amended_by_name = COALESCE((SELECT u.name FROM public.users u WHERE u.id = auth.uid()), ''),
           amend_why = CASE WHEN v_asked = 0 THEN 'Every question was taken off or skipped' ELSE 'A check was added or an answer taken back' END,
           updated_at = now()
     WHERE id = v_latest.id;
  END IF;
END
$$;
COMMENT ON FUNCTION public.stage_checklist_record_settle(uuid) IS 'The record files itself (#237 PR 3): when every question on the stage is answered (the same rule as questionWaitsOn) and the latest record is not filed, a new version with the next record number and the rows as they stand; when a filed stage comes open again, the filed record reads amended. Called by the triggers on the answers, the questions and the skips.';

-- 4. The triggers.
CREATE OR REPLACE FUNCTION public.stage_checklist_answers_settle_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.stage_checklist_record_settle(OLD.fixture_id);
    RETURN OLD;
  END IF;
  PERFORM public.stage_checklist_record_settle(NEW.fixture_id);
  IF TG_OP = 'UPDATE' AND NEW.fixture_id IS DISTINCT FROM OLD.fixture_id THEN
    PERFORM public.stage_checklist_record_settle(OLD.fixture_id);
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS stage_checklist_answers_settle_record ON public.stage_checklist_answers;
CREATE TRIGGER stage_checklist_answers_settle_record
  AFTER INSERT OR UPDATE OR DELETE ON public.stage_checklist_answers
  FOR EACH ROW EXECUTE FUNCTION public.stage_checklist_answers_settle_record();

CREATE OR REPLACE FUNCTION public.stage_checklist_templates_settle_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fixture uuid;
BEGIN
  IF NEW.fixture_id IS NOT NULL THEN
    PERFORM public.stage_checklist_record_settle(NEW.fixture_id);
  ELSE
    -- A company question added or taken off reaches every stage of its kind that holds a record.
    FOR v_fixture IN SELECT DISTINCT r.fixture_id FROM public.stage_checklist_records r WHERE r.stage_kind = NEW.stage_kind LOOP
      PERFORM public.stage_checklist_record_settle(v_fixture);
    END LOOP;
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS stage_checklist_templates_settle_record ON public.stage_checklist_templates;
CREATE TRIGGER stage_checklist_templates_settle_record
  AFTER INSERT OR UPDATE OF retired_at, asks_photo, needs_signature ON public.stage_checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.stage_checklist_templates_settle_record();

CREATE OR REPLACE FUNCTION public.stage_checklist_skips_settle_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.stage_checklist_record_settle(NEW.fixture_id);
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS stage_checklist_skips_settle_record ON public.stage_checklist_skips;
CREATE TRIGGER stage_checklist_skips_settle_record
  AFTER INSERT OR UPDATE OF put_back_at ON public.stage_checklist_skips
  FOR EACH ROW EXECUTE FUNCTION public.stage_checklist_skips_settle_record();

-- 5. The office's Amend: the filed record reads amended with the reason, the stage is open again.
CREATE OR REPLACE FUNCTION public.amend_stage_checklist_record(p_record_id uuid, p_why text)
RETURNS public.stage_checklist_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record public.stage_checklist_records;
BEGIN
  SELECT r.* INTO v_record FROM public.stage_checklist_records r WHERE r.id = p_record_id;
  IF v_record.id IS NULL THEN
    RAISE EXCEPTION 'That record is gone.';
  END IF;
  IF NOT public.stage_checklist_may_author(v_record.job_id) THEN
    RAISE EXCEPTION 'Only the office, the superintendent on their own job or the estimator on a job they priced amends a checklist.' USING ERRCODE = '42501';
  END IF;
  IF v_record.state <> 'filed' THEN
    RAISE EXCEPTION 'That record is already amended; the stage is open.';
  END IF;
  IF length(btrim(COALESCE(p_why, ''))) < 3 THEN
    RAISE EXCEPTION 'Say why the record is amended.' USING ERRCODE = '23514';
  END IF;
  UPDATE public.stage_checklist_records
     SET state = 'amended', amended_at = now(), amended_by = auth.uid(),
         amended_by_name = COALESCE((SELECT u.name FROM public.users u WHERE u.id = auth.uid()), ''),
         amend_why = left(btrim(p_why), 200), updated_at = now()
   WHERE id = v_record.id
  RETURNING * INTO v_record;
  RETURN v_record;
END
$$;
REVOKE ALL ON FUNCTION public.amend_stage_checklist_record(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.amend_stage_checklist_record(uuid, text) TO authenticated;
COMMENT ON FUNCTION public.amend_stage_checklist_record(uuid, text) IS 'Amend (#237 PR 3): a filed record reads amended with who and why, so the stage is open again and the next completion files the next version; the filed version stays as it was. Whoever authors on the job.';

-- The gates: read by whoever may stamp the job's stages; no insert or update policy, since settle and amend run as the owner; a dev deletes.
ALTER TABLE public.stage_checklist_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stage_checklist_records_select ON public.stage_checklist_records;
CREATE POLICY stage_checklist_records_select ON public.stage_checklist_records FOR SELECT TO authenticated USING (public.can_report_stage_progress(job_id));
DROP POLICY IF EXISTS stage_checklist_records_delete ON public.stage_checklist_records;
CREATE POLICY stage_checklist_records_delete ON public.stage_checklist_records FOR DELETE TO authenticated USING (public.is_dev());

-- 6. The cron: every clause as 20261106030000 wrote it (20261030070000's rule: every earlier clause written again), and a
--    seventh while a record's PDF waits. Unscheduled first, so a second run leaves one row.
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
     OR EXISTS (SELECT 1 FROM public.job_photo_notes WHERE filed_at IS NULL AND storage_path IS NOT NULL AND added_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.machine_check_photos WHERE filed_at IS NULL AND storage_path IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.stage_checklist_records WHERE pdf_filed_at IS NULL AND pdf_tries < 5);
  $$
);

-- House rules for every CREATE TABLE: training-mode blocks and the digital-twin fence on the new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
