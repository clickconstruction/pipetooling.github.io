-- payments_made drift audit (FRAGILITY_REMEDIATION_PLAN.md step B1)
-- Read-only. Run against the linked DB (CLI/psql — not the Dashboard SQL editor).
-- Classifies every jobs_ledger row by whether payments_made agrees with
-- SUM(jobs_ledger_payments.amount). Three classes:
--   consistent  — column ≈ row sum (±0.005 for numeric noise)
--   drift       — rows exist but the column disagrees (the path-E race /
--                 non-transactional client failures; fix = recompute, B2)
--   historical  — payments_made > 0 with ZERO rows (the table predates
--                 2026-03 and was created with no backfill; fix = synthesize
--                 tagged rows, B2 — do NOT blanket-recompute these to 0)

-- 1) Class counts + dollar totals (the headline numbers to record in the plan)
WITH sums AS (
  SELECT j.id,
         COALESCE(j.payments_made, 0) AS pm,
         COALESCE((SELECT SUM(p.amount) FROM public.jobs_ledger_payments p WHERE p.job_id = j.id), 0) AS row_sum,
         EXISTS (SELECT 1 FROM public.jobs_ledger_payments p WHERE p.job_id = j.id) AS has_rows
  FROM public.jobs_ledger j
)
SELECT CASE
         WHEN ABS(pm - row_sum) <= 0.005 THEN 'consistent'
         WHEN NOT has_rows AND pm > 0 THEN 'historical (no rows)'
         ELSE 'drift'
       END AS class,
       COUNT(*) AS jobs,
       ROUND(SUM(pm)::numeric, 2) AS payments_made_total,
       ROUND(SUM(row_sum)::numeric, 2) AS row_sum_total,
       ROUND(SUM(pm - row_sum)::numeric, 2) AS delta_total
FROM sums
GROUP BY 1
ORDER BY 1;

-- 2) Drift detail: every job whose rows disagree with the column
--    (job number, status, both figures, delta — for the B2 migration comment)
WITH sums AS (
  SELECT j.id, j.hcp_number, j.click_number, j.status,
         COALESCE(j.payments_made, 0) AS pm,
         COALESCE((SELECT SUM(p.amount) FROM public.jobs_ledger_payments p WHERE p.job_id = j.id), 0) AS row_sum,
         EXISTS (SELECT 1 FROM public.jobs_ledger_payments p WHERE p.job_id = j.id) AS has_rows
  FROM public.jobs_ledger j
)
SELECT id, COALESCE(NULLIF(hcp_number, ''), click_number) AS job_number, status,
       pm AS payments_made, row_sum, ROUND((pm - row_sum)::numeric, 2) AS delta
FROM sums
WHERE ABS(pm - row_sum) > 0.005 AND has_rows
ORDER BY ABS(pm - row_sum) DESC;

-- 3) Historical detail: payments_made > 0 with zero rows (B2 synthesis targets)
WITH sums AS (
  SELECT j.id, j.hcp_number, j.click_number, j.status, j.created_at,
         COALESCE(j.payments_made, 0) AS pm,
         EXISTS (SELECT 1 FROM public.jobs_ledger_payments p WHERE p.job_id = j.id) AS has_rows
  FROM public.jobs_ledger j
)
SELECT id, COALESCE(NULLIF(hcp_number, ''), click_number) AS job_number, status,
       pm AS payments_made, created_at::date AS job_created
FROM sums
WHERE NOT has_rows AND pm > 0
ORDER BY pm DESC;

-- 4) Sanity: negative or zero-amount payment rows (should be none; the money
--    input strips '-', and zero rows are filtered on insert since v2.1120, B4)
SELECT COUNT(*) FILTER (WHERE amount < 0) AS negative_rows,
       COUNT(*) FILTER (WHERE amount = 0) AS zero_rows
FROM public.jobs_ledger_payments;

-- 5) Sanity: paid-status jobs whose row sum does not cover revenue
--    (context for status-promotion checks; informational, not a defect list)
SELECT COUNT(*) AS paid_jobs_rowsum_below_revenue
FROM public.jobs_ledger j
WHERE j.status = 'paid'
  AND COALESCE((SELECT SUM(p.amount) FROM public.jobs_ledger_payments p WHERE p.job_id = j.id), 0)
      < COALESCE(j.revenue, 0) - 0.005;
