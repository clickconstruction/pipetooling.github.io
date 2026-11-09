SET lock_timeout = '3s';

-- Punch list #188 (the dev gates), PR 10, v2.6763: the pages and the Quickfill edit modes, rows 61 and 67 to 71 of the
-- audit table, every recommendation taken as written by the owner on 2026-11-08. The database side of the doors that
-- write rows only a dev could:
--   row 61  Hiring → Onboarding settings and the Team review weights — team_onboarding_items inserted, updated and
--           deleted by the owner too; the two weight keys written by the owner too.
--   row 67  Quickfill → the edit modes on Office (arriving and leaving), Difficult people and Assistant Dailys — the
--           three template keys and the difficult-people items table, the office (is_office_staff()).
--   row 69  The Bridge — bridge_calls and the bridge_weekly_sheet_on_v1 switch, the owner too.
--   row 70  Templates — workflow_templates updated and deleted by the owner too (insert admits the office already).
-- Rows 68 (Moneyfill) and 71 (a course that is off) read what their audiences read already: client lines alone.
-- Additive and idempotent: no table is created, so no fence call is owed.

-- 1) Hiring (row 61)
DROP POLICY IF EXISTS "Owner inserts onboarding items" ON public.team_onboarding_items;
CREATE POLICY "Owner inserts onboarding items" ON public.team_onboarding_items FOR INSERT WITH CHECK (public.is_master_or_dev());
DROP POLICY IF EXISTS "Owner updates onboarding items" ON public.team_onboarding_items;
CREATE POLICY "Owner updates onboarding items" ON public.team_onboarding_items FOR UPDATE USING (public.is_master_or_dev()) WITH CHECK (public.is_master_or_dev());
DROP POLICY IF EXISTS "Owner deletes onboarding items" ON public.team_onboarding_items;
CREATE POLICY "Owner deletes onboarding items" ON public.team_onboarding_items FOR DELETE USING (public.is_master_or_dev());
DROP POLICY IF EXISTS master_or_dev_insert_team_review_weights ON public.app_settings;
CREATE POLICY master_or_dev_insert_team_review_weights ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (key IN ('team_review_composite_weights_v1', 'team_review_composite_include_crew_v1') AND public.is_master_or_dev());
DROP POLICY IF EXISTS master_or_dev_update_team_review_weights ON public.app_settings;
CREATE POLICY master_or_dev_update_team_review_weights ON public.app_settings FOR UPDATE TO authenticated
  USING (key IN ('team_review_composite_weights_v1', 'team_review_composite_include_crew_v1') AND public.is_master_or_dev())
  WITH CHECK (key IN ('team_review_composite_weights_v1', 'team_review_composite_include_crew_v1') AND public.is_master_or_dev());

-- 2) Quickfill's edit modes (row 67): the three templates in app_settings and the difficult-people items.
DROP POLICY IF EXISTS office_insert_quickfill_templates ON public.app_settings;
CREATE POLICY office_insert_quickfill_templates ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (key IN ('quickfill_office_arriving_items', 'quickfill_office_leaving_items', 'quickfill_assistant_dailys_items') AND public.is_office_staff());
DROP POLICY IF EXISTS office_update_quickfill_templates ON public.app_settings;
CREATE POLICY office_update_quickfill_templates ON public.app_settings FOR UPDATE TO authenticated
  USING (key IN ('quickfill_office_arriving_items', 'quickfill_office_leaving_items', 'quickfill_assistant_dailys_items') AND public.is_office_staff())
  WITH CHECK (key IN ('quickfill_office_arriving_items', 'quickfill_office_leaving_items', 'quickfill_assistant_dailys_items') AND public.is_office_staff());
DROP POLICY IF EXISTS quickfill_difficult_people_items_insert_office ON public.quickfill_difficult_people_items;
CREATE POLICY quickfill_difficult_people_items_insert_office ON public.quickfill_difficult_people_items FOR INSERT TO authenticated WITH CHECK (public.is_office_staff());
DROP POLICY IF EXISTS quickfill_difficult_people_items_update_office ON public.quickfill_difficult_people_items;
CREATE POLICY quickfill_difficult_people_items_update_office ON public.quickfill_difficult_people_items FOR UPDATE TO authenticated USING (public.is_office_staff()) WITH CHECK (public.is_office_staff());
DROP POLICY IF EXISTS quickfill_difficult_people_items_delete_office ON public.quickfill_difficult_people_items;
CREATE POLICY quickfill_difficult_people_items_delete_office ON public.quickfill_difficult_people_items FOR DELETE TO authenticated USING (public.is_office_staff());

-- 3) The Bridge (row 69)
DROP POLICY IF EXISTS bridge_calls_master_or_dev ON public.bridge_calls;
CREATE POLICY bridge_calls_master_or_dev ON public.bridge_calls FOR ALL TO authenticated USING (public.is_master_or_dev()) WITH CHECK (public.is_master_or_dev());
DROP POLICY IF EXISTS master_or_dev_update_bridge_weekly_sheet_on ON public.app_settings;
CREATE POLICY master_or_dev_update_bridge_weekly_sheet_on ON public.app_settings FOR UPDATE TO authenticated
  USING (key = 'bridge_weekly_sheet_on_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'bridge_weekly_sheet_on_v1' AND public.is_master_or_dev());

-- 4) Templates (row 70)
DROP POLICY IF EXISTS "Owner updates templates" ON public.workflow_templates;
CREATE POLICY "Owner updates templates" ON public.workflow_templates FOR UPDATE USING (public.is_master_or_dev()) WITH CHECK (public.is_master_or_dev());
DROP POLICY IF EXISTS "Owner deletes templates" ON public.workflow_templates;
CREATE POLICY "Owner deletes templates" ON public.workflow_templates FOR DELETE USING (public.is_master_or_dev());
