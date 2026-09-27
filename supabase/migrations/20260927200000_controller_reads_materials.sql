SET lock_timeout = '3s';

-- Controller access, batch 1 of the audit (to-dos/controller-access.md): Materials and supply houses.
--
-- The controller role (v2.662) was made assistant-like by widening is_assistant(). Policies that
-- spell their roles out by hand never got it, so a controller could edit a supply house
-- (20260908184533) and read none. This names 'controller' beside 'assistant' in every such policy
-- on the Materials and supply-house tables. Nothing else about a policy changes: same name, same
-- command, same expression with one more role in its list.
--
-- ALTER POLICY is idempotent in effect: a second run sets the same expression.
-- search_path is public here, as the expressions were read back from pg_policies.
SET search_path = public;

-- assembly_types · DELETE
ALTER POLICY "Authorized users can delete assembly types" ON public."assembly_types"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))));

-- assembly_types · INSERT
ALTER POLICY "Authorized users can insert assembly types" ON public."assembly_types"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))));

-- assembly_types · UPDATE
ALTER POLICY "Authorized users can update assembly types" ON public."assembly_types"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))));

-- fixture_labor_defaults · SELECT
ALTER POLICY "Devs, masters, assistants, and estimators can read fixture labo" ON public."fixture_labor_defaults"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))));

-- fixture_types · DELETE
ALTER POLICY "Devs masters assistants estimators primaries can delete fixture" ON public."fixture_types"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

-- fixture_types · INSERT
ALTER POLICY "Devs masters assistants estimators primaries can insert fixture" ON public."fixture_types"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

-- fixture_types · UPDATE
ALTER POLICY "Devs masters assistants estimators primaries can update fixture" ON public."fixture_types"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role]))))));

-- material_part_price_history · INSERT
ALTER POLICY "sup_material_price_history_insert" ON public."material_part_price_history"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- material_part_price_history · SELECT
ALTER POLICY "sup_material_price_history_select" ON public."material_part_price_history"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- material_part_prices · DELETE
ALTER POLICY "sup_material_part_prices_delete" ON public."material_part_prices"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- material_part_prices · INSERT
ALTER POLICY "sup_material_part_prices_insert" ON public."material_part_prices"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- material_part_prices · SELECT
ALTER POLICY "sup_material_part_prices_select" ON public."material_part_prices"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- material_part_prices · UPDATE
ALTER POLICY "sup_material_part_prices_update" ON public."material_part_prices"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- material_parts · DELETE
ALTER POLICY "sup_material_parts_delete" ON public."material_parts"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- material_parts · INSERT
ALTER POLICY "sup_material_parts_insert" ON public."material_parts"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- material_parts · SELECT
ALTER POLICY "sup_material_parts_select" ON public."material_parts"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- material_parts · UPDATE
ALTER POLICY "sup_material_parts_update" ON public."material_parts"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- material_po_generator_entries · SELECT
ALTER POLICY "material_po_generator_entries_select_authenticated" ON public."material_po_generator_entries"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger jl
  WHERE ((jl.id = material_po_generator_entries.job_ledger_id) AND ((jl.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM master_assistants ma
          WHERE ((ma.master_id = ( SELECT auth.uid() AS uid)) AND (ma.assistant_id = jl.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants ma
          WHERE ((ma.master_id = jl.master_user_id) AND (ma.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), jl.master_user_id))))))));

-- material_template_items · DELETE
ALTER POLICY "sup_material_template_items_delete" ON public."material_template_items"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- material_template_items · INSERT
ALTER POLICY "sup_material_template_items_insert" ON public."material_template_items"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- material_template_items · SELECT
ALTER POLICY "sup_material_template_items_select" ON public."material_template_items"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- material_template_items · UPDATE
ALTER POLICY "sup_material_template_items_update" ON public."material_template_items"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- material_template_prices · DELETE
ALTER POLICY "material_template_prices_delete" ON public."material_template_prices"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- material_template_prices · INSERT
ALTER POLICY "material_template_prices_insert" ON public."material_template_prices"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- material_template_prices · SELECT
ALTER POLICY "material_template_prices_select" ON public."material_template_prices"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- material_template_prices · UPDATE
ALTER POLICY "material_template_prices_update" ON public."material_template_prices"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- material_templates · DELETE
ALTER POLICY "sup_material_templates_delete" ON public."material_templates"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- material_templates · INSERT
ALTER POLICY "sup_material_templates_insert" ON public."material_templates"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- material_templates · SELECT
ALTER POLICY "sup_material_templates_select" ON public."material_templates"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- material_templates · UPDATE
ALTER POLICY "sup_material_templates_update" ON public."material_templates"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));

-- part_types · DELETE
ALTER POLICY "Devs, masters, assistants, and estimators can delete part types" ON public."part_types"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)));

-- part_types · INSERT
ALTER POLICY "Devs, masters, assistants, and estimators can insert part types" ON public."part_types"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)));

-- part_types · SELECT
ALTER POLICY "Devs, masters, assistants, and estimators can read part types" ON public."part_types"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)));

-- part_types · UPDATE
ALTER POLICY "Devs, masters, assistants, and estimators can update part types" ON public."part_types"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND estimator_can_access_service_type(service_type_id)));

-- purchase_order_items · DELETE
ALTER POLICY "sup_purchase_order_items_delete" ON public."purchase_order_items"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM purchase_orders po
  WHERE ((po.id = purchase_order_items.purchase_order_id) AND ((po.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role])))))))))));

-- purchase_order_items · INSERT
ALTER POLICY "sup_purchase_order_items_insert" ON public."purchase_order_items"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM purchase_orders po
  WHERE ((po.id = purchase_order_items.purchase_order_id) AND ((po.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role])))))) AND (po.status = 'draft'::text))))));

-- purchase_order_items · SELECT
ALTER POLICY "sup_purchase_order_items_select" ON public."purchase_order_items"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM purchase_orders po
  WHERE ((po.id = purchase_order_items.purchase_order_id) AND ((po.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role])))))))))));

-- purchase_order_items · UPDATE
ALTER POLICY "Assistants can update price confirmation" ON public."purchase_order_items"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['assistant'::user_role, 'controller'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['assistant'::user_role, 'controller'::user_role]))))));

-- purchase_order_items · UPDATE
ALTER POLICY "sup_purchase_order_items_update" ON public."purchase_order_items"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM purchase_orders po
  WHERE ((po.id = purchase_order_items.purchase_order_id) AND ((po.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role])))))) AND (po.status = 'draft'::text))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM purchase_orders po
  WHERE ((po.id = purchase_order_items.purchase_order_id) AND ((po.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role])))))) AND (po.status = 'draft'::text))))));

-- purchase_orders · DELETE
ALTER POLICY "sup_purchase_orders_delete" ON public."purchase_orders"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND ((created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))))));

-- purchase_orders · INSERT
ALTER POLICY "sup_purchase_orders_insert" ON public."purchase_orders"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (created_by = ( SELECT auth.uid() AS uid))));

-- purchase_orders · SELECT
ALTER POLICY "sup_purchase_orders_select" ON public."purchase_orders"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND ((created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))))));

-- purchase_orders · UPDATE
ALTER POLICY "sup_purchase_orders_update" ON public."purchase_orders"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND ((created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role])))))) AND (status = 'draft'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND ((created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))))));

-- supply_house_invoice_bid_allocations · DELETE
ALTER POLICY "supply_house_invoice_bid_allocations_staff_delete" ON public."supply_house_invoice_bid_allocations"
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- supply_house_invoice_bid_allocations · INSERT
ALTER POLICY "supply_house_invoice_bid_allocations_staff_insert" ON public."supply_house_invoice_bid_allocations"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- supply_house_invoice_bid_allocations · SELECT
ALTER POLICY "supply_house_invoice_bid_allocations_staff_select" ON public."supply_house_invoice_bid_allocations"
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- supply_house_invoice_bid_allocations · UPDATE
ALTER POLICY "supply_house_invoice_bid_allocations_staff_update" ON public."supply_house_invoice_bid_allocations"
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- supply_house_invoice_job_allocations · DELETE
ALTER POLICY "Devs, masters, assistants can delete supply house invoice job a" ON public."supply_house_invoice_job_allocations"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- supply_house_invoice_job_allocations · INSERT
ALTER POLICY "Devs, masters, assistants can insert supply house invoice job a" ON public."supply_house_invoice_job_allocations"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- supply_house_invoice_job_allocations · SELECT
ALTER POLICY "Devs, masters, assistants can read supply house invoice job all" ON public."supply_house_invoice_job_allocations"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- supply_house_invoice_job_allocations · UPDATE
ALTER POLICY "Devs, masters, assistants can update supply house invoice job a" ON public."supply_house_invoice_job_allocations"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- supply_house_invoices · DELETE
ALTER POLICY "Devs, masters, assistants can delete supply house invoices" ON public."supply_house_invoices"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- supply_house_invoices · INSERT
ALTER POLICY "Devs, masters, assistants can insert supply house invoices" ON public."supply_house_invoices"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- supply_house_invoices · SELECT
ALTER POLICY "Devs, masters, assistants can read supply house invoices" ON public."supply_house_invoices"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- supply_house_invoices · UPDATE
ALTER POLICY "Devs, masters, assistants can update supply house invoices" ON public."supply_house_invoices"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- supply_houses · SELECT
ALTER POLICY "sup_supply_houses_select" ON public."supply_houses"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))));
