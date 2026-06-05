-- Wrap no-argument STABLE SECURITY DEFINER helper calls in `(select fn())` inside the RLS
-- policies on the 5 hot Realtime tables, so Postgres evaluates each helper ONCE per query
-- (as an InitPlan) instead of once per row. Each helper (is_dev, is_pay_approved_master,
-- is_assistant_of_pay_approved_master, is_assistant, is_estimator,
-- is_cost_matrix_shared_with_current_user, auth_uid_is_helpers_or_subcontractor,
-- report_sub_visibility_months, report_edit_window_days) does a table lookup, so on these
-- 1k-1.3k-row tables this removes up to N-1 redundant lookups per scan.
--
-- Follow-up to 20260605202851 (policy consolidation). Same InitPlan technique Supabase
-- already applied to auth.uid(). SEMANTICS UNCHANGED: `(select fn())` returns the same
-- scalar as `fn()` (all wrapped helpers are no-arg and constant per query).
--
-- Row-argument helpers are deliberately NOT wrapped (their result varies per row):
--   is_team_lead_for_person_name(person_name), is_team_lead_for_member(..., user_id),
--   can_access_project_row(project_id), superintendent_report_job_anchor_allowed(job_ledger_id),
--   superintendent_can_access_bid(b.*).
-- Idempotent: DROP ... IF EXISTS before each CREATE.

-- ============================ clock_sessions ============================
DROP POLICY IF EXISTS "Pay access can delete clock sessions" ON public.clock_sessions;
CREATE POLICY "Pay access can delete clock sessions" ON public.clock_sessions FOR DELETE TO public
USING ( (select public.is_pay_approved_master()) );

DROP POLICY IF EXISTS "clock_sessions select access" ON public.clock_sessions;
CREATE POLICY "clock_sessions select access" ON public.clock_sessions FOR SELECT TO public
USING (
  (select public.is_dev())
  OR ((select public.is_pay_approved_master()) OR (select public.is_assistant_of_pay_approved_master()))
  OR public.is_team_lead_for_member((select auth.uid()), user_id)
  OR (user_id = (select auth.uid()))
);

DROP POLICY IF EXISTS "clock_sessions insert access" ON public.clock_sessions;
CREATE POLICY "clock_sessions insert access" ON public.clock_sessions FOR INSERT TO public
WITH CHECK (
  (((select public.is_pay_approved_master()) OR (select public.is_assistant_of_pay_approved_master()) OR (select public.is_assistant())) AND (origin = 'user_punch'::text))
  OR ((user_id = (select auth.uid())) AND (origin = 'user_punch'::text))
);

DROP POLICY IF EXISTS "clock_sessions update access" ON public.clock_sessions;
CREATE POLICY "clock_sessions update access" ON public.clock_sessions FOR UPDATE TO public
USING (
  (select public.is_dev())
  OR public.is_team_lead_for_member((select auth.uid()), user_id)
  OR ((user_id = (select auth.uid())) OR (select public.is_pay_approved_master()) OR (select public.is_assistant_of_pay_approved_master()))
)
WITH CHECK (
  (select public.is_dev())
  OR public.is_team_lead_for_member((select auth.uid()), user_id)
  OR ((user_id = (select auth.uid())) OR (select public.is_pay_approved_master()) OR (select public.is_assistant_of_pay_approved_master()))
);

-- ============================ people_crew_bids ============================
DROP POLICY IF EXISTS "people_crew_bids select access" ON public.people_crew_bids;
CREATE POLICY "people_crew_bids select access" ON public.people_crew_bids FOR SELECT TO public
USING (
  ((select public.is_pay_approved_master()) OR (select public.is_assistant_of_pay_approved_master()) OR (select public.is_assistant()) OR (select public.is_cost_matrix_shared_with_current_user()))
  OR public.is_team_lead_for_person_name(person_name)
);
DROP POLICY IF EXISTS "people_crew_bids insert access" ON public.people_crew_bids;
CREATE POLICY "people_crew_bids insert access" ON public.people_crew_bids FOR INSERT TO public
WITH CHECK (
  ((select public.is_pay_approved_master()) OR (select public.is_assistant_of_pay_approved_master()) OR (select public.is_assistant()))
  OR public.is_team_lead_for_person_name(person_name)
);
DROP POLICY IF EXISTS "people_crew_bids update access" ON public.people_crew_bids;
CREATE POLICY "people_crew_bids update access" ON public.people_crew_bids FOR UPDATE TO public
USING (
  ((select public.is_pay_approved_master()) OR (select public.is_assistant_of_pay_approved_master()) OR (select public.is_assistant()))
  OR public.is_team_lead_for_person_name(person_name)
)
WITH CHECK (
  ((select public.is_pay_approved_master()) OR (select public.is_assistant_of_pay_approved_master()) OR (select public.is_assistant()))
  OR public.is_team_lead_for_person_name(person_name)
);
DROP POLICY IF EXISTS "people_crew_bids delete access" ON public.people_crew_bids;
CREATE POLICY "people_crew_bids delete access" ON public.people_crew_bids FOR DELETE TO public
USING (
  ((select public.is_pay_approved_master()) OR (select public.is_assistant_of_pay_approved_master()) OR (select public.is_assistant()))
  OR public.is_team_lead_for_person_name(person_name)
);

-- ============================ people_crew_jobs ============================
DROP POLICY IF EXISTS "people_crew_jobs select access" ON public.people_crew_jobs;
CREATE POLICY "people_crew_jobs select access" ON public.people_crew_jobs FOR SELECT TO public
USING (
  ((select public.is_pay_approved_master()) OR (select public.is_assistant_of_pay_approved_master()) OR (select public.is_assistant()) OR (select public.is_cost_matrix_shared_with_current_user()))
  OR public.is_team_lead_for_person_name(person_name)
);
DROP POLICY IF EXISTS "people_crew_jobs insert access" ON public.people_crew_jobs;
CREATE POLICY "people_crew_jobs insert access" ON public.people_crew_jobs FOR INSERT TO public
WITH CHECK (
  ((select public.is_pay_approved_master()) OR (select public.is_assistant_of_pay_approved_master()) OR (select public.is_assistant()))
  OR public.is_team_lead_for_person_name(person_name)
);
DROP POLICY IF EXISTS "people_crew_jobs update access" ON public.people_crew_jobs;
CREATE POLICY "people_crew_jobs update access" ON public.people_crew_jobs FOR UPDATE TO public
USING (
  ((select public.is_pay_approved_master()) OR (select public.is_assistant_of_pay_approved_master()) OR (select public.is_assistant()))
  OR public.is_team_lead_for_person_name(person_name)
)
WITH CHECK (
  ((select public.is_pay_approved_master()) OR (select public.is_assistant_of_pay_approved_master()) OR (select public.is_assistant()))
  OR public.is_team_lead_for_person_name(person_name)
);
DROP POLICY IF EXISTS "people_crew_jobs delete access" ON public.people_crew_jobs;
CREATE POLICY "people_crew_jobs delete access" ON public.people_crew_jobs FOR DELETE TO public
USING (
  ((select public.is_pay_approved_master()) OR (select public.is_assistant_of_pay_approved_master()) OR (select public.is_assistant()))
  OR public.is_team_lead_for_person_name(person_name)
);

-- ============================ people_hours ============================
-- (DELETE "Team leads can delete people hours for members" uses only the row-arg helper; left as-is.)
DROP POLICY IF EXISTS "people_hours select access" ON public.people_hours;
CREATE POLICY "people_hours select access" ON public.people_hours FOR SELECT TO public
USING (
  ((select public.is_pay_approved_master()) OR (select public.is_assistant_of_pay_approved_master()) OR (select public.is_assistant()) OR (select public.is_cost_matrix_shared_with_current_user()))
  OR public.is_team_lead_for_person_name(person_name)
);
DROP POLICY IF EXISTS "people_hours insert access" ON public.people_hours;
CREATE POLICY "people_hours insert access" ON public.people_hours FOR INSERT TO public
WITH CHECK (
  ((select public.is_pay_approved_master()) OR (select public.is_assistant_of_pay_approved_master()) OR (select public.is_assistant()))
  OR public.is_team_lead_for_person_name(person_name)
);
DROP POLICY IF EXISTS "people_hours update access" ON public.people_hours;
CREATE POLICY "people_hours update access" ON public.people_hours FOR UPDATE TO public
USING (
  ((select public.is_pay_approved_master()) OR (select public.is_assistant_of_pay_approved_master()) OR (select public.is_assistant()))
  OR public.is_team_lead_for_person_name(person_name)
)
WITH CHECK (
  ((select public.is_pay_approved_master()) OR (select public.is_assistant_of_pay_approved_master()) OR (select public.is_assistant()))
  OR public.is_team_lead_for_person_name(person_name)
);

-- ============================ reports ============================
-- Wraps is_dev, is_estimator, auth_uid_is_helpers_or_subcontractor, report_sub_visibility_months,
-- report_edit_window_days. The role EXISTS(...) subqueries already carry (select auth.uid())
-- and the anchor checks take row columns, so both are left unchanged.
DROP POLICY IF EXISTS "reports select access" ON public.reports;
CREATE POLICY "reports select access" ON public.reports FOR SELECT TO public
USING (
  (EXISTS ( SELECT 1 FROM public.users WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role])))))
  OR (EXISTS ( SELECT 1 FROM public.users WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::public.user_role))))
  OR ((select public.auth_uid_is_helpers_or_subcontractor()) AND (created_by_user_id = (select auth.uid())) AND (created_at >= (now() - (((select public.report_sub_visibility_months()) || ' months'::text))::interval)))
  OR ((EXISTS ( SELECT 1 FROM public.users WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::public.user_role)))) AND (((project_id IS NOT NULL) AND public.can_access_project_row(project_id)) OR ((job_ledger_id IS NOT NULL) AND public.superintendent_report_job_anchor_allowed(job_ledger_id)) OR ((bid_id IS NOT NULL) AND (EXISTS ( SELECT 1 FROM public.bids b WHERE ((b.id = reports.bid_id) AND public.superintendent_can_access_bid(b.*)))))))
);
DROP POLICY IF EXISTS "reports insert access" ON public.reports;
CREATE POLICY "reports insert access" ON public.reports FOR INSERT TO public
WITH CHECK (
  (EXISTS ( SELECT 1 FROM public.users WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role])))))
  OR ((select public.is_estimator()) AND (created_by_user_id = (select auth.uid())))
  OR (EXISTS ( SELECT 1 FROM public.users WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::public.user_role))))
  OR ((select public.auth_uid_is_helpers_or_subcontractor()) AND (created_by_user_id = (select auth.uid())))
  OR ((EXISTS ( SELECT 1 FROM public.users WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::public.user_role)))) AND (((project_id IS NOT NULL) AND public.can_access_project_row(project_id)) OR ((job_ledger_id IS NOT NULL) AND public.superintendent_report_job_anchor_allowed(job_ledger_id)) OR ((bid_id IS NOT NULL) AND (EXISTS ( SELECT 1 FROM public.bids b WHERE ((b.id = reports.bid_id) AND public.superintendent_can_access_bid(b.*)))))))
);
DROP POLICY IF EXISTS "reports update access" ON public.reports;
CREATE POLICY "reports update access" ON public.reports FOR UPDATE TO public
USING (
  (EXISTS ( SELECT 1 FROM public.users WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role])))))
  OR (EXISTS ( SELECT 1 FROM public.users WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::public.user_role))))
  OR ((select public.auth_uid_is_helpers_or_subcontractor()) AND (created_by_user_id = (select auth.uid())) AND (created_at >= (now() - (((select public.report_edit_window_days()) || ' days'::text))::interval)))
  OR ((EXISTS ( SELECT 1 FROM public.users WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::public.user_role)))) AND (((project_id IS NOT NULL) AND public.can_access_project_row(project_id)) OR ((job_ledger_id IS NOT NULL) AND public.superintendent_report_job_anchor_allowed(job_ledger_id)) OR ((bid_id IS NOT NULL) AND (EXISTS ( SELECT 1 FROM public.bids b WHERE ((b.id = reports.bid_id) AND public.superintendent_can_access_bid(b.*)))))))
)
WITH CHECK (
  (EXISTS ( SELECT 1 FROM public.users WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role])))))
  OR (EXISTS ( SELECT 1 FROM public.users WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::public.user_role))))
  OR (created_by_user_id = (select auth.uid()))
  OR ((EXISTS ( SELECT 1 FROM public.users WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::public.user_role)))) AND (((project_id IS NOT NULL) AND public.can_access_project_row(project_id)) OR ((job_ledger_id IS NOT NULL) AND public.superintendent_report_job_anchor_allowed(job_ledger_id)) OR ((bid_id IS NOT NULL) AND (EXISTS ( SELECT 1 FROM public.bids b WHERE ((b.id = reports.bid_id) AND public.superintendent_can_access_bid(b.*)))))))
);
DROP POLICY IF EXISTS "reports delete access" ON public.reports;
CREATE POLICY "reports delete access" ON public.reports FOR DELETE TO public
USING (
  (select public.is_dev())
  OR ((EXISTS ( SELECT 1 FROM public.users WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::public.user_role)))) AND (((project_id IS NOT NULL) AND public.can_access_project_row(project_id)) OR ((job_ledger_id IS NOT NULL) AND public.superintendent_report_job_anchor_allowed(job_ledger_id)) OR ((bid_id IS NOT NULL) AND (EXISTS ( SELECT 1 FROM public.bids b WHERE ((b.id = reports.bid_id) AND public.superintendent_can_access_bid(b.*)))))))
);
