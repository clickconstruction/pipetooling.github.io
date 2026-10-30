SET lock_timeout = '3s';

-- The attorney's read of how a case tries (punch list #218, direction C, PR 2).
--
-- The owner's words of 2026-10-30: some cases are hard to try and some are easy, the attorney settles for what can
-- be had, and we get what we get. v2.6170 (PR 1) retired the office's settlement floor. In its place the firm records
-- its READ of the case from its portal — easy or hard to try, the costs to try it, the months to a judgment, one
-- line of why — and the desk shows it on *Can we sue?* and weighs a settlement against it (PR 3). A read is an
-- ENTRY: a legal_matter_entries row of kind `note` whose meta.read carries { tries, why, cost_to_try, months }
-- (`_shared/legalCounselRead.ts` holds the one rule both sides read). The firm's comes through submit-legal-portal
-- (via_portal true); this function is the office's door — in house, or when counsel said it by phone — and writes
-- the same entry as the office, so the firm reads it on its portal and the note trigger emails it. The current read
-- is the latest one not undone; legal_void_entry is the way back.
--
-- Additive and idempotent; no table, no column, no kind, so no fence is owed.

CREATE OR REPLACE FUNCTION public.legal_set_counsel_read(
  p_matter_id uuid, p_tries text, p_why text DEFAULT '', p_cost_to_try numeric DEFAULT NULL, p_months integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_why text := COALESCE(NULLIF(TRIM(p_why), ''), '');
  v_body text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF p_tries IS NULL OR p_tries NOT IN ('easy', 'hard') THEN RETURN jsonb_build_object('error', 'Say whether the case is easy or hard to try'); END IF;
  IF p_cost_to_try IS NOT NULL AND (p_cost_to_try < 0 OR p_cost_to_try > 1000000) THEN RETURN jsonb_build_object('error', 'The costs to try it are a dollar amount under a million, or blank'); END IF;
  IF p_months IS NOT NULL AND (p_months < 0 OR p_months > 120) THEN RETURN jsonb_build_object('error', 'Months to a judgment is a whole number up to 120, or blank'); END IF;
  IF length(v_why) > 2000 THEN RETURN jsonb_build_object('error', 'Keep the why under 2,000 characters'); END IF;
  PERFORM 1 FROM public.legal_matters WHERE id = p_matter_id AND closed_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Matter not found, or closed'); END IF;

  -- The same words `counselReadEntryBody` writes from the portal: *How this case tries: hard. Costs to try it $2,800.00. 9 months to a judgment. <why>*
  v_body := 'How this case tries: ' || p_tries || '.'
    || CASE WHEN p_cost_to_try IS NOT NULL THEN ' Costs to try it $' || to_char(ROUND(p_cost_to_try, 2), 'FM999,999,990.00') || '.' ELSE '' END
    || CASE WHEN p_months IS NOT NULL THEN ' ' || p_months || ' month' || CASE WHEN p_months = 1 THEN '' ELSE 's' END || ' to a judgment.' ELSE '' END
    || CASE WHEN v_why <> '' THEN ' ' || v_why ELSE '' END;

  INSERT INTO public.legal_matter_entries (matter_id, kind, body, meta, created_by)
  VALUES (p_matter_id, 'note', v_body,
    jsonb_build_object('read', jsonb_build_object('tries', p_tries, 'why', v_why, 'cost_to_try', CASE WHEN p_cost_to_try IS NULL THEN NULL ELSE ROUND(p_cost_to_try, 2) END, 'months', p_months)),
    auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'entry_id', v_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_set_counsel_read(uuid, text, text, numeric, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_set_counsel_read(uuid, text, text, numeric, integer) TO authenticated;
COMMENT ON FUNCTION public.legal_set_counsel_read(uuid, text, text, numeric, integer) IS 'Punch list #218 PR 2: the office records the attorney''s read of how the case tries — easy or hard, the costs to try it, the months to a judgment, why — as a note entry with meta.read, the same entry the firm writes from its portal.';
