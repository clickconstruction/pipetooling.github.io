SET lock_timeout = '3s';

-- Punch list #188 (the dev gates), PR 4, v2.6757: the People page, rows 1 to 3 and 55 to 59 of the audit table, every
-- recommendation taken as written by the owner on 2026-11-08. The database side of the doors that write or read rows
-- only a dev could:
--   row 56  Overhead → choose the office job — app_settings.overhead_office_job_ledger_id_v1, the owner too.
--   row 57  Users → Tags — user_tag_org, read whole, inserted, updated and deleted by the owner too.
--   row 58  Activity → the viewer grants — user_app_activity_viewers, the owner reads every grant, adds and removes;
--           user_app_activity_daily, the owner reads every row as a dev does (the tab opens to him without a grant).
--   row 59  Vehicles → Check-in settings — app_settings.vehicle_checkin_settings_v1, the owner too. Wheels writes the
--           vehicles table under its standing policy (a pay-approved master is admitted already).
-- Rows 1 (Crew P&L), 2 (Review), 3 (Scoreboard) and 55 (the Balances and Payments views) read what their audiences
-- read already; client lines alone. Additive and idempotent: no table is created, so no fence call is owed.

-- 1) The owner's two keys (rows 56 and 59): both blocks upsert.
DROP POLICY IF EXISTS master_or_dev_insert_people_page_keys ON public.app_settings;
CREATE POLICY master_or_dev_insert_people_page_keys ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (key IN ('overhead_office_job_ledger_id_v1', 'vehicle_checkin_settings_v1') AND public.is_master_or_dev());
DROP POLICY IF EXISTS master_or_dev_update_people_page_keys ON public.app_settings;
CREATE POLICY master_or_dev_update_people_page_keys ON public.app_settings FOR UPDATE TO authenticated
  USING (key IN ('overhead_office_job_ledger_id_v1', 'vehicle_checkin_settings_v1') AND public.is_master_or_dev())
  WITH CHECK (key IN ('overhead_office_job_ledger_id_v1', 'vehicle_checkin_settings_v1') AND public.is_master_or_dev());

-- 2) Tags (row 57): the tag org rows, beside the dev's four and the person's own-row read.
DROP POLICY IF EXISTS user_tag_org_select_master_or_dev ON public.user_tag_org;
CREATE POLICY user_tag_org_select_master_or_dev ON public.user_tag_org FOR SELECT TO authenticated USING (public.is_master_or_dev());
DROP POLICY IF EXISTS user_tag_org_insert_master_or_dev ON public.user_tag_org;
CREATE POLICY user_tag_org_insert_master_or_dev ON public.user_tag_org FOR INSERT TO authenticated WITH CHECK (public.is_master_or_dev());
DROP POLICY IF EXISTS user_tag_org_update_master_or_dev ON public.user_tag_org;
CREATE POLICY user_tag_org_update_master_or_dev ON public.user_tag_org FOR UPDATE TO authenticated USING (public.is_master_or_dev()) WITH CHECK (public.is_master_or_dev());
DROP POLICY IF EXISTS user_tag_org_delete_master_or_dev ON public.user_tag_org;
CREATE POLICY user_tag_org_delete_master_or_dev ON public.user_tag_org FOR DELETE TO authenticated USING (public.is_master_or_dev());

-- 3) The Activity tab (row 58): the grants and the table they open.
DROP POLICY IF EXISTS user_app_activity_viewers_select_master_or_dev ON public.user_app_activity_viewers;
CREATE POLICY user_app_activity_viewers_select_master_or_dev ON public.user_app_activity_viewers FOR SELECT TO authenticated USING (public.is_master_or_dev());
DROP POLICY IF EXISTS user_app_activity_viewers_insert_master_or_dev ON public.user_app_activity_viewers;
CREATE POLICY user_app_activity_viewers_insert_master_or_dev ON public.user_app_activity_viewers FOR INSERT TO authenticated WITH CHECK (public.is_master_or_dev());
DROP POLICY IF EXISTS user_app_activity_viewers_delete_master_or_dev ON public.user_app_activity_viewers;
CREATE POLICY user_app_activity_viewers_delete_master_or_dev ON public.user_app_activity_viewers FOR DELETE TO authenticated USING (public.is_master_or_dev());
DROP POLICY IF EXISTS user_app_activity_daily_select_master_or_dev ON public.user_app_activity_daily;
CREATE POLICY user_app_activity_daily_select_master_or_dev ON public.user_app_activity_daily FOR SELECT TO authenticated USING (public.is_master_or_dev());
