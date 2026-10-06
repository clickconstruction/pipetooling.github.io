SET lock_timeout = '3s';

-- Replace the collections law firm (punch list #85, the firm's door, PR 2). The Legal desk's
-- firm window offers "Replace with a new firm…" for a stand-in like ZZ Test Firm: the new firm
-- is added and the old one retired in one transaction, so there is never a moment with no
-- active firm, or with two (`legal_firms_one_active` allows one).
--
-- Retiring keeps the old firm's history (its matters, entries, people and sent copies) and
-- takes it off everything live:
--   * active = false — the desk, the portal and the email dispatcher read the active firm only;
--   * paused_at stamped — belt and braces for the dispatcher, which also skips a paused firm;
--   * its portal link revoked and the link's Vault secret forgotten, as revoke_legal_portal_link does.
-- Refused while an account is still with the old firm (a working stage, or an end the office
-- has not closed — the portal's own set, `LEGAL_PORTAL_STAGES` in _shared/legalStages.ts):
-- moving accounts to a firm that never agreed to take them is not this function's call.
-- Dev only, like every write to legal_firms. Additive: one new function, no table change.

CREATE OR REPLACE FUNCTION public.legal_replace_firm(
  p_old_firm_id uuid,
  p_name text,
  p_handling_name text DEFAULT '',
  p_email text DEFAULT '',
  p_phone text DEFAULT '',
  p_contingency_pct numeric DEFAULT 33,
  p_filing_cost numeric DEFAULT 350
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old public.legal_firms%ROWTYPE;
  v_open int;
  v_new uuid;
  v_name text := COALESCE(NULLIF(TRIM(p_name), ''), '');
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.is_dev() THEN RETURN jsonb_build_object('error', 'Only a dev can replace the collections law firm'); END IF;
  IF v_name = '' THEN RETURN jsonb_build_object('error', 'Give the new firm a name'); END IF;
  IF p_contingency_pct IS NULL OR p_contingency_pct < 0 OR p_contingency_pct > 100 OR p_filing_cost IS NULL OR p_filing_cost < 0 THEN
    RETURN jsonb_build_object('error', 'Contingency is a percent from 0 to 100, and the filing cost is dollars');
  END IF;

  SELECT * INTO v_old FROM public.legal_firms WHERE id = p_old_firm_id FOR UPDATE;
  IF NOT FOUND OR NOT v_old.active THEN
    RETURN jsonb_build_object('error', 'That firm is no longer the active firm. Reload the desk and try again.');
  END IF;

  SELECT count(*) INTO v_open FROM public.legal_matters
  WHERE firm_id = p_old_firm_id AND closed_at IS NULL
    AND stage IN ('referred', 'demand', 'suit', 'judgment', 'post_judgment', 'payment_plan', 'settled', 'uncollectible', 'dismissed');
  IF v_open > 0 THEN
    RETURN jsonb_build_object('error', format('%s account%s still with %s. Pull %s back first.', v_open, CASE WHEN v_open = 1 THEN ' is' ELSE 's are' END, v_old.name, CASE WHEN v_open = 1 THEN 'it' ELSE 'them' END), 'open', v_open);
  END IF;

  -- Retire the old firm: off the desk, the portal and the emails; its history stays.
  PERFORM public.legal_portal_link_forget_secrets(p_old_firm_id);
  UPDATE public.legal_portal_links SET revoked_at = now(), token_secret_id = NULL WHERE firm_id = p_old_firm_id AND revoked_at IS NULL;
  UPDATE public.legal_firms SET active = false, paused_at = COALESCE(paused_at, now()), updated_at = now() WHERE id = p_old_firm_id;

  INSERT INTO public.legal_firms (name, handling_name, email, phone, contingency_pct, filing_cost, active, created_by)
  VALUES (v_name, COALESCE(TRIM(p_handling_name), ''), COALESCE(TRIM(p_email), ''), COALESCE(TRIM(p_phone), ''), p_contingency_pct, p_filing_cost, true, auth.uid())
  RETURNING id INTO v_new;

  RETURN jsonb_build_object('ok', true, 'firm_id', v_new, 'retired_firm_id', p_old_firm_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.legal_replace_firm(uuid, text, text, text, text, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_replace_firm(uuid, text, text, text, text, numeric, numeric) TO authenticated;
