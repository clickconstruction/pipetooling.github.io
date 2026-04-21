-- Person signing copies are edited per assignee; do not bulk-overwrite from Contract Book saves.

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
END;
$$;

COMMENT ON FUNCTION public.update_contract_book_entry(uuid, text, text, text, text[], text) IS
  'Updates a Contract Book row; when document_name changes, renames matching person_contract_documents for assignees of that template. Does not overwrite per-person signing body or canonical URL. Pay-staff only. SECURITY DEFINER.';
