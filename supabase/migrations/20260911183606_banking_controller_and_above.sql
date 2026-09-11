SET lock_timeout = '3s';

-- v2.3305 — Banking is controller and above (dev, master_technician, controller).
--
-- Plain assistants have read the whole bank feed since 2026-04-01 ("banking now
-- useful by assistants"); the controller role (v2.662) was layered on top and
-- nothing ever took Banking back from assistants. The owner's call (2026-09-11):
-- Banking — the page, its Needs You doors and the data only Banking reads — is
-- controller-and-above work.
--
-- What narrows (Banking-only readers): is_banking_staff() itself, the accounting
-- label rules / suggestions, org notes, duplicate dismissals, reconcile runs,
-- debit-card ↔ user links, category tags, nickname EDITS, the Accounting-tab RPCs,
-- the attribution people picker and the debit-card backfill.
--
-- What stays as it is (shared with Jobs, Job Parts Tally, AR and People, which
-- assistants keep): the policies on drag-sort labels + assignments, attributions,
-- job allocations, supply-house invoice links and AR-returned move to
-- is_office_staff() — the identical set they gate on today — so nothing an
-- assistant does on those pages changes. Nickname READS stay office-wide (they
-- name cards on the Tally allocations modal and the Jobs bank-payments modal).
-- The mercury_transactions assistant SELECT policy is deliberately untouched:
-- the Jobs board's bank-deposit matching and job card-charge costs read it.

-- 1) The predicate ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_banking_staff()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_master_or_dev() OR public.is_controller();
$$;

COMMENT ON FUNCTION public.is_banking_staff() IS
  'Banking audience (v2.3305): dev, master_technician, or controller — plain assistants are out. Every Banking-only Mercury policy and Accounting-tab RPC reads this set; the two Banking edge functions (mercury-reconcile, get-mercury-account-balances) mirror it in ALLOWED_ROLES. Shared Mercury tables (drag-sort, attributions, job allocations, supply-house links, AR returned) gate on is_office_staff() instead.';

-- 2) Shared tables keep their audience: re-point to is_office_staff() ---------
-- Same policy names, same verbs, same TO authenticated — only the predicate.
DROP POLICY IF EXISTS "mercury_drag_sort_labels banking staff delete" ON public.mercury_drag_sort_labels;
CREATE POLICY "mercury_drag_sort_labels banking staff delete" ON public.mercury_drag_sort_labels FOR DELETE TO authenticated USING (public.is_office_staff());
DROP POLICY IF EXISTS "mercury_drag_sort_labels banking staff insert" ON public.mercury_drag_sort_labels;
CREATE POLICY "mercury_drag_sort_labels banking staff insert" ON public.mercury_drag_sort_labels FOR INSERT TO authenticated WITH CHECK (public.is_office_staff());
DROP POLICY IF EXISTS "mercury_drag_sort_labels banking staff select" ON public.mercury_drag_sort_labels;
CREATE POLICY "mercury_drag_sort_labels banking staff select" ON public.mercury_drag_sort_labels FOR SELECT TO authenticated USING (public.is_office_staff());
DROP POLICY IF EXISTS "mercury_drag_sort_labels banking staff update" ON public.mercury_drag_sort_labels;
CREATE POLICY "mercury_drag_sort_labels banking staff update" ON public.mercury_drag_sort_labels FOR UPDATE TO authenticated USING (public.is_office_staff()) WITH CHECK (public.is_office_staff());

DROP POLICY IF EXISTS "mercury_transaction_drag_sort_assignments banking staff delete" ON public.mercury_transaction_drag_sort_assignments;
CREATE POLICY "mercury_transaction_drag_sort_assignments banking staff delete" ON public.mercury_transaction_drag_sort_assignments FOR DELETE TO authenticated USING (public.is_office_staff());
DROP POLICY IF EXISTS "mercury_transaction_drag_sort_assignments banking staff insert" ON public.mercury_transaction_drag_sort_assignments;
CREATE POLICY "mercury_transaction_drag_sort_assignments banking staff insert" ON public.mercury_transaction_drag_sort_assignments FOR INSERT TO authenticated WITH CHECK (public.is_office_staff());
DROP POLICY IF EXISTS "mercury_transaction_drag_sort_assignments banking staff select" ON public.mercury_transaction_drag_sort_assignments;
CREATE POLICY "mercury_transaction_drag_sort_assignments banking staff select" ON public.mercury_transaction_drag_sort_assignments FOR SELECT TO authenticated USING (public.is_office_staff());
DROP POLICY IF EXISTS "mercury_transaction_drag_sort_assignments banking staff update" ON public.mercury_transaction_drag_sort_assignments;
CREATE POLICY "mercury_transaction_drag_sort_assignments banking staff update" ON public.mercury_transaction_drag_sort_assignments FOR UPDATE TO authenticated USING (public.is_office_staff()) WITH CHECK (public.is_office_staff());

DROP POLICY IF EXISTS "mercury_transaction_attributions staff delete" ON public.mercury_transaction_attributions;
CREATE POLICY "mercury_transaction_attributions staff delete" ON public.mercury_transaction_attributions FOR DELETE TO authenticated USING (public.is_office_staff());
DROP POLICY IF EXISTS "mercury_transaction_attributions staff insert" ON public.mercury_transaction_attributions;
CREATE POLICY "mercury_transaction_attributions staff insert" ON public.mercury_transaction_attributions FOR INSERT TO authenticated WITH CHECK (public.is_office_staff());
DROP POLICY IF EXISTS "mercury_transaction_attributions staff select" ON public.mercury_transaction_attributions;
CREATE POLICY "mercury_transaction_attributions staff select" ON public.mercury_transaction_attributions FOR SELECT TO authenticated USING (public.is_office_staff());
DROP POLICY IF EXISTS "mercury_transaction_attributions staff update" ON public.mercury_transaction_attributions;
CREATE POLICY "mercury_transaction_attributions staff update" ON public.mercury_transaction_attributions FOR UPDATE TO authenticated USING (public.is_office_staff()) WITH CHECK (public.is_office_staff());

DROP POLICY IF EXISTS "mercury_transaction_job_allocations staff delete" ON public.mercury_transaction_job_allocations;
CREATE POLICY "mercury_transaction_job_allocations staff delete" ON public.mercury_transaction_job_allocations FOR DELETE TO authenticated USING (public.is_office_staff());
DROP POLICY IF EXISTS "mercury_transaction_job_allocations staff insert" ON public.mercury_transaction_job_allocations;
CREATE POLICY "mercury_transaction_job_allocations staff insert" ON public.mercury_transaction_job_allocations FOR INSERT TO authenticated WITH CHECK (public.is_office_staff());
DROP POLICY IF EXISTS "mercury_transaction_job_allocations staff select" ON public.mercury_transaction_job_allocations;
CREATE POLICY "mercury_transaction_job_allocations staff select" ON public.mercury_transaction_job_allocations FOR SELECT TO authenticated USING (public.is_office_staff());
DROP POLICY IF EXISTS "mercury_transaction_job_allocations staff update" ON public.mercury_transaction_job_allocations;
CREATE POLICY "mercury_transaction_job_allocations staff update" ON public.mercury_transaction_job_allocations FOR UPDATE TO authenticated USING (public.is_office_staff()) WITH CHECK (public.is_office_staff());

DROP POLICY IF EXISTS "mtshil staff select" ON public.mercury_transaction_supply_house_invoice_links;
CREATE POLICY "mtshil staff select" ON public.mercury_transaction_supply_house_invoice_links FOR SELECT TO authenticated USING (public.is_office_staff());

DROP POLICY IF EXISTS "mercury_transaction_ar_returned_delete_ar_roles" ON public.mercury_transaction_ar_returned;
CREATE POLICY "mercury_transaction_ar_returned_delete_ar_roles" ON public.mercury_transaction_ar_returned FOR DELETE TO authenticated USING (public.is_office_staff() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'primary'::public.user_role));
DROP POLICY IF EXISTS "mercury_transaction_ar_returned_insert_ar_roles" ON public.mercury_transaction_ar_returned;
CREATE POLICY "mercury_transaction_ar_returned_insert_ar_roles" ON public.mercury_transaction_ar_returned FOR INSERT TO authenticated WITH CHECK (public.is_office_staff() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'primary'::public.user_role));
DROP POLICY IF EXISTS "mercury_transaction_ar_returned_select_ar_roles" ON public.mercury_transaction_ar_returned;
CREATE POLICY "mercury_transaction_ar_returned_select_ar_roles" ON public.mercury_transaction_ar_returned FOR SELECT TO authenticated USING (public.is_office_staff() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'primary'::public.user_role));
DROP POLICY IF EXISTS "mercury_transaction_ar_returned_update_ar_roles" ON public.mercury_transaction_ar_returned;
CREATE POLICY "mercury_transaction_ar_returned_update_ar_roles" ON public.mercury_transaction_ar_returned FOR UPDATE TO authenticated USING (public.is_office_staff() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'primary'::public.user_role)) WITH CHECK (public.is_office_staff() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'primary'::public.user_role));

-- Banking-only tables that already gate on is_banking_staff() need no DDL —
-- the predicate narrowed under them: mercury_accounting_label_rules,
-- mercury_accounting_label_suggestions, mercury_transaction_org_notes,
-- mercury_transaction_duplicate_dismissals, mercury_reconcile_runs,
-- mercury_debit_card_user_links.

-- 3) Nicknames: reads stay office-wide, edits become Banking-only -------------
-- Baseline "assistant" policies gated on is_assistant() (assistant + controller)
-- and master_technician had none at all, though the matrix always listed it.
DROP POLICY IF EXISTS "mercury_account_nicknames assistant select" ON public.mercury_account_nicknames;
DROP POLICY IF EXISTS "mercury_account_nicknames office select" ON public.mercury_account_nicknames;
CREATE POLICY "mercury_account_nicknames office select" ON public.mercury_account_nicknames FOR SELECT TO authenticated USING (public.is_office_staff());

DROP POLICY IF EXISTS "mercury_debit_card_nicknames assistant select" ON public.mercury_debit_card_nicknames;
DROP POLICY IF EXISTS "mercury_debit_card_nicknames assistant insert" ON public.mercury_debit_card_nicknames;
DROP POLICY IF EXISTS "mercury_debit_card_nicknames assistant update" ON public.mercury_debit_card_nicknames;
DROP POLICY IF EXISTS "mercury_debit_card_nicknames assistant delete" ON public.mercury_debit_card_nicknames;
DROP POLICY IF EXISTS "mercury_debit_card_nicknames office select" ON public.mercury_debit_card_nicknames;
CREATE POLICY "mercury_debit_card_nicknames office select" ON public.mercury_debit_card_nicknames FOR SELECT TO authenticated USING (public.is_office_staff());
DROP POLICY IF EXISTS "mercury_debit_card_nicknames banking staff insert" ON public.mercury_debit_card_nicknames;
CREATE POLICY "mercury_debit_card_nicknames banking staff insert" ON public.mercury_debit_card_nicknames FOR INSERT TO authenticated WITH CHECK (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_debit_card_nicknames banking staff update" ON public.mercury_debit_card_nicknames;
CREATE POLICY "mercury_debit_card_nicknames banking staff update" ON public.mercury_debit_card_nicknames FOR UPDATE TO authenticated USING (public.is_banking_staff()) WITH CHECK (public.is_banking_staff());
DROP POLICY IF EXISTS "mercury_debit_card_nicknames banking staff delete" ON public.mercury_debit_card_nicknames;
CREATE POLICY "mercury_debit_card_nicknames banking staff delete" ON public.mercury_debit_card_nicknames FOR DELETE TO authenticated USING (public.is_banking_staff());

-- 4) Category tags: the manage predicate reads the Banking set ---------------
CREATE OR REPLACE FUNCTION public.can_manage_mercury_category_tags()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_banking_staff();
$$;

-- 5) Banking-only RPC bodies --------------------------------------------------
-- The v2.2920 sweep (20260906010000) widened these live definitions by string
-- replacement — the four-role literal below is exactly what it wrote, so the
-- reverse replacement is deterministic. Applied to the live definition
-- (pg_get_functiondef) for the same reason: overloads and long bodies. Loud on
-- drift: a listed function that is missing aborts; one whose body carries no
-- four-role literal is skipped with a NOTICE (already narrowed, or RLS-gated).
-- Not touched — shared with Job Parts Tally / Jobs / the User review window:
-- replace_mercury_transaction_splits, list_users_for_banking_attribution,
-- list_user_mercury_review_window, the *_as_staff / *_for_tally_* helpers.
DO $$
DECLARE
  fn text;
  p record;
  def text;
  new_def text;
  touched integer;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'bulk_insert_accounting_label_suggestions',
    'bulk_approve_accounting_label_suggestions',
    'count_pending_accounting_label_suggestions',
    'auto_approve_pending_accounting_label_suggestions',
    'list_people_with_kind_for_banking_attribution',
    'list_people_for_banking_attribution',
    'backfill_mercury_auto_attributions_for_debit_card',
    'upsert_mercury_org_transaction_note'
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
      new_def := replace(new_def, 'IN (''dev'', ''master_technician'', ''assistant'', ''controller'')',
                                  'IN (''dev'', ''master_technician'', ''controller'')');
      new_def := replace(new_def, 'IN (''dev'',''master_technician'',''assistant'',''controller'')',
                                  'IN (''dev'',''master_technician'',''controller'')');
      new_def := replace(new_def, 'ARRAY[''dev''::public.user_role, ''master_technician''::public.user_role, ''assistant''::public.user_role, ''controller''::public.user_role]',
                                  'ARRAY[''dev''::public.user_role, ''master_technician''::public.user_role, ''controller''::public.user_role]');
      new_def := replace(new_def, 'ARRAY[''dev''::user_role, ''master_technician''::user_role, ''assistant''::user_role, ''controller''::user_role]',
                                  'ARRAY[''dev''::user_role, ''master_technician''::user_role, ''controller''::user_role]');
      IF new_def = def THEN
        RAISE NOTICE 'banking narrow: %(oid %) carries no four-role literal — skipped', fn, p.oid;
        CONTINUE;
      END IF;
      EXECUTE new_def;
      RAISE NOTICE 'banking narrow: %(oid %) drops assistant', fn, p.oid;
    END LOOP;
    IF touched = 0 THEN
      RAISE EXCEPTION 'banking narrow: function public.% not found — the repo and prod have drifted', fn;
    END IF;
  END LOOP;
END $$;
