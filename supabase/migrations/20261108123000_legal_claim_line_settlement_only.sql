SET lock_timeout = '3s';

-- A claim line marked settlement only (punch list #171, v2.6697; the owner's call of 2026-11-08 on the card's second
-- open decision). A line the office claims in an offer but not in the demand: materials we would take back in a
-- settlement, a fee we would waive if they paid now. The flag rides the line; the kernel keeps such a line out of
-- the demand's figures (How much?, What's left for us?, the firm's demand, the printed packet) and inside the
-- settlement figures (the claim bar, What each path nets, the firm's view of the table, chipped).
--
--   1. legal_matter_claim_lines.settlement_only — false on every line until the office says otherwise.
--   2. legal_claim_line_save — takes p_settlement_only (default false), so the deployed client keeps working
--      until the new one arrives. The old ten-argument signature is dropped so PostgREST has one candidate.
--
-- Additive and idempotent.

-- 1. The flag.
ALTER TABLE public.legal_matter_claim_lines ADD COLUMN IF NOT EXISTS settlement_only boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.legal_matter_claim_lines.settlement_only IS 'v2.6697 (punch list #171): the line is claimed in a settlement offer but not in the demand. Out of the demand''s figures and the printed packet; inside the settlement figures.';

-- 2. The save takes the flag. One signature: the ten-argument one goes.
DROP FUNCTION IF EXISTS public.legal_claim_line_save(text, uuid, text, uuid[], uuid, text, text, numeric, text, uuid);
CREATE OR REPLACE FUNCTION public.legal_claim_line_save(
  p_payer_key text, p_customer_id uuid, p_payer_name text, p_job_ids uuid[],
  p_line_id uuid, p_kind text, p_title text, p_amount numeric, p_basis text DEFAULT '', p_document_id uuid DEFAULT NULL,
  p_settlement_only boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_matter uuid;
  v_closed timestamptz;
  v_doc_matter uuid;
  v_line uuid;
  v_title text := COALESCE(TRIM(p_title), '');
  v_basis text := COALESCE(TRIM(p_basis), '');
  v_settlement_only boolean := COALESCE(p_settlement_only, false);
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
    INSERT INTO public.legal_matter_claim_lines (matter_id, kind, title, amount, basis, document_id, settlement_only, added_by, updated_by)
    VALUES (v_matter, p_kind, v_title, ROUND(p_amount, 2), v_basis, p_document_id, v_settlement_only, auth.uid(), auth.uid())
    RETURNING id INTO v_line;
  ELSE
    UPDATE public.legal_matter_claim_lines
      SET kind = p_kind, title = v_title, amount = ROUND(p_amount, 2), basis = v_basis, document_id = p_document_id,
          settlement_only = v_settlement_only, updated_by = auth.uid(), updated_at = now()
    WHERE id = p_line_id AND matter_id = v_matter AND removed_at IS NULL
    RETURNING id INTO v_line;
    IF v_line IS NULL THEN RETURN jsonb_build_object('error', 'That claim line is not on this matter, or was removed'); END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'matter_id', v_matter, 'line_id', v_line);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_claim_line_save(text, uuid, text, uuid[], uuid, text, text, numeric, text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_claim_line_save(text, uuid, text, uuid[], uuid, text, text, numeric, text, uuid, boolean) TO authenticated;
COMMENT ON FUNCTION public.legal_claim_line_save(text, uuid, text, uuid[], uuid, text, text, numeric, text, uuid, boolean) IS 'Add or edit a typed line of a legal matter''s claim (v2.6679, punch list #171; v2.6697 adds p_settlement_only): the kind, a name, an amount over zero, its basis, an optional Evidence document on the same matter and whether the line is settlement only, by an office role; the matter is made when the account has none; refused once closed. p_line_id NULL adds.';
