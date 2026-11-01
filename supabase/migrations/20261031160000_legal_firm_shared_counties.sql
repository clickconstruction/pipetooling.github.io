SET lock_timeout = '3s';

-- Firms and their coverage, PR 3 (punch list #222, v2.6227): two firms may cover one county, and one of them
-- is the county's first call, the firm the desk picks for a release there unless the office switches. The owner
-- asked for overlap in so many words on 2026-10-30 ("it is okay if multiple firms have the same coverage zones").
--
-- legal_firm_counties kept one live row per county since v2.5756 (legal_firm_counties_live_county_uidx). Now:
--   * first_call (boolean, default true): the existing rows, one per county, stay their county's first call;
--   * one live row per firm per county (legal_firm_counties_live_firm_county_uidx);
--   * at most one live first call per county (legal_firm_counties_live_first_call_uidx);
--   * the old one-row-per-county index goes.
--
-- legal_save_county_coverage(p_counties) is the one write of the county map for the Settings picker, Firms…
-- and the firm window: each item names a county, the firms that should cover it, its first call, and the firms
-- the picker read (`was`). It reads every item before it writes any, so a refusal changes nothing; a county
-- another tab changed since the picker read it comes back `stale` and nothing is written. It closes the rows
-- of firms that no longer cover the county (history stays), adds the new ones, and sets the first call: the one
-- named, else the first call that still covers it, else the longest-standing. Dev only, never a training
-- account, as every write to the firms. A matter stays with the firm it was released to, whatever the map says.
--
-- Additive for the reader: a client that selects * gets the new column; one that names columns is unchanged
-- (the legal-portal function reads firm_id, county, until). The client's picker calls the new function, so this
-- is pushed right after its merge.

BEGIN;

ALTER TABLE public.legal_firm_counties ADD COLUMN IF NOT EXISTS first_call boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.legal_firm_counties.first_call IS 'v2.6227 (punch list #222): this firm is the county''s first call, the firm the Legal desk picks for a release there unless the office switches. At most one live row per county (legal_firm_counties_live_first_call_uidx). A closed row keeps the value it had.';

CREATE UNIQUE INDEX IF NOT EXISTS legal_firm_counties_live_firm_county_uidx
  ON public.legal_firm_counties (county, firm_id) WHERE until IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS legal_firm_counties_live_first_call_uidx
  ON public.legal_firm_counties (county) WHERE until IS NULL AND first_call;
DROP INDEX IF EXISTS public.legal_firm_counties_live_county_uidx;

COMMENT ON TABLE public.legal_firm_counties IS 'Which collections law firms cover which Texas county (punch list #144, v2.5756; shared since v2.6227, punch list #222). One live row per firm per county (until IS NULL, legal_firm_counties_live_firm_county_uidx); one of a county''s live rows is its first_call (legal_firm_counties_live_first_call_uidx). A closed row is history. county is the Census county name as public/geo/tx-counties.json spells it. No live row means no firm covers the county. Written through legal_save_county_coverage; the office reads.';

CREATE OR REPLACE FUNCTION public.legal_save_county_coverage(p_counties jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item jsonb;
  v_county text;
  v_firms uuid[];
  v_was uuid[];
  v_now uuid[];
  v_first uuid;
  v_count int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not signed in.'); END IF;
  IF NOT public.is_dev() THEN RETURN jsonb_build_object('error', 'Only a dev can change which firm covers a county.'); END IF;
  IF public.is_read_only() THEN RETURN jsonb_build_object('error', 'A training account cannot change which firm covers a county.'); END IF;
  IF p_counties IS NULL OR jsonb_typeof(p_counties) <> 'array' OR jsonb_array_length(p_counties) = 0 THEN
    RETURN jsonb_build_object('error', 'Nothing to save.');
  END IF;

  -- Each county named, once, in one order: two saves never interleave on a county.
  PERFORM pg_advisory_xact_lock(hashtext('legal_firm_counties:' || s.c))
  FROM (SELECT DISTINCT btrim(COALESCE(x.item->>'county', '')) AS c FROM jsonb_array_elements(p_counties) AS x(item) ORDER BY 1) s;

  -- Read every item before writing any: a refusal changes nothing.
  FOR v_item IN SELECT x.item FROM jsonb_array_elements(p_counties) AS x(item) LOOP
    v_county := btrim(COALESCE(v_item->>'county', ''));
    IF v_county = '' THEN RETURN jsonb_build_object('error', 'A county has no name.'); END IF;
    BEGIN
      v_firms := ARRAY(SELECT DISTINCT t.id::uuid FROM jsonb_array_elements_text(COALESCE(v_item->'firms', '[]'::jsonb)) AS t(id));
      v_first := NULLIF(v_item->>'first_call', '')::uuid;
      v_was := ARRAY(SELECT DISTINCT t.id::uuid FROM jsonb_array_elements_text(COALESCE(v_item->'was', '[]'::jsonb)) AS t(id) ORDER BY 1);
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('error', format('%s names a firm that is not a firm.', v_county));
    END;
    IF (SELECT count(*) FROM public.legal_firms WHERE id = ANY(v_firms) AND active) <> COALESCE(array_length(v_firms, 1), 0) THEN
      RETURN jsonb_build_object('error', format('A firm for %s no longer stands. Reload and try again.', v_county));
    END IF;
    IF v_first IS NOT NULL AND NOT (v_first = ANY(v_firms)) THEN
      RETURN jsonb_build_object('error', format('The first call for %s must be a firm that covers it.', v_county));
    END IF;
    IF v_item ? 'was' THEN
      v_now := ARRAY(
        SELECT c.firm_id FROM public.legal_firm_counties c JOIN public.legal_firms f ON f.id = c.firm_id
        WHERE c.county = v_county AND c.until IS NULL AND f.active ORDER BY 1
      );
      IF v_now IS DISTINCT FROM v_was THEN
        RETURN jsonb_build_object('error', 'stale', 'county', v_county);
      END IF;
    END IF;
  END LOOP;

  FOR v_item IN SELECT x.item FROM jsonb_array_elements(p_counties) AS x(item) LOOP
    v_county := btrim(v_item->>'county');
    v_firms := ARRAY(SELECT DISTINCT t.id::uuid FROM jsonb_array_elements_text(COALESCE(v_item->'firms', '[]'::jsonb)) AS t(id));
    v_first := NULLIF(v_item->>'first_call', '')::uuid;

    -- A firm that no longer covers the county, a retired firm's row too: closed, its history kept.
    UPDATE public.legal_firm_counties SET until = now()
     WHERE county = v_county AND until IS NULL AND NOT (firm_id = ANY(v_firms));

    -- A firm new to the county joins as not first call; the first call is set below.
    INSERT INTO public.legal_firm_counties (firm_id, county, set_by, first_call)
    SELECT u.firm, v_county, auth.uid(), false FROM unnest(v_firms) AS u(firm)
     WHERE NOT EXISTS (SELECT 1 FROM public.legal_firm_counties c WHERE c.county = v_county AND c.firm_id = u.firm AND c.until IS NULL);

    IF COALESCE(array_length(v_firms, 1), 0) > 0 THEN
      IF v_first IS NULL THEN
        SELECT firm_id INTO v_first FROM public.legal_firm_counties WHERE county = v_county AND until IS NULL AND first_call LIMIT 1;
      END IF;
      IF v_first IS NULL THEN
        SELECT firm_id INTO v_first FROM public.legal_firm_counties WHERE county = v_county AND until IS NULL ORDER BY since, id LIMIT 1;
      END IF;
      -- Off before on: the one-first-call index never sees two.
      UPDATE public.legal_firm_counties SET first_call = false
       WHERE county = v_county AND until IS NULL AND first_call AND firm_id <> v_first;
      UPDATE public.legal_firm_counties SET first_call = true
       WHERE county = v_county AND until IS NULL AND firm_id = v_first AND NOT first_call;
    END IF;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'counties', v_count);
END;
$$;

COMMENT ON FUNCTION public.legal_save_county_coverage(jsonb) IS 'v2.6227 (punch list #222): the one write of the county map. p_counties is [{county, firms: [uuid], first_call: uuid|null, was: [uuid]}]; every item is read before any is written, a county another tab changed since `was` returns {error: stale}, and nothing is written on any refusal. Dev only, never a training account.';

REVOKE EXECUTE ON FUNCTION public.legal_save_county_coverage(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_save_county_coverage(jsonb) TO authenticated;

COMMIT;
