SET lock_timeout = '3s';

-- Punch list #188 (the dev gates), PR 3, v2.6756: Settings → Jobs, bills and liens, rows 19 to 21 and 23 to 26 of the
-- audit table, every recommendation taken as written by the owner on 2026-11-08. The kernel
-- (src/lib/settings/jobsBillingGroups.ts) mounts each card for its row's audience; this is the database side of the
-- cards that write, since app_settings takes writes from a dev alone unless a key-scoped policy says otherwise:
--   rows 19, 20  Hide the HCP field, Default labor rate, Turnaway trip charges — the owner too (is_master_or_dev()).
--   row 21       City line breaks, County suggestions — the office (is_office_staff()); Manage developments writes
--                the developments table, whose policies admit the office already.
--   row 23       Uncollectible: the accountant's list — reads jobs_ledger alone; nothing to grant.
--   row 24       The company on paper bills, the two footers and the Bill Customer memo — the controller with a dev.
--   row 25       HCP reconcile — jobs_ledger_payments admits the office already; nothing to grant.
--   row 26       Collections law firms — legal_firms and legal_firm_counties insert and update, the firm particulars
--                key, and legal_save_county_coverage, the owner too. legal_replace_firm, legal_hand_off_counties and
--                legal_retire_firm stay a dev's (the row names the two tables and the county map).
-- Additive and idempotent: no table is created, so no fence call is owed. The dev's standing policies stand beside.

-- 1) The owner's cards (rows 19, 20, 26): the HCP switch deletes its row when off, so DELETE too.
DROP POLICY IF EXISTS master_or_dev_jobs_billing_owner_keys_insert ON public.app_settings;
CREATE POLICY master_or_dev_jobs_billing_owner_keys_insert ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (key = ANY (ARRAY['hide_hcp_entry_field', 'default_labor_rate', 'trip_charge_client_not_home', 'trip_charge_site_not_ready', 'legal_particulars_v1']) AND public.is_master_or_dev());
DROP POLICY IF EXISTS master_or_dev_jobs_billing_owner_keys_update ON public.app_settings;
CREATE POLICY master_or_dev_jobs_billing_owner_keys_update ON public.app_settings FOR UPDATE TO authenticated
  USING (key = ANY (ARRAY['hide_hcp_entry_field', 'default_labor_rate', 'trip_charge_client_not_home', 'trip_charge_site_not_ready', 'legal_particulars_v1']) AND public.is_master_or_dev())
  WITH CHECK (key = ANY (ARRAY['hide_hcp_entry_field', 'default_labor_rate', 'trip_charge_client_not_home', 'trip_charge_site_not_ready', 'legal_particulars_v1']) AND public.is_master_or_dev());
DROP POLICY IF EXISTS master_or_dev_jobs_billing_owner_keys_delete ON public.app_settings;
CREATE POLICY master_or_dev_jobs_billing_owner_keys_delete ON public.app_settings FOR DELETE TO authenticated
  USING (key = ANY (ARRAY['hide_hcp_entry_field', 'default_labor_rate', 'trip_charge_client_not_home', 'trip_charge_site_not_ready', 'legal_particulars_v1']) AND public.is_master_or_dev());

-- 2) The office's cards (row 21): the address reader's extra city names and the city = county pairs.
DROP POLICY IF EXISTS office_jobs_billing_address_keys_insert ON public.app_settings;
CREATE POLICY office_jobs_billing_address_keys_insert ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (key = ANY (ARRAY['job_address_extra_localities_v1', 'tx_county_extra_mappings_v1']) AND public.is_office_staff());
DROP POLICY IF EXISTS office_jobs_billing_address_keys_update ON public.app_settings;
CREATE POLICY office_jobs_billing_address_keys_update ON public.app_settings FOR UPDATE TO authenticated
  USING (key = ANY (ARRAY['job_address_extra_localities_v1', 'tx_county_extra_mappings_v1']) AND public.is_office_staff())
  WITH CHECK (key = ANY (ARRAY['job_address_extra_localities_v1', 'tx_county_extra_mappings_v1']) AND public.is_office_staff());
DROP POLICY IF EXISTS office_jobs_billing_address_keys_delete ON public.app_settings;
CREATE POLICY office_jobs_billing_address_keys_delete ON public.app_settings FOR DELETE TO authenticated
  USING (key = ANY (ARRAY['job_address_extra_localities_v1', 'tx_county_extra_mappings_v1']) AND public.is_office_staff());

-- 3) What a bill says (row 24): the company block, the footers and the memo presets, each cleared by its Reset.
DROP POLICY IF EXISTS controller_or_dev_bill_words_keys_insert ON public.app_settings;
CREATE POLICY controller_or_dev_bill_words_keys_insert ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (key = ANY (ARRAY['physical_invoice_issuer_v1', 'physical_invoice_footer_presets_v1', 'stripe_invoice_footer_presets_v1', 'bill_customer_memo_presets_v1']) AND (public.is_dev() OR public.is_controller()));
DROP POLICY IF EXISTS controller_or_dev_bill_words_keys_update ON public.app_settings;
CREATE POLICY controller_or_dev_bill_words_keys_update ON public.app_settings FOR UPDATE TO authenticated
  USING (key = ANY (ARRAY['physical_invoice_issuer_v1', 'physical_invoice_footer_presets_v1', 'stripe_invoice_footer_presets_v1', 'bill_customer_memo_presets_v1']) AND (public.is_dev() OR public.is_controller()))
  WITH CHECK (key = ANY (ARRAY['physical_invoice_issuer_v1', 'physical_invoice_footer_presets_v1', 'stripe_invoice_footer_presets_v1', 'bill_customer_memo_presets_v1']) AND (public.is_dev() OR public.is_controller()));
DROP POLICY IF EXISTS controller_or_dev_bill_words_keys_delete ON public.app_settings;
CREATE POLICY controller_or_dev_bill_words_keys_delete ON public.app_settings FOR DELETE TO authenticated
  USING (key = ANY (ARRAY['physical_invoice_issuer_v1', 'physical_invoice_footer_presets_v1', 'stripe_invoice_footer_presets_v1', 'bill_customer_memo_presets_v1']) AND (public.is_dev() OR public.is_controller()));

-- 4) Collections law firms (row 26): the owner adds and edits a firm and colors its counties. Nobody deletes.
DROP POLICY IF EXISTS legal_firms_master_or_dev_insert ON public.legal_firms;
CREATE POLICY legal_firms_master_or_dev_insert ON public.legal_firms FOR INSERT TO authenticated WITH CHECK (public.is_master_or_dev());
DROP POLICY IF EXISTS legal_firms_master_or_dev_update ON public.legal_firms;
CREATE POLICY legal_firms_master_or_dev_update ON public.legal_firms FOR UPDATE TO authenticated USING (public.is_master_or_dev()) WITH CHECK (public.is_master_or_dev());
DROP POLICY IF EXISTS legal_firm_counties_master_or_dev_insert ON public.legal_firm_counties;
CREATE POLICY legal_firm_counties_master_or_dev_insert ON public.legal_firm_counties FOR INSERT TO authenticated WITH CHECK (public.is_master_or_dev());
DROP POLICY IF EXISTS legal_firm_counties_master_or_dev_update ON public.legal_firm_counties;
CREATE POLICY legal_firm_counties_master_or_dev_update ON public.legal_firm_counties FOR UPDATE TO authenticated USING (public.is_master_or_dev()) WITH CHECK (public.is_master_or_dev());

-- The county map's one write, restated word for word from 20261031160000 with one change: the gate reads
-- is_master_or_dev(), and the refusal names the owner beside the dev.
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
  IF NOT public.is_master_or_dev() THEN RETURN jsonb_build_object('error', 'Only the owner or a dev can change which firm covers a county.'); END IF;
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

COMMENT ON FUNCTION public.legal_save_county_coverage(jsonb) IS 'v2.6227 (punch list #222): the one write of the county map. p_counties is [{county, firms: [uuid], first_call: uuid|null, was: [uuid]}]; every item is read before any is written, a county another tab changed since `was` returns {error: stale}, and nothing is written on any refusal. The owner or a dev since v2.6756 (punch list #188 row 26; a dev alone before), never a training account.';
