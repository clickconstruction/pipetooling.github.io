SET lock_timeout = '3s';

-- The claim on a legal matter, line by line (punch list #171, v2.6679; rank 6 of the ten to-dos drawn from
-- the Burd matter, job 891). The desk sized a case by its open bills, and since v2.5849 by the open bills
-- plus the retainage no sent bill carries. A dispute can claim more: materials left on site, damages,
-- interest, attorney fees. On job 891 those lines lived only inside the demand letters. This table holds
-- them on the matter, one row per part the office types, each with an amount, its basis (a statute or a
-- contract clause) and the Evidence document behind it. The two parts that fill in on their own — the open
-- bills from AR and the retainage held from the job — are read, never stored here.
--
--   1. legal_matter_claim_lines — the typed rows. Writes go through the RPCs only.
--   2. legal_claim_line_save — office add or edit; the matter is made when the account has none (the
--      legal_answer_gap ensure, v2.5920), refused once the matter is closed.
--   3. legal_claim_line_remove — office removes one line (kept with removed_at, never deleted, like a document).
--
-- Idempotent. One CREATE TABLE, so the four fences close it.

-- 1. The table.
CREATE TABLE IF NOT EXISTS public.legal_matter_claim_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES public.legal_matters(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('materials', 'damages', 'interest', 'fees', 'other')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  amount numeric NOT NULL CHECK (amount > 0),
  basis text NOT NULL DEFAULT '' CHECK (length(basis) <= 300),
  document_id uuid REFERENCES public.legal_matter_documents(id) ON DELETE SET NULL,
  added_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);
COMMENT ON TABLE public.legal_matter_claim_lines IS 'The typed parts of a legal matter''s claim (v2.6679, punch list #171): materials left on site, damages, interest, fees, other — each with an amount, its basis (a statute or a contract clause) and the Evidence document that shows it. The open bills and the retainage held are read from AR and the job, never stored here. A removed line keeps removed_at. Writes via legal_claim_line_save / legal_claim_line_remove only.';
COMMENT ON COLUMN public.legal_matter_claim_lines.kind IS 'materials · damages · interest · fees · other: the part of the claim the line is.';
COMMENT ON COLUMN public.legal_matter_claim_lines.basis IS 'Where the line stands: a contract clause, a statute, how it was counted. One line the firm reads beside the amount.';
COMMENT ON COLUMN public.legal_matter_claim_lines.document_id IS 'The Evidence document that shows it (same matter), opened from the table.';

CREATE INDEX IF NOT EXISTS legal_matter_claim_lines_matter_idx ON public.legal_matter_claim_lines (matter_id, added_at) WHERE removed_at IS NULL;

ALTER TABLE public.legal_matter_claim_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS legal_matter_claim_lines_office_select ON public.legal_matter_claim_lines;
CREATE POLICY legal_matter_claim_lines_office_select ON public.legal_matter_claim_lines FOR SELECT TO authenticated USING (public.legal_office_can_read());
REVOKE ALL ON TABLE public.legal_matter_claim_lines FROM anon;
GRANT SELECT ON TABLE public.legal_matter_claim_lines TO authenticated;

-- 2. Add or edit a line. p_line_id NULL adds; a line's id edits it. The ensure-the-matter upsert is
-- legal_answer_gap's (v2.5920): the matter is made when the account has none, and jobs are only added.
CREATE OR REPLACE FUNCTION public.legal_claim_line_save(
  p_payer_key text, p_customer_id uuid, p_payer_name text, p_job_ids uuid[],
  p_line_id uuid, p_kind text, p_title text, p_amount numeric, p_basis text DEFAULT '', p_document_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_matter uuid;
  v_closed timestamptz;
  v_doc_matter uuid;
  v_line uuid;
  v_title text := COALESCE(TRIM(p_title), '');
  v_basis text := COALESCE(TRIM(p_basis), '');
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF p_payer_key IS NULL OR p_payer_key = '' THEN RETURN jsonb_build_object('error', 'Missing payer'); END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('materials', 'damages', 'interest', 'fees', 'other') THEN RETURN jsonb_build_object('error', 'Pick what part of the claim this is'); END IF;
  IF v_title = '' THEN RETURN jsonb_build_object('error', 'Name the line'); END IF;
  IF length(v_title) > 120 THEN RETURN jsonb_build_object('error', 'Keep the name under 120 characters'); END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN jsonb_build_object('error', 'The amount must be more than zero'); END IF;
  IF length(v_basis) > 300 THEN RETURN jsonb_build_object('error', 'Keep the basis under 300 characters'); END IF;

  INSERT INTO public.legal_matters (payer_key, customer_id, payer_name, created_by)
  VALUES (p_payer_key, p_customer_id, COALESCE(p_payer_name, ''), auth.uid())
  ON CONFLICT (payer_key) DO UPDATE
    SET customer_id = COALESCE(EXCLUDED.customer_id, public.legal_matters.customer_id),
        payer_name = CASE WHEN EXCLUDED.payer_name <> '' THEN EXCLUDED.payer_name ELSE public.legal_matters.payer_name END,
        updated_at = now()
  RETURNING id, closed_at INTO v_matter, v_closed;
  IF v_closed IS NOT NULL THEN RETURN jsonb_build_object('error', 'This matter is closed'); END IF;

  IF p_job_ids IS NOT NULL THEN
    INSERT INTO public.legal_matter_jobs (matter_id, job_id)
    SELECT v_matter, j FROM unnest(p_job_ids) AS j
    ON CONFLICT DO NOTHING;
  END IF;

  IF p_document_id IS NOT NULL THEN
    SELECT matter_id INTO v_doc_matter FROM public.legal_matter_documents WHERE id = p_document_id AND voided_at IS NULL;
    IF v_doc_matter IS NULL OR v_doc_matter <> v_matter THEN RETURN jsonb_build_object('error', 'That document is not on this matter'); END IF;
  END IF;

  IF p_line_id IS NULL THEN
    INSERT INTO public.legal_matter_claim_lines (matter_id, kind, title, amount, basis, document_id, added_by, updated_by)
    VALUES (v_matter, p_kind, v_title, ROUND(p_amount, 2), v_basis, p_document_id, auth.uid(), auth.uid())
    RETURNING id INTO v_line;
  ELSE
    UPDATE public.legal_matter_claim_lines
      SET kind = p_kind, title = v_title, amount = ROUND(p_amount, 2), basis = v_basis, document_id = p_document_id,
          updated_by = auth.uid(), updated_at = now()
    WHERE id = p_line_id AND matter_id = v_matter AND removed_at IS NULL
    RETURNING id INTO v_line;
    IF v_line IS NULL THEN RETURN jsonb_build_object('error', 'That claim line is not on this matter, or was removed'); END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'matter_id', v_matter, 'line_id', v_line);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_claim_line_save(text, uuid, text, uuid[], uuid, text, text, numeric, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_claim_line_save(text, uuid, text, uuid[], uuid, text, text, numeric, text, uuid) TO authenticated;
COMMENT ON FUNCTION public.legal_claim_line_save(text, uuid, text, uuid[], uuid, text, text, numeric, text, uuid) IS 'Add or edit a typed line of a legal matter''s claim (v2.6679, punch list #171): the kind, a name, an amount over zero, its basis and an optional Evidence document on the same matter, by an office role; the matter is made when the account has none; refused once closed. p_line_id NULL adds.';

-- 3. Remove one line. Kept with removed_at, so the record says what was once claimed.
CREATE OR REPLACE FUNCTION public.legal_claim_line_remove(p_line_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  UPDATE public.legal_matter_claim_lines SET removed_at = now(), removed_by = auth.uid() WHERE id = p_line_id AND removed_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'That claim line is already gone'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_claim_line_remove(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_claim_line_remove(uuid) TO authenticated;
COMMENT ON FUNCTION public.legal_claim_line_remove(uuid) IS 'Remove one typed claim line (v2.6679): removed_at is set, the row kept. Office roles.';

-- New table: the read-only fences (training mode), the digital-twin fence and the archived-caller fence.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
