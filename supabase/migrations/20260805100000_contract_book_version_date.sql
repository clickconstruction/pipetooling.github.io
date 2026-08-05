SET lock_timeout = '3s';

-- Contract Book settable version date (v2.1399). Library-level "official"
-- version date for a contract document: when set, it is shown as the
-- document's version date everywhere (Contract Book rows, the Applied-version
-- pickers and column in People -> Contracts) instead of the incidental
-- updated_at; NULL keeps the previous derived last-edited behavior.
-- Per-person person_contract_documents.applied_version_date still wins above it.
ALTER TABLE public.contract_template_documents
  ADD COLUMN IF NOT EXISTS book_version_date date;

COMMENT ON COLUMN public.contract_template_documents.book_version_date IS
  'Manually set official version date for this library document; NULL = derive from updated_at (last edit).';

-- Replace update_contract_book_entry with a 7-arg version. The new
-- p_book_version_date parameter uses DATE ''0001-01-01'' as a "not provided"
-- sentinel so the already-deployed 6-arg client keeps existing dates intact
-- (defaulting to NULL would clear a stored date on every old-client save);
-- the new client always passes the parameter explicitly (a date, or NULL to
-- clear back to derived).
DROP FUNCTION IF EXISTS public.update_contract_book_entry(uuid, text, text, text, text[], text);

CREATE OR REPLACE FUNCTION public.update_contract_book_entry(
  p_contract_template_document_id uuid,
  p_document_name text,
  p_book_body_html text,
  p_book_body_format text,
  p_tags text[],
  p_canonical_document_url text,
  p_book_version_date date DEFAULT DATE '0001-01-01'
) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
    canonical_document_url = v_canon,
    book_version_date = CASE
      WHEN p_book_version_date IS NOT DISTINCT FROM DATE '0001-01-01' THEN book_version_date
      ELSE p_book_version_date
    END
  WHERE id = p_contract_template_document_id;

  PERFORM public.create_pending_contract_versions_after_book_save(p_contract_template_document_id);
END;
$$;

COMMENT ON FUNCTION public.update_contract_book_entry(uuid, text, text, text, text[], text, date) IS
  'Contract Book entry save: name/body/format/tags/canonical URL + optional official book_version_date (sentinel 0001-01-01 = keep existing; NULL = clear to derived). Renames propagate to assignees'' person rows; then mints pending person versions for signed lineages. SECURITY DEFINER.';

GRANT EXECUTE ON FUNCTION public.update_contract_book_entry(uuid, text, text, text, text[], text, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
