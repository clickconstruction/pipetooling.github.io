-- Overhead ACH/wire/check attribution probe (Phase 0 of the non-card attribution plan)
-- Read-only. Run against the linked DB (CLI/psql or an authorized read-only MCP session —
-- not the Dashboard SQL editor).
--
-- Purpose: measure how much non-card money movement (ACH, wire, check, manual imports)
-- in the trailing 90 days is NOT attributed to any job — the structural undercount in
-- the 90-day overhead pool (People → Overhead / Review). Also produces the counterparty
-- seed list for auto-attribution rules and the before/after baseline for the rollout.
--
-- "Resolved" here mirrors the linked-card tally queue's semantics
-- (supabase/migrations/20260709160000_payroll_counts_as_linked.sql):
--   job splits  OR  supply-house invoice link  OR  payroll flag (is_payroll=true)
--   OR an Internal Transfers drag-sort label (not an expense at all).

-- 1) Kind distribution — the landscape (all kinds, money out vs in)
SELECT kind,
       count(*)                                                   AS tx_count,
       round(sum(CASE WHEN amount < 0 THEN -amount ELSE 0 END)::numeric, 2) AS outflow_usd,
       round(sum(CASE WHEN amount > 0 THEN  amount ELSE 0 END)::numeric, 2) AS inflow_usd
FROM public.mercury_transactions
WHERE posted_at >= now() - interval '90 days'
GROUP BY kind
ORDER BY outflow_usd DESC;

-- 2) Non-card scope, classified (money-out only; duplicates excluded)
WITH scope AS (
  SELECT t.id, t.kind, t.amount, t.counterparty_name, t.posted_at
  FROM public.mercury_transactions t
  WHERE t.posted_at >= now() - interval '90 days'
    AND t.kind <> 'debitCardTransaction'
    AND t.duplicate_of_transaction_id IS NULL
    AND t.amount < 0
), classified AS (
  SELECT s.*,
    EXISTS (SELECT 1 FROM public.mercury_transaction_job_allocations a
            WHERE a.mercury_transaction_id = s.id)                                    AS has_job_alloc,
    EXISTS (SELECT 1 FROM public.mercury_transaction_supply_house_invoice_links l
            WHERE l.mercury_transaction_id = s.id)                                    AS has_invoice_link,
    EXISTS (SELECT 1 FROM public.mercury_tally_payroll_flags pf
            WHERE pf.mercury_transaction_id = s.id AND pf.is_payroll)                 AS is_payroll,
    EXISTS (SELECT 1
            FROM public.mercury_transaction_drag_sort_assignments dsa
            JOIN public.mercury_drag_sort_labels dl ON dl.id = dsa.label_id
            WHERE dsa.mercury_transaction_id = s.id
              AND dl.default_key = 'internal_transfers')                      AS is_internal_transfer
  FROM scope s
)
SELECT CASE
         WHEN is_internal_transfer THEN 'internal_transfer (excluded)'
         WHEN has_job_alloc        THEN 'attributed (job splits)'
         WHEN has_invoice_link     THEN 'resolved (invoice link)'
         WHEN is_payroll           THEN 'resolved (payroll)'
         ELSE 'UNATTRIBUTED'
       END                                              AS class,
       count(*)                                         AS tx_count,
       round(sum(-amount)::numeric, 2)                  AS outflow_usd
FROM classified
GROUP BY 1
ORDER BY outflow_usd DESC;

-- 3) Top unattributed counterparties (the rule seed list)
WITH scope AS (
  SELECT t.id, t.kind, t.amount, t.counterparty_name
  FROM public.mercury_transactions t
  WHERE t.posted_at >= now() - interval '90 days'
    AND t.kind <> 'debitCardTransaction'
    AND t.duplicate_of_transaction_id IS NULL
    AND t.amount < 0
    AND NOT EXISTS (SELECT 1 FROM public.mercury_transaction_job_allocations a
                    WHERE a.mercury_transaction_id = t.id)
    AND NOT EXISTS (SELECT 1 FROM public.mercury_transaction_supply_house_invoice_links l
                    WHERE l.mercury_transaction_id = t.id)
    AND NOT EXISTS (SELECT 1 FROM public.mercury_tally_payroll_flags pf
                    WHERE pf.mercury_transaction_id = t.id AND pf.is_payroll)
    AND NOT EXISTS (SELECT 1
                    FROM public.mercury_transaction_drag_sort_assignments dsa
                    JOIN public.mercury_drag_sort_labels dl ON dl.id = dsa.label_id
                    WHERE dsa.mercury_transaction_id = t.id
                      AND dl.default_key = 'internal_transfers')
)
SELECT coalesce(nullif(trim(counterparty_name), ''), '(no counterparty)') AS counterparty,
       string_agg(DISTINCT kind, ', ')                                    AS kinds,
       count(*)                                                           AS tx_count,
       round(sum(-amount)::numeric, 2)                                    AS outflow_usd
FROM scope
GROUP BY 1
ORDER BY outflow_usd DESC
LIMIT 25;

-- 4) Current office-job attribution baseline (what the pool receives today, by source kind)
WITH office AS (
  SELECT value_text AS office_job_id
  FROM public.app_settings
  WHERE key = 'overhead_office_job_ledger_id_v1'
)
SELECT t.kind,
       count(*)                                          AS allocated_tx_count,
       round(sum(abs(a.amount))::numeric, 2)             AS office_allocated_usd
FROM public.mercury_transaction_job_allocations a
JOIN public.mercury_transactions t ON t.id = a.mercury_transaction_id
JOIN office o ON a.job_id::text = o.office_job_id
WHERE t.posted_at >= now() - interval '90 days'
GROUP BY t.kind
ORDER BY office_allocated_usd DESC;

-- 5) Labeled-but-unattributed overhead-category spend (candidates that already have a
--    Schedule C label suggesting true overhead — rent/insurance/software/utilities —
--    but no job attribution, so the pool never sees them)
WITH scope AS (
  SELECT t.id, t.amount, t.counterparty_name
  FROM public.mercury_transactions t
  WHERE t.posted_at >= now() - interval '90 days'
    AND t.kind <> 'debitCardTransaction'
    AND t.duplicate_of_transaction_id IS NULL
    AND t.amount < 0
    AND NOT EXISTS (SELECT 1 FROM public.mercury_transaction_job_allocations a
                    WHERE a.mercury_transaction_id = t.id)
)
SELECT dl.default_key,
       dl.name                                            AS label_name,
       count(*)                                           AS tx_count,
       round(sum(-s.amount)::numeric, 2)                  AS outflow_usd
FROM scope s
JOIN public.mercury_transaction_drag_sort_assignments dsa ON dsa.mercury_transaction_id = s.id
JOIN public.mercury_drag_sort_labels dl ON dl.id = dsa.label_id
WHERE dl.default_key IS DISTINCT FROM 'internal_transfers'
GROUP BY dl.default_key, dl.name
ORDER BY outflow_usd DESC;
