-- Consolidate duplicate PERMISSIVE RLS policies on the 5 hot Realtime tables
-- (clock_sessions, people_crew_bids, people_crew_jobs, people_hours, reports)
-- into a single policy per command.
--
-- WHY: the perf advisor flagged ~108 `multiple_permissive_policies` combos on exactly
-- these high-churn, Realtime-published tables. Each duplicate permissive policy is
-- re-evaluated on every REST query AND every CDC (postgres_changes) row check, which
-- inflated the RLS cost on the hot path behind the 2026-06-05 connection-pool exhaustion.
--
-- SAFE BY CONSTRUCTION: every policy dropped here is PERMISSIVE and TO public, so Postgres
-- already OR-combines them. Each new clause is the verbatim OR of the originals (the
-- `FOR ALL` policies are folded into each of the 4 commands). UPDATE keeps USING and
-- WITH CHECK independent. `auth.uid()` stays `(select ...)`-wrapped (already done in prod).
--
-- The squash baseline (20250101000000) CREATEs the original policies; this forward
-- migration drops them and creates the consolidated set, so a fresh `db reset` ends in the
-- correct state (create -> consolidate). Idempotent: DROP ... IF EXISTS before each CREATE.

-- ============================ clock_sessions ============================
-- (DELETE is left as-is: it already has a single policy.)
DROP POLICY IF EXISTS "Pay access can insert clock sessions" ON public.clock_sessions;
DROP POLICY IF EXISTS "Users can insert own clock sessions" ON public.clock_sessions;
DROP POLICY IF EXISTS "Devs can read all clock sessions" ON public.clock_sessions;
DROP POLICY IF EXISTS "Pay access can read all clock sessions" ON public.clock_sessions;
DROP POLICY IF EXISTS "Team leads can read member clock sessions" ON public.clock_sessions;
DROP POLICY IF EXISTS "Users can read own clock sessions" ON public.clock_sessions;
DROP POLICY IF EXISTS "Devs can update all clock sessions" ON public.clock_sessions;
DROP POLICY IF EXISTS "Team leads can update member clock sessions" ON public.clock_sessions;
DROP POLICY IF EXISTS "Users and pay access can update clock sessions" ON public.clock_sessions;

DROP POLICY IF EXISTS "clock_sessions select access" ON public.clock_sessions;
CREATE POLICY "clock_sessions select access" ON public.clock_sessions FOR SELECT TO public
USING (
  public.is_dev()
  OR (public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master())
  OR public.is_team_lead_for_member((select auth.uid()), user_id)
  OR (user_id = (select auth.uid()))
);

DROP POLICY IF EXISTS "clock_sessions insert access" ON public.clock_sessions;
CREATE POLICY "clock_sessions insert access" ON public.clock_sessions FOR INSERT TO public
WITH CHECK (
  ((public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master() OR public.is_assistant()) AND (origin = 'user_punch'::text))
  OR ((user_id = (select auth.uid())) AND (origin = 'user_punch'::text))
);

DROP POLICY IF EXISTS "clock_sessions update access" ON public.clock_sessions;
CREATE POLICY "clock_sessions update access" ON public.clock_sessions FOR UPDATE TO public
USING (
  public.is_dev()
  OR public.is_team_lead_for_member((select auth.uid()), user_id)
  OR ((user_id = (select auth.uid())) OR public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master())
)
WITH CHECK (
  public.is_dev()
  OR public.is_team_lead_for_member((select auth.uid()), user_id)
  OR ((user_id = (select auth.uid())) OR public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master())
);

-- ============================ people_crew_bids ============================
-- Drops the FOR ALL team-lead policy and folds is_team_lead_for_person_name into all 4 cmds.
DROP POLICY IF EXISTS "Team leads can manage people crew bids for members" ON public.people_crew_bids;
DROP POLICY IF EXISTS "Pay access users can delete people crew bids" ON public.people_crew_bids;
DROP POLICY IF EXISTS "Pay access users can insert people crew bids" ON public.people_crew_bids;
DROP POLICY IF EXISTS "Pay access and shared users can read people crew bids" ON public.people_crew_bids;
DROP POLICY IF EXISTS "Pay access users can update people crew bids" ON public.people_crew_bids;

DROP POLICY IF EXISTS "people_crew_bids select access" ON public.people_crew_bids;
CREATE POLICY "people_crew_bids select access" ON public.people_crew_bids FOR SELECT TO public
USING (
  (public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master() OR public.is_assistant() OR public.is_cost_matrix_shared_with_current_user())
  OR public.is_team_lead_for_person_name(person_name)
);
DROP POLICY IF EXISTS "people_crew_bids insert access" ON public.people_crew_bids;
CREATE POLICY "people_crew_bids insert access" ON public.people_crew_bids FOR INSERT TO public
WITH CHECK (
  (public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master() OR public.is_assistant())
  OR public.is_team_lead_for_person_name(person_name)
);
DROP POLICY IF EXISTS "people_crew_bids update access" ON public.people_crew_bids;
CREATE POLICY "people_crew_bids update access" ON public.people_crew_bids FOR UPDATE TO public
USING (
  (public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master() OR public.is_assistant())
  OR public.is_team_lead_for_person_name(person_name)
)
WITH CHECK (
  (public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master() OR public.is_assistant())
  OR public.is_team_lead_for_person_name(person_name)
);
DROP POLICY IF EXISTS "people_crew_bids delete access" ON public.people_crew_bids;
CREATE POLICY "people_crew_bids delete access" ON public.people_crew_bids FOR DELETE TO public
USING (
  (public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master() OR public.is_assistant())
  OR public.is_team_lead_for_person_name(person_name)
);

-- ============================ people_crew_jobs ============================
-- Identical shape to people_crew_bids.
DROP POLICY IF EXISTS "Team leads can manage people crew jobs for members" ON public.people_crew_jobs;
DROP POLICY IF EXISTS "Pay access users can delete people crew jobs" ON public.people_crew_jobs;
DROP POLICY IF EXISTS "Pay access users can insert people crew jobs" ON public.people_crew_jobs;
DROP POLICY IF EXISTS "Pay access and shared users can read people crew jobs" ON public.people_crew_jobs;
DROP POLICY IF EXISTS "Pay access users can update people crew jobs" ON public.people_crew_jobs;

DROP POLICY IF EXISTS "people_crew_jobs select access" ON public.people_crew_jobs;
CREATE POLICY "people_crew_jobs select access" ON public.people_crew_jobs FOR SELECT TO public
USING (
  (public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master() OR public.is_assistant() OR public.is_cost_matrix_shared_with_current_user())
  OR public.is_team_lead_for_person_name(person_name)
);
DROP POLICY IF EXISTS "people_crew_jobs insert access" ON public.people_crew_jobs;
CREATE POLICY "people_crew_jobs insert access" ON public.people_crew_jobs FOR INSERT TO public
WITH CHECK (
  (public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master() OR public.is_assistant())
  OR public.is_team_lead_for_person_name(person_name)
);
DROP POLICY IF EXISTS "people_crew_jobs update access" ON public.people_crew_jobs;
CREATE POLICY "people_crew_jobs update access" ON public.people_crew_jobs FOR UPDATE TO public
USING (
  (public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master() OR public.is_assistant())
  OR public.is_team_lead_for_person_name(person_name)
)
WITH CHECK (
  (public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master() OR public.is_assistant())
  OR public.is_team_lead_for_person_name(person_name)
);
DROP POLICY IF EXISTS "people_crew_jobs delete access" ON public.people_crew_jobs;
CREATE POLICY "people_crew_jobs delete access" ON public.people_crew_jobs FOR DELETE TO public
USING (
  (public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master() OR public.is_assistant())
  OR public.is_team_lead_for_person_name(person_name)
);

-- ============================ people_hours ============================
-- (DELETE is left as-is: it already has a single team-lead policy.)
DROP POLICY IF EXISTS "Pay access users can insert people hours" ON public.people_hours;
DROP POLICY IF EXISTS "Team leads can insert people hours for members" ON public.people_hours;
DROP POLICY IF EXISTS "Pay access users can read people hours" ON public.people_hours;
DROP POLICY IF EXISTS "Team leads can read people hours for members" ON public.people_hours;
DROP POLICY IF EXISTS "Pay access users can update people hours" ON public.people_hours;
DROP POLICY IF EXISTS "Team leads can update people hours for members" ON public.people_hours;

DROP POLICY IF EXISTS "people_hours select access" ON public.people_hours;
CREATE POLICY "people_hours select access" ON public.people_hours FOR SELECT TO public
USING (
  (public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master() OR public.is_assistant() OR public.is_cost_matrix_shared_with_current_user())
  OR public.is_team_lead_for_person_name(person_name)
);
DROP POLICY IF EXISTS "people_hours insert access" ON public.people_hours;
CREATE POLICY "people_hours insert access" ON public.people_hours FOR INSERT TO public
WITH CHECK (
  (public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master() OR public.is_assistant())
  OR public.is_team_lead_for_person_name(person_name)
);
DROP POLICY IF EXISTS "people_hours update access" ON public.people_hours;
CREATE POLICY "people_hours update access" ON public.people_hours FOR UPDATE TO public
USING (
  (public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master() OR public.is_assistant())
  OR public.is_team_lead_for_person_name(person_name)
)
WITH CHECK (
  (public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master() OR public.is_assistant())
  OR public.is_team_lead_for_person_name(person_name)
);

-- ============================ reports ============================
-- Drops the FOR ALL superintendent policy and folds its predicate into all 4 cmds.
DROP POLICY IF EXISTS "Superintendent can do all on reports (assigned projects)" ON public.reports;
DROP POLICY IF EXISTS "Devs can delete reports" ON public.reports;
DROP POLICY IF EXISTS "Devs masters assistants can insert reports" ON public.reports;
DROP POLICY IF EXISTS "Estimators can insert reports" ON public.reports;
DROP POLICY IF EXISTS "Primary can insert reports" ON public.reports;
DROP POLICY IF EXISTS "Subcontractors can insert reports" ON public.reports;
DROP POLICY IF EXISTS "Devs masters assistants can select insert update reports" ON public.reports;
DROP POLICY IF EXISTS "Primary can select reports" ON public.reports;
DROP POLICY IF EXISTS "Subcontractors can select own reports within visibility" ON public.reports;
DROP POLICY IF EXISTS "Devs masters assistants can update reports" ON public.reports;
DROP POLICY IF EXISTS "Primary can update reports" ON public.reports;
DROP POLICY IF EXISTS "Subcontractors can update own reports within edit window" ON public.reports;

DROP POLICY IF EXISTS "reports select access" ON public.reports;
CREATE POLICY "reports select access" ON public.reports FOR SELECT TO public
USING (
  (EXISTS ( SELECT 1 FROM public.users
    WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role])))))
  OR (EXISTS ( SELECT 1 FROM public.users
    WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::public.user_role))))
  OR (public.auth_uid_is_helpers_or_subcontractor() AND (created_by_user_id = (select auth.uid())) AND (created_at >= (now() - ((public.report_sub_visibility_months() || ' months'::text))::interval)))
  OR ((EXISTS ( SELECT 1 FROM public.users
        WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::public.user_role))))
      AND (((project_id IS NOT NULL) AND public.can_access_project_row(project_id))
        OR ((job_ledger_id IS NOT NULL) AND public.superintendent_report_job_anchor_allowed(job_ledger_id))
        OR ((bid_id IS NOT NULL) AND (EXISTS ( SELECT 1 FROM public.bids b
              WHERE ((b.id = reports.bid_id) AND public.superintendent_can_access_bid(b.*)))))))
);

DROP POLICY IF EXISTS "reports insert access" ON public.reports;
CREATE POLICY "reports insert access" ON public.reports FOR INSERT TO public
WITH CHECK (
  (EXISTS ( SELECT 1 FROM public.users
    WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role])))))
  OR (public.is_estimator() AND (created_by_user_id = (select auth.uid())))
  OR (EXISTS ( SELECT 1 FROM public.users
    WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::public.user_role))))
  OR (public.auth_uid_is_helpers_or_subcontractor() AND (created_by_user_id = (select auth.uid())))
  OR ((EXISTS ( SELECT 1 FROM public.users
        WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::public.user_role))))
      AND (((project_id IS NOT NULL) AND public.can_access_project_row(project_id))
        OR ((job_ledger_id IS NOT NULL) AND public.superintendent_report_job_anchor_allowed(job_ledger_id))
        OR ((bid_id IS NOT NULL) AND (EXISTS ( SELECT 1 FROM public.bids b
              WHERE ((b.id = reports.bid_id) AND public.superintendent_can_access_bid(b.*)))))))
);

DROP POLICY IF EXISTS "reports update access" ON public.reports;
CREATE POLICY "reports update access" ON public.reports FOR UPDATE TO public
USING (
  (EXISTS ( SELECT 1 FROM public.users
    WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role])))))
  OR (EXISTS ( SELECT 1 FROM public.users
    WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::public.user_role))))
  OR (public.auth_uid_is_helpers_or_subcontractor() AND (created_by_user_id = (select auth.uid())) AND (created_at >= (now() - ((public.report_edit_window_days() || ' days'::text))::interval)))
  OR ((EXISTS ( SELECT 1 FROM public.users
        WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::public.user_role))))
      AND (((project_id IS NOT NULL) AND public.can_access_project_row(project_id))
        OR ((job_ledger_id IS NOT NULL) AND public.superintendent_report_job_anchor_allowed(job_ledger_id))
        OR ((bid_id IS NOT NULL) AND (EXISTS ( SELECT 1 FROM public.bids b
              WHERE ((b.id = reports.bid_id) AND public.superintendent_can_access_bid(b.*)))))))
)
WITH CHECK (
  -- NOTE: subcontractor branch is intentionally asymmetric (created_by only, no window/role guard).
  (EXISTS ( SELECT 1 FROM public.users
    WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role])))))
  OR (EXISTS ( SELECT 1 FROM public.users
    WHERE ((users.id = (select auth.uid())) AND (users.role = 'primary'::public.user_role))))
  OR (created_by_user_id = (select auth.uid()))
  OR ((EXISTS ( SELECT 1 FROM public.users
        WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::public.user_role))))
      AND (((project_id IS NOT NULL) AND public.can_access_project_row(project_id))
        OR ((job_ledger_id IS NOT NULL) AND public.superintendent_report_job_anchor_allowed(job_ledger_id))
        OR ((bid_id IS NOT NULL) AND (EXISTS ( SELECT 1 FROM public.bids b
              WHERE ((b.id = reports.bid_id) AND public.superintendent_can_access_bid(b.*)))))))
);

DROP POLICY IF EXISTS "reports delete access" ON public.reports;
CREATE POLICY "reports delete access" ON public.reports FOR DELETE TO public
USING (
  public.is_dev()
  OR ((EXISTS ( SELECT 1 FROM public.users
        WHERE ((users.id = (select auth.uid())) AND (users.role = 'superintendent'::public.user_role))))
      AND (((project_id IS NOT NULL) AND public.can_access_project_row(project_id))
        OR ((job_ledger_id IS NOT NULL) AND public.superintendent_report_job_anchor_allowed(job_ledger_id))
        OR ((bid_id IS NOT NULL) AND (EXISTS ( SELECT 1 FROM public.bids b
              WHERE ((b.id = reports.bid_id) AND public.superintendent_can_access_bid(b.*)))))))
);
