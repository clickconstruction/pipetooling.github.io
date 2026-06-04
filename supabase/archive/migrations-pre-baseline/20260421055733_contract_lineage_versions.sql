-- Versioned person_contract_documents: multiple rows per (person, document_name) via contract_lineage_id + lineage_version.
-- Signed rows stay immutable; new unsigned rows carry updated Contract Book text after save.

ALTER TABLE public.person_contract_documents
  ADD COLUMN contract_lineage_id uuid,
  ADD COLUMN lineage_version integer,
  ADD COLUMN supersedes_person_contract_document_id uuid;

UPDATE public.person_contract_documents
SET
  contract_lineage_id = id,
  lineage_version = 1
WHERE contract_lineage_id IS NULL;

ALTER TABLE public.person_contract_documents
  ALTER COLUMN contract_lineage_id SET NOT NULL,
  ALTER COLUMN lineage_version SET NOT NULL;

ALTER TABLE public.person_contract_documents
  ALTER COLUMN lineage_version SET DEFAULT 1;

ALTER TABLE public.person_contract_documents
  ADD CONSTRAINT person_contract_documents_supersedes_fkey
  FOREIGN KEY (supersedes_person_contract_document_id)
  REFERENCES public.person_contract_documents (id)
  ON DELETE SET NULL;

ALTER TABLE public.person_contract_documents
  DROP CONSTRAINT IF EXISTS person_contract_documents_person_name_document_name_key;

CREATE UNIQUE INDEX person_contract_documents_person_lineage_version_key
  ON public.person_contract_documents (person_name, contract_lineage_id, lineage_version);

CREATE INDEX idx_person_contract_documents_person_lineage
  ON public.person_contract_documents (person_name, contract_lineage_id);

COMMENT ON COLUMN public.person_contract_documents.contract_lineage_id IS
  'Stable id shared by all versions of one logical contract for this person.';
COMMENT ON COLUMN public.person_contract_documents.lineage_version IS
  'Monotonic version within contract_lineage_id (1 = first row).';
COMMENT ON COLUMN public.person_contract_documents.supersedes_person_contract_document_id IS
  'Previous person_contract_documents row when this row is a re-sign amendment.';

CREATE OR REPLACE FUNCTION public.create_pending_contract_versions_after_book_save(
  p_contract_template_document_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template_id uuid;
  v_doc_name text;
  v_book_body text;
  v_book_format text;
  v_canon text;
  v_person text;
  v_lid uuid;
  v_latest public.person_contract_documents%ROWTYPE;
BEGIN
  SELECT c.template_id, c.document_name, c.book_body_html, c.book_body_format, c.canonical_document_url
  INTO v_template_id, v_doc_name, v_book_body, v_book_format, v_canon
  FROM public.contract_template_documents c
  WHERE c.id = p_contract_template_document_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  FOR v_person IN
    SELECT DISTINCT a.person_name
    FROM public.person_contract_assignments a
    WHERE a.template_id = v_template_id
  LOOP
    FOR v_lid IN
      SELECT DISTINCT p.contract_lineage_id
      FROM public.person_contract_documents p
      WHERE p.person_name = v_person
        AND p.document_name = v_doc_name
    LOOP
      SELECT *
      INTO v_latest
      FROM public.person_contract_documents p
      WHERE p.person_name = v_person
        AND p.contract_lineage_id = v_lid
      ORDER BY p.lineage_version DESC
      LIMIT 1;

      IF v_latest.id IS NULL THEN
        CONTINUE;
      END IF;

      IF v_latest.status IN ('unsent', 'sent') THEN
        CONTINUE;
      END IF;

      IF v_latest.status IS DISTINCT FROM 'signed' THEN
        CONTINUE;
      END IF;

      INSERT INTO public.person_contract_documents (
        person_name,
        document_name,
        contract_lineage_id,
        lineage_version,
        supersedes_person_contract_document_id,
        status,
        signing_body_html,
        signing_body_format,
        canonical_document_url,
        applied_contract_template_document_id,
        dashboard_prompt_after_clock_in
      ) VALUES (
        v_person,
        v_doc_name,
        v_lid,
        v_latest.lineage_version + 1,
        v_latest.id,
        'unsent',
        v_book_body,
        COALESCE(NULLIF(trim(v_book_format), ''), 'html'),
        NULLIF(trim(v_canon), ''),
        p_contract_template_document_id,
        false
      );
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_contract_book_entry(
  p_contract_template_document_id uuid,
  p_document_name text,
  p_book_body_html text,
  p_book_body_format text,
  p_tags text[],
  p_canonical_document_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_name text;
  v_template_id uuid;
  v_trim_name text;
  v_canon text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.is_dev()
    OR public.is_pay_approved_master()
    OR public.is_assistant_of_pay_approved_master()
    OR public.is_assistant()
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT c.document_name, c.template_id
  INTO v_old_name, v_template_id
  FROM public.contract_template_documents c
  WHERE c.id = p_contract_template_document_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contract template document not found';
  END IF;

  v_trim_name := trim(p_document_name);
  IF v_trim_name = '' THEN
    RAISE EXCEPTION 'Document name is required';
  END IF;

  v_canon := NULLIF(trim(p_canonical_document_url), '');

  IF EXISTS (
    SELECT 1
    FROM public.contract_template_documents d
    WHERE d.template_id = v_template_id
      AND d.id <> p_contract_template_document_id
      AND lower(trim(d.document_name)) = lower(v_trim_name)
  ) THEN
    RAISE EXCEPTION 'A document with this name already exists for that template.';
  END IF;

  IF v_trim_name IS DISTINCT FROM v_old_name THEN
    BEGIN
      UPDATE public.person_contract_documents p
      SET
        document_name = v_trim_name,
        updated_at = NOW()
      WHERE p.document_name = v_old_name
        AND EXISTS (
          SELECT 1
          FROM public.person_contract_assignments a
          WHERE a.template_id = v_template_id
            AND a.person_name = p.person_name
        );
    EXCEPTION
      WHEN unique_violation THEN
        RAISE EXCEPTION 'A contract with this name already exists for one or more people; resolve the conflict in People → Contracts.';
    END;
  END IF;

  UPDATE public.contract_template_documents
  SET
    document_name = v_trim_name,
    book_body_html = p_book_body_html,
    book_body_format = p_book_body_format,
    tags = p_tags,
    canonical_document_url = v_canon
  WHERE id = p_contract_template_document_id;

  PERFORM public.create_pending_contract_versions_after_book_save(p_contract_template_document_id);
END;
$$;

COMMENT ON FUNCTION public.create_pending_contract_versions_after_book_save(uuid) IS
  'After Contract Book body changes: inserts a new unsigned person_contract_documents row for each assignee lineage whose latest row is signed. SECURITY DEFINER.';

COMMENT ON FUNCTION public.update_contract_book_entry(uuid, text, text, text, text[], text) IS
  'Updates a Contract Book row; renames matching person rows when document_name changes; then creates pending re-sign rows for signed assignees. Does not overwrite existing unsigned person rows. Pay-staff only. SECURITY DEFINER.';
