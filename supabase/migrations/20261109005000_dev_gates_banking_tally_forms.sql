SET lock_timeout = '3s';

-- Punch list #188 (the dev gates), PR 8, v2.6761: the controller's doors on Banking, the Contract library and Tally, rows
-- 51 to 54, 60 and 62 of the audit table, every recommendation taken as written by the owner on 2026-11-08. Stripe,
-- the raw ledger, the account names, the manual accounts, the forms people sign and what counts as payroll are the
-- books', so the controller holds them with a dev. The database side of the doors that read or write rows only a dev
-- could:
--   row 51  Banking → Stripe — stripe_webhook_events read by the controller (the invoices she reads already).
--   row 53  Banking → Account nicknames — mercury_account_nicknames inserted and updated by the controller.
--   row 54  Accounting → the two switches — the two seeded keys' UPDATE, the controller beside the owner and the dev;
--           Import CSV and Manual accounts are edge functions, redeployed with the PR.
--   row 60  Contract library → Forms — contract_form_templates insert, update and delete, and contract_form_pdf_opens
--           read, by the controller.
--   row 62  Tally → Payroll rules — mercury_tally_payroll_rules whole, and bulk_apply_tally_payroll_rule_flags, the
--           controller with a dev; marking a transaction payroll stays payroll access (20260906130000).
-- Row 52 (the Ledger and its configuration) reads mercury_transactions, which the controller reads already. Additive
-- and idempotent: no table is created, so no fence call is owed.

-- 1) Stripe (row 51)
DROP POLICY IF EXISTS stripe_webhook_events_controller_select ON public.stripe_webhook_events;
CREATE POLICY stripe_webhook_events_controller_select ON public.stripe_webhook_events FOR SELECT TO authenticated USING (public.is_controller());

-- 2) Account nicknames (row 53)
DROP POLICY IF EXISTS mercury_account_nicknames_controller_insert ON public.mercury_account_nicknames;
CREATE POLICY mercury_account_nicknames_controller_insert ON public.mercury_account_nicknames FOR INSERT TO authenticated WITH CHECK (public.is_controller());
DROP POLICY IF EXISTS mercury_account_nicknames_controller_update ON public.mercury_account_nicknames;
CREATE POLICY mercury_account_nicknames_controller_update ON public.mercury_account_nicknames FOR UPDATE TO authenticated USING (public.is_controller()) WITH CHECK (public.is_controller());

-- 3) The Accounting switches (row 54): the rows are seeded, so UPDATE alone.
DROP POLICY IF EXISTS controller_update_accounting_switches ON public.app_settings;
CREATE POLICY controller_update_accounting_switches ON public.app_settings FOR UPDATE TO authenticated
  USING (key IN ('accounting_label_auto_approve_rule_matches', 'ar_applied_deposits_count_as_income') AND public.is_controller())
  WITH CHECK (key IN ('accounting_label_auto_approve_rule_matches', 'ar_applied_deposits_count_as_income') AND public.is_controller());

-- 4) Forms (row 60)
DROP POLICY IF EXISTS "Controller inserts contract form templates" ON public.contract_form_templates;
CREATE POLICY "Controller inserts contract form templates" ON public.contract_form_templates FOR INSERT WITH CHECK (public.is_controller());
DROP POLICY IF EXISTS "Controller updates contract form templates" ON public.contract_form_templates;
CREATE POLICY "Controller updates contract form templates" ON public.contract_form_templates FOR UPDATE USING (public.is_controller()) WITH CHECK (public.is_controller());
DROP POLICY IF EXISTS "Controller deletes contract form templates" ON public.contract_form_templates;
CREATE POLICY "Controller deletes contract form templates" ON public.contract_form_templates FOR DELETE USING (public.is_controller());
DROP POLICY IF EXISTS "Controller reads contract form pdf opens" ON public.contract_form_pdf_opens;
CREATE POLICY "Controller reads contract form pdf opens" ON public.contract_form_pdf_opens FOR SELECT USING (public.is_controller());

-- 5) Payroll rules (row 62): the table whole, and the rule application restated word for word from 20260704140000
-- with the controller beside the dev in its gate.
DROP POLICY IF EXISTS controller_all_payroll_rules ON public.mercury_tally_payroll_rules;
CREATE POLICY controller_all_payroll_rules ON public.mercury_tally_payroll_rules FOR ALL USING (public.is_controller()) WITH CHECK (public.is_controller());

CREATE OR REPLACE FUNCTION public.bulk_apply_tally_payroll_rule_flags(p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_count integer;
BEGIN
  IF NOT (is_dev() OR is_controller()) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
  WITH rows AS (
    SELECT (x->>'mercury_transaction_id')::uuid AS tx, (x->>'rule_id')::uuid AS rule
    FROM jsonb_array_elements(p_rows) x
  ), ins AS (
    INSERT INTO mercury_tally_payroll_flags (mercury_transaction_id, is_payroll, source, rule_id, created_by)
    SELECT r.tx, true, 'rule', r.rule, auth.uid() FROM rows r
    WHERE NOT EXISTS (SELECT 1 FROM mercury_transaction_job_allocations a WHERE a.mercury_transaction_id = r.tx)
    ON CONFLICT (mercury_transaction_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;
  RETURN v_count;
END $fn$;
