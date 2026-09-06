SET lock_timeout = '3s';

-- Tier 5 X3 (J7-9), T5-03: "Mark payroll" on the Job Parts Tally was dev-only at every
-- layer. The pay week is run by whoever has payroll access (dev, controller, a
-- pay-approved master — has_payroll_access()), so the manual flag follows that predicate.
-- Payroll auto-mark RULES (mercury_tally_payroll_rules, bulk_apply_tally_payroll_rule_flags)
-- stay dev-only: they are configuration, not the weekly chore.

DROP POLICY IF EXISTS dev_all_payroll_flags ON public.mercury_tally_payroll_flags;
DROP POLICY IF EXISTS payroll_access_all_payroll_flags ON public.mercury_tally_payroll_flags;
CREATE POLICY payroll_access_all_payroll_flags ON public.mercury_tally_payroll_flags
  FOR ALL USING (public.has_payroll_access()) WITH CHECK (public.has_payroll_access());

-- Same body as 20260704140000; only the authorization line changes.
CREATE OR REPLACE FUNCTION public.set_tally_payroll_flag(p_mercury_transaction_id uuid, p_is_payroll boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT public.has_payroll_access() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
  IF p_is_payroll AND EXISTS (SELECT 1 FROM mercury_transaction_job_allocations WHERE mercury_transaction_id = p_mercury_transaction_id) THEN
    RAISE EXCEPTION 'Transaction is allocated to jobs; remove job splits before marking payroll' USING ERRCODE='P0001';
  END IF;
  INSERT INTO mercury_tally_payroll_flags (mercury_transaction_id, is_payroll, source, rule_id, created_by, updated_at)
  VALUES (p_mercury_transaction_id, p_is_payroll, 'manual', NULL, auth.uid(), now())
  ON CONFLICT (mercury_transaction_id) DO UPDATE
    SET is_payroll = EXCLUDED.is_payroll, source = 'manual', rule_id = NULL, updated_at = now();
END $fn$;

COMMENT ON FUNCTION public.set_tally_payroll_flag(uuid, boolean) IS
  'Manual mark/unmark of a tally transaction as payroll (no job allocation). Authorization: has_payroll_access() since 20260906130000 (was is_dev()). Unmark writes a manual tombstone so rules never re-mark it.';
