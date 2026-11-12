SET lock_timeout = '3s';

-- v2.6986: the dev seat reads counsel-only material, for now.
--
-- The owner, 2026-11-11: "Because only devs and council can see the council only things, I think it's totally fine for
-- an agent to, And we can drop the security around council only decisions, for now." Asked whether that reaches the
-- records the agent notes had kept closed and the passages on a minor or a medical matter: "Yes, those too".
--
-- Until now the seat (dev-mcp, which sends X-Dev-Seat on every call) was refused, by six restrictive policies and one
-- check inside dev_matter_doc_read, a counsel-only evidence record, its files, their indexed text, the correction links
-- that touch one, a counsel-only matter document and its words. A dev signed in already read all of it; the seat reads
-- as that dev, so it now reads it too.
--
-- What does NOT change, because the owner's condition is that only devs and counsel see this material:
--   * the Drive filer still skips a counsel-only record (nothing new reaches the People Shared Drive);
--   * the firm's portal still locks a counsel-only paper and the printed packet still leaves it out;
--   * the HR agent's key (hr_agent) is still refused a counsel-only record's files and links;
--   * every policy below still requires is_dev() through the table's own permissive policies.
--
-- One switch, so "for now" is easy to undo: each fence now also asks counsel_only_held_from_seat(), which answers false.
-- To put the fence back, one migration replaces its body with `SELECT true`; no policy or function needs rewriting.
-- No table is created, so no fence call is owed.

CREATE OR REPLACE FUNCTION public.counsel_only_held_from_seat()
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  -- v2.6986: false — the owner opened counsel-only material to the dev seat. true puts every seat fence back.
  SELECT false
$$;
COMMENT ON FUNCTION public.counsel_only_held_from_seat() IS
  'v2.6986: whether counsel-only material is held from the dev seat (X-Dev-Seat). false since the owner opened it to the seat on 2026-11-11 ("for now"); replace the body with SELECT true to put every seat fence back.';
REVOKE EXECUTE ON FUNCTION public.counsel_only_held_from_seat() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.counsel_only_held_from_seat() TO authenticated;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hr_agent') THEN GRANT EXECUTE ON FUNCTION public.counsel_only_held_from_seat() TO hr_agent; END IF; END $$;

-- The six seat fences, each as it stood with the switch added (20261106020000, 20261108200000, 20261108230000, 20261112050000).
ALTER POLICY person_file_evidence_counsel_only_seat ON public.person_file_evidence
  USING (NOT (counsel_only AND public.request_is_dev_seat() AND public.counsel_only_held_from_seat()));

ALTER POLICY person_file_attachments_counsel_only_seat ON public.person_file_attachments
  USING (NOT (public.request_is_dev_seat() AND public.counsel_only_held_from_seat() AND evidence_id IS NOT NULL AND public.evidence_is_counsel_only(evidence_id)));

ALTER POLICY file_index_counsel_only_seat ON public.file_index
  USING (NOT (counsel_only AND public.request_is_dev_seat() AND public.counsel_only_held_from_seat()));

ALTER POLICY legal_matter_documents_counsel_only_seat ON public.legal_matter_documents
  USING (NOT (counsel_only AND public.request_is_dev_seat() AND public.counsel_only_held_from_seat()));

ALTER POLICY documents_matter_counsel_only_seat ON public.documents
  USING (NOT (matter_id IS NOT NULL AND public.request_is_dev_seat() AND public.counsel_only_held_from_seat() AND public.matter_text_document_is_counsel_only(id)));

ALTER POLICY person_file_amendments_counsel_only_seat ON public.person_file_amendments
  USING (NOT (
    public.request_is_dev_seat()
    AND public.counsel_only_held_from_seat()
    AND ((from_kind = 'hr_evidence' AND public.evidence_is_counsel_only(from_id)) OR (to_kind = 'hr_evidence' AND public.evidence_is_counsel_only(to_id)))));

-- dev_matter_doc_read (20261108233000) as it stood, the counsel-only refusal now asking the switch too.
CREATE OR REPLACE FUNCTION public.dev_matter_doc_read(p_matter_id uuid, p_doc_id uuid, p_section text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_row public.legal_matter_documents%ROWTYPE;
  v_text text;
  v_target jsonb;
  v_held integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_matter_doc_read: devs only' USING ERRCODE = '42501';
  END IF;
  IF p_matter_id IS NULL OR p_doc_id IS NULL THEN
    RAISE EXCEPTION 'dev_matter_doc_read: matter_id and doc_id (the Evidence row) are required';
  END IF;
  SELECT * INTO v_row FROM public.legal_matter_documents d WHERE d.id = p_doc_id AND d.matter_id = p_matter_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dev_matter_doc_read: no document % on this matter', p_doc_id;
  END IF;
  IF v_row.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'dev_matter_doc_read: document % was removed from the matter', p_doc_id;
  END IF;
  IF v_row.counsel_only AND public.request_is_dev_seat() AND public.counsel_only_held_from_seat() THEN
    SELECT count(*) INTO v_held FROM public.legal_matter_documents d WHERE d.matter_id = p_matter_id AND d.counsel_only AND d.voided_at IS NULL;
    RAISE EXCEPTION 'dev_matter_doc_read: "%" is for counsel alone — refused to the seat as deployed (% on this matter); a dev signed in reads it on the Legal desk', v_row.title, v_held USING ERRCODE = '42501';
  END IF;
  IF v_row.text_document_id IS NULL THEN
    RAISE EXCEPTION 'dev_matter_doc_read: "%" is a % (%), not a text document; its bytes are on the Evidence tab, and its title and what it shows are what search_case reads', v_row.title, v_row.mime, v_row.original_name;
  END IF;
  SELECT t.content, jsonb_build_object('document_id', v_row.id, 'text_document_id', t.id, 'title', v_row.title, 'shows', v_row.shows, 'state', v_row.state,
                                       'dated_on', v_row.dated_on, 'counsel_only', v_row.counsel_only, 'mime', v_row.mime, 'original_name', v_row.original_name,
                                       'updated_at', t.updated_at, 'kept_by', t.author_label, 'chars', length(t.content), 'archived_at', t.archived_at)
    INTO v_text, v_target
    FROM public.documents t WHERE t.id = v_row.text_document_id;
  IF v_text IS NULL THEN
    RAISE EXCEPTION 'dev_matter_doc_read: the words of "%" are not in documents any more', v_row.title;
  END IF;
  RETURN jsonb_build_object('target', v_target) || public.hr_doc_slice(v_text, p_section, 'dev_matter_doc_read');
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.dev_matter_doc_read(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_matter_doc_read(uuid, uuid, text) TO authenticated;
