SET lock_timeout = '3s';

-- Delete eight ZZ test estimates (v2.7051).
--
-- Estimates 167, 168, 169, 175, 176, 177, 189 and 190 were made on walks of the
-- app, under the two test customers "ZZ Walk Press Answers" and
-- "ZZ Test Walk 2026-11-08". They are sent, declined or accepted, and the
-- policies estimates_delete_draft / estimates_update_draft let no signed-in
-- account delete an estimate that is not a draft. So the app cannot take them
-- out, and they showed in the Estimates lists and in the counts read from them.
--
-- The delete cannot reach a real estimate. A row goes only when ALL of these hold:
--   * its number is one of the eight,
--   * its customer's name starts with ZZ,
--   * no job and no bid is tied to it.
-- A second run matches nothing and deletes nothing.
--
-- No table is created, so there is no fence call. The two ZZ customers stay.
-- What goes with each estimate, and how to bring one back:
-- docs/migrations/20261112200000_delete_zz_test_estimates.md

DO $$
DECLARE
  gone integer;
BEGIN
  DELETE FROM public.estimates e
  USING public.customers c
  WHERE c.id = e.customer_id
    AND c.name LIKE 'ZZ%'
    AND e.estimate_number IN (167, 168, 169, 175, 176, 177, 189, 190)
    AND e.job_ledger_id IS NULL
    AND e.bid_id IS NULL;

  GET DIAGNOSTICS gone = ROW_COUNT;
  RAISE NOTICE 'delete_zz_test_estimates: % estimate(s) deleted', gone;
END $$;
