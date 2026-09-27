SET lock_timeout = '3s';

-- Controller access, batch 2 of the audit (to-dos/controller-access.md): bids, the books and estimates.
--
-- Names 'controller' beside 'assistant' in every policy on these tables that lists its roles by
-- hand. Same name, same command, the same expression read back from pg_policies with one more
-- role in its list. ALTER POLICY is idempotent in effect.
SET search_path = public;

-- bid_count_row_custom_prices · DELETE
ALTER POLICY "Bid pricing users can delete custom prices" ON public."bid_count_row_custom_prices"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)));

-- bid_count_row_custom_prices · INSERT
ALTER POLICY "Bid pricing users can insert custom prices" ON public."bid_count_row_custom_prices"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)));

-- bid_count_row_custom_prices · SELECT
ALTER POLICY "Bid pricing users can read custom prices" ON public."bid_count_row_custom_prices"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)));

-- bid_count_row_custom_prices · UPDATE
ALTER POLICY "Bid pricing users can update custom prices" ON public."bid_count_row_custom_prices"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)));

-- bid_count_row_submission_hides · DELETE
ALTER POLICY "Bid pricing users can delete submission hides" ON public."bid_count_row_submission_hides"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)));

-- bid_count_row_submission_hides · INSERT
ALTER POLICY "Bid pricing users can insert submission hides" ON public."bid_count_row_submission_hides"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)));

-- bid_count_row_submission_hides · SELECT
ALTER POLICY "Bid pricing users can read submission hides" ON public."bid_count_row_submission_hides"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)));

-- bid_count_row_submission_hides · UPDATE
ALTER POLICY "Bid pricing users can update submission hides" ON public."bid_count_row_submission_hides"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- bid_estimators_extra_users · DELETE
ALTER POLICY "Staff can delete bid estimators extra users" ON public."bid_estimators_extra_users"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- bid_estimators_extra_users · INSERT
ALTER POLICY "Staff can insert bid estimators extra users" ON public."bid_estimators_extra_users"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- bid_payment_schedule_rows · DELETE
ALTER POLICY "Bid pricing users can delete payment schedule rows" ON public."bid_payment_schedule_rows"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)));

-- bid_payment_schedule_rows · INSERT
ALTER POLICY "Bid pricing users can insert payment schedule rows" ON public."bid_payment_schedule_rows"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)));

-- bid_payment_schedule_rows · SELECT
ALTER POLICY "Bid pricing users can read payment schedule rows" ON public."bid_payment_schedule_rows"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)));

-- bid_payment_schedule_rows · UPDATE
ALTER POLICY "Bid pricing users can update payment schedule rows" ON public."bid_payment_schedule_rows"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- bid_pricing_package_sends · INSERT
ALTER POLICY "bpps_insert" ON public."bid_pricing_package_sends"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND can_access_bid_for_pricing(bid_id) AND (sent_by_user_id = ( SELECT auth.uid() AS uid))));

-- bid_pricing_package_sends · SELECT
ALTER POLICY "bpps_select" ON public."bid_pricing_package_sends"
  USING (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND can_access_bid_for_pricing(bid_id)));

-- bids · DELETE
ALTER POLICY "Devs masters assistants estimators primaries can delete bids" ON public."bids"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND ((created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))))));

-- bids · INSERT
ALTER POLICY "Devs masters assistants estimators primaries can insert bids" ON public."bids"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND (created_by = ( SELECT auth.uid() AS uid))));

-- bids · SELECT
ALTER POLICY "Devs masters assistants estimators primaries can read bids" ON public."bids"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND ((created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))))));

-- bids · UPDATE
ALTER POLICY "Devs masters assistants estimators primaries can update bids" ON public."bids"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND ((created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

-- bids_count_rows · DELETE
ALTER POLICY "Devs masters assistants estimators primaries can delete bids co" ON public."bids_count_rows"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_count_rows.bid_id) AND ((b.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role])))))))))));

-- bids_count_rows · INSERT
ALTER POLICY "Devs masters assistants estimators primaries can insert bids co" ON public."bids_count_rows"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_count_rows.bid_id) AND ((b.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role])))))))))));

-- bids_count_rows · SELECT
ALTER POLICY "Devs masters assistants estimators primaries can read bids coun" ON public."bids_count_rows"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_count_rows.bid_id) AND ((b.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role])))))))))));

-- bids_count_rows · UPDATE
ALTER POLICY "Devs masters assistants estimators primaries can update bids co" ON public."bids_count_rows"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_count_rows.bid_id) AND ((b.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role])))))))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

-- bids_gc_builders · DELETE
ALTER POLICY "Devs, masters, assistants, and estimators can delete bids gc bu" ON public."bids_gc_builders"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND ((created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role]))))))));

-- bids_gc_builders · INSERT
ALTER POLICY "Devs, masters, assistants, and estimators can insert bids gc bu" ON public."bids_gc_builders"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (created_by = ( SELECT auth.uid() AS uid))));

-- bids_gc_builders · SELECT
ALTER POLICY "Devs masters assistants estimators primaries can read bids gc b" ON public."bids_gc_builders"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND ((created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))))));

-- bids_gc_builders · UPDATE
ALTER POLICY "Devs, masters, assistants, and estimators can update bids gc bu" ON public."bids_gc_builders"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND ((created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role]))))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))));

-- bids_materials · DELETE
ALTER POLICY "bid_cost_rows_bids_materials_delete" ON public."bids_materials"
  USING (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE (b.id = bids_materials.bid_id)))));

-- bids_materials · INSERT
ALTER POLICY "bid_cost_rows_bids_materials_insert" ON public."bids_materials"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE (b.id = bids_materials.bid_id)))));

-- bids_materials · SELECT
ALTER POLICY "bid_cost_rows_bids_materials_select" ON public."bids_materials"
  USING (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE (b.id = bids_materials.bid_id)))));

-- bids_materials · UPDATE
ALTER POLICY "bid_cost_rows_bids_materials_update" ON public."bids_materials"
  USING (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE (b.id = bids_materials.bid_id)))));

-- bids_submission_entries · DELETE
ALTER POLICY "Devs, masters, assistants, and estimators can delete bids submi" ON public."bids_submission_entries"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_submission_entries.bid_id) AND ((b.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role])))))) AND estimator_can_access_service_type(b.service_type_id))))));

-- bids_submission_entries · INSERT
ALTER POLICY "Devs, masters, assistants, and estimators can insert bids submi" ON public."bids_submission_entries"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_submission_entries.bid_id) AND ((b.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role])))))) AND estimator_can_access_service_type(b.service_type_id))))));

-- bids_submission_entries · SELECT
ALTER POLICY "Devs masters assistants estimators primaries can read bids subm" ON public."bids_submission_entries"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_submission_entries.bid_id) AND ((b.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role]))))) OR ((EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) AND ((EXISTS ( SELECT 1
           FROM (customers c
             JOIN master_primaries mp ON ((mp.master_id = c.master_user_id)))
          WHERE ((c.id = b.customer_id) AND (mp.primary_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM master_primaries mp
          WHERE ((mp.master_id = b.created_by) AND (mp.primary_id = ( SELECT auth.uid() AS uid))))) OR ((b.gc_builder_id IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM (bids_gc_builders bgb
             JOIN master_primaries mp ON ((mp.master_id = bgb.created_by)))
          WHERE ((bgb.id = b.gc_builder_id) AND (mp.primary_id = ( SELECT auth.uid() AS uid)))))) OR (EXISTS ( SELECT 1
           FROM (master_assistants ma
             JOIN master_primaries mp ON ((mp.master_id = ma.master_id)))
          WHERE ((ma.assistant_id = b.created_by) AND (mp.primary_id = ( SELECT auth.uid() AS uid))))))))))))));

-- bids_submission_entries · UPDATE
ALTER POLICY "Devs, masters, assistants, and estimators can update bids submi" ON public."bids_submission_entries"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_submission_entries.bid_id) AND ((b.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role])))))) AND estimator_can_access_service_type(b.service_type_id))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))));

-- bids_takeoff_rough_part_lines · DELETE
ALTER POLICY "bids_takeoff_rough_part_lines_delete" ON public."bids_takeoff_rough_part_lines"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_takeoff_rough_part_lines.bid_id) AND ((b.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))) OR superintendent_can_access_bid(b.*)))))));

-- bids_takeoff_rough_part_lines · INSERT
ALTER POLICY "bids_takeoff_rough_part_lines_insert" ON public."bids_takeoff_rough_part_lines"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_takeoff_rough_part_lines.bid_id) AND ((b.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))) OR superintendent_can_access_bid(b.*)))))));

-- bids_takeoff_rough_part_lines · SELECT
ALTER POLICY "bids_takeoff_rough_part_lines_select" ON public."bids_takeoff_rough_part_lines"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_takeoff_rough_part_lines.bid_id) AND ((b.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))) OR superintendent_can_access_bid(b.*)))))));

-- bids_takeoff_rough_part_lines · UPDATE
ALTER POLICY "bids_takeoff_rough_part_lines_update" ON public."bids_takeoff_rough_part_lines"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_takeoff_rough_part_lines.bid_id) AND ((b.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))) OR superintendent_can_access_bid(b.*)))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- bids_takeoff_template_mappings · DELETE
ALTER POLICY "Devs masters assistants estimators primaries superintendents ca" ON public."bids_takeoff_template_mappings"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_takeoff_template_mappings.bid_id) AND ((b.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))) OR superintendent_can_access_bid(b.*)))))));

-- bids_takeoff_template_mappings · DELETE
ALTER POLICY "Devs, masters, assistants, and estimators can delete mappings" ON public."bids_takeoff_template_mappings"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_takeoff_template_mappings.bid_id) AND ((b.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role])))))) AND estimator_can_access_service_type(b.service_type_id))))));

-- bids_takeoff_template_mappings · INSERT
ALTER POLICY "Devs, masters, assistants, and estimators can insert mappings" ON public."bids_takeoff_template_mappings"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_takeoff_template_mappings.bid_id) AND ((b.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role])))))) AND estimator_can_access_service_type(b.service_type_id))))));

-- bids_takeoff_template_mappings · SELECT
ALTER POLICY "Devs, masters, assistants, and estimators can read mappings" ON public."bids_takeoff_template_mappings"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_takeoff_template_mappings.bid_id) AND ((b.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role])))))) AND estimator_can_access_service_type(b.service_type_id))))));

-- bids_takeoff_template_mappings · UPDATE
ALTER POLICY "Devs, masters, assistants, and estimators can update mappings" ON public."bids_takeoff_template_mappings"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = bids_takeoff_template_mappings.bid_id) AND ((b.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role])))))) AND estimator_can_access_service_type(b.service_type_id))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))));

-- bids_tally_parts · DELETE
ALTER POLICY "bid_cost_rows_bids_tally_parts_delete" ON public."bids_tally_parts"
  USING (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE (b.id = bids_tally_parts.bid_id)))));

-- bids_tally_parts · INSERT
ALTER POLICY "bid_cost_rows_bids_tally_parts_insert" ON public."bids_tally_parts"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE (b.id = bids_tally_parts.bid_id)))));

-- bids_tally_parts · SELECT
ALTER POLICY "bid_cost_rows_bids_tally_parts_select" ON public."bids_tally_parts"
  USING (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE (b.id = bids_tally_parts.bid_id)))));

-- bids_tally_parts · UPDATE
ALTER POLICY "bid_cost_rows_bids_tally_parts_update" ON public."bids_tally_parts"
  USING (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE (b.id = bids_tally_parts.bid_id)))));

-- cost_estimate_labor_rows · DELETE
ALTER POLICY "Devs masters assistants estimators primaries superintendents ca" ON public."cost_estimate_labor_rows"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM cost_estimates ce
  WHERE ((ce.id = cost_estimate_labor_rows.cost_estimate_id) AND can_access_bid_for_pricing(ce.bid_id))))));

-- cost_estimates · DELETE
ALTER POLICY "Devs masters assistants estimators primaries superintendents ca" ON public."cost_estimates"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND can_access_bid_for_pricing(bid_id)));

-- estimate_customer_events · SELECT
ALTER POLICY "estimate_customer_events_select" ON public."estimate_customer_events"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM estimates e
  WHERE ((e.id = estimate_customer_events.estimate_id) AND (user_can_access_estimate(e.*) OR superintendent_can_access_estimate(e.*) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role])))))))))));

-- estimate_field_photos · SELECT
ALTER POLICY "estimate_field_photos_select" ON public."estimate_field_photos"
  USING ((EXISTS ( SELECT 1
   FROM estimates e
  WHERE ((e.id = estimate_field_photos.estimate_id) AND (user_can_access_estimate(e.*) OR superintendent_can_access_estimate(e.*) OR (EXISTS ( SELECT 1
           FROM users u
          WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))))))));

-- estimate_photo_handover · SELECT
ALTER POLICY "estimate_photo_handover_select" ON public."estimate_photo_handover"
  USING ((EXISTS ( SELECT 1
   FROM estimates e
  WHERE ((e.id = estimate_photo_handover.estimate_id) AND (user_can_access_estimate(e.*) OR superintendent_can_access_estimate(e.*) OR (EXISTS ( SELECT 1
           FROM users u
          WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))))))));

-- estimates · DELETE
ALTER POLICY "estimates_delete_draft" ON public."estimates"
  USING (((status = 'draft'::estimate_status) AND (is_dev() OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR user_can_access_estimate(estimates.*) OR superintendent_can_access_estimate(estimates.*) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))))));

-- estimates · INSERT
ALTER POLICY "estimates_insert" ON public."estimates"
  WITH CHECK ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role, 'subcontractor'::user_role]))))) AND (created_by = ( SELECT auth.uid() AS uid)) AND (is_dev() OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = estimates.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'estimator'::user_role)))) OR superintendent_can_access_estimate(estimates.*)))));

-- estimates · SELECT
ALTER POLICY "estimates_select" ON public."estimates"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role, 'subcontractor'::user_role]))))) AND (user_can_access_estimate(estimates.*) OR superintendent_can_access_estimate(estimates.*) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))))));

-- estimates · UPDATE
ALTER POLICY "estimates_update_draft" ON public."estimates"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role, 'subcontractor'::user_role]))))) AND (status = 'draft'::estimate_status) AND (user_can_access_estimate(estimates.*) OR superintendent_can_access_estimate(estimates.*) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role, 'subcontractor'::user_role]))))) AND (status = 'draft'::estimate_status)));

-- estimates · UPDATE
ALTER POLICY "final_estimates_update_accepted_link_job" ON public."estimates"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (status = 'customer_accepted'::estimate_status) AND (user_can_access_estimate(estimates.*) OR superintendent_can_access_estimate(estimates.*) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role]))))))))
  WITH CHECK ((status = 'customer_accepted'::estimate_status));

-- estimates_thread_notes · INSERT
ALTER POLICY "estimates_thread_notes_insert" ON public."estimates_thread_notes"
  WITH CHECK (((author_user_id = ( SELECT auth.uid() AS uid)) AND (( SELECT auth.uid() AS uid) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM estimates e
  WHERE ((e.id = estimates_thread_notes.estimate_id) AND (user_can_access_estimate(e.*) OR superintendent_can_access_estimate(e.*) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role])))))))))));

-- estimates_thread_notes · SELECT
ALTER POLICY "estimates_thread_notes_select" ON public."estimates_thread_notes"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM estimates e
  WHERE ((e.id = estimates_thread_notes.estimate_id) AND (user_can_access_estimate(e.*) OR superintendent_can_access_estimate(e.*) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'master_technician'::user_role, 'primary'::user_role])))))))))));

-- labor_book_entries · DELETE
ALTER POLICY "Devs, masters, assistants, and estimators can delete labor book" ON public."labor_book_entries"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM labor_book_versions lbv
  WHERE ((lbv.id = labor_book_entries.version_id) AND estimator_can_access_service_type(lbv.service_type_id))))));

-- labor_book_entries · INSERT
ALTER POLICY "Devs, masters, assistants, and estimators can insert labor book" ON public."labor_book_entries"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM labor_book_versions lbv
  WHERE ((lbv.id = labor_book_entries.version_id) AND estimator_can_access_service_type(lbv.service_type_id))))));

-- labor_book_entries · SELECT
ALTER POLICY "Devs, masters, assistants, and estimators can read labor book e" ON public."labor_book_entries"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM labor_book_versions lbv
  WHERE ((lbv.id = labor_book_entries.version_id) AND estimator_can_access_service_type(lbv.service_type_id))))));

-- labor_book_entries · UPDATE
ALTER POLICY "Devs, masters, assistants, and estimators can update labor book" ON public."labor_book_entries"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM labor_book_versions lbv
  WHERE ((lbv.id = labor_book_entries.version_id) AND estimator_can_access_service_type(lbv.service_type_id))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))));

-- labor_book_versions · DELETE
ALTER POLICY "Devs, masters, assistants, and estimators can delete labor book" ON public."labor_book_versions"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)));

-- labor_book_versions · INSERT
ALTER POLICY "Devs, masters, assistants, and estimators can insert labor book" ON public."labor_book_versions"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)));

-- labor_book_versions · SELECT
ALTER POLICY "Devs, masters, assistants, and estimators can read labor book v" ON public."labor_book_versions"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)));

-- labor_book_versions · UPDATE
ALTER POLICY "Devs, masters, assistants, and estimators can update labor book" ON public."labor_book_versions"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))));

-- price_book_entries · DELETE
ALTER POLICY "Devs masters assistants estimators primaries can delete price b" ON public."price_book_entries"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

-- price_book_entries · INSERT
ALTER POLICY "Devs masters assistants estimators primaries can insert price b" ON public."price_book_entries"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

-- price_book_entries · SELECT
ALTER POLICY "Devs masters assistants estimators primaries can read price boo" ON public."price_book_entries"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

-- price_book_entries · UPDATE
ALTER POLICY "Devs masters assistants estimators primaries can update price b" ON public."price_book_entries"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

-- price_book_versions · DELETE
ALTER POLICY "Devs masters assistants estimators primaries can delete price b" ON public."price_book_versions"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

-- price_book_versions · INSERT
ALTER POLICY "Devs masters assistants estimators primaries can insert price b" ON public."price_book_versions"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

-- price_book_versions · SELECT
ALTER POLICY "Devs masters assistants estimators primaries can read price boo" ON public."price_book_versions"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

-- price_book_versions · UPDATE
ALTER POLICY "Devs masters assistants estimators primaries can update price b" ON public."price_book_versions"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

-- takeoff_book_entries · DELETE
ALTER POLICY "Devs, masters, assistants, and estimators can delete takeoff bo" ON public."takeoff_book_entries"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM takeoff_book_versions tbv
  WHERE ((tbv.id = takeoff_book_entries.version_id) AND estimator_can_access_service_type(tbv.service_type_id))))));

-- takeoff_book_entries · INSERT
ALTER POLICY "Devs, masters, assistants, and estimators can insert takeoff bo" ON public."takeoff_book_entries"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM takeoff_book_versions tbv
  WHERE ((tbv.id = takeoff_book_entries.version_id) AND estimator_can_access_service_type(tbv.service_type_id))))));

-- takeoff_book_entries · SELECT
ALTER POLICY "Devs, masters, assistants, and estimators can read takeoff book" ON public."takeoff_book_entries"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM takeoff_book_versions tbv
  WHERE ((tbv.id = takeoff_book_entries.version_id) AND estimator_can_access_service_type(tbv.service_type_id))))));

-- takeoff_book_entries · UPDATE
ALTER POLICY "Devs, masters, assistants, and estimators can update takeoff bo" ON public."takeoff_book_entries"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM takeoff_book_versions tbv
  WHERE ((tbv.id = takeoff_book_entries.version_id) AND estimator_can_access_service_type(tbv.service_type_id))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))));

-- takeoff_book_entry_items · DELETE
ALTER POLICY "Devs, masters, assistants, and estimators can delete takeoff bo" ON public."takeoff_book_entry_items"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM (takeoff_book_entries tbe
     JOIN takeoff_book_versions tbv ON ((tbv.id = tbe.version_id)))
  WHERE ((tbe.id = takeoff_book_entry_items.entry_id) AND estimator_can_access_service_type(tbv.service_type_id))))));

-- takeoff_book_entry_items · INSERT
ALTER POLICY "Devs, masters, assistants, and estimators can insert takeoff bo" ON public."takeoff_book_entry_items"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM (takeoff_book_entries tbe
     JOIN takeoff_book_versions tbv ON ((tbv.id = tbe.version_id)))
  WHERE ((tbe.id = takeoff_book_entry_items.entry_id) AND estimator_can_access_service_type(tbv.service_type_id))))));

-- takeoff_book_entry_items · SELECT
ALTER POLICY "Devs, masters, assistants, and estimators can read takeoff book" ON public."takeoff_book_entry_items"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM (takeoff_book_entries tbe
     JOIN takeoff_book_versions tbv ON ((tbv.id = tbe.version_id)))
  WHERE ((tbe.id = takeoff_book_entry_items.entry_id) AND estimator_can_access_service_type(tbv.service_type_id))))));

-- takeoff_book_entry_items · UPDATE
ALTER POLICY "Devs, masters, assistants, and estimators can update takeoff bo" ON public."takeoff_book_entry_items"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM (takeoff_book_entries tbe
     JOIN takeoff_book_versions tbv ON ((tbv.id = tbe.version_id)))
  WHERE ((tbe.id = takeoff_book_entry_items.entry_id) AND estimator_can_access_service_type(tbv.service_type_id))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))));

-- takeoff_book_versions · DELETE
ALTER POLICY "Devs, masters, assistants, and estimators can delete takeoff bo" ON public."takeoff_book_versions"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)));

-- takeoff_book_versions · INSERT
ALTER POLICY "Devs, masters, assistants, and estimators can insert takeoff bo" ON public."takeoff_book_versions"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)));

-- takeoff_book_versions · SELECT
ALTER POLICY "Devs, masters, assistants, and estimators can read takeoff book" ON public."takeoff_book_versions"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)));

-- takeoff_book_versions · UPDATE
ALTER POLICY "Devs, masters, assistants, and estimators can update takeoff bo" ON public."takeoff_book_versions"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))));
