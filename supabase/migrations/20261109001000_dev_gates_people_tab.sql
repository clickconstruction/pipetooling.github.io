SET lock_timeout = '3s';

-- Punch list #188 (the dev gates), PR 2, v2.6755: Settings → People & teams, rows 8 to 13 and 22 of the audit table,
-- every recommendation taken as written by the owner on 2026-11-08. The tab becomes the office's, with a gate per
-- block; this is the database side of the blocks that write:
--   rows 8, 9, 11  Quick time add, Typed hours: a second person approves, Assistant hours visibility, Bulk hours alert
--                  and Team review cadence — nine app_settings keys, the owner too (is_master_or_dev()).
--   row 10         The Task Dispatch and Estimator Inbox groups — dispatch_group_members and estimator_group_members,
--                  read whole, inserted and deleted by the owner too.
--   row 12         Additional People — a person with no login edited or deleted by the office (is_office_staff()).
--   row 22         The sub portal pay schedule — sub_pay_run_day and sub_pay_explainer, the controller with a dev.
-- Row 13 (Find duplicates…) is a pointer; Pay Approved Leaders (row 86, the check_show_in_hours_dev_only trigger) and
-- Role visibility (row 87) stay a dev's and nothing here touches them. Additive and idempotent: no table is created, so
-- no fence call is owed. The dev's standing policies stand beside these.

-- 1) The owner's switches (rows 8, 9, 11): the blocks upsert, so INSERT and UPDATE both.
DROP POLICY IF EXISTS master_or_dev_insert_people_tab_switches ON public.app_settings;
CREATE POLICY master_or_dev_insert_people_tab_switches
  ON public.app_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    key = ANY (ARRAY['quick_add_roles_v1', 'quick_add_daily_ceiling_minutes', 'typed_hours_second_look_v1', 'assistant_hours_window_weeks_v1', 'bulk_hours_alert_enabled_v1', 'bulk_hours_alert_days_v1', 'bulk_hours_alert_window_minutes_v1', 'bulk_hours_alert_lookback_days_v1', 'team_review_cadence_days_v1'])
    AND public.is_master_or_dev()
  );

DROP POLICY IF EXISTS master_or_dev_update_people_tab_switches ON public.app_settings;
CREATE POLICY master_or_dev_update_people_tab_switches
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (
    key = ANY (ARRAY['quick_add_roles_v1', 'quick_add_daily_ceiling_minutes', 'typed_hours_second_look_v1', 'assistant_hours_window_weeks_v1', 'bulk_hours_alert_enabled_v1', 'bulk_hours_alert_days_v1', 'bulk_hours_alert_window_minutes_v1', 'bulk_hours_alert_lookback_days_v1', 'team_review_cadence_days_v1'])
    AND public.is_master_or_dev()
  )
  WITH CHECK (
    key = ANY (ARRAY['quick_add_roles_v1', 'quick_add_daily_ceiling_minutes', 'typed_hours_second_look_v1', 'assistant_hours_window_weeks_v1', 'bulk_hours_alert_enabled_v1', 'bulk_hours_alert_days_v1', 'bulk_hours_alert_window_minutes_v1', 'bulk_hours_alert_lookback_days_v1', 'team_review_cadence_days_v1'])
    AND public.is_master_or_dev()
  );

-- 2) The two groups (row 10): the owner reads every member row, adds and removes.
DROP POLICY IF EXISTS dispatch_group_members_select_master_or_dev ON public.dispatch_group_members;
CREATE POLICY dispatch_group_members_select_master_or_dev
  ON public.dispatch_group_members FOR SELECT TO authenticated USING (public.is_master_or_dev());
DROP POLICY IF EXISTS dispatch_group_members_insert_master_or_dev ON public.dispatch_group_members;
CREATE POLICY dispatch_group_members_insert_master_or_dev
  ON public.dispatch_group_members FOR INSERT TO authenticated WITH CHECK (public.is_master_or_dev());
DROP POLICY IF EXISTS dispatch_group_members_delete_master_or_dev ON public.dispatch_group_members;
CREATE POLICY dispatch_group_members_delete_master_or_dev
  ON public.dispatch_group_members FOR DELETE TO authenticated USING (public.is_master_or_dev());

DROP POLICY IF EXISTS estimator_group_members_select_master_or_dev ON public.estimator_group_members;
CREATE POLICY estimator_group_members_select_master_or_dev
  ON public.estimator_group_members FOR SELECT TO authenticated USING (public.is_master_or_dev());
DROP POLICY IF EXISTS estimator_group_members_insert_master_or_dev ON public.estimator_group_members;
CREATE POLICY estimator_group_members_insert_master_or_dev
  ON public.estimator_group_members FOR INSERT TO authenticated WITH CHECK (public.is_master_or_dev());
DROP POLICY IF EXISTS estimator_group_members_delete_master_or_dev ON public.estimator_group_members;
CREATE POLICY estimator_group_members_delete_master_or_dev
  ON public.estimator_group_members FOR DELETE TO authenticated USING (public.is_master_or_dev());

-- 3) Additional People (row 12): the office edits and deletes a roster person who has no login. A person with a login
-- keeps the desk's gates (row 106); the creator's own-row policies stand.
DROP POLICY IF EXISTS office_update_non_login_people ON public.people;
CREATE POLICY office_update_non_login_people
  ON public.people
  FOR UPDATE
  TO authenticated
  USING (account_user_id IS NULL AND public.is_office_staff())
  WITH CHECK (account_user_id IS NULL AND public.is_office_staff());

DROP POLICY IF EXISTS office_delete_non_login_people ON public.people;
CREATE POLICY office_delete_non_login_people
  ON public.people
  FOR DELETE
  TO authenticated
  USING (account_user_id IS NULL AND public.is_office_staff());

-- 4) The sub portal pay schedule (row 22): the pay-run day is payroll's, so the controller with a dev.
DROP POLICY IF EXISTS controller_or_dev_insert_sub_pay ON public.app_settings;
CREATE POLICY controller_or_dev_insert_sub_pay
  ON public.app_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (key IN ('sub_pay_run_day', 'sub_pay_explainer') AND (public.is_dev() OR public.is_controller()));

DROP POLICY IF EXISTS controller_or_dev_update_sub_pay ON public.app_settings;
CREATE POLICY controller_or_dev_update_sub_pay
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (key IN ('sub_pay_run_day', 'sub_pay_explainer') AND (public.is_dev() OR public.is_controller()))
  WITH CHECK (key IN ('sub_pay_run_day', 'sub_pay_explainer') AND (public.is_dev() OR public.is_controller()));
