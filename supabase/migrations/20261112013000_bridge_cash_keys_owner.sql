SET lock_timeout = '3s';

-- Punch list #303 (the Bridge under one story), v2.6964: the owner's role saves the Bridge's three cash settings.
--
-- Behind Money on /bridge the page saves three app_settings rows, each with an upsert:
--   bridge_cash_floor_usd_v1      the cash floor (no row until someone sets it; the page reads $5,000 until then)
--   bridge_cash_on_hand_v1        the typed cash on hand, the fallback when the bank cannot be read
--   bridge_cash_accounts_out_v1   the bank accounts left out of cash on hand (v2.6838)
-- No key-scoped policy named them, so the baseline's "Devs can manage app settings" (is_dev()) alone let the write
-- through. The owner's role has opened the page since v2.6763 (20261109006000) and was refused on all three: a
-- switch held for the visit and was lost, and the floor did not move. The weekly email reads the saved account
-- choice, so an unsaved one never reached it.
--
-- Two policies in the shape of master_or_dev_*_pipeline_money_keys (20261109003500): INSERT and UPDATE on these
-- three keys for is_master_or_dev(). An upsert needs both, and the floor has no row. No DELETE: the page never
-- deletes them. bridge_target_usd_v1 is left out: the page stopped writing it. The table's restrictive write
-- fences (read-only, digital twin, archived) still apply. Additive and idempotent: no table is created, so no fence
-- call is owed.

DROP POLICY IF EXISTS master_or_dev_insert_bridge_cash_keys ON public.app_settings;
CREATE POLICY master_or_dev_insert_bridge_cash_keys ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (key IN ('bridge_cash_floor_usd_v1', 'bridge_cash_on_hand_v1', 'bridge_cash_accounts_out_v1') AND public.is_master_or_dev());
DROP POLICY IF EXISTS master_or_dev_update_bridge_cash_keys ON public.app_settings;
CREATE POLICY master_or_dev_update_bridge_cash_keys ON public.app_settings FOR UPDATE TO authenticated
  USING (key IN ('bridge_cash_floor_usd_v1', 'bridge_cash_on_hand_v1', 'bridge_cash_accounts_out_v1') AND public.is_master_or_dev())
  WITH CHECK (key IN ('bridge_cash_floor_usd_v1', 'bridge_cash_on_hand_v1', 'bridge_cash_accounts_out_v1') AND public.is_master_or_dev());
