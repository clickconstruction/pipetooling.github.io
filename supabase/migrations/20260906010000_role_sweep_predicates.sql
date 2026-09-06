SET lock_timeout = '3s';

-- v2.2920 — role sweep: one predicate per audience (journey map Tier-2 #28,
-- cluster C21 "shells admit a role the data refuses" + C24 "robot audiences
-- disagree", plus the RLS gaps the Phase-4 builders verified and left for this
-- sweep: #7 controller jobs_ledger, #32 prospects staff access, #4b
-- create_sheet_for_work_order, B21 J31-N4 primary steps, B15 people_kind_check).
--
-- The shape everywhere: the client gate admits a role through a predicate
-- (`isAssistantLike`, `canAccessBanking`, `canAccessProspectPipeline`, the
-- Users-tab kind picker) while the data layer hard-codes a literal role list
-- that omits it. v2.662 made `is_assistant()` assistant-LIKE (assistant OR
-- controller) and promised every assistant grant "extends to controller
-- automatically" — true only where a policy calls the function. The Banking
-- tables, sixteen Banking RPCs and the whole jobs_ledger family spell the list
-- out, so a controller gets the assistant shell over data that refuses them.
--
-- Sections (each idempotent; re-running is a no-op):
--   1. is_banking_staff()               — the Banking audience, one predicate
--   2. Banking table policies           — 38 policies on 11 tables → the predicate
--   3. Banking RPC bodies               — 16 functions: literal list gains controller
--   4. jobs_ledger family policies      — 24 policies: literal arrays gain controller
--   5. user_has_prospects_staff_access  — controller joins the staff branch
--   6. create_sheet_for_work_order      — superintendent branch scoped as #4b intended
--   7. project_workflow_steps SELECT    — primary branch (adoption/share OR assignee)
--   8. people_kind_check                — 'controller' is a roster kind
-- bid_audits is deliberately NOT touched: its write policy (20260830230000, five
-- roles) is now the single audience source — the client's ROBOT_AUDIT_ROLES
-- mirrors it and the card and door read that one list.
--
-- No CREATE TABLE, so the read-only / twin write-block sweeps are not re-run
-- (their restrictive policies survive DROP/CREATE of the permissive ones).

-- 1) The Banking audience ------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_banking_staff()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_master_or_dev() OR public.is_assistant();
$$;

COMMENT ON FUNCTION public.is_banking_staff() IS
  'Banking audience (v2.2920): dev, master_technician, or assistant-LIKE (assistant, controller — is_assistant() since v2.662). Every Mercury table policy and Banking RPC gate reads this set; the two Banking edge functions (mercury-reconcile, get-mercury-account-balances) mirror it in ALLOWED_ROLES.';

GRANT ALL ON FUNCTION public.is_banking_staff() TO anon;
GRANT ALL ON FUNCTION public.is_banking_staff() TO authenticated;
GRANT ALL ON FUNCTION public.is_banking_staff() TO service_role;

-- 2) Banking table policies ----------------------------------------------------
-- Baseline bodies were all the same EXISTS(users.role = ANY(ARRAY['dev',
-- 'master_technician','assistant'])) — the "six tables" of the finding plus the
-- staff policies on attributions / job allocations / debit-card links, the
-- org-notes, duplicate-dismissal and supply-house-link readers. Same policy
-- names, same verbs, same TO authenticated; only the predicate changes.
-- mercury_transactions / *_nicknames already used is_assistant() (unchanged).
-- mercury_category_tags (20260903192740) already admitted controller (unchanged).

-- mercury_accounting_label_rules
DROP POLICY IF EXISTS "mercury_accounting_label_rules banking staff delete" ON public.mercury_accounting_label_rules;
CREATE POLICY "mercury_accounting_label_rules banking staff delete" ON public.mercury_accounting_label_rules FOR DELETE TO authenticated USING (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_accounting_label_rules banking staff insert" ON public.mercury_accounting_label_rules;
CREATE POLICY "mercury_accounting_label_rules banking staff insert" ON public.mercury_accounting_label_rules FOR INSERT TO authenticated WITH CHECK (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_accounting_label_rules banking staff select" ON public.mercury_accounting_label_rules;
CREATE POLICY "mercury_accounting_label_rules banking staff select" ON public.mercury_accounting_label_rules FOR SELECT TO authenticated USING (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_accounting_label_rules banking staff update" ON public.mercury_accounting_label_rules;
CREATE POLICY "mercury_accounting_label_rules banking staff update" ON public.mercury_accounting_label_rules FOR UPDATE TO authenticated USING (public.is_banking_staff()) WITH CHECK (public.is_banking_staff());

-- mercury_accounting_label_suggestions
DROP POLICY IF EXISTS "mercury_accounting_label_suggestions banking staff delete" ON public.mercury_accounting_label_suggestions;
CREATE POLICY "mercury_accounting_label_suggestions banking staff delete" ON public.mercury_accounting_label_suggestions FOR DELETE TO authenticated USING (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_accounting_label_suggestions banking staff insert" ON public.mercury_accounting_label_suggestions;
CREATE POLICY "mercury_accounting_label_suggestions banking staff insert" ON public.mercury_accounting_label_suggestions FOR INSERT TO authenticated WITH CHECK (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_accounting_label_suggestions banking staff select" ON public.mercury_accounting_label_suggestions;
CREATE POLICY "mercury_accounting_label_suggestions banking staff select" ON public.mercury_accounting_label_suggestions FOR SELECT TO authenticated USING (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_accounting_label_suggestions banking staff update" ON public.mercury_accounting_label_suggestions;
CREATE POLICY "mercury_accounting_label_suggestions banking staff update" ON public.mercury_accounting_label_suggestions FOR UPDATE TO authenticated USING (public.is_banking_staff()) WITH CHECK (public.is_banking_staff());

-- mercury_drag_sort_labels
DROP POLICY IF EXISTS "mercury_drag_sort_labels banking staff delete" ON public.mercury_drag_sort_labels;
CREATE POLICY "mercury_drag_sort_labels banking staff delete" ON public.mercury_drag_sort_labels FOR DELETE TO authenticated USING (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_drag_sort_labels banking staff insert" ON public.mercury_drag_sort_labels;
CREATE POLICY "mercury_drag_sort_labels banking staff insert" ON public.mercury_drag_sort_labels FOR INSERT TO authenticated WITH CHECK (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_drag_sort_labels banking staff select" ON public.mercury_drag_sort_labels;
CREATE POLICY "mercury_drag_sort_labels banking staff select" ON public.mercury_drag_sort_labels FOR SELECT TO authenticated USING (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_drag_sort_labels banking staff update" ON public.mercury_drag_sort_labels;
CREATE POLICY "mercury_drag_sort_labels banking staff update" ON public.mercury_drag_sort_labels FOR UPDATE TO authenticated USING (public.is_banking_staff()) WITH CHECK (public.is_banking_staff());

-- mercury_transaction_drag_sort_assignments
DROP POLICY IF EXISTS "mercury_transaction_drag_sort_assignments banking staff delete" ON public.mercury_transaction_drag_sort_assignments;
CREATE POLICY "mercury_transaction_drag_sort_assignments banking staff delete" ON public.mercury_transaction_drag_sort_assignments FOR DELETE TO authenticated USING (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_transaction_drag_sort_assignments banking staff insert" ON public.mercury_transaction_drag_sort_assignments;
CREATE POLICY "mercury_transaction_drag_sort_assignments banking staff insert" ON public.mercury_transaction_drag_sort_assignments FOR INSERT TO authenticated WITH CHECK (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_transaction_drag_sort_assignments banking staff select" ON public.mercury_transaction_drag_sort_assignments;
CREATE POLICY "mercury_transaction_drag_sort_assignments banking staff select" ON public.mercury_transaction_drag_sort_assignments FOR SELECT TO authenticated USING (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_transaction_drag_sort_assignments banking staff update" ON public.mercury_transaction_drag_sort_assignments;
CREATE POLICY "mercury_transaction_drag_sort_assignments banking staff update" ON public.mercury_transaction_drag_sort_assignments FOR UPDATE TO authenticated USING (public.is_banking_staff()) WITH CHECK (public.is_banking_staff());

-- mercury_debit_card_user_links
DROP POLICY IF EXISTS "mercury_debit_card_user_links staff delete" ON public.mercury_debit_card_user_links;
CREATE POLICY "mercury_debit_card_user_links staff delete" ON public.mercury_debit_card_user_links FOR DELETE TO authenticated USING (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_debit_card_user_links staff insert" ON public.mercury_debit_card_user_links;
CREATE POLICY "mercury_debit_card_user_links staff insert" ON public.mercury_debit_card_user_links FOR INSERT TO authenticated WITH CHECK (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_debit_card_user_links staff select" ON public.mercury_debit_card_user_links;
CREATE POLICY "mercury_debit_card_user_links staff select" ON public.mercury_debit_card_user_links FOR SELECT TO authenticated USING (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_debit_card_user_links staff update" ON public.mercury_debit_card_user_links;
CREATE POLICY "mercury_debit_card_user_links staff update" ON public.mercury_debit_card_user_links FOR UPDATE TO authenticated USING (public.is_banking_staff()) WITH CHECK (public.is_banking_staff());

-- mercury_transaction_attributions
DROP POLICY IF EXISTS "mercury_transaction_attributions staff delete" ON public.mercury_transaction_attributions;
CREATE POLICY "mercury_transaction_attributions staff delete" ON public.mercury_transaction_attributions FOR DELETE TO authenticated USING (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_transaction_attributions staff insert" ON public.mercury_transaction_attributions;
CREATE POLICY "mercury_transaction_attributions staff insert" ON public.mercury_transaction_attributions FOR INSERT TO authenticated WITH CHECK (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_transaction_attributions staff select" ON public.mercury_transaction_attributions;
CREATE POLICY "mercury_transaction_attributions staff select" ON public.mercury_transaction_attributions FOR SELECT TO authenticated USING (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_transaction_attributions staff update" ON public.mercury_transaction_attributions;
CREATE POLICY "mercury_transaction_attributions staff update" ON public.mercury_transaction_attributions FOR UPDATE TO authenticated USING (public.is_banking_staff()) WITH CHECK (public.is_banking_staff());

-- mercury_transaction_job_allocations
DROP POLICY IF EXISTS "mercury_transaction_job_allocations staff delete" ON public.mercury_transaction_job_allocations;
CREATE POLICY "mercury_transaction_job_allocations staff delete" ON public.mercury_transaction_job_allocations FOR DELETE TO authenticated USING (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_transaction_job_allocations staff insert" ON public.mercury_transaction_job_allocations;
CREATE POLICY "mercury_transaction_job_allocations staff insert" ON public.mercury_transaction_job_allocations FOR INSERT TO authenticated WITH CHECK (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_transaction_job_allocations staff select" ON public.mercury_transaction_job_allocations;
CREATE POLICY "mercury_transaction_job_allocations staff select" ON public.mercury_transaction_job_allocations FOR SELECT TO authenticated USING (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_transaction_job_allocations staff update" ON public.mercury_transaction_job_allocations;
CREATE POLICY "mercury_transaction_job_allocations staff update" ON public.mercury_transaction_job_allocations FOR UPDATE TO authenticated USING (public.is_banking_staff()) WITH CHECK (public.is_banking_staff());

-- mercury_transaction_org_notes
DROP POLICY IF EXISTS "mercury_transaction_org_notes_delete_banking" ON public.mercury_transaction_org_notes;
CREATE POLICY "mercury_transaction_org_notes_delete_banking" ON public.mercury_transaction_org_notes FOR DELETE TO authenticated USING (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_transaction_org_notes_insert_banking" ON public.mercury_transaction_org_notes;
CREATE POLICY "mercury_transaction_org_notes_insert_banking" ON public.mercury_transaction_org_notes FOR INSERT TO authenticated WITH CHECK (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_transaction_org_notes_select_banking" ON public.mercury_transaction_org_notes;
CREATE POLICY "mercury_transaction_org_notes_select_banking" ON public.mercury_transaction_org_notes FOR SELECT TO authenticated USING (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_transaction_org_notes_update_banking" ON public.mercury_transaction_org_notes;
CREATE POLICY "mercury_transaction_org_notes_update_banking" ON public.mercury_transaction_org_notes FOR UPDATE TO authenticated USING (public.is_banking_staff()) WITH CHECK (public.is_banking_staff());

-- mercury_transaction_duplicate_dismissals (SELECT only; writes go through the duplicate RPCs)
DROP POLICY IF EXISTS "mercury_dup_dismissals_select_banking" ON public.mercury_transaction_duplicate_dismissals;
CREATE POLICY "mercury_dup_dismissals_select_banking" ON public.mercury_transaction_duplicate_dismissals FOR SELECT TO authenticated USING (public.is_banking_staff());

-- mercury_transaction_supply_house_invoice_links (staff SELECT; the linked-user policy is untouched)
DROP POLICY IF EXISTS "mtshil staff select" ON public.mercury_transaction_supply_house_invoice_links;
CREATE POLICY "mtshil staff select" ON public.mercury_transaction_supply_house_invoice_links FOR SELECT TO authenticated USING (public.is_banking_staff());

-- mercury_transaction_ar_returned — the AR audience is banking staff + primary (was a 4-role literal without controller)
DROP POLICY IF EXISTS "mercury_transaction_ar_returned_delete_ar_roles" ON public.mercury_transaction_ar_returned;
CREATE POLICY "mercury_transaction_ar_returned_delete_ar_roles" ON public.mercury_transaction_ar_returned FOR DELETE TO authenticated USING (public.is_banking_staff() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'primary'::public.user_role));
DROP POLICY IF EXISTS "mercury_transaction_ar_returned_insert_ar_roles" ON public.mercury_transaction_ar_returned;
CREATE POLICY "mercury_transaction_ar_returned_insert_ar_roles" ON public.mercury_transaction_ar_returned FOR INSERT TO authenticated WITH CHECK (public.is_banking_staff() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'primary'::public.user_role));
DROP POLICY IF EXISTS "mercury_transaction_ar_returned_select_ar_roles" ON public.mercury_transaction_ar_returned;
CREATE POLICY "mercury_transaction_ar_returned_select_ar_roles" ON public.mercury_transaction_ar_returned FOR SELECT TO authenticated USING (public.is_banking_staff() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'primary'::public.user_role));
DROP POLICY IF EXISTS "mercury_transaction_ar_returned_update_ar_roles" ON public.mercury_transaction_ar_returned;
CREATE POLICY "mercury_transaction_ar_returned_update_ar_roles" ON public.mercury_transaction_ar_returned FOR UPDATE TO authenticated USING (public.is_banking_staff() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'primary'::public.user_role)) WITH CHECK (public.is_banking_staff() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'primary'::public.user_role));

-- 3) Banking RPC bodies --------------------------------------------------------
-- The SECURITY DEFINER RPCs the Banking shell calls gate on the same literal,
-- `role IN ('dev', 'master_technician', 'assistant')`. Their bodies are long
-- and several exist in overloads, so the transformation is applied to the live
-- definition (pg_get_functiondef) rather than re-typed: every occurrence of the
-- three-role literal gains 'controller' — exactly the is_banking_staff() set.
-- Loud on drift: a listed function that is missing, or that no longer carries
-- the literal AND does not already mention controller, aborts the migration.
-- Not touched: list_mercury_drag_sort_label_assignment_counts (its list already
-- includes primary — a different audience) and the tally-side helpers.

DO $$
DECLARE
  fn text;
  p record;
  def text;
  new_def text;
  touched integer;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'upsert_mercury_org_transaction_note',
    'replace_mercury_transaction_splits',
    'list_users_for_banking_attribution',
    'list_people_for_banking_attribution',
    'list_people_with_kind_for_banking_attribution',
    'replace_mercury_transaction_invoice_links_as_staff',
    'replace_mercury_job_splits_for_linked_card_as_staff',
    'list_supply_house_invoices_for_tally_link',
    'search_jobs_for_tally_mercury_assign_as_user',
    'list_unlabeled_mercury_transactions',
    'list_user_mercury_review_window',
    'backfill_mercury_auto_attributions_for_debit_card',
    'bulk_insert_accounting_label_suggestions',
    'bulk_approve_accounting_label_suggestions',
    'count_pending_accounting_label_suggestions',
    'auto_approve_pending_accounting_label_suggestions'
  ] LOOP
    touched := 0;
    FOR p IN
      SELECT pr.oid
      FROM pg_proc pr
      JOIN pg_namespace ns ON ns.oid = pr.pronamespace
      WHERE ns.nspname = 'public' AND pr.proname = fn
    LOOP
      touched := touched + 1;
      def := pg_get_functiondef(p.oid);
      new_def := def;
      new_def := replace(new_def, 'IN (''dev'', ''master_technician'', ''assistant'')',
                                  'IN (''dev'', ''master_technician'', ''assistant'', ''controller'')');
      new_def := replace(new_def, 'IN (''dev'',''master_technician'',''assistant'')',
                                  'IN (''dev'',''master_technician'',''assistant'',''controller'')');
      new_def := replace(new_def, 'ARRAY[''dev''::public.user_role, ''master_technician''::public.user_role, ''assistant''::public.user_role]',
                                  'ARRAY[''dev''::public.user_role, ''master_technician''::public.user_role, ''assistant''::public.user_role, ''controller''::public.user_role]');
      new_def := replace(new_def, 'ARRAY[''dev''::user_role, ''master_technician''::user_role, ''assistant''::user_role]',
                                  'ARRAY[''dev''::user_role, ''master_technician''::user_role, ''assistant''::user_role, ''controller''::user_role]');
      IF new_def = def THEN
        IF def LIKE '%controller%' THEN
          RAISE NOTICE 'role sweep: %(oid %) already admits controller — skipped', fn, p.oid;
          CONTINUE;
        END IF;
        -- No role literal at all: the function is gated by RLS on the tables it reads
        -- (e.g. list_unlabeled_mercury_transactions is a plain SECURITY INVOKER sql fn),
        -- so there is nothing to widen. Skip loudly instead of aborting the sweep
        -- (2026-09-06: the first prod push aborted here).
        RAISE NOTICE 'role sweep: %(oid %) carries no role literal — RLS-gated, skipped', fn, p.oid;
        CONTINUE;
      END IF;
      EXECUTE new_def;
      RAISE NOTICE 'role sweep: %(oid %) gains controller', fn, p.oid;
    END LOOP;
    IF touched = 0 THEN
      RAISE EXCEPTION 'role sweep: function public.% not found — the repo and prod have drifted', fn;
    END IF;
  END LOOP;
END $$;

-- 4) jobs_ledger family policies ----------------------------------------------
-- #7 (v2.2848) verified: the baseline SELECT / INSERT / UPDATE / DELETE policies
-- on jobs_ledger and its children gate on literal arrays ('dev','master_technician',
-- 'assistant'[,'primary']) plus an inner adoption arm (master_assistants,
-- assistants_share_master — both role-agnostic, so they already cover an adopted
-- controller). A controller therefore failed the outer array and every job door
-- fell back to the read-only pane. Same rewrite v2.662 used on the users policy
-- (20260714213000): read the live policy text, add controller beside assistant,
-- DROP + CREATE with the same name / verb / permissive flag / roles. Two forms:
--   role = ANY (ARRAY[..., 'assistant'::user_role, ...])   → array gains controller
--   role = 'assistant'::user_role                          → ANY (ARRAY[assistant, controller])
-- Policies already naming controller, or naming no assistant literal (the sub /
-- team-lead / clock-session readers, the primary_scope_* restrictive fences,
-- the superintendent thread-note grants), are left alone.

DO $$
DECLARE
  pol record;
  new_qual text;
  new_check text;
  sql text;
  role_clause text;
  n integer := 0;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('jobs_ledger', 'jobs_ledger_fixtures', 'jobs_ledger_team_members',
                        'jobs_ledger_invoices', 'jobs_ledger_materials', 'jobs_ledger_payments',
                        'jobs_ledger_invoice_stripe_email_sends')
      AND (coalesce(qual, '') LIKE '%''assistant''::%user_role%'
           OR coalesce(with_check, '') LIKE '%''assistant''::%user_role%')
      AND coalesce(qual, '') NOT LIKE '%controller%'
      AND coalesce(with_check, '') NOT LIKE '%controller%'
    ORDER BY tablename, policyname
  LOOP
    new_qual := pol.qual;
    new_check := pol.with_check;

    -- equality form first (so the array form below does not double-add)
    new_qual  := replace(new_qual,  '= ''assistant''::user_role)',        '= ANY (ARRAY[''assistant''::user_role, ''controller''::user_role]))');
    new_qual  := replace(new_qual,  '= ''assistant''::public.user_role)', '= ANY (ARRAY[''assistant''::public.user_role, ''controller''::public.user_role]))');
    new_check := replace(new_check, '= ''assistant''::user_role)',        '= ANY (ARRAY[''assistant''::user_role, ''controller''::user_role]))');
    new_check := replace(new_check, '= ''assistant''::public.user_role)', '= ANY (ARRAY[''assistant''::public.user_role, ''controller''::public.user_role]))');
    -- array-member form
    new_qual  := replace(new_qual,  '''master_technician''::user_role, ''assistant''::user_role',
                                    '''master_technician''::user_role, ''assistant''::user_role, ''controller''::user_role');
    new_qual  := replace(new_qual,  '''master_technician''::public.user_role, ''assistant''::public.user_role',
                                    '''master_technician''::public.user_role, ''assistant''::public.user_role, ''controller''::public.user_role');
    new_check := replace(new_check, '''master_technician''::user_role, ''assistant''::user_role',
                                    '''master_technician''::user_role, ''assistant''::user_role, ''controller''::user_role');
    new_check := replace(new_check, '''master_technician''::public.user_role, ''assistant''::public.user_role',
                                    '''master_technician''::public.user_role, ''assistant''::public.user_role, ''controller''::public.user_role');

    IF new_qual IS NOT DISTINCT FROM pol.qual AND new_check IS NOT DISTINCT FROM pol.with_check THEN
      RAISE EXCEPTION 'role sweep: policy % on % carries an assistant literal in an unrecognised form — review manually', pol.policyname, pol.tablename;
    END IF;

    role_clause := '';
    IF pol.roles IS NOT NULL AND pol.roles <> '{public}'::name[] THEN
      role_clause := ' TO ' || (SELECT string_agg(quote_ident(r.rolname), ', ') FROM unnest(pol.roles) AS r(rolname));
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    sql := format('CREATE POLICY %I ON public.%I AS %s FOR %s%s',
                  pol.policyname, pol.tablename, pol.permissive, pol.cmd, role_clause);
    IF new_qual IS NOT NULL THEN
      sql := sql || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL THEN
      sql := sql || format(' WITH CHECK (%s)', new_check);
    END IF;
    EXECUTE sql;
    n := n + 1;
    RAISE NOTICE 'role sweep: % on % gains controller', pol.policyname, pol.tablename;
  END LOOP;
  RAISE NOTICE 'role sweep: % jobs_ledger-family policies rewritten (0 on a re-run is expected)', n;
END $$;

-- 5) Prospects staff access ----------------------------------------------------
-- #32 verified: canAccessProspectPipeline (client) admits controller; this
-- function — every prospects-family policy's gate — did not. ACCESS_CONTROL's
-- intent is "staff (dev / master_technician / assistant / controller) or an
-- estimator with estimator_prospects_access", so the function widens.

CREATE OR REPLACE FUNCTION public.user_has_prospects_staff_access()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND (
        u.role IN ('dev', 'master_technician', 'assistant', 'controller')
        OR (u.role = 'estimator' AND COALESCE(u.estimator_prospects_access, false))
      )
  );
$$;

COMMENT ON FUNCTION public.user_has_prospects_staff_access() IS
  'True for dev/master/assistant/controller (assistant-LIKE since v2.2920 — matches the client canAccessProspectPipeline), or estimator with estimator_prospects_access. Used by Prospects-related RLS.';

-- 6) create_sheet_for_work_order — the superintendent branch ------------------
-- #4b (20260905120000) scoped a superintendent's sub work orders to their own
-- jobs (superintendent_can_access_sub_work_order) but left this RPC admitting
-- `superintendent` by role literal with no row gate: a superintendent who knew
-- a commitment id could trigger sheet creation for an accepted order off their
-- jobs. Same body as 20260905063000, with the role gate split: office roles and
-- the service role pass up front; a superintendent passes only once the row is
-- loaded and superintendent_can_access_sub_work_order(labor_job_id, job_id)
-- says the job is theirs. Anyone else is still refused before the row is read.

CREATE OR REPLACE FUNCTION public.create_sheet_for_work_order(p_commitment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c public.step_commitments%ROWTYPE;
  v_job public.jobs_ledger%ROWTYPE;
  v_sheet_id uuid;
  v_is_service boolean;
  v_role text;
BEGIN
  v_is_service :=
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR coalesce(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role';
  IF NOT v_is_service THEN
    SELECT u.role INTO v_role FROM public.users u WHERE u.id = auth.uid();
    IF v_role IS NULL OR v_role NOT IN ('dev','master_technician','assistant','controller','estimator','superintendent') THEN
      RETURN jsonb_build_object('error', 'Not authorized');
    END IF;
  END IF;

  SELECT * INTO v_c FROM public.step_commitments WHERE id = p_commitment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Work order not found');
  END IF;

  -- Superintendents: only a work order on a job that is theirs (v2.2844 rule).
  IF NOT v_is_service AND v_role = 'superintendent'
     AND NOT public.superintendent_can_access_sub_work_order(v_c.labor_job_id, v_c.job_id) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  IF v_c.labor_job_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'labor_job_id', v_c.labor_job_id, 'created', false);
  END IF;
  IF v_c.job_id IS NULL THEN
    RETURN jsonb_build_object('error', 'This work order has no job to create a sheet on');
  END IF;
  IF v_c.status NOT IN ('accepted', 'approved', 'settled') THEN
    RETURN jsonb_build_object('error', 'The work order is not accepted yet');
  END IF;
  IF v_c.amount IS NULL THEN
    RETURN jsonb_build_object('error', 'The work order has no amount');
  END IF;

  SELECT * INTO v_job FROM public.jobs_ledger WHERE id = v_c.job_id;

  INSERT INTO public.people_labor_jobs
    (master_user_id, assigned_to_name, address, job_number, labor_rate, job_date, distance_miles, project_id, step_id)
  VALUES (
    coalesce(v_job.master_user_id, v_c.created_by, auth.uid()),
    v_c.display_name,
    coalesce(v_job.job_address, ''),
    NULLIF(btrim(v_job.hcp_number), ''),
    0,
    public.app_today(),
    0,
    v_job.project_id,
    v_c.step_id
  )
  RETURNING id INTO v_sheet_id;

  INSERT INTO public.people_labor_job_items
    (job_id, fixture, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount, sequence_order)
  VALUES (
    v_sheet_id,
    left(coalesce(v_c.record_id, 'Work order') || ' — ' || coalesce(NULLIF(btrim(v_job.hcp_number), ''), '') || ' ' || coalesce(v_job.job_address, ''), 200),
    1, 0, true, NULL, v_c.amount, 1
  );

  INSERT INTO public.people_labor_job_assignees (labor_job_id, person_id)
  VALUES (v_sheet_id, v_c.person_id)
  ON CONFLICT DO NOTHING;

  UPDATE public.step_commitments SET labor_job_id = v_sheet_id WHERE id = p_commitment_id;

  RETURN jsonb_build_object('ok', true, 'labor_job_id', v_sheet_id, 'created', true);
END;
$$;

COMMENT ON FUNCTION public.create_sheet_for_work_order(uuid) IS
  'Creates the Sub Labor sheet for an accepted job-anchored work order and links labor_job_id (v2.2819). Callers: the service role (submit-sub-portal after a sub signs), office roles (dev/master_technician/assistant/controller/estimator), and a superintendent only for a work order on a job that is theirs — superintendent_can_access_sub_work_order, the v2.2844 rule (v2.2920).';

-- 7) project_workflow_steps SELECT — the primary branch ------------------------
-- J31-N4 (B21 verified): the last CREATE POLICY on this table
-- (20260817012110:231-245) has dev / master / assistant / superintendent /
-- sub-like-assignee branches and no primary branch, so a primary assigned to a
-- step read zero steps — Dashboard "Assigned Stages" (get_assigned_steps_for_dashboard
-- runs under RLS) was always empty for them. #4's 20260905100000 rewrote
-- can_access_project_via_step (adoption via master_primaries, shared master) but
-- not this policy. The new branch mirrors it AND admits the step's assignee, the
-- same identity rule the sub-like branch uses. Every other branch is verbatim.
-- The /workflow route stays off PRIMARY_PATHS (v2.2836) — a nav decision, not
-- a data one.

DROP POLICY IF EXISTS "Users can see steps for workflows they have access to" ON public.project_workflow_steps;
CREATE POLICY "Users can see steps for workflows they have access to" ON public.project_workflow_steps FOR SELECT USING (
  public.is_dev()
  OR (EXISTS ( SELECT 1 FROM public.users
       WHERE users.id = ( SELECT auth.uid() ) AND users.role = 'master_technician'::public.user_role))
  OR ((EXISTS ( SELECT 1 FROM public.users
       WHERE users.id = ( SELECT auth.uid() ) AND users.role = 'assistant'::public.user_role))
      AND public.can_access_project_via_workflow(workflow_id))
  OR ((EXISTS ( SELECT 1 FROM public.users
       WHERE users.id = ( SELECT auth.uid() ) AND users.role = 'superintendent'::public.user_role))
      AND public.can_access_project_via_workflow(workflow_id))
  OR ((EXISTS ( SELECT 1 FROM public.users
       WHERE users.id = ( SELECT auth.uid() ) AND users.role = 'primary'::public.user_role))
      AND (public.can_access_project_via_step(id)
           OR public.step_assignee_matches_user(assigned_person_id, assigned_to_name, ( SELECT auth.uid() ))))
  OR ((EXISTS ( SELECT 1 FROM public.users
       WHERE users.id = ( SELECT auth.uid() )
         AND users.role = ANY (ARRAY['helpers'::public.user_role, 'subcontractor'::public.user_role])))
      AND public.step_assignee_matches_user(assigned_person_id, assigned_to_name, ( SELECT auth.uid() )))
);

-- 8) people_kind_check — controller is a roster kind ---------------------------
-- B15 verified: PersonKind and the People → Users kind picker offer
-- 'controller'; the CHECK refused it. people is a small table, so the
-- re-validation scan is brief (lock_timeout above still bounds the wait).

ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_kind_check;
ALTER TABLE public.people ADD CONSTRAINT people_kind_check
  CHECK (kind = ANY (ARRAY['assistant'::text, 'master_technician'::text, 'sub'::text, 'dev'::text, 'estimator'::text, 'primary'::text, 'superintendent'::text, 'helper'::text, 'controller'::text]));

COMMENT ON CONSTRAINT people_kind_check ON public.people IS
  'Roster kind; primary/superintendent/controller align with users.role; helper aligns with helpers role users.';
