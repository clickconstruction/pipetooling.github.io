-- ROLLBACK for migration 20260605202851_consolidate_rls_hot_tables_permissive_policies.sql
-- Restores the ORIGINAL per-role RLS policies on the 5 hot tables, captured live from prod
-- (pg_policies, ref yewfzhbofbbyvkvtaatw) on 2026-06-05 before the consolidation.
-- NOT a normal forward migration — apply only to revert (append as a new migration or run
-- directly via apply_migration if the consolidation needs to be undone).

-- 1) Drop the consolidated policies
DROP POLICY IF EXISTS "clock_sessions select access" ON public.clock_sessions;
DROP POLICY IF EXISTS "clock_sessions insert access" ON public.clock_sessions;
DROP POLICY IF EXISTS "clock_sessions update access" ON public.clock_sessions;
DROP POLICY IF EXISTS "people_crew_bids select access" ON public.people_crew_bids;
DROP POLICY IF EXISTS "people_crew_bids insert access" ON public.people_crew_bids;
DROP POLICY IF EXISTS "people_crew_bids update access" ON public.people_crew_bids;
DROP POLICY IF EXISTS "people_crew_bids delete access" ON public.people_crew_bids;
DROP POLICY IF EXISTS "people_crew_jobs select access" ON public.people_crew_jobs;
DROP POLICY IF EXISTS "people_crew_jobs insert access" ON public.people_crew_jobs;
DROP POLICY IF EXISTS "people_crew_jobs update access" ON public.people_crew_jobs;
DROP POLICY IF EXISTS "people_crew_jobs delete access" ON public.people_crew_jobs;
DROP POLICY IF EXISTS "people_hours select access" ON public.people_hours;
DROP POLICY IF EXISTS "people_hours insert access" ON public.people_hours;
DROP POLICY IF EXISTS "people_hours update access" ON public.people_hours;
DROP POLICY IF EXISTS "reports select access" ON public.reports;
DROP POLICY IF EXISTS "reports insert access" ON public.reports;
DROP POLICY IF EXISTS "reports update access" ON public.reports;
DROP POLICY IF EXISTS "reports delete access" ON public.reports;

-- 2) Recreate the originals (verbatim from prod)
CREATE POLICY "Pay access can delete clock sessions" ON public.clock_sessions AS PERMISSIVE FOR DELETE TO public
  USING (is_pay_approved_master());
CREATE POLICY "Pay access can insert clock sessions" ON public.clock_sessions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((is_pay_approved_master() OR is_assistant_of_pay_approved_master() OR is_assistant()) AND (origin = 'user_punch'::text)));
CREATE POLICY "Users can insert own clock sessions" ON public.clock_sessions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (origin = 'user_punch'::text)));
CREATE POLICY "Devs can read all clock sessions" ON public.clock_sessions AS PERMISSIVE FOR SELECT TO public
  USING (is_dev());
CREATE POLICY "Pay access can read all clock sessions" ON public.clock_sessions AS PERMISSIVE FOR SELECT TO public
  USING ((is_pay_approved_master() OR is_assistant_of_pay_approved_master()));
CREATE POLICY "Team leads can read member clock sessions" ON public.clock_sessions AS PERMISSIVE FOR SELECT TO public
  USING (is_team_lead_for_member(( SELECT auth.uid() AS uid), user_id));
CREATE POLICY "Users can read own clock sessions" ON public.clock_sessions AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Devs can update all clock sessions" ON public.clock_sessions AS PERMISSIVE FOR UPDATE TO public
  USING (is_dev())
  WITH CHECK (is_dev());
CREATE POLICY "Team leads can update member clock sessions" ON public.clock_sessions AS PERMISSIVE FOR UPDATE TO public
  USING (is_team_lead_for_member(( SELECT auth.uid() AS uid), user_id))
  WITH CHECK (is_team_lead_for_member(( SELECT auth.uid() AS uid), user_id));
CREATE POLICY "Users and pay access can update clock sessions" ON public.clock_sessions AS PERMISSIVE FOR UPDATE TO public
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR is_pay_approved_master() OR is_assistant_of_pay_approved_master()))
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR is_pay_approved_master() OR is_assistant_of_pay_approved_master()));
CREATE POLICY "Team leads can manage people crew bids for members" ON public.people_crew_bids AS PERMISSIVE FOR ALL TO public
  USING (is_team_lead_for_person_name(person_name))
  WITH CHECK (is_team_lead_for_person_name(person_name));
CREATE POLICY "Pay access users can delete people crew bids" ON public.people_crew_bids AS PERMISSIVE FOR DELETE TO public
  USING ((is_pay_approved_master() OR is_assistant_of_pay_approved_master() OR is_assistant()));
CREATE POLICY "Pay access users can insert people crew bids" ON public.people_crew_bids AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((is_pay_approved_master() OR is_assistant_of_pay_approved_master() OR is_assistant()));
CREATE POLICY "Pay access and shared users can read people crew bids" ON public.people_crew_bids AS PERMISSIVE FOR SELECT TO public
  USING ((is_pay_approved_master() OR is_assistant_of_pay_approved_master() OR is_assistant() OR is_cost_matrix_shared_with_current_user()));
CREATE POLICY "Pay access users can update people crew bids" ON public.people_crew_bids AS PERMISSIVE FOR UPDATE TO public
  USING ((is_pay_approved_master() OR is_assistant_of_pay_approved_master() OR is_assistant()))
  WITH CHECK ((is_pay_approved_master() OR is_assistant_of_pay_approved_master() OR is_assistant()));
CREATE POLICY "Team leads can manage people crew jobs for members" ON public.people_crew_jobs AS PERMISSIVE FOR ALL TO public
  USING (is_team_lead_for_person_name(person_name))
  WITH CHECK (is_team_lead_for_person_name(person_name));
CREATE POLICY "Pay access users can delete people crew jobs" ON public.people_crew_jobs AS PERMISSIVE FOR DELETE TO public
  USING ((is_pay_approved_master() OR is_assistant_of_pay_approved_master() OR is_assistant()));
CREATE POLICY "Pay access users can insert people crew jobs" ON public.people_crew_jobs AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((is_pay_approved_master() OR is_assistant_of_pay_approved_master() OR is_assistant()));
CREATE POLICY "Pay access and shared users can read people crew jobs" ON public.people_crew_jobs AS PERMISSIVE FOR SELECT TO public
  USING ((is_pay_approved_master() OR is_assistant_of_pay_approved_master() OR is_assistant() OR is_cost_matrix_shared_with_current_user()));
CREATE POLICY "Pay access users can update people crew jobs" ON public.people_crew_jobs AS PERMISSIVE FOR UPDATE TO public
  USING ((is_pay_approved_master() OR is_assistant_of_pay_approved_master() OR is_assistant()))
  WITH CHECK ((is_pay_approved_master() OR is_assistant_of_pay_approved_master() OR is_assistant()));
CREATE POLICY "Team leads can delete people hours for members" ON public.people_hours AS PERMISSIVE FOR DELETE TO public
  USING (is_team_lead_for_person_name(person_name));
CREATE POLICY "Pay access users can insert people hours" ON public.people_hours AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((is_pay_approved_master() OR is_assistant_of_pay_approved_master() OR is_assistant()));
CREATE POLICY "Team leads can insert people hours for members" ON public.people_hours AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (is_team_lead_for_person_name(person_name));
CREATE POLICY "Pay access users can read people hours" ON public.people_hours AS PERMISSIVE FOR SELECT TO public
  USING ((is_pay_approved_master() OR is_assistant_of_pay_approved_master() OR is_assistant() OR is_cost_matrix_shared_with_current_user()));
CREATE POLICY "Team leads can read people hours for members" ON public.people_hours AS PERMISSIVE FOR SELECT TO public
  USING (is_team_lead_for_person_name(person_name));
CREATE POLICY "Pay access users can update people hours" ON public.people_hours AS PERMISSIVE FOR UPDATE TO public
  USING ((is_pay_approved_master() OR is_assistant_of_pay_approved_master() OR is_assistant()))
  WITH CHECK ((is_pay_approved_master() OR is_assistant_of_pay_approved_master() OR is_assistant()));
CREATE POLICY "Team leads can update people hours for members" ON public.people_hours AS PERMISSIVE FOR UPDATE TO public
  USING (is_team_lead_for_person_name(person_name))
  WITH CHECK (is_team_lead_for_person_name(person_name));
CREATE POLICY "Superintendent can do all on reports (assigned projects)" ON public.reports AS PERMISSIVE FOR ALL TO public
  USING (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'superintendent'::user_role)))) AND (((project_id IS NOT NULL) AND can_access_project_row(project_id)) OR ((job_ledger_id IS NOT NULL) AND superintendent_report_job_anchor_allowed(job_ledger_id)) OR ((bid_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = reports.bid_id) AND superintendent_can_access_bid(b.*))))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'superintendent'::user_role)))) AND (((project_id IS NOT NULL) AND can_access_project_row(project_id)) OR ((job_ledger_id IS NOT NULL) AND superintendent_report_job_anchor_allowed(job_ledger_id)) OR ((bid_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM bids b
  WHERE ((b.id = reports.bid_id) AND superintendent_can_access_bid(b.*))))))));
CREATE POLICY "Devs can delete reports" ON public.reports AS PERMISSIVE FOR DELETE TO public
  USING (is_dev());
CREATE POLICY "Devs masters assistants can insert reports" ON public.reports AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));
CREATE POLICY "Estimators can insert reports" ON public.reports AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((is_estimator() AND (created_by_user_id = ( SELECT auth.uid() AS uid))));
CREATE POLICY "Primary can insert reports" ON public.reports AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))));
CREATE POLICY "Subcontractors can insert reports" ON public.reports AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth_uid_is_helpers_or_subcontractor() AND (created_by_user_id = ( SELECT auth.uid() AS uid))));
CREATE POLICY "Devs masters assistants can select insert update reports" ON public.reports AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));
CREATE POLICY "Primary can select reports" ON public.reports AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))));
CREATE POLICY "Subcontractors can select own reports within visibility" ON public.reports AS PERMISSIVE FOR SELECT TO public
  USING ((auth_uid_is_helpers_or_subcontractor() AND (created_by_user_id = ( SELECT auth.uid() AS uid)) AND (created_at >= (now() - ((report_sub_visibility_months() || ' months'::text))::interval))));
CREATE POLICY "Devs masters assistants can update reports" ON public.reports AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::user_role, 'master_technician'::user_role, 'assistant'::user_role]))))));
CREATE POLICY "Primary can update reports" ON public.reports AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::user_role)))));
CREATE POLICY "Subcontractors can update own reports within edit window" ON public.reports AS PERMISSIVE FOR UPDATE TO public
  USING ((auth_uid_is_helpers_or_subcontractor() AND (created_by_user_id = ( SELECT auth.uid() AS uid)) AND (created_at >= (now() - ((report_edit_window_days() || ' days'::text))::interval))))
  WITH CHECK ((created_by_user_id = ( SELECT auth.uid() AS uid)));
