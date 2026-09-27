SET lock_timeout = '3s';

-- Controller access, batch 3 of the audit (to-dos/controller-access.md): jobs, customers, projects,
-- reports, people and the rest of the policies.
--
-- Names 'controller' beside 'assistant' in every remaining policy that lists its roles by hand.
-- Same name, same command, the same expression read back from pg_policies with one more role in
-- its list. ALTER POLICY is idempotent in effect.
SET search_path = public;

-- address_geocodes · DELETE
ALTER POLICY "Map roles can delete address geocodes" ON public."address_geocodes"
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))));

-- customer_addresses · DELETE
ALTER POLICY "Office roles and estimators can delete customer addresses" ON public."customer_addresses"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_addresses.customer_id) AND ((c.master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = c.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = c.master_user_id) AND (master_shares.viewing_master_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'estimator'::user_role))))))))));

-- customer_addresses · INSERT
ALTER POLICY "Office roles and estimators can insert customer addresses" ON public."customer_addresses"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_addresses.customer_id) AND ((c.master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = c.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = c.master_user_id) AND (master_shares.viewing_master_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'estimator'::user_role))))))))));

-- customer_addresses · SELECT
ALTER POLICY "Office roles and estimators can select customer addresses" ON public."customer_addresses"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_addresses.customer_id) AND ((c.master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = c.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = c.master_user_id) AND (master_shares.viewing_master_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'estimator'::user_role))))))))));

-- customer_addresses · UPDATE
ALTER POLICY "Office roles and estimators can update customer addresses" ON public."customer_addresses"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_addresses.customer_id) AND ((c.master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = c.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = c.master_user_id) AND (master_shares.viewing_master_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'estimator'::user_role))))))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_addresses.customer_id) AND ((c.master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = c.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = c.master_user_id) AND (master_shares.viewing_master_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'estimator'::user_role))))))))));

-- customer_contact_persons · DELETE
ALTER POLICY "Devs, masters, assistants, and estimators can delete customer c" ON public."customer_contact_persons"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_contact_persons.customer_id) AND ((c.master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = c.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = c.master_user_id) AND (master_shares.viewing_master_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'estimator'::user_role)))))))))));

-- customer_contact_persons · INSERT
ALTER POLICY "Devs, masters, assistants, and estimators can insert customer c" ON public."customer_contact_persons"
  WITH CHECK ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_contact_persons.customer_id) AND ((c.master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = c.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = c.master_user_id) AND (master_shares.viewing_master_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'estimator'::user_role)))))))))));

-- customer_contact_persons · SELECT
ALTER POLICY "Devs, masters, assistants, and estimators can read customer con" ON public."customer_contact_persons"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_contact_persons.customer_id) AND ((c.master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = c.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = c.master_user_id) AND (master_shares.viewing_master_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'estimator'::user_role)))))))))));

-- customer_contact_persons · UPDATE
ALTER POLICY "Devs, masters, assistants, and estimators can update customer c" ON public."customer_contact_persons"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_contact_persons.customer_id) AND ((c.master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = c.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = c.master_user_id) AND (master_shares.viewing_master_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'estimator'::user_role)))))))))))
  WITH CHECK ((is_office_staff() OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role])))))));

-- customer_contacts · DELETE
ALTER POLICY "Devs, masters, assistants, and estimators can delete customer c" ON public."customer_contacts"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_contacts.customer_id) AND ((c.master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = c.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = c.master_user_id) AND (master_shares.viewing_master_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'estimator'::user_role)))))))))));

-- customer_contacts · INSERT
ALTER POLICY "Devs, masters, assistants, and estimators can insert customer c" ON public."customer_contacts"
  WITH CHECK ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_contacts.customer_id) AND ((c.master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = c.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = c.master_user_id) AND (master_shares.viewing_master_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'estimator'::user_role)))))))) AND (created_by = ( SELECT auth.uid() AS uid)))));

-- customer_contacts · SELECT
ALTER POLICY "Devs, masters, assistants, and estimators can read customer con" ON public."customer_contacts"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_contacts.customer_id) AND ((c.master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = c.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = c.master_user_id) AND (master_shares.viewing_master_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'estimator'::user_role)))))))))));

-- customer_contacts · UPDATE
ALTER POLICY "Devs, masters, assistants, and estimators can update customer c" ON public."customer_contacts"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_contacts.customer_id) AND ((c.master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = c.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = c.master_user_id) AND (master_shares.viewing_master_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'estimator'::user_role)))))))))))
  WITH CHECK ((is_office_staff() OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role])))))));

-- customers · INSERT
ALTER POLICY "Assistants can insert customers when master is assigned and has" ON public."customers"
  WITH CHECK ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['assistant'::user_role, 'controller'::user_role]))))) AND (master_user_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = customers.master_user_id) AND (u.role = ANY (ARRAY['master_technician'::user_role, 'dev'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = customers.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))))));

-- customers · UPDATE
ALTER POLICY "Assistants can update customers when master has adopted them" ON public."customers"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['assistant'::user_role, 'controller'::user_role]))))) AND (master_user_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = customers.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))))))
  WITH CHECK ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['assistant'::user_role, 'controller'::user_role]))))) AND (master_user_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = customers.master_user_id) AND (u.role = ANY (ARRAY['master_technician'::user_role, 'dev'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = customers.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))))));

-- external_team_job_payments · DELETE
ALTER POLICY "Devs, masters, assistants can delete external team job payments" ON public."external_team_job_payments"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- external_team_job_payments · INSERT
ALTER POLICY "Devs, masters, assistants can insert external team job payments" ON public."external_team_job_payments"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- external_team_job_payments · SELECT
ALTER POLICY "Devs, masters, assistants can read external team job payments" ON public."external_team_job_payments"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- external_team_job_payments · UPDATE
ALTER POLICY "Devs, masters, assistants can update external team job payments" ON public."external_team_job_payments"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- external_team_sub_managers · DELETE
ALTER POLICY "Devs, masters, assistants can delete external team sub managers" ON public."external_team_sub_managers"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- external_team_sub_managers · INSERT
ALTER POLICY "Devs, masters, assistants can insert external team sub managers" ON public."external_team_sub_managers"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- external_team_sub_managers · SELECT
ALTER POLICY "Devs, masters, assistants can read external team sub managers" ON public."external_team_sub_managers"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- external_team_sub_managers · UPDATE
ALTER POLICY "Devs, masters, assistants can update external team sub managers" ON public."external_team_sub_managers"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- inspections · INSERT
ALTER POLICY "Devs masters assistants can insert inspections" ON public."inspections"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) AND (created_by_user_id = ( SELECT auth.uid() AS uid))));

-- inspections · SELECT
ALTER POLICY "Devs masters assistants can select inspections" ON public."inspections"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- inspections · UPDATE
ALTER POLICY "Devs masters assistants can update inspections" ON public."inspections"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- job_book_entries · DELETE
ALTER POLICY "Devs masters assistants can delete job book entries" ON public."job_book_entries"
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- job_book_entries · INSERT
ALTER POLICY "Devs masters assistants can insert job book entries" ON public."job_book_entries"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- job_book_entries · UPDATE
ALTER POLICY "Devs masters assistants can update job book entries" ON public."job_book_entries"
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- job_collect_payment_flows · SELECT
ALTER POLICY "job_collect_payment_flows_select_pending_dispatch_office" ON public."job_collect_payment_flows"
  USING (((status = 'pending_dispatch'::text) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['assistant'::user_role, 'controller'::user_role, 'master_technician'::user_role, 'primary'::user_role])))))));

-- job_collect_payment_flows · SELECT
ALTER POLICY "job_collect_payment_flows_select_staff" ON public."job_collect_payment_flows"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = job_collect_payment_flows.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), j.master_user_id))))))));

-- jobs_ledger · DELETE
ALTER POLICY "Devs, masters, assistants can delete jobs ledger" ON public."jobs_ledger"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) AND ((master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = jobs_ledger.master_user_id)))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = jobs_ledger.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), master_user_id)))));

-- jobs_ledger · INSERT
ALTER POLICY "Devs, masters, assistants can insert jobs ledger" ON public."jobs_ledger"
  WITH CHECK ((is_office_staff() OR (is_dev() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) AND ((master_user_id = ( SELECT auth.uid() AS uid)) OR ((project_id IS NOT NULL) AND can_access_project_row(project_id) AND (master_user_id = ( SELECT projects.master_user_id
   FROM projects
  WHERE (projects.id = jobs_ledger.project_id)))) OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['assistant'::user_role, 'controller'::user_role]))))) AND ((EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = jobs_ledger.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), master_user_id))))))));

-- jobs_ledger · SELECT
ALTER POLICY "Devs, masters, assistants, primary can read jobs ledger" ON public."jobs_ledger"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role]))))) AND ((master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = jobs_ledger.master_user_id)))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = jobs_ledger.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), master_user_id)))));

-- jobs_ledger · UPDATE
ALTER POLICY "Devs, masters, assistants, primary can update jobs ledger" ON public."jobs_ledger"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role]))))) AND ((master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = jobs_ledger.master_user_id)))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = jobs_ledger.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), master_user_id)))))
  WITH CHECK ((is_office_staff() OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role])))))));

-- jobs_ledger_fixtures · DELETE
ALTER POLICY "Devs, masters, assistants can delete jobs ledger fixtures" ON public."jobs_ledger_fixtures"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_fixtures.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), j.master_user_id))))))));

-- jobs_ledger_fixtures · INSERT
ALTER POLICY "Devs, masters, assistants can insert jobs ledger fixtures" ON public."jobs_ledger_fixtures"
  WITH CHECK ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_fixtures.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))))))))));

-- jobs_ledger_fixtures · SELECT
ALTER POLICY "Devs, masters, assistants, primary can read jobs ledger fixture" ON public."jobs_ledger_fixtures"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_fixtures.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), j.master_user_id))))))));

-- jobs_ledger_fixtures · UPDATE
ALTER POLICY "Devs, masters, assistants can update jobs ledger fixtures" ON public."jobs_ledger_fixtures"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_fixtures.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), j.master_user_id))))))));

-- jobs_ledger_invoice_stripe_email_sends · SELECT
ALTER POLICY "Invoice send log readable with jobs ledger invoices" ON public."jobs_ledger_invoice_stripe_email_sends"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role, 'superintendent'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM (jobs_ledger_invoices inv
     JOIN jobs_ledger j ON ((j.id = inv.job_id)))
  WHERE ((inv.id = jobs_ledger_invoice_stripe_email_sends.jobs_ledger_invoice_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_superintendents
          WHERE ((master_superintendents.master_id = j.master_user_id) AND (master_superintendents.superintendent_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), j.master_user_id))))))));

-- jobs_ledger_invoices · DELETE
ALTER POLICY "Devs, masters, assistants, primary can delete jobs ledger invoi" ON public."jobs_ledger_invoices"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_invoices.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), j.master_user_id))))))));

-- jobs_ledger_invoices · INSERT
ALTER POLICY "Devs, masters, assistants, primary can insert jobs ledger invoi" ON public."jobs_ledger_invoices"
  WITH CHECK ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_invoices.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))))))))));

-- jobs_ledger_invoices · SELECT
ALTER POLICY "Devs, masters, assistants, primary can read jobs ledger invoice" ON public."jobs_ledger_invoices"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_invoices.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), j.master_user_id))))))));

-- jobs_ledger_invoices · UPDATE
ALTER POLICY "Devs, masters, assistants, primary can update jobs ledger invoi" ON public."jobs_ledger_invoices"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_invoices.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), j.master_user_id))))))))
  WITH CHECK ((is_office_staff() OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role])))))));

-- jobs_ledger_materials · DELETE
ALTER POLICY "Devs, masters, assistants, primary can delete jobs ledger mater" ON public."jobs_ledger_materials"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_materials.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), j.master_user_id))))))));

-- jobs_ledger_materials · INSERT
ALTER POLICY "Devs, masters, assistants, primary can insert jobs ledger mater" ON public."jobs_ledger_materials"
  WITH CHECK ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_materials.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))))))))));

-- jobs_ledger_materials · SELECT
ALTER POLICY "Devs, masters, assistants, primary can read jobs ledger materia" ON public."jobs_ledger_materials"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_materials.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), j.master_user_id))))))));

-- jobs_ledger_materials · UPDATE
ALTER POLICY "Devs, masters, assistants, primary can update jobs ledger mater" ON public."jobs_ledger_materials"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_materials.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), j.master_user_id))))))))
  WITH CHECK ((is_office_staff() OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role])))))));

-- jobs_ledger_payments · DELETE
ALTER POLICY "Devs, masters, assistants, primary can delete jobs ledger payme" ON public."jobs_ledger_payments"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_payments.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), j.master_user_id))))))));

-- jobs_ledger_payments · INSERT
ALTER POLICY "Devs, masters, assistants, primary can insert jobs ledger payme" ON public."jobs_ledger_payments"
  WITH CHECK ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_payments.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))))))))));

-- jobs_ledger_payments · SELECT
ALTER POLICY "Devs, masters, assistants, primary can read jobs ledger payment" ON public."jobs_ledger_payments"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_payments.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), j.master_user_id))))))));

-- jobs_ledger_payments · UPDATE
ALTER POLICY "Devs, masters, assistants, primary can update jobs ledger payme" ON public."jobs_ledger_payments"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_payments.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), j.master_user_id))))))))
  WITH CHECK ((is_office_staff() OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role])))))));

-- jobs_ledger_team_members · DELETE
ALTER POLICY "Devs, masters, assistants can delete jobs ledger team members" ON public."jobs_ledger_team_members"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_team_members.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'dev'::user_role)))))))))));

-- jobs_ledger_team_members · INSERT
ALTER POLICY "Devs, masters, assistants can insert jobs ledger team members" ON public."jobs_ledger_team_members"
  WITH CHECK ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_team_members.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), j.master_user_id))))))));

-- jobs_ledger_team_members · SELECT
ALTER POLICY "Devs, masters, assistants, primary can read jobs ledger team me" ON public."jobs_ledger_team_members"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_ledger_team_members.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), j.master_user_id))))))));

-- jobs_receivables · DELETE
ALTER POLICY "Devs, masters, assistants can delete jobs receivables" ON public."jobs_receivables"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) AND ((master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = jobs_receivables.master_user_id)))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = jobs_receivables.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), master_user_id)))));

-- jobs_receivables · INSERT
ALTER POLICY "Devs, masters, assistants can insert jobs receivables" ON public."jobs_receivables"
  WITH CHECK ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) AND ((master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = jobs_receivables.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid)))))))));

-- jobs_receivables · SELECT
ALTER POLICY "Devs, masters, assistants can read jobs receivables" ON public."jobs_receivables"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) AND ((master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = jobs_receivables.master_user_id)))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = jobs_receivables.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), master_user_id)))));

-- jobs_receivables · UPDATE
ALTER POLICY "Devs, masters, assistants can update jobs receivables" ON public."jobs_receivables"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) AND ((master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = jobs_receivables.master_user_id)))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = jobs_receivables.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), master_user_id)))))
  WITH CHECK ((is_office_staff() OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role])))))));

-- jobs_tally_parts · DELETE
ALTER POLICY "Devs masters assistants primary can delete jobs tally parts" ON public."jobs_tally_parts"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_tally_parts.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), j.master_user_id))))))));

-- jobs_tally_parts · INSERT
ALTER POLICY "Devs masters assistants primary can insert jobs tally parts" ON public."jobs_tally_parts"
  WITH CHECK ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_tally_parts.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), j.master_user_id))))))));

-- jobs_tally_parts · SELECT
ALTER POLICY "Devs masters assistants primary can read jobs tally parts" ON public."jobs_tally_parts"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_tally_parts.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), j.master_user_id))))))));

-- jobs_tally_parts · UPDATE
ALTER POLICY "Devs masters assistants primary can update jobs tally parts" ON public."jobs_tally_parts"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'primary'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM jobs_ledger j
  WHERE ((j.id = jobs_tally_parts.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR assistants_share_master(( SELECT auth.uid() AS uid), j.master_user_id))))))));

-- mercury_transaction_bid_allocations · DELETE
ALTER POLICY "mercury_transaction_bid_allocations_staff_delete" ON public."mercury_transaction_bid_allocations"
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- mercury_transaction_bid_allocations · INSERT
ALTER POLICY "mercury_transaction_bid_allocations_staff_insert" ON public."mercury_transaction_bid_allocations"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- mercury_transaction_bid_allocations · SELECT
ALTER POLICY "mercury_transaction_bid_allocations_staff_select" ON public."mercury_transaction_bid_allocations"
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- mercury_transaction_bid_allocations · UPDATE
ALTER POLICY "mercury_transaction_bid_allocations_staff_update" ON public."mercury_transaction_bid_allocations"
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- people · INSERT
ALTER POLICY "Users can insert own people" ON public."people"
  WITH CHECK ((is_office_staff() OR ((master_user_id = ( SELECT auth.uid() AS uid)) AND (is_dev() OR (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role])))))))));

-- people · SELECT
ALTER POLICY "Banking staff read non-archived people for mercury attribution" ON public."people"
  USING (((archived_at IS NULL) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role])))))));

-- people_labor_job_assignees · DELETE
ALTER POLICY "plja_delete" ON public."people_labor_job_assignees"
  USING (((EXISTS ( SELECT 1
   FROM people_labor_jobs plj
  WHERE (plj.id = people_labor_job_assignees.labor_job_id))) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role])))))));

-- people_labor_job_assignees · INSERT
ALTER POLICY "plja_insert" ON public."people_labor_job_assignees"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM people_labor_jobs plj
  WHERE (plj.id = people_labor_job_assignees.labor_job_id))) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role])))))));

-- people_labor_job_assignees · UPDATE
ALTER POLICY "plja_update" ON public."people_labor_job_assignees"
  USING (((EXISTS ( SELECT 1
   FROM people_labor_jobs plj
  WHERE (plj.id = people_labor_job_assignees.labor_job_id))) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role])))))));

-- people_labor_job_items · DELETE
ALTER POLICY "Devs, masters, assistants, and estimators can delete people lab" ON public."people_labor_job_items"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND can_modify_people_labor_job(job_id)));

-- people_labor_job_items · INSERT
ALTER POLICY "Devs, masters, assistants, and estimators can insert people lab" ON public."people_labor_job_items"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND can_modify_people_labor_job(job_id)));

-- people_labor_job_items · SELECT
ALTER POLICY "Devs, masters, assistants, and estimators can read people labor" ON public."people_labor_job_items"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM people_labor_jobs j
  WHERE ((j.id = people_labor_job_items.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = j.master_user_id) AND (master_shares.viewing_master_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM (master_assistants ma
             JOIN master_shares ms ON ((ms.viewing_master_id = ma.master_id)))
          WHERE ((ma.assistant_id = ( SELECT auth.uid() AS uid)) AND (ms.sharing_master_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM master_assistants ma_me
          WHERE ((ma_me.assistant_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
                   FROM master_assistants ma_other
                  WHERE ((ma_other.master_id = ma_me.master_id) AND (ma_other.assistant_id = j.master_user_id))))))))))))));

-- people_labor_job_items · UPDATE
ALTER POLICY "Devs, masters, assistants, and estimators can update people lab" ON public."people_labor_job_items"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND can_modify_people_labor_job(job_id)))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))));

-- people_labor_job_payments · DELETE
ALTER POLICY "Devs, masters, assistants, and estimators can delete people lab" ON public."people_labor_job_payments"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM people_labor_jobs j
  WHERE ((j.id = people_labor_job_payments.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'dev'::user_role)))))))))));

-- people_labor_job_payments · INSERT
ALTER POLICY "Devs, masters, assistants, and estimators can insert people lab" ON public."people_labor_job_payments"
  WITH CHECK ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM people_labor_jobs j
  WHERE ((j.id = people_labor_job_payments.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'dev'::user_role)))))))))));

-- people_labor_job_payments · SELECT
ALTER POLICY "Devs, masters, assistants, and estimators can read people labor" ON public."people_labor_job_payments"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM people_labor_jobs j
  WHERE ((j.id = people_labor_job_payments.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
           FROM master_shares
          WHERE ((master_shares.sharing_master_id = j.master_user_id) AND (master_shares.viewing_master_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM (master_assistants ma
             JOIN master_shares ms ON ((ms.viewing_master_id = ma.master_id)))
          WHERE ((ma.assistant_id = ( SELECT auth.uid() AS uid)) AND (ms.sharing_master_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = j.master_user_id)))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = j.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM master_assistants ma_me
          WHERE ((ma_me.assistant_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
                   FROM master_assistants ma_other
                  WHERE ((ma_other.master_id = ma_me.master_id) AND (ma_other.assistant_id = j.master_user_id))))))))))))));

-- people_labor_job_payments · UPDATE
ALTER POLICY "Devs, masters, assistants, and estimators can update people lab" ON public."people_labor_job_payments"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM people_labor_jobs j
  WHERE ((j.id = people_labor_job_payments.job_id) AND ((j.master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'dev'::user_role)))))))))))
  WITH CHECK ((is_office_staff() OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role])))))));

-- people_labor_jobs · DELETE
ALTER POLICY "Devs, masters, assistants, and estimators can delete own people" ON public."people_labor_jobs"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND ((master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'dev'::user_role))))))));

-- people_labor_jobs · INSERT
ALTER POLICY "Devs, masters, assistants, and estimators can insert own people" ON public."people_labor_jobs"
  WITH CHECK ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND (master_user_id = ( SELECT auth.uid() AS uid)))));

-- people_labor_jobs · SELECT
ALTER POLICY "Devs, masters, assistants, and estimators can read people labor" ON public."people_labor_jobs"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND ((master_user_id = ( SELECT auth.uid() AS uid)) OR is_dev() OR (EXISTS ( SELECT 1
   FROM master_shares
  WHERE ((master_shares.sharing_master_id = people_labor_jobs.master_user_id) AND (master_shares.viewing_master_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM (master_assistants ma
     JOIN master_shares ms ON ((ms.viewing_master_id = ma.master_id)))
  WHERE ((ma.assistant_id = ( SELECT auth.uid() AS uid)) AND (ms.sharing_master_id = people_labor_jobs.master_user_id)))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = ( SELECT auth.uid() AS uid)) AND (master_assistants.assistant_id = people_labor_jobs.master_user_id)))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = people_labor_jobs.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM master_assistants ma_me
  WHERE ((ma_me.assistant_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
           FROM master_assistants ma_other
          WHERE ((ma_other.master_id = ma_me.master_id) AND (ma_other.assistant_id = people_labor_jobs.master_user_id)))))))))));

-- people_labor_jobs · UPDATE
ALTER POLICY "Devs, masters, assistants, and estimators can update own people" ON public."people_labor_jobs"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role]))))) AND ((master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'dev'::user_role))))))))
  WITH CHECK ((is_office_staff() OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'estimator'::user_role])))))));

-- project_superintendents · DELETE
ALTER POLICY "Devs masters assistants can delete project superintendents" ON public."project_superintendents"
  USING ((can_access_project_row(project_id) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role])))))));

-- project_superintendents · INSERT
ALTER POLICY "Devs masters assistants can insert project superintendents" ON public."project_superintendents"
  WITH CHECK ((can_access_project_row(project_id) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role])))))));

-- project_superintendents · SELECT
ALTER POLICY "Devs masters assistants can read project superintendents" ON public."project_superintendents"
  USING ((can_access_project_row(project_id) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role])))))));

-- project_workflow_steps · DELETE
ALTER POLICY "Users can delete steps for workflows they have access to" ON public."project_workflow_steps"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'superintendent'::user_role]))))) AND can_access_project_via_workflow(workflow_id)));

-- project_workflow_steps · INSERT
ALTER POLICY "Users can insert steps for workflows they have access to" ON public."project_workflow_steps"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'superintendent'::user_role]))))) AND can_access_project_via_workflow(workflow_id)));

-- project_workflow_steps · SELECT
ALTER POLICY "Users can see steps for workflows they have access to" ON public."project_workflow_steps"
  USING ((is_dev() OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'master_technician'::user_role)))) OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['assistant'::user_role, 'controller'::user_role]))))) AND can_access_project_via_workflow(workflow_id)) OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'superintendent'::user_role)))) AND can_access_project_via_workflow(workflow_id)) OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) AND (can_access_project_via_step(id) OR step_assignee_matches_user(assigned_person_id, assigned_to_name, ( SELECT auth.uid() AS uid)))) OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['helpers'::user_role, 'subcontractor'::user_role]))))) AND step_assignee_matches_user(assigned_person_id, assigned_to_name, ( SELECT auth.uid() AS uid)))));

-- project_workflow_steps · UPDATE
ALTER POLICY "Users can update steps for workflows they have access to" ON public."project_workflow_steps"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'superintendent'::user_role]))))) AND can_access_project_via_workflow(workflow_id)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'superintendent'::user_role]))))) AND can_access_project_via_workflow(workflow_id)));

-- project_workflows · INSERT
ALTER POLICY "Users can insert workflows for projects they have access to" ON public."project_workflows"
  WITH CHECK ((is_office_staff() OR (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_workflows.project_id) AND ((p.master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users u
          WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants ma
          WHERE ((ma.master_id = p.master_user_id) AND (ma.assistant_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM master_shares ms
          WHERE ((ms.sharing_master_id = p.master_user_id) AND (ms.viewing_master_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM customers c
          WHERE ((c.id = p.customer_id) AND ((c.master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
                   FROM users u2
                  WHERE ((u2.id = ( SELECT auth.uid() AS uid)) AND (u2.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
                   FROM master_assistants ma2
                  WHERE ((ma2.master_id = c.master_user_id) AND (ma2.assistant_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
                   FROM master_shares ms2
                  WHERE ((ms2.sharing_master_id = c.master_user_id) AND (ms2.viewing_master_id = ( SELECT auth.uid() AS uid)))))))))))))) OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'superintendent'::user_role)))) AND can_access_project_row(project_id)))));

-- projects · INSERT
ALTER POLICY "Assistants and above can insert projects" ON public."projects"
  WITH CHECK ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) AND ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['assistant'::user_role, 'controller'::user_role]))))) AND (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = projects.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))))))));

-- projects · UPDATE
ALTER POLICY "Assistants and above can update projects" ON public."projects"
  USING ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) AND ((master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = projects.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid)))))))))
  WITH CHECK ((is_office_staff() OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) AND ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR ((master_user_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM master_assistants
  WHERE ((master_assistants.master_id = projects.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))))) AND (EXISTS ( SELECT 1
   FROM customers
  WHERE ((customers.id = projects.customer_id) AND ((customers.master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM users
          WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role]))))) OR (EXISTS ( SELECT 1
           FROM master_assistants
          WHERE ((master_assistants.master_id = customers.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))))))))));

-- push_subscriptions · SELECT
ALTER POLICY "Masters and assistants can select push subscriptions" ON public."push_subscriptions"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- reports · INSERT
ALTER POLICY "reports insert access" ON public."reports"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) OR (( SELECT is_estimator() AS is_estimator) AND (created_by_user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (( SELECT auth_uid_is_helpers_or_subcontractor() AS auth_uid_is_helpers_or_subcontractor) AND (created_by_user_id = ( SELECT auth.uid() AS uid))) OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'superintendent'::user_role)))) AND (((project_id IS NOT NULL) AND can_access_project_row(project_id)) OR ((job_ledger_id IS NOT NULL) AND superintendent_report_job_anchor_allowed(job_ledger_id)) OR ((bid_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = reports.bid_id) AND superintendent_can_access_bid(b.*)))))))));

-- reports · SELECT
ALTER POLICY "reports select access" ON public."reports"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (( SELECT auth_uid_is_helpers_or_subcontractor() AS auth_uid_is_helpers_or_subcontractor) AND (created_by_user_id = ( SELECT auth.uid() AS uid)) AND (created_at >= (now() - ((( SELECT report_sub_visibility_months() AS report_sub_visibility_months) || ' months'::text))::interval))) OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'superintendent'::user_role)))) AND (((project_id IS NOT NULL) AND can_access_project_row(project_id)) OR ((job_ledger_id IS NOT NULL) AND superintendent_report_job_anchor_allowed(job_ledger_id)) OR ((bid_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = reports.bid_id) AND superintendent_can_access_bid(b.*)))))))));

-- reports · UPDATE
ALTER POLICY "reports update access" ON public."reports"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (( SELECT auth_uid_is_helpers_or_subcontractor() AS auth_uid_is_helpers_or_subcontractor) AND (created_by_user_id = ( SELECT auth.uid() AS uid)) AND (created_at >= (now() - ((( SELECT report_edit_window_days() AS report_edit_window_days) || ' days'::text))::interval))) OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'superintendent'::user_role)))) AND (((project_id IS NOT NULL) AND can_access_project_row(project_id)) OR ((job_ledger_id IS NOT NULL) AND superintendent_report_job_anchor_allowed(job_ledger_id)) OR ((bid_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = reports.bid_id) AND superintendent_can_access_bid(b.*)))))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))) OR (created_by_user_id = ( SELECT auth.uid() AS uid)) OR ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'superintendent'::user_role)))) AND (((project_id IS NOT NULL) AND can_access_project_row(project_id)) OR ((job_ledger_id IS NOT NULL) AND superintendent_report_job_anchor_allowed(job_ledger_id)) OR ((bid_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = reports.bid_id) AND superintendent_can_access_bid(b.*)))))))));

-- schedule_day_email_requests · INSERT
ALTER POLICY "schedule_day_email_requests_insert_dev_master_assistant_self" ON public."schedule_day_email_requests"
  WITH CHECK (((recipient_user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (u.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role])))))));

-- user_dashboard_goals · ALL
ALTER POLICY "Dev master assistant manage dashboard goals" ON public."user_dashboard_goals"
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))));

-- user_report_notification_preferences · ALL
ALTER POLICY "Masters assistants devs can manage own report notification pref" ON public."user_report_notification_preferences"
  USING (((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role])))))))
  WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role])))))));

-- workflow_step_dependencies · DELETE
ALTER POLICY "Users can delete workflow dependencies for steps they can acces" ON public."workflow_step_dependencies"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) AND (can_access_project_via_step(step_id) OR can_access_project_via_step(depends_on_step_id))));

-- workflow_step_dependencies · INSERT
ALTER POLICY "Users can insert workflow dependencies for steps they can acces" ON public."workflow_step_dependencies"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) AND can_access_project_via_step(step_id) AND can_access_project_via_step(depends_on_step_id)));

-- workflow_step_dependencies · UPDATE
ALTER POLICY "Users can update workflow dependencies for steps they can acces" ON public."workflow_step_dependencies"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) AND can_access_project_via_step(step_id) AND can_access_project_via_step(depends_on_step_id)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role]))))) AND can_access_project_via_step(step_id) AND can_access_project_via_step(depends_on_step_id)));

-- workflow_step_line_items · DELETE
ALTER POLICY "Owners, masters, assistants, superintendents can delete line it" ON public."workflow_step_line_items"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'superintendent'::user_role]))))) AND can_access_project_via_step(step_id)));

-- workflow_step_line_items · INSERT
ALTER POLICY "Owners, masters, assistants, superintendents can insert line it" ON public."workflow_step_line_items"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'superintendent'::user_role]))))) AND can_access_project_via_step(step_id)));

-- workflow_step_line_items · SELECT
ALTER POLICY "Owners, masters, assistants, superintendents can read line item" ON public."workflow_step_line_items"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'superintendent'::user_role]))))) AND can_access_project_via_step(step_id)));

-- workflow_step_line_items · UPDATE
ALTER POLICY "Owners, masters, assistants, superintendents can update line it" ON public."workflow_step_line_items"
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'superintendent'::user_role]))))) AND can_access_project_via_step(step_id)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role, 'controller'::user_role, 'superintendent'::user_role]))))) AND can_access_project_via_step(step_id)));
