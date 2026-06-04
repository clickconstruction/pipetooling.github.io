-- Wrap auth.uid()/auth.role() in (select ...) inside RLS policy expressions.
-- Fixes Supabase performance advisor `auth_rls_initplan`: a bare auth.uid() is
-- re-evaluated per-row; wrapping it as (select auth.uid()) lets Postgres treat it
-- as an InitPlan (evaluated once per query). No change to policy roles, command,
-- permissive flag, or access semantics -- only the expression is rewritten.
-- Generated from pg_policies on project yewfzhbofbbyvkvtaatw (plumbing-stage-manager).
-- 509 policies altered. Append-only; idempotent (re-running is a no-op).

BEGIN;

ALTER POLICY "Map roles can delete address geocodes" ON public.address_geocodes
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))));

ALTER POLICY "Map roles can insert address geocodes" ON public.address_geocodes
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))));

ALTER POLICY "Map roles can read address geocodes" ON public.address_geocodes
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))));

ALTER POLICY "Map roles can update address geocodes" ON public.address_geocodes
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))));

ALTER POLICY "Authenticated users can read app settings" ON public.app_settings
  USING (((select auth.role()) = 'authenticated'::text));

ALTER POLICY "Authenticated users can view assembly types" ON public.assembly_types
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "Authorized users can delete assembly types" ON public.assembly_types
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))));

ALTER POLICY "Authorized users can insert assembly types" ON public.assembly_types
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))));

ALTER POLICY "Authorized users can update assembly types" ON public.assembly_types
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))));

ALTER POLICY "Attendance incidents staff insert" ON public.attendance_incidents
  WITH CHECK (((created_by_user_id = (select auth.uid())) AND (is_dev() OR is_pay_approved_master() OR is_master_or_dev() OR is_assistant_of_pay_approved_master() OR is_assistant() OR is_team_lead_for_member((select auth.uid()), subject_user_id))));

ALTER POLICY "Attendance incidents staff select" ON public.attendance_incidents
  USING ((is_dev() OR is_pay_approved_master() OR is_master_or_dev() OR is_assistant_of_pay_approved_master() OR is_assistant() OR is_team_lead_for_member((select auth.uid()), subject_user_id)));

ALTER POLICY "Attendance incidents subject select own" ON public.attendance_incidents
  USING ((subject_user_id = (select auth.uid())));

ALTER POLICY "Bid pricing users can delete custom prices" ON public.bid_count_row_custom_prices
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)));

ALTER POLICY "Bid pricing users can insert custom prices" ON public.bid_count_row_custom_prices
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)));

ALTER POLICY "Bid pricing users can read custom prices" ON public.bid_count_row_custom_prices
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)));

ALTER POLICY "Bid pricing users can update custom prices" ON public.bid_count_row_custom_prices
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)));

ALTER POLICY "Bid pricing users can delete submission hides" ON public.bid_count_row_submission_hides
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)));

ALTER POLICY "Bid pricing users can insert submission hides" ON public.bid_count_row_submission_hides
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)));

ALTER POLICY "Bid pricing users can read submission hides" ON public.bid_count_row_submission_hides
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)));

ALTER POLICY "Bid pricing users can update submission hides" ON public.bid_count_row_submission_hides
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY "Authenticated users can read bid estimators extra users" ON public.bid_estimators_extra_users
  USING (((select auth.role()) = 'authenticated'::text));

ALTER POLICY "Staff can delete bid estimators extra users" ON public.bid_estimators_extra_users
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Staff can insert bid estimators extra users" ON public.bid_estimators_extra_users
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY bpps_delete ON public.bid_pricing_package_sends
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = 'dev'::user_role)))));

ALTER POLICY bpps_insert ON public.bid_pricing_package_sends
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND can_access_bid_for_pricing(bid_id) AND (sent_by_user_id = (select auth.uid()))));

ALTER POLICY bpps_select ON public.bid_pricing_package_sends
  USING (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND can_access_bid_for_pricing(bid_id)));

ALTER POLICY bpps_update ON public.bid_pricing_package_sends
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = 'dev'::user_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = 'dev'::user_role)))));

ALTER POLICY "Users delete own working board columns" ON public.bid_working_board_columns
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users insert own working board columns" ON public.bid_working_board_columns
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users select own working board columns" ON public.bid_working_board_columns
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users update own working board columns" ON public.bid_working_board_columns
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users delete own working board placements" ON public.bid_working_board_placements
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users insert own working board placements" ON public.bid_working_board_placements
  WITH CHECK ((((select auth.uid()) = user_id) AND user_is_bid_estimator_or_account_manager(bid_id) AND user_owns_working_board_column(column_id)));

ALTER POLICY "Users select own working board placements" ON public.bid_working_board_placements
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users update own working board placements" ON public.bid_working_board_placements
  USING (((select auth.uid()) = user_id))
  WITH CHECK ((((select auth.uid()) = user_id) AND user_is_bid_estimator_or_account_manager(bid_id) AND user_owns_working_board_column(column_id)));

ALTER POLICY "Devs masters assistants estimators primaries can delete bids" ON public.bids
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND ((created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))))));

ALTER POLICY "Devs masters assistants estimators primaries can insert bids" ON public.bids
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND (created_by = (select auth.uid()))));

ALTER POLICY "Devs masters assistants estimators primaries can read bids" ON public.bids
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND ((created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))))));

ALTER POLICY "Devs masters assistants estimators primaries can update bids" ON public.bids
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND ((created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

ALTER POLICY "Devs masters assistants estimators primaries can delete bids co" ON public.bids_count_rows
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_count_rows.bid_id) AND ((b.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role])))))))))));

ALTER POLICY "Devs masters assistants estimators primaries can insert bids co" ON public.bids_count_rows
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_count_rows.bid_id) AND ((b.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role])))))))))));

ALTER POLICY "Devs masters assistants estimators primaries can read bids coun" ON public.bids_count_rows
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_count_rows.bid_id) AND ((b.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role])))))))))));

ALTER POLICY "Devs masters assistants estimators primaries can update bids co" ON public.bids_count_rows
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_count_rows.bid_id) AND ((b.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role])))))))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

ALTER POLICY "Devs masters assistants estimators primaries can read bids gc b" ON public.bids_gc_builders
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND ((created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))))));

ALTER POLICY "Devs, masters, assistants, and estimators can delete bids gc bu" ON public.bids_gc_builders
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND ((created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role]))))))));

ALTER POLICY "Devs, masters, assistants, and estimators can insert bids gc bu" ON public.bids_gc_builders
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (created_by = (select auth.uid()))));

ALTER POLICY "Devs, masters, assistants, and estimators can update bids gc bu" ON public.bids_gc_builders
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND ((created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role]))))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))));

ALTER POLICY "Devs masters assistants estimators primaries can read bids subm" ON public.bids_submission_entries
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_submission_entries.bid_id) AND ((b.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role]))))) OR ((EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) AND ((EXISTS ( SELECT 1
           FROM (customers c
             JOIN master_primaries mp ON ((mp.master_id = c.master_user_id)))
          WHERE ((c.id = b.customer_id) AND (mp.primary_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM master_primaries mp
          WHERE ((mp.master_id = b.created_by) AND (mp.primary_id = (select auth.uid()))))) OR ((b.gc_builder_id IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM (bids_gc_builders bgb
             JOIN master_primaries mp ON ((mp.master_id = bgb.created_by)))
          WHERE ((bgb.id = b.gc_builder_id) AND (mp.primary_id = (select auth.uid())))))) OR (EXISTS ( SELECT 1
           FROM (master_assistants ma
             JOIN master_primaries mp ON ((mp.master_id = ma.master_id)))
          WHERE ((ma.assistant_id = b.created_by) AND (mp.primary_id = (select auth.uid())))))))))))));

ALTER POLICY "Devs, masters, assistants, and estimators can delete bids submi" ON public.bids_submission_entries
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_submission_entries.bid_id) AND ((b.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role])))))) AND estimator_can_access_service_type(b.service_type_id))))));

ALTER POLICY "Devs, masters, assistants, and estimators can insert bids submi" ON public.bids_submission_entries
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_submission_entries.bid_id) AND ((b.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role])))))) AND estimator_can_access_service_type(b.service_type_id))))));

ALTER POLICY "Devs, masters, assistants, and estimators can update bids submi" ON public.bids_submission_entries
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_submission_entries.bid_id) AND ((b.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role])))))) AND estimator_can_access_service_type(b.service_type_id))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))));

ALTER POLICY bids_takeoff_rough_part_lines_delete ON public.bids_takeoff_rough_part_lines
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_takeoff_rough_part_lines.bid_id) AND ((b.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))) OR superintendent_can_access_bid(b.*)))))));

ALTER POLICY bids_takeoff_rough_part_lines_insert ON public.bids_takeoff_rough_part_lines
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_takeoff_rough_part_lines.bid_id) AND ((b.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))) OR superintendent_can_access_bid(b.*)))))));

ALTER POLICY bids_takeoff_rough_part_lines_select ON public.bids_takeoff_rough_part_lines
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_takeoff_rough_part_lines.bid_id) AND ((b.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))) OR superintendent_can_access_bid(b.*)))))));

ALTER POLICY bids_takeoff_rough_part_lines_update ON public.bids_takeoff_rough_part_lines
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_takeoff_rough_part_lines.bid_id) AND ((b.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))) OR superintendent_can_access_bid(b.*)))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY "Devs masters assistants estimators primaries superintendents ca" ON public.bids_takeoff_template_mappings
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_takeoff_template_mappings.bid_id) AND ((b.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))) OR superintendent_can_access_bid(b.*)))))));

ALTER POLICY "Devs, masters, assistants, and estimators can delete mappings" ON public.bids_takeoff_template_mappings
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_takeoff_template_mappings.bid_id) AND ((b.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role])))))) AND estimator_can_access_service_type(b.service_type_id))))));

ALTER POLICY "Devs, masters, assistants, and estimators can insert mappings" ON public.bids_takeoff_template_mappings
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_takeoff_template_mappings.bid_id) AND ((b.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role])))))) AND estimator_can_access_service_type(b.service_type_id))))));

ALTER POLICY "Devs, masters, assistants, and estimators can read mappings" ON public.bids_takeoff_template_mappings
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_takeoff_template_mappings.bid_id) AND ((b.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role])))))) AND estimator_can_access_service_type(b.service_type_id))))));

ALTER POLICY "Devs, masters, assistants, and estimators can update mappings" ON public.bids_takeoff_template_mappings
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_takeoff_template_mappings.bid_id) AND ((b.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role])))))) AND estimator_can_access_service_type(b.service_type_id))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))));

ALTER POLICY "Users read checklist instance assignees for themselves" ON public.checklist_instance_assignees
  USING ((user_id = (select auth.uid())));

ALTER POLICY "Users read instances where assigned or dev master assistant" ON public.checklist_instances
  USING ((is_dev_or_master_or_assistant() OR (EXISTS ( SELECT 1
   FROM checklist_instance_assignees cia
  WHERE ((cia.checklist_instance_id = checklist_instances.id) AND (cia.user_id = (select auth.uid()))))) OR checklist_item_created_by_auth_user(checklist_item_id)));

ALTER POLICY "Users update instances where assigned or staff" ON public.checklist_instances
  USING ((is_dev_or_master_or_assistant() OR (EXISTS ( SELECT 1
   FROM checklist_instance_assignees
  WHERE ((checklist_instance_assignees.checklist_instance_id = checklist_instances.id) AND (checklist_instance_assignees.user_id = (select auth.uid())))))))
  WITH CHECK ((is_dev_or_master_or_assistant() OR (EXISTS ( SELECT 1
   FROM checklist_instance_assignees
  WHERE ((checklist_instance_assignees.checklist_instance_id = checklist_instances.id) AND (checklist_instance_assignees.user_id = (select auth.uid())))))));

ALTER POLICY "Users read checklist item assignees for themselves" ON public.checklist_item_assignees
  USING ((user_id = (select auth.uid())));

ALTER POLICY "Devs masters assistants can delete checklist items" ON public.checklist_items
  USING ((is_dev_or_master_or_assistant() OR (can_define_task_style_checklist_items() AND (created_by_user_id = (select auth.uid())))));

ALTER POLICY "Devs masters assistants can insert checklist items" ON public.checklist_items
  WITH CHECK ((is_dev_or_master_or_assistant() OR (can_define_task_style_checklist_items() AND (created_by_user_id = (select auth.uid())))));

ALTER POLICY "Devs masters assistants can update checklist items" ON public.checklist_items
  USING ((is_dev_or_master_or_assistant() OR (can_define_task_style_checklist_items() AND (created_by_user_id = (select auth.uid())))))
  WITH CHECK ((is_dev_or_master_or_assistant() OR (can_define_task_style_checklist_items() AND (created_by_user_id = (select auth.uid())))));

ALTER POLICY "Users read checklist items where assigned" ON public.checklist_items
  USING ((is_dev_or_master_or_assistant() OR (created_by_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM checklist_item_assignees cia
  WHERE ((cia.checklist_item_id = checklist_items.id) AND (cia.user_id = (select auth.uid())))))));

ALTER POLICY "checklist_tech_tree_group_tasks update" ON public.checklist_tech_tree_group_tasks
  USING ((EXISTS ( SELECT 1
   FROM checklist_tech_tree_groups g
  WHERE ((g.id = checklist_tech_tree_group_tasks.group_id) AND (can_edit_checklist_tech_tree_structure_for_roadmap(g.roadmap_id) OR ((EXISTS ( SELECT 1
           FROM checklist_tech_tree_task_assignees a
          WHERE ((a.task_id = checklist_tech_tree_group_tasks.id) AND (a.user_id = (select auth.uid()))))) AND can_select_checklist_tech_tree_roadmap(g.roadmap_id)))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM checklist_tech_tree_groups g
  WHERE ((g.id = checklist_tech_tree_group_tasks.group_id) AND (can_edit_checklist_tech_tree_structure_for_roadmap(g.roadmap_id) OR ((EXISTS ( SELECT 1
           FROM checklist_tech_tree_task_assignees a
          WHERE ((a.task_id = checklist_tech_tree_group_tasks.id) AND (a.user_id = (select auth.uid()))))) AND can_select_checklist_tech_tree_roadmap(g.roadmap_id)))))));

ALTER POLICY "checklist_tech_tree_roadmaps insert staff primary" ON public.checklist_tech_tree_roadmaps
  WITH CHECK ((is_checklist_tech_tree_staff_or_primary() AND (created_by_user_id = (select auth.uid()))));

ALTER POLICY "Team leads can read member clock sessions" ON public.clock_sessions
  USING (is_team_lead_for_member((select auth.uid()), user_id));

ALTER POLICY "Team leads can update member clock sessions" ON public.clock_sessions
  USING (is_team_lead_for_member((select auth.uid()), user_id))
  WITH CHECK (is_team_lead_for_member((select auth.uid()), user_id));

ALTER POLICY "Users and pay access can update clock sessions" ON public.clock_sessions
  USING (((user_id = (select auth.uid())) OR is_pay_approved_master() OR is_assistant_of_pay_approved_master()))
  WITH CHECK (((user_id = (select auth.uid())) OR is_pay_approved_master() OR is_assistant_of_pay_approved_master()));

ALTER POLICY "Users can insert own clock sessions" ON public.clock_sessions
  WITH CHECK (((user_id = (select auth.uid())) AND (origin = 'user_punch'::text)));

ALTER POLICY "Users can read own clock sessions" ON public.clock_sessions
  USING ((user_id = (select auth.uid())));

ALTER POLICY "Devs masters assistants estimators primaries superintendents ca" ON public.cost_estimate_labor_rows
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM cost_estimates ce
  WHERE ((ce.id = cost_estimate_labor_rows.cost_estimate_id) AND can_access_bid_for_pricing(ce.bid_id))))));

ALTER POLICY "Devs masters assistants estimators primaries superintendents ca" ON public.cost_estimates
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)));

ALTER POLICY "Shared users can read own share" ON public.cost_matrix_teams_shares
  USING ((shared_with_user_id = (select auth.uid())));

ALTER POLICY "All authenticated users can read counts_fixture_group_items" ON public.counts_fixture_group_items
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "Devs can manage counts_fixture_group_items" ON public.counts_fixture_group_items
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))));

ALTER POLICY "All authenticated users can read counts_fixture_groups" ON public.counts_fixture_groups
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "Devs can manage counts_fixture_groups" ON public.counts_fixture_groups
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))));

ALTER POLICY "Devs, masters, assistants, and estimators can delete customer c" ON public.customer_contact_persons
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_contact_persons.customer_id) AND ((c.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = c.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = c.master_user_id) AND (master_shares.viewing_master_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'estimator'::user_role))))))))));

ALTER POLICY "Devs, masters, assistants, and estimators can insert customer c" ON public.customer_contact_persons
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_contact_persons.customer_id) AND ((c.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = c.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = c.master_user_id) AND (master_shares.viewing_master_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'estimator'::user_role))))))))));

ALTER POLICY "Devs, masters, assistants, and estimators can read customer con" ON public.customer_contact_persons
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_contact_persons.customer_id) AND ((c.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = c.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = c.master_user_id) AND (master_shares.viewing_master_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'estimator'::user_role))))))))));

ALTER POLICY "Devs, masters, assistants, and estimators can update customer c" ON public.customer_contact_persons
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_contact_persons.customer_id) AND ((c.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = c.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = c.master_user_id) AND (master_shares.viewing_master_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'estimator'::user_role))))))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))));

ALTER POLICY "Devs, masters, assistants, and estimators can delete customer c" ON public.customer_contacts
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_contacts.customer_id) AND ((c.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = c.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = c.master_user_id) AND (master_shares.viewing_master_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'estimator'::user_role))))))))));

ALTER POLICY "Devs, masters, assistants, and estimators can insert customer c" ON public.customer_contacts
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_contacts.customer_id) AND ((c.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = c.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = c.master_user_id) AND (master_shares.viewing_master_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'estimator'::user_role)))))))) AND (created_by = (select auth.uid()))));

ALTER POLICY "Devs, masters, assistants, and estimators can read customer con" ON public.customer_contacts
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_contacts.customer_id) AND ((c.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = c.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = c.master_user_id) AND (master_shares.viewing_master_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'estimator'::user_role))))))))));

ALTER POLICY "Devs, masters, assistants, and estimators can update customer c" ON public.customer_contacts
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_contacts.customer_id) AND ((c.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = c.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = c.master_user_id) AND (master_shares.viewing_master_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'estimator'::user_role))))))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))));

ALTER POLICY "Assistants can insert customers when master is assigned and has" ON public.customers
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'assistant'::user_role)))) AND (master_user_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = customers.master_user_id) AND (u.role = ANY (ARRAY['master_technician'::user_role, 'dev'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = customers.master_user_id) AND (master_assistants.assistant_id = (select auth.uid())))))));

ALTER POLICY "Assistants can update customers when master has adopted them" ON public.customers
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'assistant'::user_role)))) AND (master_user_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = customers.master_user_id) AND (master_assistants.assistant_id = (select auth.uid())))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'assistant'::user_role)))) AND (master_user_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = customers.master_user_id) AND (u.role = ANY (ARRAY['master_technician'::user_role, 'dev'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = customers.master_user_id) AND (master_assistants.assistant_id = (select auth.uid())))))));

ALTER POLICY "Estimators can insert customers when master is assigned" ON public.customers
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'estimator'::user_role)))) AND (master_user_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = customers.master_user_id) AND (u.role = ANY (ARRAY['master_technician'::user_role, 'dev'::user_role])))))));

ALTER POLICY "Estimators can update customers" ON public.customers
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'estimator'::user_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'estimator'::user_role)))));

ALTER POLICY "Masters can create customers" ON public.customers
  WITH CHECK (((master_user_id = (select auth.uid())) OR is_dev()));

ALTER POLICY "Masters can delete own customers" ON public.customers
  USING (((master_user_id = (select auth.uid())) OR is_dev()));

ALTER POLICY "Masters can delete their own customers, devs can delete any" ON public.customers
  USING (((master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role))))));

ALTER POLICY "Masters can update own customers" ON public.customers
  USING (((master_user_id = (select auth.uid())) OR is_dev()))
  WITH CHECK (true);

ALTER POLICY "Masters see own customers" ON public.customers
  USING ((master_user_id = (select auth.uid())));

ALTER POLICY "Superintendents can insert customers when master is assigned" ON public.customers
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::user_role)))) AND (master_user_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = customers.master_user_id) AND (u.role = ANY (ARRAY['master_technician'::user_role, 'dev'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM master_superintendents ms
  WHERE ((ms.master_id = customers.master_user_id) AND (ms.superintendent_id = (select auth.uid())))))));

ALTER POLICY "Users can see their own customers or customers from masters who" ON public.customers
  USING (((master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = customers.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM master_shares
  WHERE ((master_shares.sharing_master_id = customers.master_user_id) AND (master_shares.viewing_master_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role])))))));

ALTER POLICY "Devs delete own ignored checklist items" ON public.dev_ignored_checklist_items
  USING ((((select auth.uid()) = dev_user_id) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role))))));

ALTER POLICY "Devs insert own ignored checklist items" ON public.dev_ignored_checklist_items
  WITH CHECK ((((select auth.uid()) = dev_user_id) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role))))));

ALTER POLICY "Devs select own ignored checklist items" ON public.dev_ignored_checklist_items
  USING ((((select auth.uid()) = dev_user_id) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role))))));

ALTER POLICY "Devs can delete own read completed items" ON public.dev_read_completed_items
  USING ((((select auth.uid()) = dev_user_id) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role))))));

ALTER POLICY "Devs can insert own read completed items" ON public.dev_read_completed_items
  WITH CHECK ((((select auth.uid()) = dev_user_id) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role))))));

ALTER POLICY "Devs can select own read completed items" ON public.dev_read_completed_items
  USING ((((select auth.uid()) = dev_user_id) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role))))));

ALTER POLICY dispatch_group_members_select_dev_or_self ON public.dispatch_group_members
  USING ((is_dev() OR (user_id = (select auth.uid()))));

ALTER POLICY dispatch_request_dismissals_insert_own ON public.dispatch_request_dismissals
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY dispatch_request_dismissals_select_own ON public.dispatch_request_dismissals
  USING (((select auth.uid()) = user_id));

ALTER POLICY dispatch_request_notes_insert ON public.dispatch_request_notes
  WITH CHECK (((author_user_id = (select auth.uid())) AND (is_dev() OR is_dispatch_group_member()) AND (EXISTS ( SELECT 1
   FROM dispatch_requests r
  WHERE ((r.id = dispatch_request_notes.request_id) AND ((r.from_user_id = (select auth.uid())) OR is_dev() OR is_dispatch_group_member()))))));

ALTER POLICY dispatch_request_notes_select ON public.dispatch_request_notes
  USING ((EXISTS ( SELECT 1
   FROM dispatch_requests r
  WHERE ((r.id = dispatch_request_notes.request_id) AND ((r.from_user_id = (select auth.uid())) OR is_dev() OR is_dispatch_group_member())))));

ALTER POLICY dispatch_requests_insert ON public.dispatch_requests
  WITH CHECK ((from_user_id = (select auth.uid())));

ALTER POLICY dispatch_requests_select ON public.dispatch_requests
  USING (((from_user_id = (select auth.uid())) OR is_dev() OR is_dispatch_group_member()));

ALTER POLICY "Owners can insert email templates" ON public.email_templates
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))));

ALTER POLICY "Owners can read email templates" ON public.email_templates
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))));

ALTER POLICY "Owners can update email templates" ON public.email_templates
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))));

ALTER POLICY estimate_customer_events_select ON public.estimate_customer_events
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM estimates e
  WHERE ((e.id = estimate_customer_events.estimate_id) AND (user_can_access_estimate(e.*) OR superintendent_can_access_estimate(e.*) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role])))))))))));

ALTER POLICY estimates_delete_draft ON public.estimates
  USING (((status = 'draft'::estimate_status) AND (is_dev() OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR user_can_access_estimate(estimates.*) OR superintendent_can_access_estimate(estimates.*) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))))));

ALTER POLICY estimates_insert ON public.estimates
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (created_by = (select auth.uid())) AND (is_dev() OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = estimates.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'estimator'::user_role)))) OR superintendent_can_access_estimate(estimates.*))));

ALTER POLICY estimates_select ON public.estimates
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (user_can_access_estimate(estimates.*) OR superintendent_can_access_estimate(estimates.*) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))))));

ALTER POLICY estimates_update_draft ON public.estimates
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (status = 'draft'::estimate_status) AND (user_can_access_estimate(estimates.*) OR superintendent_can_access_estimate(estimates.*) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (status = 'draft'::estimate_status)));

ALTER POLICY final_estimates_update_accepted_link_job ON public.estimates
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (status = 'customer_accepted'::estimate_status) AND (user_can_access_estimate(estimates.*) OR superintendent_can_access_estimate(estimates.*) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))))))
  WITH CHECK ((status = 'customer_accepted'::estimate_status));

ALTER POLICY estimates_thread_notes_insert ON public.estimates_thread_notes
  WITH CHECK (((author_user_id = (select auth.uid())) AND ((select auth.uid()) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM estimates e
  WHERE ((e.id = estimates_thread_notes.estimate_id) AND (user_can_access_estimate(e.*) OR superintendent_can_access_estimate(e.*) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role])))))))))));

ALTER POLICY estimates_thread_notes_select ON public.estimates_thread_notes
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM estimates e
  WHERE ((e.id = estimates_thread_notes.estimate_id) AND (user_can_access_estimate(e.*) OR superintendent_can_access_estimate(e.*) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role])))))))))));

ALTER POLICY estimator_group_members_select_dev_or_self ON public.estimator_group_members
  USING ((is_dev() OR (user_id = (select auth.uid()))));

ALTER POLICY estimator_request_dismissals_insert_own ON public.estimator_request_dismissals
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY estimator_request_dismissals_select_own ON public.estimator_request_dismissals
  USING (((select auth.uid()) = user_id));

ALTER POLICY estimator_request_notes_insert ON public.estimator_request_notes
  WITH CHECK (((author_user_id = (select auth.uid())) AND (is_dev() OR is_estimator_group_member()) AND (EXISTS ( SELECT 1
   FROM estimator_requests r
  WHERE ((r.id = estimator_request_notes.request_id) AND ((r.from_user_id = (select auth.uid())) OR is_dev() OR is_estimator_group_member()))))));

ALTER POLICY estimator_request_notes_select ON public.estimator_request_notes
  USING ((EXISTS ( SELECT 1
   FROM estimator_requests r
  WHERE ((r.id = estimator_request_notes.request_id) AND ((r.from_user_id = (select auth.uid())) OR is_dev() OR is_estimator_group_member())))));

ALTER POLICY estimator_requests_insert ON public.estimator_requests
  WITH CHECK ((from_user_id = (select auth.uid())));

ALTER POLICY estimator_requests_select ON public.estimator_requests
  USING (((from_user_id = (select auth.uid())) OR is_dev() OR is_estimator_group_member()));

ALTER POLICY "Devs, masters, assistants can delete external team job payments" ON public.external_team_job_payments
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Devs, masters, assistants can insert external team job payments" ON public.external_team_job_payments
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Devs, masters, assistants can read external team job payments" ON public.external_team_job_payments
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Devs, masters, assistants can update external team job payments" ON public.external_team_job_payments
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Devs, masters, assistants can delete external team sub managers" ON public.external_team_sub_managers
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Devs, masters, assistants can insert external team sub managers" ON public.external_team_sub_managers
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Devs, masters, assistants can read external team sub managers" ON public.external_team_sub_managers
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Devs, masters, assistants can update external team sub managers" ON public.external_team_sub_managers
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Devs and masters can delete fixture labor defaults" ON public.fixture_labor_defaults
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))));

ALTER POLICY "Devs and masters can insert fixture labor defaults" ON public.fixture_labor_defaults
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))));

ALTER POLICY "Devs and masters can update fixture labor defaults" ON public.fixture_labor_defaults
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))));

ALTER POLICY "Devs, masters, assistants, and estimators can read fixture labo" ON public.fixture_labor_defaults
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))));

ALTER POLICY "All authenticated users can read fixture types" ON public.fixture_types
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "Devs masters assistants estimators primaries can delete fixture" ON public.fixture_types
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

ALTER POLICY "Devs masters assistants estimators primaries can insert fixture" ON public.fixture_types
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

ALTER POLICY "Devs masters assistants estimators primaries can update fixture" ON public.fixture_types
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

ALTER POLICY "All authenticated can read inspection quick links" ON public.inspection_quick_links
  USING (((select auth.role()) = 'authenticated'::text));

ALTER POLICY "All authenticated can read inspection types" ON public.inspection_types
  USING (((select auth.role()) = 'authenticated'::text));

ALTER POLICY "Devs masters assistants can insert inspections" ON public.inspections
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))) AND (created_by_user_id = (select auth.uid()))));

ALTER POLICY "Devs masters assistants can select inspections" ON public.inspections
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Devs masters assistants can update inspections" ON public.inspections
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Primary can insert inspections" ON public.inspections
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) AND (created_by_user_id = (select auth.uid()))));

ALTER POLICY "Primary can select inspections" ON public.inspections
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))));

ALTER POLICY "Primary can update inspections" ON public.inspections
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))));

ALTER POLICY "Devs masters assistants can delete job book entries" ON public.job_book_entries
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT (select auth.uid()) AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Devs masters assistants can insert job book entries" ON public.job_book_entries
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT (select auth.uid()) AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Devs masters assistants can update job book entries" ON public.job_book_entries
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT (select auth.uid()) AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT (select auth.uid()) AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY job_collect_payment_flows_select_pending_dispatch_office ON public.job_collect_payment_flows
  USING (((status = 'pending_dispatch'::text) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['assistant'::user_role, 'master_technician'::user_role, 'primary'::user_role])))))));

ALTER POLICY job_collect_payment_flows_select_staff ON public.job_collect_payment_flows
  USING (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = job_collect_payment_flows.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id)))))));

ALTER POLICY job_collect_payment_flows_select_team ON public.job_collect_payment_flows
  USING ((EXISTS ( SELECT 1
   FROM jobs_ledger_team_members jtm
  WHERE ((jtm.job_id = job_collect_payment_flows.job_id) AND (jtm.user_id = (select auth.uid()))))));

ALTER POLICY job_schedule_blocks_delete ON public.job_schedule_blocks
  USING (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = job_schedule_blocks.job_id) AND (is_dev() OR (j.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id) OR (EXISTS ( SELECT 1
           FROM master_superintendents ms
          WHERE ((ms.master_id = j.master_user_id) AND (ms.superintendent_id = (select auth.uid()))))) OR ((j.project_id IS NOT NULL) AND can_access_project_row(j.project_id) AND (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::user_role)))))))))));

ALTER POLICY job_schedule_blocks_insert ON public.job_schedule_blocks
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = job_schedule_blocks.job_id) AND (is_dev() OR (j.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id) OR (EXISTS ( SELECT 1
           FROM master_superintendents ms
          WHERE ((ms.master_id = j.master_user_id) AND (ms.superintendent_id = (select auth.uid()))))) OR ((j.project_id IS NOT NULL) AND can_access_project_row(j.project_id) AND (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::user_role)))))))))));

ALTER POLICY job_schedule_blocks_select ON public.job_schedule_blocks
  USING (((assignee_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = job_schedule_blocks.job_id) AND (is_dev() OR (j.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_superintendents ms
          WHERE ((ms.master_id = j.master_user_id) AND (ms.superintendent_id = (select auth.uid()))))) OR ((j.project_id IS NOT NULL) AND can_access_project_row(j.project_id)) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id) OR (EXISTS ( SELECT 1
           FROM jobs_ledger_team_members jtm
          WHERE ((jtm.job_id = j.id) AND (jtm.user_id = (select auth.uid())))))))))));

ALTER POLICY job_schedule_blocks_update ON public.job_schedule_blocks
  USING (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = job_schedule_blocks.job_id) AND (is_dev() OR (j.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id) OR (EXISTS ( SELECT 1
           FROM master_superintendents ms
          WHERE ((ms.master_id = j.master_user_id) AND (ms.superintendent_id = (select auth.uid()))))) OR ((j.project_id IS NOT NULL) AND can_access_project_row(j.project_id) AND (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::user_role)))))))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY job_status_events_insert ON public.job_status_events
  WITH CHECK ((((select auth.uid()) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = job_status_events.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id) OR (EXISTS ( SELECT 1
           FROM jobs_ledger_team_members
          WHERE ((jobs_ledger_team_members.job_id = j.id) AND (jobs_ledger_team_members.user_id = (select auth.uid())))))))))));

ALTER POLICY job_status_events_select ON public.job_status_events
  USING ((EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = job_status_events.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id) OR (EXISTS ( SELECT 1
           FROM jobs_ledger_team_members
          WHERE ((jobs_ledger_team_members.job_id = j.id) AND (jobs_ledger_team_members.user_id = (select auth.uid()))))))))));

ALTER POLICY "Devs, masters, assistants can delete jobs ledger" ON public.jobs_ledger
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))) AND ((master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = jobs_ledger.master_user_id)))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = jobs_ledger.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), master_user_id))));

ALTER POLICY "Devs, masters, assistants can insert jobs ledger" ON public.jobs_ledger
  WITH CHECK ((is_dev() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['master_technician'::user_role, 'assistant'::user_role]))))) AND ((master_user_id = (select auth.uid())) OR ((project_id IS NOT NULL) AND can_access_project_row(project_id) AND (master_user_id = ( SELECT projects.master_user_id
   FROM projects
  WHERE (projects.id = jobs_ledger.project_id)))) OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'assistant'::user_role)))) AND ((EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = jobs_ledger.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), master_user_id)))))));

ALTER POLICY "Devs, masters, assistants, primary can read jobs ledger" ON public.jobs_ledger
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))) AND ((master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = jobs_ledger.master_user_id)))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = jobs_ledger.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), master_user_id))));

ALTER POLICY "Devs, masters, assistants, primary can update jobs ledger" ON public.jobs_ledger
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))) AND ((master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = jobs_ledger.master_user_id)))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = jobs_ledger.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), master_user_id))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))));

ALTER POLICY "Team leads can read jobs ledger for member clock sessions" ON public.jobs_ledger
  USING ((EXISTS ( SELECT 1
   FROM clock_sessions cs
  WHERE ((cs.job_ledger_id = jobs_ledger.id) AND is_team_lead_for_member((select auth.uid()), cs.user_id)))));

ALTER POLICY "Users can read jobs ledger linked from own clock sessions" ON public.jobs_ledger
  USING ((EXISTS ( SELECT 1
   FROM clock_sessions cs
  WHERE ((cs.job_ledger_id = jobs_ledger.id) AND (cs.job_ledger_id IS NOT NULL) AND (cs.user_id = (select auth.uid()))))));

ALTER POLICY "Devs, masters, assistants can delete jobs ledger fixtures" ON public.jobs_ledger_fixtures
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_fixtures.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id)))))));

ALTER POLICY "Devs, masters, assistants can insert jobs ledger fixtures" ON public.jobs_ledger_fixtures
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_fixtures.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid())))))))))));

ALTER POLICY "Devs, masters, assistants can update jobs ledger fixtures" ON public.jobs_ledger_fixtures
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_fixtures.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id)))))));

ALTER POLICY "Devs, masters, assistants, primary can read jobs ledger fixture" ON public.jobs_ledger_fixtures
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_fixtures.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id)))))));

ALTER POLICY "Invoice send log readable with jobs ledger invoices" ON public.jobs_ledger_invoice_stripe_email_sends
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM (jobs_ledger_invoices inv
     JOIN jobs_ledger j ON ((j.id = inv.job_id)))
  WHERE ((inv.id = jobs_ledger_invoice_stripe_email_sends.jobs_ledger_invoice_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_superintendents
          WHERE ((master_superintendents.master_id = j.master_user_id) AND (master_superintendents.superintendent_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id)))))));

ALTER POLICY "Devs, masters, assistants, primary can delete jobs ledger invoi" ON public.jobs_ledger_invoices
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_invoices.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id)))))));

ALTER POLICY "Devs, masters, assistants, primary can insert jobs ledger invoi" ON public.jobs_ledger_invoices
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_invoices.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid())))))))))));

ALTER POLICY "Devs, masters, assistants, primary can read jobs ledger invoice" ON public.jobs_ledger_invoices
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_invoices.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id)))))));

ALTER POLICY "Devs, masters, assistants, primary can update jobs ledger invoi" ON public.jobs_ledger_invoices
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_invoices.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id)))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))));

ALTER POLICY "Devs, masters, assistants, primary can delete jobs ledger mater" ON public.jobs_ledger_materials
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_materials.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id)))))));

ALTER POLICY "Devs, masters, assistants, primary can insert jobs ledger mater" ON public.jobs_ledger_materials
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_materials.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid())))))))))));

ALTER POLICY "Devs, masters, assistants, primary can read jobs ledger materia" ON public.jobs_ledger_materials
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_materials.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id)))))));

ALTER POLICY "Devs, masters, assistants, primary can update jobs ledger mater" ON public.jobs_ledger_materials
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_materials.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id)))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))));

ALTER POLICY "Devs, masters, assistants, primary can delete jobs ledger payme" ON public.jobs_ledger_payments
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_payments.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id)))))));

ALTER POLICY "Devs, masters, assistants, primary can insert jobs ledger payme" ON public.jobs_ledger_payments
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_payments.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid())))))))))));

ALTER POLICY "Devs, masters, assistants, primary can read jobs ledger payment" ON public.jobs_ledger_payments
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_payments.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id)))))));

ALTER POLICY "Devs, masters, assistants, primary can update jobs ledger payme" ON public.jobs_ledger_payments
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_payments.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id)))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))));

ALTER POLICY "Devs, masters, assistants can delete jobs ledger team members" ON public.jobs_ledger_team_members
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_team_members.job_id) AND ((j.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role))))))))));

ALTER POLICY "Devs, masters, assistants can insert jobs ledger team members" ON public.jobs_ledger_team_members
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_team_members.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id)))))));

ALTER POLICY "Devs, masters, assistants, primary can read jobs ledger team me" ON public.jobs_ledger_team_members
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_team_members.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id)))))));

ALTER POLICY "Subcontractors can read own jobs ledger team member rows" ON public.jobs_ledger_team_members
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'subcontractor'::user_role)))) AND (user_id = (select auth.uid()))));

ALTER POLICY jobs_ledger_thread_notes_insert ON public.jobs_ledger_thread_notes
  WITH CHECK (((author_user_id = (select auth.uid())) AND ((select auth.uid()) IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_thread_notes.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id) OR (EXISTS ( SELECT 1
           FROM jobs_ledger_team_members
          WHERE ((jobs_ledger_team_members.job_id = j.id) AND (jobs_ledger_team_members.user_id = (select auth.uid()))))))))) OR (auth_uid_is_helpers_or_subcontractor() AND ((EXISTS ( SELECT 1
   FROM jobs_ledger_team_members jtm
  WHERE ((jtm.job_id = jobs_ledger_thread_notes.job_id) AND (jtm.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM job_schedule_blocks jsb
  WHERE ((jsb.job_id = jobs_ledger_thread_notes.job_id) AND (jsb.assignee_user_id = (select auth.uid()))))))))));

ALTER POLICY jobs_ledger_thread_notes_select ON public.jobs_ledger_thread_notes
  USING (((EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_thread_notes.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id) OR (EXISTS ( SELECT 1
           FROM jobs_ledger_team_members
          WHERE ((jobs_ledger_team_members.job_id = j.id) AND (jobs_ledger_team_members.user_id = (select auth.uid()))))))))) OR (auth_uid_is_helpers_or_subcontractor() AND ((EXISTS ( SELECT 1
   FROM jobs_ledger_team_members jtm
  WHERE ((jtm.job_id = jobs_ledger_thread_notes.job_id) AND (jtm.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM job_schedule_blocks jsb
  WHERE ((jsb.job_id = jobs_ledger_thread_notes.job_id) AND (jsb.assignee_user_id = (select auth.uid())))))))));

ALTER POLICY "Devs, masters, assistants can delete jobs receivables" ON public.jobs_receivables
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))) AND ((master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = jobs_receivables.master_user_id)))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = jobs_receivables.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), master_user_id))));

ALTER POLICY "Devs, masters, assistants can insert jobs receivables" ON public.jobs_receivables
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))) AND ((master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = jobs_receivables.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))))));

ALTER POLICY "Devs, masters, assistants can read jobs receivables" ON public.jobs_receivables
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))) AND ((master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = jobs_receivables.master_user_id)))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = jobs_receivables.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), master_user_id))));

ALTER POLICY "Devs, masters, assistants can update jobs receivables" ON public.jobs_receivables
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))) AND ((master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = jobs_receivables.master_user_id)))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = jobs_receivables.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), master_user_id))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Devs masters assistants primary can delete jobs tally parts" ON public.jobs_tally_parts
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_tally_parts.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id)))))));

ALTER POLICY "Devs masters assistants primary can insert jobs tally parts" ON public.jobs_tally_parts
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_tally_parts.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id)))))));

ALTER POLICY "Devs masters assistants primary can read jobs tally parts" ON public.jobs_tally_parts
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_tally_parts.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id)))))));

ALTER POLICY "Devs masters assistants primary can update jobs tally parts" ON public.jobs_tally_parts
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_tally_parts.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id)))))));

ALTER POLICY "Subcontractors can insert jobs tally parts for their jobs" ON public.jobs_tally_parts
  WITH CHECK ((auth_uid_is_helpers_or_subcontractor() AND (created_by_user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM jobs_ledger_team_members jtm
  WHERE ((jtm.job_id = jobs_tally_parts.job_id) AND (jtm.user_id = (select auth.uid())))))));

ALTER POLICY "Subcontractors can read jobs tally parts for their jobs" ON public.jobs_tally_parts
  USING ((auth_uid_is_helpers_or_subcontractor() AND (EXISTS ( SELECT 1
   FROM jobs_ledger_team_members jtm
  WHERE ((jtm.job_id = jobs_tally_parts.job_id) AND (jtm.user_id = (select auth.uid())))))));

ALTER POLICY "Devs, masters, assistants, and estimators can delete labor book" ON public.labor_book_entries
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM labor_book_versions lbv
  WHERE ((lbv.id = labor_book_entries.version_id) AND estimator_can_access_service_type(lbv.service_type_id))))));

ALTER POLICY "Devs, masters, assistants, and estimators can insert labor book" ON public.labor_book_entries
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM labor_book_versions lbv
  WHERE ((lbv.id = labor_book_entries.version_id) AND estimator_can_access_service_type(lbv.service_type_id))))));

ALTER POLICY "Devs, masters, assistants, and estimators can read labor book e" ON public.labor_book_entries
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM labor_book_versions lbv
  WHERE ((lbv.id = labor_book_entries.version_id) AND estimator_can_access_service_type(lbv.service_type_id))))));

ALTER POLICY "Devs, masters, assistants, and estimators can update labor book" ON public.labor_book_entries
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM labor_book_versions lbv
  WHERE ((lbv.id = labor_book_entries.version_id) AND estimator_can_access_service_type(lbv.service_type_id))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))));

ALTER POLICY "Devs, masters, assistants, and estimators can delete labor book" ON public.labor_book_versions
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)));

ALTER POLICY "Devs, masters, assistants, and estimators can insert labor book" ON public.labor_book_versions
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)));

ALTER POLICY "Devs, masters, assistants, and estimators can read labor book v" ON public.labor_book_versions
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)));

ALTER POLICY "Devs, masters, assistants, and estimators can update labor book" ON public.labor_book_versions
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))));

ALTER POLICY "Assistants can read who adopted them" ON public.master_assistants
  USING (((assistant_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role])))))));

ALTER POLICY "Masters and devs can read all adoptions" ON public.master_assistants
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))));

ALTER POLICY "Masters can manage their own adoptions" ON public.master_assistants
  USING (((master_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role))))))
  WITH CHECK (((master_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role))))));

ALTER POLICY "Masters and devs can manage primary adoptions" ON public.master_primaries
  USING (((master_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role))))))
  WITH CHECK (((master_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role))))));

ALTER POLICY "Masters and devs can read all primary adoptions" ON public.master_primaries
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))));

ALTER POLICY "Primaries can read who adopted them" ON public.master_primaries
  USING (((primary_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role])))))));

ALTER POLICY "Assistants can read shares where they assist the viewing master" ON public.master_shares
  USING ((EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = master_shares.viewing_master_id) AND (master_assistants.assistant_id = (select auth.uid()))))));

ALTER POLICY "Masters and devs can read all shares" ON public.master_shares
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))));

ALTER POLICY "Masters can manage their own shares" ON public.master_shares
  USING (((sharing_master_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role))))))
  WITH CHECK (((sharing_master_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role))))));

ALTER POLICY "Viewing masters can read shares they are part of" ON public.master_shares
  USING (((viewing_master_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role])))))));

ALTER POLICY "Masters and devs can manage superintendent adoptions" ON public.master_superintendents
  USING (((master_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role))))))
  WITH CHECK (((master_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role))))));

ALTER POLICY "Masters and devs can read all superintendent adoptions" ON public.master_superintendents
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))));

ALTER POLICY "Superintendents can read who adopted them" ON public.master_superintendents
  USING (((superintendent_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role])))))));

ALTER POLICY sup_material_price_history_insert ON public.material_part_price_history
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY sup_material_price_history_select ON public.material_part_price_history
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY sup_material_part_prices_delete ON public.material_part_prices
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY sup_material_part_prices_insert ON public.material_part_prices
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY sup_material_part_prices_select ON public.material_part_prices
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY sup_material_part_prices_update ON public.material_part_prices
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY sup_material_parts_delete ON public.material_parts
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY sup_material_parts_insert ON public.material_parts
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY sup_material_parts_select ON public.material_parts
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY sup_material_parts_update ON public.material_parts
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY material_po_generator_entries_select_authenticated ON public.material_po_generator_entries
  USING (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger jl
  WHERE ((jl.id = material_po_generator_entries.job_ledger_id) AND ((jl.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM master_assistants ma
          WHERE ((ma.master_id = (select auth.uid())) AND (ma.assistant_id = jl.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants ma
          WHERE ((ma.master_id = jl.master_user_id) AND (ma.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), jl.master_user_id)))))));

ALTER POLICY sup_material_template_items_delete ON public.material_template_items
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY sup_material_template_items_insert ON public.material_template_items
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY sup_material_template_items_select ON public.material_template_items
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY sup_material_template_items_update ON public.material_template_items
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY material_template_prices_delete ON public.material_template_prices
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY material_template_prices_insert ON public.material_template_prices
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY material_template_prices_select ON public.material_template_prices
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY material_template_prices_update ON public.material_template_prices
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY sup_material_templates_delete ON public.material_templates
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY sup_material_templates_insert ON public.material_templates
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY sup_material_templates_select ON public.material_templates
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY sup_material_templates_update ON public.material_templates
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY "mercury_accounting_label_rules banking staff delete" ON public.mercury_accounting_label_rules
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_accounting_label_rules banking staff insert" ON public.mercury_accounting_label_rules
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_accounting_label_rules banking staff select" ON public.mercury_accounting_label_rules
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_accounting_label_rules banking staff update" ON public.mercury_accounting_label_rules
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_accounting_label_suggestions banking staff delete" ON public.mercury_accounting_label_suggestions
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_accounting_label_suggestions banking staff insert" ON public.mercury_accounting_label_suggestions
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_accounting_label_suggestions banking staff select" ON public.mercury_accounting_label_suggestions
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_accounting_label_suggestions banking staff update" ON public.mercury_accounting_label_suggestions
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_debit_card_user_links linked user select" ON public.mercury_debit_card_user_links
  USING ((user_id = (select auth.uid())));

ALTER POLICY "mercury_debit_card_user_links staff delete" ON public.mercury_debit_card_user_links
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_debit_card_user_links staff insert" ON public.mercury_debit_card_user_links
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_debit_card_user_links staff select" ON public.mercury_debit_card_user_links
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_debit_card_user_links staff update" ON public.mercury_debit_card_user_links
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_drag_sort_labels banking staff delete" ON public.mercury_drag_sort_labels
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_drag_sort_labels banking staff insert" ON public.mercury_drag_sort_labels
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_drag_sort_labels banking staff select" ON public.mercury_drag_sort_labels
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_drag_sort_labels banking staff update" ON public.mercury_drag_sort_labels
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_tally_transaction_notes delete own" ON public.mercury_tally_transaction_notes
  USING ((user_id = (select auth.uid())));

ALTER POLICY "mercury_tally_transaction_notes insert own visible tx" ON public.mercury_tally_transaction_notes
  WITH CHECK (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM (mercury_transactions t
     JOIN mercury_debit_card_user_links l ON (((l.user_id = (select auth.uid())) AND (l.mercury_debit_card_id = mercury_debit_card_id_from_raw(t.raw)))))
  WHERE (t.id = mercury_tally_transaction_notes.mercury_transaction_id)))));

ALTER POLICY "mercury_tally_transaction_notes select own" ON public.mercury_tally_transaction_notes
  USING ((user_id = (select auth.uid())));

ALTER POLICY "mercury_tally_transaction_notes update own visible tx" ON public.mercury_tally_transaction_notes
  USING ((user_id = (select auth.uid())))
  WITH CHECK (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM (mercury_transactions t
     JOIN mercury_debit_card_user_links l ON (((l.user_id = (select auth.uid())) AND (l.mercury_debit_card_id = mercury_debit_card_id_from_raw(t.raw)))))
  WHERE (t.id = mercury_tally_transaction_notes.mercury_transaction_id)))));

ALTER POLICY mercury_transaction_ar_returned_delete_ar_roles ON public.mercury_transaction_ar_returned
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))));

ALTER POLICY mercury_transaction_ar_returned_insert_ar_roles ON public.mercury_transaction_ar_returned
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))));

ALTER POLICY mercury_transaction_ar_returned_select_ar_roles ON public.mercury_transaction_ar_returned
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))));

ALTER POLICY mercury_transaction_ar_returned_update_ar_roles ON public.mercury_transaction_ar_returned
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'primary'::user_role]))))));

ALTER POLICY "mercury_transaction_attributions staff delete" ON public.mercury_transaction_attributions
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_transaction_attributions staff insert" ON public.mercury_transaction_attributions
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_transaction_attributions staff select" ON public.mercury_transaction_attributions
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_transaction_attributions staff update" ON public.mercury_transaction_attributions
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_transaction_drag_sort_assignments banking staff delete" ON public.mercury_transaction_drag_sort_assignments
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_transaction_drag_sort_assignments banking staff insert" ON public.mercury_transaction_drag_sort_assignments
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_transaction_drag_sort_assignments banking staff select" ON public.mercury_transaction_drag_sort_assignments
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_transaction_drag_sort_assignments banking staff update" ON public.mercury_transaction_drag_sort_assignments
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_transaction_job_allocations staff delete" ON public.mercury_transaction_job_allocations
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_transaction_job_allocations staff insert" ON public.mercury_transaction_job_allocations
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_transaction_job_allocations staff select" ON public.mercury_transaction_job_allocations
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_transaction_job_allocations staff update" ON public.mercury_transaction_job_allocations
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY mercury_transaction_org_notes_delete_banking ON public.mercury_transaction_org_notes
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY mercury_transaction_org_notes_insert_banking ON public.mercury_transaction_org_notes
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY mercury_transaction_org_notes_select_banking ON public.mercury_transaction_org_notes
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY mercury_transaction_org_notes_update_banking ON public.mercury_transaction_org_notes
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mtshil linked user select" ON public.mercury_transaction_supply_house_invoice_links
  USING ((EXISTS ( SELECT 1
   FROM (mercury_transactions t
     JOIN mercury_debit_card_user_links l ON (((l.user_id = (select auth.uid())) AND (l.mercury_debit_card_id = mercury_debit_card_id_from_raw(t.raw)))))
  WHERE (t.id = mercury_transaction_supply_house_invoice_links.mercury_transaction_id))));

ALTER POLICY "mtshil staff select" ON public.mercury_transaction_supply_house_invoice_links
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "mercury_transactions master select" ON public.mercury_transactions
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = 'master_technician'::user_role)))));

ALTER POLICY "Users can select own notification history" ON public.notification_history
  USING ((recipient_user_id = (select auth.uid())));

ALTER POLICY "Devs can insert notification templates" ON public.notification_templates
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))));

ALTER POLICY "Devs can read notification templates" ON public.notification_templates
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))));

ALTER POLICY "Devs can update notification templates" ON public.notification_templates
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))));

ALTER POLICY "Devs, masters, assistants, and estimators can delete part types" ON public.part_types
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)));

ALTER POLICY "Devs, masters, assistants, and estimators can insert part types" ON public.part_types
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)));

ALTER POLICY "Devs, masters, assistants, and estimators can read part types" ON public.part_types
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)));

ALTER POLICY "Devs, masters, assistants, and estimators can update part types" ON public.part_types
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)));

ALTER POLICY "Devs and approved masters can read pay approved masters" ON public.pay_approved_masters
  USING ((is_dev() OR (master_id = (select auth.uid()))));

ALTER POLICY "Banking staff read non-archived people for mercury attribution" ON public.people
  USING (((archived_at IS NULL) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role])))))));

ALTER POLICY "Superintendent can see people from adopted masters" ON public.people
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::user_role)))) AND (EXISTS ( SELECT 1
   FROM master_superintendents
  WHERE ((master_superintendents.master_id = people.master_user_id) AND (master_superintendents.superintendent_id = (select auth.uid())))))));

ALTER POLICY "Users can delete own people" ON public.people
  USING ((master_user_id = (select auth.uid())));

ALTER POLICY "Users can insert own people" ON public.people
  WITH CHECK (((master_user_id = (select auth.uid())) AND (is_dev() OR (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['master_technician'::user_role, 'assistant'::user_role]))))))));

ALTER POLICY "Users can see people shared with them or their master" ON public.people
  USING (((EXISTS ( SELECT 1
   FROM master_shares
  WHERE ((master_shares.sharing_master_id = people.master_user_id) AND (master_shares.viewing_master_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM (master_assistants ma
     JOIN master_shares ms ON ((ms.viewing_master_id = ma.master_id)))
  WHERE ((ma.assistant_id = (select auth.uid())) AND (ms.sharing_master_id = people.master_user_id))))));

ALTER POLICY "Users can see their own entries, owners can see all" ON public.people
  USING (((master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'owner'::user_role))))));

ALTER POLICY "Users can update own people" ON public.people
  USING ((master_user_id = (select auth.uid())))
  WITH CHECK ((master_user_id = (select auth.uid())));

ALTER POLICY "Users can view own people" ON public.people
  USING ((master_user_id = (select auth.uid())));

ALTER POLICY "Devs, masters, assistants, and estimators can delete people lab" ON public.people_labor_job_items
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND can_modify_people_labor_job(job_id)));

ALTER POLICY "Devs, masters, assistants, and estimators can insert people lab" ON public.people_labor_job_items
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND can_modify_people_labor_job(job_id)));

ALTER POLICY "Devs, masters, assistants, and estimators can read people labor" ON public.people_labor_job_items
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM people_labor_jobs j
  WHERE ((j.id = people_labor_job_items.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = j.master_user_id) AND (master_shares.viewing_master_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM (master_assistants ma
             JOIN master_shares ms ON ((ms.viewing_master_id = ma.master_id)))
          WHERE ((ma.assistant_id = (select auth.uid())) AND (ms.sharing_master_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM master_assistants ma_me
          WHERE ((ma_me.assistant_id = (select auth.uid())) AND (EXISTS ( SELECT 1
                   FROM master_assistants ma_other
                  WHERE ((ma_other.master_id = ma_me.master_id) AND (ma_other.assistant_id = j.master_user_id)))))))))))));

ALTER POLICY "Devs, masters, assistants, and estimators can update people lab" ON public.people_labor_job_items
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND can_modify_people_labor_job(job_id)))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))));

ALTER POLICY "Devs, masters, assistants, and estimators can delete people lab" ON public.people_labor_job_payments
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM people_labor_jobs j
  WHERE ((j.id = people_labor_job_payments.job_id) AND ((j.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role))))))))));

ALTER POLICY "Devs, masters, assistants, and estimators can insert people lab" ON public.people_labor_job_payments
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM people_labor_jobs j
  WHERE ((j.id = people_labor_job_payments.job_id) AND ((j.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role))))))))));

ALTER POLICY "Devs, masters, assistants, and estimators can read people labor" ON public.people_labor_job_payments
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM people_labor_jobs j
  WHERE ((j.id = people_labor_job_payments.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = j.master_user_id) AND (master_shares.viewing_master_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM (master_assistants ma
             JOIN master_shares ms ON ((ms.viewing_master_id = ma.master_id)))
          WHERE ((ma.assistant_id = (select auth.uid())) AND (ms.sharing_master_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM master_assistants ma_me
          WHERE ((ma_me.assistant_id = (select auth.uid())) AND (EXISTS ( SELECT 1
                   FROM master_assistants ma_other
                  WHERE ((ma_other.master_id = ma_me.master_id) AND (ma_other.assistant_id = j.master_user_id)))))))))))));

ALTER POLICY "Devs, masters, assistants, and estimators can update people lab" ON public.people_labor_job_payments
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM people_labor_jobs j
  WHERE ((j.id = people_labor_job_payments.job_id) AND ((j.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role))))))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))));

ALTER POLICY "Devs, masters, assistants, and estimators can delete own people" ON public.people_labor_jobs
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND ((master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))))));

ALTER POLICY "Devs, masters, assistants, and estimators can insert own people" ON public.people_labor_jobs
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (master_user_id = (select auth.uid()))));

ALTER POLICY "Devs, masters, assistants, and estimators can read people labor" ON public.people_labor_jobs
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND ((master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
   FROM master_shares
  WHERE ((master_shares.sharing_master_id = people_labor_jobs.master_user_id) AND (master_shares.viewing_master_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM (master_assistants ma
     JOIN master_shares ms ON ((ms.viewing_master_id = ma.master_id)))
  WHERE ((ma.assistant_id = (select auth.uid())) AND (ms.sharing_master_id = people_labor_jobs.master_user_id)))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = people_labor_jobs.master_user_id)))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = people_labor_jobs.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM master_assistants ma_me
  WHERE ((ma_me.assistant_id = (select auth.uid())) AND (EXISTS ( SELECT 1
           FROM master_assistants ma_other
          WHERE ((ma_other.master_id = ma_me.master_id) AND (ma_other.assistant_id = people_labor_jobs.master_user_id))))))))));

ALTER POLICY "Devs, masters, assistants, and estimators can update own people" ON public.people_labor_jobs
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND ((master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))));

ALTER POLICY "Users can read own people pay config row" ON public.people_pay_config
  USING (((EXISTS ( SELECT 1
   FROM people p
  WHERE ((p.id = people_pay_config.person_id) AND (p.account_user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (btrim(u.name) = btrim(people_pay_config.person_name)))))));

ALTER POLICY "Devs masters assistants estimators primaries can delete price b" ON public.price_book_entries
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT (select auth.uid()) AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

ALTER POLICY "Devs masters assistants estimators primaries can insert price b" ON public.price_book_entries
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT (select auth.uid()) AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

ALTER POLICY "Devs masters assistants estimators primaries can read price boo" ON public.price_book_entries
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT (select auth.uid()) AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

ALTER POLICY "Devs masters assistants estimators primaries can update price b" ON public.price_book_entries
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT (select auth.uid()) AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT (select auth.uid()) AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

ALTER POLICY "Devs masters assistants estimators primaries can delete price b" ON public.price_book_versions
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT (select auth.uid()) AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

ALTER POLICY "Devs masters assistants estimators primaries can insert price b" ON public.price_book_versions
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT (select auth.uid()) AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

ALTER POLICY "Devs masters assistants estimators primaries can read price boo" ON public.price_book_versions
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT (select auth.uid()) AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

ALTER POLICY "Devs masters assistants estimators primaries can update price b" ON public.price_book_versions
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT (select auth.uid()) AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT (select auth.uid()) AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

ALTER POLICY "Devs masters assistants can delete project superintendents" ON public.project_superintendents
  USING ((can_access_project_row(project_id) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role])))))));

ALTER POLICY "Devs masters assistants can insert project superintendents" ON public.project_superintendents
  WITH CHECK ((can_access_project_row(project_id) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role])))))));

ALTER POLICY "Devs masters assistants can read project superintendents" ON public.project_superintendents
  USING ((can_access_project_row(project_id) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role])))))));

ALTER POLICY "Superintendents can read their own project assignments" ON public.project_superintendents
  USING ((superintendent_id = (select auth.uid())));

ALTER POLICY "Authenticated users can insert actions for accessible steps" ON public.project_workflow_step_actions
  WITH CHECK ((((select auth.uid()) IS NOT NULL) AND can_access_step_for_action(step_id)));

ALTER POLICY "Only devs and masters can delete steps" ON public.project_workflow_steps
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))));

ALTER POLICY "Subcontractors can update their assigned project_workflow_steps" ON public.project_workflow_steps
  USING (((assigned_to_name IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['helpers'::user_role, 'subcontractor'::user_role])) AND (u.name IS NOT NULL) AND (lower(TRIM(BOTH FROM u.name)) = lower(TRIM(BOTH FROM project_workflow_steps.assigned_to_name))))))))
  WITH CHECK (((assigned_to_name IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['helpers'::user_role, 'subcontractor'::user_role])) AND (u.name IS NOT NULL) AND (lower(TRIM(BOTH FROM u.name)) = lower(TRIM(BOTH FROM project_workflow_steps.assigned_to_name))))))));

ALTER POLICY "Users can delete steps for workflows they have access to" ON public.project_workflow_steps
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'superintendent'::user_role]))))) AND can_access_project_via_workflow(workflow_id)));

ALTER POLICY "Users can insert steps for workflows they have access to" ON public.project_workflow_steps
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'superintendent'::user_role]))))) AND can_access_project_via_workflow(workflow_id)));

ALTER POLICY "Users can see steps for workflows they have access to" ON public.project_workflow_steps
  USING ((is_dev() OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'master_technician'::user_role)))) OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'assistant'::user_role)))) AND can_access_project_via_workflow(workflow_id)) OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::user_role)))) AND can_access_project_via_workflow(workflow_id)) OR ((assigned_to_name IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['helpers'::user_role, 'subcontractor'::user_role])) AND (users.name IS NOT NULL) AND (lower(TRIM(BOTH FROM users.name)) = lower(TRIM(BOTH FROM project_workflow_steps.assigned_to_name)))))))));

ALTER POLICY "Users can update steps for workflows they have access to" ON public.project_workflow_steps
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'superintendent'::user_role]))))) AND can_access_project_via_workflow(workflow_id)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'superintendent'::user_role]))))) AND can_access_project_via_workflow(workflow_id)));

ALTER POLICY "Only devs and masters can delete workflows" ON public.project_workflows
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))));

ALTER POLICY "Users can insert workflows for projects they have access to" ON public.project_workflows
  WITH CHECK ((((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_workflows.project_id) AND ((p.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users u
          WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants ma
          WHERE ((ma.master_id = p.master_user_id) AND (ma.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM master_shares ms
          WHERE ((ms.sharing_master_id = p.master_user_id) AND (ms.viewing_master_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM customers c
          WHERE ((c.id = p.customer_id) AND ((c.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
                   FROM users u2
                  WHERE ((u2.id = (select auth.uid())) AND (u2.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
                   FROM master_assistants ma2
                  WHERE ((ma2.master_id = c.master_user_id) AND (ma2.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
                   FROM master_shares ms2
                  WHERE ((ms2.sharing_master_id = c.master_user_id) AND (ms2.viewing_master_id = (select auth.uid())))))))))))))) OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::user_role)))) AND can_access_project_row(project_id))));

ALTER POLICY "Users can see workflows for projects they have access to" ON public.project_workflows
  USING ((EXISTS ( SELECT 1
   FROM projects
  WHERE ((projects.id = project_workflows.project_id) AND ((projects.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = projects.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM customers
          WHERE ((customers.id = projects.customer_id) AND ((customers.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
                   FROM users
                  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
                   FROM master_assistants
                  WHERE ((master_assistants.master_id = customers.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))))))))))));

ALTER POLICY "Users can see workflows they have access to" ON public.project_workflows
  USING ((can_access_project(project_id) OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::user_role)))) AND can_access_project_row(project_id)) OR (EXISTS ( SELECT 1
   FROM (project_workflow_steps s
     JOIN users u ON (((u.id = (select auth.uid())) AND (u.name IS NOT NULL) AND (lower(TRIM(BOTH FROM u.name)) = lower(TRIM(BOTH FROM s.assigned_to_name))))))
  WHERE ((s.workflow_id = project_workflows.id) AND (s.assigned_to_name IS NOT NULL))))));

ALTER POLICY "Users can update workflows for projects they have access to" ON public.project_workflows
  USING (((EXISTS ( SELECT 1
   FROM projects
  WHERE ((projects.id = project_workflows.project_id) AND ((projects.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = projects.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = projects.master_user_id) AND (master_shares.viewing_master_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM customers
          WHERE ((customers.id = projects.customer_id) AND ((customers.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
                   FROM users
                  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
                   FROM master_assistants
                  WHERE ((master_assistants.master_id = customers.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
                   FROM master_shares
                  WHERE ((master_shares.sharing_master_id = customers.master_user_id) AND (master_shares.viewing_master_id = (select auth.uid()))))))))))))) OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::user_role)))) AND can_access_project_row(project_id))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM projects
  WHERE ((projects.id = project_workflows.project_id) AND ((projects.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = projects.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = projects.master_user_id) AND (master_shares.viewing_master_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM customers
          WHERE ((customers.id = projects.customer_id) AND ((customers.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
                   FROM users
                  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
                   FROM master_assistants
                  WHERE ((master_assistants.master_id = customers.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
                   FROM master_shares
                  WHERE ((master_shares.sharing_master_id = customers.master_user_id) AND (master_shares.viewing_master_id = (select auth.uid()))))))))))))) OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::user_role)))) AND can_access_project_row(project_id))));

ALTER POLICY "Assistants and above can insert projects" ON public.projects
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))) AND ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'assistant'::user_role)))) AND (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = projects.master_user_id) AND (master_assistants.assistant_id = (select auth.uid())))))))));

ALTER POLICY "Assistants and above can update projects" ON public.projects
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))) AND ((master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = projects.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))) AND ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR ((master_user_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = projects.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))))) AND (EXISTS ( SELECT 1
   FROM customers
  WHERE ((customers.id = projects.customer_id) AND ((customers.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = customers.master_user_id) AND (master_assistants.assistant_id = (select auth.uid())))))))))));

ALTER POLICY "Only devs and masters can delete projects" ON public.projects
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))));

ALTER POLICY "Devs, masters, and assistants can insert prospect callbacks" ON public.prospect_callbacks
  WITH CHECK ((user_has_prospects_staff_access() AND (user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM prospects p
  WHERE (p.id = prospect_callbacks.prospect_id)))));

ALTER POLICY "Users can delete their own prospect callbacks" ON public.prospect_callbacks
  USING ((user_id = (select auth.uid())));

ALTER POLICY "Users can see their own prospect callbacks" ON public.prospect_callbacks
  USING ((user_id = (select auth.uid())));

ALTER POLICY "Users can delete their own prospect calling lock" ON public.prospect_calling_locks
  USING ((user_id = (select auth.uid())));

ALTER POLICY "Users can insert their own prospect calling lock" ON public.prospect_calling_locks
  WITH CHECK ((user_id = (select auth.uid())));

ALTER POLICY "Users can update their own prospect calling lock" ON public.prospect_calling_locks
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

ALTER POLICY "Devs, masters, and assistants can insert prospect comments" ON public.prospect_comments
  WITH CHECK ((user_has_prospects_staff_access() AND (created_by = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM prospects p
  WHERE (p.id = prospect_comments.prospect_id)))));

ALTER POLICY "Users can insert own prospect_email_sent" ON public.prospect_email_sent
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can insert their own prospect timer events" ON public.prospect_timer_events
  WITH CHECK (((user_id = (select auth.uid())) AND user_has_prospects_staff_access()));

ALTER POLICY "Users can see their own prospect timer events" ON public.prospect_timer_events
  USING ((user_id = (select auth.uid())));

ALTER POLICY "Devs, masters, and assistants can insert prospects" ON public.prospects
  WITH CHECK ((user_has_prospects_staff_access() AND (created_by = (select auth.uid())) AND ((master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = prospects.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR ((EXISTS ( SELECT 1
   FROM users eu
  WHERE ((eu.id = (select auth.uid())) AND (eu.role = 'estimator'::user_role) AND COALESCE(eu.estimator_prospects_access, false)))) AND (EXISTS ( SELECT 1
   FROM users m
  WHERE ((m.id = prospects.master_user_id) AND (m.role = 'master_technician'::user_role))))))));

ALTER POLICY "Assistants can update price confirmation" ON public.purchase_order_items
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'assistant'::user_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'assistant'::user_role)))));

ALTER POLICY sup_purchase_order_items_delete ON public.purchase_order_items
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM purchase_orders po
  WHERE ((po.id = purchase_order_items.purchase_order_id) AND ((po.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role])))))))))));

ALTER POLICY sup_purchase_order_items_insert ON public.purchase_order_items
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM purchase_orders po
  WHERE ((po.id = purchase_order_items.purchase_order_id) AND ((po.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role])))))) AND (po.status = 'draft'::text))))));

ALTER POLICY sup_purchase_order_items_select ON public.purchase_order_items
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM purchase_orders po
  WHERE ((po.id = purchase_order_items.purchase_order_id) AND ((po.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role])))))))))));

ALTER POLICY sup_purchase_order_items_update ON public.purchase_order_items
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM purchase_orders po
  WHERE ((po.id = purchase_order_items.purchase_order_id) AND ((po.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role])))))) AND (po.status = 'draft'::text))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM purchase_orders po
  WHERE ((po.id = purchase_order_items.purchase_order_id) AND ((po.created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role])))))) AND (po.status = 'draft'::text))))));

ALTER POLICY "Devs and masters can add notes to finalized purchase orders" ON public.purchase_orders
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) AND ((created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role))))) AND (status = 'finalized'::text) AND (notes IS NULL)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) AND ((created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role))))) AND (status = 'finalized'::text) AND (notes IS NOT NULL) AND (notes_added_by = (select auth.uid())) AND (notes_added_at IS NOT NULL)));

ALTER POLICY sup_purchase_orders_delete ON public.purchase_orders
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND ((created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))))));

ALTER POLICY sup_purchase_orders_insert ON public.purchase_orders
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (created_by = (select auth.uid()))));

ALTER POLICY sup_purchase_orders_select ON public.purchase_orders
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND ((created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))))));

ALTER POLICY sup_purchase_orders_update ON public.purchase_orders
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND ((created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role])))))) AND (status = 'draft'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND ((created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))))));

ALTER POLICY "Devs can select push subscriptions" ON public.push_subscriptions
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))));

ALTER POLICY "Masters and assistants can select push subscriptions" ON public.push_subscriptions
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Users manage own subscriptions" ON public.push_subscriptions
  USING (((select auth.uid()) = user_id));

ALTER POLICY quickfill_difficult_people_daily_checks_insert_staff ON public.quickfill_difficult_people_daily_checks
  WITH CHECK ((is_dev_or_master_or_assistant() AND (checked_by = (select auth.uid()))));

ALTER POLICY quickfill_office_arriving_daily_checks_insert_staff ON public.quickfill_office_arriving_daily_checks
  WITH CHECK ((is_dev_or_master_or_assistant() AND (checked_by = (select auth.uid()))));

ALTER POLICY recurring_job_report_dispatch_log_select ON public.recurring_job_report_dispatch_log
  USING ((EXISTS ( SELECT 1
   FROM recurring_job_report_schedules s
  WHERE ((s.id = recurring_job_report_dispatch_log.schedule_id) AND (is_dev() OR (is_dev_or_master_or_assistant() AND ((s.scope_master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM master_assistants ma
          WHERE ((ma.master_id = s.scope_master_user_id) AND (ma.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), s.scope_master_user_id))))))));

ALTER POLICY recurring_job_report_recipients_delete ON public.recurring_job_report_schedule_recipients
  USING ((EXISTS ( SELECT 1
   FROM recurring_job_report_schedules s
  WHERE ((s.id = recurring_job_report_schedule_recipients.schedule_id) AND (is_dev() OR (is_dev_or_master_or_assistant() AND ((s.scope_master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM master_assistants ma
          WHERE ((ma.master_id = s.scope_master_user_id) AND (ma.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), s.scope_master_user_id))))))));

ALTER POLICY recurring_job_report_recipients_insert ON public.recurring_job_report_schedule_recipients
  WITH CHECK ((EXISTS ( SELECT 1
   FROM recurring_job_report_schedules s
  WHERE ((s.id = recurring_job_report_schedule_recipients.schedule_id) AND (is_dev() OR (is_dev_or_master_or_assistant() AND ((s.scope_master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM master_assistants ma
          WHERE ((ma.master_id = s.scope_master_user_id) AND (ma.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), s.scope_master_user_id))))))));

ALTER POLICY recurring_job_report_recipients_select ON public.recurring_job_report_schedule_recipients
  USING ((EXISTS ( SELECT 1
   FROM recurring_job_report_schedules s
  WHERE ((s.id = recurring_job_report_schedule_recipients.schedule_id) AND (is_dev() OR (is_dev_or_master_or_assistant() AND ((s.scope_master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM master_assistants ma
          WHERE ((ma.master_id = s.scope_master_user_id) AND (ma.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), s.scope_master_user_id))))))));

ALTER POLICY recurring_job_report_recipients_update ON public.recurring_job_report_schedule_recipients
  USING ((EXISTS ( SELECT 1
   FROM recurring_job_report_schedules s
  WHERE ((s.id = recurring_job_report_schedule_recipients.schedule_id) AND (is_dev() OR (is_dev_or_master_or_assistant() AND ((s.scope_master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM master_assistants ma
          WHERE ((ma.master_id = s.scope_master_user_id) AND (ma.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), s.scope_master_user_id))))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM recurring_job_report_schedules s
  WHERE ((s.id = recurring_job_report_schedule_recipients.schedule_id) AND (is_dev() OR (is_dev_or_master_or_assistant() AND ((s.scope_master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM master_assistants ma
          WHERE ((ma.master_id = s.scope_master_user_id) AND (ma.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), s.scope_master_user_id))))))));

ALTER POLICY recurring_job_report_schedules_delete_dma ON public.recurring_job_report_schedules
  USING ((is_dev() OR (is_dev_or_master_or_assistant() AND ((scope_master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM master_assistants ma
  WHERE ((ma.master_id = recurring_job_report_schedules.scope_master_user_id) AND (ma.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), scope_master_user_id)))));

ALTER POLICY recurring_job_report_schedules_insert_dma ON public.recurring_job_report_schedules
  WITH CHECK ((is_dev() OR (is_dev_or_master_or_assistant() AND ((scope_master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM master_assistants ma
  WHERE ((ma.master_id = recurring_job_report_schedules.scope_master_user_id) AND (ma.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), scope_master_user_id)))));

ALTER POLICY recurring_job_report_schedules_select_dma ON public.recurring_job_report_schedules
  USING ((is_dev() OR (is_dev_or_master_or_assistant() AND ((scope_master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM master_assistants ma
  WHERE ((ma.master_id = recurring_job_report_schedules.scope_master_user_id) AND (ma.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), scope_master_user_id)))));

ALTER POLICY recurring_job_report_schedules_update_dma ON public.recurring_job_report_schedules
  USING ((is_dev() OR (is_dev_or_master_or_assistant() AND ((scope_master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM master_assistants ma
  WHERE ((ma.master_id = recurring_job_report_schedules.scope_master_user_id) AND (ma.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), scope_master_user_id)))))
  WITH CHECK ((is_dev() OR (is_dev_or_master_or_assistant() AND ((scope_master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM master_assistants ma
  WHERE ((ma.master_id = recurring_job_report_schedules.scope_master_user_id) AND (ma.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), scope_master_user_id)))));

ALTER POLICY "Users can read own report enabled status" ON public.report_enabled_users
  USING ((user_id = (select auth.uid())));

ALTER POLICY "Users delete own report reads" ON public.report_reads
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users insert own report reads" ON public.report_reads
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users select own report reads" ON public.report_reads
  USING (((select auth.uid()) = user_id));

ALTER POLICY "All authenticated can read report template fields" ON public.report_template_fields
  USING (((select auth.role()) = 'authenticated'::text));

ALTER POLICY "All authenticated can read report templates" ON public.report_templates
  USING (((select auth.role()) = 'authenticated'::text));

ALTER POLICY "Devs masters assistants can insert reports" ON public.reports
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Devs masters assistants can select insert update reports" ON public.reports
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Devs masters assistants can update reports" ON public.reports
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Estimators can insert reports" ON public.reports
  WITH CHECK ((is_estimator() AND (created_by_user_id = (select auth.uid()))));

ALTER POLICY "Primary can insert reports" ON public.reports
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))));

ALTER POLICY "Primary can select reports" ON public.reports
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))));

ALTER POLICY "Primary can update reports" ON public.reports
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))));

ALTER POLICY "Subcontractors can insert reports" ON public.reports
  WITH CHECK ((auth_uid_is_helpers_or_subcontractor() AND (created_by_user_id = (select auth.uid()))));

ALTER POLICY "Subcontractors can select own reports within visibility" ON public.reports
  USING ((auth_uid_is_helpers_or_subcontractor() AND (created_by_user_id = (select auth.uid())) AND (created_at >= (now() - ((report_sub_visibility_months() || ' months'::text))::interval))));

ALTER POLICY "Subcontractors can update own reports within edit window" ON public.reports
  USING ((auth_uid_is_helpers_or_subcontractor() AND (created_by_user_id = (select auth.uid())) AND (created_at >= (now() - ((report_edit_window_days() || ' days'::text))::interval))))
  WITH CHECK ((created_by_user_id = (select auth.uid())));

ALTER POLICY "Superintendent can do all on reports (assigned projects)" ON public.reports
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::user_role)))) AND (((project_id IS NOT NULL) AND can_access_project_row(project_id)) OR ((job_ledger_id IS NOT NULL) AND superintendent_report_job_anchor_allowed(job_ledger_id)) OR ((bid_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = reports.bid_id) AND superintendent_can_access_bid(b.*))))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::user_role)))) AND (((project_id IS NOT NULL) AND can_access_project_row(project_id)) OR ((job_ledger_id IS NOT NULL) AND superintendent_report_job_anchor_allowed(job_ledger_id)) OR ((bid_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = reports.bid_id) AND superintendent_can_access_bid(b.*))))))));

ALTER POLICY salary_override_delete ON public.salary_work_schedule_day_overrides
  USING ((((user_id = (select auth.uid())) AND (work_date = (timezone('America/Chicago'::text, now()))::date)) OR salary_schedule_staff_or_self_target(user_id)));

ALTER POLICY salary_override_insert ON public.salary_work_schedule_day_overrides
  WITH CHECK ((((user_id = (select auth.uid())) AND (work_date = (timezone('America/Chicago'::text, now()))::date)) OR salary_schedule_staff_or_self_target(user_id)));

ALTER POLICY salary_override_select ON public.salary_work_schedule_day_overrides
  USING (((user_id = (select auth.uid())) OR salary_schedule_staff_or_self_target(user_id) OR is_team_lead_for_member((select auth.uid()), user_id)));

ALTER POLICY salary_override_update ON public.salary_work_schedule_day_overrides
  USING ((((user_id = (select auth.uid())) AND (work_date = (timezone('America/Chicago'::text, now()))::date)) OR salary_schedule_staff_or_self_target(user_id)))
  WITH CHECK ((((user_id = (select auth.uid())) AND (work_date = (timezone('America/Chicago'::text, now()))::date)) OR salary_schedule_staff_or_self_target(user_id)));

ALTER POLICY salary_template_delete ON public.salary_work_schedule_templates
  USING (((user_id = (select auth.uid())) OR salary_schedule_staff_or_self_target(user_id)));

ALTER POLICY salary_template_insert ON public.salary_work_schedule_templates
  WITH CHECK (((user_id = (select auth.uid())) OR salary_schedule_staff_or_self_target(user_id)));

ALTER POLICY salary_template_select ON public.salary_work_schedule_templates
  USING (((user_id = (select auth.uid())) OR salary_schedule_staff_or_self_target(user_id) OR is_team_lead_for_member((select auth.uid()), user_id)));

ALTER POLICY salary_template_update ON public.salary_work_schedule_templates
  USING (((user_id = (select auth.uid())) OR salary_schedule_staff_or_self_target(user_id)))
  WITH CHECK (((user_id = (select auth.uid())) OR salary_schedule_staff_or_self_target(user_id)));

ALTER POLICY schedule_day_email_requests_insert_dev_master_assistant_self ON public.schedule_day_email_requests
  WITH CHECK (((recipient_user_id = ( SELECT (select auth.uid()) AS uid)) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT (select auth.uid()) AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role])))))));

ALTER POLICY schedule_day_email_requests_select_own ON public.schedule_day_email_requests
  USING ((recipient_user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY schedule_day_email_requests_update_own ON public.schedule_day_email_requests
  USING ((recipient_user_id = ( SELECT (select auth.uid()) AS uid)))
  WITH CHECK ((recipient_user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY "All authenticated users can read service types" ON public.service_types
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "Only devs can delete service types" ON public.service_types
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))));

ALTER POLICY "Only devs can insert service types" ON public.service_types
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))));

ALTER POLICY "Only devs can update service types" ON public.service_types
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))));

ALTER POLICY service_types_delete_dev ON public.service_types
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))));

ALTER POLICY service_types_insert_dev ON public.service_types
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))));

ALTER POLICY service_types_update_dev ON public.service_types
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'dev'::user_role)))));

ALTER POLICY "Users can delete own subscriptions" ON public.step_subscriptions
  USING ((user_id = (select auth.uid())));

ALTER POLICY "Users can insert own subscriptions" ON public.step_subscriptions
  WITH CHECK ((user_id = (select auth.uid())));

ALTER POLICY "Users can update own subscriptions" ON public.step_subscriptions
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

ALTER POLICY "Users can view own subscriptions" ON public.step_subscriptions
  USING ((user_id = (select auth.uid())));

ALTER POLICY stripe_oob_payment_reverts_select ON public.stripe_oob_payment_reverts
  USING ((EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = stripe_oob_payment_reverts.job_id) AND ((j.master_user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = (select auth.uid())) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = (select auth.uid()))))) OR assistants_share_master((select auth.uid()), j.master_user_id) OR (EXISTS ( SELECT 1
           FROM jobs_ledger_team_members
          WHERE ((jobs_ledger_team_members.job_id = j.id) AND (jobs_ledger_team_members.user_id = (select auth.uid()))))))))));

ALTER POLICY "Devs, masters, assistants can delete supply house invoice job a" ON public.supply_house_invoice_job_allocations
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Devs, masters, assistants can insert supply house invoice job a" ON public.supply_house_invoice_job_allocations
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Devs, masters, assistants can read supply house invoice job all" ON public.supply_house_invoice_job_allocations
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Devs, masters, assistants can update supply house invoice job a" ON public.supply_house_invoice_job_allocations
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Devs, masters, assistants can delete supply house invoices" ON public.supply_house_invoices
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Devs, masters, assistants can insert supply house invoices" ON public.supply_house_invoices
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Devs, masters, assistants can read supply house invoices" ON public.supply_house_invoices
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Devs, masters, assistants can update supply house invoices" ON public.supply_house_invoices
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY sup_supply_houses_delete ON public.supply_houses
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY sup_supply_houses_insert ON public.supply_houses
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY sup_supply_houses_select ON public.supply_houses
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY sup_supply_houses_update ON public.supply_houses
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

ALTER POLICY "Devs, masters, assistants, and estimators can delete takeoff bo" ON public.takeoff_book_entries
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM takeoff_book_versions tbv
  WHERE ((tbv.id = takeoff_book_entries.version_id) AND estimator_can_access_service_type(tbv.service_type_id))))));

ALTER POLICY "Devs, masters, assistants, and estimators can insert takeoff bo" ON public.takeoff_book_entries
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM takeoff_book_versions tbv
  WHERE ((tbv.id = takeoff_book_entries.version_id) AND estimator_can_access_service_type(tbv.service_type_id))))));

ALTER POLICY "Devs, masters, assistants, and estimators can read takeoff book" ON public.takeoff_book_entries
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM takeoff_book_versions tbv
  WHERE ((tbv.id = takeoff_book_entries.version_id) AND estimator_can_access_service_type(tbv.service_type_id))))));

ALTER POLICY "Devs, masters, assistants, and estimators can update takeoff bo" ON public.takeoff_book_entries
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM takeoff_book_versions tbv
  WHERE ((tbv.id = takeoff_book_entries.version_id) AND estimator_can_access_service_type(tbv.service_type_id))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))));

ALTER POLICY "Devs, masters, assistants, and estimators can delete takeoff bo" ON public.takeoff_book_entry_items
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM (takeoff_book_entries tbe
     JOIN takeoff_book_versions tbv ON ((tbv.id = tbe.version_id)))
  WHERE ((tbe.id = takeoff_book_entry_items.entry_id) AND estimator_can_access_service_type(tbv.service_type_id))))));

ALTER POLICY "Devs, masters, assistants, and estimators can insert takeoff bo" ON public.takeoff_book_entry_items
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM (takeoff_book_entries tbe
     JOIN takeoff_book_versions tbv ON ((tbv.id = tbe.version_id)))
  WHERE ((tbe.id = takeoff_book_entry_items.entry_id) AND estimator_can_access_service_type(tbv.service_type_id))))));

ALTER POLICY "Devs, masters, assistants, and estimators can read takeoff book" ON public.takeoff_book_entry_items
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM (takeoff_book_entries tbe
     JOIN takeoff_book_versions tbv ON ((tbv.id = tbe.version_id)))
  WHERE ((tbe.id = takeoff_book_entry_items.entry_id) AND estimator_can_access_service_type(tbv.service_type_id))))));

ALTER POLICY "Devs, masters, assistants, and estimators can update takeoff bo" ON public.takeoff_book_entry_items
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM (takeoff_book_entries tbe
     JOIN takeoff_book_versions tbv ON ((tbv.id = tbe.version_id)))
  WHERE ((tbe.id = takeoff_book_entry_items.entry_id) AND estimator_can_access_service_type(tbv.service_type_id))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))));

ALTER POLICY "Devs, masters, assistants, and estimators can delete takeoff bo" ON public.takeoff_book_versions
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)));

ALTER POLICY "Devs, masters, assistants, and estimators can insert takeoff bo" ON public.takeoff_book_versions
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)));

ALTER POLICY "Devs, masters, assistants, and estimators can read takeoff book" ON public.takeoff_book_versions
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)));

ALTER POLICY "Devs, masters, assistants, and estimators can update takeoff bo" ON public.takeoff_book_versions
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'estimator'::user_role]))))));

ALTER POLICY team_feedback_peer_ratings_insert_own_submission ON public.team_feedback_peer_ratings
  WITH CHECK ((EXISTS ( SELECT 1
   FROM team_feedback_submissions s
  WHERE ((s.id = team_feedback_peer_ratings.submission_id) AND (s.reviewer_user_id = (select auth.uid()))))));

ALTER POLICY team_feedback_submissions_insert_own ON public.team_feedback_submissions
  WITH CHECK ((reviewer_user_id = (select auth.uid())));

ALTER POLICY team_feedback_submissions_select_own ON public.team_feedback_submissions
  USING ((reviewer_user_id = (select auth.uid())));

ALTER POLICY team_feedback_user_state_insert_own ON public.team_feedback_user_state
  WITH CHECK ((user_id = (select auth.uid())));

ALTER POLICY team_feedback_user_state_select_own_or_dev ON public.team_feedback_user_state
  USING (((user_id = (select auth.uid())) OR is_dev()));

ALTER POLICY team_feedback_user_state_update_own_or_dev ON public.team_feedback_user_state
  USING (((user_id = (select auth.uid())) OR is_dev()))
  WITH CHECK (((user_id = (select auth.uid())) OR is_dev()));

ALTER POLICY "Team assignment read scope" ON public.team_leader_assignments
  USING (((leader_user_id = (select auth.uid())) OR (member_user_id = (select auth.uid())) OR can_manage_team_leader_assignments()));

ALTER POLICY team_leader_clock_notify_prefs_delete ON public.team_leader_clock_notify_prefs
  USING ((EXISTS ( SELECT 1
   FROM team_leader_assignments t
  WHERE ((t.id = team_leader_clock_notify_prefs.team_leader_assignment_id) AND ((t.leader_user_id = (select auth.uid())) OR can_manage_team_leader_assignments())))));

ALTER POLICY team_leader_clock_notify_prefs_insert ON public.team_leader_clock_notify_prefs
  WITH CHECK ((EXISTS ( SELECT 1
   FROM team_leader_assignments t
  WHERE ((t.id = team_leader_clock_notify_prefs.team_leader_assignment_id) AND ((t.leader_user_id = (select auth.uid())) OR can_manage_team_leader_assignments())))));

ALTER POLICY team_leader_clock_notify_prefs_select ON public.team_leader_clock_notify_prefs
  USING ((EXISTS ( SELECT 1
   FROM team_leader_assignments t
  WHERE ((t.id = team_leader_clock_notify_prefs.team_leader_assignment_id) AND ((t.leader_user_id = (select auth.uid())) OR can_manage_team_leader_assignments())))));

ALTER POLICY team_leader_clock_notify_prefs_update ON public.team_leader_clock_notify_prefs
  USING ((EXISTS ( SELECT 1
   FROM team_leader_assignments t
  WHERE ((t.id = team_leader_clock_notify_prefs.team_leader_assignment_id) AND ((t.leader_user_id = (select auth.uid())) OR can_manage_team_leader_assignments())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM team_leader_assignments t
  WHERE ((t.id = team_leader_clock_notify_prefs.team_leader_assignment_id) AND ((t.leader_user_id = (select auth.uid())) OR can_manage_team_leader_assignments())))));

ALTER POLICY user_app_activity_daily_select_own_dev_or_viewer ON public.user_app_activity_daily
  USING (((user_id = (select auth.uid())) OR is_dev() OR (EXISTS ( SELECT 1
   FROM user_app_activity_viewers v
  WHERE (v.viewer_user_id = (select auth.uid()))))));

ALTER POLICY user_app_activity_viewers_select_dev_or_self ON public.user_app_activity_viewers
  USING ((is_dev() OR (viewer_user_id = (select auth.uid()))));

ALTER POLICY "Users delete own bid notes read state" ON public.user_bid_notes_read_state
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users insert own bid notes read state" ON public.user_bid_notes_read_state
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users select own bid notes read state" ON public.user_bid_notes_read_state
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users update own bid notes read state" ON public.user_bid_notes_read_state
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users delete own checklist item mute" ON public.user_checklist_item_mute_preferences
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users insert own checklist item mute" ON public.user_checklist_item_mute_preferences
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users select own checklist item mute" ON public.user_checklist_item_mute_preferences
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users update own checklist item mute" ON public.user_checklist_item_mute_preferences
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users manage own daily goals ack" ON public.user_daily_goals_ack
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users manage own dashboard buttons" ON public.user_dashboard_buttons
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Dev master assistant manage dashboard goals" ON public.user_dashboard_goals
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Users select own dashboard goals" ON public.user_dashboard_goals
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users manage own dashboard preferences" ON public.user_dashboard_preferences
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Devs can delete any pinned tab" ON public.user_pinned_tabs
  USING ((( SELECT users.role
   FROM users
  WHERE (users.id = (select auth.uid()))) = 'dev'::user_role));

ALTER POLICY "Users delete own pinned tabs" ON public.user_pinned_tabs
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users insert own or dev inserts any" ON public.user_pinned_tabs
  WITH CHECK ((((select auth.uid()) = user_id) OR (( SELECT users.role
   FROM users
  WHERE (users.id = (select auth.uid()))) = 'dev'::user_role)));

ALTER POLICY "Users select own pinned tabs" ON public.user_pinned_tabs
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users manage own prospect copy templates" ON public.user_prospect_copy_templates
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users manage own prospect quick notes" ON public.user_prospect_quick_notes
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Masters assistants devs can manage own report notification pref" ON public.user_report_notification_preferences
  USING ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role])))))))
  WITH CHECK ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role])))))));

ALTER POLICY user_tag_org_select_dev_or_self ON public.user_tag_org
  USING ((is_dev() OR (user_id = (select auth.uid()))));

ALTER POLICY user_time_off_delete ON public.user_time_off
  USING ((user_id = (select auth.uid())));

ALTER POLICY user_time_off_insert ON public.user_time_off
  WITH CHECK ((user_id = (select auth.uid())));

ALTER POLICY user_time_off_select ON public.user_time_off
  USING (((user_id = (select auth.uid())) OR salary_schedule_staff_or_self_target(user_id) OR is_team_lead_for_member((select auth.uid()), user_id)));

ALTER POLICY user_time_off_update ON public.user_time_off
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

ALTER POLICY "Masters assistants devs can update user notes" ON public.users
  USING ((EXISTS ( SELECT 1
   FROM users users_1
  WHERE ((users_1.id = (select auth.uid())) AND (users_1.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users users_1
  WHERE ((users_1.id = (select auth.uid())) AND (users_1.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));

ALTER POLICY "Users can select users" ON public.users
  USING ((((archived_at IS NULL) OR is_dev()) AND ((id = (select auth.uid())) OR is_dev() OR ((role = 'master_technician'::user_role) AND is_master_or_dev()) OR (role = 'assistant'::user_role) OR ((role = ANY (ARRAY['master_technician'::user_role, 'dev'::user_role])) AND is_estimator()) OR (role = 'estimator'::user_role) OR (role = 'primary'::user_role) OR (role = ANY (ARRAY['helpers'::user_role, 'subcontractor'::user_role])) OR (role = 'superintendent'::user_role) OR master_adopted_current_user(id) OR can_see_sharing_master(id))));

ALTER POLICY "Users can update own profile" ON public.users
  USING (((select auth.uid()) = id))
  WITH CHECK (((select auth.uid()) = id));

ALTER POLICY "Devs and masters can delete projections" ON public.workflow_projections
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))));

ALTER POLICY "Devs and masters can insert projections" ON public.workflow_projections
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM (project_workflows pw
     JOIN projects p ON ((p.id = pw.project_id)))
  WHERE ((pw.id = workflow_projections.workflow_id) AND ((p.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users u
          WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants ma
          WHERE ((ma.master_id = p.master_user_id) AND (ma.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM master_shares ms
          WHERE ((ms.sharing_master_id = p.master_user_id) AND (ms.viewing_master_id = (select auth.uid())))))))))));

ALTER POLICY "Devs and masters can update projections" ON public.workflow_projections
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM (project_workflows pw
     JOIN projects p ON ((p.id = pw.project_id)))
  WHERE ((pw.id = workflow_projections.workflow_id) AND ((p.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users u
          WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants ma
          WHERE ((ma.master_id = p.master_user_id) AND (ma.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM master_shares ms
          WHERE ((ms.sharing_master_id = p.master_user_id) AND (ms.viewing_master_id = (select auth.uid())))))))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM (project_workflows pw
     JOIN projects p ON ((p.id = pw.project_id)))
  WHERE ((pw.id = workflow_projections.workflow_id) AND ((p.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users u
          WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants ma
          WHERE ((ma.master_id = p.master_user_id) AND (ma.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM master_shares ms
          WHERE ((ms.sharing_master_id = p.master_user_id) AND (ms.viewing_master_id = (select auth.uid())))))))))));

ALTER POLICY "Users can see projections for workflows they have access to" ON public.workflow_projections
  USING ((EXISTS ( SELECT 1
   FROM (project_workflows pw
     JOIN projects p ON ((p.id = pw.project_id)))
  WHERE ((pw.id = workflow_projections.workflow_id) AND ((p.master_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM users u
          WHERE ((u.id = (select auth.uid())) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants ma
          WHERE ((ma.master_id = p.master_user_id) AND (ma.assistant_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM master_shares ms
          WHERE ((ms.sharing_master_id = p.master_user_id) AND (ms.viewing_master_id = (select auth.uid()))))))))));

ALTER POLICY "Users can delete workflow dependencies for steps they can acces" ON public.workflow_step_dependencies
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))) AND (can_access_project_via_step(step_id) OR can_access_project_via_step(depends_on_step_id))));

ALTER POLICY "Users can insert workflow dependencies for steps they can acces" ON public.workflow_step_dependencies
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))) AND can_access_project_via_step(step_id) AND can_access_project_via_step(depends_on_step_id)));

ALTER POLICY "Users can update workflow dependencies for steps they can acces" ON public.workflow_step_dependencies
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))) AND can_access_project_via_step(step_id) AND can_access_project_via_step(depends_on_step_id)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))) AND can_access_project_via_step(step_id) AND can_access_project_via_step(depends_on_step_id)));

ALTER POLICY "Owners and masters can delete line items with adoption and shar" ON public.workflow_step_line_items
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) AND can_access_project_via_step(step_id)));

ALTER POLICY "Owners, masters, assistants, superintendents can delete line it" ON public.workflow_step_line_items
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'superintendent'::user_role]))))) AND can_access_project_via_step(step_id)));

ALTER POLICY "Owners, masters, assistants, superintendents can insert line it" ON public.workflow_step_line_items
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'superintendent'::user_role]))))) AND can_access_project_via_step(step_id)));

ALTER POLICY "Owners, masters, assistants, superintendents can read line item" ON public.workflow_step_line_items
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'superintendent'::user_role]))))) AND can_access_project_via_step(step_id)));

ALTER POLICY "Owners, masters, assistants, superintendents can update line it" ON public.workflow_step_line_items
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'superintendent'::user_role]))))) AND can_access_project_via_step(step_id)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'superintendent'::user_role]))))) AND can_access_project_via_step(step_id)));

ALTER POLICY "Masters and owners can manage template steps" ON public.workflow_template_steps
  USING ((EXISTS ( SELECT 1
   FROM workflow_templates wt
  WHERE ((wt.id = workflow_template_steps.template_id) AND ((wt.master_user_id = (select auth.uid())) OR is_dev())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM workflow_templates wt
  WHERE ((wt.id = workflow_template_steps.template_id) AND ((wt.master_user_id = (select auth.uid())) OR is_dev())))));

ALTER POLICY "Users can view accessible template steps" ON public.workflow_template_steps
  USING ((EXISTS ( SELECT 1
   FROM workflow_templates wt
  WHERE ((wt.id = workflow_template_steps.template_id) AND ((wt.master_user_id = (select auth.uid())) OR (wt.master_user_id IS NULL) OR is_dev())))));

ALTER POLICY "Masters can create templates" ON public.workflow_templates
  WITH CHECK (((master_user_id = ( SELECT (select auth.uid()) AS uid)) OR is_dev()));

ALTER POLICY "Users can view accessible templates" ON public.workflow_templates
  USING (((master_user_id = ( SELECT (select auth.uid()) AS uid)) OR (master_user_id IS NULL) OR is_dev()));

ALTER POLICY "Writeups staff insert" ON public.writeups
  WITH CHECK (((filled_by_user_id = (select auth.uid())) AND (is_dev() OR is_pay_approved_master() OR is_master_or_dev() OR is_assistant_of_pay_approved_master() OR is_assistant())));

COMMIT;
