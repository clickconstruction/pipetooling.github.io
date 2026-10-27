SET lock_timeout = '3s';

-- Gap answers on a legal matter (v2.5920, the owner's note of 2026-10-26, to-do legal-gap-answers).
-- The desk's "Before this goes to an attorney" list recomputes on every open, and until now each
-- gap offered only a door to the surface that would change the fact. When the fact is true and
-- known — the work ran on a handshake, there is no paper to record — the office had nowhere to
-- say so. One row per (matter, gap key): one line the attorney should read instead of the gap,
-- with an optional Evidence document that shows it. The desk folds the rows under their gaps;
-- the firm reads them on its portal and the printed packet (PR 2).
--
--   1. legal_matter_gap_answers — the rows. Writes go through the RPCs only.
--   2. legal_answer_gap — office write; the matter is made when the account has none
--      (the legal_set_in_house ensure, v2.5847), refused once the matter is closed.
--   3. legal_clear_gap_answer — office delete of one answer.

-- 1. The table.
CREATE TABLE IF NOT EXISTS public.legal_matter_gap_answers (
  matter_id uuid NOT NULL REFERENCES public.legal_matters(id) ON DELETE CASCADE,
  gap_key text NOT NULL CHECK (length(gap_key) BETWEEN 1 AND 120),
  label text NOT NULL DEFAULT '' CHECK (length(label) <= 300),
  answer text NOT NULL CHECK (length(TRIM(answer)) BETWEEN 1 AND 500),
  document_id uuid REFERENCES public.legal_matter_documents(id) ON DELETE SET NULL,
  answered_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (matter_id, gap_key)
);
COMMENT ON TABLE public.legal_matter_gap_answers IS 'What the office knows about a packet gap (v2.5920): one line per (matter, gap key) the attorney reads instead of the hole, with an optional Evidence document. Keyed by the gap''s own key (contract:<jobId>, evidence:<jobId>, never_asked, …) so the recompute keeps the answer glued to its gap; a gap that stops firing takes its answer off the screen, not off the record. Writes via legal_answer_gap / legal_clear_gap_answer only.';
COMMENT ON COLUMN public.legal_matter_gap_answers.gap_key IS 'The LegalGap.key the answer belongs to; the desk shows an answer only while its gap fires.';
COMMENT ON COLUMN public.legal_matter_gap_answers.label IS 'The gap''s words as answered (a snapshot): the firm''s portal and the printed packet word the row from it without recomputing the gaps.';
COMMENT ON COLUMN public.legal_matter_gap_answers.document_id IS 'The Evidence document that shows it (same matter), shown one press away beside the answer.';

ALTER TABLE public.legal_matter_gap_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS legal_matter_gap_answers_office_select ON public.legal_matter_gap_answers;
CREATE POLICY legal_matter_gap_answers_office_select ON public.legal_matter_gap_answers FOR SELECT TO authenticated USING (public.legal_office_can_read());

-- 2. Answer a gap. The ensure-the-matter upsert is legal_set_in_house's (v2.5847), without the
-- stage write: answering never moves the stage, and jobs are only added, never dropped.
CREATE OR REPLACE FUNCTION public.legal_answer_gap(
  p_payer_key text, p_customer_id uuid, p_payer_name text, p_job_ids uuid[],
  p_gap_key text, p_answer text, p_document_id uuid DEFAULT NULL, p_label text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_closed timestamptz;
  v_doc_matter uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF p_payer_key IS NULL OR p_payer_key = '' THEN RETURN jsonb_build_object('error', 'Missing payer'); END IF;
  IF COALESCE(TRIM(p_gap_key), '') = '' OR length(p_gap_key) > 120 THEN RETURN jsonb_build_object('error', 'Missing gap'); END IF;
  IF COALESCE(TRIM(p_answer), '') = '' THEN RETURN jsonb_build_object('error', 'Write the one line first'); END IF;
  IF length(TRIM(p_answer)) > 500 THEN RETURN jsonb_build_object('error', 'Keep the answer under 500 characters'); END IF;

  INSERT INTO public.legal_matters (payer_key, customer_id, payer_name, created_by)
  VALUES (p_payer_key, p_customer_id, COALESCE(p_payer_name, ''), auth.uid())
  ON CONFLICT (payer_key) DO UPDATE
    SET customer_id = COALESCE(EXCLUDED.customer_id, public.legal_matters.customer_id),
        payer_name = CASE WHEN EXCLUDED.payer_name <> '' THEN EXCLUDED.payer_name ELSE public.legal_matters.payer_name END,
        updated_at = now()
  RETURNING id, closed_at INTO v_id, v_closed;
  IF v_closed IS NOT NULL THEN RETURN jsonb_build_object('error', 'This matter is closed'); END IF;

  IF p_job_ids IS NOT NULL THEN
    INSERT INTO public.legal_matter_jobs (matter_id, job_id)
    SELECT v_id, j FROM unnest(p_job_ids) AS j
    ON CONFLICT DO NOTHING;
  END IF;

  IF p_document_id IS NOT NULL THEN
    SELECT matter_id INTO v_doc_matter FROM public.legal_matter_documents WHERE id = p_document_id AND voided_at IS NULL;
    IF v_doc_matter IS NULL OR v_doc_matter <> v_id THEN RETURN jsonb_build_object('error', 'That document is not on this matter'); END IF;
  END IF;

  INSERT INTO public.legal_matter_gap_answers (matter_id, gap_key, label, answer, document_id, answered_by)
  VALUES (v_id, TRIM(p_gap_key), LEFT(COALESCE(TRIM(p_label), ''), 300), TRIM(p_answer), p_document_id, auth.uid())
  ON CONFLICT (matter_id, gap_key) DO UPDATE
    SET label = EXCLUDED.label, answer = EXCLUDED.answer, document_id = EXCLUDED.document_id, answered_by = EXCLUDED.answered_by, updated_at = now();
  RETURN jsonb_build_object('ok', true, 'matter_id', v_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_answer_gap(text, uuid, text, uuid[], text, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_answer_gap(text, uuid, text, uuid[], text, text, uuid, text) TO authenticated;
COMMENT ON FUNCTION public.legal_answer_gap(text, uuid, text, uuid[], text, text, uuid, text) IS 'Answer a packet gap (v2.5920): one line per (matter, gap key) with an optional Evidence document, by an office role; the matter is made when the account has none; refused once closed. Answering never moves the stage.';

-- 3. Clear one answer.
CREATE OR REPLACE FUNCTION public.legal_clear_gap_answer(p_matter_id uuid, p_gap_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  DELETE FROM public.legal_matter_gap_answers WHERE matter_id = p_matter_id AND gap_key = p_gap_key;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_clear_gap_answer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_clear_gap_answer(uuid, text) TO authenticated;
COMMENT ON FUNCTION public.legal_clear_gap_answer(uuid, text) IS 'Take one gap answer back off the record (v2.5920). Office roles.';

-- New table: the read-only fences (training mode) and the digital-twin fence.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
