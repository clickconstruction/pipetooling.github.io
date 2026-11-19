SET lock_timeout = '3s';

-- Primary scoping, part 5 — REPORTS, asked about a NAMED user (the owner's word of 2026-11-19, part 4:
-- 20261119040000_primary_scope_reports.sql). Part 4 holds a primary to the reports of their own jobs wherever the
-- database knows who is asking. Three senders do not ask as anyone: the field report emails (send-report-email), the
-- digest (recurring-job-report-dispatch and its preview and test send) and the push on a new report
-- (send-report-notification) read with the service role, so no policy reaches them and auth.uid() is null. They need
-- the same rule about a person they name. This file gives it to them, and keeps one statement of it.
--
--   1. primary_user_can_read_job_reports(user, job) and primary_user_can_read_report(user, job, project, bid, author):
--      the rule's body, with the user as an argument. Service role only.
--   2. primary_can_read_job_reports(job) and primary_can_read_report(job, project, bid, author), part 4's two
--      predicates, become one line each: the body above, asked about auth.uid(). Their names, arguments, grants and
--      answers are unchanged, so every policy and list function of part 4 reads through them as before.
--   3. reports_open_to_user(user, report ids): of the reports named, the ones that user reads. Every one for a user
--      who is not a primary; none for no user or a user with no row. Service role only. The senders ask it.
--      reports_open_to_address(address, report ids): the same for an outside address, which is narrowed only when it
--      is a primary's own account address. Service role only.
--
-- One statement, and the two lines that are restated. The report rule lives in (1) and nowhere else: the app's reads
-- and the senders' both end there. Two of its legs come from parts 1 to 3, where they are written for the caller:
-- primary_can_access_job (jobs_ledger.account_manager_user_id = auth.uid()) and primary_can_access_bid (the bid's
-- estimator, account manager or creator = auth.uid()). They cannot be called about a named user, and turning them
-- into wrappers too would add a function call to every row a primary reads through the bid, estimate and job
-- policies of parts 1 to 3, for no change in any answer. So (1) writes those two comparisons out against the named
-- user. The bed holds them together: each bid and job the old predicates pass must open by name as well
-- (supabase/tests/primary_scope_reports/20_scenario.sql, part 5).
--
-- The two functions replaced were made by part 4, one file earlier, and are replaced whole on purpose (their body
-- moves to (1)); the copy checked against was pg_get_functiondef on a bed of the whole schema with part 4 applied.
-- Safe on either side of any deploy: nothing a client calls changes, and the senders treat a missing
-- answer as "hold a primary's mail, send everyone else's" (supabase/functions/_shared/primaryReportScope.ts).
-- No CREATE TABLE. Idempotent: CREATE OR REPLACE, so a second run changes nothing.
-- docs/migrations/20261119060000_primary_reports_named_user.md.

-- ---------- 1 · the rule, about a named user ----------

-- The job's reports are open to that primary: its account manager, or listed as superintendent on the job's project
-- (project_superintendents, or gc_projects.superintendent_user_id).
CREATE OR REPLACE FUNCTION public.primary_user_can_read_job_reports(p_user_id uuid, p_job_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT p_user_id IS NOT NULL
     AND p_job_id IS NOT NULL
     AND EXISTS (
           SELECT 1
           FROM public.jobs_ledger j
           WHERE j.id = p_job_id
             AND (
               -- parts 1 to 3's primary_can_access_job, about the named user
               j.account_manager_user_id = p_user_id
               OR (
                 j.project_id IS NOT NULL
                 AND (
                   EXISTS (SELECT 1 FROM public.project_superintendents ps
                           WHERE ps.project_id = j.project_id AND ps.superintendent_id = p_user_id)
                   OR EXISTS (SELECT 1 FROM public.gc_projects gp
                              WHERE gp.project_id = j.project_id AND gp.superintendent_user_id = p_user_id)
                 )
               )
             )
         );
$$;
COMMENT ON FUNCTION public.primary_user_can_read_job_reports(uuid, uuid) IS
  'Primary scoping, reports, about a named user: that user is the job''s account manager (jobs_ledger.account_manager_user_id, the test primary_can_access_job makes about the caller) or is listed as superintendent on the job''s project (project_superintendents, or gc_projects.superintendent_user_id). The body primary_can_read_job_reports(job) asks about auth.uid(). Service role only.';
REVOKE ALL ON FUNCTION public.primary_user_can_read_job_reports(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.primary_user_can_read_job_reports(uuid, uuid) TO service_role;

-- One report, by its anchors and its author. The job decides when there is one; a report on a project alone asks the
-- project's superintendents; a report on a bid alone asks the bid's people. The author always reads their own.
CREATE OR REPLACE FUNCTION public.primary_user_can_read_report(p_user_id uuid, p_job_ledger_id uuid, p_project_id uuid, p_bid_id uuid, p_created_by uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT p_user_id IS NOT NULL
     AND (
       p_created_by = p_user_id
       OR CASE
            WHEN p_job_ledger_id IS NOT NULL THEN public.primary_user_can_read_job_reports(p_user_id, p_job_ledger_id)
            WHEN p_project_id IS NOT NULL THEN
              EXISTS (SELECT 1 FROM public.project_superintendents ps
                      WHERE ps.project_id = p_project_id AND ps.superintendent_id = p_user_id)
              OR EXISTS (SELECT 1 FROM public.gc_projects gp
                         WHERE gp.project_id = p_project_id AND gp.superintendent_user_id = p_user_id)
            WHEN p_bid_id IS NOT NULL THEN
              -- part 1's primary_can_access_bid, about the named user
              EXISTS (SELECT 1 FROM public.bids b
                      WHERE b.id = p_bid_id
                        AND (b.estimator_id = p_user_id OR b.account_manager_id = p_user_id OR b.created_by = p_user_id))
            ELSE false
          END
     );
$$;
COMMENT ON FUNCTION public.primary_user_can_read_report(uuid, uuid, uuid, uuid, uuid) IS
  'Primary scoping, reports (the owner''s word of 2026-11-19), about a named user: the one statement of the rule. That user wrote the report, or its job is one whose reports they read (primary_user_can_read_job_reports: account manager or listed superintendent), or it sits on a project alone that lists them as superintendent, or on a bid alone that is theirs (estimator, account manager or creator, the test primary_can_access_bid makes about the caller). primary_can_read_report asks it about auth.uid(); reports_open_to_user asks it for the senders. Service role only.';
REVOKE ALL ON FUNCTION public.primary_user_can_read_report(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.primary_user_can_read_report(uuid, uuid, uuid, uuid, uuid) TO service_role;

-- ---------- 2 · part 4's predicates ask the same body about the caller ----------

CREATE OR REPLACE FUNCTION public.primary_can_read_job_reports(p_job_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT public.primary_user_can_read_job_reports((SELECT auth.uid()), p_job_id);
$$;
COMMENT ON FUNCTION public.primary_can_read_job_reports(uuid) IS
  'Primary scoping, reports: the caller is the job''s account manager or is listed as superintendent on the job''s project. primary_user_can_read_job_reports asked about auth.uid().';

CREATE OR REPLACE FUNCTION public.primary_can_read_report(p_job_ledger_id uuid, p_project_id uuid, p_bid_id uuid, p_created_by uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT public.primary_user_can_read_report((SELECT auth.uid()), p_job_ledger_id, p_project_id, p_bid_id, p_created_by);
$$;
COMMENT ON FUNCTION public.primary_can_read_report(uuid, uuid, uuid, uuid) IS
  'Primary scoping, reports (the owner''s word of 2026-11-19): the caller wrote the report, or reads its job''s reports, or is listed on its project, or its bid is theirs. primary_user_can_read_report asked about auth.uid(). Read by primary_scope_reports and the report list functions, each behind NOT is_primary().';

-- ---------- 3 · the senders' question ----------

-- Of the reports named, the ones that user reads in the app. A user who is not a primary reads every one named (their
-- role's own doors are not this function's business: the office picks who a stream goes to). No user, or an id with
-- no users row, reads none. The order of the answer is not the order asked.
CREATE OR REPLACE FUNCTION public.reports_open_to_user(p_user_id uuid, p_report_ids uuid[]) RETURNS uuid[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT CASE
    WHEN p_user_id IS NULL OR p_report_ids IS NULL THEN '{}'::uuid[]
    WHEN NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user_id) THEN '{}'::uuid[]
    WHEN NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user_id AND u.role = 'primary') THEN p_report_ids
    ELSE coalesce((
      SELECT array_agg(r.id)
      FROM public.reports r
      WHERE r.id = ANY (p_report_ids)
        AND public.primary_user_can_read_report(p_user_id, r.job_ledger_id, r.project_id, r.bid_id, r.created_by_user_id)
    ), '{}'::uuid[])
  END;
$$;
COMMENT ON FUNCTION public.reports_open_to_user(uuid, uuid[]) IS
  'Primary scoping, reports, for the senders that read with the service role (send-report-email, the recurring job report digest, send-report-notification): of the report ids given, the ones the named user reads in the app. Every id for a user who is not a primary; for a primary, the ids primary_user_can_read_report passes; none for no user or an id with no users row. Service role only.';
REVOKE ALL ON FUNCTION public.reports_open_to_user(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reports_open_to_user(uuid, uuid[]) TO service_role;

-- The field report stream also takes an outside address (report_email_subscriptions.recipient_email). An address that
-- is a primary's own account address is that primary: My email subscriptions already lists such a subscription as
-- theirs (get_my_email_schedule matches lower(trim(recipient_email)) to the account's email), so typing the address
-- must not send what picking the person would not. Every id for any other address, a customer's or a GC's inbox
-- among them. Were two primaries to share an address, a report must be open to both.
CREATE OR REPLACE FUNCTION public.reports_open_to_address(p_email text, p_report_ids uuid[]) RETURNS uuid[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT CASE
    WHEN p_report_ids IS NULL THEN '{}'::uuid[]
    WHEN NOT EXISTS (SELECT 1 FROM public.users u
                     WHERE u.role = 'primary' AND lower(trim(u.email)) = lower(trim(p_email))) THEN p_report_ids
    ELSE coalesce((
      SELECT array_agg(r.id)
      FROM public.reports r
      WHERE r.id = ANY (p_report_ids)
        AND NOT EXISTS (
              SELECT 1 FROM public.users u
              WHERE u.role = 'primary' AND lower(trim(u.email)) = lower(trim(p_email))
                AND NOT public.primary_user_can_read_report(u.id, r.job_ledger_id, r.project_id, r.bid_id, r.created_by_user_id)
            )
    ), '{}'::uuid[])
  END;
$$;
COMMENT ON FUNCTION public.reports_open_to_address(text, uuid[]) IS
  'Primary scoping, reports, for send-report-email''s outside addresses: of the report ids given, the ones that may go to that address. Every id unless the address is a primary''s own account address (lower(trim(users.email)), the match get_my_email_schedule makes); then the ids primary_user_can_read_report passes for that primary. Service role only.';
REVOKE ALL ON FUNCTION public.reports_open_to_address(text, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reports_open_to_address(text, uuid[]) TO service_role;
