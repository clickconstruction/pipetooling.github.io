SET lock_timeout = '3s';

-- Firms and their coverage, PR 4 (punch list #222, v2.6233): hand counties off from one firm to another, in place of
-- replacing the firm everywhere. The owner, 2026-10-30: "if we're going to replace someone replace them for that
-- coverage zone."
--
-- legal_hand_off_counties(p_from_firm, p_to_firm, p_new_firm, p_counties, p_retire) moves the counties named from the
-- giving firm to the receiving firm in one transaction: the giver's row for each county closes (its history stays),
-- the receiver covers it (a new row when it did not), and the receiver becomes the county's first call, so new
-- releases there go to it. The receiver is an active firm (p_to_firm) or a new one typed in the sheet (p_new_firm:
-- name, handling_name, email, phone, contingency_pct, filing_cost), added in the same call. With p_retire the giver
-- is retired in the same call, only when it covers no county afterwards and holds no live matter. Every check runs
-- before any write, so a refusal changes nothing. A live matter never moves: moving a matter is the receiving
-- firm's consent and its own card.
--
-- legal_retire_firm(p_firm_id) is retire as its own step, for a firm that covers no county, holds no live matter,
-- and is not the only firm that stands. Retiring revokes the firm's portal link and forgets its secret, takes it off
-- the desk and the emails, and keeps its history, as legal_replace_firm (v2.4712) does.
--
-- Both are dev only and never for a training account. The client calls them from this release on, so this is
-- pushed right after its merge.

BEGIN;

-- The one retire, for both doors. Not callable from the API: only the two functions below reach it.
CREATE OR REPLACE FUNCTION public.legal_retire_firm_now(p_firm_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.legal_portal_link_forget_secrets(p_firm_id);
  UPDATE public.legal_portal_links SET revoked_at = now(), token_secret_id = NULL WHERE firm_id = p_firm_id AND revoked_at IS NULL;
  UPDATE public.legal_firms SET active = false, paused_at = COALESCE(paused_at, now()), updated_at = now() WHERE id = p_firm_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_retire_firm_now(uuid) FROM PUBLIC, anon, authenticated;

-- Accounts a firm is working, or has ended and the office has not closed (the portal's set, as legal_replace_firm reads it).
CREATE OR REPLACE FUNCTION public.legal_firm_live_matter_count(p_firm_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.legal_matters
   WHERE firm_id = p_firm_id AND closed_at IS NULL
     AND stage IN ('referred', 'demand', 'suit', 'judgment', 'post_judgment', 'payment_plan', 'settled', 'uncollectible', 'dismissed')
$$;
REVOKE EXECUTE ON FUNCTION public.legal_firm_live_matter_count(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.legal_hand_off_counties(
  p_from_firm uuid,
  p_counties text[],
  p_to_firm uuid DEFAULT NULL,
  p_new_firm jsonb DEFAULT NULL,
  p_retire boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from public.legal_firms%ROWTYPE;
  v_to public.legal_firms%ROWTYPE;
  v_to_id uuid;
  v_counties text[];
  v_missing text[];
  v_left int;
  v_open int;
  v_county text;
  v_name text;
  v_pct numeric;
  v_cost numeric;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not signed in.'); END IF;
  IF NOT public.is_dev() THEN RETURN jsonb_build_object('error', 'Only a dev can hand counties to another firm.'); END IF;
  IF public.is_read_only() THEN RETURN jsonb_build_object('error', 'A training account cannot hand counties to another firm.'); END IF;

  v_counties := ARRAY(SELECT DISTINCT btrim(c) FROM unnest(COALESCE(p_counties, '{}'::text[])) AS u(c) WHERE btrim(c) <> '' ORDER BY 1);
  IF COALESCE(array_length(v_counties, 1), 0) = 0 THEN RETURN jsonb_build_object('error', 'Pick the counties that move.'); END IF;

  SELECT * INTO v_from FROM public.legal_firms WHERE id = p_from_firm FOR UPDATE;
  IF NOT FOUND OR NOT v_from.active THEN RETURN jsonb_build_object('error', 'That firm no longer stands. Reload the desk and try again.'); END IF;

  IF (p_to_firm IS NULL) = (p_new_firm IS NULL) THEN RETURN jsonb_build_object('error', 'Pick the firm that takes them.'); END IF;
  IF p_to_firm IS NOT NULL THEN
    IF p_to_firm = p_from_firm THEN RETURN jsonb_build_object('error', 'Pick a different firm to take them.'); END IF;
    SELECT * INTO v_to FROM public.legal_firms WHERE id = p_to_firm FOR UPDATE;
    IF NOT FOUND OR NOT v_to.active THEN RETURN jsonb_build_object('error', 'The firm that takes them no longer stands. Reload the desk and try again.'); END IF;
  ELSE
    v_name := btrim(COALESCE(p_new_firm->>'name', ''));
    IF v_name = '' THEN RETURN jsonb_build_object('error', 'Give the new firm a name.'); END IF;
    BEGIN
      v_pct := COALESCE(NULLIF(p_new_firm->>'contingency_pct', ''), '33')::numeric;
      v_cost := COALESCE(NULLIF(p_new_firm->>'filing_cost', ''), '350')::numeric;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('error', 'Contingency is a percent from 0 to 100, and the filing cost is dollars.');
    END;
    IF v_pct < 0 OR v_pct > 100 OR v_cost < 0 THEN RETURN jsonb_build_object('error', 'Contingency is a percent from 0 to 100, and the filing cost is dollars.'); END IF;
  END IF;

  -- Each county named, once, in one order, as legal_save_county_coverage locks them.
  PERFORM pg_advisory_xact_lock(hashtext('legal_firm_counties:' || c)) FROM unnest(v_counties) AS u(c);

  -- The giver must cover every county named, today.
  v_missing := ARRAY(
    SELECT c FROM unnest(v_counties) AS u(c)
     WHERE NOT EXISTS (SELECT 1 FROM public.legal_firm_counties x WHERE x.county = u.c AND x.firm_id = p_from_firm AND x.until IS NULL)
     ORDER BY 1
  );
  IF COALESCE(array_length(v_missing, 1), 0) > 0 THEN
    RETURN jsonb_build_object('error', format('%s no longer covers %s. Reload the desk and try again.', v_from.name, array_to_string(v_missing, ', ')), 'counties', to_jsonb(v_missing));
  END IF;

  IF p_retire THEN
    SELECT count(*)::int INTO v_left FROM public.legal_firm_counties
     WHERE firm_id = p_from_firm AND until IS NULL AND NOT (county = ANY(v_counties));
    IF v_left > 0 THEN
      RETURN jsonb_build_object('error', format('%s still covers %s other count%s. Hand %s off too, or retire it later.', v_from.name, v_left, CASE WHEN v_left = 1 THEN 'y' ELSE 'ies' END, CASE WHEN v_left = 1 THEN 'it' ELSE 'them' END));
    END IF;
    v_open := public.legal_firm_live_matter_count(p_from_firm);
    IF v_open > 0 THEN
      RETURN jsonb_build_object('error', format('%s account%s still with %s. Retire it once %s.', v_open, CASE WHEN v_open = 1 THEN ' is' ELSE 's are' END, v_from.name, CASE WHEN v_open = 1 THEN 'that account closes or comes back' ELSE 'those accounts close or come back' END), 'open', v_open);
    END IF;
  END IF;

  -- Every check is done; now the writes.
  IF p_to_firm IS NOT NULL THEN
    v_to_id := p_to_firm;
  ELSE
    INSERT INTO public.legal_firms (name, handling_name, email, phone, contingency_pct, filing_cost, active, created_by)
    VALUES (v_name, btrim(COALESCE(p_new_firm->>'handling_name', '')), btrim(COALESCE(p_new_firm->>'email', '')), btrim(COALESCE(p_new_firm->>'phone', '')), v_pct, v_cost, true, auth.uid())
    RETURNING id INTO v_to_id;
  END IF;

  FOREACH v_county IN ARRAY v_counties LOOP
    UPDATE public.legal_firm_counties SET until = now() WHERE county = v_county AND firm_id = p_from_firm AND until IS NULL;
    INSERT INTO public.legal_firm_counties (firm_id, county, set_by, first_call)
    SELECT v_to_id, v_county, auth.uid(), false
     WHERE NOT EXISTS (SELECT 1 FROM public.legal_firm_counties x WHERE x.county = v_county AND x.firm_id = v_to_id AND x.until IS NULL);
    -- The receiver is first call: new releases in the county go to it. Off before on.
    UPDATE public.legal_firm_counties SET first_call = false WHERE county = v_county AND until IS NULL AND first_call AND firm_id <> v_to_id;
    UPDATE public.legal_firm_counties SET first_call = true WHERE county = v_county AND until IS NULL AND firm_id = v_to_id AND NOT first_call;
  END LOOP;

  IF p_retire THEN PERFORM public.legal_retire_firm_now(p_from_firm); END IF;

  RETURN jsonb_build_object('ok', true, 'to_firm_id', v_to_id, 'counties', to_jsonb(v_counties), 'retired', p_retire);
END;
$$;

COMMENT ON FUNCTION public.legal_hand_off_counties(uuid, text[], uuid, jsonb, boolean) IS 'v2.6233 (punch list #222): move counties from one collections law firm to another (an active firm, or a new one added in the same call), the receiver first call there; with p_retire the giver is retired too when it covers nothing else and holds no live matter. Every check before any write. Dev only, never a training account. A live matter never moves.';
REVOKE EXECUTE ON FUNCTION public.legal_hand_off_counties(uuid, text[], uuid, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_hand_off_counties(uuid, text[], uuid, jsonb, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.legal_retire_firm(p_firm_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_firm public.legal_firms%ROWTYPE;
  v_counties int;
  v_open int;
  v_others int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not signed in.'); END IF;
  IF NOT public.is_dev() THEN RETURN jsonb_build_object('error', 'Only a dev can retire a collections law firm.'); END IF;
  IF public.is_read_only() THEN RETURN jsonb_build_object('error', 'A training account cannot retire a collections law firm.'); END IF;

  SELECT * INTO v_firm FROM public.legal_firms WHERE id = p_firm_id FOR UPDATE;
  IF NOT FOUND OR NOT v_firm.active THEN RETURN jsonb_build_object('error', 'That firm no longer stands. Reload the desk and try again.'); END IF;

  SELECT count(*)::int INTO v_counties FROM public.legal_firm_counties WHERE firm_id = p_firm_id AND until IS NULL;
  IF v_counties > 0 THEN
    RETURN jsonb_build_object('error', format('%s still covers %s count%s. Hand %s off first.', v_firm.name, v_counties, CASE WHEN v_counties = 1 THEN 'y' ELSE 'ies' END, CASE WHEN v_counties = 1 THEN 'it' ELSE 'them' END));
  END IF;
  v_open := public.legal_firm_live_matter_count(p_firm_id);
  IF v_open > 0 THEN
    RETURN jsonb_build_object('error', format('%s account%s still with %s. Retire it once %s.', v_open, CASE WHEN v_open = 1 THEN ' is' ELSE 's are' END, v_firm.name, CASE WHEN v_open = 1 THEN 'that account closes or comes back' ELSE 'those accounts close or come back' END), 'open', v_open);
  END IF;
  SELECT count(*)::int INTO v_others FROM public.legal_firms WHERE active AND id <> p_firm_id;
  IF v_others = 0 THEN
    RETURN jsonb_build_object('error', format('%s is the only firm. Replace it with a new firm instead.', v_firm.name));
  END IF;

  PERFORM public.legal_retire_firm_now(p_firm_id);
  RETURN jsonb_build_object('ok', true, 'retired_firm_id', p_firm_id);
END;
$$;

COMMENT ON FUNCTION public.legal_retire_firm(uuid) IS 'v2.6233 (punch list #222): retire a collections law firm as its own step, only when it covers no county, holds no live matter, and another firm stands. Its link is revoked and its secret forgotten; its history stays. Dev only, never a training account.';
REVOKE EXECUTE ON FUNCTION public.legal_retire_firm(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_retire_firm(uuid) TO authenticated;

COMMIT;
