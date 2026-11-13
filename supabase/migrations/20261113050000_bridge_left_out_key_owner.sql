SET lock_timeout = '3s';

-- Punch list #334 (the Bridge as a pulse), PR 2, v2.7095: the owner's role saves what the Bridge leaves out.
--
-- Under its title /bridge now says what it leaves out and lets a person change that list: whole developments,
-- customers or addresses whose jobs, bids and estimates the page does not count. The list is one app_settings row,
-- bridge_left_out_v1, saved with an upsert. No key-scoped policy names it, so the baseline's "Devs can manage app
-- settings" (is_dev()) alone lets the write through, and the owner's role, which has opened the page since
-- 20261109006000, would be refused: the change would hold for the visit and be lost.
--
-- Two policies in the shape of master_or_dev_*_bridge_cash_keys (20261112013000): INSERT and UPDATE on this one key
-- for is_master_or_dev(). An upsert needs both. No DELETE: the page never deletes the row, a list that leaves
-- nothing out is saved as an empty list. The row is not seeded: no saved row reads as an empty list. The table's
-- restrictive write fences (read-only, digital twin, archived) still apply. Additive and idempotent: no table is
-- created, so no fence call is owed.

DROP POLICY IF EXISTS master_or_dev_insert_bridge_left_out_key ON public.app_settings;
CREATE POLICY master_or_dev_insert_bridge_left_out_key ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (key = 'bridge_left_out_v1' AND public.is_master_or_dev());
DROP POLICY IF EXISTS master_or_dev_update_bridge_left_out_key ON public.app_settings;
CREATE POLICY master_or_dev_update_bridge_left_out_key ON public.app_settings FOR UPDATE TO authenticated
  USING (key = 'bridge_left_out_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'bridge_left_out_v1' AND public.is_master_or_dev());
