SET lock_timeout = '3s';
-- v2.6554: counsel-only evidence (punch list #269, PR 2). A record the office keeps for counsel alone: kept in the
-- hr-files bucket only, never filed in Drive, never read by the HR agent's key or by the dev seat as deployed. The
-- seat identifies itself with the header X-Dev-Seat on every PostgREST call; restrictive policies refuse it a
-- counsel-only record and that record's files. The agent's role reads attachments through its own policy, which
-- now leaves a counsel-only record's files out. THE LIMIT, stated here and in docs/HR_FILES.md: a dev signed in as
-- themself, or any client that runs the seat's code without the header, reads the row. The flag binds the agent and
-- Drive; it is not a second password. Additive and idempotent; no table is created, so no fence is owed.

ALTER TABLE public.person_file_evidence ADD COLUMN IF NOT EXISTS counsel_only boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.person_file_evidence.counsel_only IS
  'v2.6554: kept here only — never filed in Drive, never read by hr_agent or by the dev seat (X-Dev-Seat). Set on insert; to lift it, file the record again.';

-- Whether this request came through the dev seat: the header it sends on every call.
CREATE OR REPLACE FUNCTION public.request_is_dev_seat()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-dev-seat', '') <> ''
$$;

-- Whether a record is counsel-only, read past RLS so the policies on its files can ask.
CREATE OR REPLACE FUNCTION public.evidence_is_counsel_only(p_evidence_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT e.counsel_only FROM public.person_file_evidence e WHERE e.id = p_evidence_id), false)
$$;
REVOKE EXECUTE ON FUNCTION public.evidence_is_counsel_only(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evidence_is_counsel_only(uuid) TO authenticated;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hr_agent') THEN GRANT EXECUTE ON FUNCTION public.evidence_is_counsel_only(uuid) TO hr_agent; END IF; END $$;

-- The seat as deployed: a counsel-only record and its files are refused to it.
DROP POLICY IF EXISTS person_file_evidence_counsel_only_seat ON public.person_file_evidence;
CREATE POLICY person_file_evidence_counsel_only_seat ON public.person_file_evidence
  AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT (counsel_only AND public.request_is_dev_seat()));
DROP POLICY IF EXISTS person_file_attachments_counsel_only_seat ON public.person_file_attachments;
CREATE POLICY person_file_attachments_counsel_only_seat ON public.person_file_attachments
  AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT (public.request_is_dev_seat() AND evidence_id IS NOT NULL AND public.evidence_is_counsel_only(evidence_id)));

-- The agent's key: never a counsel-only record's files (it has no policy on the records themselves).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hr_agent') THEN
    DROP POLICY IF EXISTS "hr_agent reads person file attachments" ON public.person_file_attachments;
    CREATE POLICY "hr_agent reads person file attachments" ON public.person_file_attachments
      FOR SELECT TO hr_agent USING (evidence_id IS NULL OR NOT public.evidence_is_counsel_only(evidence_id));
  END IF;
END $$;

-- How many records a person's file holds from the seat: a count, never a row, so get_person_file can name the hold.
CREATE OR REPLACE FUNCTION public.person_counsel_only_count(p_person_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.is_dev() THEN (SELECT count(*)::integer FROM public.person_file_evidence e WHERE e.person_id = p_person_id AND e.counsel_only) ELSE 0 END
$$;
REVOKE EXECUTE ON FUNCTION public.person_counsel_only_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.person_counsel_only_count(uuid) TO authenticated;

-- dev_person_evidence_write takes counsel_only (the seat's plan_person_evidence); the rest of the function as v2.6544 left it.
CREATE OR REPLACE FUNCTION public.dev_person_evidence_write(p jsonb, p_dry_run boolean DEFAULT true, p_files jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_dev_name text;
  v_dev_email text;
  v_label text;
  v_person_id uuid;
  v_person_name text;
  v_entry_id uuid;
  v_dated date;
  v_title text := btrim(COALESCE(p->>'title', ''));
  v_memo text := btrim(COALESCE(p->>'memo', ''));
  -- v2.6554: counsel-only, kept here only — never filed in Drive, never read by the agent or by the seat as deployed.
  v_counsel boolean := COALESCE(NULLIF(btrim(COALESCE(p->>'counsel_only', '')), '')::boolean, false);
  v_files jsonb := COALESCE(p->'files', '[]'::jsonb);
  v_file jsonb;
  v_count integer;
  v_linked integer := 0;
  v_bytes bigint := 0;
  v_live integer;
  v_people_folder text;
  v_where text;
  v_evidence_id uuid;
  v_stored jsonb;
  v_row jsonb;
  v_file_id uuid;
  v_path text;
  v_url text;
  v_drive_id text;
  v_prefix text;
  v_ids jsonb := '[]'::jsonb;
  v_after jsonb := '[]'::jsonb;
  i integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_person_evidence_write: devs only' USING ERRCODE = '42501';
  END IF;

  SELECT u.name, u.email INTO v_dev_name, v_dev_email FROM public.users u WHERE u.id = auth.uid();
  v_label := COALESCE(NULLIF(btrim(v_dev_name), ''), v_dev_email);
  IF v_label IS NULL THEN
    RAISE EXCEPTION 'dev_person_evidence_write: no users row for the caller';
  END IF;

  IF COALESCE(p->>'person_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
    RAISE EXCEPTION 'dev_person_evidence_write: person_id is required (a people.id)';
  END IF;
  v_person_id := (p->>'person_id')::uuid;
  SELECT pe.name INTO v_person_name FROM public.people pe WHERE pe.id = v_person_id;
  IF v_person_name IS NULL THEN
    RAISE EXCEPTION 'dev_person_evidence_write: person % not found', v_person_id;
  END IF;

  IF COALESCE(p->>'entry_id', '') <> '' THEN
    IF p->>'entry_id' !~ '^[0-9a-fA-F-]{36}$' THEN
      RAISE EXCEPTION 'dev_person_evidence_write: entry_id must be a person_file_entries.id';
    END IF;
    v_entry_id := (p->>'entry_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.person_file_entries e WHERE e.id = v_entry_id AND e.person_id = v_person_id) THEN
      RAISE EXCEPTION 'dev_person_evidence_write: entry % is not on this person''s file', v_entry_id;
    END IF;
  END IF;

  -- The panel's rules (evidenceDraftProblem): the day, a title, a memo, a file or a link to one — all four.
  BEGIN
    v_dated := NULLIF(p->>'dated_on', '')::date;
  EXCEPTION WHEN OTHERS THEN
    v_dated := NULL;
  END;
  IF v_dated IS NULL THEN
    RAISE EXCEPTION 'dev_person_evidence_write: dated_on is required (YYYY-MM-DD, the day it is about)';
  END IF;
  IF v_dated > public.app_today() THEN
    RAISE EXCEPTION 'dev_person_evidence_write: the day it is about cannot be ahead of today';
  END IF;
  IF v_title = '' THEN RAISE EXCEPTION 'dev_person_evidence_write: give it a title'; END IF;
  IF length(v_title) > 160 THEN RAISE EXCEPTION 'dev_person_evidence_write: the title is over 160 characters'; END IF;
  IF v_memo = '' THEN RAISE EXCEPTION 'dev_person_evidence_write: write a memo: what it shows and why it matters'; END IF;
  IF length(v_memo) > 4000 THEN RAISE EXCEPTION 'dev_person_evidence_write: the memo is over 4,000 characters'; END IF;
  IF jsonb_typeof(v_files) <> 'array' OR jsonb_array_length(v_files) = 0 THEN
    RAISE EXCEPTION 'dev_person_evidence_write: add at least one file, or a link to one already in Drive: a photo, a PDF, an email, a screenshot, a recording';
  END IF;
  v_count := jsonb_array_length(v_files);
  IF v_count > 20 THEN
    RAISE EXCEPTION 'dev_person_evidence_write: at most 20 files a record; plan a second record for the rest';
  END IF;
  FOR v_file IN SELECT * FROM jsonb_array_elements(v_files) LOOP
    IF btrim(COALESCE(v_file->>'name', '')) = '' THEN RAISE EXCEPTION 'dev_person_evidence_write: one of the files has no name'; END IF;
    IF length(btrim(v_file->>'name')) > 200 THEN RAISE EXCEPTION 'dev_person_evidence_write: % has a name over 200 characters', left(v_file->>'name', 40); END IF;
    IF btrim(COALESCE(v_file->>'drive_url', '')) <> '' THEN
      -- A linked file (v2.6541): already in Drive, never staged. Its address is all it carries.
      IF btrim(v_file->>'drive_url') !~ '^https://(drive|docs)\.google\.com/\S+$' THEN
        RAISE EXCEPTION 'dev_person_evidence_write: % is not a Drive address (drive.google.com or docs.google.com)', v_file->>'name';
      END IF;
      v_linked := v_linked + 1;
      v_after := v_after || jsonb_build_object('name', btrim(v_file->>'name'), 'drive_url', btrim(v_file->>'drive_url'), 'linked', true);
      CONTINUE;
    END IF;
    IF btrim(COALESCE(v_file->>'mime', '')) = '' THEN RAISE EXCEPTION 'dev_person_evidence_write: % has no mime', v_file->>'name'; END IF;
    IF COALESCE(v_file->>'size_bytes', '') !~ '^[0-9]+$' OR (v_file->>'size_bytes')::bigint < 1 THEN
      RAISE EXCEPTION 'dev_person_evidence_write: % is empty', v_file->>'name';
    END IF;
    IF (v_file->>'size_bytes')::bigint > 10485760 THEN
      RAISE EXCEPTION 'dev_person_evidence_write: % is over 10 MB; put it in the person''s Drive folder by hand and send it as { name, drive_url }', v_file->>'name';
    END IF;
    IF lower(COALESCE(v_file->>'sha256', '')) !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'dev_person_evidence_write: % needs its sha256, 64 hex characters', v_file->>'name';
    END IF;
    v_bytes := v_bytes + (v_file->>'size_bytes')::bigint;
    v_after := v_after || jsonb_build_object('name', btrim(v_file->>'name'), 'mime', btrim(v_file->>'mime'), 'size_bytes', (v_file->>'size_bytes')::bigint, 'sha256', lower(v_file->>'sha256'));
  END LOOP;

  SELECT count(*) INTO v_live FROM public.person_file_evidence WHERE person_id = v_person_id;
  SELECT value_text INTO v_people_folder FROM public.app_settings WHERE key = 'drive_people_folder_id';
  -- evidenceDrivePathWords: People › <person> › <day · title>, slashes and control characters as spaces, the folder at most 120.
  v_where := 'People › ' || COALESCE(NULLIF(btrim(regexp_replace(v_person_name, '[\\/[:cntrl:]]+', ' ', 'g')), ''), 'this person') || ' › '
    || btrim(left(v_dated::text || ' · ' || btrim(regexp_replace(v_title, '[\\/[:cntrl:]]+', ' ', 'g')), 120));

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'person', jsonb_build_object('id', v_person_id, 'name', v_person_name),
      'author_label', v_label,
      'after', jsonb_build_object(
        'dated_on', v_dated, 'title', v_title, 'memo', v_memo, 'counsel_only', v_counsel, 'entry_id', v_entry_id,
        'files', v_after
      ),
      'files', v_count,
      'linked', v_linked,
      'bytes', v_bytes,
      'where', v_where,
      'evidence_on_person', v_live,
      'people_folder_set', COALESCE(v_people_folder, '') <> '',
      'then', CASE
        WHEN v_linked = v_count THEN 'apply writes the record and its linked file rows as you; nothing is staged and Drive is not asked, since every file is already there.'
        WHEN COALESCE(v_people_folder, '') <> ''
        THEN 'apply stages each file in the hr-files bucket, writes the record and its file rows as you (a linked file as its link alone), then asks hr-evidence-drive to file the staged ones into the People Shared Drive.'
        ELSE 'apply stages each file in the hr-files bucket and writes the record and its file rows as you (a linked file as its link alone); Drive waits until the People folder is set on Documents → Where files go, and the sweep files the staged ones then.' END
    );
  END IF;

  -- The write. The function stored every staged file first; p_files names the record and each file's row — a staged one
  -- by its storage_path, a linked one by its drive_url — in the plan's order. No object, no rows.
  IF COALESCE(p_files->>'evidence_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
    RAISE EXCEPTION 'dev_person_evidence_write: the files must be stored first (p_files.evidence_id, p_files.files[{ id, storage_path | drive_url }])';
  END IF;
  v_evidence_id := (p_files->>'evidence_id')::uuid;
  IF EXISTS (SELECT 1 FROM public.person_file_evidence WHERE id = v_evidence_id) THEN
    RAISE EXCEPTION 'dev_person_evidence_write: record % already exists', v_evidence_id;
  END IF;
  v_stored := COALESCE(p_files->'files', '[]'::jsonb);
  IF jsonb_typeof(v_stored) <> 'array' OR jsonb_array_length(v_stored) <> v_count THEN
    RAISE EXCEPTION 'dev_person_evidence_write: p_files.files must name every file of the plan, in order (% planned)', v_count;
  END IF;
  v_prefix := v_person_id::text || '/evidence/' || v_evidence_id::text || '/';
  FOR i IN 0 .. v_count - 1 LOOP
    v_row := v_stored->i;
    v_file := v_files->i;
    IF COALESCE(v_row->>'id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
      RAISE EXCEPTION 'dev_person_evidence_write: stored file % has no id', i + 1;
    END IF;
    v_file_id := (v_row->>'id')::uuid;
    IF EXISTS (SELECT 1 FROM public.person_file_attachments WHERE id = v_file_id) THEN
      RAISE EXCEPTION 'dev_person_evidence_write: file % already exists', v_file_id;
    END IF;
    IF btrim(COALESCE(v_file->>'drive_url', '')) <> '' THEN
      IF btrim(COALESCE(v_row->>'drive_url', '')) <> btrim(v_file->>'drive_url') THEN
        RAISE EXCEPTION 'dev_person_evidence_write: linked file % must be named by its drive_url in p_files, as planned', i + 1;
      END IF;
      CONTINUE;
    END IF;
    v_path := btrim(COALESCE(v_row->>'storage_path', ''));
    IF v_path NOT LIKE (v_prefix || v_file_id::text || '-%') THEN
      RAISE EXCEPTION 'dev_person_evidence_write: % is not under this record''s folder in hr-files', v_path;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'hr-files' AND name = v_path) THEN
      RAISE EXCEPTION 'dev_person_evidence_write: % is not in the hr-files bucket', v_path;
    END IF;
  END LOOP;

  INSERT INTO public.person_file_evidence (id, person_id, entry_id, dated_on, title, memo, created_by, author_label, counsel_only)
  VALUES (v_evidence_id, v_person_id, v_entry_id, v_dated, v_title, v_memo, auth.uid(), v_label, v_counsel);
  FOR i IN 0 .. v_count - 1 LOOP
    v_row := v_stored->i;
    v_file := v_files->i;
    v_file_id := (v_row->>'id')::uuid;
    IF btrim(COALESCE(v_file->>'drive_url', '')) <> '' THEN
      v_url := btrim(v_file->>'drive_url');
      -- driveFileIdFromUrl: /file/d/<id>, /document/d/<id>, /folders/<id>, ?id=<id>; null when the link names none.
      v_drive_id := COALESCE(
        (regexp_match(v_url, '/(?:file|document|spreadsheets|presentation)/d/([A-Za-z0-9_-]{10,})'))[1],
        (regexp_match(v_url, '/folders/([A-Za-z0-9_-]{10,})'))[1],
        (regexp_match(v_url, '[?&]id=([A-Za-z0-9_-]{10,})'))[1]
      );
      INSERT INTO public.person_file_attachments (id, person_id, entry_id, evidence_id, storage_path, filename, mime_type, size_bytes, drive_file_id, drive_url, filed_at, uploaded_by, author_label)
      VALUES (v_file_id, v_person_id, v_entry_id, v_evidence_id, NULL, btrim(v_file->>'name'), NULL, NULL, v_drive_id, v_url, now(), auth.uid(), v_label);
      v_ids := v_ids || jsonb_build_object('id', v_file_id, 'name', btrim(v_file->>'name'), 'drive_url', v_url, 'linked', true);
      CONTINUE;
    END IF;
    INSERT INTO public.person_file_attachments (id, person_id, entry_id, evidence_id, storage_path, filename, mime_type, size_bytes, sha256, uploaded_by, author_label)
    VALUES (v_file_id, v_person_id, v_entry_id, v_evidence_id, btrim(v_row->>'storage_path'), btrim(v_file->>'name'), btrim(v_file->>'mime'), (v_file->>'size_bytes')::bigint, lower(v_file->>'sha256'), auth.uid(), v_label);
    v_ids := v_ids || jsonb_build_object('id', v_file_id, 'name', btrim(v_file->>'name'), 'storage_path', btrim(v_row->>'storage_path'), 'sha256', lower(v_file->>'sha256'));
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'evidence_id', v_evidence_id, 'person_id', v_person_id, 'person_name', v_person_name, 'files', v_ids, 'linked', v_linked, 'staged', v_count - v_linked, 'where', v_where);
END;
$fn$;
