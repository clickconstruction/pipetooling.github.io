SET lock_timeout = '3s';

-- A Drive-linked evidence record marked as superseded by a named document (punch list #277, open call 2, v2.6704).
--
-- On 2026-11-07 two long documents about a former teammate went onto the HR file as evidence records that only link a
-- Drive file, because the app had no other door for a long text. v2.6613–v2.6615 gave the file named documents, and the
-- owner's call on 2026-11-08: once those documents are in, the two records are marked superseded — a note on each,
-- nothing deleted, the record and its link staying in place. Three nullable columns on person_file_evidence and one
-- dev-only function set them: person_evidence_supersede(p_evidence_id, p_document_id) stamps the record with the
-- document, the moment and the dev; p_document_id NULL lifts the mark. The record must only link Drive files (no bytes
-- staged here), the document must be a kept named document of the same person. The table stays append-only for every
-- other column: no UPDATE policy is added; the function is the one door.
--
-- Additive and idempotent; no table is created, so no fence is owed.
ALTER TABLE public.person_file_evidence ADD COLUMN IF NOT EXISTS superseded_by_document_id uuid NULL REFERENCES public.person_documents(id) ON DELETE SET NULL;
ALTER TABLE public.person_file_evidence ADD COLUMN IF NOT EXISTS superseded_at timestamptz NULL;
ALTER TABLE public.person_file_evidence ADD COLUMN IF NOT EXISTS superseded_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.person_file_evidence.superseded_by_document_id IS
  'v2.6704: the named document (person_documents) that now carries what this Drive-linked record pointed at. The record stays, with its link; set and lifted by person_evidence_supersede.';

CREATE OR REPLACE FUNCTION public.person_evidence_supersede(p_evidence_id uuid, p_document_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_rec public.person_file_evidence%ROWTYPE;
  v_doc public.person_documents%ROWTYPE;
  v_files integer;
  v_linked integer;
  v_now timestamptz := now();
  v_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'person_evidence_supersede: devs only' USING ERRCODE = '42501';
  END IF;
  IF p_evidence_id IS NULL THEN
    RAISE EXCEPTION 'person_evidence_supersede: p_evidence_id is required (a person_file_evidence.id)';
  END IF;
  SELECT * INTO v_rec FROM public.person_file_evidence WHERE id = p_evidence_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'person_evidence_supersede: no evidence record %', p_evidence_id;
  END IF;

  IF p_document_id IS NULL THEN
    -- The way back: the mark lifted, the record as it was.
    IF v_rec.superseded_by_document_id IS NULL THEN
      RAISE EXCEPTION 'person_evidence_supersede: "%" is not marked superseded', v_rec.title;
    END IF;
    UPDATE public.person_file_evidence
       SET superseded_by_document_id = NULL, superseded_at = NULL, superseded_by = NULL
     WHERE id = p_evidence_id;
    RETURN jsonb_build_object('ok', true, 'evidence_id', p_evidence_id, 'superseded', false);
  END IF;

  SELECT count(*), count(*) FILTER (WHERE storage_path IS NULL AND drive_url IS NOT NULL)
    INTO v_files, v_linked
    FROM public.person_file_attachments WHERE evidence_id = p_evidence_id;
  IF v_files = 0 OR v_linked <> v_files THEN
    RAISE EXCEPTION 'person_evidence_supersede: "%" keeps % file(s) here, not only Drive links; the mark is for a record that only links a Drive file', v_rec.title, v_files - v_linked;
  END IF;
  SELECT * INTO v_doc FROM public.person_documents WHERE id = p_document_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'person_evidence_supersede: no named document %', p_document_id;
  END IF;
  IF v_doc.person_id <> v_rec.person_id THEN
    RAISE EXCEPTION 'person_evidence_supersede: "%" is on another person''s file', v_doc.title;
  END IF;
  IF v_doc.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'person_evidence_supersede: "%" is archived; bring it back first, or pick a kept document', v_doc.title;
  END IF;
  IF v_rec.superseded_by_document_id IS NOT NULL AND v_rec.superseded_by_document_id <> p_document_id THEN
    RAISE EXCEPTION 'person_evidence_supersede: "%" is already marked superseded by another document; lift that mark first (p_document_id null)', v_rec.title;
  END IF;

  SELECT COALESCE(NULLIF(btrim(u.name), ''), u.email) INTO v_name FROM public.users u WHERE u.id = auth.uid();
  UPDATE public.person_file_evidence
     SET superseded_by_document_id = p_document_id, superseded_at = v_now, superseded_by = auth.uid()
   WHERE id = p_evidence_id;
  RETURN jsonb_build_object(
    'ok', true, 'evidence_id', p_evidence_id, 'superseded', true,
    'document', jsonb_build_object('id', v_doc.id, 'title', v_doc.title),
    'superseded_at', v_now, 'by', v_name
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.person_evidence_supersede(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.person_evidence_supersede(uuid, uuid) TO authenticated;
