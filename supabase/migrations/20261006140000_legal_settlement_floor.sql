SET lock_timeout = '3s';

-- Punch list #85, item 20 (v2.4643): settlement authority as a threshold — the owner's decision of 2026-10-05.
--
-- The office sets ONE floor per matter: dollars, or a percent of the open balance. NULL in both = no floor,
-- the firm settles freely. The firm settles at or above it; below it, `submit-legal-portal` records the firm's
-- `settled` step as a settlement ask (a `question` entry with meta.flavor = 'settlement') and the stage waits
-- for the office's sign-off through `legal_answer_settlement` below. Additive: the old client and functions
-- ignore the columns (they read legal_matters with select '*').

ALTER TABLE public.legal_matters ADD COLUMN IF NOT EXISTS settlement_floor_amount numeric;
ALTER TABLE public.legal_matters ADD COLUMN IF NOT EXISTS settlement_floor_pct numeric;

DO $$
BEGIN
  ALTER TABLE public.legal_matters ADD CONSTRAINT legal_matters_settlement_floor_check CHECK (
    (settlement_floor_amount IS NULL OR settlement_floor_amount > 0)
    AND (settlement_floor_pct IS NULL OR (settlement_floor_pct > 0 AND settlement_floor_pct <= 100))
    AND NOT (settlement_floor_amount IS NOT NULL AND settlement_floor_pct IS NOT NULL)
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.legal_matters.settlement_floor_amount IS 'Settlement authority (#85 item 20, v2.4643): the firm may settle at this many dollars or above; below it, it asks. NULL with settlement_floor_pct NULL = no floor. Never both.';
COMMENT ON COLUMN public.legal_matters.settlement_floor_pct IS 'Settlement authority (#85 item 20, v2.4643): the firm may settle at this percent of the open balance (on the day it proposes) or above. Never with settlement_floor_amount.';

-- Office: set or clear the floor. Writes a note on the matter, so the firm sees the change on its portal.
CREATE OR REPLACE FUNCTION public.legal_set_settlement_floor(p_matter_id uuid, p_amount numeric DEFAULT NULL, p_pct numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_words text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF p_amount IS NOT NULL AND p_pct IS NOT NULL THEN RETURN jsonb_build_object('error', 'Set a dollar floor or a percent, not both'); END IF;
  IF p_amount IS NOT NULL AND p_amount <= 0 THEN RETURN jsonb_build_object('error', 'The floor must be more than zero'); END IF;
  IF p_pct IS NOT NULL AND (p_pct <= 0 OR p_pct > 100) THEN RETURN jsonb_build_object('error', 'A percent floor is between 1 and 100'); END IF;
  UPDATE public.legal_matters
    SET settlement_floor_amount = ROUND(p_amount, 2), settlement_floor_pct = p_pct, updated_at = now()
  WHERE id = p_matter_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Matter not found'); END IF;
  v_words := CASE
    WHEN p_amount IS NOT NULL THEN 'Settlement floor set: the firm may settle at $' || to_char(ROUND(p_amount, 2), 'FM999,999,990.00') || ' or above'
    WHEN p_pct IS NOT NULL THEN 'Settlement floor set: the firm may settle at ' || rtrim(to_char(p_pct, 'FM990.##'), '.') || '% of the balance or above'
    ELSE 'Settlement floor cleared: the firm may settle at any amount'
  END;
  INSERT INTO public.legal_matter_entries (matter_id, kind, body, meta, created_by)
  VALUES (p_matter_id, 'note', v_words, jsonb_build_object('settlementFloor', jsonb_build_object('amount', p_amount, 'pct', p_pct)), auth.uid());
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_set_settlement_floor(uuid, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_set_settlement_floor(uuid, numeric, numeric) TO authenticated;

-- Office: answer the firm's settlement ask. One transaction writes the answer (threaded by meta.askId, so the
-- firm's portal and the 'answer' email carry it), acknowledges the ask, and — on a sign-off — moves the stage
-- to settled (not closed: the office closes the matter once the money is applied, #85 item 16) with a step entry.
CREATE OR REPLACE FUNCTION public.legal_answer_settlement(p_entry_id uuid, p_signed_off boolean, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ask public.legal_matter_entries%ROWTYPE;
  v_amount numeric;
  v_amount_words text;
  v_note text := COALESCE(NULLIF(TRIM(p_note), ''), '');
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF p_signed_off IS NULL THEN RETURN jsonb_build_object('error', 'Sign off or say not yet'); END IF;
  SELECT * INTO v_ask FROM public.legal_matter_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND OR v_ask.kind <> 'question' OR NOT v_ask.via_portal OR COALESCE(v_ask.meta->>'flavor', '') <> 'settlement' THEN
    RETURN jsonb_build_object('error', 'That is not a settlement ask from the firm');
  END IF;
  IF v_ask.acknowledged_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'That ask was already answered'); END IF;
  v_amount := COALESCE(NULLIF(v_ask.meta->>'proposedAmount', '')::numeric, v_ask.amount);
  v_amount_words := '$' || to_char(COALESCE(v_amount, 0), 'FM999,999,990.00');

  INSERT INTO public.legal_matter_entries (matter_id, kind, body, meta, created_by)
  VALUES (v_ask.matter_id, 'answer',
    CASE WHEN p_signed_off THEN 'Signed off: settle at ' || v_amount_words ELSE 'Not yet' END
      || CASE WHEN v_note <> '' THEN ' — ' || v_note ELSE '' END,
    jsonb_build_object('askId', v_ask.id, 'signedOff', p_signed_off), auth.uid());
  UPDATE public.legal_matter_entries SET acknowledged_at = now(), acknowledged_by = auth.uid() WHERE id = v_ask.id;

  IF p_signed_off THEN
    UPDATE public.legal_matters SET stage = 'settled', updated_at = now() WHERE id = v_ask.matter_id AND closed_at IS NULL;
    INSERT INTO public.legal_matter_entries (matter_id, kind, amount, body, meta, created_by)
    VALUES (v_ask.matter_id, 'step', v_amount, 'Settled at ' || v_amount_words || ' — the office signed off',
      jsonb_build_object('stage', 'settled', 'settlementAskId', v_ask.id), auth.uid());
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_answer_settlement(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_answer_settlement(uuid, boolean, text) TO authenticated;
