SET lock_timeout = '3s';
-- v2.6004: dev_legal_document_write — the dev MCP's dry-run wrapper for a document on a legal
-- matter's Evidence tab (plan_matter_document → apply_matter_document), modeled on
-- dev_legal_plan_write. The dry run names the matter and the row that would be written; the
-- write inserts the legal_matter_documents row AS THE DEV (auth.uid(), stamped by
-- legal_matter_documents_stamp) once the file is in the legal-matter-documents bucket under the
-- matter's folder: the dev-mcp function stores the file first and names it in p_file, and the
-- row is refused when the object is not there. Training mode is blocked by the table's
-- statement trigger like any other write.
--
-- Additive and idempotent; no table is created, so no read-only fence is owed.

CREATE OR REPLACE FUNCTION public.dev_legal_document_write(p jsonb, p_dry_run boolean DEFAULT true, p_file jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_matter public.legal_matters%ROWTYPE;
  v_title text := btrim(COALESCE(p->>'title', ''));
  v_shows text := btrim(COALESCE(p->>'shows', ''));
  v_name text := btrim(COALESCE(p->>'original_name', ''));
  v_mime text := lower(btrim(COALESCE(p->>'mime', '')));
  v_size bigint := NULLIF(p->>'size_bytes', '')::bigint;
  v_sha text := lower(btrim(COALESCE(p->>'sha256', '')));
  v_state text := COALESCE(NULLIF(btrim(p->>'state'), ''), 'final');
  v_dated date := NULLIF(p->>'dated_on', '')::date;
  v_received date := NULLIF(p->>'received_on', '')::date;
  v_sent_on date := NULLIF(p->>'sent_on', '')::date;
  v_sent_how text := COALESCE(NULLIF(btrim(p->>'sent_how'), ''), '');
  v_sent_to text := btrim(COALESCE(p->>'sent_to', ''));
  v_id uuid;
  v_path text;
  v_live integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_legal_document_write: devs only' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(p->>'matter_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
    RAISE EXCEPTION 'dev_legal_document_write: matter_id is required (a legal_matters.id)';
  END IF;
  SELECT * INTO v_matter FROM public.legal_matters WHERE id = (p->>'matter_id')::uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dev_legal_document_write: matter % not found', p->>'matter_id';
  END IF;
  IF v_title = '' THEN RAISE EXCEPTION 'dev_legal_document_write: give the document a title'; END IF;
  IF v_shows = '' THEN RAISE EXCEPTION 'dev_legal_document_write: say in one line what it shows'; END IF;
  IF length(v_title) > 200 OR length(v_shows) > 1000 THEN
    RAISE EXCEPTION 'dev_legal_document_write: keep the title under 200 characters and what it shows under 1,000';
  END IF;
  IF v_name = '' THEN RAISE EXCEPTION 'dev_legal_document_write: original_name is required (the file name)'; END IF;
  -- The same kinds the Evidence tab takes (LEGAL_DOCUMENT_MIMES in _shared/legalMatterDocuments.ts).
  IF v_mime NOT IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'message/rfc822', 'text/plain') THEN
    RAISE EXCEPTION 'dev_legal_document_write: % is not a kind the portal takes (PDF, an image, an email as .eml, or plain text)', v_mime;
  END IF;
  IF v_size IS NULL OR v_size < 1 OR v_size > 10485760 THEN
    RAISE EXCEPTION 'dev_legal_document_write: the file must be between 1 byte and 10 MB';
  END IF;
  IF v_sha !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'dev_legal_document_write: sha256 must be the file''s digest, 64 hex characters';
  END IF;
  IF v_state NOT IN ('draft', 'final', 'sent', 'received') THEN
    RAISE EXCEPTION 'dev_legal_document_write: state is draft, final, sent or received';
  END IF;
  IF v_state = 'sent' THEN
    v_sent_on := COALESCE(v_sent_on, public.app_today());
    IF v_sent_how NOT IN ('email', 'certified_mail', 'mail', 'hand', 'other') THEN
      RAISE EXCEPTION 'dev_legal_document_write: a sent paper needs sent_how: email, certified_mail, mail, hand or other';
    END IF;
    IF v_sent_to = '' THEN RAISE EXCEPTION 'dev_legal_document_write: a sent paper needs sent_to, who it went to'; END IF;
  ELSE
    v_sent_on := NULL; v_sent_how := ''; v_sent_to := '';
  END IF;
  IF v_state = 'received' THEN
    v_received := COALESCE(v_received, v_dated, public.app_today());
  ELSE
    v_received := NULL;
  END IF;
  SELECT count(*) INTO v_live FROM public.legal_matter_documents WHERE matter_id = v_matter.id AND voided_at IS NULL;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'matter', jsonb_build_object('id', v_matter.id, 'payer_name', v_matter.payer_name, 'stage', v_matter.stage),
      'after', jsonb_build_object(
        'title', v_title, 'shows', v_shows, 'original_name', v_name, 'mime', v_mime, 'size_bytes', v_size, 'sha256', v_sha,
        'dated_on', v_dated, 'state', v_state, 'sent_on', v_sent_on, 'sent_how', v_sent_how, 'sent_to', v_sent_to, 'received_on', v_received
      ),
      'documents_on_matter', v_live,
      -- The portal's own stage set (LEGAL_PORTAL_STAGES in _shared/legalStages.ts).
      'firm_reads_it', v_matter.stage IN ('referred', 'demand', 'suit', 'judgment', 'post_judgment', 'payment_plan', 'settled', 'uncollectible', 'dismissed') AND v_matter.closed_at IS NULL AND v_matter.firm_id IS NOT NULL
    );
  END IF;

  -- The write. The function stored the file first; p_file names it. No object in the bucket, no row.
  v_id := NULLIF(p_file->>'id', '')::uuid;
  v_path := btrim(COALESCE(p_file->>'storage_path', ''));
  IF v_id IS NULL OR v_path = '' THEN
    RAISE EXCEPTION 'dev_legal_document_write: the file must be stored first (p_file.id, p_file.storage_path)';
  END IF;
  IF v_path NOT LIKE (v_matter.id::text || '/' || v_id::text || '-%') THEN
    RAISE EXCEPTION 'dev_legal_document_write: the storage path is not under this matter''s folder';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'legal-matter-documents' AND name = v_path) THEN
    RAISE EXCEPTION 'dev_legal_document_write: % is not in the legal-matter-documents bucket', v_path;
  END IF;
  IF EXISTS (SELECT 1 FROM public.legal_matter_documents WHERE id = v_id) THEN
    RAISE EXCEPTION 'dev_legal_document_write: document % already exists', v_id;
  END IF;
  INSERT INTO public.legal_matter_documents (id, matter_id, title, shows, storage_path, mime, size_bytes, original_name, dated_on, state, received_on, sent_on, sent_how, sent_to, added_by)
  VALUES (v_id, v_matter.id, v_title, v_shows, v_path, v_mime, v_size, v_name, v_dated, v_state, v_received, v_sent_on, v_sent_how, v_sent_to, auth.uid());
  RETURN jsonb_build_object('ok', true, 'document_id', v_id, 'matter_id', v_matter.id, 'storage_path', v_path, 'state', v_state);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dev_legal_document_write(jsonb, boolean, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_legal_document_write(jsonb, boolean, jsonb) TO authenticated;
COMMENT ON FUNCTION public.dev_legal_document_write(jsonb, boolean, jsonb) IS
  'The dev MCP''s wrapper for a document on a legal matter''s Evidence tab (v2.6004): p = { matter_id, title, shows, original_name, mime, size_bytes, sha256, dated_on?, state?, received_on?, sent_on?, sent_how?, sent_to? }. p_dry_run true names the matter and the row that would be written; false inserts the legal_matter_documents row as the caller once the file named in p_file (id, storage_path) is in the legal-matter-documents bucket under the matter''s folder. Devs only.';
