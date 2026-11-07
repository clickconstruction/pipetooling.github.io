SET lock_timeout = '3s';

-- get_document_history (v2.6622, punch list #278 PR 4): what moved on a document on a person's HR file. Every save of
-- the summary, the narrative (person_file_revisions, 20260824141540) and a named document (person_document_revisions,
-- 20261107040000) keeps the prior version by trigger; nothing read them. dev_doc_history lists a document's revisions
-- — when each was replaced, by whom, how big it was — with the current row as "now", and hands back two versions'
-- texts when asked by id (the seat diffs them server-side; only the diff reaches the agent). Devs only. No table.

CREATE OR REPLACE FUNCTION public.dev_doc_history(p_person_id uuid, p_doc_id uuid DEFAULT NULL, p_kind text DEFAULT NULL, p_from uuid DEFAULT NULL, p_to uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_named boolean;
  v_now jsonb;
  v_now_text text;
  v_revisions jsonb;
  v_from jsonb;
  v_to jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_doc_history: devs only' USING ERRCODE = '42501';
  END IF;
  IF p_person_id IS NULL THEN
    RAISE EXCEPTION 'dev_doc_history: person_id is required';
  END IF;
  IF (p_doc_id IS NULL) = (COALESCE(btrim(p_kind), '') = '') THEN
    RAISE EXCEPTION 'dev_doc_history: name the document — doc_id (a named document) or kind (summary | narrative), one of the two';
  END IF;
  v_named := p_doc_id IS NOT NULL;

  IF v_named THEN
    SELECT jsonb_build_object('doc_id', d.id, 'title', d.title, 'counsel_only', d.counsel_only, 'updated_at', d.updated_at, 'kept_by', d.author_label,
                              'updated_by', u.name, 'chars', length(d.content), 'archived_at', d.archived_at), d.content
      INTO v_now, v_now_text
      FROM public.person_documents d LEFT JOIN public.users u ON u.id = d.updated_by
     WHERE d.id = p_doc_id AND d.person_id = p_person_id;
    IF v_now IS NULL THEN
      RAISE EXCEPTION 'dev_doc_history: no document % on this person', p_doc_id;
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', r.id, 'replaced_at', r.replaced_at, 'replaced_by', COALESCE(u.name, r.replaced_by_label), 'kept_by', r.author_label,
                                                 'title', r.title, 'counsel_only', r.counsel_only, 'chars', length(r.content)) ORDER BY r.replaced_at DESC), '[]'::jsonb)
      INTO v_revisions
      FROM public.person_document_revisions r LEFT JOIN public.users u ON u.id = r.replaced_by
     WHERE r.document_id = p_doc_id;
  ELSE
    IF btrim(p_kind) NOT IN ('summary', 'narrative') THEN
      RAISE EXCEPTION 'dev_doc_history: kind must be summary or narrative';
    END IF;
    SELECT jsonb_build_object('kind', f.kind, 'title', f.kind, 'counsel_only', false, 'updated_at', f.updated_at, 'kept_by', f.author_label,
                              'updated_by', u.name, 'chars', length(f.content), 'covered_through', f.covered_through), f.content
      INTO v_now, v_now_text
      FROM public.person_files f LEFT JOIN public.users u ON u.id = f.updated_by
     WHERE f.person_id = p_person_id AND f.kind = btrim(p_kind);
    IF v_now IS NULL THEN
      RAISE EXCEPTION 'dev_doc_history: this person has no % yet', btrim(p_kind);
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', r.id, 'replaced_at', r.replaced_at, 'replaced_by', COALESCE(u.name, r.replaced_by_label), 'kept_by', r.author_label,
                                                 'title', r.kind, 'counsel_only', false, 'chars', length(r.content), 'covered_through', r.covered_through) ORDER BY r.replaced_at DESC), '[]'::jsonb)
      INTO v_revisions
      FROM public.person_file_revisions r LEFT JOIN public.users u ON u.id = r.replaced_by
     WHERE r.person_id = p_person_id AND r.kind = btrim(p_kind);
  END IF;

  -- Two versions' texts, when asked: p_from a revision id; p_to a revision id, or null for the current text.
  IF p_from IS NOT NULL THEN
    IF v_named THEN
      SELECT jsonb_build_object('id', r.id, 'replaced_at', r.replaced_at, 'content', r.content) INTO v_from
        FROM public.person_document_revisions r WHERE r.id = p_from AND r.document_id = p_doc_id;
    ELSE
      SELECT jsonb_build_object('id', r.id, 'replaced_at', r.replaced_at, 'content', r.content) INTO v_from
        FROM public.person_file_revisions r WHERE r.id = p_from AND r.person_id = p_person_id AND r.kind = btrim(p_kind);
    END IF;
    IF v_from IS NULL THEN
      RAISE EXCEPTION 'dev_doc_history: no revision % of this document', p_from;
    END IF;
    IF p_to IS NULL THEN
      v_to := jsonb_build_object('id', NULL, 'replaced_at', NULL, 'content', v_now_text);
    ELSE
      IF v_named THEN
        SELECT jsonb_build_object('id', r.id, 'replaced_at', r.replaced_at, 'content', r.content) INTO v_to
          FROM public.person_document_revisions r WHERE r.id = p_to AND r.document_id = p_doc_id;
      ELSE
        SELECT jsonb_build_object('id', r.id, 'replaced_at', r.replaced_at, 'content', r.content) INTO v_to
          FROM public.person_file_revisions r WHERE r.id = p_to AND r.person_id = p_person_id AND r.kind = btrim(p_kind);
      END IF;
      IF v_to IS NULL THEN
        RAISE EXCEPTION 'dev_doc_history: no revision % of this document', p_to;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('now', v_now, 'revisions', v_revisions, 'from', v_from, 'to', v_to);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dev_doc_history(uuid, uuid, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_doc_history(uuid, uuid, text, uuid, uuid) TO authenticated;
